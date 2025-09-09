#!/usr/bin/env python3
"""
Mobile Task Handler - 移动端任务执行模块
独立处理移动端任务发起、会话管理和结果存储
"""

import asyncio
import json
import logging
import subprocess
import shutil
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from config import Config

logger = logging.getLogger(__name__)

# PC-side functions will be imported lazily to avoid circular imports
format_markdown_command = None
read_agent_content = None
get_current_time_context = None

def _import_pc_functions():
    """Lazy import PC-side functions to avoid circular imports"""
    global format_markdown_command, read_agent_content, get_current_time_context
    
    if format_markdown_command is None:
        try:
            # Import PC-side functions dynamically
            import importlib
            app_module = importlib.import_module('app')
            task_scheduler_module = importlib.import_module('task_scheduler')
            
            format_markdown_command = getattr(app_module, 'format_markdown_command')
            read_agent_content = getattr(app_module, 'read_agent_content')
            get_current_time_context = getattr(task_scheduler_module, 'get_current_time_context')
            
            logger.info("Successfully imported PC-side functions")
        except Exception as e:
            logger.warning(f"Failed to import PC-side functions: {e}")
            # Set fallback functions
            format_markdown_command = False
            read_agent_content = False  
            get_current_time_context = False

class MobileTaskHandler:
    """移动端任务处理器"""
    
    def __init__(self):
        self.base_path = Path(__file__).parent
        self.results_dir = self.base_path / "mobile_results"
        self.conversations_dir = self.base_path / "mobile_conversations"
        self.claude_executable = self._find_claude_executable()
        
        # Ensure directories exist
        self.results_dir.mkdir(exist_ok=True)
        self.conversations_dir.mkdir(exist_ok=True)
    
    def _find_claude_executable(self) -> str:
        """Find Claude CLI executable path"""
        # Check common locations
        claude_paths = [
            str(Path.home() / ".local" / "bin" / "claude"),
            "/usr/local/bin/claude",
            "/opt/homebrew/bin/claude",
            "claude"  # fallback to PATH
        ]
        
        for path in claude_paths:
            if shutil.which(path):
                logger.info(f"Found Claude CLI at: {path}")
                return path
        
        # Last resort: check PATH
        claude_path = shutil.which("claude")
        if claude_path:
            logger.info(f"Found Claude CLI in PATH: {claude_path}")
            return claude_path
        
        raise RuntimeError("Claude CLI not found. Please install Claude CLI first.")
    
    def _generate_task_id(self) -> str:
        """Generate unique task ID for mobile tasks"""
        timestamp = int(datetime.now().timestamp())
        random_suffix = str(uuid.uuid4())[:8]
        return f"mobile_task_{timestamp}_{random_suffix}"
    
    def _extract_session_id(self, claude_output: str) -> Optional[str]:
        """Extract session ID from Claude CLI output"""
        # Look for UUID session ID patterns in Claude output
        session_patterns = [
            r'Session ID: ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})',
            r'session[_-]?id["\']?\s*:\s*["\']?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})["\']?',
            r'\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b',
        ]
        
        for pattern in session_patterns:
            match = re.search(pattern, claude_output, re.IGNORECASE)
            if match:
                session_id = match.group(1)
                logger.info(f"Extracted session ID: {session_id}")
                return session_id
        
        # If no session ID found in output, we cannot continue conversations
        # Return None to indicate no session available for resume
        logger.warning(f"No UUID session ID found in Claude output")
        return None
    
    async def execute_mobile_task(
        self, 
        goal: str, 
        role: Optional[str] = None,
        name: Optional[str] = None,
        description: Optional[str] = None,
        goal_config: Optional[str] = None,
        resources: Optional[List] = None,
        execution_mode: str = 'immediate',
        schedule_settings: Optional[Dict] = None,
        notification_settings: Optional[Dict] = None,
        work_directory: Optional[str] = None,
        skip_permissions: bool = False,
        verbose_logs: bool = False
    ) -> Dict[str, Any]:
        """Execute mobile task using Claude CLI headless mode"""
        
        try:
            task_id = self._generate_task_id()
            # Generate UUID session ID for conversation continuity
            session_id = str(uuid.uuid4())
            
            # Prepare command for Claude CLI
            if work_directory is None:
                work_directory = str(Config.get_user_home())
            
            # Build enhanced goal using PC-side intelligent agent system
            _import_pc_functions()  # Ensure PC functions are imported
            
            if format_markdown_command and get_current_time_context:
                # Use PC-side command formatting with full agent integration
                time_context = get_current_time_context()
                enhanced_goal = format_markdown_command(
                    user_input=goal,
                    role=role,
                    goal_config=goal_config,
                    work_directory=work_directory,
                    time_context=time_context,
                    notification_command=None  # Mobile doesn't need notification command
                )
                logger.info(f"Mobile task using PC-side agent system: {role}")
            else:
                # Fallback to simple concatenation if PC functions not available
                logger.warning("PC-side functions not available, using fallback command building")
                enhanced_goal = goal
                
                if role:
                    enhanced_goal = f"Acting as {role}, {goal}"
                
                if goal_config:
                    enhanced_goal = f"{enhanced_goal}\n\nSpecific Goal Configuration:\n{goal_config}"
                
                if description:
                    enhanced_goal = f"{enhanced_goal}\n\nTask Description:\n{description}"
                
                if resources:
                    resources_text = "\n".join(resources) if isinstance(resources, list) else str(resources)
                    enhanced_goal = f"{enhanced_goal}\n\nResource Files:\n{resources_text}"
            
            # Add notification command if specified
            if notification_settings and notification_settings.get('enabled'):
                methods = notification_settings.get('methods', [])
                if methods:
                    notification_types = []
                    if 'email' in methods:
                        notification_types.append('email notification')
                    if 'wechat' in methods:
                        notification_types.append('WeChat notification')
                    
                    if notification_types:
                        notification_cmd = f"After task completion, send the complete detailed results and all generated content to me using {' and '.join(notification_types)} tools. Include all detailed analysis, findings, data, and generated materials directly in the notification content itself - do not just send a summary that requires me to check local files."
                        enhanced_goal = f"{enhanced_goal}\n\n{notification_cmd}"
            
            # Execute Claude CLI in headless mode with generated session ID
            cmd = [
                self.claude_executable,
                "-p", enhanced_goal,
                "--session-id", session_id
            ]
            
            # Add permission handling based on mobile settings
            if skip_permissions:
                cmd.append("--dangerously-skip-permissions")
            
            # Add verbose logging if requested
            if verbose_logs:
                cmd.append("--verbose")
            
            logger.info(f"Executing mobile task {task_id} with command: {' '.join(cmd)}")
            
            # Run Claude CLI
            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=work_directory,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            # Decode output
            output_text = stdout.decode('utf-8', errors='replace') if stdout else ""
            error_text = stderr.decode('utf-8', errors='replace') if stderr else ""
            
            # We already have the session ID generated above
            logger.info(f"Mobile task {task_id} using session ID: {session_id}")
            
            # Prepare task result with all PC-compatible fields
            task_result = {
                "task_id": task_id,
                "session_id": session_id,
                "source": "mobile",
                "goal": goal,
                "role": role,
                "name": name,
                "description": description,
                "goal_config": goal_config,
                "resources": resources,
                "execution_mode": execution_mode,
                "schedule_settings": schedule_settings,
                "work_directory": work_directory,
                "skip_permissions": skip_permissions,
                "verbose_logs": verbose_logs,
                "command_executed": ' '.join(cmd),
                "output": output_text,
                "error": error_text if error_text else None,
                "exit_code": process.returncode,
                "notification_settings": notification_settings,
                "created_at": datetime.now().isoformat(),
                "completed_at": datetime.now().isoformat(),
                "viewable_on": ["mobile", "pc"]
            }
            
            # Save result to file
            result_file = self.results_dir / f"{task_id}.json"
            with open(result_file, 'w', encoding='utf-8') as f:
                json.dump(task_result, f, indent=2, ensure_ascii=False)
            
            # Update conversation tracking
            await self._update_conversation_history(session_id, task_result)
            
            logger.info(f"Mobile task {task_id} completed successfully")
            
            return {
                "task_id": task_id,
                "session_id": session_id,
                "status": "completed" if process.returncode == 0 else "failed",
                "result_url": f"/mobile/task-result/{task_id}",
                "conversation_url": f"/mobile/conversation/{session_id}",
                "exit_code": process.returncode,
                "has_output": bool(output_text),
                "has_error": bool(error_text)
            }
            
        except Exception as e:
            logger.error(f"Failed to execute mobile task: {e}")
            return {
                "error": str(e),
                "status": "failed"
            }
    
    async def continue_conversation(
        self, 
        session_id: str, 
        goal: str,
        notification_settings: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Continue conversation with existing session"""
        
        try:
            task_id = self._generate_task_id()
            
            # Get conversation history to determine work directory
            conversation_file = self.conversations_dir / f"{session_id}.json"
            work_directory = str(Config.get_user_home())  # default
            
            if conversation_file.exists():
                with open(conversation_file, 'r', encoding='utf-8') as f:
                    conversation_data = json.load(f)
                    # Use work directory from first task in conversation
                    if conversation_data.get('tasks') and len(conversation_data['tasks']) > 0:
                        work_directory = conversation_data['tasks'][0].get('work_directory', work_directory)
            
            # Add notification command if specified
            enhanced_goal = goal
            if notification_settings and notification_settings.get('enabled'):
                methods = notification_settings.get('methods', [])
                if methods:
                    notification_types = []
                    if 'email' in methods:
                        notification_types.append('email notification')
                    if 'wechat' in methods:
                        notification_types.append('WeChat notification')
                    
                    if notification_types:
                        notification_cmd = f"After completing this follow-up request, send the complete results using {' and '.join(notification_types)} tools."
                        enhanced_goal = f"{enhanced_goal}\n\n{notification_cmd}"
            
            # Execute Claude CLI with resume
            cmd = [
                self.claude_executable,
                "--resume", session_id,
                "-p", enhanced_goal,
                "--dangerously-skip-permissions"
            ]
            
            logger.info(f"Continuing conversation {session_id} with task {task_id}")
            
            # Run Claude CLI
            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=work_directory,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            # Decode output
            output_text = stdout.decode('utf-8', errors='replace') if stdout else ""
            error_text = stderr.decode('utf-8', errors='replace') if stderr else ""
            
            # Prepare task result
            task_result = {
                "task_id": task_id,
                "session_id": session_id,
                "source": "mobile",
                "goal": goal,
                "work_directory": work_directory,
                "command_executed": ' '.join(cmd),
                "output": output_text,
                "error": error_text if error_text else None,
                "exit_code": process.returncode,
                "notification_settings": notification_settings,
                "created_at": datetime.now().isoformat(),
                "completed_at": datetime.now().isoformat(),
                "viewable_on": ["mobile", "pc"],
                "is_continuation": True
            }
            
            # Save result to file
            result_file = self.results_dir / f"{task_id}.json"
            with open(result_file, 'w', encoding='utf-8') as f:
                json.dump(task_result, f, indent=2, ensure_ascii=False)
            
            # Update conversation tracking
            await self._update_conversation_history(session_id, task_result)
            
            logger.info(f"Conversation {session_id} continued with task {task_id}")
            
            return {
                "task_id": task_id,
                "session_id": session_id,
                "status": "completed" if process.returncode == 0 else "failed",
                "result_url": f"/mobile/task-result/{task_id}",
                "conversation_url": f"/mobile/conversation/{session_id}",
                "exit_code": process.returncode,
                "has_output": bool(output_text),
                "has_error": bool(error_text),
                "continued": True
            }
            
        except Exception as e:
            logger.error(f"Failed to continue conversation {session_id}: {e}")
            return {
                "error": str(e),
                "status": "failed",
                "session_id": session_id
            }
    
    async def _update_conversation_history(self, session_id: str, task_result: Dict):
        """Update conversation history with new task"""
        conversation_file = self.conversations_dir / f"{session_id}.json"
        
        if conversation_file.exists():
            # Load existing conversation
            with open(conversation_file, 'r', encoding='utf-8') as f:
                conversation_data = json.load(f)
        else:
            # Create new conversation
            conversation_data = {
                "session_id": session_id,
                "created_at": datetime.now().isoformat(),
                "tasks": []
            }
        
        # Add new task to conversation
        conversation_data["tasks"].append({
            "task_id": task_result["task_id"],
            "goal": task_result["goal"],
            "work_directory": task_result["work_directory"],
            "completed_at": task_result["completed_at"],
            "status": "completed" if task_result["exit_code"] == 0 else "failed",
            "has_output": bool(task_result["output"]),
            "is_continuation": task_result.get("is_continuation", False)
        })
        
        conversation_data["updated_at"] = datetime.now().isoformat()
        
        # Save conversation
        with open(conversation_file, 'w', encoding='utf-8') as f:
            json.dump(conversation_data, f, indent=2, ensure_ascii=False)
    
    def get_task_result(self, task_id: str) -> Optional[Dict]:
        """Get task result by task ID"""
        result_file = self.results_dir / f"{task_id}.json"
        
        if not result_file.exists():
            return None
        
        try:
            with open(result_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load task result {task_id}: {e}")
            return None
    
    def get_conversation_history(self, session_id: str) -> Optional[Dict]:
        """Get conversation history by session ID"""
        conversation_file = self.conversations_dir / f"{session_id}.json"
        
        if not conversation_file.exists():
            return None
        
        try:
            with open(conversation_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load conversation {session_id}: {e}")
            return None
    
    def get_all_mobile_tasks(self) -> List[Dict]:
        """Get all mobile tasks for unified task list"""
        mobile_tasks = []
        
        try:
            # Get all result files
            if not self.results_dir.exists():
                return mobile_tasks
                
            for result_file in self.results_dir.glob("*.json"):
                task_id = result_file.stem
                
                try:
                    with open(result_file, 'r', encoding='utf-8') as f:
                        task_result = json.load(f)
                    
                    # Convert mobile task result to unified format
                    unified_task = {
                        "id": task_id,
                        "name": task_result.get("name", task_result.get("goal", "")[:50] + "..." if len(task_result.get("goal", "")) > 50 else task_result.get("goal", "Unnamed Task")),
                        "goal": task_result.get("goal", ""),
                        "type": "mobile",
                        "status": "completed" if task_result.get("exit_code") == 0 else "failed",
                        "sessionId": task_result.get("session_id"),
                        "session_id": task_result.get("session_id"),  # Keep for backward compatibility
                        "hasResult": bool(task_result.get("output")),
                        "resultApi": f"/api/mobile/task-result/{task_id}",
                        "createdAt": task_result.get("started_at", task_result.get("completed_at")),
                        "lastRun": task_result.get("completed_at"),
                        "role": task_result.get("role"),
                        "workDirectory": task_result.get("work_directory"),
                        "exitCode": task_result.get("exit_code"),
                        "hasOutput": bool(task_result.get("output")),
                        "hasError": bool(task_result.get("error")),
                        # Mobile-specific fields
                        "isContinuation": task_result.get("is_continuation", False),
                        "originalGoal": task_result.get("original_goal")
                    }
                    
                    mobile_tasks.append(unified_task)
                    
                except Exception as e:
                    logger.error(f"Failed to load mobile task {task_id}: {e}")
                    continue
                    
        except Exception as e:
            logger.error(f"Failed to get mobile tasks: {e}")
            
        # Sort by completion time (newest first)
        mobile_tasks.sort(key=lambda x: x.get("lastRun", ""), reverse=True)
        
        return mobile_tasks

# Global instance
mobile_task_handler = MobileTaskHandler()