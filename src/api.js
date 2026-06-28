// Client gọi backend FastAPI. Mọi request đi qua đây (1 chỗ).
// Tự gắn JWT (nếu đã đăng nhập Supabase). Luật 1-shop -> không cần gửi shop id.
import { getAccessToken } from "./lib/supabaseClient";

const BASE = "/api";

async function request(path, options = {}) {
  const token = await getAccessToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = `Lỗi ${res.status}`;
    try { const body = await res.json(); detail = body.detail || detail; } catch { /* not json */ }
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  health: () => request("/health"),

  // danh tính + cửa hàng (tối đa 1)
  me: () => request("/me"),
  listShops: () => request("/shops"),
  createShop: (name) => request("/shops", { method: "POST", body: JSON.stringify({ name }) }),

  // sản phẩm
  listProducts: () => request("/products"),
  createProduct: (data) => request("/products", { method: "POST", body: JSON.stringify(data) }),
  updateProduct: (id, data) => request(`/products/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: "DELETE" }),

  // khách hàng
  listCustomers: () => request("/customers"),
  createCustomer: (data) => request("/customers", { method: "POST", body: JSON.stringify(data) }),
  getCustomer: (id) => request(`/customers/${id}`),

  // cửa hàng (cài đặt + vòng đời)
  getShop: () => request("/shop"),
  updateShop: (data) => request("/shop", { method: "PATCH", body: JSON.stringify(data) }),
  clearShopData: () => request("/shop/clear-data", { method: "POST" }),
  reseedShop: () => request("/shop/reseed", { method: "POST" }),
  leaveShop: () => request("/shop/leave", { method: "POST" }),
  deleteShop: () => request("/shop", { method: "DELETE" }),

  // đơn hàng
  listOrders: () => request("/orders"),
  createOrder: (data) => request("/orders", { method: "POST", body: JSON.stringify(data) }),
  reportSummary: () => request("/report/summary"),

  // thành viên / mời (token)
  listMembers: () => request("/members"),
  inviteMember: (data) => request("/members", { method: "POST", body: JSON.stringify(data) }),
  updateMember: (id, data) => request(`/members/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  removeMember: (id) => request(`/members/${id}`, { method: "DELETE" }),
  transferOwnership: (id) => request(`/members/${id}/transfer-ownership`, { method: "POST" }),
  myInvites: () => request("/invites"),
  validateInvite: (token) => request(`/invite/${encodeURIComponent(token)}`),
  joinByToken: (token) => request("/join", { method: "POST", body: JSON.stringify({ token }) }),

  // thông báo + nhật ký
  notifications: () => request("/notifications"),
  auditLog: () => request("/audit"),
};
