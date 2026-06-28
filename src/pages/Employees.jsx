import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { shortDate } from "../lib/format";

// Quản lý nhân viên (CHỈ owner). Mời email, đổi vai trò, bật/tắt tài khoản.
export default function Employees() {
  const [data, setData] = useState({ profiles: [], pending: [] });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try { setData(await api.listEmployees()); } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  async function invite(e) {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      await api.inviteEmployee({ email: email.trim().toLowerCase(), role });
      setEmail(""); await reload();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  async function setProfile(id, patch) {
    try { await api.updateEmployee(id, patch); await reload(); }
    catch (e) { setErr(e.message); }
  }

  async function revoke(em) {
    try { await api.revokeInvite(em); await reload(); } catch (e) { setErr(e.message); }
  }

  return (
    <div className="page">
      <div className="page-head"><h2>Nhân viên</h2></div>
      {err && <div className="banner banner-error">⚠️ {err}</div>}

      <div className="card pad">
        <h3>Mời nhân viên mới</h3>
        <p className="muted">Chỉ email được mời mới đăng nhập được (Google hoặc email/mật khẩu).</p>
        <form onSubmit={invite} className="inline-form">
          <input type="email" required placeholder="nhanvien@email.com" value={email}
                 onChange={(e) => setEmail(e.target.value)} />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="staff">Nhân viên (POS)</option>
            <option value="owner">Chủ shop (full)</option>
          </select>
          <button className="btn btn-primary" disabled={busy}>{busy ? "…" : "Mời"}</button>
        </form>
      </div>

      <div className="card pad">
        <h3>Đang hoạt động</h3>
        <table className="data-table">
          <thead><tr><th>Email</th><th>Tên</th><th>Vai trò</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {data.profiles.map((p) => (
              <tr key={p.id}>
                <td>{p.email}</td>
                <td>{p.full_name || "—"}</td>
                <td>
                  <select value={p.role} onChange={(e) => setProfile(p.id, { role: e.target.value })}>
                    <option value="staff">Nhân viên</option>
                    <option value="owner">Chủ shop</option>
                  </select>
                </td>
                <td><span className={`pill ${p.status}`}>{p.status === "active" ? "Hoạt động" : "Đã khoá"}</span></td>
                <td>
                  <button className="btn-link" onClick={() => setProfile(p.id, { status: p.status === "active" ? "disabled" : "active" })}>
                    {p.status === "active" ? "Khoá" : "Mở khoá"}
                  </button>
                </td>
              </tr>
            ))}
            {data.profiles.length === 0 && <tr><td colSpan={5} className="muted">Chưa có nhân viên.</td></tr>}
          </tbody>
        </table>
      </div>

      {data.pending.length > 0 && (
        <div className="card pad">
          <h3>Đã mời (chờ đăng nhập lần đầu)</h3>
          <table className="data-table">
            <thead><tr><th>Email</th><th>Vai trò</th><th>Mời lúc</th><th></th></tr></thead>
            <tbody>
              {data.pending.map((a) => (
                <tr key={a.email}>
                  <td>{a.email}</td><td>{a.role}</td><td>{shortDate(a.created_at)}</td>
                  <td><button className="btn-link" onClick={() => revoke(a.email)}>Thu hồi</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
