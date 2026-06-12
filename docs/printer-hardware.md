# Printer Hardware Verification

這份文件記錄目前已實機驗證的列印硬體、可確認的 transport 能力，以及目前 production worker 的 transport 約束。

## 已驗證硬體

- 型號：Prowill PD-X326 thermal receipt printer
- 紙寬：80mm
- 協定：ESC/POS
- 介面：USB、Serial、Ethernet

## Raspberry Pi End-to-End Verification

Raspberry Pi-side USB raw ESC/POS printing 已完成 end-to-end 驗證。

環境：

- Host：Raspberry Pi 3 Model B
- Hostname：`raspberrypi`
- Wi-Fi IP during test：`172.20.10.4`
- OS kernel：`Linux raspberrypi 6.12.75+rpt-rpi-v7`
- Printer：Prowill PD-X326 / USB Receipt Printer
- Protocol：`ESC/POS`
- Paper width：`80mm`
- USB vendor/product：`0fe6:811e`
- Linux device path：`/dev/usb/lp0`
- Kernel driver：`usblp`

### Ethernet self-test

- DHCP：disabled
- IP：`192.168.50.88`
- Port：`9100`

### macOS USB raw printing

已驗證：

- macOS 可偵測到印表機名稱 `_USB_Receipt_Printer`
- 可透過 `lp -d _USB_Receipt_Printer -o raw` 送出 raw ESC/POS
- ASCII 純文字列印正常
- 切紙指令可正常執行
- 1D barcode 可正常列印

### Raspberry Pi USB raw printing

已驗證：

- Pi SSH 存取成功
- Pi Wi-Fi 臨時連線成功
- `lsusb` 可偵測印表機為 `0fe6:811e ICS Advent Parallel Adapter`
- kernel 會建立 `/dev/usb/lp0`
- raw ASCII text printing 正常
- CP950 / Big5 繁體中文列印正常
- 直接送 UTF-8 中文不支援，會印成亂碼
- 1D barcode printing 正常
- paper cut 正常
- 有效 cut command 為 `\x1D\x56\x42\x05`

可靠的手動驗證方式：

```bash
printf "\x1B\x40BoardsReborn Barcode Test\n\n\x1D\x48\x02\x1D\x68\x64\x1D\x77\x02\x1D\x6B\x04BR20260601001\x00\n\n\n\x1D\x56\x42\x05" | sudo tee /dev/usb/lp0 > /dev/null
```

實作注意事項：

- Pi worker 應直接把 ESC/POS raw bytes 寫入 `/dev/usb/lp0`
- 不要在 Pi worker 使用 CUPS
- 不要使用 macOS printer queue name
- 避免用會把 escaped sequence 原樣印出的 shell string
- 正式 worker 應使用 raw byte buffer，而不是 literal escaped text
- 中文可讀文字必須先送 `FS &` / `\x1C\x26` 啟用中文模式，再用 `text.encode("cp950", errors="replace")` 編碼
- 不可把中文文字以 UTF-8 raw bytes 直送印表機
- 條碼內容不可用 CP950 編碼，必須維持 ASCII-only
- 每筆 job 完成後要 flush 並 close printer device
- 預設 cut command 使用 `\x1D\x56\x42\x05`

## MVP 列印決策

- 第一版不做 QR Code 列印。
- 第一版列印模板的條碼內容維持 ASCII-only；中文可讀文字若納入模板，必須使用 CP950 / Big5。
- 第一版輸出工單號文字加 1D barcode。
- 1D barcode 優先評估 `Code39` 或 `Code128`。
- 條碼內容必須保持 ASCII 且 scanner-friendly。
- 若後續需要 `BR-20260601-001` 這種人類可讀格式，應視為顯示格式；列印與掃碼值仍應保持單一 ASCII-safe 工單號。

## 設計邊界

- 列印渲染必須和 printer transport 分離。
- 不可把 ESC/POS command bytes 散落在 production worker 主流程。
- Raspberry Pi transport 已確認優先走 USB raw，不走 CUPS。
- Ethernet TCP `9100` 保留為下一階段 transport，不在這次驗證中直接接入 worker。

## 下一個實作步驟

目前 repo 已把 raw USB transport 接入 `printer-worker serve`。下一步是實機驗證：

- 在 Pi 上啟動 repo 內的 `printer-worker serve`
- 確認 web 建工單後可以自動 claim 並出紙
- 驗證每筆 job 都會直接寫 raw bytes 到 `/dev/usb/lp0`
- 驗證 flush / close、`succeed` / `fail` 回報與 systemd 常駐行為
- USB raw 穩定後，再評估 Ethernet TCP `9100`
