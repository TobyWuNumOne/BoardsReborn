# Project Progress

這份文件是本 repo 目前實作狀態與高層里程碑進度的單一事實來源。其他文件如果需要提到目前已完成、尚未完成、下一步或主要風險，應優先連到本文件，而不是各自維護一份容易過時的現況說明。

## 更新規則

- 開始變更前先讀本文件，確認目前階段、已完成項目、下一步與風險。
- 完成變更後，如果實作能力、里程碑狀態、下一步或風險有變化，必須更新本文件。
- 如果其他文件需要提到目前 repo 狀態，保留短摘要即可，詳細現況統一以本文件為準。
- 本文件追蹤的是 repo / implementation progress，不是顧客查詢或工單維修進度；產品層的進度語意仍以 [product.md](product.md) 與 [api-contract.md](api-contract.md) 為準。

## 目前快照

- 最後更新：2026-04-21
- 目前階段：基礎 scaffold 已完成，準備進入第一批產品實作
- 整體狀態：進行中
- 現況摘要：
  - Minimal Nuxt app scaffold 已存在，包含 `app/`、`server/` 與 `tests/` 基本結構。
  - 基礎工具鏈已配置完成：pnpm、Nuxt、TypeScript、ESLint、Vitest、`.env.example`。
  - `server/api/` 目錄已建立，但產品 API handlers 尚未實作。
  - Supabase local config、migrations、seed、auth flows、print-agent implementation 與 production workflow 仍未建立。

## 里程碑

| 里程碑 | 狀態 | 說明 |
| --- | --- | --- |
| 核心規格與工程規則文件 | done | 產品、domain model、API contract、列印架構與 AI 規則文件已存在。 |
| Minimal Nuxt scaffold 與基礎工具鏈 | done | app shell、lint、typecheck、Vitest baseline 已建立。 |
| 進度追蹤與 agent workflow | done | 本文件、AGENTS 規範與一致性檢查 skill 已建立。 |
| Supabase local stack 與 migrations | pending | 尚未建立 `supabase/config.toml`、migration baseline 或 seed。 |
| Admin work-order API | pending | `server/api/` 已存在，但產品 endpoint 尚未實作。 |
| Auth 與管理端流程 | pending | Supabase Auth 與 admin session flow 尚未實作。 |
| Barcode / print job API 與 Print Agent | pending | `print_jobs` 相關 API 與 Python Print Agent 仍停留在規格層。 |
| Customer lookup flow | pending | Public lookup contract 已定義，但尚未實作。 |
| Production workflow 與部署硬化 | pending | 超出 scaffold baseline 的建置與部署流程尚未建立。 |

## 已完成

- 產品範圍、資料模型、API contract、條碼列印架構與 AI 開發規則文件。
- Minimal Nuxt 4 scaffold，包含 page、layout、component 與 composable 結構。
- 基礎工具鏈與 scripts：pnpm、Nuxt CLI、ESLint、TypeScript、Vitest、typecheck。
- `.env.example` 環境變數範本。
- 一個基礎單元測試，明確固定 scaffold status 的 ready / pending 邊界。

## 目前焦點

- 從 scaffold baseline 轉入第一批真實產品實作。
- 在不假設 Supabase 檔案已存在的前提下，準備資料庫與 API 的起始工作。
- 把 repo 現況描述集中在本文件，避免 README、AGENTS 與任務背景持續漂移。

## 下一步

- 在開始 schema work 時建立 `supabase/config.toml`、migration baseline 與 seed scaffolding。
- 依照既有 contract 實作第一批 admin work-order API。
- 補上 admin auth / session flow。
- 定義 `print_jobs` API 與 Python Print Agent 起始骨架。

## 風險與阻塞

- Schema、status rules 與 customer lookup restriction 已寫入規格，但尚未由實際 backend code 強制執行。
- 在 local Supabase config 與 migrations 建立前，資料模型假設無法用真實資料庫驗證。
- 印表機型號與 production printing workflow 尚未定案，因此 Print Agent 細節仍保持抽象。
