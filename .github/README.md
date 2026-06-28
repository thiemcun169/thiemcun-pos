# CI/CD — ThiemCun POS

Quy trình: **PR → test+preview · push main → staging (deploy+migrate) · prod → chạy tay có xác nhận**.
Nguyên tắc: **không sửa prod trực tiếp** — prod chỉ qua `release.yml`, **thủ công + gõ xác nhận**.

## Workflows
| File | Trigger | Việc |
|---|---|---|
| `pr.yml` | pull_request | npm build + pytest + Vercel **preview** deploy |
| `main.yml` | push main | test → migrate **staging** Supabase → deploy **staging** Vercel |
| `release.yml` | **dispatch + gõ `DEPLOY-PROD`** | migrate **prod** Supabase → deploy **prod** Vercel |
| `migrations.yml` | dispatch (chọn staging/prod) | áp migration thủ công |
| `keepwarm.yml` | cron 30' | ping `/api/health` chống Supabase ngủ + giảm cold start |

## Secrets cần đặt (Settings → Secrets and variables → Actions → Secrets)
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_STAGING_REF`, `SUPABASE_STAGING_DB_PASSWORD`
- `SUPABASE_PROD_REF`, `SUPABASE_PROD_DB_PASSWORD`
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID_STAGING`, `VERCEL_PROJECT_ID_PROD`

## Variables (… → Variables)
- `STAGING_URL` (vd https://thiemcun-staging-s1.vercel.app)
- `PROD_URL` (vd https://thiemcun-prod.vercel.app)

## Cổng duyệt PROD (gate) — phụ thuộc gói GitHub
- **Repo PRIVATE + gói Free**: GitHub **không** cho bật `Required reviewers` (trả về 422
  "billing plan"). Vì vậy `release.yml` chỉ chạy bằng **workflow_dispatch** và **bắt gõ `DEPLOY-PROD`**
  → prod không bao giờ tự deploy; phải là hành động thủ công có xác nhận của người chủ.
- **Nâng cấp gate native** (khuyến nghị khi lên thật): chuyển repo **public** *hoặc* dùng **GitHub Pro/Team**
  → Settings → Environments → **production** → bật **Required reviewers** (chính bạn). Khi đó có thể đổi
  trigger sang tag `v*` mà run vẫn **dừng chờ duyệt** trước khi migrate+deploy prod.

## ⚠️ Lưu ý
- **`uv` bắt buộc trong job deploy.** Vercel build phần Python (FastAPI) gọi `uv` để cài deps khi
  build **cục bộ** trên runner. Runner không có sẵn `uv` → `spawn uv ENOENT` làm chết bước deploy.
  Vì vậy 3 job build (preview/staging/prod) đều cài `uv` trước `vercel build`.
- Vercel deploy trong CI **chỉ chạy khi account đã verify** (đã thêm payment method → `isVerified:true`,
  deploy chạy được). Trước khi verify thì chỉ test/migrate chạy, bước deploy bị block.
- Đặt **required status check** = `pr.yml / verify` (Settings → Branches) để chặn merge khi test đỏ.
