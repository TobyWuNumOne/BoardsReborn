# Domain Model

## 設計原則

- 操作介面以工單為中心，資料模型拆分為顧客、工單、狀態歷史、照片、報價項目、列印任務。
- 第一版不建立獨立 `boards` table。板子資訊是工單當下的快照欄位，直接存在 `work_orders`。
- `board_length_class` 是獨立欄位，只對 `SURFBOARD` 使用，不從 `board_size_label` 自動推論。
- 條碼內容直接使用 `paper_order_no`，不新增獨立 barcode identifier 或 barcode table。
- Schema 來源以 `supabase/migrations/*.sql` 為準。
- 欄位命名使用 `snake_case`。
- 主鍵預設使用 `uuid`，由資料庫產生。
- enum 使用 Postgres custom enum，不用裸 `text` 表示有限集合。
- 短字串使用 `varchar(n)` 或 `char(n)`，只有長描述、備註、Storage path 使用 `text`。
- 金額以新台幣整數儲存，型別使用 `integer`，欄位命名使用 `_amount` 或 `amount`。
- 可更新的核心表應包含 `created_at` 與 `updated_at`；append-only 或事件型資料可只保留事件時間，例如 `status_history.changed_at`、`quote_items.created_at`。
- 狀態變更只能 append 到 `status_history`，不可只覆寫目前狀態。
- 照片檔案存 Supabase Storage，資料庫只存 bucket、path 與 metadata。

## Tables

### `admin_profiles`

對應 Supabase Auth 使用者。第一版只做單一管理者角色，但保留 profile table 方便未來擴充。

| 欄位           | 型別          | 規則                                    |
| -------------- | ------------- | --------------------------------------- |
| `id`           | `uuid`        | Primary key，references `auth.users.id` |
| `display_name` | `varchar(80)` | nullable                                |
| `created_at`   | `timestamptz` | required，default `now()`               |
| `updated_at`   | `timestamptz` | required，default `now()`               |

### `customers`

| 欄位               | 型別          | 規則                        |
| ------------------ | ------------- | --------------------------- |
| `id`               | `uuid`        | Primary key                 |
| `name`             | `varchar(80)` | required                    |
| `phone`            | `varchar(32)` | required，儲存正規化手機    |
| `normalized_phone` | `varchar(10)` | generated，台灣手機正規化值 |
| `note`             | `text`        | nullable，內部備註          |
| `created_at`       | `timestamptz` | required，default `now()`   |
| `updated_at`       | `timestamptz` | required，default `now()`   |

建議 constraints：

- `check (length(trim(phone)) > 0)`
- `normalized_phone is not null`

建議 index：

- `customers(phone)`
- `customers(normalized_phone)`，不加 unique constraint

電話正規化第一版只接受可判定為台灣手機的號碼。輸入先移除非數字字元；`09xxxxxxxx` 保持原值，`8869xxxxxxxx` 轉為 `09xxxxxxxx`。其他格式視為 validation error。顧客查詢需要手機驗證時，由 Nuxt server API 使用同一正規化規則比對完整手機號碼。

### `work_orders`

工單是第一版操作中心。因為第一版不做板子歷史維修彙整頁，也不需要跨工單追蹤同一塊板，所以板子資訊直接作為工單快照存在這張表。

