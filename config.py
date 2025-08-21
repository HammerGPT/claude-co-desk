"""
Claude Co-Desk 配置管理模块
统一管理所有系统配置，避免硬编码
"""

import os
import shutil
from pathlib import Path
from typing import Optional

class Config:
    """系统配置管理类"""
    
    # 服务器配置
    HOST = os.getenv('HELIKI_HOST', 'localhost')
    PORT = int(os.getenv('HELIKI_PORT', '3005'))
    
    # 路径配置
    USER_HOME = str(Path.home())
    
    # Claude CLI配置
    _claude_cli_path: Optional[str] = None
    
    @classmethod
    def get_user_home(cls) -> str:
        """获取用户主目录"""
        return cls.USER_HOME
    
    @classmethod
    def get_claude_cli_path(cls) -> Optional[str]:
        """动态检测Claude CLI路径"""
        if cls._claude_cli_path is not None:
            return cls._claude_cli_path
        
        # 使用与app.py中EnvironmentChecker相同的逻辑
        try:
            # 首先尝试从PATH环境变量中查找
            claude_path = shutil.which('claude')
            if claude_path:
                cls._claude_cli_path = claude_path
                return claude_path
            
            # 备用检查常见安装位置
            common_paths = [
                str(Path.home() / '.local' / 'bin' / 'claude'),
                '/usr/local/bin/claude',
                '/opt/homebrew/bin/claude'
            ]
            
            for path in common_paths:
                if Path(path).exists() and os.access(path, os.X_OK):
                    cls._claude_cli_path = path
                    return path
            
            return None
            
        except Exception:
            return None
    
    @classmethod
    def get_default_working_directory(cls) -> str:
        """获取默认工作目录（Claude CLI的默认工作目录）"""
        return cls.USER_HOME
    
    @classmethod
    def get_server_config(cls) -> dict:
        """获取服务器配置"""
        return {
            'host': cls.HOST,
            'port': cls.PORT
        }
    
    @classmethod
    def get_frontend_config(cls) -> dict:
        """获取前端需要的配置信息"""
        return {
            'userHome': cls.USER_HOME,
            'claudeCliPath': cls.get_claude_cli_path(),
            'serverPort': cls.PORT,
            'defaultWorkingDirectory': cls.get_default_working_directory(),
            'defaultLanguage': 'en',  # 默认语言为英文
            'supportedLanguages': ['en', 'zh']  # 支持的语言列表
        }
    
    @classmethod
    def get_language_config(cls) -> dict:
        """获取语言配置"""
        return {
            'defaultLanguage': 'en',
            'supportedLanguages': [
                {'code': 'en', 'name': 'English'},
                {'code': 'zh', 'name': '中文'}
            ]
        }
    
    @classmethod
    def reset_claude_cli_path_cache(cls):
        """重置Claude CLI路径缓存，用于测试或重新检测"""
        cls._claude_cli_path = None