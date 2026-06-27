// Client gọi backend FastAPI. Mọi request đi qua đây (1 chỗ).
// Tự gắn JWT (nếu đã đăng nhập Supabase) vào header Authorization.
import { getAccessToken } from "./lib/supabaseClient";

const BASE = "/api";

async function request(path, options = {}) {
  const token = await getAccessToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = `Lỗi ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* body không phải JSON */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  health: () => request("/health"),

  listProducts: () => request("/products"),
  createProduct: (data) => request("/products", { method: "POST", body: JSON.stringify(data) }),
  updateProduct: (id, data) =>
    request(`/products/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  listCustomers: () => request("/customers"),
  createCustomer: (data) => request("/customers", { method: "POST", body: JSON.stringify(data) }),

  listOrders: () => request("/orders"),
  createOrder: (data) => request("/orders", { method: "POST", body: JSON.stringify(data) }),

  reportSummary: () => request("/report/summary"),
};
