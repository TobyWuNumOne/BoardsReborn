# API Contract

## 基本規則

- 本文件定義 Nuxt Nitro server API，不直接把 Supabase auto-generated API 當公開 contract。
- Base path：`/api`
- Request / response 預設為 JSON。
- 照片上傳使用 `multipart/form-data`。
- 時間格式使用 ISO 8601。
- 日期格式使用 `YYYY-MM-DD`。
- enum value 使用大寫字串，需與 [domain model](domain-model.md) 一致。

## Authentication

### 管理端 API

管理端 API 使用 Supabase Auth session。第一版只有單一管理者角色，但 API path 仍使用 `/api/admin/*`。

未登入或 session 無效時回傳 `401`。
已登入但沒有對應 `admin_profiles` row 時回傳 `403`。
管理端 gate 只支援 Supabase cookie session；第一版不支援 Bearer admin auth。

### Print Agent API

Print Agent API 使用 shared token，不使用 Supabase browser session。

所有 `/api/print-jobs/*` endpoint 都必須帶：

```text
Authorization: Bearer <PRINT_AGENT_TOKEN>
```

token 無效時回傳 `401`。Print Agent token 只能存在 server-side 與 agent 環境，不可傳到瀏覽器。

### 顧客查詢 API

顧客查詢不需要登入，但必須提供：

- 紙本工單號。
- 手機後四碼。

`phoneLast4` 是 request 參數，不是資料庫欄位。Server 應正規化 `customers.phone` 後取末四碼比對。
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
- `VALIDATION_ERROR`
- `CONFLICT`
- `INVALID_STATUS_TRANSITION`
- `STORAGE_UPLOAD_FAILED`
- `PRINT_JOB_NOT_CLAIMED`
- `PRINT_JOB_ALREADY_CLAIMED`
- `INTERNAL_SERVER_ERROR`

`requestId` 優先沿用 request header `x-request-id`；若 request 沒有帶，server 使用 `crypto.randomUUID()` 產生。所有 API response 都應寫回 response header `x-request-id`；錯誤 response 也必須把同一個值放進 error envelope 的 `requestId`。

`fieldErrors` 統一使用 `Record<string, string[]>` 結構。已知 API 錯誤應由 server-side typed error classes 表示，route handler 不應散落以字串判斷錯誤類型。

## Admin Work Orders

API 中的 `board` object 是 `work_orders` 上的板子快照欄位組合，不代表有獨立 `boards` table。

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
        "boardType": "SURFBOARD",
        "sizeLabel": "6'2"
      },
      "currentStatus": "REPAIRING",
      "intakeDate": "2026-04-20",
      "estimatedCompletionDate": "2026-04-26",
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

### `POST /api/admin/work-orders`

建立工單。建立成功時，系統必須同時建立第一筆 `status_history`。

Request：

