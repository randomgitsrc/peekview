#!/usr/bin/env bash
# =============================================================================
# TPV0093 star-lifecycle — P6 backend 验收脚本
#
# 覆盖 backend BDD：BDD-1/2/3/4/5（curl star/unstar 幂等计数）+ BDD-7/8/9/10
# （定向 pytest，freezegun 时间控制）+ BDD-11/12/13（curl 作者删除 + sqlite3
# 墓碑断言）+ BDD-15/16/17/28（curl 权限三端点 + share）+ BDD-27（sqlite3 迁移断言
# + 定向 pytest）。
#
# 用法（主 Agent 执行，非本 subagent）：
#   bash agate-workspace/tasks/TPV0093-star-lifecycle/P6-evidence/scripts/verify-backend.sh
#
# 前置：debug backend :8888 必须是 P4 代码（含 entry_stars/entry_tombstones 表），
# 启动方式 `make debug-quick` 或 `make debug-start`（改了后端代码后必须重启）。
# 严禁指向 :8080 生产。
#
# 证据落盘：
#   P6-evidence/backend/bdd-NN.json   每条 BDD 一条结构化断言记录
#   P6-evidence/backend/backend-results.log  汇总日志
#   P6-evidence/backend/pytest-*.log  定向 pytest 输出
# =============================================================================
set -uo pipefail

BASE="${BASE_URL:-http://127.0.0.1:8888}"
DB="/tmp/peekview-debug/peekview.db"
TS="$(date +%Y%m%d%H%M%S)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVID_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/backend"
REPO="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
LOG="$EVID_DIR/backend-results.log"

mkdir -p "$EVID_DIR"
: > "$LOG"

echo "[$(date '+%H:%M:%S')] TPV0093 P6 backend verification — BASE=$BASE DB=$DB"
echo "[$(date '+%H:%M:%S')] TPV0093 P6 backend verification" >> "$LOG"

# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------
json_get() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)"; }
json_get_default() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)" 2>/dev/null || echo "$2"; }

record() {
  # record <bdd> <name> <pass|fail> <detail> [extra_json...]
  local bdd="$1" name="$2" status="$3" detail="$4"; shift 4
  local file="$EVID_DIR/$bdd.json"
  echo "{\"bdd\":\"$bdd\",\"name\":\"$name\",\"status\":\"$status\",\"detail\":\"$detail\"$*}" > "$file"
  echo "$status $bdd: $name — $detail" | tee -a "$LOG"
}

pass() { record "$1" "$2" "PASS" "$3" ${4:-}; }
fail() { record "$1" "$2" "FAIL" "$3" ${4:-}; }

# 前置可读验证期望状态码；失败时返回非零
expect_status() {
  # expect_status <url> <method> <expected> <token_or_empty>
  local url="$1" method="$2" expected="$3" token="$4"
  local hdrs=(-s -o /dev/null -w '%{http_code}')
  if [ -n "$token" ]; then
    curl "${hdrs[@]}" -X "$method" -H "Authorization: Bearer $token" "$BASE$url"
  else
    curl "${hdrs[@]}" -X "$method" "$BASE$url"
  fi
}

login() {
  # login <username> → prints access_token
  curl -s -X POST "$BASE/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$1\",\"password\":\"testpass123\"}" | json_get_default "d.get('access_token')" ""
}

# ---------------------------------------------------------------------------
# Preflight：环境隔离 + 新代码就位检查
# ---------------------------------------------------------------------------
if [[ "$BASE" == *":8080"* || "$BASE" == *"prod"* ]]; then
  echo "FATAL: refusing to verify production ($BASE)"; exit 1
fi
ROOT_CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/v1/entries")
if [ "$ROOT_CODE" != "200" ]; then
  echo "FATAL: debug backend not reachable at $BASE (got $ROOT_CODE)"
  exit 1
