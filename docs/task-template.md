# AI Task Template

複製以下模板給 AI agent。每個任務都應盡量填完整，避免 scope drift。

```markdown
# 任務名稱

## 目標

用 1-3 句說明這次要完成什麼。

## 背景

- 相關產品脈絡：
- 相關使用者：
- 目前已知現況：

## 限制

- 技術限制：
- Domain 限制：
- Security / RLS 限制：
- UI / UX 限制：

## 驗收條件

- [ ] 條件 1
- [ ] 條件 2
- [ ] 條件 3

## 不可修改範圍

- 不可修改：
- 不可重命名：
- 不可碰的檔案或資料表：

## 相關檔案

- `docs/product.md`
- `docs/domain-model.md`
- `docs/api-contract.md`
- `docs/ai-dev-rules.md`

## 測試要求

- 必跑測試：
- 需要新增的測試：
- 可接受不跑的測試與原因：

## Migration 要求

- 是否需要 migration：
- migration 應包含：
- seed 是否需要更新：

## API Contract 要求

- 是否需要更新 `docs/api-contract.md`：
- 新增或修改的 endpoint：
- request / response 範例：

## 完成回報格式

- 變更摘要：
- 測試摘要：
- Migration 摘要：
- API contract 摘要：
- 風險與待確認事項：
```
