#!/usr/bin/env bash
# TPV0099 任务级 vitest formatter —— 与 agate 内置 `assets/formatters/vitest.sh` **判定语义完全等价**，
# 唯一差异 = 大输出（本仓前端全量约 1.5 MB）的传递方式。
#
# 为什么需要它（P3 实测的 gate 基础设施缺陷，**与本任务测试代码无关**）：
#   内置 vitest.sh 第 6-8 行做 `OUTPUT="$(cat)"` 后 `export OUTPUT`，把整份测试输出
#   作为**环境变量**交给 python3。本仓 `make test-frontend` 的输出约 1.5 MB
#   （主体是既有 spec 的 Vue warn / VTUROOT 组件树噪声，非本任务引入），
#   超过 execve 单参数/环境上限（MAX_ARG_STRLEN = 131072）→
#   `bash: /usr/bin/python3: 参数列表过长`（formatter exit 126）
#   → agate_common.run_test_with_formatter 回退 _fallback_json(raw_output=全量输出)
#   → judge_result 命中 `exit_code == 2 and raw_output 含 "matching"` 分支
#   （"matching" 来自既有 spec 的 `No diagram type detected matching given configuration`）
#   → **误判为 A 类错误 exit 1**。实测：**剔除本任务新 spec 后基线的 1,509,387 字节输出
#   触发完全相同的误判** ⇒ 预存缺陷，非 TPV0099 引入。
#   修法：把输出经**临时文件**交 python3 读取，绕开参数/环境长度限制。
#   本文件经 agate_common.resolve_formatter 的 `$task_dir/.agate/formatters/` 优先级生效。
set -euo pipefail

EXIT_CODE="${1:-1}"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
cat > "$TMP"
export EXIT_CODE

python3 - "$TMP" <<'PYEOF'
import sys, json, re, os

exit_code = int(os.environ.get("EXIT_CODE", "1"))
with open(sys.argv[1], "r", encoding="utf-8", errors="replace") as fh:
    output = fh.read()

def extract_count(pattern):
    m = re.search(pattern, output)
    return int(m.group(1)) if m else 0

failed = extract_count(r"Tests\s+(\d+)\s+failed")
passed = extract_count(r"Tests\s+(\d+)\s+passed")
errors = extract_count(r"Failed Suites\s+(\d+)")
total = passed + failed + errors

failed_tests = re.findall(r"^FAIL\s+(\S+)", output, re.MULTILINE)

import_errors = []
for m in re.finditer(r"Cannot find (?:module|package) ['\"]([^'\"]+)", output):
    import_errors.append({"module": m.group(1), "message": m.group(0)})

syntax_errors = []
for m in re.finditer(r".*(?:SyntaxError|ParseError|Unexpected token).*", output):
    line = m.group(0).strip()
    file_match = re.search(r"(\S+\.(?:js|ts|jsx|tsx|mjs|cjs))", line)
    file = file_match.group(1) if file_match else ""
    syntax_errors.append({"file": file, "message": line})

result = {
    "exit_code": exit_code,
    "total": total,
    "passed": passed,
    "failed": failed,
    "errors": errors,
    "failed_tests": failed_tests,
    "import_errors": import_errors,
    "syntax_errors": syntax_errors
}

print(json.dumps(result, separators=(",", ":")))
PYEOF
