import { useState } from "react";
import { updatePassword, signOut } from "../lib/supabaseClient";
import { api } from "../api";

// Bắt buộc đổi mật khẩu lần đầu (tài khoản mới / admin mặc định). Chặn UI khác.
export default function ForceChangePassword({ email, onDone }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setErr(null);
    if (pw.length < 8) return setErr("Mật khẩu mới tối thiểu 8 ký tự.");
    if (pw !== pw2) return setErr("Hai mật khẩu không khớp.");
    setBusy(true);
    try { await updatePassword(pw); await api.passwordChanged(); onDone(); }
    catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <div className="center-card-wrap">
      <div className="center-card">
        <div className="icon-tile" style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 20 }}><i className="ph ph-key" style={{ fontSize: 24 }} /></div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-.3px" }}>Đặt mật khẩu mới</h1>
        <p className="muted" style={{ fontSize: 14, margin: "0 0 24px", lineHeight: 1.5 }}>
          Đây là lần đăng nhập đầu tiên của <b style={{ color: "var(--text)" }}>{email}</b>. Vui lòng tạo mật khẩu mới để bảo mật tài khoản.
        </p>

        <form onSubmit={submit}>
          <div className="field" style={{ marginBottom: 16 }}>
            <label className="field-label">Mật khẩu mới</label>
            <input className="input" type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Tối thiểu 8 ký tự" />
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label className="field-label">Nhập lại mật khẩu</label>
            <input className="input" type="password" required minLength={8} value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Nhập lại mật khẩu mới" />
          </div>

          <div className="check-list">
            <div><i className="ph ph-check" />Tối thiểu 8 ký tự</div>
            <div><i className="ph ph-check" />Nên có chữ hoa, chữ thường và số</div>
          </div>

          {err && <div className="banner banner-error">⚠️ {err}</div>}
          <button className="btn btn-primary btn-block" style={{ height: 46 }} disabled={busy}>{busy ? "Đang lưu…" : "Đổi mật khẩu & tiếp tục"}</button>
        </form>
        <div style={{ marginTop: 16, textAlign: "center" }}><button className="btn-link" style={{ color: "var(--sub)" }} onClick={signOut}>Đăng xuất</button></div>
      </div>
    </div>
  );
}
