import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { vnd, shortDate } from "../lib/format";

// Màn Khách hàng: danh sách (lượt mua + tổng chi tiêu) + thêm + chi tiết (lịch sử mua).
export default function Customers() {
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try { setRows(await api.listCustomers()); } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  async function open(id) {
    try { setDetail(await api.getCustomer(id)); } catch (e) { setErr(e.message); }
  }
  async function addCustomer(e) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await api.createCustomer({ name: form.name.trim(), phone: form.phone.trim() || null });
      setForm({ name: "", phone: "" }); setAdding(false); await reload();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div><h1>Khách hàng</h1><div className="muted">Cơ sở dữ liệu khách</div></div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Thêm khách hàng</button>
      </header>
      {err && <div className="banner banner-error">⚠️ {err}</div>}

      <div className="card">
        <table className="data-table">
          <thead><tr><th>KHÁCH HÀNG</th><th>SỐ ĐIỆN THOẠI</th><th>SỐ LƯỢT MUA</th><th>TỔNG CHI TIÊU</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="clickable" onClick={() => open(c.id)}>
                <td><div className="avatar-row"><span className="avatar">{(c.name || "?")[0]}</span><span className="cell-strong">{c.name}</span></div></td>
                <td>{c.phone || "—"}</td>
                <td>{c.purchase_count ?? 0} lượt</td>
                <td className="cell-strong">{vnd(c.total_spent || 0)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="muted">Chưa có khách hàng.</td></tr>}
          </tbody>
        </table>
      </div>

      {adding && (
        <div className="modal-overlay" onClick={() => setAdding(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Thêm khách hàng</h2>
            <form onSubmit={addCustomer} className="auth-form">
              <label>Tên<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label>Số điện thoại<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setAdding(false)}>Huỷ</button>
                <button className="btn btn-primary" disabled={busy}>{busy ? "…" : "Lưu"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detail && (
        <div className="drawer-overlay" onClick={() => setDetail(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div><h2>{detail.name}</h2><div className="muted">{detail.phone || "—"}</div></div>
              <button className="btn-link" onClick={() => setDetail(null)}>Đóng</button>
            </div>
            <div className="profile-grid">
              <div><span className="muted">Số lượt mua</span><div className="cell-strong">{detail.purchase_count ?? detail.orders?.length ?? 0}</div></div>
              <div><span className="muted">Tổng chi tiêu</span><div className="cell-strong">{vnd(detail.total_spent || 0)}</div></div>
            </div>
            <h3>Lịch sử mua</h3>
            <table className="data-table">
              <thead><tr><th>MÃ ĐƠN</th><th>NGÀY</th><th>TỔNG</th></tr></thead>
              <tbody>
                {(detail.orders || []).map((o) => (
                  <tr key={o.id}><td>#{o.id}</td><td>{shortDate(o.created_at)}</td><td>{vnd(o.total)}</td></tr>
                ))}
                {(!detail.orders || detail.orders.length === 0) && <tr><td colSpan={3} className="muted">Chưa có đơn nào.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
