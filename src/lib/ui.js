// Tiện ích UI dùng chung cho các màn hình.

// Map danh mục -> icon Phosphor. Không khớp -> icon mặc định.
const CAT_ICONS = {
  "thời trang": "ph-t-shirt",
  "phụ kiện": "ph-handbag",
  "tạp hóa": "ph-shopping-bag",
  "tạp hoá": "ph-shopping-bag",
  "gia dụng": "ph-house-line",
  "đồ uống": "ph-coffee",
  "thực phẩm": "ph-fork-knife",
  "bánh kẹo": "ph-cookie",
};

export function catIcon(category) {
  if (!category) return "ph-package";
  return CAT_ICONS[category.trim().toLowerCase()] || "ph-package";
}

// Chữ cái đại diện (avatar): lấy chữ đầu của từ cuối cùng.
export function initialOf(name) {
  const s = (name || "?").trim();
  if (!s) return "?";
  return s.split(/\s+/).pop()[0].toUpperCase();
}
