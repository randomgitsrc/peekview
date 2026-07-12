#!/usr/bin/env bash
# T053 P6 Verification Script — Agent Raw Endpoint Auto-Discovery
# Runs against debug backend at :8888
set -euo pipefail

BASE="http://127.0.0.1:8888"
EVIDENCE_DIR="$(dirname "$0")"
PASS_COUNT=0
FAIL_COUNT=0
RESULTS=""

pass() {
  RESULTS="$RESULTS\n- PASS $1: $2 ($3)"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  RESULTS="$RESULTS\n- FAIL $1: $2 ($3)"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

# Wait for backend
echo "Waiting for backend..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w "" "$BASE/health" 2>/dev/null; then
    echo "Backend ready."
    break
  fi
  sleep 1
done

# Setup: ensure admin user (first registered = admin) + create entries
echo "Setting up test data..."

# Register admin (first user becomes admin). If already exists, login.
ADMIN_TOKEN=$(curl -s -X POST "$BASE/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"p6admin","password":"Test1234!","email":"p6admin@test.com"}' 2>/dev/null \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || echo "")

if [ -z "$ADMIN_TOKEN" ]; then
  ADMIN_TOKEN=$(curl -s -X POST "$BASE/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"p6admin","password":"Test1234!"}' 2>/dev/null \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || echo "")
fi

# If p6admin is not admin (not first user), try testuser as fallback
ADMIN_IS_ADMIN=$(curl -s "$BASE/api/v1/auth/me" -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('is_admin',False))" 2>/dev/null || echo "False")

if [ "$ADMIN_IS_ADMIN" != "True" ]; then
  # Try testuser (likely the first registered admin)
  ADMIN_TOKEN=$(curl -s -X POST "$BASE/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"testuser","password":"Test1234!"}' 2>/dev/null \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || echo "")
fi

# Create public entry (ignore 409 conflict if already exists)
curl -s -X POST "$BASE/api/v1/entries" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slug":"test-cn","summary":"Test entry for content negotiation","is_public":true,"files":[{"filename":"hello.py","content":"print(\"hello\")","language":"python"}]}' > /dev/null 2>/dev/null

# Create private entry owned by admin
curl -s -X POST "$BASE/api/v1/entries" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slug":"private-cn","summary":"Private entry for content negotiation","is_public":false,"files":[{"filename":"secret.py","content":"secret=42","language":"python"}]}' > /dev/null 2>/dev/null

# Register regular user + create private entry owned by regular user
REGULAR_TOKEN=$(curl -s -X POST "$BASE/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"p6regular","password":"Test1234!","email":"p6regular@test.com"}' 2>/dev/null \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || echo "")

if [ -z "$REGULAR_TOKEN" ]; then
  REGULAR_TOKEN=$(curl -s -X POST "$BASE/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"p6regular","password":"Test1234!"}' 2>/dev/null \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || echo "")
fi

# Create private entry owned by regular user (for B7b admin-non-owner test)
curl -s -X POST "$BASE/api/v1/entries" \
  -H "Authorization: Bearer $REGULAR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slug":"private-regular","summary":"Private entry by regular user","is_public":false,"files":[{"filename":"data.txt","content":"private data"}]}' > /dev/null 2>/dev/null

echo "Test data ready. Running BDD verification..."
echo ""

# B1: Content Negotiation — JSON preferred
B1_CT=$(curl -s -D - "$BASE/test-cn" -H "Accept: application/json" 2>/dev/null | grep -i "^content-type:" | head -1 | tr -d '\r')
B1_BODY=$(curl -s "$BASE/test-cn" -H "Accept: application/json" 2>/dev/null)
B1_SLUG=$(echo "$B1_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('slug')=='test-cn')" 2>/dev/null || echo "False")
B1_FILES=$(echo "$B1_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('files' in d)" 2>/dev/null || echo "False")
if echo "$B1_CT" | grep -qi "application/json" && [ "$B1_SLUG" = "True" ] && [ "$B1_FILES" = "True" ]; then
  pass "B01" "Accept: application/json returns JSON with entry data" "b1_headers.txt"
else
  fail "B01" "Accept: application/json should return JSON" "b1_headers.txt"
fi
curl -s -D "$EVIDENCE_DIR/b1_headers.txt" -o "$EVIDENCE_DIR/b1_body.json" "$BASE/test-cn" -H "Accept: application/json" 2>/dev/null

# B2: Content Negotiation — HTML preferred when both present
B2_CT=$(curl -s -D - "$BASE/test-cn" -H "Accept: text/html, application/json" 2>/dev/null | grep -i "^content-type:" | head -1 | tr -d '\r')
if echo "$B2_CT" | grep -qi "text/html"; then
  pass "B02" "Accept: text/html, application/json returns HTML" "b2_headers.txt"
else
  fail "B02" "Accept: text/html, application/json should return HTML" "b2_headers.txt"
fi
curl -s -D "$EVIDENCE_DIR/b2_headers.txt" -o "$EVIDENCE_DIR/b2_body.html" "$BASE/test-cn" -H "Accept: text/html, application/json" 2>/dev/null

# B3: Wildcard doesn't trigger JSON
B3_CT=$(curl -s -D - "$BASE/test-cn" -H "Accept: */*" 2>/dev/null | grep -i "^content-type:" | head -1 | tr -d '\r')
if echo "$B3_CT" | grep -qi "text/html"; then
  pass "B03" "Accept: */* returns HTML" "b3_headers.txt"
else
  fail "B03" "Accept: */* should return HTML" "b3_headers.txt"
fi
curl -s -D "$EVIDENCE_DIR/b3_headers.txt" -o "$EVIDENCE_DIR/b3_body.html" "$BASE/test-cn" -H "Accept: */*" 2>/dev/null

# B4: Browser Accept returns HTML
B4_CT=$(curl -s -D - "$BASE/test-cn" -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8" 2>/dev/null | grep -i "^content-type:" | head -1 | tr -d '\r')
if echo "$B4_CT" | grep -qi "text/html"; then
  pass "B04" "Browser Accept header returns HTML" "b4_headers.txt"
else
  fail "B04" "Browser Accept should return HTML" "b4_headers.txt"
fi
curl -s -D "$EVIDENCE_DIR/b4_headers.txt" -o "$EVIDENCE_DIR/b4_body.html" "$BASE/test-cn" -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8" 2>/dev/null

# B5: text/html present → HTML wins regardless of q
B5_CT=$(curl -s -D - "$BASE/test-cn" -H "Accept: application/json;q=0.9, text/html;q=0.8" 2>/dev/null | grep -i "^content-type:" | head -1 | tr -d '\r')
if echo "$B5_CT" | grep -qi "text/html"; then
  pass "B05" "text/html present (even with lower q) → HTML wins" "b5_headers.txt"
else
  fail "B05" "text/html;q=0.8 should still win over application/json;q=0.9" "b5_headers.txt"
fi
curl -s -D "$EVIDENCE_DIR/b5_headers.txt" -o "$EVIDENCE_DIR/b5_body.html" "$BASE/test-cn" -H "Accept: application/json;q=0.9, text/html;q=0.8" 2>/dev/null

# B6: Private entry, unauthenticated → 404
B6_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/private-cn" -H "Accept: application/json" 2>/dev/null)
B6_CT=$(curl -s -D - "$BASE/private-cn" -H "Accept: application/json" 2>/dev/null | grep -i "^content-type:" | head -1 | tr -d '\r')
if [ "$B6_STATUS" = "404" ] && echo "$B6_CT" | grep -qi "application/json"; then
  pass "B06" "Private entry unauthenticated returns 404 JSON" "b6_headers.txt"
else
  fail "B06" "Private entry unauthenticated should return 404 JSON (got $B6_STATUS)" "b6_headers.txt"
fi
curl -s -D "$EVIDENCE_DIR/b6_headers.txt" -o "$EVIDENCE_DIR/b6_body.json" "$BASE/private-cn" -H "Accept: application/json" 2>/dev/null

# B7: Private entry, authenticated as owner → JSON
B7_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/private-cn" -H "Accept: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)
B7_BODY=$(curl -s "$BASE/private-cn" -H "Accept: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)
B7_SLUG=$(echo "$B7_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('slug')=='private-cn')" 2>/dev/null || echo "False")
if [ "$B7_STATUS" = "200" ] && [ "$B7_SLUG" = "True" ]; then
  pass "B07" "Private entry authenticated as owner returns JSON" "b7_headers.txt"
else
  fail "B07" "Private entry authenticated should return JSON (got $B7_STATUS, slug=$B7_SLUG)" "b7_headers.txt"
fi
curl -s -D "$EVIDENCE_DIR/b7_headers.txt" -o "$EVIDENCE_DIR/b7_body.json" "$BASE/private-cn" -H "Accept: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null

# B7b: Admin (non-owner) access private entry → JSON
B7B_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/private-regular" -H "Accept: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)
B7B_BODY=$(curl -s "$BASE/private-regular" -H "Accept: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)
B7B_SLUG=$(echo "$B7B_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('slug')=='private-regular')" 2>/dev/null || echo "False")
if [ "$B7B_STATUS" = "200" ] && [ "$B7B_SLUG" = "True" ]; then
  pass "B07b" "Admin accessing non-owned private entry returns JSON" "b7b_headers.txt"
else
  fail "B07b" "Admin should access non-owned private entry (got $B7B_STATUS, slug=$B7B_SLUG)" "b7b_headers.txt"
fi
curl -s -D "$EVIDENCE_DIR/b7b_headers.txt" -o "$EVIDENCE_DIR/b7b_body.json" "$BASE/private-regular" -H "Accept: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null

# B8: Non-existent slug, Accept JSON → 404 JSON
B8_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/nonexistent-slug" -H "Accept: application/json" 2>/dev/null)
B8_CT=$(curl -s -D - "$BASE/nonexistent-slug" -H "Accept: application/json" 2>/dev/null | grep -i "^content-type:" | head -1 | tr -d '\r')
if [ "$B8_STATUS" = "404" ] && echo "$B8_CT" | grep -qi "application/json"; then
  pass "B08" "Non-existent slug with Accept JSON returns 404 JSON" "b8_headers.txt"
else
  fail "B08" "Non-existent slug should return 404 JSON (got $B8_STATUS)" "b8_headers.txt"
fi
curl -s -D "$EVIDENCE_DIR/b8_headers.txt" -o "$EVIDENCE_DIR/b8_body.json" "$BASE/nonexistent-slug" -H "Accept: application/json" 2>/dev/null

# B9: Non-existent slug, Accept HTML → SPA page
B9_CT=$(curl -s -D - "$BASE/nonexistent-slug" -H "Accept: text/html" 2>/dev/null | grep -i "^content-type:" | head -1 | tr -d '\r')
if echo "$B9_CT" | grep -qi "text/html"; then
  pass "B09" "Non-existent slug with Accept HTML returns SPA page" "b9_headers.txt"
else
  fail "B09" "Non-existent slug should return HTML SPA (got $B9_CT)" "b9_headers.txt"
fi
curl -s -D "$EVIDENCE_DIR/b9_headers.txt" -o "$EVIDENCE_DIR/b9_body.html" "$BASE/nonexistent-slug" -H "Accept: text/html" 2>/dev/null

# B10: HTML <link> injection — valid slug
B10_BODY=$(curl -s "$BASE/test-cn" -H "Accept: text/html" 2>/dev/null)
B10_HAS_LINK=$(echo "$B10_BODY" | python3 -c "
import sys
c = sys.stdin.read()
print('rel=\"alternate\"' in c and 'type=\"application/json\"' in c and '/api/v1/entries/test-cn/raw' in c)
" 2>/dev/null || echo "False")
if [ "$B10_HAS_LINK" = "True" ]; then
  pass "B10" "Valid slug HTML contains <link rel=alternate> pointing to /raw" "b10_body.html"
else
  fail "B10" "Valid slug HTML should contain <link> injection" "b10_body.html"
fi
curl -s -o "$EVIDENCE_DIR/b10_body.html" "$BASE/test-cn" -H "Accept: text/html" 2>/dev/null

# B10b: HTML <link> injection — private entry also gets injected
B10B_BODY=$(curl -s "$BASE/private-cn" -H "Accept: text/html" 2>/dev/null)
B10B_HAS_LINK=$(echo "$B10B_BODY" | python3 -c "
import sys
c = sys.stdin.read()
print('rel=\"alternate\"' in c and '/api/v1/entries/private-cn/raw' in c)
" 2>/dev/null || echo "False")
B10B_RAW_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/v1/entries/private-cn/raw" 2>/dev/null)
if [ "$B10B_HAS_LINK" = "True" ] && [ "$B10B_RAW_STATUS" = "404" ]; then
  pass "B10b" "Private entry HTML has <link> but /raw without auth returns 404" "b10b_body.html"
else
  fail "B10b" "Private entry should have <link> and /raw should 404 without auth (link=$B10B_HAS_LINK, raw=$B10B_RAW_STATUS)" "b10b_body.html"
fi
curl -s -o "$EVIDENCE_DIR/b10b_body.html" "$BASE/private-cn" -H "Accept: text/html" 2>/dev/null

# B11: Non-existent slug — no <link> injection
B11_BODY=$(curl -s "$BASE/nonexistent-slug" -H "Accept: text/html" 2>/dev/null)
B11_NO_LINK=$(echo "$B11_BODY" | python3 -c "
import sys
c = sys.stdin.read()
print('rel=\"alternate\"' not in c)
" 2>/dev/null || echo "False")
if [ "$B11_NO_LINK" = "True" ]; then
  pass "B11" "Non-existent slug HTML has no <link> injection" "b11_body.html"
else
  fail "B11" "Non-existent slug should not have <link> injection" "b11_body.html"
fi
curl -s -o "$EVIDENCE_DIR/b11_body.html" "$BASE/nonexistent-slug" -H "Accept: text/html" 2>/dev/null

# B12: Frontend routes — no <link> injection
B12_EXPLORE=$(curl -s "$BASE/explore" -H "Accept: text/html" 2>/dev/null)
B12_APIKEYS=$(curl -s "$BASE/settings/apikeys" -H "Accept: text/html" 2>/dev/null)
B12_NO_EXPLORE=$(echo "$B12_EXPLORE" | python3 -c "import sys; print('rel=\"alternate\"' not in sys.stdin.read())" 2>/dev/null || echo "False")
B12_NO_APIKEYS=$(echo "$B12_APIKEYS" | python3 -c "import sys; print('rel=\"alternate\"' not in sys.stdin.read())" 2>/dev/null || echo "False")
if [ "$B12_NO_EXPLORE" = "True" ] && [ "$B12_NO_APIKEYS" = "True" ]; then
  pass "B12" "Frontend routes (/explore, /settings/apikeys) have no <link> injection" "b12_explore.html"
else
  fail "B12" "Frontend routes should not have <link> injection (explore=$B12_NO_EXPLORE, apikeys=$B12_NO_APIKEYS)" "b12_explore.html"
fi
curl -s -o "$EVIDENCE_DIR/b12_explore.html" "$BASE/explore" -H "Accept: text/html" 2>/dev/null
curl -s -o "$EVIDENCE_DIR/b12_apikeys.html" "$BASE/settings/apikeys" -H "Accept: text/html" 2>/dev/null

# B13: HTTP Link header — valid slug
B13_HEADERS=$(curl -s -D - "$BASE/test-cn" -H "Accept: text/html" 2>/dev/null)
B13_HAS_LINK=$(echo "$B13_HEADERS" | python3 -c "
import sys
h = sys.stdin.read().lower()
print('link:' in h and '/api/v1/entries/test-cn/raw' in h and 'rel=\"alternate\"' in h)
" 2>/dev/null || echo "False")
if [ "$B13_HAS_LINK" = "True" ]; then
  pass "B13" "Valid slug response has Link header pointing to /raw" "b13_headers.txt"
else
  fail "B13" "Valid slug should have Link header" "b13_headers.txt"
fi
curl -s -D "$EVIDENCE_DIR/b13_headers.txt" -o /dev/null "$BASE/test-cn" -H "Accept: text/html" 2>/dev/null

# B13b: HTTP Link header — private entry
B13B_HEADERS=$(curl -s -D - "$BASE/private-cn" -H "Accept: text/html" 2>/dev/null)
B13B_HAS_LINK=$(echo "$B13B_HEADERS" | python3 -c "
import sys
h = sys.stdin.read().lower()
print('link:' in h and '/api/v1/entries/private-cn/raw' in h)
" 2>/dev/null || echo "False")
if [ "$B13B_HAS_LINK" = "True" ]; then
  pass "B13b" "Private entry response has Link header" "b13b_headers.txt"
else
  fail "B13b" "Private entry should have Link header" "b13b_headers.txt"
fi
curl -s -D "$EVIDENCE_DIR/b13b_headers.txt" -o /dev/null "$BASE/private-cn" -H "Accept: text/html" 2>/dev/null

# B14: HTTP Link header — non-existent slug no Link
B14_HEADERS=$(curl -s -D - "$BASE/nonexistent-slug" -H "Accept: text/html" 2>/dev/null)
B14_NO_LINK=$(echo "$B14_HEADERS" | python3 -c "
import sys
h = sys.stdin.read().lower()
# Check if there's a link header pointing to /raw
lines = h.split('\n')
for line in lines:
    if line.strip().startswith('link:') and '/raw' in line:
        print('False')
        sys.exit(0)
print('True')
" 2>/dev/null || echo "False")
if [ "$B14_NO_LINK" = "True" ]; then
  pass "B14" "Non-existent slug has no Link header" "b14_headers.txt"
else
  fail "B14" "Non-existent slug should not have Link header" "b14_headers.txt"
fi
curl -s -D "$EVIDENCE_DIR/b14_headers.txt" -o /dev/null "$BASE/nonexistent-slug" -H "Accept: text/html" 2>/dev/null

# B15: llms.txt — contains /raw and Content Negotiation description
B15_HEADERS=$(curl -s -D - "$BASE/llms.txt" 2>/dev/null)
B15_IS_302=$(echo "$B15_HEADERS" | head -1 | grep -c "302" || echo "0")
B15_CONTENT=$(curl -sL "$BASE/llms.txt" 2>/dev/null)
B15_HAS_RAW=$(echo "$B15_CONTENT" | python3 -c "import sys; print('/raw' in sys.stdin.read())" 2>/dev/null || echo "False")
B15_HAS_CN=$(echo "$B15_CONTENT" | python3 -c "import sys; c=sys.stdin.read().lower(); print('accept' in c or 'content negotiation' in c or 'application/json' in c)" 2>/dev/null || echo "False")
if [ "$B15_HAS_RAW" = "True" ] && [ "$B15_HAS_CN" = "True" ]; then
  pass "B15" "llms.txt contains /raw and Content Negotiation description" "b15_content.txt"
else
  fail "B15" "llms.txt missing Content Negotiation description (has_raw=$B15_HAS_RAW, has_cn=$B15_HAS_CN)" "b15_content.txt"
fi
curl -s -D "$EVIDENCE_DIR/b15_headers.txt" -o "$EVIDENCE_DIR/b15_content.txt" "$BASE/llms.txt" 2>/dev/null

# B16: End-to-end — Agent gets JSON directly via Accept
B16_BODY=$(curl -s "$BASE/test-cn" -H "Accept: application/json" 2>/dev/null)
B16_SLUG=$(echo "$B16_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('slug')=='test-cn' and 'files' in d)" 2>/dev/null || echo "False")
if [ "$B16_SLUG" = "True" ]; then
  pass "B16" "Agent gets structured JSON directly via Accept: application/json" "b16_body.json"
else
  fail "B16" "Agent should get JSON directly" "b16_body.json"
fi
curl -s -o "$EVIDENCE_DIR/b16_body.json" "$BASE/test-cn" -H "Accept: application/json" 2>/dev/null

# B17: End-to-end — Agent discovers /raw via <link>
B17_HTML=$(curl -s "$BASE/test-cn" 2>/dev/null)
B17_RAW_URL=$(echo "$B17_HTML" | python3 -c "
import re,sys
c = sys.stdin.read()
m = re.search(r'href=\"(/api/v1/entries/test-cn/raw)\"', c)
print(m.group(1) if m else 'NOT_FOUND')
" 2>/dev/null || echo "NOT_FOUND")
B17_RAW_BODY=$(curl -s "$BASE$B17_RAW_URL" 2>/dev/null)
B17_SLUG=$(echo "$B17_RAW_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('slug')=='test-cn' and 'files' in d)" 2>/dev/null || echo "False")
if [ "$B17_RAW_URL" != "NOT_FOUND" ] && [ "$B17_SLUG" = "True" ]; then
  pass "B17" "Agent discovers /raw via <link> and gets structured JSON" "b17_raw.json"
else
  fail "B17" "Agent should discover /raw via <link> (url=$B17_RAW_URL, slug=$B17_SLUG)" "b17_raw.json"
fi
curl -s -o "$EVIDENCE_DIR/b17_html.html" "$BASE/test-cn" 2>/dev/null
curl -s -o "$EVIDENCE_DIR/b17_raw.json" "$BASE/api/v1/entries/test-cn/raw" 2>/dev/null

# Summary
echo ""
echo "========================================="
echo "T053 P6 Verification Summary"
echo "========================================="
echo -e "$RESULTS"
echo ""
echo "PASS: $PASS_COUNT / $((PASS_COUNT + FAIL_COUNT))"
echo "FAIL: $FAIL_COUNT / $((PASS_COUNT + FAIL_COUNT))"
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "RESULT: FAIL"
  exit 1
else
  echo "RESULT: ALL PASS"
  exit 0
fi
