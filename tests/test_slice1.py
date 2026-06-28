"""Integration tests cho Slice 1: product edit/delete, customer DB, shop settings."""
from fastapi.testclient import TestClient
from index import app

client = TestClient(app)


def test_product_create_with_new_fields():
    r = client.post("/api/products", json={
        "name": "Bút bi Thiên Long", "sku": "BUT01", "category": "Văn phòng phẩm",
        "price": 5000, "stock": 100, "description": "Mực xanh", "low_stock_threshold": 10,
        "image_url": "https://x/y.png",
    })
    assert r.status_code == 201
    p = r.json()
    assert p["description"] == "Mực xanh" and p["low_stock_threshold"] == 10 and p["image_url"]


def test_product_edit_all_fields():
    p = client.get("/api/products").json()[0]
    r = client.patch(f"/api/products/{p['id']}", json={"price": 99000, "description": "Đã sửa", "low_stock_threshold": 3})
    assert r.status_code == 200
    u = r.json()
    assert u["price"] == 99000 and u["description"] == "Đã sửa" and u["low_stock_threshold"] == 3


def test_product_soft_delete_removed_from_list():
    p = client.get("/api/products").json()[0]
    pid = p["id"]
    assert client.delete(f"/api/products/{pid}").status_code == 200
    assert all(x["id"] != pid for x in client.get("/api/products").json())  # ẩn khỏi danh sách
    assert client.delete("/api/products/99999").status_code == 404


def test_customer_list_has_stats():
    cs = client.get("/api/customers").json()
    assert len(cs) >= 1
    assert "purchase_count" in cs[0] and "total_spent" in cs[0]


def test_customer_detail_with_history():
    # tạo khách + đơn cho khách đó
    c = client.post("/api/customers", json={"name": "Anh Test", "phone": "0900000000"}).json()
    prod = next(x for x in client.get("/api/products").json() if x["stock"] >= 2)
    client.post("/api/orders", json={"items": [{"product_id": prod["id"], "qty": 2}], "customer_id": c["id"]})
    r = client.get(f"/api/customers/{c['id']}")
    assert r.status_code == 200
    d = r.json()
    assert d["purchase_count"] == 1 and len(d["orders"]) == 1 and d["total_spent"] == prod["price"] * 2


def test_shop_get_and_update():
    assert client.get("/api/shop").json()["name"]
    r = client.patch("/api/shop", json={"name": "Cửa hàng Cún", "hotline": "1900", "address": "Hà Nội"})
    assert r.status_code == 200
    s = client.get("/api/shop").json()
    assert s["name"] == "Cửa hàng Cún" and s["hotline"] == "1900"
