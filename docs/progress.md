# Project Progress

這份文件是本 repo 目前實作狀態與高層里程碑進度的單一事實來源。其他文件如果需要提到目前已完成、尚未完成、下一步或主要風險，應優先連到本文件，而不是各自維護一份容易過時的現況說明。

## 更新規則

- 開始變更前先讀本文件，確認目前階段、已完成項目、下一步與風險。
- 完成變更後，如果實作能力、里程碑狀態、下一步或風險有變化，必須更新本文件。
- 如果其他文件需要提到目前 repo 狀態，保留短摘要即可，詳細現況統一以本文件為準。
- 本文件追蹤的是 repo / implementation progress，不是顧客查詢或工單維修進度；產品層的進度語意仍以 [product.md](product.md) 與 [api-contract.md](api-contract.md) 為準。

## 目前快照

- 最後更新：2026-05-05
- 目前階段：admin 主流程與 public customer lookup 第一版已建立，工單板子資訊已補 surfboard 長度分類與顏色 projection，下一步往列印流程與前端第二版細節調整推進
- 整體狀態：進行中
- 現況摘要：
  - Minimal Nuxt app scaffold 已存在，包含 `app/`、`server/` 與 `tests/` 基本結構。
  - 基礎工具鏈已配置完成：pnpm、Nuxt、TypeScript、ESLint、Prettier、Vitest、`.env.example`。
  - `server/api/` 已有 admin session、customer lookup、public lookup 與 work-order create/list/detail/update/status/resolve/bulk-status handlers。
  - Server API 共用基礎層已建立，包含 typed error classes、requestId helper、handler wrapper、typed Supabase client helper 與 admin gate helper。
  - 前端已導入 Tailwind CSS v4、shadcn-vue primitives、`shadcn-nuxt` 與 SSR width baseline。
  - `/`、`/login`、`/admin`、`/forbidden` 已重整到 Tailwind/shadcn 基礎；`/admin/work-orders` 已可查詢、篩選、排序與分頁，`/admin/work-orders/[id]` 已提供 `mode=view|edit|work` detail route，且 `mode=edit` 已接上 PATCH；`/admin/work-orders/new` 已接上 lookup-first 現場建單流程；`/admin/work-orders/bulk-status` 已接上 preview 搜尋與批量狀態更新。
  - `board_length_class` 已加入 schema 與 admin create/list/detail；衝浪板建單需選短板 / 中尺寸 / 長板，既有 legacy null 在 UI 顯示為 `—`。
  - `board_color` 已加入 `admin_work_order_list` projection 與 admin resolve preview；工單列表與 bulk status preview 會顯示顏色 swatch + label。
  - `/repair-status` 已接上 public customer lookup API，顯示公開進度、預估完成日、初始報價、公開備註與最近更新時間。
  - `/admin` 已接上 dashboard live data，第一版顯示互動式處理中工單 breakdown、管理 summary 與 Quick entries。
  - 目前 admin 前端頁面屬第一版方向雛形：主要流程、版位與資料結構已建立，但欄位編排、文案、資訊層級與操作細節仍預期在與甲方討論後進入第二版調整。
  - Frontend strategy 已記錄於 [frontend.md](frontend.md)。
  - Supabase Database types 已產生於 `types/database.types.ts`。
  - Supabase local config、initial migration 與 seed placeholder 已建立。
  - Admin auth/session flow 已能區分 anonymous、forbidden、admin 三種狀態；print-agent implementation 與 production workflow 仍未建立。
- 本機 HTTP 開發環境已明確關閉 Supabase secure auth cookie，避免 SSR session bootstrap 在 `localhost` / `127.0.0.1` 上反覆 `401`。
- 目前已停用 Nuxt `experimental.appManifest`，避免本機開發環境出現 `/_nuxt/builds/meta/dev.json` 404 並直接觸發整頁 Nuxt error page。

## 里程碑

