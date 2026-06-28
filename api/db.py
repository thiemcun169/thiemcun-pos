"""
Lớp kết nối dữ liệu (Data layer) — ĐỂ RIÊNG MỘT CHỖ.

Nguyên tắc kiến trúc của khoá: mọi truy cập database đi qua đây.
Sau muốn đổi nhà cung cấp (Supabase -> khác) chỉ sửa file này, KHÔNG đụng giao diện.

Hai backend:
  - SqliteDatabase  : chạy local + test (không cần Internet, không cần key).
  - SupabaseDatabase: chạy thật (Postgres của Supabase, qua REST PostgREST + service_role key).

Chọn backend tự động:
  - Nếu có SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY trong môi trường -> dùng Supabase.
  - Ngược lại -> dùng SQLite (mặc định cho dev/test).
"""

from __future__ import annotations

import os
import sqlite3
import threading
from typing import Any, Optional

import httpx

from pricing import line_total, check_stock
from seed_data import SEED_PRODUCTS, SEED_CUSTOMERS, SEED_ORDERS


# ---------------------------------------------------------------------------
# Giao diện chung (interface) — phần còn lại của app chỉ biết tới các hàm này.
# ---------------------------------------------------------------------------
class Database:
    backend_name = "abstract"

    # --- products ---
    def list_products(self) -> list[dict]: ...
    def get_product(self, product_id: int) -> Optional[dict]: ...
    def create_product(self, data: dict) -> dict: ...
    def update_product(self, product_id: int, data: dict) -> Optional[dict]: ...

    # --- customers ---
    def list_customers(self) -> list[dict]: ...
    def create_customer(self, data: dict) -> dict: ...

    # --- orders ---
    def list_orders(self, limit: int = 50) -> list[dict]: ...
    def get_order(self, order_id: int) -> Optional[dict]: ...
    def create_order(self, items: list[dict], customer_id: Optional[int], user_id: Optional[str]) -> dict: ...

    # --- reports ---
    def report_summary(self) -> dict: ...


