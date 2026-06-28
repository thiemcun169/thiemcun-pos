-- ============================================================================
-- 0005_multitenant.sql — Đa cửa hàng (MULTI-TENANT) · mô hình 1-user-1-shop
-- ----------------------------------------------------------------------------
-- Biến app 1-cửa-hàng thành nền tảng NHIỀU CỬA HÀNG dùng chung (free SaaS):
--   * Bảng `shops`        : mỗi cửa hàng = 1 dòng (tên, màu thương hiệu, logo…).
--   * Bảng `shop_members` : ai thuộc shop nào, vai trò gì (owner|staff).
--   * Thêm cột `shop_id`  : products / customers / orders / audit_logs gắn về 1 shop.
--   * RLS viết lại        : mỗi truy vấn tự lọc theo shop mà user là THÀNH VIÊN.
--
-- LUẬT NGHIỆP VỤ (theo yêu cầu user):
--   * 1 user = TỐI ĐA 1 cửa hàng ĐANG HOẠT ĐỘNG (active) tại 1 thời điểm.
--     -> unique index one_active_membership_per_user.
--   * Đăng ký KHÔNG tự tạo shop. User chọn vai trò ở màn onboarding:
--       (A) "Tôi là chủ"   -> tạo shop mới (owner).
--       (B) "Tôi là NV"    -> nhận lời mời bằng TOKEN (owner copy link /join?token=…).
--   * Mời nhân viên = tạo dòng status='pending_invite' + invite_token + hạn 7 ngày.
--     Chưa có dịch vụ gửi email -> owner tự gửi link cho NV (Zalo/SMS…).
--   * Rời shop -> status='left' (thành "orphan" -> onboarding lại). Owner phải
--     chuyển quyền hoặc xoá shop trước khi rời.
--
-- AN TOÀN (expand → contract): file CHỈ THÊM. Drop legacy (profiles.role,
--   allowed_emails, shop_settings) để dành 0006 SAU KHI prod xác nhận ổn.
--
-- KỸ THUẬT: backend dùng service_role -> BỎ QUA RLS -> cách ly shop ép ở tầng
--   truy vấn (mọi hàm DB nhận shop_id). RLS = lớp phòng thủ thứ 2.
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- 1) ENUM trạng thái thành viên ----------------------------------------------
do $$ begin
  create type member_status as enum ('pending_invite','active','disabled','left');
exception when duplicate_object then null; end $$;

-- 2) BẢNG shops ---------------------------------------------------------------
create table if not exists shops (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null default 'Cửa hàng của tôi',
  slug                text unique,
  color_primary       text not null default '#008060',
  color_secondary     text not null default '#004c3f',
  logo_url            text,
  address             text,
  hotline             text,
  created_by          uuid references auth.users(id),
  is_active           boolean not null default true,
  transferred_owner_at timestamptz,
  settings            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists trg_shops_touch on shops;
create trigger trg_shops_touch before update on shops
  for each row execute function public.touch_updated_at();

-- 3) BẢNG shop_members --------------------------------------------------------
create table if not exists shop_members (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid not null references shops(id) on delete cascade,
  user_id           uuid references auth.users(id) on delete cascade,
  role              user_role     not null default 'staff',
  status            member_status not null default 'pending_invite',
  invited_email     text,
  invited_by        uuid references auth.users(id),
  invite_token      uuid,
  invite_expires_at timestamptz,
  joined_at         timestamptz,
  created_at        timestamptz not null default now()
);

-- 1 user chỉ 1 dòng / shop; 1 email-mời chỉ 1 / shop; token tra cứu nhanh.
create unique index if not exists uq_member_shop_user
  on shop_members(shop_id, user_id) where user_id is not null;
create unique index if not exists uq_member_shop_email
  on shop_members(shop_id, lower(invited_email)) where invited_email is not null;
-- LUẬT 1-shop: mỗi user chỉ 1 membership ACTIVE trên toàn hệ thống.
create unique index if not exists one_active_membership_per_user
  on shop_members(user_id) where status = 'active' and user_id is not null;
create index if not exists idx_member_user  on shop_members(user_id);
create index if not exists idx_member_token on shop_members(invite_token);

-- 4) THÊM CỘT shop_id (additive) ---------------------------------------------
alter table products   add column if not exists shop_id uuid references shops(id) on delete cascade;
alter table customers  add column if not exists shop_id uuid references shops(id) on delete cascade;
alter table orders     add column if not exists shop_id uuid references shops(id) on delete cascade;
alter table audit_logs add column if not exists shop_id uuid references shops(id) on delete cascade;

create index if not exists idx_products_shop  on products(shop_id);
create index if not exists idx_customers_shop on customers(shop_id);
create index if not exists idx_orders_shop    on orders(shop_id);
create index if not exists idx_audit_shop     on audit_logs(shop_id);

-- 5) HÀM TIỆN ÍCH cho RLS (security definer) ---------------------------------
create or replace function public.user_shop_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select shop_id from shop_members where user_id = auth.uid() and status = 'active';
$$;

create or replace function public.is_shop_member(p_shop uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from shop_members
    where shop_id = p_shop and user_id = auth.uid() and status = 'active');
$$;

create or replace function public.is_shop_owner(p_shop uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from shop_members
    where shop_id = p_shop and user_id = auth.uid() and role = 'owner' and status = 'active');
$$;

create or replace function public.current_email()
returns text language sql stable as $$
  select lower(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', ''));
$$;

-- 6) BACKFILL: gom dữ liệu cũ vào 1 shop "ThiemCun Demo Shop" -----------------
-- Chỉ chạy khi CÓ dữ liệu cũ (products) và CHƯA có shop nào -> tránh tạo shop rỗng
-- và an toàn nếu migration lỡ chạy lại. Chủ = user sớm nhất (hoặc NULL nếu chưa ai).
do $$
declare
  v_owner uuid;
  v_shop  uuid;
