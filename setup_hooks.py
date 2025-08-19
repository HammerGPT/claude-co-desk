#!/usr/bin/env python3
"""
Claude Code Hooks自动配置脚本
在系统启动时自动设置hook监听初始化完成事件
"""

import json
import os
import logging
from pathlib import Path
from typing import Dict, Any

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class HookManager:
    """Claude Code Hook配置管理器"""
    
    def __init__(self):
        self.settings_path = Path.home() / ".claude" / "settings.json"
        self.deploy_script_path = Path(__file__).parent / "deploy_agents.py"
        
    def setup_claude_hooks(self) -> bool:
        """
        配置Claude hooks监听初始化完成事件（已废弃，使用临时hook）
        """
        logger.warning("setup_claude_hooks已废弃，请使用setup_temporary_hook")
        return False
    
    def setup_temporary_hook(self, session_identifier: str = None) -> bool:
        """
        设置临时的hook配置，只在特定会话中生效
        """
        logger.info("开始配置临时Claude Code hooks...")
        
        try:
            # 1. 确保部署脚本存在且可执行
            if not self.deploy_script_path.exists():
                logger.error(f"部署脚本不存在: {self.deploy_script_path}")
                return False
            
            # 2. 读取现有配置
            settings = self._load_existing_settings()
            
            # 3. 添加临时hook配置
            self._add_temporary_deployment_hook(settings, session_identifier)
            
            # 4. 保存配置
            success = self._save_settings(settings)
            
            if success:
                logger.info(" 临时Claude Code hooks配置成功")
                logger.info(f"监听脚本: {self.deploy_script_path}")
                logger.info(f"会话标识: {session_identifier or 'any'}")
                return True
            else:
                logger.error(" 临时Claude Code hooks配置失败")
                return False
                
        except Exception as e:
            logger.error(f"配置临时Claude hooks时出现错误: {e}")
            return False
    
    def _load_existing_settings(self) -> Dict[str, Any]:
        """
        读取现有的Claude settings配置
        """
        settings = {}
        
        if self.settings_path.exists():
            try:
                with open(self.settings_path, 'r', encoding='utf-8') as f:
                    settings = json.load(f)
                logger.info(f"读取现有配置文件: {self.settings_path}")
            except Exception as e:
                logger.warning(f"读取现有配置失败，将创建新配置: {e}")
                settings = {}
        else:
            logger.info("配置文件不存在，将创建新配置")
        
        return settings
    
    def _add_deployment_hook(self, settings: Dict[str, Any]) -> None:
        """
        添加数字员工部署hook配置（已废弃）
        """
        logger.warning("_add_deployment_hook已废弃，请使用_add_temporary_deployment_hook")
    
    def _add_temporary_deployment_hook(self, settings: Dict[str, Any], session_identifier: str = None) -> None:
        """
        添加临时的数字员工部署hook配置
        """
        # 确保hooks结构存在
        if "hooks" not in settings:
            settings["hooks"] = {}
        
        # 构建增强的hook命令 - 传递会话标识和更多上下文
        session_arg = f' "{session_identifier}"' if session_identifier else ' ""'
        hook_command = f'python "{self.deploy_script_path}" "$CLAUDE_TRANSCRIPT_PATH" "$CLAUDE_CWD"{session_arg}'
        
        # 使用PostToolUse事件监听Write/Edit操作，更精准
        post_tool_hook = {
            "matcher": "Write",  # 只监听Write工具，初始化时会写入CLAUDE.md
            "hooks": [
                {
                    "type": "command",
                    "command": hook_command,
                    "timeout": 30  # 30秒超时
                }
            ]
        }
        
        # 清理旧的临时hooks
        self._cleanup_temporary_hooks(settings)
        
        # 添加PostToolUse hook配置
        if "PostToolUse" not in settings["hooks"]:
            settings["hooks"]["PostToolUse"] = []
        
        settings["hooks"]["PostToolUse"].append(post_tool_hook)
        logger.info("已添加临时数字员工部署hook到PostToolUse事件（Write工具）")
    
    def _cleanup_temporary_hooks(self, settings: Dict[str, Any]) -> None:
        """
        清理所有临时的数字员工部署hooks
        """
        events_to_clean = ["PostToolUse", "Stop"]
        
        for event in events_to_clean:
            if event in settings.get("hooks", {}):
                # 移除包含部署脚本路径的hooks
                settings["hooks"][event] = [
                    hook_config for hook_config in settings["hooks"][event]
                    if not any(
                        str(self.deploy_script_path) in hook.get("command", "")
                        for hook in hook_config.get("hooks", [])
                    )
                ]
                
                # 如果事件数组为空，移除整个事件配置
                if not settings["hooks"][event]:
                    del settings["hooks"][event]
    
    def _save_settings(self, settings: Dict[str, Any]) -> bool:
        """
        保存Claude settings配置
        """
        try:
            # 确保配置目录存在
            self.settings_path.parent.mkdir(parents=True, exist_ok=True)
            
            # 保存配置文件
            with open(self.settings_path, 'w', encoding='utf-8') as f:
                json.dump(settings, f, indent=2, ensure_ascii=False)
            
            logger.info(f"配置已保存到: {self.settings_path}")
            return True
            
        except Exception as e:
            logger.error(f"保存配置文件失败: {e}")
            return False
    
    def remove_hooks(self) -> bool:
        """
        移除数字员工部署hooks（用于清理）
        """
        logger.info("开始移除数字员工部署hooks...")
        
        try:
            if not self.settings_path.exists():
                logger.info("配置文件不存在，无需移除")
                return True
            
            # 读取现有配置
            settings = self._load_existing_settings()
            
            # 清理所有相关hooks
            removed_count = 0
            events_to_clean = ["PostToolUse", "Stop"]
            
            for event in events_to_clean:
                if "hooks" in settings and event in settings["hooks"]:
                    original_count = len(settings["hooks"][event])
                    
                    # 过滤掉包含部署脚本路径的hooks
                    settings["hooks"][event] = [
                        hook_config for hook_config in settings["hooks"][event]
                        if not any(
                            str(self.deploy_script_path) in hook.get("command", "")
                            for hook in hook_config.get("hooks", [])
                        )
                    ]
                    
                    event_removed = original_count - len(settings["hooks"][event])
                    removed_count += event_removed
                    
                    # 如果事件数组为空，移除整个事件配置
                    if not settings["hooks"][event]:
                        del settings["hooks"][event]
                    
                    if event_removed > 0:
                        logger.info(f"从{event}事件中移除了{event_removed}个hooks")
            
            if removed_count > 0:
                # 保存更新后的配置
                self._save_settings(settings)
                logger.info(f" 总共移除了 {removed_count} 个数字员工部署hooks")
            else:
                logger.info("未找到需要移除的hooks")
            
            return True
            
        except Exception as e:
            logger.error(f"移除hooks时出现错误: {e}")
            return False
    
    def remove_temporary_hooks(self) -> bool:
        """
        移除临时的数字员工部署hooks
        """
        return self.remove_hooks()  # 复用现有逻辑
    
    def check_hook_status(self) -> Dict[str, Any]:
        """
        检查hooks配置状态
        """
        status = {
            "configured": False,
            "settings_file_exists": False,
            "deploy_script_exists": False,
            "hook_count": 0
        }
        
        try:
            # 检查配置文件
            status["settings_file_exists"] = self.settings_path.exists()
            
            # 检查部署脚本
            status["deploy_script_exists"] = self.deploy_script_path.exists()
            
            if status["settings_file_exists"]:
                settings = self._load_existing_settings()
                
                # 检查Stop hooks
                if "hooks" in settings and "Stop" in settings["hooks"]:
                    stop_hooks = settings["hooks"]["Stop"]
                    
                    # 计算相关的hooks数量
                    for hook_config in stop_hooks:
                        for hook in hook_config.get("hooks", []):
                            if str(self.deploy_script_path) in hook.get("command", ""):
                                status["hook_count"] += 1
                
                status["configured"] = status["hook_count"] > 0
            
            return status
            
        except Exception as e:
            logger.error(f"检查hooks状态时出现错误: {e}")
            return status

def main():
    """
    主入口函数
    """
    hook_manager = HookManager()
    
    # 检查当前状态
    status = hook_manager.check_hook_status()
    logger.info(f"当前hooks状态: {status}")
    
    if status["configured"]:
        logger.info("Hooks已配置，如需重新配置请先运行移除命令")
        return 0
    
    # 配置hooks
    success = hook_manager.setup_claude_hooks()
    return 0 if success else 1

if __name__ == "__main__":
    import sys
    
    # 支持命令行参数
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        hook_manager = HookManager()
        
        if command == "remove":
            success = hook_manager.remove_hooks()
            sys.exit(0 if success else 1)
        elif command == "status":
            status = hook_manager.check_hook_status()
            print(json.dumps(status, indent=2))
            sys.exit(0)
        elif command == "setup":
            success = hook_manager.setup_claude_hooks()
            sys.exit(0 if success else 1)
        else:
            print("用法: python setup_hooks.py [setup|remove|status]")
            sys.exit(1)
    else:
        # 默认执行配置
        exit_code = main()
        sys.exit(exit_code)