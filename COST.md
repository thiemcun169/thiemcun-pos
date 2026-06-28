# COST.md — Kiểm soát chi phí ThiemCun POS (giữ $0)

> Nguyên tắc: **Toàn bộ chạy ở free tier — mục tiêu $0.**
> Cập nhật: 2026-06-28 (Phase 10.5 — đã thêm thẻ vào Vercel để VERIFY account).

## 0. Sau khi add card vào Vercel — HARD RULES (bắt buộc)

Ngày 2026-06-28, user đã thêm 1 thẻ vào Vercel **chỉ để verify account** (gỡ lỗi deploy "Blocked" do `isVerified:false`). **Verify ≠ cho phép tiêu tiền.** Mọi tác nhân (AI hay người) tuyệt đối KHÔNG được:

- ❌ Click **Upgrade to Pro** / Activate Pro Trial / bất kỳ banner nâng cấp nào
- ❌ **Mua domain** qua Vercel (`vercel domains buy …`) — cần user duyệt từng lần
- ❌ Bật **paid add-on** (AI Gateway auto-reload, Vercel KV/Blob/Postgres bản trả phí, Edge Config quota trả phí, Observability Plus…)
- ❌ Bật **AI Gateway Auto-reload** — giữ **Off** (hiện có $5.00 credit KHUYẾN MÃI free, hết là dừng, KHÔNG tự mua thêm)
- ❌ **Add team seat** (thêm thành viên trả phí)
- ✅ Nếu task cần tính năng trả phí → **STOP + hỏi user**: "Cần paid feature X (~$Y), confirm proceed?"

**Trạng thái đã xác minh (2026-06-28, sau khi add card):**

| Mục | Giá trị |
|---|---|
| Plan | **Hobby** (Active) — chưa nâng cấp |
| Payment method | Visa debit •••• **0390**, Default, valid **12/2028** (verify-only) |
| Invoices | **None** — thẻ chưa bị trừ đồng nào |
| AI Gateway credit | $5.00 (credit free), **Auto-reload = Off** |
| Subscription | Không có gói trả phí định kỳ nào |
| v0 plan (personal) | Free |

> Vì sao an toàn: Hobby **không có on-demand billing** (vượt limit thì *tạm dừng*, không charge). Spend Management/Usage Alerts là tính năng Pro → không bật được trên Hobby, nhưng cũng KHÔNG cần vì Hobby vốn không sinh phí.

## 1. Hiện trạng — tất cả FREE
| Dịch vụ | Gói | Hạn free | Dùng cho |
|---|---|---|---|
| **Supabase** | Free | 2 project active, 500MB DB, 2GB egress/tháng, 50k MAU; **ngủ sau 7 ngày không hoạt động** | DB prod + staging |
| **Vercel** | Hobby | 100GB băng thông, 100h serverless/tháng; **phi thương mại** | Host frontend + API |
| **GitHub** | Free | Actions 2.000 phút/tháng (repo private) | CI/CD |
| **Domain** | `thiemcun.is-a.dev` | Miễn phí (is-a.dev) | Domain thật |
| **Vercel Analytics** | Free | có giới hạn sự kiện | Analytics |
| **GA4 / Sentry / UptimeRobot** | Free | — | Analytics / lỗi / uptime |

→ **Tổng: $0/tháng.** 3 môi trường: **dev = local (Supabase CLI/Docker)**, **staging + prod = 2 hosted free**.

## 2. ⚠️ Bẫy chi phí cần tránh
- **KHÔNG** bật Supabase **Pro**, **Branching**, **PITR** (đều tính phí) trừ khi chấp nhận trả.
- **KHÔNG** thêm payment method vào Vercel (để Spend Cap = $0 chặn vượt Hobby).
- Supabase free **ngủ sau 7 ngày** → dùng UptimeRobot ping định kỳ để giữ thức (hoặc chấp nhận ngủ).
- Vercel Hobby là **phi thương mại** — khi shop bán thật (doanh thu) thì đúng ToS phải lên Pro ($20).

