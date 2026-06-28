import { useState } from "react";
import { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithMagicLink } from "../lib/supabaseClient";

// Trang đăng nhập — POS free cho shop nhỏ. Hero (trái) + form (phải).
// Ai cũng đăng ký được: đăng ký xong tự tạo cửa hàng riêng (multi-tenant).
export default function LoginPage() {
  const [mode, setMode] = useState("login"); // login | signup
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
        if (!session) setInfo("Đăng ký thành công! Kiểm tra email xác minh (nếu có), rồi đăng nhập.");
      }
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  async function magicLink() {
    if (!email.trim()) return setErr("Nhập email trước đã.");
    setErr(null); setInfo(null); setBusy(true);
    try {
      await signInWithMagicLink(email.trim(), fullName.trim());
      setInfo(`Đã gửi link đăng nhập tới ${email.trim()}. Mở email và bấm vào link.`);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <div className="login-wrap">
      {/* HERO (trái) */}
      <div className="login-hero">
        <HeroArt />
        <div className="login-hero-copy">
          <div className="login-brand"><i className="ph-fill ph-storefront" /> <span>ThiemCun <b>POS</b></span></div>
          <h2>Bán hàng nhẹ tênh,<br />quản lý gọn gàng.</h2>
          <p>Thu ngân, kho hàng, khách hàng, nhân viên và báo cáo doanh thu — tất cả trong một app. Miễn phí cho cửa hàng nhỏ.</p>
          <ul className="login-points">
            <li><i className="ph ph-check-circle" /> Tạo cửa hàng trong 30 giây</li>
            <li><i className="ph ph-check-circle" /> Mời nhân viên, phân quyền dễ dàng</li>
            <li><i className="ph ph-check-circle" /> Dùng trên điện thoại & máy tính</li>
          </ul>
        </div>
      </div>

      {/* FORM (phải) */}
      <div className="login-form-side">
        <div className="login-form">
          <div className="login-brand mobile-only"><i className="ph-fill ph-storefront" /> <span>ThiemCun <b>POS</b></span></div>
          <h1>POS Free cho shop nhỏ</h1>
          <p className="login-sub">
            {mode === "login"
              ? "Quản lý bán hàng, sản phẩm, nhân viên — miễn phí, dễ dùng."
              : "Tạo tài khoản free — bạn sẽ có ngay cửa hàng của riêng mình."}
          </p>

          <form onSubmit={submit}>
            {mode === "signup" && (
              <div className="field"><label className="field-label">Họ tên</label>
                <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nguyễn Văn A" /></div>
            )}
            <div className="field"><label className="field-label">Email</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="thiemnguyenba169@gmail.com" /></div>
            <div className="field"><label className="field-label">Mật khẩu</label>
              <input className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></div>

            {err && <div className="banner banner-error" style={{ marginBottom: 12 }}>⚠️ {err}</div>}
            {info && <div className="banner banner-ok" style={{ marginBottom: 12 }}>✅ {info}</div>}

            <button className="btn btn-primary login-submit" disabled={busy}>
              {busy ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : "Đăng ký miễn phí"}
            </button>
          </form>

          <div className="login-or"><span>hoặc</span></div>

          <button className="btn login-oauth" onClick={signInWithGoogle} disabled={busy}>
            <span className="g-logo"><span style={{ color: "#4285F4" }}>G</span><span style={{ color: "#EA4335" }}>o</span><span style={{ color: "#FBBC05" }}>o</span><span style={{ color: "#4285F4" }}>g</span><span style={{ color: "#34A853" }}>l</span><span style={{ color: "#EA4335" }}>e</span></span>
            Tiếp tục với Google
          </button>
          <button className="btn login-magic" onClick={magicLink} disabled={busy}>
            <i className="ph ph-envelope-simple" /> Gửi link đăng nhập qua email
          </button>

          <div className="login-switch">
            {mode === "login"
              ? <>Chưa có tài khoản? <button onClick={() => { setMode("signup"); setErr(null); setInfo(null); }}>Đăng ký miễn phí</button></>
              : <>Đã có tài khoản? <button onClick={() => { setMode("login"); setErr(null); setInfo(null); }}>Đăng nhập</button></>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Hero minh hoạ (SVG inline — không phụ thuộc ảnh ngoài, không vỡ khi offline).
function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 420 320" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="300" cy="70" r="160" fill="#ffffff" opacity="0.06" />
      <circle cx="70" cy="280" r="120" fill="#ffffff" opacity="0.05" />
      {/* mái hiên cửa hàng */}
      <rect x="96" y="120" width="228" height="20" rx="4" fill="#ffffff" opacity="0.92" />
      <path d="M96 140 h228 v14 h-228 z" fill="#ffffff" opacity="0.18" />
      {[0,1,2,3,4,5,6].map((i) => (
        <rect key={i} x={100 + i*32} y="140" width="16" height="14" fill="#ffffff" opacity={i % 2 ? 0.5 : 0.85} />
      ))}
      {/* thân cửa hàng */}
      <rect x="110" y="154" width="200" height="120" rx="6" fill="#ffffff" opacity="0.95" />
      <rect x="128" y="178" width="74" height="74" rx="6" fill="none" stroke="#008060" strokeWidth="3" opacity="0.85" />
      <rect x="222" y="178" width="70" height="74" rx="6" fill="#e7f4ef" />
      {/* cửa */}
      <rect x="234" y="196" width="46" height="56" rx="4" fill="#008060" opacity="0.9" />
      <circle cx="272" cy="226" r="3" fill="#fff" />
      {/* biển hiệu trái tim/túi */}
      <path d="M150 200 h30 v8 a15 15 0 0 1 -30 0 z" fill="#008060" opacity="0.55" />
      <rect x="150" y="196" width="30" height="6" rx="2" fill="#008060" opacity="0.8" />
      {/* hoá đơn bay ra */}
      <g opacity="0.95">
        <rect x="300" y="60" width="64" height="84" rx="6" fill="#ffffff" />
        <rect x="310" y="74" width="44" height="5" rx="2" fill="#008060" />
        <rect x="310" y="88" width="44" height="4" rx="2" fill="#c9d2cf" />
        <rect x="310" y="98" width="34" height="4" rx="2" fill="#c9d2cf" />
        <rect x="310" y="108" width="40" height="4" rx="2" fill="#c9d2cf" />
        <rect x="310" y="124" width="44" height="6" rx="2" fill="#008060" opacity="0.6" />
      </g>
    </svg>
  );
}
