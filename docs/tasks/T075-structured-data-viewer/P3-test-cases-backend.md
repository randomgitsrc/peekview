---
phase: P3
task_id: T075-structured-data-viewer
type: test-cases
parent: P2-design.md
trace_id: T075-P3-20260801
status: draft
created: 2026-08-01
agent: test-designer
---

# T075 P3 后端测试用例清单（BDD-01~06 + 相关）

> 本文件是 `P3-test-cases.md`（frontend test-designer 产出，含全部 53 BDD 总表）的后端补充子集，覆盖后端 `backend/tests/test_language.py` 的 BDD-01~06 及 BDD-02 相关的 PLAIN_TEXT_LANGS 断言。
> 前端部分（BDD-07~53）由 frontend test-designer 负责，不在此文件。

## 目标

为 T075 后端子任务（`language.py` `.tsv` 映射修正）设计 TDD 测试用例，1:1 映射 P1 的 BDD-01~06 验收条件，并更新 `PLAIN_TEXT_LANGS` 相关断言（14→15 + 新增 tsv 成员检查）。

## 改动范围

- `backend/tests/test_language.py`（唯一改动文件）
- 不改动 `backend/peekview/language.py`（实现归 P4）

## BDD → 测试映射表

| BDD | 测试函数 | 断言 | 当前实现 | 红/绿 | 红灯原因 |
|-----|---------|------|---------|-------|---------|
| BDD-01 | `test_bdd_01_csv_returns_csv` | `detect_language("data.csv") == "csv"` | `.csv → 'csv'`（正确） | 🟢 绿 | 回归保护 |
| BDD-02 | `test_bdd_02_tsv_returns_tsv` | `detect_language("data.tsv") == "tsv"` | `.tsv → 'csv'`（bug） | 🔴 红 | 断言 `'tsv'` 收到 `'csv'` |
| BDD-03 | `test_bdd_03_json_returns_json` | `detect_language("data.json") == "json"` | `.json → 'json'`（正确） | 🟢 绿 | 回归保护 |
| BDD-04 | `test_bdd_04_yaml_returns_yaml` | `detect_language("data.yaml") == "yaml"` | `.yaml → 'yaml'`（正确） | 🟢 绿 | 回归保护 |
| BDD-05 | `test_bdd_05_yml_returns_yaml` | `detect_language("data.yml") == "yaml"` | `.yml → 'yaml'`（正确） | 🟢 绿 | 回归保护 |
| BDD-06 | `test_bdd_06_xml_returns_xml` | `detect_language("data.xml") == "xml"` | `.xml → 'xml'`（正确） | 🟢 绿 | 回归保护 |
| BDD-02 相关 | `test_plain_text_langs_count`（更新） | `len(PLAIN_TEXT_LANGS) == 15` | 当前 14 | 🔴 红 | 断言 15 收到 14 |
| BDD-02 相关 | `test_contains_tsv`（新增） | `"tsv" in PLAIN_TEXT_LANGS` | 集合无 tsv | 🔴 红 | `"tsv" not in set` |

## 设计说明

- **命名**：测试函数名引用 BDD 编号（`test_bdd_02_tsv_returns_tsv`），与 P1 `#### BDD-NN` 1:1 对应，便于 P6 逐条验收追溯
- **放置**：BDD-01~06 加入 `TestDetectLanguage` 类（沿用现有 `test_xxx_file` 方法风格）；`test_contains_tsv` 加入 `TestPlainTextLanguages` 类（紧随 `test_contains_csv` 后）；`test_plain_text_langs_count` 更新断言 14→15 并修正 docstring
- **回归保护**：BDD-01/03/04/05/06 当前实现已正确，测试为绿——防止 P4 改动 `.tsv` 行时误伤相邻映射
- **TDD 时序**：本阶段（P3）整体 pytest 必须红灯，证明实现未写。当前 3 个失败（`test_bdd_02_tsv_returns_tsv` / `test_contains_tsv` / `test_plain_text_langs_count`）均为 assertion 失败（B 类），非测试代码自身错误

## 测试代码位置

- 修改文件：`backend/tests/test_language.py`（BDD-01~06 六个方法 + `test_contains_tsv` + `test_plain_text_langs_count` 更新）
- 测试代码即测试文件本身（项目约定：pytest 测试与源码同库，无独立 test_code_dir）

## 验证命令（gate_commands.P3_backend）

```bash
cd backend && .venv/bin/python -m pytest tests/test_language.py -q --tb=no
```

### 当前实测结果（2026-08-01，实现未改）

```
3 failed, 60 passed in 1.02s
FAILED tests/test_language.py::TestDetectLanguage::test_bdd_02_tsv_returns_tsv
FAILED tests/test_language.py::TestPlainTextLanguages::test_contains_tsv
FAILED tests/test_language.py::TestPlainTextLanguages::test_plain_text_langs_count
```

红灯确认：3 个失败用例指向 P4 需实现的 `.tsv → 'tsv'` 映射 + `PLAIN_TEXT_LANGS` 加 `"tsv"`。

## P4 实现目标（供 implementer 参考，不属于本阶段改动）

```python
# language.py:69
".tsv": "tsv",          # 原 ".tsv": "csv"

# language.py:255-270 PLAIN_TEXT_LANGS 新增 "tsv" → len 14 → 15
```
