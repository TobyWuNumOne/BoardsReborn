# Frontend Guidelines

這份文件定義 BoardsReborn MVP 的前端設計與實作規範。它是後續 admin page、表單、列表與共用 UI 元件的主要參考。

## Current Status

- 前端工具鏈已導入 Nuxt 4 + Tailwind CSS v4 + shadcn-vue。
- Tailwind CSS 透過 `@tailwindcss/vite` 接入 Nuxt。
- shadcn-vue 透過 `shadcn-nuxt` 與 CLI-generated primitives 接入。
- 目前 `/`、`/login`、`/admin`、`/forbidden` 已重整到 Tailwind/shadcn 基礎。
- `/admin` 已接上 dashboard live data，第一版顯示處理中工單 breakdown、管理 summary 與 quick entries。
- `/admin/work-orders` 已實作 read-only 列表頁，支援 URL query state、篩選、排序、分頁、桌機 table 與手機 card list。
- `/admin/work-orders/[id]` 已實作單一路由 detail page，採 `mode=view|edit|work`；目前 `view` 可用、`edit` 已接上 PATCH、`work` 已接上單筆 status mutation，列印摘要卡可建立工單標籤或顧客留存聯補印任務，LINE 卡片可查綁定/通知/token/job狀態並執行發卡或店家端解除。
- `/admin/work-orders/new` 已實作單頁建單流程，重用 customer lookup 與 create API，並已補 tablet-first F8A/F8B 快捷輸入、sticky 必填摘要，以及 Konva repair marks modal。
- `/admin/work-orders/bulk-status` 已實作第一版批量狀態頁，採 preview 搜尋、共享狀態與依狀態分組的快捷操作。
- `/admin/scan` 已實作第一版掃碼查詢頁，支援單張工單 lookup、付款 / 交件 / 狀態更新 / 快速備註與完整工單導頁。
- `/repair-status` 已實作顧客查進度頁，採同頁查詢表單與結果切換，並支援只讀 repair marks 示意圖。
- repair marks 的編輯與只讀預覽已統一 responsive 規則：`>1024px` 同時顯示正反面，`<=1024px` 改成單面切換；Konva stage 會跟著外層卡片可用空間縮放，不再依賴固定可視像素尺寸。
- repair marks editor modal 現在額外區分直向 editor 版型：直向時維持單面切換，但把單面標記區置中放在上方，設定卡與儲存/取消放到下方，避免畫布高度把設定區擠出可視範圍。
- 目前 admin 前端頁面大多屬第一版雛形：已建立主要流程、資訊架構與操作方向，但欄位編排、文案、資訊層級、互動回饋與 mode 細節不視為最終定稿，預期會在與甲方討論後進入第二版調整。

## Styling Strategy

- 使用 Nuxt 4 + Tailwind CSS + shadcn-vue 作為 MVP 前端方向。
- `components.json` 目前使用 shadcn-vue CLI 的 `reka-vega` style、neutral base color 與 CSS variables。
- 風格參考 shadcn / Linear / Vercel dashboard：乾淨、低彩度、中等資訊密度、操作導向。
- 這是現場作業系統，不是 marketing site；避免過大的 hero、裝飾性卡片、過度插畫、重色塊 ERP 風格。
- MVP 以 light mode 為主。Dark mode 可透過 shadcn-vue tokens 保留相容性，但不是 release requirement。
- 頁面文字以繁體中文優先；技術名詞、狀態 enum、API 欄位可保留英文。

## Route Map

第一版 admin 前端只規劃以下路由：

- `/login`
- `/forbidden`
- `/admin`
- `/admin/work-orders`
- `/admin/work-orders/new`
- `/admin/work-orders/bulk-status`
- `/admin/scan`
- `/admin/work-orders/[id]`
- `/admin/printing`
- `/admin/printing/workers`

第一版 public customer route：

- `/repair-status`

Production domain routing：