| 里程碑                                 | 狀態    | 說明                                                                                                                                                  |
| -------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 核心規格與工程規則文件                 | done    | 產品、domain model、API contract、列印架構與 AI 規則文件已存在。                                                                                      |
| Minimal Nuxt scaffold 與基礎工具鏈     | done    | app shell、lint、typecheck、Vitest baseline 已建立。                                                                                                  |
| 進度追蹤與 agent workflow              | done    | 本文件、AGENTS 規範與一致性檢查 skill 已建立。                                                                                                        |
| Supabase local stack 與 migrations     | done    | `supabase/config.toml`、initial migration baseline 與 seed placeholder 已建立。                                                                       |
| Server API foundation                  | done    | 共用 requestId、typed errors、Supabase client helpers 與 admin gate 已建立。                                                                          |
| Admin work-order API                   | partial | Create/list/detail/update/status/resolve/bulk-status 與 customer lookup 已建立；print 仍未實作。                                                      |
| Auth 與管理端流程                      | done    | Admin gate helper、session endpoint、login/logout UI、admin middleware 與 session bootstrap 已建立。                                                  |
| Frontend strategy / UI foundation      | done    | Tailwind CSS v4、shadcn-vue primitives、admin shell、dashboard summary 與 frontend rules 已建立。                                                     |
| Admin work-order list UI               | done    | `/admin/work-orders` 已接上 list API、URL query state、table/card list 與 detail 導頁。                                                               |
| Admin work-order detail UI             | partial | `/admin/work-orders/[id]` 已接上 detail API 與 `view/edit/work` mode；`view`、`edit` 與 `work` 皆已有第一版可用雛形，細節仍待與甲方討論後進二版調整。 |
| Admin work-order create UI             | done    | `/admin/work-orders/new` 已接上 lookup-first 建單流程、日期預設、初始報價與成功導向 detail。                                                          |
| Admin bulk status UI                   | done    | `/admin/work-orders/bulk-status` 已接上 preview 搜尋、共享狀態更新、分組快捷操作與批量結果摘要。                                                      |
| Barcode / print job API 與 Print Agent | pending | `print_jobs` 相關 API 與 Python Print Agent 仍停留在規格層。                                                                                          |
| Customer lookup flow                   | done    | `POST /api/public/work-orders/lookup` 與 `/repair-status` 已建立，支援 server-generated progress 與 basic rate limit。                                |
| Production workflow 與部署硬化         | pending | 超出 scaffold baseline 的建置與部署流程尚未建立。                                                                                                     |

## 已完成

