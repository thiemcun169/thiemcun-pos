-- ============================================================================
-- 0004_phase10_slice1.sql — Mở rộng sản phẩm + shop_settings + thống kê khách
-- (Slice 1: Product edit/delete · Customer DB · Shop settings)
-- ============================================================================

-- 1) Sản phẩm: thêm ảnh/mô tả/ngưỡng tồn thấp + soft delete
alter table products add column if not exists image_url           text;
alter table products add column if not exists description         text;
alter table products add column if not exists low_stock_threshold integer not null default 5;
alter table products add column if not exists deleted_at          timestamptz;

-- 2) Thông tin cửa hàng (1 dòng duy nhất)
create table if not exists shop_settings (
  id         boolean primary key default true,
  name       text not null default 'ThiemCun Shop',
  address    text,
  hotline    text,
  logo_url   text,
  updated_at timestamptz not null default now(),
  constraint shop_settings_singleton check (id)
);
insert into shop_settings (id, name) values (true, 'ThiemCun Shop') on conflict (id) do nothing;

alter table shop_settings enable row level security;
drop policy if exists shop_read_all on shop_settings;
create policy shop_read_all on shop_settings for select using (true);
drop policy if exists shop_owner_write on shop_settings;
create policy shop_owner_write on shop_settings for all
  using (public.is_owner()) with check (public.is_owner());

-- 3) Thống kê khách hàng (lượt mua + tổng chi tiêu) cho trang Khách hàng
create or replace view customer_stats as
select c.id, c.name, c.phone, c.created_at,
       count(o.id)                  as purchase_count,
       coalesce(sum(o.total), 0)    as total_spent
from customers c
left join orders o on o.customer_id = c.id
group by c.id, c.name, c.phone, c.created_at;
