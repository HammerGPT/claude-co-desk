#!/usr/bin/env python3
"""
Application Control MCP Server
MCP (Model Context Protocol) server for system application control
Provides tools for Claude Code to discover and launch applications
"""

import asyncio
import json
import logging
import subprocess
import sys
from typing import Any, Dict, List, Optional

# MCP server imports
try:
    from mcp.server.models import InitializationOptions
    from mcp.server import NotificationOptions, Server
    from mcp.types import Resource, Tool, TextContent, ImageContent, EmbeddedResource
    import mcp.types as types
except ImportError:
    print("MCP library not found. Install with: pip install mcp")
    sys.exit(1)

from app_scanner import ApplicationScanner, ApplicationInfo

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app-control-mcp")

class ApplicationControlMCP:
    """MCP Server for application control functionality"""
    
    def __init__(self):
        self.server = Server("app-control")
        self.scanner = ApplicationScanner()
        self._cached_applications = None
        
        logger.info("Application Control MCP Server initialized")
        
        # Register tools
        self._register_tools()
    
    def _register_tools(self):
        """Register all available MCP tools"""
        
        @self.server.list_tools()
        async def handle_list_tools() -> list[Tool]:
            """List available application control tools"""
            return [
                Tool(
                    name="list_applications",
                    description="List all discovered system applications (GUI apps and CLI tools)",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "app_type": {
                                "type": "string",
                                "enum": ["all", "gui", "cli"],
                                "description": "Filter applications by type",
                                "default": "all"
                            },
                            "tags": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Filter applications by tags (e.g., ['development', 'design'])"
                            },
                            "match_all_tags": {
                                "type": "boolean",
                                "description": "If true, app must have ALL specified tags. If false, app must have ANY tag.",
                                "default": False
                            }
                        }
                    }
                ),
                Tool(
                    name="launch_application",
                    description="Launch a specific application by name",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "app_name": {
                                "type": "string",
                                "description": "Name of the application to launch"
                            }
                        },
                        "required": ["app_name"]
                    }
                ),
                Tool(
                    name="get_application_info",
                    description="Get detailed information about a specific application",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "app_name": {
                                "type": "string", 
                                "description": "Name of the application to get info for"
                            }
                        },
                        "required": ["app_name"]
                    }
                ),
                Tool(
                    name="refresh_applications",
                    description="Refresh the list of discovered applications",
                    inputSchema={"type": "object", "properties": {}}
                ),
                Tool(
                    name="list_application_tags",
                    description="List all available application tags",
                    inputSchema={"type": "object", "properties": {}}
                )
            ]
        
        @self.server.call_tool()
        async def handle_call_tool(name: str, arguments: dict) -> list[types.TextContent]:
            """Handle tool calls"""
            
            try:
                if name == "list_applications":
                    return await self._handle_list_applications(arguments)
                elif name == "launch_application":
                    return await self._handle_launch_application(arguments)
                elif name == "get_application_info":
                    return await self._handle_get_application_info(arguments)
                elif name == "refresh_applications":
                    return await self._handle_refresh_applications(arguments)
                elif name == "list_application_tags":
                    return await self._handle_list_application_tags(arguments)
                else:
                    raise ValueError(f"Unknown tool: {name}")
                    
            except Exception as e:
                logger.error(f"Error handling tool {name}: {e}")
                return [types.TextContent(
                    type="text",
                    text=f"Error executing {name}: {str(e)}"
                )]
    
    async def _handle_list_applications(self, arguments: dict) -> list[types.TextContent]:
        """Handle list_applications tool call"""
        app_type = arguments.get("app_type", "all")
        tags = arguments.get("tags", [])
        match_all_tags = arguments.get("match_all_tags", False)
        
        filter_desc = f"type: {app_type}"
        if tags:
            match_type = "ALL" if match_all_tags else "ANY"
            filter_desc += f", tags: {tags} (match {match_type})"
        
        logger.info(f"Listing applications with filter: {filter_desc}")
        
        # Get cached applications or scan fresh
        if self._cached_applications is None:
            self._cached_applications = self.scanner.scan_all_applications()
        
        apps = self._cached_applications
        
        # Filter by tags first if specified
        if tags:
            filtered_apps = {}
            for name, app in apps.items():
                if match_all_tags:
                    # App must have all specified tags
                    if all(tag in app.tags for tag in tags):
                        filtered_apps[name] = app
                else:
                    # App must have at least one of the specified tags
                    if any(tag in app.tags for tag in tags):
                        filtered_apps[name] = app
            apps = filtered_apps
        
        # Filter by type if requested
        if app_type == "gui":
            apps = {name: app for name, app in apps.items() if app.type == "gui"}
        elif app_type == "cli":
            apps = {name: app for name, app in apps.items() if app.type == "cli"}
        
        # Format response
        if not apps:
            filter_text = f"{app_type} applications"
            if tags:
                filter_text += f" with tags {tags}"
            response_text = f"No {filter_text} found on the system."
        else:
            filter_text = f"{app_type} applications"
            if tags:
                filter_text += f" with tags {tags}"
            lines = [f"Discovered {len(apps)} {filter_text}:\n"]
            
            # Group by type for better presentation
            gui_apps = {n: a for n, a in apps.items() if a.type == "gui"}
            cli_apps = {n: a for n, a in apps.items() if a.type == "cli"}
            
            if gui_apps:
                lines.append(f"GUI Applications ({len(gui_apps)}):")
                for name, app in sorted(gui_apps.items()):
                    tags_str = ", ".join(app.tags) if app.tags else "no tags"
                    lines.append(f"  • {name} ({app.platform}) [tags: {tags_str}]")
                lines.append("")
            
            if cli_apps:
                lines.append(f"CLI Tools ({len(cli_apps)}):")
                for name, app in sorted(cli_apps.items()):
                    tags_str = ", ".join(app.tags) if app.tags else "no tags"
                    lines.append(f"  • {name} -> {app.path} [tags: {tags_str}]")
            
            response_text = "\n".join(lines)
        
        logger.info(f"Listed {len(apps)} applications")
        return [types.TextContent(type="text", text=response_text)]
    
    async def _handle_launch_application(self, arguments: dict) -> list[types.TextContent]:
        """Handle launch_application tool call"""
        app_name = arguments.get("app_name")
        
        if not app_name:
            return [types.TextContent(
                type="text",
                text="Error: app_name parameter is required"
            )]
        
        logger.info(f"Attempting to launch application: {app_name}")
        
        # Get cached applications or scan fresh
        if self._cached_applications is None:
            self._cached_applications = self.scanner.scan_all_applications()
        
        app_info = self._cached_applications.get(app_name)
        
        if not app_info:
            logger.warning(f"Application not found: {app_name}")
            # Try to find similar names
            similar = [name for name in self._cached_applications.keys() 
                      if app_name.lower() in name.lower()]
            
            if similar:
                suggestion_text = f"Application '{app_name}' not found. Did you mean: {', '.join(similar[:3])}"
            else:
                suggestion_text = f"Application '{app_name}' not found. Use list_applications to see available apps."
            
            return [types.TextContent(type="text", text=suggestion_text)]
        
        # Launch the application
        try:
            command = app_info.launch_command
            logger.info(f"Executing launch command: {command}")
            
            # Execute command based on platform
            if app_info.platform == "darwin":
                # macOS
                result = subprocess.run(
                    command.split(),
                    capture_output=True,
                    text=True,
                    timeout=10
                )
            elif app_info.platform == "windows":
                # Windows
                result = subprocess.run(
                    command,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=10
                )
            else:
                # Linux
                result = subprocess.run(
                    command.split(),
                    capture_output=True,
                    text=True,
                    timeout=10
                )
            
            if result.returncode == 0:
                success_text = f"Successfully launched {app_name} ({app_info.type})"
                logger.info(success_text)
                return [types.TextContent(type="text", text=success_text)]
            else:
                error_text = f"Failed to launch {app_name}. Error: {result.stderr}"
                logger.error(error_text)
                return [types.TextContent(type="text", text=error_text)]
                
        except subprocess.TimeoutExpired:
            timeout_text = f"Timeout launching {app_name} - application may have started in background"
            logger.warning(timeout_text)
            return [types.TextContent(type="text", text=timeout_text)]
            
        except Exception as e:
            error_text = f"Error launching {app_name}: {str(e)}"
            logger.error(error_text)
            return [types.TextContent(type="text", text=error_text)]
    
    async def _handle_get_application_info(self, arguments: dict) -> list[types.TextContent]:
        """Handle get_application_info tool call"""
        app_name = arguments.get("app_name")
        
        if not app_name:
            return [types.TextContent(
                type="text",
                text="Error: app_name parameter is required"
            )]
        
        logger.info(f"Getting info for application: {app_name}")
        
        # Get cached applications or scan fresh
        if self._cached_applications is None:
            self._cached_applications = self.scanner.scan_all_applications()
        
        app_info = self._cached_applications.get(app_name)
        
        if not app_info:
            return [types.TextContent(
                type="text",
                text=f"Application '{app_name}' not found"
            )]
        
        # Format application information
        info_lines = [
            f"Application: {app_info.name}",
            f"Type: {app_info.type}",
            f"Platform: {app_info.platform}",
            f"Path: {app_info.path}",
        ]
        
        if app_info.executable:
            info_lines.append(f"Executable: {app_info.executable}")
        
        if app_info.launch_command:
            info_lines.append(f"Launch Command: {app_info.launch_command}")
        
        if app_info.tags:
            info_lines.append(f"Tags: {', '.join(app_info.tags)}")
        else:
            info_lines.append("Tags: none")
        
        response_text = "\n".join(info_lines)
        
        return [types.TextContent(type="text", text=response_text)]
    
    async def _handle_refresh_applications(self, arguments: dict) -> list[types.TextContent]:
        """Handle refresh_applications tool call"""
        logger.info("Refreshing application list")
        
        # Clear cache and rescan
        self._cached_applications = None
        self._cached_applications = self.scanner.scan_all_applications()
        
        response_text = f"Application list refreshed. Found {len(self._cached_applications)} applications."
        logger.info(response_text)
        
        return [types.TextContent(type="text", text=response_text)]
    
    async def _handle_list_application_tags(self, arguments: dict) -> list[types.TextContent]:
        """Handle list_application_tags tool call"""
        logger.info("Listing all application tags")
        
        # Get cached applications or scan fresh
        if self._cached_applications is None:
            self._cached_applications = self.scanner.scan_all_applications()
        
        # Collect all tags from applications
        all_tags = set()
        tag_counts = {}
        
        for app in self._cached_applications.values():
            for tag in app.tags:
                all_tags.add(tag)
                tag_counts[tag] = tag_counts.get(tag, 0) + 1
        
        if not all_tags:
            response_text = "No tags found for any applications."
        else:
            lines = [f"Available application tags ({len(all_tags)} total):\n"]
            
            # Sort tags by frequency (most common first)
            sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)
            
            for tag, count in sorted_tags:
                lines.append(f"  • {tag} ({count} applications)")
            
            response_text = "\n".join(lines)
        
        logger.info(f"Listed {len(all_tags)} unique tags")
        return [types.TextContent(type="text", text=response_text)]

async def main():
    """Main function to run the MCP server"""
    mcp_server = ApplicationControlMCP()
    
    # Run the server
    from mcp.server.stdio import stdio_server
    
    async with stdio_server() as (read_stream, write_stream):
        await mcp_server.server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="app-control",
                server_version="1.0.0",
                capabilities=mcp_server.server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )

if __name__ == "__main__":
    asyncio.run(main())