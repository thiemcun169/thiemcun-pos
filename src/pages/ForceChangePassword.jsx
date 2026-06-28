import { useState } from "react";
import { updatePassword, signOut } from "../lib/supabaseClient";
import { api } from "../api";

// Bắt buộc đổi mật khẩu lần đầu (admin mặc định / tài khoản mới). Chặn UI khác.
export default function ForceChangePassword({ email, onDone }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    if (pw.length < 8) return setErr("Mật khẩu mới tối thiểu 8 ký tự.");
    if (pw !== pw2) return setErr("Hai mật khẩu không khớp.");
    setBusy(true);
    try {
      await updatePassword(pw);
      await api.passwordChanged();
      onDone();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap center-only">
      <div className="auth-card">
        <h1>Đổi mật khẩu lần đầu</h1>
        <p className="auth-sub">Vì lý do an toàn, hãy đặt mật khẩu mới cho <b>{email}</b> trước khi tiếp tục.</p>
        <form onSubmit={submit} className="auth-form">
          <label> Mật khẩu mới (≥ 8 ký tự)
            <input type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} />
          </label>
          <label> Nhập lại mật khẩu
            <input type="password" required minLength={8} value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </label>
          {err && <div className="auth-err">⚠️ {err}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Đang lưu…" : "Đổi mật khẩu & tiếp tục"}
          </button>
        </form>
        <div className="auth-switch"><button onClick={signOut}>Đăng xuất</button></div>
      </div>
    </div>
  );
}
