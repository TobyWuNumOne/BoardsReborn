# BoardsReborn

BoardsReborn 是給板再生使用的板類維修進度管理系統。目標是把原本依賴老闆記憶、紙本工單與板子擺放位置的流程，轉成可追蹤、可搜尋、可協作的數位流程，並在後續提供顧客自助查詢進度。

目前 repo 的實作現況、高層里程碑與下一步請以 [docs/progress.md](docs/progress.md) 為準。README 保留啟動方式、工具鏈版本基準與長期有效的開發約束。

## 專案目的

- 讓店內人員能快速查詢每張板子的維修階段。
- 保留收件、報價、狀態變更、照片、取件的完整紀錄。
- 標示超過預估完成日、待取件過久與太久沒開工的工單。
- 條碼內容直接使用紙本工單號，支援掃碼查詢與批量更新狀態。
- 標籤列印採非同步 print job，由固定桌機或樹莓派上的 Print Agent 控制 USB 標籤機。
- 後續開放顧客用工單號與完整手機號碼查詢進度，降低來電詢問成本。

## 技術棧

- Node.js 20.19+
- pnpm 10
- Nuxt 4.1.1
- Vue 3.5.32
- TypeScript 5.9.3
- Tailwind CSS v4
- shadcn-vue primitives
- shadcn-nuxt
- Reka UI
- Nitro server API
- H3 1.15.11
- `@nuxtjs/supabase` 2.0.5
- Supabase Postgres
- Supabase Auth
- Supabase Storage
- Supabase CLI migrations
- Python Print Agent
- systemd
- Vitest 3.2.4
- ESLint 9.39.4
- Prettier 3.8.3

Nuxt 是主系統與 API 層，負責 UI、工單流程、資料存取、建立列印任務與接收列印結果；Nuxt 不負責低階硬體驅動，也不直接從平板瀏覽器控制 USB 標籤機。

### 前端工具鏈版本基準

目前 scaffold 已在以下版本驗證：

| 項目               | 版本 / 規則                      | 備註                                                       |
| ------------------ | -------------------------------- | ---------------------------------------------------------- |
| Node.js            | `>=20.19.0`，本機驗證 `v20.19.3` | 目前不要求 Node 22。                                       |
| pnpm               | `10.13.1`                        | `packageManager` 以此版本為準。                            |
| Nuxt               | `4.1.1`                          | 先固定版本，避免較新依賴鏈要求 Node 22。                   |
| Nitro / Nitropack  | `2.12.6`                         | 透過 `pnpm.overrides` 固定。                               |
| H3                 | `1.15.11`                        | Server API helper 直接使用。                               |
| Nuxt CLI           | `3.28.0`                         | 透過 `pnpm.overrides` 固定，避免 peer dependency 警告。    |
| Vue                | `3.5.32`                         | 由 lockfile 鎖定。                                         |
| Vue Router         | `4.6.4`                          | 由 lockfile 鎖定。                                         |
| TypeScript         | `5.9.3`                          | 由 lockfile 鎖定。                                         |
| Tailwind CSS       | `4.x`                            | 透過 `@tailwindcss/vite` 接入 Nuxt。                       |
| shadcn-vue         | CLI 生成元件                     | `components/ui` 以 CLI 生成 primitives 為主。              |
| shadcn-nuxt        | `2.x`                            | 啟用 shadcn-vue component auto-import。                    |
| `@nuxtjs/supabase` | `2.0.5`                          | 固定啟用 module，讓 server helper 與 DB types alias 可用。 |
| `@nuxt/eslint`     | `1.15.2`                         | Nuxt flat ESLint config。                                  |
| `@nuxt/test-utils` | `3.23.0`                         | Nuxt 測試工具 module。                                     |
| Vitest             | `3.2.4`                          | 由 lockfile 鎖定。                                         |
| ESLint             | `9.39.4`                         | 由 lockfile 鎖定。                                         |
| Prettier           | `3.8.3`                          | 格式化設定見 `.prettierrc`。                               |

實際安裝解析以 `package.json` 與 `pnpm-lock.yaml` 為準。README 不逐項列出所有 shadcn-vue runtime dependency 的 lockfile 版本；若要升級 Nuxt、Nitro、Node、Tailwind、shadcn 相關套件或格式化工具，請同步更新本段、重新執行 `pnpm install`，並至少跑 `pnpm format:check`、`pnpm lint`、`pnpm test`、`pnpm typecheck`、`pnpm build`。

## 本地執行方式

第一次設定：

```bash
pnpm install
cp .env.example .env
pnpm dev
```

預期開發伺服器：

