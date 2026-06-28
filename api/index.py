"""
ThiemCun POS — Backend FastAPI (tầng "nhà bếp"). ĐA CỬA HÀNG.

Chạy được ở 2 nơi với CÙNG file này:
  - Local:  uvicorn index:app --reload  (từ thư mục api/)  hoặc  vercel dev
  - Vercel: tự nhận `app` ở api/index.py và biến thành 1 serverless function.

Mọi route đặt tiền tố /api (Vercel rewrite /api/* về function này — xem vercel.json).
Truy cập dữ liệu QUA db.get_db(), LUÔN kèm shop_id của cửa hàng đang chọn.
Phân quyền QUA auth.require_shop / require_owner (vai trò theo shop_members).
"""

from __future__ import annotations

import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

# Đảm bảo import được module cùng thư mục kể cả khi Vercel đổi cwd. PHẢI đặt TRƯỚC import sibling.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from typing import Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from auth import (auth_enabled, require_owner, require_shop,
                  require_user, send_invite_email, user_id_of)
from db import get_db
from pricing import StockError

INVITE_TTL_DAYS = 7  # lời mời hết hạn sau 7 ngày

# --- Sentry (tuỳ chọn): chỉ bật khi có SENTRY_DSN ---
if os.environ.get("SENTRY_DSN"):
    import sentry_sdk
    sentry_sdk.init(
        dsn=os.environ["SENTRY_DSN"],
        traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        environment=os.environ.get("VERCEL_ENV", "development"),
    )

app = FastAPI(title="ThiemCun POS API", version="3.0.0")

# --- CORS: chỉ cho phép origin của domain MÌNH (siết, không dùng "*") ---
_default_origins = ",".join([
    "http://localhost:5173", "http://127.0.0.1:5173",
    "https://pos.thiemcun.io.vn", "https://thiemcun-prod.vercel.app",
])
_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", _default_origins).split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    # chỉ preview deploy của CHÍNH project này (không mở cho mọi *.vercel.app)
    allow_origin_regex=r"https://thiemcun[a-z0-9-]*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------- Pydantic models ---------------------------
class ProductIn(BaseModel):
    name: str = Field(min_length=1)
    sku: Optional[str] = None
    category: Optional[str] = None
    price: float = Field(ge=0)
    stock: int = Field(default=0, ge=0)
    image_url: Optional[str] = None
    description: Optional[str] = None
    low_stock_threshold: int = Field(default=5, ge=0)


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = Field(default=None, ge=0)
    stock: Optional[int] = Field(default=None, ge=0)
    image_url: Optional[str] = None
    description: Optional[str] = None
    low_stock_threshold: Optional[int] = Field(default=None, ge=0)


class ShopCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class ShopUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=80)
    color_primary: Optional[str] = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    color_secondary: Optional[str] = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    logo_url: Optional[str] = None
    address: Optional[str] = None
    hotline: Optional[str] = None


class CustomerIn(BaseModel):
    name: str = Field(min_length=1)
    phone: Optional[str] = None


class OrderItemIn(BaseModel):
    product_id: int
    qty: int = Field(gt=0)


class OrderIn(BaseModel):
    items: list[OrderItemIn] = Field(min_length=1)
    customer_id: Optional[int] = None


