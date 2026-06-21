# Printing Model

這份文件定義 BoardsReborn 第一版的列印任務模型、Worker API 邊界，以及目前 Raspberry Pi raw USB 列印整合方式。現況上，Cloud-to-Physical Printing MVP 已完成，系統已能從雲端建單一路打通到 Raspberry Pi 實體出紙與結果回報。

## 目標

- 工單主流程只負責可靠地建立與追蹤 `print_jobs`。
- 列印是非同步 side effect，不可阻塞工單建立。
- Raspberry Pi / Python Worker 是任務消費者，不是主系統的一部分。
- 列印模型保留單店單機 MVP 的簡單性，同時保留未來多裝置擴充空間。
- 列印渲染與 transport 必須分離，避免把硬體命令散落到 worker 主流程。

## 目前完成的 MVP 鏈路

已完成並實際驗證的端到端流程：

```text
雲端 Web 建立工單 / 補印
  -> Nuxt API 建立 print_job
  -> Supabase Realtime wake-up / worker claim
  -> Raspberry Pi `printer-worker serve`
  -> render ESC/POS bytes
  -> raw `/dev/usb/lp0`
  -> 80mm thermal printer 實體出紙
  -> succeed / fail 回報與 retry flow
```

這代表列印已不只是 smoke test，而是可支撐現場最小可用標籤流程的工作流能力。

## 目前已驗證硬體

- 已驗證印表機：Prowill PD-X326 thermal receipt printer
- 紙寬：80mm
- 協定：`ESC/POS`
- macOS USB raw printing：已驗證 ASCII 文字、1D barcode 與 cut command 可正常送出
- Raspberry Pi raw USB printing：已完成 end-to-end 驗證，`/dev/usb/lp0`、ASCII、CP950 / Big5 繁體中文、1D barcode 與 cut command 均正常
- UTF-8 文字不可直接送印；Prowill PD-X326 需使用 CP950 / Big5 才能正確列印繁體中文

具體硬體紀錄與約束見 [printer-hardware.md](printer-hardware.md)。

## Queue Model

第一版列印採 queue model：

```text
Admin UI / Work-order create
  -> Nuxt Nitro API
  -> print_jobs
  -> Print Worker claim / succeed / fail
  -> render ESC/POS bytes
  -> raw USB / TCP 9100 transport
  -> 80mm thermal receipt printer
```

核心資料表：

- `print_devices`：描述可用的本地 Worker / 列印裝置。
- `print_jobs`：描述等待處理、處理中、成功、失敗的列印任務。

### `print_devices`

- `device_key` 是 Worker identity，需 unique。
- `status`：
  - `active`
  - `inactive`
  - `error`
- `last_seen_at` 由 Worker claim / succeed / fail API 更新。
- `claim` 就算回傳 `job: null`，也會更新 `last_seen_at`；因此 Pi 持續跑 `poll` 時，即使目前沒有待印任務，Admin Worker 管理頁仍可維持顯示為在線。

### `print_jobs`

- `job_type` 第一版支援：
  - `work_order_label`
  - `customer_receipt`
- `status`：
  - `pending`
  - `locked`
  - `printing`
  - `printed`
  - `failed`
  - `cancelled`

第一版 API flow 只會主動使用 `pending`、`locked`、`printed`、`failed`。`printing` 保留給後續 Worker 內部更細的進度回報。

`payload` 第一版固定是 immutable print snapshot。`work_order_label` 範例：

```json
{
  "templateVersion": 2,
  "paperOrderNo": "260001",
  "displayOrderNumber": "260001",
  "barcodeValue": "260001",
  "intakeDate": "2026-06-05",
  "customerPhone": "0912927265",
  "paymentReceived": true,
  "repairCount": 6
}
```

規則：

- `work_order_label` 使用 1D barcode，`customer_receipt` 使用 QR Code 導向公開查詢頁 `/repair-status`
- worker 只消費 snapshot，不可自行推導 repair count，也不可自行 normalize phone 或 work order number
- server enqueue 端負責生成列印文字欄位；新 `customer_receipt` snapshot只保存 `qrKind` 與可選 `lineBindTokenId`，claim時才暫時生成 `publicLookupUrl`

