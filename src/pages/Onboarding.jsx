import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

// Onboarding wizard cho user CHƯA thuộc cửa hàng nào.
// Bước 1: chọn vai trò (Chủ shop / Nhân viên). Bước 2A: tạo shop. Bước 2B: nhận lời mời.
export default function Onboarding({ defaultName, onCreated, onJoined }) {
  const [step, setStep] = useState("choose"); // choose | owner | staff

  return (
    <div className="onboard">
      <div className="onboard-card wide">
        <div className="onboard-badge"><i className="ph-fill ph-storefront" /></div>
        {step === "choose" && <ChooseRole onPick={setStep} />}
        {step === "owner" && <OwnerForm defaultName={defaultName} onCreated={onCreated} onBack={() => setStep("choose")} />}
        {step === "staff" && <StaffJoin onJoined={onJoined} onBack={() => setStep("choose")} />}
      </div>
    </div>
  );
}

function ChooseRole({ onPick }) {
  return (
    <>
      <h1>Chào mừng! Bạn là ai?</h1>
      <p className="onboard-sub">Chọn vai trò để bắt đầu. (Mỗi tài khoản thuộc 1 cửa hàng tại một thời điểm.)</p>
      <div className="role-cards">
        <button className="role-card" onClick={() => onPick("owner")}>
          <i className="ph-fill ph-storefront" />
          <div className="role-card-title">Tôi là chủ shop</div>
          <div className="role-card-sub">Tạo cửa hàng mới, quản lý sản phẩm, đơn hàng, nhân viên.</div>
        </button>
        <button className="role-card" onClick={() => onPick("staff")}>
          <i className="ph-fill ph-users" />
          <div className="role-card-title">Tôi là nhân viên</div>
          <div className="role-card-sub">Tham gia cửa hàng của người khác (cần được mời).</div>
        </button>
      </div>
    </>
  );
}

function OwnerForm({ defaultName, onCreated, onBack }) {
  const [name, setName] = useState(defaultName || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setErr(null);
    try { onCreated(await api.createShop(name.trim())); }
    catch (e2) { setErr(e2.message); setBusy(false); }
  }
  return (
    <>
      <h1>Tạo cửa hàng của bạn</h1>
      <p className="onboard-sub">Đặt tên cửa hàng để bắt đầu. Màu sắc, logo, địa chỉ chỉnh sau trong Cài đặt.</p>
      <form onSubmit={submit}>
        <input className="input" autoFocus placeholder="VD: Tạp hoá Cô Ba" value={name}
               onChange={(e) => setName(e.target.value)} maxLength={80} />
        {err && <div className="banner banner-error" style={{ marginTop: 12 }}>⚠️ {err}</div>}
        <button className="btn btn-primary onboard-go" disabled={busy || !name.trim()}>
          {busy ? "Đang tạo…" : "Tạo cửa hàng"} <i className="ph ph-arrow-right" />
        </button>
      </form>
      <button type="button" className="btn-link onboard-back" onClick={onBack}><i className="ph ph-arrow-left" /> Quay lại</button>
    </>
  );
}

function StaffJoin({ onJoined, onBack }) {
  const [invites, setInvites] = useState([]);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    try { setInvites(await api.myInvites()); } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function join(tk) {
    if (!tk) return setErr("Nhập mã mời hoặc dán link.");
    setBusy(true); setErr(null); setMsg(null);
    // Cho dán cả link đầy đủ: tách token sau ?token=
    const t = tk.includes("token=") ? tk.split("token=")[1].split("&")[0] : tk.trim();
    try { await api.joinByToken(t); onJoined(); }
    catch (e) { setErr(e.message); setBusy(false); }
  }

  return (
    <>
      <h1>Tham gia cửa hàng</h1>
      <p className="onboard-sub">Chủ shop mời bạn qua email + gửi link tham gia. Bấm vào lời mời hoặc dán mã/link bên dưới.</p>

      {invites.length > 0 && (
        <div className="invite-list">
          {invites.map((i) => (
            <div key={i.id} className="invite-row">
              <div><b>{i.shop_name || "Cửa hàng"}</b><div className="muted" style={{ fontSize: 12.5 }}>Vai trò: {i.role === "owner" ? "Chủ" : "Nhân viên"}</div></div>
              <button className="btn btn-primary btn-xs" disabled={busy} onClick={() => join(i.invite_token)}>Tham gia</button>
            </div>
          ))}
        </div>
      )}
      {invites.length === 0 && <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>Chưa có lời mời nào gửi tới email của bạn. Dán mã/link mời nếu có:</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input className="input" placeholder="Dán mã mời hoặc link /join?token=…" value={token} onChange={(e) => setToken(e.target.value)} />
        <button className="btn btn-primary" disabled={busy} onClick={() => join(token)}>Tham gia</button>
      </div>
      {err && <div className="banner banner-error" style={{ marginTop: 12 }}>⚠️ {err}</div>}
      {msg && <div className="banner banner-ok" style={{ marginTop: 12 }}>✅ {msg}</div>}
      <button type="button" className="btn-link onboard-back" onClick={onBack}><i className="ph ph-arrow-left" /> Quay lại</button>
    </>
  );
}
