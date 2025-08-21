"""
任务持久化存储模块
负责任务数据的保存和加载
"""

import json
import logging
import os
from typing import Dict, List, Any
from pathlib import Path

logger = logging.getLogger(__name__)

class TasksStorage:
    """任务数据存储管理器"""
    
    def __init__(self, storage_file: str = "tasks.json"):
        self.storage_file = Path(storage_file)
        self.ensure_storage_file()
        logger.info(f"Task storage initialization: {self.storage_file}")
    
    def ensure_storage_file(self):
        """确保存储文件存在"""
        if not self.storage_file.exists():
            self.save_tasks([])
            logger.info(f"Creating new task storage file: {self.storage_file}")
    
    def save_tasks(self, tasks: List[Dict[str, Any]]) -> bool:
        """保存任务数据到JSON文件"""
        try:
            with open(self.storage_file, 'w', encoding='utf-8') as f:
                json.dump(tasks, f, ensure_ascii=False, indent=2)
            logger.info(f"Saving.*tasks to storage file")
            return True
        except Exception as e:
            logger.error(f"保存任务失败: {e}")
            return False
    
    def load_tasks(self) -> List[Dict[str, Any]]:
        """从JSON文件加载任务数据"""
        try:
            if not self.storage_file.exists():
                logger.info("Storage file does not exist, returning empty task list")
                return []
            
            with open(self.storage_file, 'r', encoding='utf-8') as f:
                tasks = json.load(f)
            
            # 确保返回的是列表
            if not isinstance(tasks, list):
                logger.warning("存储文件格式错误，返回空列表")
                return []
                
            logger.info(f"Loading.*tasks from storage file")
            return tasks
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON解析错误: {e}")
            return []
        except Exception as e:
            logger.error(f"加载任务失败: {e}")
            return []
    
    def backup_tasks(self) -> bool:
        """备份当前任务文件"""
        try:
            if not self.storage_file.exists():
                return False
                
            backup_file = self.storage_file.with_suffix('.backup.json')
            import shutil
            shutil.copy2(self.storage_file, backup_file)
            logger.info(f" Task data backed up to: {backup_file}")
            return True
        except Exception as e:
            logger.error(f"备份任务失败: {e}")
            return False