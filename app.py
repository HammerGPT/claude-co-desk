#!/usr/bin/env python3
"""
Claude Co-Desk - 基于Claude Code的智能协作平台
移植并简化自claudecodeui项目
"""

import asyncio
import json
import platform
import shutil
import subprocess
import threading
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from contextlib import asynccontextmanager
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# Platform-specific imports for PTY functionality
IS_WINDOWS = platform.system() == 'Windows'

if not IS_WINDOWS:
    import pty
    import select
    import termios
    # fcntl will be imported locally where needed

# 导入Claude CLI集成和项目管理器
from claude_cli import claude_cli
from projects_manager import ProjectManager
from task_scheduler import TaskScheduler
from config import Config
from user_config import user_config_manager
# Dynamic import to avoid hardcoded path dependencies
import sys
from pathlib import Path

# Add MCP services to Python path for dynamic imports
_mcp_app_control_path = Path(__file__).parent / "mcp_services" / "app_control"
if str(_mcp_app_control_path) not in sys.path:
    sys.path.append(str(_mcp_app_control_path))

from app_scanner import ApplicationScanner, ApplicationInfo
from mcp_config_generator import MCPConfigGenerator
import os
import mimetypes
import aiofiles

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# WeChat MCP Service initialization
async def init_wechat_mcp_service():
    """Initialize WeChat notification MCP service configuration"""
    from pathlib import Path
    import json
    from user_config import get_user_config
    
    try:
        # 确保微信MCP服务目录存在
        mcp_services_path = Path(__file__).parent / "mcp_services" / "wechat_notification"
        mcp_services_path.mkdir(parents=True, exist_ok=True)
        
        # 获取用户配置
        user_config = await get_user_config()
        user_identifier = user_config.get("user_identifier")
        api_key = user_config.get("api_key")
        
        if not user_identifier or not api_key:
            logger.warning("User not registered, skipping WeChat MCP service initialization")
            return
        
        # 创建或更新微信MCP服务配置文件
        config_path = mcp_services_path / "wechat_config.json"
        
        # 检查现有配置
        existing_config = {}
        if config_path.exists():
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    existing_config = json.load(f)
            except Exception as e:
                logger.warning(f"Failed to read existing WeChat MCP config: {e}")
        
        # 更新配置
        config_data = {
            "service_name": "wechat_notification",
            "description": "WeChat notification service via cloud API",
            "api_config": {
                "base_url": "https://www.heliki.com/wechat",
                "user_identifier": user_identifier,
                "api_key": api_key,
                "timeout": 30
            },
            "notification_settings": {
                "enabled": True,
                "max_retries": 3,
                "retry_delay": 5
            },
            "updated_at": datetime.now().isoformat(),
            **existing_config.get("custom_settings", {})  # 保留用户自定义设置
        }
        
        # 保存配置
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"WeChat MCP service config updated: {config_path}")
        
        # 初始化用户绑定数据结构（如果不存在）
        user_bindings_path = mcp_services_path / "user_bindings.json"
        if not user_bindings_path.exists():
            bindings_data = {
                "service_info": {
                    "name": "WeChat Notification Service",
                    "version": "1.0.0",
                    "initialized_at": datetime.now().isoformat()
                },
                "users": {},
                "binding_stats": {
                    "total_users": 0,
                    "active_bindings": 0,
                    "last_updated": datetime.now().isoformat()
                }
            }
            
            with open(user_bindings_path, 'w', encoding='utf-8') as f:
                json.dump(bindings_data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"WeChat user bindings data initialized: {user_bindings_path}")
        
        logger.info("WeChat notification MCP service initialization completed")
        
    except Exception as e:
        logger.error(f"Failed to initialize WeChat MCP service: {e}")
        raise

# 定义生命周期管理器
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时执行
    logger.info("Application starting...")
    
    # 初始化用户注册配置
    try:
        logger.info("Initializing user configuration...")
        await user_config_manager.ensure_user_registration()
        logger.info("User configuration initialized successfully")
    except Exception as e:
        logger.warning(f"User configuration initialization failed (non-blocking): {e}")
    
    # 启动任务调度器
    logger.info("Starting task scheduler...")
    task_scheduler.start()
    
    # 初始化微信通知MCP服务
    try:
        logger.info("Initializing WeChat notification MCP service...")
        await init_wechat_mcp_service()
        logger.info("WeChat notification MCP service initialized successfully")
    except Exception as e:
        logger.warning(f"WeChat notification MCP service initialization failed (non-blocking): {e}")
    
    # 统一注册所有MCP服务到Claude Code全局配置
    try:
        logger.info("Registering all MCP services to Claude Code global configuration...")
        mcp_generator = MCPConfigGenerator()
        mcp_success = mcp_generator.setup_mcp_configuration()
        if mcp_success:
            logger.info("All MCP services registered successfully to Claude Code")
        else:
            logger.warning("MCP services registration failed")
    except Exception as e:
        logger.warning(f"MCP services registration failed (non-blocking): {e}")
    
    yield  # 应用运行期间
    
    # 关闭时执行
    logger.info("Application shutting down...")
    
    # 停止任务调度器
    logger.info("Stopping task scheduler...")
    task_scheduler.stop()

