import { useMemo } from "react";
import { vnd, shortDate } from "../lib/format";

// Dashboard "Tổng quan & Báo cáo" — bám theo prototype Claude Design:
// 4 KPI card · biểu đồ doanh thu theo ngày · top sản phẩm · đơn gần đây · cảnh báo tồn.
export default function Reports({ report, orders = [], customers = [] }) {
  const stats = useMemo(() => {
    const byDay = {};
    let revenue = 0;
    for (const o of orders) {
      const d = new Date(o.created_at || Date.now());
      const key = `${d.getDate()}/${d.getMonth() + 1}`;
      byDay[key] = (byDay[key] || 0) + Number(o.total || 0);
      revenue += Number(o.total || 0);
    }
    const days = Object.entries(byDay).slice(-7);
    const avg = orders.length ? revenue / orders.length : 0;
    return { revenue, orderCount: orders.length, customerCount: customers.length, avg, days };
  }, [orders, customers]);

  if (!report) return <div className="page"><div className="loading">Đang tải báo cáo…</div></div>;

  const maxDay = Math.max(1, ...stats.days.map(([, v]) => v));
  const maxQty = Math.max(1, ...(report.top_products || []).map((t) => t.qty_sold));
  const recent = orders.slice(0, 6);

  const KPIS = [
    { label: "Doanh thu", value: vnd(report.revenue ?? stats.revenue), icon: "💰", sub: "tổng cộng" },
    { label: "Đơn hàng", value: stats.orderCount, icon: "🧾", sub: `${report.order_count ?? stats.orderCount} đơn` },
    { label: "Khách hàng", value: stats.customerCount, icon: "🧑", sub: "đang quản lý" },
    { label: "Giá trị TB/đơn", value: vnd(stats.avg), icon: "📈", sub: "trung bình" },
  ];

  return (
    <div className="page">
      <header className="page-head">
        <div><h1>Tổng quan & Báo cáo</h1><div className="muted">Tình hình kinh doanh cửa hàng</div></div>
      </header>

      <div className="kpi-row">
        {KPIS.map((k) => (
          <div className="kpi" key={k.label}>
            <div className="kpi-top"><span className="kpi-label">{k.label}</span><span className="kpi-icon">{k.icon}</span></div>
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
        <div className="card pad dash-main">
          <h2>Doanh thu theo ngày</h2>
          {stats.days.length === 0 ? <div className="empty">Chưa có dữ liệu.</div> : (
            <div className="chart">
              {stats.days.map(([day, v], i) => (
                <div className="chart-col" key={day}>
                  <div className="chart-val">{(v / 1000).toFixed(0)}k</div>
                  <div className={`chart-bar ${i === stats.days.length - 1 ? "now" : ""}`} style={{ height: `${(v / maxDay) * 140 + 8}px` }} />
                  <div className="chart-x">{day}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card pad">
          <h2>Sản phẩm bán chạy</h2>
          {(report.top_products || []).length === 0 ? <div className="empty">Chưa có dữ liệu.</div> : (
            <ul className="bars">
              {report.top_products.map((t) => (
                <li key={t.product_name}>
                  <div className="bar-head"><span>{t.product_name}</span><span className="bar-val">{t.qty_sold} đã bán</span></div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${(t.qty_sold / maxQty) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card pad dash-main">
          <h2>Đơn hàng gần đây</h2>
          <table className="data-table">
            <thead><tr><th>MÃ ĐƠN</th><th>NGÀY</th><th>TRẠNG THÁI</th><th>TỔNG</th></tr></thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id}>
                  <td className="cell-strong">#{o.id}</td>
                  <td>{shortDate(o.created_at)}</td>
                  <td><span className="pill active">{o.status === "paid" ? "Hoàn thành" : o.status}</span></td>
                  <td className="cell-strong">{vnd(o.total)}</td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td colSpan={4} className="muted">Chưa có đơn nào.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card pad">
          <h2>⚠️ Sắp hết hàng</h2>
          {(report.low_stock || []).length === 0 ? <div className="empty">Tất cả còn đủ hàng 👍</div> : (
            <ul className="low-list">
              {report.low_stock.map((p) => (
                <li key={p.id}><span>{p.name}</span><span className="pill disabled">còn {p.stock}</span></li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
