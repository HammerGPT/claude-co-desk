#!/usr/bin/env python3
"""
Digital Employee Auto-Deployment Script
Triggered by Claude Code hooks to automatically deploy digital employee teams after initialization completion
"""

import json
import sys
import shutil
import os
import requests
import hashlib
import logging
import subprocess
from pathlib import Path
from datetime import datetime
from typing import List, Optional

# Configure logging
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
    """Digital Employee Deployer"""
    
    def __init__(self):
        self.project_dir = Path(__file__).parent
        self.source_dir = self.project_dir / "static" / "agents"
        self.target_dir = Path.home() / ".claude" / "agents"
        self.deployed_marker = self.target_dir / ".heliki_agents_deployed"
        # Get Claude Co-Desk API address from environment variables, default to localhost:3005
        heliki_host = os.getenv('HELIKI_HOST', 'localhost')
        heliki_port = os.getenv('HELIKI_PORT', '3005')
        self.heliki_api_url = f"http://{heliki_host}:{heliki_port}/api/agents-deployed"
        
        # Dynamically discover agent files from source directory
        self.expected_agents = self._discover_agent_files()
    
    def _discover_agent_files(self) -> List[str]:
        """
        Dynamically discover agent files from the source directory
        """
        agent_files = []
        try:
            if self.source_dir.exists():
                # Find all .md files in the agents directory
                for agent_file in self.source_dir.glob("*.md"):
                    agent_files.append(agent_file.name)
                
                logger.info(f"Discovered {len(agent_files)} agent files: {agent_files}")
            else:
                logger.warning(f"Agents source directory not found: {self.source_dir}")
        except Exception as e:
            logger.error(f"Error discovering agent files: {e}")
        
        return sorted(agent_files)  # Sort for consistent ordering
    
    def _add_language_instruction(self) -> bool:
        """
        Add language adaptation instruction to user home CLAUDE.md file
        """
        try:
            home_claude_md = Path.home() / "CLAUDE.md"
            
            if not home_claude_md.exists():
                logger.error("User home CLAUDE.md file does not exist")
                return False
            
            # Language adaptation instruction
            language_instruction = """

## Language Communication Setting

**IMPORTANT**: Always respond to users in the same language they use when asking questions. If a user asks in Chinese, respond in Chinese; if they ask in English, respond in English; and so on for other languages. This ensures natural and accessible communication for users worldwide.

---
*This instruction was automatically added by Heliki OS digital employee deployment system*
"""
            
            # Read current content
            with open(home_claude_md, 'r', encoding='utf-8') as f:
                current_content = f.read()
            
            # Check if instruction already exists
            if "Language Communication Setting" in current_content:
                logger.info("Language instruction already exists in CLAUDE.md")
                return True
            
            # Append language instruction
            updated_content = current_content + language_instruction
            
            # Write back to file
            with open(home_claude_md, 'w', encoding='utf-8') as f:
                f.write(updated_content)
            
            logger.info("Successfully added language adaptation instruction to CLAUDE.md")
            return True
            
        except Exception as e:
            logger.error(f"Error adding language instruction: {e}")
            return False
    
    def should_deploy_agents(self, transcript_path: str, project_path: str = None, session_identifier: str = None) -> bool:
        """
        Simplified logic: check if user home directory CLAUDE.md file exists
        """
        logger.info(f"Checking if agent deployment is needed, session: {session_identifier}")
        
        try:
            # 1. Check if already deployed (prevent duplicates)
            if self.deployed_marker.exists():
                logger.info("Detected deployment marker file, skipping duplicate deployment")
                return False
            
            # 2. Check if user home directory CLAUDE.md file exists
            home_claude_md = Path.home() / "CLAUDE.md"
            
            if not home_claude_md.exists():
                logger.info("User home directory CLAUDE.md file does not exist, initialization not yet complete")
                return False
            
            # 3. Check if file is not empty (ensure content has been written)
            try:
                if home_claude_md.stat().st_size == 0:
                    logger.info("User home directory CLAUDE.md file is empty, initialization not yet complete")
                    return False
            except OSError as e:
                logger.warning(f"Unable to check CLAUDE.md file size: {e}")
                return False
            
            # 4. Check if session identifier is initialization session
            if session_identifier and not session_identifier.startswith('init-'):
                logger.info(f"Non-initialization session, skipping deployment: {session_identifier}")
                return False
            
            logger.info(" Detected home directory CLAUDE.md file generated, preparing agent deployment")
            return True
            
        except Exception as e:
            logger.error(f"Error checking deployment conditions: {e}")
            return False
    
    def deploy_agents(self) -> bool:
        """
        Execute digital employee file deployment
        """
        logger.info("Starting agent deployment...")
        
        try:
            # 1. Check source file directory
            if not self.source_dir.exists():
                logger.error(f"Source file directory does not exist: {self.source_dir}")
                return False
            
            # 2. Create target directory
            self.target_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f"Ensuring target directory exists: {self.target_dir}")
            
            # 3. Check if all expected agent files exist
            missing_files = []
            for agent_file in self.expected_agents:
                source_file = self.source_dir / agent_file
                if not source_file.exists():
                    missing_files.append(agent_file)
            
            if missing_files:
                logger.error(f"Missing required agent files: {missing_files}")
                return False
            
            # 4. Copy all agent files
            deployed_files = []
            failed_files = []
            
            for agent_file in self.expected_agents:
                source_file = self.source_dir / agent_file
                target_file = self.target_dir / agent_file
                
                try:
                    # Copy file and preserve metadata
                    shutil.copy2(source_file, target_file)
                    
                    # Verify copy success
                    if target_file.exists():
                        deployed_files.append(agent_file)
                        logger.info(f" Successfully deployed: {agent_file}")
                    else:
                        failed_files.append(agent_file)
                        logger.error(f" Deployment failed: {agent_file}")
                        
                except Exception as e:
                    failed_files.append(agent_file)
                    logger.error(f" Failed to copy file {agent_file}: {e}")
            
            # 5. Check deployment results
            if failed_files:
                logger.error(f"Partial file deployment failed: {failed_files}")
                return False
            
            # 6. Add language adaptation instruction to user home CLAUDE.md
            success = self._add_language_instruction()
            if not success:
                logger.warning("Failed to add language instruction, but deployment continues")
            
            # 7. Create deployment marker file
            deployment_info = {
                "deployed_at": datetime.now().isoformat(),
                "deployed_files": deployed_files,
                "source_directory": str(self.source_dir),
                "target_directory": str(self.target_dir),
                "agent_count": len(deployed_files)
            }
            
            with open(self.deployed_marker, 'w', encoding='utf-8') as f:
                json.dump(deployment_info, f, indent=2, ensure_ascii=False)
            
            logger.info(f" Agent deployment completed! Total deployed {len(deployed_files)}  agents")
            return True
            
        except Exception as e:
            logger.error(f"Error occurred during deployment: {e}")
            return False
    
    def notify_heliki_completion(self) -> bool:
        """
        Notify Claude Co-Desk of deployment completion
        """
        logger.info("Notifying Claude Co-Desk of agent deployment completion...")
        
        try:
            # Prepare notification data
            notification_data = {
                "status": "success",
                "message": "Digital employee team deployment completed",
                "deployed_agents": self.expected_agents,
                "timestamp": datetime.now().isoformat(),
                "refresh_required": True,  # Indicate frontend needs refresh
                "agent_count": len(self.expected_agents)
            }
            
            # Send POST request notification
            response = requests.post(
                self.heliki_api_url,
                json=notification_data,
                timeout=10
            )
            
            if response.status_code == 200:
                logger.info(" Successfully notified Claude Co-Desk of deployment completion")
                return True
            else:
                logger.warning(f"Claude Co-Desk notification response abnormal: {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            logger.warning(f"Unable to connect to Claude Co-Desk API: {e}")
            # Notification failure does not affect deployment success
            return True
        except Exception as e:
            logger.error(f"Error occurred while notifying Claude Co-Desk: {e}")
            return True
    
    def register_system_mcp(self) -> bool:
        """
        Use claude mcp add command to register app-control MCP as user-level system service
        """
        logger.info("Registering app-control MCP as system-level service...")
        
        try:
            # Build absolute path for app_control_mcp.py
            mcp_server_path = self.project_dir / "app_control_mcp.py"
            
            if not mcp_server_path.exists():
                logger.error(f"MCP server file not found: {mcp_server_path}")
                return False
            
            # Check Python path in virtual environment
            python_executable = sys.executable
            if not python_executable:
                logger.error("Could not determine Python executable")
                return False
            
            # Build claude mcp add command
            claude_mcp_command = [
                "claude", "mcp", "add",
                "--scope", "user",
                "app-control",
                "-e", f"PYTHONPATH={self.project_dir}",
                "--",
                python_executable,
                str(mcp_server_path)
            ]
            
            logger.info(f"Executing command: {' '.join(claude_mcp_command)}")
            
            # Execute command in user home directory
            result = subprocess.run(
                claude_mcp_command,
                cwd=str(Path.home()),
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                logger.info(" Successfully registered app-control MCP at user level")
                logger.info(f"Command output: {result.stdout}")
                return True
            else:
                logger.error(f"Failed to register app-control MCP. Exit code: {result.returncode}")
                logger.error(f"Error output: {result.stderr}")
                return False
                
        except subprocess.TimeoutExpired:
            logger.error("MCP registration command timed out")
            return False
        except subprocess.SubprocessError as e:
            logger.error(f"Error executing MCP registration command: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error during MCP registration: {e}")
            return False
    
    def cleanup_hooks(self) -> bool:
        """
        Clean up temporary hooks configuration
        """
        logger.info("Starting to clean up temporary hooks configuration...")
        
        try:
            # Send cleanup request to Claude Co-Desk API
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
                logger.info(" Successfully cleaned up temporary hooks configuration")
                return True
            else:
                logger.warning(f"Hooks cleanup response abnormal: {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            logger.warning(f"Unable to connect to Claude Co-Desk to clean hooks: {e}")
            
            # Backup plan: use HookManager directly for cleanup
            try:
                logger.info("Trying alternative method to clean hooks...")
                # Import setup_hooks module directly
                import sys
                import os
                
                # Add project directory to path
                project_dir = Path(__file__).parent
                sys.path.insert(0, str(project_dir))
                
                from setup_hooks import HookManager
                hook_manager = HookManager()
                
                success = hook_manager.remove_temporary_hooks()
                if success:
                    logger.info(" Alternative method successfully cleaned hooks")
                    return True
                else:
                    logger.error(" Backup plan to clean hooks failed")
                    return False
                    
            except Exception as backup_error:
                logger.error(f"Backup plan also failed: {backup_error}")
                return False
        
        except Exception as e:
            logger.error(f"Error occurred while cleaning hooks: {e}")
            return False
    
    def run(self, transcript_path: str, project_path: str = None, session_identifier: str = None) -> bool:
        """
        Main execution flow
        """
        logger.info("==================== Digital agent auto-deployment started ====================")
        logger.info(f"Transcript path: {transcript_path}")
        logger.info(f"Project path: {project_path}")
        logger.info(f"Session identifier: {session_identifier}")
        
        try:
            # 1. Determine if deployment is needed
            if not self.should_deploy_agents(transcript_path, project_path, session_identifier):
                logger.info("Deployment conditions not met, exiting")
                return False
            
            # 2. Execute deployment
            if not self.deploy_agents():
                logger.error("Deployment failed")
                return False
            
            # 3. Register system-level MCP service
            self.register_system_mcp()
            
            # 4. Notify Claude Co-Desk
            self.notify_heliki_completion()
            
            # 5. Clean up temporary hooks configuration
            self.cleanup_hooks()
            
            logger.info("==================== Digital agent auto-deployment completed ====================")
            return True
            
        except Exception as e:
            logger.error(f"Unexpected error occurred during deployment: {e}")
            return False

def main():
    """
    Main entry function
    """
    if len(sys.argv) < 2:
        logger.error("Missing transcript path parameter")
        logger.info("Usage: python deploy_agents.py <transcript_path> [project_path] [session_identifier]")
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