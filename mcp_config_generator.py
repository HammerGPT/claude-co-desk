#!/usr/bin/env python3
"""
MCP Configuration Generator
Automatically generates .mcp.json configuration file for Claude Code
Registers the application control MCP server
"""

import json
import logging
import os
import shutil
import sys
from pathlib import Path
from typing import Dict, Any, Optional

from config import Config

logger = logging.getLogger(__name__)

class MCPConfigGenerator:
    """MCP Configuration Generator for Claude Code integration"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.absolute()
        self.mcp_config_file = self.project_root / ".mcp.json"
        self.app_control_mcp_path = self.project_root / "app_control_mcp.py"
        
        logger.info(f"MCP Config Generator initialized for project: {self.project_root}")
    
    def check_python_executable(self) -> str:
        """Find the appropriate Python executable to use"""
        # Check if we're in a virtual environment
        if hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
            # We're in a virtual environment, use the current Python
            python_exe = sys.executable
            logger.info(f"Using virtual environment Python: {python_exe}")
            return python_exe
        
        # Not in virtual environment, try to find system Python
        python_candidates = ['python3', 'python']
        for candidate in python_candidates:
            python_path = shutil.which(candidate)
            if python_path:
                logger.info(f"Using system Python: {python_path}")
                return python_path
        
        # Fallback to current sys.executable
        logger.warning(f"Could not find Python executable, using current: {sys.executable}")
        return sys.executable
    
    def check_mcp_dependencies(self) -> bool:
        """Check if MCP server dependencies are available"""
        try:
            import asyncio
            # Try importing MCP - if it fails, we'll catch it
            try:
                from mcp.server import Server
                from mcp.server.models import InitializationOptions
                logger.info("MCP server dependencies are available")
                return True
            except ImportError as e:
                logger.warning(f"MCP server library not found: {e}")
                logger.info("Install MCP with: pip install mcp")
                return False
                
        except ImportError as e:
            logger.error(f"Required dependencies not available: {e}")
            return False
    
    def generate_mcp_config(self) -> Dict[str, Any]:
        """Generate MCP configuration for application control"""
        
        # Get Python executable
        python_exe = self.check_python_executable()
        
        # MCP server configuration
        mcp_config = {
            "mcpServers": {
                "app-control": {
                    "command": python_exe,
                    "args": [str(self.app_control_mcp_path)],
                    "env": {
                        "PYTHONPATH": str(self.project_root)
                    }
                }
            }
        }
        
        logger.info("Generated MCP configuration for application control server")
        return mcp_config
    
    def load_existing_config(self) -> Dict[str, Any]:
        """Load existing MCP configuration if it exists"""
        if self.mcp_config_file.exists():
            try:
                with open(self.mcp_config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                logger.info(f"Loaded existing MCP configuration from {self.mcp_config_file}")
                return config
            except (json.JSONDecodeError, IOError) as e:
                logger.warning(f"Error loading existing MCP config: {e}")
                return {}
        else:
            logger.info("No existing MCP configuration found")
            return {}
    
    def merge_configs(self, existing_config: Dict[str, Any], new_config: Dict[str, Any]) -> Dict[str, Any]:
        """Merge new MCP config with existing config"""
        # Start with existing config
        merged = existing_config.copy()
        
        # Ensure mcpServers section exists
        if "mcpServers" not in merged:
            merged["mcpServers"] = {}
        
        # Merge new servers
        merged["mcpServers"].update(new_config["mcpServers"])
        
        logger.info("Merged MCP configurations")
        return merged
    
    def write_mcp_config(self, config: Dict[str, Any]) -> bool:
        """Write MCP configuration to .mcp.json file"""
        try:
            with open(self.mcp_config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            
            logger.info(f"MCP configuration written to {self.mcp_config_file}")
            return True
            
        except (IOError, OSError) as e:
            logger.error(f"Error writing MCP configuration: {e}")
            return False
    
    def validate_mcp_server(self) -> bool:
        """Validate that the MCP server file exists and is executable"""
        if not self.app_control_mcp_path.exists():
            logger.error(f"MCP server file not found: {self.app_control_mcp_path}")
            return False
        
        if not self.app_control_mcp_path.is_file():
            logger.error(f"MCP server path is not a file: {self.app_control_mcp_path}")
            return False
        
        # Check if file is readable
        try:
            with open(self.app_control_mcp_path, 'r') as f:
                content = f.read(100)  # Read first 100 chars
            if not content.strip():
                logger.error(f"MCP server file appears to be empty")
                return False
                
        except IOError as e:
            logger.error(f"Cannot read MCP server file: {e}")
            return False
        
        logger.info("MCP server file validation passed")
        return True
    
    def setup_mcp_configuration(self) -> bool:
        """Setup complete MCP configuration for application control"""
        logger.info("Setting up MCP configuration for application control")
        
        # Validate MCP server file
        if not self.validate_mcp_server():
            return False
        
        # Check dependencies (warning only)
        if not self.check_mcp_dependencies():
            logger.warning("MCP dependencies not available - install with: pip install mcp")
        
        # Generate new configuration
        new_config = self.generate_mcp_config()
        
        # Load existing configuration
        existing_config = self.load_existing_config()
        
        # Merge configurations
        merged_config = self.merge_configs(existing_config, new_config)
        
        # Write configuration
        success = self.write_mcp_config(merged_config)
        
        if success:
            logger.info("MCP configuration setup completed successfully")
            logger.info(f"Claude Code will automatically load the app-control MCP server")
            logger.info(f"Restart Claude Code to activate the new MCP server")
        else:
            logger.error("Failed to setup MCP configuration")
        
        return success
    
    def get_mcp_status(self) -> Dict[str, Any]:
        """Get current MCP configuration status"""
        status = {
            "config_file_exists": self.mcp_config_file.exists(),
            "mcp_server_exists": self.app_control_mcp_path.exists(),
            "dependencies_available": self.check_mcp_dependencies(),
            "config_file_path": str(self.mcp_config_file),
            "mcp_server_path": str(self.app_control_mcp_path)
        }
        
        if status["config_file_exists"]:
            try:
                config = self.load_existing_config()
                status["app_control_configured"] = "app-control" in config.get("mcpServers", {})
                status["total_servers"] = len(config.get("mcpServers", {}))
            except Exception as e:
                status["config_error"] = str(e)
                status["app_control_configured"] = False
                status["total_servers"] = 0
        else:
            status["app_control_configured"] = False
            status["total_servers"] = 0
        
        return status
    
    def remove_mcp_server(self, server_name: str = "app-control") -> bool:
        """Remove MCP server from configuration"""
        try:
            existing_config = self.load_existing_config()
            
            if "mcpServers" in existing_config and server_name in existing_config["mcpServers"]:
                del existing_config["mcpServers"][server_name]
                
                # Remove empty mcpServers section if no servers left
                if not existing_config["mcpServers"]:
                    del existing_config["mcpServers"]
                
                success = self.write_mcp_config(existing_config)
                if success:
                    logger.info(f"Removed MCP server '{server_name}' from configuration")
                return success
            else:
                logger.warning(f"MCP server '{server_name}' not found in configuration")
                return True  # Not an error if it wasn't there
                
        except Exception as e:
            logger.error(f"Error removing MCP server: {e}")
            return False

def main():
    """Test the MCP configuration generator"""
    logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
    
    generator = MCPConfigGenerator()
    
    print("MCP Configuration Generator")
    print("=" * 40)
    
    # Show current status
    status = generator.get_mcp_status()
    print(f"Configuration file exists: {status['config_file_exists']}")
    print(f"MCP server file exists: {status['mcp_server_exists']}")
    print(f"Dependencies available: {status['dependencies_available']}")
    print(f"App control configured: {status['app_control_configured']}")
    print(f"Total MCP servers: {status['total_servers']}")
    
    print("\nSetting up MCP configuration...")
    success = generator.setup_mcp_configuration()
    
    if success:
        print("\n✓ MCP configuration setup successful!")
        print("  Restart Claude Code to activate the application control MCP server")
    else:
        print("\n✗ MCP configuration setup failed")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())