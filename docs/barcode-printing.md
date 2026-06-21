# Barcode and Printing Architecture

## 目標

第一版條碼與列印架構採低摩擦、品牌通用、現場可落地的方式：

- 掃碼走 Web App，可直接在平板或桌機操作。
- 列印不由平板瀏覽器直控 USB 印表機。
- 目前已驗證的 MVP 硬體是 `ESC/POS` 80mm 熱感出單機。
- USB 熱感出單機由固定桌機或樹莓派上的 Python Print Agent 控制。
- Nuxt 4 是主系統與 API 層，不是硬體驅動層。

## 掃碼架構

條碼內容直接使用 `paper_order_no`，不新增第二套 barcode identifier。新工單的 `paper_order_no` 由後端產生純數字年份流水號，例如 `260001`；舊單號仍可查詢與掃描。

正式環境的測試工單使用保留的 `99` 前綴，例如 `990001`。它和一般工單相同，會建立 `work_order_label` 與 `customer_receipt`，且 barcode payload 仍直接等於該測試工單的 `paper_order_no`。

無線條碼槍採 keyboard wedge 模式：

- 條碼槍掃到條碼後，像鍵盤一樣把工單號輸入到 Nuxt Web App 的輸入框。
- 條碼槍可設定掃描後附加 Enter，讓 Web App 自動查詢或加入批量清單。
- 單張掃碼用於快速查詢工單。
- 多張掃碼用於先累積多個工單號，再一次批量更新狀態。

目前尚未拿到實際條碼槍硬體，因此這一段仍停留在 Web 輸入模式與操作契約設計；真正的掃描後自動 Enter、焦點管理、連續掃碼節奏與現場批量操作，需等設備到位後再做實機驗證。

## 列印架構

第一版列印採非同步 print queue：

```text
平板 / 桌機 Nuxt Web App
  -> Nuxt Nitro API
  -> print_jobs
  -> Python Print Agent
  -> render ESC/POS bytes
  -> USB raw / TCP 9100 transport
  -> 80mm 熱感出單機
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
- 直接控制所有品牌印表機。
- 在前端頁面寫死列印語言或品牌 SDK。
- 從平板瀏覽器直接控制 USB 印表機。

## Print Worker Runtime

Print Worker 第一版先拆成三個階段：

1. **connectivity worker**：`run-once` / `poll`，只驗證 `claim -> succeed/fail`
2. **event wake-up worker**：`serve`，用 Supabase Realtime wake-up + fallback claim 常駐
3. **printer worker**：在 `serve` 模式下接入 ESC/POS render + raw USB transport

目前 repo 已包含 connectivity worker、event wake-up worker 與 `serve` 模式的 raw USB 列印 transport，且已完成從 web 建單到 Pi 實體出紙與成功/失敗回報的端到端 MVP；接下來主要是 Pi 常駐穩定化與 systemd 驗證。

Worker 工作：

1. `serve` 啟動時先 claim 一次，處理已存在 backlog。
2. worker 訂閱 public `printing:worker-wakeup`，收到 `printing.job_available` 後再 claim。
3. 同時保留 `15` 秒 fallback claim，補 missed event / heartbeat；Realtime 重連成功後也會立即補一次 claim。
4. connectivity worker 階段先印出 job 摘要，並回報 `succeed` 或 `fail`。
5. `serve` 模式會把 immutable print snapshot render 成 ESC/POS bytes。
6. `serve` 模式會直接把 raw bytes 寫到 `/dev/usb/lp0`。
7. 完成 raw USB 後，再評估 Ethernet TCP `9100` transport。
8. 呼叫 `POST /api/print-worker/jobs/{id}/succeed` 或 `POST /api/print-worker/jobs/{id}/fail` 回報結果。

Worker 使用 `Authorization: Bearer <PRINT_WORKER_TOKEN>` 呼叫 Nuxt API，並在 body 帶 `deviceKey`。Realtime wake-up 只負責通知，不直接授權 claim。

`printing:worker-wakeup` 是 public minimal topic，只帶 `eventType`、`changedAt`、`reason`。Pi 不可信任 payload 內容，收到後仍需重新呼叫 `claim`。

## 列印語言與內容策略

第一版已驗證的硬體 profile 為：

- `ESC/POS`
- `80mm` thermal receipt printer
- USB raw first
- Ethernet TCP `9100` later

目前 MVP 列印內容策略：

- 工單標籤 `work_order_label` 仍以工單號、日期、電話、付款狀態與維修處數等精簡 receipt 內容為主；1D barcode payload 維持 ASCII-only
- 顧客留存聯 `customer_receipt` 是獨立 print job，使用 CP950 / Big5 中文文字與 QR Code 導向 `https://status.surfboards-reborn.com/repair-status`；不把工單號或手機放入 URL
- enqueue `print_jobs` 時就建立 immutable print-ready snapshot，worker 不再自行推導 repair count
- `work_order_label` snapshot 目前使用 `templateVersion = 2`，至少包含 `paperOrderNo`、`displayOrderNumber`、`barcodeValue`、`intakeDate`、`customerPhone`、`paymentReceived`、`repairCount`
- `customer_receipt` snapshot 目前使用 `templateVersion = 1`，至少包含 `paperOrderNo`、`intakeDate`、`customerPhone`、`boardTypeLabel`、`paymentReceived`、`repairCount`、`publicLookupUrl`
- `publicLookupUrl` 優先由 `NUXT_PUBLIC_STATUS_URL` 產生；未設定時才 fallback 到 `NUXT_PUBLIC_APP_URL`。既有 print job snapshot 維持 immutable，不回寫舊 URL。
- 列印置中的收件日期、電話 / 付款狀態、大字工單號、維修處數括號與同一個工單號的 1D barcode
- 1D barcode height 固定 `0x40`
- 1D barcode 優先評估 `Code39` 或 `Code128`

