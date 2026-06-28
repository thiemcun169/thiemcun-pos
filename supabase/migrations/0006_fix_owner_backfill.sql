-- ============================================================================
-- 0006_fix_owner_backfill.sql — Sửa lỗi backfill 0005: shop phải có OWNER
-- ----------------------------------------------------------------------------
-- LỖI 0005: backfill chèn thành viên theo `profiles.role`. Nếu người tạo shop
-- (shops.created_by) có profiles.role='staff', họ bị chèn là staff; bước "ensure
-- owner" của 0005 chỉ INSERT-nếu-thiếu nên KHÔNG nâng họ lên owner → shop không
-- có owner (chủ đăng nhập chỉ thấy quyền nhân viên).
--
-- Sửa idempotent: nâng created_by lên 'owner' cho MỌI shop CHƯA có owner active.
-- An toàn chạy lại (đã có owner -> không đổi gì). created_by NULL -> bỏ qua.
-- ============================================================================

update shop_members m
set role = 'owner'
from shops s
where s.id = m.shop_id
  and s.created_by is not null
  and s.created_by = m.user_id
  and m.status = 'active'
  and m.role <> 'owner'
  and not exists (
    select 1 from shop_members o
    where o.shop_id = s.id and o.role = 'owner' and o.status = 'active'
  );
