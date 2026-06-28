// Cache stale-while-revalidate đơn giản (localStorage) — render NGAY dữ liệu cũ
// khi tải lại trang (cold start), rồi revalidate ngầm. Không cần thư viện ngoài.
// Key gắn theo Supabase URL để không lẫn dữ liệu giữa các môi trường.
const NS = "tpos:" + (import.meta.env.VITE_SUPABASE_URL || "local");

export function readCache(key) {
  try {
    const v = localStorage.getItem(`${NS}:${key}`);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export function writeCache(key, data) {
  try {
    localStorage.setItem(`${NS}:${key}`, JSON.stringify(data));
  } catch {
    /* hết quota / private mode — bỏ qua */
  }
}

export function clearCache() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(NS)).forEach((k) => localStorage.removeItem(k));
  } catch { /* noop */ }
}
