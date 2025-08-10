#!/usr/bin/env python3
"""
项目管理模块 - 移植自claudecodeui/server/projects.js
负责Claude CLI项目扫描、会话解析和项目配置管理
"""

import json
import asyncio
import logging
import shutil
import os
from pathlib import Path
from typing import Dict, List, Any, Optional, Set
from datetime import datetime, timezone
from collections import defaultdict, Counter
import aiofiles

logger = logging.getLogger(__name__)

class ProjectDirectoryCache:
    """项目目录缓存，避免重复解析JSONL文件"""
    
    def __init__(self):
        self._cache: Dict[str, str] = {}
        self._timestamp = datetime.now().timestamp()
    
    def get(self, project_name: str) -> Optional[str]:
        """获取缓存的项目目录"""
        return self._cache.get(project_name)
    
    def set(self, project_name: str, directory: str):
        """设置项目目录缓存"""
        self._cache[project_name] = directory
    
    def clear(self):
        """清除缓存"""
        self._cache.clear()
        self._timestamp = datetime.now().timestamp()

# 全局缓存实例
project_directory_cache = ProjectDirectoryCache()

class ProjectConfigManager:
    """项目配置管理器"""
    
    @staticmethod
    async def load_project_config() -> Dict[str, Any]:
        """加载项目配置文件"""
        config_path = Path.home() / '.claude' / 'project-config.json'
        
        try:
            async with aiofiles.open(config_path, 'r', encoding='utf-8') as f:
                content = await f.read()
                return json.loads(content)
        except (FileNotFoundError, json.JSONDecodeError):
            return {}
    
    @staticmethod
    async def save_project_config(config: Dict[str, Any]):
        """保存项目配置文件"""
        config_path = Path.home() / '.claude' / 'project-config.json'
        
        # 确保目录存在
        config_path.parent.mkdir(parents=True, exist_ok=True)
        
        async with aiofiles.open(config_path, 'w', encoding='utf-8') as f:
            await f.write(json.dumps(config, ensure_ascii=False, indent=2))
    
    @staticmethod
    async def generate_display_name(project_name: str, actual_project_dir: Optional[str] = None) -> str:
        """生成更好的显示名称"""
        # 使用实际项目目录或解码项目名称
        project_path = actual_project_dir or project_name.replace('-', '/')
        
        # 尝试读取package.json获取项目名称
        try:
            if actual_project_dir:
                package_json_path = Path(actual_project_dir) / 'package.json'
                if package_json_path.exists():
                    async with aiofiles.open(package_json_path, 'r', encoding='utf-8') as f:
                        package_data = json.loads(await f.read())
                        if package_data.get('name'):
                            return package_data['name']
        except Exception:
            # 回退到基于路径的命名
            pass
        
        # 如果是绝对路径，返回最后一个目录名
        if project_path.startswith('/'):
            parts = [p for p in project_path.split('/') if p]
            return parts[-1] if parts else project_path
        
        return project_path


