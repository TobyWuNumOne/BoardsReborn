# Frontend Guidelines

這份文件定義 BoardsReborn MVP 的前端設計與實作規範。它是後續 admin page、表單、列表與共用 UI 元件的主要參考。

## Current Status

- 前端工具鏈已導入 Nuxt 4 + Tailwind CSS v4 + shadcn-vue。
- Tailwind CSS 透過 `@tailwindcss/vite` 接入 Nuxt。
- shadcn-vue 透過 `shadcn-nuxt` 與 CLI-generated primitives 接入。
- 目前 `/`、`/login`、`/admin`、`/forbidden` 已重整到 Tailwind/shadcn 基礎。
- `/admin` 已接上 dashboard live data，第一版顯示處理中工單 breakdown、管理 summary 與 quick entries。
- `/admin/work-orders` 已實作 read-only 列表頁，支援 URL query state、篩選、排序、分頁、桌機 table 與手機 card list。
- `/admin/work-orders/[id]` 已實作單一路由 detail page，採 `mode=view|edit|work`；目前 `view` 可用、`edit` 已接上 PATCH、`work` 已接上單筆 status mutation。
- `/admin/work-orders/new` 已實作單頁建單流程，重用 customer lookup 與 create API。
- `/admin/work-orders/bulk-status` 已實作第一版批量狀態頁，採 preview 搜尋、共享狀態與依狀態分組的快捷操作。
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
- `/admin/work-orders/[id]`

暫不建立獨立的 `/admin/customers`、`/admin/quotes`、`/admin/photos`、`/admin/print-jobs`。顧客、報價、照片與列印資訊先放在工單流程內，等複雜度提高後再拆頁。

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
- Sidebar / sheet / mobile layout 已加入 `app/plugins/ssr-width.ts`，以 `provideSSRWidth(1024, nuxtApp.vueApp)` 作為第一版 SSR width baseline。
- Sidebar 第一版只放：
  - Dashboard
  - 工單
  - 批量狀態
- 後續才加入：
  - 設定
  - 列印佇列

## Data Access

- Admin frontend 只呼叫 Nitro `/api/admin/*`。
- 前端不得直接讀寫 Supabase table。
- Supabase client 在前端只用於 auth session / email-password sign-in / sign-out。
- 工單條碼與現場輸入以 `paper_order_no` 為主；需要 UUID-based detail/update/status endpoint 時，前端先呼叫 resolve endpoint 取得 `work_orders.id`。

## Forms And Validation

- 表單驗證使用 Zod。
- 表單狀態第一版手寫管理，不導入 vee-validate 或其他表單框架。
- 每個 form page 至少定義：
  - idle
  - dirty
  - submitting
  - validation error
  - server error
  - success feedback
- Request body 應由表單層整理成 API contract 定義的 shape，不在 component 深處散落轉換規則。

## Feedback And Errors

- 使用 toast 顯示 action success / failure feedback。
- 表單欄位錯誤使用 inline error。
- API error envelope 的 `fieldErrors` 應映射到對應欄位。
- 非欄位錯誤顯示在 form-level alert 或 toast。
- Loading / disabled state 必須跟 action 綁定，避免重複送出。

## Work Order List

- Desktop（`xl` 起）使用原生 table。
- Tablet / mobile（`<xl`）使用 card list，不把完整 table 硬塞進較窄 viewport。
- 第一版不導入 TanStack Table；等排序、欄位控制、批量選取或虛擬列表需求明確後再評估。

Desktop / tablet table 欄位：

- 工單號
- 狀態
- 顧客
- 板型
- 預估完成日
- 提醒
- 最近更新
- 操作

Mobile card 欄位：

- 工單號
- 狀態 badge
- 顧客 / 電話
- 板型
- 預估完成日
- 提醒 badges
- 最近更新

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
  - 顧客資訊
  - 板子資訊
  - 報價資訊
  - 取件資訊
  - 狀態歷史
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

## Work Order Create

- 建單頁定位是「現場收件流程」，不是一般後台 CRUD 表單。
- `/admin/work-orders/new` 採單頁分區表單，不做 wizard。
- 平板 / 手機第一屏優先顯示：
  - 紙本工單號
  - 顧客手機
  - 查詢顧客
  - 板型
  - 固定可見的建立按鈕
- 顧客流程固定為 lookup-first：
  - 先查手機
  - 查到候選顧客時由店員手動選 reuse，或改成建立新顧客
  - 手機號碼變更後必須清空 lookup 結果與 reuse/create 決策
- `estimatedCompletionDate` 預設由 `intakeDate` 計算，第一版規則為固定下週日；在使用者手動改過前，`intakeDate` 改變時可自動重算。
- 初始報價可留空；若有填金額，送單筆 `INITIAL` quote item。
- `paymentReceived = true` 且未填初始報價時只顯示 warning，不阻擋提交。
- 建立成功後：
  - 清除 unsaved-change guard
  - 顯示 success toast
  - 導向 `/admin/work-orders/[id]?mode=view`

## Bulk Status

- `/admin/work-orders/bulk-status` 是獨立的現場批量操作頁，不共用工單列表的 URL query state。
- 第一版直接重用既有：
  - `GET /api/admin/work-orders/resolve`
  - `POST /api/admin/work-orders/bulk-status`
- 頁面採 hybrid 操作模型：
  - 先貼上多筆紙本工單號
  - 先做 preview 搜尋
  - 用共享 `status` select + `note` 做整批更新
  - 依 `currentStatus` 分組提供「下一階段」快捷按鈕
- textarea parser 規則：
  - 支援換行、逗號、空白
  - trim
  - dedupe
  - 保留首次出現順序
- preview resolve 由 client fan-out 執行，固定限制為 `6` 個並行 request。
- 單筆 resolve `404` 與其他非 auth 失敗都視為 `notFound`，不中斷整批搜尋。
- textarea 內容改動後，既有 preview 立刻標記為 stale；只有下一次完整搜尋成功完成後才恢復 active。
- `found` 工單預設全選，但可逐筆排除。
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
  - 保存最近一次批量結果
  - 重新執行 preview 搜尋
  - smooth scroll 到結果區塊
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
