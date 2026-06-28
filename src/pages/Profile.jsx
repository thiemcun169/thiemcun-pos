import { useState } from "react";
import { updatePassword } from "../lib/supabaseClient";

// Hồ sơ cá nhân: xem thông tin + đổi mật khẩu.
export default function Profile({ user }) {
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function changePw(e) {
    e.preventDefault(); setMsg(null); setErr(null);
    if (pw.length < 8) return setErr("Mật khẩu tối thiểu 8 ký tự.");
    setBusy(true);
    try { await updatePassword(pw); setPw(""); setMsg("Đã đổi mật khẩu."); }
    catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <div className="page">
      <div className="page-head"><h2>Hồ sơ</h2></div>
      <div className="card pad profile-grid">
        <div><span className="muted">Email</span><div>{user.email}</div></div>
        <div><span className="muted">Họ tên</span><div>{user.full_name || "—"}</div></div>
        <div><span className="muted">Vai trò</span><div><span className={`pill role-${user.role}`}>{user.role === "owner" ? "Chủ shop" : "Nhân viên"}</span></div></div>
        <div><span className="muted">Trạng thái</span><div><span className="pill active">Hoạt động</span></div></div>
      </div>

      <div className="card pad">
        <h3>Đổi mật khẩu</h3>
        <form onSubmit={changePw} className="inline-form">
          <input type="password" placeholder="Mật khẩu mới (≥ 8 ký tự)" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} />
          <button className="btn btn-primary" disabled={busy}>{busy ? "…" : "Đổi"}</button>
        </form>
        {msg && <div className="auth-info">✅ {msg}</div>}
        {err && <div className="auth-err">⚠️ {err}</div>}
      </div>
    </div>
  );
}
