import { Fragment, useState } from "react";
import { vnd, shortDate } from "../lib/format";

// Màn Đơn hàng: danh sách đơn gần đây, bấm để xem chi tiết các dòng.
export default function Orders({ orders }) {
  const [openId, setOpenId] = useState(null);

  if (!orders || orders.length === 0) {
    return (
      <div className="page">
        <header className="page-head"><h1>Đơn hàng</h1></header>
        <div className="card empty">Chưa có đơn hàng nào. Sang màn "Bán hàng" để tạo đơn đầu tiên.</div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head"><h1>Đơn hàng</h1></header>
      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Mã đơn</th><th>Thời gian</th><th>Số mặt hàng</th><th>Tổng tiền</th><th></th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <Fragment key={o.id}>
                <tr className="clickable" onClick={() => setOpenId(openId === o.id ? null : o.id)}>
                  <td className="cell-strong">#{o.id}</td>
                  <td>{shortDate(o.created_at)}</td>
                  <td>{(o.items || []).length}</td>
                  <td className="cell-strong">{vnd(o.total)}</td>
                  <td>{openId === o.id ? "▲" : "▼"}</td>
                </tr>
                {openId === o.id && (
                  <tr className="detail-row">
                    <td colSpan={5}>
                      <ul className="order-items">
                        {(o.items || []).map((it) => (
                          <li key={it.id}>
                            <span>{it.product_name} × {it.qty}</span>
                            <span>{vnd(it.line_total)}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
