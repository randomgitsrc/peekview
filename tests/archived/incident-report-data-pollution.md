# 生产环境数据污染事件报告

## 事件摘要

**时间**: 2026-05-08  
**版本**: v0.1.22 发布后  
**影响**: 生产环境被测试数据污染

## 问题描述

v0.1.22 发布后，生产环境（:8080）出现了 17 条测试数据（如 `stdin-workflow-2`、`json-list-2` 等），而调试环境（:8888）保持干净。这表明数据隔离配置工作正常，但测试数据通过其他途径进入了生产环境。

## 根本原因

`tests/e2e/` 目录下的旧 Python E2E 测试脚本（如 `run_tests.py`、`run_p0_*.py` 等）硬编码了 `http://localhost:8080` 作为 BASE_URL。

这些脚本在发布流程的某个时刻被手动或自动运行，直接访问生产环境 API 创建测试条目。

**问题脚本示例** (`tests/e2e/run_tests.py`):
```python
BASE_URL = "http://localhost:8080"  # 硬编码生产环境
API_URL = f"{BASE_URL}/api/v1"

async def create_test_entry():
    # 直接创建到生产环境
    response = await client.post(f"{API_URL}/entries", json=entry_data)
```

## 为什么调试环境隔离正常

- `scripts/dev-server.sh` 已正确配置 `PEEKVIEW_STORAGE__DATA_DIR` 和 `PEEKVIEW_STORAGE__DB_PATH`
- E2E Playwright 测试（`frontend-v3/e2e/`）正确使用了 `http://127.0.0.1:8888`
- `make debug` 流程启动的服务确实使用独立数据库

**问题不在调试流程，而在遗留的 Python E2E 脚本。**

## 修复措施

### 1. 立即修复 (已完成)

```bash
# 归档旧 E2E 测试（防止再次误运行）
mkdir -p tests/archived/
mv tests/e2e tests/archived/

# 清理生产环境测试数据
# 删除 17 条测试条目
```

### 2. 长期措施

- [x] 归档所有 `tests/e2e/*.py` 到 `tests/archived/`
- [ ] 更新发布流程检查清单，明确禁用旧测试
- [ ] 检查 CI/CD 配置，确保不会运行这些脚本
- [ ] 添加测试数据命名规范（PEEKVIEW_TEST_DATA_PREFIX）

## 教训总结

### 1. 遗留代码的风险

旧的测试脚本如果没有明确标记为废弃，可能在某个时刻被重新运行。应该：
- 明确归档到 `archived/` 或 `docs/archived/`
- 在脚本开头添加警告注释
- 删除不再使用的代码

### 2. 硬编码 URL 的危险

所有测试脚本应该使用可配置的 BASE_URL：
```python
# 正确
BASE_URL = os.environ.get("PEEKVIEW_TEST_URL", "http://127.0.0.1:8888")

# 错误
BASE_URL = "http://localhost:8080"  # 永远不要硬编码生产环境
```

### 3. 测试数据清理策略

即使测试数据会过期，也应该：
- 使用可识别的命名（如 `test-xxx`、`e2e-xxx`）
- 定期清理生产环境（`peekview list | grep test`）
- 监控生产环境数据量异常增长

### 4. 发布流程检查清单

在发布前应该检查：
```bash
# 检查生产环境是否有测试数据
curl -s http://127.0.0.1:8080/api/v1/entries | jq '.total'
# 如果数量异常，暂停发布并调查
```

## 相关文档

- [数据隔离验证](../../docs/process/debug-workflow.md#步骤-25-数据隔离验证)
- [文档同步指南](../../docs/process/doc-sync-guide.md)
- [调试流程](../../docs/process/debug-workflow.md)

## 状态

- ✅ 生产环境已清理
- ✅ 问题脚本已归档
- ✅ 文档已更新
- ⬜ CI/CD 检查待添加

---

**报告时间**: 2026-05-08  
**报告人**: Claude Code  
**状态**: 已修复，持续监控中