class MemberInvite(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    role: str = Field(default="staff", pattern="^(owner|staff)$")
    origin: Optional[str] = None  # frontend gửi window.location.origin để build link email


class MemberUpdate(BaseModel):
    role: Optional[str] = Field(default=None, pattern="^(owner|staff)$")
    status: Optional[str] = Field(default=None, pattern="^(active|disabled)$")


class JoinByToken(BaseModel):
    token: str = Field(min_length=1)


# --------------------------- Health / meta ---------------------------
@app.get("/api/health")
def health():
    return {"status": "ok", "db_backend": get_db().backend_name, "auth_enabled": auth_enabled()}


@app.get("/api/me")
def me(ctx: dict = Depends(require_user)):
    """Danh tính + danh sách cửa hàng + shop/role đang chọn."""
    return {
        "user": ctx.get("user"),
        "email": ctx.get("email"),
        "shop_id": ctx.get("shop_id"),
        "role": ctx.get("role"),
        "shops": ctx.get("shops", []),
    }


# --------------------------- Shops ---------------------------
@app.get("/api/shops")
def list_shops(ctx: dict = Depends(require_user)):
    return ctx.get("shops", [])


@app.post("/api/shops", status_code=201)
def create_shop(body: ShopCreate, ctx: dict = Depends(require_user)):
    # Đa thành viên: user có thể tạo nhiều shop (vừa owner shop này, vừa staff shop khác).
    shop = get_db().create_shop(body.name.strip(), user_id_of(ctx))
    get_db().write_audit(shop["id"], user_id_of(ctx), ctx.get("email"), "shop_create", target=shop["id"], payload={"name": shop["name"]})
    return shop


@app.get("/api/shop")
def get_shop(ctx: dict = Depends(require_shop)):
    shop = get_db().get_shop(ctx["shop_id"])
    if not shop:
        raise HTTPException(status_code=404, detail="Không tìm thấy cửa hàng")
    return shop


@app.patch("/api/shop")
def update_shop(body: ShopUpdate, ctx: dict = Depends(require_owner)):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    shop = get_db().update_shop(ctx["shop_id"], data)
    get_db().write_audit(ctx["shop_id"], user_id_of(ctx), ctx.get("email"), "shop_update", payload=data)
    return shop


@app.post("/api/shop/clear-data")
def clear_shop_data(ctx: dict = Depends(require_owner)):
    get_db().clear_shop_data(ctx["shop_id"])
    get_db().write_audit(ctx["shop_id"], user_id_of(ctx), ctx.get("email"), "shop_clear_data")
    return {"ok": True}


@app.post("/api/shop/reseed")
def reseed_shop(ctx: dict = Depends(require_owner)):
    get_db().reseed_shop(ctx["shop_id"])
    get_db().write_audit(ctx["shop_id"], user_id_of(ctx), ctx.get("email"), "shop_reseed")
    return {"ok": True}


# --------------------------- Products ---------------------------
@app.get("/api/products")
def list_products(ctx: dict = Depends(require_shop)):
    return get_db().list_products(ctx["shop_id"])


@app.post("/api/products", status_code=201)
def create_product(body: ProductIn, ctx: dict = Depends(require_shop)):
    p = get_db().create_product(ctx["shop_id"], body.model_dump())
    get_db().write_audit(ctx["shop_id"], user_id_of(ctx), ctx.get("email"), "product_create", target=str(p.get("id")), payload={"name": p.get("name")})
    return p


@app.patch("/api/products/{product_id}")
def update_product(product_id: int, body: ProductUpdate, ctx: dict = Depends(require_shop)):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = get_db().update_product(ctx["shop_id"], product_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail="Không tìm thấy sản phẩm")
    get_db().write_audit(ctx["shop_id"], user_id_of(ctx), ctx.get("email"), "product_update", target=str(product_id), payload=data)
    return updated


@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, ctx: dict = Depends(require_shop)):
    if not get_db().get_product(ctx["shop_id"], product_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy sản phẩm")
    get_db().delete_product(ctx["shop_id"], product_id)
    get_db().write_audit(ctx["shop_id"], user_id_of(ctx), ctx.get("email"), "product_delete", target=str(product_id))
    return {"ok": True}


# --------------------------- Customers ---------------------------
@app.get("/api/customers")
def list_customers(ctx: dict = Depends(require_shop)):
    return get_db().list_customers(ctx["shop_id"])


@app.post("/api/customers", status_code=201)
def create_customer(body: CustomerIn, ctx: dict = Depends(require_shop)):
    return get_db().create_customer(ctx["shop_id"], body.model_dump())


@app.get("/api/customers/{customer_id}")
def get_customer(customer_id: int, ctx: dict = Depends(require_shop)):
    c = get_db().get_customer(ctx["shop_id"], customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")
    return c


# --------------------------- Orders ---------------------------
@app.get("/api/orders")
def list_orders(ctx: dict = Depends(require_shop)):
    return get_db().list_orders(ctx["shop_id"])


@app.get("/api/orders/{order_id}")
def get_order(order_id: int, ctx: dict = Depends(require_shop)):
    order = get_db().get_order(ctx["shop_id"], order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
    return order


@app.post("/api/orders", status_code=201)
def create_order(body: OrderIn, ctx: dict = Depends(require_shop)):
    try:
        items = [it.model_dump() for it in body.items]
        return get_db().create_order(ctx["shop_id"], items, body.customer_id, user_id_of(ctx))
    except (StockError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))


# --------------------------- Reports (OWNER only) ---------------------------
@app.get("/api/report/summary")
def report_summary(ctx: dict = Depends(require_owner)):
    get_db().write_audit(ctx["shop_id"], user_id_of(ctx), ctx.get("email"), "view_financial_report")
    return get_db().report_summary(ctx["shop_id"])


# --------------------------- Members / RBAC (OWNER only) ---------------------------
@app.get("/api/members")
def list_members(ctx: dict = Depends(require_owner)):
    return {"members": get_db().list_members(ctx["shop_id"])}


@app.post("/api/members", status_code=201)
def invite_member(body: MemberInvite, ctx: dict = Depends(require_owner)):
    # Sinh token + hạn 7 ngày -> lưu lời mời. Gửi email tự động qua Supabase (nếu có origin),
    # đồng thời trả link để owner copy gửi tay (Zalo/SMS) nếu email chưa tới.
    token = uuid.uuid4().hex
    expires = (datetime.now(timezone.utc) + timedelta(days=INVITE_TTL_DAYS)).isoformat()
    row = get_db().invite_member(ctx["shop_id"], str(body.email), body.role, user_id_of(ctx), token, expires)
    join_path = f"/join?token={token}"
    emailed = False
    if body.origin:
        emailed = send_invite_email(str(body.email), body.origin.rstrip("/") + join_path)
    get_db().write_audit(ctx["shop_id"], user_id_of(ctx), ctx.get("email"), "invite_member", target=str(body.email), payload={"role": body.role, "emailed": emailed})
    return {**(row or {}), "invite_token": token, "join_path": join_path, "expires_at": expires, "email_sent": emailed}


@app.patch("/api/members/{member_id}")
def update_member(member_id: str, body: MemberUpdate, ctx: dict = Depends(require_owner)):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="Không có thay đổi")
    updated = get_db().update_member(ctx["shop_id"], member_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail="Không tìm thấy thành viên")
    get_db().write_audit(ctx["shop_id"], user_id_of(ctx), ctx.get("email"), "update_member", target=member_id, payload=data)
    return updated


@app.delete("/api/members/{member_id}")
def remove_member(member_id: str, ctx: dict = Depends(require_owner)):
    get_db().remove_member(ctx["shop_id"], member_id)
    get_db().write_audit(ctx["shop_id"], user_id_of(ctx), ctx.get("email"), "remove_member", target=member_id)
    return {"ok": True}


@app.post("/api/members/{member_id}/transfer-ownership")
def transfer_ownership(member_id: str, ctx: dict = Depends(require_owner)):
    """Chuyển quyền chủ cho 1 thành viên khác; người gọi trở thành staff."""
    members = {m["id"]: m for m in get_db().list_members(ctx["shop_id"])}
    target = members.get(member_id)
    if not target or not target.get("user_id") or target.get("status") != "active":
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên hợp lệ để chuyển quyền")
    get_db().transfer_ownership(ctx["shop_id"], user_id_of(ctx), member_id)
    get_db().write_audit(ctx["shop_id"], user_id_of(ctx), ctx.get("email"), "transfer_ownership", target=member_id)
    return {"ok": True}


# --------------------------- Rời / xoá cửa hàng ---------------------------
@app.post("/api/shop/leave")
def leave_shop(ctx: dict = Depends(require_shop)):
    uid = user_id_of(ctx)
    if ctx.get("role") == "owner" and get_db().count_active_members(ctx["shop_id"]) > 1:
        raise HTTPException(status_code=409,
                            detail="Bạn là chủ cửa hàng. Hãy chuyển quyền cho nhân viên khác hoặc xoá cửa hàng trước khi rời.")
    get_db().leave_shop(ctx["shop_id"], uid)
    get_db().write_audit(ctx["shop_id"], uid, ctx.get("email"), "leave_shop")
    return {"ok": True}


@app.delete("/api/shop")
def delete_shop(ctx: dict = Depends(require_owner)):
    sid = ctx["shop_id"]
    get_db().write_audit(sid, user_id_of(ctx), ctx.get("email"), "delete_shop", target=sid)
    get_db().delete_shop(sid)
    return {"ok": True}


# --------------------------- Invites / join (token-based) ---------------------------
@app.get("/api/invites")
def my_invites(ctx: dict = Depends(require_user)):
    """Lời mời đang chờ gửi tới email của tôi (cho màn onboarding staff)."""
    email = ctx.get("email")
    return get_db().list_invites_for_email(email) if email else []


@app.get("/api/invite/{token}")
def validate_invite(token: str):
    """Công khai (không cần login) — để màn /join hiển thị 'bạn được mời vào shop X'."""
    inv = get_db().get_invite_by_token(token)
    if not inv or inv.get("user_id") or inv.get("status") != "pending_invite":
        return {"valid": False, "reason": "Lời mời không hợp lệ hoặc đã được sử dụng."}
    from db import _is_expired
    if _is_expired(inv.get("invite_expires_at")):
        return {"valid": False, "reason": "Lời mời đã hết hạn."}
    return {"valid": True, "shop_name": inv.get("shop_name"),
            "invited_email": inv.get("invited_email"), "role": inv.get("role")}


@app.post("/api/join")
def join_by_token(body: JoinByToken, ctx: dict = Depends(require_user)):
    uid, email = user_id_of(ctx), ctx.get("email")
    if not (uid and email):
        raise HTTPException(status_code=400, detail="Cần đăng nhập để nhận lời mời")
    try:
        m = get_db().accept_invite_by_token(body.token, uid, email)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    get_db().write_audit(m["shop_id"], uid, email, "accept_invite", target=m["shop_id"])
    return {"ok": True, "shop_id": m["shop_id"], "shop_name": m.get("shop_name")}


# --------------------------- Notifications ---------------------------
@app.get("/api/notifications")
def notifications(ctx: dict = Depends(require_user)):
    shop_id = ctx.get("shop_id")
    if not shop_id:
        email = ctx.get("email")
        invs = get_db().list_invites_for_email(email) if email else []
        return [{"type": "invite", "token": i.get("invite_token"),
                 "title": f"Lời mời vào {i.get('shop_name') or 'cửa hàng'}",
                 "body": f"Bạn được mời làm {i.get('role')}.", "role": i.get("role")} for i in invs]
    return get_db().notifications(shop_id, ctx.get("email"))


# --------------------------- Audit log (OWNER only) ---------------------------
@app.get("/api/audit")
def audit(ctx: dict = Depends(require_owner)):
    return get_db().list_audit(ctx["shop_id"])
