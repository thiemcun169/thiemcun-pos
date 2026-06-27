import { useMemo, useState } from "react";
import { api } from "../api";
import { vnd } from "../lib/format";

// Màn Bán hàng: chọn sản phẩm -> giỏ hàng -> tính tiền -> tạo đơn.
export default function Sales({ products, customers, onDone }) {
  const [cart, setCart] = useState({}); // { productId: qty }
  const [customerId, setCustomerId] = useState("");
  const [query, setQuery] = useState(""); // tìm sản phẩm theo tên (Lab 4b)
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q)
    );
  }, [products, query]);

  const cartLines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => {
          const p = products.find((x) => String(x.id) === String(id));
          return p ? { product: p, qty } : null;
        })
        .filter(Boolean),
    [cart, products]
  );

  const total = cartLines.reduce((sum, l) => sum + l.product.price * l.qty, 0);

  function addToCart(p) {
    setCart((c) => {
      const cur = c[p.id] || 0;
      if (cur + 1 > p.stock) {
        setToast(`Chỉ còn ${p.stock} "${p.name}" trong kho`);
        return c;
      }
      return { ...c, [p.id]: cur + 1 };
    });
  }

  function setQty(id, qty) {
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  async function checkout() {
    if (cartLines.length === 0) return;
    setSubmitting(true);
    setToast(null);
    try {
      const items = cartLines.map((l) => ({ product_id: l.product.id, qty: l.qty }));
      const order = await api.createOrder({
        items,
        customer_id: customerId ? Number(customerId) : null,
      });
      setCart({});
      setCustomerId("");
      setToast(`✅ Đã tạo đơn #${order.id} — ${vnd(order.total)}`);
      onDone();
    } catch (e) {
      setToast(`⚠️ ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Bán hàng</h1>
        <input
          className="search"
          placeholder="🔎 Tìm sản phẩm theo tên / mã…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </header>

      <div className="sales-layout">
        <section className="product-grid">
          {filtered.length === 0 && <div className="empty">Không tìm thấy sản phẩm.</div>}
          {filtered.map((p) => (
            <button
              key={p.id}
              className={`product-card ${p.stock <= 0 ? "out" : ""}`}
              onClick={() => addToCart(p)}
              disabled={p.stock <= 0}
            >
              <div className="product-name">{p.name}</div>
              <div className="product-meta">
                <span className="price">{vnd(p.price)}</span>
                <span className={`stock ${p.stock <= 5 ? "low" : ""}`}>Kho: {p.stock}</span>
              </div>
            </button>
          ))}
        </section>

        <aside className="cart">
          <h2>Giỏ hàng</h2>
          {cartLines.length === 0 ? (
            <div className="empty">Chưa có sản phẩm. Bấm vào sản phẩm để thêm.</div>
          ) : (
            <ul className="cart-list">
              {cartLines.map((l) => (
                <li key={l.product.id}>
                  <div className="cart-line-top">
                    <span>{l.product.name}</span>
                    <button className="x" onClick={() => setQty(l.product.id, 0)}>✕</button>
                  </div>
                  <div className="cart-line-bot">
                    <div className="qty">
                      <button onClick={() => setQty(l.product.id, l.qty - 1)}>−</button>
                      <span>{l.qty}</span>
                      <button
                        onClick={() =>
                          l.qty < l.product.stock
                            ? setQty(l.product.id, l.qty + 1)
                            : setToast(`Chỉ còn ${l.product.stock} trong kho`)
                        }
                      >
                        +
                      </button>
                    </div>
                    <span className="line-total">{vnd(l.product.price * l.qty)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="cart-foot">
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">— Khách lẻ —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="total-row">
              <span>Tổng cộng</span>
              <strong>{vnd(total)}</strong>
            </div>
            <button
              className="btn btn-primary btn-block"
              onClick={checkout}
              disabled={submitting || cartLines.length === 0}
            >
              {submitting ? "Đang tạo đơn…" : "Tính tiền & tạo đơn"}
            </button>
          </div>
        </aside>
      </div>

      {toast && (
        <div className="toast" onClick={() => setToast(null)}>{toast}</div>
      )}
    </div>
  );
}