- `admin.surfboards-reborn.com` 承載 `/admin/**`、`/login` 與 `/forbidden`。
- `status.surfboards-reborn.com` 承載 `/repair-status` 與 `/repair-status/**`。
- `surfboards-reborn.com` 與 `www.surfboards-reborn.com` 暫時以 `302` 導向 status 查詢入口；舊 `/repair-status` path 與 query 會保留。
- 跨網域導向保留 path 與 query；client-side navigation 在可取得時也保留 hash。SSR 首次請求不保證 hash，因為瀏覽器不會把 fragment 傳給 server。
- localhost、staging、preview 與其他未知 host 不套用 production domain routing。

第一版仍暫不建立獨立的 `/admin/customers`、`/admin/quotes`、`/admin/photos`。列印則例外拆成：

- `/admin/printing`：列印中心，從任務視角看列印紀錄、狀態與 retry
- `/admin/printing/workers`：Print Worker 管理，從設備視角看狀態、最後心跳、最近錯誤與啟停 / 輕量編輯

`/admin` 是真正 dashboard，不是工單列表。第一版 dashboard 放 summary cards 與快速入口，不放完整 table。

第一版 dashboard 由兩塊 summary 組成：

- `處理中工單` 區塊
  - 已收件
  - 除濕中
  - 維修中
- 右側 / 下方 3 張 summary cards
  - 待取件
  - 逾期
  - 今日新建

規則：

- 只顯示 summary，不做圖表、不做 polling。
- `處理中工單` header 顯示總數 `activeWorkOrders`，且固定等於 `RECEIVED + DRYING + REPAIRING`。
- `已收件` 可導到 `/admin/work-orders?status=RECEIVED`
- `除濕中` 可導到 `/admin/work-orders?status=DRYING`
- `維修中` 可導到 `/admin/work-orders?status=REPAIRING`
- `待取件` 可導到 `/admin/work-orders?status=READY_FOR_PICKUP`
- `逾期` 可導到 `/admin/work-orders?overdueEstimatedCompletion=true`
- `今日新建` 第一版不導頁，因現有 list query 尚無對應 filter
- `generatedAt` 只作為最後更新時間顯示，不作為 cache key 或邏輯依據

## Public Lookup

- `/repair-status` 是顧客查進度頁，不需要登入。
- 顧客留存聯 QR Code 固定導向 `https://status.surfboards-reborn.com/repair-status`，不預帶工單號或手機。
- 第一版使用：
  - 工單號
  - 完整台灣手機號碼
- 結果頁只顯示：
  - 工單號
  - 目前狀態
  - progress timeline / cancelled state
  - 預估完成日
  - 初始報價
  - 取板預約官方 LINE CTA
  - 只讀 repair marks 示意圖與維修處數
  - 公開備註
  - 依板型切換的公開費用參考與補板注意事項
  - 最近更新時間
- public progress 由 server 回傳，不由前端自行推導。
- `CANCELLED` 時只顯示取消狀態，不渲染一般 stepper。
- 不把完整手機號碼或工單號寫進 URL query。
- 店家資訊、營業時間、轉帳資訊、取板預約提醒、費用表與補板注意事項屬公開靜態內容；不透過 public lookup API 回傳，也不可因此回傳顧客完整電話或內部資料。
- 查詢前只顯示共通店家資訊；查詢成功後依 `boardType` 顯示 `SURFBOARD / SUP` 或 `SNOWBOARD` 的費用與工作天數說明。
- mobile 顧客查詢結果排序以狀態與取板行動優先：工單號 / 狀態、官方 LINE 預約、目前進度、預估完成日 / 初始報價、公開備註、維修標記圖、費用參考與注意事項。

版型規則：

- desktop（`xl` 起）：
  - 左欄：`處理中工單` + `Quick entries`
  - 右欄：`待取件 / 逾期 / 今日新建`
  - 左右兩欄等寬
- tablet（`md` 到 `<xl`）：
  - 單欄往下排
  - 順序固定為 `處理中工單 → 其他 summary → Quick entries`
  - `處理中工單` 3 個子卡與其他 3 張 summary cards 都可維持 3 欄
- mobile（`<md`）：
  - 單欄往下排
  - 順序同 tablet
  - `處理中工單` 與其他 3 張 summary cards 都改單欄 stack，優先放大點擊區

