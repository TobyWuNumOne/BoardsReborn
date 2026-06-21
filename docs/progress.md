# Project Progress

這份文件是本 repo 目前實作狀態與高層里程碑進度的單一事實來源。其他文件如果需要提到目前已完成、尚未完成、下一步或主要風險，應優先連到本文件，而不是各自維護一份容易過時的現況說明。

## 更新規則

- 開始變更前先讀本文件，確認目前階段、已完成項目、下一步與風險。
- 完成變更後，如果實作能力、里程碑狀態、下一步或風險有變化，必須更新本文件。
- 如果其他文件需要提到目前 repo 狀態，保留短摘要即可，詳細現況統一以本文件為準。
- 本文件追蹤的是 repo / implementation progress，不是顧客查詢或工單維修進度；產品層的進度語意仍以 [product.md](product.md) 與 [api-contract.md](api-contract.md) 為準。

## 目前快照

- 最後更新：2026-06-21
- 目前階段：Cloud-to-Physical Printing MVP 已完成；LINE 官方帳號串接已完成 PR 1 文件基線、PR 2 Database Migration 與 PR 3 Domain Routing。LINE token service、API、LIFF 頁面、webhook、Outbox processor、Cron、條件式留存聯 QR 與 admin UI 均尚未實作。
- 整體狀態：進行中
- 現況摘要：
  - Minimal Nuxt app scaffold 已存在，包含 `app/`、`server/` 與 `tests/` 基本結構。
  - 基礎工具鏈已配置完成：pnpm、Nuxt、TypeScript、ESLint、Prettier、Vitest、`.env.example`。
  - LINE MVP 的產品、domain、API、frontend、printing、安全與環境變數設計基線已寫入文件；目前狀態為 planned / not implemented，不代表 production 已配置 LINE secrets 或任何 LINE route 可用。
  - LINE schema foundation 已建立：`customer_line_accounts`、`line_bind_tokens`、`line_jobs`、三個 LINE enums、雙向 1:1 / pending token / dedupe / retry constraints、claim/reclaim/history indexes、admin-scoped RLS 與 service-role grants。這只代表資料層可用，不代表 LINE workflow 已上線。
  - status production domain 已允許 `/line/order-gate` 與其 query/hash 原地停留，不再被 domain middleware 導回 `/repair-status`；order-gate Vue page 尚未建立，現階段 404 是預期行為。
  - `server/api/` 已有 admin session、customer lookup、public lookup、work-order create/list/detail/update/status/resolve/bulk-status，以及 admin / print-worker 列印 handlers 與 `print-devices` 管理 handlers。
  - Server API 共用基礎層已建立，包含 typed error classes、requestId helper、handler wrapper、typed Supabase client helper 與 admin gate helper。
  - 前端已導入 Tailwind CSS v4、shadcn-vue primitives、`shadcn-nuxt` 與 SSR width baseline。
  - `/`、`/login`、`/admin`、`/forbidden` 已重整到 Tailwind/shadcn 基礎；`/admin/work-orders` 已可查詢、篩選、排序與分頁，`/admin/work-orders/[id]` 已提供 `mode=view|edit|work` detail route，且 `mode=edit` 已接上 PATCH、repair marks 編輯與新建錯單刪除；`/admin/work-orders/new` 已接上 lookup-first 現場建單流程、後端純數字工單號產生、99 前綴測試建單模式、tablet-first F8A/F8B 快捷操作與 Konva repair marks modal；`/admin/settings` 已提供測試工單入口；`/admin/work-orders/bulk-status` 已接上 preview 搜尋與批量狀態更新；`/admin/scan` 已接上單張掃碼 lookup 與第一版快速操作。
  - `board_length_class` 已加入 schema 與 admin create/list/detail；衝浪板建單需選短板 / 中尺寸 / 長板，既有 legacy null 在 UI 顯示為 `—`。
  - `board_color` 已加入 `admin_work_order_list` projection 與 admin resolve preview；工單列表與 bulk status preview 會顯示顏色 swatch + label。
  - `/repair-status` 已接上 public customer lookup API，顯示公開進度、預估完成日、初始報價、repair marks 示意圖、公開備註、最近更新時間，以及紙本維修單上的公開店家資訊、取板預約官方 LINE CTA、板型對應費用參考與補板注意事項。
  - Production domain routing 已在 Nuxt 全域 route middleware 落地並部署：admin、status、主網域與 `www` 依 canonical route 以 `302` 分流；localhost、staging、preview 與未知 host 不受影響。Vercel 原有的 `www -> root` 永久 redirect 已移除，避免繞過 Nuxt 規則。
  - Vercel Speed Insights 已接入 Nuxt module；正式站重新部署並開始回傳 Web Vitals 後，可直接在 Vercel Speed Insights dashboard 觀測資料。
  - `work_orders` 現在已新增 `repair_count` / `repair_count_source`，並新增 `work_order_repair_marks` 結構化標記表；create/detail/patch/public lookup contract 已同步支援，且建單前必須先解析出非空 `repairCount`。
  - repair marks 的編輯與只讀預覽已統一 responsive 規則：`>1024px` 顯示正反面，`<=1024px` 改成單面切換；Konva stage 會跟著外層卡片可用空間縮放，`SURFBOARD` / `SUP` 共用同一套瘦長輪廓，`SNOWBOARD` 保持獨立輪廓；其中 editor modal 已再調整為 iPad 11 吋橫向優先，`>=1024px` 時固定維持 `正面 / 背面 / 設定區` 同列，且不再需要為了看到 `儲存` 額外下捲；直向 editor 則改成單面切換在上、設定卡在下的堆疊版型，並把 modal 高度與單面標記區再往上放大。
  - `/admin` 已接上 dashboard live data，第一版顯示互動式處理中工單 breakdown、管理 summary 與 Quick entries。
  - 目前 admin 前端頁面屬第一版方向雛形：主要流程、版位與資料結構已建立；新增工單頁已先完成後端估算下一張純數字工單號、平板收件用的輸入尺寸、尺寸 / 日期 / 報價 / 備註快捷操作、sticky 必填摘要，以及顧客手機 10 碼自動查詢與單一候選顧客自動選取；送出錯誤 scroll 與建立成功後 next actions 區塊尚待下一輪，但導頁後頂部成功提示已補上。
  - admin mobile sidebar 已支援左緣拖拉開啟與左拖關閉，保留既有 trigger / close button 作為備援。
  - admin mobile sidebar 現在在點下導航按鈕時就會立即收起，路由切換後也會維持關閉，避免點選導航後覆蓋新頁；共用 Button 與 sidebar nav button 也已補按壓視覺回饋。
  - `/admin/printing` 已接上列印中心列表、狀態燈、篩選與 failed retry；`/admin/printing/workers` 已接上 Worker 列表、最後心跳、最近錯誤、名稱 / 位置編輯、啟停，以及新增 / 刪除，且燈號會依 `status + lastSeenAt` 顯示在線 / 離線 / 心跳過期。
  - admin printing 已加上 Supabase Realtime notification layer：`/admin/printing` 與 `/admin/printing/workers` 改成收到事件後 refetch + visible-only 60 秒 fallback，不再固定每 5 秒打 API；Phase 2 起 Realtime emit ownership 已收斂到 Nuxt server-side utility，並新增 public `printing:worker-wakeup` topic。
  - server 端 `printing:worker-wakeup` 已提前於 `printing:jobs` / `printing:summary` 發送，降低建單或補印後 worker 被喚醒的等待時間。
  - 建立工單成功後，server 會 best-effort 依序建立 `work_order_label` 與 `customer_receipt` 兩筆 `print_jobs`；目前同一台 Pi worker 會依 queue 連續列印兩張，未新增 device routing。
