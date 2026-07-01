# Project Progress

這份文件是本 repo 目前「以程式碼與版本庫內容可驗證」的實作狀態單一事實來源。其他文件若要提到目前已完成、尚未完成、下一步或主要風險，應優先連到本文件，而不是各自維護容易過時的現況說明。

## 更新規則

- 開始變更前先讀本文件，確認目前階段、已完成項目、下一步與風險。
- 完成變更後，如果實作能力、里程碑狀態、下一步或風險有變化，必須更新本文件。
- 如果其他文件需要提到目前 repo 狀態，保留短摘要即可，詳細現況統一以本文件為準。
- 本文件追蹤的是 repo / implementation progress，不是顧客查詢或工單維修進度；產品語意仍以 [product.md](product.md) 與 [api-contract.md](api-contract.md) 為準。
- 除非本 repo 內已有 runbook、測試或文件可佐證，否則不要把一次性 deployment / 真人測試 / 雲端當下狀態寫成長期現況。

## 目前快照

- 最後更新：2026-07-01
- 目前階段：MVP 主流程與上線前最低資安防護已落地；目前重點是文件收斂、測試/驗證補強與現場穩定化
- 整體狀態：進行中

### 以目前程式碼可確認的能力

- Nuxt 4 主站與 Nitro server API 已建立，`app/`、`server/`、`tests/`、`supabase/`、`printer-worker/` 結構完整。
- 前端工具鏈已接上 Node 22、Nuxt 4.4、Vue 3.5.39、TypeScript、Tailwind CSS v4、shadcn-nuxt、Unovis、Vitest、ESLint、Prettier。
- Supabase migration 已從初始 schema 走到工單、列印、repair marks、自動工單號、測試工單號與 LINE MVP foundation。
- Admin auth/session 最小流程已存在：`/login`、`/admin`、`/forbidden`、session endpoint 與 admin gate helper 已落地。
- Admin dashboard 已存在，並有 server 端 summary / statistics API：`GET /api/admin/dashboard`，支援近 12 週 / 近 12 個月收件統計；Unovis chart 實作已隔離在 client-only component，避免 production SSR 載入 browser-dependent chart runtime。
- 工單管理主流程已存在：建立、列表、詳情、編輯、單筆狀態更新、bulk status、掃碼 lookup、quick note、刪除測試/錯單流程。
- 顧客詳情頁 `/admin/customers/[id]` 已存在，支援 profile 編輯、LINE 管理、工單列表與工單轉移。
- 工單建立改走系統自動產生純數字 `paper_order_no`；測試工單號 `99` namespace migration 也已存在。
- `repair_marks` 與 `repair_count` 已是正式資料模型，包含 migration、API 映射、前端 Konva editor 與 public read-only 預覽。
- `board_length_class`、`board_color` 等板子快照欄位已進入 schema、API 與 admin UI。
- Public `/repair-status` 顧客查詢頁與 `POST /api/public/work-orders/lookup` 已存在，並使用工單號 + 完整手機驗證；public lookup response 已設定 no-store、不回 repair mark DB UUID，rate limit 已改為 DB-backed，且同時套用 IP-only 與 lookup tuple buckets。
- 上線前最低資安防護已加入：核心資料表 authenticated RLS hardening、admin unsafe method 同源檢查、全站安全 headers / Referrer-Policy、Supabase cookie SameSite、CSP 與 Google Fonts host 同步、Nuxt dependency high/critical audit 修補基準。
- 非同步列印主流程已存在：`print_jobs` / `print_devices` schema、admin 列印中心 API/UI、worker claim/succeed/fail API，以及 Python `printer-worker` 子專案。
- `printer-worker` 已有 renderer、transport、realtime wake-up、`run-once` / `poll` / `serve` 相關程式與測試檔。
- LINE MVP server/client 流程已在 repo 內存在：LIFF order-gate page、bind token service、public confirm/resolve API、webhook、job processor、Flex message helpers、admin line status / 發卡 / 解除綁定 API。
- 相關單元測試已覆蓋主要模組：work-order API、public lookup、printing、LINE token / order-gate / processor / webhook、frontend admin 頁面與 routing。

### 目前 repo 內可見的頁面

