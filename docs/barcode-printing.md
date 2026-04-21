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

第一版列印採非同步 print job：

```text
平板 / 桌機 Nuxt Web App
  -> Nuxt Nitro API
  -> print_jobs
  -> Python Print Agent
  -> USB 熱感標籤機
```

Nuxt 負責：

- 建立工單。
- 建立初始列印任務。
- 建立補印任務。
- 提供 Print Agent 拉取任務的 API。
- 接收 Print Agent 的列印結果回報。

Nuxt 不負責：

- 低階 USB 驅動。
- 直接控制所有品牌標籤機。
- 在前端頁面寫死列印語言或品牌 SDK。
- 從平板瀏覽器直接控制 USB 標籤機。

## Print Agent v1

Print Agent 第一版使用 Python 腳本 + systemd。

Agent 工作：

1. 定期呼叫 `GET /api/print-jobs/next` 取得待印任務。
2. 呼叫 `POST /api/print-jobs/{id}/start` 標記 processing。
3. 把 `label_payload` 轉成 TSPL/ZPL/EPL/DPL 指令。
4. 將指令寫入 USB 標籤機。
5. 可行時嘗試讀取印表機狀態。
6. 呼叫 `POST /api/print-jobs/{id}/result` 回報結果。

Agent 使用 `Authorization: Bearer <PRINT_AGENT_TOKEN>` 呼叫 Nuxt API。

## 標籤語言與品牌策略

第一版優先支援原始列印語言：

- `TSPL`
- `ZPL`
- `EPL`
- `DPL`

不要在 MVP 綁死單一品牌 SDK。具體標籤機型號尚未定案，所以文件與 API 只保留抽象列印語言與 payload。

## 列印狀態

列印成功不可簡化成單一 boolean，因為「寫入 USB 成功」不等於「貼紙一定吐出來」。

`print_job_status` 使用：

- `QUEUED`
- `PROCESSING`
- `SENT_TO_PRINTER`
- `PRINTER_READY_AFTER_SEND`
- `FAILED_TRANSPORT`
- `FAILED_PRINTER_STATUS`
- `UNKNOWN`
- `REPRINT_REQUESTED`

保守判定：

- USB 寫入成功：`SENT_TO_PRINTER`
- USB 寫入失敗：`FAILED_TRANSPORT`
- 印表機狀態回讀異常：`FAILED_PRINTER_STATUS`
- 印表機狀態回讀 ready：`PRINTER_READY_AFTER_SEND`
- 無法確認：`UNKNOWN`

## 補印流程

補印是標準流程，不是異常 workaround。

- 建立工單時，系統建立初始 `print_jobs`。
- 如果列印失敗或標籤破損，使用者可建立補印任務。
- 補印必須新增 `print_jobs` 記錄，不覆蓋舊任務。
- 建立工單不要求同步列印成功。

## 樹莓派定位

樹莓派適合作為本地列印中樞：

- 可固定連接 USB 熱感標籤機。
- 可常駐 Python Print Agent。
- 可用 systemd 自動啟動與重啟。
- 可降低平板瀏覽器直控硬體的不確定性。

具體印表機是否能穩定回讀狀態，需要實機測試。文件不承諾特定型號一定支援完整雙向狀態回讀。

## 不做項目

第一版不做：

- 平板瀏覽器直接控制 USB 標籤機。
- 綁定單一品牌 SDK。
- 完整微服務或複雜訊息佇列。
- 把標籤列印當一般文件列印流程。
- 要求建立工單必須同步列印成功。