class JsonlSessionParser:
    """JSONL会话文件解析器"""
    
    @staticmethod
    async def extract_project_directory(project_name: str) -> str:
        """从JSONL会话中提取实际项目目录路径，带缓存机制"""
        # 检查缓存
        cached_dir = project_directory_cache.get(project_name)
        if cached_dir:
            return cached_dir
        
        project_dir = Path.home() / '.claude' / 'projects' / project_name
        cwd_counts = Counter()
        latest_timestamp = 0
        latest_cwd = None
        extracted_path = None
        
        try:
            if not project_dir.exists():
                extracted_path = project_name.replace('-', '/')
            else:
                jsonl_files = list(project_dir.glob('*.jsonl'))
                
                if not jsonl_files:
                    extracted_path = project_name.replace('-', '/')
                else:
                    # 处理所有JSONL文件收集cwd值
                    for jsonl_file in jsonl_files:
                        try:
                            async with aiofiles.open(jsonl_file, 'r', encoding='utf-8') as f:
                                async for line in f:
                                    line = line.strip()
                                    if not line:
                                        continue
                                    
                                    try:
                                        entry = json.loads(line)
                                        
                                        if 'cwd' in entry and entry['cwd']:
                                            cwd = entry['cwd']
                                            cwd_counts[cwd] += 1
                                            
                                            # 跟踪最新的cwd
                                            if 'timestamp' in entry:
                                                timestamp = datetime.fromisoformat(
                                                    entry['timestamp'].replace('Z', '+00:00')
                                                ).timestamp()
                                                if timestamp > latest_timestamp:
                                                    latest_timestamp = timestamp
                                                    latest_cwd = cwd
                                    except json.JSONDecodeError:
                                        # 跳过格式错误的行
                                        continue
                        except Exception as e:
                            logger.warning(f"读取JSONL文件 {jsonl_file} 时出错: {e}")
                            continue
                    
                    # 确定最佳cwd
                    if not cwd_counts:
                        extracted_path = project_name.replace('-', '/')
                    elif len(cwd_counts) == 1:
                        extracted_path = list(cwd_counts.keys())[0]
                    else:
                        # 多个cwd值 - 优先使用最近的，如果使用频率合理
                        most_recent_count = cwd_counts.get(latest_cwd, 0) if latest_cwd else 0
                        max_count = max(cwd_counts.values())
                        
                        # 如果最近的cwd至少有最大计数的25%，使用它
                        if most_recent_count >= max_count * 0.25:
                            extracted_path = latest_cwd
                        else:
                            # 否则使用最频繁使用的cwd
                            extracted_path = cwd_counts.most_common(1)[0][0]
                        
                        # 回退保护
                        if not extracted_path:
                            extracted_path = latest_cwd or project_name.replace('-', '/')
            
            # 缓存结果
            project_directory_cache.set(project_name, extracted_path)
            return extracted_path
            
        except Exception as e:
            logger.error(f"提取项目目录 {project_name} 时出错: {e}")
            # 回退到解码项目名称
            extracted_path = project_name.replace('-', '/')
            project_directory_cache.set(project_name, extracted_path)
            return extracted_path
    
    @staticmethod
    async def parse_jsonl_sessions(file_path: Path) -> List[Dict[str, Any]]:
        """解析JSONL文件并提取会话信息 - 优先使用文件名作为主会话ID"""
        sessions = {}
        
        # 从文件名提取主会话ID（不带.jsonl扩展名）
        main_session_id = file_path.stem
        
        try:
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                line_count = 0
                # 用于收集主会话信息
                main_session_data = {
                    'id': main_session_id,
                    'summary': '新会话',
                    'messageCount': 0,
                    'lastActivity': datetime.now(timezone.utc),
                    'cwd': '',
                    'isPrimary': True  # 标记为主会话
                }
                
                # 用于收集子会话信息
                sub_sessions = {}
                
                async for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    
                    line_count += 1
                    try:
                        entry = json.loads(line)
                        
                        # 更新主会话信息
                        main_session_data['messageCount'] += 1
                        if 'cwd' in entry and entry['cwd']:
                            main_session_data['cwd'] = entry['cwd']
                        
                        # 更新主会话摘要和活动时间
                        if entry.get('type') == 'summary' and entry.get('summary'):
                            main_session_data['summary'] = entry['summary']
                        elif (entry.get('message', {}).get('role') == 'user' and 
                              entry.get('message', {}).get('content') and 
                              main_session_data['summary'] == '新会话'):
                            # 使用第一个用户消息作为摘要
                            content = entry['message']['content']
                            if isinstance(content, str) and len(content) > 0:
                                # 跳过以<command-name>开头的命令消息
                                if not content.startswith('<command-name>'):
                                    main_session_data['summary'] = content[:50] + '...' if len(content) > 50 else content
                        
                        # 更新最近活动时间
                        if 'timestamp' in entry:
                            try:
                                timestamp = datetime.fromisoformat(
                                    entry['timestamp'].replace('Z', '+00:00')
                                )
                                main_session_data['lastActivity'] = timestamp
                            except ValueError:
                                pass
                        
                        # 收集子会话信息（如果sessionId不同于文件名）
                        if 'sessionId' in entry:
                            session_id = entry['sessionId']
                            if session_id != main_session_id:
                                if session_id not in sub_sessions:
                                    sub_sessions[session_id] = {
                                        'id': session_id,
                                        'summary': '子会话',
                                        'messageCount': 0,
                                        'lastActivity': datetime.now(timezone.utc),
                                        'cwd': entry.get('cwd', ''),
                                        'isPrimary': False  # 标记为子会话
                                    }
                                
                                sub_session = sub_sessions[session_id]
                                sub_session['messageCount'] += 1
                                
                                # 更新子会话摘要
                                if entry.get('type') == 'summary' and entry.get('summary'):
                                    sub_session['summary'] = entry['summary']
                                elif (entry.get('message', {}).get('role') == 'user' and 
                                      entry.get('message', {}).get('content') and 
                                      sub_session['summary'] == '子会话'):
                                    content = entry['message']['content']
                                    if isinstance(content, str) and len(content) > 0:
                                        if not content.startswith('<command-name>'):
                                            sub_session['summary'] = content[:50] + '...' if len(content) > 50 else content
                                
                                # 更新子会话活动时间
                                if 'timestamp' in entry:
                                    try:
                                        sub_session['lastActivity'] = datetime.fromisoformat(
                                            entry['timestamp'].replace('Z', '+00:00')
                                        )
                                    except ValueError:
                                        pass
                                
                    except json.JSONDecodeError as e:
                        logger.warning(f"解析JSONL行 {line_count} 时出错: {e}")
                        continue
        except Exception as e:
            logger.error(f"读取JSONL文件 {file_path} 时出错: {e}")
        
        # 组合结果：主会话优先，然后是子会话
        all_sessions = [main_session_data]
        
        # 按活动时间排序子会话
        sorted_sub_sessions = sorted(
            sub_sessions.values(), 
            key=lambda s: s['lastActivity'], 
            reverse=True
        )
        all_sessions.extend(sorted_sub_sessions)
        
        logger.info(f"文件 {file_path.name}: 主会话1个, 子会话{len(sub_sessions)}个")
        return all_sessions