app = FastAPI(
    title="Claude Co-Desk", 
    description="基于Claude Code的智能协作平台",
    lifespan=lifespan
)

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
    
    # 缓存已解析的Claude可执行文件路径
    _cached_claude_path = None
    
    @staticmethod
    def get_claude_executable_path() -> Optional[str]:
        """获取Claude CLI可执行文件的绝对路径，增强稳定性和重试机制"""
        
        # 验证缓存路径的可用性（更严格的验证）
        if EnvironmentChecker._cached_claude_path:
            logger.debug(f" 验证缓存路径: {EnvironmentChecker._cached_claude_path}")
            if EnvironmentChecker._verify_claude_executable(EnvironmentChecker._cached_claude_path):
                logger.debug(f" 缓存路径验证通过: {EnvironmentChecker._cached_claude_path}")
                return EnvironmentChecker._cached_claude_path
            else:
                logger.warning(f" 缓存路径验证失败，清除缓存: {EnvironmentChecker._cached_claude_path}")
                EnvironmentChecker._cached_claude_path = None
        
        # 检测策略列表，按优先级排序
        detection_strategies = [
            ("PATH environment", EnvironmentChecker._check_path_env),
            ("环境变量CLAUDE_CLI_PATH", EnvironmentChecker._check_claude_env_var), 
            ("常见安装路径", EnvironmentChecker._check_common_paths),
            ("用户本地路径", EnvironmentChecker._check_user_local_paths),
            ("系统路径搜索", EnvironmentChecker._check_system_paths),
        ]
        
        # 重试机制：每个策略最多重试3次
        for strategy_name, strategy_func in detection_strategies:
            logger.debug(f"Attempting detection strategy: {strategy_name}")
            
            for attempt in range(3):  # 最多重试3次
                try:
                    claude_path = strategy_func()
                    if claude_path:
                        # 严格验证找到的路径
                        if EnvironmentChecker._verify_claude_executable(claude_path):
                            EnvironmentChecker._cached_claude_path = claude_path
                            logger.info(f"Found Claude CLI via {strategy_name}: {claude_path} (attempt {attempt + 1}/3)")
                            return claude_path
                        else:
                            logger.warning(f" {strategy_name}找到的路径验证失败: {claude_path}")
                    
                    if attempt == 0:  # 第一次失败时输出详细信息
                        logger.debug(f" {strategy_name}第{attempt + 1}次尝试失败，准备重试")
                    
                except Exception as e:
                    logger.warning(f" {strategy_name}第{attempt + 1}次尝试出错: {e}")
                    
                # 短暂延迟后重试
                if attempt < 2:
                    import time
                    time.sleep(0.1)
        
        # 所有策略都失败，输出详细的诊断信息
        EnvironmentChecker._log_detection_failure()
        return None
    
    @staticmethod
    def _verify_claude_executable(path: str) -> bool:
        """严格验证Claude可执行文件的可用性"""
        try:
            path_obj = Path(path)
            
            # 基础检查
            if not path_obj.exists():
                logger.debug(f" 路径不存在: {path}")
                return False
                
            if not path_obj.is_file():
                logger.debug(f" 不是文件: {path}")
                return False
                
            # 权限检查
            if not os.access(path, os.X_OK):
                logger.debug(f" 文件不可执行: {path}")
                return False
            
            # 执行验证（使用--version命令）
            result = subprocess.run(
                [str(path), '--version'], 
                capture_output=True, 
                text=True,
                timeout=10,
                env=dict(os.environ, **{'NO_COLOR': '1'})  # 禁用彩色输出
            )
            
            if result.returncode == 0:
                version_output = result.stdout.strip()
                logger.debug(f" Claude CLI版本验证成功: {version_output}")
                return True
            else:
                logger.debug(f" Claude CLI版本验证失败 (返回码 {result.returncode}): {result.stderr}")
                return False
                
        except subprocess.TimeoutExpired:
            logger.debug(f" Claude CLI版本检查超时: {path}")
            return False
        except Exception as e:
            logger.debug(f" Claude CLI验证过程出错: {path} - {e}")
            return False
    
    @staticmethod 
    def _check_path_env() -> Optional[str]:
        """Check claude command in PATH environment"""
        logger.debug("Searching for claude command in PATH environment")
        claude_path = shutil.which('claude')
        if claude_path:
            logger.debug(f"Found in PATH: {claude_path}")
            return claude_path
        else:
            logger.debug("Claude command not found in PATH")
            return None
    
    @staticmethod
    def _check_claude_env_var() -> Optional[str]:
        """Check CLAUDE_CLI_PATH environment variable"""
        claude_env_path = os.environ.get('CLAUDE_CLI_PATH')
        if claude_env_path:
            logger.debug(f"Environment variable CLAUDE_CLI_PATH: {claude_env_path}")
            return claude_env_path
        return None
    
    @staticmethod
    def _check_common_paths() -> Optional[str]:
        """检查常见的Claude CLI安装路径"""
        common_paths = [
            Path.home() / '.local' / 'bin' / 'claude',
            Path('/usr/local/bin/claude'),
            Path('/opt/homebrew/bin/claude'),
            Path('/usr/bin/claude'),
            Path('/bin/claude'),
        ]
        
        for path in common_paths:
            logger.debug(f" 检查常见路径: {path}")
            if path.exists():
                logger.debug(f"Found file: {path}")
                return str(path)
        
        return None
    
    @staticmethod
    def _check_user_local_paths() -> Optional[str]:
        """检查用户本地安装路径"""
        user_paths = [
            Path.home() / 'bin' / 'claude',
            Path.home() / '.bin' / 'claude', 
            Path.home() / 'Applications' / 'claude',
            Path.home() / '.npm-global' / 'bin' / 'claude',
        ]
        
        for path in user_paths:
            logger.debug(f" 检查用户路径: {path}")
            if path.exists():
                logger.debug(f"Found file: {path}")
                return str(path)
        
        return None
    
    @staticmethod
    def _check_system_paths() -> Optional[str]:
        """在系统路径中搜索claude"""
        system_paths = [
            Path('/Applications/Claude.app/Contents/MacOS/claude'),  # macOS应用
            Path('/snap/bin/claude'),  # Snap包
            Path('/flatpak/exports/bin/claude'),  # Flatpak
        ]
        
        for path in system_paths:
            logger.debug(f" 检查系统路径: {path}")
            if path.exists():
                logger.debug(f"Found file: {path}")
                return str(path)
        
        return None
    
    @staticmethod
    def _log_detection_failure():
        """Output detailed detection failure diagnostic information"""
        logger.error("No available Claude CLI executable found")
        logger.error("Diagnostic information:")
        
        # PATH environment variable
        path_env = os.environ.get('PATH', '')
        logger.error(f"   PATH environment: {path_env[:200]}{'...' if len(path_env) > 200 else ''}")
        
        # 检查常见路径的存在性
        common_paths = [
            Path.home() / '.local' / 'bin' / 'claude',
            Path('/usr/local/bin/claude'),
            Path('/opt/homebrew/bin/claude'),
        ]
        
        for path in common_paths:
            exists = path.exists()
            logger.error(f"   {path}: {'exists' if exists else 'not found'}")
        
        # Environment variables check
        claude_env = os.environ.get('CLAUDE_CLI_PATH')
        if claude_env:
            logger.error(f"   CLAUDE_CLI_PATH: {claude_env}")
        else:
            logger.error("   CLAUDE_CLI_PATH: not set")
        
        logger.error("Solution suggestions:")
        logger.error("   1. Confirm Claude CLI is properly installed: pip install claude-ai")
        logger.error("   2. Check if PATH environment contains Claude CLI installation path")
        logger.error("   3. Set CLAUDE_CLI_PATH environment variable to point to Claude CLI executable")
        logger.error("   4. Restart terminal or reload environment variables")
    
    @staticmethod
    def check_claude_cli() -> bool:
        """检测Claude CLI是否已安装"""
        return EnvironmentChecker.get_claude_executable_path() is not None
    
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
        
        # 检查系统项目状态
        try:
            from projects_manager import SystemProjectManager
            system_project_status = SystemProjectManager.check_system_project_status()
        except Exception as e:
            logger.warning(f"检查系统项目状态时出错: {e}")
            system_project_status = {'error': str(e)}
        
        # 获取工作目录
        working_directory = os.getcwd()
        home_directory = os.path.expanduser('~')
        
        return {
            'claude_cli': claude_available,
            'projects_dir': projects_exist,
            'projects_path': cls.get_projects_path(),
            'system_project': system_project_status,
            'ready': claude_available and projects_exist,
            'status': 'ready' if (claude_available and projects_exist) else 'incomplete',
            'workingDirectory': working_directory,
            'homeDirectory': home_directory
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
        
        logger.info(f"WebSocket connection established: {connection_type}")
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.chat_connections:
            self.chat_connections.remove(websocket)
        if websocket in self.shell_connections:
            self.shell_connections.remove(websocket)
        
        logger.info("WebSocket connection closed")
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_text(json.dumps(message))
    
    async def broadcast(self, message: dict, connection_type: str = 'all'):
        """广播消息到指定类型的WebSocket连接"""
        connections = self.active_connections
        if connection_type == 'chat':
            connections = self.chat_connections
        elif connection_type == 'shell':
            connections = self.shell_connections
        
        if not connections:
            logger.warning(f"没有活跃的{connection_type}连接可用于广播")
            return
        
        disconnected_connections = []
        for connection in connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                # 连接可能已断开，记录并稍后清理
                logger.warning(f"广播到WebSocket连接失败: {e}")
                disconnected_connections.append(connection)
        
        # 清理断开的连接
        for connection in disconnected_connections:
            self.disconnect(connection)
            
        logger.info(f"Broadcasted message to {len(connections) - len(disconnected_connections)}/{len(connections)} connections")

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
        
        # session_id捕获相关状态
        self.task_id = None  # 当前执行的任务ID
        self.session_id_captured = False  # 是否已经捕获过session_id
        self.file_monitor_thread = None  # 文件监控线程
        self.file_monitor_running = False  # 文件监控运行状态
        self.project_path = None  # 项目路径，用于文件监控
    
    def is_running(self):
        """检查PTY进程是否正在运行"""
        return (self.process is not None and 
                self.process.poll() is None and 
                self.running and 
                self.master_fd is not None)
    
    async def start_shell(self, websocket: WebSocket, project_path: str, session_id: str = None, has_session: bool = False, cols: int = 80, rows: int = 24, initial_command: str = None, task_id: str = None):
        """启动PTY shell进程"""
        # 设置task_id和project_path用于session_id捕获
        self.task_id = task_id
        self.project_path = project_path
        if task_id:
            logger.info(f"Set task ID for session_id capture: {task_id}")
            # 启动文件监控来捕获session_id
            self._start_file_monitor()
        
        # 如果已经有进程在运行，先清理
        if self.is_running():
            logger.info("Detected existing PTY process, cleaning up...")
            self.cleanup()
            # 等待清理完成
            await asyncio.sleep(0.5)
        
        self.websocket = websocket
        self.loop = asyncio.get_running_loop()  # 保存当前事件循环
        
        try:
            # 获取Claude CLI的绝对路径
            claude_executable = EnvironmentChecker.get_claude_executable_path()
            if not claude_executable:
                error_msg = " Claude CLI executable not found，请检查安装"
                logger.error(error_msg)
                await self.send_output(f"{error_msg}\r\n")
                return False
            
            logger.info(f"Using Claude CLI path: {claude_executable}")
            
            # 构建Claude命令 - 使用绝对路径，支持初始命令参数
            if initial_command:
                # 正确处理：分离主命令和参数，只给主命令加引号
                command_content = initial_command.replace("claude", "").strip()
                
                # 查找最后一个以--开头的参数位置来分离主命令和参数
                import re
                # 查找所有--参数的位置
                param_matches = list(re.finditer(r'\s(--\S+)', command_content))
                
                if param_matches:
                    # 找到第一个参数的位置
                    first_param_pos = param_matches[0].start()
                    main_command = command_content[:first_param_pos].strip()
                    remaining_params = command_content[first_param_pos:].strip()
                    # 检查main_command是否已经被双引号包围
                    if main_command.startswith('"') and main_command.endswith('"'):
                        enhanced_command = f'"{claude_executable}" {main_command} {remaining_params}'
                    else:
                        enhanced_command = f'"{claude_executable}" "{main_command}" {remaining_params}'
                else:
                    # 没有参数，检查command_content是否已经被双引号包围
                    if command_content.startswith('"') and command_content.endswith('"'):
                        enhanced_command = f'"{claude_executable}" {command_content}'
                    else:
                        enhanced_command = f'"{claude_executable}" "{command_content}"'
                
                shell_command = f'cd "{project_path}" && {enhanced_command}'
                logger.info(f"Using enhanced initial command: {enhanced_command}")
            elif has_session and session_id:
                # 优化恢复会话策略：
                # 1. 首先尝试使用传入的session_id
                # 2. 如果失败，自动启动新会话
                # 注：session_id现在优先是文件名(主会话ID)，更可能成功
                shell_command = f'cd "{project_path}" && ("{claude_executable}" --resume {session_id} || "{claude_executable}")'
                logger.info(f"Resume session command (enhanced fallback): \"{claude_executable}\" --resume {session_id} || \"{claude_executable}\"")
                logger.info(f"Session ID type: {'main session' if len(session_id.split('-')) == 5 else 'sub session'}")
            else:
                # 直接启动新会话
                shell_command = f'cd "{project_path}" && "{claude_executable}"'
                logger.info(f"Starting new Claude session: \"{claude_executable}\"")
            
            # 注意：不再需要添加JSON参数，session_id通过文件监控获取
            
            # 设置正确的终端环境变量 - 使用实际尺寸和UTF-8编码
            env = os.environ.copy()
            env.update({
                'TERM': 'xterm-256color',       # 设置终端类型
                'COLORTERM': 'truecolor',       # 启用真彩色
                'FORCE_COLOR': '3',             # 强制彩色输出
                'CLICOLOR': '1',                # 启用CLI颜色
                'CLICOLOR_FORCE': '1',          # 强制CLI颜色输出
                'COLUMNS': str(cols),           # 终端宽度（实际值）
                'LINES': str(rows),             # 终端高度（实际值）
                'LANG': 'en_US.UTF-8',          # 设置UTF-8编码
                'LC_ALL': 'en_US.UTF-8',        # 确保所有locale都是UTF-8
                'BROWSER': 'echo "OPEN_URL:"'   # URL检测
            })
            # 确保NO_COLOR不存在，避免与FORCE_COLOR冲突
            env.pop('NO_COLOR', None)
            
            logger.info(f"Starting PTY Shell: {shell_command}")
            logger.info(f"Working directory: {project_path}")
            logger.info(f"Terminal environment: TERM={env['TERM']}, COLORTERM={env['COLORTERM']}")
            
            if IS_WINDOWS:
                # Windows implementation using subprocess.PIPE
                logger.info("Starting Windows subprocess mode (PTY not available)")
                
                # Use cmd.exe as the shell for Windows
                self.process = subprocess.Popen(
                    ['cmd', '/c', shell_command],
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    env=env,
                    cwd=os.path.expanduser('~'),
                    text=True,
                    bufsize=1,  # Line buffered
                    universal_newlines=True
                )
                
                # Set master_fd to None to indicate Windows mode
                self.master_fd = None
                
                logger.info(f"Windows subprocess started: PID {self.process.pid}")
                
                # Start reading thread for Windows
                self.running = True
                self.read_thread = threading.Thread(target=self._read_windows_output, daemon=True)
                self.read_thread.start()
                
            else:
                # Unix implementation with full PTY functionality
                logger.info("Starting Unix PTY mode with full terminal features")
                
                # 创建PTY主从文件描述符对
                self.master_fd, slave_fd = pty.openpty()
                
                # 立即设置PTY窗口尺寸
                try:
                    import struct, fcntl
                    winsize = struct.pack('HHHH', rows, cols, 0, 0)
                    fcntl.ioctl(slave_fd, termios.TIOCSWINSZ, winsize)
                    logger.info(f"PTY initial size set: {cols}x{rows}")
                except Exception as e:
                    logger.warning(f"Failed to set PTY initial size: {e}")
                
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
                    logger.info("PTY configured in node-pty-like mode, full terminal features enabled")
                except Exception as e:
                    logger.warning(f"Failed to set PTY attributes: {e}")
                
                # 启动子进程，使用用户默认shell执行命令
                user_shell = env.get('SHELL', '/bin/bash')
                logger.info(f"Using shell: {user_shell}")
                
                self.process = subprocess.Popen(
                    [user_shell, '-c', shell_command],
                    stdin=slave_fd,
                    stdout=slave_fd,
                    stderr=slave_fd,
                    env=env,
                    preexec_fn=os.setsid,  # 创建新的会话组
                    cwd=os.path.expanduser('~')  # 从home目录开始
                )
                
                # 关闭slave端，只保留master端
                os.close(slave_fd)
                
                logger.info(f"PTY Shell process started: PID {self.process.pid}")
                
                # 启动读取线程
                self.running = True
                self.read_thread = threading.Thread(target=self._read_pty_output, daemon=True)
                self.read_thread.start()
            
            # 添加进程监控
            logger.info(f"Child process status: PID={self.process.pid}, poll={self.process.poll()}")
            
            return True
            
        except Exception as e:
            logger.error(f" 启动PTY Shell失败: {e}")
            await self.send_output(f" 启动Claude CLI失败: {str(e)}\r\n")
            return False
    
    def _read_pty_output(self):
        """读取PTY输出的线程函数 - 优化重复输出处理"""
        logger.info("PTY read thread started")
        
        try:
            read_count = 0
            while self.running and self.master_fd is not None:
                # 使用select检查是否有数据可读
                ready, _, error = select.select([self.master_fd], [], [self.master_fd], 1.0)
                
                # 检查错误状态
                if error:
                    logger.error(f" PTY select检测到错误: {error}")
                    break
                    
                if ready:
                    try:
                        # 读取PTY输出数据
                        data = os.read(self.master_fd, 1024)
                        if not data:
                            logger.warning(" PTY读取到空数据，子进程可能已退出")
                            # 检查子进程状态
                            if self.process:
                                poll_result = self.process.poll()
                                if poll_result is not None:
                                    logger.warning(f" 子进程已退出，退出码: {poll_result}")
                                    
                                    # 发送任务完成通知
                                    if self.task_id and poll_result == 0:
                                        asyncio.run_coroutine_threadsafe(
                                            self._send_task_completion_notification(self.task_id, poll_result),
                                            self.loop
                                        )
                                    
                                    break
                            continue
                        
                        read_count += 1
                        # 改进UTF-8解码，避免中文字符乱码
                        try:
                            raw_output = data.decode('utf-8', errors='strict')
                        except UnicodeDecodeError:
                            # 如果strict解码失败，尝试其他编码
                            try:
                                raw_output = data.decode('utf-8', errors='ignore')
                            except:
                                raw_output = data.decode('utf-8', errors='replace')
                        
                        # 启用简化的输出处理，保留ANSI颜色序列
                        processed_output = self._simple_output_filter(raw_output)
                        
                        # 注意：session_id现在通过文件监控获取，不再从PTY输出解析
                        
                        # 调试日志
                        if processed_output:
                            logger.debug(f" PTY读取#{read_count}: {len(data)}字节原始 -> {len(processed_output)}字符处理后")
                        
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
                                logger.error(f" 发送WebSocket消息失败: {send_error}")
                            
                    except OSError as e:
                        if e.errno == 5:  # Input/output error，PTY已关闭
                            logger.info("PTY closed (I/O error)")
                            break
                        elif e.errno == 9:  # Bad file descriptor
                            logger.info("PTY file descriptor invalid")
                            break
                        else:
                            logger.error(f" 读取PTY输出错误 (errno={e.errno}): {e}")
                            break
                    except Exception as read_error:
                        logger.error(f" PTY读取异常: {read_error}")
                        break
                else:
                    # 超时，但继续循环（这是正常的）
                    # 每10秒检查一次子进程状态
                    if read_count % 10 == 0 and self.process:
                        poll_result = self.process.poll()
                        if poll_result is not None:
                            logger.warning(f" 子进程在超时检查中发现已退出，退出码: {poll_result}")
                            
                            # 发送任务完成通知
                            if self.task_id and poll_result == 0:
                                asyncio.run_coroutine_threadsafe(
                                    self._send_task_completion_notification(self.task_id, poll_result),
                                    self.loop
                                )
                            
                            break
                        
        except Exception as e:
            logger.error(f" PTY读取线程异常: {e}")
            import traceback
            logger.error(f"异常详情: {traceback.format_exc()}")
        finally:
            logger.info(f"PTY read thread ended (total reads: {read_count})")
    
    def _read_windows_output(self):
        """Windows subprocess output reading thread"""
        logger.info("Windows output read thread started")
        
        try:
            read_count = 0
            while self.running and self.process and self.process.poll() is None:
                try:
                    # Read line from subprocess stdout
                    line = self.process.stdout.readline()
                    if not line:
                        # Check if process has ended
                        if self.process.poll() is not None:
                            exit_code = self.process.poll()
                            logger.info(f"Windows subprocess ended with code: {exit_code}")
                            
                            # 发送任务完成通知
                            if self.task_id and exit_code == 0:
                                asyncio.run_coroutine_threadsafe(
                                    self._send_task_completion_notification(self.task_id, exit_code),
                                    self.loop
                                )
                            
                            break
                        continue
                    
                    read_count += 1
                    # Send output to WebSocket
                    asyncio.run_coroutine_threadsafe(
                        self.send_output(line), 
                        self.loop
                    )
                    
                except Exception as e:
                    logger.error(f"Error reading Windows subprocess output: {e}")
                    break
                    
        except Exception as e:
            logger.error(f"Windows read thread exception: {e}")
            import traceback
            logger.error(f"Exception details: {traceback.format_exc()}")
        finally:
            logger.info(f"Windows read thread ended (total reads: {read_count})")
    
    async def send_input(self, data: str):
        """发送输入到shell - 支持PTY和Windows模式"""
        if IS_WINDOWS and self.process and self.process.stdin:
            # Windows mode using subprocess.PIPE
            try:
                logger.debug(f"Windows input: {repr(data)}")
                self.process.stdin.write(data)
                self.process.stdin.flush()
            except Exception as e:
                logger.error(f"Failed to send Windows input: {e}")
                logger.error(f"Input data: {repr(data)}")
        elif self.master_fd is not None:
            # Unix PTY mode
            try:
                # 调试输入数据
                input_bytes = data.encode('utf-8')
                char_repr = repr(data)
                logger.debug(f"PTY输入: {char_repr} -> {input_bytes.hex()}")
                
                # 特殊字符处理提示
                if '\x08' in data:  # 退格键
                    logger.debug("⌫ 检测到退格键")
                elif '\x7f' in data:  # DEL键
                    logger.debug("检测到DEL键")
                
                os.write(self.master_fd, input_bytes)
            except Exception as e:
                logger.error(f"发送PTY输入失败: {e}")
                logger.error(f"输入数据: {repr(data)}")
    
    def _optimize_ansi_sequences(self, text: str) -> str:
        """优化ANSI转义序列，合并重复操作"""
        import re
        
        # Claude CLI特定的ANSI序列优化
        original_len = len(text)
        
        # 1. 处理重复的行清除序列（Claude CLI经常使用）
        # \x1b[2K 清除当前行, \r 回车符
        text = re.sub(r'(\x1b\[2K\r?){2,}', '\x1b[2K\r', text)
        
        # 2. 处理重复的光标移动序列  
        # 合并连续的相同光标移动
        text = re.sub(r'(\x1b\[A){2,}', '\x1b[A', text)  # 向上
        text = re.sub(r'(\x1b\[B){2,}', '\x1b[B', text)  # 向下  
        text = re.sub(r'(\x1b\[C){2,}', '\x1b[C', text)  # 向右
        text = re.sub(r'(\x1b\[D){2,}', '\x1b[D', text)  # 向左
        
        # 3. 处理重复的清屏操作
        clear_screen_count = text.count('\x1b[2J')
        if clear_screen_count > 1:
            # 只保留最后一个清屏操作
            text = re.sub(r'\x1b\[2J.*?(?=\x1b\[2J)', '', text)
            logger.debug(f" 合并了{clear_screen_count-1}个重复的清屏操作")
        
        # 4. 处理Claude CLI的光标位置重置模式
        # 经常出现的模式: \x1b[2K\r + 内容 + \r
        text = re.sub(r'\x1b\[2K\r([^\r\n]*)\r(?=\x1b\[2K)', r'\x1b[2K\r\1', text)
        
        # 5. 处理过多的回车符和换行符组合
        # 将多个\r\n或\n\r组合简化
        text = re.sub(r'(\r\n|\n\r){2,}', '\r\n', text)
        text = re.sub(r'\r{2,}', '\r', text)
        
        # 6. 清理Claude CLI常见的状态覆盖模式
        # 检测并优化 "清行 + 写内容 + 回车 + 清行" 的重复模式
        status_override_pattern = r'\x1b\[2K\r([^\r\n]+)\r\x1b\[2K\r'
        matches = list(re.finditer(status_override_pattern, text))
        if len(matches) > 1:
            # 如果有连续的状态覆盖，只保留最后的状态
            for match in matches[:-1]:
                # 检查是否为相似的状态行（如同一类型的进度）
                content = match.group(1)
                if any(keyword in content for keyword in ['Computing', 'Processing', 'Thinking', '']):
                    # 移除这个中间状态
                    text = text[:match.start()] + text[match.end():]
                    # 重新搜索匹配项（因为位置已改变）
                    matches = list(re.finditer(status_override_pattern, text))
                    break
        
        # 7. 优化颜色序列
        # 合并连续的相同颜色设置
        text = re.sub(r'(\x1b\[\d+m)\1+', r'\1', text)
        
        # 8. 清理残余的控制字符
        # 移除一些Claude CLI可能产生的多余控制字符
        text = re.sub(r'\x1b\[0;0H', '', text)  # 无用的光标定位
        text = re.sub(r'\x1b\[999;999H', '', text)  # 异常的光标定位
        
        # 记录优化效果
        if len(text) < original_len:
            reduction = original_len - len(text)
            logger.debug(f" ANSI序列优化: {original_len} -> {len(text)} 字符 (减少{reduction})")
        
        return text
    
    def _simple_output_filter(self, raw_output: str) -> str:
        """简化的输出过滤器，只处理关键重复问题，保留所有ANSI颜色序列"""
        import re
        
        # 改进的行级过滤，处理重复行和空行
        lines = raw_output.split('\n')
        filtered_lines = []
        last_clean_line = ""
        consecutive_count = 0
        consecutive_empty_count = 0
        
        for line in lines:
            # 移除ANSI序列后的纯文本用于比较重复
            clean_line = re.sub(r'\x1b\[[0-9;]*[a-zA-Z]', '', line).strip()
            
            # 处理空行
            if clean_line == "":
                consecutive_empty_count += 1
                # 限制连续空行数量（任务执行过程中经常产生多余空行）
                if consecutive_empty_count > 2:
                    continue
            else:
                consecutive_empty_count = 0
            
            # 检测连续重复的相同内容行
            if clean_line == last_clean_line and clean_line:
                consecutive_count += 1
                # 允许重复2次，超过则跳过（针对Claude CLI的重复状态行）
                if consecutive_count > 2 and any(marker in clean_line for marker in ['', '', '', 'Computing', 'Thinking']):
                    continue
            else:
                consecutive_count = 0
                last_clean_line = clean_line
            
            filtered_lines.append(line)
        
        result = '\n'.join(filtered_lines)
        
        # 最终的连续空行清理（处理可能遗漏的空行）
        result = re.sub(r'\n{3,}', '\n\n', result)
        
        return result
    
    def _process_terminal_output(self, raw_output: str) -> str:
        """处理终端输出，去除重复和优化ANSI序列"""
        import re
        
        # 首先处理ANSI转义序列优化
        optimized_output = self._optimize_ansi_sequences(raw_output)
        
        # 将输出添加到缓冲区
        self.output_buffer += optimized_output
        
        # 分析并处理行
        processed_chunks = []
        current_buffer = self.output_buffer
        
        # Claude CLI特定的重复模式检测
        claude_patterns = {
            'task': r'^\s+',           # 任务状态行
            'thinking': r'^\s+Computing|^\s+Thinking',   # 思考状态行  
            'progress': r'^\s+Processing',  # 处理进度行
            'spinner': r'^.+\s+Computing.*\(',  # 旋转状态指示器（简化模式）
        }
        
        # 处理完整的行
        lines = current_buffer.split('\n')
        self.output_buffer = lines[-1] if not current_buffer.endswith('\n') else ""
        
        for i, line in enumerate(lines[:-1] if not current_buffer.endswith('\n') else lines):
            # 清理ANSI转义序列后的纯文本用于比较
            clean_line = re.sub(r'\x1b\[[0-9;]*[a-zA-Z]', '', line).strip()
            
            # 检测Claude CLI特定的重复模式
            is_claude_status = False
            pattern_type = None
            
            for pattern_name, pattern in claude_patterns.items():
                if re.match(pattern, clean_line):
                    is_claude_status = True
                    pattern_type = pattern_name
                    break
            
            if is_claude_status:
                # 检查是否与最近的相同类型行重复
                recent_key = f"_recent_{pattern_type}_lines"
                if not hasattr(self, recent_key):
                    setattr(self, recent_key, [])
                
                recent_lines = getattr(self, recent_key)
                
                # 提取核心内容（去除变化的部分如时间、token数等）
                core_content = clean_line
                if pattern_type in ['thinking', 'spinner']:
                    # 去除括号内的时间和token信息
                    core_content = re.sub(r'\([^)]*\)', '', core_content).strip()
                
                # 检查是否为重复内容
                if core_content in recent_lines:
                    # 限制连续重复次数
                    if hasattr(self, f'_{pattern_type}_repeat_count'):
                        repeat_count = getattr(self, f'_{pattern_type}_repeat_count') + 1
                    else:
                        repeat_count = 1
                    
                    setattr(self, f'_{pattern_type}_repeat_count', repeat_count)
                    
                    # 超过2次重复则跳过
                    if repeat_count > 2:
                        continue
                else:
                    # 新内容，重置计数器
                    setattr(self, f'_{pattern_type}_repeat_count', 0)
                    recent_lines.append(core_content)
                    
                    # 保持最近5条记录
                    if len(recent_lines) > 5:
                        recent_lines.pop(0)
            
            # 检测过多的空行
            elif clean_line == "":
                if hasattr(self, '_consecutive_empty_count'):
                    self._consecutive_empty_count += 1
                else:
                    self._consecutive_empty_count = 1
                
                # 超过2个连续空行则跳过
                if self._consecutive_empty_count > 2:
                    continue
            else:
                # 非空行，重置空行计数
                self._consecutive_empty_count = 0
            
            # 清理明显的乱码字符
            if '��' in line:
                line = line.replace('��', '')
                logger.debug(" 清理乱码字符")
            
            processed_chunks.append(line)
        
        # 重新组装结果
        result = '\n'.join(processed_chunks) if processed_chunks else ""
        
        # 添加未完成的缓冲区
        if self.output_buffer and not current_buffer.endswith('\n'):
            if result:
                result = result + '\n' + self.output_buffer
            else:
                result = self.output_buffer
            self.output_buffer = ""
        
        # 记录过滤统计
        original_len = len(raw_output)
        result_len = len(result)
        if result_len < original_len:
            reduction = original_len - result_len
            logger.debug(f" 输出过滤: {original_len} -> {result_len} 字符 (减少{reduction})")
        
        return result
    
    async def send_output(self, data: str):
        """发送输出到WebSocket"""
        # 检查WebSocket连接状态
        if not self.websocket:
            logger.debug(" WebSocket连接不存在，跳过发送输出")
            return
            
        # 检查WebSocket是否已关闭
        try:
            if hasattr(self.websocket, 'client_state') and self.websocket.client_state.name != 'CONNECTED':
                logger.debug(f" WebSocket连接已关闭 ({self.websocket.client_state.name})，跳过发送输出")
                return
        except:
            # 如果检查连接状态失败，也跳过发送
            logger.debug(" 无法检查WebSocket连接状态，跳过发送输出")
            return
            
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
                    logger.info(f"Detected URL: {url}")
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
            # 更详细的错误分类
            error_msg = str(e)
            if "after sending 'websocket.close'" in error_msg:
                logger.debug(" WebSocket已关闭，停止发送输出")
                self.websocket = None  # 清理已关闭的连接引用
            elif "Connection is already closed" in error_msg:
                logger.debug(" WebSocket连接已断开")
                self.websocket = None
            else:
                logger.error(f" 发送WebSocket输出失败: {e}")
    
    async def resize_terminal(self, cols: int, rows: int):
        """调整终端大小 - 跨平台版本"""
        if IS_WINDOWS:
            # Windows mode: Terminal resizing not supported, log and return
            logger.info(f"Windows mode: Terminal resize not supported ({cols}x{rows})")
            return
            
        if self.master_fd is not None and cols > 0 and rows > 0:
            try:
                import struct, fcntl, termios
                
                # 记录调整信息
                logger.info(f"PTY terminal resized: {cols}x{rows}")
                
                # 发送TIOCSWINSZ信号调整终端窗口大小
                # 格式: rows, cols, xpixel, ypixel
                winsize = struct.pack('HHHH', rows, cols, 0, 0)
                fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, winsize)
                
                logger.debug(f"PTY终端大小已调整为: {cols}x{rows}")
                
            except Exception as e:
                logger.error(f"调整PTY终端大小失败 ({cols}x{rows}): {e}")
        else:
            logger.warning(f"无效的终端大小或PTY未就绪: {cols}x{rows}, fd={self.master_fd}")
    
    async def _send_task_completion_notification(self, task_id: str, exit_code: int):
        """发送任务完成通知"""
        try:
            logger.info(f"Sending task completion notification for task: {task_id}, exit_code: {exit_code}")
            
            # 获取任务信息
            task_info = None
            if task_scheduler and hasattr(task_scheduler, 'all_tasks'):
                task_info = task_scheduler.all_tasks.get(task_id)
            
            if not task_info:
                logger.warning(f"Task info not found for task: {task_id}")
                return
            
            # 构建通知消息
            completion_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            status = "成功" if exit_code == 0 else f"失败 (退出码: {exit_code})"
            
            notification_message = f"""## 任务执行完成通知

**任务名称**: {task_info.name}

**执行状态**: {status}

**完成时间**: {completion_time}

**任务目标**:
{task_info.goal}

**工作目录**: {task_info.work_directory or "默认目录"}

---
*此通知由 Claude Co-Desk 自动发送*"""
            
            # 发送微信通知
            await self._send_wechat_notification(task_info.name, notification_message)
            
        except Exception as e:
            logger.error(f"Failed to send task completion notification: {e}")
    
    async def _send_wechat_notification(self, task_name: str, message: str):
        """发送微信通知"""
        try:
            from user_config import get_user_config
            import aiohttp
            
            # 获取用户配置
            user_config = await get_user_config()
            user_identifier = user_config.get("user_identifier")
            api_key = user_config.get("api_key")
            
            if not user_identifier or not api_key:
                logger.warning("User not registered, skipping WeChat notification")
                return
            
            # 检查微信是否已绑定
            from pathlib import Path
            mcp_services_path = Path(__file__).parent / "mcp_services" / "wechat_notification"
            user_bindings_path = mcp_services_path / "user_bindings.json"
            
            bound = False
            if user_bindings_path.exists():
                import json
                with open(user_bindings_path, 'r', encoding='utf-8') as f:
                    bindings_data = json.load(f)
                users = bindings_data.get("users", {})
                user_binding = users.get(user_identifier)
                bound = user_binding and user_binding.get("status") == "active"
            
            if not bound:
                logger.info("WeChat not bound, skipping notification")
                return
            
            # 调用云端API发送通知
            async with aiohttp.ClientSession() as session:
                payload = {
                    "user_identifier": user_identifier,
                    "message": message,
                    "task_name": task_name
                }
                
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }
                
                async with session.post(
                    "https://www.heliki.com/wechat/send_message",
                    json=payload,
                    headers=headers,
                    timeout=15
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        if result.get("success"):
                            logger.info(f"WeChat notification sent successfully for task: {task_name}")
                        else:
                            logger.warning(f"WeChat notification failed: {result.get('error')}")
                    else:
                        logger.warning(f"WeChat API error: {response.status}")
                        
        except Exception as e:
            logger.error(f"Failed to send WeChat notification: {e}")

    def cleanup(self):
        """清理PTY资源"""
        logger.info("Cleaning PTY Shell resources...")
        
        self.running = False
        
        # 停止文件监控
        self._stop_file_monitor()
        
        # 等待读取线程结束
        if self.read_thread and self.read_thread.is_alive():
            self.read_thread.join(timeout=2.0)
        
        # 终止进程
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=5.0)
            except Exception as e:
                logger.warning(f" 终止PTY进程失败: {e}")
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
        
        logger.info("PTY Shell resource cleanup completed")
    
    
    def _start_file_monitor(self):
        """启动文件监控来捕获session_id"""
        if self.file_monitor_running:
            return
        
        import threading
        self.file_monitor_running = True
        self.file_monitor_thread = threading.Thread(
            target=self._file_monitor_worker,
            daemon=True
        )
        self.file_monitor_thread.start()
        logger.info(f"Starting file monitoring for session_id capture (task: {self.task_id})")
    
    def _stop_file_monitor(self):
        """停止文件监控"""
        self.file_monitor_running = False
        if self.file_monitor_thread and self.file_monitor_thread.is_alive():
            self.file_monitor_thread.join(timeout=2.0)
        logger.info("File monitoring stopped")
    
    def _file_monitor_worker(self):
        """文件监控工作线程"""
        import time
        from pathlib import Path
        
        try:
            # Claude CLI会话文件目录
            claude_dir = Path.home() / ".claude" / "projects"
            
            # 构建项目路径对应的文件路径
            # 例如: /home/user -> -home-user
            if self.project_path:
                project_file_path = self.project_path.replace("/", "-")
                session_dir = claude_dir / project_file_path
            else:
                # 默认监控所有项目目录
                session_dir = claude_dir
            
            logger.info(f"Monitoring directory: {session_dir}")
            
            # 记录监控开始时间
            start_time = time.time()
            
            # 监控最多30秒
            while self.file_monitor_running and time.time() - start_time < 30:
                if not self.session_id_captured:
                    session_id = self._scan_for_session_files(session_dir)
                    if session_id:
                        # 找到session_id，保存到任务记录
                        try:
                            success = task_scheduler.update_task_session_id(self.task_id, session_id)
                            if success:
                                logger.info(f"File monitoring successfully captured session_id: {session_id} (task: {self.task_id})")
                                self.session_id_captured = True
                                
                                # 通知前端任务数据已更新，需要刷新任务列表
                                try:
                                    # 使用saved事件循环发送WebSocket消息
                                    if hasattr(self, 'loop') and self.loop and not self.loop.is_closed():
                                        # 获取WebSocket管理器
                                        websocket_manager = getattr(task_scheduler, 'websocket_manager', None)
                                        if websocket_manager:
                                            # 在主事件循环中发送广播消息
                                            import asyncio
                                            future = asyncio.run_coroutine_threadsafe(
                                                websocket_manager.broadcast({
                                                    'type': 'task-session-captured',
                                                    'taskId': self.task_id,
                                                    'sessionId': session_id,
                                                    'message': f"任务会话已捕获，可以继续任务"
                                                }),
                                                self.loop
                                            )
                                            future.result(timeout=5)
                                            logger.info(f"Notified frontend to refresh task data: {self.task_id}")
                                        else:
                                            logger.warning(" WebSocket管理器不可用，无法通知前端")
                                    else:
                                        logger.warning(" 事件循环不可用，无法通知前端")
                                except Exception as notify_error:
                                    logger.error(f" 通知前端失败: {notify_error}")
                                
                                break
                            else:
                                logger.warning(f" 保存任务 {self.task_id} 的session_id失败")
                        except Exception as e:
                            logger.error(f" 保存任务session_id时出错: {e}")
                
                # 每0.5秒检查一次
                time.sleep(0.5)
            
            if not self.session_id_captured:
                logger.warning(f" 文件监控超时，未能捕获session_id (任务: {self.task_id})")
                
        except Exception as e:
            logger.error(f" 文件监控出错: {e}")
        finally:
            self.file_monitor_running = False
    
    def _scan_for_session_files(self, session_dir):
        """扫描会话文件，提取session_id"""
        import re
        import time
        from pathlib import Path
        
        try:
            if not session_dir.exists():
                return None
            
            # 查找新创建的.jsonl文件
            current_time = time.time()
            for file_path in session_dir.glob("*.jsonl"):
                # 检查文件创建时间（最近10秒内创建的）
                try:
                    file_stat = file_path.stat()
                    if current_time - file_stat.st_ctime < 10:
                        # 从文件名提取session_id
                        # 格式: 891a2f24-0dcb-41a3-ba70-8dff44e3eb42.jsonl
                        filename = file_path.stem
                        if re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', filename):
                            logger.info(f"Getting session_id from filename: {filename} (file: {file_path.name})")
                            return filename
                except:
                    continue
            
            return None
            
        except Exception as e:
            logger.debug(f"扫描会话文件出错: {e}")
            return None

