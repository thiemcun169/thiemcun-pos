"""
MULTI-TENANT tests — cách ly cửa hàng + luồng mời/nhận + ma trận quyền.

Hai cấp:
  * DB-level: gọi thẳng db.get_db() -> kiểm cách ly + invite/accept + multi-shop.
  * API-level: ghi đè dependency `shop_context` để giả lập user/role/shop khác nhau,
    kiểm scoping + ma trận quyền (owner vs staff).
"""
import db as dbmod
import pytest
from fastapi.testclient import TestClient

from auth import shop_context
from db import DEMO_SHOP_ID
from index import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clear_overrides():
    yield
    app.dependency_overrides.clear()


def _ctx(shop_id, role="owner", user_id="u1", email="u1@x.com"):
    return {"user": {"id": user_id, "email": email, "full_name": "U"},
            "user_id": user_id, "email": email, "shop_id": shop_id, "role": role, "shops": []}


# --------------------------- DB-level: cách ly ---------------------------
def test_two_shops_products_isolated():
    db = dbmod.get_db()
    a = db.create_shop("Shop A", "userA")
    b = db.create_shop("Shop B", "userB")
    pa = db.create_product(a["id"], {"name": "Chỉ của A", "price": 1000, "stock": 5})
    pb = db.create_product(b["id"], {"name": "Chỉ của B", "price": 2000, "stock": 5})

    names_a = [p["name"] for p in db.list_products(a["id"])]
    names_b = [p["name"] for p in db.list_products(b["id"])]
    assert "Chỉ của A" in names_a and "Chỉ của B" not in names_a
    assert "Chỉ của B" in names_b and "Chỉ của A" not in names_b
    # không thể lấy sản phẩm shop khác bằng id
    assert db.get_product(b["id"], pa["id"]) is None
    assert db.get_product(a["id"], pb["id"]) is None


def test_orders_and_reports_isolated():
    db = dbmod.get_db()
    a = db.create_shop("A", "ua"); b = db.create_shop("B", "ub")
    pa = db.create_product(a["id"], {"name": "PA", "price": 10000, "stock": 10})
    db.create_product(b["id"], {"name": "PB", "price": 99000, "stock": 10})
    db.create_order(a["id"], [{"product_id": pa["id"], "qty": 2}], None, "ua")

    assert db.report_summary(a["id"])["revenue"] == 20000
    assert db.report_summary(b["id"])["revenue"] == 0
    assert len(db.list_orders(a["id"])) == 1 and len(db.list_orders(b["id"])) == 0


def test_create_shop_makes_owner_membership():
    db = dbmod.get_db()
    s = db.create_shop("Tiệm tạp hoá", "owner-1")
    m = db.get_membership(s["id"], "owner-1")
    assert m and m["role"] == "owner" and m["status"] == "active"
    shops = db.list_user_shops("owner-1")
    assert any(x["id"] == s["id"] and x["my_role"] == "owner" for x in shops)


# --------------------------- DB-level: mời + nhận ---------------------------
def test_invite_then_accept_joins_shop():
    db = dbmod.get_db()
    shop = db.create_shop("Quán cà phê", "owner-x")
    db.invite_member(shop["id"], "Staff@Example.com", "staff", invited_by="owner-x")

    # người được mời thấy lời mời (không phân biệt hoa thường)
    invs = db.list_invites_for_email("staff@example.com")
    assert len(invs) == 1 and invs[0]["shop_id"] == shop["id"]

    # chưa nhận -> chưa là thành viên
    assert db.get_membership(shop["id"], "new-user") is None
    db.accept_invite(shop["id"], "new-user", "staff@example.com")
    m = db.get_membership(shop["id"], "new-user")
    assert m and m["role"] == "staff" and m["status"] == "active"
    # nhận rồi -> hết lời mời chờ
    assert db.list_invites_for_email("staff@example.com") == []


def test_user_can_be_owner_of_A_and_staff_of_B():
    db = dbmod.get_db()
    a = db.create_shop("A", "alice")           # alice là owner A
    b = db.create_shop("B", "bob")             # bob owner B
    db.invite_member(b["id"], "alice@x.com", "staff", invited_by="bob")
    db.accept_invite(b["id"], "alice", "alice@x.com")

    shops = {s["id"]: s["my_role"] for s in db.list_user_shops("alice")}
    assert shops.get(a["id"]) == "owner" and shops.get(b["id"]) == "staff"


# --------------------------- API-level: scoping ---------------------------
def test_api_products_scoped_to_active_shop():
    db = dbmod.get_db()
    b = db.create_shop("Shop B", "userB")
    db.create_product(b["id"], {"name": "Sản phẩm B duy nhất", "price": 5000, "stock": 3})

    app.dependency_overrides[shop_context] = lambda: _ctx(b["id"], "owner", "userB")
    items = client.get("/api/products").json()
    assert len(items) == 1 and items[0]["name"] == "Sản phẩm B duy nhất"
    # không lẫn sản phẩm shop demo
    assert all("Cà phê sữa đá" != p["name"] for p in items)


def test_api_no_shop_returns_409():
    app.dependency_overrides[shop_context] = lambda: _ctx(None, None, "lonely")
    assert client.get("/api/products").status_code == 409
    assert client.get("/api/shops").status_code == 200  # vẫn xem được danh sách (rỗng)


# --------------------------- API-level: ma trận quyền ---------------------------
def test_staff_cannot_access_owner_only_routes():
    db = dbmod.get_db()
    s = db.create_shop("Shop S", "ownerS")
    app.dependency_overrides[shop_context] = lambda: _ctx(s["id"], "staff", "staffS")

    # staff: được dùng products/customers/orders
    assert client.get("/api/products").status_code == 200
    assert client.get("/api/customers").status_code == 200
    assert client.get("/api/orders").status_code == 200
    # staff: KHÔNG được báo cáo / quản lý nhân viên / sửa cài đặt shop / audit
    assert client.get("/api/report/summary").status_code == 403
    assert client.get("/api/members").status_code == 403
    assert client.patch("/api/shop", json={"name": "x"}).status_code == 403
    assert client.get("/api/audit").status_code == 403


def test_owner_can_access_everything():
    db = dbmod.get_db()
    s = db.create_shop("Shop O", "ownerO")
    app.dependency_overrides[shop_context] = lambda: _ctx(s["id"], "owner", "ownerO")

    assert client.get("/api/report/summary").status_code == 200
    assert client.get("/api/members").status_code == 200
    assert client.patch("/api/shop", json={"name": "Tên mới"}).status_code == 200
    assert client.get("/api/audit").status_code == 200


def test_invite_via_api_then_listed_for_invitee():
    db = dbmod.get_db()
    s = db.create_shop("Shop I", "ownerI")
    app.dependency_overrides[shop_context] = lambda: _ctx(s["id"], "owner", "ownerI", "owneri@x.com")
    r = client.post("/api/members", json={"email": "moi@x.com", "role": "staff"})
    assert r.status_code == 201

    members = client.get("/api/members").json()["members"]
    assert any(m.get("invited_email") == "moi@x.com" and m["status"] == "pending" for m in members)


# --------------------------- maintenance ---------------------------
def test_clear_and_reseed_shop_data():
    db = dbmod.get_db()
    assert len(db.list_products(DEMO_SHOP_ID)) >= 20
    db.clear_shop_data(DEMO_SHOP_ID)
    assert db.list_products(DEMO_SHOP_ID) == []
    assert db.list_orders(DEMO_SHOP_ID) == []
    db.reseed_shop(DEMO_SHOP_ID)
    assert len(db.list_products(DEMO_SHOP_ID)) >= 20