## 3. Cài cảnh báo (alerts) — làm 1 lần
### Supabase (cảnh báo khi gần chạm free tier)
1. Dashboard → **Settings → Billing** (hoặc Organization → Usage).
2. Bật **Email alerts / Usage warnings** khi usage > 80% (DB size, egress, MAU).
3. (Free) theo dõi thủ công ở **Reports → Usage**; đặt nhắc tháng.

### Vercel (chặn vượt phí)
1. Dashboard → Team → **Settings → Billing → Spend Management**.
2. Đặt **Spend Cap = $0** (Hobby mặc định không tính phí, cap đảm bảo không bật trả phí ngoài ý muốn).
3. Bật **Usage alerts** (email khi gần 80% Hobby limit).

### GitHub Actions
- Settings → Billing → đặt **spending limit = $0** (Actions private repo: 2.000 phút free, không tự tính phí nếu cap $0).

## 4. Theo dõi định kỳ (gợi ý lịch)
- **Hàng tuần**: mở UptimeRobot xem app còn sống; Supabase Reports → DB size.
- **Hàng tháng**: Vercel Usage + Supabase Usage; rà có dịch vụ nào "lỡ" lên paid không.
- **Khi có người dùng thật**: cân nhắc Supabase Pro ($25, có backup/PITR + không ngủ) + Vercel Pro ($20).

## 5. Khi nào NÊN trả phí (tham khảo)
| Tín hiệu | Nâng cấp | Giá |
|---|---|---|
| DB > 400MB hoặc cần backup | Supabase Pro | $25/tháng |
| Băng thông Vercel > 80GB / cần dùng thương mại | Vercel Pro | $20/tháng |
| Cần domain `.com` chuyên nghiệp | `vercel domains buy thiemcun.com` | ~$11/năm |

> Tóm lại: bản hiện tại **$0**, đủ chạy thật cho cửa hàng nhỏ + dạy học. Chỉ trả khi quy mô lớn.

## Email invite (Supabase free tier)
- Mời nhân viên gửi email tự động qua Supabase Auth (magic-link OTP, `create_user=true`).
- **Free tier ~ 3-4 email/giờ** (built-in SMTP) → đủ cho dev/demo. Vượt → cấu hình SMTP riêng (Resend/Postmark)
  hoặc Supabase Pro ($25/mo) — **CHƯA bật, cần user duyệt** (không tự upgrade).
- Fallback: UI luôn hiện "Copy link" để owner gửi tay (Zalo/SMS) nếu email chưa tới.

## Final infrastructure footprint (2026-06-28, post-cleanup)
**Mục tiêu: $0/tháng. Single-project mỗi dịch vụ.**
- **Vercel (Hobby, free):** CHỈ còn `thiemcun-prod` → pos.thiemcun.io.vn. Đã xoá 5 grace project (thiemcun-app, thiemcun-staging-s1/s2, thiemcun, thiemcun-pos). Prod deploy chỉ qua `release.yml` (tag v* + cổng duyệt). Bỏ preview/dev auto-deploy Vercel (test dev cục bộ).
- **Supabase (free):** prod `cnoolkkpkvzerlwkhjxe` + dev `cbtpfnvlcszmlbgxunag` (DB dev cho `dev.yml migrate-dev` + test cục bộ). Email invite dùng built-in SMTP (~4/giờ). Keepwarm cron chống ngủ.
- **Google OAuth:** 2 client tách biệt — `thiemcun-pos-web` (prod) + `thiemcun-pos-web-dev` (dev). Xem SECURITY.md.
- **GitHub:** repo public (free Actions + branch protection + environment reviewer gate).
- **Monitoring:** Sentry wired-but-no-DSN (silent no-op cho tới khi set `SENTRY_DSN`) + UptimeRobot = tự setup (xem MONITORING.md). KHÔNG paid.
- Domain `thiemcun.io.vn` 30k₫/năm @ PA Vietnam (đã trả). KHÔNG có chi phí định kỳ khác.
