# Barcode and Printing Architecture

## 目標

第一版條碼與列印架構採低摩擦、品牌通用、現場可落地的方式：

- 掃碼走 Web App，可直接在平板或桌機操作。
- 列印不由平板瀏覽器直控 USB 標籤機。
- USB 熱感標籤機由固定桌機或樹莓派上的 Python Print Agent 控制。
- Nuxt 4 是主系統與 API 層，不是硬體驅動層。

## 掃碼架構

條碼內容直接使用 `paper_order_no`，不新增第二套 barcode identifier。

無線條碼槍採 keyboard wedge 模式：

- 條碼槍掃到條碼後，像鍵盤一樣把工單號輸入到 Nuxt Web App 的輸入框。
- 條碼槍可設定掃描後附加 Enter，讓 Web App 自動查詢或加入批量清單。
- 單張掃碼用於快速查詢工單。
- 多張掃碼用於先累積多個工單號，再一次批量更新狀態。

## 列印架構

第一版列印採非同步 print queue：

```text
平板 / 桌機 Nuxt Web App
  -> Nuxt Nitro API
  -> print_jobs
  -> Python Print Agent
  -> USB 熱感標籤機
```

Nuxt 負責：

- 建立工單。
- 建立與重排列印任務。
- 建立補印任務。
- 提供 work-order detail / create / bulk-status 使用的列印摘要 read model。
- 提供 admin 列印中心與 Print Worker 管理頁。
- 提供 Worker claim / succeed / fail API。
- 接收 Worker 的列印結果回報。
- 透過 Supabase Realtime broadcast 通知 admin 列印頁面與 Pi worker 有列印變更，再由 client refetch / claim server truth。

Nuxt 不負責：

- 低階 USB 驅動。
- 直接控制所有品牌標籤機。
- 在前端頁面寫死列印語言或品牌 SDK。
- 從平板瀏覽器直接控制 USB 標籤機。

## Print Worker Runtime

Print Worker 第一版先拆成兩個階段：

1. **connectivity worker**：`run-once` / `poll`，只驗證 `claim -> succeed/fail`
2. **event wake-up worker**：`serve`，用 Supabase Realtime wake-up + fallback claim 常駐
3. **printer worker**：後續再接 systemd、CUPS 與實體標籤機

目前 repo 已包含 connectivity worker 與 event wake-up worker；CUPS / 實體列印仍未實作。

Worker 工作：

1. `serve` 啟動時先 claim 一次，處理已存在 backlog。
2. worker 訂閱 public `printing:worker-wakeup`，收到 `printing.job_available` 後再 claim。
3. 同時保留 `60` 秒 fallback claim，補 missed event / heartbeat。
4. connectivity worker 階段先印出 job 摘要，並回報 `succeed` 或 `fail`。
5. printer worker 階段再把 `payload` 轉成實際標籤格式。
6. printer worker 階段再寫入 CUPS / USB 標籤機。
7. 呼叫 `POST /api/print-worker/jobs/{id}/succeed` 或 `POST /api/print-worker/jobs/{id}/fail` 回報結果。

Worker 使用 `Authorization: Bearer <PRINT_WORKER_TOKEN>` 呼叫 Nuxt API，並在 body 帶 `deviceKey`。Realtime wake-up 只負責通知，不直接授權 claim。

`printing:worker-wakeup` 是 public minimal topic，只帶 `eventType`、`changedAt`、`reason`。Pi 不可信任 payload 內容，收到後仍需重新呼叫 `claim`。

## 標籤語言與品牌策略

第一版優先支援原始列印語言：

- `TSPL`
- `ZPL`
- `EPL`
- `DPL`

不要在 MVP 綁死單一品牌 SDK。具體標籤機型號尚未定案，所以文件與 API 只保留抽象列印語言與 payload。

## 列印狀態

第一版主系統狀態聚焦在 queue，而不是硬體 transport 細節。

`print_job_status` 使用：

- `pending`
- `locked`
- `printing`
- `printed`
- `failed`
- `cancelled`

其中：

- `pending`：等待 Worker claim
- `locked`：已被某台 Worker claim
- `printed`：Worker 已回報成功
- `failed`：已達 retry 上限或需要人工介入

實際的 CUPS / 印表機 transport 細節留到 Worker 實作階段處理，不在主系統 schema 裡展開成另一套狀態機。

## 補印流程

補印是標準流程，不是異常 workaround。

- 建立工單主資料後，server 會 best-effort 建立第一筆 `print_jobs`。
- 需要列印時，系統建立新的 `print_jobs`。
- 如果列印失敗或標籤破損，使用者可建立補印任務。
- 補印必須新增 `print_jobs` 記錄，不覆蓋舊任務。
- 建立工單不要求同步列印成功。
- work-order detail / create success / bulk-status 只顯示列印摘要與 deep link；完整列印操作仍集中在 `/admin/printing`。

## 樹莓派定位

樹莓派適合作為本地列印中樞：

- 可固定連接 USB 熱感標籤機。
- 可常駐 Python Print Agent。
- 可用 systemd 自動啟動與重啟。
- 可降低平板瀏覽器直控硬體的不確定性。

具體印表機是否能穩定回讀狀態，需要實機測試。文件不承諾特定型號一定支援完整雙向狀態回讀。connectivity worker 只驗證主系統與樹莓派之間的 contract，不驗證硬體能力。

詳細 queue model、API 與 Raspberry Pi 下一階段整合方式，見 [printing.md](printing.md)。

## 不做項目

第一版不做：

- 平板瀏覽器直接控制 USB 標籤機。
- 綁定單一品牌 SDK。
- 完整微服務或複雜訊息佇列。
- 把標籤列印當一般文件列印流程。
- 要求建立工單必須同步列印成功。
