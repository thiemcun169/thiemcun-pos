# 🛒 ThiemCun POS — App Quản Lý Bán Hàng (mini-POS)

Sản phẩm mẫu **production-ready** của khoá **"Vibe Coding với Claude Code"**, đi trọn pipeline
**Idea → Research → PRD → Prototype → Build → Test → Deploy → Operate**.

> **Live (prod):** https://thiemcun-prod.vercel.app · **Staging:** https://thiemcun-staging-s1.vercel.app
> Hướng dẫn dựng lại từ đầu: **[../HANDSON.md](../HANDSON.md)**

## Tính năng
- **Bán hàng (POS)**: lưới sản phẩm + tìm kiếm + giỏ hàng → tạo đơn (tự trừ tồn kho).
- **Sản phẩm**: thêm/sửa/xoá (ảnh, mô tả, ngưỡng tồn) + banner cảnh báo tồn thấp.
- **Khách hàng**: DB khách + lượt mua + tổng chi tiêu + lịch sử mua.
- **Đơn hàng**: lịch sử đơn + chi tiết. **Báo cáo**: doanh thu, top bán chạy, cảnh báo hết hàng.
- **Cài đặt**: hồ sơ + đổi mật khẩu + MFA (TOTP) + thông tin cửa hàng.
- **RBAC** owner/staff + allowlist + ép đổi MK lần đầu + audit log; **Đăng nhập Google** (Supabase Auth).

## Stack
React (Vite) · FastAPI (serverless trên Vercel) · Supabase (Postgres + Auth, ES256 JWT) ·
**CI/CD GitHub Actions** (PR preview · push→staging · prod manual-gated) · Sentry + Vercel Analytics.

## CI/CD (`.github/workflows/` — xem [.github/README.md](.github/README.md))
| Trigger | Workflow |
|---|---|
| Mở PR | build + pytest → Vercel **preview** |
| Push `main` | test → migrate **staging** Supabase → deploy **staging** Vercel |
| Prod | `release.yml` — `workflow_dispatch` + **gõ `DEPLOY-PROD`** (cổng thủ công) |
| Thủ công | `migrations.yml` áp migration (staging/prod) · `keepwarm.yml` cron chống ngủ |

## Kiến trúc
```
src/            React frontend (1 trang, đổi tab bằng state)
  api.js          client gọi /api (1 chỗ)
  lib/            supabaseClient (auth), format (VND)
  pages/          Sales · Products · Orders · Reports
api/            FastAPI backend (Vercel function)
  index.py        routes /api/*
  db.py           LỚP KẾT NỐI DB (sqlite | supabase) — đổi DB chỉ sửa ở đây
  pricing.py      logic nghiệp vụ thuần (unit-test dễ)
  auth.py         xác thực JWT Supabase (verify qua /auth/v1/user — hợp ES256)
supabase/migrations/  000N_*.sql (additive + idempotent, áp qua CI theo môi trường)
tests/          pytest (unit + integration) + e2e (Playwright)
vercel.json     gộp Vite (/) + FastAPI (/api/*) trong 1 project
```

## Chạy local
```bash
# 1) Backend (Python) — cổng 8001
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
npm run api            # = uvicorn index:app --reload --port 8001 --app-dir api

# 2) Frontend (Node) — cổng 5173, proxy /api -> 8001
npm install
npm run dev

# 3) Test
python -m pytest
```
Chưa cấu hình Supabase → app tự dùng **SQLite + dữ liệu mẫu** (chạy được ngay).
Cấu hình thật: copy `.env.example` → `.env` rồi điền key Supabase (xem HANDSON.md).

## Bảo mật
`.env` đã gitignore. `service_role` key chỉ ở backend. Frontend chỉ dùng anon key. Kiểm: `git ls-files | grep .env` phải rỗng.
