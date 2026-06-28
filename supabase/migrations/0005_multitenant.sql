-- ============================================================================
-- 0005_multitenant.sql — Đa cửa hàng (MULTI-TENANT)
-- ----------------------------------------------------------------------------
-- Biến app 1-cửa-hàng thành nền tảng NHIỀU CỬA HÀNG dùng chung (free SaaS):
--   * Bảng `shops`        : mỗi cửa hàng = 1 dòng (tên, màu thương hiệu, logo…).
--   * Bảng `shop_members` : ai thuộc shop nào, vai trò gì (owner|staff), mời theo email.
--   * Thêm cột `shop_id`  : products / customers / orders / audit_logs gắn về 1 shop.
--   * RLS viết lại        : mỗi truy vấn tự lọc theo shop mà user là THÀNH VIÊN.
--   * Đăng ký mới         : tự tạo 1 shop cho user; nếu được mời thì vào shop người mời.
--
-- NGUYÊN TẮC AN TOÀN (expand → contract):
--   File này CHỈ THÊM (additive). KHÔNG xoá `profiles.role`/`allowed_emails`/
--   `shop_settings` ở đây — để bản cũ vẫn chạy nếu cần rollback. Việc dọn dẹp
--   (drop cột/bảng cũ) để dành cho migration 0006 SAU KHI prod đã xác nhận chạy ổn.
--
-- LƯU Ý KỸ THUẬT: backend dùng service_role -> BỎ QUA RLS. Vì vậy cách ly cửa
--   hàng THẬT SỰ được ép ở tầng backend (luôn lọc theo shop_id). RLS ở đây là
--   lớp phòng thủ thứ 2 (chặn ai gọi thẳng PostgREST bằng anon/authenticated key).
--
-- Không bọc BEGIN/COMMIT thủ công: `supabase db push` đã chạy mỗi file trong 1
--   transaction (giống 0001–0004). Mọi lệnh đều idempotent (if not exists / on conflict).
-- ============================================================================

create extension if not exists pgcrypto;   -- cho gen_random_uuid()

-- 1) KIỂU TRẠNG THÁI THÀNH VIÊN ----------------------------------------------
-- Thêm 'pending' (đã mời, chờ nhận) so với user_status cũ (active|disabled).
do $$ begin
  create type member_status as enum ('active','disabled','pending');
exception when duplicate_object then null; end $$;

-- 2) BẢNG shops ---------------------------------------------------------------
create table if not exists shops (
  id              uuid primary key default gen_random_uuid(),
  name            text not null default 'Cửa hàng của tôi',
  slug            text unique,
  color_primary   text not null default '#008060',
  color_secondary text not null default '#004c3f',
  logo_url        text,
  address         text,
  hotline         text,
  created_by      uuid references auth.users(id),
  settings        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_shops_touch on shops;
create trigger trg_shops_touch before update on shops
  for each row execute function public.touch_updated_at();

-- 3) BẢNG shop_members --------------------------------------------------------
-- 1 user có thể là OWNER shop A và STAFF shop B (multi-shop). Mời theo email:
-- tạo dòng status='pending', user_id=NULL; khi người đó đăng nhập -> khớp email
-- -> set user_id + status='active'.
create table if not exists shop_members (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references shops(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  role          user_role     not null default 'staff',
  status        member_status not null default 'pending',
  invited_email text,
  invited_by    uuid references auth.users(id),
  joined_at     timestamptz,
  created_at    timestamptz not null default now()
);

-- Mỗi user chỉ 1 dòng / shop; mỗi email-mời chỉ 1 lời mời / shop.
create unique index if not exists uq_member_shop_user
  on shop_members(shop_id, user_id) where user_id is not null;
create unique index if not exists uq_member_shop_email
  on shop_members(shop_id, lower(invited_email)) where invited_email is not null;
create index if not exists idx_member_user   on shop_members(user_id);
create index if not exists idx_member_email  on shop_members(lower(invited_email));

-- 4) THÊM CỘT shop_id (additive) ---------------------------------------------
alter table products   add column if not exists shop_id uuid references shops(id) on delete cascade;
alter table customers  add column if not exists shop_id uuid references shops(id) on delete cascade;
alter table orders     add column if not exists shop_id uuid references shops(id) on delete cascade;
alter table audit_logs add column if not exists shop_id uuid references shops(id) on delete cascade;

