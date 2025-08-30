"""
Configuration management for WeChat Notification MCP Service
Handles API configuration, user bindings, and activity logging
"""

import json
import os
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
import aiofiles

logger = logging.getLogger("wechat-config")

class Config:
    """Configuration manager for WeChat notification service"""
    
    def __init__(self):
        # Use current MCP service directory for all configurations
        self.service_dir = Path(__file__).parent
        self.config_file = self.service_dir / "wechat_config.json"
        self.bindings_file = self.service_dir / "user_bindings.json"
        self.logs_file = self.service_dir / "notification_logs.json"
        
        logger.info(f"WeChat config initialized in: {self.service_dir}")
        
        # Create config files if they don't exist
        self._ensure_config_files()
    
    def _ensure_config_files(self):
        """Ensure all configuration files exist with default values"""
        
        # Ensure service directory exists
        self.service_dir.mkdir(parents=True, exist_ok=True)
        
        # Create default API config if not exists
        if not self.config_file.exists():
            default_config = {
                "api_base": "https://your-server.com/api",
                "api_key": "your-api-key-here",
                "service_name": "Claude Co-Desk WeChat Notification",
                "version": "1.0.0",
                "timeout": 30,
                "retry_attempts": 3
            }
            self._write_json_file(self.config_file, default_config)
            logger.info("Created default API configuration")
        
        # Create empty bindings file if not exists
        if not self.bindings_file.exists():
            # 初始化带有结构的绑定文件
            initial_bindings = {
                "version": "1.0.0",
                "last_sync": None,
                "users": {},
                "binding_stats": {
                    "total_users": 0,
                    "active_bindings": 0,
                    "last_updated": datetime.now().isoformat()
                }
            }
            self._write_json_file(self.bindings_file, initial_bindings)
            logger.info("Created structured user bindings file")
        
        # Create empty logs file if not exists  
        if not self.logs_file.exists():
            self._write_json_file(self.logs_file, [])
            logger.info("Created empty notification logs file")
    
    def _write_json_file(self, file_path: Path, data: Any):
        """Write data to JSON file"""
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Error writing to {file_path}: {e}")
            raise
    
    async def _write_json_file_async(self, file_path: Path, data: Any):
        """Async write data to JSON file"""
        try:
            async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
                await f.write(json.dumps(data, indent=2, ensure_ascii=False))
        except Exception as e:
            logger.error(f"Error writing to {file_path}: {e}")
            raise
    
    def _read_json_file(self, file_path: Path) -> Any:
        """Read data from JSON file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            logger.warning(f"Config file not found: {file_path}")
            return {}
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in {file_path}: {e}")
            return {}
        except Exception as e:
            logger.error(f"Error reading {file_path}: {e}")
            return {}
    
    async def _read_json_file_async(self, file_path: Path) -> Any:
        """Async read data from JSON file"""
        try:
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                content = await f.read()
                return json.loads(content)
        except FileNotFoundError:
            logger.warning(f"Config file not found: {file_path}")
            return {}
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in {file_path}: {e}")
            return {}
        except Exception as e:
            logger.error(f"Error reading {file_path}: {e}")
            return {}

# Global configuration instance
_config = None

def get_config() -> Config:
    """Get global configuration instance"""
    global _config
    if _config is None:
        _config = Config()
    return _config

# API Configuration Functions

async def get_api_config() -> Dict[str, Any]:
    """Get API configuration"""
    config = get_config()
    
    # Try to get from environment variables first (similar to smtp-mail pattern)
    env_config = _get_env_api_config()
    if env_config:
        return env_config
    
    # Fallback to config file
    return config._read_json_file(config.config_file)

def _get_env_api_config() -> Optional[Dict[str, Any]]:
    """Get API configuration from environment variables"""
    api_base = os.getenv("WECHAT_API_BASE")
    api_key = os.getenv("WECHAT_API_KEY")
    
    if api_base and api_key:
        logger.info("Using WeChat API configuration from environment variables")
        return {
            "api_base": api_base,
            "api_key": api_key,
            "service_name": "Claude Co-Desk WeChat Notification (Env)",
            "version": "1.0.0",
            "timeout": int(os.getenv("WECHAT_API_TIMEOUT", "30")),
            "retry_attempts": int(os.getenv("WECHAT_API_RETRY", "3"))
        }
    
    logger.debug("Environment WeChat API config not found, using file config")
    return None

async def save_api_config(config_data: Dict[str, Any]) -> bool:
    """Save API configuration"""
    config = get_config()
    try:
        await config._write_json_file_async(config.config_file, config_data)
        logger.info("API configuration saved successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to save API configuration: {e}")
        return False

# User Bindings Functions

async def get_user_bindings() -> Dict[str, Any]:
    """Get all user bindings"""
    config = get_config()
    bindings_data = await config._read_json_file_async(config.bindings_file)
    
    # 兼容旧格式，自动升级到新格式
    if "users" not in bindings_data:
        logger.info("Upgrading bindings data to new format")
        new_format = {
            "version": "1.0.0",
            "last_sync": None,
            "users": bindings_data if bindings_data else {},
            "binding_stats": {
                "total_users": len(bindings_data) if bindings_data else 0,
                "active_bindings": len([u for u in bindings_data.values() if u.get("status") == "active"]) if bindings_data else 0,
                "last_updated": datetime.now().isoformat()
            }
        }
        await config._write_json_file_async(config.bindings_file, new_format)
        return new_format
    
    return bindings_data

async def get_user_binding(user_identifier: str) -> Optional[Dict[str, Any]]:
    """Get binding for specific user"""
    bindings_data = await get_user_bindings()
    return bindings_data.get("users", {}).get(user_identifier)

async def save_user_binding(user_identifier: str, binding_data: Dict[str, Any]) -> bool:
    """Save user binding"""
    config = get_config()
    try:
        bindings_data = await get_user_bindings()
        
        # 准备用户绑定数据
        user_binding = {
            "user_identifier": user_identifier,
            "status": binding_data.get("status", "active"),
            "cloud_binding_id": binding_data.get("cloud_binding_id"),
            "openid": binding_data.get("openid"),
            "nickname": binding_data.get("nickname", "WeChat User"),
            "bound_at": binding_data.get("bound_at", datetime.now().isoformat()),
            "last_notification": binding_data.get("last_notification"),
            "notification_count": binding_data.get("notification_count", 0),
            "notification_preferences": binding_data.get("notification_preferences", {
                "enabled": True,
                "types": ["task_completion", "system_alerts", "custom"]
            }),
            "updated_at": datetime.now().isoformat()
        }
        
        # 更新用户绑定
        bindings_data["users"][user_identifier] = user_binding
        
        # 更新统计信息
        total_users = len(bindings_data["users"])
        active_bindings = len([u for u in bindings_data["users"].values() if u.get("status") == "active"])
        
        bindings_data["binding_stats"] = {
            "total_users": total_users,
            "active_bindings": active_bindings,
            "last_updated": datetime.now().isoformat()
        }
        
        await config._write_json_file_async(config.bindings_file, bindings_data)
        logger.info(f"User binding saved for: {user_identifier} (Total: {total_users}, Active: {active_bindings})")
        return True
    except Exception as e:
        logger.error(f"Failed to save user binding: {e}")
        return False

async def remove_user_binding(user_identifier: str) -> bool:
    """Remove user binding"""
    config = get_config()
    try:
        bindings = await get_user_bindings()
        if user_identifier in bindings:
            del bindings[user_identifier]
            await config._write_json_file_async(config.bindings_file, bindings)
            logger.info(f"User binding removed for: {user_identifier}")
            return True
        else:
            logger.warning(f"No binding found for user: {user_identifier}")
            return False
    except Exception as e:
        logger.error(f"Failed to remove user binding: {e}")
        return False

# Notification Activity Logging Functions

async def log_notification_activity(log_entry: Dict[str, Any]) -> bool:
    """Log notification activity"""
    config = get_config()
    try:
        logs = await get_notification_logs()
        
        # Add timestamp if not present
        if "timestamp" not in log_entry:
            log_entry["timestamp"] = datetime.now().isoformat()
        
        logs.append(log_entry)
        
        # Keep only last 1000 log entries to prevent file from growing too large
        if len(logs) > 1000:
            logs = logs[-1000:]
        
        await config._write_json_file_async(config.logs_file, logs)
        logger.debug("Notification activity logged")
        return True
    except Exception as e:
        logger.error(f"Failed to log notification activity: {e}")
        return False

async def get_notification_logs() -> List[Dict[str, Any]]:
    """Get notification activity logs"""
    config = get_config()
    logs = await config._read_json_file_async(config.logs_file)
    return logs if isinstance(logs, list) else []

async def clear_notification_logs() -> bool:
    """Clear all notification logs"""
    config = get_config()
    try:
        await config._write_json_file_async(config.logs_file, [])
        logger.info("Notification logs cleared")
        return True
    except Exception as e:
        logger.error(f"Failed to clear notification logs: {e}")
        return False

# Health Check Functions

def get_service_status() -> Dict[str, Any]:
    """Get service status information"""
    config = get_config()
    
    status = {
        "service_name": "WeChat Notification MCP Service",
        "version": "1.0.0",
        "status": "running",
        "config_files": {
            "api_config": config.config_file.exists(),
            "user_bindings": config.bindings_file.exists(),
            "logs": config.logs_file.exists()
        }
    }
    
    return status