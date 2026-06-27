"""
INTEGRATION TEST (giữa kim tự tháp) — gọi API thật qua FastAPI TestClient,
ghi/đọc DB (SQLite in-memory). Kiểm dữ liệu chảy đúng giữa các tầng.
"""
import pytest
from fastapi.testclient import TestClient
from index import app

client = TestClient(app)


def test_health_uses_sqlite():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["db_backend"] == "sqlite"


def test_list_products_seeded():
    r = client.get("/api/products")
    assert r.status_code == 200
    products = r.json()
    assert len(products) >= 20  # dữ liệu mẫu ~20 sản phẩm


def test_create_order_decrements_stock():
    # Arrange: lấy 1 sản phẩm còn nhiều hàng
    products = client.get("/api/products").json()
    p = next(x for x in products if x["stock"] >= 10)
    before = p["stock"]

    # Act: tạo đơn mua 3 cái
    r = client.post("/api/orders", json={"items": [{"product_id": p["id"], "qty": 3}]})
    assert r.status_code == 201
    order = r.json()

    # Assert: tổng tiền đúng + tồn kho giảm 3 + đơn xuất hiện trong DB
    assert order["total"] == p["price"] * 3
    after = next(x for x in client.get("/api/products").json() if x["id"] == p["id"])["stock"]
    assert after == before - 3
    assert any(o["id"] == order["id"] for o in client.get("/api/orders").json())


def test_create_order_empty_cart_rejected():
    r = client.post("/api/orders", json={"items": []})
    assert r.status_code == 422  # pydantic chặn (min_length=1)


def test_create_order_over_stock_rejected():
    products = client.get("/api/products").json()
    p = products[0]
    r = client.post("/api/orders", json={"items": [{"product_id": p["id"], "qty": p["stock"] + 100}]})
    assert r.status_code == 400
    assert "tồn kho" in r.json()["detail"].lower()


def test_create_order_unknown_product_rejected():
    r = client.post("/api/orders", json={"items": [{"product_id": 999999, "qty": 1}]})
    assert r.status_code == 400


def test_create_product_then_appears():
    r = client.post("/api/products", json={"name": "Sản phẩm test", "price": 12345, "stock": 7})
    assert r.status_code == 201
    new_id = r.json()["id"]
    found = [x for x in client.get("/api/products").json() if x["id"] == new_id]
    assert found and found[0]["price"] == 12345


def test_report_summary_reflects_sales():
    # Có đơn mẫu nên doanh thu > 0
    r = client.get("/api/report/summary")
    assert r.status_code == 200
    summary = r.json()
    assert summary["revenue"] > 0
    assert summary["order_count"] >= 1
    assert "top_products" in summary and "low_stock" in summary
