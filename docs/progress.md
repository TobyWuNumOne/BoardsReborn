# Project Progress

這份文件是本 repo 目前實作狀態與高層里程碑進度的單一事實來源。其他文件如果需要提到目前已完成、尚未完成、下一步或主要風險，應優先連到本文件，而不是各自維護一份容易過時的現況說明。

## 更新規則

- 開始變更前先讀本文件，確認目前階段、已完成項目、下一步與風險。
- 完成變更後，如果實作能力、里程碑狀態、下一步或風險有變化，必須更新本文件。
- 如果其他文件需要提到目前 repo 狀態，保留短摘要即可，詳細現況統一以本文件為準。
- 本文件追蹤的是 repo / implementation progress，不是顧客查詢或工單維修進度；產品層的進度語意仍以 [product.md](product.md) 與 [api-contract.md](api-contract.md) 為準。

## 目前快照

- 最後更新：2026-05-25
- 目前階段：admin 主流程、public customer lookup、第一版列印中心 UI 與 `printer-worker` connectivity worker 已建立；下一步往樹莓派 smoke test、device provisioning、CUPS 與實機列印驗證推進
- 整體狀態：進行中
- 現況摘要：
  - Minimal Nuxt app scaffold 已存在，包含 `app/`、`server/` 與 `tests/` 基本結構。
  - 基礎工具鏈已配置完成：pnpm、Nuxt、TypeScript、ESLint、Prettier、Vitest、`.env.example`。
  - `server/api/` 已有 admin session、customer lookup、public lookup、work-order create/list/detail/update/status/resolve/bulk-status，以及 admin / print-worker 列印 handlers 與 `print-devices` 管理 handlers。
  - Server API 共用基礎層已建立，包含 typed error classes、requestId helper、handler wrapper、typed Supabase client helper 與 admin gate helper。
  - 前端已導入 Tailwind CSS v4、shadcn-vue primitives、`shadcn-nuxt` 與 SSR width baseline。
  - `/`、`/login`、`/admin`、`/forbidden` 已重整到 Tailwind/shadcn 基礎；`/admin/work-orders` 已可查詢、篩選、排序與分頁，`/admin/work-orders/[id]` 已提供 `mode=view|edit|work` detail route，且 `mode=edit` 已接上 PATCH；`/admin/work-orders/new` 已接上 lookup-first 現場建單流程與 tablet-first F8A/F8B 快捷操作；`/admin/work-orders/bulk-status` 已接上 preview 搜尋與批量狀態更新。
  - `board_length_class` 已加入 schema 與 admin create/list/detail；衝浪板建單需選短板 / 中尺寸 / 長板，既有 legacy null 在 UI 顯示為 `—`。
  - `board_color` 已加入 `admin_work_order_list` projection 與 admin resolve preview；工單列表與 bulk status preview 會顯示顏色 swatch + label。
  - `/repair-status` 已接上 public customer lookup API，顯示公開進度、預估完成日、初始報價、公開備註與最近更新時間。
  - `/admin` 已接上 dashboard live data，第一版顯示互動式處理中工單 breakdown、管理 summary 與 Quick entries。
  - 目前 admin 前端頁面屬第一版方向雛形：主要流程、版位與資料結構已建立；新增工單頁已先完成平板收件用的輸入尺寸、尺寸 / 日期 / 報價 / 備註快捷操作、sticky 必填摘要，以及顧客手機 10 碼自動查詢與單一候選顧客自動選取；送出錯誤 scroll 與成功後 next actions 尚待下一輪。
  - `/admin/printing` 已接上列印中心列表、狀態燈、篩選與 failed retry；`/admin/printing/workers` 已接上 Worker 列表、最後心跳、最近錯誤、名稱 / 位置編輯、啟停，以及新增 / 刪除。
  - `/printer-worker` 已建立 connectivity-first Python Worker 子專案，支援 `run-once` / `poll` 來驗證 `claim -> succeed/fail` flow。
  - 目前 admin 前端頁面屬第一版方向雛形：主要流程、版位與資料結構已建立，但欄位編排、文案、資訊層級與操作細節仍預期在與甲方討論後進入第二版調整。
  - Frontend strategy 已記錄於 [frontend.md](frontend.md)。
  - Supabase Database types 已產生於 `types/database.types.ts`。
  - Supabase local config、initial migration 與 seed placeholder 已建立。
  - Staging deployment runbook 已建立於 [deployment.md](deployment.md)，定義 Vercel + Supabase staging 的 90% 半自動部署流程、env 名稱與 smoke test checklist。
  - Supabase staging project `xnxbbjigercsfqdswdhb` 已 link，5 個 migrations 已推到 remote 並與 local migration list 對齊。
  - Vercel staging project `board-reborn-staging` 已建立並連結 GitHub repo，staging URL 為 `https://board-reborn-staging.vercel.app`，必要 Vercel env 已設定為 encrypted production env for staging project。
  - Staging admin session 首次驗證發現 `authenticated` role 缺少核心 table / view privileges，導致 `/api/admin/session` 查詢 `admin_profiles` 時 Supabase REST 回 `403`; authenticated table grants migration 已推送到 staging，cookie-based admin session API 已重測通過。
  - Staging 第一輪 API smoke test 已建立測試工單 `STG-20260506005302`，並確認 admin session、dashboard、create、resolve、list search、detail、detail edit、status update 與 bulk status 可用；第二輪已將 public lookup 的 repo-side service-role helper 改為 direct `createClient`，推送 `service_role` lookup grants migration 到 staging，並重測 `POST /api/public/work-orders/lookup` 通過 `200/404/422` 路徑。
  - Repo env 解析已直接相容 Vercel Supabase integration 匯入的 `SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`；既有 `SUPABASE_KEY` / `SUPABASE_SECRET_KEY` alias 仍保留相容。admin session/client SSR 已將 anon key 優先順序調整為先吃 `SUPABASE_ANON_KEY` / `NUXT_PUBLIC_SUPABASE_ANON_KEY`，避免錯吃 `SUPABASE_PUBLISHABLE_KEY` 的 local/demo 值，staging `/api/admin/session` 已恢復為預期的 `401/200/403` 分流，不再回 `500`。
  - 共用 `Card` 元件已從 `ring-1` 改為實體 `border`，修正 Chrome 下 dashboard / admin 卡片外框比 Safari 更不明顯、看起來像少一層框的視覺不一致。
  - Admin auth/session flow 已能區分 anonymous、forbidden、admin 三種狀態；print queue model、admin print-jobs API、print-worker claim/succeed/fail API 與 connectivity worker 已建立，但 CUPS / 實體印表機整合仍未建立。
