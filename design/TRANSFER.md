# DESIGN TRANSFER — Claude Design → Claude Code (cách ĐÚNG)

> Bài học lớn: re-skin CSS bằng tay KHÔNG = transfer design. Cách đúng do user chỉ:
> **Claude Design → nút "Share" → tab "Send to..." → "Claude Code" → "Send"**.

## Cơ chế (3 lựa chọn từ dialog)
1. **claude_design MCP** (`DesignSync` tool): import trực tiếp qua login claude.ai. *(Cần `/design-login`
   interactive — môi trường này không có TTY → dùng cách 3.)*
2. **Send to Claude Code Web**: seed project vào workspace.
3. **Download .zip (handoff bundle)** ← đã dùng: `ThiemCun POS Web App-handoff.zip` →
   giải nén vào `design/exports/claude-design-handoff/`.

## Bundle gồm
- `README.md` — hướng dẫn coding agent: **đọc `project/ThiemCun POS.dc.html` FULL, recreate pixel-perfect**.
- `project/ThiemCun POS.dc.html` (1114 dòng) — **NGUỒN THIẾT KẾ THẬT**: mọi screen (Login/Dashboard/POS/
  Sản phẩm/Khách/Cài đặt) với inline style chính xác (màu, spacing, kích thước). Cú pháp `<x-dc>` + `{{ }}`.
- `project/support.js` — runtime của Design Component.
- `project/screenshots/dash.png` — ảnh dashboard.

## Tokens xác nhận từ source (khớp app)
`#FAFBFB` bg · `#FFFFFF` surface · `#202223` text · `#6D7175` sub · `#E1E3E5` border · `#008060` accent ·
Inter (Google Fonts) · **Phosphor icons** (`@phosphor-icons/web`). Login: max-width 380px, input h44, logo 38px.

## Cách port (theo README)
"Recreate pixel-perfectly trong React — match visual output, KHÔNG copy cấu trúc prototype." → đọc inline
style trong .dc.html cho từng screen → áp vào component React tương ứng (`src/pages/*`) + tokens trong `styles.css`.

## Trạng thái
- ✅ Tokens + Dashboard (KPI+chart+top SP+đơn gần đây) đã rebuild bám prototype.
- 🔄 Pixel-refinement chi tiết từng screen theo `.dc.html` = bước tinh chỉnh tiếp (source đã có trong repo làm chuẩn).
