"""Cấu hình chung cho test: đảm bảo dùng SQLite sạch (không đụng Supabase)."""
import os
import sys
import pytest

# Xoá biến Supabase để DB layer luôn chọn SQLite trong test.
os.environ.pop("SUPABASE_URL", None)
os.environ.pop("SUPABASE_SERVICE_ROLE_KEY", None)
os.environ.pop("SUPABASE_JWT_SECRET", None)

# Cho phép import module trong api/ kể cả khi chạy pytest ngoài cấu hình.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))


@pytest.fixture(autouse=True)
def fresh_db():
    """Mỗi test bắt đầu với 1 DB SQLite in-memory sạch + dữ liệu mẫu."""
    import db
    db.reset_db_for_tests()
    yield