manager = ConnectionManager()

# MCP会话去重保护：活跃MCP会话追踪
active_mcp_sessions = set()

# 初始化任务调度器
task_scheduler = TaskScheduler(websocket_manager=manager)

# 初始化应用扫描器
app_scanner = ApplicationScanner()
logger.info("Application scanner initialized")

# 初始化MCP配置生成器
mcp_config_generator = MCPConfigGenerator()
logger.info("MCP configuration generator initialized")

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
        
        # macOS系统保护目录列表，直接跳过以避免权限错误
        macos_protected_dirs = {
            'Accounts', 'AppleMediaServices', 'Autosave Information', 'Biome',
            'Calendars', 'CallHistoryDB', 'CloudStorage', 'Contacts', 
            'CoreData', 'CoreDuet', 'CoreFollowUp', 'DataDeliveryServices',
            'GameKit', 'IdentityServices', 'Insights', 'Mail', 'Messages',
            'PersonalizationPortrait', 'Photos', 'SafariSafeBrowsing', 
            'Suggestions', 'Trial', 'com.apple.aiml.instrumentation',
            'com.apple.assistant.backedup', 'com.apple.internal.ck',
            'com.apple.passd', 'Metadata', 'MobileMeAccounts'
        }
        
        entries = []
        for entry in path.iterdir():
            if entry.name.startswith('.') and entry.name not in {'.gitignore', '.env.example'}:
                continue
            if entry.name in ignore_patterns:
                continue
            # 跳过macOS系统保护目录（主要在Library目录下）
            if path.name == 'Library' and entry.name in macos_protected_dirs:
                logger.debug(f"跳过macOS系统保护目录: {entry}")
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
                # 区分正常的macOS系统保护和真正的文件系统错误
                if 'Operation not permitted' in str(e) or 'Permission denied' in str(e):
                    # macOS系统保护机制，使用debug级别日志
                    logger.debug(f"macOS系统保护目录无法访问: {entry}")
                else:
                    # 其他文件系统错误
                    logger.warning(f"无法访问 {entry}: {e}")
                continue
                
    except (PermissionError, OSError) as e:
        # 区分正常的macOS系统保护和真正的文件系统错误
        if 'Operation not permitted' in str(e) or 'Permission denied' in str(e):
            logger.debug(f"macOS系统保护目录无法读取: {path}")
        else:
            logger.error(f"无法读取目录 {path}: {e}")
    
    return items

