import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { shortDate } from "../lib/format";
import { initialOf } from "../lib/ui";
import { useToasts, Toasts } from "../components/Toasts.jsx";

// Quản lý nhân viên (CHỈ owner): mời email, đổi vai trò, bật/tắt truy cập.
export default function Employees() {
  const [data, setData] = useState({ profiles: [], pending: [] });
  const [invite, setInvite] = useState(null); // {email, role}
  const [busy, setBusy] = useState(false);
  const { toasts, push, dismiss } = useToasts();

  const reload = useCallback(async () => {
    try { setData(await api.listEmployees()); } catch (e) { push(e.message, "error"); }
  }, [push]);
  useEffect(() => { reload(); }, [reload]);

  async function sendInvite(e) {
    e.preventDefault(); setBusy(true);
    try {
      await api.inviteEmployee({ email: invite.email.trim().toLowerCase(), role: invite.role });
      push(`Đã gửi lời mời tới ${invite.email.trim()}`); setInvite(null); await reload();
    } catch (e2) { push(e2.message, "error"); } finally { setBusy(false); }
  }
  async function setProfile(id, patch) {
    try { await api.updateEmployee(id, patch); await reload(); } catch (e) { push(e.message, "error"); }
  }
  async function revoke(em) {
    try { await api.revokeInvite(em); push("Đã thu hồi lời mời", "info"); await reload(); } catch (e) { push(e.message, "error"); }
  }

  return (
    <div className="page">
      <div className="toolbar end">
        <button className="btn btn-primary" onClick={() => setInvite({ email: "", role: "staff" })}><i className="ph ph-paper-plane-tilt" /> Mời nhân viên</button>
      </div>

      <div className="card">
        <table className="data-table">
          <thead><tr><th>Nhân viên</th><th>Vai trò</th><th>Trạng thái</th><th className="r">Truy cập</th></tr></thead>
          <tbody>
            {data.profiles.map((p) => {
              const owner = p.role === "owner";
              const activeS = p.status === "active";
              return (
                <tr key={p.id}>
                  <td><div className="name-cell"><div className="avatar sm">{initialOf(p.full_name || p.email)}</div>
                    <div><div className="cell-strong">{p.full_name || "—"}</div><div className="cell-sub">{p.email}</div></div></div></td>
                  <td>
                    <select className="select" style={{ height: 34, width: "auto" }} value={p.role} onChange={(e) => setProfile(p.id, { role: e.target.value })}>
                      <option value="staff">Nhân viên</option>
                      <option value="owner">Chủ cửa hàng</option>
                    </select>
                  </td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: activeS ? "var(--accent)" : "var(--sub)" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: activeS ? "var(--accent)" : "var(--sub)" }} />{activeS ? "Đang hoạt động" : "Đã khoá"}
                    </span>
                  </td>
                  <td className="r">
                    {owner ? <span className="muted" style={{ fontSize: 12 }}><i className="ph ph-lock-simple" /> Toàn quyền</span>
                      : <button className={`toggle ${activeS ? "on" : ""}`} style={{ width: 44, height: 24 }} title={activeS ? "Khoá" : "Mở khoá"}
                          onClick={() => setProfile(p.id, { status: activeS ? "disabled" : "active" })}>
                          <span className="knob" style={{ width: 18, height: 18, left: activeS ? 23 : 3 }} />
                        </button>}
                  </td>
                </tr>
              );
            })}
            {data.profiles.length === 0 && <tr><td colSpan={4} className="empty">Chưa có nhân viên.</td></tr>}
          </tbody>
        </table>
      </div>

      {data.pending.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-head"><span className="card-title">Đã mời (chờ đăng nhập lần đầu)</span></div>
          <table className="data-table">
            <thead><tr><th>Email</th><th>Vai trò</th><th>Mời lúc</th><th className="r">Thao tác</th></tr></thead>
            <tbody>
              {data.pending.map((a) => (
                <tr key={a.email}>
                  <td>{a.email}</td><td>{a.role === "owner" ? "Chủ cửa hàng" : "Nhân viên"}</td><td className="muted">{shortDate(a.created_at)}</td>
                  <td className="r"><button className="btn-link" style={{ color: "var(--danger)" }} onClick={() => revoke(a.email)}>Thu hồi</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {invite && (
        <div className="modal-overlay">
          <div className="scrim" onClick={() => setInvite(null)} />
          <form className="modal sm" onSubmit={sendInvite}>
            <div className="modal-head"><span className="title">Mời nhân viên</span>
              <button type="button" className="modal-x" onClick={() => setInvite(null)}><i className="ph ph-x" /></button>
            </div>
            <div className="modal-body form-cols">
              <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>Chỉ email được mời mới đăng nhập được (Google hoặc email/mật khẩu). Nhân viên đặt mật khẩu khi đăng nhập lần đầu.</p>
              <div className="field"><label className="field-label">Email</label><input className="input" type="email" required value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="nhanvien@thiemcun.vn" /></div>
              <div className="field"><label className="field-label">Vai trò</label>
                <select className="select" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
                  <option value="staff">Nhân viên (POS)</option>
                  <option value="owner">Chủ cửa hàng (toàn quyền)</option>
                </select>
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => setInvite(null)}>Huỷ</button>
              <button className="btn btn-primary" disabled={busy}><i className="ph ph-paper-plane-tilt" /> {busy ? "…" : "Gửi lời mời"}</button>
            </div>
          </form>
        </div>
      )}
      <Toasts toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