工單詳情採單一路由 + mode query：

- `/admin/work-orders/[id]?mode=view`
- `/admin/work-orders/[id]?mode=edit`
- `/admin/work-orders/[id]?mode=work`

規則：

- `mode=view` 是預設模式。
- 缺省或非法 mode 需 canonicalize 成 `mode=view`。
- detail data fetching 只依 `work order id`，不依賴 mode。
- mode 切換只能更新 query，不應觸發 full reload 或重抓 detail。

## Layout

- Desktop（`xl` 起）：top bar + left sidebar + main content。
- Tablet / mobile（`<xl`）：top bar + single-column content，sidebar 使用 offcanvas / sheet；第一版不做永久 sidebar。
- Tablet / mobile sidebar 支援左緣右拖開啟、開啟後左拖關閉；維持 button trigger 與 close button 作為備援。
- Mobile sidebar 在點下導航按鈕當下就應先收起；路由切換後也應維持關閉，避免點選導航後還要等待側欄停留在畫面上。
- Sidebar / sheet / mobile layout 已加入 `app/plugins/ssr-width.ts`，以 `provideSSRWidth(1024, nuxtApp.vueApp)` 作為第一版 SSR width baseline。
- Sidebar 第一版在 `Navigation` 區最上方提供加高的 `新增工單` 快捷入口，其下再放：
  - Dashboard
  - 工單
  - 批量狀態
  - 列印
- 後續才加入：
  - 設定

## Data Access

- Admin frontend 只呼叫 Nitro `/api/admin/*`。
- 前端不得直接讀寫 Supabase table。
- Supabase client 在前端只用於 auth session / email-password sign-in / sign-out。
- 工單條碼與現場輸入以 `paper_order_no` 為主；需要 UUID-based detail/update/status endpoint 時，前端先呼叫 resolve endpoint 取得 `work_orders.id`。

掃碼頁使用：

- `GET /api/admin/work-orders/lookup`
- `PATCH /api/admin/work-orders/{id}`
- `POST /api/admin/work-orders/{id}/status`
- `POST /api/admin/work-orders/{id}/quick-note`

工單詳情 LINE 卡片使用：

- `GET /api/admin/work-orders/{id}/line-status`
- `POST /api/admin/work-orders/{id}/line-bind-token`
- `DELETE /api/admin/customers/{customerId}/line-binding`

卡片只顯示 server回傳的安全摘要，不顯示 LINE user ID、token hash、recipient或 prepared payload。發卡成功的 LIFF URL只保留在目前頁面記憶體並提供複製；不自動建立 print job。解除綁定必須先確認，成功後顯示撤銷 token與 skipped pending job數量並 refetch狀態。

建單與單筆狀態更新 response的 `lineNotification` 以 toast補充顯示：enqueue成功是 success；無綁定、已存在或已通知是 info；enqueue失敗是 warning但不得蓋掉主流程成功；`NOT_READY_FOR_PICKUP`不顯示。

列印中心與 Worker 管理使用：

- `GET /api/admin/print-jobs`
- `GET /api/admin/print-summaries`
- `POST /api/admin/print-jobs`
- `POST /api/admin/print-jobs/{id}/retry`
- `GET /api/admin/print-devices`
- `PATCH /api/admin/print-devices/{id}`

## Forms And Validation