| 欄位                             | 型別                 | 規則                                                  |
| -------------------------------- | -------------------- | ----------------------------------------------------- |
| `id`                             | `uuid`               | Primary key                                           |
| `paper_order_no`                 | `varchar(50)`        | required，unique，沿用紙本工單號；trim 後長度 3 到 50 |
| `customer_id`                    | `uuid`               | required，references `customers.id`                   |
| `board_type`                     | `board_type`         | required，見 `BoardType`                              |
| `board_length_class`             | `board_length_class` | nullable，只對 `SURFBOARD` 使用                       |
| `board_brand`                    | `varchar(80)`        | nullable                                              |
| `board_model`                    | `varchar(80)`        | nullable                                              |
| `board_size_label`               | `varchar(40)`        | nullable，例如長度或尺寸描述                          |
| `board_color`                    | `varchar(40)`        | nullable                                              |
| `board_serial_label`             | `varchar(80)`        | nullable，板上貼紙或人工標記                          |
| `intake_date`                    | `date`               | required                                              |
| `damage_description`             | `text`               | nullable，可描述示意圖標記內容                        |
| `estimated_completion_date`      | `date`               | nullable，老闆檢查後填寫，可修改                      |
| `current_status`                 | `work_order_status`  | required，latest status cache，不可取代 history       |
| `payment_received`               | `boolean`            | required，default `false`                             |
| `payment_received_at`            | `timestamptz`        | nullable，由 Nuxt API 在付款標記為 true 時維護        |
| `customer_confirmed_at`          | `timestamptz`        | nullable                                              |
| `ready_for_pickup_at`            | `timestamptz`        | nullable                                              |
| `notified_at`                    | `timestamptz`        | nullable，完工通知時間                                |
| `picked_up_at`                   | `timestamptz`        | nullable，取件時間                                    |
| `delivered_at`                   | `timestamptz`        | nullable                                              |
| `cancelled_at`                   | `timestamptz`        | nullable                                              |
| `pickup_note`                    | `text`               | nullable                                              |
| `storage_fee_warning_after_days` | `smallint`           | required，default `14`                                |
| `public_note`                    | `text`               | nullable，顧客查詢可見                                |
| `internal_note`                  | `text`               | nullable，內部備註                                    |
| `created_at`                     | `timestamptz`        | required，default `now()`                             |
| `updated_at`                     | `timestamptz`        | required，default `now()`                             |

`id` 是資料庫 primary key 與 admin 單筆 API 的 internal resource identity。`paper_order_no` 是現場與條碼操作輸入；工單條碼內容直接等於 `paper_order_no`。掃碼或人工輸入工單號時，前端應先透過 admin resolve endpoint 取得 `work_orders.id`，再呼叫 UUID-based detail / update / status endpoint。批量更新時仍以多個 `paper_order_no` 作為 payload。

`board_length_class` 只對 `SURFBOARD` 使用，值為 `SHORTBOARD`、`MID_LENGTH`、`LONGBOARD`。第一版不從 `board_size_label` 自動推論，由現場人員明確選擇。為保留既有 legacy SURFBOARD 工單不被 migration 阻斷，資料庫使用 board-field scoped trigger 針對新 insert 與 `board_type` / `board_length_class` 變更做檢查：`SURFBOARD` 必須有值，`SUP` / `SNOWBOARD` 必須是 `null`。舊資料若仍為 `null` 可保留，UI 以 `—` 顯示。

`board_color` 目前已進入 admin projection：`admin_work_order_list` 與 admin resolve preview 都會帶出這個欄位，供工單列表與批量狀態頁顯示顏色 swatch。

第一版不拆 `pickup_info` table。取件通知、取件時間與待取件提醒欄位直接放在 `work_orders`，降低 MVP schema 複雜度。若未來取件流程變複雜，再以 migration 拆表。

付款第一版只記錄 `payment_received` 與 `payment_received_at`。`payment_received_at` 由 Nuxt API 維護：`payment_received` 改為 `true` 時寫入時間，改回 `false` 時清空。第一版不建立付款明細、收據、退款或付款方式資料表。

建議 index：

- `work_orders(paper_order_no)`
- `work_orders(customer_id)`
- `work_orders(board_type)`
- `work_orders(current_status)`
- `work_orders(estimated_completion_date)`
- `work_orders(intake_date)`
- `work_orders(notified_at)` partial index for 尚未取件且已通知的工單

### `status_history`

| 欄位                 | 型別                | 規則                                  |
| -------------------- | ------------------- | ------------------------------------- |
| `id`                 | `uuid`              | Primary key                           |
| `work_order_id`      | `uuid`              | required，references `work_orders.id` |
| `status`             | `work_order_status` | required，見 `WorkOrderStatus`        |
| `changed_at`         | `timestamptz`       | required，default `now()`             |
| `changed_by_user_id` | `uuid`              | nullable，references `auth.users.id`  |
| `note`               | `text`              | nullable，第一版不強制                |

建議 index：

- `status_history(work_order_id, changed_at desc)`
- `status_history(status, changed_at desc)`

### `photos`

