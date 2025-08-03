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
        
        captured_session_id = session_id
        session_created_sent = False
        
        # 构建Claude CLI命令参数
        args = ['claude']
        
        # 添加print标志和命令
        if command and command.strip():
            args.extend(['--print', command])
        
        # 使用工作目录
        working_dir = cwd or os.getcwd()
        
        # 处理会话恢复
        if resume and session_id:
            args.extend(['--resume', session_id])
        
        # 添加基础标志
        args.extend(['--output-format', 'stream-json', '--verbose'])
        
        # 检查MCP配置
        await self._add_mcp_config_if_available(args)
        
        # 添加模型参数（仅新会话）
        if not resume:
            args.extend(['--model', 'sonnet'])
        
        # 添加权限模式
        if permission_mode and permission_mode != 'default':
            args.extend(['--permission-mode', permission_mode])
            logger.info(f"使用权限模式: {permission_mode}")
        
        # 添加工具设置
        self._add_tools_settings(args, tools_settings, permission_mode)
        
        logger.info(f"启动Claude CLI: {' '.join(args)}")
        logger.info(f"工作目录: {working_dir}")
        logger.info(f"会话信息 - 输入session_id: {session_id}, 恢复: {resume}")
        
        try:
            # 配置终端环境变量，支持完整ANSI颜色
            env = os.environ.copy()
            env.update({
                'TERM': 'xterm-256color',  # 支持256色
                'COLORTERM': 'truecolor',  # 支持真彩色
                'COLUMNS': '120',          # 固定列数
                'LINES': '30',             # 固定行数
                'FORCE_COLOR': '1',        # 强制彩色输出
                'NO_COLOR': '',            # 清除禁用颜色标志
            })
            
            # 启动Claude进程
            process = await asyncio.create_subprocess_exec(
                *args,
                cwd=working_dir,
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
                
                logger.info("🚀 开始监听Claude CLI stdout...")
                try:
                    while True:
                        # 使用更小的缓冲区并添加超时
                        try:
                            line = await asyncio.wait_for(process.stdout.readline(), timeout=30.0)
                            if not line:
                                logger.info("📜 Claude CLI stdout结束")
                                break
                        except asyncio.TimeoutError:
                            logger.warning("⏰ Claude CLI stdout读取超时，检查进程状态...")
                            if process.returncode is not None:
                                logger.info(f"🔚 Claude CLI进程已结束，返回码: {process.returncode}")
                                break
                            continue
                        
                        try:
                            raw_output = line.decode('utf-8').strip()
                            if not raw_output:
                                continue
                            
                            logger.info(f"📤 Claude CLI stdout: {raw_output[:200]}{'...' if len(raw_output) > 200 else ''}")
                            
                            try:
                                response = json.loads(raw_output)
                                logger.info(f"✅ 解析JSON成功: type={response.get('type')}, session_id={response.get('session_id')}")
                                
                                # 捕获session ID
                                if response.get('session_id') and not captured_session_id:
                                    captured_session_id = response['session_id']
                                    logger.info(f"🆔 捕获到session ID: {captured_session_id}")
                                    
                                    # 更新进程键
                                    if process_key != captured_session_id:
                                        if process_key in self.active_processes:
                                            del self.active_processes[process_key]
                                        self.active_processes[captured_session_id] = process
                                    
                                    # 发送session-created事件（仅新会话）
                                    if not session_id and not session_created_sent:
                                        session_created_sent = True
                                        await websocket.send_text(json.dumps({
                                            'type': 'session-created',
                                            'sessionId': captured_session_id
                                        }))
                                        logger.info("📨 发送session-created事件")
                                
                                # 发送解析的响应到WebSocket
                                await websocket.send_text(json.dumps({
                                    'type': 'claude-response',
                                    'data': response
                                }))
                                logger.info("📤 发送claude-response到前端")
                                
                            except json.JSONDecodeError as je:
                                logger.info(f"📄 非JSON响应: {raw_output[:100]}{'...' if len(raw_output) > 100 else ''}")
                                # 发送原始文本
                                await websocket.send_text(json.dumps({
                                    'type': 'claude-output',
                                    'data': raw_output
                                }))
                                logger.info("📤 发送claude-output到前端")
                        
                        except Exception as e:
                            logger.error(f"❌ 处理单行stdout时出错: {e}")
                            
                except Exception as e:
                    logger.error(f"❌ handle_stdout异常: {e}")
                finally:
                    logger.info("🔚 handle_stdout结束")
            
            # 处理stderr
            async def handle_stderr():
                logger.info("🚀 开始监听Claude CLI stderr...")
                try:
                    while True:
                        try:
                            line = await asyncio.wait_for(process.stderr.readline(), timeout=10.0)
                            if not line:
                                logger.info("📜 Claude CLI stderr结束")
                                break
                        except asyncio.TimeoutError:
                            if process.returncode is not None:
                                break
                            continue
                        
                        try:
                            error_output = line.decode('utf-8').strip()
                            if error_output:
                                logger.error(f"🚨 Claude CLI stderr: {error_output}")
                                await websocket.send_text(json.dumps({
                                    'type': 'claude-error',
                                    'error': error_output
                                }))
                        except Exception as e:
                            logger.error(f"❌ 处理stderr时出错: {e}")
                except Exception as e:
                    logger.error(f"❌ handle_stderr异常: {e}")
                finally:
                    logger.info("🔚 handle_stderr结束")
            
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
            
            logger.info(f"Claude CLI进程退出，代码: {return_code}")
            
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
            logger.info("开始检查MCP配置...")
            
            # 检查~/.claude.json中的MCP配置
            claude_config_path = Path.home() / '.claude.json'
            
            logger.info(f"检查MCP配置文件: {claude_config_path}")
            logger.info(f"Claude配置文件存在: {claude_config_path.exists()}")
            
            has_mcp_servers = False
            
            if claude_config_path.exists():
                try:
                    with open(claude_config_path, 'r', encoding='utf-8') as f:
                        claude_config = json.load(f)
                    
                    # 检查全局MCP服务器
                    if claude_config.get('mcpServers') and len(claude_config['mcpServers']) > 0:
                        logger.info(f"找到 {len(claude_config['mcpServers'])} 个全局MCP服务器")
                        has_mcp_servers = True
                    
                    # 检查项目特定的MCP服务器
                    if not has_mcp_servers and claude_config.get('claudeProjects'):
                        current_project_path = os.getcwd()
                        project_config = claude_config['claudeProjects'].get(current_project_path)
                        if project_config and project_config.get('mcpServers') and len(project_config['mcpServers']) > 0:
                            logger.info(f"找到 {len(project_config['mcpServers'])} 个项目MCP服务器")
                            has_mcp_servers = True
                
                except json.JSONDecodeError as e:
                    logger.error(f"解析Claude配置文件失败: {e}")
                except Exception as e:
                    logger.error(f"读取Claude配置文件时出错: {e}")
            
            logger.info(f"MCP服务器检查结果: {has_mcp_servers}")
            
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
                    logger.info(f"添加MCP配置: {config_path}")
                    args.extend(['--mcp-config', config_path])
                else:
                    logger.warning("检测到MCP服务器但未找到有效配置文件")
        
        except Exception as error:
            logger.error(f"MCP配置检查失败: {error}")
            logger.info("继续执行，不使用MCP支持")
    
    def _add_tools_settings(self, args: List[str], settings: Dict[str, Any], permission_mode: str) -> None:
        """添加工具设置参数"""
        # 如果跳过权限且不在计划模式
        if settings.get('skipPermissions') and permission_mode != 'plan':
            args.append('--dangerously-skip-permissions')
            logger.warning("使用 --dangerously-skip-permissions（跳过其他工具设置）")
        else:
            # 收集允许的工具
            allowed_tools = list(settings.get('allowedTools', []))
            
            # 为计划模式添加特定工具
            if permission_mode == 'plan':
                plan_mode_tools = ['Read', 'Task', 'exit_plan_mode', 'TodoRead', 'TodoWrite']
                for tool in plan_mode_tools:
                    if tool not in allowed_tools:
                        allowed_tools.append(tool)
                logger.info(f"计划模式: 添加默认允许工具: {plan_mode_tools}")
            
            # 添加允许的工具
            if allowed_tools:
                for tool in allowed_tools:
                    args.extend(['--allowedTools', tool])
                    logger.info(f"允许工具: {tool}")
            
            # 添加禁用的工具
            disallowed_tools = settings.get('disallowedTools', [])
            if disallowed_tools:
                for tool in disallowed_tools:
                    args.extend(['--disallowedTools', tool])
                    logger.info(f"禁用工具: {tool}")
            
            # 记录跳过权限被计划模式禁用的情况
            if settings.get('skipPermissions') and permission_mode == 'plan':
                logger.info("计划模式禁用了跳过权限设置")
    
    def abort_claude_session(self, session_id: str) -> bool:
        """中止Claude会话"""
        process = self.active_processes.get(session_id)
        if process:
            logger.info(f"中止Claude会话: {session_id}")
            try:
                process.terminate()
                del self.active_processes[session_id]
                return True
            except Exception as e:
                logger.error(f"中止会话失败: {e}")
                return False
        return False
    
    @staticmethod
    def check_claude_availability() -> bool:
        """检查Claude CLI是否可用"""
        return shutil.which('claude') is not None

# 全局实例
claude_cli = ClaudeCLIIntegration()