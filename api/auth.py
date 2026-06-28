"""
Auth + phân quyền (RBAC) — kiểm "vé" đăng nhập (JWT) Supabase + nạp hồ sơ (role/status).

Luồng:
  Người dùng đăng nhập (email/mật khẩu HOẶC Google) -> Supabase cấp JWT ->
  frontend gửi `Authorization: Bearer <jwt>` -> backend:
    1. xác thực token qua /auth/v1/user (hợp mọi thuật toán ký, kể cả ES256),
    2. nạp profile (role owner|staff, status, must_change_password) từ bảng profiles
       qua service_role (bỏ qua RLS) — để biết quyền của user.

Quy ước:
  - Token TUỲ CHỌN ở route công khai (catalog). Route nhạy cảm dùng require_user / require_owner.
  - user bị 'disabled' -> 403 (khoá truy cập).
"""

from __future__ import annotations

import os
from typing import Optional

import httpx
from fastapi import Depends, Header, HTTPException


def _supabase_url() -> Optional[str]:
    return os.environ.get("SUPABASE_URL")


def _anon_key() -> Optional[str]:
    return os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")


def _service_key() -> Optional[str]:
    return os.environ.get("SUPABASE_SERVICE_ROLE_KEY")


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


def _fetch_profile(user_id: str) -> Optional[dict]:
    """Nạp profile qua service_role (bỏ qua RLS)."""
    url, skey = _supabase_url(), _service_key()
    if not (url and skey):
        return None
    try:
        r = _client.get(
            f"{url.rstrip('/')}/rest/v1/profiles",
            params={"id": f"eq.{user_id}", "select": "id,email,full_name,role,status,must_change_password"},
            headers={"apikey": skey, "Authorization": f"Bearer {skey}"},
        )
        if r.status_code == 200 and r.json():
            return r.json()[0]
    except httpx.HTTPError:
        return None
    return None


def current_user(authorization: Optional[str] = Header(default=None)) -> Optional[dict]:
    """
    Token tuỳ chọn. Có token -> verify + nạp profile.
    Trả dict {id, email, role, status, must_change_password} hoặc None (khách).
    user 'disabled' -> 403.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    u = _verify_token(token)
    uid = u.get("id") or u.get("sub")
    prof = _fetch_profile(uid) or {}
    if prof.get("status") == "disabled":
        raise HTTPException(status_code=403, detail="Tài khoản đã bị vô hiệu hoá. Liên hệ admin.")
    return {
        "id": uid,
        "email": u.get("email") or prof.get("email"),
        "role": prof.get("role", "staff"),
        "status": prof.get("status", "active"),
        "must_change_password": bool(prof.get("must_change_password", False)),
        "full_name": prof.get("full_name"),
    }


_DEMO_OWNER = {"id": None, "email": "demo@local", "role": "owner",
               "status": "active", "must_change_password": False, "full_name": "Demo"}


def require_user(user: Optional[dict] = Depends(current_user)) -> dict:
    """Dependency: bắt buộc đã đăng nhập (và active). Chế độ demo (chưa cấu hình
    Supabase) coi như owner để dev/test chạy được."""
    if not auth_enabled():
        return _DEMO_OWNER
    if not user:
        raise HTTPException(status_code=401, detail="Cần đăng nhập")
    return user


def require_owner(user: dict = Depends(require_user)) -> dict:
    """Dependency: bắt buộc vai trò owner."""
    if not auth_enabled():
        return _DEMO_OWNER
    if user.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Chỉ chủ shop (owner) mới có quyền này")
    return user


def user_id_of(user: Optional[dict]) -> Optional[str]:
    if not user:
        return None
    return user.get("id") or user.get("sub")