| 欄位                  | 型別               | 規則                                         |
| --------------------- | ------------------ | -------------------------------------------- |
| `id`                  | `uuid`             | Primary key                                  |
| `work_order_id`       | `uuid`             | required，references `work_orders.id`        |
| `photo_type`          | `photo_type`       | required，見 `PhotoType`                     |
| `visibility`          | `photo_visibility` | required，default `INTERNAL`                 |
| `bucket`              | `varchar(64)`      | required，例如 `repair-photos`               |
| `path`                | `text`             | required，Storage object path                |
| `content_type`        | `varchar(120)`     | nullable                                     |
| `size_bytes`          | `bigint`           | nullable                                     |
| `metadata`            | `jsonb`            | nullable，保留圖片寬高、來源裝置等非核心資訊 |
| `taken_at`            | `timestamptz`      | nullable                                     |
| `uploaded_by_user_id` | `uuid`             | nullable，references `auth.users.id`         |
| `note`                | `text`             | nullable                                     |
| `created_at`          | `timestamptz`      | required，default `now()`                    |

檔案不可用 base64 存在資料庫。

建議 index：

- `photos(work_order_id, created_at desc)`
- `photos(photo_type)`

### `quote_items`

| 欄位                 | 型別              | 規則                                   |
| -------------------- | ----------------- | -------------------------------------- |
| `id`                 | `uuid`            | Primary key                            |
| `work_order_id`      | `uuid`            | required，references `work_orders.id`  |
| `item_type`          | `quote_item_type` | required，見 `QuoteItemType`           |
| `description`        | `varchar(160)`    | required                               |
| `amount`             | `integer`         | required，新台幣整數，可為負數用於調整 |
| `created_by_user_id` | `uuid`            | nullable，references `auth.users.id`   |
| `created_at`         | `timestamptz`     | required，default `now()`              |

一張工單以一個初始報價為主，可有多筆追加或調整項目。最終總價由 `quote_items.amount` 加總。

DB 必須用 partial unique index 強制同一 `work_order_id` 最多一筆 `item_type = 'INITIAL'`。允許 0 筆初始報價，方便老闆之後補報價。

建議 index：

- `quote_items(work_order_id, created_at asc)`
- unique partial index on `work_order_id` where `item_type = 'INITIAL'`

### `print_jobs`

非同步標籤列印任務。工單主資料建立不依賴列印任務；列印由後續獨立流程建立 `print_jobs`，補印時新增另一筆任務，不覆蓋舊任務。

| 欄位                 | 型別               | 規則                                                       |
| -------------------- | ------------------ | ---------------------------------------------------------- |
| `id`                 | `uuid`             | Primary key                                                |
| `work_order_id`      | `uuid`             | required，references `work_orders.id`                      |
| `paper_order_no`     | `varchar(50)`      | required，列印 payload 來源，應等於工單的 `paper_order_no` |
| `status`             | `print_job_status` | required，見 `PrintJobStatus`                              |
| `label_language`     | `label_language`   | required，見 `LabelLanguage`                               |
| `label_payload`      | `jsonb`            | required，標籤內容，例如工單號、板種、顧客姓名             |
| `attempt_count`      | `smallint`         | required，default `0`                                      |
| `last_error`         | `text`             | nullable，最後一次錯誤原因                                 |
| `claimed_by`         | `varchar(80)`      | nullable，處理中的 agent 名稱                              |
| `claimed_at`         | `timestamptz`      | nullable，agent 取走任務時間                               |
| `printed_at`         | `timestamptz`      | nullable，agent 回報列印完成或印表機 ready 時間            |
| `created_by_user_id` | `uuid`             | nullable，references `auth.users.id`                       |
| `created_at`         | `timestamptz`      | required，default `now()`                                  |
| `updated_at`         | `timestamptz`      | required，default `now()`                                  |

建議 index：

- `print_jobs(status, created_at asc)`
- `print_jobs(work_order_id, created_at desc)`
- `print_jobs(paper_order_no)`
- `print_jobs(claimed_by, claimed_at)`

## Enum 定義

### SQL enum：`board_type`

TypeScript 名稱：`BoardType`

- `SURFBOARD`
- `SUP`
- `SNOWBOARD`

### SQL enum：`board_length_class`

TypeScript 名稱：`BoardLengthClass`

- `SHORTBOARD`
- `MID_LENGTH`
- `LONGBOARD`

### SQL enum：`work_order_status`

TypeScript 名稱：`WorkOrderStatus`

- `RECEIVED`
- `DRYING`
- `REPAIRING`
- `READY_FOR_PICKUP`
- `DELIVERED`
- `CANCELLED`

### SQL enum：`photo_type`

TypeScript 名稱：`PhotoType`

- `INTAKE`
- `IN_PROGRESS`
- `SPECIAL_CONDITION`
- `COMPLETION`

### SQL enum：`photo_visibility`

TypeScript 名稱：`PhotoVisibility`