async def build_folder_tree(path: Path, max_depth: int = 3, current_depth: int = 0) -> List[Dict[str, Any]]:
    """构建文件夹树结构，只返回文件夹"""
    folders = []
    
    if current_depth >= max_depth:
        return folders
    
    try:
        # 忽略的目录
        ignore_patterns = {
            '.git', '.svn', '.hg', '__pycache__', '.pytest_cache',
            'node_modules', '.venv', 'venv', '.env',
            '.DS_Store', 'Thumbs.db', '.vscode', '.idea'
        }
        
        # macOS系统保护目录列表
        macos_protected_dirs = {
            'Accounts', 'AppleMediaServices', 'Autosave Information', 'Biome',
            'Calendars', 'CallHistoryDB', 'CloudStorage', 'Contacts', 
            'CoreData', 'CoreDuet', 'CoreFollowUp', 'DataDeliveryServices',
            'GameKit', 'IdentityServices', 'Insights', 'Mail', 'Messages',
            'Photos', 'ProtectedCloudStorage', 'Reminders', 'Safari', 'Shared',
            'SpeechRecognition', 'Suggestions', 'TCC', 'Trial', 'Wallet'
        }
        
        # 获取目录下的所有条目
        entries = []
        for entry in path.iterdir():
            if entry.name.startswith('.') and entry.name not in {'.claude'}:
                continue
            if entry.name in ignore_patterns:
                continue
            if entry.name in macos_protected_dirs:
                continue
            entries.append(entry)
        
        # 按名称排序，文件夹优先
        entries.sort(key=lambda x: (not x.is_dir(), x.name.lower()))
        
        for entry in entries:
            try:
                # 只处理文件夹
                if not entry.is_dir():
                    continue
                    
                folder = {
                    'name': entry.name,
                    'path': str(entry),
                    'type': 'directory',
                    'size': 0
                }
                
                # 递归获取子文件夹
                if current_depth < max_depth - 1:
                    folder['children'] = await build_folder_tree(entry, max_depth, current_depth + 1)
                else:
                    # 即使不递归，也要检查是否有子文件夹，用于显示展开箭头
                    folder['children'] = []
                    folder['hasChildren'] = await has_subfolders(entry)
                
                folders.append(folder)
                
            except (PermissionError, OSError) as e:
                if 'Operation not permitted' in str(e) or 'Permission denied' in str(e):
                    logger.debug(f"macOS系统保护目录无法访问: {entry}")
                else:
                    logger.warning(f"无法访问 {entry}: {e}")
                continue
                
    except (PermissionError, OSError) as e:
        if 'Operation not permitted' in str(e) or 'Permission denied' in str(e):
            logger.debug(f"macOS系统保护目录无法读取: {path}")
        else:
            logger.error(f"无法读取目录 {path}: {e}")
    
    return folders

async def has_subfolders(path: Path) -> bool:
    """检查目录是否包含子文件夹"""
    try:
        # 忽略的目录
        ignore_patterns = {
            '.git', '.svn', '.hg', '__pycache__', '.pytest_cache',
            'node_modules', '.venv', 'venv', '.env',
            '.DS_Store', 'Thumbs.db', '.vscode', '.idea'
        }
        
        # macOS系统保护目录列表
        macos_protected_dirs = {
            'Accounts', 'AppleMediaServices', 'Autosave Information', 'Biome',
            'Calendars', 'CallHistoryDB', 'CloudStorage', 'Contacts', 
            'CoreData', 'CoreDuet', 'CoreFollowUp', 'DataDeliveryServices',
            'GameKit', 'IdentityServices', 'Insights', 'Mail', 'Messages',
            'Photos', 'ProtectedCloudStorage', 'Reminders', 'Safari', 'Shared',
            'SpeechRecognition', 'Suggestions', 'TCC', 'Trial', 'Wallet'
        }
        
        for entry in path.iterdir():
            if entry.name.startswith('.') and entry.name not in {'.claude'}:
                continue
            if entry.name in ignore_patterns:
                continue
            if entry.name in macos_protected_dirs:
                continue
            if entry.is_dir():
                return True
        return False
    except (PermissionError, OSError):
        return False

async def search_files_in_directory(
    directory: Path, 
    query: str, 
    file_types: str = "all", 
    max_results: int = 20
) -> List[Dict[str, Any]]:
    """在指定目录中搜索文件和文件夹"""
    results = []
    
    if not query or len(query.strip()) < 2:
        return results
    
    try:
        # 忽略的目录和文件（扩展以跳过大型目录）
        ignore_patterns = {
            '.git', '.svn', '.hg', '__pycache__', '.pytest_cache',
            'node_modules', '.venv', 'venv', '.env',
            '.DS_Store', 'Thumbs.db', '.vscode', '.idea',
            'Library', 'Applications', '.yarn', 'go', '.npm', '.cache',
            'bower_components', '.gradle', '.m2'
        }
        
        # 全局停止标志，用于提前终止搜索
        search_stopped = False
        
        # 递归搜索 - 改为广度优先策略
        def search_recursive(current_path: Path, relative_base: Path, depth: int = 0):
            nonlocal search_stopped
            if depth > 2 or search_stopped:  # 限制搜索深度为2层，大幅提升速度
                return
                
            try:
                for entry in current_path.iterdir():
                    if entry.name in ignore_patterns:
                        continue
                        
                    # 计算相对路径
                    try:
                        relative_path = entry.relative_to(relative_base)
                        relative_path_str = str(relative_path)
                    except ValueError:
                        continue
                    
                    # 检查是否匹配搜索词
                    entry_name_lower = entry.name.lower()
                    path_lower = relative_path_str.lower()
                    
                    if (query in entry_name_lower or 
                        query in path_lower or 
                        any(query in part.lower() for part in relative_path_str.split('/'))):
                        
                        is_directory = entry.is_dir()
                        
                        # 根据文件类型过滤
                        if file_types == "files" and is_directory:
                            continue
                        elif file_types == "folders" and not is_directory:
                            continue
                        
                        # 添加到结果
                        result_item = {
                            "name": entry.name,
                            "path": relative_path_str,
                            "type": "directory" if is_directory else "file",
                            "isDirectory": is_directory
                        }
                        
                        # 移除文件大小获取以提升速度
                        # 前端不需要文件大小信息，移除stat()调用
                        
                        results.append(result_item)
                        
                        # 检查是否达到最大结果数 - 全局停止
                        if len(results) >= max_results:
                            search_stopped = True
                            return
                    
                    # 如果是目录，递归搜索 - 增加全局停止检查
                    if entry.is_dir() and not search_stopped:
                        search_recursive(entry, relative_base, depth + 1)
                        if search_stopped:
                            return
                            
            except (PermissionError, OSError) as e:
                logger.debug(f"搜索时无法访问目录 {current_path}: {e}")
                return
        
        # 开始搜索
        search_recursive(directory, directory)
        
        # 按相关性排序（优先显示文件名匹配的结果）
        def sort_key(item):
            name_lower = item["name"].lower()
            path_lower = item["path"].lower()
            
            # 文件名完全匹配得分最高
            if name_lower == query:
                return (0, item["name"])
            # 文件名开头匹配
            elif name_lower.startswith(query):
                return (1, item["name"])
            # 文件名包含
            elif query in name_lower:
                return (2, item["name"])
            # 路径匹配
            else:
                return (3, item["name"])
        
        results.sort(key=sort_key)
        
        # 限制结果数量
        return results[:max_results]
        
    except Exception as e:
        logger.error(f"搜索过程中出错: {e}")
        return []

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

@app.get("/api/config")
async def get_config():
    """获取系统配置API"""
    return JSONResponse(content=Config.get_frontend_config())

@app.get("/api/config/language")
async def get_language_config():
    """获取语言配置API"""
    return JSONResponse(content=Config.get_language_config())

# 通知配置API
@app.get("/api/notifications/email-config")
async def get_email_config():
    """获取邮件通知配置"""
    try:
        import os
        import json
        from pathlib import Path
        
        config_file = Path(__file__).parent / 'mcp_services' / 'smtp-mail' / 'smtp_config.json'
        
        result = {
            "success": True,
            "config": None
        }
        
        # Read from user's flat format config file
        if config_file.exists():
            with open(config_file, 'r', encoding='utf-8') as f:
                smtp_config = json.load(f)
                # Check if it's user's flat format
                if smtp_config.get('SMTP_USER') and smtp_config.get('SMTP_PASS'):
                    test_status = smtp_config.get('testStatus')
                    result["config"] = {
                        "email": smtp_config['SMTP_USER'],
                        "senderName": smtp_config.get('SMTP_HOST', 'Claude Co-Desk'),
                        "configured": True,
                        "testStatus": test_status,
                        # Include actual server configuration
                        "actualProvider": {
                            "host": smtp_config.get('SMTP_HOST', 'unknown'),
                            "port": int(smtp_config.get('SMTP_PORT', 587)),
                            "secure": smtp_config.get('SMTP_SECURE', 'false').lower() == 'true',
                            "nameKey": "providers.actual"  # Use a special key for actual config
                        }
                    }
                    logger.info(f"Loaded email config with testStatus: {test_status}")
        
        return JSONResponse(content=result)
        
    except Exception as e:
        logger.error(f"获取邮件配置失败: {e}")
        return JSONResponse(content={
            "success": False,
            "error": str(e)
        })

