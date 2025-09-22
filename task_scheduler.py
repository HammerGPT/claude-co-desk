"""
定时任务调度系统
负责管理和执行用户设定的定时任务
"""

import asyncio
import json
import logging
import os
from datetime import datetime, time
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import threading
import schedule
import time as time_module
from tasks_storage import TasksStorage
from mission_manager import MissionManager

logger = logging.getLogger(__name__)

# Import build_task_command function for unified command building
def get_build_task_command():
    """Lazy import to avoid circular import"""
    from app import build_task_command
    return build_task_command

# Time context generation function for mobile_task_handler compatibility
def get_current_time_context():
    """Generate unified time context information for Claude commands"""
    try:
        import pytz
        from datetime import datetime

        # Get local time (Asia/Shanghai timezone) and UTC time
        local_tz = pytz.timezone('Asia/Shanghai')
        now_local = datetime.now(local_tz)
        now_utc = datetime.now(pytz.UTC)

        time_context = f"[Current Time Context] Local time: {now_local.strftime('%Y-%m-%d %H:%M:%S %Z')}, UTC time: {now_utc.strftime('%Y-%m-%d %H:%M:%S %Z')}"
        return time_context
    except Exception as e:
        logger.warning(f"Failed to generate time context: {e}")
        # Fallback to basic datetime if pytz is not available
        from datetime import datetime
        now = datetime.now()
        return f"[Current Time Context] Local time: {now.strftime('%Y-%m-%d %H:%M:%S')}"

def task_to_dict(task: 'ScheduledTask') -> dict:
    """Convert ScheduledTask object to task_data dict format"""
    return {
        'id': task.id,
        'name': task.name,
        'goal': task.goal,
        'role': getattr(task, 'role', ''),
        'goal_config': getattr(task, 'goal_config', ''),
        'skipPermissions': task.skip_permissions,
        'verboseLogs': task.verbose_logs,
        'resources': task.resources,
        'notificationSettings': getattr(task, 'notification_settings', {}),
    }




@dataclass
class ScheduledTask:
    """定时任务数据结构"""
    id: str
    name: str
    goal: str
    skip_permissions: bool
    verbose_logs: bool
    resources: List[str]
    schedule_frequency: str  # 'daily' or 'weekly'
    schedule_time: str       # HH:MM format
    enabled: bool
    created_at: str
    last_run: Optional[str] = None
    work_directory: str = ""  # 任务工作目录
    deleted: bool = False     # 软删除标记
    session_id: Optional[str] = None  # Claude CLI会话ID，用于恢复会话
    notification_settings: Optional[Dict[str, Any]] = None  # 通知设置
    role: str = ""  # AI员工角色
    goal_config: str = ""  # 专业目标设定
    execution_mode: str = "immediate"  # 执行模式：background, immediate, scheduled

