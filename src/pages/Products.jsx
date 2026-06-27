import { useState } from "react";
import { api } from "../api";
import { vnd } from "../lib/format";

// Màn Sản phẩm: xem danh sách + thêm sản phẩm mới + chỉnh nhanh tồn kho.
export default function Products({ products, onChanged }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", sku: "", category: "", price: "", stock: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.createProduct({
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        category: form.category.trim() || null,
        price: Number(form.price) || 0,
        stock: Number(form.stock) || 0,
      });
      setForm({ name: "", sku: "", category: "", price: "", stock: "" });
      setShowForm(false);
      onChanged();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function bumpStock(p, delta) {
    try {
      await api.updateProduct(p.id, { stock: Math.max(0, p.stock + delta) });
      onChanged();
    } catch (e2) {
      setErr(e2.message);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Sản phẩm</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Đóng" : "+ Thêm sản phẩm"}
        </button>
      </header>

      {err && <div className="banner banner-error">⚠️ {err}</div>}

      {showForm && (
        <form className="card form-grid" onSubmit={submit}>
          <label>Tên<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Mã (SKU)<input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></label>
          <label>Nhóm<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
          <label>Giá (₫)<input type="number" min="0" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
          <label>Tồn kho<input type="number" min="0" required value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></label>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu"}</button>
        </form>
      )}

      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Tên</th><th>Nhóm</th><th>Giá</th><th>Tồn kho</th><th></th></tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="cell-strong">{p.name}</div>
                  {p.sku && <div className="cell-sub">{p.sku}</div>}
                </td>
                <td>{p.category || "—"}</td>
                <td>{vnd(p.price)}</td>
                <td>
                  <span className={`pill ${p.stock <= 5 ? "pill-warn" : ""}`}>{p.stock}</span>
                </td>
                <td className="row-actions">
                  <button className="btn-mini" onClick={() => bumpStock(p, +10)}>+10</button>
                  <button className="btn-mini" onClick={() => bumpStock(p, -1)} disabled={p.stock <= 0}>−1</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