- 表單驗證使用 Zod。
- 表單狀態第一版手寫管理，不導入 vee-validate 或其他表單框架。
- Konva / vue-konva 只在 `ClientOnly` 內使用，並透過 client-only Nuxt plugin 註冊，避免 SSR 嘗試存取 canvas / window。
- repair marks 的板面容器以卡片可用空間為準，persisted mark 仍維持 normalized ratio；前端只改當下渲染尺寸，不改資料格式。
- repair marks 響應式規則固定為：`>1024px` 雙面並排，`<=1024px` 單面切換。
- repair marks editor modal 以 iPad 11 吋橫向為優先：`>=1024px` 時設定卡提早進入右側欄，讓 `正面 / 背面 / 設定區` 在 11 吋橫向 87% / 100% 都維持同列；只讀預覽維持既有共享 breakpoint。
- repair marks editor modal 不再依賴大 `min-h` 撐高卡片；dialog body 改以可視高度內的 `flex/grid` 伸縮為主，避免為了看到 `儲存` 再額外往下捲。
- repair marks editor modal 在直向單面模式下，會限制單面畫布卡片寬度並置中，讓設定卡自然排在下方，而不是讓單面畫布直接吃滿 modal 寬度造成高度失控；同時 dialog 高度會盡量貼近全螢幕，並以固定上下分區 + 壓縮設定區內容的方式，優先確保同一畫面內看得到 `儲存`，必要時可省略直向專用的次要說明文。
- 每個 form page 至少定義：
  - idle
  - dirty
  - submitting
  - validation error
  - server error
  - success feedback
- Request body 應由表單層整理成 API contract 定義的 shape，不在 component 深處散落轉換規則。

## Feedback And Errors

- 同頁操作可使用 toast 顯示 action success / failure feedback。
- 若成功後會導頁，或成功後需要在新頁面保留明確回饋，應在頁面頂部顯示 shadcn alert。
- 可點擊的 button / nav button 應提供明確的 hover / active press feedback，至少包含背景或陰影變化，避免現場觸控時無法判斷是否已按下。
- 表單欄位錯誤使用 inline error。
- API error envelope 的 `fieldErrors` 應映射到對應欄位。
- 非欄位錯誤顯示在 form-level alert 或 toast。
- Loading / disabled state 必須跟 action 綁定，避免重複送出。

## Work Order List

- 全尺寸都使用原生 table；窄螢幕以水平 overflow-x 捲動承載固定欄位，不再另外維護 mobile card list。
- 第一版不導入 TanStack Table；等排序、欄位控制、批量選取或虛擬列表需求明確後再評估。

Table 欄位順序：

- 工單號
- 狀態
- 維修數量
- 板型
- 收件時間
- 收版天數
- 提醒

板型欄位顯示 `板型 / 長度分類 / 尺寸標記 / 顏色`。顏色用小方框加文字 label 呈現；標準值 `BLACK / GRAY / WHITE / RED / ORANGE / YELLOW / GREEN / BLUE / PURPLE / MULTICOLOR / WOODGRAIN` 顯示固定 swatch，自訂值顯示中性描邊方框與原始文字。legacy `boardLengthClass = null` 或無顏色時顯示 `—`。

`收件時間` 使用 `intakeDate`，`收版天數` 使用 list API 回傳的 `daysInShop`，`維修數量` 使用 `repairCount`；legacy null 顯示 `—`。整列仍可點擊進入工單詳情，不在列表中另放查看詳情按鈕。

## Work Order Detail

- 工單詳情 route 只有一個：`/admin/work-orders/[id]`。
- `view` 用於完整只讀檢視。
- `edit` 用於管理修正，接既有 `PATCH /api/admin/work-orders/{id}`。
- `work` 保留給現場操作；第一版已接上單筆 status mutation。
- 目前 detail page 的 `view/edit/work` 只代表第一版資訊架構與操作分區已成立，不代表欄位排序、區塊展開方式、文案與操作節奏已定稿。
- F4 的 detail header 在三個 mode 需維持一致：
  - 工單號
  - 目前狀態
  - 返回列表
  - mode toggle
- F4 的 detail page 至少顯示：
  - 工單摘要
  - 列印狀態摘要
  - 顧客資訊
  - 板子資訊
  - 報價資訊
  - 取件資訊
  - 狀態歷史
- detail 的只讀 `受損位置` 預覽需獨立使用一整列，不與 `板子資訊` 共用同一排寬度，避免平板寬度下雙面預覽被擠壓裁切。
- detail header 若顯示板型摘要，需一併顯示衝浪板長度分類摘要。
- F5B 的 edit mode 規則：
  - 單一整頁表單與單一 Save / Reset
  - dirty comparison 使用 normalized values，不直接比 raw input
  - nullable text 的 `null` / 空字串 / 全空白視為等價
  - `storageFeeWarningAfterDays` 在 form state 內保留字串，送出時才轉正整數
  - `paymentReceivedAt` 只讀，必須以 refresh 後的 server detail response 顯示
  - 有未儲存變更時，切 mode、返回列表、reload 都需確認離開