```json
{
  "customer": {
    "name": "王小明",
    "phone": "0912345678",
    "note": "偏好下午聯絡"
  },
  "board": {
    "boardType": "SURFBOARD",
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

Response：`201`

```json
{
  "data": {
    "id": "4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2",
    "paperOrderNo": "BR-2026-0001",
    "currentStatus": "RECEIVED",
    "quoteTotalAmount": 500,
    "printJob": {
      "id": "a347e6ea-a025-48ef-9ca1-bec9d63a5676",
      "status": "QUEUED",
      "labelLanguage": "TSPL"
    },
    "createdAt": "2026-04-20T08:00:00.000Z"
  }
}
```

建立工單成功後，Nuxt API 應建立一筆初始 `print_job`。列印失敗不應影響工單建立成功；使用者可從補印流程建立新的列印任務。

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
      "brand": "Channel Islands",
      "model": "Happy",
      "sizeLabel": "6'2"
    },
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

更新工單基本欄位。不可透過此 endpoint 更新狀態；狀態必須走 append history endpoint。

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

新增狀態歷史並同步更新 `work_orders.current_status`。

Request：

```json
{
  "status": "DRYING",
  "note": "確認進水，先除濕"
}
```

Response：`201`

```json
{
  "data": {
    "workOrderId": "4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2",
    "currentStatus": "DRYING",
    "statusHistory": {
      "id": "8b1c52b7-5bfd-4ff3-bd69-467963515bc8",
      "status": "DRYING",
      "changedAt": "2026-04-20T09:30:00.000Z",
      "note": "確認進水，先除濕"
    }
  }
}
```

若雪板進入 `DRYING`，回傳 `422 INVALID_STATUS_TRANSITION`。

狀態 timestamp 維護規則：

- 進入 `READY_FOR_PICKUP` 時，維護 `work_orders.ready_for_pickup_at`；若此操作同時代表已通知顧客，維護 `work_orders.notified_at`。
- 進入 `DELIVERED` 時，維護 `work_orders.delivered_at` 與 `work_orders.picked_up_at`。
- 進入 `CANCELLED` 時，維護 `work_orders.cancelled_at`。
- 狀態可重複 append，例如 `REPAIRING` 到 `REPAIRING` 可用於補充事件備註。

### `POST /api/admin/work-orders/bulk-status`

批量狀態更新。前端掃描多張條碼後，直接把掃描到的 `paperOrderNo` 陣列送進來。

Request：

```json
{
  "paperOrderNos": ["BR-2026-0001", "BR-2026-0002", "BR-2026-0003"],
  "status": "REPAIRING",
  "note": "今日統一開工"
}
```

Response：`200`

```json
{
  "data": {
    "requestedCount": 3,
    "updatedCount": 2,
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

- `paperOrderNos` 內每張工單都要 individually 驗證。
- 每張成功更新的工單都必須 individually append 一筆 `status_history`。
- 單張失敗不可讓整批全部回滾；應回傳 `updated` 與 `skipped` 明細。
- `paperOrderNos` 應去重後處理，但 response 仍應按唯一工單回報結果。

### `POST /api/admin/work-orders/{id}/print-jobs`

建立補印任務。此 endpoint 使用管理端 Supabase Auth session。

Request：

```json
{
  "labelLanguage": "TSPL",
  "reason": "標籤破損，重新列印"
}
```

Response：`201`

```json
{
  "data": {
    "id": "f126a8fd-13f6-4797-a874-22a397ad25c7",
    "workOrderId": "4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2",
    "paperOrderNo": "BR-2026-0001",
    "status": "QUEUED",
    "labelLanguage": "TSPL",
    "attemptCount": 0,
    "createdAt": "2026-04-20T10:00:00.000Z"
  }
}
```

補印必須新增 `print_jobs` 記錄，不可覆蓋舊列印任務。

## Print Agent Jobs

以下 endpoint 供固定桌機或樹莓派上的 Python Print Agent 使用，皆需要 `Authorization: Bearer <PRINT_AGENT_TOKEN>`。

### `GET /api/print-jobs/next`

取得下一筆待印任務。Server 應優先回傳 `QUEUED` 或 `REPRINT_REQUESTED` 狀態中最早建立的任務。

Query examples：

```text
/api/print-jobs/next?agentId=raspi-frontdesk-01
```

Response：

```json
{
  "data": {
    "id": "a347e6ea-a025-48ef-9ca1-bec9d63a5676",
    "workOrderId": "4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2",
    "paperOrderNo": "BR-2026-0001",
    "status": "QUEUED",
    "labelLanguage": "TSPL",
    "labelPayload": {
      "paperOrderNo": "BR-2026-0001",
      "boardType": "SURFBOARD",
      "customerName": "王小明",
      "barcodeValue": "BR-2026-0001"
    },
    "attemptCount": 0,
    "createdAt": "2026-04-20T08:00:00.000Z"
  }
}
```

無待印任務時：

```json
{
  "data": null
}
```

### `POST /api/print-jobs/{id}/start`

標記任務進入處理中。

Request：

```json
{
  "agentId": "raspi-frontdesk-01"
}
```

Response：

```json
{
  "data": {
    "id": "a347e6ea-a025-48ef-9ca1-bec9d63a5676",
    "status": "PROCESSING",
    "claimedBy": "raspi-frontdesk-01",
    "claimedAt": "2026-04-20T08:01:00.000Z",
    "attemptCount": 1
  }
}
```

### `POST /api/print-jobs/{id}/result`

回報列印結果。

Request：

```json
{
  "agentId": "raspi-frontdesk-01",
  "status": "SENT_TO_PRINTER",
  "printerStatusRaw": "USB_WRITE_OK",
  "message": "TSPL command sent to USB printer."
}
```

Response：

```json
{
  "data": {
    "id": "a347e6ea-a025-48ef-9ca1-bec9d63a5676",
    "status": "SENT_TO_PRINTER",
    "printedAt": null,
    "lastError": null,
    "updatedAt": "2026-04-20T08:02:00.000Z"
  }
}
```

`status` 必須是 `SENT_TO_PRINTER`、`PRINTER_READY_AFTER_SEND`、`FAILED_TRANSPORT`、`FAILED_PRINTER_STATUS` 或 `UNKNOWN`。寫入 USB 成功只能回報 `SENT_TO_PRINTER`，不可直接等同貼紙已成功吐出。

### `POST /api/print-jobs/{id}/retry`

將失敗或未知狀態的任務重新排入待印。

Request：

```json
{
  "agentId": "raspi-frontdesk-01",
  "reason": "重新排入待印"
}
```

Response：

```json
{
  "data": {
    "id": "a347e6ea-a025-48ef-9ca1-bec9d63a5676",
    "status": "REPRINT_REQUESTED",
    "attemptCount": 1,
    "updatedAt": "2026-04-20T08:05:00.000Z"
  }
}
```

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

### `GET /api/admin/customers`

Query examples：

```text
/api/admin/customers?q=王&page=1&pageSize=20
/api/admin/customers?phone=0912345678
```

Response：

```json
{
  "data": [
    {
      "id": "ddf3e1b0-1c86-41a9-a22c-a40231ecf981",
      "name": "王小明",
      "phone": "0912345678",
      "workOrderCount": 2,
      "createdAt": "2026-04-20T08:00:00.000Z"
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

### `GET /api/admin/customers/{id}/work-orders`

回傳某位顧客的工單列表，格式同 `GET /api/admin/work-orders`。

## Public Work Order Lookup

### `GET /api/public/work-orders/{paperOrderNo}?phoneLast4=1234`

顧客查詢進度。Server 以工單關聯顧客的 `customers.phone` 末四碼比對 `phoneLast4`。手機後四碼不符合時，回傳 `404`，避免透露工單是否存在。

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
    "lastUpdatedAt": "2026-04-20T09:30:00.000Z"
  }
}
```

顧客查詢不可回傳：

- 顧客完整電話。
- 內部備註。
- Supabase Storage bucket/path。
- `status_history` 完整明細。
- 管理者或員工資訊。
