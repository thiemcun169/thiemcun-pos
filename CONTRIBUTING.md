# Đóng góp cho ThiemCun POS

Cảm ơn bạn quan tâm! Đây là dự án mã nguồn mở (MIT) phục vụ cộng đồng + khoá học.

## Quy trình
1. **Fork** repo + tạo nhánh từ `main`: `git checkout -b feat/ten-tinh-nang`.
2. Code + **viết/chạy test**: `python -m pytest` phải xanh, `npm run build` không lỗi.
3. Commit theo [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`…).
4. Mở **Pull Request** vào `main`. CI (`pr.yml`) tự chạy test + tạo bản preview để xem trước.

## Nguyên tắc kiến trúc (giữ cho dễ bảo trì)
- **Mọi truy cập DB qua `api/db.py`** và **luôn kèm `shop_id`** (cách ly đa cửa hàng).
- Logic nghiệp vụ thuần để ở `api/pricing.py` (unit-test dễ).
- Frontend gọi backend **qua `src/api.js`** (1 chỗ), đường dẫn tương đối `/api`.
- **Migration chỉ THÊM (additive) + idempotent**; không sửa schema prod trực tiếp — áp qua CI (`migrations.yml`).
- Không commit `.env`/secret. `service_role` key chỉ ở backend.

## Báo lỗi / đề xuất
Mở [Issue](https://github.com/thiemcun169/thiemcun-pos/issues) — mô tả các bước tái hiện, hành vi mong đợi vs thực tế, ảnh chụp nếu có.

## Phát triển local
Xem mục **Chạy local** trong [README.md](README.md). Chưa có Supabase vẫn chạy được (SQLite + dữ liệu mẫu).
