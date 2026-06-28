import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { authEnabled, supabase, signOut } from "./lib/supabaseClient";
import LoginPage from "./pages/LoginPage.jsx";
import ForceChangePassword from "./pages/ForceChangePassword.jsx";
import Sales from "./pages/Sales.jsx";
import Products from "./pages/Products.jsx";
import Orders from "./pages/Orders.jsx";
import Reports from "./pages/Reports.jsx";
import Employees from "./pages/Employees.jsx";
import Profile from "./pages/Profile.jsx";

const ALL_TABS = [
  { id: "sales", label: "Bán hàng", icon: "🛒", roles: ["owner", "staff"] },
  { id: "products", label: "Sản phẩm", icon: "📦", roles: ["owner", "staff"] },
  { id: "orders", label: "Đơn hàng", icon: "🧾", roles: ["owner", "staff"] },
  { id: "reports", label: "Báo cáo", icon: "📊", roles: ["owner"] },
  { id: "employees", label: "Nhân viên", icon: "👥", roles: ["owner"] },
  { id: "profile", label: "Hồ sơ", icon: "👤", roles: ["owner", "staff"] },
];

const DEMO_USER = { role: "owner", email: "demo@local", full_name: "Demo", must_change_password: false };

export default function App() {
  const [booting, setBooting] = useState(authEnabled);     // chờ biết trạng thái phiên
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(authEnabled ? null : DEMO_USER); // profile (role…)
  const [tab, setTab] = useState("sales");

  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1) Theo dõi phiên đăng nhập
  useEffect(() => {
    if (!authEnabled || !supabase) { setBooting(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data?.session ?? null); setBooting(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => sub?.subscription?.unsubscribe();
  }, []);

  // 2) Có phiên -> nạp profile (role/status/must_change_password)
  useEffect(() => {
    if (!authEnabled) return;
    if (!session) { setUser(null); return; }
    api.me().then(setUser).catch((e) => setError(e.message));
  }, [session]);

  // 3) Nạp dữ liệu (chỉ khi đã đăng nhập, hoặc demo). Báo cáo chỉ owner.
  const reload = useCallback(async (role) => {
    setLoading(true); setError(null);
    try {
      const tasks = [api.listProducts(), api.listCustomers(), api.listOrders()];
      const [p, c, o] = await Promise.all(tasks);
      setProducts(p); setCustomers(c); setOrders(o);
      if (role === "owner") {
        try { setReport(await api.reportSummary()); } catch { /* staff không xem được */ }
      } else { setReport(null); }
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!authEnabled) { reload("owner"); return; }
    if (user && !user.must_change_password) reload(user.role);
  }, [user, reload]);

  // --- Màn hình ---
  if (booting) return <div className="full-center">Đang tải…</div>;
  if (authEnabled && !session) return <LoginPage />;
  if (authEnabled && session && !user) return <div className="full-center">Đang tải hồ sơ…</div>;
  if (authEnabled && user?.must_change_password)
    return <ForceChangePassword email={user.email} onDone={() => api.me().then(setUser)} />;

  const tabs = ALL_TABS.filter((t) => t.roles.includes(user?.role || "owner"));
  const activeTab = tabs.find((t) => t.id === tab) ? tab : "sales";

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
          {tabs.map((t) => (
            <button key={t.id} className={`nav-item ${activeTab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              <span className="nav-icon">{t.icon}</span>{t.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-box">
            <div className="user-name">{user?.email}</div>
            <div className="user-role">{user?.role === "owner" ? "Chủ shop" : user?.role === "staff" ? "Nhân viên" : "Demo"}</div>
            {authEnabled && <button className="btn-link" onClick={signOut}>Đăng xuất</button>}
          </div>
          <div className="built-by">Dựng bằng Claude Code</div>
        </div>
      </aside>

      <main className="content">
        {error && <div className="banner banner-error">⚠️ {error} <button className="btn-link" onClick={() => reload(user?.role)}>Thử lại</button></div>}
        {loading ? <div className="loading">Đang tải dữ liệu…</div> : (
          <>
            {activeTab === "sales" && <Sales products={products} customers={customers} onDone={() => reload(user?.role)} />}
            {activeTab === "products" && <Products products={products} onChanged={() => reload(user?.role)} />}
            {activeTab === "orders" && <Orders orders={orders} />}
            {activeTab === "reports" && <Reports report={report} />}
            {activeTab === "employees" && <Employees />}
            {activeTab === "profile" && <Profile user={user || DEMO_USER} />}
          </>
        )}
      </main>
    </div>
  );
}
