# LINE MVP Release Verification

本文件記錄 LINE MVP 12 PR 主線完成後的 release hardening 結果。狀態定義為：

> 功能完成，尚未完成 production release verification。

本輪只驗證 staging 與 production 啟用前條件，不新增功能、不改 LINE 架構，也不啟用 production Cron。

## 驗證環境

- 驗證日期：2026-06-22
- Vercel project：`board-reborn-staging`
- Staging URL：`https://board-reborn-staging.vercel.app`
- Supabase staging project ref：`xnxbbjigercsfqdswdhb`
- Production Supabase project未執行任何 Vault / Cron變更。

## 自動驗證結果

| 項目                          | 結果    | 證據摘要                                                                                 |
| ----------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| Staging deploy                | PASS    | Vercel deployment `dpl_DKvF2548VJhNPKi6aoSfiQWSQbR6` ready，stable alias已更新           |
| Staging migrations            | PASS    | `supabase db push --dry-run` 回 `Remote database is up to date`                          |
| LINE env key完整性            | PASS    | Staging Vercel已包含LINE Login、Messaging、LIFF、bind token與processor所需keys；未輸出值 |
| `/line/order-gate` routing    | PASS    | Staging path帶invalid token仍HTTP 200且未被domain routing搶先redirect                    |
| LIFF URL可開啟                | PARTIAL | `https://liff.line.me/{LIFF_ID}` HTTP 200；尚未完成真人LINE App login / bind             |
| Messaging channel token       | PASS    | LINE `/v2/bot/info` HTTP 200並回bot identity欄位                                         |
| Production webhook設定        | PASS    | LINE API回 `active=true`，endpoint為 `admin.surfboards-reborn.com/api/webhooks/line`     |
| Staging signed webhook        | PASS    | 合法follow/unfollow回200；DB分別更新friend與blocked狀態                                  |
| Invalid webhook signature     | PASS    | Staging endpoint回 `401 LINE_WEBHOOK_SIGNATURE_INVALID`                                  |
| Unknown webhook user          | PASS    | 合法簽章事件回200且安全忽略                                                              |
| Processor auth                | PASS    | 無Bearer回401；正確Bearer回200                                                           |
| Supabase Vault / Cron staging | PASS    | Vault保存endpoint與processor secret；Cron每分鐘active，run succeeded，`pg_net` HTTP 200  |
| Processor skipped語意         | PASS    | blocked fixture進入`skipped / line_not_notifyable`，`notified_at`保持null                |
| Processor failed語意          | PASS    | fake recipient收到LINE 4xx後job failed，`notified_at`保持null                            |
| Smoke fixtures cleanup        | PASS    | Customer、work order、binding與line jobs fixture均已刪除                                 |

Stable staging alias使用Vercel project的Production target，該target已補齊並實測。Preview target仍缺`LINE_BIND_TOKEN_SECRET`與`NUXT_PUBLIC_LINE_OFFICIAL_URL`；Vercel CLI在非互動agent模式要求明確git branch scope，本輪未強行建立branch-scoped值。需要branch preview時先補齊，不能把stable staging的PASS延伸解讀為所有Preview deployment均可用。

## 人工驗收待辦

以下項目需要真實帳號或手機互動，本輪不得標記為通過：

- [ ] 部署 2026-06-23 LIFF click-time token preservation hotfix 後，重新發卡並確認按「綁定 LINE 接收通知」不再產生 `https://liff.line.me/{LIFF_ID}?t` 空 token URL。
- [ ] 提供或建立可用的 staging admin帳號，完成authenticated browser smoke。
- [ ] 工單詳情顯示LINE狀態卡，驗證loading/error/unbound/bound狀態。
- [ ] 未綁定顧客發卡、複製LIFF URL及解除綁定確認modal。
- [ ] 建單成功時確認`lineNotification` toast。
- [ ] READY更新成功時確認`lineNotification` toast。
- [ ] 在LINE App開啟LIFF，完成login與實際綁定。
- [ ] 在LINE Developers確認LINE Login/LIFF channel與Messaging API channel位於同一Provider。
- [ ] 綁定後確認後台狀態、display name與好友狀態更新。
- [ ] 以真實可通知LINE user執行READY push，確認手機收到訊息、job succeeded及`notified_at`設定。
- [ ] 驗證真實follow/unfollow事件由LINE Platform送達production webhook。

## Production 啟用前 Checklist

### Vercel / LINE

