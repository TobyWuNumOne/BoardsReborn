# Staging Deployment Runbook

這份 runbook 定義 BoardsReborn 第一階段 staging 部署流程。目標是 90% 半自動：人先建立 Supabase staging project 並保管 secrets，Codex / CLI 負責檢查、migration push、Vercel env 設定與 staging deploy。

Production cutover 不是本文件的完成狀態。正式 production 應使用獨立 Supabase project、獨立 Vercel production env，並在 staging smoke test 全部通過後另行執行。

## 原則

- 不把 secrets 寫進 repo、文件、commit、console log 或對話。
- 不新增 `.env.production`，也不要 commit 任何實際 env 檔。
- 不修改 schema、RLS、API contract 或 print-agent scope 來配合部署。
- 第一階段只部署 staging；print-agent implementation 仍 pending，不阻塞 staging 驗證。
- `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY` 只能存在 Nitro server runtime / Vercel server env，不可進入 public runtime config。

## 前置檢查

確認工具與 repo 狀態：

```bash
node --version
pnpm --version
git remote -v
git branch --show-current
command -v vercel
command -v supabase
```

若缺少 CLI，先安裝：

```bash
npm install -g vercel
npm install -g supabase
```

登入 CLI：

```bash
vercel login
supabase login
```

也可以用本機 shell token，但不要把 token 寫入 repo：

```bash
export VERCEL_TOKEN="<paste-token-in-local-shell-only>"
export SUPABASE_ACCESS_TOKEN="<paste-token-in-local-shell-only>"
```

## 環境變數

本 repo 目前直接相容 Supabase / Vercel integration 匯入的變數名稱，也保留舊 alias fallback：

| 變數                            | Staging 來源                         | Browser 可見 | 備註                                                                         |
| ------------------------------- | ------------------------------------ | ------------ | ---------------------------------------------------------------------------- |
| `SUPABASE_URL`                  | Supabase staging Project URL         | 是           | 例如 `https://<project-ref>.supabase.co`                                     |
| `SUPABASE_ANON_KEY`             | Supabase anon / publishable key      | 是           | client auth 與一般 authenticated request 使用                                |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase service role / secret key   | 否           | server-only elevated key                                                     |
| `NEXT_PUBLIC_SUPABASE_URL`      | Vercel integration public URL        | 是           | 可直接由 Vercel Supabase integration 匯入；若有 `SUPABASE_URL` 仍可共存      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel integration public client key | 是           | 可直接由 Vercel Supabase integration 匯入；若有 `SUPABASE_ANON_KEY` 仍可共存 |
| `NUXT_PUBLIC_APP_URL`           | Vercel staging / preview URL         | 是           | 可手動指定；未設定時會 fallback 到 Vercel deployment URL                     |
| `ADMIN_EMAIL`                   | 手動建立 admin 時使用                | 否           | 目前 seed 不會自動建立 admin                                                 |
| `ADMIN_PASSWORD`                | 手動建立 admin 時使用                | 否           | 不要 commit                                                                  |
| `PRINT_WORKER_TOKEN`            | Print Worker bearer token            | 否           | print-worker API 已使用；Pi 端與 server 端需一致                             |

仍相容的舊 alias：

- `SUPABASE_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_PUBLISHABLE_KEY`
- `NUXT_PUBLIC_SUPABASE_URL`
- `NUXT_PUBLIC_SUPABASE_KEY`
- `NUXT_PUBLIC_SUPABASE_ANON_KEY`

不要再使用以下錯名：

- `NUXT_PUBLIC_SITE_URL`

## Supabase Staging

手動建立一個新的 Supabase staging project，不要使用 local project 或未來 production project。Region 優先選 Asia 相關區域以降低現場延遲。

取得：

- Project ref
- Project URL
- anon / publishable key
- service role / secret key

連結 staging project：

```bash
supabase link --project-ref <staging-project-ref>
```

先 dry run，確認會套用的 migrations：

```bash
supabase db push --dry-run
```

只有 dry run 結果符合預期時，才推到 staging：

```bash
supabase db push
```

### Auth 設定

在 Supabase Dashboard 設定：

