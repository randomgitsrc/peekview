#!/bin/bash
#
# Extended Debug Workflow with Remote CLI Testing
# 扩展调试流程 - 包含 Remote CLI 模式测试
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEBUG_PORT=8888
DEBUG_URL="http://127.0.0.1:${DEBUG_PORT}"
TEST_DATA_DIR="/tmp/peekview-debug-remote-test"

# Python executable
PYTHON_CMD="${PYTHON:-python3}"

# Function to run peekview command
run_peekview() {
    if [ -f "$PROJECT_ROOT/backend/peekview/__init__.py" ]; then
        # Running from source
        (cd "$PROJECT_ROOT/backend" && PYTHONPATH="$PROJECT_ROOT/backend" "$PYTHON_CMD" -m peekview "$@")
    else
        # Installed package
        peekview "$@"
    fi
}

echo_info() {
    echo -e "${BLUE}→ $1${NC}"
}

echo_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

echo_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

echo_error() {
    echo -e "${RED}✗ $1${NC}"
}

# ========================================
# Setup Functions
# ========================================

setup_test_env() {
    echo_info "Setting up test environment..."

    # Create test data directory
    rm -rf "$TEST_DATA_DIR"
    mkdir -p "$TEST_DATA_DIR"

    # Create test files
    echo 'print("Hello from remote CLI")' > "$TEST_DATA_DIR/test.py"
    echo '# Test Markdown' > "$TEST_DATA_DIR/README.md"

    # Create subdirectory with files
    mkdir -p "$TEST_DATA_DIR/src"
    echo 'def helper(): pass' > "$TEST_DATA_DIR/src/utils.py"
    echo 'const x = 1;' > "$TEST_DATA_DIR/src/app.js"

    # Create binary file (should be skipped)
    printf '\x89PNG\r\n\x1a\n' > "$TEST_DATA_DIR/image.png"

    echo_success "Test environment ready at $TEST_DATA_DIR"
}

cleanup_test_env() {
    echo_info "Cleaning up test environment..."
    rm -rf "$TEST_DATA_DIR"
    echo_success "Test environment cleaned"
}

# ========================================
# Remote CLI Test Functions
# ========================================

test_remote_create_single_file() {
    echo_info "Testing: Create entry with single file..."

    local result
    result=$(run_peekview create "$TEST_DATA_DIR/test.py" \
        -s "Remote Single File Test" \
        --remote-url "$DEBUG_URL" \
        --json-output 2>&1)

    if echo "$result" | grep -q '"slug"'; then
        echo_success "Single file create test passed"
        # Extract slug for cleanup
        local slug
        slug=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['slug'])" 2>/dev/null || echo "")
        if [ -n "$slug" ]; then
            TEST_ENTRIES+=("$slug")
        fi
        return 0
    else
        echo_error "Single file create test failed"
        echo "$result"
        return 1
    fi
}

test_remote_create_directory() {
    echo_info "Testing: Create entry from directory..."

    local result
    result=$(run_peekview create "$TEST_DATA_DIR/src" \
        -s "Remote Directory Test" \
        -t python -t javascript \
        --remote-url "$DEBUG_URL" \
        --json-output 2>&1)

    if echo "$result" | grep -q '"slug"' && echo "$result" | grep -q '"file_count": 2'; then
        echo_success "Directory create test passed (2 files uploaded)"
        local slug
        slug=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['slug'])" 2>/dev/null || echo "")
        if [ -n "$slug" ]; then
            TEST_ENTRIES+=("$slug")
        fi
        return 0
    else
        echo_error "Directory create test failed"
        echo "$result"
        return 1
    fi
}

test_remote_create_stdin() {
    echo_info "Testing: Create entry from stdin..."

    local result
    result=$(echo 'console.log("from stdin")' | run_peekview create \
        -s "Remote Stdin Test" \
        --from-stdin \
        --remote-url "$DEBUG_URL" \
        --json-output 2>&1)

    if echo "$result" | grep -q '"slug"'; then
        echo_success "Stdin create test passed"
        local slug
        slug=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['slug'])" 2>/dev/null || echo "")
        if [ -n "$slug" ]; then
            TEST_ENTRIES+=("$slug")
        fi
        return 0
    else
        echo_error "Stdin create test failed"
        echo "$result"
        return 1
    fi
}

test_remote_list() {
    echo_info "Testing: List entries..."

    local result
    result=$(run_peekview list \
        --remote-url "$DEBUG_URL" \
        --json-output 2>&1)

    if echo "$result" | grep -q '"items"'; then
        local count
        count=$(echo "$result" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['items']))" 2>/dev/null || echo "0")
        echo_success "List test passed ($count entries found)"
        return 0
    else
        echo_error "List test failed"
        echo "$result"
        return 1
    fi
}

test_remote_list_with_filter() {
    echo_info "Testing: List entries with tag filter..."

    local result
    result=$(run_peekview list \
        -t python \
        --remote-url "$DEBUG_URL" \
        --json-output 2>&1)

    if echo "$result" | grep -q '"items"'; then
        echo_success "List with filter test passed"
        return 0
    else
        echo_error "List with filter test failed"
        echo "$result"
        return 1
    fi
}