- 本機 HTTP 開發環境已明確關閉 Supabase secure auth cookie，避免 SSR session bootstrap 在 `localhost` / `127.0.0.1` 上反覆 `401`。
- 目前已停用 Nuxt `experimental.appManifest`，避免本機開發環境出現 `/_nuxt/builds/meta/dev.json` 404 並直接觸發整頁 Nuxt error page。

## 里程碑

| 里程碑                                 | 狀態    | 說明                                                                                                                                                                                  |
| -------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 核心規格與工程規則文件                 | done    | 產品、domain model、API contract、列印架構與 AI 規則文件已存在。                                                                                                                      |
| Minimal Nuxt scaffold 與基礎工具鏈     | done    | app shell、lint、typecheck、Vitest baseline 已建立。                                                                                                                                  |
| 進度追蹤與 agent workflow              | done    | 本文件、AGENTS 規範與一致性檢查 skill 已建立。                                                                                                                                        |
| Supabase local stack 與 migrations     | done    | `supabase/config.toml`、initial migration baseline 與 seed placeholder 已建立。                                                                                                       |
| Server API foundation                  | done    | 共用 requestId、typed errors、Supabase client helpers 與 admin gate 已建立。                                                                                                          |
| Admin work-order API                   | partial | Create/list/detail/update/status/resolve/bulk-status 與 customer lookup 已建立；建工單後 best-effort print enqueue 已接上，但 detail / create success 後的列印狀態銜接仍待補強。     |
| Auth 與管理端流程                      | done    | Admin gate helper、session endpoint、login/logout UI、admin middleware 與 session bootstrap 已建立。                                                                                  |
| Frontend strategy / UI foundation      | done    | Tailwind CSS v4、shadcn-vue primitives、admin shell、dashboard summary 與 frontend rules 已建立。                                                                                     |
| Admin work-order list UI               | done    | `/admin/work-orders` 已接上 list API、URL query state、table/card list 與 detail 導頁。                                                                                               |
| Admin work-order detail UI             | partial | `/admin/work-orders/[id]` 已接上 detail API 與 `view/edit/work` mode；`view`、`edit` 與 `work` 皆已有第一版可用雛形，細節仍待與甲方討論後進二版調整。                                 |
| Admin work-order create UI             | done    | `/admin/work-orders/new` 已接上 lookup-first 建單流程、日期預設、初始報價、tablet-first F8A/F8B 快捷操作與成功導向 detail。                                                           |
| Admin bulk status UI                   | done    | `/admin/work-orders/bulk-status` 已接上 preview 搜尋、共享狀態更新、分組快捷操作與批量結果摘要。                                                                                      |
| Barcode / print job API 與 Print Agent | partial | `print_devices` / `print_jobs` schema、admin print-jobs / print-devices API、print-worker claim/succeed/fail API、admin 列印 UI 與 `printer-worker` connectivity worker 已建立；CUPS / 實體列印仍 pending。 |
| Admin printing UI                      | done    | `/admin/printing` 與 `/admin/printing/workers` 第一版已建立，包含列印紀錄、retry、Worker 列表、dialog 建立與輕量管理。                                                                |
| Customer lookup flow                   | done    | `POST /api/public/work-orders/lookup` 與 `/repair-status` 已建立，支援 server-generated progress 與 basic rate limit。                                                                |
| Production workflow 與部署硬化         | pending | Staging Supabase / Vercel 基礎部署已完成；正式 production cutover、production Auth 設定與部署硬化尚未完成。                                                                           |

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
- Admin work-order create RPC：原子建立 customer、work_order、第一筆 status_history 與 quote_items；route 會在 RPC 成功後 best-effort enqueue 第一筆 print job。
- Admin work-order status RPC：原子 append `status_history`、同步 `work_orders.current_status`，並維護 ready/delivered/cancelled timestamp。
- Admin bulk status API：以 `paperOrderNos` 批量更新狀態，回傳 `requestedCount`、`dedupedCount`、`updatedCount`、`skippedCount` 與逐筆結果；未知錯誤時立即停止後續處理。
- Login / session UI：`/login`、`/admin`、`/forbidden`、admin middleware、admin layout bootstrap 與 logout action。
- Local auth cookie hardening：Supabase SSR cookie 依 app URL protocol 決定 `secure`，避免本機 HTTP 開發時瀏覽器拒收 auth cookie。
- Frontend UI foundation：Tailwind CSS v4、`@tailwindcss/vite`、shadcn-vue primitives、`shadcn-nuxt`、SSR width plugin、Tailwind/shadcn 重整後的 homepage / login / forbidden / admin placeholder。
- Frontend strategy spec：`docs/frontend.md`，定義 admin route map、layout、data access、form validation、feedback、列表與狀態 badge 規則。
- Admin work-order list UI：URL query canonicalization middleware、read-only 工單列表、提醒 badges、桌機 table / 手機 card list 與 detail placeholder route。
- Admin work-order list rendering fix：改為顯式 import `work-orders` 目錄下的列表與 badge 元件，排除 Nuxt auto-import 前綴不符造成「總數正確但列表不顯示」的回歸。
- Admin work-order detail UI：單一路由 detail page、`mode=view|edit|work` query canonicalization、detail data keyed only by id、view mode 只讀區塊、edit mode PATCH 表單、work mode 狀態更新卡與 404/422 分流已建立。
- Admin work-order create UI：單頁現場收件建單頁、lookup-first 顧客流程、`intakeDate -> estimatedCompletionDate` 預設規則、初始報價映射、tablet-first F8A/F8B 快捷操作與成功導向 detail 已建立。
- Admin work-order create tablet-first F8A/F8B：已加大本頁觸控目標，補工單號 / 顧客手機 / 初始報價 numeric input attributes，新增衝浪板尺寸 quick selector 與 +/- 英寸、預估完成日 quick actions、初始報價 quick amount / 微調、損傷描述與維修處數量 quick chips、公開 / 內部備註 quick chips，以及 sticky 必填欄位摘要；未改 API payload、schema 或建單狀態流程。
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
- Staging deployment runbook：`docs/deployment.md` 已建立，記錄 Vercel + Supabase staging 的前置檢查、env 名稱、Supabase migration push、Vercel preview deploy、admin 建立與 smoke test checklist。
- Staging 基礎部署：Supabase staging migrations 已推送，Vercel staging project 已建立並部署到 `https://board-reborn-staging.vercel.app`；`.vercel` 已加入 `.gitignore`。
- Authenticated table grants：已新增 migration，讓 user-scoped admin APIs 可在 RLS policies 之上讀寫核心資料表與 `admin_work_order_list` view。
- Print queue model：已新增 `print_devices`、重整 `print_jobs` schema 與 `admin_print_job_list` view，並用 migration 將 legacy print status 映射到 queue status。
- Print job APIs：已新增 `GET /api/admin/print-jobs`、`POST /api/admin/print-jobs`、`POST /api/admin/print-jobs/{id}/retry`、`POST /api/print-worker/jobs/claim`、`POST /api/print-worker/jobs/{id}/succeed`、`POST /api/print-worker/jobs/{id}/fail`。
- Print device admin APIs：已新增 `GET /api/admin/print-devices`、`POST /api/admin/print-devices`、`PATCH /api/admin/print-devices/{id}` 與 `DELETE /api/admin/print-devices/{id}`，支援 Worker 列表、建立、名稱 / 位置編輯、啟停與刪除。
- Work-order create print enqueue：建工單成功後會 best-effort 自動建立第一筆 `work_order_label` print job；enqueue 失敗不回滾工單。
- Admin printing UI：已新增 `/admin/printing` 與 `/admin/printing/workers`，提供列印紀錄列表、狀態燈、failed retry、Worker 狀態查看、shadcn dialog 建立與輕量管理。
- `printer-worker` connectivity worker：已新增 repo 內 Python 子專案，支援 `run-once` / `poll`，可在 local / Raspberry Pi 上驗證 `claim -> succeed/fail` flow。

