# COST.md — Kiểm soát chi phí ThiemCun POS (giữ $0)

> Nguyên tắc: **KHÔNG cắm thẻ vào bất kỳ dịch vụ nào.** Toàn bộ chạy ở **free tier**.
> Cập nhật: 2026-06-28 (Phase 8).

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