# ---------------------------------------------------------------------------
# SQLite — dùng cho local dev & test. Dữ liệu mẫu được nạp sẵn.
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
                CREATE TABLE IF NOT EXISTS products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    sku TEXT,
                    category TEXT,
                    price REAL NOT NULL DEFAULT 0,
                    stock INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS customers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    phone TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            cur = self._conn.execute("SELECT COUNT(*) AS n FROM products")
            if cur.fetchone()["n"] > 0:
                return
            for p in SEED_PRODUCTS:
                self._conn.execute(
                    "INSERT INTO products (name, sku, category, price, stock) VALUES (?,?,?,?,?)",
                    (p["name"], p["sku"], p["category"], p["price"], p["stock"]),
                )
            for c in SEED_CUSTOMERS:
                self._conn.execute(
                    "INSERT INTO customers (name, phone) VALUES (?,?)",
                    (c["name"], c["phone"]),
                )
            self._conn.commit()
        # Tạo vài đơn mẫu để báo cáo có số liệu ngay.
        # GỌI NGOÀI lock vì create_order tự acquire lock (Lock không tái nhập).
        for o in SEED_ORDERS:
            self.create_order(o["items"], o.get("customer_id"), user_id=None)

    # --- products ---
    def list_products(self) -> list[dict]:
        with self._lock:
            rows = self._conn.execute("SELECT * FROM products ORDER BY id").fetchall()
        return [dict(r) for r in rows]

    def get_product(self, product_id: int) -> Optional[dict]:
        with self._lock:
            row = self._conn.execute("SELECT * FROM products WHERE id=?", (product_id,)).fetchone()
        return dict(row) if row else None

    def create_product(self, data: dict) -> dict:
        with self._lock:
            cur = self._conn.execute(
                "INSERT INTO products (name, sku, category, price, stock) VALUES (?,?,?,?,?)",
                (data["name"], data.get("sku"), data.get("category"), data["price"], data.get("stock", 0)),
            )
            self._conn.commit()
            new_id = cur.lastrowid
        return self.get_product(new_id)

    def update_product(self, product_id: int, data: dict) -> Optional[dict]:
        existing = self.get_product(product_id)
        if not existing:
            return None
        merged = {**existing, **data}
        with self._lock:
            self._conn.execute(
                "UPDATE products SET name=?, sku=?, category=?, price=?, stock=? WHERE id=?",
                (merged["name"], merged.get("sku"), merged.get("category"), merged["price"], merged["stock"], product_id),
            )
            self._conn.commit()
        return self.get_product(product_id)

    # --- customers ---
    def list_customers(self) -> list[dict]:
        with self._lock:
            rows = self._conn.execute("SELECT * FROM customers ORDER BY id").fetchall()
        return [dict(r) for r in rows]

    def create_customer(self, data: dict) -> dict:
        with self._lock:
            cur = self._conn.execute(
                "INSERT INTO customers (name, phone) VALUES (?,?)",
                (data["name"], data.get("phone")),
            )
            self._conn.commit()
            new_id = cur.lastrowid
            row = self._conn.execute("SELECT * FROM customers WHERE id=?", (new_id,)).fetchone()
        return dict(row)

    # --- orders ---
    def list_orders(self, limit: int = 50) -> list[dict]:
        with self._lock:
            orders = self._conn.execute(
                "SELECT * FROM orders ORDER BY id DESC LIMIT ?", (limit,)
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

    def get_order(self, order_id: int) -> Optional[dict]:
        with self._lock:
            o = self._conn.execute("SELECT * FROM orders WHERE id=?", (order_id,)).fetchone()
            if not o:
                return None
            items = self._conn.execute(
                "SELECT * FROM order_items WHERE order_id=?", (order_id,)
            ).fetchall()
        d = dict(o)
        d["items"] = [dict(i) for i in items]
        return d

    def create_order(self, items: list[dict], customer_id: Optional[int], user_id: Optional[str]) -> dict:
        # Logic nghiệp vụ (tính tiền + trừ tồn kho) nằm ở orders.py — đây chỉ ghi DB.
        with self._lock:
            total = 0.0
            resolved = []
            for it in items:
                prod = self._conn.execute(
                    "SELECT * FROM products WHERE id=?", (it["product_id"],)
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
                "INSERT INTO orders (customer_id, user_id, total, status) VALUES (?,?,?, 'paid')",
                (customer_id, user_id, total),
            )
            order_id = cur.lastrowid
            for prod, qty, unit_price, lt in resolved:
                self._conn.execute(
                    "INSERT INTO order_items (order_id, product_id, product_name, qty, unit_price, line_total)"
                    " VALUES (?,?,?,?,?,?)",
                    (order_id, prod["id"], prod["name"], qty, unit_price, lt),
                )
                # Trừ tồn kho
                self._conn.execute(
                    "UPDATE products SET stock = stock - ? WHERE id=?", (qty, prod["id"])
                )
            self._conn.commit()
        return self.get_order(order_id)

    # --- reports ---
    def report_summary(self) -> dict:
        with self._lock:
            revenue = self._conn.execute("SELECT COALESCE(SUM(total),0) AS s FROM orders").fetchone()["s"]
            order_count = self._conn.execute("SELECT COUNT(*) AS n FROM orders").fetchone()["n"]
            product_count = self._conn.execute("SELECT COUNT(*) AS n FROM products").fetchone()["n"]
            low_stock = self._conn.execute(
                "SELECT id, name, stock FROM products WHERE stock <= 5 ORDER BY stock ASC"
            ).fetchall()
            top = self._conn.execute(
                """
                SELECT product_name, SUM(qty) AS qty_sold, SUM(line_total) AS revenue
                FROM order_items GROUP BY product_name ORDER BY qty_sold DESC LIMIT 5
                """
            ).fetchall()
        return {
            "revenue": revenue,
            "order_count": order_count,
            "product_count": product_count,
            "low_stock": [dict(r) for r in low_stock],
            "top_products": [dict(r) for r in top],
        }


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
        # timeout ngắn để serverless không treo.
        self._client = httpx.Client(timeout=15.0)

    @staticmethod
    def _json_or_none(r: "httpx.Response") -> Any:
        # PostgREST trả body RỖNG khi Prefer=return=minimal (201/204) hoặc khi
        # PATCH/DELETE không khớp hàng nào. Tránh JSONDecodeError ("Expecting value").
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

    # --- products ---
    def list_products(self) -> list[dict]:
        return self._get("/products", {"select": "*", "order": "id"})

    def get_product(self, product_id: int) -> Optional[dict]:
        rows = self._get("/products", {"id": f"eq.{product_id}", "select": "*"})
        return rows[0] if rows else None

    def create_product(self, data: dict) -> dict:
        rows = self._post("/products", {
            "name": data["name"], "sku": data.get("sku"), "category": data.get("category"),
            "price": data["price"], "stock": data.get("stock", 0),
        })
        return rows[0]

    def update_product(self, product_id: int, data: dict) -> Optional[dict]:
        rows = self._patch("/products", data, {"id": f"eq.{product_id}"})
        return rows[0] if rows else None

    # --- customers ---
    def list_customers(self) -> list[dict]:
        return self._get("/customers", {"select": "*", "order": "id"})

    def create_customer(self, data: dict) -> dict:
        rows = self._post("/customers", {"name": data["name"], "phone": data.get("phone")})
        return rows[0]

    # --- orders ---
    def list_orders(self, limit: int = 50) -> list[dict]:
        return self._get("/orders", {
            "select": "*,order_items(*)", "order": "id.desc", "limit": str(limit),
        })

    def get_order(self, order_id: int) -> Optional[dict]:
        rows = self._get("/orders", {"id": f"eq.{order_id}", "select": "*,order_items(*)"})
        return rows[0] if rows else None

    def create_order(self, items: list[dict], customer_id: Optional[int], user_id: Optional[str]) -> dict:
        # Tính tiền + kiểm tồn kho ở backend, sau đó ghi qua PostgREST.
        total = 0.0
        resolved = []
        for it in items:
            prod = self.get_product(it["product_id"])
            if prod is None:
                raise ValueError(f"Sản phẩm id={it['product_id']} không tồn tại")
            qty = int(it["qty"])
            check_stock(prod["stock"], qty, prod["name"])
            unit_price = float(prod["price"])
            lt = line_total(unit_price, qty)
            total += lt
            resolved.append((prod, qty, unit_price, lt))

        order_rows = self._post("/orders", {
            "customer_id": customer_id, "user_id": user_id, "total": total, "status": "paid",
        })
        order = order_rows[0]
        item_payload = [{
            "order_id": order["id"], "product_id": prod["id"], "product_name": prod["name"],
            "qty": qty, "unit_price": unit_price, "line_total": lt,
        } for (prod, qty, unit_price, lt) in resolved]
        self._post("/order_items", item_payload, prefer="return=minimal")
        # Trừ tồn kho từng sản phẩm.
        for (prod, qty, _, _) in resolved:
            self._patch("/products", {"stock": prod["stock"] - qty}, {"id": f"eq.{prod['id']}"})
        return self.get_order(order["id"])

    # --- reports ---
    def report_summary(self) -> dict:
        products = self.list_products()
        orders = self._get("/orders", {"select": "total"})
        items = self._get("/order_items", {"select": "product_name,qty,line_total"})
        revenue = sum(float(o["total"]) for o in orders)
        agg: dict[str, dict] = {}
        for it in items:
            a = agg.setdefault(it["product_name"], {"product_name": it["product_name"], "qty_sold": 0, "revenue": 0.0})
            a["qty_sold"] += int(it["qty"])
            a["revenue"] += float(it["line_total"])
        top = sorted(agg.values(), key=lambda x: x["qty_sold"], reverse=True)[:5]
        low_stock = [
            {"id": p["id"], "name": p["name"], "stock": p["stock"]}
            for p in sorted(products, key=lambda x: x["stock"]) if p["stock"] <= 5
        ]
        return {
            "revenue": revenue,
            "order_count": len(orders),
            "product_count": len(products),
            "low_stock": low_stock,
            "top_products": top,
        }


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
        # Local/test: SQLite. SQLITE_PATH=file để giữ dữ liệu, mặc định in-memory.
        _db_singleton = SqliteDatabase(os.environ.get("SQLITE_PATH", ":memory:"))
    return _db_singleton


def reset_db_for_tests() -> Database:
    """Dùng trong test để tạo DB SQLite sạch mỗi lần."""
    global _db_singleton
    _db_singleton = SqliteDatabase(":memory:")
    return _db_singleton
