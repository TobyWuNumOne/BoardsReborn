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
- 顧客查詢必須走 Nuxt server API，並驗證工單號與手機後四碼。
- 條碼 payload 一律使用 `paper_order_no`，不可再引入第二套主要識別碼。
- `PRINT_AGENT_TOKEN` 只能存在 server-side 與 Print Agent 環境，不可傳到 client。
- Print Agent API 必須驗證 `Authorization: Bearer <PRINT_AGENT_TOKEN>`。
- `SUPABASE_SECRET_KEY` 只能在 server-side 使用。
- 不可把 server-only key 放進 public runtime config。
- 不可把 server-only key 傳到 client、console、response、log 或錯誤訊息。
- 管理端 API 必須檢查 Supabase Auth session。

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
- Error response 必須使用 `{ error: { code, message, fieldErrors?, requestId? } }`。
- Request / response 範例更新時必須保持合法 JSON。
- 照片上傳例外使用 `multipart/form-data`，但 response 仍使用 JSON。
- 顧客查詢手機後四碼錯誤時，應回傳 `404`，避免透露工單存在性。

## Barcode / Printing Rules

- Nuxt 是主系統與 API 層，不是硬體驅動層。
- 掃碼走 keyboard wedge 模式，條碼槍輸入 `paper_order_no`。
- 列印走非同步 `print_jobs`，不可要求建立工單必須同步列印成功。
- 平板瀏覽器不可直接控制 USB 標籤機。
- 不可綁死單一品牌 SDK；優先使用 TSPL/ZPL/EPL/DPL 原始列印語言。
- 不可把列印結果簡化成單一 `success: true/false`。
- 寫入 USB 成功只能回報 `SENT_TO_PRINTER`，不可直接視為貼紙已成功吐出。
- 補印必須建立新的 `print_jobs` 記錄，不可覆蓋舊列印任務。

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
- 平板瀏覽器直接控制 USB 標籤機。
- 綁死單一品牌標籤機 SDK。
- 完整微服務或複雜訊息佇列。

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
- print job 建立、claim、result 回報與 retry。

## PR Summary Requirements

每個 PR 必須包含：

- 變更摘要。
- 測試摘要。
- Migration 摘要，若無 migration 要明確寫無。
- API contract 更新摘要，若無 API 變更要明確寫無。
- 風險或待確認事項。
