"""
UNIT TEST (đáy kim tự tháp) — logic nghiệp vụ thuần, nhanh & nhiều.
Theo công thức Arrange–Act–Assert. Phủ happy path + edge case.
"""
import pytest
from pricing import line_total, order_total, check_stock, StockError


# ----- line_total -----
def test_line_total_happy():
    # Arrange / Act / Assert
    assert line_total(50000, 2) == 100000


def test_line_total_qty_zero_raises():
    with pytest.raises(StockError):
        line_total(50000, 0)


def test_line_total_negative_qty_raises():
    with pytest.raises(StockError):
        line_total(50000, -3)


def test_line_total_negative_price_raises():
    with pytest.raises(StockError):
        line_total(-1000, 2)


# ----- order_total -----
def test_order_total_two_items():
    lines = [{"unit_price": 50000, "qty": 1}, {"unit_price": 30000, "qty": 1}]
    assert order_total(lines) == 80000


def test_order_total_empty_cart_is_zero():
    # Edge case: giỏ rỗng -> tổng = 0
    assert order_total([]) == 0


def test_order_total_multiple_qty():
    lines = [{"unit_price": 25000, "qty": 4}, {"unit_price": 8000, "qty": 5}]
    assert order_total(lines) == 25000 * 4 + 8000 * 5


# ----- check_stock -----
def test_check_stock_ok():
    check_stock(available=10, qty=3)  # không ném lỗi


def test_check_stock_exact_boundary():
    check_stock(available=5, qty=5)  # vừa đủ -> ok


def test_check_stock_not_enough_raises():
    with pytest.raises(StockError):
        check_stock(available=2, qty=5, product_name="Cà phê")


def test_check_stock_zero_available_raises():
    with pytest.raises(StockError):
        check_stock(available=0, qty=1, product_name="Trứng gà")