@app.get("/api/notifications/status")
async def get_notification_status():
    """获取所有通知方式的配置状态"""
    try:
        status = {
            "email": {"configured": False},
            "wechat": {"bound": False}
        }
        
        # 检查邮件配置状态
        try:
            from pathlib import Path
            import json
            import os
            
            config_dir = Path(__file__).parent / 'mcp_services' / 'smtp-mail'
            smtp_config_file = config_dir / 'smtp_config.json'
            
            if smtp_config_file.exists():
                with open(smtp_config_file, 'r', encoding='utf-8') as f:
                    smtp_config = json.load(f)
                    if smtp_config.get('SMTP_USER') and smtp_config.get('SMTP_PASS'):
                        status["email"]["configured"] = True
        except Exception as e:
            logger.debug(f"Email config check failed: {e}")
        
        # 检查微信绑定状态（使用与/api/wechat/binding-status相同的逻辑）
        try:
            from user_config import get_user_config
            from pathlib import Path
            
            # 获取用户配置
            user_config = await get_user_config()
            user_identifier = user_config.get("user_identifier")
            
            if user_identifier:
                # 检查本地MCP服务的绑定状态
                mcp_services_path = Path(__file__).parent / "mcp_services" / "wechat_notification"
                user_bindings_path = mcp_services_path / "user_bindings.json"
                
                if user_bindings_path.exists():
                    import json
                    with open(user_bindings_path, 'r', encoding='utf-8') as f:
                        bindings_data = json.load(f)
                    
                    users = bindings_data.get("users", {})
                    user_binding = users.get(user_identifier)
                    
                    if user_binding and user_binding.get("status") == "active":
                        status["wechat"]["bound"] = True
        except Exception as e:
            logger.debug(f"WeChat binding check failed: {e}")
        
        return JSONResponse(content={
            "success": True,
            "status": status
        })
        
    except Exception as e:
        logger.error(f"Failed to get notification status: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )

@app.post("/api/notifications/save-email-config")
async def save_email_config(request: Request):
    """保存邮件通知配置"""
    try:
        import json
        from pathlib import Path
        
        body = await request.json()
        email = body.get('email')
        sender_name = body.get('senderName', 'Claude Co-Desk')
        password = body.get('password')
        provider = body.get('provider')
        test_status = body.get('testStatus')
        
        if not email or not password or not provider:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "缺少必要的配置信息"}
            )
        
        # Use MCP services directory for unified management
        config_dir = Path(__file__).parent / 'mcp_services' / 'smtp-mail'
        config_dir.mkdir(parents=True, exist_ok=True)
        
        # Save to SMTP config using user's required flat format
        smtp_config_file = config_dir / 'smtp_config.json'
        smtp_config = {
            "SMTP_HOST": provider['host'],
            "SMTP_PORT": str(provider['port']),
            "SMTP_SECURE": str(provider['secure']).lower(),
            "SMTP_USER": email,
            "SMTP_PASS": password,
            "testStatus": None  # Reset test status when configuration changes
        }
        
        with open(smtp_config_file, 'w', encoding='utf-8') as f:
            json.dump(smtp_config, f, indent=2, ensure_ascii=False)
        
        logger.info(f"邮件配置已保存: {email}")
        
        return JSONResponse(content={
            "success": True,
            "message": "邮件配置保存成功"
        })
        
    except Exception as e:
        logger.error(f"保存邮件配置失败: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )

@app.post("/api/notifications/test-email")
async def test_email_config(request: Request):
    """测试邮件配置 - 使用Python原生SMTP"""
    try:
        body = await request.json()
        email = body.get('email')
        sender_name = body.get('senderName', 'Claude Co-Desk')
        password = body.get('password')
        provider = body.get('provider')
        
        if not email or not password or not provider:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "Missing required configuration"}
            )
        
        # Use Python's native smtplib for testing
        import smtplib
        import ssl
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        # Test email content
        test_subject = "Claude Co-Desk Email Configuration Test"
        test_body = f"""
        <h3>Email Configuration Test Successful!</h3>
        <p>Congratulations! Your email notification configuration has been successfully set up.</p>
        <ul>
            <li><strong>Sender Email:</strong> {email}</li>
            <li><strong>Sender Name:</strong> {sender_name}</li>
            <li><strong>Provider:</strong> {provider.get('nameKey', 'Unknown Provider')}</li>
            <li><strong>Test Time:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</li>
        </ul>
        <p>The system can now send task completion notifications to this email address.</p>
        <hr>
        <small>This email was automatically sent by Claude Co-Desk</small>
        """
        
        try:
            # Create message with proper headers
            message = MIMEMultipart("alternative")
            message["Subject"] = test_subject
            message["From"] = f"{sender_name} <{email}>"
            message["To"] = email
            message["Reply-To"] = email
            message["Message-ID"] = f"<{datetime.now().strftime('%Y%m%d%H%M%S')}.test@heliki.com>"
            
            # Add both plain text and HTML versions
            plain_text = f"""
Email Configuration Test Successful!

Congratulations! Your email notification configuration has been successfully set up.

- Sender Email: {email}
- Sender Name: {sender_name}
- Provider: {provider.get('nameKey', 'Unknown Provider')}
- Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

The system can now send task completion notifications to this email address.

This email was automatically sent by Claude Co-Desk
            """.strip()
            
            text_part = MIMEText(plain_text, "plain")
            html_part = MIMEText(test_body, "html")
            
            message.attach(text_part)
            message.attach(html_part)
            
            # Connect to server and send email with debug info
            if provider['secure']:
                # Use SSL/TLS
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(provider['host'], provider['port'], context=context) as server:
                    server.set_debuglevel(1)
                    server.login(email, password)
                    result = server.sendmail(email, [email], message.as_string())
                    logger.info(f"SMTP SSL result: {result}")
            else:
                # Use STARTTLS
                with smtplib.SMTP(provider['host'], provider['port']) as server:
                    server.set_debuglevel(1)
                    server.starttls()
                    server.login(email, password)
                    result = server.sendmail(email, [email], message.as_string())
                    logger.info(f"SMTP STARTTLS result: {result}")
            
            logger.info(f"Test email sent successfully to {email}")
            
            # Save successful test status to config file
            try:
                import json
                from pathlib import Path
                config_file = Path(__file__).parent / 'mcp_services' / 'smtp-mail' / 'smtp_config.json'
                if config_file.exists():
                    with open(config_file, 'r', encoding='utf-8') as f:
                        smtp_config = json.load(f)
                    smtp_config['testStatus'] = 'success'
                    with open(config_file, 'w', encoding='utf-8') as f:
                        json.dump(smtp_config, f, indent=2, ensure_ascii=False)
                    logger.info("Test status saved as success")
                else:
                    logger.error(f"Config file does not exist at: {config_file}")
            except Exception as save_error:
                logger.error(f"Failed to save test status: {save_error}")
            
            return JSONResponse(content={
                "success": True,
                "message": "Test email sent successfully. Please check your inbox and spam folder."
            })
            
        except smtplib.SMTPAuthenticationError:
            # Save failed test status
            try:
                import json
                from pathlib import Path
                config_file = Path(__file__).parent / 'mcp_services' / 'smtp-mail' / 'smtp_config.json'
                if config_file.exists():
                    with open(config_file, 'r', encoding='utf-8') as f:
                        smtp_config = json.load(f)
                    smtp_config['testStatus'] = 'failed'
                    with open(config_file, 'w', encoding='utf-8') as f:
                        json.dump(smtp_config, f, indent=2, ensure_ascii=False)
                    logger.info("Test status saved as failed - authentication error")
            except Exception as save_error:
                logger.error(f"Failed to save test status: {save_error}")
            return JSONResponse(content={
                "success": False,
                "error": "Authentication failed. Please check your email and password."
            })
        except smtplib.SMTPConnectError:
            # Save failed test status
            try:
                import json
                from pathlib import Path
                config_file = Path(__file__).parent / 'mcp_services' / 'smtp-mail' / 'smtp_config.json'
                if config_file.exists():
                    with open(config_file, 'r', encoding='utf-8') as f:
                        smtp_config = json.load(f)
                    smtp_config['testStatus'] = 'failed'
                    with open(config_file, 'w', encoding='utf-8') as f:
                        json.dump(smtp_config, f, indent=2, ensure_ascii=False)
                    logger.info("Test status saved as failed - connection error")
            except Exception as save_error:
                logger.error(f"Failed to save test status: {save_error}")
            return JSONResponse(content={
                "success": False,
                "error": "Connection failed. Please check server settings."
            })
        except smtplib.SMTPException as e:
            # Save failed test status
            try:
                import json
                from pathlib import Path
                config_file = Path(__file__).parent / 'mcp_services' / 'smtp-mail' / 'smtp_config.json'
                if config_file.exists():
                    with open(config_file, 'r', encoding='utf-8') as f:
                        smtp_config = json.load(f)
                    smtp_config['testStatus'] = 'failed'
                    with open(config_file, 'w', encoding='utf-8') as f:
                        json.dump(smtp_config, f, indent=2, ensure_ascii=False)
                    logger.info("Test status saved as failed - SMTP exception")
            except Exception as save_error:
                logger.error(f"Failed to save test status: {save_error}")
            return JSONResponse(content={
                "success": False,
                "error": f"SMTP error: {str(e)}"
            })
        except Exception as e:
            # Save failed test status
            try:
                import json
                from pathlib import Path
                config_file = Path(__file__).parent / 'mcp_services' / 'smtp-mail' / 'smtp_config.json'
                if config_file.exists():
                    with open(config_file, 'r', encoding='utf-8') as f:
                        smtp_config = json.load(f)
                    smtp_config['testStatus'] = 'failed'
                    with open(config_file, 'w', encoding='utf-8') as f:
                        json.dump(smtp_config, f, indent=2, ensure_ascii=False)
                    logger.info("Test status saved as failed - unexpected error")
            except Exception as save_error:
                logger.error(f"Failed to save test status: {save_error}")
            return JSONResponse(content={
                "success": False,
                "error": f"Unexpected error: {str(e)}"
            })
        
    except Exception as e:
        logger.error(f"Failed to test email configuration: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )

# WeChat Notification APIs
async def sync_binding_to_local(user_identifier: str, user_info: dict, mcp_services_path):
    """将云端绑定信息同步到本地存储"""
    try:
        import json
        from datetime import datetime
        
        user_bindings_path = mcp_services_path / "user_bindings.json"
        
        # 读取现有绑定数据
        if user_bindings_path.exists():
            with open(user_bindings_path, 'r', encoding='utf-8') as f:
                bindings_data = json.load(f)
        else:
            bindings_data = {
                "version": "1.0.0",
                "last_sync": None,
                "users": {},
                "binding_stats": {
                    "total_users": 0,
                    "active_bindings": 0,
                    "last_updated": None
                }
            }
        
        # 添加或更新用户绑定信息
        bindings_data["users"][user_identifier] = {
            "user_identifier": user_identifier,
            "status": "active",
            "cloud_binding_id": user_info.get("cloud_binding_id"),
            "openid": user_info.get("openid"),
            "nickname": user_info.get("nickname", "微信用户"),
            "bound_at": user_info.get("boundAt") or user_info.get("bound_at", datetime.now().isoformat()),
            "last_notification": user_info.get("last_notification"),
            "notification_count": user_info.get("notification_count", 0),
            "avatar_url": user_info.get("avatarUrl", ""),
            "sex": user_info.get("sex", 0),
            "city": user_info.get("city", ""),
            "country": user_info.get("country", ""),
            "notification_preferences": {
                "enabled": True,
                "types": ["task_completion", "system_alerts", "custom"]
            },
            "updated_at": datetime.now().isoformat()
        }
        
        # 更新统计信息
        active_count = sum(1 for user in bindings_data["users"].values() if user.get("status") == "active")
        bindings_data["binding_stats"].update({
            "total_users": len(bindings_data["users"]),
            "active_bindings": active_count,
            "last_updated": datetime.now().isoformat()
        })
        bindings_data["last_sync"] = datetime.now().isoformat()
        
        # 保存到文件
        with open(user_bindings_path, 'w', encoding='utf-8') as f:
            json.dump(bindings_data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Successfully synced binding for user {user_identifier} to local storage")
        
    except Exception as e:
        logger.error(f"Failed to sync binding to local storage: {e}")
        raise

async def sync_unbind_to_cloud(user_identifier: str, mcp_services_path):
    """将解绑操作同步到云端"""
    try:
        import json
        import aiohttp
        
        # 读取微信配置
        config_path = mcp_services_path / "wechat_config.json"
        if not config_path.exists():
            logger.warning("WeChat config not found, skipping cloud unbind sync")
            return
        
        with open(config_path, 'r', encoding='utf-8') as f:
            config_data = json.load(f)
        
        api_config = config_data.get("api_config", {})
        base_url = api_config.get("base_url", "https://www.heliki.com/wechat")
        api_key = api_config.get("api_key")
        
        if not api_key:
            logger.warning("API key not found, skipping cloud unbind sync")
            return
        
        # 调用云端解绑API
        async with aiohttp.ClientSession() as session:
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            
            params = {"user_identifier": user_identifier}
            
            async with session.post(
                f"{base_url}/unbind",
                params=params,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    if result.get("success"):
                        logger.info(f"Successfully synced unbind to cloud for user {user_identifier}")
                    else:
                        logger.warning(f"Cloud unbind failed: {result.get('error', 'Unknown error')}")
                else:
                    logger.warning(f"Cloud unbind API returned status {response.status}")
                    
    except Exception as e:
        logger.error(f"Failed to sync unbind to cloud: {e}")
        raise

@app.get("/api/wechat/binding-status")
async def get_wechat_binding_status():
    """检查微信绑定状态"""
    try:
        from user_config import get_user_config
        from pathlib import Path
        
        # 获取用户配置
        user_config = await get_user_config()
        user_identifier = user_config.get("user_identifier")
        
        if not user_identifier:
            return JSONResponse(content={
                "success": False,
                "bound": False,
                "error": "User not registered"
            })
        
        # 首先检查云端绑定状态
        try:
            # 从配置文件获取云端API信息
            mcp_services_path = Path(__file__).parent / "mcp_services" / "wechat_notification"
            config_path = mcp_services_path / "wechat_config.json"
            
            if config_path.exists():
                import json
                import aiohttp
                
                with open(config_path, 'r', encoding='utf-8') as f:
                    config_data = json.load(f)
                
                api_config = config_data.get("api_config", {})
                base_url = api_config.get("base_url", "https://www.heliki.com/wechat")
                api_key = api_config.get("api_key")
                
                if api_key:
                    # 查询云端绑定状态
                    async with aiohttp.ClientSession() as session:
                        headers = {
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json"
                        }
                        
                        async with session.get(
                            f"{base_url}/user-status/{user_identifier}",
                            headers=headers,
                            timeout=aiohttp.ClientTimeout(total=10)
                        ) as response:
                            if response.status == 200:
                                cloud_data = await response.json()
                                if cloud_data.get("success") and cloud_data.get("bound"):
                                    user_info = cloud_data.get("user_info", {})
                                    
                                    # 提取绑定时间
                                    bound_at_value = user_info.get("boundAt") or user_info.get("bound_at")
                                    
                                    # 同步到本地存储
                                    try:
                                        await sync_binding_to_local(user_identifier, user_info, mcp_services_path)
                                    except Exception as sync_error:
                                        logger.warning(f"Failed to sync binding to local: {sync_error}")
                                    
                                    return JSONResponse(content={
                                        "success": True,
                                        "bound": True,
                                        "userInfo": {
                                            "nickname": user_info.get("nickname", "WeChat User"),
                                            "boundAt": bound_at_value,
                                            "lastNotification": user_info.get("lastNotification") or user_info.get("last_notification")
                                        }
                                    })
                            
        except Exception as e:
            logger.warning(f"Failed to check cloud binding status: {e}")
        
        # 检查本地MCP服务的绑定状态（作为备用）
        try:
            user_bindings_path = mcp_services_path / "user_bindings.json"
            
            if user_bindings_path.exists():
                import json
                with open(user_bindings_path, 'r', encoding='utf-8') as f:
                    bindings_data = json.load(f)
                
                users = bindings_data.get("users", {})
                user_binding = users.get(user_identifier)
                
                if user_binding and user_binding.get("status") == "active":
                    return JSONResponse(content={
                        "success": True,
                        "bound": True,
                        "userInfo": {
                            "nickname": user_binding.get("nickname", "WeChat User"),
                            "boundAt": user_binding.get("bound_at") or user_binding.get("boundAt"),
                            "lastNotification": user_binding.get("last_notification") or user_binding.get("lastNotification")
                        }
                    })
        except Exception as e:
            logger.warning(f"Failed to check local binding status: {e}")
        
        # 如果本地和云端都没有绑定信息，返回未绑定状态
        return JSONResponse(content={
            "success": True,
            "bound": False
        })
        
    except Exception as e:
        logger.error(f"检查微信绑定状态失败: {e}")
        return JSONResponse(content={
            "success": False,
            "bound": False,
            "error": str(e)
        })

@app.post("/api/wechat/generate-qr")
async def generate_wechat_qr():
    """生成微信绑定二维码"""
    try:
        from user_config import get_user_config
        import aiohttp
        
        # 获取用户配置
        user_config = await get_user_config()
        user_identifier = user_config.get("user_identifier")
        api_key = user_config.get("api_key")
        
        if not user_identifier or not api_key:
            return JSONResponse(content={
                "success": False,
                "error": "User not registered properly"
            })
        
        # 调用云端API生成二维码
        async with aiohttp.ClientSession() as session:
            payload = {
                "user_identifier": user_identifier,
                "action": "bind"
            }
            
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            
            async with session.post(
                "https://www.heliki.com/wechat/generate_qr",
                json=payload,
                headers=headers,
                timeout=10
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    if result.get("success"):
                        return JSONResponse(content={
                            "success": True,
                            "qrCodeUrl": result.get("qr_code_url"),
                            "expireTime": 300  # 5 minutes
                        })
                    else:
                        return JSONResponse(content={
                            "success": False,
                            "error": result.get("error", "Failed to generate QR code")
                        })
                else:
                    return JSONResponse(content={
                        "success": False,
                        "error": f"Server error: {response.status}"
                    })
                    
    except Exception as e:
        logger.error(f"生成微信二维码失败: {e}")
        return JSONResponse(content={
            "success": False,
            "error": str(e)
        })

@app.post("/api/wechat/test-notification")
async def test_wechat_notification(request: Request):
    """发送微信测试通知"""
    try:
        from user_config import get_user_config
        import aiohttp
        
        # Parse request body to get language preference
        try:
            body = await request.json()
            language = body.get('language', 'zh-CN')
        except Exception as e:
            language = 'zh-CN'  # Default to Chinese
        
        # 获取用户配置
        user_config = await get_user_config()
        user_identifier = user_config.get("user_identifier")
        api_key = user_config.get("api_key")
        
        if not user_identifier or not api_key:
            return JSONResponse(content={
                "success": False,
                "error": "User not registered properly"
            })
        
        # 构建多语言测试消息
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        if language == 'en':
            task_name = "WeChat Test"
            test_message = f"""## WeChat Notification Test Successful!

Congratulations! Your WeChat notification configuration has been successfully set up.

### Configuration Information:
- **User Identifier**: {user_identifier}
- **Test Time**: {current_time}

The system can now send task completion notifications to you via WeChat.

---
*This message was automatically sent by Claude Co-Desk*"""
        else:
            task_name = "微信通知配置测试"
            test_message = f"""## 微信通知测试成功！

恭喜！您的微信通知配置已成功设置。

### 配置信息：
- **用户标识**: {user_identifier}
- **测试时间**: {current_time}

系统现在可以通过微信向您发送任务完成通知。

---
*此消息由 Claude Co-Desk 自动发送*"""
        
        # 调用云端API发送测试消息
        async with aiohttp.ClientSession() as session:
            payload = {
                "user_identifier": user_identifier,
                "message": test_message,
                "task_name": task_name
            }
            
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            
            async with session.post(
                "https://www.heliki.com/wechat/send_message",
                json=payload,
                headers=headers,
                timeout=15
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    if result.get("success"):
                        return JSONResponse(content={
                            "success": True,
                            "message": "测试通知发送成功"
                        })
                    else:
                        return JSONResponse(content={
                            "success": False,
                            "error": result.get("error", "发送测试消息失败")
                        })
                else:
                    return JSONResponse(content={
                        "success": False,
                        "error": f"Server error: {response.status}"
                    })
                    
    except Exception as e:
        logger.error(f"发送微信测试通知失败: {e}")
        return JSONResponse(content={
            "success": False,
            "error": str(e)
        })

@app.post("/api/wechat/unbind")
async def unbind_wechat():
    """解除微信绑定"""
    try:
        from user_config import get_user_config
        from pathlib import Path
        import json
        
        # 获取用户配置
        user_config = await get_user_config()
        user_identifier = user_config.get("user_identifier")
        
        if not user_identifier:
            return JSONResponse(content={
                "success": False,
                "error": "User not registered"
            })
        
        # 清除本地绑定信息
        try:
            mcp_services_path = Path(__file__).parent / "mcp_services" / "wechat_notification"
            user_bindings_path = mcp_services_path / "user_bindings.json"
            
            if user_bindings_path.exists():
                with open(user_bindings_path, 'r', encoding='utf-8') as f:
                    bindings_data = json.load(f)
                
                # 移除用户绑定
                users = bindings_data.get("users", {})
                if user_identifier in users:
                    del users[user_identifier]
                    
                    # 更新统计信息
                    bindings_data["binding_stats"] = {
                        "total_users": len(users),
                        "active_bindings": len([u for u in users.values() if u.get("status") == "active"]),
                        "last_updated": datetime.now().isoformat()
                    }
                    
                    # 保存更新后的绑定数据
                    with open(user_bindings_path, 'w', encoding='utf-8') as f:
                        json.dump(bindings_data, f, indent=2, ensure_ascii=False)
                    
                    logger.info(f"解除微信绑定成功: {user_identifier}")
                    
                    # 同步解绑到云端
                    try:
                        await sync_unbind_to_cloud(user_identifier, mcp_services_path)
                    except Exception as sync_error:
                        logger.warning(f"云端解绑同步失败: {sync_error}")
                    
                    return JSONResponse(content={
                        "success": True,
                        "message": "微信绑定已解除"
                    })
        
        except Exception as e:
            logger.warning(f"清除本地绑定信息失败: {e}")
        
        # 本地清除失败时，也尝试云端解绑
        try:
            mcp_services_path = Path(__file__).parent / "mcp_services" / "wechat_notification"
            await sync_unbind_to_cloud(user_identifier, mcp_services_path)
        except Exception as sync_error:
            logger.warning(f"云端解绑同步失败: {sync_error}")
        
        # 即使本地清除失败，也返回成功（因为主要绑定在云端）
        return JSONResponse(content={
            "success": True,
            "message": "微信绑定已解除"
        })
        
    except Exception as e:
        logger.error(f"解除微信绑定失败: {e}")
        return JSONResponse(content={
            "success": False,
            "error": str(e)
        })

@app.get("/api/environment")
async def check_environment():
    """Enhanced environment detection API with progress info"""
    logger.info("Starting environment detection process")
    
    # Step 1: Claude CLI detection
    logger.info("Step 1: Detecting Claude CLI executable")
    claude_available = EnvironmentChecker.check_claude_cli()
    if claude_available:
        logger.info("Claude CLI detected successfully")
    else:
        logger.warning("Claude CLI not found")
    
    # Step 2: Projects directory check
    logger.info("Step 2: Checking projects directory")
    projects_exist = EnvironmentChecker.check_projects_directory()
    if projects_exist:
        logger.info("Projects directory verified")
    else:
        logger.warning("Projects directory not accessible")
    
    env_status = EnvironmentChecker.check_environment()
    logger.info(f"Environment check completed. Ready: {env_status['ready']}")
    
    return JSONResponse(content=env_status)

# 系统项目管理API
@app.get("/api/system-project/status")
async def get_system_project_status():
    """获取系统项目状态API"""
    try:
        from projects_manager import SystemProjectManager
        status = SystemProjectManager.check_system_project_status()
        return JSONResponse(content=status)
    except Exception as e:
        logger.error(f"获取系统项目状态时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "获取系统项目状态失败", "details": str(e)}
        )

@app.post("/api/system-project/initialize")
async def initialize_system_project():
    """初始化系统项目API"""
    try:
        from projects_manager import SystemProjectManager
        result = await SystemProjectManager.initialize_system_project()
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"初始化系统项目时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "初始化系统项目失败", "details": str(e)}
        )

@app.get("/api/system-project/agents")
async def get_system_agents():
    """获取已部署智能体信息 - 统一API"""
    try:
        import yaml
        import re
        
        def extract_yaml_fields(content):
            """使用正则表达式提取YAML字段"""
            # 提取YAML front matter部分
            yaml_match = re.search(r'---\n(.*?)\n---', content, re.DOTALL)
            if not yaml_match:
                return None
            
            yaml_text = yaml_match.group(1)
            
            # 简单提取各个字段（只提取第一行的值）
            name_match = re.search(r'name:\s*(.+)', yaml_text)
            description_match = re.search(r'description:\s*(.+)', yaml_text)
            model_match = re.search(r'model:\s*(.+)', yaml_text)
            color_match = re.search(r'color:\s*(.+)', yaml_text)
            
            # 对于description，如果包含复杂内容，只取第一行简单部分
            description = None
            if description_match:
                desc_text = description_match.group(1).strip()
                # 如果描述过长或包含特殊字符，截取前100个字符
                if len(desc_text) > 100 or '\\n' in desc_text:
                    description = desc_text[:100] + '...'
                else:
                    description = desc_text
            
            return {
                'name': name_match.group(1).strip() if name_match else None,
                'description': description,
                'model': model_match.group(1).strip() if model_match else None,
                'color': color_match.group(1).strip() if color_match else None
            }
        
        # 动态获取用户Claude目录，支持多环境
        claude_dir = Path.home() / ".claude" / "agents"
        
        if not claude_dir.exists():
            return JSONResponse(content={"count": 0, "agents": []})
        
        agents = []
        for md_file in claude_dir.glob("*.md"):
            try:
                # 解析YAML front matter
                with open(md_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # 使用正则表达式提取YAML字段，避免严格解析问题
                agent_info = extract_yaml_fields(content)
                if agent_info:
                    agent_info['id'] = md_file.stem
                    agent_info['file_path'] = str(md_file)
                    agent_info['deployed'] = True  # 文件存在即为已部署
                    agents.append(agent_info)
                else:
                    # 如果无法提取YAML，使用文件名创建基本信息
                    agent_info = {
                        'id': md_file.stem,
                        'name': md_file.stem.replace('-', ' ').title(),
                        'description': 'Agent configuration file',
                        'model': 'unknown',
                        'color': 'default',
                        'file_path': str(md_file),
                        'deployed': True
                    }
                    agents.append(agent_info)
                        
            except Exception as e:
                logger.warning(f"解析智能体文件 {md_file} 失败: {e}")
                continue
        
        return JSONResponse(content={
            "count": len(agents),
            "agents": agents
        })
        
    except Exception as e:
        logger.error(f"获取智能体信息时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"count": 0, "agents": [], "error": str(e)}
        )


@app.post("/api/agents-deployed")
async def handle_agents_deployed(request: Request):
    """处理数字员工部署完成通知API"""
    try:
        # 解析请求数据
        data = await request.json()
        logger.info(f"Received agent deployment completion notification: {data}")
        
        # 准备广播消息
        broadcast_message = {
            "type": "agents_deployed",
            "status": data.get("status", "success"),
            "message": data.get("message", "数字员工团队部署完成"),
            "deployed_agents": data.get("deployed_agents", []),
            "timestamp": data.get("timestamp"),
            "agent_count": len(data.get("deployed_agents", []))
        }
        
        # 广播到所有WebSocket连接
        broadcast_success = True
        try:
            await manager.broadcast(broadcast_message)
            logger.info(f"Broadcasted agent deployment completion message to all connections")
        except Exception as broadcast_error:
            logger.error(f"广播消息失败: {broadcast_error}")
            broadcast_success = False
            # 继续处理，不因为广播失败而中断
        
        # 可选：更新系统状态（如果需要持久化）
        # await update_system_agents_status()
        
        return JSONResponse(content={
            "status": "success",
            "message": "部署完成通知已处理",
            "broadcast": broadcast_success,
            "agent_count": len(data.get("deployed_agents", [])),
            "timestamp": data.get("timestamp")
        })
        
    except Exception as e:
        logger.error(f"处理数字员工部署通知时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "error": "处理部署通知失败", 
                "details": str(e),
                "status": "error"
            }
        )

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
        return JSONResponse(content={"files": file_tree})
        
    except Exception as e:
        logger.error(f"获取项目 {project_name} 文件时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "获取文件列表失败", "details": str(e)}
        )

@app.get("/api/browse-folders")
async def browse_folders(path: str = None, max_depth: int = 2):
    if path is None:
        path = Config.get_user_home()
    """浏览文件夹树API，只返回文件夹结构"""
    try:
        folder_path = Path(path).resolve()
        
        # 安全检查：确保路径存在
        if not folder_path.exists():
            return JSONResponse(
                status_code=404,
                content={"error": "路径不存在"}
            )
            
        if not folder_path.is_dir():
            return JSONResponse(
                status_code=400,
                content={"error": "指定路径不是文件夹"}
            )
        
        # 构建文件夹树
        folder_tree = await build_folder_tree(folder_path, max_depth)
        return JSONResponse(content={"folders": folder_tree, "currentPath": str(folder_path)})
        
    except Exception as e:
        logger.error(f"浏览文件夹 {path} 时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "浏览文件夹失败", "details": str(e)}
        )

@app.get("/api/search-files")
async def search_files(
    query: str,
    working_directory: str,
    file_types: str = "all",
    max_results: int = 20
):
    """搜索文件和文件夹API"""
    try:
        # 安全检查：确保工作目录存在
        working_dir = Path(working_directory).resolve()
        if not working_dir.exists() or not working_dir.is_dir():
            return JSONResponse(
                status_code=404,
                content={"error": "工作目录不存在"}
            )
        
        # 执行搜索
        results = await search_files_in_directory(
            working_dir, 
            query.lower().strip(), 
            file_types, 
            max_results
        )
        
        return JSONResponse(content={"results": results})
        
    except Exception as e:
        logger.error(f"搜索文件时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "搜索文件失败", "details": str(e)}
        )

@app.get("/api/files/read")
async def read_file(file_path: str, project_path: str):
    """读取文件内容API"""
    try:
        # 安全检查：确保文件在项目目录内
        project_path = Path(project_path).resolve()
        
        # 正确处理相对路径：如果是相对路径，相对于project_path解析
        file_path_obj = Path(file_path)
        if not file_path_obj.is_absolute():
            file_path_obj = project_path / file_path
        file_path_resolved = file_path_obj.resolve()
        
        if not str(file_path_resolved).startswith(str(project_path)):
            return JSONResponse(
                status_code=403,
                content={"error": "Access denied: file not within project directory"}
            )
        
        if not file_path_resolved.exists():
            return JSONResponse(
                status_code=404,
                content={"error": "文件不存在"}
            )
        
        # 检查是否为二进制文件
        if is_binary_file(file_path_resolved):
            return JSONResponse(
                status_code=400,
                content={"error": "无法读取二进制文件"}
            )
        
        # 检查文件大小（10MB限制）
        file_size = file_path_resolved.stat().st_size
        MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
        
        if file_size > MAX_FILE_SIZE:
            # 格式化文件大小显示
            def format_file_size(bytes_size):
                if bytes_size < 1024:
                    return f"{bytes_size} B"
                elif bytes_size < 1024 * 1024:
                    return f"{bytes_size / 1024:.1f} KB"
                elif bytes_size < 1024 * 1024 * 1024:
                    return f"{bytes_size / (1024 * 1024):.1f} MB"
                else:
                    return f"{bytes_size / (1024 * 1024 * 1024):.1f} GB"
            
            return JSONResponse(
                status_code=413,  # Payload Too Large
                content={
                    "error": "文件过大，会导致崩溃",
                    "fileSize": file_size,
                    "fileSizeFormatted": format_file_size(file_size),
                    "maxSize": MAX_FILE_SIZE,
                    "maxSizeFormatted": format_file_size(MAX_FILE_SIZE),
                    "canOpenWithSystem": True,
                    "filePath": str(file_path_resolved)
                }
            )
        
        # 读取文件内容
        async with aiofiles.open(file_path_resolved, 'r', encoding='utf-8') as f:
            content = await f.read()
        
        return JSONResponse(content={
            "content": content,
            "path": str(file_path_resolved),
            "size": file_size,
            "modified": file_path_resolved.stat().st_mtime
        })
        
    except Exception as e:
        logger.error(f"读取文件 {file_path} 时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "读取文件失败", "details": str(e)}
        )

@app.post("/api/files/open-system")
async def open_file_with_system(request: Request):
    """用系统默认应用打开文件API"""
    try:
        data = await request.json()
        file_path = data.get('filePath', '')
        project_path = data.get('projectPath', '')
        
        if not file_path or not project_path:
            return JSONResponse(
                status_code=400,
                content={"error": "文件路径和项目路径不能为空"}
            )
        
        # 安全检查：确保文件在项目目录内
        project_path = Path(project_path).resolve()
        file_path = Path(file_path).resolve()
        
        if not str(file_path).startswith(str(project_path)):
            return JSONResponse(
                status_code=403,
                content={"error": "Access denied: file not within project directory"}
            )
        
        if not file_path.exists():
            return JSONResponse(
                status_code=404,
                content={"error": "文件不存在"}
            )
        
        # 根据操作系统使用不同的命令打开文件
        import platform
        import subprocess
        
        system = platform.system()
        try:
            if system == "Darwin":  # macOS
                subprocess.run(["open", str(file_path)], check=True)
            elif system == "Windows":  # Windows
                subprocess.run(["start", str(file_path)], shell=True, check=True)
            else:  # Linux和其他Unix系统
                subprocess.run(["xdg-open", str(file_path)], check=True)
            
            logger.info(f"Successfully opened file with system application: {file_path}")
            return JSONResponse(content={
                "success": True,
                "message": f"已用系统默认应用打开文件",
                "filePath": str(file_path)
            })
            
        except subprocess.CalledProcessError as e:
            logger.error(f"打开文件失败: {e}")
            return JSONResponse(
                status_code=500,
                content={"error": "无法打开文件", "details": str(e)}
            )
            
    except Exception as e:
        logger.error(f"打开文件 {file_path} 时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "打开文件失败", "details": str(e)}
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
                content={"error": "Access denied: file not within project directory"}
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

# Hook管理API端点
@app.post("/api/hooks/setup-temporary")
async def setup_temporary_hook(request: Request):
    """设置临时的Claude Code hook"""
    try:
        data = await request.json()
        session_identifier = data.get('sessionId', '')
        
        # 导入并使用HookManager
        from setup_hooks import HookManager
        hook_manager = HookManager()
        
        success = hook_manager.setup_temporary_hook(session_identifier)
        
        if success:
            logger.info(f"Temporary hook setup successful, session ID: {session_identifier}")
            return JSONResponse(content={
                "success": True,
                "message": "临时hook配置成功",
                "sessionId": session_identifier
            })
        else:
            logger.error(f" 临时hook设置失败，会话ID: {session_identifier}")
            return JSONResponse(
                status_code=500,
                content={"error": "临时hook配置失败"}
            )
            
    except Exception as e:
        logger.error(f"设置临时hook时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "设置临时hook失败", "details": str(e)}
        )

@app.post("/api/hooks/remove-temporary")
async def remove_temporary_hook(request: Request):
    """移除临时的Claude Code hooks"""
    try:
        # 导入并使用HookManager
        from setup_hooks import HookManager
        hook_manager = HookManager()
        
        success = hook_manager.remove_temporary_hooks()
        
        if success:
            logger.info("Temporary hooks removed successfully")
            return JSONResponse(content={
                "success": True,
                "message": "临时hooks已移除"
            })
        else:
            logger.error(" 临时hooks移除失败")
            return JSONResponse(
                status_code=500,
                content={"error": "临时hooks移除失败"}
            )
            
    except Exception as e:
        logger.error(f"移除临时hooks时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "移除临时hooks失败", "details": str(e)}
        )

@app.get("/api/hooks/status")
async def get_hook_status():
    """获取当前hooks配置状态"""
    try:
        # 导入并使用HookManager
        from setup_hooks import HookManager
        hook_manager = HookManager()
        
        status = hook_manager.check_hook_status()
        
        return JSONResponse(content={
            "success": True,
            "status": status
        })
        
    except Exception as e:
        logger.error(f"检查hooks状态时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "检查hooks状态失败", "details": str(e)}
        )

# 系统信息API
@app.get("/api/claude-info")
async def get_claude_info():
    """获取Claude CLI信息API"""
    try:
        claude_path = EnvironmentChecker.get_claude_executable_path()
        if not claude_path:
            return JSONResponse(
                status_code=500,
                content={"error": "Claude CLI未找到"}
            )
        
        # 获取Claude CLI版本
        try:
            result = subprocess.run([claude_path, '--version'], 
                                 capture_output=True, text=True, timeout=10)
            version = result.stdout.strip() if result.returncode == 0 else "未知版本"
        except Exception:
            version = "1.0.73 (Claude Code)"
        
        return JSONResponse(content={
            "version": version,
            "path": claude_path
        })
    except Exception as e:
        logger.error(f"获取Claude CLI信息时出错: {e}")
        return JSONResponse(content={
            "version": "1.0.73 (Claude Code)",
            "path": str(Path.home() / '.local' / 'bin' / 'claude')
        })


# 任务管理API
@app.get("/api/tasks")
async def get_tasks():
    """获取任务列表API"""
    try:
        tasks = task_scheduler.get_scheduled_tasks()
        
        # 添加调试日志：检查返回的任务数据
        logger.info(f"API returned task count: {len(tasks)}")
        for task in tasks:
            if task.get('sessionId'):
                logger.info(f"Task {task['name']} contains sessionId: {task['sessionId']}")
            else:
                logger.info(f"Task {task['name']} has no sessionId")
        
        return JSONResponse(content={"tasks": tasks})
    except Exception as e:
        logger.error(f"获取任务列表时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "获取任务列表失败", "details": str(e)}
        )

@app.get("/api/tasks/scheduler-status")
async def get_scheduler_status():
    """获取任务调度器状态API"""
    try:
        status = task_scheduler.get_scheduler_status()
        return JSONResponse(content=status)
    except Exception as e:
        logger.error(f"获取调度器状态时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "获取调度器状态失败", "details": str(e)}
        )

@app.post("/api/tasks")
async def create_task(request: Request):
    """创建任务API"""
    try:
        task_data = await request.json()
        
        # 验证必需字段
        required_fields = ['name', 'goal']
        for field in required_fields:
            if not task_data.get(field):
                return JSONResponse(
                    status_code=400,
                    content={"error": f"缺少必需字段: {field}"}
                )
        
        # 生成任务ID和创建时间
        task_data['id'] = f"task_{int(datetime.now().timestamp())}_{len(task_data['name'])}"
        task_data['createdAt'] = datetime.now().isoformat()
        
        # 确保数据完整性
        if 'enabled' not in task_data:
            task_data['enabled'] = True
        if 'resources' not in task_data:
            task_data['resources'] = []
        if 'skipPermissions' not in task_data:
            task_data['skipPermissions'] = False
        if 'verboseLogs' not in task_data:
            task_data['verboseLogs'] = False
        
        # 添加任务到调度器（无论是立即执行还是定时执行）
        success = task_scheduler.add_scheduled_task(task_data)
        if not success:
            logger.warning(f"任务 {task_data['name']} 未添加到调度器，但仍返回成功响应")
        
        # 如果是立即执行任务，直接创建页签执行
        if task_data.get('executionMode') == 'immediate':
            try:
                # 获取刚创建的任务对象以获取工作目录
                created_task = task_scheduler.all_tasks.get(task_data['id'])
                if created_task:
                    # Build complete execution command, adding work directory instruction
                    work_dir_instruction = f" [Special Requirement] For local tasks, save all newly created materials/code/documents and collected information to {created_task.work_directory}. If results are generated by agents, prefix filenames with the agent type name"
                    enhanced_goal = f"{task_data['goal']} {work_dir_instruction}"
                    
                    # Add notification instructions if enabled
                    notification_settings = task_data.get('notificationSettings', {})
                    if notification_settings.get('enabled') and notification_settings.get('methods'):
                        methods = notification_settings['methods']
                        if methods:
                            notification_types = []
                            if 'email' in methods:
                                notification_types.append('email notification')
                            if 'wechat' in methods:
                                notification_types.append('WeChat notification')
                            
                            if notification_types:
                                notification_command = f" After task completion, send the results to me using {' and '.join(notification_types)} tools. For email notifications, format the content as clean HTML with proper structure, headers, and readable formatting instead of raw Markdown."
                                enhanced_goal = f"{enhanced_goal}{notification_command}"
                    
                    # 调试日志：确认task_data的内容
                    logger.info(f"Immediate task execution debug: verboseLogs={task_data.get('verboseLogs', 'KEY_NOT_FOUND')}, skipPermissions={task_data.get('skipPermissions', 'KEY_NOT_FOUND')}")
                    logger.info(f"task_data all keys: {list(task_data.keys())}")
                    
                    task_command_parts = [enhanced_goal]  # 增强的任务目标
                    
                    # 添加权限模式
                    if task_data.get('skipPermissions', False):
                        task_command_parts.append('--dangerously-skip-permissions')
                    
                    # 添加verbose日志模式
                    if task_data.get('verboseLogs', False):
                        task_command_parts.append('--verbose')
                        logger.info(f"Batch execution added --verbose parameter to command")
                    
                    # 添加资源文件引用
                    if task_data.get('resources'):
                        for resource in task_data['resources']:
                            task_command_parts.extend(['--add-dir', resource])
                    
                    # 拼接完整命令
                    full_task_command = ' '.join(task_command_parts)
                    
                    # 发送创建页签消息给前端
                    session_data = {
                        'type': 'create-task-tab',
                        'taskId': task_data['id'],
                        'taskName': f" {task_data['name']}",
                        'initialCommand': full_task_command,
                        'workingDirectory': os.path.expanduser('~'),
                        'immediateExecution': True
                    }
                    
                    # 通过WebSocket广播给所有连接的客户端
                    await manager.broadcast(session_data)
                    logger.info(f"Immediate execution task {task_data['name']} tab creation request sent")
                else:
                    logger.warning(f" 未找到刚创建的任务: {task_data['id']}")
                    
            except Exception as e:
                logger.error(f" 创建立即执行任务页签失败: {e}")
        
        # 返回完整的任务对象
        return JSONResponse(content=task_data)
        
    except Exception as e:
        logger.error(f"创建任务时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "创建任务失败", "details": str(e)}
        )

@app.put("/api/tasks/{task_id}")
async def update_task(task_id: str, request: Request):
    """更新任务API"""
    try:
        task_data = await request.json()
        task_data['id'] = task_id
        
        success = task_scheduler.update_scheduled_task(task_data)
        if success:
            # 获取更新后的任务数据
            all_tasks = task_scheduler.get_scheduled_tasks()
            updated_task = next((task for task in all_tasks if task['id'] == task_id), None)
            
            if updated_task:
                return JSONResponse(content=updated_task)
            else:
                return JSONResponse(
                    status_code=500,
                    content={"error": "任务更新成功但无法获取更新后的数据"}
                )
        else:
            return JSONResponse(
                status_code=400,
                content={"error": "更新任务失败"}
            )
        
    except Exception as e:
        logger.error(f"更新任务时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "更新任务失败", "details": str(e)}
        )

@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str):
    """删除任务API（软删除）"""
    try:
        success = task_scheduler.delete_task(task_id)
        if success:
            return JSONResponse(content={"success": True, "message": "任务已删除"})
        else:
            return JSONResponse(
                status_code=404,
                content={"error": "任务不存在"}
            )
        
    except Exception as e:
        logger.error(f"删除任务时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "删除任务失败", "details": str(e)}
        )

@app.get("/api/task-files/{task_id}")
async def get_task_files(task_id: str):
    """获取任务文件列表API"""
    try:
        # 从调度器中获取任务信息
        if task_id not in task_scheduler.all_tasks:
            return JSONResponse(
                status_code=404,
                content={"error": "任务不存在"}
            )
        
        task = task_scheduler.all_tasks[task_id]
        work_directory = task.work_directory
        
        if not work_directory:
            return JSONResponse(content={"files": [], "message": "任务未分配工作目录"})
        
        # 使用MissionManager获取文件列表
        files = task_scheduler.mission_manager.list_task_files(work_directory)
        
        return JSONResponse(content={
            "files": files,
            "workDirectory": work_directory,
            "taskId": task_id,
            "taskName": task.name
        })
        
    except Exception as e:
        logger.error(f"获取任务文件时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "获取任务文件失败", "details": str(e)}
        )

@app.post("/api/tasks/{task_id}/toggle")
async def toggle_task(task_id: str, request: Request):
    """启用/禁用任务API"""
    try:
        data = await request.json()
        enabled = data.get('enabled', True)
        
        success = task_scheduler.toggle_task(task_id, enabled)
        if success:
            return JSONResponse(content={"success": True})
        else:
            return JSONResponse(
                status_code=404,
                content={"error": "任务不存在"}
            )
        
    except Exception as e:
        logger.error(f"切换任务状态时出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "切换任务状态失败", "details": str(e)}
        )


# MCP工具管理API
@app.get("/api/mcp/status")
async def get_mcp_status_api(project_path: str = None):
    """获取MCP工具状态API"""
    try:
        result = await get_project_mcp_status(project_path or os.path.expanduser('~'))
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"获取MCP状态API出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "获取MCP状态失败", "details": str(e)}
        )


@app.get("/api/mcp/cross-project-status")
async def get_cross_project_mcp_status():
    """获取跨项目MCP工具状态API"""
    try:
        # 获取所有项目
        projects = await ProjectManager.get_projects()
        
        # 用户家目录MCP状态
        user_home_path = os.path.expanduser('~')
        user_home_status = await get_project_mcp_status(user_home_path)
        
        # 并行获取每个项目的MCP状态
        async def get_single_project_status(project):
            project_path = project.get("path")
            # 过滤掉用户家目录，避免重复统计
            if project_path and os.path.exists(project_path) and os.path.abspath(project_path) != os.path.abspath(user_home_path):
                try:
                    status = await get_project_mcp_status(project_path)
                    return {
                        "projectName": project.get("name"),
                        "projectPath": project_path,
                        "mcpStatus": status
                    }
                except Exception as e:
                    logger.warning(f"获取项目 {project_path} MCP状态失败: {e}")
                    return {
                        "projectName": project.get("name"),
                        "projectPath": project_path,
                        "mcpStatus": {"count": 0, "tools": []}
                    }
            return None
        
        # 串行执行项目的MCP状态查询（排除用户家目录），避免进程竞争
        project_statuses = []
        for project in projects:
            try:
                result = await get_single_project_status(project)
                if result is not None:
                    project_statuses.append(result)
            except Exception as e:
                logger.warning(f"获取项目 {project.get('name', 'unknown')} MCP状态异常: {e}")
                continue
        
        return JSONResponse(content={
            "userHomeStatus": user_home_status,
            "projectStatuses": project_statuses,
            "totalProjects": len(project_statuses)
        })
    except Exception as e:
        logger.error(f"获取跨项目MCP状态API出错: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "获取跨项目MCP状态失败", "details": str(e)}
        )


def parse_mcp_tools_output(output: str) -> tuple[list, int]:
    """解析claude mcp list命令的输出
    
    输出格式示例:
    Checking MCP server health...
    
    playwright: npx @playwright/mcp - Connected
    weather: ~/.local/bin/uv - Failed
    
    返回: (tools_list, tools_count)
    """
    import re
    
    tools_list = []
    
    # 跳过健康检查头部信息
    lines = output.split('\n')
    for line in lines:
        line = line.strip()
        if not line or line.startswith('Checking MCP server health'):
            continue
        
        # 匹配工具行格式: tool_name: command - status
        match = re.match(r'^([^:]+):\s+(.+?)\s+-\s+(.*?)$', line)
        if match:
            tool_name = match.group(1).strip()
            tool_command = match.group(2).strip()
            status_text = match.group(3).strip()
            
            # 解析状态
            is_connected = 'Connected' in status_text
            
            tool_info = {
                'id': tool_name,
                'name': tool_name,
                'command': tool_command,
                'enabled': is_connected,
                'status': 'connected' if is_connected else 'failed',
                'description': f'{tool_command} - {status_text}'
            }
            
            tools_list.append(tool_info)
    
    tools_count = len(tools_list)
    logger.info(f"Parsed MCP tool list: {tools_count} tools")
    
    return tools_list, tools_count

# MCP管理处理方法
async def handle_get_mcp_status(websocket: WebSocket, project_path: str = None):
    """处理获取MCP工具状态请求"""
    try:
        # 确定工作目录：如果提供了项目路径则使用项目路径，否则使用用户家目录
        working_dir = project_path if project_path and os.path.exists(project_path) else os.path.expanduser('~')
        logger.info(f"Received MCP status query request, working directory: {working_dir}")
        
        # 获取Claude CLI的绝对路径
        claude_executable = EnvironmentChecker.get_claude_executable_path()
        if not claude_executable:
            raise Exception("Claude CLI executable not found")
        
        # 执行claude mcp list命令获取已安装工具
        result = subprocess.run([claude_executable, 'mcp', 'list'], 
                              capture_output=True, text=True, timeout=30,
                              cwd=working_dir)
        
        tools_list = []
        tools_count = 0
        
        if result.returncode == 0:
            output = result.stdout.strip()
            if "No MCP servers configured" not in output and output:
                # 解析MCP工具列表
                tools_list, tools_count = parse_mcp_tools_output(output)
            else:
                tools_count = 0
        else:
            logger.error(f"获取MCP状态失败: {result.stderr}")
        
        # 发送MCP状态响应
        await manager.send_personal_message({
            'type': 'mcp-status-response',
            'tools': tools_list,
            'count': tools_count,
            'status': 'success' if result.returncode == 0 else 'error',
            'message': output if result.returncode == 0 else result.stderr,
            'projectPath': working_dir,
            'isProjectSpecific': bool(project_path and os.path.exists(project_path))
        }, websocket)
        
        logger.info(f"MCP status query completed: {tools_count} tools")
        
    except subprocess.TimeoutExpired:
        working_dir = project_path if project_path and os.path.exists(project_path) else os.path.expanduser('~')
        await manager.send_personal_message({
            'type': 'mcp-status-response',
            'tools': [],
            'count': 0,
            'status': 'timeout',
            'message': 'MCP状态查询超时',
            'projectPath': working_dir,
            'isProjectSpecific': bool(project_path and os.path.exists(project_path))
        }, websocket)
        logger.error("MCP状态查询超时")
        
    except Exception as e:
        working_dir = project_path if project_path and os.path.exists(project_path) else os.path.expanduser('~')
        await manager.send_personal_message({
            'type': 'mcp-status-response',
            'tools': [],
            'count': 0,
            'status': 'error',
            'message': str(e),
            'projectPath': working_dir,
            'isProjectSpecific': bool(project_path and os.path.exists(project_path))
        }, websocket)
        logger.error(f"MCP状态查询异常: {e}")


async def get_project_mcp_status(project_path: str):
    """获取指定项目的MCP状态"""
    try:
        working_dir = project_path if os.path.exists(project_path) else os.path.expanduser('~')
        logger.info(f"Querying project MCP status: {working_dir}")
        
        # 获取Claude CLI的绝对路径
        claude_executable = EnvironmentChecker.get_claude_executable_path()
        if not claude_executable:
            raise Exception("Claude CLI executable not found")
        
        # 异步执行claude mcp list命令获取已安装工具
        process = await asyncio.create_subprocess_exec(
            claude_executable, 'mcp', 'list',
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=working_dir
        )
        
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=20.0)
            result_stdout = stdout.decode('utf-8').strip()
            result_stderr = stderr.decode('utf-8')
            returncode = process.returncode
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            return {
                'projectPath': working_dir,
                'tools': [],
                'count': 0,
                'status': 'timeout',
                'message': 'MCP查询超时',
                'isProjectSpecific': os.path.exists(project_path)
            }
        
        tools_list = []
        tools_count = 0
        
        if returncode == 0:
            if "No MCP servers configured" not in result_stdout and result_stdout:
                tools_list, tools_count = parse_mcp_tools_output(result_stdout)
            else:
                tools_count = 0
        
        return {
            'projectPath': working_dir,
            'tools': tools_list,
            'count': tools_count,
            'status': 'success' if returncode == 0 else 'error',
            'message': result_stdout if returncode == 0 else result_stderr,
            'isProjectSpecific': os.path.exists(project_path)
        }
        
    except Exception as e:
        logger.error(f"获取项目MCP状态异常: {e}")
        return {
            'projectPath': project_path,
            'tools': [],
            'count': 0,
            'status': 'error',
            'message': str(e),
            'isProjectSpecific': False
        }


# Application Control API Endpoints
@app.get("/api/applications")
async def get_applications():
    """Get all discovered applications API"""
    try:
        logger.info("Getting all discovered applications")
        applications = app_scanner.scan_all_applications()
        applications_dict = app_scanner.to_dict(applications)
        
        logger.info(f"Found {len(applications_dict)} applications")
        return JSONResponse(content={
            "success": True,
            "applications": applications_dict,
            "count": len(applications_dict)
        })
        
    except Exception as e:
        logger.error(f"Error getting applications: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Failed to get applications",
                "details": str(e)
            }
        )

@app.post("/api/applications/scan")
async def scan_applications():
    """Scan and refresh applications API"""
    try:
        logger.info("Starting application scan")
        applications = app_scanner.scan_all_applications()
        applications_dict = app_scanner.to_dict(applications)
        
        logger.info(f"Application scan completed. Found {len(applications_dict)} applications")
        return JSONResponse(content={
            "success": True,
            "applications": applications_dict,
            "count": len(applications_dict),
            "message": f"Successfully scanned {len(applications_dict)} applications"
        })
        
    except Exception as e:
        logger.error(f"Error scanning applications: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Failed to scan applications",
                "details": str(e)
            }
        )