- [x] `board-reborn-staging` stable deployment的Vercel Production target具備所有LINE env key名稱。
- [ ] 正式production deployment具備所有LINE env key名稱與正確值。
- [x] Production webhook URL已設定且Use webhook為active。
- [x] Production status domain允許`/line/order-gate`。
- [ ] 人工比對`NUXT_PUBLIC_LIFF_ID`與LINE Developers LIFF app ID。
- [ ] 人工確認LIFF endpoint URL指向production status domain。
- [ ] 人工確認LINE Login與Messaging API channel同Provider且已連結官方帳號。

### Supabase / Processor

- [x] Staging Vault / Cron每分鐘呼叫已驗證。
- [x] Staging processor Bearer auth已驗證。
- [x] Staging Cron HTTP 200與run succeeded已驗證。
- [ ] Production Vault建立processor URL與secret。
- [ ] Production Cron建立前再次manual invoke processor。
- [ ] Production Cron啟用後觀察至少三個週期的run details與HTTP response。

2026-06-22只讀查詢確認production project未安裝`pg_cron`/`pg_net`，因此production Cron確實尚未啟用。

### End-to-End

- [ ] Authenticated admin UI smoke全部通過。
- [ ] 真實LIFF綁定流程通過。
- [ ] 真實follow/unfollow webhook通過。
- [ ] 真實READY push送達、job succeeded及`notified_at`通過。
- [ ] 確認failed / skipped不寫`notified_at`。

## Release Gate

Production Cron保持未啟用。只有人工驗收待辦與production checklist全部完成後，才能將LINE MVP狀態改為正式上線完成。

## 2026-06-23 LIFF Click Flow Hotfix

Production 真人測試確認初始 `liff.state` token extraction 與 resolve 成功，但按下綁定後 URL 變成 `https://liff.line.me/{LIFF_ID}?t`，表示 click/login redirect 階段 token value 遺失且 confirm API 未完成。

本次 repo hotfix 僅處理 release verification 期間的 LIFF click flow：