- `/printer-worker` 已建立 Python Worker 子專案，`run-once` / `poll` 保持 connectivity smoke test，`serve` 已接上 Realtime wake-up + 15 秒 fallback claim、Realtime 重連後立即補 claim、raw `/dev/usb/lp0` ESC/POS transport，並已完成實體列印與 succeeded / failed 回報；renderer 會依 `job_type` dispatch 工單標籤或顧客留存聯。
- `printer-worker` 的 systemd service 模板已改成 `PYTHONUNBUFFERED=1` + `python -u`，避免 Pi 上 `journalctl -f` 看不到即時 claim / succeed / fail log。
- `/admin/work-orders/[id]` 已接上列印摘要卡與 `前往列印中心 / 建立列印任務 / 建立補印`；建立列印任務會先用 dialog 選 `工單標籤` 或 `顧客留存聯`，建單成功會導到 detail 並帶 `created=1` 頂部成功提示。
- `/admin/work-orders/[id]` 的列印摘要卡在最新 job 為 `pending / locked / printing` 時，會短週期補抓 summary，避免 Realtime 漏事件時卡在 `已鎖定`。
  - `/admin/work-orders/bulk-status` 已調整回掃碼優先頁：preview 與最近一次批量結果不再顯示列印摘要，批量成功後改在頁頂顯示成功提示。
  - `/` 已補 `repair-status` 快捷入口；admin sidebar 也已補加高的 `新增工單` 導航按鈕，讓現場跳轉更直接。
  - Raspberry Pi `192.168.0.242` 已完成第一輪 connectivity smoke test：Pi 端 `printer-worker run-once` 可透過區網呼叫本機 Nuxt `print-worker` API，並成功驗證 `claim -> printed` 與 `claim -> pending(last_error, attempt_count+1)` 兩條路徑。
  - 已完成第一輪印表機硬體確認：Prowill PD-X326、80mm、`ESC/POS`、USB/Serial/Ethernet，Ethernet self-test 固定為 `192.168.50.88:9100`、DHCP disabled。
  - macOS 已完成 raw ESC/POS smoke test：`_USB_Receipt_Printer` 可透過 `lp -d _USB_Receipt_Printer -o raw` 成功列印 ASCII 文字、切紙與 1D barcode。
  - Raspberry Pi 端 raw USB ESC/POS 已完成 end-to-end 驗證：Pi SSH、Wi-Fi 臨時連線、USB 偵測、`/dev/usb/lp0`、ASCII、CP950 / Big5 繁體中文、1D barcode、切紙皆成功；UTF-8 直送中文不支援，會亂碼。
  - Pi 端已確認有效 cut command 為 `\x1D\x56\x42\x05`，可靠手動驗證方式為 `printf ... | sudo tee /dev/usb/lp0 > /dev/null`。
  - 已確認 Pi worker 路徑應直接寫 raw bytes 到 `/dev/usb/lp0`，不使用 CUPS，也不使用 macOS printer queue name。
  - `printer-worker serve` 已實作 immutable print snapshot renderer 與 raw USB transport；`run-once` / `poll` 保持既有 smoke test，不會真的出紙。
  - 最新 `work_order_label` snapshot 已改為 `templateVersion: 2`，第一版工單標籤改成顯示收件日期、電話 / Paid、大字工單號、維修處數與 1D barcode。
  - Label renderer 已固定 barcode height `0x40`，並直接依 sample ESC/POS bytes 輸出新版版面。
  - Staging Supabase 已推送 `20260605140000_print_job_payload_snapshot_worker_receipt.sql`，Vercel staging `https://board-reborn-staging.vercel.app` 已重新部署到包含 immutable print snapshot 與 Pi raw USB transport 的版本，並已完成 web 建單到 Pi 自動出紙的 end-to-end 驗證。
  - Raspberry Pi `172.20.10.4` 上的 `boards-reborn-printer-worker.service` 已同步最新 `~/printer-worker` 程式碼並重啟成功；`serve` mode 已確認使用 `/dev/usb/lp0`、startup claim、Realtime subscription、實體出紙與成功/失敗回報皆正常。
  - 目前 admin 前端頁面屬第一版方向雛形：主要流程、版位與資料結構已建立，但欄位編排、文案、資訊層級與操作細節仍預期在與甲方討論後進入第二版調整。
  - Frontend strategy 已記錄於 [frontend.md](frontend.md)。
  - Supabase Database types 已產生於 `types/database.types.ts`。
  - Supabase local config、initial migration 與 seed placeholder 已建立。
  - Staging deployment runbook 已建立於 [deployment.md](deployment.md)，定義 Vercel + Supabase staging 的 90% 半自動部署流程、env 名稱與 smoke test checklist。
  - Supabase staging project `xnxbbjigercsfqdswdhb` 已 link，5 個 migrations 已推到 remote 並與 local migration list 對齊。
  - Vercel staging project `board-reborn-staging` 已建立並連結 GitHub repo，staging URL 為 `https://board-reborn-staging.vercel.app`，必要 Vercel env 已設定為 encrypted production env for staging project。
  - Staging admin session 首次驗證發現 `authenticated` role 缺少核心 table / view privileges，導致 `/api/admin/session` 查詢 `admin_profiles` 時 Supabase REST 回 `403`; authenticated table grants migration 已推送到 staging，cookie-based admin session API 已重測通過。
  - Staging 第一輪 API smoke test 已建立測試工單 `STG-20260506005302`，並確認 admin session、dashboard、create、resolve、list search、detail、detail edit、status update 與 bulk status 可用；第二輪已將 public lookup 的 repo-side service-role helper 改為 direct `createClient`，推送 `service_role` lookup grants migration 到 staging，並重測 `POST /api/public/work-orders/lookup` 通過 `200/404/422` 路徑。
  - Repo env 解析已直接相容 Vercel Supabase integration 匯入的 `SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`；既有 `SUPABASE_KEY` / `SUPABASE_SECRET_KEY` alias 仍保留相容。admin session/client SSR 已將 anon key 優先順序調整為先吃 `SUPABASE_ANON_KEY` / `NUXT_PUBLIC_SUPABASE_ANON_KEY`，避免錯吃 `SUPABASE_PUBLISHABLE_KEY` 的 local/demo 值；Nuxt 前端 Supabase URL/client key 解析也已調整為優先吃 `NEXT_PUBLIC_*` / `NUXT_PUBLIC_*`，降低 staging 同時存在多組 env 時發生 URL/key 錯配導致登入 `401` 的風險，staging `/api/admin/session` 已恢復為預期的 `401/200/403` 分流，不再回 `500`。
  - Vercel CLI 本機部署現已透過 `.vercelignore` 明確排除 `.env` / `.env.*`，避免 local Supabase demo key 與 `http://localhost:3000` 汙染 staging build，導致 `/login` 注入錯誤的 public Supabase runtime config。
  - 共用 `Card` 元件已從 `ring-1` 改為實體 `border`，修正 Chrome 下 dashboard / admin 卡片外框比 Safari 更不明顯、看起來像少一層框的視覺不一致。
  - Admin auth/session flow 已能區分 anonymous、forbidden、admin 三種狀態；print queue model、admin print-jobs API、print-worker claim/succeed/fail API、Realtime wake-up、Pi `serve` runtime 與 Raspberry Pi raw USB transport integration 已建立並完成 MVP 驗證。
