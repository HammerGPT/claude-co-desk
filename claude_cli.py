"""
Claude CLI集成模块
移植自claudecodeui/server/claude-cli.js
"""

import asyncio
import json
import logging
import shutil
import subprocess
from pathlib import Path
from typing import Dict, List, Any, Optional
import os
from config import Config

logger = logging.getLogger(__name__)

class ClaudeCLIIntegration:
    """Claude CLI集成类 - 移植自claude-cli.js"""
    
    def __init__(self):
        self.active_processes: Dict[str, subprocess.Popen] = {}
    
    async def spawn_claude(self, command: str, options: Dict[str, Any], websocket) -> None:
        """
        启动Claude CLI进程
        移植自spawnClaude函数
        """
        session_id = options.get('sessionId')
        project_path = options.get('projectPath')
        cwd = options.get('cwd', os.getcwd())
        resume = options.get('resume', False)
        tools_settings = options.get('toolsSettings', {})
        permission_mode = options.get('permissionMode', 'default')
        resources = options.get('resources', [])
        task_id = options.get('taskId')  # 任务ID，用于区分任务执行
        
        captured_session_id = session_id
        session_created_sent = False
        
        # 获取Claude CLI的绝对路径，防止"Command not found"随机性问题
        from app import EnvironmentChecker  # 延迟导入避免循环依赖
        claude_executable = EnvironmentChecker.get_claude_executable_path()
        if not claude_executable:
            error_msg = "未找到Claude CLI可执行文件，请检查安装"
            logger.error(error_msg)
            await websocket.send_text(json.dumps({
                'type': 'claude-error',
                'error': error_msg
            }))
            return
        
        logger.info(f"Using Claude CLI path: {claude_executable}")
        
        # 构建Claude CLI命令参数 - 使用claude命令而非绝对路径
        args = ['claude']
        
        # 构建包含资源文件引用的完整命令
        enhanced_command = command.strip() if command and command.strip() else ""
        
        # 添加资源文件引用到命令中（使用 @ 语法）
        if resources:
            resource_refs = []
            for resource in resources:
                # 直接使用资源路径，无需检查是否存在，让 Claude Code 处理
                resource_refs.append(f"@{resource}")
                logger.info(f"Adding resource reference: @{resource}")
            
            # 将资源引用添加到命令末尾
            if resource_refs:
                if enhanced_command:
                    enhanced_command = f"{enhanced_command} {' '.join(resource_refs)}"
                else:
                    enhanced_command = ' '.join(resource_refs)
        
        # 添加完整的增强命令
        if enhanced_command:
            args.append(f'"{enhanced_command}"')
        
        # 使用Claude CLI默认工作目录（用户主目录）
        working_dir = Config.get_default_working_directory()
        
        # 处理会话恢复
        if resume and session_id:
            args.extend(['--resume', session_id])
        
        # 添加基础标志 - 暂时注释掉减少命令长度
        # args.extend(['--output-format', 'stream-json'])
        
        # 检查MCP配置
        await self._add_mcp_config_if_available(args)
        
        # 添加模型参数（仅新会话）- 暂时注释掉减少命令长度
        # if not resume:
        #     args.extend(['--model', 'sonnet'])
        
        # 添加权限设置
        if permission_mode == 'dangerously-allow-all':
            args.append('--dangerously-skip-permissions')
            logger.info("Using dangerous skip permissions mode")
        elif permission_mode and permission_mode != 'default':
            args.extend(['--permission-mode', permission_mode])
            logger.info(f"Using permission mode: {permission_mode}")
        
        # 添加工具设置
        self._add_tools_settings(args, tools_settings, permission_mode)
        
        logger.info(f"Starting Claude CLI: {' '.join(args)}")
        logger.info(f"Working directory: {working_dir}")
        logger.info(f"Session info - input session_id: {session_id}, resume: {resume}")
        
        try:
            # 配置终端环境变量，支持完整ANSI颜色
            env = os.environ.copy()
            env.update({
                'TERM': 'xterm-256color',  # 支持256色
                'COLORTERM': 'truecolor',  # 支持真彩色
                'COLUMNS': '120',          # 固定列数
                'LINES': '30',             # 固定行数
                'NO_COLOR': '1',           # 禁用颜色输出，避免警告
            })
            # 移除可能冲突的FORCE_COLOR
            env.pop('FORCE_COLOR', None)
            
            # 构建完整的shell命令字符串（使用与PTY Shell相同的方式）
            shell_command = f'cd "{working_dir}" && {" ".join(args)}'
            logger.info(f"Shell command: {shell_command}")
            
            # 启动Claude进程 - 使用bash -c方式（与PTY Shell保持一致）
            process = await asyncio.create_subprocess_exec(
                'bash', '-c', shell_command,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env
            )
            
            # 存储进程引用
            process_key = captured_session_id or session_id or str(id(process))
            self.active_processes[process_key] = process
            
            # 处理stdout（流式JSON响应）
            async def handle_stdout():
                nonlocal captured_session_id, session_created_sent
                
                logger.info("Starting to monitor Claude CLI stdout...")
                try:
                    while True:
                        # 使用更小的缓冲区并添加超时
                        try:
                            line = await asyncio.wait_for(process.stdout.readline(), timeout=30.0)
                            if not line:
                                logger.info("Claude CLI stdout ended")
                                break
                        except asyncio.TimeoutError:
                            logger.warning("Claude CLI stdout read timeout, checking process status...")
                            if process.returncode is not None:
                                logger.info(f"Claude CLI process ended, return code: {process.returncode}")
                                break
                            continue
                        
                        try:
                            raw_output = line.decode('utf-8').strip()
                            if not raw_output:
                                continue
                            
                            logger.info(f" Claude CLI stdout: {raw_output[:200]}{'...' if len(raw_output) > 200 else ''}")
                            
                            try:
                                response = json.loads(raw_output)
                                logger.info(f"JSON parsing successful: type={response.get('type')}, session_id={response.get('session_id')}")
                                
                                # 捕获session ID
                                if response.get('session_id') and not captured_session_id:
                                    captured_session_id = response['session_id']
                                    logger.info(f"Captured session ID: {captured_session_id}")
                                    
                                    # 更新进程键
                                    if process_key != captured_session_id:
                                        if process_key in self.active_processes:
                                            del self.active_processes[process_key]
                                        self.active_processes[captured_session_id] = process
                                    
                                    # 如果是任务执行，保存session_id到任务记录
                                    if task_id:
                                        try:
                                            from app import task_scheduler  # 延迟导入避免循环依赖
                                            success = task_scheduler.update_task_session_id(task_id, captured_session_id)
                                            if success:
                                                logger.info(f"Task {task_id} session_id saved")
                                            else:
                                                logger.warning(f"Failed to save task {task_id} session_id")
                                        except Exception as e:
                                            logger.error(f" 保存任务session_id时出错: {e}")
                                    
                                    # 发送session-created事件（仅新会话，不包括任务执行）
                                    if not session_id and not session_created_sent and not task_id:
                                        session_created_sent = True
                                        await websocket.send_text(json.dumps({
                                            'type': 'session-created',
                                            'sessionId': captured_session_id
                                        }))
                                        logger.info("Sending session-created event")
                                
                                # 发送解析的响应到WebSocket
                                await websocket.send_text(json.dumps({
                                    'type': 'claude-response',
                                    'data': response
                                }))
                                logger.info("Sending claude-response to frontend")
                                
                            except json.JSONDecodeError as je:
                                logger.info(f"Non-JSON response: {raw_output[:100]}{'...' if len(raw_output) > 100 else ''}")
                                # 发送原始文本
                                await websocket.send_text(json.dumps({
                                    'type': 'claude-output',
                                    'data': raw_output
                                }))
                                logger.info("Sending claude-output to frontend")
                        
                        except Exception as e:
                            logger.error(f" 处理单行stdout时出错: {e}")
                            
                except Exception as e:
                    logger.error(f" handle_stdout异常: {e}")
                finally:
                    logger.info("handle_stdout ended")
            
            # 处理stderr
            async def handle_stderr():
                logger.info("Starting to monitor Claude CLI stderr...")
                try:
                    while True:
                        try:
                            line = await asyncio.wait_for(process.stderr.readline(), timeout=10.0)
                            if not line:
                                logger.info("Claude CLI stderr ended")
                                break
                        except asyncio.TimeoutError:
                            if process.returncode is not None:
                                break
                            continue
                        
                        try:
                            error_output = line.decode('utf-8').strip()
                            if error_output:
                                logger.error(f"Claude CLI stderr: {error_output}")
                                if websocket:
                                    await websocket.send_text(json.dumps({
                                        'type': 'claude-error',
                                        'error': error_output
                                    }))
                        except Exception as e:
                            logger.error(f" 处理stderr时出错: {e}")
                except Exception as e:
                    logger.error(f" handle_stderr异常: {e}")
                finally:
                    logger.info("handle_stderr ended")
            
            # 启动异步处理任务
            stdout_task = asyncio.create_task(handle_stdout())
            stderr_task = asyncio.create_task(handle_stderr())
            
            # 等待进程完成
            return_code = await process.wait()
            
            # 清理进程引用
            final_session_id = captured_session_id or session_id or process_key
            if final_session_id in self.active_processes:
                del self.active_processes[final_session_id]
            
            # 发送完成消息
            await websocket.send_text(json.dumps({
                'type': 'claude-complete',
                'exitCode': return_code,
                'isNewSession': not session_id and bool(command)
            }))
            
            # 等待输出处理完成
            await asyncio.gather(stdout_task, stderr_task, return_exceptions=True)
            
            logger.info(f"Claude CLI process exited, code: {return_code}")
            
        except Exception as error:
            logger.error(f"Claude CLI进程错误: {error}")
            
            # 清理进程引用
            final_session_id = captured_session_id or session_id or process_key
            if final_session_id in self.active_processes:
                del self.active_processes[final_session_id]
            
            await websocket.send_text(json.dumps({
                'type': 'claude-error',
                'error': str(error)
            }))
            
            raise
    
    async def _add_mcp_config_if_available(self, args: List[str]) -> None:
        """检查并添加MCP配置"""
        try:
            logger.info("Starting MCP configuration check...")
            
            # 检查~/.claude.json中的MCP配置
            claude_config_path = Path.home() / '.claude.json'
            
            logger.info(f"Checking MCP config file: {claude_config_path}")
            logger.info(f"Claude config file exists: {claude_config_path.exists()}")
            
            has_mcp_servers = False
            
            if claude_config_path.exists():
                try:
                    with open(claude_config_path, 'r', encoding='utf-8') as f:
                        claude_config = json.load(f)
                    
                    # 检查全局MCP服务器
                    if claude_config.get('mcpServers') and len(claude_config['mcpServers']) > 0:
                        logger.info(f"Found {len(claude_config['mcpServers'])} global MCP servers")
                        has_mcp_servers = True
                    
                    # 检查项目特定的MCP服务器
                    if not has_mcp_servers and claude_config.get('claudeProjects'):
                        current_project_path = os.getcwd()
                        project_config = claude_config['claudeProjects'].get(current_project_path)
                        if project_config and project_config.get('mcpServers') and len(project_config['mcpServers']) > 0:
                            logger.info(f"Found {len(project_config['mcpServers'])} project MCP servers")
                            has_mcp_servers = True
                
                except json.JSONDecodeError as e:
                    logger.error(f"解析Claude配置文件失败: {e}")
                except Exception as e:
                    logger.error(f"读取Claude配置文件时出错: {e}")
            
            logger.info(f"MCP server check result: {has_mcp_servers}")
            
            if has_mcp_servers:
                config_path = None
                
                if claude_config_path.exists():
                    try:
                        with open(claude_config_path, 'r', encoding='utf-8') as f:
                            claude_config = json.load(f)
                        
                        # 检查是否有MCP服务器（全局或项目特定）
                        has_global_servers = claude_config.get('mcpServers') and len(claude_config['mcpServers']) > 0
                        current_project_path = os.getcwd()
                        project_config = claude_config.get('claudeProjects', {}).get(current_project_path, {})
                        has_project_servers = project_config.get('mcpServers') and len(project_config['mcpServers']) > 0
                        
                        if has_global_servers or has_project_servers:
                            config_path = str(claude_config_path)
                    
                    except Exception:
                        # 配置无效
                        pass
                
                if config_path:
                    logger.info(f"Adding MCP config: {config_path}")
                    args.extend(['--mcp-config', config_path])
                else:
                    logger.warning("Detected MCP servers but no valid config file found")
        
        except Exception as error:
            logger.error(f"MCP配置检查失败: {error}")
            logger.info("Continue execution without MCP support")
    
    def _add_tools_settings(self, args: List[str], settings: Dict[str, Any], permission_mode: str) -> None:
        """添加工具设置参数"""
        # 如果跳过权限且不在计划模式
        if settings.get('skipPermissions') and permission_mode != 'plan':
            args.append('--dangerously-skip-permissions')
            logger.warning("Using --dangerously-skip-permissions (skipping other tool settings)")
        else:
            # 收集允许的工具
            allowed_tools = list(settings.get('allowedTools', []))
            
            # 为计划模式添加特定工具
            if permission_mode == 'plan':
                plan_mode_tools = ['Read', 'Task', 'exit_plan_mode', 'TodoRead', 'TodoWrite']
                for tool in plan_mode_tools:
                    if tool not in allowed_tools:
                        allowed_tools.append(tool)
                logger.info(f"Planning mode: adding default allowed tools: {plan_mode_tools}")
            
            # 添加允许的工具
            if allowed_tools:
                for tool in allowed_tools:
                    args.extend(['--allowedTools', tool])
                    logger.info(f"Allowing tool: {tool}")
            
            # 添加禁用的工具
            disallowed_tools = settings.get('disallowedTools', [])
            if disallowed_tools:
                for tool in disallowed_tools:
                    args.extend(['--disallowedTools', tool])
                    logger.info(f"Disabling tool: {tool}")
            
            # 记录跳过权限被计划模式禁用的情况
            if settings.get('skipPermissions') and permission_mode == 'plan':
                logger.info("Planning mode disabled skip permissions setting")
    
    def abort_claude_session(self, session_id: str) -> bool:
        """中止Claude会话"""
        process = self.active_processes.get(session_id)
        if process:
            logger.info(f"Aborting Claude session: {session_id}")
            try:
                process.terminate()
                del self.active_processes[session_id]
                return True
            except Exception as e:
                logger.error(f"中止会话失败: {e}")
                return False
        return False
    
    async def spawn_continue_session(self, options: Dict[str, Any], websocket) -> None:
        """
        启动继续会话进程 - 执行 claude -c 命令
        继续上个会话而不是恢复特定会话
        """
        session_id = options.get('sessionId')
        project_path = options.get('projectPath')
        project_name = options.get('projectName')
        cwd = options.get('cwd', project_path or os.getcwd())
        
        logger.info(f"Starting continue session - project: {project_name}, path: {project_path}, working directory: {cwd}")
        
        # 获取Claude CLI的绝对路径，防止"Command not found"随机性问题
        from app import EnvironmentChecker  # 延迟导入避免循环依赖
        claude_executable = EnvironmentChecker.get_claude_executable_path()
        if not claude_executable:
            error_msg = "未找到Claude CLI可执行文件，请检查安装"
            logger.error(error_msg)
            await websocket.send_text(json.dumps({
                'type': 'claude-error',
                'error': error_msg
            }))
            return
        
        logger.info(f"Continue session using Claude CLI path: {claude_executable}")
        
        # 构建Claude CLI命令参数 - 使用claude命令，claude -c 是交互式命令，不需要其他参数
        args = ['claude']
        
        # 使用工作目录
        working_dir = cwd or os.getcwd()
        
        # 对于 -c 参数，只需要基本的 MCP 配置（如果有的话）
        await self._add_mcp_config_if_available(args)
        
        # 最后添加 -c 参数继续上个会话
        args.append('-c')
        
        logger.info(f"Starting Claude continue session")
        logger.info(f"Complete command: {' '.join(args)}")
        logger.info(f"Command array: {args}")
        logger.info(f"Working directory: {working_dir}")
        logger.info(f"Session info - sessionId: {session_id}, project: {project_name}")
        logger.info(f"Key: using claude -c to continue previous session (not create new session)")
        
        try:
            # 配置终端环境变量，支持完整ANSI颜色
            env = os.environ.copy()
            env.update({
                'TERM': 'xterm-256color',  # 支持256色
                'COLORTERM': 'truecolor',  # 支持真彩色
                'COLUMNS': '120',          # 固定列数
                'LINES': '30',             # 固定行数
                'NO_COLOR': '1',           # 禁用颜色输出，避免警告
            })
            # 移除可能冲突的FORCE_COLOR
            env.pop('FORCE_COLOR', None)
            
            # 启动Claude进程 - 继承标准输入以访问会话历史
            process = await asyncio.create_subprocess_exec(
                *args,
                cwd=working_dir,
                stdin=None,  # 继承父进程的stdin，让claude -c能访问会话历史
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env
            )
            
            # 存储进程引用
            process_key = session_id or str(id(process))
            self.active_processes[process_key] = process
            
            # 处理stdout（流式JSON响应）
            async def handle_stdout():
                logger.info("Starting to monitor Claude continue session stdout...")
                try:
                    while True:
                        try:
                            line = await asyncio.wait_for(process.stdout.readline(), timeout=30.0)
                            if not line:
                                logger.info("Claude continue session stdout ended")
                                break
                        except asyncio.TimeoutError:
                            logger.warning("Claude continue session stdout read timeout, checking process status...")
                            if process.returncode is not None:
                                logger.info(f"Claude continue session process ended, return code: {process.returncode}")
                                break
                            continue
                        
                        try:
                            raw_output = line.decode('utf-8').strip()
                            if not raw_output:
                                continue
                            
                            logger.info(f"Claude continue session stdout: {raw_output[:200]}{'...' if len(raw_output) > 200 else ''}")
                            
                            try:
                                response = json.loads(raw_output)
                                logger.info(f"JSON parsing successful: type={response.get('type')}")
                                
                                # 发送解析后的响应到WebSocket
                                await websocket.send_text(json.dumps({
                                    'type': 'claude-response',
                                    'data': response
                                }))
                            except json.JSONDecodeError:
                                logger.info(f"Non-JSON response: {raw_output}")
                                # 发送原始文本
                                await websocket.send_text(json.dumps({
                                    'type': 'claude-output',
                                    'data': raw_output
                                }))
                        except Exception as e:
                            logger.error(f" 处理stdout行异常: {e}")
                            
                except Exception as e:
                    logger.error(f" handle_stdout异常: {e}")
                finally:
                    logger.info("handle_stdout ended")
            
            # 处理stderr
            async def handle_stderr():
                logger.info("Starting to monitor Claude continue session stderr...")
                try:
                    while True:
                        try:
                            line = await asyncio.wait_for(process.stderr.readline(), timeout=30.0)
                            if not line:
                                logger.info("Claude continue session stderr ended")
                                break
                        except asyncio.TimeoutError:
                            if process.returncode is not None:
                                break
                            continue
                        
                        try:
                            stderr_output = line.decode('utf-8').strip()
                            if stderr_output:
                                logger.error(f" Claude继续会话 stderr: {stderr_output}")
                                if websocket:
                                    await websocket.send_text(json.dumps({
                                        'type': 'claude-error',
                                        'error': stderr_output
                                    }))
                        except Exception as e:
                            logger.error(f" 处理stderr行异常: {e}")
                            
                except Exception as e:
                    logger.error(f" handle_stderr异常: {e}")
                finally:
                    logger.info("handle_stderr ended")
            
            # 启动异步处理任务
            stdout_task = asyncio.create_task(handle_stdout())
            stderr_task = asyncio.create_task(handle_stderr())
            
            # 等待进程完成
            return_code = await process.wait()
            
            # 清理进程引用
            if process_key in self.active_processes:
                del self.active_processes[process_key]
            
            # 发送完成消息
            await websocket.send_text(json.dumps({
                'type': 'claude-complete',
                'exitCode': return_code,
                'isContinueSession': True
            }))
            
            # 等待输出处理完成
            await asyncio.gather(stdout_task, stderr_task, return_exceptions=True)
            
            logger.info(f"Claude continue session process exited, code: {return_code}")
            
        except Exception as error:
            logger.error(f"Claude继续会话进程错误: {error}")
            
            # 清理进程引用
            if process_key in self.active_processes:
                del self.active_processes[process_key]
            
            await websocket.send_text(json.dumps({
                'type': 'claude-error',
                'error': str(error)
            }))
            
            raise
    
    @staticmethod
    def check_claude_availability() -> bool:
        """检查Claude CLI是否可用"""
        from app import EnvironmentChecker  # 延迟导入避免循环依赖
        return EnvironmentChecker.get_claude_executable_path() is not None

# 全局实例
claude_cli = ClaudeCLIIntegration()