- 2026-06-24 production 真人測試確認 `https://liff.line.me/{LIFF_ID}/?t={token}&debug=1` 會在 LINE iOS 入口被改寫成 `https://liff.line.me/{LIFF_ID}?t`，尚未進入可用 debug block 前就遺失 token與debug。LIFF bind URL 已改為 `https://liff.line.me/{LIFF_ID}/t/{token}`，不再使用 root query 承載 token。
- `/line/order-gate` token extraction 支援 `liff.state` 內的 `/t/{token}` additional path；若 LINE SDK secondary redirect 到 `/line/order-gate/t/{token}`，新增前端 canonical route 會以非空 token 轉回 `/line/order-gate?t={token}`。
- click handler 改用已 resolve 成功的 `resolvedToken`，不在按鈕點擊時重新從 URL/query 讀 token。
- `resolvedToken` 缺失時直接顯示 invalid，不呼叫 `liff.login()`。
- `liff.login({ redirectUri })` 只在 `liff.isLoggedIn() === false` 時呼叫，且 redirectUri 使用 status origin 的 absolute `/line/order-gate?t={token}`。
- `liff.isLoggedIn() === true` 時直接呼叫 `liff.getIDToken()` 並進入 confirm API。
- `?debug=1` 會保留到 login redirectUri，debug block 新增 click token、LIFF step、login redirectUri拆解、hash token存在性與 confirm API結果。
- debug URL 會遮罩 `t`、`access_token`、`id_token`、`context_token`、`feature_token`、`mst_challenge`，不顯示完整 token或 LINE credentials。
- 若 current URL hash 已有 LIFF `access_token` / `id_token`，但 `liff.isLoggedIn()` 仍回 `false`，不再再次呼叫 `liff.login()`；頁面回報 `LIFF_LOGGED_IN_MISMATCH`，避免導向 `https://liff.line.me/{LIFF_ID}?t` 空 token URL。
- click-time debug snapshot 會以 masked / boolean / length / step 寫入 `sessionStorage`，讓下一次回到 `?debug=1` 的 order-gate 時可看到最後一次 click flow 狀態；不保存完整 token、id token、access token、LINE user id或 raw profile。
- `debug=1&dryRun=1` 可在 production 只計算 click-time token、endpoint redirectUri與下一步行為，不呼叫 `liff.login()`、不呼叫 confirm API、不導頁。
- Debug block 顯示條件包含 URL / `liff.state` / `liff_state` / current URL fallback 的 `debug=1`，或 `sessionStorage` 已存在上一輪 line order-gate debug event；後者可用來觀察點擊後立刻跳頁前最後寫入的 masked debug snapshot。
- Production dry-run 進一步定位到 click handler token與 endpoint redirectUri皆正確，最後停在 `before_liff_init`。正式流程維持先走 `liff.init()` / `liff.getIDToken()`，並只在 `debug=1` 且 SDK 回報 `LIFF_ID_TOKEN_MISSING` 或 `LIFF_LOGGED_IN_MISMATCH` 時，才使用 URL hash 內既有 LIFF `id_token` 作為 fallback 送 confirm API，由 server 端照既有規格驗證 ID token。
- hash token fallback 只在 debug 診斷分支使用，且只在函式區域 / transient memory 讀取 `id_token` / `access_token`，不寫入 debug block、localStorage或sessionStorage，不解析 profile或LINE user id。
- Follow-up debug 顯示 click handler token與 computed redirectUri正確，但頁面仍可能回到 `/line/order-gate?t`。Repo search 確認 order-gate頁面沒有 `navigateTo` / `router.push` / `router.replace` 導向空 token URL；本次改為單一 `buildOrderGateUrl()` 產生 `/line/order-gate?t={token}&debug=1`，computed redirectUri與實際傳入 `liff.login({ redirectUri })` 的 URL 走同一 helper，並在 debug block 增加 `actualLoginRedirectUriMasked`、`redirectReason`、`beforeNavigateTo`、`navigateToTargetMasked` 以區分 app 顯式導頁與 LIFF SDK / browser URL rewrite。
- DOM-level follow-up search確認 pending綁定按鈕未包在 `NuxtLink` / `RouterLink` / `<a>` / `<form>` 中，且頁面沒有 `window.location.assign/replace/href` 導向空 token URL。綁定按鈕已加 `@click.prevent.stop`，`handleBindClick(event)` 會在任何 LIFF/API 操作前記錄 `bindButtonTag`、`bindButtonHref`、`bindButtonClosestAnchorHref`、`bindButtonFormAction`、`bindButtonFormMethod`、`clickEventDefaultPreventedBefore/After`、`beforeLocationAssign`、`locationAssignTargetMasked`，用來確認是否仍有原生 DOM 導頁或外層 link/form 介入。
- 最新 production debug 顯示按鈕不是 link/form，且 click handler 在 `before_liff_init` 後才發生 `/line/order-gate?t`。本次修正改為在 mounted 階段偵測 LIFF primary redirect：若同時存在 `liff.state` 與 URL hash 內的 `access_token` / `id_token`，頁面先顯示「正在初始化 LINE...」並呼叫 `liff.init()`，不先呼叫 resolve API，也不顯示 pending 綁定按鈕。
- 如果 `liff.init()` 沒有讓 SDK 自動完成 secondary redirect，但原本 `liff.state` 仍可解析出 token，頁面只透過 `buildOrderGateUrl(token, debug)` 做一次 canonical secondary redirect 到 `/line/order-gate?t={token}&debug=1`；`buildOrderGateUrl()` 仍拒絕空 token，因此不應再產生 `/line/order-gate?t`。
- Debug block 新增 `isLiffPrimaryRedirect`、`hasLiffState`、`hasHashAccessToken`、`hasHashIdToken`、`mountedAction`、`mountedLiffInitStarted`、`mountedLiffInitFinished`、`mountedSecondaryRedirectExpected`、`mountedManualSecondaryRedirectTargetMasked`、`mountedManualSecondaryRedirectReason`、`resolvedPhase` 與 `skippedResolveBecausePrimaryRedirect`，用來區分 primary 初始化、manual secondary redirect 與一般 secondary resolve。
- 2026-06-24 新 `/t/{token}` URL 真人測試已成功進入 order-gate，token resolve為 pending，點擊後也已進入 confirm API；失敗點改為 `LINE_ACCESS_TOKEN_INVALID`。因 access token是 optional enrichment，已改為 best-effort：ID token驗證成功即可綁定，access token / profile / friendship查詢失敗時降級為通知狀態 `unknown`，不阻斷 confirm。

驗證狀態：repo tests/build 已通過；仍需部署到 production 後，以新發卡 token 重新跑真人 LIFF 綁定。預期新發卡 LIFF URL 會長成 `https://liff.line.me/{LIFF_ID}/t/{token}`；第一次 LINE App landing 會先顯示 primary 初始化 debug或經由 `/line/order-gate/t/{token}` canonical route，之後才進入 `/line/order-gate?t={token}` 的 secondary resolve / pending 畫面。