- 本機 HTTP 開發環境已明確關閉 Supabase secure auth cookie，避免 SSR session bootstrap 在 `localhost` / `127.0.0.1` 上反覆 `401`。
- 目前已停用 Nuxt `experimental.appManifest`，避免本機開發環境出現 `/_nuxt/builds/meta/dev.json` 404 並直接觸發整頁 Nuxt error page。
- `pnpm build` 現在會在 build 後自動補 `.output/server/chunks/public -> ../../public` symlink（必要時 fallback copy），修正 `pnpm preview` 與 `node .output/server/index.mjs` 在本機出現 `/_nuxt/*` `500`、導致 `/admin` 無法渲染的問題。

## 里程碑

- 核心規格與工程規則文件：done。產品、domain model、API contract、列印架構與 AI 規則文件已存在。
- Minimal Nuxt scaffold 與基礎工具鏈：done。app shell、lint、typecheck、Vitest baseline 已建立。
- 進度追蹤與 agent workflow：done。本文件、AGENTS 規範與一致性檢查 skill 已建立。
- Supabase local stack 與 migrations：done。`supabase/config.toml`、initial migration baseline 與 seed placeholder 已建立。
- Server API foundation：done。共用 requestId、typed errors、Supabase client helpers 與 admin gate 已建立。
- Admin work-order API：done。Create/list/detail/update/status/resolve/bulk-status、customer lookup 與 `GET /api/admin/print-summaries` 已建立；建工單後 best-effort print enqueue 已接上。
- Auth 與管理端流程：done。Admin gate helper、session endpoint、login/logout UI、admin middleware 與 session bootstrap 已建立。
- Frontend strategy / UI foundation：done。Tailwind CSS v4、shadcn-vue primitives、admin shell、dashboard summary 與 frontend rules 已建立。
- Admin work-order list UI：done。`/admin/work-orders` 已接上 list API、URL query state、全尺寸 table（窄螢幕 overflow-x）、維修數量 / 收版天數顯示與 detail 導頁。
- Admin work-order detail UI：done。`/admin/work-orders/[id]` 已接上 detail API、`view/edit/work` mode、列印摘要卡與 repair marks 顯示 / 編輯；完整列印操作仍以 `/admin/printing` 為中心。
- Admin work-order create UI：done。`/admin/work-orders/new` 已接上 lookup-first 建單流程、日期預設、初始報價、tablet-first F8A/F8B 快捷操作、Konva repair marks modal 與成功導向 detail。
- Admin bulk status UI：done。`/admin/work-orders/bulk-status` 已接上 preview 搜尋、共享狀態更新、分組快捷操作、批量結果摘要與頁頂成功提示；此頁不再顯示列印摘要。
- Admin scan UI：done。`/admin/scan` 已接上 keyboard wedge `Enter` 查詢、單張工單主卡片、付款 / 交件 / 狀態更新 / 快速備註與完整工單導頁。
- Barcode / print job API 與 Print Agent：done。`print_devices` / `print_jobs` schema、admin print-jobs / print-devices / print-summaries API、print-worker claim/succeed/fail API、admin 列印 UI，以及 `printer-worker run-once/poll/serve` 已建立；web 建單/補印、worker wake-up/claim、Pi raw USB ESC/POS 實體列印與 succeeded/failed 回報已完成端到端驗證。
- Admin printing UI：done。`/admin/printing` 與 `/admin/printing/workers` 第一版已建立，包含列印紀錄、retry、Worker 列表、dialog 建立與輕量管理。
- Customer lookup flow：done。`POST /api/public/work-orders/lookup` 與 `/repair-status` 已建立，支援 server-generated progress 與 basic rate limit。
- Production workflow 與部署硬化：pending。Staging Supabase / Vercel 基礎部署已完成；正式 production cutover、production Auth 設定與部署硬化尚未完成。
- Cloud-to-Physical Printing MVP：done。雲端 Web 建立工單、建立 `print_job`、worker wake-up / claim、Raspberry Pi `/dev/usb/lp0` raw ESC/POS 實體列印、成功/失敗回報與 retry flow 已完成，已跨過「雲端系統控制現場硬體」的關鍵門檻。
- LINE Official Account MVP：in progress。PR 1 文件基線、PR 2 schema foundation 與 PR 3 domain routing 已完成；token service、API、LIFF、列印、webhook、processor、status/create integration 與 admin UI 尚未開始。

