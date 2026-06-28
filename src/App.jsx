import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { authEnabled, supabase, signOut } from "./lib/supabaseClient";
import { readCache, writeCache } from "./lib/cache";
import LoginPage from "./pages/LoginPage.jsx";
import ForceChangePassword from "./pages/ForceChangePassword.jsx";
import Sales from "./pages/Sales.jsx";
import Products from "./pages/Products.jsx";
import Orders from "./pages/Orders.jsx";
import Reports from "./pages/Reports.jsx";
import Employees from "./pages/Employees.jsx";
import Customers from "./pages/Customers.jsx";
import Settings from "./pages/Settings.jsx";

// Mỗi tab: icon Phosphor + nhãn + phụ đề (hiển thị ở topbar) + vai trò được xem.
const ALL_TABS = [
  { id: "sales", label: "Bán hàng", icon: "ph-storefront", sub: "Tạo đơn nhanh tại quầy", roles: ["owner", "staff"] },
  { id: "products", label: "Sản phẩm", icon: "ph-package", sub: "Quản lý kho hàng", roles: ["owner", "staff"] },
  { id: "orders", label: "Đơn hàng", icon: "ph-receipt", sub: "Lịch sử giao dịch", roles: ["owner", "staff"] },
  { id: "customers", label: "Khách hàng", icon: "ph-users", sub: "Cơ sở dữ liệu khách", roles: ["owner", "staff"] },
  { id: "reports", label: "Báo cáo", icon: "ph-chart-pie-slice", sub: "Tình hình kinh doanh", roles: ["owner"] },
  { id: "employees", label: "Nhân viên", icon: "ph-user-circle-gear", sub: "Phân quyền & truy cập", roles: ["owner"] },
  { id: "settings", label: "Cài đặt", icon: "ph-gear", sub: "Tài khoản & cửa hàng", roles: ["owner", "staff"] },
];

const DEMO_USER = { role: "owner", email: "demo@local", full_name: "Demo", must_change_password: false };
const initial = (s) => (s || "?").trim().split(/\s+/).pop()[0]?.toUpperCase() || "?";

export default function App() {
  const [booting, setBooting] = useState(authEnabled);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(authEnabled ? null : DEMO_USER);
  const [tab, setTab] = useState("sales");
  const [collapsed, setCollapsed] = useState(false);

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

  // 3) Nạp dữ liệu (stale-while-revalidate). silent=true: đang có cache, revalidate ngầm.
  const reload = useCallback(async (role, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [p, c, o] = await Promise.all([api.listProducts(), api.listCustomers(), api.listOrders()]);
      setProducts(p); setCustomers(c); setOrders(o);
      writeCache("core", { p, c, o });
      if (role === "owner") {
        try { setReport(await api.reportSummary()); } catch { /* staff không xem được */ }
      } else { setReport(null); }
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const ready = !authEnabled || (user && !user.must_change_password);
    if (!ready) return;
    const role = authEnabled ? user.role : "owner";
    const cached = readCache("core");
    if (cached) {
      setProducts(cached.p || []); setCustomers(cached.c || []); setOrders(cached.o || []);
      setLoading(false);
      reload(role, true);
    } else {
      reload(role);
    }
  }, [user, reload]);

  // --- Màn hình chặn (chưa đăng nhập / chưa có profile / buộc đổi mật khẩu) ---
  if (booting) return <div className="full-center">Đang tải…</div>;
  if (authEnabled && !session) return <LoginPage />;
  if (authEnabled && session && !user) return <div className="full-center">Đang tải hồ sơ…</div>;
  if (authEnabled && user?.must_change_password)
    return <ForceChangePassword email={user.email} onDone={() => api.me().then(setUser)} />;

  const role = user?.role || "owner";
  const tabs = ALL_TABS.filter((t) => t.roles.includes(role));
  const active = tabs.find((t) => t.id === tab) ? tab : "sales";
  const meta = ALL_TABS.find((t) => t.id === active);
  const roleLabel = role === "owner" ? "Chủ cửa hàng" : role === "staff" ? "Nhân viên" : "Demo";

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-head">
          <div className="logo-badge"><i className="ph-fill ph-storefront" /></div>
          {!collapsed && <span className="logo-text">ThiemCun <span>POS</span></span>}
        </div>
        <nav className="nav">
          {tabs.map((t) => (
            <button key={t.id} className={`nav-item ${active === t.id ? "active" : ""}`} onClick={() => setTab(t.id)} title={t.label}>
              <i className={`ph ${t.icon}`} />
              {!collapsed && <span>{t.label}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="sidebar-user">
            <div className="avatar">{initial(user?.full_name || user?.email)}</div>
            {!collapsed && (
              <div className="info">
                <div className="name">{user?.full_name || user?.email}</div>
                <div className="role">{roleLabel}</div>
                {authEnabled && <button className="btn-signout" onClick={signOut}>Đăng xuất</button>}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main">
        <header className="topbar">
          <button className="topbar-toggle" onClick={() => setCollapsed((c) => !c)} title="Thu gọn">
            <i className="ph ph-sidebar-simple" />
          </button>
          <div className="topbar-titles">
            <h1>{meta?.label}</h1>
            <div className="sub">{meta?.sub}</div>
          </div>
          <button className="icon-btn" title="Thông báo"><i className="ph ph-bell" /><span className="dot" /></button>
        </header>

        <main className="content">
          {error && (
            <div className="page" style={{ paddingBottom: 0 }}>
              <div className="banner banner-error">⚠️ {error}<button className="btn-link" onClick={() => reload(role)}>Thử lại</button></div>
            </div>
          )}
          {loading ? <SkeletonPage /> : (
            <>
              {active === "sales" && <Sales products={products} customers={customers} report={report} onDone={() => reload(role)} />}
              {active === "products" && <Products products={products} onChanged={() => reload(role)} />}
              {active === "orders" && <Orders orders={orders} />}
              {active === "customers" && <Customers />}
              {active === "reports" && <Reports report={report} orders={orders} customers={customers} products={products} />}
              {active === "employees" && <Employees />}
              {active === "settings" && <Settings user={user || DEMO_USER} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// Skeleton loader — cảm giác load nhanh hơn (khớp layout dashboard).
function SkeletonPage() {
  return (
    <div className="page" aria-busy="true">
      <div className="sk-kpis">{[0, 1, 2, 3].map((i) => <div key={i} className="sk sk-kpi" />)}</div>
      <div className="sk sk-block" />
    </div>
  );
}
