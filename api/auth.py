"""
Kiểm "vé" đăng nhập (JWT) do Supabase Auth cấp.

Luồng (buổi 3): người dùng bấm "Đăng nhập với Google" -> Google xác thực ->
Supabase cấp JWT -> frontend gửi kèm header `Authorization: Bearer <jwt>` ->
backend ở đây kiểm vé trước khi gắn user_id vào đơn hàng.

THIẾT KẾ:
  - Token là TUỲ CHỌN (cho phép khách dùng thử không cần đăng nhập). Nếu CÓ token
    thì BẮT BUỘC hợp lệ (sai/hết hạn -> 401).
  - Cách kiểm vé: gọi thẳng endpoint `/auth/v1/user` của Supabase với token +
    apikey. Cách này hoạt động với MỌI thuật toán ký (HS256 cũ hoặc ES256 mới
    mà project Supabase đời mới dùng mặc định) — không cần tự verify chữ ký,
    không cần thêm thư viện `cryptography` nặng vào bundle serverless.
"""

from __future__ import annotations

import os
from typing import Optional

import httpx
from fastapi import Header, HTTPException


def _supabase_url() -> Optional[str]:
    return os.environ.get("SUPABASE_URL")


def _anon_key() -> Optional[str]:
    # anon/publishable key (an toàn) dùng làm `apikey` khi gọi /auth/v1/user.
    return os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")


def auth_enabled() -> bool:
    """Auth khả dụng khi đã cấu hình Supabase. (Token vẫn TUỲ CHỌN.)"""
    return bool(_supabase_url() and _anon_key())


# Client dùng lại giữa các request (serverless giữ ấm) — timeout ngắn để không treo.
_client = httpx.Client(timeout=8.0)


def verify_token(token: str) -> dict:
    """Hỏi Supabase xem vé có hợp lệ không. Trả payload user, hoặc ném 401."""
    url = _supabase_url()
    key = _anon_key()
    if not (url and key):
        raise HTTPException(status_code=500, detail="Auth chưa cấu hình (thiếu SUPABASE_URL/ANON_KEY)")
    try:
        r = _client.get(
            f"{url.rstrip('/')}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": key},
        )
    except httpx.HTTPError as e:
        raise HTTPException(status_code=503, detail=f"Không kết nối được Auth: {e}")
    if r.status_code == 200:
        return r.json()
    raise HTTPException(status_code=401, detail="Vé đăng nhập không hợp lệ hoặc đã hết hạn")


def current_user(authorization: Optional[str] = Header(default=None)) -> Optional[dict]:
    """
    FastAPI dependency.
    - Không có header Bearer -> trả None (khách, vẫn cho dùng).
    - Có header Bearer -> bắt buộc hợp lệ, trả payload user (chứa 'id').
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    return verify_token(token)


def user_id_of(user: Optional[dict]) -> Optional[str]:
    # /auth/v1/user trả {"id": "<uuid>", ...}; JWT thuần dùng 'sub'.
    if not user:
        return None
    return user.get("id") or user.get("sub")
