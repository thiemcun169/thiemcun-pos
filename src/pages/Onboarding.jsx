import { useState } from "react";
import { api } from "../api";

// Màn chào mừng cho người dùng MỚI chưa có cửa hàng nào.
// (Thường trigger DB tự tạo shop khi đăng ký; màn này là phương án dự phòng + tạo thêm shop.)
export default function Onboarding({ defaultName, onCreated, onCancel }) {
  const [name, setName] = useState(defaultName || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setErr(null);
    try {
      const shop = await api.createShop(name.trim());
      onCreated(shop);
    } catch (e2) { setErr(e2.message); setBusy(false); }
  }

  return (
    <div className="onboard">
      <form className="onboard-card" onSubmit={submit}>
        <div className="onboard-badge"><i className="ph-fill ph-storefront" /></div>
        <h1>Tạo cửa hàng của bạn</h1>
        <p className="onboard-sub">Đặt tên cho cửa hàng để bắt đầu bán hàng. Bạn có thể đổi tên, màu sắc, logo bất cứ lúc nào trong Cài đặt.</p>
        <input className="input" autoFocus placeholder="VD: Tạp hoá Cô Ba" value={name}
               onChange={(e) => setName(e.target.value)} maxLength={80} />
        {err && <div className="banner banner-error" style={{ marginTop: 12 }}>⚠️ {err}</div>}
        <button className="btn btn-primary onboard-go" disabled={busy || !name.trim()}>
          {busy ? "Đang tạo…" : "Tạo cửa hàng"} <i className="ph ph-arrow-right" />
        </button>
        {onCancel && <button type="button" className="btn-link" style={{ marginTop: 12 }} onClick={onCancel}>Huỷ</button>}
      </form>
    </div>
  );
}
