-- ============================================================================
-- ThiemCun POS — Schema Postgres cho Supabase
-- Chạy trong: Supabase Dashboard -> SQL Editor -> dán & Run.
-- (Hoặc nhờ Claude chạy qua Supabase MCP — xem HANDSON.md buổi 2, Lab 2.)
--
-- Gồm: 4 bảng (products, customers, orders, order_items) + khoá ngoại
--      + bật RLS (Row Level Security) + policy + dữ liệu mẫu (~20 sp, 5 khách).
-- ============================================================================

-- 1) BẢNG ---------------------------------------------------------------------
create table if not exists products (
  id          bigint generated always as identity primary key,
  name        text not null,
  sku         text,
  category    text,
  price       numeric(12,0) not null default 0,   -- VND, số nguyên đồng
  stock       integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists customers (
  id          bigint generated always as identity primary key,
  name        text not null,
  phone       text,
  created_at  timestamptz not null default now()
);

create table if not exists orders (
  id          bigint generated always as identity primary key,
  customer_id bigint references customers(id) on delete set null,
  user_id     uuid,                                -- ai tạo đơn (Supabase Auth)
  total       numeric(12,0) not null default 0,
  status      text not null default 'paid',
  created_at  timestamptz not null default now()
);

-- Khoá ngoại order_id -> orders.id giúp PostgREST hiểu quan hệ
-- để truy vấn lồng: /orders?select=*,order_items(*)
create table if not exists order_items (
  id           bigint generated always as identity primary key,
  order_id     bigint not null references orders(id) on delete cascade,
  product_id   bigint references products(id) on delete set null,
  product_name text not null,
  qty          integer not null,
  unit_price   numeric(12,0) not null,
  line_total   numeric(12,0) not null
);

create index if not exists idx_order_items_order on order_items(order_id);
create index if not exists idx_orders_user on orders(user_id);

-- 2) ROW LEVEL SECURITY -------------------------------------------------------
-- Nguyên tắc: BẬT RLS = mặc định KHOÁ hết, rồi mở từng việc bằng policy.
-- LƯU Ý: backend FastAPI dùng service_role key -> BỎ QUA RLS (toàn quyền).
-- RLS ở đây bảo vệ trường hợp ai đó dùng anon key gọi thẳng PostgREST.
alter table products    enable row level security;
alter table customers   enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;

-- Catalog sản phẩm: cho phép đọc công khai (an toàn, chỉ là danh mục hàng).
drop policy if exists "products_read_all" on products;
create policy "products_read_all" on products
  for select using (true);

-- Khách & đơn: KHÔNG mở cho anon. Chỉ người đã đăng nhập đọc đơn của CHÍNH MÌNH.
drop policy if exists "orders_owner_read" on orders;
create policy "orders_owner_read" on orders
  for select using (auth.uid() = user_id);

drop policy if exists "order_items_owner_read" on order_items;
create policy "order_items_owner_read" on order_items
  for select using (
    exists (select 1 from orders o where o.id = order_items.order_id and o.user_id = auth.uid())
  );

-- (Ghi dữ liệu đi qua backend bằng service_role -> không cần policy insert cho anon.)

-- 3) DỮ LIỆU MẪU --------------------------------------------------------------
insert into products (name, sku, category, price, stock) values
  ('Cà phê sữa đá',         'CF001', 'Đồ uống',   25000, 100),
  ('Cà phê đen đá',         'CF002', 'Đồ uống',   20000, 100),
  ('Trà đào cam sả',        'TR001', 'Đồ uống',   35000, 60),
  ('Trà sữa trân châu',     'TR002', 'Đồ uống',   40000, 50),
  ('Nước suối Lavie 500ml', 'NU001', 'Đồ uống',   8000,  200),
  ('Coca Cola lon',         'NU002', 'Đồ uống',   12000, 150),
  ('Bánh mì thịt nguội',    'BM001', 'Đồ ăn',     25000, 40),
  ('Bánh mì chả',           'BM002', 'Đồ ăn',     20000, 35),
  ('Xôi mặn',               'XO001', 'Đồ ăn',     30000, 25),
  ('Mì gói Hảo Hảo',        'MG001', 'Thực phẩm', 5000,  300),
  ('Trứng gà (hộp 10)',     'TP001', 'Thực phẩm', 35000, 5),
  ('Gạo ST25 (5kg)',        'TP002', 'Thực phẩm', 180000, 18),
  ('Dầu ăn Tường An 1L',    'TP003', 'Thực phẩm', 55000, 22),
  ('Nước mắm Nam Ngư',      'TP004', 'Thực phẩm', 38000, 30),
  ('Snack Oishi',           'SN001', 'Bánh kẹo',  7000,  120),
  ('Bánh Choco Pie (hộp)',  'SN002', 'Bánh kẹo',  45000, 28),
  ('Kẹo Alpenliebe',        'SN003', 'Bánh kẹo',  3000,  4),
  ('Khẩu trang y tế (hộp)', 'TD001', 'Tiêu dùng', 30000, 45),
  ('Nước rửa tay Lifebuoy', 'TD002', 'Tiêu dùng', 42000, 16),
  ('Giấy vệ sinh (lốc 10)', 'TD003', 'Tiêu dùng', 65000, 3)
on conflict do nothing;

insert into customers (name, phone) values
  ('Khách lẻ',       ''),
  ('Cô Lan tạp hoá', '0901234567'),
  ('Anh Tú',         '0912345678'),
  ('Chị Hương',      '0987654321'),
  ('Quán cơm Bình',  '0934567890')
on conflict do nothing;

-- Đơn hàng mẫu: chạy `python scripts/seed_orders.py` (dùng service_role key)
-- để tạo ~10 đơn qua chính backend -> tồn kho trừ đúng & báo cáo có số liệu.
