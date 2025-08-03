#!/usr/bin/env python3
"""
Heliki OS - 基于Claude Code的系统级AI操作系统
移植并简化自claudecodeui项目
"""

import asyncio
import json
import pty
import select
import shutil
import subprocess
import termios
import threading
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# 导入Claude CLI集成和项目管理器
from claude_cli import claude_cli
from projects_manager import ProjectManager
import os
import mimetypes
import aiofiles

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Heliki OS", description="基于Claude Code的AI操作系统")

# 允许跨域请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态文件服务 - 同时映射/static和根路径下的资源
app.mount("/static", StaticFiles(directory="static"), name="static")
# 为了兼容日志中显示的请求路径，也映射根路径下的css、js等
app.mount("/css", StaticFiles(directory="static/css"), name="css")
app.mount("/js", StaticFiles(directory="static/js"), name="js")
app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")

class EnvironmentChecker:
    """环境检测类"""
    
    @staticmethod
    def check_claude_cli() -> bool:
        """检测Claude CLI是否已安装"""
        return shutil.which('claude') is not None
    
    @staticmethod
    def check_projects_directory() -> bool:
        """检测Claude项目目录是否存在"""
        projects_dir = Path.home() / '.claude' / 'projects'
        return projects_dir.exists()
    
    @staticmethod
    def get_projects_path() -> str:
        """获取Claude项目目录路径"""
        return str(Path.home() / '.claude' / 'projects')
    
    @classmethod
    def check_environment(cls) -> Dict[str, Any]:
        """完整的环境检测"""
        claude_available = cls.check_claude_cli()
        projects_exist = cls.check_projects_directory()
        
        return {
            'claude_cli': claude_available,
            'projects_dir': projects_exist,
            'projects_path': cls.get_projects_path(),
            'ready': claude_available and projects_exist,
            'status': 'ready' if (claude_available and projects_exist) else 'incomplete'
        }

class ProjectScanner:
    """项目扫描类 - 移植自claudecodeui/server/projects.js"""
    
    @staticmethod
    async def get_projects() -> List[Dict[str, Any]]:
        """扫描并返回所有Claude项目"""
        projects = []
        projects_dir = Path.home() / '.claude' / 'projects'
        
        if not projects_dir.exists():
            return projects
        
        try:
            for project_path in projects_dir.iterdir():
                if project_path.is_dir() and not project_path.name.startswith('.'):
                    project_info = {
                        'name': project_path.name,
                        'path': str(project_path),
                        'display_name': project_path.name.replace('-', ' ').title(),
                        'last_modified': project_path.stat().st_mtime,
                        'sessions': []  # 稍后实现会话扫描
                    }
                    projects.append(project_info)
            
            # 按最后修改时间排序
            projects.sort(key=lambda x: x['last_modified'], reverse=True)
            
        except Exception as e:
            logger.error(f"扫描项目时出错: {e}")
        
        return projects