- F5A 的 work mode 規則：
  - 直接接 `POST /api/admin/work-orders/{id}/status`
  - 只處理 `status`、`note`、`internalNote`
  - 可選和目前相同的狀態，用於再 append 一筆 `status_history`
  - `note` 永遠包含在 request 中；空白送 `null`
  - `internalNote` 空白代表不變更既有內部備註；若要清空，改走 `mode=edit`
  - 成功後 refresh detail、清空 form，並保留在 `mode=work`
- detail 頁列印狀態卡使用 `GET /api/admin/print-summaries?workOrderId=...`，只刷新 summary，不因列印事件整頁重抓 work order detail。
- detail 頁列印狀態卡只顯示 summary + deep link，不嵌入完整 print timeline。
- detail 頁列印 action 使用 dialog 選擇 job type；第一版支援 `work_order_label`（工單標籤）與 `customer_receipt`（顧客留存聯），每次送出都建立新的 print job。
- detail 頁若最新列印任務處於 `pending / locked / printing`，需短週期補抓 print summary，直到進入 terminal state，避免 Realtime 漏事件時卡在 `已鎖定`。

## Work Order Create

- 建單頁定位是「現場收件流程」，不是一般後台 CRUD 表單。
- `/admin/work-orders/new` 採單頁分區表單，不做 wizard。
- 平板 / 手機第一屏優先顯示：
  - 系統產生的工單號
  - 顧客手機
  - 查詢顧客
  - 板型
  - 固定可見的建立按鈕
- 建單頁以平板現場收件為主要操作情境：
  - 本頁可局部加大 input、button、option card、checkbox 與 chip 的觸控尺寸，不需全域修改 shadcn primitives。
  - 工單號由後端產生，頁面只顯示目前估算值且不可編輯；顧客手機與初始報價使用 numeric / tel input attributes 協助平板叫出數字鍵盤。
  - 衝浪板尺寸、預估完成日、初始報價、損傷描述、公開備註與內部備註可提供 quick actions；quick actions 只寫回既有 form state。
  - sticky action bar 顯示必填欄位完成度與未完成欄位，並保留清除 / 建立工單操作。
- admin sidebar 提供 `/admin/settings` 後台設定入口；設定頁的「新增測試工單」導向 `/admin/work-orders/new?mode=test`，不加入行動版頂部核心導覽。
- 測試模式共用同一份建單表單，標題與警示需說明會建立真實資料並送出列印；單號預填下一個 `99` 流水號且可修改。正式模式仍唯讀且不可指定單號。
- 建單頁欄位需直接標示必填/選填：必填顯示紅字 `（＊必填）`，非必填顯示灰字 `不必填`。
- 建立成功後以 detail 頁與出單機列印的正式 `paperOrderNo` 為準；若送出前估算值被其他建單使用，前端不阻擋建立。
- 只有 `boardType = SURFBOARD` 時才顯示 `boardLengthClass` 選項（短板 / 中尺寸 / 長板）；切換到 `SUP` / `SNOWBOARD` 時需清空該欄位。
- 顧客流程固定為 lookup-first：
  - 先查手機
  - 查到候選顧客時由店員手動選 reuse，或改成建立新顧客
  - 手機號碼變更後必須清空 lookup 結果與 reuse/create 決策
- `estimatedCompletionDate` 預設由 `intakeDate` 計算，第一版規則為固定下週日；在使用者手動改過前，`intakeDate` 改變時可自動重算。
- 初始報價可留空；若有填金額，送單筆 `INITIAL` quote item。
- `damageDescription` 在建單頁屬選填；若留空，create payload 可省略 `workOrder.damageDescription`。
- 建單頁必須在送出前解析出非空 `repairCount`：
  - `auto` 模式：至少一筆 repair mark
  - `manual` 模式：必填正整數維修處數
