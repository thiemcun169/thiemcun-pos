import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import Profile from "./Profile.jsx";

// Cài đặt: Tài khoản (hồ sơ + bảo mật/MFA — dùng lại Profile) + Thông tin cửa hàng (owner).
export default function Settings({ user }) {
  const isOwner = (user?.role || "owner") === "owner";
  const [tab, setTab] = useState("account");

  return (
    <div className="page">
      <header className="page-head"><div><h1>Cài đặt</h1><div className="muted">Tài khoản & cửa hàng</div></div></header>
      <div className="tabs">
        <button className={`tab ${tab === "account" ? "active" : ""}`} onClick={() => setTab("account")}>Tài khoản & Bảo mật</button>
        {isOwner && <button className={`tab ${tab === "shop" ? "active" : ""}`} onClick={() => setTab("shop")}>Thông tin cửa hàng</button>}
      </div>

      {tab === "account" && <Profile user={user} embedded />}
      {tab === "shop" && isOwner && <ShopSettings />}
    </div>
  );
}

function ShopSettings() {
  const [f, setF] = useState({ name: "", address: "", hotline: "", logo_url: "" });
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const load = useCallback(async () => {
    try { const s = await api.getShop(); setF({ name: s.name || "", address: s.address || "", hotline: s.hotline || "", logo_url: s.logo_url || "" }); }
    catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(e) {
    e.preventDefault(); setBusy(true); setErr(null); setMsg(null);
    try { await api.updateShop(f); setMsg("Đã lưu thông tin cửa hàng."); } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <div className="card pad">
      <h3>Thông tin cửa hàng</h3>
      <p className="muted">Dùng trên hoá đơn in cho khách.</p>
      <form onSubmit={save} className="auth-form">
        <label>Tên cửa hàng<input value={f.name} onChange={set("name")} /></label>
        <label>Địa chỉ<input value={f.address} onChange={set("address")} /></label>
        <div className="form-grid">
          <label>Hotline<input value={f.hotline} onChange={set("hotline")} /></label>
          <label>Logo (URL)<input value={f.logo_url} onChange={set("logo_url")} placeholder="https://…" /></label>
        </div>
        {msg && <div className="auth-info">✅ {msg}</div>}
        {err && <div className="auth-err">⚠️ {err}</div>}
        <div><button className="btn btn-primary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu thay đổi"}</button></div>
      </form>
    </div>
  );
}