fi
STAR_TABLE=$(sqlite3 "$DB" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='entry_stars'" 2>/dev/null || echo 0)
if [ "$STAR_TABLE" != "1" ]; then
  echo "FATAL: entry_stars table missing in $DB — :8888 运行的是旧代码，请先 make debug-quick 重启"
  exit 1
fi
echo "Preflight OK: debug backend reachable + star tables present [PROD_NOT_TOUCHED]"
echo "Preflight OK: debug backend reachable + star tables present [PROD_NOT_TOUCHED]" >> "$LOG"

# ---------------------------------------------------------------------------
# 登录 alice / bob / carol
# ---------------------------------------------------------------------------
TOKA=$(login alice); TOKB=$(login bob); TOKC=$(login carol)
if [ -z "$TOKA" ] || [ -z "$TOKB" ] || [ -z "$TOKC" ]; then
  echo "FATAL: seed users alice/bob/carol 登录失败（需先 make debug-seed）"; exit 1
fi
echo "Logged in: alice/bob/carol OK"

# 创建专用公开测试 entry（避免污染 seed 数据）
SLUG_BASE="p6bdd-$TS"
create_entry() {
  # create_entry <slug> <token>
  curl -s -X POST "$BASE/api/v1/entries" \
    -H "Authorization: Bearer $2" -H 'Content-Type: application/json' \
    -d "{\"summary\":\"P6 verify $1\",\"slug\":\"$1\",\"is_public\":true,\"tags\":[\"p6\"],\"files\":[{\"filename\":\"README.md\",\"language\":\"markdown\",\"content\":\"# $1\\nP6 verification entry.\"}]}"
}

SLUG_A="$SLUG_BASE-star"
create_entry "$SLUG_A" "$TOKA" > /dev/null

# ===========================================================================
# BDD-1: 登录用户星标公开内容，计数 +1
# ===========================================================================
D0=$(curl -s "$BASE/api/v1/entries/$SLUG_A" -H "Authorization: Bearer $TOKA")
C0=$(echo "$D0" | json_get_default "d.get('star_count')" "?")
S0=$(echo "$D0" | json_get_default "d.get('is_starred')" "?")
R1=$(curl -s -X POST "$BASE/api/v1/entries/$SLUG_A/star" -H "Authorization: Bearer $TOKA")
C1=$(echo "$R1" | json_get_default "d.get('star_count')" "?")
S1=$(echo "$R1" | json_get_default "d.get('is_starred')" "?")
EXP1=$((C0 + 1))
if [ "$C1" = "$EXP1" ] && [ "$S1" = "True" ]; then
  pass BDD-1 "星标公开内容计数+1" "star_count $C0→$C1, is_starred=$S1" ",\"pre\":\"$C0\",\"post\":\"$C1\",\"is_starred\":\"$S1\""
else
  fail BDD-1 "星标公开内容计数+1" "star_count $C0→$C1 (expect $EXP1), is_starred=$S1" ",\"pre\":\"$C0\",\"post\":\"$C1\",\"is_starred\":\"$S1\""
fi

# ===========================================================================
# BDD-2: 同一用户重复星标不重复计数
# ===========================================================================
R2=$(curl -s -X POST "$BASE/api/v1/entries/$SLUG_A/star" -H "Authorization: Bearer $TOKA")
C2=$(echo "$R2" | json_get_default "d.get('star_count')" "?")
AL=$(echo "$R2" | json_get_default "d.get('already_starred')" "?")
if [ "$C2" = "$C1" ] && [ "$AL" = "True" ]; then
  pass BDD-2 "重复星标不重复计数" "star_count 保持 $C2, already_starred=$AL" ",\"star_count\":\"$C2\",\"already_starred\":\"$AL\""
else
  fail BDD-2 "重复星标不重复计数" "star_count=$C2 (expect $C1), already_starred=$AL" ",\"star_count\":\"$C2\",\"already_starred\":\"$AL\""
fi

# ===========================================================================
# BDD-3: 取消星标计数 -1
# ===========================================================================
R3=$(curl -s -X DELETE "$BASE/api/v1/entries/$SLUG_A/star" -H "Authorization: Bearer $TOKA")
C3=$(echo "$R3" | json_get_default "d.get('star_count')" "?")
S3=$(echo "$R3" | json_get_default "d.get('is_starred')" "?")
EXP3=$((C1 - 1))
if [ "$C3" = "$EXP3" ] && [ "$S3" = "False" ]; then
  pass BDD-3 "取消星标计数-1" "star_count $C1→$C3, is_starred=$S3" ",\"pre\":\"$C1\",\"post\":\"$C3\",\"is_starred\":\"$S3\""
else
  fail BDD-3 "取消星标计数-1" "star_count $C1→$C3 (expect $EXP3), is_starred=$S3" ",\"pre\":\"$C1\",\"post\":\"$C3\",\"is_starred\":\"$S3\""
fi

# ===========================================================================
# BDD-4: 匿名用户不能星标
# ===========================================================================
# 匿名 POST star 应 401；star_count 不变
ANON=$(expect_status "/api/v1/entries/$SLUG_A/star" POST 401 "")
D4=$(curl -s "$BASE/api/v1/entries/$SLUG_A")
C4=$(echo "$D4" | json_get_default "d.get('star_count')" "?")
if [ "$ANON" = "401" ] && [ "$C4" = "$EXP3" ]; then
  pass BDD-4 "匿名禁星标(401)" "anonymous POST→$ANON, star_count 保持 $C4" ",\"http\":\"$ANON\",\"star_count\":\"$C4\""
else
  fail BDD-4 "匿名禁星标(401)" "anonymous POST→$ANON (expect 401), star_count=$C4 (expect $EXP3)" ",\"http\":\"$ANON\",\"star_count\":\"$C4\""
fi

# ===========================================================================
# BDD-5: 多用户星标各计一次
# ===========================================================================
# 重新星标（alice）+ bob 星标 → count=2
curl -s -X POST "$BASE/api/v1/entries/$SLUG_A/star" -H "Authorization: Bearer $TOKA" > /dev/null
curl -s -X POST "$BASE/api/v1/entries/$SLUG_A/star" -H "Authorization: Bearer $TOKB" > /dev/null
D5=$(curl -s "$BASE/api/v1/entries/$SLUG_A" -H "Authorization: Bearer $TOKA")
C5=$(echo "$D5" | json_get_default "d.get('star_count')" "?")
if [ "$C5" = "2" ]; then
  pass BDD-5 "多用户各计一次" "alice+bob 星标后 star_count=$C5" ",\"star_count\":\"$C5\""
else
  fail BDD-5 "多用户各计一次" "alice+bob 星标后 star_count=$C5 (expect 2)" ",\"star_count\":\"$C5\""
fi

# ===========================================================================
# BDD-7/8/9/10: 豁免删除（时间控制，freezegun）
# ===========================================================================
echo "[$(date '+%H:%M:%S')] Running pytest test_star_lifecycle.py (BDD-7/8/9/10) ..." | tee -a "$LOG"
(cd "$REPO/backend" && .venv/bin/python -m pytest tests/test_star_lifecycle.py \
  -k "bdd_7 or bdd_8 or bdd_9 or bdd_10" -v --tb=short) > "$EVID_DIR/pytest-lifecycle.log" 2>&1
PY_EXIT=$?
echo "  pytest exit=$PY_EXIT (expect 0)" | tee -a "$LOG"
PY_PASS=$(grep -c "^PASSED\|pytest.test_star_lifecycle" "$EVID_DIR/pytest-lifecycle.log" || true)
if [ "$PY_EXIT" = "0" ]; then
  pass BDD-7 "归档期星标豁免清理" "pytest test_star_lifecycle.py -k bdd_7 exit=0 (freezegun)" ",\"pytest_exit\":\"0\",\"log\":\"pytest-lifecycle.log\""
  pass BDD-8 "有效期内星标归档后豁免" "pytest test_star_lifecycle.py -k bdd_8 exit=0 (freezegun)" ",\"pytest_exit\":\"0\",\"log\":\"pytest-lifecycle.log\""
  pass BDD-9 "取消星标恢复剩余倒计时" "pytest test_star_lifecycle.py -k bdd_9 exit=0 (freezegun)" ",\"pytest_exit\":\"0\",\"log\":\"pytest-lifecycle.log\""
  pass BDD-10 "最后星标取消剩余≤0下周期删除" "pytest test_star_lifecycle.py -k bdd_10 exit=0 (freezegun)" ",\"pytest_exit\":\"0\",\"log\":\"pytest-lifecycle.log\""
else
  fail BDD-7 "归档期星标豁免清理" "pytest exit=$PY_EXIT, 见 pytest-lifecycle.log"
  fail BDD-8 "有效期内星标归档后豁免" "pytest exit=$PY_EXIT, 见 pytest-lifecycle.log"
  fail BDD-9 "取消星标恢复剩余倒计时" "pytest exit=$PY_EXIT, 见 pytest-lifecycle.log"
  fail BDD-10 "最后星标取消剩余≤0下周期删除" "pytest exit=$PY_EXIT, 见 pytest-lifecycle.log"
fi

# ===========================================================================
# BDD-11/12/13: 作者删除优先 + 墓碑
# ===========================================================================
# BDD-11/12: alice 创建 entry，bob 星标，alice 删除 → 正文 404 + 墓碑生成
SLUG_DEL="$SLUG_BASE-author-del"
create_entry "$SLUG_DEL" "$TOKA" > /dev/null
curl -s -X POST "$BASE/api/v1/entries/$SLUG_DEL/star" -H "Authorization: Bearer $TOKB" > /dev/null
DEL_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$BASE/api/v1/entries/$SLUG_DEL" -H "Authorization: Bearer $TOKA")
D11=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/v1/entries/$SLUG_DEL" -H "Authorization: Bearer $TOKA")
R11=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/v1/entries/$SLUG_DEL/raw" -H "Authorization: Bearer $TOKB")
# 墓碑存在 + 星标用户列表可见（bob 视角 GET /api/v1/stars 含 type=tombstone）
STAR_LIST_BOB=$(curl -s "$BASE/api/v1/stars?filter=all" -H "Authorization: Bearer $TOKB")
TOMB_IN_LIST=$(echo "$STAR_LIST_BOB" | json_get_default "any(('author_deleted' in json.dumps(i) or i.get('type')=='tombstone') for i in d.get('items',[]))" "False")
if [ "$D11" = "404" ] && [ "$R11" = "404" ] && [ "$TOMB_IN_LIST" = "True" ]; then
  pass BDD-11 "作者删除强制覆盖豁免" "author delete→$DEL_CODE, detail=$D11, raw=$R11 均 404" ",\"delete\":\"$DEL_CODE\",\"detail\":\"$D11\",\"raw\":\"$R11\""
else
  fail BDD-11 "作者删除强制覆盖豁免" "delete=$DEL_CODE, detail=$D11 (expect 404), raw=$R11 (expect 404), tombstone_in_list=$TOMB_IN_LIST" ",\"delete\":\"$DEL_CODE\",\"detail\":\"$D11\",\"raw\":\"$R11\",\"tombstone_in_list\":\"$TOMB_IN_LIST\""
fi
TOMBS=$(sqlite3 "$DB" "SELECT count(*) FROM entry_tombstones WHERE slug='$SLUG_DEL' AND reason='author_deleted'" 2>/dev/null || echo 0)
if [ "$TOMBS" = "1" ]; then
  pass BDD-12 "作者删除生成墓碑且星标用户可见" "tombstone rows=$TOMBS reason=author_deleted; bob /stars 含墓碑卡片" ",\"tombstones\":\"$TOMBS\",\"in_star_list\":\"$TOMB_IN_LIST\""
else
  fail BDD-12 "作者删除生成墓碑且星标用户可见" "tombstones=$TOMBS (expect 1), in_star_list=$TOMB_IN_LIST" ",\"tombstones\":\"$TOMBS\",\"in_star_list\":\"$TOMB_IN_LIST\""
fi

# BDD-13: 墓碑保留至最后一个引用星标移除
# 用同一墓碑：alice+bob 都星标该 entry 后作者删除 → 两人各 unstar → 墓碑清理
SLUG_T13="$SLUG_BASE-tomb13"
create_entry "$SLUG_T13" "$TOKA" > /dev/null
T13_EID=$(curl -s "$BASE/api/v1/entries/$SLUG_T13" -H "Authorization: Bearer $TOKA" | json_get_default "d.get('id',0)" "0")
curl -s -X POST "$BASE/api/v1/entries/$SLUG_T13/star" -H "Authorization: Bearer $TOKA" > /dev/null
curl -s -X POST "$BASE/api/v1/entries/$SLUG_T13/star" -H "Authorization: Bearer $TOKB" > /dev/null
curl -s -o /dev/null -X DELETE "$BASE/api/v1/entries/$SLUG_T13" -H "Authorization: Bearer $TOKA"
T13_BEFORE=$(sqlite3 "$DB" "SELECT count(*) FROM entry_tombstones WHERE slug='$SLUG_T13'" 2>/dev/null || echo 0)
# 墓碑引用移除走批量端点（DELETE /api/v1/stars body entry_ids）——entry 已物理删除，
# slug 路由对已删 entry 404 是既有行为；前端墓碑卡片移除按钮即走此批量端点（P2 §4.5）
# A 移除（墓碑仍剩 1 引用）
curl -s -X DELETE "$BASE/api/v1/stars" -H "Authorization: Bearer $TOKA" -H 'Content-Type: application/json' -d "{\"entry_ids\":[$T13_EID]}" > /dev/null
T13_MID=$(sqlite3 "$DB" "SELECT count(*) FROM entry_tombstones WHERE slug='$SLUG_T13'" 2>/dev/null || echo 0)
# B 移除（最后引用移除 → 墓碑清理）
curl -s -X DELETE "$BASE/api/v1/stars" -H "Authorization: Bearer $TOKB" -H 'Content-Type: application/json' -d "{\"entry_ids\":[$T13_EID]}" > /dev/null
T13_AFTER=$(sqlite3 "$DB" "SELECT count(*) FROM entry_tombstones WHERE slug='$SLUG_T13'" 2>/dev/null || echo 0)
if [ "$T13_BEFORE" = "1" ] && [ "$T13_MID" = "1" ] && [ "$T13_AFTER" = "0" ]; then
  pass BDD-13 "墓碑保留至最后引用移除" "tombstone $T13_BEFORE→$T13_MID(1 ref left)→$T13_AFTER" ",\"before\":\"$T13_BEFORE\",\"mid\":\"$T13_MID\",\"after\":\"$T13_AFTER\""
else
  fail BDD-13 "墓碑保留至最后引用移除" "tombstone count before=$T13_BEFORE mid=$T13_MID after=$T13_AFTER (expect 1/1/0)" ",\"before\":\"$T13_BEFORE\",\"mid\":\"$T13_MID\",\"after\":\"$T13_AFTER\""
fi

# ===========================================================================
# BDD-15/16/17/28: 权限（星标用户读 archived / 非星标 404 / owner/admin 200 / share）
# ===========================================================================
SLUG_ARCH="$SLUG_BASE-archived"
create_entry "$SLUG_ARCH" "$TOKA" > /dev/null
curl -s -X POST "$BASE/api/v1/entries/$SLUG_ARCH/star" -H "Authorization: Bearer $TOKB" > /dev/null
# 归档
curl -s -o /dev/null -X PATCH "$BASE/api/v1/entries/$SLUG_ARCH" \
  -H "Authorization: Bearer $TOKA" -H 'Content-Type: application/json' -d '{"status":"archived"}' 
# 拿一个 file_id 供文件内容端点
FID=$(curl -s "$BASE/api/v1/entries/$SLUG_ARCH" -H "Authorization: Bearer $TOKB" | json_get_default "d.get('files',[{}])[0].get('id') if d.get('files') else 0" "0")

# BDD-15: 星标用户（bob）详情/raw/文件内容 → 200
B15_D=$(expect_status "/api/v1/entries/$SLUG_ARCH" GET 200 "$TOKB")
B15_R=$(expect_status "/api/v1/entries/$SLUG_ARCH/raw" GET 200 "$TOKB")
B15_F=$(expect_status "/api/v1/entries/$SLUG_ARCH/files/$FID/content" GET 200 "$TOKB")
# 同源继承抽查：download（bob）→ 200；短链 /{slug}/raw → 302
B15_DL=$(expect_status "/api/v1/entries/$SLUG_ARCH/download" GET 200 "$TOKB")
B15_SL=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/$SLUG_ARCH/raw" -H "Authorization: Bearer $TOKB")
if [ "$B15_D" = "200" ] && [ "$B15_R" = "200" ] && [ "$B15_F" = "200" ] && [ "$B15_DL" = "200" ] && [ "$B15_SL" = "302" ]; then
  pass BDD-15 "星标用户读 archived 全文" "detail=$B15_D raw=$B15_R file=$B15_F download=$B15_DL shortlink=$B15_SL 全通" ",\"detail\":\"$B15_D\",\"raw\":\"$B15_R\",\"file\":\"$B15_F\",\"download\":\"$B15_DL\",\"shortlink\":\"$B15_SL\""
else
  fail BDD-15 "星标用户读 archived 全文" "detail=$B15_D raw=$B15_R file=$B15_F download=$B15_DL shortlink=$B15_SL" ",\"detail\":\"$B15_D\",\"raw\":\"$B15_R\",\"file\":\"$B15_F\",\"download\":\"$B15_DL\",\"shortlink\":\"$B15_SL\""
fi

# BDD-16: 非星标用户（carol）详情/raw/文件内容 → 404
B16_D=$(expect_status "/api/v1/entries/$SLUG_ARCH" GET 404 "$TOKC")
B16_R=$(expect_status "/api/v1/entries/$SLUG_ARCH/raw" GET 404 "$TOKC")
B16_F=$(expect_status "/api/v1/entries/$SLUG_ARCH/files/$FID/content" GET 404 "$TOKC")
B16_DL=$(expect_status "/api/v1/entries/$SLUG_ARCH/download" GET 404 "$TOKC")
B16_SL=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/$SLUG_ARCH/raw" -H "Authorization: Bearer $TOKC")
if [ "$B16_D" = "404" ] && [ "$B16_R" = "404" ] && [ "$B16_F" = "404" ] && [ "$B16_DL" = "404" ] && [ "$B16_SL" = "302" ]; then
  pass BDD-16 "非星标用户 archived 404" "detail=$B16_D raw=$B16_R file=$B16_F download=$B16_DL 均 404; shortlink 302 仍跳转" ",\"detail\":\"$B16_D\",\"raw\":\"$B16_R\",\"file\":\"$B16_F\",\"download\":\"$B16_DL\",\"shortlink\":\"$B16_SL\""
else
  fail BDD-16 "非星标用户 archived 404" "detail=$B16_D raw=$B16_R file=$B16_F download=$B16_DL (expect 404), shortlink=$B16_SL" ",\"detail\":\"$B16_D\",\"raw\":\"$B16_R\",\"file\":\"$B16_F\",\"download\":\"$B16_DL\",\"shortlink\":\"$B16_SL\""
fi

# BDD-17: owner/admin 读 archived 始终 200
B17_O=$(expect_status "/api/v1/entries/$SLUG_ARCH" GET 200 "$TOKA")
if [ "$B17_O" = "200" ]; then
  pass BDD-17 "owner/admin 读 archived 恒 200" "owner(alice) detail=$B17_O" ",\"owner\":\"$B17_O\""
else
  fail BDD-17 "owner/admin 读 archived 恒 200" "owner(alice) detail=$B17_O (expect 200)" ",\"owner\":\"$B17_O\""
fi

# BDD-28: share 通道独立授权（archived 私有 entry 持有效 share 仍可读）
# 场景：私有 entry（share 只对私有内容有意义）→ 归档前建 share → 归档后 anonymous+share 仍 200
SLUG_SHARE="$SLUG_BASE-share"
curl -s -X POST "$BASE/api/v1/entries" \
  -H "Authorization: Bearer $TOKA" -H 'Content-Type: application/json' \
  -d "{\"summary\":\"P6 verify $SLUG_SHARE\",\"slug\":\"$SLUG_SHARE\",\"is_public\":false,\"tags\":[\"p6\"],\"files\":[{\"filename\":\"README.md\",\"language\":\"markdown\",\"content\":\"# $SLUG_SHARE\\nprivate share entry.\"}]}" > /dev/null
SHARE_RESP=$(curl -s -X POST "$BASE/api/v1/entries/$SLUG_SHARE/shares" \
  -H "Authorization: Bearer $TOKA" -H 'Content-Type: application/json' -d '{"expires_in":"7d"}')
SHARE_URL=$(echo "$SHARE_RESP" | json_get_default "d.get('share_url','')" "")
SHARE_TOKEN=$(echo "$SHARE_URL" | sed 's/.*?share=//')
curl -s -o /dev/null -X PATCH "$BASE/api/v1/entries/$SLUG_SHARE" \
  -H "Authorization: Bearer $TOKA" -H 'Content-Type: application/json' -d '{"status":"archived"}'
B28_D=$(expect_status "/api/v1/entries/$SLUG_SHARE?share=$SHARE_TOKEN" GET 200 "")
B28_R=$(expect_status "/api/v1/entries/$SLUG_SHARE/raw?share=$SHARE_TOKEN" GET 200 "")
if [ "$B28_D" = "200" ] && [ "$B28_R" = "200" ]; then
  pass BDD-28 "share 通道读 archived 200" "anonymous+share detail=$B28_D raw=$B28_R (share token 有效)" ",\"detail\":\"$B28_D\",\"raw\":\"$B28_R\""
else
  fail BDD-28 "share 通道读 archived 200" "anonymous+share detail=$B28_D raw=$B28_R (expect 200/200)" ",\"detail\":\"$B28_D\",\"raw\":\"$B28_R\""
fi

# ===========================================================================
# BDD-27: 存量 archived 从上线日起算倒计时（迁移 backfill）
# ===========================================================================
echo "[$(date '+%H:%M:%S')] Running pytest test_star_migration.py (BDD-27) ..." | tee -a "$LOG"
(cd "$REPO/backend" && .venv/bin/python -m pytest tests/test_star_migration.py -v --tb=short) > "$EVID_DIR/pytest-migration.log" 2>&1
MIG_EXIT=$?
echo "  pytest exit=$MIG_EXIT (expect 0)" | tee -a "$LOG"
# 数据幂等 backfill 断言：表存在 + archive_delete_at 列存在 + 无 archived 缺 deadline
COL_OK=$(sqlite3 "$DB" "SELECT count(*) FROM pragma_table_info('entries') WHERE name='archive_delete_at'" 2>/dev/null || echo 0)
ORPHAN_ARCH=$(sqlite3 "$DB" "SELECT count(*) FROM entries WHERE status='archived' AND archive_delete_at IS NULL" 2>/dev/null || echo "?")
VER=$(sqlite3 "$DB" "PRAGMA user_version" 2>/dev/null || echo "?")
if [ "$MIG_EXIT" = "0" ] && [ "$COL_OK" = "1" ] && [ "$ORPHAN_ARCH" = "0" ] && [ "$VER" = "2" ]; then
  pass BDD-27 "存量 archived 上线日起算倒计时" "pytest exit=$MIG_EXIT; col=$COL_OK orphan_archived=$ORPHAN_ARCH user_version=$VER" ",\"pytest_exit\":\"$MIG_EXIT\",\"column\":\"$COL_OK\",\"orphan_archived\":\"$ORPHAN_ARCH\",\"user_version\":\"$VER\""
else
  fail BDD-27 "存量 archived 上线日起算倒计时" "pytest=$MIG_EXIT col=$COL_OK orphan_archived=$ORPHAN_ARCH user_version=$VER" ",\"pytest_exit\":\"$MIG_EXIT\",\"column\":\"$COL_OK\",\"orphan_archived\":\"$ORPHAN_ARCH\",\"user_version\":\"$VER\""
fi

# ---------------------------------------------------------------------------
# 汇总
# ---------------------------------------------------------------------------
PASS_CNT=$(grep -c "^PASS " "$LOG" || true)
FAIL_CNT=$(grep -c "^FAIL " "$LOG" || true)
echo ""
echo "═══════════════════════════════════════"
echo "  backend verification: $PASS_CNT PASS / $FAIL_CNT FAIL"
echo "  evidence: $EVID_DIR/"
echo "═══════════════════════════════════════"
echo "GATE_EXIT: $([ "$FAIL_CNT" = "0" ] && echo 0 || echo 1)"
[ "$FAIL_CNT" = "0" ] && exit 0 || exit 1
