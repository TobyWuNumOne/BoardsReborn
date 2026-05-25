# `printer-worker`

BoardsReborn 的第一版 Python Print Worker 子專案。  
它的目的是先驗證 **Raspberry Pi ↔ Nuxt print-worker API ↔ `print_jobs` 狀態流轉**，不是實體列印。

## 這一版做什麼

- 呼叫 `POST /api/print-worker/jobs/claim`
- 顯示拿到的 job 摘要
- 依設定回報 `succeed` 或 `fail`
- 支援單次執行與持續輪詢

## 這一版不做

- CUPS
- USB / 熱感標籤機
- systemd service file
- TSPL / ZPL / EPL / DPL label rendering

## 檔案

- `worker.py`：CLI entrypoint
- `config.py`：讀取 `.env` 與設定驗證
- `client.py`：呼叫 BoardsReborn print-worker API
- `.env.example`：Pi / local worker 設定範本
- `requirements.txt`：runtime dependency

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

### 3. Auth 路徑

- 錯 token：應收到 `401`
- 不存在的 `DEVICE_KEY`：應收到 `401`
- `inactive` device：應收到 `403`

## Raspberry Pi 下一步

這一版只驗證連線與 API contract。  
如果這版穩定，下一步再補：

1. systemd service
2. label rendering
3. CUPS / 實體印表機整合