## 目前焦點

- 驗證 `printer-worker` 在 local / staging / Raspberry Pi 的 token、device provisioning 與 stale lock reclaim 行為。
- 用 connectivity worker 跑第一輪 `claim -> succeed/fail` smoke test。
- 盤點列印流程與既有 detail / create / bulk status / public lookup 頁面的列印狀態銜接方式。
- 把 repo 現況描述集中在本文件，避免 README、AGENTS 與任務背景持續漂移。

## 下一步

- 在 local / staging 建立第一台 `print_devices` seed / 手動 provisioning 流程，驗證 `PRINT_WORKER_TOKEN` + `deviceKey` 認證。
- 在 Raspberry Pi 執行 `printer-worker`，確認 `run-once` 與 `poll` 皆可連到 Nuxt API。
- 以 `WORKER_RESULT_MODE=fail` 驗證 retry / failed 狀態流轉。
- 補工單 detail / create 成功後的列印狀態呈現與列印中心導流。
- 與甲方確認 detail / list / dashboard 的資訊優先序與操作節奏，整理前端第二版調整項目。
- 延續新增工單頁 F8C：送出時 scroll 到第一個錯誤欄位、建立成功後 next actions 區塊。
- 開始接 CUPS / 實體印表機整合。
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
- [x] 實作 printing center page。
- [x] 實作 print worker management page。

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

