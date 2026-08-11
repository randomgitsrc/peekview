# TPV0089 P5 后端 pytest 结果

## 命令

`make test-quick`（backend pytest，`-n auto` xdist，建议项：确认无跨端回归）

## 结果

- **1061 passed / 4 failed / 3 skipped / 3 errors**
- 失败全部集中在 `tests/test_cli_remote.py`（TestCLIRemoteList/Get/Delete）

## 失败根因（与 TPV0089 无关）

- TPV0089 为 frontend-only 任务（P4 commit `b144ea3d` 仅改 `frontend-v3/src/utils/path-map.ts` + 任务文档），后端零改动。
- `test_cli_remote.py` 在 `-n auto`（本机 16 核 → 16 workers）下：模块级 fixture 启动的子进程 server 因资源竞争/端口抢占未能按时就绪，CLI 连不上 `127.0.0.1:18888` 报 Connection refused。
- 验证：
  - 单独运行该文件（无 xdist）：**17/17 全绿**
  - `-n 2`：**全绿**
  - `-n auto`：复现失败 → 确认为 xdist worker 数相关的预存环境性失败
- 与本次改动无关，登记为预存失败（见 known-failures.md）。

## 预存失败清单

- `tests/test_cli_remote.py::TestCLIRemoteList::test_list_entries`
- `tests/test_cli_remote.py::TestCLIRemoteList::test_list_with_query`
- `tests/test_cli_remote.py::TestCLIRemoteList::test_list_with_tag_filter`
- `tests/test_cli_remote.py::TestCLIRemoteList::test_list_json_output`
- `tests/test_cli_remote.py::TestCLIRemoteGet::test_get_entry`（ERROR）
- `tests/test_cli_remote.py::TestCLIRemoteGet::test_get_entry_json`（ERROR）
- `tests/test_cli_remote.py::TestCLIRemoteDelete::test_delete_entry`（ERROR）

EXIT_CODE: 1