- create API 若回 `workOrder.repairCount` 這類巢狀欄位錯誤，前端需映射回 `repairCount` inline error。
- `paymentReceived = true` 且未填初始報價時只顯示 warning，不阻擋提交。
- 建立成功後：
  - 清除 unsaved-change guard
  - 顯示 success toast
  - 導向 `/admin/work-orders/[id]?mode=view&created=1`
  - detail 頁頂部顯示 success alert，讓導頁後仍可確認操作成功

## Bulk Status

- `/admin/work-orders/bulk-status` 是獨立的現場批量操作頁，不共用工單列表的 URL query state。
- 第一版直接重用既有：
  - `GET /api/admin/work-orders/resolve`
  - `POST /api/admin/work-orders/bulk-status`
- 頁面採 hybrid 操作模型：
  - 先貼上多筆工單號
  - 先做 preview 搜尋
  - 用共享 `status` select + `note` 做整批更新
  - 依 `currentStatus` 分組提供「下一階段」快捷按鈕
- textarea parser 規則：
  - 支援換行、逗號、空白
  - trim
- preview 區只保留掃碼後核對狀態所需的工單資料，不顯示列印摘要或列印操作。
- recent batch result 區只顯示 updated / skipped 摘要與狀態結果，不顯示列印摘要。

## Scan Page

- `/admin/scan` 是獨立的現場單張工單工具頁，不是 detail page 的 mode，也不取代列表或批量頁。
- 頁面頂部固定一個長駐搜尋欄，placeholder 固定為 `掃描或輸入工單號`。
- keyboard wedge 規則：
  - 掃碼頁：`Enter` 代表立即查詢
  - 批量頁：`Enter` 代表分隔不同單號，不直接送出整批查詢
  - 工單列表頁：`Enter` 可作為一般搜尋送出
- 掃碼頁查詢完成後，input 需自動全選，方便下一次掃描直接覆蓋。
- 掃碼頁成功操作後，應重新 fetch 同一筆 lookup payload，讓主卡片、付款狀態與快速操作依最新 server 狀態更新。
- 第一版快速操作只做：
  - 標記已付款
  - 標記已交件
  - 更新狀態
  - 新增備註
  - 開啟完整工單
- 第一版不在掃碼頁內完成照片上傳或追加費用，這些仍導去完整工單頁。

## Printing Center

- `/admin/printing` 是列印中心首頁，先看列印紀錄列表，再進 Worker 管理。
- 頁面目的：
  - 快速判斷成功 / 失敗 / 處理中 / 待列印
  - 依工單號或狀態篩選最近任務
  - 對 `failed` 任務直接 retry
- 首屏抓 snapshot 後，改由 Supabase Realtime 通知觸發 refetch；hidden tab 不做固定 polling。
- 列表規則：
  - desktop（`xl` 起）用 table
  - `xl` 以下用 card list
  - 每列左側固定顯示狀態燈
  - 綠色 `printed`
  - 紅色 `failed`
  - 黃色 `locked` / `printing`
  - 灰色 `pending`
  - 深灰 `cancelled`
- 第一版欄位：
  - 燈號
  - 工單號
  - 任務類型（工單標籤 / 顧客留存聯）
  - 任務狀態
  - 板型摘要
  - 裝置 / `lockedBy`
  - 嘗試次數
  - 最近錯誤
  - 建立 / 更新時間
  - Retry action
- 第一版不做 print job detail page；工單號直接連到既有 work-order detail。

## Print Worker 管理

- `/admin/printing/workers` 是設備視角頁面，不和列印任務列表混在同一頁。
- 第一版頁面目的：
  - 看哪台 worker 在線
  - 看最後心跳
  - 看目前鎖住哪筆 job
  - 看最近錯誤
  - 做啟用 / 停用與名稱 / 位置編輯
  - 直接在 UI 新增 / 刪除 worker，不需要再去 Supabase Studio 手動維護
