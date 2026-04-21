# BoardsReborn

BoardsReborn 是給板再生使用的板類維修進度管理系統。目標是把原本依賴老闆記憶、紙本工單與板子擺放位置的流程，轉成可追蹤、可搜尋、可協作的數位流程，並在後續提供顧客自助查詢進度。

目前此 repository 已建立 Nuxt app scaffold 與基礎工具鏈，但尚未包含 Supabase migration、資料庫 seed 或產品功能程式碼。

## 專案目的

- 讓店內人員能快速查詢每張板子的維修階段。
- 保留收件、報價、狀態變更、照片、取件的完整紀錄。
- 標示超過預估完成日、待取件過久與太久沒開工的工單。
- 條碼內容直接使用紙本工單號，支援掃碼查詢與批量更新狀態。
- 標籤列印採非同步 print job，由固定桌機或樹莓派上的 Print Agent 控制 USB 標籤機。
- 後續開放顧客用工單號與手機後四碼查詢進度，降低來電詢問成本。

## 技術棧

- Node.js 20.19+
- pnpm 10
- Nuxt 4.1.1
- Vue 3.5.32
- TypeScript 5.9.3
- Nitro server API
- `@nuxtjs/supabase` 2.0.5
- Supabase Postgres
- Supabase Auth
- Supabase Storage
- Supabase CLI migrations
- Python Print Agent
- systemd
- Vitest 3.2.4
- ESLint 9.39.4

Nuxt 是主系統與 API 層，負責 UI、工單流程、資料存取、建立列印任務與接收列印結果；Nuxt 不負責低階硬體驅動，也不直接從平板瀏覽器控制 USB 標籤機。

### 前端工具鏈版本基準

目前 scaffold 已在以下版本驗證：

| 項目 | 版本 / 規則 | 備註 |
| --- | --- | --- |
| Node.js | `>=20.19.0`，本機驗證 `v20.19.3` | 目前不要求 Node 22。 |
| pnpm | `10.13.1` | `packageManager` 以此版本為準。 |
| Nuxt | `4.1.1` | 先固定版本，避免較新依賴鏈要求 Node 22。 |
| Nitro / Nitropack | `2.12.6` | 透過 `pnpm.overrides` 固定。 |
| Nuxt CLI | `3.28.0` | 透過 `pnpm.overrides` 固定，避免 peer dependency 警告。 |
| Vue | `3.5.32` | 由 lockfile 鎖定。 |
| Vue Router | `4.6.4` | 由 lockfile 鎖定。 |
| TypeScript | `5.9.3` | 由 lockfile 鎖定。 |
| `@nuxtjs/supabase` | `2.0.5` | 有 `SUPABASE_URL` 與 `SUPABASE_KEY` 時才啟用 module。 |
| `@nuxt/eslint` | `1.15.2` | Nuxt flat ESLint config。 |
| `@nuxt/test-utils` | `3.23.0` | Nuxt 測試工具 module。 |
| Vitest | `3.2.4` | 由 lockfile 鎖定。 |
| ESLint | `9.39.4` | 由 lockfile 鎖定。 |

實際安裝解析以 `package.json` 與 `pnpm-lock.yaml` 為準。若要升級 Nuxt、Nitro 或 Node，請同步更新本段、重新執行 `pnpm install`，並至少跑 `pnpm lint`、`pnpm test`、`pnpm typecheck`、`pnpm build`。

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

`@nuxtjs/supabase` module 會在 `SUPABASE_URL` 與 `SUPABASE_KEY` 有值時啟用。資料庫 schema、Supabase CLI config 與 migrations 尚未建立；完成這些檔案後，才把 `supabase start` 納入必跑流程。

## 環境變數

請在 `.env` 或部署平台環境變數中設定：

| 變數                  | 用途                                                                  | 是否可暴露到瀏覽器 |
| --------------------- | --------------------------------------------------------------------- | ------------------ |
| `SUPABASE_URL`        | Supabase project URL                                                  | 是                 |
| `SUPABASE_KEY`        | Supabase publishable key 或 anon key，供 client 與一般 authenticated request 使用 | 是                 |
| `SUPABASE_SECRET_KEY` | Server-only elevated key，只能在 Nitro server API 使用                | 否                 |
| `NUXT_PUBLIC_APP_URL` | App 對外網址，例如 `http://localhost:3000`                            | 是                 |
| `ADMIN_EMAIL`         | 第一版管理者帳號 seed 或手動建立時使用                                | 否                 |
| `ADMIN_PASSWORD`      | 第一版管理者密碼 seed 或手動建立時使用                                | 否                 |
| `PRINT_AGENT_TOKEN`   | Print Agent 呼叫 Nuxt API 的 Bearer token                              | 否                 |

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
pnpm typecheck
```

Supabase CLI 指令尚未啟用為本專案工具鏈的一部分；建立 `supabase/config.toml`、migrations 與 seed 後，預期會使用：

```bash
supabase start
supabase migration new <name>
supabase db reset
supabase db push
```

## Migration / Seed / Test

- Schema 來源以 `supabase/migrations/*.sql` 為準。
- Seed 來源以 `supabase/seed.sql` 為準。
- 目前尚未建立 Supabase migrations 或 seed。
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
