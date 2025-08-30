#!/usr/bin/env python3
"""
用户配置管理模块
负责用户标识符生成、API密钥注册和本地配置存储
"""

import os
import json
import time
import secrets
import logging
import aiohttp
from typing import Optional, Dict, Any
from pathlib import Path

logger = logging.getLogger(__name__)

# 配置文件路径
USER_CONFIG_FILE = os.path.join(os.path.dirname(__file__), ".user_config.json")
WECHAT_API_BASE = "https://www.heliki.com/wechat"

class UserConfigManager:
    """用户配置管理器"""
    
    def __init__(self):
        self.config_file = USER_CONFIG_FILE
        self._config = None
    
    def generate_user_identifier(self) -> str:
        """生成唯一用户标识符"""
        timestamp = int(time.time())
        random_part = secrets.token_hex(4)
        return f"user_{timestamp}_{random_part}"
    
    def load_config(self) -> Optional[Dict[str, Any]]:
        """加载本地配置"""
        if self._config is not None:
            return self._config
            
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    self._config = json.load(f)
                    logger.info("User config loaded successfully")
                    return self._config
        except Exception as e:
            logger.error(f"Failed to load user config: {e}")
        
        return None
    
    def save_config(self, config: Dict[str, Any]) -> bool:
        """保存配置到本地"""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
            self._config = config
            logger.info("User config saved successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to save user config: {e}")
            return False
    
    async def register_with_server(self, user_identifier: str) -> Optional[str]:
        """向服务器注册并获取API密钥"""
        try:
            async with aiohttp.ClientSession() as session:
                data = {"user_identifier": user_identifier}
                
                async with session.post(
                    f"{WECHAT_API_BASE}/register",
                    json=data,
                    headers={"Content-Type": "application/json"},
                    timeout=10
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        if result.get("success"):
                            api_key = result.get("api_key")
                            logger.info(f"Registration successful, API key: {api_key[:12]}...")
                            return api_key
                        else:
                            logger.error(f"Registration failed: {result.get('error')}")
                    else:
                        logger.error(f"Registration request failed with status: {response.status}")
        
        except Exception as e:
            logger.error(f"Failed to register with server: {e}")
        
        return None
    
    async def ensure_user_registration(self) -> Dict[str, Any]:
        """确保用户已注册，返回配置信息"""
        config = self.load_config()
        
        # 如果已有配置且有效，直接返回
        if config and config.get("user_identifier") and config.get("api_key"):
            logger.info("User already registered")
            return config
        
        logger.info("No valid user config found, initiating registration...")
        
        # 生成用户标识符
        user_identifier = self.generate_user_identifier()
        logger.info(f"Generated user identifier: {user_identifier}")
        
        # 向服务器注册
        api_key = await self.register_with_server(user_identifier)
        
        if not api_key:
            raise Exception("Failed to register with server")
        
        # 保存配置
        new_config = {
            "user_identifier": user_identifier,
            "api_key": api_key,
            "registered_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "registration_version": "1.0"
        }
        
        if self.save_config(new_config):
            logger.info("User registration completed successfully")
            return new_config
        else:
            raise Exception("Failed to save user configuration")

# 全局实例
user_config_manager = UserConfigManager()

async def get_user_config() -> Dict[str, Any]:
    """获取用户配置的便捷函数"""
    return await user_config_manager.ensure_user_registration()

def get_api_key() -> Optional[str]:
    """获取API密钥的便捷函数"""
    config = user_config_manager.load_config()
    return config.get("api_key") if config else None