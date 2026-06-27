import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { authEnabled, supabase, signInWithGoogle, signOut } from "./lib/supabaseClient";
import Sales from "./pages/Sales.jsx";
import Products from "./pages/Products.jsx";
import Orders from "./pages/Orders.jsx";
import Reports from "./pages/Reports.jsx";

const TABS = [
  { id: "sales", label: "Bán hàng", icon: "🛒" },
  { id: "products", label: "Sản phẩm", icon: "📦" },
  { id: "orders", label: "Đơn hàng", icon: "🧾" },
  { id: "reports", label: "Báo cáo", icon: "📊" },
];

export default function App() {
  const [tab, setTab] = useState("sales");
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, c, o, r] = await Promise.all([
        api.listProducts(),
        api.listCustomers(),
        api.listOrders(),
        api.reportSummary(),
      ]);
      setProducts(p);
      setCustomers(c);
      setOrders(o);
      setReport(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Theo dõi phiên đăng nhập (nếu bật Auth).
  useEffect(() => {
    if (!authEnabled || !supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data?.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      reload();
    });
    return () => sub?.subscription?.unsubscribe();
  }, [reload]);

  useEffect(() => {
    // Chế độ mở: tải luôn. Chế độ Auth: tải sau khi biết trạng thái đăng nhập.
    if (!authEnabled) reload();
    else if (user) reload();
    else setLoading(false);
  }, [reload, user]);

  // Màn hình yêu cầu đăng nhập (chỉ khi bật Auth và chưa đăng nhập).
  if (authEnabled && !user) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="brand-mark">🛒</div>
          <h1>ThiemCun POS</h1>
          <p>Quản lý bán hàng cho cửa hàng nhỏ</p>
          <button className="btn btn-google" onClick={signInWithGoogle}>
            <span className="g">G</span> Đăng nhập với Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <span className="logo-mark">🛒</span>
          <div>
            <div className="logo-title">ThiemCun POS</div>
            <div className="logo-sub">Quản lý bán hàng</div>
          </div>
        </div>
        <nav>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`nav-item ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <span className="nav-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          {authEnabled && user ? (
            <div className="user-box">
              <div className="user-name">{user.email}</div>
              <button className="btn-link" onClick={signOut}>Đăng xuất</button>
            </div>
          ) : (
            <div className="demo-badge">Chế độ demo (chưa bật đăng nhập)</div>
          )}
          <div className="built-by">Dựng bằng Claude Code</div>
        </div>
      </aside>

      <main className="content">
        {error && (
          <div className="banner banner-error">
            ⚠️ {error}{" "}
            <button className="btn-link" onClick={reload}>Thử lại</button>
          </div>
        )}
        {loading ? (
          <div className="loading">Đang tải dữ liệu…</div>
        ) : (
          <>
            {tab === "sales" && (
              <Sales products={products} customers={customers} onDone={reload} />
            )}
            {tab === "products" && <Products products={products} onChanged={reload} />}
            {tab === "orders" && <Orders orders={orders} />}
            {tab === "reports" && <Reports report={report} />}
          </>
        )}
      </main>
    </div>
  );
}
