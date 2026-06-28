import { useCallback, useState } from "react";

// Hook + component thông báo nổi (toast) — khớp design Claude Design.
// Dùng: const { toasts, push, dismiss } = useToasts(); push("Đã lưu"); push("Lỗi", "error");
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((msg, kind = "success") => {
    const id = "t" + Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return { toasts, push, dismiss };
}

const ICON = { success: "ph-check-circle", error: "ph-warning-circle", info: "ph-info" };

export function Toasts({ toasts, dismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismiss(t.id)}>
          <i className={`ph-fill ${ICON[t.kind] || ICON.success}`} />
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
