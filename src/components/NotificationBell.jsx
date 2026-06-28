import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";

// Chuông thông báo: lời mời vào shop + cảnh báo tồn kho thấp.
// Lời mời có nút "Chấp nhận" -> gọi accept rồi báo cho App nạp lại danh sách shop.
export default function NotificationBell({ onAcceptedInvite }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const reload = useCallback(async () => {
    try { setItems(await api.notifications()); } catch { /* im lặng */ }
  }, []);

  useEffect(() => {
    reload();
    const t = setInterval(reload, 60000); // làm mới mỗi phút
    return () => clearInterval(t);
  }, [reload]);

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function accept(token) {
    try { const r = await api.joinByToken(token); await reload(); onAcceptedInvite?.(r?.shop_id); }
    catch (e) { alert(e.message); }
  }

  const count = items.length;
  const icon = (t) => (t === "invite" ? "ph-envelope-simple" : t === "low_stock" ? "ph-warning" : "ph-info");

  return (
    <div className="notif" ref={ref}>
      <button className="icon-btn" title="Thông báo" onClick={() => setOpen((o) => !o)}>
        <i className="ph ph-bell" />
        {count > 0 && <span className="notif-badge">{count > 9 ? "9+" : count}</span>}
      </button>

      {open && (
        <div className="notif-menu">
          <div className="notif-head">Thông báo {count > 0 && <span className="notif-count">{count}</span>}</div>
          {count === 0 && <div className="notif-empty"><i className="ph ph-check-circle" /> Không có thông báo mới</div>}
          {items.map((n, i) => (
            <div key={i} className={`notif-item ${n.type}`}>
              <i className={`ph ${icon(n.type)} notif-ico`} />
              <div className="notif-body">
                <div className="notif-title">{n.title}</div>
                <div className="notif-sub">{n.body}</div>
                {n.type === "invite" && n.token && (
                  <button className="btn btn-primary btn-xs" onClick={() => accept(n.token)}>Chấp nhận</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