## LINE MVP 12 PR 路線圖

本路線圖不得被解讀為整體 LINE 功能已實作。當前完成 PR 1、PR 2 與 PR 3；下一步是 PR 4。

- [x] PR 1 Docs only：同步產品決策、schema / API 設計基線、frontend、printing、安全、setup 與進度文件。
- [x] PR 2 Database migration：新增 LINE tables、enum、constraints、RLS、indexes 與 generated database types。
- [x] PR 3 Domain routing：讓 status domain 允許 `/line/order-gate`。
- [ ] PR 4 Token service：發卡、HMAC、hash、resolve、revoke 與 active pending token 重建能力。
- [ ] PR 5 Admin API：重新發卡、解除綁定、查詢工單 LINE 狀態。
- [ ] PR 6 Order-gate / LIFF：resolve token、confirm binding、成功與錯誤 UX。
- [ ] PR 7 Receipt printing：未綁定印 LIFF QR、已綁定印 `/repair-status`，並保留發卡失敗 fallback。
- [ ] PR 8 Webhook：follow / unfollow signature 驗證與好友狀態更新。
- [ ] PR 9 `line_jobs` processor：claim、prepare、send、retry、skip、`notified_at` 與 Supabase Cron。
- [ ] PR 10 Status update integration：`READY_FOR_PICKUP` 狀態 transaction 自動 enqueue。
- [ ] PR 11 Work order create integration：已綁定顧客 enqueue `work_order_received`；失敗不阻斷建單。
- [ ] PR 12 Admin UI：工單詳情顯示 LINE 綁定、好友、token 與通知狀態。