# WebSocket连接管理
class ConnectionManager:
    """WebSocket连接管理器"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.chat_connections: List[WebSocket] = []
        self.shell_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket, connection_type: str):
        await websocket.accept()
        self.active_connections.append(websocket)
        
        if connection_type == 'chat':
            self.chat_connections.append(websocket)
        elif connection_type == 'shell':
            self.shell_connections.append(websocket)
        
        logger.info(f"WebSocket连接已建立: {connection_type}")
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.chat_connections:
            self.chat_connections.remove(websocket)
        if websocket in self.shell_connections:
            self.shell_connections.remove(websocket)
        
        logger.info("WebSocket连接已断开")
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_text(json.dumps(message))

# PTY Shell处理器 - 移植自claudecodeui的node-pty逻辑
class PTYShellHandler:
    """Python PTY Shell处理器，模拟claudecodeui的node-pty功能"""
    
    def __init__(self):
        self.process = None
        self.master_fd = None
        self.websocket = None
        self.running = False
        self.read_thread = None
        self.loop = None  # 保存主事件循环引用
        
        # 输出优化相关状态
        self.output_buffer = ""
        self.last_output_line = ""
        self.consecutive_same_lines = 0
        self.current_cursor_pos = (0, 0)  # (row, col)
        self.screen_state = {}  # 简单的屏幕状态跟踪
    
    def is_running(self):
        """检查PTY进程是否正在运行"""
        return (self.process is not None and 
                self.process.poll() is None and 
                self.running and 
                self.master_fd is not None)
    
    async def start_shell(self, websocket: WebSocket, project_path: str, session_id: str = None, has_session: bool = False, cols: int = 80, rows: int = 24):
        """启动PTY shell进程"""
        # 如果已经有进程在运行，先清理
        if self.is_running():
            logger.info("🔄 检测到已有PTY进程，正在清理...")
            self.cleanup()
            # 等待清理完成
            await asyncio.sleep(0.5)
        
        self.websocket = websocket
        self.loop = asyncio.get_running_loop()  # 保存当前事件循环
        
        try:
            # 构建Claude命令 - 使用fallback机制
            if has_session and session_id:
                # 尝试恢复会话，失败时自动启动新会话（移植自claudecodeui）
                shell_command = f'cd "{project_path}" && (claude --resume {session_id} || claude)'
                logger.info(f"🔄 恢复会话命令（带fallback）: claude --resume {session_id} || claude")
            else:
                # 直接启动新会话
                shell_command = f'cd "{project_path}" && claude'
                logger.info("🆕 启动新Claude会话: claude")
            
            # 设置正确的终端环境变量 - 使用实际尺寸和UTF-8编码
            env = os.environ.copy()
            env.update({
                'TERM': 'xterm-256color',       # 设置终端类型
                'COLORTERM': 'truecolor',       # 启用真彩色
                'FORCE_COLOR': '3',             # 强制彩色输出
                'COLUMNS': str(cols),           # 终端宽度（实际值）
                'LINES': str(rows),             # 终端高度（实际值）
                'LANG': 'en_US.UTF-8',          # 设置UTF-8编码
                'LC_ALL': 'en_US.UTF-8',        # 确保所有locale都是UTF-8
                'BROWSER': 'echo "OPEN_URL:"'   # URL检测
            })
            
            logger.info(f"🚀 启动PTY Shell: {shell_command}")
            logger.info(f"📁 工作目录: {project_path}")
            logger.info(f"🎨 终端环境: TERM={env['TERM']}, COLORTERM={env['COLORTERM']}")
            
            # 创建PTY主从文件描述符对
            self.master_fd, slave_fd = pty.openpty()
            
            # 立即设置PTY窗口尺寸
            try:
                import struct, fcntl
                winsize = struct.pack('HHHH', rows, cols, 0, 0)
                fcntl.ioctl(slave_fd, termios.TIOCSWINSZ, winsize)
                logger.info(f"📐 PTY初始尺寸已设置: {cols}x{rows}")
            except Exception as e:
                logger.warning(f"⚠️ 设置PTY初始尺寸失败: {e}")
            
            # 设置PTY属性 - 模拟node-pty的配置
            try:
                # 获取当前终端属性
                attrs = termios.tcgetattr(slave_fd)
                
                # 输入模式 (iflag) - 类似node-pty的配置
                attrs[0] &= ~(termios.IGNBRK | termios.BRKINT | termios.PARMRK | 
                            termios.ISTRIP | termios.INLCR | termios.IGNCR | 
                            termios.ICRNL | termios.IXON)
                attrs[0] |= termios.BRKINT | termios.ICRNL
                
                # 输出模式 (oflag) - 启用输出处理
                attrs[1] |= termios.OPOST | termios.ONLCR
                
                # 控制模式 (cflag) - 8位数据
                attrs[2] &= ~termios.CSIZE
                attrs[2] |= termios.CS8
                
                # 本地模式 (lflag) - 启用规范模式和回显，这是关键！
                attrs[3] |= (termios.ECHO | termios.ECHOE | termios.ECHOK | 
                           termios.ECHONL | termios.ICANON | termios.ISIG)
                
                # 特殊字符处理
                attrs[6][termios.VEOF] = 4    # Ctrl+D
                attrs[6][termios.VEOL] = 0    # 额外的行结束符
                attrs[6][termios.VERASE] = 127 # 退格键 (DEL)
                attrs[6][termios.VKILL] = 21  # Ctrl+U
                attrs[6][termios.VMIN] = 1    # 最小读取字符
                attrs[6][termios.VTIME] = 0   # 无超时
                
                termios.tcsetattr(slave_fd, termios.TCSANOW, attrs)
                logger.info("✅ PTY配置为类node-pty模式，启用完整终端功能")
            except Exception as e:
                logger.warning(f"⚠️ 设置PTY属性失败: {e}")
            
            # 启动子进程，使用bash执行shell命令
            self.process = subprocess.Popen(
                ['bash', '-c', shell_command],
                stdin=slave_fd,
                stdout=slave_fd,
                stderr=slave_fd,
                env=env,
                preexec_fn=os.setsid,  # 创建新的会话组
                cwd=os.path.expanduser('~')  # 从home目录开始
            )
            
            # 关闭slave端，只保留master端
            os.close(slave_fd)
            
            logger.info(f"✅ PTY Shell进程已启动: PID {self.process.pid}")
            
            # 不发送启动消息，让Claude CLI的原生输出成为唯一信息源
            
            # 启动读取线程
            self.running = True
            self.read_thread = threading.Thread(target=self._read_pty_output, daemon=True)
            self.read_thread.start()
            
            # 添加进程监控
            logger.info(f"🔍 子进程状态: PID={self.process.pid}, poll={self.process.poll()}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ 启动PTY Shell失败: {e}")
            await self.send_output(f"❌ 启动Claude CLI失败: {str(e)}\r\n")
            return False
    
    def _read_pty_output(self):
        """读取PTY输出的线程函数 - 优化重复输出处理"""
        logger.info("🎬 PTY读取线程启动")
        
        try:
            read_count = 0
            while self.running and self.master_fd is not None:
                # 使用select检查是否有数据可读
                ready, _, error = select.select([self.master_fd], [], [self.master_fd], 1.0)
                
                # 检查错误状态
                if error:
                    logger.error(f"❌ PTY select检测到错误: {error}")
                    break
                    
                if ready:
                    try:
                        # 读取PTY输出数据
                        data = os.read(self.master_fd, 1024)
                        if not data:
                            logger.warning("⚠️ PTY读取到空数据，子进程可能已退出")
                            # 检查子进程状态
                            if self.process:
                                poll_result = self.process.poll()
                                if poll_result is not None:
                                    logger.warning(f"⚠️ 子进程已退出，退出码: {poll_result}")
                                    break
                            continue
                        
                        read_count += 1
                        raw_output = data.decode('utf-8', errors='replace')
                        
                        # 暂时禁用复杂的输出处理，直接使用原始输出
                        processed_output = raw_output
                        
                        # 调试日志
                        if processed_output:
                            logger.debug(f"📥 PTY读取#{read_count}: {len(data)}字节原始 -> {len(processed_output)}字符处理后")
                        
                        # 线程安全地发送到WebSocket
                        if self.websocket and processed_output and self.loop:
                            try:
                                future = asyncio.run_coroutine_threadsafe(
                                    self.send_output(processed_output), 
                                    self.loop
                                )
                                # 等待一小段时间确保消息发送
                                future.result(timeout=0.1)
                            except Exception as send_error:
                                logger.error(f"❌ 发送WebSocket消息失败: {send_error}")
                            
                    except OSError as e:
                        if e.errno == 5:  # Input/output error，PTY已关闭
                            logger.info("🔚 PTY已关闭 (I/O错误)")
                            break
                        elif e.errno == 9:  # Bad file descriptor
                            logger.info("🔚 PTY文件描述符无效")
                            break
                        else:
                            logger.error(f"❌ 读取PTY输出错误 (errno={e.errno}): {e}")
                            break
                    except Exception as read_error:
                        logger.error(f"❌ PTY读取异常: {read_error}")
                        break
                else:
                    # 超时，但继续循环（这是正常的）
                    # 每10秒检查一次子进程状态
                    if read_count % 10 == 0 and self.process:
                        poll_result = self.process.poll()
                        if poll_result is not None:
                            logger.warning(f"⚠️ 子进程在超时检查中发现已退出，退出码: {poll_result}")
                            break
                        
        except Exception as e:
            logger.error(f"❌ PTY读取线程异常: {e}")
            import traceback
            logger.error(f"异常详情: {traceback.format_exc()}")
        finally:
            logger.info(f"🔚 PTY读取线程结束 (共读取{read_count}次)")
    
    async def send_input(self, data: str):
        """发送输入到PTY - 增强调试"""
        if self.master_fd is not None:
            try:
                # 调试输入数据
                input_bytes = data.encode('utf-8')
                char_repr = repr(data)
                logger.debug(f"🔤 PTY输入: {char_repr} -> {input_bytes.hex()}")
                
                # 特殊字符处理提示
                if '\x08' in data:  # 退格键
                    logger.debug("⌫ 检测到退格键")
                elif '\x7f' in data:  # DEL键
                    logger.debug("🗑️ 检测到DEL键")
                
                os.write(self.master_fd, input_bytes)
            except Exception as e:
                logger.error(f"❌ 发送PTY输入失败: {e}")
                logger.error(f"❌ 输入数据: {repr(data)}")
    
    def _optimize_ansi_sequences(self, text: str) -> str:
        """优化ANSI转义序列，合并重复操作"""
        import re
        
        # 常见的ANSI转义序列模式
        ansi_patterns = {
            'clear_screen': r'\x1b\[2J',           # 清屏
            'clear_line': r'\x1b\[2K',             # 清除当前行
            'cursor_home': r'\x1b\[H',             # 光标回到家位置
            'cursor_up': r'\x1b\[(\d+)?A',         # 光标向上移动
            'cursor_down': r'\x1b\[(\d+)?B',       # 光标向下移动
            'cursor_right': r'\x1b\[(\d+)?C',      # 光标向右移动
            'cursor_left': r'\x1b\[(\d+)?D',       # 光标向左移动
            'cursor_position': r'\x1b\[(\d+);(\d+)H',  # 设置光标位置
            'erase_display': r'\x1b\[(\d+)?J',     # 擦除显示
            'erase_line': r'\x1b\[(\d+)?K',        # 擦除行
            'save_cursor': r'\x1b\[s',             # 保存光标位置
            'restore_cursor': r'\x1b\[u',          # 恢复光标位置
        }
        
        # 检测重复的清屏操作
        clear_screen_matches = list(re.finditer(ansi_patterns['clear_screen'], text))
        if len(clear_screen_matches) > 1:
            # 只保留最后一个清屏操作
            last_clear = clear_screen_matches[-1]
            # 移除之前的清屏操作
            for match in clear_screen_matches[:-1]:
                text = text[:match.start()] + text[match.end():]
                # 需要重新计算位置
                offset = match.end() - match.start()
                last_clear = re.search(ansi_patterns['clear_screen'], text)
            
            logger.debug(f"🧹 合并了{len(clear_screen_matches)-1}个重复的清屏操作")
        
        # 检测重复的光标移动
        cursor_moves = re.findall(r'\x1b\[[\d;]*[ABCD]', text)
        if len(cursor_moves) > 3:  # 如果有过多的光标移动
            # 简化连续的光标移动操作
            simplified = re.sub(r'(\x1b\[[\d;]*[ABCD]){3,}', lambda m: m.group(0)[-10:], text)
            if len(simplified) < len(text):
                logger.debug(f"🧹 简化了光标移动序列: {len(text)} -> {len(simplified)}")
                text = simplified
        
        # 检测重复的行清除操作
        clear_line_pattern = r'\x1b\[2K\r?'
        clear_line_matches = list(re.finditer(clear_line_pattern, text))
        if len(clear_line_matches) > 2:
            # 合并连续的行清除操作
            consecutive_groups = []
            current_group = [clear_line_matches[0]]
            
            for i in range(1, len(clear_line_matches)):
                current_match = clear_line_matches[i]
                prev_match = clear_line_matches[i-1]
                
                # 如果两个匹配之间只有少量字符，认为是连续的
                gap = text[prev_match.end():current_match.start()]
                if len(gap.strip()) < 5:  # 少于5个非空白字符
                    current_group.append(current_match)
                else:
                    consecutive_groups.append(current_group)
                    current_group = [current_match]
            
            consecutive_groups.append(current_group)
            
            # 对每个连续组，只保留最后一个
            offset = 0
            for group in consecutive_groups:
                if len(group) > 1:
                    for match in group[:-1]:
                        adjusted_start = match.start() - offset
                        adjusted_end = match.end() - offset
                        text = text[:adjusted_start] + text[adjusted_end:]
                        offset += adjusted_end - adjusted_start
        
        return text
    
    def _process_terminal_output(self, raw_output: str) -> str:
        """处理终端输出，去除重复和优化ANSI序列"""
        import re
        
        # 首先处理ANSI转义序列优化
        optimized_output = self._optimize_ansi_sequences(raw_output)
        
        # 将输出添加到缓冲区
        self.output_buffer += optimized_output
        
        # 分析ANSI转义序列
        processed_chunks = []
        current_buffer = self.output_buffer
        
        # 检测常见的Claude CLI重复模式
        claude_task_pattern = r'⏺\s+([^⏺\n]+(?:\n(?!\s*⏺)[^\n]*)*)'
        claude_thinking_pattern = r'✻\s+Thinking[^\n]*'
        claude_progress_pattern = r'·\s+Processing[^\n]*'
        
        # 处理完整的行
        lines = current_buffer.split('\n')
        self.output_buffer = lines[-1] if not current_buffer.endswith('\n') else ""
        
        for i, line in enumerate(lines[:-1] if not current_buffer.endswith('\n') else lines):
            # 检测Claude CLI任务行的重复
            if re.match(r'⏺\s+', line):
                # 这是一个任务行，检查是否与上一行相同
                clean_line = re.sub(r'\x1b\[[0-9;]*[mK]', '', line).strip()
                clean_last = re.sub(r'\x1b\[[0-9;]*[mK]', '', self.last_output_line).strip()
                
                if clean_line == clean_last:
                    # 重复的任务行，跳过
                    self.consecutive_same_lines += 1
                    if self.consecutive_same_lines > 2:  # 允许少量重复，超过2次才过滤
                        continue
                else:
                    self.consecutive_same_lines = 0
                    self.last_output_line = line
            
            # 检测进度更新行
            elif re.match(r'·\s+Processing|✻\s+Thinking', line):
                # 进度行，检查是否需要去重
                clean_line = re.sub(r'\([^)]*\)', '', line)  # 移除括号内容（如时间）
                clean_line = re.sub(r'\x1b\[[0-9;]*[mK]', '', clean_line).strip()
                
                if clean_line in getattr(self, '_recent_progress_lines', set()):
                    continue  # 跳过重复的进度行
                
                # 记录最近的进度行（最多保持5个）
                if not hasattr(self, '_recent_progress_lines'):
                    self._recent_progress_lines = set()
                if len(self._recent_progress_lines) > 5:
                    self._recent_progress_lines.clear()
                self._recent_progress_lines.add(clean_line)
            
            # 检测空行的重复
            elif line.strip() == "":
                if hasattr(self, '_last_was_empty') and self._last_was_empty:
                    continue  # 跳过连续的空行
                self._last_was_empty = True
            else:
                self._last_was_empty = False
            
            processed_chunks.append(line)
        
        # 如果有未完成的缓冲区，也要处理
        if current_buffer.endswith('\n'):
            processed_chunks.append("")
        
        result = '\n'.join(processed_chunks) if processed_chunks else ""
        
        # 记录过滤统计
        if len(result) < len(raw_output):
            logger.debug(f"🧹 输出过滤: {len(raw_output)} -> {len(result)} 字符 (减少{len(raw_output)-len(result)})")
        
        return result
    
    async def send_output(self, data: str):
        """发送输出到WebSocket"""
        if self.websocket:
            try:
                # 检测URL并处理
                import re
                url_patterns = [
                    r'(?:xdg-open|open|start)\s+(https?://[^\s\x1b\x07]+)',
                    r'OPEN_URL:\s*(https?://[^\s\x1b\x07]+)',
                    r'Opening\s+(https?://[^\s\x1b\x07]+)',
                    r'Visit:\s*(https?://[^\s\x1b\x07]+)',
                    r'View at:\s*(https?://[^\s\x1b\x07]+)',
                    r'Browse to:\s*(https?://[^\s\x1b\x07]+)'
                ]
                
                for pattern in url_patterns:
                    matches = re.findall(pattern, data, re.IGNORECASE)
                    for url in matches:
                        logger.info(f"🔗 检测到URL: {url}")
                        await self.websocket.send_text(json.dumps({
                            'type': 'url_open',
                            'url': url
                        }))
                
                # 发送输出数据
                await self.websocket.send_text(json.dumps({
                    'type': 'output',
                    'data': data
                }))
            except Exception as e:
                logger.error(f"❌ 发送WebSocket输出失败: {e}")
    
    async def resize_terminal(self, cols: int, rows: int):
        """调整终端大小 - 改进版"""
        if self.master_fd is not None and cols > 0 and rows > 0:
            try:
                import struct, fcntl, termios
                
                # 记录调整信息
                logger.info(f"📐 PTY终端调整大小: {cols}x{rows}")
                
                # 发送TIOCSWINSZ信号调整终端窗口大小
                # 格式: rows, cols, xpixel, ypixel
                winsize = struct.pack('HHHH', rows, cols, 0, 0)
                fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, winsize)
                
                logger.debug(f"✅ PTY终端大小已调整为: {cols}x{rows}")
                
            except Exception as e:
                logger.error(f"❌ 调整PTY终端大小失败 ({cols}x{rows}): {e}")
        else:
            logger.warning(f"⚠️ 无效的终端大小或PTY未就绪: {cols}x{rows}, fd={self.master_fd}")
    
    def cleanup(self):
        """清理PTY资源"""
        logger.info("🧹 清理PTY Shell资源...")
        
        self.running = False
        
        # 等待读取线程结束
        if self.read_thread and self.read_thread.is_alive():
            self.read_thread.join(timeout=2.0)
        
        # 终止进程
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=5.0)
            except Exception as e:
                logger.warning(f"⚠️ 终止PTY进程失败: {e}")
                try:
                    self.process.kill()
                except:
                    pass
        
        # 关闭master文件描述符
        if self.master_fd is not None:
            try:
                os.close(self.master_fd)
            except:
                pass
            self.master_fd = None
        
        logger.info("✅ PTY Shell资源清理完成")
    
    async def broadcast(self, message: dict, connection_type: str = 'all'):
        connections = self.active_connections
        if connection_type == 'chat':
            connections = self.chat_connections
        elif connection_type == 'shell':
            connections = self.shell_connections
        
        for connection in connections:
            try:
                await connection.send_text(json.dumps(message))
            except:
                # 连接可能已断开
                pass

manager = ConnectionManager()

# 文件管理辅助函数
async def build_file_tree(path: Path, max_depth: int = 3, current_depth: int = 0) -> List[Dict[str, Any]]:
    """构建文件树结构"""
    items = []
    
    if current_depth >= max_depth:
        return items
    
    try:
        # 忽略的目录和文件
        ignore_patterns = {
            '.git', '.svn', '.hg', '__pycache__', '.pytest_cache',
            'node_modules', '.venv', 'venv', '.env',
            '.DS_Store', 'Thumbs.db', '.vscode', '.idea'
        }
        
        entries = []
        for entry in path.iterdir():
            if entry.name.startswith('.') and entry.name not in {'.gitignore', '.env.example'}:
                continue
            if entry.name in ignore_patterns:
                continue
            entries.append(entry)
        
        # 排序：目录优先，然后按名称
        entries.sort(key=lambda x: (not x.is_dir(), x.name.lower()))
        
        for entry in entries:
            try:
                stat_info = entry.stat()
                
                item = {
                    'name': entry.name,
                    'path': str(entry),
                    'type': 'directory' if entry.is_dir() else 'file',
                    'size': stat_info.st_size if entry.is_file() else None,
                    'modified': stat_info.st_mtime,
                    'permissions': oct(stat_info.st_mode)[-3:],
                    'permissionsRwx': get_permissions_string(stat_info.st_mode)
                }
                
                if entry.is_dir():
                    # 递归构建子目录
                    item['children'] = await build_file_tree(entry, max_depth, current_depth + 1)
                else:
                    # 文件类型检测
                    item['mimeType'] = mimetypes.guess_type(str(entry))[0]
                    item['isBinary'] = is_binary_file(entry)
                
                items.append(item)
                
            except (PermissionError, OSError) as e:
                logger.warning(f"无法访问 {entry}: {e}")
                continue
                
    except (PermissionError, OSError) as e:
        logger.error(f"无法读取目录 {path}: {e}")
    
    return items

def get_permissions_string(mode: int) -> str:
    """转换权限模式为可读字符串"""
    permissions = ''
    
    # 用户权限
    permissions += 'r' if mode & 0o400 else '-'
    permissions += 'w' if mode & 0o200 else '-'
    permissions += 'x' if mode & 0o100 else '-'
    
    # 组权限
    permissions += 'r' if mode & 0o040 else '-'
    permissions += 'w' if mode & 0o020 else '-'
    permissions += 'x' if mode & 0o010 else '-'
    
    # 其他权限
    permissions += 'r' if mode & 0o004 else '-'
    permissions += 'w' if mode & 0o002 else '-'
    permissions += 'x' if mode & 0o001 else '-'
    
    return permissions

def is_binary_file(file_path: Path) -> bool:
    """检测文件是否为二进制文件"""
    if not file_path.is_file():
        return False
    
    # 根据扩展名快速判断
    text_extensions = {
        '.txt', '.md', '.py', '.js', '.ts', '.jsx', '.tsx', '.css', '.scss', '.sass',
        '.html', '.htm', '.xml', '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg',
        '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
        '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.java', '.kt', '.rs', '.go',
        '.php', '.rb', '.pl', '.swift', '.m', '.mm', '.r', '.sql', '.dockerfile',
        '.gitignore', '.gitattributes', '.editorconfig', '.eslintrc', '.prettierrc'
    }
    
    binary_extensions = {
        '.exe', '.dll', '.so', '.dylib', '.app', '.dmg', '.pkg', '.deb', '.rpm',
        '.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar',
        '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.svg', '.ico', '.webp',
        '.mp3', '.wav', '.flac', '.ogg', '.aac', '.m4a',
        '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm',
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.ttf', '.otf', '.woff', '.woff2', '.eot'
    }
    
    extension = file_path.suffix.lower()
    
    if extension in text_extensions:
        return False
    if extension in binary_extensions:
        return True
    
    # 对于未知扩展名，读取前1024字节检测
    try:
        with open(file_path, 'rb') as f:
            chunk = f.read(1024)
            if not chunk:
                return False
            
            # 检测是否包含零字节（二进制文件的典型特征）
            if b'\x00' in chunk:
                return True
            
            # 检测非可打印字符的比例
            try:
                chunk.decode('utf-8')
                return False
            except UnicodeDecodeError:
                return True
                
    except (IOError, OSError):
        return True
    
    return False

# API路由
@app.get("/")
async def read_root():
    """主页路由"""
    with open("static/index.html", "r", encoding="utf-8") as f:
        html_content = f.read()
    return HTMLResponse(content=html_content)

@app.get("/api/environment")
async def check_environment():
    """环境检测API"""
    env_status = EnvironmentChecker.check_environment()
    return JSONResponse(content=env_status)

@app.get("/api/projects")
async def get_projects():
    """获取项目列表API - 使用新的项目管理器"""
    try:
        projects = await ProjectManager.get_projects()
        return JSONResponse(content={"projects": projects})
    except Exception as e:
        logger.error(f"获取项目列表时出错: {e}")
        return JSONResponse(
            status_code=500, 
            content={"error": "获取项目列表失败", "details": str(e)}
        )

@app.get("/api/projects/{project_name}/sessions")
async def get_project_sessions(project_name: str, limit: int = 5, offset: int = 0):
    """获取项目会话列表API"""
    try:
        sessions_data = await ProjectManager.get_sessions(project_name, limit, offset)
        return JSONResponse(content=sessions_data)
    except Exception as e:
        logger.error(f"获取项目 {project_name} 会话时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "获取会话列表失败", "details": str(e)}
        )

@app.get("/api/projects/{project_name}/sessions/{session_id}/messages")
async def get_session_messages(project_name: str, session_id: str):
    """获取会话消息API"""
    try:
        messages = await ProjectManager.get_session_messages(project_name, session_id)
        return JSONResponse(content={"messages": messages})
    except Exception as e:
        logger.error(f"获取会话 {session_id} 消息时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "获取会话消息失败", "details": str(e)}
        )

@app.post("/api/projects/{project_name}/rename")
async def rename_project(project_name: str, request: Request):
    """重命名项目API"""
    try:
        data = await request.json()
        new_name = data.get('displayName', '')
        
        success = await ProjectManager.rename_project(project_name, new_name)
        if success:
            return JSONResponse(content={"success": True})
        else:
            return JSONResponse(
                status_code=400,
                content={"error": "重命名项目失败"}
            )
    except Exception as e:
        logger.error(f"重命名项目 {project_name} 时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "重命名项目失败", "details": str(e)}
        )

@app.delete("/api/projects/{project_name}/sessions/{session_id}")
async def delete_session(project_name: str, session_id: str):
    """删除会话API"""
    try:
        success = await ProjectManager.delete_session(project_name, session_id)
        if success:
            return JSONResponse(content={"success": True})
        else:
            return JSONResponse(
                status_code=400,
                content={"error": "删除会话失败"}
            )
    except Exception as e:
        logger.error(f"删除会话 {session_id} 时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "删除会话失败", "details": str(e)}
        )

@app.delete("/api/projects/{project_name}")
async def delete_project(project_name: str):
    """删除空项目API"""
    try:
        success = await ProjectManager.delete_project(project_name)
        if success:
            return JSONResponse(content={"success": True})
        else:
            return JSONResponse(
                status_code=400,
                content={"error": "删除项目失败"}
            )
    except Exception as e:
        logger.error(f"删除项目 {project_name} 时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "删除项目失败", "details": str(e)}
        )

@app.post("/api/projects/create")
async def create_project(request: Request):
    """手动创建项目API"""
    try:
        data = await request.json()
        project_path = data.get('path', '')
        display_name = data.get('displayName')
        
        if not project_path:
            return JSONResponse(
                status_code=400,
                content={"error": "项目路径不能为空"}
            )
        
        project = await ProjectManager.add_project_manually(project_path, display_name)
        return JSONResponse(content={"success": True, "project": project})
        
    except Exception as e:
        logger.error(f"创建项目时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "创建项目失败", "details": str(e)}
        )

@app.get("/api/projects/{project_name}/files")
async def get_project_files(project_name: str):
    """获取项目文件树API"""
    try:
        # 从项目管理器获取项目路径
        projects = await ProjectManager.get_projects()
        project = next((p for p in projects if p['name'] == project_name), None)
        
        if not project:
            return JSONResponse(
                status_code=404,
                content={"error": "项目不存在"}
            )
        
        project_path = Path(project['path'])
        if not project_path.exists():
            return JSONResponse(
                status_code=404,
                content={"error": "项目路径不存在"}
            )
        
        # 构建文件树
        file_tree = await build_file_tree(project_path)
        return JSONResponse(content=file_tree)
        
    except Exception as e:
        logger.error(f"获取项目 {project_name} 文件时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "获取文件列表失败", "details": str(e)}
        )

@app.get("/api/files/read")
async def read_file(file_path: str, project_path: str):
    """读取文件内容API"""
    try:
        # 安全检查：确保文件在项目目录内
        project_path = Path(project_path).resolve()
        file_path = Path(file_path).resolve()
        
        if not str(file_path).startswith(str(project_path)):
            return JSONResponse(
                status_code=403,
                content={"error": "访问被拒绝：文件不在项目目录内"}
            )
        
        if not file_path.exists():
            return JSONResponse(
                status_code=404,
                content={"error": "文件不存在"}
            )
        
        # 检查是否为二进制文件
        if is_binary_file(file_path):
            return JSONResponse(
                status_code=400,
                content={"error": "无法读取二进制文件"}
            )
        
        # 读取文件内容
        async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
            content = await f.read()
        
        return JSONResponse(content={
            "content": content,
            "path": str(file_path),
            "size": file_path.stat().st_size,
            "modified": file_path.stat().st_mtime
        })
        
    except Exception as e:
        logger.error(f"读取文件 {file_path} 时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "读取文件失败", "details": str(e)}
        )

@app.post("/api/files/write")
async def write_file(request: Request):
    """写入文件内容API"""
    try:
        data = await request.json()
        file_path = data.get('filePath', '')
        content = data.get('content', '')
        project_path = data.get('projectPath', '')
        
        if not file_path or not project_path:
            return JSONResponse(
                status_code=400,
                content={"error": "文件路径和项目路径不能为空"}
            )
        
        # 安全检查
        project_path = Path(project_path).resolve()
        file_path = Path(file_path).resolve()
        
        if not str(file_path).startswith(str(project_path)):
            return JSONResponse(
                status_code=403,
                content={"error": "访问被拒绝：文件不在项目目录内"}
            )
        
        # 确保目录存在
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 写入文件
        async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
            await f.write(content)
        
        return JSONResponse(content={"success": True})
        
    except Exception as e:
        logger.error(f"写入文件时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "写入文件失败", "details": str(e)}
        )

# WebSocket路由
@app.websocket("/ws")
async def chat_websocket_endpoint(websocket: WebSocket):
    """聊天WebSocket端点 - 移植自claudecodeui"""
    await manager.connect(websocket, 'chat')
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # 处理不同类型的消息
            if message.get('type') == 'claude-command':
                command = message.get('command', '')
                options = message.get('options', {})
                
                logger.info(f"用户消息: {command or '[Continue/Resume]'}")
                logger.info(f"项目: {options.get('projectPath', 'Unknown')}")
                logger.info(f"会话: {'Resume' if options.get('sessionId') else 'New'}")
                
                try:
                    await claude_cli.spawn_claude(command, options, websocket)
                except Exception as e:
                    logger.error(f"Claude CLI错误: {e}")
                    await manager.send_personal_message({
                        'type': 'claude-error',
                        'error': str(e)
                    }, websocket)
            elif message.get('type') == 'abort-session':
                session_id = message.get('sessionId')
                logger.info(f"中止会话请求: {session_id}")
                success = claude_cli.abort_claude_session(session_id)
                await manager.send_personal_message({
                    'type': 'session-aborted',
                    'sessionId': session_id,
                    'success': success
                }, websocket)
            elif message.get('type') == 'ping':
                await manager.send_personal_message({
                    'type': 'pong'
                }, websocket)
            else:
                logger.info(f"收到未知消息类型: {message.get('type')}")
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket错误: {e}")
        manager.disconnect(websocket)

@app.websocket("/shell")
async def shell_websocket_endpoint(websocket: WebSocket):
    """终端WebSocket端点 - 使用PTY处理器"""
    await manager.connect(websocket, 'shell')
    pty_handler = PTYShellHandler()
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # 处理终端消息
            if message.get('type') == 'init':
                project_path = message.get('projectPath', str(Path.cwd()))
                session_id = message.get('sessionId')
                has_session = message.get('hasSession', False)
                cols = message.get('cols', 80)
                rows = message.get('rows', 24)
                
                logger.info(f"🚀 PTY Shell初始化请求")
                logger.info(f"📁 项目路径: {project_path}")
                logger.info(f"📋 会话信息: {'恢复会话 ' + str(session_id) if has_session else '新会话'}")
                logger.info(f"📐 终端大小: {cols}x{rows}")
                
                # 检查项目路径是否存在
                if not Path(project_path).exists():
                    error_msg = f"❌ 项目路径不存在: {project_path}\r\n"
                    await websocket.send_text(json.dumps({
                        'type': 'output',
                        'data': error_msg
                    }))
                    logger.error(f"项目路径不存在: {project_path}")
                    continue
                
                # 如果PTY已经在运行，先清理
                if hasattr(pty_handler, 'process') and pty_handler.process:
                    logger.info("🔄 检测到已有PTY进程，先清理")
                    pty_handler.cleanup()
                
                # 启动PTY Shell（传入正确的终端尺寸）
                success = await pty_handler.start_shell(websocket, project_path, session_id, has_session, cols, rows)
                # 如果启动成功，尺寸已在初始化时设置，无需额外调用resize
            
            elif message.get('type') == 'input':
                # 处理用户输入 - 发送到PTY
                input_data = message.get('data', '')
                await pty_handler.send_input(input_data)
            
            elif message.get('type') == 'resize':
                # 处理终端大小调整
                cols = message.get('cols', 80)
                rows = message.get('rows', 24)
                logger.info(f"📐 终端调整大小: {cols}x{rows}")
                await pty_handler.resize_terminal(cols, rows)
                
    except WebSocketDisconnect:
        logger.info("🔌 Shell WebSocket客户端断开连接")
        manager.disconnect(websocket)
        pty_handler.cleanup()
    except Exception as e:
        logger.error(f"❌ Shell WebSocket异常错误: {e}")
        logger.error(f"❌ 错误类型: {type(e).__name__}")
        
        # 发送错误消息给客户端
        try:
            await websocket.send_text(json.dumps({
                'type': 'output',
                'data': f"❌ Shell连接错误: {str(e)}\r\n"
            }))
        except:
            pass  # 如果连接已断开，忽略发送错误
            
        manager.disconnect(websocket)
        pty_handler.cleanup()
    finally:
        # 确保资源清理
        try:
            pty_handler.cleanup()
        except:
            pass

# PTY处理器已包含所有必要的输入输出处理功能

if __name__ == "__main__":
    print("🚀 启动 Heliki OS...")
    print(f"📁 项目目录: {Path.cwd()}")
    
    # 检查环境
    env_status = EnvironmentChecker.check_environment()
    print(f"🔍 环境检测结果:")
    print(f"   Claude CLI: {'✅' if env_status['claude_cli'] else '❌'}")
    print(f"   项目目录: {'✅' if env_status['projects_dir'] else '❌'}")
    print(f"   状态: {'✅ 就绪' if env_status['ready'] else '⚠️  需要配置'}")
    
    uvicorn.run(
        "app:app", 
        host="localhost", 
        port=3005, 
        reload=True,
        log_level="info"
    )