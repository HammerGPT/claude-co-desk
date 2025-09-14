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
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional

from config import Config

logger = logging.getLogger(__name__)

class MCPConfigGenerator:
    """MCP Configuration Generator for Claude Code integration"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.absolute()
        self.mcp_config_file = self.project_root / ".mcp.json"
        self.mcp_services_dir = self.project_root / "mcp_services"
        
        logger.info(f"MCP Config Generator initialized for project: {self.project_root}")
        logger.info(f"MCP Services directory: {self.mcp_services_dir}")
    
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
    
    def load_smtp_config(self, service_dir: Path) -> Dict[str, str]:
        """Load SMTP configuration from config file"""
        config_file = service_dir / "smtp_config.json"

        if not config_file.exists():
            logger.warning(f"SMTP config file not found: {config_file}")
            return {}

        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)

            # Handle new JSON structure format
            if "smtpServers" in config:
                smtp_servers = config.get("smtpServers", [])
                # Only convert to env vars if we have a valid server with real credentials
                if smtp_servers:
                    default_server = next((s for s in smtp_servers if s.get("isDefault")), smtp_servers[0])
                    auth = default_server.get("auth", {})
                    # Only use if not example/placeholder values
                    if (default_server.get("host") != "smtp.example.com" and
                        auth.get("user") != "your_email@example.com" and
                        auth.get("pass") != "your_password"):

                        return {
                            "SMTP_HOST": default_server.get("host", ""),
                            "SMTP_PORT": str(default_server.get("port", 587)),
                            "SMTP_SECURE": str(default_server.get("secure", False)).lower(),
                            "SMTP_USER": auth.get("user", ""),
                            "SMTP_PASS": auth.get("pass", "")
                        }

                logger.info(f"SMTP config contains example values only, skipping environment variable setup")
                return {}

            # Handle legacy direct environment variable format
            logger.info(f"Loaded SMTP configuration from {config_file}")
            return config

        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"Error loading SMTP config from {config_file}: {e}")
            return {}

    def discover_mcp_services(self) -> Dict[str, Dict[str, Any]]:
        """Discover all MCP services in mcp_services directory"""
        services = {}
        
        if not self.mcp_services_dir.exists():
            logger.warning(f"MCP services directory not found: {self.mcp_services_dir}")
            return services
        
        # Get Python executable
        python_exe = self.check_python_executable()
        
        for service_dir in self.mcp_services_dir.iterdir():
            if not service_dir.is_dir():
                continue
                
            service_name = service_dir.name
            
            # Check for Python service (server.py)
            python_server = service_dir / "server.py"
            if python_server.exists():
                services[service_name] = {
                    "type": "stdio",
                    "command": python_exe,
                    "args": [str(python_server)],
                    "env": {
                        "PYTHONPATH": str(self.project_root)
                    }
                }
                logger.info(f"Discovered Python MCP service: {service_name}")
                continue
            
            # Check for TypeScript/Node.js service (build/index.js)
            nodejs_server = service_dir / "build" / "index.js"
            if nodejs_server.exists():
                # Find node executable
                node_exe = shutil.which("node")
                if node_exe:
                    # Start with empty env
                    env_config = {}
                    
                    # Load SMTP configuration for smtp-mail service
                    if service_name == "smtp-mail":
                        smtp_config = self.load_smtp_config(service_dir)
                        if smtp_config:
                            env_config.update(smtp_config)
                            logger.info(f"Applied SMTP configuration to service: {service_name}")
                        else:
                            logger.warning(f"SMTP service {service_name} found but no config loaded")
                    
                    services[service_name] = {
                        "type": "stdio",
                        "command": node_exe,
                        "args": [str(nodejs_server)],
                        "env": env_config
                    }
                    logger.info(f"Discovered Node.js MCP service: {service_name}")
                else:
                    logger.warning(f"Node.js not found, skipping service: {service_name}")
                continue
            
            logger.debug(f"No valid MCP server found in directory: {service_dir}")
        
        logger.info(f"Total discovered MCP services: {len(services)}")
        return services
    
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
        """Generate MCP configuration for all discovered services"""
        
        # Discover all MCP services
        discovered_services = self.discover_mcp_services()
        
        if not discovered_services:
            logger.warning("No MCP services discovered, using empty configuration")
            return {"mcpServers": {}}
        
        # Build MCP server configuration
        mcp_servers = {}
        for service_name, service_config in discovered_services.items():
            # Use service name as server name (with prefix if needed)
            server_name = f"{service_name}"
            mcp_servers[server_name] = {
                "command": service_config["command"],
                "args": service_config["args"],
                "env": service_config["env"]
            }
        
        mcp_config = {
            "mcpServers": mcp_servers
        }
        
        logger.info(f"Generated MCP configuration for {len(mcp_servers)} services: {list(mcp_servers.keys())}")
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
    
    def validate_mcp_services(self) -> bool:
        """Validate that MCP services directory and discovered services are valid"""
        if not self.mcp_services_dir.exists():
            logger.error(f"MCP services directory not found: {self.mcp_services_dir}")
            return False
        
        # Discover services and validate each one
        discovered_services = self.discover_mcp_services()
        
        if not discovered_services:
            logger.warning("No MCP services discovered for validation")
            return True  # Not an error if no services exist yet
        
        validation_passed = True
        for service_name, service_config in discovered_services.items():
            service_path = Path(service_config["args"][0])
            
            if not service_path.exists():
                logger.error(f"MCP service file not found: {service_path}")
                validation_passed = False
                continue
            
            if not service_path.is_file():
                logger.error(f"MCP service path is not a file: {service_path}")
                validation_passed = False
                continue
            
            # Check if file is readable
            try:
                with open(service_path, 'r') as f:
                    content = f.read(100)  # Read first 100 chars
                if not content.strip():
                    logger.error(f"MCP service file appears to be empty: {service_path}")
                    validation_passed = False
                    continue
                    
            except IOError as e:
                logger.error(f"Cannot read MCP service file {service_path}: {e}")
                validation_passed = False
                continue
            
            logger.info(f"MCP service validation passed: {service_name}")
        
        if validation_passed:
            logger.info("All MCP services validation passed")
        else:
            logger.error("Some MCP services failed validation")
        
        return validation_passed
    
    def setup_mcp_configuration(self) -> bool:
        """Setup complete MCP configuration for all discovered services"""
        logger.info("Setting up MCP configuration for all discovered services")
        
        # Validate MCP services
        if not self.validate_mcp_services():
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
        
        # Register services to Claude Code global configuration
        if success:
            global_success = self.register_to_global_config()
            if not global_success:
                logger.warning("Local MCP configuration created but failed to register to Claude Code global config")
                return success  # Still return success for local config
        
        return success
    
    def get_claude_config_path(self) -> Path:
        """Get Claude Code global configuration file path"""
        home_dir = Path.home()
        claude_config_file = home_dir / ".claude.json"
        return claude_config_file
    
    def load_claude_global_config(self) -> Dict[str, Any]:
        """Load Claude Code global configuration"""
        claude_config_path = self.get_claude_config_path()
        
        if not claude_config_path.exists():
            logger.warning(f"Claude global config file not found: {claude_config_path}")
            return {}
        
        try:
            with open(claude_config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Claude global config JSON: {e}")
            return {}
        except Exception as e:
            logger.error(f"Failed to load Claude global config: {e}")
            return {}
    
    def save_claude_global_config(self, config: Dict[str, Any]) -> bool:
        """Safely save Claude Code global configuration with atomic write"""
        claude_config_path = self.get_claude_config_path()
        
        try:
            # Create a temporary file in the same directory for atomic write
            temp_fd, temp_path = tempfile.mkstemp(
                suffix='.tmp',
                prefix='.claude_',
                dir=claude_config_path.parent
            )
            
            temp_path = Path(temp_path)
            
            try:
                # Write to temporary file
                with os.fdopen(temp_fd, 'w', encoding='utf-8') as f:
                    json.dump(config, f, indent=2, ensure_ascii=False)
                
                # Atomic move to replace original file
                temp_path.replace(claude_config_path)
                logger.info(f"Claude global config updated successfully: {claude_config_path}")
                return True
                
            except Exception as e:
                # Clean up temporary file if something goes wrong
                if temp_path.exists():
                    temp_path.unlink()
                raise e
                
        except Exception as e:
            logger.error(f"Failed to save Claude global config: {e}")
            return False
    
    def find_project_config_key(self, global_config: Dict[str, Any]) -> tuple[str, Optional[str]]:
        """Find the configuration key for user home directory in Claude global config
        
        Returns:
            tuple[str, Optional[str]]: (config_type, config_key) where config_type is 'projects' or 'root'
        """
        # Use user home directory as the working directory for MCP tools
        home_path_str = Config.get_user_home()
        user_home_path = Path(home_path_str)
        
        # PRIORITY 1: Look in projects structure first (this is where Claude CLI reads from)
        if "projects" in global_config:
            projects = global_config["projects"]
            if isinstance(projects, dict):
                # Check if home path exists in projects
                if home_path_str in projects:
                    project_config = projects[home_path_str]
                    if isinstance(project_config, dict):
                        logger.info(f"Found user home config in projects structure: {home_path_str}")
                        return ("projects", home_path_str)
                
                # Look for alternative path representations in projects
                possible_keys = [
                    str(user_home_path.resolve()),
                    str(user_home_path.absolute()),
                    home_path_str.replace(' ', '-'),  # Space to dash conversion
                ]
                
                for key in projects.keys():
                    if key in possible_keys:
                        logger.info(f"Found user home config in projects with alternative key: {key}")
                        return ("projects", key)
        
        # PRIORITY 2: Look in root level (legacy support)
        # Look for exact path match, prioritize the one with existing mcpServers
        if home_path_str in global_config:
            home_config = global_config[home_path_str]
            if isinstance(home_config, dict) and "mcpServers" in home_config:
                existing_servers = home_config.get("mcpServers", {})
                # Prefer the config node that already has MCP servers configured
                if existing_servers:
                    logger.info(f"Found user home config with existing MCP servers in root level: {home_path_str}")
                    return ("root", home_path_str)
        
        # If no existing mcpServers found, return the first match at root level
        if home_path_str in global_config:
            logger.info(f"Found user home config in root level: {home_path_str}")
            return ("root", home_path_str)
        
        # Look for alternative path representations at root level
        possible_keys = [
            str(user_home_path.resolve()),
            str(user_home_path.absolute()),
            home_path_str.replace(' ', '-'),  # Space to dash conversion
        ]
        
        for key in global_config.keys():
            if key in possible_keys:
                logger.info(f"Found user home config in root level with alternative key: {key}")
                return ("root", key)
        
        # If no match found anywhere, prefer projects structure for new registration
        logger.info(f"No existing user home config found, will create new key in projects: {home_path_str}")
        return ("projects", home_path_str)
    
    def register_to_global_config(self) -> bool:
        """Register discovered MCP services to Claude Code global configuration for user home directory"""
        logger.info("Registering MCP services to Claude Code global configuration for user home directory")
        
        # Discover all services using existing method
        discovered_services = self.discover_mcp_services()
        
        if not discovered_services:
            logger.warning("No MCP services discovered for global registration")
            return True  # Not an error if no services exist
        
        # Load Claude global config
        global_config = self.load_claude_global_config()
        
        if not global_config:
            logger.error("Failed to load Claude global configuration")
            return False
        
        # Find or create user home directory configuration
        config_type, home_key = self.find_project_config_key(global_config)
        
        logger.info(f"Using configuration: {config_type} -> {home_key}")
        
        # Get the target configuration object
        if config_type == "projects":
            # Ensure projects structure exists
            if "projects" not in global_config:
                global_config["projects"] = {}
            
            # Get or create the home directory configuration in projects
            if home_key not in global_config["projects"]:
                global_config["projects"][home_key] = {
                    "allowedTools": [],
                    "history": [],
                    "mcpContextUris": [],
                    "mcpServers": {},
                    "enabledMcpjsonServers": [],
                    "disabledMcpjsonServers": [],
                    "hasTrustDialogAccepted": True,  # Auto-trust system-initialized MCP services
                    "projectOnboardingSeenCount": 0,
                    "hasClaudeMdExternalIncludesApproved": False
                }
                logger.info(f"Created new projects config for {home_key}")
            
            target_config = global_config["projects"][home_key]
            
        else:  # config_type == "root"
            # Initialize user home config if it doesn't exist at root level
            if home_key not in global_config:
                global_config[home_key] = {
                    "allowedTools": [],
                    "history": [],
                    "mcpContextUris": [],
                    "mcpServers": {},
                    "enabledMcpjsonServers": [],
                    "disabledMcpjsonServers": [],
                    "hasTrustDialogAccepted": True,  # Auto-trust system-initialized MCP services
                    "projectOnboardingSeenCount": 0,
                    "hasClaudeMdExternalIncludesApproved": False
                }
                logger.info(f"Created new root-level config for {home_key}")
            
            target_config = global_config[home_key]
        
        # If config exists but MCP services need trust, enable trust for system services
        if "hasTrustDialogAccepted" in target_config and not target_config["hasTrustDialogAccepted"]:
            target_config["hasTrustDialogAccepted"] = True
            logger.info("Auto-enabled trust for system-initialized MCP services")
        
        # Ensure mcpServers exists
        if "mcpServers" not in target_config:
            target_config["mcpServers"] = {}
        
        # Register all discovered services
        mcp_servers = target_config["mcpServers"]
        
        for service_name, service_config in discovered_services.items():
            server_config = {
                "type": "stdio",  # Required field for MCP services
                "command": service_config["command"],
                "args": service_config["args"],
                "env": service_config["env"]
            }
            
            mcp_servers[service_name] = server_config
            logger.info(f"Registered MCP service to global config: {service_name}")
        
        # Clean up legacy root-level configurations if we're now using projects structure
        if config_type == "projects":
            home_path_str = Config.get_user_home()
            if home_path_str in global_config and home_path_str != home_key:
                # Check if this root config contains our MCP services
                root_config = global_config[home_path_str]
                if isinstance(root_config, dict) and "mcpServers" in root_config:
                    root_mcp_servers = root_config["mcpServers"]
                    our_services = set(discovered_services.keys())
                    root_services = set(root_mcp_servers.keys())
                    
                    # If root config only contains our services, remove it
                    if root_services.issubset(our_services) and root_services:
                        logger.info(f"Cleaning up legacy root-level MCP config for {home_path_str}")
                        # Only remove mcpServers, keep other config
                        del global_config[home_path_str]["mcpServers"]
                        
                        # If the config is now mostly empty, remove the entire node
                        remaining_keys = set(global_config[home_path_str].keys())
                        default_keys = {"allowedTools", "history", "mcpContextUris", "enabledMcpjsonServers", 
                                      "disabledMcpjsonServers", "hasTrustDialogAccepted", "projectOnboardingSeenCount", 
                                      "hasClaudeMdExternalIncludesApproved"}
                        
                        if remaining_keys <= default_keys:
                            # Check if all remaining values are defaults/empty
                            config_is_default = (
                                not global_config[home_path_str].get("allowedTools", []) and
                                not global_config[home_path_str].get("history", []) and 
                                not global_config[home_path_str].get("mcpContextUris", []) and
                                not global_config[home_path_str].get("enabledMcpjsonServers", []) and
                                not global_config[home_path_str].get("disabledMcpjsonServers", [])
                            )
                            
                            if config_is_default:
                                logger.info(f"Removing empty legacy root config: {home_path_str}")
                                del global_config[home_path_str]
        
        # Save updated configuration
        success = self.save_claude_global_config(global_config)
        
        if success:
            logger.info(f"Successfully registered {len(discovered_services)} MCP services to Claude Code global config")
            logger.info(f"Services: {list(discovered_services.keys())}")
            logger.info(f"Configuration path: {config_type} -> {home_key}")
        else:
            logger.error("Failed to save Claude Code global configuration")
        
        return success
    
    def get_mcp_status(self) -> Dict[str, Any]:
        """Get current MCP configuration status"""
        discovered_services = self.discover_mcp_services()
        
        status = {
            "config_file_exists": self.mcp_config_file.exists(),
            "mcp_services_dir_exists": self.mcp_services_dir.exists(),
            "dependencies_available": self.check_mcp_dependencies(),
            "config_file_path": str(self.mcp_config_file),
            "mcp_services_dir_path": str(self.mcp_services_dir),
            "discovered_services": list(discovered_services.keys()),
            "total_discovered_services": len(discovered_services)
        }
        
        if status["config_file_exists"]:
            try:
                config = self.load_existing_config()
                configured_servers = config.get("mcpServers", {})
                status["configured_servers"] = list(configured_servers.keys())
                status["total_configured_servers"] = len(configured_servers)
                
                # Check if discovered services are configured
                status["services_configured"] = {}
                for service_name in discovered_services.keys():
                    status["services_configured"][service_name] = service_name in configured_servers
                    
            except Exception as e:
                status["config_error"] = str(e)
                status["configured_servers"] = []
                status["total_configured_servers"] = 0
                status["services_configured"] = {}
        else:
            status["configured_servers"] = []
            status["total_configured_servers"] = 0
            status["services_configured"] = {}
        
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
    print(f"MCP services directory exists: {status['mcp_services_dir_exists']}")
    print(f"Dependencies available: {status['dependencies_available']}")
    print(f"Discovered services: {status['discovered_services']}")
    print(f"Total discovered services: {status['total_discovered_services']}")
    print(f"Total configured servers: {status['total_configured_servers']}")
    
    print("\nSetting up MCP configuration...")
    success = generator.setup_mcp_configuration()
    
    if success:
        print("\nSuccess: MCP configuration setup successful!")
        print("  Restart Claude Code to activate the application control MCP server")
    else:
        print("\nError: MCP configuration setup failed")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())