PR 9 啟用 production Cron 前，必須先完成 LINE secrets、Supabase Vault、同 Provider / channel linking、LIFF production endpoint 與 status-domain routing checklist。MVP 使用 Supabase Cron 每分鐘呼叫 Nuxt internal endpoint，不使用 Vercel Hobby Cron 做分鐘級通知。

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
- Admin print summary API：`GET /api/admin/print-summaries`，目前供 detail 頁讀取列印摘要 read model。
- Admin work-order create RPC：原子建立 customer、work_order、第一筆 status_history 與 quote_items；`paper_order_no` 由 DB 端依 `Asia/Taipei` 年份產生純數字流水號，route 會先要求非空 `repairCount`，再於 RPC 成功後 best-effort enqueue 第一筆 print job。
- Admin work-order status RPC：原子 append `status_history`、同步 `work_orders.current_status`，並維護 ready/delivered/cancelled timestamp。
- Admin bulk status API：以 `paperOrderNos` 批量更新狀態，回傳 `requestedCount`、`dedupedCount`、`updatedCount`、`skippedCount` 與逐筆結果；未知錯誤時立即停止後續處理。
- Login / session UI：`/login`、`/admin`、`/forbidden`、admin middleware、admin layout bootstrap 與 logout action。
- Login 錯誤訊息分流：`/login` 已可區分 `invalid_credentials`、`email_not_confirmed`、`invalid_api_key`、rate limit 等錯誤，不再把所有 Supabase auth 失敗都顯示成帳密錯誤。
- Local auth cookie hardening：Supabase SSR cookie 依 app URL protocol 決定 `secure`，避免本機 HTTP 開發時瀏覽器拒收 auth cookie。
- Frontend UI foundation：Tailwind CSS v4、`@tailwindcss/vite`、shadcn-vue primitives、`shadcn-nuxt`、SSR width plugin、Tailwind/shadcn 重整後的 homepage / login / forbidden / admin placeholder。
- Frontend strategy spec：`docs/frontend.md`，定義 admin route map、layout、data access、form validation、feedback、列表與狀態 badge 規則。
- Admin work-order list UI：URL query canonicalization middleware、read-only 工單列表、提醒 badges、全尺寸 table（窄螢幕 overflow-x）、維修數量 / 收版天數欄位與 detail route。
- Admin work-order list rendering fix：改為顯式 import `work-orders` 目錄下的列表與 badge 元件，排除 Nuxt auto-import 前綴不符造成「總數正確但列表不顯示」的回歸。
- Admin work-order detail UI：單一路由 detail page、`mode=view|edit|work` query canonicalization、detail data keyed only by id、view mode 只讀區塊、edit mode PATCH 表單、work mode 狀態更新卡與 404/422 分流已建立。
- Work-order detail 列印摘要：detail 頁已新增列印狀態卡、`created=1` 頂部成功提示、`前往列印中心` deep link，並可在建立列印任務 / 補印時選擇 `工單標籤` 或 `顧客留存聯`。
- Admin work-order create UI：單頁現場收件建單頁、lookup-first 顧客流程、系統產生純數字工單號顯示、`intakeDate -> estimatedCompletionDate` 預設規則、初始報價映射、tablet-first F8A/F8B 快捷操作與成功導向 detail 已建立。
  - Admin work-order create tablet-first F8A/F8B：已加大本頁觸控目標，補顧客手機 / 初始報價 numeric input attributes，新增衝浪板尺寸 quick selector 與 +/- 英寸、預估完成日 quick actions、初始報價 quick amount / 微調、損傷描述與公開 / 內部備註 quick chips，以及 sticky 必填欄位摘要；新增工單頁也已補必填 / 不必填標示、擴充板子顏色選項，並將損傷描述改為選填；工單號不再手動輸入，由後端建立時產生。
