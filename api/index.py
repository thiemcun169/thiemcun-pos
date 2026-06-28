"""
ThiemCun POS — Backend FastAPI (tầng "nhà bếp").

Chạy được ở 2 nơi với CÙNG file này:
  - Local:  uvicorn index:app --reload  (từ thư mục api/)  hoặc  vercel dev
  - Vercel: tự nhận `app` ở api/index.py và biến thành 1 serverless function.

Mọi route đặt tiền tố /api (Vercel rewrite /api/* về function này — xem vercel.json).
Truy cập dữ liệu QUA db.get_db(). Phân quyền QUA auth.require_user / require_owner.
"""

from __future__ import annotations

import os
import sys

# Đảm bảo import được module cùng thư mục kể cả khi Vercel đổi cwd. PHẢI đặt TRƯỚC import sibling.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from typing import Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from auth import auth_enabled, current_user, require_owner, require_user, user_id_of
from db import get_db
from pricing import StockError

# --- Sentry (tuỳ chọn): chỉ bật khi có SENTRY_DSN ---
if os.environ.get("SENTRY_DSN"):
    import sentry_sdk
    sentry_sdk.init(
        dsn=os.environ["SENTRY_DSN"],
        traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        environment=os.environ.get("VERCEL_ENV", "development"),
    )

app = FastAPI(title="ThiemCun POS API", version="2.0.0")

# --- CORS: chỉ cho phép origin của domain MÌNH (siết, không dùng "*") ---
_default_origins = ",".join([
    "http://localhost:5173", "http://127.0.0.1:5173",
    "https://thiemcun-six.vercel.app", "https://thiemcun.is-a.dev",
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


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = Field(default=None, ge=0)
    stock: Optional[int] = Field(default=None, ge=0)


class CustomerIn(BaseModel):
    name: str = Field(min_length=1)
    phone: Optional[str] = None


class OrderItemIn(BaseModel):
    product_id: int
    qty: int = Field(gt=0)


class OrderIn(BaseModel):
    items: list[OrderItemIn] = Field(min_length=1)
    customer_id: Optional[int] = None


class AllowedEmailIn(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    role: str = Field(default="staff", pattern="^(owner|staff)$")


class ProfileUpdate(BaseModel):
    role: Optional[str] = Field(default=None, pattern="^(owner|staff)$")
    status: Optional[str] = Field(default=None, pattern="^(active|disabled)$")
    full_name: Optional[str] = None


# --------------------------- Health / meta ---------------------------
@app.get("/api/health")
def health():
    return {"status": "ok", "db_backend": get_db().backend_name, "auth_enabled": auth_enabled()}


@app.get("/api/me")
def me(user: dict = Depends(require_user)):
    """Hồ sơ của chính mình (role, status, must_change_password)."""
    return user


@app.post("/api/me/password-changed")
def password_changed(user: dict = Depends(require_user)):
    """Frontend gọi sau khi user đổi mật khẩu lần đầu -> tắt cờ must_change_password."""
    if user.get("id"):
        get_db().update_profile(user["id"], {"must_change_password": False})
        get_db().write_audit(user["id"], user.get("email"), "password_changed")
    return {"ok": True}


# --------------------------- Products ---------------------------
@app.get("/api/products")
def list_products(user=Depends(current_user)):
    return get_db().list_products()


@app.post("/api/products", status_code=201)
def create_product(body: ProductIn, user: dict = Depends(require_user)):
    p = get_db().create_product(body.model_dump())
    get_db().write_audit(user.get("id"), user.get("email"), "product_create", target=str(p.get("id")), payload={"name": p.get("name")})
    return p


@app.patch("/api/products/{product_id}")
def update_product(product_id: int, body: ProductUpdate, user: dict = Depends(require_user)):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = get_db().update_product(product_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail="Không tìm thấy sản phẩm")
    get_db().write_audit(user.get("id"), user.get("email"), "product_update", target=str(product_id), payload=data)
    return updated


# --------------------------- Customers ---------------------------
@app.get("/api/customers")
def list_customers(user=Depends(current_user)):
    return get_db().list_customers()


@app.post("/api/customers", status_code=201)
def create_customer(body: CustomerIn, user: dict = Depends(require_user)):
    return get_db().create_customer(body.model_dump())


# --------------------------- Orders ---------------------------
@app.get("/api/orders")
def list_orders(user=Depends(current_user)):
    return get_db().list_orders()


@app.get("/api/orders/{order_id}")
def get_order(order_id: int, user=Depends(current_user)):
    order = get_db().get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
    return order


@app.post("/api/orders", status_code=201)
def create_order(body: OrderIn, user=Depends(current_user)):
    try:
        items = [it.model_dump() for it in body.items]
        return get_db().create_order(items, body.customer_id, user_id_of(user))
    except (StockError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))


# --------------------------- Reports (OWNER only) ---------------------------
@app.get("/api/report/summary")
def report_summary(user: dict = Depends(require_owner)):
    get_db().write_audit(user.get("id"), user.get("email"), "view_financial_report")
    return get_db().report_summary()


# --------------------------- Employees / RBAC (OWNER only) ---------------------------
@app.get("/api/employees")
def list_employees(user: dict = Depends(require_owner)):
    return {
        "profiles": get_db().list_profiles(),
        "pending": get_db().list_allowed_emails(),
    }


@app.post("/api/employees", status_code=201)
def invite_employee(body: AllowedEmailIn, user: dict = Depends(require_owner)):
    row = get_db().add_allowed_email(str(body.email), body.role, invited_by=user.get("id"))
    get_db().write_audit(user.get("id"), user.get("email"), "invite_employee", target=str(body.email), payload={"role": body.role})
    return row


@app.patch("/api/employees/{profile_id}")
def update_employee(profile_id: str, body: ProfileUpdate, user: dict = Depends(require_owner)):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="Không có thay đổi")
    updated = get_db().update_profile(profile_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên")
    get_db().write_audit(user.get("id"), user.get("email"), "update_employee", target=profile_id, payload=data)
    return updated


@app.delete("/api/employees/pending/{email}")
def revoke_invite(email: str, user: dict = Depends(require_owner)):
    get_db().remove_allowed_email(email)
    get_db().write_audit(user.get("id"), user.get("email"), "revoke_invite", target=email)
    return {"ok": True}


# --------------------------- Audit log (OWNER only) ---------------------------
@app.get("/api/audit")
def audit(user: dict = Depends(require_owner)):
    return get_db().list_audit()
