import { vnd } from "../lib/format";

// Màn Báo cáo: số liệu tổng quan + top sản phẩm + cảnh báo sắp hết hàng.
export default function Reports({ report }) {
  if (!report) return <div className="page"><div className="loading">Đang tải báo cáo…</div></div>;

  const maxQty = Math.max(1, ...(report.top_products || []).map((t) => t.qty_sold));

  return (
    <div className="page">
      <header className="page-head"><h1>Báo cáo</h1></header>

      <div className="kpi-row">
        <div className="kpi">
          <div className="kpi-label">Doanh thu</div>
          <div className="kpi-value">{vnd(report.revenue)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Số đơn</div>
          <div className="kpi-value">{report.order_count}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Mặt hàng</div>
          <div className="kpi-value">{report.product_count}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Sắp hết hàng</div>
          <div className="kpi-value">{(report.low_stock || []).length}</div>
        </div>
      </div>

      <div className="report-grid">
        <div className="card">
          <h2>Top sản phẩm bán chạy</h2>
          {(report.top_products || []).length === 0 ? (
            <div className="empty">Chưa có dữ liệu bán hàng.</div>
          ) : (
            <ul className="bars">
              {report.top_products.map((t) => (
                <li key={t.product_name}>
                  <div className="bar-head">
                    <span>{t.product_name}</span>
                    <span className="bar-val">{t.qty_sold} sp · {vnd(t.revenue)}</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(t.qty_sold / maxQty) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2>⚠️ Sắp hết hàng (≤ 5)</h2>
          {(report.low_stock || []).length === 0 ? (
            <div className="empty">Tất cả sản phẩm còn đủ hàng. 👍</div>
          ) : (
            <ul className="low-list">
              {report.low_stock.map((p) => (
                <li key={p.id}>
                  <span>{p.name}</span>
                  <span className="pill pill-warn">còn {p.stock}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
