"""
User Binding Manager
用户绑定管理系统
处理用户与微信的绑定关系、绑定token管理和消息日志
"""

import json
import aiofiles
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import uuid

logger = logging.getLogger("user-manager")

class UserBindingManager:
    """用户绑定管理器"""
    
    def __init__(self, data_file: str = "user_data.json"):
        self.data_file = Path(data_file)
        self._data: Dict[str, Any] = {
            "user_bindings": {},      # 用户绑定数据
            "bind_tokens": {},        # 绑定token数据
            "message_logs": [],       # 消息发送日志
            "created_at": datetime.now().isoformat(),
            "version": "1.0.0"
        }
        
        # 确保数据文件目录存在
        self.data_file.parent.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"User binding manager initialized with data file: {data_file}")
        
        # 初始化数据文件
        asyncio.create_task(self._init_data_file())
    
    async def _init_data_file(self):
        """初始化数据文件"""
        if not self.data_file.exists():
            await self._save_data()
            logger.info("Created new user data file")
        else:
            await self._load_data()
            logger.info("Loaded existing user data file")
    
    async def _load_data(self):
        """加载数据文件"""
        try:
            async with aiofiles.open(self.data_file, 'r', encoding='utf-8') as f:
                content = await f.read()
                self._data = json.loads(content)
            
            # 确保数据结构完整
            if "user_bindings" not in self._data:
                self._data["user_bindings"] = {}
            if "bind_tokens" not in self._data:
                self._data["bind_tokens"] = {}
            if "message_logs" not in self._data:
                self._data["message_logs"] = []
            
            logger.info(f"Data loaded: {len(self._data['user_bindings'])} users, {len(self._data['bind_tokens'])} tokens")
            
        except (FileNotFoundError, json.JSONDecodeError) as e:
            logger.warning(f"Error loading data file, using default data: {e}")
            await self._save_data()
        except Exception as e:
            logger.error(f"Unexpected error loading data: {e}")
            raise
    
    async def _save_data(self):
        """保存数据文件"""
        try:
            # 添加更新时间
            self._data["updated_at"] = datetime.now().isoformat()
            
            async with aiofiles.open(self.data_file, 'w', encoding='utf-8') as f:
                await f.write(json.dumps(self._data, indent=2, ensure_ascii=False))
            
            logger.debug("Data saved successfully")
            
        except Exception as e:
            logger.error(f"Error saving data: {e}")
            raise
    
    # User Binding Management
    
    async def get_user_binding(self, user_identifier: str) -> Optional[Dict[str, Any]]:
        """获取用户绑定信息"""
        await self._load_data()
        return self._data["user_bindings"].get(user_identifier)
    
    async def get_user_binding_by_openid(self, openid: str) -> Optional[Dict[str, Any]]:
        """根据OpenID查找用户绑定"""
        await self._load_data()
        for user_id, binding in self._data["user_bindings"].items():
            if binding.get("openid") == openid:
                return {"user_identifier": user_id, **binding}
        return None
    
    async def create_user_binding(self, user_identifier: str, binding_data: Dict[str, Any]) -> bool:
        """创建用户绑定"""
        try:
            await self._load_data()
            
            # 添加绑定时间和状态
            binding_info = {
                **binding_data,
                "bind_time": datetime.now().isoformat(),
                "last_interaction": datetime.now().isoformat(),
                "status": "active",
                "message_count": 0
            }
            
            self._data["user_bindings"][user_identifier] = binding_info
            await self._save_data()
            
            logger.info(f"User binding created for: {user_identifier}")
            return True
            
        except Exception as e:
            logger.error(f"Error creating user binding: {e}")
            return False
    
    async def update_user_binding(self, user_identifier: str, updates: Dict[str, Any]) -> bool:
        """更新用户绑定信息"""
        try:
            await self._load_data()
            
            if user_identifier not in self._data["user_bindings"]:
                logger.warning(f"User binding not found: {user_identifier}")
                return False
            
            # 更新绑定信息
            self._data["user_bindings"][user_identifier].update(updates)
            self._data["user_bindings"][user_identifier]["last_interaction"] = datetime.now().isoformat()
            
            await self._save_data()
            
            logger.info(f"User binding updated for: {user_identifier}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating user binding: {e}")
            return False
    
    async def delete_user_binding(self, user_identifier: str) -> bool:
        """删除用户绑定"""
        try:
            await self._load_data()
            
            if user_identifier in self._data["user_bindings"]:
                del self._data["user_bindings"][user_identifier]
                await self._save_data()
                
                logger.info(f"User binding deleted for: {user_identifier}")
                return True
            else:
                logger.warning(f"User binding not found: {user_identifier}")
                return False
                
        except Exception as e:
            logger.error(f"Error deleting user binding: {e}")
            return False
    
    async def list_user_bindings(self) -> Dict[str, Dict[str, Any]]:
        """列出所有用户绑定"""
        await self._load_data()
        return self._data["user_bindings"].copy()
    
    # Bind Token Management
    
    async def save_bind_token(self, bind_token: str, token_data: Dict[str, Any]) -> bool:
        """保存绑定token"""
        try:
            await self._load_data()
            
            token_info = {
                **token_data,
                "created_at": datetime.now().isoformat(),
                "token_id": str(uuid.uuid4()),
                "status": "pending"
            }
            
            self._data["bind_tokens"][bind_token] = token_info
            await self._save_data()
            
            logger.info(f"Bind token saved: {bind_token}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving bind token: {e}")
            return False
    
    async def get_bind_token(self, bind_token: str) -> Optional[Dict[str, Any]]:
        """获取绑定token信息"""
        await self._load_data()
        
        token_info = self._data["bind_tokens"].get(bind_token)
        
        if token_info:
            # 检查是否过期
            try:
                expires_at = datetime.fromisoformat(token_info.get("expires_at", ""))
                if datetime.now() > expires_at:
                    logger.warning(f"Bind token expired: {bind_token}")
                    return None
            except (ValueError, TypeError):
                logger.warning(f"Invalid expire time for token: {bind_token}")
        
        return token_info
    
    async def update_bind_token(self, bind_token: str, updates: Dict[str, Any]) -> bool:
        """更新绑定token状态"""
        try:
            await self._load_data()
            
            if bind_token not in self._data["bind_tokens"]:
                logger.warning(f"Bind token not found: {bind_token}")
                return False
            
            self._data["bind_tokens"][bind_token].update(updates)
            self._data["bind_tokens"][bind_token]["updated_at"] = datetime.now().isoformat()
            
            await self._save_data()
            
            logger.info(f"Bind token updated: {bind_token}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating bind token: {e}")
            return False
    
    async def clean_expired_tokens(self) -> int:
        """清理过期的绑定token"""
        try:
            await self._load_data()
            
            current_time = datetime.now()
            expired_tokens = []
            
            for token, token_info in self._data["bind_tokens"].items():
                try:
                    expires_at = datetime.fromisoformat(token_info.get("expires_at", ""))
                    if current_time > expires_at:
                        expired_tokens.append(token)
                except (ValueError, TypeError):
                    # 无效的过期时间，也标记为过期
                    expired_tokens.append(token)
            
            # 删除过期token
            for token in expired_tokens:
                del self._data["bind_tokens"][token]
            
            if expired_tokens:
                await self._save_data()
                logger.info(f"Cleaned {len(expired_tokens)} expired tokens")
            
            return len(expired_tokens)
            
        except Exception as e:
            logger.error(f"Error cleaning expired tokens: {e}")
            return 0
    
    # Message Activity Logging
    
    async def log_message_activity(self, log_entry: Dict[str, Any]) -> bool:
        """记录消息活动日志"""
        try:
            await self._load_data()
            
            # 添加日志ID和时间戳
            log_info = {
                **log_entry,
                "log_id": str(uuid.uuid4()),
                "timestamp": datetime.now().isoformat()
            }
            
            self._data["message_logs"].append(log_info)
            
            # 更新用户消息计数
            user_identifier = log_entry.get("user_identifier")
            if user_identifier and user_identifier in self._data["user_bindings"]:
                if log_entry.get("success", False):
                    current_count = self._data["user_bindings"][user_identifier].get("message_count", 0)
                    self._data["user_bindings"][user_identifier]["message_count"] = current_count + 1
                    self._data["user_bindings"][user_identifier]["last_message_time"] = datetime.now().isoformat()
            
            # 保持最新1000条日志记录
            if len(self._data["message_logs"]) > 1000:
                self._data["message_logs"] = self._data["message_logs"][-1000:]
            
            await self._save_data()
            
            logger.debug(f"Message activity logged: {log_entry.get('message_id', 'unknown')}")
            return True
            
        except Exception as e:
            logger.error(f"Error logging message activity: {e}")
            return False
    
    async def get_message_logs(
        self, 
        user_identifier: str = None, 
        days: int = 7,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """获取消息日志"""
        await self._load_data()
        
        logs = self._data["message_logs"]
        
        # 按用户过滤
        if user_identifier:
            logs = [log for log in logs if log.get("user_identifier") == user_identifier]
        
        # 按时间过滤
        if days > 0:
            cutoff_date = datetime.now() - timedelta(days=days)
            logs = [
                log for log in logs
                if datetime.fromisoformat(log.get("timestamp", "")) >= cutoff_date
            ]
        
        # 按时间排序（最新的在前）
        logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        
        # 限制数量
        if limit > 0:
            logs = logs[:limit]
        
        return logs
    
    async def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        await self._load_data()
        
        # 基础统计
        total_users = len(self._data["user_bindings"])
        total_tokens = len(self._data["bind_tokens"])
        total_messages = len(self._data["message_logs"])
        
        # 活跃用户统计（7天内有消息的用户）
        cutoff_date = datetime.now() - timedelta(days=7)
        active_users = 0
        
        for user_data in self._data["user_bindings"].values():
            try:
                last_message_time = user_data.get("last_message_time")
                if last_message_time:
                    last_time = datetime.fromisoformat(last_message_time)
                    if last_time >= cutoff_date:
                        active_users += 1
            except (ValueError, TypeError):
                continue
        
        # 成功率统计（最近7天）
        recent_logs = await self.get_message_logs(days=7, limit=0)
        successful_messages = sum(1 for log in recent_logs if log.get("success", False))
        success_rate = (successful_messages / len(recent_logs) * 100) if recent_logs else 0
        
        # 清理过期token
        expired_tokens = await self.clean_expired_tokens()
        
        return {
            "total_users": total_users,
            "active_users_7d": active_users,
            "total_tokens": total_tokens,
            "expired_tokens_cleaned": expired_tokens,
            "total_messages": total_messages,
            "messages_7d": len(recent_logs),
            "success_rate_7d": round(success_rate, 2),
            "last_updated": datetime.now().isoformat()
        }