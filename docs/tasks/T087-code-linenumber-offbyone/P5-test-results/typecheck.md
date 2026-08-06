# P5 typecheck results — T087 代码块行号 off-by-one

## 命令

```
cd frontend-v3 && ./node_modules/.bin/vue-tsc --noEmit
```

## 结果

- **exit code**: 0
- **errors**: 0
- **output**: （无输出，exit 0）

## 说明

vue-tsc --noEmit 全量类型检查通过，无错误。CI 强制门禁满足。

T087 改动文件 `frontend-v3/src/composables/useShiki.ts` 仅新增 `const trimmedCode = code.replace(/\n$/, '')` 两处（highlight / highlightCode），类型推导为 `string`，无类型变更，无新依赖。

[PROD_NOT_TOUCHED]
