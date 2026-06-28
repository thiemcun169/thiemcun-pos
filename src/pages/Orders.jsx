import { useState } from "react";
import { vnd, shortDate } from "../lib/format";

// Nhãn + màu trạng thái đơn.
function statusPill(status) {
  const s = (status || "").toLowerCase();
  if (s === "paid" || s === "completed" || s === "hoàn thành") return { label: "Hoàn thành", cls: "success" };
  if (s === "pending" || s === "đang xử lý") return { label: "Đang xử lý", cls: "warn" };
  if (s === "cancelled" || s === "canceled" || s === "đã huỷ") return { label: "Đã huỷ", cls: "danger" };
  return { label: status || "Hoàn thành", cls: "success" };
}

// Màn Đơn hàng: bảng + chi tiết (drawer).
export default function Orders({ orders }) {
  const [detail, setDetail] = useState(null);

  if (!orders || orders.length === 0) {
    return (
      <div className="page">
        <div className="card"><div className="empty">Chưa có đơn hàng nào. Sang màn "Bán hàng" để tạo đơn đầu tiên.</div></div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card">
        <table className="data-table">
          <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Sản phẩm</th><th>Thời gian</th><th>Trạng thái</th><th className="r">Tổng</th></tr></thead>
          <tbody>
            {orders.map((o) => {
              const sp = statusPill(o.status);
              const itemCount = (o.items || []).reduce((a, i) => a + (i.qty || 0), 0);
              return (
                <tr key={o.id} className="clickable" onClick={() => setDetail(o)}>
                  <td className="cell-accent">#{o.id}</td>
                  <td>{o.customer_name || "Khách lẻ"}</td>
                  <td className="muted">{itemCount} sản phẩm</td>
                  <td className="muted">{shortDate(o.created_at)}</td>
                  <td><span className={`pill ${sp.cls}`}>{sp.label}</span></td>
                  <td className="r cell-strong">{vnd(o.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {detail && <OrderDrawer order={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function OrderDrawer({ order, onClose }) {
  const sp = statusPill(order.status);
  const items = order.items || [];
  const subtotal = items.reduce((a, i) => a + (i.line_total || 0), 0);
  return (
    <div className="drawer-overlay">
      <div className="scrim" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <div><div className="title">#{order.id}</div><div className="sub">{shortDate(order.created_at)}</div></div>
          <button className="modal-x" onClick={onClose}><i className="ph ph-x" /></button>
        </div>
        <div className="drawer-body">
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <span className={`pill ${sp.cls}`}>{sp.label}</span>
            {order.customer_name && <span className="pill neutral">{order.customer_name}</span>}
          </div>
          <div className="section-label">Chi tiết sản phẩm</div>
          <div className="drawer-items">
            {items.map((i) => (
              <div className="drawer-item" key={i.id}>
                <div><div className="di-name">{i.product_name}</div><div className="di-meta">{vnd(i.price ?? (i.line_total / (i.qty || 1)))} × {i.qty}</div></div>
                <span className="cell-strong">{vnd(i.line_total)}</span>
              </div>
            ))}
            {items.length === 0 && <div className="empty">Không có dòng hàng.</div>}
          </div>
          <div className="drawer-totals">
            <div className="sum-row"><span>Tạm tính</span><span>{vnd(subtotal)}</span></div>
            <div className="sum-total" style={{ fontSize: 17 }}><span>Tổng cộng</span><span>{vnd(order.total)}</span></div>
          </div>
        </div>
        <div className="drawer-foot">
          <button className="btn btn-block" onClick={() => window.print()}><i className="ph ph-printer" /> In hoá đơn</button>
        </div>
      </div>
    </div>
  );
}
