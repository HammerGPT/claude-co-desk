#!/usr/bin/env python3
"""
WeChat Notification MCP Service Registration Script
Automatically registers the WeChat notification MCP service to Claude configuration
"""

import json
import os
import sys
from pathlib import Path

def get_user_home():
    """Get user home directory"""
    return os.path.expanduser("~")

def get_project_root():
    """Get project root directory"""
    return str(Path(__file__).parent.parent.parent)

def register_wechat_mcp():
    """Register WeChat notification MCP service to Claude configuration"""
    
    # Paths
    claude_config_path = Path(get_user_home()) / ".claude.json" 
    project_root = get_project_root()
    service_path = Path(project_root) / "mcp_services" / "wechat_notification" / "server.py"
    venv_python = Path(project_root) / "venv" / "bin" / "python"
    
    print(f"Registering WeChat notification MCP service...")
    print(f"Project root: {project_root}")
    print(f"Service path: {service_path}")
    print(f"Python path: {venv_python}")
    
    # Check if files exist
    if not claude_config_path.exists():
        print(f"Error: Claude configuration file not found: {claude_config_path}")
        return False
    
    if not service_path.exists():
        print(f"Error: WeChat MCP service not found: {service_path}")
        return False
        
    if not venv_python.exists():
        print(f"Error: Virtual environment Python not found: {venv_python}")
        return False
    
    try:
        # Read current configuration
        with open(claude_config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        # Get home directory key
        home_key = get_user_home()
        
        # Ensure home directory section exists
        if home_key not in config:
            config[home_key] = {
                "allowedTools": [],
                "history": [],
                "mcpContextUris": [],
                "mcpServers": {},
                "enabledMcpjsonServers": [],
                "disabledMcpjsonServers": [],
                "hasTrustDialogAccepted": False,
                "projectOnboardingSeenCount": 0,
                "hasClaudeMdExternalIncludesApproved": False
            }
        
        # Ensure mcpServers section exists
        if "mcpServers" not in config[home_key]:
            config[home_key]["mcpServers"] = {}
        
        # WeChat notification MCP server configuration
        wechat_mcp_config = {
            "type": "stdio",
            "command": str(venv_python),
            "args": [str(service_path)],
            "env": {
                "PYTHONPATH": project_root
            }
        }
        
        # Add WeChat notification MCP service
        config[home_key]["mcpServers"]["wechat_notification"] = wechat_mcp_config
        
        # Write updated configuration
        with open(claude_config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        print("✓ WeChat notification MCP service registered successfully")
        print("✓ Configuration saved to ~/.claude.json")
        
        return True
        
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in Claude configuration: {e}")
        return False
    except Exception as e:
        print(f"Error registering WeChat MCP service: {e}")
        return False

def verify_registration():
    """Verify that the MCP service is properly registered"""
    
    claude_config_path = Path(get_user_home()) / ".claude.json"
    home_key = get_user_home()
    
    try:
        with open(claude_config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        if (home_key in config and 
            "mcpServers" in config[home_key] and 
            "wechat_notification" in config[home_key]["mcpServers"]):
            
            mcp_config = config[home_key]["mcpServers"]["wechat_notification"]
            print(f"✓ WeChat notification MCP service found in configuration:")
            print(f"  Command: {mcp_config['command']}")
            print(f"  Args: {mcp_config['args']}")
            print(f"  Env: {mcp_config.get('env', {})}")
            return True
        else:
            print("✗ WeChat notification MCP service not found in configuration")
            return False
            
    except Exception as e:
        print(f"Error verifying registration: {e}")
        return False

if __name__ == "__main__":
    print("WeChat Notification MCP Service Registration")
    print("=" * 50)
    
    # Register the service
    success = register_wechat_mcp()
    
    if success:
        print("\nVerifying registration...")
        verify_registration()
        
        print("\nNext steps:")
        print("1. Test the MCP service: claude mcp list")
        print("2. Verify connection: claude mcp test wechat_notification")
        print("3. Configure API settings in wechat_config.json")
    else:
        print("\nRegistration failed!")
        sys.exit(1)