class ProjectManager:
    """项目管理器 - 移植自claudecodeui核心功能"""
    
    @staticmethod
    async def get_projects() -> List[Dict[str, Any]]:
        """获取所有Claude项目"""
        claude_dir = Path.home() / '.claude' / 'projects'
        config = await ProjectConfigManager.load_project_config()
        projects = []
        existing_projects = set()
        
        try:
            if not claude_dir.exists():
                return projects
            
            # 首先获取文件系统中存在的项目
            for entry in claude_dir.iterdir():
                if entry.is_dir() and not entry.name.startswith('.'):
                    existing_projects.add(entry.name)
                    project_path = entry
                    
                    # 提取实际项目目录
                    actual_project_dir = await JsonlSessionParser.extract_project_directory(entry.name)
                    
                    # 获取显示名称
                    custom_name = config.get(entry.name, {}).get('displayName')
                    auto_display_name = await ProjectConfigManager.generate_display_name(
                        entry.name, actual_project_dir
                    )
                    
                    project = {
                        'name': entry.name,
                        'path': actual_project_dir,
                        'displayName': custom_name or auto_display_name,
                        'fullPath': actual_project_dir,
                        'isCustomName': bool(custom_name),
                        'sessions': []
                    }
                    
                    # 尝试获取会话（仅前5个用于性能优化）
                    try:
                        session_result = await ProjectManager.get_sessions(entry.name, limit=5, offset=0)
                        # 序列化会话数据中的datetime对象
                        serialized_sessions = serialize_datetime_objects(session_result.get('sessions', []))
                        project['sessions'] = serialized_sessions
                        project['sessionMeta'] = {
                            'hasMore': session_result.get('hasMore', False),
                            'total': session_result.get('total', 0)
                        }
                    except Exception as e:
                        logger.warning(f"无法加载项目 {entry.name} 的会话: {e}")
                    
                    projects.append(project)
            
            # 添加手动配置但尚未存在文件夹的项目
            for project_name, project_config in config.items():
                if project_name not in existing_projects and project_config.get('manuallyAdded'):
                    actual_project_dir = project_config.get('originalPath')
                    
                    if not actual_project_dir:
                        try:
                            actual_project_dir = await JsonlSessionParser.extract_project_directory(project_name)
                        except Exception:
                            actual_project_dir = project_name.replace('-', '/')
                    
                    project = {
                        'name': project_name,
                        'path': actual_project_dir,
                        'displayName': project_config.get('displayName') or 
                                     await ProjectConfigManager.generate_display_name(project_name, actual_project_dir),
                        'fullPath': actual_project_dir,
                        'isCustomName': bool(project_config.get('displayName')),
                        'isManuallyAdded': True,
                        'sessions': []
                    }
                    
                    projects.append(project)
            
            return projects
            
        except Exception as e:
            logger.error(f"获取项目时出错: {e}")
            return projects
    
    @staticmethod
    async def get_sessions(project_name: str, limit: int = 5, offset: int = 0) -> Dict[str, Any]:
        """获取项目的会话列表，支持分页 - 恢复到原来的JSONL解析方式"""
        project_dir = Path.home() / '.claude' / 'projects' / project_name
        
        try:
            if not project_dir.exists():
                return {'sessions': [], 'hasMore': False, 'total': 0}
            
            jsonl_files = list(project_dir.glob('*.jsonl'))
            
            if not jsonl_files:
                return {'sessions': [], 'hasMore': False, 'total': 0}
            
            # 按修改时间排序文件（最新优先）
            jsonl_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
            
            all_sessions = {}
            processed_count = 0
            
            # 按修改时间顺序处理文件
            for jsonl_file in jsonl_files:
                sessions = await JsonlSessionParser.parse_jsonl_sessions(jsonl_file)
                
                # 合并会话，避免重复
                for session in sessions:
                    if session['id'] not in all_sessions:
                        all_sessions[session['id']] = session
                
                processed_count += 1
                
                # 早期退出优化：如果有足够会话且处理了最近的文件
                if len(all_sessions) >= (limit + offset) * 2 and processed_count >= min(3, len(jsonl_files)):
                    break
            
            # 转换为数组并按最近活动排序
            sorted_sessions = sorted(
                all_sessions.values(), 
                key=lambda s: s['lastActivity'], 
                reverse=True
            )
            
            total = len(sorted_sessions)
            paginated_sessions = sorted_sessions[offset:offset + limit]
            has_more = offset + limit < total
            
            # 序列化会话中的datetime对象
            serialized_sessions = serialize_datetime_objects(paginated_sessions)
            
            return {
                'sessions': serialized_sessions,
                'hasMore': has_more,
                'total': total,
                'offset': offset,
                'limit': limit
            }
            
        except Exception as e:
            logger.error(f"获取项目 {project_name} 会话时出错: {e}")
            return {'sessions': [], 'hasMore': False, 'total': 0}
    
    @staticmethod
    async def get_session_messages(project_name: str, session_id: str) -> List[Dict[str, Any]]:
        """获取特定会话的所有消息"""
        project_dir = Path.home() / '.claude' / 'projects' / project_name
        messages = []
        
        try:
            if not project_dir.exists():
                return messages
            
            jsonl_files = list(project_dir.glob('*.jsonl'))
            
            # 处理所有JSONL文件寻找该会话的消息
            for jsonl_file in jsonl_files:
                try:
                    async with aiofiles.open(jsonl_file, 'r', encoding='utf-8') as f:
                        async for line in f:
                            line = line.strip()
                            if not line:
                                continue
                            
                            try:
                                entry = json.loads(line)
                                if entry.get('sessionId') == session_id:
                                    messages.append(entry)
                            except json.JSONDecodeError:
                                continue
                except Exception as e:
                    logger.warning(f"读取JSONL文件 {jsonl_file} 时出错: {e}")
                    continue
            
            # 按时间戳排序消息
            messages.sort(key=lambda m: m.get('timestamp', ''), reverse=False)
            
            # 序列化消息中的datetime对象
            return serialize_datetime_objects(messages)
            
        except Exception as e:
            logger.error(f"获取会话 {session_id} 消息时出错: {e}")
            return serialize_datetime_objects(messages)
    
    @staticmethod
    async def rename_project(project_name: str, new_display_name: str) -> bool:
        """重命名项目显示名称"""
        try:
            config = await ProjectConfigManager.load_project_config()
            
            if not new_display_name or new_display_name.strip() == '':
                # 删除自定义名称，回退到自动生成
                if project_name in config:
                    config[project_name].pop('displayName', None)
                    # 如果配置项为空，完全删除
                    if not config[project_name]:
                        del config[project_name]
            else:
                # 设置自定义显示名称
                if project_name not in config:
                    config[project_name] = {}
                config[project_name]['displayName'] = new_display_name.strip()
            
            await ProjectConfigManager.save_project_config(config)
            return True
            
        except Exception as e:
            logger.error(f"重命名项目 {project_name} 时出错: {e}")
            return False
    
    @staticmethod
    async def delete_session(project_name: str, session_id: str) -> bool:
        """删除会话"""
        project_dir = Path.home() / '.claude' / 'projects' / project_name
        
        try:
            if not project_dir.exists():
                raise FileNotFoundError(f"项目目录不存在: {project_dir}")
            
            jsonl_files = list(project_dir.glob('*.jsonl'))
            
            if not jsonl_files:
                raise FileNotFoundError("项目中没有会话文件")
            
            # 检查所有JSONL文件找到包含该会话的文件
            for jsonl_file in jsonl_files:
                lines = []
                session_found = False
                
                async with aiofiles.open(jsonl_file, 'r', encoding='utf-8') as f:
                    async for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        
                        try:
                            data = json.loads(line)
                            if data.get('sessionId') == session_id:
                                session_found = True
                                # 跳过该会话的行
                                continue
                        except json.JSONDecodeError:
                            # 保留格式错误的行
                            pass
                        
                        lines.append(line)
                
                if session_found:
                    # 写回过滤后的内容
                    content = '\n'.join(lines)
                    if content and not content.endswith('\n'):
                        content += '\n'
                    
                    async with aiofiles.open(jsonl_file, 'w', encoding='utf-8') as f:
                        await f.write(content)
                    
                    return True
            
            raise FileNotFoundError(f"在任何文件中都找不到会话 {session_id}")
            
        except Exception as e:
            logger.error(f"删除会话 {session_id} 时出错: {e}")
            return False
    
    @staticmethod
    async def is_project_empty(project_name: str) -> bool:
        """检查项目是否为空（无会话）"""
        try:
            sessions_result = await ProjectManager.get_sessions(project_name, limit=1, offset=0)
            return sessions_result['total'] == 0
        except Exception as e:
            logger.error(f"检查项目 {project_name} 是否为空时出错: {e}")
            return False
    
    @staticmethod
    async def delete_project(project_name: str) -> bool:
        """删除空项目"""
        project_dir = Path.home() / '.claude' / 'projects' / project_name
        
        try:
            # 首先检查项目是否为空
            is_empty = await ProjectManager.is_project_empty(project_name)
            if not is_empty:
                raise ValueError("不能删除包含会话的项目")
            
            # 删除项目目录
            import shutil
            if project_dir.exists():
                shutil.rmtree(project_dir)
            
            # 从项目配置中删除
            config = await ProjectConfigManager.load_project_config()
            if project_name in config:
                del config[project_name]
                await ProjectConfigManager.save_project_config(config)
            
            return True
            
        except Exception as e:
            logger.error(f"删除项目 {project_name} 时出错: {e}")
            return False
    
    @staticmethod
    async def add_project_manually(project_path: str, display_name: Optional[str] = None) -> Dict[str, Any]:
        """手动添加项目到配置"""
        try:
            # 解析为绝对路径
            absolute_path = Path(project_path).resolve()
            
            # 检查路径是否存在
            if not absolute_path.exists():
                raise FileNotFoundError(f"路径不存在: {absolute_path}")
            
            # 生成项目名称（编码路径用作目录名）
            project_name = str(absolute_path).replace('/', '-')
            
            # 检查项目是否已存在
            config = await ProjectConfigManager.load_project_config()
            project_dir = Path.home() / '.claude' / 'projects' / project_name
            
            if project_dir.exists():
                raise ValueError(f"项目已存在: {absolute_path}")
            
            if project_name in config:
                raise ValueError(f"项目已配置: {absolute_path}")
            
            # 添加到配置作为手动添加的项目
            config[project_name] = {
                'manuallyAdded': True,
                'originalPath': str(absolute_path)
            }
            
            if display_name:
                config[project_name]['displayName'] = display_name
            
            await ProjectConfigManager.save_project_config(config)
            
            return {
                'name': project_name,
                'path': str(absolute_path),
                'fullPath': str(absolute_path),
                'displayName': display_name or await ProjectConfigManager.generate_display_name(
                    project_name, str(absolute_path)
                ),
                'isManuallyAdded': True,
                'sessions': []
            }
            
        except Exception as e:
            logger.error(f"手动添加项目 {project_path} 时出错: {e}")
            raise

