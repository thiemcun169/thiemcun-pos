"""
ThiemCun POS — Backend FastAPI (tầng "nhà bếp").

Chạy được ở 2 nơi với CÙNG file này:
  - Local:  uvicorn index:app --reload  (từ thư mục api/)  hoặc  vercel dev
  - Vercel: tự nhận `app` ở api/index.py và biến thành 1 serverless function.

Mọi route đặt tiền tố /api (Vercel rewrite /api/* về function này — xem vercel.json).
Truy cập dữ liệu QUA db.get_db() (lớp kết nối để riêng — đổi Supabase/SQLite không đụng route).
"""

from __future__ import annotations

import os
import sys

# Đảm bảo import được các module cùng thư mục (db, auth, pricing, seed_data)
# kể cả khi Vercel chạy function với thư mục làm việc khác. PHẢI đặt TRƯỚC các import sibling.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from typing import Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from auth import auth_enabled, current_user, user_id_of
from db import get_db
from pricing import StockError

# --- Sentry (tuỳ chọn, buổi 3): chỉ bật khi có SENTRY_DSN ---
if os.environ.get("SENTRY_DSN"):
    import sentry_sdk
    sentry_sdk.init(
        dsn=os.environ["SENTRY_DSN"],
        traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        environment=os.environ.get("VERCEL_ENV", "development"),
    )

app = FastAPI(title="ThiemCun POS API", version="1.0.0")

# --- CORS: cho phép frontend gọi. Origin rõ ràng (không dùng "*" khi có credentials). ---
_default_origins = "http://localhost:5173,http://127.0.0.1:5173"
_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", _default_origins).split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",  # các bản preview của Vercel
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


# --------------------------- Health / meta ---------------------------
@app.get("/api/health")
def health():
    return {"status": "ok", "db_backend": get_db().backend_name, "auth_enabled": auth_enabled()}


# --------------------------- Products ---------------------------
@app.get("/api/products")
def list_products(user=Depends(current_user)):
    return get_db().list_products()


@app.post("/api/products", status_code=201)
def create_product(body: ProductIn, user=Depends(current_user)):
    return get_db().create_product(body.model_dump())


@app.patch("/api/products/{product_id}")
def update_product(product_id: int, body: ProductUpdate, user=Depends(current_user)):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = get_db().update_product(product_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail="Không tìm thấy sản phẩm")
    return updated


# --------------------------- Customers ---------------------------
@app.get("/api/customers")
def list_customers(user=Depends(current_user)):
    return get_db().list_customers()


@app.post("/api/customers", status_code=201)
def create_customer(body: CustomerIn, user=Depends(current_user)):
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
        # Lỗi nghiệp vụ (giỏ rỗng, hết hàng, sản phẩm không tồn tại) -> 400.
        raise HTTPException(status_code=400, detail=str(e))


# --------------------------- Reports ---------------------------
@app.get("/api/report/summary")
def report_summary(user=Depends(current_user)):
    return get_db().report_summary()