- Public: `/`, `/repair-status`, `/line/order-gate`, `/line/order-gate/t/[...parts]`
- Auth: `/login`, `/forbidden`
- Admin: `/admin`, `/admin/statistics`, `/admin/work-orders`, `/admin/work-orders/new`, `/admin/work-orders/[id]`, `/admin/work-orders/bulk-status`, `/admin/customers`, `/admin/customers/[id]`, `/admin/scan`, `/admin/printing`, `/admin/printing/workers`, `/admin/settings`

### 目前 repo 內可見的 API

- Admin session / dashboard statistics / customer lookup
- Admin customers: list, detail, patch, LINE bind token, work-order transfer
- Admin work-orders: create, list, detail, patch, status, bulk-status, lookup, resolve, next-paper-order-no, quick-note, delete
- Admin printing: print-jobs list/create/retry, print-devices list/create/patch/delete, print-summaries
- Public: work-order lookup, LINE bind resolve/confirm
- Internal / worker: line-jobs process, print-worker claim/succeed/fail
- Webhook: `POST /api/webhooks/line`

## 已完成里程碑

- 核心規格文件：done
  - `docs/product.md`、`docs/domain-model.md`、`docs/api-contract.md`、`docs/barcode-printing.md`、`docs/frontend.md`、`docs/ai-dev-rules.md` 已存在。
- Minimal Nuxt scaffold 與基礎工具鏈：done
  - 基本 app shell、lint、typecheck、Vitest baseline、runtime 結構已建立。
- Supabase schema foundation：done
  - 初始工單 schema、status rules、admin work-order API 所需 migration 已建立。
- Admin work-order API：done
  - create/list/detail/patch/status/bulk-status/lookup/resolve/delete/quick-note 已落地。
- Admin 前端第一版：done
  - dashboard、詳細統計、工單列表、詳情、顧客列表/詳情、建單、bulk status、scan、settings、printing、workers 頁面已落地。
  - dashboard / 詳細統計頁已使用 Unovis 長條圖顯示收件趨勢，並支援近 12 週 / 近 12 個月切換；詳細統計頁可展開衝浪板長度比例。
  - 建單送出期間已有全頁可見 loading feedback；工單詳情頁初始資料與列印摘要採 lazy fetch，避免導頁被 detail payload 阻塞。
- Public customer lookup：done
  - `/repair-status` 與 public lookup API 已存在，含 repair marks read-only 顯示。
- Printing MVP code path：done
  - `print_jobs` / `print_devices`、admin 列印 API/UI、Python worker、renderer/transport/realtime 程式已存在。
- LINE MVP code foundation：done
  - bind token issuance/resolve/confirm、order-gate page、webhook、job processor、admin line management、LINE notification helper 已存在。

## 各模組現況

### Work Orders

已完成：

- `GET /api/admin/work-orders` 列表、filter、sort、pagination
- `POST /api/admin/work-orders` 建立工單
- `GET /api/admin/work-orders/{id}` 詳情
- `PATCH /api/admin/work-orders/{id}` 編輯
- `POST /api/admin/work-orders/{id}/status` 單筆狀態更新
- `POST /api/admin/work-orders/bulk-status` 批量狀態更新
- `GET /api/admin/work-orders/lookup` 與 `GET /api/admin/work-orders/resolve`
- `POST /api/admin/work-orders/{id}/quick-note`
- `DELETE /api/admin/work-orders/{id}`
- 自動數字工單號與 `99` 測試工單號 migration
- 工單 detail / create / bulk status / scan 第一版 UI；scan 可用狀態操作會依板型排除雪板除濕；scan / detail / bulk 交件入口會在未收款時先顯示確認流程

仍待確認或補強：

- 刪除工單的實際使用規則與 production guardrail 是否已完全收斂
- 掃碼頁與 bulk status 的實機條碼槍驗證流程
- 更多端到端驗證，而不只單元測試與文件描述

### Repair Marks

已完成：

- `work_order_repair_marks` schema 與 `repair_count` 欄位
- create/detail/patch/public lookup contract 映射
- Konva editor、只讀 gallery、responsive 單雙面切換

仍待確認或補強：

- 舊資料 backfill 與 legacy null 狀態的營運規則
- 實機平板長時間操作體驗與更多手勢/效能驗證

### Public Lookup

已完成：

- `/repair-status` 同頁查詢與結果顯示
- 工單號 + 完整手機驗證
- 公開狀態、預估完成日、初始報價、公開備註、repair marks、官方 LINE CTA
- `Cache-Control: no-store, private`
- Public repair marks 不回傳 DB UUID
- DB-backed rate limit，跨 server instance 共用計數，public lookup 同時限制 IP-only 與 lookup tuple，rate-limit key 不保存工單號或電話明文

