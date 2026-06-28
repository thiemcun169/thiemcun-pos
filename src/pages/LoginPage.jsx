import { useState } from "react";
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from "../lib/supabaseClient";

// Pixel-pass theo design/exports .dc.html (Login). Inline style để khớp chính xác source.
const C = { accent: "#008060", accentD: "#006e52", border: "#E1E3E5", sub: "#6D7175", ink: "#202223" };
const inputStyle = { width: "100%", height: 44, padding: "0 14px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, outline: "none" };

export default function LoginPage() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [err, setErr] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setErr(null); setInfo(null); setBusy(true);
    try {
      if (mode === "login") await signInWithEmail(email.trim(), password);
      else {
        const { session } = await signUpWithEmail(email.trim(), password, fullName.trim());
        if (!session) setInfo("Đăng ký thành công! Kiểm tra email xác minh nếu cần, rồi đăng nhập.");
      }
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <div style={{ height: "100vh", display: "grid", gridTemplateColumns: "1.1fr 1fr" }}>
      {/* LEFT — form */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 40 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="ph-fill ph-storefront" style={{ color: "#fff", fontSize: 21 }} />
            </div>
            <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.3px" }}>ThiemCun <span style={{ color: C.accent }}>POS</span></span>
          </div>

          <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-.4px" }}>{mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</h1>
          <p style={{ color: C.sub, fontSize: 14, margin: "0 0 28px" }}>
            {mode === "login" ? "Quản lý cửa hàng của bạn mọi lúc, mọi nơi." : "Email của bạn phải được admin cấp quyền trước."}
          </p>

          <form onSubmit={submit}>
            {mode === "signup" && (
              <>
                <label style={lbl}>Họ tên</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nguyễn Văn A" style={{ ...inputStyle, marginBottom: 16 }} />
              </>
            )}
            <label style={lbl}>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@thiemcun.vn" style={{ ...inputStyle, marginBottom: 16 }} />

            <label style={lbl}>Mật khẩu</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ ...inputStyle, marginBottom: 8 }} />
            <div style={{ textAlign: "right", marginBottom: 20 }}><a href="#" style={{ fontSize: 13, color: C.accent, textDecoration: "none" }}>Quên mật khẩu?</a></div>

            {err && <div style={alert("#fbeae5", "#d72c0d")}>⚠️ {err}</div>}
            {info && <div style={alert("#e3f1ed", C.accent)}>✅ {info}</div>}

            <button disabled={busy} style={{ width: "100%", height: 46, background: C.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              {busy ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : "Đăng ký"}
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0", color: C.sub, fontSize: 12 }}>
            <div style={{ flex: 1, height: 1, background: C.border }} />hoặc<div style={{ flex: 1, height: 1, background: C.border }} />
          </div>

          <button onClick={signInWithGoogle} style={{ width: "100%", height: 46, background: "#fff", color: C.ink, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>
              <span style={{ color: "#4285F4" }}>G</span><span style={{ color: "#EA4335" }}>o</span><span style={{ color: "#FBBC05" }}>o</span><span style={{ color: "#4285F4" }}>g</span><span style={{ color: "#34A853" }}>l</span><span style={{ color: "#EA4335" }}>e</span>
            </span>
            Đăng nhập với Google
          </button>

          <div style={{ marginTop: 24, display: "flex", gap: 8, alignItems: "flex-start", background: "#F1F8F5", border: "1px solid #cce7dd", borderRadius: 8, padding: 12 }}>
            <i className="ph ph-shield-check" style={{ color: C.accent, fontSize: 17, marginTop: 1 }} />
            <span style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.5 }}>Chỉ những email đã được cấp quyền (allowlist) mới có thể truy cập hệ thống.</span>
          </div>

          <div style={{ marginTop: 18, textAlign: "center", color: C.sub, fontSize: 13 }}>
            {mode === "login"
              ? <>Chưa có tài khoản? <button onClick={() => { setMode("signup"); setErr(null); }} style={linkBtn}>Đăng ký</button></>
              : <>Đã có tài khoản? <button onClick={() => { setMode("login"); setErr(null); }} style={linkBtn}>Đăng nhập</button></>}
          </div>
        </div>
      </div>

      {/* RIGHT — hero */}
      <div style={{ background: "linear-gradient(150deg, #013d2f, #008060)", display: "flex", flexDirection: "column", justifyContent: "center", padding: 56, color: "#fff" }}>
        <i className="ph-fill ph-storefront" style={{ fontSize: 40, opacity: 0.9, marginBottom: 24 }} />
        <h2 style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.25, margin: "0 0 16px", letterSpacing: "-.5px" }}>Bán hàng nhanh,<br />quản lý dễ dàng.</h2>
        <p style={{ fontSize: 15, opacity: 0.85, lineHeight: 1.6, margin: "0 0 32px", maxWidth: 360 }}>Đầy đủ công cụ cho cửa hàng bán lẻ: thu ngân, kho hàng, khách hàng và báo cáo doanh thu — trên một nền tảng.</p>
        <div style={{ display: "flex", gap: 28 }}>
          <div><div style={{ fontSize: 24, fontWeight: 700 }}>2.500+</div><div style={{ fontSize: 13, opacity: 0.8 }}>cửa hàng tin dùng</div></div>
          <div><div style={{ fontSize: 24, fontWeight: 700 }}>99,9%</div><div style={{ fontSize: 13, opacity: 0.8 }}>thời gian hoạt động</div></div>
        </div>
      </div>
    </div>
  );
}

const lbl = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 };
const linkBtn = { background: "none", border: "none", color: "#008060", fontWeight: 700, cursor: "pointer", fontSize: 13 };
const alert = (bg, color) => ({ background: bg, color, padding: "9px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 });
