"""
Lớp kết nối dữ liệu (Data layer) — ĐỂ RIÊNG MỘT CHỖ.

Nguyên tắc kiến trúc của khoá: mọi truy cập database đi qua đây.
Sau muốn đổi nhà cung cấp (Supabase -> khác) chỉ sửa file này, KHÔNG đụng giao diện.

ĐA CỬA HÀNG (multi-tenant) — đọc kỹ:
  Backend dùng service_role -> BỎ QUA RLS. Vì vậy CÁCH LY GIỮA CÁC SHOP được ép
  Ở ĐÂY: gần như mọi hàm nhận `shop_id` (cửa hàng đang hoạt động) và LUÔN lọc
  theo nó. Route ở index.py chỉ truyền vào shop_id mà user thực sự là thành viên
  (đã kiểm ở auth.py) -> không thể đọc/ghi nhầm dữ liệu shop khác.

Hai backend:
  - SqliteDatabase  : chạy local + test (không cần Internet, không cần key).
  - SupabaseDatabase: chạy thật (Postgres của Supabase, qua REST PostgREST + service_role key).

Chọn backend tự động:
  - Nếu có SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY trong môi trường -> dùng Supabase.
  - Ngược lại -> dùng SQLite (mặc định cho dev/test).
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from pricing import line_total, check_stock
from seed_data import SEED_PRODUCTS, SEED_CUSTOMERS, SEED_ORDERS

# Shop mặc định cho chế độ demo (không cấu hình Supabase) — id cố định để backend tham chiếu.
DEMO_SHOP_ID = "demo-shop"
DEMO_USER_ID = "demo-user"


def _new_id() -> str:
    return str(uuid.uuid4())


def _parse_iso(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def _is_expired(expires_at: Optional[str]) -> bool:
    """Lời mời hết hạn? (so với thời điểm hiện tại UTC)."""
    dt = _parse_iso(expires_at)
    return bool(dt and dt < datetime.now(timezone.utc))


# ---------------------------------------------------------------------------
# Giao diện chung (interface) — phần còn lại của app chỉ biết tới các hàm này.
# Hầu hết hàm dữ liệu nhận shop_id (cửa hàng đang hoạt động).
# ---------------------------------------------------------------------------
class Database:
    backend_name = "abstract"

    # --- shops ---
    def list_user_shops(self, user_id: Optional[str]) -> list[dict]: ...
    def get_shop(self, shop_id: str) -> Optional[dict]: ...
    def create_shop(self, name: str, user_id: Optional[str]) -> dict: ...
    def update_shop(self, shop_id: str, data: dict) -> Optional[dict]: ...

    # --- shop members / invites (token-based) ---
    def get_membership(self, shop_id: str, user_id: Optional[str]) -> Optional[dict]:
        return None

    def get_active_membership(self, user_id: Optional[str]) -> Optional[dict]:
        """Membership ACTIVE duy nhất của user (luật 1-shop). None nếu là 'orphan'."""
        return None

    def list_members(self, shop_id: str) -> list[dict]:
        return []

    def invite_member(self, shop_id: str, email: str, role: str, invited_by: Optional[str], token: str, expires_at: str) -> dict: ...
    def update_member(self, shop_id: str, member_id: str, data: dict) -> Optional[dict]: ...
    def remove_member(self, shop_id: str, member_id: str) -> None: ...
    def list_invites_for_email(self, email: str) -> list[dict]:
        return []
    def get_invite_by_token(self, token: str) -> Optional[dict]: ...
    def accept_invite_by_token(self, token: str, user_id: str, email: str) -> dict:
        """Nhận lời mời. Raise ValueError nếu token sai/hết hạn/email lệch/đã có shop."""
        ...
    def leave_shop(self, shop_id: str, user_id: str) -> None: ...
    def transfer_ownership(self, shop_id: str, from_user_id: str, to_member_id: str) -> None: ...
    def delete_shop(self, shop_id: str) -> None: ...
    def count_active_members(self, shop_id: str) -> int:
        return 0

    # --- products ---
    def list_products(self, shop_id: str) -> list[dict]: ...
    def get_product(self, shop_id: str, product_id: int) -> Optional[dict]: ...
    def create_product(self, shop_id: str, data: dict) -> dict: ...
    def update_product(self, shop_id: str, product_id: int, data: dict) -> Optional[dict]: ...
    def delete_product(self, shop_id: str, product_id: int) -> None: ...

    # --- customers ---
    def list_customers(self, shop_id: str) -> list[dict]: ...
    def get_customer(self, shop_id: str, customer_id: int) -> Optional[dict]: ...
    def create_customer(self, shop_id: str, data: dict) -> dict: ...

    # --- orders ---
    def list_orders(self, shop_id: str, limit: int = 50) -> list[dict]: ...
    def get_order(self, shop_id: str, order_id: int) -> Optional[dict]: ...
    def create_order(self, shop_id: str, items: list[dict], customer_id: Optional[int], user_id: Optional[str]) -> dict: ...

    # --- reports ---
    def report_summary(self, shop_id: str) -> dict: ...

    # --- notifications (suy ra động: lời mời + tồn thấp) ---
    def notifications(self, shop_id: str, email: Optional[str]) -> list[dict]:
        return []

    # --- maintenance ---
    def clear_shop_data(self, shop_id: str) -> None: ...
    def reseed_shop(self, shop_id: str) -> None: ...

    # --- audit (mặc định no-op cho demo/test) ---
    def write_audit(self, shop_id: Optional[str], actor_id: Optional[str], actor_email: Optional[str],
                    action: str, target: Optional[str] = None, payload: Optional[dict] = None) -> None:
        return None

    def list_audit(self, shop_id: str, limit: int = 100) -> list[dict]:
        return []


# ---------------------------------------------------------------------------
# SQLite — dùng cho local dev & test. Dữ liệu mẫu được nạp sẵn vào 1 shop demo.
# ---------------------------------------------------------------------------
class SqliteDatabase(Database):
    backend_name = "sqlite"

    def __init__(self, path: str = ":memory:"):
        # check_same_thread=False để FastAPI (nhiều thread) dùng chung 1 connection.
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        self._init_schema()
        self._seed()

    def _init_schema(self) -> None:
        with self._lock:
            self._conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS shops (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL DEFAULT 'Cửa hàng của tôi',
                    slug TEXT UNIQUE,
                    color_primary TEXT NOT NULL DEFAULT '#008060',
                    color_secondary TEXT NOT NULL DEFAULT '#004c3f',
                    logo_url TEXT, address TEXT, hotline TEXT,
                    created_by TEXT,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    transferred_owner_at TEXT,
                    settings TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS shop_members (
                    id TEXT PRIMARY KEY,
                    shop_id TEXT NOT NULL,
                    user_id TEXT,
                    role TEXT NOT NULL DEFAULT 'staff',
                    status TEXT NOT NULL DEFAULT 'pending_invite',
                    invited_email TEXT,
                    invited_by TEXT,
                    invite_token TEXT,
                    invite_expires_at TEXT,
                    joined_at TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
                -- Đa thành viên: 1 user có thể active ở NHIỀU shop (chỉ chống trùng trong cùng shop).
                CREATE UNIQUE INDEX IF NOT EXISTS uq_member_shop_user
                    ON shop_members(shop_id, user_id) WHERE user_id IS NOT NULL;
                CREATE TABLE IF NOT EXISTS products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    shop_id TEXT,
                    name TEXT NOT NULL,
                    sku TEXT,
                    category TEXT,
                    price REAL NOT NULL DEFAULT 0,
                    stock INTEGER NOT NULL DEFAULT 0,
                    image_url TEXT,
                    description TEXT,
                    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
                    deleted_at TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS customers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    shop_id TEXT,
                    name TEXT NOT NULL,
                    phone TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    shop_id TEXT,
                    customer_id INTEGER,
                    user_id TEXT,
                    total REAL NOT NULL DEFAULT 0,
                    status TEXT NOT NULL DEFAULT 'paid',
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS order_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id INTEGER NOT NULL,
                    product_id INTEGER,
                    product_name TEXT NOT NULL,
                    qty INTEGER NOT NULL,
                    unit_price REAL NOT NULL,
                    line_total REAL NOT NULL
                );
                """
            )
            self._conn.commit()

    def _seed(self) -> None:
        with self._lock:
            cur = self._conn.execute("SELECT COUNT(*) AS n FROM shops")
            if cur.fetchone()["n"] > 0:
                return
            # 1 shop demo + 1 owner demo
            self._conn.execute(
                "INSERT INTO shops (id, name, slug, created_by) VALUES (?,?,?,?)",
                (DEMO_SHOP_ID, "ThiemCun Demo Shop", "thiemcun-demo", DEMO_USER_ID),
            )
            self._conn.execute(
                "INSERT INTO shop_members (id, shop_id, user_id, role, status, joined_at)"
                " VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)",
                (_new_id(), DEMO_SHOP_ID, DEMO_USER_ID, "owner", "active"),
            )
            self._conn.commit()
        self._seed_shop_contents(DEMO_SHOP_ID)

    def _seed_shop_contents(self, shop_id: str) -> None:
        """Nạp sản phẩm/khách/đơn mẫu cho 1 shop (dùng cho demo + nút 'reseed').

        SEED_ORDERS dùng product_id/customer_id 1-based theo thứ tự seed; ta ánh xạ
        sang ID THẬT vừa insert (an toàn cả khi reseed -> ID auto-increment đã nhảy)."""
        prod_ids: list[int] = []
        cust_ids: list[int] = []
        with self._lock:
            for p in SEED_PRODUCTS:
                cur = self._conn.execute(
                    "INSERT INTO products (shop_id, name, sku, category, price, stock) VALUES (?,?,?,?,?,?)",
                    (shop_id, p["name"], p["sku"], p["category"], p["price"], p["stock"]),
                )
                prod_ids.append(cur.lastrowid)
            for c in SEED_CUSTOMERS:
                cur = self._conn.execute(
                    "INSERT INTO customers (shop_id, name, phone) VALUES (?,?,?)",
                    (shop_id, c["name"], c["phone"]),
                )
                cust_ids.append(cur.lastrowid)
            self._conn.commit()
        # Đơn mẫu — gọi NGOÀI lock vì create_order tự acquire lock.
        for o in SEED_ORDERS:
            items = [{"product_id": prod_ids[it["product_id"] - 1], "qty": it["qty"]} for it in o["items"]]
            cust = cust_ids[o["customer_id"] - 1] if o.get("customer_id") else None
            self.create_order(shop_id, items, cust, user_id=None)

    # ---- shops ----
    def _shop_row(self, row: sqlite3.Row) -> dict:
        d = dict(row)
        try:
            d["settings"] = json.loads(d.get("settings") or "{}")
        except (TypeError, ValueError):
            d["settings"] = {}
        return d

    def list_user_shops(self, user_id: Optional[str]) -> list[dict]:
        uid = user_id or DEMO_USER_ID
        with self._lock:
            rows = self._conn.execute(
                """SELECT s.*, m.role AS my_role FROM shops s
                   JOIN shop_members m ON m.shop_id = s.id
                   WHERE m.user_id = ? AND m.status = 'active' ORDER BY s.created_at""",
                (uid,),
            ).fetchall()
        return [{**self._shop_row(r), "my_role": r["my_role"]} for r in rows]

    def get_shop(self, shop_id: str) -> Optional[dict]:
        with self._lock:
            row = self._conn.execute("SELECT * FROM shops WHERE id=?", (shop_id,)).fetchone()
        return self._shop_row(row) if row else None

    def create_shop(self, name: str, user_id: Optional[str]) -> dict:
        # Đa thành viên: user có thể tạo/đứng nhiều shop (vừa owner shop này vừa staff shop khác).
        uid = user_id or DEMO_USER_ID
        sid = _new_id()
        with self._lock:
            self._conn.execute(
                "INSERT INTO shops (id, name, created_by) VALUES (?,?,?)", (sid, name, uid)
            )
            self._conn.execute(
                "INSERT INTO shop_members (id, shop_id, user_id, role, status, joined_at)"
                " VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)",
                (_new_id(), sid, uid, "owner", "active"),
            )
            self._conn.commit()
        return self.get_shop(sid)

    _SHOP_FIELDS = ("name", "color_primary", "color_secondary", "logo_url", "address", "hotline")

    def update_shop(self, shop_id: str, data: dict) -> Optional[dict]:
        cur = self.get_shop(shop_id)
        if not cur:
            return None
        m = {**cur, **{k: v for k, v in data.items() if k in self._SHOP_FIELDS}}
        with self._lock:
            self._conn.execute(
                "UPDATE shops SET name=?, color_primary=?, color_secondary=?, logo_url=?,"
                " address=?, hotline=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                (m.get("name") or "Cửa hàng của tôi", m.get("color_primary"), m.get("color_secondary"),
                 m.get("logo_url"), m.get("address"), m.get("hotline"), shop_id),
            )
            self._conn.commit()
        return self.get_shop(shop_id)

    # ---- members / invites (token-based, luật 1-shop) ----
    def get_membership(self, shop_id: str, user_id: Optional[str]) -> Optional[dict]:
        if not user_id:
            return None
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM shop_members WHERE shop_id=? AND user_id=? AND status='active'",
                (shop_id, user_id),
            ).fetchone()
        return dict(row) if row else None

    def get_active_membership(self, user_id: Optional[str]) -> Optional[dict]:
        if not user_id:
            return None
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM shop_members WHERE user_id=? AND status='active' LIMIT 1", (user_id,)
            ).fetchone()
        return dict(row) if row else None

    def list_members(self, shop_id: str) -> list[dict]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM shop_members WHERE shop_id=? AND status != 'left' ORDER BY created_at", (shop_id,)
            ).fetchall()
        return [dict(r) for r in rows]

    def count_active_members(self, shop_id: str) -> int:
        with self._lock:
            return self._conn.execute(
                "SELECT COUNT(*) AS n FROM shop_members WHERE shop_id=? AND status='active'", (shop_id,)
            ).fetchone()["n"]

    def invite_member(self, shop_id: str, email: str, role: str, invited_by: Optional[str], token: str, expires_at: str) -> dict:
        email = email.lower()
        with self._lock:
            existing = self._conn.execute(
                "SELECT * FROM shop_members WHERE shop_id=? AND lower(invited_email)=?", (shop_id, email)
            ).fetchone()
            if existing:
                self._conn.execute(
                    "UPDATE shop_members SET role=?, status='pending_invite', invite_token=?, invite_expires_at=? WHERE id=?",
                    (role, token, expires_at, existing["id"]),
                )
                mid = existing["id"]
            else:
                mid = _new_id()
                self._conn.execute(
                    "INSERT INTO shop_members (id, shop_id, role, status, invited_email, invited_by, invite_token, invite_expires_at)"
                    " VALUES (?,?,?,?,?,?,?,?)",
                    (mid, shop_id, role, "pending_invite", email, invited_by, token, expires_at),
                )
            self._conn.commit()
            row = self._conn.execute("SELECT * FROM shop_members WHERE id=?", (mid,)).fetchone()
        return dict(row)

    def update_member(self, shop_id: str, member_id: str, data: dict) -> Optional[dict]:
        allowed = {k: v for k, v in data.items() if k in ("role", "status")}
        if not allowed:
            return None
        sets = ", ".join(f"{k}=?" for k in allowed)
        with self._lock:
            self._conn.execute(
                f"UPDATE shop_members SET {sets} WHERE id=? AND shop_id=?",
                (*allowed.values(), member_id, shop_id),
            )
            self._conn.commit()
            row = self._conn.execute(
                "SELECT * FROM shop_members WHERE id=? AND shop_id=?", (member_id, shop_id)
            ).fetchone()
        return dict(row) if row else None

    def remove_member(self, shop_id: str, member_id: str) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM shop_members WHERE id=? AND shop_id=?", (member_id, shop_id))
            self._conn.commit()

    def list_invites_for_email(self, email: str) -> list[dict]:
        with self._lock:
            rows = self._conn.execute(
                """SELECT m.*, s.name AS shop_name FROM shop_members m JOIN shops s ON s.id=m.shop_id
                   WHERE m.status='pending_invite' AND m.user_id IS NULL AND lower(m.invited_email)=?""",
                (email.lower(),),
            ).fetchall()
        return [dict(r) for r in rows]

    def get_invite_by_token(self, token: str) -> Optional[dict]:
        with self._lock:
            row = self._conn.execute(
                """SELECT m.*, s.name AS shop_name FROM shop_members m JOIN shops s ON s.id=m.shop_id
                   WHERE m.invite_token=?""", (token,),
            ).fetchone()
        return dict(row) if row else None

    def accept_invite_by_token(self, token: str, user_id: str, email: str) -> dict:
        inv = self.get_invite_by_token(token)
        if not inv or inv.get("user_id") or inv.get("status") != "pending_invite":
            raise ValueError("Lời mời không hợp lệ hoặc đã được sử dụng.")
        if _is_expired(inv.get("invite_expires_at")):
            raise ValueError("Lời mời đã hết hạn.")
        if (inv.get("invited_email") or "").lower() != (email or "").lower():
            raise ValueError("Email đăng nhập không khớp với email được mời.")
        with self._lock:
            self._conn.execute(
                "UPDATE shop_members SET user_id=?, status='active', joined_at=CURRENT_TIMESTAMP,"
                " invite_token=NULL WHERE id=?",
                (user_id, inv["id"]),
            )
            self._conn.commit()
        m = self.get_membership(inv["shop_id"], user_id)
        return {**(m or {}), "shop_id": inv["shop_id"], "shop_name": inv.get("shop_name")}

    def leave_shop(self, shop_id: str, user_id: str) -> None:
        with self._lock:
            self._conn.execute(
                "UPDATE shop_members SET status='left' WHERE shop_id=? AND user_id=? AND status='active'",
                (shop_id, user_id),
            )
            self._conn.commit()

    def transfer_ownership(self, shop_id: str, from_user_id: str, to_member_id: str) -> None:
        with self._lock:
            self._conn.execute(
                "UPDATE shop_members SET role='owner' WHERE id=? AND shop_id=? AND status='active'",
                (to_member_id, shop_id),
            )
            self._conn.execute(
                "UPDATE shop_members SET role='staff' WHERE shop_id=? AND user_id=? AND status='active'",
                (shop_id, from_user_id),
            )
            self._conn.execute(
                "UPDATE shops SET transferred_owner_at=CURRENT_TIMESTAMP WHERE id=?", (shop_id,)
            )
            self._conn.commit()

    def delete_shop(self, shop_id: str) -> None:
        self.clear_shop_data(shop_id)  # tự acquire lock
        with self._lock:
            self._conn.execute("DELETE FROM shop_members WHERE shop_id=?", (shop_id,))
            self._conn.execute("DELETE FROM shops WHERE id=?", (shop_id,))
            self._conn.commit()

    # --- products (luôn lọc theo shop_id) ---
    _PROD_COLS = ("name", "sku", "category", "price", "stock", "image_url", "description", "low_stock_threshold")

    def list_products(self, shop_id: str) -> list[dict]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM products WHERE shop_id=? AND deleted_at IS NULL ORDER BY id", (shop_id,)
            ).fetchall()
        return [dict(r) for r in rows]

    def get_product(self, shop_id: str, product_id: int) -> Optional[dict]:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM products WHERE id=? AND shop_id=?", (product_id, shop_id)
            ).fetchone()
        return dict(row) if row else None

    def create_product(self, shop_id: str, data: dict) -> dict:
        with self._lock:
            cur = self._conn.execute(
                "INSERT INTO products (shop_id, name, sku, category, price, stock, image_url, description, low_stock_threshold)"
                " VALUES (?,?,?,?,?,?,?,?,?)",
                (shop_id, data["name"], data.get("sku"), data.get("category"), data["price"], data.get("stock", 0),
                 data.get("image_url"), data.get("description"), data.get("low_stock_threshold", 5)),
            )
            self._conn.commit()
            new_id = cur.lastrowid
        return self.get_product(shop_id, new_id)

    def update_product(self, shop_id: str, product_id: int, data: dict) -> Optional[dict]:
        existing = self.get_product(shop_id, product_id)
        if not existing:
            return None
        merged = {**existing, **data}
        with self._lock:
            self._conn.execute(
                "UPDATE products SET name=?, sku=?, category=?, price=?, stock=?, image_url=?, description=?,"
                " low_stock_threshold=? WHERE id=? AND shop_id=?",
                (merged["name"], merged.get("sku"), merged.get("category"), merged["price"], merged["stock"],
                 merged.get("image_url"), merged.get("description"), merged.get("low_stock_threshold", 5),
                 product_id, shop_id),
            )
            self._conn.commit()
        return self.get_product(shop_id, product_id)

    def delete_product(self, shop_id: str, product_id: int) -> None:
        with self._lock:
            self._conn.execute(
                "UPDATE products SET deleted_at=CURRENT_TIMESTAMP WHERE id=? AND shop_id=?", (product_id, shop_id)
            )
            self._conn.commit()

    # --- customers ---
    def list_customers(self, shop_id: str) -> list[dict]:
        with self._lock:
            rows = self._conn.execute(
                """SELECT c.*, COUNT(o.id) AS purchase_count, COALESCE(SUM(o.total),0) AS total_spent
                   FROM customers c LEFT JOIN orders o ON o.customer_id=c.id
                   WHERE c.shop_id=? GROUP BY c.id ORDER BY c.id""",
                (shop_id,),
            ).fetchall()
        return [dict(r) for r in rows]

    def get_customer(self, shop_id: str, customer_id: int) -> Optional[dict]:
        with self._lock:
            c = self._conn.execute(
                "SELECT * FROM customers WHERE id=? AND shop_id=?", (customer_id, shop_id)
            ).fetchone()
            if not c:
                return None
            orders = self._conn.execute(
                "SELECT id, total, status, created_at FROM orders WHERE customer_id=? AND shop_id=? ORDER BY id DESC",
                (customer_id, shop_id),
            ).fetchall()
        d = dict(c)
        d["orders"] = [dict(o) for o in orders]
        d["purchase_count"] = len(d["orders"])
        d["total_spent"] = sum(float(o["total"]) for o in d["orders"])
        return d

    def create_customer(self, shop_id: str, data: dict) -> dict:
        with self._lock:
            cur = self._conn.execute(
                "INSERT INTO customers (shop_id, name, phone) VALUES (?,?,?)",
                (shop_id, data["name"], data.get("phone")),
            )
            self._conn.commit()
            new_id = cur.lastrowid
            row = self._conn.execute("SELECT * FROM customers WHERE id=?", (new_id,)).fetchone()
        return dict(row)

    # --- orders ---
    def list_orders(self, shop_id: str, limit: int = 50) -> list[dict]:
        with self._lock:
            orders = self._conn.execute(
                "SELECT * FROM orders WHERE shop_id=? ORDER BY id DESC LIMIT ?", (shop_id, limit)
            ).fetchall()
            result = []
            for o in orders:
                items = self._conn.execute(
                    "SELECT * FROM order_items WHERE order_id=?", (o["id"],)
                ).fetchall()
                d = dict(o)
                d["items"] = [dict(i) for i in items]
                result.append(d)
        return result

    def get_order(self, shop_id: str, order_id: int) -> Optional[dict]:
        with self._lock:
            o = self._conn.execute(
                "SELECT * FROM orders WHERE id=? AND shop_id=?", (order_id, shop_id)
            ).fetchone()
            if not o:
                return None
            items = self._conn.execute(
                "SELECT * FROM order_items WHERE order_id=?", (order_id,)
            ).fetchall()
        d = dict(o)
        d["items"] = [dict(i) for i in items]
        return d

    def create_order(self, shop_id: str, items: list[dict], customer_id: Optional[int], user_id: Optional[str]) -> dict:
        with self._lock:
            total = 0.0
            resolved = []
            for it in items:
                prod = self._conn.execute(
                    "SELECT * FROM products WHERE id=? AND shop_id=?", (it["product_id"], shop_id)
                ).fetchone()
                if prod is None:
                    raise ValueError(f"Sản phẩm id={it['product_id']} không tồn tại")
                qty = int(it["qty"])
                check_stock(prod["stock"], qty, prod["name"])
                unit_price = float(prod["price"])
                lt = line_total(unit_price, qty)
                total += lt
                resolved.append((prod, qty, unit_price, lt))

            cur = self._conn.execute(
                "INSERT INTO orders (shop_id, customer_id, user_id, total, status) VALUES (?,?,?,?, 'paid')",
                (shop_id, customer_id, user_id, total),
            )
            order_id = cur.lastrowid
            for prod, qty, unit_price, lt in resolved:
                self._conn.execute(
                    "INSERT INTO order_items (order_id, product_id, product_name, qty, unit_price, line_total)"
                    " VALUES (?,?,?,?,?,?)",
                    (order_id, prod["id"], prod["name"], qty, unit_price, lt),
                )
                self._conn.execute(
                    "UPDATE products SET stock = stock - ? WHERE id=?", (qty, prod["id"])
                )
            self._conn.commit()
        return self.get_order(shop_id, order_id)

    # --- reports ---
    def report_summary(self, shop_id: str) -> dict:
        with self._lock:
            revenue = self._conn.execute(
                "SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE shop_id=?", (shop_id,)
            ).fetchone()["s"]
            order_count = self._conn.execute(
                "SELECT COUNT(*) AS n FROM orders WHERE shop_id=?", (shop_id,)
            ).fetchone()["n"]
            product_count = self._conn.execute(
                "SELECT COUNT(*) AS n FROM products WHERE shop_id=? AND deleted_at IS NULL", (shop_id,)
            ).fetchone()["n"]
            low_stock = self._conn.execute(
                "SELECT id, name, stock FROM products WHERE shop_id=? AND deleted_at IS NULL AND stock <= low_stock_threshold ORDER BY stock ASC",
                (shop_id,),
            ).fetchall()
            top = self._conn.execute(
                """SELECT oi.product_name, SUM(oi.qty) AS qty_sold, SUM(oi.line_total) AS revenue
                   FROM order_items oi JOIN orders o ON o.id=oi.order_id
                   WHERE o.shop_id=? GROUP BY oi.product_name ORDER BY qty_sold DESC LIMIT 5""",
                (shop_id,),
            ).fetchall()
        return {
            "revenue": revenue, "order_count": order_count, "product_count": product_count,
            "low_stock": [dict(r) for r in low_stock], "top_products": [dict(r) for r in top],
        }

    # --- notifications ---
    def notifications(self, shop_id: str, email: Optional[str]) -> list[dict]:
        out: list[dict] = []
        if email:
            for inv in self.list_invites_for_email(email):
                out.append({
                    "type": "invite", "token": inv.get("invite_token"),
                    "title": f"Lời mời vào {inv.get('shop_name') or 'cửa hàng'}",
                    "body": f"Bạn được mời làm {inv.get('role')}.", "role": inv.get("role"),
                })
        for p in self.report_summary(shop_id)["low_stock"]:
            out.append({
                "type": "low_stock", "title": f"Sắp hết: {p['name']}",
                "body": f"Còn {p['stock']} trong kho.",
            })
        return out

    # --- maintenance ---
    def clear_shop_data(self, shop_id: str) -> None:
        with self._lock:
            self._conn.execute(
                "DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE shop_id=?)", (shop_id,)
            )
            self._conn.execute("DELETE FROM orders WHERE shop_id=?", (shop_id,))
            self._conn.execute("DELETE FROM products WHERE shop_id=?", (shop_id,))
            self._conn.execute("DELETE FROM customers WHERE shop_id=?", (shop_id,))
            self._conn.commit()

    def reseed_shop(self, shop_id: str) -> None:
        self.clear_shop_data(shop_id)
        self._seed_shop_contents(shop_id)


