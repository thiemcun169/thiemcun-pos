import { useEffect, useRef, useState } from "react";

// Bộ chuyển cửa hàng (header). Hiện shop đang chọn + danh sách shop user là thành viên.
export default function ShopSwitcher({ shops, activeShopId, onSwitch, onCreateShop }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = shops.find((s) => String(s.id) === String(activeShopId)) || shops[0];

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!active) return null;
  const dot = (c) => ({ width: 10, height: 10, borderRadius: 3, flexShrink: 0, background: c || "var(--accent)" });

  return (
    <div className="shop-switcher" ref={ref}>
      <button className="shop-switcher-btn" onClick={() => setOpen((o) => !o)} title="Đổi cửa hàng">
        <span style={dot(active.color_primary)} />
        <span className="ss-name">{active.name}</span>
        <i className="ph ph-caret-down" style={{ fontSize: 13, color: "var(--sub)" }} />
      </button>

      {open && (
        <div className="shop-switcher-menu">
          <div className="ss-label">Cửa hàng của bạn</div>
          {shops.map((s) => (
            <button key={s.id} className={`ss-item ${String(s.id) === String(activeShopId) ? "active" : ""}`}
              onClick={() => { onSwitch(s.id); setOpen(false); }}>
              <span style={dot(s.color_primary)} />
              <span className="ss-item-name">{s.name}</span>
              <span className="ss-role">{s.my_role === "owner" ? "Chủ" : "NV"}</span>
              {String(s.id) === String(activeShopId) && <i className="ph ph-check" style={{ color: "var(--accent)" }} />}
            </button>
          ))}
          <div className="ss-divider" />
          <button className="ss-item ss-new" onClick={() => { setOpen(false); onCreateShop(); }}>
            <i className="ph ph-plus-circle" /> <span>Tạo cửa hàng mới</span>
          </button>
        </div>
      )}
    </div>
  );
}
