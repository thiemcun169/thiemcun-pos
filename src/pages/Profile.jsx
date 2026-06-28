import { useCallback, useEffect, useState } from "react";
import { updatePassword, listMfaFactors, enrollMfa, verifyMfa, unenrollMfa } from "../lib/supabaseClient";

// Hồ sơ cá nhân: thông tin + đổi mật khẩu + bật 2FA (MFA TOTP).
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
      <div className="page-head"><h2>Hồ sơ & Bảo mật</h2></div>
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

      <MfaSection isOwner={user.role === "owner"} />
    </div>
  );
}

// --- Bảo mật 2 lớp (TOTP) ---
function MfaSection({ isOwner }) {
  const [factors, setFactors] = useState([]);
  const [enroll, setEnroll] = useState(null); // {id, totp:{qr_code,secret}}
  const [code, setCode] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => setFactors(await listMfaFactors()), []);
  useEffect(() => { reload(); }, [reload]);

  const verified = factors.some((f) => f.status === "verified");

  async function start() {
    setErr(null); setBusy(true);
    try { setEnroll(await enrollMfa()); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function confirm() {
    setErr(null); setBusy(true);
    try { await verifyMfa(enroll.id, code.trim()); setEnroll(null); setCode(""); await reload(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function disable(id) {
    setBusy(true);
    try { await unenrollMfa(id); await reload(); } finally { setBusy(false); }
  }

  return (
    <div className="card pad">
      <h3>Xác thực 2 lớp (2FA / TOTP)
        {verified ? <span className="pill active" style={{ marginLeft: 10 }}>Đã bật</span>
                  : <span className="pill" style={{ marginLeft: 10 }}>Chưa bật</span>}
      </h3>
      <p className="muted">
        Dùng app Authenticator (Google Authenticator, Authy…) để bảo vệ tài khoản.
        {isOwner && " Khuyến nghị BẮT BUỘC cho chủ shop."}
      </p>

      {verified && (
        <div className="inline-form">
          {factors.filter((f) => f.status === "verified").map((f) => (
            <button key={f.id} className="btn" disabled={busy} onClick={() => disable(f.id)}>Tắt 2FA</button>
          ))}
        </div>
      )}

      {!verified && !enroll && (
        <button className="btn btn-primary" disabled={busy} onClick={start}>{busy ? "…" : "Bật 2FA"}</button>
      )}

      {!verified && enroll && (
        <div className="mfa-enroll">
          <p>1) Quét mã QR bằng app Authenticator:</p>
          <img src={enroll.totp.qr_code} alt="QR MFA" className="mfa-qr" />
          <p className="muted">Hoặc nhập tay mã bí mật: <code>{enroll.totp.secret}</code></p>
          <p>2) Nhập mã 6 số từ app:</p>
          <div className="inline-form">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" maxLength={6} />
            <button className="btn btn-primary" disabled={busy} onClick={confirm}>{busy ? "…" : "Xác nhận"}</button>
            <button className="btn" onClick={() => setEnroll(null)}>Huỷ</button>
          </div>
        </div>
      )}
      {err && <div className="auth-err">⚠️ {err}</div>}
    </div>
  );
}
