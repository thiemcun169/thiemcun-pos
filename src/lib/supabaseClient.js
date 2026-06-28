// Lớp Auth (Supabase) — ĐỂ RIÊNG MỘT CHỖ. Chỉ dùng anon/publishable key ở frontend.
// Hỗ trợ: Email+mật khẩu, Google OAuth, đổi mật khẩu, theo dõi phiên.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const authEnabled = Boolean(url && anonKey);
export const supabase = authEnabled
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

// --- Đăng nhập / đăng ký ---
export async function signInWithEmail(email, password) {
  if (!supabase) throw new Error("Auth chưa cấu hình");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(viError(error.message));
  return data;
}

export async function signUpWithEmail(email, password, fullName) {
  if (!supabase) throw new Error("Auth chưa cấu hình");
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName || email } },
  });
  if (error) throw new Error(viError(error.message));
  return data;
}

export async function signInWithGoogle() {
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

export async function updatePassword(newPassword) {
  if (!supabase) throw new Error("Auth chưa cấu hình");
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(viError(error.message));
}

export async function getAccessToken() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

// Dịch vài lỗi Supabase sang tiếng Việt dễ hiểu.
function viError(msg = "") {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Email hoặc mật khẩu không đúng.";
  if (m.includes("cấp quyền") || m.includes("not authorized") || m.includes("database error"))
    return "Email chưa được cấp quyền truy cập shop. Liên hệ admin.";
  if (m.includes("already registered")) return "Email này đã có tài khoản — hãy đăng nhập.";
  if (m.includes("password")) return "Mật khẩu chưa đạt yêu cầu (tối thiểu 6 ký tự).";
  if (m.includes("email")) return "Email không hợp lệ.";
  return msg;
}
