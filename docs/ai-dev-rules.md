# AI Development Rules

這份文件是給 AI agent 與工程協作者看的硬性規則。除非任務明確要求修改本文件，否則不得忽略。

## 最高原則

- 先讀相關文件，再改程式。
- 不可擴張 MVP scope。
- 不可任意改 schema 命名、enum 命名、API endpoint 命名。
- 所有會影響資料庫的功能都必須附 Supabase migration。
- API 行為改變必須同步更新 [API contract](api-contract.md)。
- Domain 規則改變必須同步更新 [domain model](domain-model.md)。
- 產品範圍改變必須同步更新 [product spec](product.md)。

## Schema / Migration

- Schema 來源以 `supabase/migrations/*.sql` 為準。
- Seed 來源以 `supabase/seed.sql` 為準。
- 新增、刪除、改名資料表或欄位，必須建立 migration。
- 新增或修改 enum/check constraint，必須建立 migration。
- 新增或修改 RLS policy，必須建立 migration。
- 新增查詢常用 filter/sort 欄位時，必須評估 index。
- 不可只改 TypeScript 型別而不改 migration。
- 不可在沒有明確任務要求時重命名既有欄位。

## Supabase / Security

- 所有核心資料表都必須 enable row level security。
- 顧客查詢不得直接開放 Supabase table read。
- 顧客查詢必須走 Nuxt server API，並驗證工單號與完整手機號碼。
- 條碼 payload 一律使用 `paper_order_no`，不可再引入第二套主要識別碼。
- `PRINT_WORKER_TOKEN` 只能存在 server-side 與 Print Worker 環境，不可傳到 client。
- Print Worker API 必須驗證 `Authorization: Bearer <PRINT_WORKER_TOKEN>`，且 request body 需帶合法 `deviceKey`。
- `SUPABASE_SECRET_KEY` 只能在 server-side 使用。
- Service-role Supabase client 只能由明確 server-only helper 匯出；一般 admin route helper 不可自動 fallback 到 service-role client。
- 不可把 server-only key 放進 public runtime config。
- 不可把 server-only key 傳到 client、console、response、log 或錯誤訊息。
- 管理端 API 必須檢查 Supabase Auth session。
- 管理端 API gate 不能只檢查 Auth user；必須查 `admin_profiles.id = auth user sub`。查詢 admin profile 時只取最小必要欄位；若 schema 已有 active 狀態欄位，必須一併檢查。

## Frontend Toolchain

- 前端工具鏈版本基準記錄在 [README](../README.md)。
- 修改 Node、pnpm、Nuxt、Nitro、Vue、TypeScript、ESLint、Prettier、Vitest 或 Nuxt module 版本時，必須同步更新 README 的版本基準。
- 目前 Nuxt 與 Nitro 版本是為 Node 20.19 相容性固定；升級到要求 Node 22 的依賴鏈前，必須先明確更新 `engines.node` 與 README。
- `package.json` 與 `pnpm-lock.yaml` 是實際安裝來源；文件不得宣稱未在 lockfile 中固定或驗證的版本。

## Status Rules

- 狀態變更只能 append `status_history`。
- 不可只更新 `work_orders.current_status` 當作狀態變更。
- `work_orders.current_status` 若存在，只能作為 latest status cache。
- 新建工單必須建立第一筆 `status_history`，狀態為 `RECEIVED`。
- `SNOWBOARD` 不可進入 `DRYING`。
- 進入 `READY_FOR_PICKUP`、`DELIVERED`、`CANCELLED` 時，必須同步維護對應時間欄位。
- 批量狀態更新必須對每張工單 individually append `status_history`，不可批量覆寫當前狀態而不留歷史。
- `overdueEstimatedCompletion`、`pickupOverdue`、`staleReceived` 是衍生標記，不是正式狀態，不可寫回 enum。

## File Upload / Photos

- 檔案上傳必須走 Supabase Storage。
- 不可把照片或影片 base64 直接塞進資料庫。
- `photos` table 只存 bucket、path、type、visibility、metadata。
- 第一版顧客查詢不回傳照片。
- 照片 visibility 預設 `INTERNAL`。
- 影片不是第一版範圍。

## API Rules

- API contract 是 Nuxt Nitro server API。
- 不可把 Supabase auto-generated API 當公開產品 contract。
- 所有 list API 都必須支援 filter、sort、pagination。
- List response 必須使用 `{ data, pageInfo }`。
- Error response 必須使用 `{ error: { code, message, fieldErrors?, requestId } }`。
- `requestId` 優先使用 request header `x-request-id`；缺少時使用 `crypto.randomUUID()` 產生，並寫回 response header 與錯誤 envelope。
- 已知 API 錯誤必須用 typed error classes 表示，不可在 route handler 裡散落字串判斷。
- `fieldErrors` 統一為 `Record<string, string[]>`。
- Request / response 範例更新時必須保持合法 JSON。
- 照片上傳例外使用 `multipart/form-data`，但 response 仍使用 JSON。
- 顧客查詢手機號碼錯誤時，應回傳 `404`，避免透露工單存在性。

## Barcode / Printing Rules

