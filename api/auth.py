"""
Auth + phân quyền theo CỬA HÀNG (multi-tenant RBAC).

Luồng:
  Người dùng đăng nhập (email/mật khẩu · Google · magic link) -> Supabase cấp JWT ->
  frontend gửi:
    Authorization: Bearer <jwt>      (ai đang đăng nhập)
    X-Shop-Id: <uuid>                (đang làm việc với cửa hàng nào)
  backend:
    1. xác thực token qua /auth/v1/user (hợp mọi thuật toán ký, kể cả ES256),
    2. tra THÀNH VIÊN: user này thuộc shop X với vai trò gì (owner|staff)?
       -> vai trò KHÔNG còn lấy từ profiles.role, mà từ bảng shop_members.

Quy ước:
  - Demo (chưa cấu hình Supabase): coi như owner của 1 shop demo cố định.
  - require_shop : bắt buộc đăng nhập + là thành viên active của shop đang chọn.
  - require_owner: thêm điều kiện vai trò owner trong shop đó.
"""

from __future__ import annotations

import os
from typing import Optional

import httpx
from fastapi import Depends, Header, HTTPException

from db import get_db, DEMO_SHOP_ID, DEMO_USER_ID


def _supabase_url() -> Optional[str]:
    return os.environ.get("SUPABASE_URL")


def _anon_key() -> Optional[str]:
    return os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")


def auth_enabled() -> bool:
    return bool(_supabase_url() and _anon_key())


_client = httpx.Client(timeout=8.0)


def _verify_token(token: str) -> dict:
    """Hỏi Supabase token có hợp lệ không -> trả thông tin user (id, email)."""
    url, key = _supabase_url(), _anon_key()
    if not (url and key):
        raise HTTPException(status_code=500, detail="Auth chưa cấu hình")
    try:
        r = _client.get(f"{url.rstrip('/')}/auth/v1/user",
                        headers={"Authorization": f"Bearer {token}", "apikey": key})
    except httpx.HTTPError as e:
        raise HTTPException(status_code=503, detail=f"Không kết nối được Auth: {e}")
    if r.status_code == 200:
        return r.json()
    raise HTTPException(status_code=401, detail="Vé đăng nhập không hợp lệ hoặc đã hết hạn")


def send_invite_email(email: str, redirect_url: str) -> bool:
    """Gửi email mời qua Supabase (magic-link OTP, auto-email). `create_user=true` để hợp
    cả người MỚI lẫn đã có tài khoản. Sau khi bấm link + xác thực, Supabase redirect tới
    `redirect_url` (= .../join?token=...) -> app tự nhận lời mời (auto-staff).
    Trả True nếu gửi OK; KHÔNG làm gãy luồng mời nếu email lỗi (free tier ~4 email/giờ)."""
    url, key = _supabase_url(), _anon_key()
    if not (url and key):
        return False
    try:
        r = _client.post(
            f"{url.rstrip('/')}/auth/v1/otp",
            params={"redirect_to": redirect_url},
            headers={"apikey": key, "Content-Type": "application/json"},
            json={"email": email, "create_user": True},
        )
        return r.status_code < 400
    except httpx.HTTPError:
        return False


def current_user(authorization: Optional[str] = Header(default=None)) -> Optional[dict]:
    """Token tuỳ chọn. Có token -> verify -> trả danh tính {id, email, full_name}.
    KHÔNG còn gắn role ở đây — vai trò phụ thuộc vào cửa hàng (xem shop_context)."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    u = _verify_token(token)
    uid = u.get("id") or u.get("sub")
    meta = u.get("user_metadata") or {}
    return {
        "id": uid,
        "email": (u.get("email") or "").lower() or None,
        "full_name": meta.get("full_name") or meta.get("name"),
    }


def _demo_ctx() -> dict:
    """Bối cảnh demo (chưa cấu hình Supabase): owner của shop demo, kèm danh sách shop."""
    shops = get_db().list_user_shops(DEMO_USER_ID)
    return {
        "user": {"id": DEMO_USER_ID, "email": "demo@local", "full_name": "Demo"},
        "user_id": DEMO_USER_ID, "email": "demo@local",
        "shop_id": DEMO_SHOP_ID, "role": "owner", "shops": shops,
    }


def shop_context(user: Optional[dict] = Depends(current_user),
                 x_shop_id: Optional[str] = Header(default=None)) -> dict:
    """Bối cảnh làm việc: ai + đang ở cửa hàng nào + vai trò gì.

    ĐA THÀNH VIÊN: 1 user có thể thuộc NHIỀU shop (owner shop này + staff shop khác).
    Frontend gửi header `X-Shop-Id` để chọn shop đang làm việc (shop-switcher).
    - Demo (chưa bật auth): owner của shop demo.
    - Header trỏ shop user KHÔNG thuộc (hoặc cũ) -> lùi về shop đầu tiên của họ (an toàn).
    - Chưa thuộc shop nào -> shop_id=None (frontend đưa vào onboarding wizard).
    """
    if not auth_enabled():
        return _demo_ctx()
    if not user:
        return {"user": None, "user_id": None, "email": None, "shop_id": None, "role": None, "shops": []}

    shops = get_db().list_user_shops(user["id"])
    chosen = None
    if x_shop_id:
        chosen = next((s for s in shops if str(s.get("id")) == str(x_shop_id)), None)
    if chosen is None and shops:
        chosen = shops[0]
    return {
        "user": user, "user_id": user["id"], "email": user.get("email"),
        "shop_id": chosen["id"] if chosen else None,
        "role": chosen.get("my_role") if chosen else None,
        "shops": shops,
    }


def require_user(ctx: dict = Depends(shop_context)) -> dict:
    """Bắt buộc đã đăng nhập (demo coi như đã đăng nhập)."""
    if ctx.get("user") is None and auth_enabled():
        raise HTTPException(status_code=401, detail="Cần đăng nhập")
    return ctx


def require_shop(ctx: dict = Depends(require_user)) -> dict:
    """Bắt buộc đang ở 1 cửa hàng hợp lệ (là thành viên active)."""
    if not ctx.get("shop_id"):
        raise HTTPException(status_code=409, detail="Chưa chọn/ chưa có cửa hàng")
    return ctx


def require_owner(ctx: dict = Depends(require_shop)) -> dict:
    """Bắt buộc vai trò owner trong cửa hàng đang chọn."""
    if ctx.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Chỉ chủ cửa hàng (owner) mới có quyền này")
    return ctx


def user_id_of(ctx: Optional[dict]) -> Optional[str]:
    if not ctx:
        return None
    uid = ctx.get("user_id")
    return None if uid == DEMO_USER_ID else uid
