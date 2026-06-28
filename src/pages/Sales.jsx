import { useMemo, useState } from "react";
import { api } from "../api";
import { vnd } from "../lib/format";
import { catIcon } from "../lib/ui";
import { useToasts, Toasts } from "../components/Toasts.jsx";

const DISCOUNTS = [
  { key: "none", label: "Không", rate: 0 },
  { key: "5", label: "5%", rate: 0.05 },
  { key: "10", label: "10%", rate: 0.1 },
  { key: "15", label: "15%", rate: 0.15 },
  { key: "member", label: "Thành viên", rate: 0.1 },
];

// Màn Bán hàng (POS): chọn sản phẩm -> giỏ hàng -> giảm giá/thanh toán -> tạo đơn + hoá đơn.
export default function Sales({ products, customers }) {
  const [cart, setCart] = useState({});       // { productId: qty }
  const [customerId, setCustomerId] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [discount, setDiscount] = useState("none");
  const [pay, setPay] = useState("cash");
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const { toasts, push, dismiss } = useToasts();

  const categories = useMemo(() => {
    const set = [...new Set(products.map((p) => p.category).filter(Boolean))];
    return ["all", ...set];
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (category === "all" || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q))
    );
  }, [products, query, category]);

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => {
          const p = products.find((x) => String(x.id) === String(id));
          return p ? { product: p, qty } : null;
        })
        .filter(Boolean),
    [cart, products]
  );

  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const discRate = DISCOUNTS.find((d) => d.key === discount)?.rate || 0;
  const discAmount = Math.round(subtotal * discRate);
  const total = subtotal - discAmount;
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const low = (p) => p.stock <= (p.low_stock_threshold ?? 5);

  function add(p) {
    setCart((c) => {
      const cur = c[p.id] || 0;
      if (cur + 1 > p.stock) { push(`Chỉ còn ${p.stock} "${p.name}" trong kho`, "error"); return c; }
      return { ...c, [p.id]: cur + 1 };
    });
  }
  function setQty(id, qty) {
    setCart((c) => { const n = { ...c }; if (qty <= 0) delete n[id]; else n[id] = qty; return n; });
  }
  function clear() { setCart({}); setDiscount("none"); }

  async function checkout() {
    if (!lines.length) return;
    setSubmitting(true);
    try {
      const items = lines.map((l) => ({ product_id: l.product.id, qty: l.qty }));
      const order = await api.createOrder({ items, customer_id: customerId ? Number(customerId) : null });
      // Hoá đơn hiển thị theo những gì thu ngân vừa nhập (kèm giảm giá nếu có).
      setReceipt({
        id: order.id,
        date: new Date().toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        items: lines.map((l) => ({ name: l.product.name, qty: l.qty, line: l.product.price * l.qty })),
        subtotal, discAmount, total, pay: pay === "cash" ? "Tiền mặt" : "Chuyển khoản",
      });
      clear(); setCustomerId("");
      push(`Thanh toán thành công · ${vnd(total)}`);
    } catch (e) { push(e.message, "error"); } finally { setSubmitting(false); }
  }

  return (
    <div className="pos">
      {/* KHU SẢN PHẨM */}
      <div className="pos-main">
        <div className="pos-tools">
          <div className="search">
            <i className="ph ph-magnifying-glass" />
            <input placeholder="Tìm sản phẩm..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        <div className="chips">
          {categories.map((c) => (
            <button key={c} className={`chip ${category === c ? "active" : ""}`} onClick={() => setCategory(c)}>
              {c === "all" ? "Tất cả" : c}
            </button>
          ))}
        </div>
        <div className="pos-scroll">
          {filtered.length === 0 ? <div className="empty">Không tìm thấy sản phẩm.</div> : (
            <div className="pos-grid">
              {filtered.map((p) => (
                <button key={p.id} className="pcard" onClick={() => add(p)} disabled={p.stock <= 0}>
                  <div className="pcard-img">
                    {p.image_url ? <img src={p.image_url} alt={p.name} /> : <i className={`ph ${catIcon(p.category)}`} />}
                    {low(p) && <span className="low">Sắp hết</span>}
                  </div>
                  <div className="pcard-body">
                    <div className="pcard-name">{p.name}</div>
                    <div className="pcard-foot">
                      <span className="pcard-price">{vnd(p.price)}</span>
                      <span className="pcard-stock">Kho: {p.stock}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* GIỎ HÀNG */}
      <div className="cart">
        <div className="cart-head">
          <div className="title"><i className="ph ph-shopping-cart-simple" /><strong>Giỏ hàng</strong><span className="count">{count}</span></div>
          {count > 0 && <button className="btn-link" style={{ color: "var(--sub)" }} onClick={clear}>Xoá hết</button>}
        </div>

        <div className="cart-body">
          {lines.length === 0 ? (
            <div className="cart-empty">
              <i className="ph ph-shopping-cart" />
              <div>Chưa có sản phẩm.<br />Chạm vào sản phẩm để thêm.</div>
            </div>
          ) : (
            <div className="cart-items">
              {lines.map((l) => (
                <div className="cart-item" key={l.product.id}>
                  <div className="ci-info">
                    <div className="ci-name">{l.product.name}</div>
                    <div className="ci-price">{vnd(l.product.price)}</div>
                  </div>
                  <div className="stepper">
                    <button onClick={() => setQty(l.product.id, l.qty - 1)}><i className="ph ph-minus" /></button>
                    <span className="q">{l.qty}</span>
                    <button onClick={() => (l.qty < l.product.stock ? setQty(l.product.id, l.qty + 1) : push(`Chỉ còn ${l.product.stock} trong kho`, "error"))}><i className="ph ph-plus" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="cart-foot">
          <div>
            <div className="foot-label">GIẢM GIÁ / VOUCHER</div>
            <div className="disc-opts">
              {DISCOUNTS.map((d) => (
                <button key={d.key} className={discount === d.key ? "on" : ""} onClick={() => setDiscount(d.key)}>{d.label}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="foot-label">KHÁCH HÀNG</div>
            <select className="select" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Khách lẻ</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <div className="foot-label">THANH TOÁN</div>
            <div className="pay-row">
              <button className={pay === "cash" ? "on" : ""} onClick={() => setPay("cash")}><i className="ph ph-money" /> Tiền mặt</button>
              <button className={pay === "bank" ? "on" : ""} onClick={() => setPay("bank")}><i className="ph ph-bank" /> Chuyển khoản</button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
            <div className="sum-row"><span>Tạm tính</span><span>{vnd(subtotal)}</span></div>
            {discAmount > 0 && <div className="sum-row disc"><span>Giảm giá</span><span>-{vnd(discAmount)}</span></div>}
            <div className="sum-total"><span>Tổng cộng</span><span>{vnd(total)}</span></div>
          </div>
          <button className="checkout-btn" onClick={checkout} disabled={submitting || !lines.length}>
            <i className="ph ph-check-circle" /> {submitting ? "Đang xử lý…" : "Thanh toán"}
          </button>
        </div>
      </div>

      {receipt && <Receipt r={receipt} onClose={() => setReceipt(null)} />}
      <Toasts toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

// Hoá đơn sau thanh toán.
function Receipt({ r, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="scrim" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 360 }}>
        <div style={{ padding: "28px 28px 20px", textAlign: "center", borderBottom: "1px dashed var(--border)" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--accent-tint)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <i className="ph-fill ph-check-circle" style={{ color: "var(--accent)", fontSize: 28 }} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Thanh toán thành công</div>
          <div style={{ fontSize: 13, color: "var(--sub)" }}>#{r.id} · {r.date}</div>
        </div>
        <div style={{ padding: "20px 28px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 16 }}>
            {r.items.map((i, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span>{i.name} <span style={{ color: "var(--sub)" }}>×{i.qty}</span></span>
                <span style={{ fontWeight: 600 }}>{vnd(i.line)}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 7 }}>
            <div className="sum-row"><span>Tạm tính</span><span>{vnd(r.subtotal)}</span></div>
            {r.discAmount > 0 && <div className="sum-row disc"><span>Giảm giá</span><span>-{vnd(r.discAmount)}</span></div>}
            <div className="sum-total" style={{ fontSize: 17 }}><span>Tổng cộng</span><span>{vnd(r.total)}</span></div>
            <div className="sum-row" style={{ marginTop: 2 }}><span>Phương thức</span><span>{r.pay}</span></div>
          </div>
        </div>
        <div style={{ padding: "0 24px 24px", display: "flex", gap: 12 }}>
          <button className="btn btn-block" onClick={onClose}>Đóng</button>
          <button className="btn btn-primary btn-block" onClick={() => window.print()}><i className="ph ph-printer" /> In hoá đơn</button>
        </div>
      </div>
    </div>
  );
}