### 中文列印編碼

Prowill PD-X326 已在 Raspberry Pi raw USB ESC/POS 路徑驗證可用 CP950 / Big5 列印繁體中文。直接送 UTF-8 不支援，會造成亂碼。

Renderer 規則：

- 列印中文可讀文字前，必須啟用中文模式 `FS &` / `\x1C\x26`。
- 中文可列印文字使用 `text.encode("cp950", errors="replace")` 轉成 bytes。
- 不可把中文文字以 UTF-8 raw bytes 直接送到印表機。
- `barcodeValue` 與實際 1D barcode content 必須保持 ASCII-only，且仍使用 `paper_order_no`；不可用 CP950 編碼條碼內容。

不要在 MVP 綁死單一品牌 SDK。具體已驗證硬體與測試結果見 [printer-hardware.md](printer-hardware.md)。

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

實際的 USB raw / TCP `9100` transport 細節留到 Worker 實作階段處理，不在主系統 schema 裡展開成另一套狀態機。

## 補印流程

補印是標準流程，不是異常 workaround。

- 建立工單成功後，server 會依序 best-effort 建立 `work_order_label` 與 `customer_receipt` 兩筆 `print_jobs`。
- 建立工單前，server 必須先確認可解析出非空 `repairCount`；若缺少則整體 create 回 `422`。
- 需要列印時，系統建立新的 `print_jobs`。
- 如果列印失敗或標籤破損，使用者可建立補印任務。
- 若目標工單 `repairCount` 為 `null`，建立列印任務必須回 `422 VALIDATION_ERROR`。
- 補印必須新增 `print_jobs` 記錄，不覆蓋舊任務。
- 建立工單不要求同步列印成功。
- work-order detail / create success / bulk-status 只顯示列印摘要與 deep link；完整列印操作仍集中在 `/admin/printing`。

### LINE 條件式留存聯 QR（planned / not implemented）

目前已落地的 `customer_receipt` snapshot 仍固定使用 `/repair-status`，且 immutable，不回寫。後續 LINE PR 只影響新建立的留存聯任務：

- Customer 未綁定 LINE：建立 active `line_bind_token`，QR 使用 LIFF bind URL。
- Customer 已綁定 LINE：不發 token，QR 使用 `/repair-status`。
- 自動發卡失敗：工單仍建立成功，該次留存聯 fallback 到 `/repair-status`，後台顯示可重新發卡。
- 普通補印沿用未使用、未過期、未撤銷的 active pending token；重新發卡是另一個明確 admin action，並撤銷舊 pending token。
- 明文 token 由 `token row UUID + LINE_BIND_TOKEN_SECRET` 以 HMAC 重建，DB 只存 `token_hash`。
- `print_jobs.payload` 不得持久化明文 token 或完整 LIFF bind URL。可持久化非機密 token row reference / QR target kind；Nuxt 在 Worker claim / dispatch 時重建 URL，僅於 response 與列印記憶體中短暫存在。
- `LINE_BIND_TOKEN_SECRET` 遺失或輪替時，舊 pending token 不可補印，只能重新發卡。
- LIFF URL 是顧客持有的一次性 bearer credential；不得寫入 application log、錯誤訊息或其他持久化欄位。

## 樹莓派定位

樹莓派適合作為本地列印中樞：

- 可固定連接 USB 熱感出單機。
- 可常駐 Python Print Agent。
- 可用 systemd 自動啟動與重啟。
- 建議以 `python -u` 或 `PYTHONUNBUFFERED=1` 啟動，避免 `journalctl -f` 看不到即時 worker log。
- 可降低平板瀏覽器直控硬體的不確定性。

具體印表機是否能穩定回讀狀態，需要實機測試。文件不承諾特定型號一定支援完整雙向狀態回讀。connectivity worker 只驗證主系統與樹莓派之間的 contract；目前 `serve` 已直接接上 `/dev/usb/lp0` raw USB transport，下一步是用 repo 內 worker 在 Pi 上重跑並驗證常駐行為。

詳細 queue model、API 與 Raspberry Pi 下一階段整合方式，見 [printing.md](printing.md)。

## 不做項目

第一版不做：

- 平板瀏覽器直接控制 USB 印表機。
- 綁定單一品牌 SDK。
- 完整微服務或複雜訊息佇列。
- 把標籤列印當一般文件列印流程。
- 要求建立工單必須同步列印成功。
