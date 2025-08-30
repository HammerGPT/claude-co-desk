#!/usr/bin/env python3
"""
调试环境变量读取
"""
import os
from pathlib import Path
from pydantic import BaseSettings, Field

class DebugSettings(BaseSettings):
    # 微信公众号配置
    wechat_app_id: str = Field(..., description="微信AppID")
    wechat_app_secret: str = Field(..., description="微信AppSecret")
    wechat_token: str = Field(..., description="微信Token")
    wechat_aes_key: str = Field(..., description="微信AES加密密钥")
    
    class Config:
        env_prefix = "WECHAT_"
        env_file = ".env"
        case_sensitive = False

print("=== 环境变量调试 ===")
print(f"当前工作目录: {os.getcwd()}")
print(f".env 文件是否存在: {Path('.env').exists()}")

if Path('.env').exists():
    print("\n=== .env 文件内容 ===")
    with open('.env', 'r', encoding='utf-8') as f:
        content = f.read()
        print(content)
else:
    print("❌ .env 文件不存在!")

print("\n=== 直接读取环境变量 ===")
env_vars = ['WECHAT_APP_ID', 'WECHAT_APP_SECRET', 'WECHAT_TOKEN', 'WECHAT_AES_KEY']
for var in env_vars:
    value = os.getenv(var, 'NOT_SET')
    print(f"{var}: {value}")

print("\n=== 使用python-dotenv加载 ===")
try:
    from dotenv import load_dotenv
    load_dotenv('.env')
    print("✓ dotenv加载成功")
    
    for var in env_vars:
        value = os.getenv(var, 'NOT_SET')
        print(f"{var}: {value}")
except ImportError:
    print("❌ python-dotenv未安装")

print("\n=== 尝试创建Settings ===")
try:
    # 使用python-dotenv手动加载
    if Path('.env').exists():
        from dotenv import load_dotenv
        load_dotenv('.env')
        
    # 重新设置环境变量（手动确保环境变量被设置）
    env_vars = {
        'WECHAT_APP_ID': os.getenv('WECHAT_APP_ID'),
        'WECHAT_APP_SECRET': os.getenv('WECHAT_APP_SECRET'),
        'WECHAT_TOKEN': os.getenv('WECHAT_TOKEN'),
        'WECHAT_AES_KEY': os.getenv('WECHAT_AES_KEY'),
    }
    
    print("加载后的环境变量:")
    for k, v in env_vars.items():
        print(f"  {k}: {v}")
        if v:
            os.environ[k] = v
    
    settings = DebugSettings(_env_file='.env')
    print("✓ Settings创建成功")
    print(f"APP_ID: {settings.wechat_app_id}")
except Exception as e:
    print(f"❌ Settings创建失败: {e}")
    
print("\n=== 测试真实config.py ===")
try:
    from config import get_settings
    settings = get_settings()
    print("✓ 真实Settings创建成功")
    print(f"APP_ID: {settings.wechat_app_id}")
    print(f"PORT: {settings.port}")
except Exception as e:
    print(f"❌ 真实Settings创建失败: {e}")