import { useMemo, useState } from "react";
import { api } from "../api";
import { vnd } from "../lib/format";

const EMPTY = { name: "", sku: "", category: "", price: "", stock: "", image_url: "", description: "", low_stock_threshold: 5 };

// Màn Sản phẩm: danh sách + cảnh báo tồn thấp + thêm/sửa/xoá (modal).
export default function Products({ products, onChanged }) {
  const [editing, setEditing] = useState(null); // null=đóng, {}=tạo mới, {id...}=sửa
  const [err, setErr] = useState(null);

  const lowStock = useMemo(
    () => products.filter((p) => p.stock <= (p.low_stock_threshold ?? 5)),
    [products]
  );

  async function remove(p) {
    if (!window.confirm(`Xoá sản phẩm "${p.name}"?`)) return;
    try { await api.deleteProduct(p.id); onChanged(); } catch (e) { setErr(e.message); }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div><h1>Sản phẩm</h1><div className="muted">Quản lý kho hàng</div></div>
        <button className="btn btn-primary" onClick={() => setEditing({ ...EMPTY })}>+ Thêm sản phẩm</button>
      </header>

      {err && <div className="banner banner-error">⚠️ {err}</div>}
      {lowStock.length > 0 && (
        <div className="banner banner-warn">
          ⚠️ <b>{lowStock.length} sản phẩm</b> sắp hết hàng. Hãy nhập thêm để không gián đoạn bán hàng.
        </div>
      )}

      <div className="card">
        <table className="data-table">
          <thead><tr><th>SẢN PHẨM</th><th>DANH MỤC</th><th>GIÁ BÁN</th><th>TỒN KHO</th><th>THAO TÁC</th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="cell-strong">{p.name}</div>
                  {p.sku && <div className="cell-sub">{p.sku}</div>}
                </td>
                <td>{p.category ? <span className="pill role-staff">{p.category}</span> : "—"}</td>
                <td>{vnd(p.price)}</td>
                <td><span className={`pill ${p.stock <= (p.low_stock_threshold ?? 5) ? "disabled" : "active"}`}>{p.stock}</span></td>
                <td className="row-actions">
                  <button className="btn-mini" onClick={() => setEditing(p)} title="Sửa">✏️</button>
                  <button className="btn-mini" onClick={() => remove(p)} title="Xoá">🗑️</button>
                </td>
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan={5} className="muted">Chưa có sản phẩm.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <ProductModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged(); }}
        />
      )}
    </div>
  );
}

function ProductModal({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial.id);
  const [f, setF] = useState({ ...EMPTY, ...initial });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload = {
      name: f.name.trim(), sku: f.sku?.trim() || null, category: f.category?.trim() || null,
      price: Number(f.price) || 0, stock: Number(f.stock) || 0,
      image_url: f.image_url?.trim() || null, description: f.description?.trim() || null,
      low_stock_threshold: Number(f.low_stock_threshold) || 5,
    };
    try {
      if (isEdit) await api.updateProduct(initial.id, payload);
      else await api.createProduct(payload);
      onSaved();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? "Sửa sản phẩm" : "Thêm sản phẩm"}</h2>
        <form onSubmit={submit} className="auth-form">
          <label>Tên sản phẩm<input required value={f.name} onChange={set("name")} /></label>
          <div className="form-grid">
            <label>Mã (SKU)<input value={f.sku || ""} onChange={set("sku")} /></label>
            <label>Danh mục<input value={f.category || ""} onChange={set("category")} /></label>
          </div>
          <div className="form-grid">
            <label>Giá bán (₫)<input type="number" min="0" required value={f.price} onChange={set("price")} /></label>
            <label>Tồn kho<input type="number" min="0" required value={f.stock} onChange={set("stock")} /></label>
            <label>Ngưỡng tồn thấp<input type="number" min="0" value={f.low_stock_threshold} onChange={set("low_stock_threshold")} /></label>
          </div>
          <label>Ảnh (URL)<input value={f.image_url || ""} onChange={set("image_url")} placeholder="https://…" /></label>
          <label>Mô tả<textarea rows={2} value={f.description || ""} onChange={set("description")} /></label>
          {err && <div className="auth-err">⚠️ {err}</div>}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>Huỷ</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
