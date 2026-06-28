import { useEffect, useState } from "react";
import { api } from "../api";

// Màn xử lý link mời: /join?token=… (khi đã đăng nhập).
export default function JoinShop({ token, onJoined, onSkip }) {
  const [info, setInfo] = useState({ loading: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.validateInvite(token)
      .then((v) => setInfo({ loading: false, ...v }))
      .catch((e) => setInfo({ loading: false, valid: false, reason: e.message }));
  }, [token]);

  async function accept() {
    setBusy(true); setErr(null);
    try { await api.joinByToken(token); onJoined(); }
    catch (e) { setErr(e.message); setBusy(false); }
  }

  return (
    <div className="onboard">
      <div className="onboard-card">
        <div className="onboard-badge"><i className="ph-fill ph-envelope-simple" /></div>
        {info.loading && <p className="onboard-sub">Đang kiểm tra lời mời…</p>}

        {!info.loading && !info.valid && (
          <>
            <h1>Lời mời không dùng được</h1>
            <p className="onboard-sub">{info.reason || "Lời mời không hợp lệ."}</p>
            <button className="btn btn-primary onboard-go" onClick={onSkip}>Về trang chủ</button>
          </>
        )}

        {!info.loading && info.valid && (
          <>
            <h1>Tham gia {info.shop_name || "cửa hàng"}</h1>
            <p className="onboard-sub">
              Bạn được mời làm <b>{info.role === "owner" ? "chủ cửa hàng" : "nhân viên"}</b>.
              Lời mời gửi tới <b>{info.invited_email}</b>.
            </p>
            {err && <div className="banner banner-error" style={{ marginBottom: 12 }}>⚠️ {err}</div>}
            <button className="btn btn-primary onboard-go" disabled={busy} onClick={accept}>
              {busy ? "Đang tham gia…" : "Tham gia cửa hàng"} <i className="ph ph-arrow-right" />
            </button>
            <button type="button" className="btn-link onboard-back" onClick={onSkip}>Bỏ qua</button>
          </>
        )}
      </div>
    </div>
  );
}