- `INTERNAL`
- `PUBLIC`

第一版預設所有照片為 `INTERNAL`，顧客查詢不回傳照片。

### SQL enum：`quote_item_type`

TypeScript 名稱：`QuoteItemType`

- `INITIAL`
- `ADDITIONAL`
- `ADJUSTMENT`

### SQL enum：`print_job_status`

TypeScript 名稱：`PrintJobStatus`

- `QUEUED`
- `PROCESSING`
- `SENT_TO_PRINTER`
- `PRINTER_READY_AFTER_SEND`
- `FAILED_TRANSPORT`
- `FAILED_PRINTER_STATUS`
- `UNKNOWN`
- `REPRINT_REQUESTED`

### SQL enum：`label_language`

TypeScript 名稱：`LabelLanguage`

- `TSPL`
- `ZPL`
- `EPL`
- `DPL`

## 關聯

- `customers` 1:N `work_orders`
- `work_orders` 1:N `status_history`
- `work_orders` 1:N `photos`
- `work_orders` 1:N `quote_items`
- `work_orders` 1:N `print_jobs`

## 狀態流轉規則

- 工單建立時必須建立第一筆 `status_history`，狀態為 `RECEIVED`。
- 狀態可跳階段，不強制依序流轉。
- 每次狀態變更必須新增 `status_history`。
- 更新 `work_orders.current_status` 時，必須與最新一筆 `status_history.status` 一致。
- `board_type = SNOWBOARD` 的工單不可進入 `DRYING`。
- 單筆 admin 狀態更新透過 `POST /api/admin/work-orders/{id}/status` 進行，`PATCH /api/admin/work-orders/{id}` 不更新狀態。
- 進入 `READY_FOR_PICKUP` 時，應設定 `ready_for_pickup_at`；若已有值，保留第一次時間。
- 進入 `DELIVERED` 時，應設定 `delivered_at` 與 `work_orders.picked_up_at`；若已有值，保留第一次時間。
- 進入 `CANCELLED` 時，應設定 `cancelled_at`；若已有值，保留第一次時間。
- 要計算卡在哪個狀態最久，應以相鄰 `status_history.changed_at` 的時間差計算。
- 批量狀態更新時，必須對每張工單 individually 驗證並 individually 新增一筆 `status_history`。
- 批量狀態更新不是單一 transaction；若途中發生未知系統錯誤，前面已成功的 individual updates 可保留，後續項目停止處理。

## 列印任務規則

- 建立工單主資料時不要求同步建立 `print_jobs`；列印任務由後續獨立流程建立。
- 補印時，應新增一筆 `print_jobs`，不可重用舊任務。
- Print Agent 取走任務後，狀態更新為 `PROCESSING`，並設定 `claimed_by` 與 `claimed_at`。
- 寫入 USB 成功只能表示 `SENT_TO_PRINTER`，不可直接等同貼紙已成功吐出。
- 若印表機狀態回讀顯示 ready，可回報 `PRINTER_READY_AFTER_SEND`。
- 若傳輸失敗，回報 `FAILED_TRANSPORT`。
- 若傳輸成功但印表機狀態異常，回報 `FAILED_PRINTER_STATUS`。
- 若無法確認實際列印狀態，回報 `UNKNOWN`。

## 衍生營運標記

以下是列表標記或篩選條件，不是正式狀態，也不應寫回 `work_order_status`：

- `overdueEstimatedCompletion`：
  `estimated_completion_date` 已填寫，且今天晚於該日期，並且工單尚未 `DELIVERED` 或 `CANCELLED`。
- `pickupOverdue`：
  `work_orders.notified_at` 已存在、`work_orders.picked_up_at` 為空，且通知後已超過 `storage_fee_warning_after_days`。
- `staleReceived`：
  `current_status = RECEIVED`，且距離最近一次 `RECEIVED` 狀態變更時間已超過店內設定天數。第一版預設門檻為 7 天，由 API 常數集中管理。

## RLS 原則

- 所有核心資料表都必須 enable row level security。
- 管理端操作由 Supabase Auth authenticated admin 執行。
- 顧客查詢不得直接開放 Supabase table read，必須經由 Nuxt server API 驗證工單號，並以 `customers.phone` 的完整正規化手機號碼比對使用者輸入後，才回傳有限欄位。
- Server-only elevated key 只能在 Nitro server API 使用。
- RLS policy 的新增或修改必須寫在 migration，並在任務摘要中說明。