- Surfboard 長度分類：`board_length_class` schema、create validation、create/list/detail API mapping 與 admin create/list/detail UI 顯示已建立。
- Admin bulk status UI：獨立 `/admin/work-orders/bulk-status` 頁面、resolve fan-out preview、共享狀態 select、依狀態分組的快捷操作與最近一次批量結果摘要已建立。
- Admin scan UI：獨立 `/admin/scan` 頁面、專用 `GET /api/admin/work-orders/lookup` read model、快速備註 endpoint 與 sidebar 入口已建立。
- Bulk status 掃碼工作流：preview 與 recent batch result 已聚焦狀態核對，不再顯示列印摘要或補印操作，避免干擾掃碼批量作業。
- Bulk preview / 工單列表資訊密度升級：`resolve` preview 已補顧客電話、長度分類、顏色、預估完成日與提醒 flags；bulk status 與工單列表都會顯示顏色 swatch。
- Public customer lookup：`POST /api/public/work-orders/lookup` 與 `/repair-status` 已建立，使用完整手機號碼驗證、server-generated progress timeline / cancelled state、只讀 repair marks 示意圖、公開店家/費用/注意事項資訊、官方 LINE 取板 CTA 與 MVP in-memory rate limit。
- Admin dashboard quick entries：已接上工單列表與建單頁入口，排除 create entry 仍停留 disabled placeholder 的不一致狀態。
- Admin sidebar navigation：已補上 bulk status、後台設定入口與加高的新增工單快捷按鈕；後台設定可進入共用表單的測試模式，預填並允許修改 `99` 測試單號。
- Admin dashboard quick entries：已再補上 bulk status 入口。
- Admin dashboard live data：`/admin` 已接上真實 summary metrics，第一版顯示互動式處理中工單 breakdown、待取件、逾期與今日新建。
- Admin responsive breakpoint tuning：sidebar desktop breakpoint 與工單列表 table breakpoint 已同步上移到 `xl`，避免 `768px~1279px` 區間同時顯示固定 sidebar 與 table 造成內容擠壓。
- Admin 前端第一版雛形：列表與詳情頁的主要流程、資料顯示與基本操作骨架已到位，可作為後續與甲方討論 UI/流程細節的基礎。
- Staging deployment runbook：`docs/deployment.md` 已建立，記錄 Vercel + Supabase staging 的前置檢查、env 名稱、Supabase migration push、Vercel preview deploy、admin 建立與 smoke test checklist。
- Staging 基礎部署：Supabase staging migrations 已推送，Vercel staging project 已建立並部署到 `https://board-reborn-staging.vercel.app`；`.vercel` 已加入 `.gitignore`。
- Staging work-order list grant fix：已定位 `20260610000000_admin_work_order_list_repair_count.sql` 以 `drop/create view` 重建 `admin_work_order_list` 後遺失原本的 `authenticated` `select grant`，造成 staging `/admin/work-orders` 查詢 view 時 Supabase REST 回 `403`。已補 grant-fix migration，後續所有重建該 view 的 schema 變更都需重新補 grant。
- Authenticated table grants：已新增 migration，讓 user-scoped admin APIs 可在 RLS policies 之上讀寫核心資料表與 `admin_work_order_list` view。
- Print queue model：已新增 `print_devices`、重整 `print_jobs` schema 與 `admin_print_job_list` view，並用 migration 將 legacy print status 映射到 queue status。
- Print job APIs：已新增 `GET /api/admin/print-jobs`、`POST /api/admin/print-jobs`、`POST /api/admin/print-jobs/{id}/retry`、`POST /api/print-worker/jobs/claim`、`POST /api/print-worker/jobs/{id}/succeed`、`POST /api/print-worker/jobs/{id}/fail`。
- Print device admin APIs：已新增 `GET /api/admin/print-devices`、`POST /api/admin/print-devices`、`PATCH /api/admin/print-devices/{id}` 與 `DELETE /api/admin/print-devices/{id}`，支援 Worker 列表、建立、名稱 / 位置編輯、啟停與刪除。
- Work-order create print enqueue：建工單前必須先確認非空 `repairCount`；create 成功後會 best-effort 依序自動建立 `work_order_label` 與 `customer_receipt` 兩筆 print jobs，任一 enqueue 失敗不回滾工單。
- Admin printing UI：已新增 `/admin/printing` 與 `/admin/printing/workers`，提供列印紀錄列表、狀態燈、failed retry、Worker 狀態查看、shadcn dialog 建立與輕量管理。
- Printing admin Realtime sync：database-side Supabase Realtime broadcast 已接上 `print_jobs` / `print_devices`，admin 列印頁面改成 event-driven refetch；fallback sync 只在 visible tab 每 60 秒執行一次。
- `printer-worker` connectivity worker：已新增 repo 內 Python 子專案，支援 `run-once` / `poll`，可在 local / Raspberry Pi 上驗證 `claim -> succeed/fail` flow。
- `printer-worker serve`：已新增 Pi event wake-up runtime，使用 public `printing:worker-wakeup` + 15 秒 fallback claim，並在 Realtime 重連成功後立即補 claim；附 systemd artifacts / env example。
- Raspberry Pi connectivity smoke test：已在 Pi 上驗證 `run-once` 的 success 與 fail 路徑，確認可打通本機 Nuxt API、正確更新 `print_jobs.status`、`attempt_count`、`last_error` 與 `printed_at`。
- Raspberry Pi poll heartbeat behavior：已確認 Pi 在 `printer-worker poll` 模式下，即使本輪 `No job available`，仍會透過 `claim -> job: null` 更新 `print_devices.last_seen_at`，所以 Worker 管理頁可在空佇列時維持顯示為在線。
- Printer hardware verification：已確認 Prowill PD-X326 為目前 MVP 實機，支援 `ESC/POS`、80mm、USB/Serial/Ethernet；macOS raw USB 已驗證 ASCII、1D barcode 與 cut。
- Raspberry Pi USB raw verification：已確認 Pi 端 `lsusb`、`/dev/usb/lp0`、ASCII、CP950 / Big5 繁體中文、1D barcode、cut command 全部通過；UTF-8 直送中文會亂碼，有效 cut command 為 `\x1D\x56\x42\x05`。
- Printing MVP decision：工單標籤維持工單號文字與 ASCII-only `paper_order_no` 1D barcode；顧客留存聯使用 QR Code 導向公開查詢頁 `/repair-status`。繁體中文文字必須啟用 `FS &` / `\x1C\x26` 並以 CP950 / Big5 編碼，UTF-8 direct printing 不支援。
- Pi transport decision：正式 Pi worker 直接寫 raw bytes 到 `/dev/usb/lp0`，不使用 CUPS，不使用 macOS printer queue name。
  - Print snapshot payload：`work_order_label` 現在會建立 `templateVersion: 2` 的 immutable print-ready snapshot，包含 `paperOrderNo`、`displayOrderNumber`、`barcodeValue`、`intakeDate`、`customerPhone`、`paymentReceived` 與 `repairCount`；`customer_receipt` 會建立 `templateVersion: 1` snapshot，包含 `paperOrderNo`、`intakeDate`、`customerPhone`、`boardTypeLabel`、`paymentReceived`、`repairCount` 與 `publicLookupUrl`。
  - Label renderer 已改成新版 ESC/POS 版面：置中的收件日期、電話 / Paid、大字工單號、維修處數括號與 1D barcode，條碼高度固定 `0x40`。
  - Customer receipt renderer 已依實測版面使用 page mode、CP950 / Big5 中文、QR Code、form feed 與 cut；QR 內容固定使用 `publicLookupUrl`，不帶工單號 query。
  - 新建 customer receipt 的 `publicLookupUrl` 優先使用 `NUXT_PUBLIC_STATUS_URL`，正式目標為 `https://status.surfboards-reborn.com/repair-status`；既有 immutable snapshot 不回寫。
  - Label renderer 已調整為顯示完整電話，並縮短條碼前後留白，避免單據頭尾多餘空白。
