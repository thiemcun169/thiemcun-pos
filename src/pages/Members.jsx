import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { shortDate } from "../lib/format";
import { initialOf } from "../lib/ui";
import { useToasts, Toasts } from "../components/Toasts.jsx";

// Nhân viên cửa hàng (CHỈ owner): mời theo email, đổi vai trò, bật/tắt, gỡ.
const linkFor = (token) => `${window.location.origin}/join?token=${token}`;

export default function Members() {
  const [members, setMembers] = useState([]);
  const [invite, setInvite] = useState(null); // {email, role}
  const [busy, setBusy] = useState(false);
  const [lastLink, setLastLink] = useState(null); // link mời vừa tạo (để owner copy gửi NV)
  const { toasts, push, dismiss } = useToasts();

  const reload = useCallback(async () => {
    try { setMembers((await api.listMembers()).members || []); } catch (e) { push(e.message, "error"); }
  }, [push]);
  useEffect(() => { reload(); }, [reload]);

  const active = members.filter((m) => m.user_id && m.status === "active");
  const pending = members.filter((m) => !m.user_id && m.status === "pending_invite");

  function copy(text) {
    navigator.clipboard?.writeText(text).then(() => push("Đã copy link mời"), () => push("Không copy được — hãy chọn & copy thủ công", "error"));
  }

  async function sendInvite(e) {
    e.preventDefault(); setBusy(true);
    try {
      const r = await api.inviteMember({ email: invite.email.trim().toLowerCase(), role: invite.role });
      const url = window.location.origin + (r.join_path || `/join?token=${r.invite_token}`);
      setLastLink({ email: invite.email.trim(), url });
      push(`Đã tạo lời mời cho ${invite.email.trim()}`); setInvite(null); await reload();
    } catch (e2) { push(e2.message, "error"); } finally { setBusy(false); }
  }
  async function patch(id, body) {
    try { await api.updateMember(id, body); await reload(); } catch (e) { push(e.message, "error"); }
  }
  async function remove(id) {
    try { await api.removeMember(id); push("Đã gỡ thành viên", "info"); await reload(); } catch (e) { push(e.message, "error"); }
  }

  return (
    <div className="page">
      <div className="toolbar end">
        <button className="btn btn-primary" onClick={() => setInvite({ email: "", role: "staff" })}>
          <i className="ph ph-paper-plane-tilt" /> Mời nhân viên
        </button>
      </div>

      {lastLink && (
        <div className="card pad invite-link-box">
          <div className="card-title"><i className="ph ph-link-simple" /> Link mời {lastLink.email}</div>
          <div className="card-sub" style={{ margin: "4px 0 10px" }}>Chưa gửi email tự động — copy link này gửi cho nhân viên (Zalo/SMS…). Hết hạn sau 7 ngày.</div>
          <div className="invite-link-row">
            <input className="input" readOnly value={lastLink.url} onFocus={(e) => e.target.select()} />
            <button className="btn btn-primary" onClick={() => copy(lastLink.url)}><i className="ph ph-copy" /> Copy</button>
            <button className="btn" onClick={() => setLastLink(null)}>Đóng</button>
          </div>
        </div>
      )}

      <div className="card">
        <table className="data-table">
          <thead><tr><th>Thành viên</th><th>Vai trò</th><th>Trạng thái</th><th className="r">Thao tác</th></tr></thead>
          <tbody>
            {active.map((m) => {
              const owner = m.role === "owner";
              const activeS = m.status === "active";
              const label = m.full_name || m.email || m.invited_email;
              return (
                <tr key={m.id}>
                  <td><div className="name-cell"><div className="avatar sm">{initialOf(label)}</div>
                    <div><div className="cell-strong">{m.full_name || "—"}</div><div className="cell-sub">{m.email || m.invited_email}</div></div></div></td>
                  <td>
                    <select className="select" style={{ height: 34, width: "auto" }} value={m.role} onChange={(e) => patch(m.id, { role: e.target.value })}>
                      <option value="staff">Nhân viên</option>
                      <option value="owner">Chủ cửa hàng</option>
                    </select>
                  </td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: activeS ? "var(--accent)" : "var(--sub)" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: activeS ? "var(--accent)" : "var(--sub)" }} />{activeS ? "Đang hoạt động" : "Đã khoá"}
                    </span>
                  </td>
                  <td className="r" style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                    {!owner && (
                      <button className={`toggle ${activeS ? "on" : ""}`} style={{ width: 44, height: 24 }} title={activeS ? "Khoá" : "Mở khoá"}
                        onClick={() => patch(m.id, { status: activeS ? "disabled" : "active" })}>
                        <span className="knob" style={{ width: 18, height: 18, left: activeS ? 23 : 3 }} />
                      </button>
                    )}
                    {!owner && <button className="btn-link" style={{ color: "var(--danger)" }} onClick={() => remove(m.id)}>Gỡ</button>}
                    {owner && <span className="muted" style={{ fontSize: 12 }}><i className="ph ph-lock-simple" /> Chủ shop</span>}
                  </td>
                </tr>
              );
            })}
            {active.length === 0 && <tr><td colSpan={4} className="empty">Chưa có thành viên.</td></tr>}
          </tbody>
        </table>
      </div>

      {pending.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-head"><span className="card-title">Đã mời (chờ nhận)</span></div>
          <table className="data-table">
            <thead><tr><th>Email</th><th>Vai trò</th><th>Mời lúc</th><th className="r">Thao tác</th></tr></thead>
            <tbody>
              {pending.map((m) => (
                <tr key={m.id}>
                  <td>{m.invited_email}</td><td>{m.role === "owner" ? "Chủ cửa hàng" : "Nhân viên"}</td><td className="muted">{shortDate(m.created_at)}</td>
                  <td className="r" style={{ whiteSpace: "nowrap" }}>
                    {m.invite_token && <button className="btn-link" onClick={() => copy(linkFor(m.invite_token))}>Copy link</button>}
                    <button className="btn-link" style={{ color: "var(--danger)", marginLeft: 12 }} onClick={() => remove(m.id)}>Thu hồi</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {invite && (
        <div className="modal-overlay">
          <div className="scrim" onClick={() => setInvite(null)} />
          <form className="modal sm" onSubmit={sendInvite}>
            <div className="modal-head"><span className="title">Mời nhân viên</span>
              <button type="button" className="modal-x" onClick={() => setInvite(null)}><i className="ph ph-x" /></button>
            </div>
            <div className="modal-body form-cols">
              <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>Nhân viên đăng nhập bằng Google, email/mật khẩu hoặc magic link. Khi vào đúng email được mời sẽ tự tham gia cửa hàng này.</p>
              <div className="field"><label className="field-label">Email</label><input className="input" type="email" required value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="nhanvien@email.com" /></div>
              <div className="field"><label className="field-label">Vai trò</label>
                <select className="select" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
                  <option value="staff">Nhân viên (POS)</option>
                  <option value="owner">Chủ cửa hàng (toàn quyền)</option>
                </select>
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => setInvite(null)}>Huỷ</button>
              <button className="btn btn-primary" disabled={busy}><i className="ph ph-paper-plane-tilt" /> {busy ? "…" : "Gửi lời mời"}</button>
            </div>
          </form>
        </div>
      )}
      <Toasts toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