@app.post("/api/applications/launch")
async def launch_application(request: Request):
    """Launch application API"""
    try:
        data = await request.json()
        app_name = data.get('app_name', '')
        
        if not app_name:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": "Application name is required"
                }
            )
        
        logger.info(f"Launching application: {app_name}")
        
        # Get application info
        app_info = app_scanner.get_application_by_name(app_name)
        if not app_info:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "error": f"Application '{app_name}' not found"
                }
            )
        
        # Launch the application
        import subprocess
        try:
            if app_info.platform == "darwin":
                # macOS
                result = subprocess.run(
                    app_info.launch_command.split(),
                    capture_output=True,
                    text=True,
                    timeout=10
                )
            elif app_info.platform == "windows":
                # Windows
                result = subprocess.run(
                    app_info.launch_command,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=10
                )
            else:
                # Linux
                result = subprocess.run(
                    app_info.launch_command.split(),
                    capture_output=True,
                    text=True,
                    timeout=10
                )
            
            if result.returncode == 0:
                logger.info(f"Successfully launched application: {app_name}")
                return JSONResponse(content={
                    "success": True,
                    "message": f"Successfully launched {app_name}"
                })
            else:
                logger.error(f"Failed to launch {app_name}: {result.stderr}")
                return JSONResponse(
                    status_code=500,
                    content={
                        "success": False,
                        "error": f"Failed to launch {app_name}",
                        "details": result.stderr
                    }
                )
                
        except subprocess.TimeoutExpired:
            logger.warning(f"Timeout launching {app_name} - application may have started")
            return JSONResponse(content={
                "success": True,
                "message": f"Application {app_name} launch initiated (timeout reached, may be running in background)"
            })
            
    except Exception as e:
        logger.error(f"Error launching application {app_name}: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Failed to launch application",
                "details": str(e)
            }
        )

