# Frontend Guidelines

這份文件定義 BoardsReborn MVP 的前端設計與實作規範。它是後續 admin page、表單、列表與共用 UI 元件的主要參考。

## Current Status

- 前端工具鏈已導入 Nuxt 4 + Tailwind CSS v4 + shadcn-vue。
- Tailwind CSS 透過 `@tailwindcss/vite` 接入 Nuxt。
- shadcn-vue 透過 `shadcn-nuxt` 與 CLI-generated primitives 接入。
- 目前 `/`、`/login`、`/admin`、`/forbidden` 已重整到 Tailwind/shadcn 基礎。
- `/admin/work-orders` 已實作 read-only 列表頁，支援 URL query state、篩選、排序、分頁、桌機 table 與手機 card list。
- 工單詳情與建單頁面尚未實作。

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
- `/admin/work-orders/[id]`

暫不建立獨立的 `/admin/customers`、`/admin/quotes`、`/admin/photos`、`/admin/print-jobs`。顧客、報價、照片與列印資訊先放在工單流程內，等複雜度提高後再拆頁。

`/admin` 是真正 dashboard，不是工單列表。第一版 dashboard 放摘要卡與快速入口，不放完整 table。

## Layout

- Desktop / tablet：top bar + left sidebar + main content。
- Mobile：top bar + single-column content；第一版不做永久 sidebar。
- Sidebar / sheet / mobile layout 已加入 `app/plugins/ssr-width.ts`，以 `provideSSRWidth(1024, nuxtApp.vueApp)` 作為第一版 SSR width baseline。
- Sidebar 第一版只放：
  - Dashboard
  - 工單
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

- Desktop / tablet 使用原生 table。
- Mobile 使用 card list，不把完整 table 硬塞進手機版。
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
- `card`
- `input`
- `label`
- `field`
- `alert`
- `badge`
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

1. 建立 admin dashboard live data。
2. 建立 work order detail。
3. 建立 work order create。
4. 建立 bulk status UI。
