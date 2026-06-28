# CI/CD — ThiemCun POS

Quy trình: **PR → test+preview · push main → staging (deploy+migrate) · tag `v*` → PROD (gated)**.
Nguyên tắc: **không sửa prod trực tiếp** — prod chỉ qua `release.yml` có **manual approval**.

## Workflows
| File | Trigger | Việc |
|---|---|---|
| `pr.yml` | pull_request | npm build + pytest + Vercel **preview** deploy |
| `main.yml` | push main | test → migrate **staging** Supabase → deploy **staging** Vercel |
| `release.yml` | tag `v*.*.*` | (gate `production`) → migrate **prod** Supabase → deploy **prod** Vercel |
| `migrations.yml` | dispatch | áp migration thủ công (chọn staging/prod) |
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

## Manual approval cho PROD
Settings → Environments → **production** → bật **Required reviewers** (chính bạn). Khi push tag `v*`,
`release.yml` dừng chờ bạn duyệt trước khi migrate+deploy prod.

## ⚠️ Lưu ý
- Vercel deploy trong CI **chỉ chạy khi account đã verify** (hiện `isVerified:false` → bước deploy có thể
  fail cho tới khi thêm payment method). Test/migrate vẫn chạy bình thường.
- Đặt **required status check** = `pr.yml / verify` (Settings → Branches) để chặn merge khi test đỏ.