class TaskScheduler:
    """定时任务调度器"""
    
    def __init__(self, websocket_manager=None):
        self.websocket_manager = websocket_manager
        self.scheduled_tasks: Dict[str, ScheduledTask] = {}  # 定时任务
        self.all_tasks: Dict[str, ScheduledTask] = {}        # 所有任务（包括立即执行）
        self.scheduler_thread = None
        self.running = False
        self.storage = TasksStorage()  # 初始化存储管理器
        self.mission_manager = MissionManager()  # 初始化任务目录管理器
        self.main_loop = None  # 保存主事件循环引用
        
        logger.info("TaskScheduler initialization completed")
    
    def start(self):
        """启动任务调度器"""
        if self.running:
            logger.warning("Task scheduler already running")
            return
        
        # 保存主事件循环引用，用于跨线程异步调用
        try:
            self.main_loop = asyncio.get_running_loop()
            logger.info("Main event loop reference saved")
        except RuntimeError:
            logger.warning("Unable to get current event loop, WebSocket communication may be affected")
            self.main_loop = None
        
        # 先从存储文件加载任务
        self._load_tasks_from_storage()
        
        self.running = True
        self.scheduler_thread = threading.Thread(target=self._run_scheduler, daemon=True)
        self.scheduler_thread.start()
        logger.info("Task scheduler started")
    
    def stop(self):
        """停止任务调度器"""
        self.running = False
        schedule.clear()
        if self.scheduler_thread:
            self.scheduler_thread.join(timeout=5)
        logger.info("Task scheduler stopped")
    
    def _run_scheduler(self):
        """运行调度器循环"""
        logger.info("Task scheduler loop started")
        while self.running:
            try:
                # 添加调试信息：显示当前时间和待执行任务
                current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                pending_jobs = len([job for job in schedule.jobs if job.should_run])
                
                if pending_jobs > 0:
                    logger.info(f"Current time: {current_time}, found {pending_jobs} pending tasks")
                
                # 执行待处理的任务
                schedule.run_pending()
                time_module.sleep(60)  # 每分钟检查一次
            except Exception as e:
                logger.error(f"Task scheduler runtime error: {e}")
                time_module.sleep(60)
    
    def add_scheduled_task(self, task_data: Dict[str, Any]) -> bool:
        """添加定时任务"""
        try:
            # 如果没有工作目录，自动创建一个
            work_directory = task_data.get('workDirectory', '')
            if not work_directory:
                work_directory = self.mission_manager.create_task_directory(
                    task_data['id'], 
                    task_data['name']
                )
            
            task = ScheduledTask(
                id=task_data['id'],
                name=task_data['name'],
                goal=task_data['goal'],
                skip_permissions=task_data.get('skipPermissions', False),
                verbose_logs=task_data.get('verboseLogs', False),
                resources=task_data.get('resources', []),
                schedule_frequency=task_data.get('scheduleFrequency', 'daily'),
                schedule_time=task_data.get('scheduleTime', '09:00'),
                enabled=task_data.get('enabled', True),
                created_at=task_data.get('createdAt', datetime.now().isoformat()),
                work_directory=work_directory,
                deleted=task_data.get('deleted', False),
                session_id=task_data.get('sessionId', None),
                notification_settings=task_data.get('notificationSettings'),
                role=task_data.get('role', ''),
                goal_config=task_data.get('goal_config', ''),
                execution_mode=task_data.get('executionMode', 'immediate')  # 保持原有executionMode
            )
            
            # 保存所有任务到all_tasks
            self.all_tasks[task.id] = task
            
            # 只有启用且为定时执行的任务才添加到调度器
            if task.enabled and task_data.get('executionMode') == 'scheduled':
                self.scheduled_tasks[task.id] = task
                self._schedule_task(task)
                logger.info(f"Adding scheduled task: {task.name} - {task.schedule_frequency} {task.schedule_time}")
            else:
                logger.info(f"Saving immediate execution task: {task.name}")
            
            # 自动保存到存储文件
            self._save_tasks_to_storage()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to add scheduled task: {e}")
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
                    
                logger.info(f"Removing task: {task.name}")
                
                # 自动保存到存储文件
                self._save_tasks_to_storage()
                
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to remove task: {e}")
            return False
    
    def update_scheduled_task(self, task_data: Dict[str, Any]) -> bool:
        """更新定时任务"""
        try:
            task_id = task_data['id']
            
            # 保存原有任务信息（如果存在）
            original_task = None
            if task_id in self.all_tasks:
                original_task = self.all_tasks[task_id]
                logger.info(f"Updating existing task: {original_task.name}")
            
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
                logger.info(f"Task update successful: {task_data.get('name', 'Unknown')}")
                # 注意：add_scheduled_task 已经会自动保存，这里不需要重复保存
            return success
            
        except Exception as e:
            logger.error(f"Failed to update scheduled task: {e}")
            return False
    
    def toggle_task(self, task_id: str, enabled: bool) -> bool:
        """启用/禁用任务"""
        try:
            if task_id in self.scheduled_tasks:
                task = self.scheduled_tasks[task_id]
                task.enabled = enabled
                
                if enabled:
                    self._schedule_task(task)
                    logger.info(f"Enabling scheduled task: {task.name}")
                else:
                    self._unschedule_task(task)
                    logger.info(f"Disabling scheduled task: {task.name}")
                
                # 自动保存到存储文件
                self._save_tasks_to_storage()
                
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to toggle task status: {e}")
            return False
    
    def _schedule_task(self, task: ScheduledTask):
        """将任务添加到schedule库"""
        try:
            # 解析时间
            hour, minute = map(int, task.schedule_time.split(':'))
            schedule_time = time(hour, minute)
            
            # 创建任务执行函数 - 修复异步调用问题
            def execute_task():
                logger.info(f"Schedule library triggering task execution: {task.name}")
                self._execute_task_sync(task)
            
            # 根据频率设置调度
            if task.schedule_frequency == 'daily':
                schedule.every().day.at(task.schedule_time).do(execute_task).tag(task.id)
                logger.info(f"Task {task.name} set to execute daily at {task.schedule_time}")
            elif task.schedule_frequency == 'weekly':
                # 默认设置为每周一执行，可以后续扩展为指定星期几
                schedule.every().monday.at(task.schedule_time).do(execute_task).tag(task.id)
                logger.info(f"Task {task.name} set to execute every Monday at {task.schedule_time}")
                
        except Exception as e:
            logger.error(f"Failed to set task schedule: {e}")
    
    def _unschedule_task(self, task: ScheduledTask):
        """从schedule库移除任务"""
        try:
            schedule.clear(task.id)
            logger.info(f"Task {task.name} removed from schedule")
        except Exception as e:
            logger.error(f"Failed to remove task schedule: {e}")
    
    def get_scheduled_tasks(self) -> List[Dict[str, Any]]:
        """获取所有任务（包括立即执行和定时任务），过滤已删除任务"""
        tasks = []
        for task in self.all_tasks.values():
            # 过滤已删除的任务
            if task.deleted:
                continue
                
            tasks.append({
                'id': task.id,
                'name': task.name,
                'goal': task.goal,
                'role': task.role,  # 添加角色字段
                'goal_config': task.goal_config,  # 添加目标设定字段
                'skipPermissions': task.skip_permissions,
                'verboseLogs': task.verbose_logs,
                'resources': task.resources,
                'scheduleFrequency': task.schedule_frequency,
                'scheduleTime': task.schedule_time,
                'enabled': task.enabled,
                'createdAt': task.created_at,
                'lastRun': task.last_run,
                'workDirectory': task.work_directory,
                'deleted': task.deleted,
                'sessionId': task.session_id  # 添加sessionId字段到API响应
            })
        return tasks
    
    def delete_task(self, task_id: str) -> bool:
        """软删除任务"""
        try:
            if task_id in self.all_tasks:
                task = self.all_tasks[task_id]
                task.deleted = True
                
                # 如果是定时任务，从调度器中移除
                if task_id in self.scheduled_tasks:
                    self._unschedule_task(task)
                    del self.scheduled_tasks[task_id]
                
                # 保存更改
                self._save_tasks_to_storage()
                
                logger.info(f"Task marked for deletion: {task.name}")
                return True
                
            logger.debug(f"Task to delete does not exist: {task_id}")
            return False
            
        except Exception as e:
            logger.error(f"Failed to delete task: {task_id} - {e}")
            return False
    
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
    
    def get_scheduler_status(self) -> Dict[str, Any]:
        """获取调度器状态信息"""
        return {
            'running': self.running,
            'total_jobs': len(schedule.jobs),
            'scheduled_tasks_count': len(self.scheduled_tasks),
            'all_tasks_count': len(self.all_tasks),
            'current_time': datetime.now().isoformat(),
            'jobs': [
                {
                    'tag': list(job.tags)[0] if job.tags else 'unknown',
                    'next_run': job.next_run.isoformat() if job.next_run else None,
                    'should_run': job.should_run
                }
                for job in schedule.jobs
            ]
        }
    
    def _load_tasks_from_storage(self):
        """从存储文件加载任务数据"""
        try:
            tasks_data = self.storage.load_tasks()
            loaded_count = 0
            scheduled_count = 0
            mobile_skipped_count = 0
            
            for task_data in tasks_data:
                try:
                    # 跳过移动端任务（只加载PC任务到调度器）
                    is_mobile = (
                        task_data.get('source') == 'mobile' or 
                        task_data.get('taskType') == 'mobile' or 
                        task_data.get('type') == 'mobile'
                    )
                    if is_mobile:
                        mobile_skipped_count += 1
                        continue
                    
                    # 重建任务对象
                    task = ScheduledTask(
                        id=task_data['id'],
                        name=task_data['name'],
                        goal=task_data['goal'],
                        skip_permissions=task_data.get('skipPermissions', False),
                        verbose_logs=task_data.get('verboseLogs', False),
                        resources=task_data.get('resources', []),
                        schedule_frequency=task_data.get('scheduleFrequency', 'daily'),
                        schedule_time=task_data.get('scheduleTime', '09:00'),
                        enabled=task_data.get('enabled', True),
                        created_at=task_data.get('createdAt', datetime.now().isoformat()),
                        last_run=task_data.get('lastRun'),
                        work_directory=task_data.get('workDirectory', ''),
                        deleted=task_data.get('deleted', False),
                        session_id=task_data.get('sessionId'),  # 确保加载session_id
                        notification_settings=task_data.get('notificationSettings'),
                        role=task_data.get('role', ''),
                        goal_config=task_data.get('goal_config', ''),
                        execution_mode=task_data.get('executionMode', 'immediate')  # 保持原有executionMode
                    )
                    
                    # 优化调试日志
                    logger.debug(f"Loaded PC task: {task.id} - {task.name} (sessionId: {task.session_id or 'None'})")
                    
                    # 添加到all_tasks
                    self.all_tasks[task.id] = task
                    loaded_count += 1
                    
                    # 如果是启用的定时任务，添加到调度器
                    if task.enabled and task_data.get('executionMode') == 'scheduled':
                        self.scheduled_tasks[task.id] = task
                        self._schedule_task(task)
                        scheduled_count += 1
                        
                except Exception as e:
                    logger.error(f"Failed to load task: {task_data.get('name', 'Unknown')} - {e}")
                    
            logger.info(f"Task scheduler loaded {loaded_count} PC tasks from storage ({scheduled_count} scheduled, {mobile_skipped_count} mobile tasks skipped)")
            
        except Exception as e:
            logger.error(f"Failed to load task data: {e}")
    
    def _save_tasks_to_storage(self):
        """保存任务数据到存储文件"""
        try:
            tasks_data = []
            for task in self.all_tasks.values():
                # 使用任务自己的execution_mode，不要强制重新计算

                task_data = {
                    'id': task.id,
                    'name': task.name,
                    'goal': task.goal,
                    'role': task.role,
                    'goal_config': task.goal_config,
                    'skipPermissions': task.skip_permissions,
                    'verboseLogs': task.verbose_logs,
                    'resources': task.resources,
                    'scheduleFrequency': task.schedule_frequency,
                    'scheduleTime': task.schedule_time,
                    'enabled': task.enabled,
                    'createdAt': task.created_at,
                    'lastRun': task.last_run,
                    'workDirectory': task.work_directory,
                    'deleted': task.deleted,
                    'executionMode': task.execution_mode,  # 保持原有的executionMode
                    'sessionId': task.session_id
                }
                tasks_data.append(task_data)
                
            success = self.storage.save_tasks(tasks_data)
            if success:
                logger.debug(f"Task data saved to storage file")
            else:
                logger.error("Failed to save task data")
                
        except Exception as e:
            logger.error(f"Failed to save task data: {e}")
    
    def _execute_task_sync(self, task: ScheduledTask):
        """同步方式执行定时任务 - 修复异步调用问题"""
        try:
            logger.info(f"Starting scheduled task execution: {task.name}")
            
            # 更新最后执行时间
            task.last_run = datetime.now().isoformat()
            self._save_tasks_to_storage()  # 保存更新时间
            
            # 定时任务直接使用后台模式执行，不创建页签
            # 使用与立即执行后台模式完全相同的逻辑
            try:
                # 导入mobile handler
                from mobile_task_handler import MobileTaskHandler
                mobile_handler = MobileTaskHandler()

                # 将task对象转换为task_data格式
                task_data = task_to_dict(task)

                logger.info(f"Scheduled task {task.name} starting in background mode (no tab creation)")

                # 使用mobile handler的异步执行逻辑
                if self.main_loop and not self.main_loop.is_closed():
                    # 在主事件循环中异步执行
                    future = asyncio.run_coroutine_threadsafe(
                        mobile_handler.execute_mobile_task(
                            goal=task_data['goal'],
                            role=task_data.get('role'),
                            name=task_data.get('name'),
                            description=task_data.get('name'),  # 使用name作为description
                            goal_config=task_data.get('goal_config'),
                            resources=task_data.get('resources', []),
                            execution_mode='background',  # 强制后台模式
                            schedule_settings=task_data.get('scheduleSettings'),
                            notification_settings=task_data.get('notificationSettings'),
                            work_directory=task.work_directory,
                            task_id=task_data['id'],
                            skip_permissions=task_data.get('skipPermissions', False),
                            verbose_logs=task_data.get('verboseLogs', False)
                        ),
                        self.main_loop
                    )
                    logger.info(f"Scheduled task {task.name} started in background mode (direct execution)")
                else:
                    logger.error(f"Main event loop unavailable, cannot execute scheduled task: {task.name}")

            except Exception as e:
                logger.error(f"Failed to execute scheduled task in background mode: {task.name} - {e}")
                import traceback
                logger.error(f"Detailed error information: {traceback.format_exc()}")
            
        except Exception as e:
            logger.error(f"Failed to execute scheduled task: {task.name} - {e}")
    
    def update_task_session_id(self, task_id: str, session_id: str) -> bool:
        """更新任务的session_id，用于会话恢复"""
        try:
            # 在所有任务中查找
            if task_id in self.all_tasks:
                task = self.all_tasks[task_id]
                task.session_id = session_id
                logger.info(f"Updating task {task.name} session_id: {session_id}")
                
                # 保存到存储文件
                self._save_tasks_to_storage()
                return True
            else:
                logger.warning(f"Task {task_id} not found, unable to update session_id")
                return False
                
        except Exception as e:
            logger.error(f"Failed to update task session_id: {task_id} - {e}")
            return False