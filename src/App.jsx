import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { authEnabled, supabase, signOut as supaSignOut } from "./lib/supabaseClient";
import { getActiveShopId, setActiveShopId, applyTheme } from "./lib/shop";
import { readCache, writeCache } from "./lib/cache";
import LoginPage from "./pages/LoginPage.jsx";
import Onboarding from "./pages/Onboarding.jsx";
import Sales from "./pages/Sales.jsx";
import Products from "./pages/Products.jsx";
import Orders from "./pages/Orders.jsx";
import Reports from "./pages/Reports.jsx";
import Members from "./pages/Members.jsx";
import Customers from "./pages/Customers.jsx";
import Settings from "./pages/Settings.jsx";
import ShopSwitcher from "./components/ShopSwitcher.jsx";
import NotificationBell from "./components/NotificationBell.jsx";

// Mỗi tab: icon Phosphor + nhãn + phụ đề + vai trò được xem.
const ALL_TABS = [
  { id: "sales", label: "Bán hàng", icon: "ph-storefront", sub: "Tạo đơn nhanh tại quầy", roles: ["owner", "staff"] },
  { id: "products", label: "Sản phẩm", icon: "ph-package", sub: "Quản lý kho hàng", roles: ["owner", "staff"] },
  { id: "orders", label: "Đơn hàng", icon: "ph-receipt", sub: "Lịch sử giao dịch", roles: ["owner", "staff"] },
  { id: "customers", label: "Khách hàng", icon: "ph-users", sub: "Cơ sở dữ liệu khách", roles: ["owner", "staff"] },
  { id: "reports", label: "Báo cáo", icon: "ph-chart-pie-slice", sub: "Tình hình kinh doanh", roles: ["owner"] },
  { id: "members", label: "Nhân viên", icon: "ph-user-circle-gear", sub: "Mời & phân quyền", roles: ["owner"] },
  { id: "settings", label: "Cài đặt", icon: "ph-gear", sub: "Tài khoản & cửa hàng", roles: ["owner", "staff"] },
];

const initial = (s) => (s || "?").trim().split(/\s+/).pop()[0]?.toUpperCase() || "?";