## 建單與補印規則

- 建立工單後，server 會 **best-effort** 依序自動建立 `work_order_label` 與 `customer_receipt` 兩筆 `pending` `print_jobs`。
- 建立工單前，server 必須先確認可解析出非空 `repairCount`；若缺少則整體 create 回 `422`。
- 自動 enqueue 失敗不可讓工單建立失敗。
- Admin 可手動建立新的 `print_job` 作為補印或重印。
- 若目標工單 `repairCount` 為 `null`，建立列印任務必須回 `422 VALIDATION_ERROR`。
- 補印與重印都必須新增新任務，不覆蓋舊任務。
- `attempt_count` 在 worker fail 時累加；manual retry 只重排任務，不重置計數。

## Admin UI v1

第一版管理端已拆出兩個頁面：

- `/admin/printing`：列印中心，先看列印任務列表、狀態與 retry
- `/admin/printing/workers`：Worker 管理，查看裝置狀態、最後心跳、最近錯誤，並可做名稱 / 位置編輯與啟停

這兩頁都只透過 Nitro `/api/admin/*` 存取資料，不直接從瀏覽器讀寫 Supabase table。

### Admin Realtime Notification Layer

目前 admin 列印頁面使用 **Realtime notification + server truth refetch**：

- server-side Nuxt API / utility 會在 print job / print device 的 DB write 或 RPC 成功後，best-effort emit Supabase Realtime broadcast。
- topic 固定為：
  - `printing:jobs`
  - `printing:devices`
  - `printing:summary`
- payload 只帶通知級最小資料，例如 `eventType`、`entityId`、`changedAt`、`jobStatus`、`deviceKey` 與可選的 `workOrderId`；不直接把完整 row 當作 UI 真實來源。
- `/admin/printing` 與 `/admin/printing/workers` 首次載入抓 snapshot，收到事件後再 refetch 既有 `/api/admin/*` endpoint。
- 這層 Realtime 只用來減少固定輪詢與改善 admin 即時感，不取代既有 API / DB state machine。
- fallback sync 改為頁面可見時每 `60` 秒一次；hidden tab 不再固定打 API。
- 若主流程 DB write 成功但 Realtime emit 失敗，API 仍成功，交由 admin fallback refresh 補救。

### Worker 管理邊界

v1 UI 允許：

- 查看 `print_devices`
- 新增 `print_devices`
- 更新 `name`
- 更新 `location`
- 將 `status` 設成 `active` / `inactive` / `error`
- 刪除沒有進行中 job 的 `print_devices`

v1 UI 不允許：

- 重設 `device_key`
- 重發 `PRINT_WORKER_TOKEN`
- 從前端直接發送實體列印命令

## Worker API 規則

Worker API 使用：

```text
Authorization: Bearer <PRINT_WORKER_TOKEN>
```

request body 另外必須帶：

```json
{
  "deviceKey": "raspi-print-worker-01"
}
```

Server 端會同時驗證：

- bearer token 正確
- `device_key` 存在
- `print_devices.status = active`

### Claim

- `POST /api/print-worker/jobs/claim`
- 優先 claim 最早建立的 `pending` 任務
- 若沒有 `pending`，可 reclaim `locked_at` 已超過 5 分鐘的 stale lock
- 不論有沒有 claim 到 job，都會更新該 `print_device.last_seen_at`
- claim 成功時寫入：
  - `status = locked`
  - `locked_at`
  - `locked_by = device_key`
  - `print_device_id`

### Succeed

- `POST /api/print-worker/jobs/{id}/succeed`
- 僅允許目前持有 lock 的同一台 device 回報成功
- 成功時寫入：
  - `status = printed`
  - `printed_at`

### Fail

- `POST /api/print-worker/jobs/{id}/fail`
- 僅允許目前持有 lock 的同一台 device 回報失敗
- 失敗時：
  - `attempt_count += 1`
  - `last_error = error`
  - 若 `attempt_count < max_attempts`，回到 `pending`
  - 否則改成 `failed`

## Worker Runtime

repo 內的 `/printer-worker` 子專案目前同時提供三種 runtime：