@app.get("/api/applications/{app_name}")
async def get_application_info(app_name: str):
    """Get specific application information API"""
    try:
        logger.info(f"Getting info for application: {app_name}")
        app_info = app_scanner.get_application_by_name(app_name)
        
        if not app_info:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "error": f"Application '{app_name}' not found"
                }
            )
        
        app_dict = app_scanner.to_dict({app_name: app_info})
        return JSONResponse(content={
            "success": True,
            "application": app_dict[app_name]
        })
        
    except Exception as e:
        logger.error(f"Error getting application info for {app_name}: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Failed to get application info",
                "details": str(e)
            }
        )

@app.post("/api/applications/setup-mcp")
async def setup_mcp_configuration():
    """Setup MCP configuration for application control API"""
    try:
        logger.info("Setting up MCP configuration for application control")
        
        success = mcp_config_generator.setup_mcp_configuration()
        
        if success:
            # Get updated status
            status = mcp_config_generator.get_mcp_status()
            
            return JSONResponse(content={
                "success": True,
                "message": "MCP configuration setup successful",
                "status": status,
                "restart_required": True
            })
        else:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "error": "Failed to setup MCP configuration"
                }
            )
            
    except Exception as e:
        logger.error(f"Error setting up MCP configuration: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Failed to setup MCP configuration",
                "details": str(e)
            }
        )

