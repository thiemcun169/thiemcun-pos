# SECURITY.md — ThiemCun POS

> Mô hình bảo mật + vận hành an toàn. Áp dụng cho `build/thiemcun-pos`.
> Cập nhật: 2026-06-28 (Phase 8).

## 1. Phân quyền (RBAC)
- **2 vai trò**: `owner` (chủ shop — full) và `staff` (nhân viên — chỉ POS).
- **Bảng `profiles`** (1-1 với `auth.users`): `role`, `status` (active/disabled), `must_change_password`.
- **Allowlist (`allowed_emails`)**: chỉ email được owner mời TRƯỚC mới đăng nhập được. User lạ đăng nhập
  (kể cả Google) → trigger `handle_new_user` raise `Email chưa được cấp quyền…` → bị chặn.
- **Bootstrap**: user đầu tiên = owner (tự động). Sau đó bắt buộc qua allowlist.
- **Backend** (`api/auth.py`): nạp `role/status` từ profiles qua service_role; `require_owner`
  chặn route nhạy cảm; `status=disabled` → 403.
- **Frontend**: nav theo role — staff chỉ thấy Bán hàng / Sản phẩm / Đơn hàng / Hồ sơ;
  owner thấy thêm Báo cáo + Nhân viên. Báo cáo tài chính = endpoint owner-only.

## 2. RLS (Row Level Security) — bảo vệ tầng DB
Bật RLS mọi bảng. Backend dùng `service_role` (bỏ qua RLS) + tự kiểm role. RLS bảo vệ truy cập
TRỰC TIẾP bằng anon key:
| Bảng | select | ghi |
|---|---|---|
| products | công khai (catalog) | qua backend |
| orders / order_items | chỉ user active | qua backend |
| profiles | bản thân + owner | owner / bản thân |
| allowed_emails, audit_logs | **chỉ owner** | chỉ owner |

→ Nhân viên KHÔNG đọc được danh sách nhân viên khác, allowlist, hay audit log qua anon key.

## 3. Mật khẩu & MFA
- **Admin bootstrap**: tạo tài khoản admin với mật khẩu **mạnh, đặt lúc tạo** (qua biến môi trường/secret,
  **KHÔNG hardcode trong repo**), `must_change_password=true` → **BẮT BUỘC đổi mật khẩu lần đầu**
  (chặn toàn bộ UI khác cho tới khi đổi). *(Đừng commit mật khẩu thật vào repo — kể cả mật khẩu mẫu.)*
- **MFA (TOTP)**: Supabase Auth hỗ trợ sẵn TOTP (`supabase.auth.mfa.enroll/challenge/verify`).
  Khuyến nghị **bắt buộc MFA cho owner**: sau đăng nhập, nếu `role=owner` và chưa enroll factor →
  ép màn hình enroll. *(Thành phần enroll UI: roadmap — backend/Supabase đã sẵn sàng.)*
- **Rate limit đăng nhập**: Supabase Auth có rate-limit sẵn ở endpoint `/token`, `/signup`, `/verify`
  (chỉnh ở Dashboard → Auth → Rate Limits). Lockout tuỳ biến "5 fail → khoá 15 phút": dùng 1
  Supabase Edge Function đếm fail theo IP/email (roadmap; built-in rate-limit đã chặn brute-force cơ bản).

## 4. Quản lý secret (chống lộ / chống "dev nắm hết")
- **service_role key = toàn quyền DB** → CHỈ ở Vercel env (production), KHÔNG commit, KHÔNG ra frontend.
- Repo: chỉ `.env.example` (placeholder) được track. Mọi key thật ở `build/thiemcun-pos/.secrets/`
  (đã `.gitignore`). Tự kiểm: `git ls-files | grep -iE '\.env|secret'` chỉ ra `.env.example`.
- **Tách quyền theo môi trường**: developer chỉ nhận key **dev/staging**; key **prod** owner giữ
  (Vercel env, ai có quyền project mới thấy). Xem `README` mục provision dev.
- **Frontend chỉ dùng anon/publishable key** (an toàn công khai; RLS bảo vệ ở DB).

## 5. Secret rotation (định kỳ, ~hàng quý)
1. **anon/service_role**: Supabase Dashboard → Settings → API → "Reset" / tạo key mới → cập nhật Vercel env → redeploy.
2. **JWT signing key**: Settings → Auth → JWT Keys → rotate (project đời mới dùng ES256 → backend verify
   qua `/auth/v1/user` nên KHÔNG cần cập nhật secret thủ công).
3. **Supabase access token (`sbp_`)**: Account → Access Tokens → revoke + tạo mới → cập nhật GitHub secret.
4. **Google OAuth secret**: Google Cloud → Credentials → reset → cập nhật Supabase provider.

## 6. Read-only user cho support
Tạo role chỉ đọc trong Postgres (không write/delete), cấp cho support:
```sql
create role support_readonly login password '<đặt>';
grant connect on database postgres to support_readonly;
grant usage on schema public to support_readonly;
grant select on all tables in schema public to support_readonly;
alter default privileges in schema public grant select on tables to support_readonly;
```
*(Áp qua migration, KHÔNG cấp quyền ghi.)*

## 7. Audit log
Bảng `audit_logs` ghi: đăng nhập đổi mật khẩu, mời/sửa nhân viên, đổi role, tạo/sửa sản phẩm,
**xem báo cáo tài chính**. Chỉ owner đọc (RLS + endpoint `/api/audit`). Backend ghi tự động ở các route nhạy cảm.

## 8. CORS / CSRF
- CORS siết: chỉ origin domain mình (`localhost:5173`, `thiemcun-six.vercel.app`, `thiemcun.is-a.dev`)
  + regex riêng cho preview deploy của project này. KHÔNG `allow_origins=["*"]`.
- Token gửi qua header `Authorization: Bearer` (không dùng cookie) → giảm bề mặt CSRF.

## 9. Backup & khôi phục
- Supabase Free: backup hạn chế (không PITR). **Prod thật nên lên Pro** để có **Point-in-Time Recovery**.
- Khôi phục: Dashboard → Database → Backups → chọn thời điểm → Restore. Diễn tập định kỳ.
- Seed prod: chỉ dữ liệu **ẩn danh** (sản phẩm demo), KHÔNG dữ liệu khách thật.

## 10. SSO doanh nghiệp (Google Workspace) — sẵn sàng bật
Supabase hỗ trợ SAML SSO (Pro+). Để bật Google Workspace SSO:
1. Supabase → Auth → SSO → thêm SAML provider (metadata từ Google Workspace Admin).
2. Map domain công ty → tổ chức.
3. Hoặc giữ Google OAuth hiện tại (đã chạy) cho đăng nhập cá nhân.

## 11. Checklist trước go-live
- [ ] Đổi mật khẩu admin bootstrap sang mật khẩu mạnh (không dùng lại mật khẩu mẫu nào).
- [ ] Bật MFA cho owner.
- [ ] Bật email confirmation (tắt `mailer_autoconfirm`) + cấu hình SMTP.
- [ ] Supabase Pro nếu cần PITR/không-ngủ.
- [ ] Rà `allowed_emails` đúng người.
- [ ] Kiểm `git ls-files | grep -iE '\.env|secret'` sạch.
