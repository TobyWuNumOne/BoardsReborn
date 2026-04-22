# Project Progress

這份文件是本 repo 目前實作狀態與高層里程碑進度的單一事實來源。其他文件如果需要提到目前已完成、尚未完成、下一步或主要風險，應優先連到本文件，而不是各自維護一份容易過時的現況說明。

## 更新規則

- 開始變更前先讀本文件，確認目前階段、已完成項目、下一步與風險。
- 完成變更後，如果實作能力、里程碑狀態、下一步或風險有變化，必須更新本文件。
- 如果其他文件需要提到目前 repo 狀態，保留短摘要即可，詳細現況統一以本文件為準。
- 本文件追蹤的是 repo / implementation progress，不是顧客查詢或工單維修進度；產品層的進度語意仍以 [product.md](product.md) 與 [api-contract.md](api-contract.md) 為準。

## 目前快照

- 最後更新：2026-04-22
- 目前階段：Server API 基礎層已建立，準備進入第一批產品 API endpoint 實作
- 整體狀態：進行中
- 現況摘要：
  - Minimal Nuxt app scaffold 已存在，包含 `app/`、`server/` 與 `tests/` 基本結構。
  - 基礎工具鏈已配置完成：pnpm、Nuxt、TypeScript、ESLint、Prettier、Vitest、`.env.example`。
  - `server/api/` 目錄已建立，但產品 API handlers 尚未實作。
  - Server API 共用基礎層已建立，包含 typed error classes、requestId helper、handler wrapper、typed Supabase client helper 與 admin gate helper。
  - Supabase Database types 已產生於 `types/database.types.ts`。
  - Supabase local config、initial migration 與 seed placeholder 已建立。
  - Admin auth helper 已能檢查 Supabase cookie session 與 `admin_profiles` gate；完整登入 UI / session flow、print-agent implementation 與 production workflow 仍未建立。

## 里程碑

| 里程碑                                 | 狀態    | 說明                                                                            |
| -------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| 核心規格與工程規則文件                 | done    | 產品、domain model、API contract、列印架構與 AI 規則文件已存在。                |
| Minimal Nuxt scaffold 與基礎工具鏈     | done    | app shell、lint、typecheck、Vitest baseline 已建立。                            |
| 進度追蹤與 agent workflow              | done    | 本文件、AGENTS 規範與一致性檢查 skill 已建立。                                  |
| Supabase local stack 與 migrations     | done    | `supabase/config.toml`、initial migration baseline 與 seed placeholder 已建立。 |
| Server API foundation                  | done    | 共用 requestId、typed errors、Supabase client helpers 與 admin gate 已建立。    |
| Admin work-order API                   | pending | `server/api/` 已存在，但產品 endpoint 尚未實作。                                |
| Auth 與管理端流程                      | pending | Admin gate helper 已建立；登入 UI 與完整 session flow 尚未實作。                |
| Barcode / print job API 與 Print Agent | pending | `print_jobs` 相關 API 與 Python Print Agent 仍停留在規格層。                    |
| Customer lookup flow                   | pending | Public lookup contract 已定義，但尚未實作。                                     |
| Production workflow 與部署硬化         | pending | 超出 scaffold baseline 的建置與部署流程尚未建立。                               |

## 已完成

- 產品範圍、資料模型、API contract、條碼列印架構與 AI 開發規則文件。
- Minimal Nuxt 4 scaffold，包含 page、layout、component 與 composable 結構。
- 基礎工具鏈與 scripts：pnpm、Nuxt CLI、ESLint、Prettier、TypeScript、Vitest、typecheck。
- `.env.example` 環境變數範本。
- 一個基礎單元測試，明確固定 scaffold status 的 ready / pending 邊界。
- Supabase baseline：local config、initial schema migration、private `repair-photos` bucket setup、RLS policies 與 seed placeholder。
- Supabase Database types：`types/database.types.ts`。
- Server API 基礎層：typed API errors、shared error envelope helper、`x-request-id` 維護、user-scoped Supabase helper、明確 service-role helper 與 admin gate helper。

## 目前焦點

- 從 Server API foundation 轉入第一批真實產品 API endpoint 實作。
- 使用 generated Database types 與 admin gate helper，開始實作 admin work-order API 與登入/session flow。
- 把 repo 現況描述集中在本文件，避免 README、AGENTS 與任務背景持續漂移。

## 下一步

- 依照既有 contract 實作第一批 admin work-order API。
- 補上登入 UI / session flow，串接已建立的 admin gate helper。
- 定義 `print_jobs` API 與 Python Print Agent 起始骨架。

## 風險與阻塞

- Schema 與部分 status rules 已寫入 migration，但尚未由產品 endpoint 完整串接。
- Docker daemon 已確認可用；本地 `supabase start` 與 `supabase db reset` 已成功跑過。第一次啟動時若遇到 Supabase ECR / CloudFront image 下載 timeout，可改從 Docker Hub 拉同版本 image 後 tag 成 `public.ecr.aws/supabase/*` 名稱再重跑。
- Customer lookup restriction 已寫入規格，但尚未由實際 backend code 強制執行。
- Server API foundation 已建立，但尚未有實際工單 CRUD route 使用它。
- 印表機型號與 production printing workflow 尚未定案，因此 Print Agent 細節仍保持抽象。