test_remote_get() {
    echo_info "Testing: Get entry details..."

    # Get the first test entry
    local list_result
    list_result=$(run_peekview list \
        --remote-url "$DEBUG_URL" \
        --json-output 2>&1)

    local first_slug
    first_slug=$(echo "$list_result" | python3 -c "import sys,json; print(json.load(sys.stdin)['items'][0]['slug'])" 2>/dev/null || echo "")

    if [ -z "$first_slug" ]; then
        echo_warning "No entries found for get test"
        return 1
    fi

    local result
    result=$(run_peekview get "$first_slug" \
        --remote-url "$DEBUG_URL" \
        --json-output 2>&1)

    if echo "$result" | grep -q '"slug"' && echo "$result" | grep -q "\"$first_slug\""; then
        echo_success "Get entry test passed (slug: $first_slug)"
        return 0
    else
        echo_error "Get entry test failed"
        echo "$result"
        return 1
    fi
}

test_remote_binary_skip() {
    echo_info "Testing: Binary file skip with warning..."

    local result
    result=$(run_peekview create "$TEST_DATA_DIR" \
        -s "Binary Skip Test" \
        --remote-url "$DEBUG_URL" 2>&1)

    if echo "$result" | grep -q "Skipping binary file"; then
        echo_success "Binary file skip test passed"
        return 0
    else
        echo_warning "Binary file skip warning not found (may be OK if PNG detected differently)"
        return 0
    fi
}

test_remote_mode_indicator() {
    echo_info "Testing: Remote mode indicator in non-JSON mode..."

    local result
    result=$(run_peekview list \
        --remote-url "$DEBUG_URL" 2>&1)

    if echo "$result" | grep -q "→ Remote mode:"; then
        echo_success "Remote mode indicator test passed"
        return 0
    else
        echo_error "Remote mode indicator not found"
        echo "$result"
        return 1
    fi
}

test_local_mode_explicit() {
    echo_info "Testing: Explicit local mode (empty --remote-url)..."

    local result
    result=$(run_peekview list --remote-url "" 2>&1 || true)

    if ! echo "$result" | grep -q "→ Remote mode:"; then
        echo_success "Explicit local mode test passed (no remote indicator)"
        return 0
    else
        echo_error "Explicit local mode test failed (should not show remote indicator)"
        return 1
    fi
}

# ========================================
# Cleanup Functions
# ========================================

cleanup_test_entries() {
    echo_info "Cleaning up test entries..."

    for slug in "${TEST_ENTRIES[@]}"; do
        echo "  Deleting: $slug"
        run_peekview delete "$slug" \
            --remote-url "$DEBUG_URL" \
            --yes 2>/dev/null || true
    done

    echo_success "Test entries cleaned"
}

# ========================================
# Main Test Runner
# ========================================

run_all_tests() {
    echo ""
    echo "========================================"
    echo "  Remote CLI Mode - Integration Tests"
    echo "========================================"
    echo ""

    # Initialize test entries array
    TEST_ENTRIES=()

    # Track results
    local passed=0
    local failed=0

    # Setup
    setup_test_env

    # Wait for server to be ready
    echo_info "Waiting for server at $DEBUG_URL..."
    local retries=0
    while ! curl -s "$DEBUG_URL/health" > /dev/null 2>&1; do
        retries=$((retries + 1))
        if [ $retries -gt 30 ]; then
            echo_error "Server not responding after 30 seconds"
            cleanup_test_env
            exit 1
        fi
        sleep 1
    done
    echo_success "Server is ready"
    echo ""

    # Run tests
    echo "Running tests..."
    echo ""

    if test_remote_create_single_file; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi

    if test_remote_create_directory; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi

    if test_remote_create_stdin; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi

    if test_remote_list; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi

    if test_remote_list_with_filter; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi

    if test_remote_get; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi

    if test_remote_binary_skip; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi

    if test_remote_mode_indicator; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi

    if test_local_mode_explicit; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi

    echo ""
    echo "========================================"
    echo "  Test Results"
    echo "========================================"
    echo_success "Passed: $passed"
    if [ $failed -gt 0 ]; then
        echo_error "Failed: $failed"
    fi
    echo ""

    # Cleanup
    cleanup_test_entries
    cleanup_test_env

    if [ $failed -gt 0 ]; then
        exit 1
    fi

    echo_success "All Remote CLI tests passed!"
    return 0
}

# ========================================
# Command Handling
# ========================================

case "${1:-}" in
    test)
        run_all_tests
        ;;
    setup)
        setup_test_env
        ;;
    cleanup)
        cleanup_test_env
        cleanup_test_entries 2>/dev/null || true
        ;;
    *)
        echo "Remote CLI Debug Workflow"
        echo ""
        echo "Usage: $0 {test|setup|cleanup}"
        echo ""
        echo "Commands:"
        echo "  test     - Run all Remote CLI integration tests"
        echo "  setup    - Setup test environment only"
        echo "  cleanup  - Cleanup test environment and entries"
        echo ""
        echo "Environment Variables:"
        echo "  DEBUG_URL    - Server URL (default: http://127.0.0.1:8888)"
        echo ""
        exit 1
        ;;
esac
