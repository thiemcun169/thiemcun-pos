import { useState } from "react";
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from "../lib/supabaseClient";

export default function LoginPage() {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [err, setErr] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(null); setInfo(null); setBusy(true);
    try {
      if (mode === "login") {
        await signInWithEmail(email.trim(), password);
      } else {
        const { session } = await signUpWithEmail(email.trim(), password, fullName.trim());
        if (!session) setInfo("Đăng ký thành công! Nếu cần xác minh email hãy kiểm tra hộp thư, rồi đăng nhập.");
      }
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <div className="auth-brand">
          <span className="auth-logo">🛒</span>
          <span>ThiemCun POS</span>
        </div>
        <h2>Quản lý bán hàng cho cửa hàng nhỏ</h2>
        <p>Bán hàng nhanh, theo dõi tồn kho, báo cáo doanh thu — gọn nhẹ, an toàn, đăng nhập có phân quyền.</p>
        <ul className="auth-points">
          <li>✓ Dữ liệu lưu bền trên Supabase</li>
          <li>✓ Phân quyền chủ shop / nhân viên</li>
          <li>✓ Đăng nhập Google hoặc email</li>
        </ul>
      </div>

      <div className="auth-card">
        <h1>{mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</h1>
        <p className="auth-sub">
          {mode === "login" ? "Đăng nhập để vào cửa hàng." : "Email của bạn phải được admin cấp quyền trước."}
        </p>

        <button className="btn btn-google" onClick={signInWithGoogle} disabled={busy}>
          <span className="g">G</span> Tiếp tục với Google
        </button>

        <div className="auth-divider"><span>hoặc</span></div>

        <form onSubmit={submit} className="auth-form">
          {mode === "signup" && (
            <label> Họ tên
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nguyễn Văn A" />
            </label>
          )}
          <label> Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@email.com" />
          </label>
          <label> Mật khẩu
            <input type="password" required minLength={6} value={password}
                   onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </label>

          {err && <div className="auth-err">⚠️ {err}</div>}
          {info && <div className="auth-info">✅ {info}</div>}

          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : "Đăng ký"}
          </button>
        </form>

        <div className="auth-switch">
          {mode === "login" ? (
            <>Chưa có tài khoản? <button onClick={() => { setMode("signup"); setErr(null); }}>Đăng ký</button></>
          ) : (
            <>Đã có tài khoản? <button onClick={() => { setMode("login"); setErr(null); }}>Đăng nhập</button></>
          )}
        </div>
        <div className="auth-foot">Dựng bằng Claude Code</div>
      </div>
    </div>
  );
}