```text
http://localhost:3000
```

`@nuxtjs/supabase` module 固定啟用，讓 server API helper 與 Supabase Database types alias 在建置時可用；未設定 `SUPABASE_URL` / `SUPABASE_KEY` 時會出現 module warning，但實際連線仍需在 `.env` 或部署環境填入。完整實作現況請見 [docs/progress.md](docs/progress.md)；執行 Supabase 指令前請先確認 Supabase CLI 與 Docker daemon 可用。

### Supabase 本地設定

本 repo 已包含 Supabase local config、baseline migration 與 seed placeholder。請先在本機安裝 Supabase CLI 並確認 Docker 可用，再執行：

```bash
supabase start
supabase db reset
```

`supabase db reset` 會套用 `supabase/migrations/*.sql` 並執行 `supabase/seed.sql`。第一版 seed 不包含真實 admin 帳密；請用 Supabase Auth dashboard、CLI 或 SQL 在本地/正式環境手動建立第一個內部使用者，再建立對應 `admin_profiles` row。

本地 Supabase 啟動後，可用 `supabase status` 查看 API URL 與 anon key，填入 `.env` 的 `SUPABASE_URL` 與 `SUPABASE_KEY`。`SUPABASE_SECRET_KEY` 應使用 service role key，只能給 Nitro server API 使用，不可放進 public runtime config 或 client code。

Schema 變更後重新產生 TypeScript Database types：

```bash
pnpm dlx supabase@2.93.0 gen types typescript --local > types/database.types.ts
```

## 環境變數

請在 `.env` 或部署平台環境變數中設定：

| 變數                  | 用途                                                                              | 是否可暴露到瀏覽器 |
| --------------------- | --------------------------------------------------------------------------------- | ------------------ |
| `SUPABASE_URL`        | Supabase project URL                                                              | 是                 |
| `SUPABASE_KEY`        | Supabase publishable key 或 anon key，供 client 與一般 authenticated request 使用 | 是                 |
| `SUPABASE_SECRET_KEY` | Server-only elevated key，只能在 Nitro server API 使用                            | 否                 |
| `NUXT_PUBLIC_APP_URL` | App 對外網址，例如 `http://localhost:3000`                                        | 是                 |
| `ADMIN_EMAIL`         | 第一版管理者帳號 seed 或手動建立時使用                                            | 否                 |
| `ADMIN_PASSWORD`      | 第一版管理者密碼 seed 或手動建立時使用                                            | 否                 |
| `PRINT_AGENT_TOKEN`   | Print Agent 呼叫 Nuxt API 的 Bearer token                                         | 否                 |

`SUPABASE_SECRET_KEY` 不可傳到 client、不可以出現在 public runtime config、不可以寫入 log。
`PRINT_AGENT_TOKEN` 只能存在 server-side 與 Print Agent 環境，不可傳到瀏覽器。

## 專案指令

`package.json` 提供：

```bash
pnpm dev
pnpm build
pnpm preview
pnpm test
pnpm lint
pnpm format
pnpm format:check
pnpm typecheck
```

Supabase CLI 指令：

```bash
supabase start
supabase migration new <name>
supabase db reset
supabase db push
```

## Migration / Seed / Test

- Schema 來源以 `supabase/migrations/*.sql` 為準。
- Seed 來源以 `supabase/seed.sql` 為準。
- 新增或修改資料表、enum、RLS policy、index，都必須附 migration。
- 本地重建資料庫使用 `supabase db reset`，此指令會套用 migrations 並執行 seed。
- 測試至少包含 domain 規則、API contract、狀態歷史 append 行為、顧客查詢限制、條碼批量更新行為、print job 狀態回報。

## 核心文件

- [產品文件](docs/product.md)
  產品需求文件。
- [Domain Model](docs/domain-model.md)
  資料模型文件。
- [API Contract](docs/api-contract.md)
  API 合約文件。
- [條碼與列印架構](docs/barcode-printing.md)
  條碼掃描、非同步列印與 Print Agent 架構文件。
- [專案進度](docs/progress.md)
  repo 現況、高層里程碑與下一步。
- [AI 開發規則](docs/ai-dev-rules.md)
  AI 開發規則文件。
- [AI 任務模板](docs/task-template.md)
  任務模板文件。

## 外部參考

- [Nuxt Supabase module](https://nuxt.com/modules/supabase)
- [Supabase Nuxt quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nuxtjs)
- [Supabase CLI reference](https://supabase.com/docs/reference/cli/getting-started)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Supabase API keys](https://supabase.com/docs/guides/api/api-keys)
