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
import os
import platform
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from config import Config
from tasks_storage import TasksStorage
from mission_manager import MissionManager

logger = logging.getLogger(__name__)

def should_use_sandbox_env():
    """Check if IS_SANDBOX=1 environment variable should be used for Linux root environment"""
    try:
        return platform.system() == 'Linux' and os.getuid() == 0
    except (AttributeError, OSError):
        # getuid() not available on Windows or permission error
        return False

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
        self.mission_manager = MissionManager()  # Add mission manager for task directory creation
        
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
    
    def _save_task_to_unified_storage(self, task_data: Dict[str, Any], status: str = "pending") -> bool:
        """Save mobile task to unified tasks storage (PC-compatible)"""
        try:
            from tasks_storage import TasksStorage
            
            # Create PC-compatible task structure with correct field names
            unified_task = {
                "id": task_data["task_id"],  # Use 'id' not 'task_id' for PC compatibility
                "name": task_data.get("name", "Mobile Task"),
                "goal": task_data.get("goal", ""),
                "role": task_data.get("role", ""),
                "goal_config": task_data.get("goal_config", ""),
                "skipPermissions": task_data.get("skip_permissions", False),
                "verboseLogs": task_data.get("verbose_logs", False),
                "resources": task_data.get("resources", []),
                "scheduleFrequency": "immediate",
                "scheduleTime": "",
                "enabled": True,
                "createdAt": task_data.get("created_at", datetime.now().isoformat()),
                "lastRun": None,
                "workDirectory": task_data.get("work_directory", ""),
                "deleted": False,
                "executionMode": "immediate",
                "sessionId": task_data.get("session_id") or task_data.get("sessionId"),  # Use 'sessionId' for PC compatibility
                "status": status,
                "source": "mobile",  # Mark as mobile task
                "taskType": "mobile",  # Additional mobile identifier
                "type": "mobile",  # Additional mobile identifier
                "taskName": task_data.get("name", "Mobile Task"),  # Mobile compatibility field
                "notificationSettings": task_data.get("notification_settings", {"enabled": False, "methods": []})
            }
            
            # Load existing tasks and add new mobile task
            storage = TasksStorage()
            existing_tasks = storage.load_tasks()
            
            # Check if task already exists (avoid duplicates)
            task_exists = any(task.get("id") == unified_task["id"] for task in existing_tasks)
            if not task_exists:
                existing_tasks.append(unified_task)
                storage.save_tasks(existing_tasks)
                logger.info(f"Successfully saved mobile task {unified_task['id']} to unified storage with status: {status}")
                return True
            else:
                logger.info(f"Mobile task {unified_task['id']} already exists in storage, skipping")
                return False
            
        except Exception as e:
            logger.error(f"Failed to save mobile task to unified storage: {e}")
            logger.debug(f"Error details: {e}", exc_info=True)
            return False
    
    def _update_task_status_in_unified_storage(self, task_id: str, status: str, additional_data: Dict[str, Any] = None) -> bool:
        """Update mobile task status in unified storage"""
        try:
            from tasks_storage import TasksStorage
            
            storage = TasksStorage()
            existing_tasks = storage.load_tasks()
            
            # Find and update the task
            for task in existing_tasks:
                if task.get("id") == task_id:
                    task["status"] = status
                    task["lastRun"] = datetime.now().isoformat()
                    
                    # Update additional data if provided
                    if additional_data:
                        task.update(additional_data)
                    
                    storage.save_tasks(existing_tasks)
                    logger.info(f"Updated mobile task {task_id} status to: {status}")
                    return True
            
            logger.warning(f"Mobile task {task_id} not found for status update")
            return False
            
        except Exception as e:
            logger.error(f"Failed to update mobile task status: {e}")
            logger.debug(f"Error details: {e}", exc_info=True)
            return False
    
    def _update_task_session_id_by_old_session(self, old_session_id: str, new_session_id: str) -> bool:
        """Update task sessionId from old session to new session ID"""
        try:
            from tasks_storage import TasksStorage
            
            storage = TasksStorage()
            existing_tasks = storage.load_tasks()
            
            # Find tasks with old session ID and update to new session ID
            updated_count = 0
            for task in existing_tasks:
                if task.get("sessionId") == old_session_id:
                    task["sessionId"] = new_session_id
                    task["lastRun"] = datetime.now().isoformat()
                    updated_count += 1
                    logger.info(f"Updated task {task.get('id')} sessionId: {old_session_id} -> {new_session_id}")
            
            if updated_count > 0:
                storage.save_tasks(existing_tasks)
                logger.info(f"Successfully updated {updated_count} tasks with new session ID")
                return True
            else:
                logger.warning(f"No tasks found with old session ID: {old_session_id}")
                return False
            
        except Exception as e:
            logger.error(f"Failed to update task session ID: {e}")
            logger.debug(f"Error details: {e}", exc_info=True)
            return False
    
    def _find_task_by_session_id(self, session_id: str) -> Optional[str]:
        """Find original task ID by session ID"""
        try:
            from tasks_storage import TasksStorage
            
            storage = TasksStorage()
            existing_tasks = storage.load_tasks()
            
            # Find task with matching session ID
            for task in existing_tasks:
                if task.get("sessionId") == session_id:
                    task_id = task.get("id")
                    logger.info(f"Found original task {task_id} for session {session_id}")
                    return task_id
            
            logger.warning(f"No task found for session ID: {session_id}")
            return None
            
        except Exception as e:
            logger.error(f"Failed to find task by session ID: {e}")
            return None
    
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
    
    def _parse_json_response(self, output_text: str) -> Dict[str, Any]:
        """Parse JSON response from Claude CLI"""
        try:
            # Claude CLI JSON output may contain multiple lines, try to find JSON content
            lines = output_text.strip().split('\n')
            for line in lines:
                line = line.strip()
                if line.startswith('{') and line.endswith('}'):
                    json_data = json.loads(line)
                    logger.info(f"Successfully parsed JSON response")
                    return json_data
            
            # If no JSON line found, try parsing entire output
            json_data = json.loads(output_text.strip())
            logger.info(f"Successfully parsed entire output as JSON")
            return json_data
            
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse JSON response: {e}")
            return {}
    
    def _extract_session_from_json(self, json_response: Dict[str, Any]) -> Optional[str]:
        """Extract session ID from JSON response"""
        if not json_response:
            return None
            
        # Try multiple possible field names for session ID
        session_fields = ['session_id', 'sessionId', 'id', 'conversation_id', 'conversationId']
        
        for field in session_fields:
            if field in json_response:
                session_id = json_response[field]
                if isinstance(session_id, str) and len(session_id) > 0:
                    logger.info(f"Found session ID in JSON field '{field}': {session_id}")
                    return session_id
        
        # Try nested structures
        if 'metadata' in json_response:
            metadata = json_response['metadata']
            if isinstance(metadata, dict):
                for field in session_fields:
                    if field in metadata:
                        session_id = metadata[field]
                        if isinstance(session_id, str) and len(session_id) > 0:
                            logger.info(f"Found session ID in metadata.{field}: {session_id}")
                            return session_id
        
        logger.warning("No session ID found in JSON response")
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
        verbose_logs: bool = False,
        task_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Execute mobile task using Claude CLI headless mode"""
        
        try:
            # Use provided task_id or generate new one if not provided
            if task_id is None:
                task_id = self._generate_task_id()
            # Generate UUID session ID for conversation continuity
            session_id = str(uuid.uuid4())
            
            # Prepare command for Claude CLI
            if work_directory is None:
                # Use MissionManager to create task-specific directory (consistent with PC-side)
                work_directory = self.mission_manager.create_task_directory(task_id, name or "Mobile Task")
            
            # Save task to unified storage IMMEDIATELY (before execution)
            # This ensures the task is saved regardless of notification configuration
            current_time = datetime.now().isoformat()
            task_data = {
                "task_id": task_id,
                "name": name or "Mobile Task",
                "goal": goal,
                "role": role or "",
                "goal_config": goal_config or "",
                "skip_permissions": skip_permissions,
                "verbose_logs": verbose_logs,
                "resources": resources or [],
                "work_directory": work_directory,
                "session_id": session_id,
                "created_at": current_time,
                "notification_settings": notification_settings or {"enabled": False, "methods": []}
            }
            
            # Save to unified storage with "running" status
            self._save_task_to_unified_storage(task_data, status="running")
            logger.info(f"Mobile task {task_id} saved to unified storage before execution")
            
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
            
            # Build shell command string using PC-side PTY Shell approach (bash -c method)
            # This ensures proper handling of long text with newlines and special characters
            shell_command_parts = [f'"{self.claude_executable}"', '-p', f'"{enhanced_goal}"', '--session-id', session_id]
            
            # Mobile tasks always skip permissions (non-interactive mode)
            shell_command_parts.append("--dangerously-skip-permissions")
            
            # Add verbose logging if requested
            if verbose_logs:
                shell_command_parts.append("--verbose")
            
            # Construct complete shell command (similar to PC PTY Shell logic)
            # IMPORTANT: Execute Claude CLI in user home directory, not task directory
            # The task directory is only used for file storage (specified in Working Directory instruction)
            claude_command = ' '.join(shell_command_parts)
            user_home = str(Config.get_user_home())
            if should_use_sandbox_env():
                shell_command = f'cd "{user_home}" && IS_SANDBOX=1 {claude_command}'
                logger.info("Using IS_SANDBOX=1 for Linux root environment")
            else:
                shell_command = f'cd "{user_home}" && {claude_command}'
            
            logger.info(f"Executing mobile task {task_id} with shell command: {shell_command}")
            logger.info(f"Enhanced goal length: {len(enhanced_goal)} characters")
            
            # Run Claude CLI using bash -c (same as PC PTY Shell)
            process = await asyncio.create_subprocess_exec(
                'bash', '-c', shell_command,
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
                "command_executed": shell_command,
                "output": output_text,
                "error": error_text if error_text else None,
                "exit_code": process.returncode,
                "notification_settings": notification_settings,
                "created_at": datetime.now().isoformat(),
                "completed_at": datetime.now().isoformat(),
                "viewable_on": ["mobile", "pc"]
            }
            
            # Results are now saved in unified storage only - no separate files needed
            
            logger.info(f"Mobile task {task_id} completed successfully")
            
            # Update task status in unified storage (completed successfully)
            completion_status = "completed" if process.returncode == 0 else "failed"
            completion_data = {
                "completed_at": datetime.now().isoformat(),
                "exit_code": process.returncode,
                "output": output_text[:500] if output_text else None,  # Store first 500 chars for preview
                "error": error_text[:500] if error_text else None  # Store first 500 chars for preview
            }
            self._update_task_status_in_unified_storage(task_id, completion_status, completion_data)
            logger.info(f"Mobile task {task_id} status updated to: {completion_status}")
            
            # Send WebSocket notification for real-time task list update
            await self._notify_task_completed(task_id, task_result)
            
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
            
            # Update task status to failed in unified storage if task_id exists
            if 'task_id' in locals():
                failure_data = {
                    "completed_at": datetime.now().isoformat(),
                    "error": str(e)[:500]  # Store first 500 chars of error
                }
                self._update_task_status_in_unified_storage(task_id, "failed", failure_data)
                logger.info(f"Mobile task {task_id} status updated to: failed")
            
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
            # Find original task ID by session ID - do NOT generate new task ID
            task_id = self._find_task_by_session_id(session_id)
            if not task_id:
                raise Exception(f"No original task found for session {session_id}")
            
            logger.info(f"Using original task ID {task_id} for session continuation")
            
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
            
            # Build shell command string using PC-side PTY Shell approach (bash -c method)
            # Use JSON output format to get structured response with session information
            shell_command_parts = [f'"{self.claude_executable}"', '--resume', session_id, '-p', f'"{enhanced_goal}"', '--output-format', 'json']
            
            # Mobile conversation continuation always skips permissions (non-interactive mode)  
            shell_command_parts.append("--dangerously-skip-permissions")
            
            # Construct complete shell command (similar to PC PTY Shell logic)
            # IMPORTANT: Execute Claude CLI in user home directory for session continuity
            claude_command = ' '.join(shell_command_parts)
            user_home = str(Config.get_user_home())
            if should_use_sandbox_env():
                shell_command = f'cd "{user_home}" && IS_SANDBOX=1 {claude_command}'
                logger.info("Using IS_SANDBOX=1 for Linux root environment")
            else:
                shell_command = f'cd "{user_home}" && {claude_command}'
            
            logger.info(f"Continuing conversation {session_id} with task {task_id}")
            logger.info(f"Continue conversation shell command: {shell_command}")
            
            # Run Claude CLI using bash -c (same as PC PTY Shell)
            process = await asyncio.create_subprocess_exec(
                'bash', '-c', shell_command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            # Decode output
            output_text = stdout.decode('utf-8', errors='replace') if stdout else ""
            error_text = stderr.decode('utf-8', errors='replace') if stderr else ""
            
            # Extract new session ID from JSON response
            new_session_id = None
            json_response = {}
            
            # Try to parse JSON response first
            if output_text:
                json_response = self._parse_json_response(output_text)
                if json_response:
                    new_session_id = self._extract_session_from_json(json_response)
            
            # Fallback: use existing UUID extraction method
            if not new_session_id:
                new_session_id = self._extract_session_id(output_text)
                
            # Final fallback: use original session_id
            if not new_session_id:
                new_session_id = session_id
                logger.info(f"No new session ID found, using original: {session_id}")
            else:
                logger.info(f"Session progression: {session_id} -> {new_session_id}")
            
            # Prepare task result
            task_result = {
                "task_id": task_id,
                "session_id": session_id,
                "source": "mobile",
                "goal": goal,
                "work_directory": work_directory,
                "command_executed": shell_command,
                "output": output_text,
                "error": error_text if error_text else None,
                "exit_code": process.returncode,
                "notification_settings": notification_settings,
                "created_at": datetime.now().isoformat(),
                "completed_at": datetime.now().isoformat(),
                "viewable_on": ["mobile", "pc"],
                "is_continuation": True
            }
            
            # Do NOT create new task for continue conversation - only update sessionId
            # The conversation continuation should only update the original task's sessionId
            
            # Update original task's session ID if session changed
            if new_session_id != session_id:
                self._update_task_session_id_by_old_session(session_id, new_session_id)
            else:
                logger.info(f"Session ID unchanged, no task update needed: {session_id}")
            
            logger.info(f"Conversation {session_id} continued with task {task_id}")
            
            return {
                "task_id": task_id,
                "session_id": new_session_id,  # Return the new session ID
                "original_session_id": session_id,  # Keep original for reference
                "status": "completed" if process.returncode == 0 else "failed",
                "result_url": f"/mobile/task-result/{task_id}",
                "conversation_url": f"/mobile/conversation/{new_session_id}",  # Use new session ID for URL
                "exit_code": process.returncode,
                "has_output": bool(output_text),
                "has_error": bool(error_text),
                "continued": True,
                "session_changed": new_session_id != session_id,  # Flag indicating session change
                "json_response": json_response  # Include parsed JSON for debugging
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
        task_ids_seen = set()  # To avoid duplicates
        
        try:
            # First, get mobile tasks from unified storage (tasks.json)
            tasks_storage = TasksStorage()
            all_unified_tasks = tasks_storage.load_tasks()
            
            for task in all_unified_tasks:
                # Check if it's a mobile task
                if (task.get("source") == "mobile" or 
                    task.get("taskType") == "mobile" or 
                    task.get("type") == "mobile"):
                    
                    task_id = task.get("id")
                    if task_id:
                        task_ids_seen.add(task_id)
                        
                        # Convert unified storage task to display format
                        unified_task = {
                            "id": task_id,
                            "name": task.get("name", task.get("goal", "")[:50] + "..." if len(task.get("goal", "")) > 50 else task.get("goal", "Unnamed Task")),
                            "goal": task.get("goal", ""),
                            "type": "mobile",
                            "status": task.get("status", "pending"),
                            "sessionId": task.get("sessionId"),
                            "session_id": task.get("sessionId"),  # Keep for backward compatibility
                            "hasResult": bool(task.get("sessionId")),
                            "resultApi": f"/api/mobile/task-result/{task_id}" if task.get("sessionId") else None,
                            "createdAt": task.get("createdAt", task.get("created", "")),
                            "lastRun": task.get("lastRun", task.get("completed_at", "")),
                            "role": task.get("role"),
                            "workDirectory": task.get("workDirectory", task.get("work_directory")),
                            "exitCode": task.get("exitCode"),
                            "hasOutput": bool(task.get("hasOutput")),
                            "hasError": bool(task.get("hasError")),
                            # Mobile-specific fields
                            "isContinuation": task.get("is_continuation", False),
                            "originalGoal": task.get("original_goal")
                        }
                        
                        mobile_tasks.append(unified_task)
            
            # Then, get additional mobile tasks from result files (legacy completed tasks)
            if self.results_dir.exists():
                for result_file in self.results_dir.glob("*.json"):
                    task_id = result_file.stem
                    
                    # Skip if already processed from unified storage
                    if task_id in task_ids_seen:
                        continue
                        
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
        mobile_tasks.sort(key=lambda x: x.get("lastRun", "") or x.get("createdAt", ""), reverse=True)
        
        return mobile_tasks
    
    async def _notify_task_completed(self, task_id: str, task_result: Dict) -> None:
        """Send WebSocket notification when mobile task is completed"""
        try:
            # Import WebSocket manager to send notifications
            from app import manager
            
            # Prepare notification message
            notification_message = {
                "type": "mobile_task_completed",
                "task_id": task_id,
                "task_name": task_result.get("name", task_result.get("goal", "")[:50] + "..." if len(task_result.get("goal", "")) > 50 else task_result.get("goal", "Unnamed Task")),
                "status": "completed" if task_result.get("exit_code") == 0 else "failed",
                "session_id": task_result.get("session_id"),
                "has_output": bool(task_result.get("output")),
                "has_error": bool(task_result.get("error")),
                "completed_at": task_result.get("completed_at"),
                "timestamp": datetime.now().isoformat()
            }
            
            # Broadcast to all WebSocket connections
            await manager.broadcast(notification_message)
            logger.info(f"Sent mobile task completion notification for task {task_id}")
            
        except Exception as e:
            logger.warning(f"Failed to send WebSocket notification for mobile task {task_id}: {e}")
            # Don't fail the task execution if notification fails
    
    def delete_mobile_task(self, task_id: str) -> bool:
        """Delete mobile task result file"""
        try:
            result_file = self.results_dir / f"{task_id}.json"
            if result_file.exists():
                result_file.unlink()
                logger.info(f"Deleted mobile task result file: {result_file}")
                return True
            else:
                logger.debug(f"Mobile task result file not found: {result_file}")
                return False
        except Exception as e:
            logger.error(f"Failed to delete mobile task {task_id}: {e}")
            return False

# Global instance
mobile_task_handler = MobileTaskHandler()