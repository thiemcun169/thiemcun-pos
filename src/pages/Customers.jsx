import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { vnd, shortDate } from "../lib/format";
import { initialOf } from "../lib/ui";
import { useToasts, Toasts } from "../components/Toasts.jsx";

// Màn Khách hàng: bảng + thêm (modal) + hồ sơ chi tiết (drawer, lịch sử mua).
export default function Customers() {
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const { toasts, push, dismiss } = useToasts();

  const reload = useCallback(async () => {
    try { setRows(await api.listCustomers()); } catch (e) { push(e.message, "error"); }
  }, [push]);
  useEffect(() => { reload(); }, [reload]);

  async function open(id) {
    try { setDetail(await api.getCustomer(id)); } catch (e) { push(e.message, "error"); }
  }
  async function addCustomer(e) {
    e.preventDefault(); setBusy(true);
    try {
      await api.createCustomer({ name: form.name.trim(), phone: form.phone.trim() || null });
      setForm({ name: "", phone: "" }); setAdding(false); push(`Đã thêm khách hàng "${form.name.trim()}"`); await reload();
    } catch (e2) { push(e2.message, "error"); } finally { setBusy(false); }
  }

  return (
    <div className="page">
      <div className="toolbar end">
        <button className="btn btn-primary" onClick={() => setAdding(true)}><i className="ph ph-plus" /> Thêm khách hàng</button>
      </div>

      <div className="card">
        <table className="data-table">
          <thead><tr><th>Khách hàng</th><th>Số điện thoại</th><th className="c">Số lượt mua</th><th className="r">Tổng chi tiêu</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="clickable" onClick={() => open(c.id)}>
                <td><div className="name-cell"><div className="avatar sm">{initialOf(c.name)}</div><span className="cell-strong">{c.name}</span></div></td>
                <td>{c.phone || "—"}</td>
                <td className="c">{c.purchase_count ?? 0}</td>
                <td className="r cell-strong">{vnd(c.total_spent || 0)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="empty">Chưa có khách hàng.</td></tr>}
          </tbody>
        </table>
      </div>

      {adding && (
        <div className="modal-overlay">
          <div className="scrim" onClick={() => setAdding(false)} />
          <form className="modal sm" onSubmit={addCustomer}>
            <div className="modal-head"><span className="title">Thêm khách hàng</span>
              <button type="button" className="modal-x" onClick={() => setAdding(false)}><i className="ph ph-x" /></button>
            </div>
            <div className="modal-body form-cols">
              <div className="field"><label className="field-label">Họ và tên</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: Nguyễn Văn A" /></div>
              <div className="field"><label className="field-label">Số điện thoại</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="VD: 0901 234 567" /></div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => setAdding(false)}>Huỷ</button>
              <button className="btn btn-primary" disabled={busy}>{busy ? "…" : "Thêm"}</button>
            </div>
          </form>
        </div>
      )}

      {detail && (
        <div className="drawer-overlay">
          <div className="scrim" onClick={() => setDetail(null)} />
          <div className="drawer">
            <div className="drawer-head">
              <span className="title">Hồ sơ khách hàng</span>
              <button className="modal-x" onClick={() => setDetail(null)}><i className="ph ph-x" /></button>
            </div>
            <div className="drawer-body">
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
                <div className="avatar lg">{initialOf(detail.name)}</div>
                <div><div style={{ fontSize: 17, fontWeight: 700 }}>{detail.name}</div><div className="muted" style={{ fontSize: 13 }}>{detail.phone || "—"}</div></div>
              </div>
              <div className="stat-grid">
                <div className="stat-box"><div className="l">Tổng chi tiêu</div><div className="v accent">{vnd(detail.total_spent || 0)}</div></div>
                <div className="stat-box"><div className="l">Số lượt mua</div><div className="v">{detail.purchase_count ?? detail.orders?.length ?? 0}</div></div>
              </div>
              <div className="section-label">Lịch sử mua hàng</div>
              {(detail.orders || []).length === 0 ? <div className="empty">Chưa có giao dịch nào.</div> : (
                <div className="hist-list">
                  {detail.orders.map((o) => (
                    <div className="hist-item" key={o.id}>
                      <div><div className="hid">#{o.id}</div><div className="hdate">{shortDate(o.created_at)}</div></div>
                      <span className="cell-strong">{vnd(o.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <Toasts toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