- Schema 與 status rules 已寫入 migration；create/list/detail/update/status/resolve/bulk-status、admin print-jobs、print-worker APIs 與 connectivity worker 已建立，但實體列印 runtime 尚未建立。
- Admin 單筆 detail/update/status endpoint 保留 UUID path 作為 internal resource identity；現場掃碼或人工輸入紙本工單號時，前端應先呼叫 `GET /api/admin/work-orders/resolve?paperOrderNo=...` 取得 UUID，再呼叫既有 UUID-based endpoint。
- Docker daemon 已確認可用；本地 `supabase start` 與 `supabase db reset` 已成功跑過。第一次啟動時若遇到 Supabase ECR / CloudFront image 下載 timeout，可改從 Docker Hub 拉同版本 image 後 tag 成 `public.ecr.aws/supabase/*` 名稱再重跑。
- Public customer lookup 已落地，但目前 rate limit 採 in-memory store，只適用 local / single-instance MVP，未達 production-grade distributed limiter。
- Staging Supabase / Vercel 基礎部署已完成；`authenticated` table grants 與 `service_role` lookup grants 已推送至 staging，cookie-based `/api/admin/session` 已恢復正常，public lookup 已驗證正確手機 `200`、錯誤手機 `404`、不存在工單 `404` 與 payload 錯誤 `422`。
- Safari 登入頁原本在 autofill / accessibility-set value 情境下可能送出 stale `v-model` form state；目前已改成 submit-time `FormData` 讀值，仍需以實際瀏覽器再跑一次完整登入流程確認。
- 建工單後會 best-effort enqueue 第一筆 `print_job`；若 enqueue 失敗，需靠 server log 與 admin print-jobs 補建流程補救。
- 既有 legacy `SURFBOARD` 工單可能尚未有 `board_length_class`；目前 list / detail 會顯示 `—`，這次沒有補 edit flow 或 backfill。
- 新增工單頁 F8C 尚未完整收尾：送出錯誤 scroll、建立成功後 next actions 尚未在本輪加入。
- Admin 前端目前已有 Tailwind/shadcn shell、dashboard summary、工單列表、detail 的 `view/edit/work`、建單頁、bulk status 與列印中心 / Worker 管理第一版；Worker 已可直接在 UI 建立 / 刪除，工單 detail / create 成功後的列印狀態銜接仍待補強。
- Admin 前端目前仍屬第一版雛形；雖然大方向與主流程已可展示，但欄位配置、文案、資訊密度、互動回饋與模式切換細節尚未定案，預期需在與甲方討論後進行第二版調整。
- Nuxt 4 在此專案目前的本機開發組合下，`experimental.appManifest` 會導致 `/_nuxt/builds/meta/dev.json` 404；目前已先關閉這個實驗功能，以穩定開發中的 admin 頁面導航與刷新行為。
- shadcn-vue latest 的 `reka-vega` style registry base style 在初始化時回 404；本次以 `--no-base-style` 初始化並依官方 neutral theme scaffold 手動補齊 global CSS tokens。
- 印表機型號、CUPS 設定與 production printing workflow 尚未定案，因此 connectivity worker 之後的實體列印驗證仍有不確定性。