仍待確認或補強：

- 顧客頁 copy、費用說明與現場話術仍可能繼續微調

### Printing

已完成：

- `print_jobs` / `print_devices` queue model 與相關 migrations
- Admin 列印中心與 worker 管理頁
- `GET/POST /api/admin/print-jobs`、retry、print-devices CRUD、print-summaries
- Print Worker claim / succeed / fail API
- Python `printer-worker` 的 renderer、transport、service、worker_realtime 與測試
- 建單後 best-effort 建立列印任務的程式碼路徑

仍待確認或補強：

- repo 雖有完整 worker/runtime 程式，但長時間常駐、stale job recovery、device provisioning、異常 runbook 仍應持續收斂
- 本文件不再把某次 staging/production/Pi 手動驗證寫成固定現況；若要保留，應整理到獨立 runbook 或 release 驗證文件

### LINE Integration

已完成：

- LINE schema foundation：`customer_line_accounts`、`line_bind_tokens`、`line_jobs` 與相關 migrations
- bind token issue / resolve / confirm server flow
- LIFF order-gate page 與 token path/query 解析頁
- admin 發卡、查詢 line status、解除綁定 API
- LINE webhook、job processor、Flex message helper、notification utility
- 與工單 READY / 新工單收件相關的通知 migration 與 server utility
- 對應單元測試：token、order-gate、processor、webhook、admin/public line API

仍待確認或補強：

- repo 內可證明功能已實作，不等於 production release verification 永久有效
- 綁定/好友狀態/通知的真人流程驗證應留在 `docs/line-release-verification.md` 或未來 runbook，不應全部堆回 progress
- 若後續增加手動補發、更多通知類型、顧客中心等，仍屬 scope 擴張，需要先更新產品文件

## 測試現況

- `tests/unit/` 已包含 work-order、printing、public lookup、LINE、frontend UI、routing、migration guard 等測試檔。
- `printer-worker/tests/` 已包含 renderer、print runner、worker realtime 測試。
- 目前本 repo 看得出來有不錯的單元測試覆蓋，但本文件不假設所有測試在當下環境都已重新跑過；每次任務仍應在 completion report 明確說明本次實際執行的驗證。

## 目前焦點

- 把 `docs/progress.md` 維持為「以 repo 可驗證實作為準」的乾淨現況文件。
- 收斂 MVP 主流程文件，減少過期的 deployment / 真人驗證敘述混入 repo 狀態說明。
- 補強列印與 LINE 的 runbook / release verification 邊界，讓 `progress.md` 專注在實作狀態。
- 持續補 end-to-end 與現場操作驗證，尤其是掃碼、列印恢復、LINE 通知實機流程。
- 完成資安 hardening 後，需要在 staging / production 套用 migration、更新 Node runtime、重跑 deployment audit。

## 下一步

- 重新整理 `docs/line-release-verification.md`、`docs/deployment.md` 等文件，把一次性驗證紀錄與長期 runbook 拆清楚。
- 針對列印與 LINE 補更明確的 recovery / failure-mode runbook。
- 補做實機掃碼驗證：不同條碼槍 suffix、連續掃描、錯誤碼處理與現場節奏。
- 補做列印穩定化驗證：worker 重啟、自啟、印表機未連接、stale job recovery、retry 人工流程。
- 若要宣稱某個 staging/production 狀態仍有效，應補新的驗證時間與證據來源，而不是沿用舊敘述。

## 風險與阻塞

- `progress.md` 過去混入大量 deployment / production 真人驗證敘述，容易隨時間失真；已知這是文件維護風險。
- Node baseline 已升到 22.12+；deployment runtime 若仍停在 Node 20，Nuxt 4.4 runtime 將無法符合 engine 要求。
- 資安 hardening migration 尚需在 staging / production 套用並確認非 admin authenticated user 無法直接讀寫 Supabase tables。
- LINE 與 printing 都已有完整程式碼路徑，但長時間穩定性、異常處理與現場 runbook 仍是風險區。
- Admin 前端已可用，但仍屬第一版，欄位編排、資訊密度、回饋節奏與操作細節仍可能再調整。
- Legacy 資料如 `board_length_class` / `repair_count` / repair marks 缺值情況，仍需依實際資料狀態決定是否 backfill。
