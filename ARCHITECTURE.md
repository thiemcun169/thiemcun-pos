# ARCHITECTURE — ThiemCun POS (multi-tenant, 1-shop model)

> Tài liệu thiết kế: dữ liệu, phân quyền, luồng mời/tham gia, môi trường, nhánh Git, và các quyết định.

## 1. Tổng quan
Free multi-tenant POS. **1 tài khoản = TỐI ĐA 1 cửa hàng đang hoạt động (active)** tại một thời điểm.
- Frontend: React (Vite), 1 trang, đổi tab bằng state. Gọi backend qua `src/api.js`.
- Backend: FastAPI serverless (Vercel), data layer cô lập ở `api/db.py` (sqlite | supabase).
- DB/Auth: Supabase (Postgres + Auth ES256, Google/email/magic-link).

## 2. Dữ liệu (migration `0005_multitenant.sql`)
```
shops(id uuid pk, name, slug, color_primary, color_secondary, logo_url, address, hotline,
      created_by → auth.users, is_active, transferred_owner_at, settings jsonb, timestamps)

shop_members(id uuid pk, shop_id → shops, user_id → auth.users (null khi chưa nhận),
      role user_role(owner|staff), status member_status(pending_invite|active|disabled|left),
      invited_email, invited_by, invite_token uuid, invite_expires_at, joined_at, created_at)
  UNIQUE(shop_id, user_id)               -- 1 user 1 dòng/shop
  UNIQUE(shop_id, lower(invited_email))  -- 1 lời mời/email/shop
  UNIQUE(user_id) WHERE status='active'  -- ★ LUẬT 1-SHOP

products / customers / orders / audit_logs: + shop_id (NOT NULL trừ audit_logs)
customer_stats view: + shop_id
```
Helper RLS (security definer): `user_shop_ids()`, `is_shop_member()`, `is_shop_owner()`, `current_email()`.

## 3. Phân quyền & cách ly tenant
- **Backend dùng `service_role` → BỎ QUA RLS.** Vì vậy cách ly cửa hàng được **ép ở tầng truy vấn**:
  mọi hàm `db.*` nhận `shop_id`; `auth.shop_context` chỉ trả `shop_id` của membership ACTIVE của user.
- **RLS theo thành viên = lớp phòng thủ thứ 2** (chặn truy cập trực tiếp PostgREST bằng anon/authenticated key).
- Ma trận quyền:
  | | owner | staff |
  |---|---|---|
  | POS / sản phẩm / đơn / khách | ✓ | ✓ |
  | Báo cáo tài chính · Nhân viên · Cài đặt shop · Audit | ✓ | ✗ |
  | Mời/gỡ NV · chuyển quyền · xoá shop | ✓ | ✗ |
  | Rời shop | (phải chuyển quyền/xoá trước) | ✓ |

## 4. Luồng Auth (mô hình 1-shop)
1. **Đăng ký** (Google / email-mật khẩu / magic-link). Trigger `handle_new_user` CHỈ tạo `profiles`
   (tương thích) — **KHÔNG tự tạo shop**.
2. **Onboarding wizard** (user chưa thuộc shop nào):
   - **Chủ shop** → tạo shop mới → owner.
   - **Nhân viên** → nhận lời mời (xem mục 5).
3. Khi user đã có shop → vào dashboard. `/me` trả `{user, email, shop_id, role, shops:[≤1]}`.

## 5. Mời nhân viên bằng TOKEN (chưa có dịch vụ email)
1. Owner → "Mời nhân viên" (email + role) → backend tạo `shop_members` status `pending_invite`
   + `invite_token` (uuid) + hạn **7 ngày**. Trả link `…/join?token=<uuid>`.
2. Owner tự gửi link cho NV (Zalo/SMS…). (Khi có email service → tự gửi.)
3. NV mở link → `/join?token=` → đăng nhập (bất kỳ phương thức) → backend `accept_invite_by_token`:
   kiểm **token hợp lệ + chưa dùng + chưa hết hạn + email khớp invited_email + user chưa có shop** → kích hoạt.
4. NV đã đăng nhập sẵn cũng thấy lời mời ở **chuông thông báo** + tab onboarding "Nhân viên" (theo email).

## 6. Chuyển vai trò / rời shop
- **Staff** → "Rời cửa hàng" (status='left') → thành *orphan* → onboarding lại.
- **Owner** muốn rời → phải **chuyển quyền** cho 1 staff (promote owner, tự xuống staff, set `transferred_owner_at`)
  HOẶC **xoá shop** (cascade dữ liệu). Sau đó orphan → onboarding.

## 7. Môi trường & nhánh (Gitflow)
```
feat/*  →  dev  →  main ──tag v*──> PROD (release.yml, cổng duyệt reviewer)
```
- **feat/***: phát triển tự do.
- **dev**: môi trường DEV. Push dev → `dev.yml`: test → migrate DB dev → deploy Vercel (subdomain *.vercel.app). Bảo vệ: cần PR + checks (lint/test/build), không cần review.
- **main**: chỉ test (`main.yml`). Bảo vệ: cần PR + 1 review + checks. Prod CHỈ qua tag `v*`.
- **DB dev** = Supabase **staging** project (free tier 2 project: prod + dev). **DB prod** = project prod.
- Migration: `dev.yml` auto khi push dev; `release.yml` áp prod khi tag; `migrations.yml` chạy tay (dev/staging/prod).

## 8. Quyết định thiết kế (rationale)
- **Expand → contract**: `0005` chỉ THÊM; drop `profiles.role`/`allowed_emails`/`shop_settings` để dành `0006`
  SAU khi prod ổn → rollback an toàn (xem `PROD_CUTOVER_PHASE11.md`).
- **Owner suy ra từ `shop_members`** (role=owner active), không dùng cột `shops.owner_id` cứng → hỗ trợ
  chuyển quyền dễ; `created_by` chỉ ghi người tạo gốc.
- **shop_id NOT NULL** trên products/customers/orders (sau backfill) — ép mọi dữ liệu thuộc 1 shop;
  audit_logs để nullable (có log cấp hệ thống).
- **Bỏ shop-switcher** (vì 1-shop) — đơn giản hoá UI so với bản multi-shop ban đầu.
- **Token invite, không auto-match email ở trigger** — tham gia là hành động CHỦ ĐỘNG (bấm nhận), tránh
  tự kéo user vào shop ngoài ý muốn; hợp với việc chưa có email service.

## 9. Design-review checklist (trạng thái)
- [x] shops + shop_members + UNIQUE(user_id) active (luật 1-shop)
- [x] shop_id trên mọi bảng dữ liệu + RLS theo shop + backfill demo shop
- [x] Onboarding chọn vai trò; invite token; /join validate (TTL 7d, single-use, email-match)
- [x] Leave / transfer ownership / delete shop
- [x] Bỏ shop-switcher; bell hoạt động; login redesign + real test emails
- [x] Branch feat→dev→main + protection + workflows (lint/test/build)
- [ ] E2E 6 kịch bản (cần dev deploy + Google consent của user) — xem PROGRESS
