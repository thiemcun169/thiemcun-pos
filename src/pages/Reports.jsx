import { useMemo } from "react";
import { vnd, shortDate } from "../lib/format";

function statusPill(status) {
  const s = (status || "").toLowerCase();
  if (s === "paid" || s === "completed" || s === "hoàn thành") return { label: "Hoàn thành", cls: "success" };
  if (s === "pending" || s === "đang xử lý") return { label: "Đang xử lý", cls: "warn" };
  if (s === "cancelled" || s === "canceled" || s === "đã huỷ") return { label: "Đã huỷ", cls: "danger" };
  return { label: status || "Hoàn thành", cls: "success" };
}
const k = (n) => Math.round((Number(n) || 0) / 1000) + "k";

// Dashboard "Tổng quan & Báo cáo" — KPI · biểu đồ doanh thu/ngày · top sản phẩm · đơn gần đây · tồn thấp.
export default function Reports({ report, orders = [], customers = [], products = [] }) {
  const days = useMemo(() => {
    const byDay = {};
    for (const o of orders) {
      const d = new Date(o.created_at || Date.now());
      const key = `${d.getDate()}/${d.getMonth() + 1}`;
      byDay[key] = (byDay[key] || 0) + Number(o.total || 0);
    }
    return Object.entries(byDay).slice(-7);
  }, [orders]);

  if (!report) return <div className="page"><div className="empty">Đang tải báo cáo…</div></div>;

  const revenue = report.revenue ?? orders.reduce((a, o) => a + Number(o.total || 0), 0);
  const orderCount = report.order_count ?? orders.length;
  const avg = orderCount ? Math.round(revenue / orderCount) : 0;
  const maxDay = Math.max(1, ...days.map(([, v]) => v));
  const top = report.top_products || [];
  const maxRev = Math.max(1, ...top.map((t) => t.revenue || t.qty_sold));
  const recent = orders.slice(0, 5);
  const low = report.low_stock || [];

  const KPIS = [
    { label: "Doanh thu", value: vnd(revenue), icon: "ph-currency-circle-dollar" },
    { label: "Đơn hàng", value: String(orderCount), icon: "ph-receipt" },
    { label: "Khách hàng", value: String(customers.length), icon: "ph-users" },
    { label: "Giá trị TB/đơn", value: vnd(avg), icon: "ph-chart-line-up" },
  ];

  return (
    <div className="page">
      <div className="kpi-grid">
        {KPIS.map((kp) => (
          <div className="kpi" key={kp.label}>
            <div className="kpi-top"><span className="kpi-label">{kp.label}</span><span className="kpi-icon"><i className={`ph ${kp.icon}`} /></span></div>
            <div className="kpi-value">{kp.value}</div>
            <div className="kpi-delta up"><i className="ph ph-trend-up" /> {products.length} SP <span className="since">đang kinh doanh</span></div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
        {/* Biểu đồ doanh thu */}
        <div className="card pad">
          <div style={{ marginBottom: 24 }}><div className="card-title">Doanh thu</div><div className="card-sub">Theo ngày (gần đây)</div></div>
          {days.length === 0 ? <div className="empty">Chưa có dữ liệu.</div> : (
            <div className="chart">
              {days.map(([day, v], i) => (
                <div className="chart-col" key={day}>
                  <span className="v">{k(v)}</span>
                  <div className={`bar ${i === days.length - 1 ? "now" : ""}`} style={{ height: `${(v / maxDay) * 100}%` }} />
                  <span className="x">{day}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top sản phẩm */}
        <div className="card pad">
          <div style={{ marginBottom: 18 }}><div className="card-title">Sản phẩm bán chạy</div><div className="card-sub">Theo doanh thu</div></div>
          {top.length === 0 ? <div className="empty">Chưa có dữ liệu.</div> : (
            <div className="bars">
              {top.map((t) => (
                <div className="bar-row" key={t.product_name}>
                  <div className="bar-head"><span className="bar-name">{t.product_name}</span><span className="bar-meta">{t.qty_sold} đã bán</span></div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${((t.revenue || t.qty_sold) / maxRev) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="dash-grid">
        {/* Đơn hàng gần đây */}
        <div className="card">
          <div className="card-head"><span className="card-title">Đơn hàng gần đây</span></div>
          <table className="data-table">
            <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Trạng thái</th><th className="r">Tổng</th></tr></thead>
            <tbody>
              {recent.map((o) => {
                const sp = statusPill(o.status);
                return (
                  <tr key={o.id}>
                    <td className="cell-strong">#{o.id}</td>
                    <td>{o.customer_name || "Khách lẻ"}</td>
                    <td><span className={`pill ${sp.cls}`}>{sp.label}</span></td>
                    <td className="r cell-strong">{vnd(o.total)}</td>
                  </tr>
                );
              })}
              {recent.length === 0 && <tr><td colSpan={4} className="empty">Chưa có đơn nào.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Sắp hết hàng */}
        <div className="card pad">
          <div style={{ marginBottom: 18 }}><div className="card-title">Sắp hết hàng</div><div className="card-sub">Cần nhập thêm</div></div>
          {low.length === 0 ? <div className="empty">Tất cả còn đủ hàng 👍</div> : (
            <ul className="low-list">
              {low.map((p) => (
                <li key={p.id}><span>{p.name}</span><span className="pill stock low">còn {p.stock}</span></li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