- 產品範圍、資料模型、API contract、條碼列印架構與 AI 開發規則文件。
- Minimal Nuxt 4 scaffold，包含 page、layout、component 與 composable 結構。
- 基礎工具鏈與 scripts：pnpm、Nuxt CLI、ESLint、Prettier、TypeScript、Vitest、typecheck。
- `.env.example` 環境變數範本。
- 一個基礎單元測試，明確固定 scaffold status 的 ready / pending 邊界。
- Supabase baseline：local config、initial schema migration、private `repair-photos` bucket setup、RLS policies 與 seed placeholder。
- Supabase Database types：`types/database.types.ts`。
- Server API 基礎層：typed API errors、shared error envelope helper、`x-request-id` 維護、user-scoped Supabase helper、明確 service-role helper 與 admin gate helper。
- Admin session endpoint：`GET /api/admin/session`。
- Admin customer lookup：`GET /api/admin/customers/lookup`。
- Admin work-order API：create/list/detail/update/status/resolve/bulk-status。
- Admin work-order create RPC：原子建立 customer、work_order、第一筆 status_history 與 quote_items，不建立 print_jobs。
- Admin work-order status RPC：原子 append `status_history`、同步 `work_orders.current_status`，並維護 ready/delivered/cancelled timestamp。
- Admin bulk status API：以 `paperOrderNos` 批量更新狀態，回傳 `requestedCount`、`dedupedCount`、`updatedCount`、`skippedCount` 與逐筆結果；未知錯誤時立即停止後續處理。
- Login / session UI：`/login`、`/admin`、`/forbidden`、admin middleware、admin layout bootstrap 與 logout action。
- Local auth cookie hardening：Supabase SSR cookie 依 app URL protocol 決定 `secure`，避免本機 HTTP 開發時瀏覽器拒收 auth cookie。
- Frontend UI foundation：Tailwind CSS v4、`@tailwindcss/vite`、shadcn-vue primitives、`shadcn-nuxt`、SSR width plugin、Tailwind/shadcn 重整後的 homepage / login / forbidden / admin placeholder。
- Frontend strategy spec：`docs/frontend.md`，定義 admin route map、layout、data access、form validation、feedback、列表與狀態 badge 規則。
- Admin work-order list UI：URL query canonicalization middleware、read-only 工單列表、提醒 badges、桌機 table / 手機 card list 與 detail placeholder route。
- Admin work-order list rendering fix：改為顯式 import `work-orders` 目錄下的列表與 badge 元件，排除 Nuxt auto-import 前綴不符造成「總數正確但列表不顯示」的回歸。
- Admin work-order detail UI：單一路由 detail page、`mode=view|edit|work` query canonicalization、detail data keyed only by id、view mode 只讀區塊、edit mode PATCH 表單、work mode 狀態更新卡與 404/422 分流已建立。
- Admin work-order create UI：單頁現場收件建單頁、lookup-first 顧客流程、`intakeDate -> estimatedCompletionDate` 預設規則、初始報價映射與成功導向 detail 已建立。
- Surfboard 長度分類：`board_length_class` schema、create validation、create/list/detail API mapping 與 admin create/list/detail UI 顯示已建立。
- Admin bulk status UI：獨立 `/admin/work-orders/bulk-status` 頁面、resolve fan-out preview、共享狀態 select、依狀態分組的快捷操作與最近一次批量結果摘要已建立。
- Bulk preview / 工單列表資訊密度升級：`resolve` preview 已補顧客電話、長度分類、顏色、預估完成日與提醒 flags；bulk status 與工單列表都會顯示顏色 swatch。
- Public customer lookup：`POST /api/public/work-orders/lookup` 與 `/repair-status` 已建立，使用完整手機號碼驗證、server-generated progress timeline / cancelled state 與 MVP in-memory rate limit。
- Admin dashboard quick entries：已接上工單列表與建單頁入口，排除 create entry 仍停留 disabled placeholder 的不一致狀態。
- Admin sidebar navigation：已補上 bulk status 入口，讓現場批量操作不只依賴 dashboard quick entry 與列表頁 header。
- Admin dashboard quick entries：已再補上 bulk status 入口。
- Admin dashboard live data：`/admin` 已接上真實 summary metrics，第一版顯示互動式處理中工單 breakdown、待取件、逾期與今日新建。
- Admin responsive breakpoint tuning：sidebar desktop breakpoint 與工單列表 table breakpoint 已同步上移到 `xl`，避免 `768px~1279px` 區間同時顯示固定 sidebar 與 table 造成內容擠壓。
- Admin 前端第一版雛形：列表與詳情頁的主要流程、資料顯示與基本操作骨架已到位，可作為後續與甲方討論 UI/流程細節的基礎。

## 目前焦點

- 在 `docs/frontend.md` 的規範下延續 admin 前端主流程。
- 盤點第一版 admin 前端雛形的欄位、文案與互動細節，準備與甲方確認後整理第二版調整清單。
- 盤點列印流程與既有 detail / create / bulk status / public lookup 頁面的銜接方式。
- 使用 generated Database types、admin gate helper 與 create RPC 延續後續 API 實作。
- 把 repo 現況描述集中在本文件，避免 README、AGENTS 與任務背景持續漂移。

## 下一步

- 與甲方確認 detail / list / dashboard 的資訊優先序與操作節奏，整理前端第二版調整項目。
- 實作列印任務 API 與 Python Print Agent 起始骨架。
- 盤點 detail / create / bulk status / public lookup 與後續列印流程之間的 UI / 操作銜接。

