"""
定时任务调度系统
负责管理和执行用户设定的定时任务
"""

import asyncio
import json
import logging
from datetime import datetime, time
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import threading
import schedule
import time as time_module

logger = logging.getLogger(__name__)

@dataclass
class ScheduledTask:
    """定时任务数据结构"""
    id: str
    name: str
    goal: str
    skip_permissions: bool
    resources: List[str]
    schedule_frequency: str  # 'daily' or 'weekly'
    schedule_time: str       # HH:MM format
    enabled: bool
    created_at: str
    last_run: Optional[str] = None

class TaskScheduler:
    """定时任务调度器"""
    
    def __init__(self, websocket_manager=None):
        self.websocket_manager = websocket_manager
        self.scheduled_tasks: Dict[str, ScheduledTask] = {}  # 定时任务
        self.all_tasks: Dict[str, ScheduledTask] = {}        # 所有任务（包括立即执行）
        self.scheduler_thread = None
        self.running = False
        
        logger.info("🕐 TaskScheduler 初始化完成")
    
    def start(self):
        """启动任务调度器"""
        if self.running:
            logger.warning("任务调度器已在运行中")
            return
        
        self.running = True
        self.scheduler_thread = threading.Thread(target=self._run_scheduler, daemon=True)
        self.scheduler_thread.start()
        logger.info("🚀 任务调度器已启动")
    
    def stop(self):
        """停止任务调度器"""
        self.running = False
        schedule.clear()
        if self.scheduler_thread:
            self.scheduler_thread.join(timeout=5)
        logger.info("⏹️ 任务调度器已停止")
    
    def _run_scheduler(self):
        """运行调度器循环"""
        logger.info("📅 任务调度器循环启动")
        while self.running:
            try:
                schedule.run_pending()
                time_module.sleep(60)  # 每分钟检查一次
            except Exception as e:
                logger.error(f"任务调度器运行错误: {e}")
                time_module.sleep(60)
    
    def add_scheduled_task(self, task_data: Dict[str, Any]) -> bool:
        """添加定时任务"""
        try:
            task = ScheduledTask(
                id=task_data['id'],
                name=task_data['name'],
                goal=task_data['goal'],
                skip_permissions=task_data.get('skipPermissions', False),
                resources=task_data.get('resources', []),
                schedule_frequency=task_data.get('scheduleFrequency', 'daily'),
                schedule_time=task_data.get('scheduleTime', '09:00'),
                enabled=task_data.get('enabled', True),
                created_at=task_data.get('createdAt', datetime.now().isoformat())
            )
            
            # 保存所有任务到all_tasks
            self.all_tasks[task.id] = task
            
            # 只有启用且为定时执行的任务才添加到调度器
            if task.enabled and task_data.get('executionMode') == 'scheduled':
                self.scheduled_tasks[task.id] = task
                self._schedule_task(task)
                logger.info(f"➕ 添加定时任务: {task.name} - {task.schedule_frequency} {task.schedule_time}")
            else:
                logger.info(f"➕ 保存立即执行任务: {task.name}")
            
            return True
            
        except Exception as e:
            logger.error(f"添加定时任务失败: {e}")
            return False
    
    def remove_scheduled_task(self, task_id: str) -> bool:
        """移除任务"""
        try:
            # 从所有任务中移除
            if task_id in self.all_tasks:
                task = self.all_tasks[task_id]
                del self.all_tasks[task_id]
                
                # 如果是定时任务，也从调度器中移除
                if task_id in self.scheduled_tasks:
                    self._unschedule_task(task)
                    del self.scheduled_tasks[task_id]
                    
                logger.info(f"➖ 移除任务: {task.name}")
                return True
            return False
        except Exception as e:
            logger.error(f"移除任务失败: {e}")
            return False
    
    def update_scheduled_task(self, task_data: Dict[str, Any]) -> bool:
        """更新定时任务"""
        try:
            task_id = task_data['id']
            
            # 保存原有任务信息（如果存在）
            original_task = None
            if task_id in self.all_tasks:
                original_task = self.all_tasks[task_id]
                logger.info(f"🔄 更新现有任务: {original_task.name}")
            
            # 确保任务数据完整性，保留原有的创建时间等信息
            if original_task:
                task_data.setdefault('createdAt', original_task.created_at)
                task_data.setdefault('lastRun', original_task.last_run)
            
            # 先移除现有任务（从调度器和存储中）
            if task_id in self.scheduled_tasks:
                self._unschedule_task(self.scheduled_tasks[task_id])
                del self.scheduled_tasks[task_id]
            
            if task_id in self.all_tasks:
                del self.all_tasks[task_id]
            
            # 重新添加任务
            success = self.add_scheduled_task(task_data)
            if success:
                logger.info(f"✅ 任务更新成功: {task_data.get('name', 'Unknown')}")
            return success
            
        except Exception as e:
            logger.error(f"更新定时任务失败: {e}")
            return False
    
    def toggle_task(self, task_id: str, enabled: bool) -> bool:
        """启用/禁用任务"""
        try:
            if task_id in self.scheduled_tasks:
                task = self.scheduled_tasks[task_id]
                task.enabled = enabled
                
                if enabled:
                    self._schedule_task(task)
                    logger.info(f"✅ 启用定时任务: {task.name}")
                else:
                    self._unschedule_task(task)
                    logger.info(f"⏸️ 禁用定时任务: {task.name}")
                
                return True
            return False
        except Exception as e:
            logger.error(f"切换任务状态失败: {e}")
            return False
    
    def _schedule_task(self, task: ScheduledTask):
        """将任务添加到schedule库"""
        try:
            # 解析时间
            hour, minute = map(int, task.schedule_time.split(':'))
            schedule_time = time(hour, minute)
            
            # 创建任务执行函数
            def execute_task():
                asyncio.create_task(self._execute_scheduled_task(task))
            
            # 根据频率设置调度
            if task.schedule_frequency == 'daily':
                schedule.every().day.at(task.schedule_time).do(execute_task).tag(task.id)
                logger.info(f"📅 任务 {task.name} 已设置为每日 {task.schedule_time} 执行")
            elif task.schedule_frequency == 'weekly':
                # 默认设置为每周一执行，可以后续扩展为指定星期几
                schedule.every().monday.at(task.schedule_time).do(execute_task).tag(task.id)
                logger.info(f"📅 任务 {task.name} 已设置为每周一 {task.schedule_time} 执行")
                
        except Exception as e:
            logger.error(f"设置任务调度失败: {e}")
    
    def _unschedule_task(self, task: ScheduledTask):
        """从schedule库移除任务"""
        try:
            schedule.clear(task.id)
            logger.info(f"🗑️ 任务 {task.name} 已从调度中移除")
        except Exception as e:
            logger.error(f"移除任务调度失败: {e}")
    
    async def _execute_scheduled_task(self, task: ScheduledTask):
        """执行定时任务"""
        try:
            logger.info(f"🎯 执行定时任务: {task.name}")
            
            # 更新最后执行时间
            task.last_run = datetime.now().isoformat()
            
            # 构建命令
            command = self._build_command(task)
            
            # 通过WebSocket通知前端创建新页签执行任务
            if self.websocket_manager:
                session_data = {
                    'type': 'new-task-session',
                    'taskId': task.id,
                    'taskName': f"📋 {task.name}",
                    'command': command,
                    'skipPermissions': task.skip_permissions,
                    'resources': task.resources,
                    'scheduledExecution': True
                }
                
                await self.websocket_manager.broadcast(session_data)
                logger.info(f"✅ 定时任务 {task.name} 执行请求已发送")
            
        except Exception as e:
            logger.error(f"执行定时任务失败: {task.name} - {e}")
    
    def _build_command(self, task: ScheduledTask) -> str:
        """构建Claude CLI命令"""
        parts = []
        
        # 1. 先添加文件引用（使用@语法）
        if task.resources:
            for resource in task.resources:
                # 使用@语法直接引用文件，Claude能直接读取文件内容
                parts.append(f"@{resource}")
        
        # 2. 添加空行分隔符
        if parts:
            parts.append('')
        
        # 3. 添加任务目标描述
        parts.append(task.goal)
        
        return ' '.join(parts)
    
    def get_scheduled_tasks(self) -> List[Dict[str, Any]]:
        """获取所有任务（包括立即执行和定时任务）"""
        tasks = []
        for task in self.all_tasks.values():
            tasks.append({
                'id': task.id,
                'name': task.name,
                'goal': task.goal,
                'skipPermissions': task.skip_permissions,
                'resources': task.resources,
                'scheduleFrequency': task.schedule_frequency,
                'scheduleTime': task.schedule_time,
                'enabled': task.enabled,
                'createdAt': task.created_at,
                'lastRun': task.last_run
            })
        return tasks
    
    def get_next_run_times(self) -> Dict[str, str]:
        """获取下次执行时间"""
        next_runs = {}
        for job in schedule.jobs:
            if hasattr(job, 'tags') and job.tags:
                task_id = list(job.tags)[0]
                next_run = job.next_run
                if next_run:
                    next_runs[task_id] = next_run.isoformat()
        return next_runs