create index if not exists idx_products_shop   on products(shop_id);
create index if not exists idx_customers_shop  on customers(shop_id);
create index if not exists idx_orders_shop     on orders(shop_id);
create index if not exists idx_audit_shop      on audit_logs(shop_id);

-- 5) HÀM TIỆN ÍCH cho RLS (security definer để đọc shop_members an toàn) ------
create or replace function public.user_shop_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select shop_id from shop_members where user_id = auth.uid() and status = 'active';
$$;

create or replace function public.is_shop_member(p_shop uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from shop_members
    where shop_id = p_shop and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.is_shop_owner(p_shop uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from shop_members
    where shop_id = p_shop and user_id = auth.uid()
      and role = 'owner' and status = 'active'
  );
$$;

-- email của user hiện tại (từ JWT) — dùng để user tự thấy lời mời gửi cho mình.
create or replace function public.current_email()
returns text language sql stable as $$
  select lower(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', ''));
$$;

-- 6) BACKFILL: gom toàn bộ dữ liệu cũ vào 1 shop "ThiemCun Demo Shop" ---------
-- Chủ shop = owner sớm nhất trong profiles (hoặc user sớm nhất). Chạy 1 lần
-- (chỉ khi CHƯA có shop nào) -> an toàn khi migration lỡ chạy lại.
do $$
declare
  v_owner uuid;
  v_shop  uuid;
begin
  if exists (select 1 from shops) then
    return;  -- đã có shop -> bỏ qua backfill
  end if;

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

  -- Thành viên = mọi profile hiện có (giữ nguyên vai trò owner/staff).
  insert into shop_members(shop_id, user_id, role, status, joined_at, invited_email)
    select v_shop, p.id, p.role, 'active', now(), p.email
    from profiles p
    on conflict do nothing;

  -- Bảo đảm chủ shop là owner kể cả khi chưa có profile.
  if v_owner is not null
     and not exists (select 1 from shop_members where shop_id = v_shop and user_id = v_owner) then
    insert into shop_members(shop_id, user_id, role, status, joined_at)
      values (v_shop, v_owner, 'owner', 'active', now());
  end if;
end $$;

-- 7) TRIGGER user mới: tạo shop riêng + nhận mọi lời mời theo email -----------
-- KHÁC bản cũ: KHÔNG còn chặn theo allowlist. Ai đăng ký cũng có shop của mình
-- (mô hình free SaaS). Nếu được mời sẵn -> vào shop người mời (không tạo shop rác).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  nm       text;
  v_shop   uuid;
begin
  nm := coalesce(new.raw_user_meta_data->>'full_name',
                 new.raw_user_meta_data->>'name',
                 split_part(new.email, '@', 1));

  -- Giữ profiles cho tương thích (role/status ở đây KHÔNG còn là nguồn sự thật phân quyền).
  insert into profiles(id, email, full_name, role, status, must_change_password)
    values (new.id, new.email, nm, 'staff', 'active', false)
    on conflict (id) do update set email = excluded.email, full_name = coalesce(profiles.full_name, excluded.full_name);

  -- (1) Kích hoạt mọi lời mời đang chờ gửi tới email này.
  update shop_members
     set user_id = new.id, status = 'active', joined_at = now()
   where user_id is null
     and status = 'pending'
     and lower(invited_email) = lower(new.email);

  -- (2) Nếu user chưa thuộc shop nào -> tạo shop riêng (làm owner).
  if not exists (select 1 from shop_members where user_id = new.id and status = 'active') then
    insert into shops(name, created_by)
      values ('Shop của ' || nm, new.id)
      returning id into v_shop;
    insert into shop_members(shop_id, user_id, role, status, joined_at)
      values (v_shop, new.id, 'owner', 'active', now());
  end if;

  return new;
