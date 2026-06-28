# PROD CUTOVER — Phase 11 Multi-tenant (GATED — cần owner duyệt)

> Mọi bước build + test đã xong trên nhánh `phase-11-multitenant` (PR #2).
> Migration `0005` ĐÃ chạy & verify trên **staging** Supabase. Các bước dưới
> đây **chạm vào PRODUCTION** nên CHỜ owner bấm duyệt — KHÔNG tự động.

## Trạng thái đã xong (an toàn)
- [x] `0005_multitenant.sql` — expand pattern (chỉ THÊM, không xoá cột/bảng cũ)
- [x] Backend scope theo `shop_id` + 36 pytest xanh + `npm run build` sạch
- [x] Frontend: shop switcher, bell, onboarding, theming, Members, Settings
- [x] **Áp 0005 lên STAGING qua CI → verify**: tạo "ThiemCun Demo Shop", owner active,
      mọi product có `shop_id` (0 cái null), view `customer_stats` có `shop_id`
- [x] PR #2 mở → CI test + preview deploy chạy

## Bước CẦN DUYỆT (theo thứ tự)

### 1. Merge PR #2 → `main`
- Trigger `migrations.yml` (paths supabase/migrations/**) → **áp 0005 lên STAGING lại** (idempotent, an toàn) + `main.yml` deploy staging.
- ✅ An toàn — chưa chạm prod.

### 2. Áp 0005 lên PRODUCTION + deploy (qua tag, có cổng duyệt)
```bash
# từ main đã merge:
git tag v0.11.0 && git push origin v0.11.0
```
- `release.yml` chạy: **PAUSE chờ Required reviewers (thiemcun169) Approve** trong tab Actions/Environments.
- Sau Approve: `supabase db push` áp 0005 lên **prod** (`cnoolkkpkvzerlwkhjxe`) + deploy prod (`thiemcun-prod` → pos.thiemcun.io.vn).
- ⚠️ Đây là bước CHẠM PROD DB. Vì 0005 là expand (không drop) → nếu lỗi vẫn rollback dễ.
- Không cần env var mới: `X-Shop-Id` là header, CORS đã `allow_headers=["*"]`.

### 3. Smoke test prod (sau deploy)
- [ ] Đăng nhập tài khoản cũ (thiemnguyenba169@gmail.com) → vào **ThiemCun Demo Shop**, data còn nguyên, là owner.
- [ ] Đăng ký tài khoản MỚI (email khác) → tự tạo "Shop của …" riêng, data rỗng/seed.
- [ ] Owner mời 1 email staff → email đó đăng nhập → tự join shop (hoặc nhận qua chuông).
- [ ] Đổi tên/màu/logo trong Cài đặt → theme đổi toàn app.
- [ ] Shop switcher chuyển qua lại 2 shop → data tách biệt.
- [ ] Bell hiện lời mời + cảnh báo tồn thấp.

### 4. SAU KHI prod ổn định vài ngày → contract migration `0006`
Chỉ làm khi prod đã chạy multi-tenant ổn:
- `0006_contract.sql`: `drop column profiles.role`, `drop table allowed_emails`, `drop table shop_settings`.
- Tag `v0.11.1` → duyệt → áp prod.
- (Trước đó để nguyên = phương án rollback an toàn.)

## Phase 14 cleanup (riêng, cũng cần duyệt vì XOÁ tài nguyên)
- Vercel: giữ DUY NHẤT `thiemcun-prod`; xoá các project grace cũ (`thiemcun-staging-s1/s2`, `thiemcun-pos`, …) — liệt kê `vercel project ls` trước khi xoá.
- Supabase: xoá project **staging** (`cbtpfnvlcszmlbgxunag`) — **chỉ sau khi** đã dùng nó validate xong (đã xong ở bước trên). Giữ prod (`cnoolkkpkvzerlwkhjxe`).
- Sau khi xoá staging: gỡ secrets `SUPABASE_STAGING_*`, bỏ bước staging trong `main.yml`, sửa `pr.yml` preview trỏ về project phù hợp (hoặc bỏ preview-deploy, giữ test).

## Rollback (nếu prod lỗi sau bước 2)
- 0005 không drop gì → app cũ vẫn đọc được. Có thể redeploy commit trước (`v0.10.0`) trong khi giữ schema mới (cột thừa `shop_id` không ảnh hưởng app cũ).
- Hoặc khôi phục Supabase prod từ daily backup (PITR/backups tab) nếu cần.
