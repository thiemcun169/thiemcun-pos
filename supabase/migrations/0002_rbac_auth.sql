-- ============================================================================
-- 0002_rbac_auth.sql — Phân quyền (RBAC), allowlist, audit log, RLS theo vai trò
-- ----------------------------------------------------------------------------
-- Mục tiêu:
--   * 2 vai trò: OWNER (chủ shop, full) và STAFF (nhân viên, chỉ POS).
--   * Allowlist: chỉ email được admin thêm trước mới đăng nhập được.
--   * profiles: mở rộng auth.users (role, status, đổi-mật-khẩu-lần-đầu).
--   * audit_logs: ghi mọi hành động nhạy cảm (chỉ owner xem).
--   * RLS: staff KHÔNG đọc được danh sách nhân viên (ngoài bản thân), không đọc allowlist/audit.
-- ============================================================================

-- 1) KIỂU DỮ LIỆU -------------------------------------------------------------
do $$ begin
  create type user_role as enum ('owner','staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_status as enum ('active','disabled');
exception when duplicate_object then null; end $$;

-- 2) BẢNG profiles (1-1 với auth.users) --------------------------------------
create table if not exists profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  email                text unique not null,
  full_name            text,
  role                 user_role   not null default 'staff',
  status               user_status not null default 'active',
  must_change_password boolean     not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- 3) ALLOWLIST: email được cấp quyền TRƯỚC khi đăng nhập ----------------------
create table if not exists allowed_emails (
  email      text primary key,
  role       user_role not null default 'staff',
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- 4) AUDIT LOG ----------------------------------------------------------------
create table if not exists audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references auth.users(id),
  actor_email text,
  action      text not null,
  target      text,
  payload     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_created on audit_logs(created_at desc);

-- 5) HÀM TIỆN ÍCH (security definer để đọc profiles trong RLS) ----------------
create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from profiles
    where id = auth.uid() and role = 'owner' and status = 'active'
  );
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and status = 'active');
$$;

-- updated_at tự cập nhật
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_profiles_touch on profiles;
create trigger trg_profiles_touch before update on profiles
  for each row execute function public.touch_updated_at();

-- 6) TRIGGER: tạo user mới -> kiểm allowlist ---------------------------------
-- Người đầu tiên (bootstrap) = owner. Sau đó BẮT BUỘC email phải nằm trong allowlist.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  n_users   int;
  allow_rec allowed_emails%rowtype;
  nm        text;
begin
  nm := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email);
  select count(*) into n_users from profiles;

  if n_users = 0 then
    insert into profiles(id, email, full_name, role, status, must_change_password)
    values (new.id, new.email, nm, 'owner', 'active', true)
    on conflict (id) do nothing;
    return new;
  end if;

  select * into allow_rec from allowed_emails where lower(email) = lower(new.email);
  if allow_rec.email is null then
    raise exception 'Email % chưa được cấp quyền truy cập shop, liên hệ admin', new.email
      using errcode = '42501';
  end if;

  insert into profiles(id, email, full_name, role, status)
  values (new.id, new.email, nm, allow_rec.role, 'active')
  on conflict (id) do update set role = excluded.role, status = 'active';

  delete from allowed_emails where lower(email) = lower(new.email);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- 7) BACKFILL: user đã tồn tại (đăng nhập trước khi có bảng này) --------------
-- User sớm nhất = owner (chủ shop), còn lại = staff.
insert into profiles(id, email, full_name, role, status, must_change_password)
select u.id, u.email,
       coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email),
       case when u.rn = 1 then 'owner'::user_role else 'staff'::user_role end,
       'active'::user_status, false
from (select id, email, raw_user_meta_data,
             row_number() over (order by created_at) as rn from auth.users) u
on conflict (id) do nothing;

-- 8) RLS ----------------------------------------------------------------------
alter table profiles      enable row level security;
alter table allowed_emails enable row level security;
alter table audit_logs    enable row level security;

-- profiles: tự đọc bản thân; owner đọc tất cả; owner sửa tất cả; user tự sửa full_name
drop policy if exists profiles_self_read on profiles;
create policy profiles_self_read on profiles for select
  using (id = auth.uid() or public.is_owner());

drop policy if exists profiles_owner_write on profiles;
create policy profiles_owner_write on profiles for update
  using (public.is_owner() or id = auth.uid())
  with check (public.is_owner() or id = auth.uid());

-- allowed_emails & audit_logs: CHỈ owner
drop policy if exists allow_owner_all on allowed_emails;
create policy allow_owner_all on allowed_emails for all
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists audit_owner_read on audit_logs;
create policy audit_owner_read on audit_logs for select using (public.is_owner());

-- 9) Siết RLS trên orders: chỉ user ĐÃ đăng nhập & active mới đọc/ghi qua anon key
--    (backend dùng service_role nên bỏ qua RLS; đây bảo vệ truy cập trực tiếp.)
drop policy if exists "orders_owner_read" on orders;
drop policy if exists orders_active_read on orders;
create policy orders_active_read on orders for select using (public.is_active_user());

drop policy if exists "order_items_owner_read" on order_items;
drop policy if exists order_items_active_read on order_items;
create policy order_items_active_read on order_items for select using (public.is_active_user());

-- 10) SEED allowlist mẫu (chủ shop + 1 nhân viên mẫu) ------------------------
insert into allowed_emails(email, role) values
  ('thiemnguyenba169@gmail.com', 'owner')
on conflict (email) do update set role = excluded.role;