begin
  if exists (select 1 from shops) then return; end if;
  if not exists (select 1 from products) then return; end if;  -- DB sạch -> bỏ qua

  select id into v_owner from profiles where role = 'owner' order by created_at asc limit 1;
  if v_owner is null then
    select id into v_owner from auth.users order by created_at asc limit 1;
  end if;

  insert into shops(name, slug, created_by, color_primary, color_secondary)
    values ('ThiemCun Demo Shop', 'thiemcun-demo', v_owner, '#008060', '#004c3f')
    returning id into v_shop;

  update products   set shop_id = v_shop where shop_id is null;
  update customers  set shop_id = v_shop where shop_id is null;
  update orders     set shop_id = v_shop where shop_id is null;
  update audit_logs set shop_id = v_shop where shop_id is null;

  -- Thành viên = mọi profile hiện có (giữ owner/staff). 1 owner active đầu tiên.
  insert into shop_members(shop_id, user_id, role, status, joined_at, invited_email)
    select v_shop, p.id, p.role, 'active', now(), p.email
    from profiles p
    on conflict do nothing;

  -- Bảo đảm chủ shop là OWNER: nâng nếu đã là thành viên (vd bị chèn 'staff' theo
  -- profiles.role), chèn nếu chưa có. (Trước đây chỉ insert-nếu-thiếu -> có thể không owner.)
  if v_owner is not null then
    update shop_members set role = 'owner', status = 'active'
      where shop_id = v_shop and user_id = v_owner;
    if not found then
      insert into shop_members(shop_id, user_id, role, status, joined_at)
        values (v_shop, v_owner, 'owner', 'active', now());
    end if;
  end if;
end $$;

-- shop_id BẮT BUỘC sau backfill (mọi dữ liệu cũ đã gắn shop; insert mới phải có shop).
alter table products  alter column shop_id set not null;
alter table customers alter column shop_id set not null;
alter table orders    alter column shop_id set not null;
-- audit_logs.shop_id để NULLABLE (có thể có log cấp hệ thống).

-- 7) TRIGGER user mới: KHÔNG tự tạo shop (user chọn vai trò ở onboarding) ------
-- Chỉ đảm bảo có dòng profiles (tương thích phần cũ). Không tạo shop, không auto-join.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  nm := coalesce(new.raw_user_meta_data->>'full_name',
                 new.raw_user_meta_data->>'name',
                 split_part(new.email, '@', 1));
  insert into profiles(id, email, full_name, role, status, must_change_password)
    values (new.id, new.email, nm, 'staff', 'active', false)
    on conflict (id) do update set email = excluded.email,
      full_name = coalesce(profiles.full_name, excluded.full_name);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- 8) RLS theo thành viên shop ------------------------------------------------
alter table shops        enable row level security;
alter table shop_members enable row level security;

drop policy if exists shops_member_read on shops;
create policy shops_member_read on shops for select
  using (id in (select user_shop_ids()));

drop policy if exists shops_owner_update on shops;
create policy shops_owner_update on shops for update
  using (public.is_shop_owner(id)) with check (public.is_shop_owner(id));

drop policy if exists shops_self_insert on shops;
create policy shops_self_insert on shops for insert
  with check (auth.uid() is not null and created_by = auth.uid());

drop policy if exists members_read on shop_members;
create policy members_read on shop_members for select
  using (shop_id in (select user_shop_ids())
         or (invited_email is not null and lower(invited_email) = public.current_email()));

drop policy if exists members_owner_manage on shop_members;
create policy members_owner_manage on shop_members for all
  using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id));

drop policy if exists "products_read_all" on products;
drop policy if exists products_read_all on products;
drop policy if exists products_shop_all on products;
create policy products_shop_all on products for all
  using (shop_id in (select user_shop_ids())) with check (shop_id in (select user_shop_ids()));

drop policy if exists customers_shop_all on customers;
create policy customers_shop_all on customers for all
  using (shop_id in (select user_shop_ids())) with check (shop_id in (select user_shop_ids()));

drop policy if exists "orders_owner_read" on orders;
drop policy if exists orders_active_read on orders;
drop policy if exists orders_shop_all on orders;
create policy orders_shop_all on orders for all
  using (shop_id in (select user_shop_ids())) with check (shop_id in (select user_shop_ids()));

drop policy if exists "order_items_owner_read" on order_items;
drop policy if exists order_items_active_read on order_items;
drop policy if exists order_items_shop_all on order_items;
create policy order_items_shop_all on order_items for all
  using (exists (select 1 from orders o where o.id = order_items.order_id
                 and o.shop_id in (select user_shop_ids())))
  with check (exists (select 1 from orders o where o.id = order_items.order_id
                 and o.shop_id in (select user_shop_ids())));

drop policy if exists audit_owner_read on audit_logs;
drop policy if exists audit_shop_owner_read on audit_logs;
create policy audit_shop_owner_read on audit_logs for select
  using (shop_id is not null and public.is_shop_owner(shop_id));

-- 9) View thống kê khách hàng + shop_id --------------------------------------
create or replace view customer_stats as
select c.id, c.name, c.phone, c.created_at,
       count(o.id)               as purchase_count,
       coalesce(sum(o.total), 0) as total_spent,
       c.shop_id
from customers c
left join orders o on o.customer_id = c.id
group by c.id, c.name, c.phone, c.created_at, c.shop_id;

-- ============================================================================
-- 0006 (sau khi prod ổn) sẽ contract: drop profiles.role / allowed_emails /
-- shop_settings. KHÔNG làm ở đây để an toàn rollback.
-- ============================================================================
