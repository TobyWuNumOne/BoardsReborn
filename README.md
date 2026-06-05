# BoardsReborn

**A repair-progress management system for surf and snowboard shops.**
板類維修進度管理系統，專為衝浪板與滑雪板修繕工作室設計。

---

## What is BoardsReborn? / 什麼是 BoardsReborn？

BoardsReborn replaces the notebook-and-memory workflow that most repair shops still rely on. When a board comes in, staff create a digital work order, print a barcode work-order receipt, and the board's entire journey — intake, quote, repair stages, photos, and pickup — is tracked in one place. Anyone in the shop can see what's happening at a glance, and customers can look up their own repair status without calling in.

BoardsReborn 取代了修板店長期依賴的紙本筆記與口耳相傳流程。板子進店後，工作人員建立數位工單並列印帶條碼的工單收據，從收件、報價、各維修階段、照片到取件，完整紀錄都集中在同一個系統。店內任何人都能即時掌握每張板子的狀態；顧客也可以自助查詢進度，不必打電話詢問。

---

## The Problem / 解決的痛點

Repair shops track dozens of boards at a time using only their memory, physical placement on the shelf, and handwritten paper tickets. This leads to missed follow-ups, lost boards, and unnecessary phone calls. There is no audit trail when status changes or when a board changes hands between technicians.

修板店同時處理數十張板子，卻只能靠記憶、擺放位置與紙本工單來管理。這造成後續追蹤遺漏、板子找不到，以及大量重複來電詢問。狀態變更與換手作業沒有任何留存紀錄。

---

## Key Features / 功能亮點

- **Work order lifecycle** — intake, quote, multi-stage repair, pickup, with full status history  
  工單全生命週期 — 收件、報價、多階段維修、取件，完整狀態歷程
- **Barcode work-order receipts** — payload is the paper order number; scan to query or bulk-update status
  條碼工單收據 — 內容為紙本工單號；掃碼即可查詢或批次更新狀態
- **Async print jobs** — print jobs are queued; a Print Agent on a fixed PC or Raspberry Pi drives the local receipt printer
  非同步列印任務 — 工作加入佇列後，由桌機或樹莓派上的 Print Agent 驅動本地熱感出單機
- **Smart flags** — highlight overdue boards, boards waiting too long for pickup, and stalled work orders  
  智慧提示 — 標示逾期、久候未取、長期未開工的工單
- **Customer self-lookup** — customers can check their repair status using their order number and phone number  
  顧客自助查詢 — 顧客用工單號加完整手機號碼即可查詢維修進度

---

## Built With / 技術棧

| Layer | Technology |
| --- | --- |
| Full-stack framework | Nuxt 4 (Vue 3, TypeScript, Nitro API) |
| Database & Auth | Supabase (Postgres, Auth, Storage) |
| Styling | Tailwind CSS v4 + shadcn-vue |
| Testing | Vitest |
| Print Agent | Python + systemd (runs on-premises) |

Nuxt is the primary application and API layer — it handles UI, work order flows, data access, print job creation, and print result callbacks. It does not provide low-level USB printer drivers or control hardware directly from the browser.

Nuxt 是主系統與 API 層，負責 UI、工單流程、資料存取、建立列印任務與接收列印結果；不負責低階硬體驅動，也不直接從瀏覽器控制 USB 印表機。

---

## Project Status / 專案狀態

See [docs/progress.md](docs/progress.md) for current milestone progress, completed work, and next steps.

目前里程碑進度、已完成工項與下一步請見 [docs/progress.md](docs/progress.md)。

---

## Getting Started / 快速開始

See [docs/setup.md](docs/setup.md) for toolchain versions, local setup, environment variables, Supabase configuration, and all project commands.

工具鏈版本基準、本地設定、環境變數、Supabase 配置與所有專案指令請見 [docs/setup.md](docs/setup.md)。

---

## Documentation / 核心文件

| Document | Description |
| --- | --- |
| [docs/product.md](docs/product.md) | MVP scope, user flows, and out-of-scope features / 產品需求、使用者流程、範疇外功能 |
| [docs/domain-model.md](docs/domain-model.md) | Schema, enums, status rules, storage boundaries / 資料模型、枚舉、狀態規則、儲存邊界 |
| [docs/api-contract.md](docs/api-contract.md) | Endpoint shapes, auth, pagination, error format / API 端點、認證、分頁、錯誤格式 |
| [docs/barcode-printing.md](docs/barcode-printing.md) | Barcode payload, async print jobs, Print Agent / 條碼內容、非同步列印、Print Agent 架構 |
| [docs/printer-hardware.md](docs/printer-hardware.md) | Verified printer hardware and isolated Pi print plan / 已驗證印表機硬體與 Pi 隔離列印計畫 |
| [docs/progress.md](docs/progress.md) | Current implementation status and next steps / 目前實作狀態與下一步 |
| [docs/setup.md](docs/setup.md) | Local setup, toolchain versions, env vars, commands / 本地設定、工具鏈版本、環境變數、指令 |
| [docs/deployment.md](docs/deployment.md) | Staging deployment runbook / Staging 部署流程 |
| [docs/ai-dev-rules.md](docs/ai-dev-rules.md) | AI development rules / AI 開發規則 |
| [printer-worker/README.md](printer-worker/README.md) | Connectivity-first Python Print Worker / Python 列印 worker 子專案 |
