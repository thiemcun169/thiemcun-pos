import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// --- Analytics (buổi 3, Lab 5): Vercel Web Analytics, cookie-free, 1 dòng ---
import { inject } from "@vercel/analytics";
inject();

// --- Error tracking (buổi 3, Lab 5): Sentry, chỉ bật khi có DSN ---
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn: sentryDsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
