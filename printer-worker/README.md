# `printer-worker`

BoardsReborn 的第一版 Python Print Worker 子專案。  
它現在同時提供 connectivity smoke test 與正式的 Raspberry Pi USB raw 列印常駐模式。

## 這一版做什麼

- 呼叫 `POST /api/print-worker/jobs/claim`
- `run-once` / `poll` 模式下顯示拿到的 job 摘要
- `serve` 模式下把 print snapshot render 成 ESC/POS bytes，直接寫入 `/dev/usb/lp0`
- 列印成功後回報 `succeed`
- 列印失敗後回報 `fail`
- 在 `poll` 模式下，就算本輪 `No job available`，server 仍會更新該 device 的 `last_seen_at`
- 在 `serve` 模式下，會訂閱 public `printing:worker-wakeup` 並保留 60 秒 fallback claim

## 這一版不做

- CUPS
- macOS printer queue name
- Ethernet TCP `9100` transport
- 中文列印
- `locked` / `printing` stale job 自動 recovery

## 檔案

- `worker.py`：CLI entrypoint
- `config.py`：讀取 `.env` 與設定驗證
- `client.py`：呼叫 BoardsReborn print-worker API
- `print_runner.py`：正式列印 job handler
- `renderer.py`：`payload -> ESC/POS bytes`
- `transport.py`：`bytes -> /dev/usb/lp0`
- `worker_realtime.py`：訂閱 `printing:worker-wakeup`
- `service.py`：`serve` 主循環、fallback claim 與 graceful shutdown
- `systemd/`：service unit 與 env file example
- `.env.example`：Pi / local worker 設定範本
- `requirements.txt`：runtime dependency（`requests` + `realtime`）

## 環境需求

- Python 3.11+
- 可連到 BoardsReborn Nuxt API 的網路
- 一台已在 BoardsReborn 裡建立且 `status=active` 的 `print_device`
- 與 server 端一致的 `PRINT_WORKER_TOKEN`
- Raspberry Pi 上已存在 `/dev/usb/lp0`

## 設定

```bash
cd printer-worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

`.env` 欄位：

- `API_BASE_URL`：Nuxt app base URL，例如 `http://192.168.1.50:3000`
- `PRINT_WORKER_TOKEN`：與 server 端一致的 bearer token
- `DEVICE_KEY`：對應 `print_devices.device_key`
- `PRINTER_DEVICE_PATH`：raw USB device path，預設 `/dev/usb/lp0`
- `POLL_INTERVAL_SECONDS`：輪詢秒數，預設 `5`
- `SUPABASE_URL`：Supabase project / local gateway URL，供 `serve` 訂閱 Realtime
- `SUPABASE_ANON_KEY`：public key，供 `serve` 訂閱 public wake-up topic
- `REALTIME_FALLBACK_CLAIM_INTERVAL_SECONDS`：`serve` 模式 fallback claim 秒數，預設 `60`
- `REALTIME_RECONNECT_MAX_SECONDS`：`serve` 模式 reconnect backoff 上限，預設 `30`
- `WORKER_RESULT_MODE`：只供 `run-once` / `poll` smoke test 使用，`succeed` 或 `fail`
- `WORKER_FAIL_MESSAGE`：只供 `run-once` / `poll` fail mode 使用

## 執行

單次 smoke test：

```bash
cd printer-worker
source .venv/bin/activate
python worker.py run-once
```

輪詢 smoke test：

```bash
cd printer-worker
source .venv/bin/activate
python worker.py poll
```

正式 Realtime wake-up 常駐模式：

```bash
cd printer-worker
source .venv/bin/activate
python worker.py serve
```

## Payload contract

`serve` 只消費 immutable print snapshot payload。第一版至少包含：

- `templateVersion`
- `paperOrderNo`
- `barcodeValue`
- `customerNameAscii`
- `customerPhone`
- `boardType`

Worker 不會自行 normalize customer name、phone、board type 或 work order number。

## Receipt template

第一版固定輸出：

- `BoardsReborn`
- `Order: <paperOrderNo>`
- `Customer: <customerNameAscii | ->`
- `Phone: <customerPhone | ->`
- `Board: <boardType | ->`
- 1D barcode using `barcodeValue`
- reduced feed lines
- cut command `\x1D\x56\x42\x05`

## 預期輸出

`run-once` / `poll` 有 job：

```text
Claimed print job
- id: ...
- jobType: work_order_label
- paperOrderNo: BR-2026-0001
- barcodeValue: BR20260001
- customerNameAscii: ALEX
- customerPhone: 0912927265
- boardType: SURFBOARD
Reported success -> status=printed attemptCount=0 printedAt=...
```

`serve` 有 job：

```text
Claimed print job
- id: ...
- jobType: work_order_label
- paperOrderNo: BR-2026-0001
- barcodeValue: BR20260001
- customerPhone: 0912927265
- boardType: SURFBOARD
Reported success -> status=printed attemptCount=0 printedAt=...
```

無 job：

```text
No job available
```

`poll` 模式下這個輸出是正常的；它代表目前佇列為空，不代表 worker 離線。只要 Pi 持續輪詢，Worker 管理頁仍應維持更新最後心跳並顯示為 `在線`。

`serve` 模式下，預期還會看到：

```text
Claim requested -> reason=startup
Realtime subscribed -> printing:worker-wakeup
Starting serve mode -> fallbackClaimInterval=60s devicePath=/dev/usb/lp0
Realtime wake-up received -> reason=enqueued
```

## Smoke Test 建議流程

### 1. 成功路徑

1. 在 admin `/admin/printing/workers` 建立一台 `active` worker
2. 在 admin `/admin/print-jobs` 或工單建立流程產生一筆 `pending` job
3. 在 Pi 執行：

```bash
python worker.py serve
```

4. 驗證：
   - `print_jobs` 狀態 `pending -> locked -> printed`
   - Pi 直接出紙
   - barcode 可掃回 `barcodeValue`

### 2. Smoke / fail 路徑

在 `.env` 設定：

```bash
WORKER_RESULT_MODE=fail
WORKER_FAIL_MESSAGE=Simulated print failure
```

再執行：

```bash
python worker.py run-once
```

驗證：

- `attempt_count` 遞增
- `last_error` 寫入
- job 轉成 `pending` 或 `failed`

### 3. Auth / Realtime 路徑

- 錯 token：應收到 `401`
- 不存在的 `DEVICE_KEY`：應收到 `401`
- `inactive` device：應收到 `403`
- 缺少 `SUPABASE_URL` 或 `SUPABASE_ANON_KEY`：`python worker.py serve` 應直接報 configuration error

## systemd

repo 已附：

- `systemd/boards-reborn-printer-worker.service`
- `systemd/printer-worker.env.example`

預設 service 使用：

- `ExecStart=/opt/boards-reborn/printer-worker/.venv/bin/python worker.py serve`
- `EnvironmentFile=/etc/boards-reborn/printer-worker.env`
- `Restart=always`
- `RestartSec=5`

安裝後可用：

```bash
sudo systemctl enable --now boards-reborn-printer-worker.service
sudo journalctl -u boards-reborn-printer-worker.service -f
```

## 下一步

這一版的程式碼已把 raw USB 列印接進 `serve`。
接下來重點是：

1. 在 Raspberry Pi 上重跑 `printer-worker serve`
2. 驗證 web 建工單後可以自動出紙
3. 確認 systemd 常駐、斷線重連與 shutdown 行為
4. 之後再評估 Ethernet TCP `9100`