- 由於第一版預期只有 1~2 台裝置，這頁**不做查詢、篩選或分頁控制**，直接顯示全部 worker。
- 頁面首屏先抓一次 worker list，之後改由 Supabase Realtime notification layer 觸發 refetch。
- fixed fallback sync 僅在頁面可見時啟用，頻率為每 `60` 秒一次。
- 分頁 hidden 時不可再固定打 worker list API；回到 visible 時若收到事件或最後同步已超過 `60` 秒，需立刻補一次 refresh。
- 第一版欄位：
  - 燈號
  - Worker 名稱
  - `deviceKey`
  - 位置
  - 狀態
  - 最後心跳
  - 目前任務
  - 最近錯誤
  - 操作
- 第一版允許動作：
  - 新增 worker（shadcn `Dialog`）
  - 編輯名稱
  - 編輯位置
  - 將 `status` 設成 `active` / `inactive` / `error`
  - 快速啟用 / 停用
  - 刪除沒有進行中 job 的 worker
- 連線狀態顯示規則：
  - `status = error` -> `錯誤` / 紅燈
  - `status = inactive` -> `停用` / 灰燈
  - `status = active` 且 `lastSeenAt` 在 30 秒內 -> `在線` / 綠燈
  - `status = active` 且 `lastSeenAt` 為空 -> `離線` / 灰燈
  - `status = active` 且 `lastSeenAt` 超過 30 秒 -> `心跳過期` / 黃燈
- `在線 / 離線 / 心跳過期` 都是前端衍生 UI 狀態，不回寫 DB，也不新增 API 欄位。
- `lastSeenAt` 的過期判斷應以本地時間推進，不可依賴持續打 API 來更新燈號。
- 只要 Pi 持續跑 `printer-worker poll`，即使暫時沒有待印任務，`claim -> job: null` 也會刷新 `lastSeenAt`；因此空佇列時仍應維持顯示為 `在線`。
- 第一版不做：
  - 重設 `deviceKey`
  - 重發 worker bearer token
  - 遠端重啟 Raspberry Pi
  - 從 UI 直接送出實體列印命令
  - dedupe
  - 保留首次出現順序
- preview resolve 由 client fan-out 執行，固定限制為 `6` 個並行 request。
- 單筆 resolve `404` 與其他非 auth 失敗都視為 `notFound`，不中斷整批搜尋。
- textarea 內容改動後，既有 preview 立刻標記為 stale；只有下一次完整搜尋成功完成後才恢復 active。
- `found` 工單預設全選，但可逐筆排除。
- preview item 資訊密度需接近工單列表，至少顯示：
  - 工單號
  - 狀態 badge
  - 顧客姓名 / 電話
  - 板型 / 長度分類 / 尺寸 / 顏色
  - 預估完成日
  - 提醒 badges
  - 最近更新
- preview item 不以 UUID 作為主要展示內容；UUID 可保留在內部 state，但不放在預設卡片資訊層級。
- `found` 固定依下列狀態順序分組：
  - `RECEIVED`
  - `DRYING`
  - `REPAIRING`
  - `READY_FOR_PICKUP`
  - `DELIVERED`
  - `CANCELLED`
- group-level 快捷規則：
  - `RECEIVED -> REPAIRING`
  - `DRYING -> REPAIRING`
  - `REPAIRING -> READY_FOR_PICKUP`
  - `READY_FOR_PICKUP -> DELIVERED`
- 共享 `status=DRYING` 時若選取集合含 `SNOWBOARD`，只顯示 warning，不阻擋送出；實際略過仍以 server `INVALID_STATUS_TRANSITION` 為準。
- bulk submit 期間會鎖住 selected snapshot，禁止改動 textarea、selection、status、note 與快捷按鈕。
- 成功後：
  - 顯示 updated / skipped 摘要 toast
  - 在頁面頂部顯示 success alert
  - 保存最近一次批量結果
  - 重新執行 preview 搜尋
- 第一版不支援：
  - `internalNote`
  - 掃碼裝置事件監聽
  - URL query-based page state

## Status Badges

狀態不可只靠顏色辨識，必須同時顯示文字與 badge。

