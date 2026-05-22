# API Contract

## 基本規則

- 本文件定義 Nuxt Nitro server API，不直接把 Supabase auto-generated API 當公開 contract。
- Base path：`/api`
- Request / response 預設為 JSON。
- 照片上傳使用 `multipart/form-data`。
- 時間格式使用 ISO 8601。
- 日期格式使用 `YYYY-MM-DD`。
- enum value 需與 [domain model](domain-model.md) 一致；`work_order_status` 為大寫，print queue enums 為小寫。

## API Index

以下索引用來快速查看目前有哪些 API 與實作狀態；詳細 request / response / 規則仍以下方正式 contract 為準。

### Admin API

- `implemented` `GET /api/admin/dashboard`：回傳管理端 dashboard summary metrics。
- `implemented` `GET /api/admin/session`：回傳目前 admin session 與最小 profile。
- `implemented` `GET /api/admin/customers/lookup`：建單時查候選 customer。
- `implemented` `GET /api/admin/work-orders`：工單列表。
- `implemented` `GET /api/admin/work-orders/resolve`：用 `paperOrderNo` 解析 internal UUID。
- `implemented` `POST /api/admin/work-orders`：建立工單。
- `implemented` `GET /api/admin/work-orders/{id}`：工單詳情。
- `implemented` `PATCH /api/admin/work-orders/{id}`：更新非狀態欄位。
- `implemented` `POST /api/admin/work-orders/{id}/status`：單筆狀態更新。
- `implemented` `POST /api/admin/work-orders/bulk-status`：批量狀態更新。
- `implemented` `GET /api/admin/print-jobs`：查詢列印任務列表。
- `implemented` `POST /api/admin/print-jobs`：建立列印任務或補印任務。
- `implemented` `POST /api/admin/print-jobs/{id}/retry`：將失敗任務重新排入佇列。
- `implemented` `GET /api/admin/print-devices`：查詢 Print Worker / 裝置列表。
- `implemented` `POST /api/admin/print-devices`：新增 Print Worker / 裝置。
- `implemented` `PATCH /api/admin/print-devices/{id}`：更新 Worker 名稱、位置或狀態。
- `implemented` `DELETE /api/admin/print-devices/{id}`：刪除沒有進行中 job 的 Worker / 裝置。
- `planned` `POST /api/admin/work-orders/{id}/photos`：上傳工單照片。
- `planned` `GET /api/admin/work-orders/{id}/photos`：查詢工單照片。
- `planned` `POST /api/admin/work-orders/{id}/quote-items`：新增報價項目。
- `planned` `PATCH /api/admin/work-orders/{id}/pickup-info`：更新取件資訊。

### Public API

- `implemented` `POST /api/public/work-orders/lookup`：顧客查詢工單進度。

### Print Worker API

- `implemented` `POST /api/print-worker/jobs/claim`：claim 下一筆待印任務。
- `implemented` `POST /api/print-worker/jobs/{id}/succeed`：Worker 回報列印成功。
- `implemented` `POST /api/print-worker/jobs/{id}/fail`：Worker 回報列印失敗。

## Authentication

### 管理端 API

管理端 API 使用 Supabase Auth session。第一版只有單一管理者角色，但 API path 仍使用 `/api/admin/*`。

未登入或 session 無效時回傳 `401`。
已登入但沒有對應 `admin_profiles` row 時回傳 `403`。
管理端 gate 只支援 Supabase cookie session；第一版不支援 Bearer admin auth。

### Print Worker API

Print Worker API 使用 shared token，不使用 Supabase browser session。

所有 `/api/print-worker/*` endpoint 都必須帶：

```text
Authorization: Bearer <PRINT_WORKER_TOKEN>
```

request body 另外必須帶 `deviceKey`。token 無效時回傳 `401`。device 不存在時回傳 `401`；device 存在但 `status != active` 時回傳 `403`。Print Worker token 只能存在 server-side 與 Worker 環境，不可傳到瀏覽器。

### 顧客查詢 API

顧客查詢不需要登入，但必須提供：

- 紙本工單號。
- 完整手機號碼。

Server 應正規化 `customers.phone` 後比對完整台灣手機號碼。
條碼內容直接等於 `paperOrderNo`。單張掃碼查詢不需要第二套 barcode identifier。

顧客查詢只回傳有限欄位，不回傳內部備註、完整電話、照片路徑或狀態操作歷史。

## Pagination / Filter / Sort

所有 list API 都必須支援：

| Query      | 規則                                                            |
| ---------- | --------------------------------------------------------------- |
| `page`     | default `1`                                                     |
| `pageSize` | default `20`，max `100`                                         |
| `sort`     | 格式 `field:asc` 或 `field:desc`                                |
| `filter`   | 可依 endpoint 定義，也可使用明確 query，例如 `status=REPAIRING` |

List response 格式：

```json
{
  "data": [],
  "pageInfo": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

## Error Model

所有錯誤使用同一格式：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "fieldErrors": {
      "customer.phone": ["Phone is required."]
    },
    "requestId": "req_01HZX8Y7W7S3"
  }
}
```

常用 error code：

- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `TOO_MANY_REQUESTS`
- `VALIDATION_ERROR`
- `CONFLICT`
- `STORAGE_UPLOAD_FAILED`
- `PRINT_JOB_NOT_CLAIMED`
- `PRINT_JOB_ALREADY_CLAIMED`
- `INTERNAL_SERVER_ERROR`

`requestId` 優先沿用 request header `x-request-id`；若 request 沒有帶，server 使用 `crypto.randomUUID()` 產生。所有 API response 都應寫回 response header `x-request-id`；錯誤 response 也必須把同一個值放進 error envelope 的 `requestId`。

`fieldErrors` 統一使用 `Record<string, string[]>` 結構。已知 API 錯誤應由 server-side typed error classes 表示，route handler 不應散落以字串判斷錯誤類型。

第一版 query、body、path validation 失敗一律回 `422 VALIDATION_ERROR`。紙本工單號唯一性衝突回 `409 CONFLICT`。查無 customer 或 work order 回 `404 NOT_FOUND`。

## Admin Session

### `GET /api/admin/session`

回傳目前管理端 session 狀態與最小 admin profile。這支 endpoint 是前端 login / session UI 唯一的 admin bootstrap 來源。

- 未登入時回 `401 UNAUTHORIZED`
- 已登入但沒有 `admin_profiles` row 時回 `403 FORBIDDEN`
- 已登入且為 admin 時回 `200`

Response：`200`

```json
{
  "data": {
    "id": "ddf3e1b0-1c86-41a9-a22c-a40231ecf981",
    "displayName": "BoardsReborn Admin"
  }
}
```

這支 endpoint 只回傳最小必要欄位，不回傳 email、role 或其他無關 profile 資訊。

## Admin Dashboard

### `GET /api/admin/dashboard`

回傳管理端 dashboard 第一版 summary metrics。這支 endpoint 只提供總覽數字，不回傳工單列表，也不取代 `/api/admin/work-orders`。

Response：`200`

```json
{
  "data": {
    "summary": {
      "activeWorkOrders": 18,
      "activeWorkOrdersByStatus": {
        "RECEIVED": 5,
        "DRYING": 4,
        "REPAIRING": 9
      },
      "readyForPickup": 6,
      "overdue": 3,
      "createdToday": 4
    },
    "generatedAt": "2026-04-29T10:45:00.000Z"
  }
}
```

`summary` 第一版固定包含：

- `activeWorkOrders`：
  只計算 `RECEIVED`、`DRYING`、`REPAIRING`，且固定等於 `activeWorkOrdersByStatus.RECEIVED + DRYING + REPAIRING`。
- `activeWorkOrdersByStatus`：
  只包含 `RECEIVED`、`DRYING`、`REPAIRING` 三個處理中狀態的 breakdown。
- `readyForPickup`：
  只計算 `READY_FOR_PICKUP`。
- `overdue`：
  與列表 `overdueEstimatedCompletion` 規則一致，只計算 `RECEIVED`、`DRYING`、`REPAIRING`、`READY_FOR_PICKUP`，排除 `DELIVERED`、`CANCELLED`。
- `createdToday`：
  以 `created_at` 為準，依 `Asia/Taipei` 本地日曆日計算，邊界固定為 `created_at >= startOfDay` 且 `created_at < nextDay`。

`generatedAt` 只用於 UI 顯示「最後更新時間」，不作為 cache key，也不參與邏輯判斷。

## Admin Work Orders

API 中的 `board` object 是 `work_orders` 上的板子快照欄位組合，不代表有獨立 `boards` table。

`board.boardLengthClass` 只對 `boardType = SURFBOARD` 使用，不從 `sizeLabel` 自動推論。第一版允許 legacy row 在 list / detail response 中回 `null`；新建立的 SURFBOARD 工單必須提供 `boardLengthClass`，`SUP` / `SNOWBOARD` 不可帶值。

Admin 單筆 detail / update / status endpoint 使用 `work_orders.id` 作為 internal resource identity。現場掃碼或人工輸入時，前端應先用 `paperOrderNo` 呼叫 resolve endpoint 取得 UUID，再呼叫 UUID-based endpoint。

### `GET /api/admin/work-orders`

查詢工單列表。

Query examples：

```text
/api/admin/work-orders?status=REPAIRING&page=1&pageSize=20&sort=estimated_completion_date:asc
/api/admin/work-orders?overdueEstimatedCompletion=true
/api/admin/work-orders?pickupOverdue=true
/api/admin/work-orders?staleReceived=true
/api/admin/work-orders?q=BR-2026-0001
/api/admin/work-orders?customerPhone=0912345678
```

`q` 第一版只搜尋 `paper_order_no`。`customerPhone` 會先依台灣手機正規化規則轉為 `09xxxxxxxx` 後查詢。`staleReceived=true` 第一版使用 7 天門檻。

列表 response 的 `flags` 用來表達管理端提醒，不是正式狀態，也不會寫回 `work_order_status`：

- `overdueEstimatedCompletion`
- `pickupOverdue`
- `staleReceived`

第一版允許排序欄位：

