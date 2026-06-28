# 🛒 ThiemCun POS — Free Mini-POS đa cửa hàng

> **POS miễn phí cho shop nhỏ.** Quản lý bán hàng, sản phẩm, khách hàng, nhân viên & báo cáo —
> mỗi người tự tạo cửa hàng riêng, mời nhân viên, tuỳ biến thương hiệu. Mã nguồn mở (MIT).
>
> _A free, open-source multi-tenant point-of-sale for small shops._

**🔗 Dùng thử (live):** **https://pos.thiemcun.io.vn** — bấm **Đăng ký miễn phí**, bạn có ngay cửa hàng của riêng mình.

Đây cũng là sản phẩm mẫu của khoá **"Vibe Coding với Claude Code"** — đi trọn pipeline
**Idea → Research → PRD → Prototype → Build → Test → Deploy → Operate → Multi-tenant**.

![React](https://img.shields.io/badge/React-Vite-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688) ![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ecf8e) ![license](https://img.shields.io/badge/license-MIT-green)

## ✨ Tính năng
- 🏬 **Đa cửa hàng (multi-tenant)** — 1 tài khoản tạo/đứng nhiều cửa hàng; dữ liệu tách biệt hoàn toàn theo shop.
- 👥 **Phân quyền (RBAC)** — chủ (owner) & nhân viên (staff); mời nhân viên qua **email**, nhận lời mời qua chuông thông báo.
- 🎨 **Tuỳ biến thương hiệu** — đổi tên, màu sắc, logo cửa hàng; giao diện đổi theo ngay (live theming).
- 🧾 **Bán hàng (POS)** — lưới sản phẩm + giỏ hàng → tạo đơn (tự trừ tồn kho), giảm giá, hoá đơn.
- 📦 **Sản phẩm & kho** — CRUD đầy đủ (ảnh, mô tả, ngưỡng tồn) + cảnh báo tồn thấp.
- 🧑‍🤝‍🧑 **Khách hàng** — DB khách + lượt mua + tổng chi tiêu + lịch sử.
- 📊 **Báo cáo** (owner) — doanh thu, top bán chạy, cảnh báo hết hàng.
- 🔐 **Đăng nhập** Email/mật khẩu · Google · **Magic link** (Supabase Auth) + 2FA (TOTP).
- 📱 **Responsive** — dùng tốt trên điện thoại & máy tính. Hoàn toàn **miễn phí**.

## 🧱 Stack
React (Vite) · FastAPI (serverless trên Vercel) · Supabase (Postgres + Auth, ES256 JWT) ·
CI/CD GitHub Actions · Sentry + Vercel Analytics.

## 🏗️ Kiến trúc
```
src/            React frontend (1 trang, đổi tab bằng state)
  api.js          client gọi /api (1 chỗ) — tự gắn JWT + X-Shop-Id
  lib/            supabaseClient (auth) · shop (active shop + theme) · format (VND)
  components/     ShopSwitcher · NotificationBell · Toasts
  pages/          Sales · Products · Orders · Customers · Reports · Members · Settings · Onboarding
api/            FastAPI backend (Vercel function)
  index.py        routes /api/* (đều scope theo shop đang chọn)
  db.py           LỚP KẾT NỐI DB (sqlite | supabase) — đổi DB chỉ sửa ở đây
  auth.py         xác thực JWT Supabase + shop_context (vai trò theo shop_members)
  pricing.py      logic nghiệp vụ thuần (unit-test dễ)
supabase/migrations/  000N_*.sql (additive + idempotent, áp qua CI theo môi trường)
tests/          pytest (unit + integration + multi-tenant)
vercel.json     gộp Vite (/) + FastAPI (/api/*) trong 1 project
```

> **Đa cửa hàng:** backend dùng `service_role` (bỏ qua RLS) nên cách ly tenant được ép ở **tầng truy vấn**
> (mọi hàm DB nhận `shop_id`). RLS theo thành viên = lớp phòng thủ thứ 2. Xem `supabase/migrations/0005_multitenant.sql`.

## 🚀 Chạy local
```bash
# 1) Backend (Python) — cổng 8001
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
npm run api            # uvicorn index:app --reload --port 8001 --app-dir api

# 2) Frontend (Node) — cổng 5173, proxy /api -> 8001
npm install && npm run dev

# 3) Test
python -m pytest
```
Chưa cấu hình Supabase → app tự dùng **SQLite + dữ liệu mẫu** (chạy được ngay, demo owner + 1 shop mẫu).
Cấu hình thật: copy `.env.example` → `.env` rồi điền key Supabase.

## 🔑 Tự host (deploy riêng)
1. Tạo project Supabase → áp migrations trong `supabase/migrations/` (qua `supabase db push` hoặc CI `migrations.yml`).
2. Bật Google provider + đặt Site/Redirect URL trong Supabase Auth (nếu dùng Google/magic link).
3. Deploy lên Vercel (1 project, đã có `vercel.json`); đặt env `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## 🤝 Đóng góp & giấy phép
- Đóng góp: xem [CONTRIBUTING.md](CONTRIBUTING.md). Lịch sử thay đổi: [CHANGELOG.md](CHANGELOG.md).
- Bảo mật: `.env` đã gitignore; `service_role` key **chỉ ở backend**, frontend chỉ dùng anon key (RLS bảo vệ tầng DB). Xem `SECURITY.md`.
- Giấy phép: **MIT** — xem [LICENSE](LICENSE). Dùng tự do cho cá nhân & thương mại.
