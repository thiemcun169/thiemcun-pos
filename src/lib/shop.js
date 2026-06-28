// Áp dụng màu thương hiệu của cửa hàng -> CSS variables. (Luật 1-shop: không cần
// lưu "active shop id" nữa — cửa hàng của user chính là me.shop_id.)
export function applyTheme(shop) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--accent", shop?.color_primary || "#008060");
  root.style.setProperty("--accent-d", shop?.color_secondary || "#006e52");
}
