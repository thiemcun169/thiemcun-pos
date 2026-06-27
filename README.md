# 🛒 ThiemCun POS — App Quản Lý Bán Hàng (mini-POS)

Sản phẩm mẫu **production-ready** của khoá **"Vibe Coding với Claude Code"**, đi trọn pipeline
**Idea → Research → PRD → Prototype → Build → Test → Deploy → Operate**.

> Live: `https://thiemcun.vercel.app` · Hướng dẫn dựng lại từ đầu: **[../HANDSON.md](../HANDSON.md)**

## Tính năng
- **Bán hàng**: lưới sản phẩm + tìm kiếm + giỏ hàng → tạo đơn (tự trừ tồn kho).
- **Sản phẩm**: danh sách + thêm mới + chỉnh tồn.
- **Đơn hàng**: lịch sử đơn + chi tiết.
- **Báo cáo**: doanh thu, số đơn, top bán chạy, cảnh báo sắp hết hàng.
- **Đăng nhập Google** (Supabase Auth) — bật/tắt bằng env; chưa cấu hình = chế độ demo.

## Stack
React (Vite) · FastAPI (serverless trên Vercel) · Supabase (Postgres + Auth) · GitHub Actions (CI) · Sentry + Vercel Analytics.

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
  auth.py         xác thực JWT Supabase (bật/tắt theo env)
supabase/schema.sql   tạo bảng + RLS + seed
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
