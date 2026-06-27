"""Dữ liệu mẫu (~20 sản phẩm + khách + đơn) — cửa hàng tạp hoá/tiện lợi VN.

Dùng cho SQLite (local/test). File supabase/schema.sql nạp dữ liệu tương đương lên Postgres.
Giá để theo VND (số nguyên đồng).
"""

SEED_PRODUCTS = [
    {"name": "Cà phê sữa đá",        "sku": "CF001", "category": "Đồ uống",   "price": 25000,  "stock": 100},
    {"name": "Cà phê đen đá",        "sku": "CF002", "category": "Đồ uống",   "price": 20000,  "stock": 100},
    {"name": "Trà đào cam sả",       "sku": "TR001", "category": "Đồ uống",   "price": 35000,  "stock": 60},
    {"name": "Trà sữa trân châu",    "sku": "TR002", "category": "Đồ uống",   "price": 40000,  "stock": 50},
    {"name": "Nước suối Lavie 500ml","sku": "NU001", "category": "Đồ uống",   "price": 8000,   "stock": 200},
    {"name": "Coca Cola lon",        "sku": "NU002", "category": "Đồ uống",   "price": 12000,  "stock": 150},
    {"name": "Bánh mì thịt nguội",   "sku": "BM001", "category": "Đồ ăn",     "price": 25000,  "stock": 40},
    {"name": "Bánh mì chả",          "sku": "BM002", "category": "Đồ ăn",     "price": 20000,  "stock": 35},
    {"name": "Xôi mặn",              "sku": "XO001", "category": "Đồ ăn",     "price": 30000,  "stock": 25},
    {"name": "Mì gói Hảo Hảo",       "sku": "MG001", "category": "Thực phẩm", "price": 5000,   "stock": 300},
    {"name": "Trứng gà (hộp 10)",    "sku": "TP001", "category": "Thực phẩm", "price": 35000,  "stock": 5},
    {"name": "Gạo ST25 (5kg)",       "sku": "TP002", "category": "Thực phẩm", "price": 180000, "stock": 18},
    {"name": "Dầu ăn Tường An 1L",   "sku": "TP003", "category": "Thực phẩm", "price": 55000,  "stock": 22},
    {"name": "Nước mắm Nam Ngư",     "sku": "TP004", "category": "Thực phẩm", "price": 38000,  "stock": 30},
    {"name": "Snack Oishi",          "sku": "SN001", "category": "Bánh kẹo",  "price": 7000,   "stock": 120},
    {"name": "Bánh Choco Pie (hộp)", "sku": "SN002", "category": "Bánh kẹo",  "price": 45000,  "stock": 28},
    {"name": "Kẹo Alpenliebe",       "sku": "SN003", "category": "Bánh kẹo",  "price": 3000,   "stock": 4},
    {"name": "Khẩu trang y tế (hộp)","sku": "TD001", "category": "Tiêu dùng", "price": 30000,  "stock": 45},
    {"name": "Nước rửa tay Lifebuoy","sku": "TD002", "category": "Tiêu dùng", "price": 42000,  "stock": 16},
    {"name": "Giấy vệ sinh (lốc 10)","sku": "TD003", "category": "Tiêu dùng", "price": 65000,  "stock": 3},
]

SEED_CUSTOMERS = [
    {"name": "Khách lẻ",        "phone": ""},
    {"name": "Cô Lan tạp hoá",  "phone": "0901234567"},
    {"name": "Anh Tú",          "phone": "0912345678"},
    {"name": "Chị Hương",       "phone": "0987654321"},
    {"name": "Quán cơm Bình",   "phone": "0934567890"},
]

# Đơn mẫu: tham chiếu product_id 1-based theo thứ tự SEED_PRODUCTS ở trên.
SEED_ORDERS = [
    {"customer_id": 2, "items": [{"product_id": 1, "qty": 2}, {"product_id": 7, "qty": 1}]},
    {"customer_id": 3, "items": [{"product_id": 4, "qty": 3}]},
    {"customer_id": 1, "items": [{"product_id": 10, "qty": 10}, {"product_id": 5, "qty": 5}]},
    {"customer_id": 4, "items": [{"product_id": 12, "qty": 1}, {"product_id": 13, "qty": 2}]},
    {"customer_id": 5, "items": [{"product_id": 14, "qty": 3}, {"product_id": 1, "qty": 4}]},
    {"customer_id": 1, "items": [{"product_id": 16, "qty": 2}]},
    {"customer_id": 3, "items": [{"product_id": 6, "qty": 6}, {"product_id": 15, "qty": 4}]},
    {"customer_id": 2, "items": [{"product_id": 18, "qty": 1}]},
    {"customer_id": 1, "items": [{"product_id": 2, "qty": 1}, {"product_id": 9, "qty": 1}]},
    {"customer_id": 4, "items": [{"product_id": 3, "qty": 2}, {"product_id": 16, "qty": 1}]},
]
