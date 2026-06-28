import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { updatePassword, listMfaFactors, enrollMfa, verifyMfa, unenrollMfa } from "../lib/supabaseClient";
import { initialOf } from "../lib/ui";
import { useToasts, Toasts } from "../components/Toasts.jsx";

// Cài đặt: 3 tab — Hồ sơ · Bảo mật & 2FA · Thông tin cửa hàng (owner).
export default function Settings({ user }) {
  const isOwner = (user?.role || "owner") === "owner";
  const [tab, setTab] = useState("profile");
  const { toasts, push, dismiss } = useToasts();

  return (
    <div className="page narrow">
      <div className="tabs">
        <button className={`tab ${tab === "profile" ? "active" : ""}`} onClick={() => setTab("profile")}>Hồ sơ</button>
        <button className={`tab ${tab === "security" ? "active" : ""}`} onClick={() => setTab("security")}>Bảo mật & 2FA</button>
        {isOwner && <button className={`tab ${tab === "shop" ? "active" : ""}`} onClick={() => setTab("shop")}>Thông tin cửa hàng</button>}
      </div>

      {tab === "profile" && <ProfileTab user={user} />}
      {tab === "security" && <SecurityTab isOwner={isOwner} push={push} />}
      {tab === "shop" && isOwner && <ShopTab push={push} />}

      <Toasts toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

// --- Tab Hồ sơ (thông tin tài khoản; email không đổi được) ---
function ProfileTab({ user }) {
  const roleLabel = user.role === "owner" ? "Chủ cửa hàng" : "Nhân viên";
  return (
    <div className="card pad">
      <div className="profile-head">
        <div className="avatar xl">{initialOf(user.full_name || user.email)}</div>
        <div><div className="pname">{user.full_name || user.email}</div><div className="prole">{roleLabel}</div></div>
      </div>
      <div className="form-grid">
        <div className="field"><label className="field-label">Họ và tên</label><input className="input" defaultValue={user.full_name || ""} disabled /></div>
        <div className="field"><label className="field-label">Vai trò</label><input className="input" defaultValue={roleLabel} disabled /></div>
        <div className="field full"><label className="field-label">Email <span className="hint">(không thể thay đổi)</span></label><input className="input" value={user.email} disabled /></div>
      </div>
    </div>
  );
}

// --- Tab Bảo mật: đổi mật khẩu + 2FA (TOTP) ---
function SecurityTab({ isOwner, push }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  async function changePw(e) {
    e.preventDefault();
    if (pw.length < 8) return push("Mật khẩu tối thiểu 8 ký tự", "error");
    if (pw !== pw2) return push("Mật khẩu nhập lại không khớp", "error");
    setBusy(true);
    try { await updatePassword(pw); setPw(""); setPw2(""); push("Đã cập nhật mật khẩu"); }
    catch (e2) { push(e2.message, "error"); } finally { setBusy(false); }
  }

  return (
    <div className="stack">
      <form className="card pad" onSubmit={changePw}>
        <div className="card-title">Đổi mật khẩu</div>
        <div className="card-sub" style={{ marginBottom: 18 }}>Nên đổi mật khẩu định kỳ để bảo mật tài khoản.</div>
        <div className="form-grid">
          <div className="field"><label className="field-label">Mật khẩu mới</label><input className="input" type="password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" /></div>
          <div className="field"><label className="field-label">Nhập lại</label><input className="input" type="password" minLength={8} value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="••••••••" /></div>
        </div>
        <div className="card-actions"><button className="btn btn-primary" disabled={busy}>{busy ? "…" : "Cập nhật mật khẩu"}</button></div>
      </form>

      <MfaCard isOwner={isOwner} push={push} />
    </div>
  );
}

function MfaCard({ isOwner, push }) {
  const [factors, setFactors] = useState([]);
  const [enroll, setEnroll] = useState(null); // {id, totp:{qr_code,secret}}
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => { try { setFactors(await listMfaFactors()); } catch { /* ignore */ } }, []);
  useEffect(() => { reload(); }, [reload]);
  const verified = factors.some((f) => f.status === "verified");

  async function start() { setBusy(true); try { setEnroll(await enrollMfa()); } catch (e) { push(e.message, "error"); } finally { setBusy(false); } }
  async function confirm() {
    setBusy(true);
    try { await verifyMfa(enroll.id, code.trim()); setEnroll(null); setCode(""); push("Đã bật 2FA"); await reload(); }
    catch (e) { push(e.message, "error"); } finally { setBusy(false); }
  }
  async function disable() {
    const f = factors.find((x) => x.status === "verified"); if (!f) return;
    setBusy(true);
    try { await unenrollMfa(f.id); push("Đã tắt 2FA", "info"); await reload(); }
    catch (e) { push(e.message, "error"); } finally { setBusy(false); }
  }
  function onToggle() { if (verified) disable(); else if (!enroll) start(); }

  return (
    <div className="card pad">
      <div className="row-between">
        <div style={{ display: "flex", gap: 14 }}>
          <div className="icon-tile"><i className="ph ph-shield-check" /></div>
          <div>
            <div className="card-title">Xác thực 2 lớp (2FA)</div>
            <div className="card-sub" style={{ maxWidth: 380, lineHeight: 1.45 }}>
              {isOwner ? "Khuyến nghị bật để bảo vệ dữ liệu tài chính." : "Thêm một lớp bảo vệ bằng mã OTP khi đăng nhập."}
              {verified ? " Đang BẬT." : " Đang TẮT."}
            </div>
          </div>
        </div>
        <button className={`toggle ${verified ? "on" : ""}`} disabled={busy} onClick={onToggle}><span className="knob" /></button>
      </div>

      {enroll && (
        <div style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
          <p style={{ fontSize: 13, margin: "0 0 8px" }}>1) Quét mã QR bằng app Authenticator (Google Authenticator, Authy…):</p>
          <img src={enroll.totp.qr_code} alt="QR 2FA" className="mfa-qr" />
          <p className="muted" style={{ fontSize: 12.5 }}>Hoặc nhập tay mã bí mật: <span className="mono">{enroll.totp.secret}</span></p>
          <p style={{ fontSize: 13, margin: "12px 0 8px" }}>2) Nhập mã 6 số từ app:</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input" style={{ maxWidth: 160 }} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" maxLength={6} />
            <button className="btn btn-primary" disabled={busy} onClick={confirm}>{busy ? "…" : "Xác nhận"}</button>
            <button className="btn" onClick={() => setEnroll(null)}>Huỷ</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Tab Thông tin cửa hàng (owner) ---
function ShopTab({ push }) {
  const [f, setF] = useState({ name: "", address: "", hotline: "", email: "", logo_url: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const load = useCallback(async () => {
    try { const s = await api.getShop(); setF({ name: s.name || "", address: s.address || "", hotline: s.hotline || "", email: s.email || "", logo_url: s.logo_url || "" }); }
    catch (e) { push(e.message, "error"); }
  }, [push]);
  useEffect(() => { load(); }, [load]);

  async function save(e) {
    e.preventDefault(); setBusy(true);
    try { await api.updateShop({ name: f.name, address: f.address, hotline: f.hotline, logo_url: f.logo_url }); push("Đã lưu thông tin cửa hàng"); }
    catch (e2) { push(e2.message, "error"); } finally { setBusy(false); }
  }

  return (
    <form className="card pad" onSubmit={save}>
      <div style={{ display: "flex", gap: 20, marginBottom: 24, alignItems: "flex-start" }}>
        <div className="icon-tile" style={{ width: 84, height: 84, borderRadius: 12, border: "1.5px dashed var(--border)", background: "transparent", flexDirection: "column", gap: 4, color: "var(--sub)" }}>
          <i className="ph ph-image" style={{ color: "var(--sub)", fontSize: 22 }} /><span style={{ fontSize: 10, fontFamily: "monospace" }}>logo</span>
        </div>
        <div style={{ flex: 1, paddingTop: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Logo cửa hàng</div>
          <div className="card-sub" style={{ lineHeight: 1.5 }}>Hiển thị trên hoá đơn. Dán URL ảnh PNG/JPG ở ô bên dưới.</div>
        </div>
      </div>
      <div className="form-grid">
        <div className="field full"><label className="field-label">Tên cửa hàng</label><input className="input" value={f.name} onChange={set("name")} /></div>
        <div className="field full"><label className="field-label">Địa chỉ</label><input className="input" value={f.address} onChange={set("address")} /></div>
        <div className="field"><label className="field-label">Hotline</label><input className="input" value={f.hotline} onChange={set("hotline")} /></div>
        <div className="field"><label className="field-label">Email liên hệ</label><input className="input" value={f.email} disabled placeholder="—" /></div>
        <div className="field full"><label className="field-label">Logo (URL)</label><input className="input" value={f.logo_url} onChange={set("logo_url")} placeholder="https://…" /></div>
      </div>
      <div className="card-actions"><button className="btn btn-primary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu thay đổi"}</button></div>
    </form>
  );
}
