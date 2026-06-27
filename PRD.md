# PRD — ThiemCun POS (App Quản Lý Bán Hàng)

> **PRD = SSOT** (nguồn chân lý duy nhất). Kết quả Lab 2 (Buổi 1) qua `/grill-me` → `/to-prd`.
> Mọi người + mọi phiên AI tham chiếu file này. Sửa yêu cầu → sửa ở đây trước.

## 1. Một câu định vị
> App quản lý bán hàng tối giản cho cửa hàng nhỏ: **lên đơn nhanh tại quầy + biết ngay doanh
> thu và tồn kho** — miễn phí, chạy trên web, đăng nhập bằng Google.

## 2. Đối tượng
Chủ & nhân viên cửa hàng nhỏ (tạp hoá/quán). Ưu tiên thao tác nhanh, dùng được trên điện thoại/tablet.

## 3. Tính năng (User Stories)
- **US1 — Bán hàng**: *Là nhân viên, tôi chọn sản phẩm từ lưới, thêm vào giỏ, chọn khách (tuỳ chọn),
  bấm "Tính tiền" để tạo đơn; tồn kho tự trừ.*
  - Chấp nhận: tổng tiền = Σ(đơn giá × số lượng); không cho bán quá tồn kho; tạo xong đơn hiện ở màn Đơn hàng.
- **US2 — Tìm sản phẩm**: *Là nhân viên, tôi gõ tên/mã để lọc nhanh sản phẩm ở màn Bán hàng.*
- **US3 — Quản lý sản phẩm**: *Là chủ, tôi xem danh sách, thêm sản phẩm mới (tên, giá, tồn, nhóm),
  và chỉnh nhanh tồn kho.*
- **US4 — Đơn hàng**: *Là chủ, tôi xem các đơn gần đây và bấm để xem chi tiết từng dòng.*
- **US5 — Báo cáo**: *Là chủ, tôi xem doanh thu, số đơn, top sản phẩm bán chạy, và sản phẩm sắp hết hàng (≤5).*
- **US6 — Đăng nhập Google** (buổi 3): *Là người dùng, tôi đăng nhập bằng Google; chế độ demo thì
  không cần đăng nhập.*

## 4. Màn hình
1. **Bán hàng**: lưới card sản phẩm (giá, tồn) + ô tìm kiếm + giỏ hàng bên phải + nút Tính tiền.
2. **Sản phẩm**: bảng + form thêm + nút chỉnh tồn (+10 / −1).
3. **Đơn hàng**: bảng đơn (mã, thời gian, số mặt hàng, tổng) + mở rộng xem chi tiết.
4. **Báo cáo**: 4 thẻ KPI + biểu đồ thanh top sản phẩm + danh sách sắp hết hàng.

## 5. Dữ liệu (data model)
- **products**(id, name, sku, category, price, stock, created_at)
- **customers**(id, name, phone, created_at)
- **orders**(id, customer_id?, user_id?, total, status, created_at)
- **order_items**(id, order_id, product_id?, product_name, qty, unit_price, line_total)
- Dữ liệu mẫu: ~20 sản phẩm (tạp hoá VN) + 5 khách + ~10 đơn.

## 6. Quy tắc nghiệp vụ
- Giá: VND số nguyên đồng. Tổng tiền = Σ thành tiền dòng.
- Số lượng > 0; không bán vượt tồn kho (báo lỗi rõ).
- Tồn kho trừ ngay khi tạo đơn. Cảnh báo "sắp hết" khi tồn ≤ 5.

## 7. Kiểm thử (verify)
- **Unit**: line_total, order_total (giỏ rỗng = 0), check_stock (đủ/biên/thiếu/0).
- **Integration**: tạo đơn → tồn kho giảm đúng → đơn vào DB; chặn giỏ rỗng / quá tồn / sản phẩm lạ.
- **E2E**: mở web → thêm sản phẩm vào giỏ → tạo đơn → thấy ở Đơn hàng & Báo cáo cập nhật.

## 8. Phi mục tiêu (Out of scope — MVP)
In hoá đơn, mã vạch, đa chi nhánh, khuyến mãi/giảm giá, công nợ, phân quyền chi tiết.

## 9. Phi chức năng
- Responsive (điện thoại/tablet/desktop). HTTPS. Bí mật trong env vars. Có bộ test + CI gate.