# ---------------------------------------------------------------------------
# Supabase — dùng cho production. Gọi PostgREST bằng service_role key (chỉ ở backend).
# ---------------------------------------------------------------------------
class SupabaseDatabase(Database):
    backend_name = "supabase"

    def __init__(self, url: str, service_key: str):
        self._base = url.rstrip("/") + "/rest/v1"
        self._headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        }
        self._client = httpx.Client(timeout=15.0)

    @staticmethod
    def _json_or_none(r: "httpx.Response") -> Any:
        if not r.content:
            return None
        return r.json()

    def _get(self, path: str, params: dict | None = None) -> Any:
        r = self._client.get(f"{self._base}{path}", headers=self._headers, params=params)
        r.raise_for_status()
        return self._json_or_none(r)

    def _post(self, path: str, json: Any, prefer: str = "return=representation") -> Any:
        headers = {**self._headers, "Prefer": prefer}
        r = self._client.post(f"{self._base}{path}", headers=headers, json=json)
        r.raise_for_status()
        return self._json_or_none(r)

    def _patch(self, path: str, json: Any, params: dict) -> Any:
        headers = {**self._headers, "Prefer": "return=representation"}
        r = self._client.patch(f"{self._base}{path}", headers=headers, params=params, json=json)
        r.raise_for_status()
        return self._json_or_none(r)

    def _delete(self, path: str, params: dict) -> None:
        r = self._client.delete(f"{self._base}{path}", headers=self._headers, params=params)
        r.raise_for_status()

    # ---- shops ----
    def list_user_shops(self, user_id: Optional[str]) -> list[dict]:
        if not user_id:
            return []
        rows = self._get("/shop_members", {
            "user_id": f"eq.{user_id}", "status": "eq.active",
            "select": "role,shop:shops(*)", "order": "created_at",
        }) or []
        out = []
        for r in rows:
            shop = r.get("shop")
            if shop:
                out.append({**shop, "my_role": r.get("role")})
        return out

    def get_shop(self, shop_id: str) -> Optional[dict]:
        rows = self._get("/shops", {"id": f"eq.{shop_id}", "select": "*"})
        return rows[0] if rows else None

    def create_shop(self, name: str, user_id: Optional[str]) -> dict:
        # Đa thành viên: cho phép user tạo nhiều shop / đứng nhiều shop song song.
        rows = self._post("/shops", {"name": name, "created_by": user_id})
        shop = rows[0]
        self._post("/shop_members", {
            "shop_id": shop["id"], "user_id": user_id, "role": "owner",
            "status": "active", "joined_at": "now()",
        }, prefer="return=minimal")
        return shop

    _SHOP_FIELDS = ("name", "color_primary", "color_secondary", "logo_url", "address", "hotline")

    def update_shop(self, shop_id: str, data: dict) -> Optional[dict]:
        clean = {k: data[k] for k in self._SHOP_FIELDS if k in data}
        if not clean:
            return self.get_shop(shop_id)
        rows = self._patch("/shops", clean, {"id": f"eq.{shop_id}"})
        return rows[0] if rows else self.get_shop(shop_id)

    # ---- members / invites (token-based, luật 1-shop) ----
    def get_membership(self, shop_id: str, user_id: Optional[str]) -> Optional[dict]:
        if not user_id:
            return None
        rows = self._get("/shop_members", {
            "shop_id": f"eq.{shop_id}", "user_id": f"eq.{user_id}", "status": "eq.active", "select": "*",
        })
        return rows[0] if rows else None

    def get_active_membership(self, user_id: Optional[str]) -> Optional[dict]:
        if not user_id:
            return None
        rows = self._get("/shop_members", {
            "user_id": f"eq.{user_id}", "status": "eq.active", "select": "*", "limit": "1",
        })
        return rows[0] if rows else None

    def list_members(self, shop_id: str) -> list[dict]:
        members = self._get("/shop_members", {
            "shop_id": f"eq.{shop_id}", "status": "neq.left", "select": "*", "order": "created_at"}) or []
        uids = [m["user_id"] for m in members if m.get("user_id")]
        prof_by_id: dict[str, dict] = {}
        if uids:
            ids = ",".join(uids)
            profs = self._get("/profiles", {"id": f"in.({ids})", "select": "id,email,full_name"}) or []
            prof_by_id = {p["id"]: p for p in profs}
        for m in members:
            p = prof_by_id.get(m.get("user_id"))
            m["email"] = (p or {}).get("email") or m.get("invited_email")
            m["full_name"] = (p or {}).get("full_name")
        return members

    def count_active_members(self, shop_id: str) -> int:
        rows = self._get("/shop_members", {"shop_id": f"eq.{shop_id}", "status": "eq.active", "select": "id"}) or []
        return len(rows)

    def invite_member(self, shop_id: str, email: str, role: str, invited_by: Optional[str], token: str, expires_at: str) -> dict:
        email = email.lower()
        existing = self._get("/shop_members", {"shop_id": f"eq.{shop_id}", "invited_email": f"eq.{email}", "select": "id"})
        payload = {"role": role, "status": "pending_invite", "invite_token": token, "invite_expires_at": expires_at}
        if existing:
            rows = self._patch("/shop_members", payload, {"id": f"eq.{existing[0]['id']}"})
            return rows[0] if rows else {"shop_id": shop_id, "invited_email": email, "role": role, "invite_token": token}
        rows = self._post("/shop_members", {
            "shop_id": shop_id, "invited_email": email, "invited_by": invited_by, **payload})
        return rows[0] if rows else {"shop_id": shop_id, "invited_email": email, "role": role, "invite_token": token}

    def update_member(self, shop_id: str, member_id: str, data: dict) -> Optional[dict]:
        clean = {k: v for k, v in data.items() if k in ("role", "status")}
        if not clean:
            return None
        rows = self._patch("/shop_members", clean, {"id": f"eq.{member_id}", "shop_id": f"eq.{shop_id}"})
        return rows[0] if rows else None

    def remove_member(self, shop_id: str, member_id: str) -> None:
        self._delete("/shop_members", {"id": f"eq.{member_id}", "shop_id": f"eq.{shop_id}"})

    def list_invites_for_email(self, email: str) -> list[dict]:
        rows = self._get("/shop_members", {
            "invited_email": f"eq.{email.lower()}", "status": "eq.pending_invite", "user_id": "is.null",
            "select": "*,shop:shops(name)",
        }) or []
        for r in rows:
            r["shop_name"] = (r.get("shop") or {}).get("name")
        return rows

    def get_invite_by_token(self, token: str) -> Optional[dict]:
        rows = self._get("/shop_members", {"invite_token": f"eq.{token}", "select": "*,shop:shops(name)"})
        if not rows:
            return None
        r = rows[0]
        r["shop_name"] = (r.get("shop") or {}).get("name")
        return r

    def accept_invite_by_token(self, token: str, user_id: str, email: str) -> dict:
        inv = self.get_invite_by_token(token)
        if not inv or inv.get("user_id") or inv.get("status") != "pending_invite":
            raise ValueError("Lời mời không hợp lệ hoặc đã được sử dụng.")
        if _is_expired(inv.get("invite_expires_at")):
            raise ValueError("Lời mời đã hết hạn.")
        if (inv.get("invited_email") or "").lower() != (email or "").lower():
            raise ValueError("Email đăng nhập không khớp với email được mời.")
        self._patch("/shop_members",
                    {"user_id": user_id, "status": "active", "joined_at": "now()", "invite_token": None},
                    {"id": f"eq.{inv['id']}"})
        m = self.get_membership(inv["shop_id"], user_id)
        return {**(m or {}), "shop_id": inv["shop_id"], "shop_name": inv.get("shop_name")}

    def leave_shop(self, shop_id: str, user_id: str) -> None:
        self._patch("/shop_members", {"status": "left"},
                    {"shop_id": f"eq.{shop_id}", "user_id": f"eq.{user_id}", "status": "eq.active"})

    def transfer_ownership(self, shop_id: str, from_user_id: str, to_member_id: str) -> None:
        self._patch("/shop_members", {"role": "owner"}, {"id": f"eq.{to_member_id}", "shop_id": f"eq.{shop_id}"})
        self._patch("/shop_members", {"role": "staff"},
                    {"shop_id": f"eq.{shop_id}", "user_id": f"eq.{from_user_id}", "status": "eq.active"})
        self._patch("/shops", {"transferred_owner_at": "now()"}, {"id": f"eq.{shop_id}"})

    def delete_shop(self, shop_id: str) -> None:
        self.clear_shop_data(shop_id)
        self._delete("/shop_members", {"shop_id": f"eq.{shop_id}"})
        self._delete("/shops", {"id": f"eq.{shop_id}"})

    # --- products (lọc shop_id) ---
    _PROD_FIELDS = ("name", "sku", "category", "price", "stock", "image_url", "description", "low_stock_threshold")

    def list_products(self, shop_id: str) -> list[dict]:
        return self._get("/products", {"select": "*", "shop_id": f"eq.{shop_id}", "deleted_at": "is.null", "order": "id"})

    def get_product(self, shop_id: str, product_id: int) -> Optional[dict]:
        rows = self._get("/products", {"id": f"eq.{product_id}", "shop_id": f"eq.{shop_id}", "select": "*"})
        return rows[0] if rows else None

    def create_product(self, shop_id: str, data: dict) -> dict:
        payload = {k: data[k] for k in self._PROD_FIELDS if k in data}
        payload["name"] = data["name"]; payload["price"] = data["price"]; payload["shop_id"] = shop_id
        rows = self._post("/products", payload)
        return rows[0]

    def update_product(self, shop_id: str, product_id: int, data: dict) -> Optional[dict]:
        clean = {k: v for k, v in data.items() if k in self._PROD_FIELDS}
        rows = self._patch("/products", clean, {"id": f"eq.{product_id}", "shop_id": f"eq.{shop_id}"})
        return rows[0] if rows else None

    def delete_product(self, shop_id: str, product_id: int) -> None:
        self._patch("/products", {"deleted_at": "now()"}, {"id": f"eq.{product_id}", "shop_id": f"eq.{shop_id}"})

    # --- customers ---
    def list_customers(self, shop_id: str) -> list[dict]:
        return self._get("/customer_stats", {"select": "*", "shop_id": f"eq.{shop_id}", "order": "id"})

    def get_customer(self, shop_id: str, customer_id: int) -> Optional[dict]:
        rows = self._get("/customer_stats", {"id": f"eq.{customer_id}", "shop_id": f"eq.{shop_id}", "select": "*"})
        if not rows:
            return None
        c = rows[0]
        c["orders"] = self._get("/orders", {"customer_id": f"eq.{customer_id}", "shop_id": f"eq.{shop_id}",
                                            "select": "id,total,status,created_at", "order": "id.desc"})
        return c

    def create_customer(self, shop_id: str, data: dict) -> dict:
        rows = self._post("/customers", {"shop_id": shop_id, "name": data["name"], "phone": data.get("phone")})
        return rows[0]

    # --- orders ---
    def list_orders(self, shop_id: str, limit: int = 50) -> list[dict]:
        return self._get("/orders", {"select": "*,order_items(*)", "shop_id": f"eq.{shop_id}",
                                     "order": "id.desc", "limit": str(limit)})

    def get_order(self, shop_id: str, order_id: int) -> Optional[dict]:
        rows = self._get("/orders", {"id": f"eq.{order_id}", "shop_id": f"eq.{shop_id}", "select": "*,order_items(*)"})
        return rows[0] if rows else None

    def create_order(self, shop_id: str, items: list[dict], customer_id: Optional[int], user_id: Optional[str]) -> dict:
        total = 0.0
        resolved = []
        for it in items:
            prod = self.get_product(shop_id, it["product_id"])
            if prod is None:
                raise ValueError(f"Sản phẩm id={it['product_id']} không tồn tại")
            qty = int(it["qty"])
            check_stock(prod["stock"], qty, prod["name"])
            unit_price = float(prod["price"])
            lt = line_total(unit_price, qty)
            total += lt
            resolved.append((prod, qty, unit_price, lt))

        order_rows = self._post("/orders", {
            "shop_id": shop_id, "customer_id": customer_id, "user_id": user_id, "total": total, "status": "paid",
        })
        order = order_rows[0]
        item_payload = [{
            "order_id": order["id"], "product_id": prod["id"], "product_name": prod["name"],
            "qty": qty, "unit_price": unit_price, "line_total": lt,
        } for (prod, qty, unit_price, lt) in resolved]
        self._post("/order_items", item_payload, prefer="return=minimal")
        for (prod, qty, _, _) in resolved:
            self._patch("/products", {"stock": prod["stock"] - qty}, {"id": f"eq.{prod['id']}"})
        return self.get_order(shop_id, order["id"])

    # --- reports ---
    def report_summary(self, shop_id: str) -> dict:
        products = self.list_products(shop_id)
        orders = self._get("/orders", {"select": "total", "shop_id": f"eq.{shop_id}"})
        items = self._get("/order_items", {
            "select": "product_name,qty,line_total,orders!inner(shop_id)",
            "orders.shop_id": f"eq.{shop_id}",
        }) or []
        revenue = sum(float(o["total"]) for o in orders)
        agg: dict[str, dict] = {}
        for it in items:
            a = agg.setdefault(it["product_name"], {"product_name": it["product_name"], "qty_sold": 0, "revenue": 0.0})
            a["qty_sold"] += int(it["qty"])
            a["revenue"] += float(it["line_total"])
        top = sorted(agg.values(), key=lambda x: x["qty_sold"], reverse=True)[:5]
        low_stock = [
            {"id": p["id"], "name": p["name"], "stock": p["stock"]}
            for p in sorted(products, key=lambda x: x["stock"])
            if p["stock"] <= p.get("low_stock_threshold", 5)
        ]
        return {
            "revenue": revenue, "order_count": len(orders), "product_count": len(products),
            "low_stock": low_stock, "top_products": top,
        }

    # --- notifications ---
    def notifications(self, shop_id: str, email: Optional[str]) -> list[dict]:
        out: list[dict] = []
        if email:
            for inv in self.list_invites_for_email(email):
                out.append({
                    "type": "invite", "token": inv.get("invite_token"),
                    "title": f"Lời mời vào {inv.get('shop_name') or 'cửa hàng'}",
                    "body": f"Bạn được mời làm {inv.get('role')}.", "role": inv.get("role"),
                })
        for p in self.report_summary(shop_id)["low_stock"]:
            out.append({"type": "low_stock", "title": f"Sắp hết: {p['name']}", "body": f"Còn {p['stock']} trong kho."})
        return out

    # --- maintenance ---
    def clear_shop_data(self, shop_id: str) -> None:
        # Xoá order_items qua FK cascade khi xoá orders; nhưng order_items không có shop_id
        # -> xoá orders trước (PostgREST cascade theo FK order_items.order_id ON DELETE CASCADE).
        self._delete("/orders", {"shop_id": f"eq.{shop_id}"})
        self._delete("/customers", {"shop_id": f"eq.{shop_id}"})
        self._delete("/products", {"shop_id": f"eq.{shop_id}"})

    def reseed_shop(self, shop_id: str) -> None:
        self.clear_shop_data(shop_id)
        prods = [{**{k: p[k] for k in ("name", "sku", "category", "price", "stock")}, "shop_id": shop_id}
                 for p in SEED_PRODUCTS]
        self._post("/products", prods, prefer="return=minimal")
        custs = [{"shop_id": shop_id, "name": c["name"], "phone": c["phone"]} for c in SEED_CUSTOMERS]
        self._post("/customers", custs, prefer="return=minimal")

    # --- audit (qua service_role, bỏ qua RLS) ---
    def write_audit(self, shop_id, actor_id, actor_email, action, target=None, payload=None) -> None:
        try:
            self._post("/audit_logs", {
                "shop_id": shop_id, "actor_id": actor_id, "actor_email": actor_email,
                "action": action, "target": target, "payload": payload,
            }, prefer="return=minimal")
        except Exception:
            pass  # audit không được làm gãy luồng chính

    def list_audit(self, shop_id: str, limit: int = 100) -> list[dict]:
        return self._get("/audit_logs", {"select": "*", "shop_id": f"eq.{shop_id}",
                                         "order": "created_at.desc", "limit": str(limit)})


# ---------------------------------------------------------------------------
# Factory — chọn backend dựa trên môi trường. Gọi get_db() ở mọi nơi.
# ---------------------------------------------------------------------------
_db_singleton: Optional[Database] = None


def get_db() -> Database:
    global _db_singleton
    if _db_singleton is not None:
        return _db_singleton

    url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if url and service_key:
        _db_singleton = SupabaseDatabase(url, service_key)
    else:
        _db_singleton = SqliteDatabase(os.environ.get("SQLITE_PATH", ":memory:"))
    return _db_singleton


def reset_db_for_tests() -> Database:
    """Dùng trong test để tạo DB SQLite sạch mỗi lần."""
    global _db_singleton
    _db_singleton = SqliteDatabase(":memory:")
    return _db_singleton