export default function App() {
  const [booting, setBooting] = useState(authEnabled);
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);            // {user, email, shop_id, role, shops}
  const [activeId, setActiveId] = useState(getActiveShopId());
  const [creatingShop, setCreatingShop] = useState(false);
  const [tab, setTab] = useState("sales");
  const [collapsed, setCollapsed] = useState(false);

  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const shops = me?.shops || [];
  const activeShop = shops.find((s) => String(s.id) === String(activeId)) || shops[0] || null;
  const role = activeShop?.my_role || me?.role || "owner";

  // 1) Theo dõi phiên đăng nhập
  useEffect(() => {
    if (!authEnabled || !supabase) { setBooting(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data?.session ?? null); setBooting(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null);
      if (!s) { setMe(null); setActiveShopId(null); setActiveId(null); }
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  // 2) Nạp danh tính + danh sách cửa hàng. Chọn shop active (ưu tiên lựa chọn đã lưu).
  const loadMe = useCallback(async () => {
    const m = await api.me();
    setMe(m);
    const stored = getActiveShopId();
    const ids = (m.shops || []).map((s) => String(s.id));
    const pick = (stored && ids.includes(String(stored))) ? stored : (m.shop_id || m.shops?.[0]?.id || null);
    setActiveShopId(pick);
    setActiveId(pick);
    applyTheme((m.shops || []).find((s) => String(s.id) === String(pick)));
    return m;
  }, []);

  useEffect(() => {
    if (authEnabled && !session) { setMe(null); return; }
    loadMe().catch((e) => setError(e.message));
  }, [session, loadMe]);

  // 3) Nạp dữ liệu của shop đang chọn (stale-while-revalidate theo từng shop).
  const reload = useCallback(async (silent = false) => {
    if (!activeId && authEnabled) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [p, c, o] = await Promise.all([api.listProducts(), api.listCustomers(), api.listOrders()]);
      setProducts(p); setCustomers(c); setOrders(o);
      writeCache(`core:${activeId}`, { p, c, o });
      if (role === "owner") {
        try { setReport(await api.reportSummary()); } catch { setReport(null); }
      } else { setReport(null); }
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [activeId, role]);

  useEffect(() => {
    if (authEnabled && !me) return;
    if (authEnabled && me && shops.length === 0) { setLoading(false); return; } // -> onboarding
    if (authEnabled && !activeId) return;
    const cached = readCache(`core:${activeId}`);
    if (cached) {
      setProducts(cached.p || []); setCustomers(cached.c || []); setOrders(cached.o || []);
      setLoading(false);
      reload(true);
    } else {
      reload();
    }
  }, [me, activeId, reload, shops.length]);

  // Đổi cửa hàng
  function switchShop(id) {
    if (String(id) === String(activeId)) return;
    setActiveShopId(id);
    setActiveId(id);
    applyTheme(shops.find((s) => String(s.id) === String(id)));
    setTab("sales");
  }
  async function onShopCreated(shop) {
    setCreatingShop(false);
    const m = await loadMe();
    if (shop?.id && (m.shops || []).some((s) => String(s.id) === String(shop.id))) switchShop(shop.id);
  }
  async function onAcceptedInvite() { await loadMe(); }
  async function onShopUpdated() { await loadMe(); }   // sau khi đổi tên/màu trong Cài đặt

  // --- Màn hình chặn ---
  if (booting) return <div className="full-center">Đang tải…</div>;
  if (authEnabled && !session) return <LoginPage />;
  if (authEnabled && session && !me) return <div className="full-center">Đang tải hồ sơ…</div>;
  // Người dùng mới chưa có cửa hàng -> onboarding
  if (authEnabled && me && shops.length === 0)
    return <Onboarding defaultName={me.user?.full_name ? `Shop của ${me.user.full_name}` : ""} onCreated={onShopCreated} />;

  const tabs = ALL_TABS.filter((t) => t.roles.includes(role));
  const active = tabs.find((t) => t.id === tab) ? tab : "sales";
  const meta = ALL_TABS.find((t) => t.id === active);
  const roleLabel = role === "owner" ? "Chủ cửa hàng" : "Nhân viên";
  const displayUser = me?.user || { full_name: "Demo", email: "demo@local" };

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-head">
          <div className="logo-badge">
            {activeShop?.logo_url ? <img src={activeShop.logo_url} alt="" className="logo-img" /> : <i className="ph-fill ph-storefront" />}
          </div>
          {!collapsed && <span className="logo-text">{activeShop?.name || "ThiemCun POS"}</span>}
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
            <div className="avatar">{initial(displayUser.full_name || displayUser.email)}</div>
            {!collapsed && (
              <div className="info">
                <div className="name">{displayUser.full_name || displayUser.email}</div>
                <div className="role">{roleLabel}</div>
                {authEnabled && <button className="btn-signout" onClick={supaSignOut}>Đăng xuất</button>}
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
          {shops.length > 0 && (
            <ShopSwitcher shops={shops} activeShopId={activeId} onSwitch={switchShop} onCreateShop={() => setCreatingShop(true)} />
          )}
          <div className="topbar-titles">
            <h1>{meta?.label}</h1>
            <div className="sub">{meta?.sub}</div>
          </div>
          <NotificationBell onAcceptedInvite={onAcceptedInvite} />
        </header>

        <main className="content">
          {error && (
            <div className="page" style={{ paddingBottom: 0 }}>
              <div className="banner banner-error">⚠️ {error}<button className="btn-link" onClick={() => reload()}>Thử lại</button></div>
            </div>
          )}
          {loading ? <SkeletonPage /> : (
            <>
              {active === "sales" && <Sales products={products} customers={customers} report={report} onDone={() => reload()} />}
              {active === "products" && <Products products={products} onChanged={() => reload()} />}
              {active === "orders" && <Orders orders={orders} />}
              {active === "customers" && <Customers />}
              {active === "reports" && <Reports report={report} orders={orders} customers={customers} products={products} />}
              {active === "members" && <Members />}
              {active === "settings" && <Settings role={role} user={displayUser} shop={activeShop} onShopUpdated={onShopUpdated} />}
            </>
          )}
        </main>
      </div>

      {creatingShop && (
        <div className="modal-overlay">
          <div className="scrim" onClick={() => setCreatingShop(false)} />
          <div className="modal sm" style={{ padding: 0, background: "transparent", boxShadow: "none" }}>
            <Onboarding onCreated={onShopCreated} onCancel={() => setCreatingShop(false)} />
          </div>
        </div>
      )}
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
