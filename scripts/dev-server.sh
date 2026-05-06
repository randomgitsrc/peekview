#!/bin/bash
# PeekView 调试服务管理脚本
# 用法: ./scripts/dev-server.sh [start|stop|status|restart]

set -e

PORT=8888
DATA_DIR="/tmp/peekview-debug"
PID_FILE="/tmp/peekview-debug.pid"
LOG_FILE="/tmp/peekview-debug.log"

check_port() {
    if lsof -i :$PORT > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

get_pid() {
    if [ -f "$PID_FILE" ]; then
        cat "$PID_FILE"
    else
        echo ""
    fi
}

start_server() {
    echo "=== 启动 PeekView 调试服务 ==="

    # 检查端口占用
    if check_port; then
        EXISTING_PID=$(lsof -t -i :$PORT 2>/dev/null || echo "")
        if [ -n "$EXISTING_PID" ]; then
            echo "⚠️  端口 $PORT 已被占用 (PID: $EXISTING_PID)"
            echo "   尝试停止现有服务..."
            kill $EXISTING_PID 2>/dev/null || true
            sleep 2
        fi
    fi

    # 准备环境
    mkdir -p "$DATA_DIR/data"
    rm -f "$PID_FILE" "$LOG_FILE"

    # 检查静态文件是否存在
    if [ ! -f "backend/peekview/static/index.html" ]; then
        echo "✗ 错误: 静态文件不存在"
        echo "   请先运行: make build-frontend"
        exit 1
    fi

    # 获取静态文件数量
    STATIC_COUNT=$(ls backend/peekview/static/assets/ 2>/dev/null | wc -l)
    echo "✓ 静态文件: $STATIC_COUNT 个"

    # 启动服务
    echo "→ 启动 uvicorn (端口 $PORT)..."
    cd backend
    PEEKVIEW_DATA_DIR="$DATA_DIR/data" \
    PEEKVIEW_DB_PATH="$DATA_DIR/peek.db" \
    PEEKVIEW_PORT=$PORT \
        python3 -m uvicorn peekview.main:get_app \
        --host 127.0.0.1 \
        --port $PORT \
        --factory \
        > "$LOG_FILE" 2>&1 &

    PID=$!
    echo $PID > "$PID_FILE"
    cd ..

    # 等待服务启动
    echo "→ 等待服务启动..."
    for i in {1..10}; do
        sleep 1
        if curl -s "http://127.0.0.1:$PORT/health" > /dev/null 2>&1; then
            echo "✓ 服务已启动 (PID: $PID)"
            echo "  地址: http://127.0.0.1:$PORT"
            echo "  日志: $LOG_FILE"
            return 0
        fi
        if ! kill -0 $PID 2>/dev/null; then
            echo "✗ 服务启动失败，查看日志:"
            tail -20 "$LOG_FILE"
            exit 1
        fi
    done

    echo "✗ 服务启动超时"
    exit 1
}

stop_server() {
    echo "=== 停止 PeekView 调试服务 ==="

    PID=$(get_pid)
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        echo "→ 停止服务 (PID: $PID)..."
        kill "$PID" 2>/dev/null || true
        sleep 2
        if kill -0 "$PID" 2>/dev/null; then
            echo "→ 强制停止..."
            kill -9 "$PID" 2>/dev/null || true
        fi
    fi

    # 清理端口占用
    PORT_PID=$(lsof -t -i :$PORT 2>/dev/null || echo "")
    if [ -n "$PORT_PID" ]; then
        echo "→ 清理端口 $PORT 占用 (PID: $PORT_PID)..."
        kill $PORT_PID 2>/dev/null || true
    fi

    rm -f "$PID_FILE"
    echo "✓ 服务已停止"
}

status_server() {
    PID=$(get_pid)
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        if curl -s "http://127.0.0.1:$PORT/health" > /dev/null 2>&1; then
            echo "✓ 运行中 (PID: $PID, 端口: $PORT)"
            echo "  地址: http://127.0.0.1:$PORT"
            return 0
        else
            echo "⚠️  进程存在但服务无响应 (PID: $PID)"
            return 1
        fi
    else
        if check_port; then
            OTHER_PID=$(lsof -t -i :$PORT 2>/dev/null || echo "unknown")
            echo "⚠️  端口 $PORT 被其他进程占用 (PID: $OTHER_PID)"
            return 1
        else
            echo "✗ 未运行"
            return 1
        fi
    fi
}

restart_server() {
    stop_server
    sleep 1
    start_server
}

case "${1:-start}" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    status)
        status_server
        ;;
    restart)
        restart_server
        ;;
    *)
        echo "用法: $0 [start|stop|status|restart]"
        exit 1
        ;;
esac