def clear_project_directory_cache():
    """清除项目目录缓存"""
    project_directory_cache.clear()

class SystemProjectManager:
    """系统项目管理器 - 管理系统根目录的Claude项目初始化"""
    
    @staticmethod
    def check_system_project_status() -> Dict[str, Any]:
        """检测系统根目录项目状态"""
        root_dir = Path.home()  # 用户主目录（真正的系统根目录）
        claude_md_path = root_dir / 'CLAUDE.md'
        claude_dir = root_dir / '.claude'
        agents_dir = claude_dir / 'agents'
        
        status = {
            'root_directory': str(root_dir),
            'has_claude_md': claude_md_path.exists(),
            'has_claude_dir': claude_dir.exists(),
            'has_agents_dir': agents_dir.exists(),
            'claude_md_path': str(claude_md_path),
            'agents_dir_path': str(agents_dir),
            'needs_initialization': False
        }
        
        # 判断是否需要初始化
        status['needs_initialization'] = not (
            status['has_claude_md'] and 
            status['has_claude_dir'] and 
            status['has_agents_dir']
        )
        
        # 检查默认智能体是否已部署
        if status['has_agents_dir']:
            default_agents = [
                'document-manager.md',
                'work-assistant.md', 
                'finance-assistant.md',
                'info-collector.md',
                'fullstack-engineer.md'
            ]
            
            deployed_agents = []
            for agent_file in default_agents:
                agent_path = agents_dir / agent_file
                deployed_agents.append({
                    'name': agent_file,
                    'deployed': agent_path.exists(),
                    'path': str(agent_path)
                })
            
            status['default_agents'] = deployed_agents
            status['all_agents_deployed'] = all(agent['deployed'] for agent in deployed_agents)
        else:
            status['default_agents'] = []
            status['all_agents_deployed'] = False
        
        return status
    
    @staticmethod
    async def initialize_system_project():
        """初始化系统根目录项目"""
        from claude_cli import ClaudeCLIIntegration
        
        try:
            status = SystemProjectManager.check_system_project_status()
            
            if not status['needs_initialization']:
                logger.info("系统项目已经初始化完成")
                return {'success': True, 'message': '系统项目已经初始化'}
            
            logger.info(f"开始初始化系统项目: {status['root_directory']}")
            
            # 使用Claude Code在用户主目录下初始化项目
            logger.info("🏗️ 使用Claude Code初始化用户主目录...")
            
            # 创建Claude CLI实例
            claude_cli = ClaudeCLIIntegration()
            
            # 创建异步mock websocket
            class MockWebSocket:
                async def send_text(self, msg):
                    logger.info(f"初始化输出: {msg}")
            
            mock_websocket = MockWebSocket()
            
            # 在用户主目录下运行Claude /init命令
            system_root = Path.home()
            await claude_cli.spawn_claude(
                command="/init --yes",
                options={
                    'projectPath': str(system_root),
                    'cwd': str(system_root)
                },
                websocket=mock_websocket
            )
            
            # 等待Claude初始化完成(增加超时时间到60秒)
            if await SystemProjectManager._verify_claude_initialization(timeout=60):
                # 部署默认智能体
                logger.info("🧑‍💼 开始部署默认智能体...")
                deploy_result = await SystemProjectManager.deploy_default_agents()
                
                if deploy_result['success']:
                    logger.info("✅ 系统项目初始化完成")
                    return {
                        'success': True, 
                        'message': '系统项目初始化完成',
                        'agents_deployed': deploy_result['deployed_count']
                    }
                else:
                    logger.error("❌ 智能体部署失败")
                    return {
                        'success': False,
                        'message': f'智能体部署失败: {deploy_result.get("message", "未知错误")}'
                    }
            else:
                logger.error("❌ Claude项目初始化失败")
                return {
                    'success': False,
                    'message': 'Claude项目初始化超时，请确保Claude CLI正常工作'
                }
                
        except Exception as e:
            logger.error(f"系统项目初始化出错: {e}")
            return {
                'success': False, 
                'message': f'初始化出错: {str(e)}'
            }
    
    @staticmethod
    async def _verify_claude_initialization(timeout: int = 30) -> bool:
        """验证Claude初始化是否成功"""
        root_dir = Path.home()
        claude_md_path = root_dir / 'CLAUDE.md'
        
        # 等待CLAUDE.md文件生成
        for attempt in range(timeout):
            if claude_md_path.exists():
                logger.info(f"CLAUDE.md文件已生成: {claude_md_path}")
                return True
            await asyncio.sleep(1)
        
        logger.error(f"等待{timeout}秒后CLAUDE.md文件仍未生成")
        return False
    
    @staticmethod
    async def deploy_default_agents() -> Dict[str, Any]:
        """部署默认智能体到系统项目"""
        try:
            root_dir = Path.home()
            agents_dir = root_dir / '.claude' / 'agents'
            
            # 确保agents目录存在
            agents_dir.mkdir(parents=True, exist_ok=True)
            
            # 默认智能体配置文件
            current_file_dir = Path(__file__).parent
            source_agents_dir = current_file_dir / 'agents'
            
            default_agents = [
                'document-manager.md',
                'work-assistant.md', 
                'finance-assistant.md',
                'info-collector.md',
                'fullstack-engineer.md'
            ]
            
            deployed_count = 0
            failed_agents = []
            
            for agent_file in default_agents:
                try:
                    source_path = source_agents_dir / agent_file
                    target_path = agents_dir / agent_file
                    
                    if source_path.exists():
                        # 复制智能体配置文件
                        shutil.copy2(source_path, target_path)
                        deployed_count += 1
                        logger.info(f"已部署智能体: {agent_file}")
                    else:
                        logger.warning(f"源文件不存在: {source_path}")
                        failed_agents.append(f"{agent_file} (源文件不存在)")
                        
                except Exception as e:
                    logger.error(f"部署智能体 {agent_file} 时出错: {e}")
                    failed_agents.append(f"{agent_file} ({str(e)})")
            
            if deployed_count > 0:
                return {
                    'success': True,
                    'deployed_count': deployed_count,
                    'total_count': len(default_agents),
                    'failed_agents': failed_agents,
                    'message': f'成功部署 {deployed_count}/{len(default_agents)} 个智能体'
                }
            else:
                return {
                    'success': False,
                    'deployed_count': 0,
                    'total_count': len(default_agents),
                    'failed_agents': failed_agents,
                    'message': '没有成功部署任何智能体'
                }
                
        except Exception as e:
            logger.error(f"部署默认智能体时出错: {e}")
            return {
                'success': False,
                'message': f'部署出错: {str(e)}'
            }
    
    @staticmethod
    async def get_system_agents_status() -> Dict[str, Any]:
        """获取系统智能体状态"""
        try:
            status = SystemProjectManager.check_system_project_status()
            
            agents_status = []
            if 'default_agents' in status:
                for agent in status['default_agents']:
                    agent_info = {
                        'name': agent['name'].replace('.md', ''),
                        'file_name': agent['name'],
                        'deployed': agent['deployed'],
                        'path': agent['path'],
                        'status': 'deployed' if agent['deployed'] else 'missing'
                    }
                    
                    # 如果文件存在，读取配置信息
                    if agent['deployed']:
                        try:
                            agent_path = Path(agent['path'])
                            async with aiofiles.open(agent_path, 'r', encoding='utf-8') as f:
                                content = await f.read()
                                
                            # 解析YAML前置内容
                            if content.startswith('---'):
                                yaml_end = content.find('---', 3)
                                if yaml_end != -1:
                                    yaml_content = content[3:yaml_end].strip()
                                    # 简单解析关键字段
                                    for line in yaml_content.split('\n'):
                                        if ':' in line:
                                            key, value = line.split(':', 1)
                                            key = key.strip()
                                            value = value.strip()
                                            if key == 'description':
                                                agent_info['description'] = value
                                            elif key == 'tools':
                                                agent_info['tools'] = value
                        except Exception as e:
                            logger.warning(f"读取智能体配置 {agent['name']} 时出错: {e}")
                    
                    agents_status.append(agent_info)
            
            return {
                'system_project_ready': not status['needs_initialization'],
                'agents_deployed': status.get('all_agents_deployed', False),
                'agents': agents_status,
                'root_directory': status['root_directory']
            }
            
        except Exception as e:
            logger.error(f"获取系统智能体状态时出错: {e}")
            return {
                'system_project_ready': False,
                'agents_deployed': False,
                'agents': [],
                'error': str(e)
            }


def serialize_datetime_objects(obj):
    """递归序列化对象中的datetime对象为ISO格式字符串"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {key: serialize_datetime_objects(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [serialize_datetime_objects(item) for item in obj]
    else:
        return obj