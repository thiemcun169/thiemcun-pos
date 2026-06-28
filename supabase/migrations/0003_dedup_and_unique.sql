-- ============================================================================
-- 0003_dedup_and_unique.sql — Dọn trùng seed + chống trùng về sau
-- ----------------------------------------------------------------------------
-- Lý do: `supabase db push` chạy lại seed của 0001 (on conflict do nothing không
-- bắt trùng vì thiếu unique) -> nhân đôi sản phẩm/khách. Migration này:
--   1) Xoá bản trùng (giữ id nhỏ nhất theo sku / theo name).
--   2) Thêm UNIQUE để lần sau `on conflict do nothing` hoạt động đúng -> idempotent.
-- An toàn: đơn hàng tham chiếu id GỐC (nhỏ nhất) nên xoá bản trùng id lớn không ảnh hưởng.
-- ============================================================================

delete from products  a using products  b where a.sku = b.sku   and a.sku is not null and a.id > b.id;
delete from customers a using customers b where a.name = b.name  and a.id > b.id;

create unique index if not exists uq_products_sku on products(sku) where sku is not null;
