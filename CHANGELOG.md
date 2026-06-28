# Changelog

Theo [Keep a Changelog](https://keepachangelog.com/) + [SemVer](https://semver.org/).

## [Unreleased] — feat/phase-11-multi-tenant (PR #3 → dev)
### Added
- **Đa cửa hàng (multi-tenant), mô hình 1-shop:** bảng `shops` + `shop_members`; **mỗi user tối đa 1 cửa hàng active** (`UNIQUE(user_id) WHERE status='active'`).
- **Onboarding wizard**: chọn vai trò **Chủ shop** (tạo shop) / **Nhân viên** (nhận lời mời).
- **Mời bằng TOKEN** (chưa có email service): owner copy link `…/join?token=`, hạn 7 ngày, single-use, khớp email; màn `/join` validate + nhận. Chuông thông báo hiện lời mời.
- **Rời shop / chuyển quyền chủ / xoá shop** (Cài đặt).
- **Tuỳ biến thương hiệu**: tên/màu/logo, theme áp trực tiếp (CSS vars). **Magic-link** login.
- Cài đặt owner: **Xoá dữ liệu** + **Nạp lại mẫu**.
- Migration `0005_multitenant.sql` (expand) + backfill dữ liệu cũ vào "ThiemCun Demo Shop".
- `ARCHITECTURE.md`; **Gitflow** feat→dev→main + branch protection + `dev.yml`; lint (ruff) trong CI.
- Test đa cửa hàng (cách ly, 1-shop, token invite/join, leave/transfer/delete, ma trận quyền).

### Changed
- Trang đăng nhập thiết kế lại (hero + copy "POS Free cho shop nhỏ", 3 phương thức).
- Vai trò suy ra từ `shop_members` (không dùng `profiles.role`). Backend mọi route scope theo `shop_id`.
- Pin Supabase CLI `2.108.0` trong CI; `main.yml` test-only, prod chỉ qua tag `v*`.

### Removed
- Cơ chế **allowlist** + ép đổi mật khẩu lần đầu. **Bỏ shop-switcher** (vì 1-shop).

### Deferred
- `0006_contract.sql` (drop `profiles.role`/`allowed_emails`/`shop_settings`) — làm SAU khi prod xác nhận ổn (an toàn rollback). Xem `PROD_CUTOVER_PHASE11.md`.

## [0.10.0] — 2026-06-28
- Prod live tại **pos.thiemcun.io.vn** (custom domain). RBAC owner/staff + allowlist + audit log.
- UI Shopify-Polaris (rebuild từ Claude Design). Google login (ES256 JWT).
- CI/CD đầy đủ: `pr.yml` (test+preview), `main.yml` (staging), `release.yml` (tag `v*` + cổng duyệt), `migrations.yml`, `keepwarm.yml`.
- Migrations 0001–0004 (schema + RBAC + dedup + product fields/shop_settings/customer_stats).

## [0.1.0] — 2026-06-28
- Bản đầu: mini-POS (Bán hàng · Sản phẩm · Đơn hàng · Báo cáo), FastAPI + React + Supabase/SQLite, deploy Vercel.