| Status             | UI label     | Color meaning            |
| ------------------ | ------------ | ------------------------ |
| `RECEIVED`         | 已收件       | neutral                  |
| `DRYING`           | 除濕中       | blue                     |
| `REPAIRING`        | 維修中       | amber                    |
| `READY_FOR_PICKUP` | 已完工待取件 | green + warning emphasis |
| `DELIVERED`        | 已交件       | green                    |
| `CANCELLED`        | 已取消       | muted                    |

## UI States

每個 list page 都必須處理：

- loading
- error
- empty
- filtered empty
- pagination

每個 action 都必須處理：

- disabled state
- loading state
- success feedback
- failure feedback

## Component Boundaries

- `components/ui` 只保留 shadcn-vue primitives。
- `components/ui` 以 CLI 生成內容為主；除非必要 bugfix，不自行改寫 primitive 對外 API。
- 業務元件放在明確的 feature 區域，例如 `components/admin` 或 `components/work-orders`。
- 不要一開始建立過多抽象，例如通用 `BaseTable`、`BaseForm`、`BaseModal`。等重複出現兩到三次後再抽。
- 業務規則不放進 `components/ui`。

第一批 shadcn-vue primitives：

- `button`
- `calendar`
- `card`
- `input`
- `label`
- `field`
- `alert`
- `badge`
- `popover`
- `radio-group`
- `separator`
- `skeleton`
- `spinner`
- `sonner`
- `sidebar`
- `table`
- `pagination`
- `dropdown-menu`
- `sheet`
- `tooltip`

## Implementation Priority

前端後續建議順序：

1. 與甲方確認第一版 admin 前端雛形後，整理並執行第二版 UI / UX 細節調整。
2. 盤點列印流程與 detail / create / bulk status 之間的前端銜接。
3. 規劃掃碼 / print flow 在現場批量操作頁的後續整合。

## LINE MVP Frontend（order-gate implemented，remaining integration planned）

- `/line/order-gate` 已作為 LIFF 綁定頁；status domain允許此路徑，不會被 domain routing導回 `/repair-status`。
- 未綁定顧客的留存聯以 `https://liff.line.me/{LIFF_ID}/?t={token}` 進入綁定；LINE Developers LIFF endpoint 已是 `/line/order-gate`，因此 LIFF URL 不再額外附加 `/line/order-gate`，避免 secondary redirect 變成 `/line/order-gate/line/order-gate`。已綁定顧客留存聯仍指向 `/repair-status`。
- Order-gate 必須同時支援從 `?t=...` 與 LINE redirect 後的 `liff.state` 取回 token，避免 LIFF login / redirect 過程遺失綁定憑證。
- 加官方帳號不是綁定必要條件，但 order-gate 與綁定成功畫面必須明確引導加入官方 LINE。
- UI 必須分開顯示「已綁定」與「可通知」。後台可通知狀態至少區分可通知、尚未加好友 / 未知、已封鎖，以及最近發送只獲 LINE API accepted。
- Pending token 顯示工單安全摘要與主要綁定 action；expired、revoked、invalid 顯示聯絡店家重新發卡。
- Used token 若 Customer 仍有有效綁定，顯示「已綁定」與前往查詢 CTA；若綁定已解除，只顯示憑證失效並要求聯絡店家重新發卡。
- 綁定成功頁不得假設可以免驗證查詢。由於 `/repair-status` 仍要求工單號與完整電話，成功頁顯示成功狀態、加入好友 CTA、工單號與「前往查詢」按鈕；不得把完整電話放進 URL。
- Admin 工單詳情規劃顯示綁定狀態、LINE 暱稱、好友 / 可通知狀態、latest token、最近 job 狀態、重新發卡與解除綁定。MVP 不重工 Customer 詳情頁。
- 顧客端不提供解除綁定。解除綁定與重新發卡必須是 admin 明確操作並有確認文案。
- Order-gate成功後停留在成功畫面，不自動導頁；提供查詢進度與官方 LINE CTA，並說明查詢仍需工單號與完整手機。
