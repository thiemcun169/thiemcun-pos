// Định dạng tiền VND, vd 25000 -> "25.000 ₫".
export function vnd(amount) {
  const n = Number(amount) || 0;
  return n.toLocaleString("vi-VN") + " ₫";
}

// Định dạng ngày giờ ngắn gọn.
export function shortDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
