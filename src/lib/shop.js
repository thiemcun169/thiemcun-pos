// Cửa hàng đang hoạt động (active shop) — đa thành viên: user có thể thuộc nhiều shop,
// shop-switcher chọn shop đang làm việc; lưu id ở localStorage để giữ khi tải lại.
const KEY = "tc_active_shop";

let _activeShopId = (typeof localStorage !== "undefined" && localStorage.getItem(KEY)) || null;

export function getActiveShopId() {
  return _activeShopId;
}

export function setActiveShopId(id) {
  _activeShopId = id || null;
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* localStorage bị chặn — bỏ qua */
  }
}

// Đổi màu thương hiệu của shop -> CSS variables (tint tự suy ra qua color-mix).
export function applyTheme(shop) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--accent", shop?.color_primary || "#008060");
  root.style.setProperty("--accent-d", shop?.color_secondary || "#006e52");
}