- `created_at`
- `updated_at`
- `intake_date`
- `estimated_completion_date`
- `current_status`
- `paper_order_no`
- `quote_total_amount`

Response：

```json
{
  "data": [
    {
      "id": "4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2",
      "paperOrderNo": "BR-2026-0001",
      "customer": {
        "id": "ddf3e1b0-1c86-41a9-a22c-a40231ecf981",
        "name": "王小明",
        "phone": "0912345678"
      },
      "board": {
        "color": "BLUE",
        "boardLengthClass": "SHORTBOARD",
        "boardType": "SURFBOARD",
        "sizeLabel": "6'2"
      },
      "currentStatus": "REPAIRING",
      "intakeDate": "2026-04-20",
      "estimatedCompletionDate": "2026-04-26",
      "flags": {
        "overdueEstimatedCompletion": false,
        "pickupOverdue": false,
        "staleReceived": true
      },
      "quoteTotalAmount": 700,
      "paymentReceived": true,
      "paymentReceivedAt": "2026-04-20T08:00:00.000Z",
      "readyForPickupAt": null,
      "lastUpdatedAt": "2026-04-20T08:30:00.000Z"
    }
  ],
  "pageInfo": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

### `GET /api/admin/work-orders/resolve`

依紙本工單號 exact match 查出系統內部工單 UUID。這支 endpoint 用於掃碼、搜尋工單號後進入詳情、批量狀態 preview 或後續更新流程，不做 fuzzy search，也不取代 list API。

Query example：

```text
/api/admin/work-orders/resolve?paperOrderNo=BR-2026-0001
```

`paperOrderNo` 會 trim 前後空白，長度必須是 `3..50`。第一版不新增固定格式 regex。查無工單時回 `404 NOT_FOUND`。

Response：

```json
{
  "data": {
    "id": "4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2",
    "paperOrderNo": "BR-2026-0001",
    "currentStatus": "REPAIRING",
    "customer": {
      "id": "ddf3e1b0-1c86-41a9-a22c-a40231ecf981",
      "name": "王小明",
      "phone": "0912345678"
    },
    "board": {
      "boardType": "SURFBOARD",
      "boardLengthClass": "SHORTBOARD",
      "sizeLabel": "6'2",
      "color": "BLUE"
    },
    "estimatedCompletionDate": "2026-04-26",
    "flags": {
      "overdueEstimatedCompletion": false,
      "pickupOverdue": false,
      "staleReceived": false
    },
    "lastUpdatedAt": "2026-04-20T08:30:00.000Z"
  }
}
```

### `POST /api/admin/work-orders`

建立工單。建立成功時，系統必須以單一 transaction 建立核心工單資料與第一筆 `status_history`。

Request：

```json
{
  "customerMode": "create",
  "customer": {
    "name": "王小明",
    "phone": "0912345678",
    "note": "偏好下午聯絡"
  },
  "board": {
    "boardType": "SURFBOARD",
    "boardLengthClass": "SHORTBOARD",
    "brand": "Channel Islands",
    "model": "Happy",
    "sizeLabel": "6'2",
    "color": "white",
    "serialLabel": "A12"
  },
  "workOrder": {
    "paperOrderNo": "BR-2026-0001",
    "intakeDate": "2026-04-20",
    "damageDescription": "鼻頭裂傷，疑似進水",
    "estimatedCompletionDate": "2026-04-26",
    "paymentReceived": true,
    "publicNote": "已收件，等待檢查",
    "internalNote": "老闆需確認是否除濕"
  },
  "quoteItems": [
    {
      "itemType": "INITIAL",
      "description": "初始報價",
      "amount": 500
    }
  ]
}
```

`board.boardLengthClass` 規則：

- `SURFBOARD`：必填，值只能是 `SHORTBOARD`、`MID_LENGTH`、`LONGBOARD`
- `SUP` / `SNOWBOARD`：不得帶值；若帶值回 `422 VALIDATION_ERROR`

若要重用既有顧客，request 使用：

```json
{
  "customerMode": "reuse",
  "customerId": "ddf3e1b0-1c86-41a9-a22c-a40231ecf981",
  "board": {
    "boardType": "SURFBOARD",
    "boardLengthClass": "MID_LENGTH",
    "sizeLabel": "6'2"
  },
  "workOrder": {
    "paperOrderNo": "BR-2026-0001",
    "intakeDate": "2026-04-20"
  },
  "quoteItems": []
}
```

Response：`201`

```json
{
  "data": {
    "id": "4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2",
    "paperOrderNo": "BR-2026-0001",
    "currentStatus": "RECEIVED",
    "quoteTotalAmount": 500,
    "createdAt": "2026-04-20T08:00:00.000Z"
  }
}
```

建立工單成功後，server 會 best-effort 建立第一筆 `print_jobs`。若 enqueue 失敗，工單仍然建立成功；列印流程失敗不可影響工單主資料建立成功。

### `GET /api/admin/work-orders/{id}`

取得工單詳細資料。

Response：

```json
{
  "data": {
    "id": "4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2",
    "paperOrderNo": "BR-2026-0001",
    "currentStatus": "REPAIRING",
    "customer": {
      "id": "ddf3e1b0-1c86-41a9-a22c-a40231ecf981",
      "name": "王小明",
      "phone": "0912345678"
    },
    "board": {
      "boardType": "SURFBOARD",
      "boardLengthClass": "SHORTBOARD",
      "brand": "Channel Islands",
      "color": "white",
      "model": "Happy",
      "serialLabel": "A12",
      "sizeLabel": "6'2"
    },
    "intakeDate": "2026-04-20",
    "damageDescription": "鼻頭裂傷，疑似進水",
    "estimatedCompletionDate": "2026-04-26",
    "paymentReceived": true,
    "paymentReceivedAt": "2026-04-20T08:00:00.000Z",
    "publicNote": "維修中",
    "internalNote": "注意鼻頭內層",
    "quoteItems": [
      {
        "id": "e24d6d36-e8cc-4124-9a31-46046b0334b5",
        "itemType": "INITIAL",
        "description": "初始報價",
        "amount": 500,
        "createdAt": "2026-04-20T08:00:00.000Z"
      },
      {
        "id": "f748635c-63c2-4a36-9d4b-d9263ef5756d",
        "itemType": "ADDITIONAL",
        "description": "拆開後發現傷口更大",
        "amount": 200,
        "createdAt": "2026-04-20T09:00:00.000Z"
      }
    ],
    "quoteTotalAmount": 700,
    "statusHistory": [
      {
        "id": "2cbe8b43-3810-47d2-9a6d-ae6472340e4c",
        "status": "RECEIVED",
        "changedAt": "2026-04-20T08:00:00.000Z",
        "note": null
      },
      {
        "id": "efcefb48-7f33-4123-b7d0-4d3e9101f0f5",
        "status": "REPAIRING",
        "changedAt": "2026-04-20T08:30:00.000Z",
        "note": "已開始補鼻頭"
      }
    ],
    "pickupInfo": {
      "notifiedAt": null,
      "pickedUpAt": null,
      "pickupNote": null,
      "storageFeeWarningAfterDays": 14,
      "daysWaitingForPickup": 0,
      "isPickupOverdue": false
    }
  }
}
```

### `PATCH /api/admin/work-orders/{id}`

更新工單非狀態欄位。不可透過此 endpoint 更新狀態；狀態必須走 append history endpoint。

第一版只允許更新：

- `estimatedCompletionDate`
- `damageDescription`
- `paymentReceived`
- `publicNote`
- `internalNote`
- `pickupNote`
- `storageFeeWarningAfterDays`

Request：

```json
{
  "estimatedCompletionDate": "2026-04-28",
  "damageDescription": "鼻頭裂傷，拆開後確認範圍更大",
  "paymentReceived": true,
  "publicNote": "維修中，預估完成日已更新",
  "internalNote": "已與顧客確認追加費用"
}
```

`paymentReceived` 由 `false` 改為 `true` 時，Nuxt API 應同步寫入 `paymentReceivedAt`。由 `true` 改回 `false` 時，Nuxt API 應清空 `paymentReceivedAt`。第一版不提供付款明細、付款方式、收據或退款流程。

Response：

```json
{
  "data": {
    "id": "4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2",
    "updatedAt": "2026-04-20T09:10:00.000Z"
  }
}
```

### `POST /api/admin/work-orders/{id}/status`

新增狀態歷史並同步更新 `work_orders.current_status`。這是唯一可更新工單狀態的單筆 admin endpoint；`PATCH /api/admin/work-orders/{id}` 不接受狀態欄位。

Request：

```json
{
  "status": "READY_FOR_PICKUP",
  "note": "已完成，等待取件",
  "internalNote": "老闆已確認可取件"
}
```

`note`、`internalNote` 可省略或傳 `null`。trim 後空字串視為 `null`。`internalNote` 有傳入時更新 `work_orders.internal_note`；未傳入時保持原值。`reason` 不是第一版支援欄位，若送入會以 unknown field 回 `422 VALIDATION_ERROR`。

Response：`201`

```json
{
  "data": {
    "workOrder": {
      "id": "4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2",
      "paperOrderNo": "BR-2026-0001",
      "currentStatus": "READY_FOR_PICKUP",
      "readyForPickupAt": "2026-04-20T09:30:00.000Z",
      "deliveredAt": null,
      "cancelledAt": null,
      "updatedAt": "2026-04-20T09:30:00.000Z"
    },
    "statusHistory": {
      "id": "8b1c52b7-5bfd-4ff3-bd69-467963515bc8",
      "status": "READY_FOR_PICKUP",
      "changedAt": "2026-04-20T09:30:00.000Z",
      "note": "已完成，等待取件"
    }
  }
}
```

若雪板進入 `DRYING`，回傳 `422 VALIDATION_ERROR`，`fieldErrors.status` 說明不可轉換。

狀態 timestamp 維護規則：

- 進入 `READY_FOR_PICKUP` 時，維護 `work_orders.ready_for_pickup_at`，若已有值則保留第一次時間。
- 進入 `DELIVERED` 時，維護 `work_orders.delivered_at` 與 `work_orders.picked_up_at`，若已有值則保留第一次時間。
- 進入 `CANCELLED` 時，維護 `work_orders.cancelled_at`，若已有值則保留第一次時間。
- 狀態可重複 append，例如 `REPAIRING` 到 `REPAIRING` 可用於補充事件備註。

### `POST /api/admin/work-orders/bulk-status`

批量狀態更新。前端掃描多張條碼後，直接把掃描到的 `paperOrderNos` 陣列送進來。

Request：

```json
{
  "paperOrderNos": ["BR-2026-0001", "BR-2026-0002", "BR-2026-0001", "BR-2026-0003"],
  "status": "REPAIRING",
  "note": "今日統一開工"
}
```

只接受 `paperOrderNos`、`status`、`note` 三個欄位。第一版不支援 `internalNote`、`reason`；若出現未知欄位，整體回 `422 VALIDATION_ERROR`。

Response：`200`

```json
{
  "data": {
    "requestedCount": 4,
    "dedupedCount": 3,
    "updatedCount": 2,
    "skippedCount": 1,
    "updated": [
      {
        "paperOrderNo": "BR-2026-0001",
        "workOrderId": "4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2",
        "currentStatus": "REPAIRING",
        "statusHistoryId": "8b1c52b7-5bfd-4ff3-bd69-467963515bc8"
      },
      {
        "paperOrderNo": "BR-2026-0002",
        "workOrderId": "d07e4aab-c2ae-4b8b-90a2-5c82e3796a6f",
        "currentStatus": "REPAIRING",
        "statusHistoryId": "c8ab0f5b-2653-433b-8443-0ef1fcd8507e"
      }
    ],
    "skipped": [
      {
        "paperOrderNo": "BR-2026-0003",
        "reason": "INVALID_STATUS_TRANSITION"
      }
    ]
  }
}
```

規則：

- `paperOrderNos` 必須是非空字串陣列；每筆值會 trim 前後空白，長度必須是 `3..50`。
- `status` 必須是既有 `work_order_status` enum；`note` 可省略或為 `null`，trim 後空字串視為 `null`。
- `requestedCount` 等於原始輸入陣列長度，包含重複值。
- `dedupedCount` 等於 server trim + 去重後，實際嘗試處理的唯一工單號數。
- `updatedCount` 等於成功完成狀態更新的工單數；`skippedCount` 等於略過的工單數。
- `updated[]` 與 `skipped[]` 依去重後的首次出現順序輸出，不依資料庫查詢順序。
- `skipped.reason` 第一版固定只允許 `NOT_FOUND` 與 `INVALID_STATUS_TRANSITION`。這是 batch result label，不是 shared error envelope code。
- `paperOrderNos` 內每張工單都要 individually 驗證。
- 每張成功更新的工單都必須 individually append 一筆 `status_history`。
- 單張找不到工單時，該筆進 `skipped.reason = NOT_FOUND`。
- 單張狀態轉換違反商業規則時，該筆進 `skipped.reason = INVALID_STATUS_TRANSITION`。
- 單張失敗不可讓整批全部回滾；應回傳 `updated` 與 `skipped` 明細。
- Bulk endpoint 不是單一 transaction；每張工單仍 individually 執行既有單筆 status transition RPC。
- 若途中發生未知系統錯誤，立即停止後續項目處理，整體回 `500 INTERNAL_SERVER_ERROR`。
- 在未知錯誤發生前已成功完成的 individual updates 可能已經 committed，不保證整批 rollback。

### `GET /api/admin/print-jobs`

查詢列印任務列表。此 endpoint 使用管理端 Supabase Auth session。

Query：

| Field         | Required | Example                        |
| ------------- | -------- | ------------------------------ |
| `status`      | no       | `failed`                       |
| `workOrderId` | no       | `4d4ff81c-2b1d-41aa-9fd2...`   |
| `paperOrderNo`| no       | `BR-2026-0001`                 |
| `page`        | no       | `1`                            |
| `pageSize`    | no       | `20`                           |
| `sort`        | no       | `createdAt:desc`               |

Response：

```json
{
  "data": [
    {
      "id": "f126a8fd-13f6-4797-a874-22a397ad25c7",
      "jobType": "work_order_label",
      "status": "failed",
      "attemptCount": 3,
      "maxAttempts": 3,
      "lastError": "Printer offline",
      "lockedAt": null,
      "lockedBy": null,
      "printedAt": null,
      "createdAt": "2026-05-21T10:00:00.000Z",
      "updatedAt": "2026-05-21T10:04:00.000Z",
      "workOrder": {
        "id": "4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2",
        "paperOrderNo": "BR-2026-0001"
      },
      "customer": {
        "name": "王小明"
      },
      "board": {
        "boardType": "SURFBOARD",
        "boardLengthClass": "SHORTBOARD"
      },
      "device": {
        "id": "a0c7a5e9-6984-4f61-a983-2bc859e85834",
        "name": "Front Desk Pi"
      }
    }
  ],
  "pageInfo": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

### `POST /api/admin/print-jobs`

手動建立列印任務或補印任務。此 endpoint 使用管理端 Supabase Auth session。

Request：

```json
{
  "workOrderId": "4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2",
  "jobType": "work_order_label"
}
```

Response：`201`

```json
{
  "data": {
    "id": "f126a8fd-13f6-4797-a874-22a397ad25c7",
    "workOrderId": "4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2",
    "jobType": "work_order_label",
    "status": "pending",
    "attemptCount": 0,
    "maxAttempts": 3,
    "createdAt": "2026-05-21T10:00:00.000Z",
    "updatedAt": "2026-05-21T10:00:00.000Z"
  }
}
```

補印必須新增新的 `print_jobs` 記錄，不可覆蓋舊任務。

### `POST /api/admin/print-jobs/{id}/retry`

將失敗任務重新排入佇列。此 endpoint 使用管理端 Supabase Auth session。

Request：空 body

Response：

```json
{
  "data": {
    "id": "f126a8fd-13f6-4797-a874-22a397ad25c7",
    "workOrderId": "4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2",
    "jobType": "work_order_label",
    "status": "pending",
    "attemptCount": 3,
    "maxAttempts": 3,
    "updatedAt": "2026-05-21T10:05:00.000Z"
  }
}
```

規則：

- 只能 retry `failed`
- retry 後 `status` 回到 `pending`
- `lastError` 清空
- `lockedAt` / `lockedBy` 清空
- `attemptCount` 保留

### `GET /api/admin/print-devices`

查詢 Print Worker / 裝置列表。此 endpoint 使用管理端 Supabase Auth session。

Query：

| Field      | Required | Example          |
| ---------- | -------- | ---------------- |
| `status`   | no       | `active`         |
| `q`        | no       | `front desk`     |
| `page`     | no       | `1`              |
| `pageSize` | no       | `20`             |
| `sort`     | no       | `updatedAt:desc` |

`q` 會比對 `name`、`deviceKey` 與 `location`。

Response：

```json
{
  "data": [
    {
      "id": "a0c7a5e9-6984-4f61-a983-2bc859e85834",
      "name": "Front Desk Pi",
      "deviceKey": "raspi-print-worker-01",
      "location": "Front Desk",
      "status": "active",
      "lastSeenAt": "2026-05-22T09:30:00.000Z",
      "createdAt": "2026-05-21T08:00:00.000Z",
      "updatedAt": "2026-05-22T09:30:00.000Z",
      "currentJob": {
        "id": "f126a8fd-13f6-4797-a874-22a397ad25c7",
        "workOrderId": "4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2",
        "paperOrderNo": "BR-2026-0001",
        "status": "locked",
        "lockedAt": "2026-05-22T09:28:00.000Z"
      },
      "recentError": {
        "jobId": "0e5d2f4c-f9cc-4614-a54a-1824383dfe15",
        "message": "Printer offline",
        "updatedAt": "2026-05-22T08:12:00.000Z"
      }
    }
  ],
  "pageInfo": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

### `POST /api/admin/print-devices`

新增 Print Worker / 裝置。此 endpoint 使用管理端 Supabase Auth session。

Request：

```json
{
  "name": "Front Desk Pi",
  "deviceKey": "raspi-print-worker-01",
  "location": "Front Desk",
  "status": "active"
}
```

規則：

- `name` 與 `deviceKey` 必填
- `deviceKey` 必須 unique
- `status` 可省略，省略時預設 `active`
- 只接受 `name`、`deviceKey`、`location`、`status` 四個欄位

Response：`201`

```json
{
  "data": {
    "id": "a0c7a5e9-6984-4f61-a983-2bc859e85834",
    "name": "Front Desk Pi",
    "deviceKey": "raspi-print-worker-01",
    "location": "Front Desk",
    "status": "active",
    "lastSeenAt": null,
    "createdAt": "2026-05-22T10:00:00.000Z",
    "updatedAt": "2026-05-22T10:00:00.000Z",
    "currentJob": null,
    "recentError": null
  }
}
```

### `PATCH /api/admin/print-devices/{id}`

更新 Print Worker 的名稱、位置或狀態。此 endpoint 使用管理端 Supabase Auth session。

Request：

```json
{
  "name": "Front Desk Pi",
  "location": "Front Desk",
  "status": "inactive"
}
```

規則：

- 至少需帶一個可更新欄位
- 只允許更新 `name`、`location`、`status`
- `location` 可送 `null` 清空
- `status` 只允許 `active`、`inactive`、`error`
- 不提供 `deviceKey`、token、secret 的管理能力

Response：

```json
{
  "data": {
    "id": "a0c7a5e9-6984-4f61-a983-2bc859e85834",
    "name": "Front Desk Pi",
    "deviceKey": "raspi-print-worker-01",
    "location": "Front Desk",
    "status": "inactive",
    "lastSeenAt": "2026-05-22T09:30:00.000Z",
    "createdAt": "2026-05-21T08:00:00.000Z",
    "updatedAt": "2026-05-22T09:35:00.000Z",
    "currentJob": null,
    "recentError": {
      "jobId": "0e5d2f4c-f9cc-4614-a54a-1824383dfe15",
      "message": "Printer offline",
      "updatedAt": "2026-05-22T08:12:00.000Z"
    }
  }
}
```

### `DELETE /api/admin/print-devices/{id}`

刪除 Print Worker / 裝置。此 endpoint 使用管理端 Supabase Auth session。

規則：

- 若該裝置仍有 `locked` 或 `printing` 的 job，回 `409 CONFLICT`
- 刪除後，既有歷史 `print_jobs.print_device_id` 依 schema `on delete set null`
- 第一版不支援 bulk delete

Response：

```json
{
  "data": {
    "id": "a0c7a5e9-6984-4f61-a983-2bc859e85834"
  }
}
```

## Print Worker Jobs

以下 endpoint 供固定桌機或樹莓派上的 Python Print Worker 使用，皆需要 `Authorization: Bearer <PRINT_WORKER_TOKEN>`。

### `POST /api/print-worker/jobs/claim`

Claim 下一筆待印任務。

Request：

```json
{
  "deviceKey": "raspi-print-worker-01"
}
```

Response：

```json
{
  "data": {
    "job": {
      "id": "a347e6ea-a025-48ef-9ca1-bec9d63a5676",
      "workOrderId": "4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2",
      "jobType": "work_order_label",
      "payload": {
        "paperOrderNo": "BR-2026-0001",
        "customerName": "王小明",
        "boardType": "SURFBOARD",
        "boardLengthClass": "SHORTBOARD",
        "createdAt": "2026-05-21T09:50:00.000Z"
      },
      "attemptCount": 0,
      "maxAttempts": 3,
      "lockedAt": "2026-05-21T10:01:00.000Z",
      "createdAt": "2026-05-21T10:00:00.000Z"
    }
  }
}
```

無待印任務時：

```json
{
  "data": {
    "job": null
  }
}
```

規則：

- 只允許 `active` device claim
- server 優先回傳最早建立的 `pending` 任務
- 若無 `pending`，可 reclaim `locked_at` 超過 5 分鐘的 stale lock
- claim 必須是原子操作，避免多個 worker 同時取走同一筆
- claim 成功後寫入 `status = locked`、`lockedAt`、`lockedBy`、`printDeviceId`

### `POST /api/print-worker/jobs/{id}/succeed`

Worker 回報列印成功。

Request：

```json
{
  "deviceKey": "raspi-print-worker-01"
}
```

Response：

```json
{
  "data": {
    "id": "a347e6ea-a025-48ef-9ca1-bec9d63a5676",
    "status": "printed",
    "attemptCount": 0,
    "printedAt": "2026-05-21T10:02:00.000Z",
    "updatedAt": "2026-05-21T10:02:00.000Z"
  }
}
```

### `POST /api/print-worker/jobs/{id}/fail`

Worker 回報列印失敗。

Request：

```json
{
  "deviceKey": "raspi-print-worker-01",
  "error": "Printer offline"
}
```

Response：

```json
{
  "data": {
    "id": "a347e6ea-a025-48ef-9ca1-bec9d63a5676",
    "status": "pending",
    "attemptCount": 1,
    "maxAttempts": 3,
    "lastError": "Printer offline",
    "updatedAt": "2026-05-21T10:03:00.000Z"
  }
}
```

規則：

- `succeed` / `fail` 都只允許目前持有 lock 的同一台 device 回報
- `fail` 時 `attemptCount += 1`
- 若 `attemptCount < maxAttempts`，job 回到 `pending`
- 若 `attemptCount >= maxAttempts`，job 改成 `failed`

## Admin Photos

### `POST /api/admin/work-orders/{id}/photos`

上傳照片。此 endpoint 使用 `multipart/form-data`。

Form fields：

| Field        | Required | Example                    |
| ------------ | -------- | -------------------------- |
| `file`       | yes      | image file                 |
| `photoType`  | yes      | `SPECIAL_CONDITION`        |
| `visibility` | no       | `INTERNAL`                 |
| `note`       | no       | `拆開後發現傷口更大`       |
| `takenAt`    | no       | `2026-04-20T09:00:00.000Z` |

Response：`201`

```json
{
  "data": {
    "id": "b7d285a4-ef0d-46e4-97d8-298fd7ee2311",
    "workOrderId": "4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2",
    "photoType": "SPECIAL_CONDITION",
    "visibility": "INTERNAL",
    "bucket": "repair-photos",
    "path": "work-orders/BR-2026-0001/20260420-special-condition.jpg",
    "contentType": "image/jpeg",
    "sizeBytes": 348112,
    "createdAt": "2026-04-20T09:00:00.000Z"
  }
}
```

### `GET /api/admin/work-orders/{id}/photos`

Response：

```json
{
  "data": [
    {
      "id": "b7d285a4-ef0d-46e4-97d8-298fd7ee2311",
      "photoType": "SPECIAL_CONDITION",
      "visibility": "INTERNAL",
      "bucket": "repair-photos",
      "path": "work-orders/BR-2026-0001/20260420-special-condition.jpg",
      "createdAt": "2026-04-20T09:00:00.000Z"
    }
  ]
}
```

## Admin Quote Items

### `POST /api/admin/work-orders/{id}/quote-items`

新增追加或調整項目。

Request：

```json
{
  "itemType": "ADDITIONAL",
  "description": "特殊工況追加費用",
  "amount": 200
}
```

Response：`201`

```json
{
  "data": {
    "id": "f748635c-63c2-4a36-9d4b-d9263ef5756d",
    "workOrderId": "4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2",
    "itemType": "ADDITIONAL",
    "description": "特殊工況追加費用",
    "amount": 200,
    "quoteTotalAmount": 700,
    "createdAt": "2026-04-20T09:00:00.000Z"
  }
}
```

## Admin Pickup Info

`pickupInfo` 是 API 層的邏輯 object；第一版資料來源是 `work_orders` 上的 inline pickup 欄位，不是獨立 `pickup_info` table。

### `PATCH /api/admin/work-orders/{id}/pickup-info`

Request：

```json
{
  "notifiedAt": "2026-04-27T03:00:00.000Z",
  "pickedUpAt": null,
  "pickupNote": "已電話通知",
  "storageFeeWarningAfterDays": 14
}
```

Response：

```json
{
  "data": {
    "workOrderId": "4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2",
    "notifiedAt": "2026-04-27T03:00:00.000Z",
    "pickedUpAt": null,
    "pickupNote": "已電話通知",
    "storageFeeWarningAfterDays": 14,
    "daysWaitingForPickup": 0,
    "isPickupOverdue": false
  }
}
```

寄板費或取件費提醒第一版不做獨立欄位；需要時先寫入 `pickupNote` 或 `internalNote`。

## Admin Customers

### `GET /api/admin/customers/lookup`

建單流程用的顧客候選查詢；不是完整 customer list / CRUD。

Query：

```text
/api/admin/customers/lookup?phone=0912345678
```

Response：

```json
{
  "data": [
    {
      "id": "ddf3e1b0-1c86-41a9-a22c-a40231ecf981",
      "name": "王小明",
      "phone": "0912345678",
      "note": "偏好下午聯絡",
      "createdAt": "2026-04-20T08:00:00.000Z"
    }
  ]
}
```

此 endpoint 只依正規化後的台灣手機號碼查候選顧客；不提供顧客修改、刪除或完整列表。

## Public Work Order Lookup

### `POST /api/public/work-orders/lookup`

顧客查詢進度。Server 以工單關聯顧客的 `customers.phone` 正規化後比對完整手機號碼。手機號碼不符合時，回傳 `404`，避免透露工單是否存在。

Request：

```json
{
  "paperOrderNo": "BR-2026-0001",
  "phone": "0912345678"
}
```

Response：

```json
{
  "data": {
    "paperOrderNo": "BR-2026-0001",
    "currentStatus": "REPAIRING",
    "statusLabel": "維修中",
    "estimatedCompletionDate": "2026-04-26",
    "initialQuoteAmount": 500,
    "publicNote": "維修中，預估下週完成",
    "lastUpdatedAt": "2026-04-20T09:30:00.000Z",
    "progress": {
      "kind": "timeline",
      "currentStepKey": "REPAIRING",
      "steps": [
        { "key": "RECEIVED", "label": "已收件", "state": "done" },
        { "key": "DRYING", "label": "除濕中", "state": "done" },
        { "key": "REPAIRING", "label": "維修中", "state": "current" },
        { "key": "READY_FOR_PICKUP", "label": "待取件", "state": "upcoming" },
        { "key": "DELIVERED", "label": "已交件", "state": "upcoming" }
      ]
    }
  }
}
```

Request rules：

- `paperOrderNo` 會 trim 前後空白，長度必須是 `3..50`。
- `phone` 必須是可正規化為台灣手機的完整號碼。
- 只接受 `paperOrderNo` 與 `phone` 兩個欄位；未知欄位回 `422 VALIDATION_ERROR`。
- `lastUpdatedAt` 固定等於 `work_orders.updated_at`。

`progress` 是 discriminated union：

- `timeline`
  - `steps[].state` 只允許 `done`、`current`、`upcoming`
  - `SURFBOARD / SUP` steps 固定為 `RECEIVED -> DRYING -> REPAIRING -> READY_FOR_PICKUP -> DELIVERED`
  - `SNOWBOARD` steps 固定為 `RECEIVED -> REPAIRING -> READY_FOR_PICKUP -> DELIVERED`
- `cancelled`
  - `CANCELLED` 工單固定回傳：

```json
{
  "kind": "cancelled",
  "message": "此工單已取消"
}
```

`CANCELLED` 不回 timeline steps。

第一版 public lookup 另加簡單 rate limit：

- `10 requests / minute / IP`
- MVP 可使用 server-side in-memory store
- rate limit key 取 `x-forwarded-for` 第一個 IP；若無則 fallback 到 `remoteAddress`
- 超限回 `429 TOO_MANY_REQUESTS`

顧客查詢不可回傳：

- 顧客完整電話。
- 內部備註。
- Supabase Storage bucket/path。
- `status_history` 完整明細。
- 管理者或員工資訊。