- 支援 `python worker.py run-once`
- 支援 `python worker.py poll`
- 支援 `python worker.py serve`
- `run-once` / `poll` 仍只做 `claim -> succeed/fail` smoke test
- `serve` 會做實體列印：render ESC/POS bytes 並直接寫入 `/dev/usb/lp0`

`run-once` / `poll` 的目標仍是 connectivity smoke test。  
`serve` 則是目前 Phase 2 的正式常駐模式：

- 啟動時先 claim 一次，吃掉 backlog
- 透過 `SUPABASE_URL + SUPABASE_ANON_KEY` 訂閱 public `printing:worker-wakeup`
- 收到 `printing.job_available` 後立即再 claim
- 保留每 `15` 秒一次 fallback claim，補 missed event、斷線期間消費與 `last_seen_at`
- 同一時間只允許一個 claim / print / report 流程；wake-up 只視為 untrusted hint
- `SIGINT` / `SIGTERM` 時停止接收新 wake-up，盡可能讓當前 claim / print / report 收尾

目前已完成驗證：

- Raspberry Pi 能連到 Nuxt print-worker API
- `PRINT_WORKER_TOKEN` + `deviceKey` 認證可用
- `print_jobs` 狀態可正確從 `pending -> locked -> printed|failed`
- `python worker.py poll` 在佇列為空時仍會持續更新 `last_seen_at`，讓 Worker 管理頁正確顯示在線 / 心跳過期 / 離線
- admin 列印頁面可透過 Realtime notification layer 收到 job / device 變化並更新 UI，而不需要每 `5` 秒固定打 API
- Pi 可在不依賴固定 `5` 秒 polling 的情況下，被 `printing:worker-wakeup` 喚醒後立即 claim
- `printer-worker serve` 可在 Pi 上直接寫入 `/dev/usb/lp0`，完成 ASCII receipt、1D barcode 與 cut command 的實體列印
- Worker 成功或失敗都會回報既有 `succeed` / `fail` API，並回到 queue / retry 流程

## Worker 列印實作

正式列印只接在 `printer-worker serve`：

- `run-once` / `poll` 保持 connectivity smoke test，不做實體列印
- `serve` 直接 claim job、render receipt、寫入 `/dev/usb/lp0`、成功後回報 `succeed`
- transport 固定不使用 CUPS
- transport 固定每筆 job 寫 raw byte buffer、flush、close
- 預設 cut command 使用 `\x1D\x56\x42\x05`
- 若 receipt 模板加入中文可讀文字，renderer 必須先送 `FS &` / `\x1C\x26` 啟用中文模式，再用 `text.encode("cp950", errors="replace")` 編碼文字
- `barcodeValue` 必須保持 ASCII-only，且只作為 1D barcode payload；不可對 barcode content 使用 CP950 編碼
- `customer_receipt` renderer 使用 page mode、CP950 中文、QR Code、form feed 與 cut；QR 內容使用 claim response暫時注入的 `publicLookupUrl`

## Raspberry Pi 穩定化下一階段

端到端 MVP 已完成，接下來的 Pi 工作不再是「接上列印」，而是把已接通的流程穩定化：

1. 驗證 systemd 開機自啟、異常重啟與 graceful shutdown
2. 驗證印表機未接上、`/dev/usb/lp0` 消失、網路中斷時的 fail / retry 與人工補救
3. 驗證連續 3-5 筆工單下的 claim / print / report 不重印不漏印
4. 補 document 化 device provisioning、worker 更新與 rollback 流程
5. USB raw 穩定後，再評估 Ethernet TCP `9100`

建議 Raspberry Pi 端 secret 儲存方式：

- `PRINT_WORKER_TOKEN`：放在 systemd `EnvironmentFile`
- `deviceKey`：也放在同一個 root-only env file
- `SUPABASE_ANON_KEY`：可放同一個 env file，但不可改成 service-role key
- 不要把 service-role key 放到 Raspberry Pi

## 這一版不做

- device key rotation UI
- 多店 routing policy
- 依印表機 transport 細節擴充主系統狀態機
- `locked` / `printing` stale job 的自動 recovery（本輪只文件化，不自動 requeue）
