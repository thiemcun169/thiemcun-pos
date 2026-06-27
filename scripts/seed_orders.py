"""
Nạp ~10 đơn hàng mẫu lên Supabase (chạy 1 lần sau khi đã chạy schema.sql).

Dùng CHÍNH lớp DB của backend (SupabaseDatabase) -> tồn kho trừ đúng, báo cáo có số liệu.
Chỉ nạp khi bảng orders đang RỖNG (tránh nạp trùng).

Cách chạy (từ thư mục gốc dự án, đã có .env với SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY):
    source .venv/bin/activate
    set -a && source .env && set +a
    python scripts/seed_orders.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))

from db import get_db  # noqa: E402
from seed_data import SEED_ORDERS  # noqa: E402


def main() -> None:
    db = get_db()
    if db.backend_name != "supabase":
        print("⚠️  Chưa cấu hình Supabase (thiếu SUPABASE_URL/SERVICE_ROLE_KEY). Bỏ qua.")
        sys.exit(1)

    existing = db.list_orders(limit=1)
    if existing:
        print("ℹ️  Đã có đơn hàng trong DB -> không nạp lại.")
        return

    created = 0
    for o in SEED_ORDERS:
        try:
            order = db.create_order(o["items"], o.get("customer_id"), user_id=None)
            created += 1
            print(f"  ✓ Đơn #{order['id']} — {order['total']:.0f} đ")
        except Exception as e:  # noqa: BLE001
            print(f"  ✗ Bỏ qua 1 đơn: {e}")
    print(f"✅ Đã nạp {created} đơn hàng mẫu.")


if __name__ == "__main__":
    main()