@app.get("/api/applications/mcp-status")
async def get_mcp_status():
    """Get MCP configuration status API"""
    try:
        logger.info("Getting MCP configuration status")
        
        status = mcp_config_generator.get_mcp_status()
        
        return JSONResponse(content={
            "success": True,
            "status": status
        })
        
    except Exception as e:
        logger.error(f"Error getting MCP status: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Failed to get MCP status",
                "details": str(e)
            }
        )

@app.post("/api/applications/update-tags")
async def update_application_tags(request: Request):
    """Update application tags API"""
    try:
        data = await request.json()
        app_name = data.get('app_name', '')
        tags = data.get('tags', [])
        
        if not app_name:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": "Application name is required"
                }
            )
        
        if not isinstance(tags, list):
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": "Tags must be a list"
                }
            )
        
        logger.info(f"Updating tags for application: {app_name}, tags: {tags}")
        
        # Validate that the application exists
        app_info = app_scanner.get_application_by_name(app_name)
        if not app_info:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "error": f"Application '{app_name}' not found"
                }
            )
        
        # Update tags using the scanner's update method
        app_scanner.update_app_tags(app_name, tags)
        
        # Clear cache to ensure fresh data on next scan
        app_scanner.clear_cache()
        
        logger.info(f"Successfully updated tags for {app_name}: {tags}")
        return JSONResponse(content={
            "success": True,
            "message": f"Tags updated for {app_name}",
            "app_name": app_name,
            "tags": tags
        })
        
    except Exception as e:
        logger.error(f"Error updating tags for application: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Failed to update application tags",
                "details": str(e)
            }
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
                
                logger.info(f"User message: {command or '[Continue/Resume]'}")
                logger.info(f"Project: {options.get('projectPath', 'Unknown')}")
                logger.info(f"Session: {'Resume' if options.get('sessionId') else 'New'}")
                
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
                logger.info(f"Abort session request: {session_id}")
                success = claude_cli.abort_claude_session(session_id)
                await manager.send_personal_message({
                    'type': 'session-aborted',
                    'sessionId': session_id,
                    'success': success
                }, websocket)
            elif message.get('type') == 'new-task-session':
                # 处理任务执行请求
                task_id = message.get('taskId')
                task_name = message.get('taskName', '未知任务')
                command = message.get('command', '')
                skip_permissions = message.get('skipPermissions', False)
                verbose_logs = message.get('verboseLogs', False)
                resources = message.get('resources', [])
                
                # 调试：检查接收到的完整命令
                logger.info(f"🔔 Received WebSocket command: {command}")
                logger.info(f"🔔 Command length: {len(command)} characters")
                
                # 调试日志：确认接收到的参数
                logger.info(f"Task execution parameter debug: skipPermissions={skip_permissions}, verboseLogs={verbose_logs}")
                
                logger.info(f"Task execution request: {task_name} (ID: {task_id})")
                if resources:
                    logger.info(f"Task resource files: {', '.join(resources)}")
                
                # 获取任务工作目录信息
                task_work_dir = ""
                if task_id in task_scheduler.all_tasks:
                    task_work_dir = task_scheduler.all_tasks[task_id].work_directory
                
                # 构建任务执行选项
                task_options = {
                    'taskId': task_id,
                    'taskName': task_name,
                    'projectPath': None,  # 任务不绑定特定项目
                    'permissionMode': 'dangerously-allow-all' if skip_permissions else 'default',
                    'resources': resources
                }
                
                # Build complete task execution command, adding work directory instruction
                enhanced_command = command
                logger.info(f"🔔 Enhanced command before work dir: {enhanced_command}")
                
                if task_work_dir:
                    work_dir_instruction = f"Please save all created files to the {task_work_dir} directory, with filenames prefixed with the agent type."
                    enhanced_command = f"{command} {work_dir_instruction}"
                    logger.info(f"🔔 Enhanced command after work dir: {enhanced_command}")
                
                task_command_parts = ['claude', f'"{enhanced_command}"']
                logger.info(f"🔔 Task command parts: {task_command_parts}")
                
                # 添加权限设置
                if skip_permissions:
                    task_command_parts.append('--dangerously-skip-permissions')
                
                # 添加verbose日志模式
                if verbose_logs:
                    task_command_parts.append('--verbose')
                    logger.info(f"Added --verbose parameter to command")
                
                # 添加资源目录
                if resources:
                    for resource in resources:
                        task_command_parts.extend(['--add-dir', resource])
                
                # 拼接完整命令
                full_task_command = ' '.join(task_command_parts)
                logger.info(f"🔔 Built final task command: {full_task_command}")
                logger.info(f"🔔 Final task_command_parts: {task_command_parts}")
                logger.info(f"🔔 Final command length: {len(full_task_command)} characters")
                
                # 通知前端创建任务页签，同时传递完整的初始命令
                await manager.broadcast({
                    'type': 'create-task-tab',
                    'taskId': task_id,
                    'taskName': task_name,
                    'initialCommand': full_task_command,  # 直接传递完整的任务命令
                    'workingDirectory': os.path.expanduser('~'),  # 传递工作目录
                    'scheduledExecution': message.get('scheduledExecution', False)
                })
                
                try:
                    # 验证命令不为空
                    if not command or not command.strip():
                        raise ValueError("任务命令不能为空")
                    
                    logger.info(f"Task sent to frontend for execution via create-task-tab message")
                    
                except ValueError as e:
                    logger.error(f"任务参数错误: {e}")
                    await manager.send_personal_message({
                        'type': 'task-error',
                        'taskId': task_id,
                        'error': f"任务参数错误: {str(e)}",
                        'category': 'validation'
                    }, websocket)
                except FileNotFoundError as e:
                    logger.error(f"Claude CLI不可用: {e}")
                    await manager.send_personal_message({
                        'type': 'task-error',
                        'taskId': task_id,
                        'error': "Claude CLI不可用，请检查安装",
                        'category': 'system'
                    }, websocket)
                except Exception as e:
                    logger.error(f"任务执行错误: {e}")
                    await manager.send_personal_message({
                        'type': 'task-error',
                        'taskId': task_id,
                        'error': f"任务执行失败: {str(e)}",
                        'category': 'execution'
                    }, websocket)
            elif message.get('type') == 'resume-task-session':
                # 处理任务会话恢复请求
                task_id = message.get('taskId')
                task_name = message.get('taskName', '未知任务')
                session_id = message.get('sessionId')
                work_directory = message.get('workDirectory', os.path.expanduser('~'))
                
                logger.info(f"Restore task session: {task_name} (ID: {task_id}, Session: {session_id})")
                logger.info(f"Restore session working directory: {work_directory}")
                
                if not session_id:
                    logger.error(f"任务 {task_id} 缺少session_id，无法恢复会话")
                    await manager.send_personal_message({
                        'type': 'task-error',
                        'taskId': task_id,
                        'error': "缺少会话ID，无法恢复任务",
                        'category': 'validation'
                    }, websocket)
                else:
                    # 通知前端创建恢复会话的页签
                    await manager.broadcast({
                        'type': 'create-task-tab',
                        'taskId': task_id,
                        'taskName': f"继续: {task_name}",
                        'resumeSession': True,  # 标记为恢复会话
                        'sessionId': session_id,
                        'workingDirectory': work_directory,
                        'scheduledExecution': False
                    })
                    
                    logger.info(f"Task session restore request sent to frontend: session_id={session_id}")
            elif message.get('type') == 'get-mcp-status':
                # 处理获取MCP工具状态请求
                project_path = message.get('projectPath')
                await handle_get_mcp_status(websocket, project_path)
            elif message.get('type') == 'new-mcp-manager-session':
                # 处理MCP管理员会话创建请求
                session_id = message.get('sessionId')
                session_name = message.get('sessionName', 'MCP工具搜索')
                command = message.get('command', '')
                skip_permissions = message.get('skipPermissions', True)
                project_path = message.get('projectPath', os.path.expanduser('~'))
                
                # 去重保护：检查是否已经在处理相同的会话
                if session_id in active_mcp_sessions:
                    logger.warning(f"Duplicate MCP session request ignored: {session_name} (ID: {session_id})")
                    continue
                
                # 标记会话为活跃状态
                active_mcp_sessions.add(session_id)
                logger.info(f"MCP admin session creation request: {session_name} (ID: {session_id})")
                logger.info(f"Target project path: {project_path}")
                logger.info(f"Active MCP sessions: {len(active_mcp_sessions)}")
                
                # Use @agent syntax to build command, reinforcing instructions to ensure agent works continuously until completion
                if project_path:
                    agent_command = f"@agent-mcp-manager This is an independent task for MCP addition that requires using the mcp-manager agent throughout the entire MCP addition process. The MCP addition target directory path is: {project_path}. Please fully execute the MCP tool recommendation, confirmation, and installation workflow until the user's requested MCP tool is successfully installed and verified through claude mcp list. User requirement: {command}"
                else:
                    agent_command = f"@agent-mcp-manager This is an independent task for MCP addition that requires using the mcp-manager agent throughout the entire MCP addition process. Please fully execute the MCP tool recommendation, confirmation, and installation workflow until the user's requested MCP tool is successfully installed and verified through claude mcp list. User requirement: {command}"
                logger.info(f"Built @agent command: {agent_command}")
                
                task_command_parts = ['claude', f'"{agent_command}"']
                
                # MCP管理员默认跳过权限检查
                if skip_permissions:
                    task_command_parts.append('--dangerously-skip-permissions')
                
                # 添加verbose日志模式
                verbose_logs = message.get('verboseLogs', True)  # MCP任务默认开启verbose
                if verbose_logs:
                    task_command_parts.append('--verbose')
                
                # 拼接完整命令
                full_command = ' '.join(task_command_parts)
                logger.info(f"Built MCP admin command: {full_command}")
                
                # 发送创建页签消息，使用与正常任务相同的机制
                await manager.broadcast({
                    'type': 'create-task-tab',
                    'taskId': session_id,
                    'taskName': session_name,
                    'initialCommand': full_command,
                    'workingDirectory': project_path,  # 使用指定的项目路径作为工作目录
                    'scheduledExecution': False,
                    'resumeSession': False,  # 添加会话恢复标识
                    'sessionId': None        # 添加会话ID字段
                })
                
                logger.info(f"MCP admin session creation request sent to frontend: {session_id}")
                
                # 延迟清理会话状态（给页签创建留时间）
                def cleanup_mcp_session():
                    try:
                        active_mcp_sessions.discard(session_id)
                        logger.info(f"Cleaned up MCP session: {session_id}, remaining: {len(active_mcp_sessions)}")
                    except Exception as e:
                        logger.error(f"Error cleaning up MCP session {session_id}: {e}")
                
                # 延迟1秒后清理，确保页签创建完成
                import threading
                cleanup_timer = threading.Timer(1.0, cleanup_mcp_session)
                cleanup_timer.start()
            elif message.get('type') == 'ping':
                await manager.send_personal_message({
                    'type': 'pong'
                }, websocket)
            else:
                logger.info(f"Received unknown message type: {message.get('type')}")
    
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
            
            # 处理心跳消息 - 在WebSocket层直接处理，确保始终能响应
            if message.get('type') == 'ping':
                await websocket.send_text(json.dumps({
                    'type': 'pong',
                    'timestamp': message.get('timestamp')
                }))
                continue
            
            # 处理终端消息
            if message.get('type') == 'init':
                project_path = message.get('projectPath', str(Path.cwd()))
                session_id = message.get('sessionId')
                has_session = message.get('hasSession', False)
                initial_command = message.get('initialCommand')  # 添加初始命令参数
                project_name = message.get('projectName')  # 添加项目名称参数
                task_id = message.get('taskId')  # 任务ID，用于session_id捕获
                cols = message.get('cols', 80)
                rows = message.get('rows', 24)
                
                logger.info(f"PTY Shell initialization request")
                logger.info(f"Project path: {project_path}")
                logger.info(f"Session info: {'restore session ' + str(session_id) if has_session else 'new session'}")
                logger.info(f"Initial command: {initial_command or 'claude'}")
                logger.info(f"Terminal size: {cols}x{rows}")
                
                # 检查项目路径是否存在
                if not Path(project_path).exists():
                    error_msg = f" 项目路径不存在: {project_path}\r\n"
                    await websocket.send_text(json.dumps({
                        'type': 'output',
                        'data': error_msg
                    }))
                    logger.error(f"项目路径不存在: {project_path}")
                    continue
                
                # 如果PTY已经在运行，先清理
                if hasattr(pty_handler, 'process') and pty_handler.process:
                    logger.info("Detected existing PTY process, cleaning first")
                    pty_handler.cleanup()
                
                # 启动PTY Shell，传递初始命令参数和task_id
                success = await pty_handler.start_shell(websocket, project_path, session_id, has_session, cols, rows, initial_command, task_id)
                # 如果启动成功，尺寸已在初始化时设置，无需额外调用resize
            
            elif message.get('type') == 'input':
                # 处理用户输入 - 发送到PTY
                input_data = message.get('data', '')
                await pty_handler.send_input(input_data)
            
            elif message.get('type') == 'resize':
                # 处理终端大小调整
                cols = message.get('cols', 80)
                rows = message.get('rows', 24)
                logger.info(f"Terminal resized: {cols}x{rows}")
                await pty_handler.resize_terminal(cols, rows)
                
    except WebSocketDisconnect:
        # 用户关闭页签是正常行为，使用debug级别日志
        logger.debug("Shell WebSocket客户端断开连接")
        manager.disconnect(websocket)
        pty_handler.cleanup()
    except Exception as e:
        logger.error(f" Shell WebSocket异常错误: {e}")
        logger.error(f" 错误类型: {type(e).__name__}")
        
        # 发送错误消息给客户端
        try:
            await websocket.send_text(json.dumps({
                'type': 'output',
                'data': f" Shell连接错误: {str(e)}\r\n"
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
    print("Starting Claude Co-Desk...")
    print(f"Project directory: {Path.cwd()}")
    
    # 检查环境
    env_status = EnvironmentChecker.check_environment()
    print(f"Environment check results:")
    print(f"   Claude CLI: {'' if env_status['claude_cli'] else ''}")
    print(f"   Projects directory: {'' if env_status['projects_dir'] else ''}")
    print(f"   Status: {'Ready' if env_status['ready'] else 'Needs configuration'}")
    
    # 配置Claude hooks for数字员工自动部署
    print(f"Configuring Claude hooks...")
    try:
        from setup_hooks import HookManager
        hook_manager = HookManager()
        
        # 检查hooks状态
        status = hook_manager.check_hook_status()
        print(f"   Hooks status: {'Configured' if status['configured'] else 'Needs configuration'}")
        
        # 如果未配置则自动配置
        if not status["configured"]:
            print(f"   Auto-configuring Claude hooks...")
            if hook_manager.setup_claude_hooks():
                print(f"    Claude hooks configuration successful")
            else:
                print(f"    Claude hooks configuration failed")
        else:
            print(f"    Digital agent auto-deployment ready")
            
    except Exception as e:
        print(f"    Error configuring Claude hooks: {e}")
        print(f"    Digital agent auto-deployment may not be available")
    
    print(f"Starting Claude Co-Desk service...")
    
    # 任务调度器现在通过lifespan事件自动管理
    print(f"Task scheduler will start automatically through application lifecycle...")
    
    try:
        server_config = Config.get_server_config()
        uvicorn.run(
            "app:app", 
            host=server_config['host'], 
            port=server_config['port'], 
            reload=False,
            log_level="info",
            # WebSocket长连接配置 - 设置极长超时时间实现静默连接
            timeout_keep_alive=86400*7,  # 7天保持连接
            ws_ping_interval=0,          # 禁用服务器端ping
            ws_ping_timeout=86400*7      # WebSocket ping超时7天
        )
    finally:
        # 任务调度器现在通过lifespan事件自动管理
        print(f"Task scheduler will stop automatically through application lifecycle...")