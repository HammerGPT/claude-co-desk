"""
Configuration Management for WeChat Cloud API Service
微信云端API服务配置管理
支持环境变量配置和安全性最佳实践
"""

import os
import json
import logging
from pathlib import Path
from typing import List, Optional
from pydantic import BaseSettings, Field
from functools import lru_cache
from dotenv import load_dotenv

logger = logging.getLogger("config")

class Settings(BaseSettings):
    """应用配置设置"""
    
    # 基础服务配置
    app_name: str = Field(default="WeChat Cloud API Service", description="应用名称")
    version: str = Field(default="1.0.0", description="版本号")
    debug: bool = Field(default=False, description="调试模式")
    
    # 服务器配置
    host: str = Field(default="0.0.0.0", description="服务器监听地址")
    port: int = Field(default=8888, description="服务器端口")
    workers: int = Field(default=1, description="工作进程数量")
    
    # 微信公众号配置
    wechat_app_id: str = Field(..., env="WECHAT_APP_ID", description="微信AppID")
    wechat_app_secret: str = Field(..., env="WECHAT_APP_SECRET", description="微信AppSecret")
    wechat_token: str = Field(..., env="WECHAT_TOKEN", description="微信Token")
    wechat_aes_key: str = Field(..., env="WECHAT_AES_KEY", description="微信AES加密密钥")
    
    # API安全配置
    api_keys: str = Field(..., env="WECHAT_API_KEYS", description="有效的API密钥")
    secret_key: str = Field(..., env="WECHAT_SECRET_KEY", description="应用密钥")
    
    # 数据存储配置
    data_dir: str = Field(default="./data", description="数据存储目录")
    user_bindings_file: str = Field(default="./data/user_bindings.json", description="用户绑定数据文件")
    
    # 日志配置
    log_level: str = Field(default="INFO", description="日志级别")
    log_file: str = Field(default="./logs/wechat_api.log", description="日志文件路径")
    
    # 微信API配置
    access_token_cache_seconds: int = Field(default=7200, description="访问令牌缓存秒数")
    qr_code_expire_seconds: int = Field(default=3600, description="二维码过期时间")
    
    # CORS配置
    cors_origins: str = Field(default="*", description="允许的CORS源")
    cors_methods: str = Field(default="*", description="允许的HTTP方法")
    cors_headers: str = Field(default="*", description="允许的HTTP头")
    
    class Config:
        # 环境变量前缀
        env_prefix = "WECHAT_"
        # 环境变量文件
        env_file = ".env"
        # 大小写敏感
        case_sensitive = False

@lru_cache()
def get_settings() -> Settings:
    """获取应用配置（缓存）"""
    
    # 手动加载.env文件
    env_file = Path('.env')
    if env_file.exists():
        load_dotenv(env_file)
        logger.info(f"Loaded environment variables from {env_file}")
    
    # 创建设置对象
    settings = Settings()
    
    # 创建必要的目录
    data_dir = Path(settings.data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)
    
    log_dir = Path(settings.log_file).parent
    log_dir.mkdir(parents=True, exist_ok=True)
    
    # 配置日志
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(settings.log_file),
            logging.StreamHandler()
        ]
    )
    
    logger.info(f"Configuration loaded: {settings.app_name} v{settings.version}")
    logger.info(f"Data directory: {settings.data_dir}")
    logger.info(f"Debug mode: {settings.debug}")
    
    return settings

def validate_configuration() -> bool:
    """验证配置完整性"""
    
    settings = get_settings()
    
    # 检查必要的微信配置
    if not settings.wechat_app_secret:
        logger.error("WECHAT_APP_SECRET is required but not set")
        return False
    
    if not settings.wechat_app_id:
        logger.error("WECHAT_APP_ID is required but not set")
        return False
    
    if not settings.api_keys:
        logger.error("API keys are required but not set")
        return False
    
    # 检查数据目录权限
    try:
        data_dir = Path(settings.data_dir)
        data_dir.mkdir(parents=True, exist_ok=True)
        
        # 测试写入权限
        test_file = data_dir / "test_write.tmp"
        test_file.write_text("test")
        test_file.unlink()
        
    except Exception as e:
        logger.error(f"Data directory not writable: {e}")
        return False
    
    logger.info("✓ Configuration validation passed")
    return True

def create_example_env_file():
    """创建示例环境变量文件"""
    
    env_example = """# WeChat Cloud API Service Configuration
# 复制此文件为.env并填入实际值

# 微信公众号配置
WECHAT_APP_ID=wx245aa02d3bbdcbeb
WECHAT_APP_SECRET=你的微信AppSecret
WECHAT_TOKEN=你的微信Token
WECHAT_AES_KEY=你的微信AES加密密钥(可选)

# API安全配置
WECHAT_API_KEYS=["your-api-key-1","your-api-key-2"]
WECHAT_SECRET_KEY=your-secret-key-here

# 服务器配置
WECHAT_HOST=0.0.0.0
WECHAT_PORT=8000
WECHAT_DEBUG=false

# 数据存储配置
WECHAT_DATA_DIR=./data
WECHAT_USER_BINDINGS_FILE=./data/user_bindings.json

# 日志配置
WECHAT_LOG_LEVEL=INFO
WECHAT_LOG_FILE=./logs/wechat_api.log

# 微信API配置
WECHAT_ACCESS_TOKEN_CACHE_SECONDS=7200
WECHAT_QR_CODE_EXPIRE_SECONDS=3600
"""
    
    env_file = Path(".env.example")
    env_file.write_text(env_example, encoding='utf-8')
    logger.info(f"Created example environment file: {env_file}")

def get_deployment_config(environment: str = "production") -> dict:
    """获取部署配置"""
    
    settings = get_settings()
    
    base_config = {
        "app_name": settings.app_name,
        "version": settings.version,
        "host": settings.host,
        "port": settings.port,
        "workers": settings.workers
    }
    
    if environment == "development":
        return {
            **base_config,
            "debug": True,
            "reload": True,
            "log_level": "debug"
        }
    elif environment == "production":
        return {
            **base_config,
            "debug": False,
            "reload": False,
            "log_level": "info",
            "access_log": True
        }
    elif environment == "docker":
        return {
            **base_config,
            "host": "0.0.0.0",
            "port": int(os.getenv("PORT", 8000)),
            "workers": int(os.getenv("WORKERS", 2))
        }
    
    return base_config

# 配置验证装饰器
def require_valid_config(func):
    """要求有效配置的装饰器"""
    def wrapper(*args, **kwargs):
        if not validate_configuration():
            raise RuntimeError("Invalid configuration")
        return func(*args, **kwargs)
    return wrapper

if __name__ == "__main__":
    # 运行配置验证和示例文件创建
    print("WeChat Cloud API Configuration Manager")
    print("=" * 40)
    
    try:
        settings = get_settings()
        print(f"✓ Configuration loaded for {settings.app_name}")
        
        if validate_configuration():
            print("✓ Configuration validation passed")
        else:
            print("✗ Configuration validation failed")
            
        create_example_env_file()
        print("✓ Example environment file created")
        
        # 显示当前配置摘要
        print(f"\nConfiguration Summary:")
        print(f"  App ID: {settings.wechat_app_id}")
        print(f"  Host: {settings.host}:{settings.port}")
        print(f"  Data Dir: {settings.data_dir}")
        print(f"  Debug Mode: {settings.debug}")
        
    except Exception as e:
        print(f"✗ Configuration error: {e}")
        exit(1)