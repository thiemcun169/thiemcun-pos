// Lớp Auth (đăng nhập Google qua Supabase) — ĐỂ RIÊNG MỘT CHỖ.
// Chỉ dùng "publishable/anon key" ở frontend (an toàn công khai). KHÔNG bao giờ
// để service_role key ở đây.
//
// Bật/tắt được: nếu chưa có biến môi trường VITE_SUPABASE_* -> chạy chế độ "mở"
// (không đăng nhập), app vẫn dùng được để demo. Có rồi -> hiện nút đăng nhập Google.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const authEnabled = Boolean(url && anonKey);

export const supabase = authEnabled ? createClient(url, anonKey) : null;

export async function signInWithGoogle() {
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

// Lấy access token (JWT) hiện tại để gắn vào header gọi API backend.
export async function getAccessToken() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}
