# MONITORING — ThiemCun POS

Quan sát hệ thống ở tier MIỄN PHÍ (Supabase free + Vercel Hobby + Sentry/UptimeRobot/GA4 free).

## 1. Sentry (lỗi runtime) — code đã sẵn sàng
Backend `api/index.py` đã khởi tạo Sentry **khi có `SENTRY_DSN`** (no-op nếu trống):
```python
if os.environ.get("SENTRY_DSN"):
    sentry_sdk.init(dsn=..., traces_sample_rate=..., environment=os.environ.get("VERCEL_ENV"))
```
**Bật (cần tài khoản Sentry của bạn — AI không tạo account hộ):**
1. sentry.io → New Project → Platform: Python (FastAPI). Copy **DSN**.
2. Vercel `thiemcun-prod` → Settings → Environment Variables → thêm `SENTRY_DSN` (Production) + (tuỳ chọn) `SENTRY_TRACES_SAMPLE_RATE=0.1`.
3. Redeploy (tag mới hoặc Vercel "Redeploy"). Gây 1 lỗi thử (vd gọi endpoint sai) → kiểm Sentry nhận event.
4. (Frontend) muốn bắt lỗi JS: thêm `@sentry/react` + `VITE_SENTRY_DSN` — hiện chưa wire (future).

## 2. UptimeRobot (uptime) — cần account của bạn
1. uptimerobot.com (free 50 monitors) → Add New Monitor.
2. Type: HTTP(s) · URL: `https://pos.thiemcun.io.vn/api/health` · Interval: 5 phút.
3. Alert contact: email `thiemnguyenba169@gmail.com`.
4. (Health trả `{"status":"ok",...}` 200 — đủ cho uptime check.)

## 3. GA4 (analytics web) — Vercel Analytics đã bật
- Vercel Web Analytics: đã active trên project (Speed Insights/Analytics tab).
- GA4: nếu muốn, thêm `VITE_GA_MEASUREMENT_ID` + script gtag trong `index.html` (future wire).

## 4. Supabase / Vercel usage (free-tier limits)
Theo dõi thủ công (hoặc dashboard):
- **Supabase free:** DB 500MB · bandwidth 2GB/mo · 50k MAU auth. Dashboard → Project → Usage.
- **Vercel Hobby:** 100GB bandwidth · serverless execution. Dashboard → Usage.
- Cảnh báo: Supabase free **pause project sau 1 tuần không hoạt động** → `keepwarm.yml` cron ping chống ngủ.

## 5. In-app analytics (hiện có vs future)
- **Hiện có:** trang **Báo cáo** (owner) — doanh thu, top sản phẩm, cảnh báo tồn thấp (theo shop).
- **Future "Hệ thống" (platform-admin):** signup rate, MAU, top shops theo doanh thu, gauge usage Supabase/Vercel.
  Cần 1 vai trò **super-admin** (xuyên tenant) — KHÔNG thuộc mô hình 1-shop hiện tại; là enhancement riêng (xem ARCHITECTURE.md §8). Triển khai qua SQL view tổng hợp + endpoint owner-platform.

## 6. CI/CD observability
- GitHub Actions: pr.yml (lint/test/build/preview), dev.yml (migrate+deploy dev), release.yml (prod, gated), migrations.yml (dispatch), keepwarm.yml (cron).
- Mỗi prod release = tag `v*` → cổng duyệt reviewer (audit ai duyệt, khi nào).
