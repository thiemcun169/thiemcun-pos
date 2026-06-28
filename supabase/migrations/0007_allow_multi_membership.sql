-- ============================================================================
-- 0007_allow_multi_membership.sql — Nới luật: 1 user thuộc NHIỀU shop active
-- ----------------------------------------------------------------------------
-- Yêu cầu mới: 1 user có thể đồng thời là OWNER shop này VÀ STAFF shop khác
-- (đa thành viên song song). Bỏ ràng buộc "1 active membership / user".
--
-- VẪN giữ uq_member_shop_user (shop_id, user_id) -> không trùng membership trong
-- cùng 1 shop. Frontend dùng shop-switcher để chọn shop đang làm việc (X-Shop-Id).
-- ============================================================================

drop index if exists one_active_membership_per_user;

-- (uq_member_shop_user partial unique trên (shop_id,user_id) đã có từ 0005 — đủ chống trùng.)
