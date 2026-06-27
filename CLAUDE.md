# CLAUDE.md — "Bộ não" của dự án ThiemCun POS

> Claude Code đọc file này TỰ ĐỘNG đầu mỗi phiên. Viết 1 lần → AI làm đúng style mọi phiên.

## Dự án này là gì
**ThiemCun POS** — app quản lý bán hàng (mini-POS) cho cửa hàng nhỏ (tạp hoá/quán).
4 màn: **Bán hàng · Sản phẩm · Đơn hàng · Báo cáo**. Đây là sản phẩm mẫu của khoá
"Vibe Coding với Claude Code" — đi trọn pipeline Idea → … → Operate.

## Bộ công nghệ (stack)
- **Frontend**: React + Vite (thư mục `src/`), thuần JS, không router (1 trang, đổi tab bằng state).
- **Backend**: Python FastAPI (thư mục `api/`), chạy serverless trên Vercel.
- **Database/Auth**: Supabase (Postgres + Google OAuth). Local/test dùng SQLite.
- **Deploy**: 1 project Vercel (React ở `/`, FastAPI ở `/api/*` — xem `vercel.json`).
- **Test**: pytest (unit + integration), Playwright (E2E).

## Quy ước kiến trúc (QUAN TRỌNG)
- **Lớp kết nối DB để RIÊNG ở `api/db.py`.** Mọi truy cập dữ liệu qua `get_db()`.
  Đổi Supabase ↔ SQLite chỉ sửa file này, KHÔNG đụng route/giao diện.
- **Logic nghiệp vụ thuần ở `api/pricing.py`** (tính tiền, kiểm tồn kho) → unit-test dễ.
- **Auth để riêng**: backend `api/auth.py`, frontend `src/lib/supabaseClient.js`. Cả hai
  "bật/tắt được" theo biến môi trường (chưa cấu hình = chạy chế độ demo, không cần đăng nhập).
- Frontend gọi backend QUA `src/api.js` (1 chỗ), luôn dùng đường dẫn tương đối `/api`.

## Bảo mật — đọc kỹ
- **TUYỆT ĐỐI không commit `.env`** (đã gitignore). Tự kiểm: `git ls-files | grep .env` phải rỗng.
- **`service_role` key = toàn quyền DB → chỉ ở backend/`.env`.** Không bao giờ để ra frontend.
- Frontend chỉ dùng **anon/publishable key** (an toàn công khai; RLS bảo vệ ở tầng DB).
- Đừng in token/key ra màn hình hay dán vào chat.

## Cách làm việc với mình (người dùng)
- Mình **không rành code** — giải thích bằng **tiếng Việt dễ hiểu**, tránh thuật ngữ khó.
- **Trước khi sửa nhiều file → nói kế hoạch cho mình duyệt** (Plan Mode).
- Làm xong mỗi tính năng chạy được → **commit** với ghi chú rõ.
- **Thêm/sửa gì → chạy lại TOÀN BỘ test** (`python -m pytest`) trước khi báo "xong".

## Lệnh hay dùng
```bash
# Backend (cổng 8001 vì máy này đang chạy macos-mcp ở 8000)
source .venv/bin/activate && npm run api
# Frontend (cổng 5173, proxy /api -> 8001)
npm run dev
# Test
python -m pytest
# Build kiểm lỗi biên dịch
npm run build
```

## Đừng (Don't)
- Đừng deploy/đụng Production khi chưa chạy test xanh.
- Đừng tự ý đổi `vercel.json` rewrites (đã chỉnh cho combined Vite+FastAPI).
- Đừng thêm dependency nặng nếu chưa cần (giữ bundle gọn).
- Đừng dùng `allow_origins=["*"]` khi bật credentials trong CORS.
