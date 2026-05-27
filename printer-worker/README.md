# `printer-worker`

BoardsReborn 的第一版 Python Print Worker 子專案。  
它目前同時提供 connectivity smoke test 與 event wake-up worker runtime；目的是先驗證 **Raspberry Pi ↔ Nuxt print-worker API ↔ Supabase Realtime ↔ `print_jobs` 狀態流轉**，不是實體列印。

## 這一版做什麼

- 呼叫 `POST /api/print-worker/jobs/claim`
- 顯示拿到的 job 摘要
- 依設定回報 `succeed` 或 `fail`
- 支援單次執行、持續輪詢與 `serve` 常駐模式
- 在 `poll` 模式下，就算本輪 `No job available`，server 仍會更新該 device 的 `last_seen_at`
- 在 `serve` 模式下，會訂閱 public `printing:worker-wakeup` 並保留 60 秒 fallback claim

## 這一版不做

- CUPS
- USB / 熱感標籤機
- TSPL / ZPL / EPL / DPL label rendering
- `locked` / `printing` stale job 自動 recovery

## 檔案

- `worker.py`：CLI entrypoint
- `config.py`：讀取 `.env` 與設定驗證
- `client.py`：呼叫 BoardsReborn print-worker API
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
- `POLL_INTERVAL_SECONDS`：輪詢秒數，預設 `5`
- `SUPABASE_URL`：Supabase project / local gateway URL，供 `serve` 訂閱 Realtime
- `SUPABASE_ANON_KEY`：public key，供 `serve` 訂閱 public wake-up topic
- `REALTIME_FALLBACK_CLAIM_INTERVAL_SECONDS`：`serve` 模式 fallback claim 秒數，預設 `60`
- `REALTIME_RECONNECT_MAX_SECONDS`：`serve` 模式 reconnect backoff 上限，預設 `30`
- `WORKER_RESULT_MODE`：`succeed` 或 `fail`
- `WORKER_FAIL_MESSAGE`：fail mode 回傳的錯誤訊息

## 執行

單次模式：

```bash
cd printer-worker
source .venv/bin/activate
python worker.py run-once
```

輪詢模式：

```bash
cd printer-worker
source .venv/bin/activate
python worker.py poll
```

Realtime wake-up 常駐模式：

```bash
cd printer-worker
source .venv/bin/activate
python worker.py serve
```

## 預期輸出

有 job：

```text
Claimed print job
- id: ...
- jobType: work_order_label
- paperOrderNo: BR-2026-0001
- customerName: 王小明
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
Starting serve mode -> fallbackClaimInterval=60s mode=succeed
Realtime wake-up received -> reason=enqueued
```

## Smoke Test 建議流程

### 1. 成功路徑

1. 在 admin `/admin/printing/workers` 建立一台 `active` worker
2. 在 admin `/admin/print-jobs` 或工單建立流程產生一筆 `pending` job
3. 在 Pi 或本機執行：

```bash
python worker.py run-once
```

4. 驗證 `print_jobs` 狀態：
   - `pending -> locked -> printed`

### 2. 失敗路徑

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

## Raspberry Pi 下一步

這一版已驗證連線、API contract 與 Realtime wake-up 邊界。  
下一步再補：

1. Pi 實機 systemd 常駐驗證
2. label rendering
3. CUPS / 實體印表機整合
4. stale active job recovery