- Worker raw USB transport：`printer-worker serve` 現在會直接把 ESC/POS raw bytes 寫到 `/dev/usb/lp0`，並在成功/失敗後回報既有 `succeed` / `fail` API。
- Staging deployment refresh：GitHub `main` 已推送最新列印整合變更；Supabase staging 已套用 print snapshot migration，Vercel staging 已重新部署並更新穩定 alias。
- Staging login config hardening：已補 `.vercelignore` 排除 local `.env` / `.env.*`，避免 `vercel deploy` 從本機上傳 source 時把 local Supabase demo env 帶進 staging build。
- Pi service refresh：Raspberry Pi 上 `boards-reborn-printer-worker.service` 已同步最新 worker 程式並重啟，啟動後已重新訂閱 `printing:worker-wakeup`。
- Cloud-to-Physical Printing MVP：已完成雲端 Web 建立工單/補印 -> 建立 `print_jobs` -> worker wake-up / claim -> Pi USB raw ESC/POS 實體列印 -> succeeded / failed 回報的端到端流程，現場已可支撐最小可用列印工作流。
- Production printer cutover：已確認 production Supabase / Vercel / Pi `.env` 串接完成，補上 `print_devices` 缺漏的 `insert` grants 後，`raspi-print-worker-01` 已可在 production 成功 claim job 並回報 `printed`。
- Production work-order numbering migrations：production Supabase 已套用自動年度純數字工單號、新建錯單刪除與 `99` 測試工單 namespace migrations；正式 Web 部署與 `99` 工單實體列印驗證進行中。
- Production domain cutover：Vercel Production 已設定 admin/status/app public URLs，四個 custom domains 均維持 verified，並已 live 驗證 admin、status、主網域與 `www` 的 `302` 分流、登入頁放行及舊 `/repair-status` query 保留。
- Vercel Speed Insights：repo 已安裝 `@vercel/speed-insights@2.0.0` 並啟用 Nuxt module；production 重新部署後即可開始收集 Web Vitals。
- Local preview asset fix：`pnpm build` 現在會自動修正 Nitro build output 的 public asset link，避免 `pnpm preview` / `node .output/server/index.mjs` 在本機出現 `/_nuxt/*` `500`。

## 目前焦點

- 把已完成的 Cloud-to-Physical Printing MVP 收斂成穩定可演示的現場流程，補齊文件、runbook 與驗證 checklist。
- 從直接在 `main` 開發，轉向至少 `dev -> staging -> main` 的基本 branch discipline，降低真實場景測試直接衝擊主線的風險。
- 補做真實場景穩定化驗證：Pi 重開機自啟、印表機未連接時 fail / retry、連續 3-5 筆工單不漏印不重印。
- 收斂 staging / production 部署來源，避免 local `.env`、local `.output` 或其他開發態 artifacts 再汙染雲端 build。
- 掃碼端先維持 keyboard wedge 規劃；實際條碼槍硬體與使用者端掃碼 UX，待取得設備後再做實機驗證。

## 下一步

- 建立 `dev` 分支作為日常整合線，讓 `main` 保持接近可展示 / 可部署狀態；後續至少維持 `feature -> dev -> staging 驗證 -> main`。
- 補一個固定的測試環境，建議沿用現有 Vercel staging + Supabase staging，並把 Raspberry Pi worker 指到 staging 先跑 smoke / recovery tests，再決定何時切 production。
- 確認 Raspberry Pi 開機自啟、異常重啟與 `SIGTERM` 收尾在最新 worker 版本下仍正常。
- 驗證印表機未連接、USB 裝置路徑失效、網路中斷等錯誤情境下的 fail / retry 與人工補救流程。
- 連續建立 3-5 筆工單，確認每筆都依序建立並列印工單標籤與顧客留存聯，不重複列印、不漏印；同時確認 `work_order_label.barcodeValue` 與 `paper_order_no` 的對應在掃碼流程可直接使用。
- 實機驗證新建顧客留存聯 QR Code 會導向 `https://status.surfboards-reborn.com/repair-status`，且不把工單號或手機寫進 URL query。
- 規劃並文件化 `locked` / `printing` stale job recovery、device provisioning 與 worker 更新流程。
- 上線前需先 drain 或 discard 舊版 `work_order_label` pending jobs，因新版 worker renderer 不保留舊 payload 相容層；部署 `customer_receipt` 後也需確認 production worker 已更新到可 dispatch 新 job type。
- 掃碼硬體尚未到位前，先維持使用者端查單 / 狀態頁最小可用；拿到條碼槍後再驗證 keyboard wedge 掃碼、掃描後 Enter、自動查詢與批量收件場景。
- 補做 `/admin/scan` 的實機掃碼驗證：不同條碼槍 suffix、未付款交件現場節奏、連續掃描覆蓋輸入框與錯誤掃碼回復流程。
- 與甲方確認 detail / list / dashboard 的資訊優先序與操作節奏，整理前端第二版調整項目。

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

