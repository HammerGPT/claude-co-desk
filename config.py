"""
Claude Co-Desk 配置管理模块
统一管理所有系统配置，避免硬编码
"""

import os
import shutil
import socket
import ipaddress
from pathlib import Path
from typing import Optional

class Config:
    """系统配置管理类"""
    
    # 服务器配置
    HOST = os.getenv('HELIKI_HOST', '0.0.0.0')
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
    def get_user_home_project_name(cls) -> str:
        """获取用户家目录对应的Claude项目名称"""
        # 动态生成项目路径，避免硬编码
        home_path = cls.USER_HOME.replace('/', '-')
        if home_path.startswith('-'):
            return home_path
        else:
            return f'-{home_path}'
    
    @classmethod
    def get_server_config(cls) -> dict:
        """获取服务器配置"""
        return {
            'host': cls.HOST,
            'port': cls.PORT
        }
    
    @classmethod
    def get_local_ip(cls) -> str:
        """获取真正的局域网IP地址"""
        try:
            # Get all network interfaces
            hostname = socket.gethostname()
            ip_list = socket.gethostbyname_ex(hostname)[2]
            
            # Filter private network IPs
            private_ips = []
            for ip in ip_list:
                if ip != '127.0.0.1':
                    try:
                        addr = ipaddress.ip_address(ip)
                        if addr.is_private:
                            private_ips.append(ip)
                    except ValueError:
                        continue
            
            # Prefer 192.168.x.x IPs (most common home/office networks)
            for ip in private_ips:
                if ip.startswith('192.168.'):
                    return ip
            
            # Then prefer 10.x.x.x IPs
            for ip in private_ips:
                if ip.startswith('10.'):
                    return ip
            
            # Finally use any other private IP
            if private_ips:
                return private_ips[0]
            
            # Fallback to original method if no private IPs found
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
            return local_ip
            
        except Exception:
            return "127.0.0.1"  # Final fallback
    
    @classmethod
    def get_frontend_config(cls) -> dict:
        """获取前端需要的配置信息"""
        return {
            'userHome': cls.USER_HOME,
            'userHomeProjectName': cls.get_user_home_project_name(),
            'claudeCliPath': cls.get_claude_cli_path(),
            'serverPort': cls.PORT,
            'serverHost': cls.HOST,
            'localIp': cls.get_local_ip(),
            'localUrl': f"http://{cls.get_local_ip()}:{cls.PORT}",
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