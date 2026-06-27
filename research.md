# research.md — Nghiên cứu nghiệp vụ (Pha 2: Research)

> Kết quả Lab 1 (Buổi 1): dùng Claude Code research & chốt nghiệp vụ TRƯỚC khi viết PRD.

## 1. Bài toán & nỗi đau
Cửa hàng nhỏ ở VN (tạp hoá, quán cà phê, shop) thường:
- Ghi đơn bằng **giấy/sổ tay** → khó tổng hợp doanh thu, dễ thất lạc.
- **Không biết tồn kho thực tế** → bán hụt hoặc ôm hàng.
- Phần mềm POS thị trường (KiotViet, Sapo…) **đủ tính năng nhưng tốn phí hàng tháng** và nhiều
  tính năng thừa với cửa hàng siêu nhỏ.

**Nỗi đau lớn nhất:** lên đơn nhanh + biết ngay *bán được bao nhiêu, còn bao nhiêu hàng*.

## 2. Khách hàng (ai dùng)
- **Chủ cửa hàng nhỏ** (1–3 nhân viên): cần lên đơn nhanh tại quầy, xem báo cáo cuối ngày.
- **Nhân viên bán hàng**: thao tác đơn giản, ít bước, máy tính bảng/điện thoại đều dùng được.

## 3. Vài app tham khảo
| App | Điểm mạnh | Điểm có thể học |
|---|---|---|
| KiotViet | Quản lý kho + đơn mạnh | Luồng "chọn sản phẩm → giỏ → tính tiền" rất nhanh |
| Sapo POS | Giao diện quầy gọn | Tách rõ Bán hàng / Sản phẩm / Báo cáo |
| Square POS | Lưới sản phẩm bấm nhanh | Lưới card sản phẩm + tìm theo tên |

→ Học: **màn Bán hàng kiểu lưới card + giỏ hàng bên phải**, báo cáo tối giản.

## 4. Luồng nghiệp vụ chính
```
Bán hàng:  chọn sản phẩm (lưới) → thêm vào giỏ → chọn khách (tuỳ chọn)
           → "Tính tiền" → tạo Đơn → TRỪ TỒN KHO → hiện trong Đơn hàng & Báo cáo
Sản phẩm:  xem danh sách → thêm sản phẩm mới → chỉnh tồn kho
Đơn hàng:  xem đơn gần đây → bấm xem chi tiết các dòng
Báo cáo:   doanh thu, số đơn, top sản phẩm bán chạy, cảnh báo sắp hết hàng
```

## 5. Nên làm gì trước (MVP)
**Phải có (MVP):**
1. Danh mục sản phẩm có tồn kho.
2. Màn Bán hàng: chọn sản phẩm → giỏ → tạo đơn → trừ tồn kho.
3. Danh sách đơn hàng.
4. Báo cáo tổng quan (doanh thu, top sản phẩm, sắp hết hàng).

**Để sau (không làm ở MVP):** in hoá đơn, mã vạch/máy quét, nhiều chi nhánh, khuyến mãi/giảm giá,
công nợ khách, phân quyền nhân viên chi tiết.

## 6. Quyết định kỹ thuật rút ra
- Giá để **VND số nguyên đồng** (không lẻ) cho hợp ngữ cảnh VN.
- Tồn kho **trừ ngay khi tạo đơn**; cảnh báo khi ≤ 5.
- Đăng nhập **Google qua Supabase** (đừng tự xây mật khẩu) — bật ở buổi 3.
