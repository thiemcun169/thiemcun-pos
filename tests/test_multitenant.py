"""
MULTI-TENANT tests — mô hình 1-user-1-shop + mời bằng TOKEN + ma trận quyền.

Hai cấp:
  * DB-level: gọi thẳng db.get_db() -> cách ly + 1-shop + invite/join token + leave/transfer/delete.
  * API-level: ghi đè dependency `shop_context` để giả lập user/role/shop, kiểm scoping + quyền.
"""
from datetime import datetime, timedelta, timezone

import db as dbmod
import pytest
from fastapi.testclient import TestClient

from auth import shop_context
from db import DEMO_SHOP_ID
from index import app

client = TestClient(app)


def _future():
    return (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()


def _past():
    return (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()


@pytest.fixture(autouse=True)
def _clear_overrides():
    yield
    app.dependency_overrides.clear()


def _ctx(shop_id, role="owner", user_id="u1", email="u1@x.com"):
    return {"user": {"id": user_id, "email": email, "full_name": "U"},
            "user_id": user_id, "email": email, "shop_id": shop_id, "role": role, "shops": []}


# --------------------------- DB: cách ly ---------------------------
def test_two_shops_products_isolated():
    db = dbmod.get_db()
    a = db.create_shop("Shop A", "userA")
    b = db.create_shop("Shop B", "userB")
    pa = db.create_product(a["id"], {"name": "Chỉ của A", "price": 1000, "stock": 5})
    pb = db.create_product(b["id"], {"name": "Chỉ của B", "price": 2000, "stock": 5})
    assert [p["name"] for p in db.list_products(a["id"])] == ["Chỉ của A"]
    assert [p["name"] for p in db.list_products(b["id"])] == ["Chỉ của B"]
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
    assert any(x["id"] == s["id"] and x["my_role"] == "owner" for x in db.list_user_shops("owner-1"))


# --------------------------- DB: ĐA THÀNH VIÊN (multi-membership) ---------------------------
def test_user_can_own_multiple_shops():
    db = dbmod.get_db()
    a = db.create_shop("A", "alice")
    b = db.create_shop("B", "alice")          # cùng user -> ĐƯỢC PHÉP (đa thành viên)
    shops = {s["id"]: s["my_role"] for s in db.list_user_shops("alice")}
    assert shops.get(a["id"]) == "owner" and shops.get(b["id"]) == "owner"
    assert len(shops) == 2


def test_owner_of_A_can_also_be_staff_of_B():
    db = dbmod.get_db()
    a = db.create_shop("Shop A", "alice")      # alice owner A
    b = db.create_shop("Shop B", "bob")
    db.invite_member(b["id"], "alice@x.com", "staff", "bob", "tok-x", _future())
    db.accept_invite_by_token("tok-x", "alice", "alice@x.com")  # vẫn nhận được dù đã có shop
    shops = {s["id"]: s["my_role"] for s in db.list_user_shops("alice")}
    assert shops.get(a["id"]) == "owner" and shops.get(b["id"]) == "staff"


# --------------------------- DB: mời + nhận bằng token ---------------------------
def test_invite_token_then_accept():
    db = dbmod.get_db()
    shop = db.create_shop("Quán cà phê", "owner-x")
    db.invite_member(shop["id"], "Staff@Example.com", "staff", "owner-x", "tok-1", _future())

    inv = db.get_invite_by_token("tok-1")
    assert inv and inv["shop_id"] == shop["id"] and inv["status"] == "pending_invite"

    m = db.accept_invite_by_token("tok-1", "new-user", "staff@example.com")
    assert m["shop_id"] == shop["id"]
    assert db.get_membership(shop["id"], "new-user")["role"] == "staff"
    # token đã dùng -> nhận lại lỗi
    with pytest.raises(ValueError):
        db.accept_invite_by_token("tok-1", "other", "staff@example.com")


def test_invite_email_mismatch_and_expiry():
    db = dbmod.get_db()
    shop = db.create_shop("Shop", "owner-y")
    db.invite_member(shop["id"], "right@x.com", "staff", "owner-y", "tok-good", _future())
    db.invite_member(shop["id"], "late@x.com", "staff", "owner-y", "tok-old", _past())

    with pytest.raises(ValueError):
        db.accept_invite_by_token("tok-good", "u", "wrong@x.com")   # email lệch
    with pytest.raises(ValueError):
        db.accept_invite_by_token("tok-old", "u", "late@x.com")     # hết hạn
    with pytest.raises(ValueError):
        db.accept_invite_by_token("does-not-exist", "u", "x@x.com")  # token sai


# --------------------------- DB: rời / chuyển quyền / xoá ---------------------------
def test_leave_shop_makes_orphan():
    db = dbmod.get_db()
    s = db.create_shop("S", "owner-z")
    db.invite_member(s["id"], "nv@x.com", "staff", "owner-z", "tk", _future())
    db.accept_invite_by_token("tk", "staff-u", "nv@x.com")
    db.leave_shop(s["id"], "staff-u")
    assert db.get_active_membership("staff-u") is None     # thành orphan
    # rời rồi có thể tạo shop mới
    s2 = db.create_shop("Shop mới", "staff-u")
    assert db.get_membership(s2["id"], "staff-u")["role"] == "owner"


def test_transfer_ownership():
    db = dbmod.get_db()
    s = db.create_shop("S", "boss")
    db.invite_member(s["id"], "nv@x.com", "staff", "boss", "tk2", _future())
    db.accept_invite_by_token("tk2", "worker", "nv@x.com")
    members = {m["user_id"]: m for m in db.list_members(s["id"])}
    db.transfer_ownership(s["id"], "boss", members["worker"]["id"])
    assert db.get_membership(s["id"], "worker")["role"] == "owner"
    assert db.get_membership(s["id"], "boss")["role"] == "staff"


def test_delete_shop():
    db = dbmod.get_db()
    s = db.create_shop("Tạm", "del-owner")
    db.create_product(s["id"], {"name": "X", "price": 1, "stock": 1})
    db.delete_shop(s["id"])
    assert db.get_shop(s["id"]) is None
    assert db.get_active_membership("del-owner") is None


# --------------------------- API: scoping + quyền ---------------------------
def test_api_products_scoped_to_active_shop():
    db = dbmod.get_db()
    b = db.create_shop("Shop B", "userB")
    db.create_product(b["id"], {"name": "Sản phẩm B duy nhất", "price": 5000, "stock": 3})
    app.dependency_overrides[shop_context] = lambda: _ctx(b["id"], "owner", "userB")
    items = client.get("/api/products").json()
    assert len(items) == 1 and items[0]["name"] == "Sản phẩm B duy nhất"


def test_api_no_shop_returns_409_and_can_list_shops():
    app.dependency_overrides[shop_context] = lambda: _ctx(None, None, "lonely")
    assert client.get("/api/products").status_code == 409
    assert client.get("/api/shops").status_code == 200


def test_staff_cannot_access_owner_only_routes():
    db = dbmod.get_db()
    s = db.create_shop("Shop S", "ownerS")
    app.dependency_overrides[shop_context] = lambda: _ctx(s["id"], "staff", "staffS")
    assert client.get("/api/products").status_code == 200
    assert client.get("/api/customers").status_code == 200
    assert client.get("/api/orders").status_code == 200
    assert client.get("/api/report/summary").status_code == 403
    assert client.get("/api/members").status_code == 403
    assert client.patch("/api/shop", json={"name": "x"}).status_code == 403
    assert client.delete("/api/shop").status_code == 403
    assert client.get("/api/audit").status_code == 403


def test_owner_can_access_everything():
    db = dbmod.get_db()
    s = db.create_shop("Shop O", "ownerO")
    app.dependency_overrides[shop_context] = lambda: _ctx(s["id"], "owner", "ownerO")
    assert client.get("/api/report/summary").status_code == 200
    assert client.get("/api/members").status_code == 200
    assert client.patch("/api/shop", json={"name": "Tên mới"}).status_code == 200
    assert client.get("/api/audit").status_code == 200


def test_api_create_second_shop_allowed():
    db = dbmod.get_db()
    s = db.create_shop("Đã có", "ownerX")
    app.dependency_overrides[shop_context] = lambda: _ctx(s["id"], "owner", "ownerX")
    # đa thành viên: tạo shop thứ 2 -> OK
    assert client.post("/api/shops", json={"name": "Shop 2"}).status_code == 201
    assert len(db.list_user_shops("ownerX")) == 2


def test_api_invite_returns_token_then_join():
    db = dbmod.get_db()
    s = db.create_shop("Shop I", "ownerI")
    app.dependency_overrides[shop_context] = lambda: _ctx(s["id"], "owner", "ownerI", "owneri@x.com")
    r = client.post("/api/members", json={"email": "moi@x.com", "role": "staff"})
    assert r.status_code == 201
    token = r.json()["invite_token"]
    assert token and r.json()["join_path"].endswith(token)

    # validate công khai
    v = client.get(f"/api/invite/{token}").json()
    assert v["valid"] and v["invited_email"] == "moi@x.com"

    # người được mời (orphan) join bằng token
    app.dependency_overrides[shop_context] = lambda: _ctx(None, None, "newbie", "moi@x.com")
    j = client.post("/api/join", json={"token": token})
    assert j.status_code == 200 and j.json()["shop_id"] == s["id"]
    assert db.get_membership(s["id"], "newbie")["role"] == "staff"


def test_api_leave_owner_with_staff_blocked():
    db = dbmod.get_db()
    s = db.create_shop("Shop L", "ownerL")
    db.invite_member(s["id"], "nv@x.com", "staff", "ownerL", "tkL", _future())
    db.accept_invite_by_token("tkL", "staffL", "nv@x.com")
    app.dependency_overrides[shop_context] = lambda: _ctx(s["id"], "owner", "ownerL")
    # owner còn nhân viên khác -> không được rời (phải chuyển quyền / xoá)
    assert client.post("/api/shop/leave").status_code == 409


# --------------------------- maintenance ---------------------------
def test_clear_and_reseed_shop_data():
    db = dbmod.get_db()
    assert len(db.list_products(DEMO_SHOP_ID)) >= 20
    db.clear_shop_data(DEMO_SHOP_ID)
    assert db.list_products(DEMO_SHOP_ID) == []
    db.reseed_shop(DEMO_SHOP_ID)
    assert len(db.list_products(DEMO_SHOP_ID)) >= 20