- Schema 與 status rules 已寫入 migration；create/list/detail/update/status/resolve/bulk-status、admin print-jobs、print-worker APIs、worker wake-up 與 Pi 實體列印 runtime 已建立，但 production-grade branch discipline、測試環境操作規範與現場異常 runbook 尚未收斂。
- Admin 單筆 detail/update/status endpoint 保留 UUID path 作為 internal resource identity；現場掃碼或人工輸入工單號時，前端應先呼叫 `GET /api/admin/work-orders/resolve?paperOrderNo=...` 取得 UUID，再呼叫既有 UUID-based endpoint。
- Docker daemon 已確認可用；本地 `supabase start` 與 `supabase db reset` 已成功跑過。第一次啟動時若遇到 Supabase ECR / CloudFront image 下載 timeout，可改從 Docker Hub 拉同版本 image 後 tag 成 `public.ecr.aws/supabase/*` 名稱再重跑。
- Public customer lookup 已落地，但目前 rate limit 採 in-memory store，只適用 local / single-instance MVP，未達 production-grade distributed limiter。
- Staging Supabase / Vercel 基礎部署已完成；`authenticated` table grants 與 `service_role` lookup grants 已推送至 staging，cookie-based `/api/admin/session` 已恢復正常，public lookup 已驗證正確手機 `200`、錯誤手機 `404`、不存在工單 `404` 與 payload 錯誤 `422`。
- Safari 登入頁原本在 autofill / accessibility-set value 情境下可能送出 stale `v-model` form state；目前已改成 submit-time `FormData` 讀值，仍需以實際瀏覽器再跑一次完整登入流程確認。
- 建工單前若無法解析 `repairCount`，現在會直接 `422` 阻擋送出；建工單後若其他 enqueue 失敗，仍需靠 server log 與 admin print-jobs 補建流程補救。
- 這一輪 `work_order_label` renderer 不保留舊 payload 相容；部署前需先清空或放棄舊版 pending label jobs。`customer_receipt` 需要新版 enum / RPC / worker 同步部署，否則舊 worker 會把未知 job type 回報 failure。
- 既有 legacy `SURFBOARD` 工單可能尚未有 `board_length_class`；目前 list / detail 會顯示 `—`，這次沒有補 edit flow 或 backfill。
- 新增工單頁 F8C 尚未完整收尾：送出錯誤 scroll、建立成功後 next actions 尚未在本輪加入。
- Admin 前端目前已有 Tailwind/shadcn shell、dashboard summary、工單列表、detail 的 `view/edit/work`、建單頁、bulk status 與列印中心 / Worker 管理第一版；detail 頁仍保留列印摘要與 deep link，但 bulk status 已改為純掃碼狀態頁，完整 print timeline 仍集中在 `/admin/printing`。
- Worker 管理頁目前的連線狀態仍是前端依 `last_seen_at` 衍生判斷，不是獨立後端 heartbeat service；Pi 若只跑 `run-once`，顯示為離線或心跳過期是預期行為，但持續跑 `poll` 時即使佇列為空也應維持在線。
- Pi worker 已新增 `serve` mode 與 public `printing:worker-wakeup`，並已接上 raw USB worker transport，且已完成 end-to-end 實體出紙；但 Pi 重開機後自啟、長時間常駐穩定性、印表機未連接錯誤處理與 `locked` / `printing` stale job recovery 仍待完整驗證。
- Admin 前端目前仍屬第一版雛形；雖然大方向與主流程已可展示，但欄位配置、文案、資訊密度、互動回饋與模式切換細節尚未定案，預期需在與甲方討論後進行第二版調整。
- Nuxt 4 在此專案目前的本機開發組合下，`experimental.appManifest` 會導致 `/_nuxt/builds/meta/dev.json` 404；目前已先關閉這個實驗功能，以穩定開發中的 admin 頁面導航與刷新行為。
- Nitro `node-server` build output 目前仍依賴 build 後補的 public asset symlink / fallback copy 來讓本機 `preview` 與直接 `node .output/server/index.mjs` 正常提供 `/_nuxt/*`；此 workaround 已落地，但後續仍可追蹤上游 Nitro 行為是否修正。
- shadcn-vue latest 的 `reka-vega` style registry base style 在初始化時回 404；本次以 `--no-base-style` 初始化並依官方 neutral theme scaffold 手動補齊 global CSS tokens。
- 已確認目前印表機型號為 Prowill PD-X326，且 Raspberry Pi raw USB `/dev/usb/lp0` 已驗證可用；CP950 / Big5 繁體中文列印已通過、UTF-8 直送中文不支援。Ethernet TCP `9100` 尚未驗證，因此 production printing workflow 仍有 transport 不確定性。
- 條碼掃描端目前缺少實際條碼槍硬體，因此 user-side 掃碼流程仍停在文件與 Web 輸入設計階段；是否採 keyboard wedge、掃描後自動 Enter 與現場批量操作細節，需等實機後再驗證。
- 目前仍以 `main` 承接主要開發，對真實場景測試風險偏高；若不切出 `dev` / staging discipline，之後 production 行為與正在開發中的變更會持續互相干擾。
