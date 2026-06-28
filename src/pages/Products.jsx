import { useMemo, useState } from "react";
import { api } from "../api";
import { vnd } from "../lib/format";
import { catIcon } from "../lib/ui";
import { useToasts, Toasts } from "../components/Toasts.jsx";

const EMPTY = { name: "", sku: "", category: "", price: "", stock: "", image_url: "", description: "", low_stock_threshold: 5 };

// Màn Sản phẩm: bảng + cảnh báo tồn thấp + thêm/sửa/xoá (modal).
export default function Products({ products, onChanged }) {
  const [editing, setEditing] = useState(null); // null=đóng, {}=tạo mới, {id...}=sửa
  const [query, setQuery] = useState("");
  const { toasts, push, dismiss } = useToasts();

  const lowStock = useMemo(() => products.filter((p) => p.stock <= (p.low_stock_threshold ?? 5)), [products]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q));
  }, [products, query]);

  async function remove(p) {
    if (!window.confirm(`Xoá sản phẩm "${p.name}"?`)) return;
    try { await api.deleteProduct(p.id); push(`Đã xoá "${p.name}"`, "info"); onChanged(); }
    catch (e) { push(e.message, "error"); }
  }

  return (
    <div className="page">
      {lowStock.length > 0 && (
        <div className="banner banner-warn">
          <i className="ph ph-warning" />
          <span><strong>{lowStock.length} sản phẩm</strong> sắp hết hàng. Hãy nhập thêm để không gián đoạn bán hàng.</span>
        </div>
      )}

      <div className="toolbar">
        <div className="search">
          <i className="ph ph-magnifying-glass" />
          <input placeholder="Tìm sản phẩm..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({ ...EMPTY })}><i className="ph ph-plus" /> Thêm sản phẩm</button>
      </div>

      <div className="card">
        <table className="data-table">
          <thead><tr><th>Sản phẩm</th><th>Danh mục</th><th className="r">Giá bán</th><th className="c">Tồn kho</th><th className="r">Thao tác</th></tr></thead>
          <tbody>
            {rows.map((p) => {
              const low = p.stock <= (p.low_stock_threshold ?? 5);
              return (
                <tr key={p.id}>
                  <td>
                    <div className="name-cell">
                      <div className="thumb">{p.image_url ? <img src={p.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} /> : <i className={`ph ${catIcon(p.category)}`} />}</div>
                      <div><div className="cell-strong">{p.name}</div>{p.sku && <div className="cell-sub">{p.sku}</div>}</div>
                    </div>
                  </td>
                  <td>{p.category ? <span className="pill cat">{p.category}</span> : "—"}</td>
                  <td className="r cell-strong">{vnd(p.price)}</td>
                  <td className="c"><span className={`pill stock ${low ? "low" : "ok"}`}>{p.stock}</span></td>
                  <td className="r">
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button className="btn-icon" title="Sửa" onClick={() => setEditing(p)}><i className="ph ph-pencil-simple" /></button>
                      <button className="btn-icon del" title="Xoá" onClick={() => remove(p)}><i className="ph ph-trash" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={5} className="empty">Chưa có sản phẩm.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <ProductModal initial={editing} onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); push(msg); onChanged(); }} />
      )}
      <Toasts toasts={toasts} dismiss={dismiss} />
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
      onSaved(isEdit ? "Đã cập nhật sản phẩm" : `Đã thêm "${payload.name}"`);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="scrim" onClick={onClose} />
      <form className="modal" onSubmit={submit}>
        <div className="modal-head"><span className="title">{isEdit ? "Sửa sản phẩm" : "Thêm sản phẩm"}</span>
          <button type="button" className="modal-x" onClick={onClose}><i className="ph ph-x" /></button>
        </div>
        <div className="modal-body">
          <div className="form-cols">
            <div className="field"><label className="field-label">Tên sản phẩm</label>
              <input className="input" required value={f.name} onChange={set("name")} placeholder="VD: Áo thun cotton" /></div>
            <div className="form-grid">
              <div className="field"><label className="field-label">Mã (SKU)</label><input className="input" value={f.sku || ""} onChange={set("sku")} /></div>
              <div className="field"><label className="field-label">Danh mục</label><input className="input" value={f.category || ""} onChange={set("category")} placeholder="VD: Tạp hoá" /></div>
            </div>
            <div className="form-grid three">
              <div className="field"><label className="field-label">Giá bán (₫)</label><input className="input" type="number" min="0" required value={f.price} onChange={set("price")} placeholder="0" /></div>
              <div className="field"><label className="field-label">Tồn kho</label><input className="input" type="number" min="0" required value={f.stock} onChange={set("stock")} placeholder="0" /></div>
              <div className="field"><label className="field-label">Ngưỡng cảnh báo</label><input className="input" type="number" min="0" value={f.low_stock_threshold} onChange={set("low_stock_threshold")} placeholder="5" /></div>
            </div>
            <div className="field"><label className="field-label">Ảnh (URL)</label><input className="input" value={f.image_url || ""} onChange={set("image_url")} placeholder="https://…" /></div>
            <div className="field"><label className="field-label">Mô tả</label><textarea className="input" rows={2} value={f.description || ""} onChange={set("description")} /></div>
            {err && <div className="banner banner-error" style={{ margin: 0 }}>⚠️ {err}</div>}
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Huỷ</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu sản phẩm"}</button>
        </div>
      </form>
    </div>
  );
}
