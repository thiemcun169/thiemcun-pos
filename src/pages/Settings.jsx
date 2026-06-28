import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { updatePassword, listMfaFactors, enrollMfa, verifyMfa, unenrollMfa } from "../lib/supabaseClient";
import { applyTheme } from "../lib/shop";
import { initialOf } from "../lib/ui";
import { useToasts, Toasts } from "../components/Toasts.jsx";

// Cài đặt: Hồ sơ · Bảo mật & 2FA · Cửa hàng (owner) · Dữ liệu (owner).
export default function Settings({ role, user, shop, onShopUpdated }) {
  const isOwner = role === "owner";
  const [tab, setTab] = useState("profile");
  const { toasts, push, dismiss } = useToasts();

  return (
    <div className="page narrow">
      <div className="tabs">
        <button className={`tab ${tab === "profile" ? "active" : ""}`} onClick={() => setTab("profile")}>Hồ sơ</button>
        <button className={`tab ${tab === "security" ? "active" : ""}`} onClick={() => setTab("security")}>Bảo mật & 2FA</button>
        {isOwner && <button className={`tab ${tab === "shop" ? "active" : ""}`} onClick={() => setTab("shop")}>Cửa hàng</button>}
        {isOwner && <button className={`tab ${tab === "data" ? "active" : ""}`} onClick={() => setTab("data")}>Dữ liệu</button>}
      </div>

      {tab === "profile" && <ProfileTab user={user} role={role} />}
      {tab === "security" && <SecurityTab isOwner={isOwner} push={push} />}
      {tab === "shop" && isOwner && <ShopTab push={push} onShopUpdated={onShopUpdated} />}
      {tab === "data" && isOwner && <DataTab push={push} onShopUpdated={onShopUpdated} />}

      <Toasts toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

// --- Hồ sơ ---
function ProfileTab({ user, role }) {
  const roleLabel = role === "owner" ? "Chủ cửa hàng" : "Nhân viên";
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

// --- Bảo mật: đổi mật khẩu + 2FA ---
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
        <div className="card-sub" style={{ marginBottom: 18 }}>Đặt/đổi mật khẩu (nếu bạn đăng nhập bằng Google hoặc magic link, đây là cách thêm mật khẩu).</div>
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
  const [enroll, setEnroll] = useState(null);
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
          <p style={{ fontSize: 13, margin: "0 0 8px" }}>1) Quét mã QR bằng app Authenticator:</p>
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

// --- Cửa hàng: tên, màu thương hiệu, logo, địa chỉ, hotline ---
function ShopTab({ push, onShopUpdated }) {
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const load = useCallback(async () => {
    try {
      const s = await api.getShop();
      setF({
        name: s.name || "", color_primary: s.color_primary || "#008060", color_secondary: s.color_secondary || "#004c3f",
        logo_url: s.logo_url || "", address: s.address || "", hotline: s.hotline || "",
      });
    } catch (e) { push(e.message, "error"); }
  }, [push]);
  useEffect(() => { load(); }, [load]);

  // Xem trước màu ngay khi chỉnh.
  useEffect(() => { if (f) applyTheme({ color_primary: f.color_primary, color_secondary: f.color_secondary }); }, [f?.color_primary, f?.color_secondary]); // eslint-disable-line

  async function save(e) {
    e.preventDefault(); setBusy(true);
    try {
      await api.updateShop(f);
      push("Đã lưu thông tin cửa hàng");
      onShopUpdated?.();
    } catch (e2) { push(e2.message, "error"); } finally { setBusy(false); }
  }

  if (!f) return <div className="card pad">Đang tải…</div>;
  return (
    <form className="card pad" onSubmit={save}>
      <div className="card-title" style={{ marginBottom: 16 }}>Thương hiệu cửa hàng</div>
      <div className="form-grid">
        <div className="field full"><label className="field-label">Tên cửa hàng</label><input className="input" value={f.name} onChange={set("name")} maxLength={80} /></div>
        <div className="field"><label className="field-label">Màu chính</label>
          <div className="color-row"><input type="color" className="color-input" value={f.color_primary} onChange={set("color_primary")} /><input className="input" value={f.color_primary} onChange={set("color_primary")} /></div>
        </div>
        <div className="field"><label className="field-label">Màu phụ (đậm)</label>
          <div className="color-row"><input type="color" className="color-input" value={f.color_secondary} onChange={set("color_secondary")} /><input className="input" value={f.color_secondary} onChange={set("color_secondary")} /></div>
        </div>
        <div className="field full"><label className="field-label">Logo (URL ảnh)</label><input className="input" value={f.logo_url} onChange={set("logo_url")} placeholder="https://…" /></div>
        <div className="field full"><label className="field-label">Địa chỉ</label><input className="input" value={f.address} onChange={set("address")} /></div>
        <div className="field"><label className="field-label">Hotline</label><input className="input" value={f.hotline} onChange={set("hotline")} /></div>
      </div>
      <div className="card-actions"><button className="btn btn-primary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu thay đổi"}</button></div>
    </form>
  );
}

// --- Dữ liệu: xoá sạch / nạp lại dữ liệu mẫu (owner) ---
function DataTab({ push, onShopUpdated }) {
  const [confirm, setConfirm] = useState(null); // 'clear' | 'reseed'
  const [busy, setBusy] = useState(false);

  async function doClear() {
    setBusy(true);
    try { await api.clearShopData(); push("Đã xoá toàn bộ dữ liệu bán hàng", "info"); setConfirm(null); onShopUpdated?.(); }
    catch (e) { push(e.message, "error"); } finally { setBusy(false); }
  }
  async function doReseed() {
    setBusy(true);
    try { await api.reseedShop(); push("Đã nạp lại dữ liệu mẫu"); setConfirm(null); onShopUpdated?.(); }
    catch (e) { push(e.message, "error"); } finally { setBusy(false); }
  }

  return (
    <div className="stack">
      <div className="card pad">
        <div className="card-title">Nạp lại dữ liệu mẫu</div>
        <div className="card-sub" style={{ marginBottom: 14 }}>Xoá dữ liệu hiện tại và thêm bộ sản phẩm + khách hàng mẫu để dùng thử.</div>
        {confirm === "reseed"
          ? <div className="confirm-box"><span>Xoá dữ liệu hiện tại và nạp mẫu?</span><button className="btn btn-primary" disabled={busy} onClick={doReseed}>{busy ? "…" : "Nạp mẫu"}</button><button className="btn" onClick={() => setConfirm(null)}>Huỷ</button></div>
          : <button className="btn" onClick={() => setConfirm("reseed")}><i className="ph ph-flask" /> Nạp dữ liệu mẫu</button>}
      </div>

      <div className="card pad danger-zone">
        <div className="card-title" style={{ color: "var(--danger)" }}>Vùng nguy hiểm</div>
        <div className="card-sub" style={{ marginBottom: 14 }}>Xoá sạch toàn bộ sản phẩm, đơn hàng, khách hàng của cửa hàng này. Không thể hoàn tác.</div>
        {confirm === "clear"
          ? <div className="confirm-box"><span style={{ color: "var(--danger)" }}>Chắc chắn xoá hết? Hành động không thể hoàn tác.</span><button className="btn btn-danger" disabled={busy} onClick={doClear}>{busy ? "…" : "Xoá hết"}</button><button className="btn" onClick={() => setConfirm(null)}>Huỷ</button></div>
          : <button className="btn btn-danger-outline" onClick={() => setConfirm("clear")}><i className="ph ph-trash" /> Xoá toàn bộ dữ liệu</button>}
      </div>
    </div>
  );
}