## Frontend Strategy 待辦

- [x] 新增 `docs/frontend.md` 作為 MVP 前端設計與實作規範。
- [x] 定案前端方向為 Nuxt 4 + Tailwind CSS + shadcn-vue。
- [x] 定案 admin route map、layout、work order list 呈現、status badge、UI state 與 component boundaries。
- [x] 安裝 Tailwind CSS / shadcn-vue，並更新 README 工具鏈基線。
- [x] 重整既有 homepage / login / forbidden / admin placeholder 到新 styling strategy。
- [x] 實作 admin dashboard live data。
- [x] 實作 work order list page。
- [x] 實作 work order detail page（`view` 完整）。
- [x] 接上 work order detail page 的 `edit` PATCH 表單。
- [x] 接上 work order detail page 的 `work` mode 狀態操作。
- [x] 實作 work order create page。
- [x] 實作 bulk status UI。

## Login / Session UI 待辦

- [x] 建立最小登入頁，支援 Supabase email/password sign-in。
- [x] 建立前端 Supabase auth helper / composable，集中管理 session 狀態與登入登出呼叫。
- [x] 建立 admin route middleware，未登入時導回登入頁。
- [x] 建立 admin layout 的 session bootstrap，載入目前登入狀態並處理 loading / ready state。
- [x] 串接既有 admin gate 規則，登入成功但非 `admin_profiles` 使用者時顯示禁止存取狀態。
- [x] 提供 logout action，清除 session 後返回登入頁。
- [x] 補最小 UI 驗證流程：未登入導轉、已登入可進 admin 頁、登出後失效。
- [x] 更新 `docs/progress.md` 與必要的 auth / frontend 文件，標記 login / session UI 完成狀態。

## 風險與阻塞

- Schema 與 status rules 已寫入 migration；create/list/detail/update/status/resolve/bulk-status 已串接，列印相關 endpoint 尚未建立。
- Admin 單筆 detail/update/status endpoint 保留 UUID path 作為 internal resource identity；現場掃碼或人工輸入紙本工單號時，前端應先呼叫 `GET /api/admin/work-orders/resolve?paperOrderNo=...` 取得 UUID，再呼叫既有 UUID-based endpoint。
- Docker daemon 已確認可用；本地 `supabase start` 與 `supabase db reset` 已成功跑過。第一次啟動時若遇到 Supabase ECR / CloudFront image 下載 timeout，可改從 Docker Hub 拉同版本 image 後 tag 成 `public.ecr.aws/supabase/*` 名稱再重跑。
- Public customer lookup 已落地，但目前 rate limit 採 in-memory store，只適用 local / single-instance MVP，未達 production-grade distributed limiter。
- 工單建立目前不建立 `print_jobs`；列印任務會在後續獨立流程補上。
- 既有 legacy `SURFBOARD` 工單可能尚未有 `board_length_class`；目前 list / detail 會顯示 `—`，這次沒有補 edit flow 或 backfill。
- Admin 前端目前已有 Tailwind/shadcn shell、dashboard summary、工單列表、detail 的 `view/edit/work`、建單頁與 bulk status 第一版；列印相關 UI 仍待實作。
- Admin 前端目前仍屬第一版雛形；雖然大方向與主流程已可展示，但欄位配置、文案、資訊密度、互動回饋與模式切換細節尚未定案，預期需在與甲方討論後進行第二版調整。
- Nuxt 4 在此專案目前的本機開發組合下，`experimental.appManifest` 會導致 `/_nuxt/builds/meta/dev.json` 404；目前已先關閉這個實驗功能，以穩定開發中的 admin 頁面導航與刷新行為。
- shadcn-vue latest 的 `reka-vega` style registry base style 在初始化時回 404；本次以 `--no-base-style` 初始化並依官方 neutral theme scaffold 手動補齊 global CSS tokens。
- 印表機型號與 production printing workflow 尚未定案，因此 Print Agent 細節仍保持抽象。
