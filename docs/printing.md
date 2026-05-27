# Printing Model

這份文件定義 BoardsReborn 第一版的列印任務模型、Worker API 邊界與 Raspberry Pi 後續整合方式。

## 目標

- 工單主流程只負責可靠地建立與追蹤 `print_jobs`。
- 列印是非同步 side effect，不可阻塞工單建立。
- Raspberry Pi / Python Worker 是任務消費者，不是主系統的一部分。
- 列印模型保留單店單機 MVP 的簡單性，同時保留未來多裝置擴充空間。

## Queue Model

第一版列印採 queue model：

```text
Admin UI / Work-order create
  -> Nuxt Nitro API
  -> print_jobs
  -> Print Worker claim / succeed / fail
  -> CUPS / USB label printer (下一階段)
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

- `job_type` 第一版固定 `work_order_label`
- `status`：
  - `pending`
  - `locked`
  - `printing`
  - `printed`
  - `failed`
  - `cancelled`

第一版 API flow 只會主動使用 `pending`、`locked`、`printed`、`failed`。`printing` 保留給後續 Worker 內部更細的進度回報。

`payload` 第一版固定包含：

```json
{
  "paperOrderNo": "BR-2026-0001",
  "customerName": "王小明",
  "boardType": "SURFBOARD",
  "boardLengthClass": "SHORTBOARD",
  "createdAt": "2026-05-21T00:00:00.000Z"
}
```

## 建單與補印規則

- 建立工單後，server 會 **best-effort** 自動建立第一筆 `pending` `print_job`。
- 自動 enqueue 失敗不可讓工單建立失敗。
- Admin 可手動建立新的 `print_job` 作為補印或重印。
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

repo 內的 `/printer-worker` 子專案目前同時提供兩種 runtime：

- 支援 `python worker.py run-once`
- 支援 `python worker.py poll`
- 支援 `python worker.py serve`
- 目前都只做 `claim -> succeed/fail`，只印出 job 摘要，不做實體列印

`run-once` / `poll` 的目標仍是 connectivity smoke test。  
`serve` 則是目前 Phase 2 的正式常駐模式：

- 啟動時先 claim 一次，吃掉 backlog
- 透過 `SUPABASE_URL + SUPABASE_ANON_KEY` 訂閱 public `printing:worker-wakeup`
- 收到 `printing.job_available` 後立即再 claim
- 保留每 `60` 秒一次 fallback claim，補 missed event、斷線期間消費與 `last_seen_at`
- 同一時間只允許一個 claim / print / report 流程；wake-up 只視為 untrusted hint
- `SIGINT` / `SIGTERM` 時停止接收新 wake-up，盡可能讓當前 claim / print / report 收尾

這一版目標是先驗證：

- Raspberry Pi 能連到 Nuxt print-worker API
- `PRINT_WORKER_TOKEN` + `deviceKey` 認證可用
- `print_jobs` 狀態可正確從 `pending -> locked -> printed|failed`
- `python worker.py poll` 在佇列為空時仍會持續更新 `last_seen_at`，讓 Worker 管理頁正確顯示在線 / 心跳過期 / 離線
- admin 列印頁面可透過 Realtime notification layer 收到 job / device 變化並更新 UI，而不需要每 `5` 秒固定打 API
- Pi 可在不依賴固定 `5` 秒 polling 的情況下，被 `printing:worker-wakeup` 喚醒後立即 claim

## Raspberry Pi 下一階段

在 connectivity worker 驗證完成後，再依這個順序往下接：

1. Raspberry Pi 啟動 `printer-worker serve`
2. worker 先靠 Realtime wake-up + 低頻 fallback claim 維持 job 消費與 heartbeat
3. 將 `payload` 轉成實際標籤格式
4. 寫入 CUPS / 印表機
5. 成功後呼叫 `succeed`
6. 失敗後呼叫 `fail`

建議 Raspberry Pi 端 secret 儲存方式：

- `PRINT_WORKER_TOKEN`：放在 systemd `EnvironmentFile`
- `deviceKey`：也放在同一個 root-only env file
- `SUPABASE_ANON_KEY`：可放同一個 env file，但不可改成 service-role key
- 不要把 service-role key 放到 Raspberry Pi

## 這一版不做

- CUPS 設定
- 實體標籤機整合
- device key rotation UI
- 多店 routing policy
- 依印表機 transport 細節擴充主系統狀態機
- `locked` / `printing` stale job 的自動 recovery（本輪只文件化，不自動 requeue）
