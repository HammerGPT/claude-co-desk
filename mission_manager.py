"""
任务工作目录管理模块
负责创建、管理和清理任务工作目录
"""

import os
import logging
import random
import string
from typing import List, Dict, Any, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

class MissionManager:
    """任务目录管理器"""
    
    def __init__(self, base_mission_dir: str = "mission"):
        """
        初始化任务目录管理器
        
        Args:
            base_mission_dir: mission基础目录路径
        """
        self.base_mission_dir = Path(base_mission_dir).resolve()
        self._ensure_base_directory()
        logger.info(f"📁 MissionManager初始化: {self.base_mission_dir}")
    
    def _ensure_base_directory(self):
        """确保mission基础目录存在"""
        try:
            self.base_mission_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f"✅ Mission基础目录已创建: {self.base_mission_dir}")
        except Exception as e:
            logger.error(f"❌ 创建mission基础目录失败: {e}")
            raise
    
    def _generate_random_suffix(self, length: int = 6) -> str:
        """生成随机后缀"""
        return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))
    
    def create_task_directory(self, task_id: str, task_name: str = "") -> str:
        """
        为任务创建工作目录
        
        Args:
            task_id: 任务ID
            task_name: 任务名称（可选，用于日志）
            
        Returns:
            str: 创建的工作目录绝对路径
            
        Raises:
            Exception: 目录创建失败时抛出异常
        """
        try:
            # 生成目录名：task_id_随机后缀
            random_suffix = self._generate_random_suffix()
            dir_name = f"{task_id}_{random_suffix}"
            task_dir = self.base_mission_dir / dir_name
            
            # 创建目录
            task_dir.mkdir(parents=True, exist_ok=True)
            
            # 创建任务信息文件
            task_info = {
                "task_id": task_id,
                "task_name": task_name,
                "directory_name": dir_name,
                "created_at": "",
                "description": "任务工作目录，所有AI生成的文件应保存在此"
            }
            
            info_file = task_dir / "task_info.json"
            import json
            with open(info_file, 'w', encoding='utf-8') as f:
                json.dump(task_info, f, ensure_ascii=False, indent=2)
            
            logger.info(f"✅ 为任务 '{task_name}' ({task_id}) 创建工作目录: {task_dir}")
            return str(task_dir)
            
        except Exception as e:
            logger.error(f"❌ 创建任务目录失败: {task_id} - {e}")
            raise
    
    def list_task_files(self, work_directory: str) -> List[Dict[str, Any]]:
        """
        列出任务目录下的所有文件
        
        Args:
            work_directory: 任务工作目录路径
            
        Returns:
            List[Dict]: 文件信息列表，格式与项目文件API一致
        """
        try:
            if not work_directory or not os.path.exists(work_directory):
                logger.warning(f"⚠️ 任务目录不存在: {work_directory}")
                return []
            
            work_dir = Path(work_directory)
            files = []
            
            for item in work_dir.iterdir():
                try:
                    if item.is_file():
                        # 获取文件信息
                        stat = item.stat()
                        file_info = {
                            "name": item.name,
                            "path": str(item.relative_to(work_dir)),
                            "full_path": str(item),
                            "type": "file",
                            "size": stat.st_size,
                            "modified": stat.st_mtime,
                            "is_directory": False
                        }
                        files.append(file_info)
                    elif item.is_dir():
                        # 目录信息
                        dir_info = {
                            "name": item.name,
                            "path": str(item.relative_to(work_dir)),
                            "full_path": str(item),
                            "type": "directory", 
                            "size": 0,
                            "modified": item.stat().st_mtime,
                            "is_directory": True
                        }
                        files.append(dir_info)
                        
                        # 递归添加子目录文件
                        for subitem in item.rglob("*"):
                            if subitem.is_file():
                                stat = subitem.stat()
                                file_info = {
                                    "name": subitem.name,
                                    "path": str(subitem.relative_to(work_dir)),
                                    "full_path": str(subitem),
                                    "type": "file",
                                    "size": stat.st_size,
                                    "modified": stat.st_mtime,
                                    "is_directory": False
                                }
                                files.append(file_info)
                                
                except Exception as e:
                    logger.warning(f"⚠️ 处理文件失败: {item} - {e}")
                    continue
            
            # 按名称排序
            files.sort(key=lambda x: (x["is_directory"], x["name"].lower()))
            
            logger.info(f"📂 任务目录 {work_directory} 包含 {len(files)} 个文件/目录")
            return files
            
        except Exception as e:
            logger.error(f"❌ 列出任务文件失败: {work_directory} - {e}")
            return []
    
    def get_task_directory_info(self, work_directory: str) -> Optional[Dict[str, Any]]:
        """
        获取任务目录的详细信息
        
        Args:
            work_directory: 任务工作目录路径
            
        Returns:
            Dict: 目录信息，包括文件数量、总大小等
        """
        try:
            if not work_directory or not os.path.exists(work_directory):
                return None
                
            work_dir = Path(work_directory)
            files = list(work_dir.rglob("*"))
            file_count = len([f for f in files if f.is_file()])
            total_size = sum(f.stat().st_size for f in files if f.is_file())
            
            return {
                "directory": str(work_dir),
                "exists": True,
                "file_count": file_count,
                "total_size": total_size,
                "created_at": work_dir.stat().st_ctime,
                "modified_at": work_dir.stat().st_mtime
            }
            
        except Exception as e:
            logger.error(f"❌ 获取目录信息失败: {work_directory} - {e}")
            return None
    
    def cleanup_empty_directories(self) -> int:
        """
        清理空的任务目录
        
        Returns:
            int: 清理的目录数量
        """
        cleaned_count = 0
        try:
            for item in self.base_mission_dir.iterdir():
                if item.is_dir():
                    # 检查目录是否只包含task_info.json文件
                    files = list(item.iterdir())
                    if len(files) <= 1 and (len(files) == 0 or files[0].name == "task_info.json"):
                        try:
                            import shutil
                            shutil.rmtree(item)
                            cleaned_count += 1
                            logger.info(f"🗑️ 清理空目录: {item}")
                        except Exception as e:
                            logger.warning(f"⚠️ 清理目录失败: {item} - {e}")
                            
            if cleaned_count > 0:
                logger.info(f"🧹 清理完成，删除了 {cleaned_count} 个空目录")
                
        except Exception as e:
            logger.error(f"❌ 清理目录失败: {e}")
            
        return cleaned_count