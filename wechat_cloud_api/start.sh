#!/bin/bash
# WeChat Cloud API Service 启动脚本

set -e

echo "WeChat Cloud API Service Startup Script"
echo "========================================"

# 检查Python版本
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
REQUIRED_VERSION="3.8"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Error: Python 3.8+ is required, found: $PYTHON_VERSION"
    exit 1
fi

echo "✅ Python version: $PYTHON_VERSION"

# 检查并创建虚拟环境
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# 激活虚拟环境
echo "🔄 Activating virtual environment..."
source venv/bin/activate

# 升级pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip

# 安装依赖
echo "📦 Installing dependencies..."
pip install -r requirements.txt

# 检查配置文件
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found, creating from template..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "📝 Please edit .env file with your actual configuration"
    else
        echo "❌ Error: .env.example not found"
        exit 1
    fi
fi

# 创建必要的目录
echo "📁 Creating directories..."
mkdir -p data logs

# 验证配置
echo "🔍 Validating configuration..."
python3 -c "from config import validate_configuration; exit(0 if validate_configuration() else 1)"

if [ $? -ne 0 ]; then
    echo "❌ Configuration validation failed!"
    echo "Please check your .env file and ensure all required variables are set."
    exit 1
fi

echo "✅ Configuration validation passed"

# 获取启动参数
MODE=${1:-"development"}
HOST=${WECHAT_HOST:-"0.0.0.0"}
PORT=${WECHAT_PORT:-"8000"}
WORKERS=${WECHAT_WORKERS:-"1"}

echo "🚀 Starting WeChat Cloud API Service..."
echo "   Mode: $MODE"
echo "   Host: $HOST"
echo "   Port: $PORT"
echo "   Workers: $WORKERS"
echo ""

# 根据模式启动服务
case $MODE in
    "development"|"dev")
        echo "🔧 Starting in development mode..."
        python3 main.py
        ;;
    "production"|"prod")
        echo "🏭 Starting in production mode..."
        gunicorn main:app -w $WORKERS -k uvicorn.workers.UvicornWorker \
            --bind $HOST:$PORT \
            --access-logfile logs/access.log \
            --error-logfile logs/error.log \
            --log-level info \
            --preload
        ;;
    "test")
        echo "🧪 Running tests..."
        if [ -f "test_api.py" ]; then
            python3 test_api.py
        else
            echo "⚠️  No test file found"
        fi
        ;;
    *)
        echo "❌ Invalid mode: $MODE"
        echo "Available modes: development, production, test"
        exit 1
        ;;
esac