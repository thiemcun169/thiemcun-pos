import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { authEnabled, supabase, signOut as supaSignOut } from "./lib/supabaseClient";
import { getActiveShopId, setActiveShopId, applyTheme } from "./lib/shop";
import { readCache, writeCache } from "./lib/cache";
import LoginPage from "./pages/LoginPage.jsx";
import Onboarding from "./pages/Onboarding.jsx";
import JoinShop from "./pages/JoinShop.jsx";
import Sales from "./pages/Sales.jsx";
import Products from "./pages/Products.jsx";
import Orders from "./pages/Orders.jsx";
import Reports from "./pages/Reports.jsx";
import Members from "./pages/Members.jsx";
import Customers from "./pages/Customers.jsx";
import Settings from "./pages/Settings.jsx";
import ShopSwitcher from "./components/ShopSwitcher.jsx";
import NotificationBell from "./components/NotificationBell.jsx";

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

function readToken() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("token");
}
function clearToken() {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  u.searchParams.delete("token");
  window.history.replaceState({}, "", u.pathname + u.search);
}

export default function App() {
  const [booting, setBooting] = useState(authEnabled);
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);          // {user, email, shop_id, role, shops:[...]}
  const [activeId, setActiveId] = useState(getActiveShopId());
  const [joinToken, setJoinToken] = useState(readToken());
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
  const shopId = activeShop?.id || null;
  const role = activeShop?.my_role || me?.role || "owner";

  // 1) Phiên đăng nhập
  useEffect(() => {
    if (!authEnabled || !supabase) { setBooting(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data?.session ?? null); setBooting(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null);
      if (!s) { setMe(null); setActiveShopId(null); setActiveId(null); }
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  // 2) Nạp danh tính + danh sách shop; chọn shop active (ưu tiên lựa chọn đã lưu).
  const loadMe = useCallback(async () => {
    const m = await api.me();
    setMe(m);
    const ids = (m.shops || []).map((s) => String(s.id));
    const stored = getActiveShopId();
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

  // 3) Dữ liệu của shop đang chọn (stale-while-revalidate theo từng shop).
  const reload = useCallback(async (silent = false) => {
    if (authEnabled && !shopId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [p, c, o] = await Promise.all([api.listProducts(), api.listCustomers(), api.listOrders()]);
      setProducts(p); setCustomers(c); setOrders(o);
      writeCache(`core:${shopId}`, { p, c, o });
      if (role === "owner") {
        try { setReport(await api.reportSummary()); } catch { setReport(null); }
      } else { setReport(null); }
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [shopId, role]);

  useEffect(() => {
    if (authEnabled && !me) return;
    if (authEnabled && (joinToken || !shopId)) { setLoading(false); return; } // join/onboarding
    const cached = readCache(`core:${shopId}`);
    if (cached) {
      setProducts(cached.p || []); setCustomers(cached.c || []); setOrders(cached.o || []);
      setLoading(false); reload(true);
    } else { reload(); }
  }, [me, shopId, joinToken, reload]);

  // Đổi shop (shop-switcher)
  function switchShop(id) {
    if (!id || String(id) === String(activeId)) return;
    setActiveShopId(id); setActiveId(id);
    applyTheme(shops.find((s) => String(s.id) === String(id)));
    setTab("sales");
  }
  // Sau khi tạo shop mới hoặc nhận lời mời -> nạp lại + chuyển tới shop đó
  async function afterJoinOrCreate(targetShopId) {
    clearToken(); setJoinToken(null); setCreatingShop(false);
    const m = await loadMe();
    const ids = (m.shops || []).map((s) => String(s.id));
    if (targetShopId && ids.includes(String(targetShopId))) {
      setActiveShopId(targetShopId); setActiveId(targetShopId);
      applyTheme((m.shops || []).find((s) => String(s.id) === String(targetShopId)));
    }
    setTab("sales");
  }
  async function onShopUpdated() { await loadMe(); }

  // --- Màn chặn ---
  if (booting) return <div className="full-center">Đang tải…</div>;
  if (authEnabled && !session) return <LoginPage inviteToken={joinToken} />;
  if (authEnabled && session && !me) return <div className="full-center">Đang tải hồ sơ…</div>;
  if (authEnabled && joinToken)
    return <JoinShop token={joinToken} onJoined={afterJoinOrCreate} onSkip={() => { clearToken(); setJoinToken(null); }} />;
  // Chưa thuộc shop nào -> onboarding wizard (đa thành viên: chỉ khi 0 shop)
  if (authEnabled && shops.length === 0)
    return <Onboarding defaultName={me?.user?.full_name ? `Shop của ${me.user.full_name}` : ""}
                       onCreated={(s) => afterJoinOrCreate(s?.id)} onJoined={afterJoinOrCreate} />;

  const tabs = ALL_TABS.filter((t) => t.roles.includes(role));
  const active = tabs.find((t) => t.id === tab) ? tab : "sales";
  const meta = ALL_TABS.find((t) => t.id === active);
  const roleLabel = role === "owner" ? "Chủ cửa hàng" : "Nhân viên";
  const displayUser = me?.user || { full_name: "Demo", email: "demo@local" };

  return (
    <div className="app">
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
              <i className={`ph ${t.icon}`} />{!collapsed && <span>{t.label}</span>}
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
          <NotificationBell onAcceptedInvite={afterJoinOrCreate} />
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
              {active === "settings" && <Settings role={role} user={displayUser} shop={activeShop} onShopUpdated={onShopUpdated} onLeftShop={() => afterJoinOrCreate()} />}
            </>
          )}
        </main>
      </div>

      {creatingShop && (
        <div className="modal-overlay">
          <div className="scrim" onClick={() => setCreatingShop(false)} />
          <div className="modal sm" style={{ padding: 0, background: "transparent", boxShadow: "none" }}>
            <Onboarding onCreated={(s) => afterJoinOrCreate(s?.id)} onJoined={afterJoinOrCreate} onCancel={() => setCreatingShop(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function SkeletonPage() {
  return (
    <div className="page" aria-busy="true">
      <div className="sk-kpis">{[0, 1, 2, 3].map((i) => <div key={i} className="sk sk-kpi" />)}</div>
      <div className="sk sk-block" />
    </div>
  );
}