- Nuxt 是主系統與 API 層，不是硬體驅動層。
- 掃碼走 keyboard wedge 模式，條碼槍輸入 `paper_order_no`。
- 列印走非同步 `print_jobs`，不可要求建立工單必須同步列印成功。
- 平板瀏覽器不可直接控制 USB 印表機。
- 第一版已驗證硬體 profile 以 `ESC/POS` 80mm 熱感出單機為主，但仍不可綁死單一品牌 SDK。
- 列印渲染與 transport 必須分離；不可把 ESC/POS command bytes 散落在 worker 主流程。
- Prowill PD-X326 已驗證在 Raspberry Pi raw USB ESC/POS 下可用 CP950 / Big5 列印繁體中文；直接送 UTF-8 會亂碼。
- 若列印模板加入中文可列印文字，renderer 必須先進入中文模式 `FS &` (`\x1C\x26`)，並以 `text.encode("cp950", errors="replace")` 產生文字 bytes，不可用 UTF-8 直送。
- 條碼 payload 必須維持 ASCII-only `paper_order_no`；不可把 `barcodeValue` 以 CP950 或其他中文字編碼處理。
- 工單標籤使用工單號文字與 1D barcode；顧客留存聯可使用 QR Code 導向公開查詢頁。
- 第一版主系統的 `print_job_status` 以 queue 為主：`pending`、`locked`、`printing`、`printed`、`failed`、`cancelled`。
- Worker claim 必須是原子操作，避免多個 worker 同時取走同一筆 job。
- 補印必須建立新的 `print_jobs` 記錄，不可覆蓋舊列印任務。

## LINE Integration Rules

- LINE PR 1 至 PR 12 已實作且 production Cron 已啟用；手動補發與其他非目標功能仍不得宣稱完成。
- 綁定基數必須是 `1 LINE : 1 Customer` 與 `1 Customer : 1 LINE`；confirm 不得覆蓋既有其他綁定。
- 顧客端不可解除綁定。解除只能由 admin hard delete，目前不建立完整 binding history 或 audit subsystem。
- 明文 bind token 必須由 `token row UUID + LINE_BIND_TOKEN_SECRET` 以 deterministic HMAC 產生；DB 只存 hash。
- 明文 bind token 不得持久化到 `print_jobs.payload`、其他 table 或 log。active pending token 的 LIFF URL只能由 server 暫時重建。
- `LINE_BIND_TOKEN_SECRET`、`LINE_JOB_PROCESSOR_SECRET`、channel secrets 與 access token 都是 server-only；不得出現在 query string、public runtime config、client、response 或 log。只有 LIFF ID 與官方帳號 URL 可使用 `NUXT_PUBLIC_`。
- Server 不得信任 client 傳入的 LINE user ID 或 profile；必須驗證 LINE ID token 後取得可信身分。
- Webhook 必須以 raw body 驗證 `x-line-signature` 後才處理 follow / unfollow。
- LINE 推播必須經 `line_jobs` Outbox；不得把 Messaging API request 放進核心同步 transaction。
- 第一次送出前必須重新解析目前綁定並凍結 recipient、payload、retry key；retry 必須重用同一 `X-Line-Retry-Key`。
- LINE API accepted 不得在 UI 或 log 描述為顧客已收到或已讀。
- 自動 READY job 每張工單只建立一次；成功後才以 `coalesce(notified_at, sent_at)` 維護 `work_orders.notified_at`。
- 啟用 production Cron 前，必須完成 LINE secrets、Supabase Vault、Provider/channel linking、LIFF endpoint 與 status-domain routing checklist。

## Product Scope

第一版不做：

- 會計報表。
- 租借管理。
- 會員系統。
- 金流。
- 寄賣。
- 庫存管理。
- 多店管理。
- 板子的歷史維修彙整頁。
- 自動寄板費計算。
- 顧客修改狀態。
- 顧客觀看影片。
- 平板瀏覽器直接控制 USB 印表機。
- 綁死單一品牌印表機 SDK。
- 完整微服務或複雜訊息佇列。
- LINE Pay、完整 LINE 會員中心、顧客端解除綁定、手動補發 API。
- AI 客服、LINE 群發行銷、顧客照片自動入庫。
- 完整 `line_message_logs`、retention worker、Customer 詳情頁重工。

如果任務要求碰到上述項目，必須先更新產品文件或要求重新確認 scope。

## Testing Requirements

PR 或任務完成時，至少說明：

- 做了哪些變更。
- 是否有 migration。
- 是否更新 API contract。
- 測了哪些案例。
- 哪些測試沒有跑，以及原因。

涉及以下行為時必須有測試：

- 工單建立。
- 狀態 append history。
- `SNOWBOARD` 禁止 `DRYING`。
- list API pagination/filter/sort。
- 顧客工單查詢。
- 照片 metadata 建立與 Storage upload error handling。
- print job 建立、claim、success/fail 回報與 retry。

## PR Summary Requirements

每個 PR 必須包含：

- 變更摘要。
- 測試摘要。
- Migration 摘要，若無 migration 要明確寫無。
- API contract 更新摘要，若無 API 變更要明確寫無。
- 風險或待確認事項。
