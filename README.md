# BoardsReborn

BoardsReborn 是給板再生使用的板類維修進度管理系統。目標是把原本依賴老闆記憶、紙本工單與板子擺放位置的流程，轉成可追蹤、可搜尋、可協作的數位流程，並在後續提供顧客自助查詢進度。

目前此 repository 先建立必要文件，不包含 Nuxt app scaffold、資料庫 migration 或功能程式碼。

## 專案目的

- 讓店內人員能快速查詢每張板子的維修階段。
- 保留收件、報價、狀態變更、照片、取件的完整紀錄。
- 標示超過預估完成日、待取件過久與太久沒開工的工單。
- 條碼內容直接使用紙本工單號，支援掃碼查詢與批量更新狀態。
- 標籤列印採非同步 print job，由固定桌機或樹莓派上的 Print Agent 控制 USB 標籤機。
- 後續開放顧客用工單號與手機後四碼查詢進度，降低來電詢問成本。

## 技術棧

- Nuxt 4
- Vue 3
- TypeScript
- Nitro server API
- `@nuxtjs/supabase`
- Supabase Postgres
- Supabase Auth
- Supabase Storage
- Supabase CLI migrations
- Python Print Agent
- systemd
- Vitest
- pnpm

Nuxt 是主系統與 API 層，負責 UI、工單流程、資料存取、建立列印任務與接收列印結果；Nuxt 不負責低階硬體驅動，也不直接從平板瀏覽器控制 USB 標籤機。

## 本地執行方式

本專案尚未 scaffold app。建立 app 後，預期本地流程如下：

```bash
pnpm install
supabase start
pnpm dev
```

預期開發伺服器：

```text
http://localhost:3000
```

## 環境變數

建立 app 後，請在 `.env` 或部署平台環境變數中設定：

| 變數                  | 用途                                                                  | 是否可暴露到瀏覽器 |
| --------------------- | --------------------------------------------------------------------- | ------------------ |
| `SUPABASE_URL`        | Supabase project URL                                                  | 是                 |
| `SUPABASE_KEY`        | Supabase publishable key，供 client 與一般 authenticated request 使用 | 是                 |
| `SUPABASE_SECRET_KEY` | Server-only elevated key，只能在 Nitro server API 使用                | 否                 |
| `NUXT_PUBLIC_APP_URL` | App 對外網址，例如 `http://localhost:3000`                            | 是                 |
| `ADMIN_EMAIL`         | 第一版管理者帳號 seed 或手動建立時使用                                | 否                 |
| `ADMIN_PASSWORD`      | 第一版管理者密碼 seed 或手動建立時使用                                | 否                 |
| `PRINT_AGENT_TOKEN`   | Print Agent 呼叫 Nuxt API 的 Bearer token                              | 否                 |

`SUPABASE_SECRET_KEY` 不可傳到 client、不可以出現在 public runtime config、不可以寫入 log。
`PRINT_AGENT_TOKEN` 只能存在 server-side 與 Print Agent 環境，不可傳到瀏覽器。

## 預期指令

建立 app 後，`package.json` 應提供：

```bash
pnpm dev
pnpm build
pnpm preview
pnpm test
pnpm lint
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
