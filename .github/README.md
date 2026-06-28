# CI/CD — ThiemCun POS

Quy trình: **PR → test+preview · push main → staging (deploy+migrate) · tag `v*` → prod (chờ duyệt)**.
Nguyên tắc: **không sửa prod trực tiếp** — prod chỉ qua `release.yml`, **dừng chờ Required reviewer duyệt**.

## Workflows
| File | Trigger | Việc |
|---|---|---|
| `pr.yml` | pull_request | npm build + pytest + Vercel **preview** deploy |
| `main.yml` | push main | test → migrate **staging** Supabase → deploy **staging** Vercel |
| `release.yml` | **tag `v*.*.*`** (hoặc dispatch) | dừng ở environment `production` chờ duyệt → migrate + deploy **prod** |
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

## Cổng duyệt PROD (gate) — NATIVE (đang bật)
Repo này **PUBLIC** → `Required reviewers` khả dụng trên gói **Free**. Đã cấu hình:
**Settings → Environments → production → Required reviewers = `thiemcun169`**.

Luồng release prod:
1. `git tag v1.2.3 && git push --tags` (hoặc Actions → release → Run workflow).
2. `release.yml` khởi động nhưng **dừng (pending)** tại job `release` vì `environment: production`.
3. GitHub gửi yêu cầu duyệt → vào **Actions → run → Review deployments → Approve and deploy**.
4. Sau approve: migrate prod Supabase → deploy prod Vercel.

> Lịch sử (gói cũ): khi repo còn **private + Free**, GitHub trả 422 cho required-reviewers → từng phải
> dùng cổng phần mềm `workflow_dispatch` + gõ `DEPLOY-PROD`. Public hoá đã thay bằng cổng native ở trên.

## ⚠️ Lưu ý
- **`uv` bắt buộc trong job deploy.** Vercel build phần Python (FastAPI) gọi `uv` để cài deps khi
  build **cục bộ** trên runner. Runner không có sẵn `uv` → `spawn uv ENOENT` làm chết bước deploy.
  Vì vậy 3 job build (preview/staging/prod) đều cài `uv` trước `vercel build`.
- Vercel deploy trong CI **chỉ chạy khi account đã verify** (đã thêm payment method → `isVerified:true`,
  deploy chạy được). Trước khi verify thì chỉ test/migrate chạy, bước deploy bị block.
- Đặt **required status check** = `pr.yml / verify` (Settings → Branches) để chặn merge khi test đỏ.
