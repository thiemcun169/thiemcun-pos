"""
Logic nghiệp vụ THUẦN (pure functions) — tính tiền & kiểm tồn kho.

Tách riêng để UNIT TEST dễ: không cần database, không cần mạng.
Đây chính là "đáy kim tự tháp test" — hàm nhỏ, nhanh, nhiều case (buổi 2).
"""

from __future__ import annotations


class StockError(ValueError):
    """Ném khi số lượng không hợp lệ hoặc vượt tồn kho."""


def line_total(unit_price: float, qty: int) -> float:
    """Thành tiền 1 dòng = đơn giá × số lượng. Số lượng phải là số nguyên dương."""
    if qty <= 0:
        raise StockError("Số lượng phải lớn hơn 0")
    if unit_price < 0:
        raise StockError("Đơn giá không được âm")
    return float(unit_price) * int(qty)


def order_total(lines: list[dict]) -> float:
    """
    Tổng tiền đơn = tổng thành tiền các dòng.
    lines: [{"unit_price": ..., "qty": ...}, ...]
    Giỏ rỗng -> tổng = 0.
    """
    return sum(line_total(l["unit_price"], l["qty"]) for l in lines)


def check_stock(available: int, qty: int, product_name: str = "") -> None:
    """Kiểm còn đủ hàng để bán. Ném StockError nếu thiếu."""
    if qty <= 0:
        raise StockError("Số lượng phải lớn hơn 0")
    if available < qty:
        raise StockError(f"Không đủ tồn kho cho '{product_name}' (còn {available}, cần {qty})")