end $$;

-- trigger đã tồn tại từ 0002 (on_auth_user_created) -> dùng lại hàm mới ở trên.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- 8) RLS VIẾT LẠI THEO THÀNH VIÊN SHOP ---------------------------------------
alter table shops        enable row level security;
alter table shop_members enable row level security;

-- shops: thành viên đọc shop của mình; owner sửa; user đã đăng nhập tạo shop mới (của mình).
drop policy if exists shops_member_read on shops;
create policy shops_member_read on shops for select
  using (id in (select user_shop_ids()));

drop policy if exists shops_owner_update on shops;
create policy shops_owner_update on shops for update
  using (public.is_shop_owner(id)) with check (public.is_shop_owner(id));

drop policy if exists shops_self_insert on shops;
create policy shops_self_insert on shops for insert
  with check (auth.uid() is not null and created_by = auth.uid());

-- shop_members: thành viên đọc danh sách thành viên shop mình; thấy lời mời gửi cho email mình;
-- owner toàn quyền quản lý thành viên trong shop của họ.
drop policy if exists members_read on shop_members;
create policy members_read on shop_members for select
  using (shop_id in (select user_shop_ids())
         or (invited_email is not null and lower(invited_email) = public.current_email()));

drop policy if exists members_owner_manage on shop_members;
create policy members_owner_manage on shop_members for all
  using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id));

-- products: thay policy "đọc công khai" cũ bằng lọc theo shop của thành viên.
drop policy if exists "products_read_all" on products;
drop policy if exists products_read_all on products;
drop policy if exists products_shop_all on products;
create policy products_shop_all on products for all
  using (shop_id in (select user_shop_ids()))
  with check (shop_id in (select user_shop_ids()));

-- customers
drop policy if exists customers_shop_all on customers;
create policy customers_shop_all on customers for all
  using (shop_id in (select user_shop_ids()))
  with check (shop_id in (select user_shop_ids()));

-- orders: bỏ policy cũ theo is_active_user, thay bằng theo shop.
drop policy if exists "orders_owner_read" on orders;
drop policy if exists orders_active_read on orders;
drop policy if exists orders_shop_all on orders;
create policy orders_shop_all on orders for all
  using (shop_id in (select user_shop_ids()))
  with check (shop_id in (select user_shop_ids()));

-- order_items: theo shop của ĐƠN cha.
drop policy if exists "order_items_owner_read" on order_items;
drop policy if exists order_items_active_read on order_items;
drop policy if exists order_items_shop_all on order_items;
create policy order_items_shop_all on order_items for all
  using (exists (select 1 from orders o
                 where o.id = order_items.order_id
                   and o.shop_id in (select user_shop_ids())))
  with check (exists (select 1 from orders o
                 where o.id = order_items.order_id
                   and o.shop_id in (select user_shop_ids())));

-- audit_logs: chỉ OWNER của shop đó đọc.
drop policy if exists audit_owner_read on audit_logs;
drop policy if exists audit_shop_owner_read on audit_logs;
create policy audit_shop_owner_read on audit_logs for select
  using (shop_id is not null and public.is_shop_owner(shop_id));

-- 9) View thống kê khách hàng: BỔ SUNG shop_id để lọc theo từng shop ----------
-- (create or replace chỉ cho thêm cột ở CUỐI -> shop_id đặt sau cùng.)
create or replace view customer_stats as
select c.id, c.name, c.phone, c.created_at,
       count(o.id)               as purchase_count,
       coalesce(sum(o.total), 0) as total_spent,
       c.shop_id
from customers c
left join orders o on o.customer_id = c.id
group by c.id, c.name, c.phone, c.created_at, c.shop_id;

-- ============================================================================
-- KẾT THÚC 0005. Sau khi prod xác nhận chạy ổn -> 0006 sẽ "contract":
--   drop column profiles.role (suy ra từ shop_members), drop table allowed_emails,
--   drop table shop_settings (đã thay bằng shops). KHÔNG làm ở đây để an toàn rollback.
-- ============================================================================
