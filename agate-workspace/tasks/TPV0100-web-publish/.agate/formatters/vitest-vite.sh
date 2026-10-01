#!/usr/bin/env bash
# TPV0100 任务级 vitest formatter —— 与 agate 内置 `assets/formatters/vitest.sh` 判定语义等价，
# 差异有二（均为 gate 基础设施层，与本任务测试代码无关）：
#   1) 大输出传递：本仓 `make test-frontend` 全量输出约 1.5 MB（既有 spec 的 Vue warn 噪声），
#      经**临时文件**交给 python 读取，绕开 execve 参数/环境长度上限（MAX_ARG_STRLEN=131072）；
#      （同 TPV0099 的 vitest.sh，属预存缺陷规避，非本任务引入）
#   2) import-error 识别面：内置版只匹配 `Cannot find (module|package) '<name>'`（CommonJS 风格），
#      **不识别 Vite 解析器的 `Failed to resolve import "<spec>" from "<file>"`**——后者正是
#      「测试 import 尚未实现的项目模块」这一正常 TDD 红态的报错形态，会被内置版误判为 A 类错误。
#      本版额外匹配该形态，并把 `@/` alias 归一化为 `src/`（见 frontend-v3/vite.config.ts resolve.alias），
#      使 project_module 前缀（"src/"）命中 → 正确判为 B 类红灯。
# 本文件经 agate_common.resolve_formatter 的 `$task_dir/.agate/formatters/` 优先级生效。
set -euo pipefail

EXIT_CODE="${1:-1}"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
cat > "$TMP"
export EXIT_CODE

env python3 - "$TMP" <<'PYEOF'
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
seen = set()
patterns = [
    r"Cannot find (?:module|package) ['\"]([^'\"]+)",
    r"Failed to resolve import ['\"]([^'\"]+)['\"] from",
]
for pat in patterns:
    for m in re.finditer(pat, output):
        module = m.group(1)
        message = m.group(0)
        candidates = [module]
        if module.startswith("@/"):
            candidates.append("src/" + module[2:])
        for name in candidates:
            if name in seen:
                continue
            seen.add(name)
            import_errors.append({"module": name, "message": message})

syntax_errors = []
for raw in output.split("\n"):
    if not ("SyntaxError" in raw or "ParseError" in raw or "Unexpected token" in raw):
        continue
    line = raw.strip()
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
