# Changelog

Theo [Keep a Changelog](https://keepachangelog.com/) + [SemVer](https://semver.org/).

## [Unreleased] — phase-11-multitenant (PR #2)
### Added
- **Đa cửa hàng (multi-tenant):** bảng `shops` + `shop_members`; mỗi user tự tạo cửa hàng riêng, có thể đứng nhiều shop.
- **Mời nhân viên qua email** (pending → active khi người đó đăng nhập) + chuông thông báo (lời mời + cảnh báo tồn thấp).
- **Bộ chuyển cửa hàng** (shop switcher) ở header; **onboarding** tạo cửa hàng cho người dùng mới.
- **Tuỳ biến thương hiệu**: tên/màu/logo cửa hàng, áp dụng theme trực tiếp (CSS variables).
- **Đăng nhập magic link** (ngoài Email/mật khẩu + Google).
- Cài đặt: nút **Xoá toàn bộ dữ liệu** + **Nạp lại dữ liệu mẫu** (owner).
- Migration `0005_multitenant.sql` (expand pattern) + backfill dữ liệu cũ vào "ThiemCun Demo Shop".
- 11 test đa cửa hàng (cách ly, mời/nhận, multi-shop, ma trận quyền).

### Changed
- Trang đăng nhập thiết kế lại (hero + copy "POS Free cho shop nhỏ", form 3 phương thức).
- Vai trò (owner/staff) suy ra từ `shop_members` thay vì `profiles.role`. Backend mọi route scope theo `shop_id`.
- Pin Supabase CLI `2.108.0` trong CI (setup-cli `latest` bị GitHub API rate-limit).

### Removed
- Cơ chế **allowlist** + ép đổi mật khẩu lần đầu (signup nay mở; ai cũng tạo được cửa hàng).

### Deferred
- `0006_contract.sql` (drop `profiles.role`/`allowed_emails`/`shop_settings`) — làm SAU khi prod xác nhận ổn (an toàn rollback). Xem `PROD_CUTOVER_PHASE11.md`.

## [0.10.0] — 2026-06-28
- Prod live tại **pos.thiemcun.io.vn** (custom domain). RBAC owner/staff + allowlist + audit log.
- UI Shopify-Polaris (rebuild từ Claude Design). Google login (ES256 JWT).
- CI/CD đầy đủ: `pr.yml` (test+preview), `main.yml` (staging), `release.yml` (tag `v*` + cổng duyệt), `migrations.yml`, `keepwarm.yml`.
- Migrations 0001–0004 (schema + RBAC + dedup + product fields/shop_settings/customer_stats).

## [0.1.0] — 2026-06-28
- Bản đầu: mini-POS (Bán hàng · Sản phẩm · Đơn hàng · Báo cáo), FastAPI + React + Supabase/SQLite, deploy Vercel.