- Authentication signups：disabled
- Site URL：Vercel staging URL，例如 `https://boards-reborn-staging.vercel.app`
- Additional Redirect URLs：
  - `http://localhost:3000`
  - `http://127.0.0.1:3000`
  - staging URL
  - 需要測 Vercel preview branch 時，再加入對應 preview URL

### 第一個 admin

本 repo 的 `supabase/seed.sql` 不包含真實 admin 帳密。請在 Supabase Auth dashboard 手動建立第一個內部使用者，再建立對應 `admin_profiles` row：

```sql
insert into public.admin_profiles (id, display_name)
values ('<auth.users.id>', 'BoardsReborn Admin');
```

`id` 必須等於 Supabase Auth user id。不要用 email、role claim 或 user metadata 取代 `admin_profiles` gate。

## Vercel Staging

先在本機確認 build：

```bash
pnpm install
pnpm format:check
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```

連結或建立 Vercel project：

```bash
vercel link
```

若使用一般 preview deployment，設定 preview env。每個值由你在 CLI prompt 手動貼入，不要寫入 repo：

```bash
vercel env add SUPABASE_URL preview
vercel env add SUPABASE_ANON_KEY preview
vercel env add SUPABASE_SERVICE_ROLE_KEY preview
vercel env add NUXT_PUBLIC_APP_URL preview
vercel env add ADMIN_EMAIL preview
vercel env add ADMIN_PASSWORD preview
```

若要驗證 print-worker API，需另外設定：

```bash
vercel env add PRINT_WORKER_TOKEN preview
```

若使用獨立 Vercel project 作為 staging project，也可以把 Vercel 的 production environment 視為 staging environment。這會產生穩定 staging alias，例如 `https://board-reborn-staging.vercel.app`，但不代表產品 production cutover：

```bash
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add NUXT_PUBLIC_APP_URL production
vercel deploy --prod -y
```

部署 preview：

```bash
vercel deploy -y
```

部署完成後，把 Vercel 回傳的 URL 設回：

- Vercel `NUXT_PUBLIC_APP_URL` preview env
- Supabase Auth Site URL / Additional Redirect URLs

若更新 env 後需要重新部署：

```bash
vercel deploy -y
```

不要在 staging 驗證完成前對正式產品 project 執行 production deploy。正式 product production 只在另行確認後使用：

```bash
vercel deploy --prod -y
```

## Staging Smoke Test

部署後逐項驗證：

- `/login`：admin email/password 可登入。
- `/admin`：未登入會導回 login；admin 登入後可看到 dashboard。
- `/forbidden`：已登入但沒有 `admin_profiles` row 的帳號會被拒絕。
- `/admin/work-orders/new`：可建立新工單；`SURFBOARD` 必須選 `boardLengthClass`。
- `/admin/work-orders`：列表、搜尋、狀態 filter、sort、pagination 正常。
- `/admin/work-orders/[id]?mode=edit`：可更新非狀態欄位。
- `/admin/work-orders/[id]?mode=work`：狀態更新成功，且 `SNOWBOARD -> DRYING` 被拒絕。
- `/admin/work-orders/bulk-status`：resolve preview 與批量狀態更新逐筆處理。
- `/repair-status`：正確 `paperOrderNo` + 完整手機可查詢；錯手機回 `404`。
- API error response 保持 `{ error: { code, message, fieldErrors?, requestId } }`。

## 已知 MVP 風險

- Public customer lookup rate limit 目前是 in-memory，只適合 staging / single-instance MVP 驗證，不是 production-grade distributed limiter。
- Print queue model 與 API 已完成，但 Python Print Worker 的 raw USB / Ethernet transport 與 production worker 整合仍 pending。
- `printed` 目前只代表 Worker 已回報成功；是否已與實體熱感出單機穩定整合仍需下一階段實測。
- Staging project 不應承載真實 production 資料；production 應另開 project 並重新設定 env / Auth URLs。

## 完成回報格式

部署執行後回報：

- Vercel deployment URL。
- Supabase project ref（不要貼 secrets）。
- 已設定的 env key 名稱清單（不要貼值）。
- `supabase db push --dry-run` / `supabase db push` 結果。
- 本機檢查與 staging smoke test 結果。
- 尚未完成或阻塞事項。
