#!/usr/bin/env python3
"""
数字员工自动部署脚本
通过Claude Code hooks触发，在初始化完成后自动部署数字员工团队
"""

import json
import sys
import shutil
import os
import requests
import hashlib
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Optional

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/tmp/heliki_deploy_agents.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class AgentDeployer:
    """数字员工部署器"""
    
    def __init__(self):
        self.project_dir = Path(__file__).parent
        self.source_dir = self.project_dir / "static" / "agents"
        self.target_dir = Path.home() / ".claude" / "agents"
        self.deployed_marker = self.target_dir / ".heliki_agents_deployed"
        # 从环境变量获取Heliki OS API地址，默认为localhost:3005
        heliki_host = os.getenv('HELIKI_HOST', 'localhost')
        heliki_port = os.getenv('HELIKI_PORT', '3005')
        self.heliki_api_url = f"http://{heliki_host}:{heliki_port}/api/agents-deployed"
        
        # 预期的数字员工文件列表
        self.expected_agents = [
            "document-manager.md",
            "work-assistant.md", 
            "finance-assistant.md",
            "info-collector.md",
            "fullstack-engineer.md"
        ]
    
    def should_deploy_agents(self, transcript_path: str, project_path: str = None, session_identifier: str = None) -> bool:
        """
        简化判断逻辑：检查用户主目录CLAUDE.md是否存在
        """
        logger.info(f"检查是否需要部署数字员工，session: {session_identifier}")
        
        try:
            # 1. 检查是否已经部署过（防重复）
            if self.deployed_marker.exists():
                logger.info("检测到已部署标记文件，跳过重复部署")
                return False
            
            # 2. 检查用户主目录的CLAUDE.md文件是否存在
            home_claude_md = Path.home() / "CLAUDE.md"
            
            if not home_claude_md.exists():
                logger.info("用户主目录CLAUDE.md文件不存在，初始化尚未完成")
                return False
            
            # 3. 检查文件是否不为空（确保已写入内容）
            try:
                if home_claude_md.stat().st_size == 0:
                    logger.info("用户主目录CLAUDE.md文件为空，初始化尚未完成")
                    return False
            except OSError as e:
                logger.warning(f"无法检查CLAUDE.md文件大小: {e}")
                return False
            
            # 4. 检查会话标识是否为初始化会话
            if session_identifier and not session_identifier.startswith('init-'):
                logger.info(f"非初始化会话，跳过部署: {session_identifier}")
                return False
            
            logger.info(" 检测到主目录CLAUDE.md文件已生成，准备部署数字员工")
            return True
            
        except Exception as e:
            logger.error(f"检查部署条件时出错: {e}")
            return False
    
    def deploy_agents(self) -> bool:
        """
        执行数字员工文件部署
        """
        logger.info("开始部署数字员工...")
        
        try:
            # 1. 检查源文件目录
            if not self.source_dir.exists():
                logger.error(f"源文件目录不存在: {self.source_dir}")
                return False
            
            # 2. 创建目标目录
            self.target_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f"确保目标目录存在: {self.target_dir}")
            
            # 3. 检查所有预期的agent文件是否存在
            missing_files = []
            for agent_file in self.expected_agents:
                source_file = self.source_dir / agent_file
                if not source_file.exists():
                    missing_files.append(agent_file)
            
            if missing_files:
                logger.error(f"缺少必要的agent文件: {missing_files}")
                return False
            
            # 4. 复制所有agent文件
            deployed_files = []
            failed_files = []
            
            for agent_file in self.expected_agents:
                source_file = self.source_dir / agent_file
                target_file = self.target_dir / agent_file
                
                try:
                    # 复制文件并保持元数据
                    shutil.copy2(source_file, target_file)
                    
                    # 验证复制成功
                    if target_file.exists():
                        deployed_files.append(agent_file)
                        logger.info(f" 成功部署: {agent_file}")
                    else:
                        failed_files.append(agent_file)
                        logger.error(f" 部署失败: {agent_file}")
                        
                except Exception as e:
                    failed_files.append(agent_file)
                    logger.error(f" 复制文件失败 {agent_file}: {e}")
            
            # 5. 检查部署结果
            if failed_files:
                logger.error(f"部分文件部署失败: {failed_files}")
                return False
            
            # 6. 创建部署标记文件
            deployment_info = {
                "deployed_at": datetime.now().isoformat(),
                "deployed_files": deployed_files,
                "source_directory": str(self.source_dir),
                "target_directory": str(self.target_dir),
                "agent_count": len(deployed_files)
            }
            
            with open(self.deployed_marker, 'w', encoding='utf-8') as f:
                json.dump(deployment_info, f, indent=2, ensure_ascii=False)
            
            logger.info(f" 数字员工部署完成！共部署 {len(deployed_files)} 个员工")
            return True
            
        except Exception as e:
            logger.error(f"部署过程中出现错误: {e}")
            return False
    
    def notify_heliki_completion(self) -> bool:
        """
        通知Heliki OS部署完成
        """
        logger.info("通知Heliki OS数字员工部署完成...")
        
        try:
            # 准备通知数据
            notification_data = {
                "status": "success",
                "message": "数字员工团队部署完成",
                "deployed_agents": self.expected_agents,
                "timestamp": datetime.now().isoformat(),
                "refresh_required": True,  # 指示前端需要刷新
                "agent_count": len(self.expected_agents)
            }
            
            # 发送POST请求通知
            response = requests.post(
                self.heliki_api_url,
                json=notification_data,
                timeout=10
            )
            
            if response.status_code == 200:
                logger.info(" 成功通知Heliki OS部署完成")
                return True
            else:
                logger.warning(f"Heliki OS通知响应异常: {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            logger.warning(f"无法连接到Heliki OS API: {e}")
            # 通知失败不影响部署成功
            return True
        except Exception as e:
            logger.error(f"通知Heliki OS时出现错误: {e}")
            return True
    
    def cleanup_hooks(self) -> bool:
        """
        清理临时hooks配置
        """
        logger.info("开始清理临时hooks配置...")
        
        try:
            # 发送清理请求到Heliki OS API
            cleanup_data = {
                "cleanup_reason": "deployment_completed",
                "timestamp": datetime.now().isoformat()
            }
            
            heliki_host = os.getenv('HELIKI_HOST', 'localhost')
            heliki_port = os.getenv('HELIKI_PORT', '3005')
            cleanup_url = f"http://{heliki_host}:{heliki_port}/api/hooks/remove-temporary"
            response = requests.post(
                cleanup_url,
                json=cleanup_data,
                timeout=10
            )
            
            if response.status_code == 200:
                logger.info(" 成功清理临时hooks配置")
                return True
            else:
                logger.warning(f"hooks清理响应异常: {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            logger.warning(f"无法连接到Heliki OS清理hooks: {e}")
            
            # 备用方案：直接使用HookManager清理
            try:
                logger.info("尝试使用备用方案清理hooks...")
                # 直接导入setup_hooks模块
                import sys
                import os
                
                # 添加项目目录到路径
                project_dir = Path(__file__).parent
                sys.path.insert(0, str(project_dir))
                
                from setup_hooks import HookManager
                hook_manager = HookManager()
                
                success = hook_manager.remove_temporary_hooks()
                if success:
                    logger.info(" 备用方案成功清理hooks")
                    return True
                else:
                    logger.error(" 备用方案清理hooks失败")
                    return False
                    
            except Exception as backup_error:
                logger.error(f"备用方案也失败: {backup_error}")
                return False
        
        except Exception as e:
            logger.error(f"清理hooks时出现错误: {e}")
            return False
    
    def run(self, transcript_path: str, project_path: str = None, session_identifier: str = None) -> bool:
        """
        主执行流程
        """
        logger.info("==================== 数字员工自动部署开始 ====================")
        logger.info(f"Transcript路径: {transcript_path}")
        logger.info(f"项目路径: {project_path}")
        logger.info(f"会话标识: {session_identifier}")
        
        try:
            # 1. 判断是否需要部署
            if not self.should_deploy_agents(transcript_path, project_path, session_identifier):
                logger.info("不满足部署条件，退出")
                return False
            
            # 2. 执行部署
            if not self.deploy_agents():
                logger.error("部署失败")
                return False
            
            # 3. 通知Heliki OS
            self.notify_heliki_completion()
            
            # 4. 清理临时hooks配置
            self.cleanup_hooks()
            
            logger.info("==================== 数字员工自动部署完成 ====================")
            return True
            
        except Exception as e:
            logger.error(f"部署过程中发生未预期的错误: {e}")
            return False

def main():
    """
    主入口函数
    """
    if len(sys.argv) < 2:
        logger.error("缺少transcript路径参数")
        logger.info("用法: python deploy_agents.py <transcript_path> [project_path] [session_identifier]")
        return 1
    
    transcript_path = sys.argv[1]
    project_path = sys.argv[2] if len(sys.argv) > 2 else None
    session_identifier = sys.argv[3] if len(sys.argv) > 3 else None
    
    deployer = AgentDeployer()
    
    success = deployer.run(transcript_path, project_path, session_identifier)
    return 0 if success else 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)