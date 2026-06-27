"""
Kiểm "vé" đăng nhập (JWT) do Supabase Auth cấp.

Luồng (buổi 3): người dùng bấm "Đăng nhập với Google" -> Google xác thực ->
Supabase cấp JWT -> frontend gửi kèm header `Authorization: Bearer <jwt>` ->
backend ở đây kiểm vé trước khi trả dữ liệu.

Thiết kế "bật/tắt được":
  - Nếu CHƯA cấu hình SUPABASE_JWT_SECRET -> chế độ MỞ (cho phép mọi request,
    user_id = None). Tiện cho dev/demo khi chưa bật Auth.
  - Nếu ĐÃ cấu hình -> bắt buộc có vé hợp lệ cho các route cần đăng nhập.

JWT của Supabase ký bằng HS256 với "JWT secret" (Settings -> API -> JWT secret).
"""

from __future__ import annotations

import os
from typing import Optional

import jwt
from fastapi import Header, HTTPException


def _jwt_secret() -> Optional[str]:
    return os.environ.get("SUPABASE_JWT_SECRET")


def auth_enabled() -> bool:
    return bool(_jwt_secret())


def verify_token(token: str) -> dict:
    """Giải mã & xác thực JWT. Ném HTTPException nếu vé sai/hết hạn."""
    secret = _jwt_secret()
    if not secret:
        raise HTTPException(status_code=500, detail="Auth chưa cấu hình (thiếu SUPABASE_JWT_SECRET)")
    try:
        # Supabase dùng audience="authenticated".
        payload = jwt.decode(token, secret, algorithms=["HS256"], audience="authenticated")
        return payload
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"Vé đăng nhập không hợp lệ: {e}")


def current_user(authorization: Optional[str] = Header(default=None)) -> Optional[dict]:
    """
    FastAPI dependency.
    - Auth tắt: trả None (chế độ mở).
    - Auth bật: yêu cầu header Bearer hợp lệ, trả payload (chứa 'sub' = user id).
    """
    if not auth_enabled():
        return None
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Cần đăng nhập (thiếu Bearer token)")
    token = authorization.split(" ", 1)[1].strip()
    return verify_token(token)


def user_id_of(user: Optional[dict]) -> Optional[str]:
    return user.get("sub") if user else None
