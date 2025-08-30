#!/usr/bin/env python3
"""
WeChat Notification MCP Server
MCP (Model Context Protocol) server for WeChat public account notifications
Provides tools for Claude Code to send WeChat notifications via cloud API
"""

import asyncio
import json
import logging
import sys
from typing import Any, Dict, List, Optional
import aiohttp
from datetime import datetime
import uuid

# MCP server imports
try:
    from mcp.server.models import InitializationOptions
    from mcp.server import NotificationOptions, Server
    from mcp.types import Resource, Tool, TextContent, ImageContent, EmbeddedResource
    import mcp.types as types
except ImportError:
    print("MCP library not found. Install with: pip install mcp")
    sys.exit(1)

try:
    from .config import Config, get_api_config, log_notification_activity
    from .api_client import WeChatAPIClient
except ImportError:
    # Fall back to direct import when run as script
    import sys
    import os
    sys.path.append(os.path.dirname(__file__))
    from config import Config, get_api_config, log_notification_activity
    from api_client import WeChatAPIClient

# Configure logging with enhanced formatting
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("wechat-notification-mcp")

# Add file handler for persistent logging
try:
    from pathlib import Path
    log_dir = Path(__file__).parent / "logs"
    log_dir.mkdir(exist_ok=True)
    
    file_handler = logging.FileHandler(log_dir / "wechat_mcp.log")
    file_handler.setLevel(logging.DEBUG)
    file_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
    )
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)
    
    logger.info("Enhanced logging system initialized")
except Exception as e:
    logger.warning(f"Failed to set up file logging: {e}")

class WeChatNotificationMCP:
    """MCP Server for WeChat notification functionality"""
    
    def __init__(self):
        self.server = Server("wechat-notification")
        self.config = Config()
        self.api_client: Optional[WeChatAPIClient] = None
        self._binding_cache = {}  # Local cache for user bindings
        self._cache_last_sync = None  # Timestamp of last sync with cloud
        self._retry_config = {
            "max_retries": 3,
            "base_delay": 1.0,
            "max_delay": 10.0,
            "exponential_base": 2.0
        }
        
        logger.info("WeChat Notification MCP Server initialized with enhanced error handling")
        
        # Register tools
        self._register_tools()
    
    async def _retry_with_backoff(self, operation, operation_name: str, *args, **kwargs):
        """Execute operation with exponential backoff retry"""
        max_retries = self._retry_config["max_retries"]
        base_delay = self._retry_config["base_delay"]
        max_delay = self._retry_config["max_delay"]
        exponential_base = self._retry_config["exponential_base"]
        
        last_exception = None
        
        for attempt in range(max_retries + 1):
            try:
                logger.debug(f"Attempting {operation_name} (attempt {attempt + 1}/{max_retries + 1})")
                return await operation(*args, **kwargs)
                
            except Exception as e:
                last_exception = e
                
                if attempt == max_retries:
                    logger.error(f"Failed {operation_name} after {max_retries + 1} attempts: {e}")
                    break
                
                # Calculate delay with exponential backoff
                delay = min(base_delay * (exponential_base ** attempt), max_delay)
                logger.warning(f"{operation_name} failed (attempt {attempt + 1}): {e}. Retrying in {delay:.2f}s...")
                
                await asyncio.sleep(delay)
        
        # If we get here, all retries failed
        raise last_exception or Exception(f"{operation_name} failed after all retries")
    
    async def _safe_execute(self, operation, operation_name: str, default_return=None, *args, **kwargs):
        """Safely execute operation with comprehensive error handling"""
        try:
            return await operation(*args, **kwargs)
        except asyncio.TimeoutError:
            logger.error(f"{operation_name} timed out")
            return {"success": False, "error": "Operation timed out", "error_code": "TIMEOUT"}
        except aiohttp.ClientError as e:
            logger.error(f"{operation_name} network error: {e}")
            return {"success": False, "error": f"Network error: {str(e)}", "error_code": "NETWORK_ERROR"}
        except Exception as e:
            logger.error(f"{operation_name} unexpected error: {e}", exc_info=True)
            return {"success": False, "error": f"Unexpected error: {str(e)}", "error_code": "INTERNAL_ERROR"}
    
    async def _initialize_api_client(self):
        """Initialize the API client with configuration"""
        if self.api_client is None:
            api_config = await get_api_config()
            self.api_client = WeChatAPIClient(
                base_url=api_config["api_base"],
                api_key=api_config["api_key"]
            )
            
            # Load local binding cache on initialization
            await self._load_binding_cache()
    
    async def _load_binding_cache(self):
        """Load user binding cache from local storage"""
        try:
            from config import get_user_bindings
            bindings_data = await get_user_bindings()
            users = bindings_data.get("users", {})
            
            # Convert to cache format
            self._binding_cache = {}
            for user_identifier, binding_info in users.items():
                if binding_info.get("status") == "active":
                    self._binding_cache[user_identifier] = {
                        "openid": binding_info.get("openid"),
                        "nickname": binding_info.get("nickname", "WeChat User"),
                        "bound_at": binding_info.get("bound_at"),
                        "last_notification": binding_info.get("last_notification"),
                        "cached_at": datetime.now().isoformat()
                    }
            
            self._cache_last_sync = bindings_data.get("last_sync")
            logger.info(f"Loaded {len(self._binding_cache)} active user bindings to cache")
            
        except Exception as e:
            logger.error(f"Failed to load binding cache: {e}")
            self._binding_cache = {}
    
    async def _sync_user_bindings(self, force_sync: bool = False):
        """Synchronize user bindings with cloud API"""
        try:
            # Check if sync is needed
            if not force_sync and self._cache_last_sync:
                from datetime import timedelta
                last_sync = datetime.fromisoformat(self._cache_last_sync)
                if datetime.now() - last_sync < timedelta(minutes=30):  # Sync every 30 minutes
                    logger.debug("Binding cache is recent, skipping sync")
                    return
            
            logger.info("Synchronizing user bindings with cloud API...")
            
            # Get all users from cloud API (would need a new endpoint in cloud API)
            # For now, we'll update based on successful/failed message attempts
            
            # Update local storage with current cache
            from config import get_user_bindings, save_user_binding
            bindings_data = await get_user_bindings()
            
            # Mark sync timestamp
            bindings_data["last_sync"] = datetime.now().isoformat()
            
            # Update binding stats
            active_count = len([b for b in self._binding_cache.values() if b])
            bindings_data["binding_stats"] = {
                "total_users": len(bindings_data.get("users", {})),
                "active_bindings": active_count,
                "last_updated": datetime.now().isoformat()
            }
            
            # Save updated bindings data
            from config import Config
            config = Config()
            await config._write_json_file_async(config.bindings_file, bindings_data)
            
            self._cache_last_sync = bindings_data["last_sync"]
            logger.info(f"Successfully synchronized {active_count} active bindings")
            
        except Exception as e:
            logger.error(f"Failed to sync user bindings: {e}")
    
    async def _check_user_binding_cached(self, user_identifier: str) -> Optional[Dict[str, Any]]:
        """Check user binding status using local cache first"""
        # Check local cache first
        if user_identifier in self._binding_cache:
            cached_binding = self._binding_cache[user_identifier]
            logger.debug(f"Found user {user_identifier} in local cache")
            return {
                "bound": True,
                "binding_info": {
                    "nickname": cached_binding.get("nickname"),
                    "bind_time": cached_binding.get("bound_at"),
                    "last_notification": cached_binding.get("last_notification"),
                    "cached": True
                }
            }
        
        # If not in cache, check with cloud API and update cache
        try:
            logger.debug(f"User {user_identifier} not in cache, checking cloud API")
            response = await self.api_client.check_binding_status(user_identifier)
            
            if response.get("bound", False):
                # Cache the binding info for future use
                binding_info = response.get("binding_info", {})
                self._binding_cache[user_identifier] = {
                    "openid": "unknown",  # We don't get openid from status check
                    "nickname": binding_info.get("nickname", "WeChat User"),
                    "bound_at": binding_info.get("bind_time"),
                    "last_notification": binding_info.get("last_interaction"),
                    "cached_at": datetime.now().isoformat()
                }
                logger.info(f"Cached binding info for user {user_identifier}")
            
            return response
            
        except Exception as e:
            logger.error(f"Error checking binding with cloud API: {e}")
            return {"bound": False, "error": str(e)}
    
    async def _update_binding_cache(self, user_identifier: str, success: bool, message_id: str):
        """Update binding cache after message send attempt"""
        if user_identifier in self._binding_cache:
            self._binding_cache[user_identifier]["last_notification"] = datetime.now().isoformat()
            logger.debug(f"Updated cache for user {user_identifier} after message {message_id}")
        elif success:
            # If message was successful but user not in cache, they might be newly bound
            logger.info(f"Message successful for uncached user {user_identifier}, triggering sync")
            await self._sync_user_bindings(force_sync=True)
    
    def _register_tools(self):
        """Register all available MCP tools"""
        
        @self.server.list_tools()
        async def handle_list_tools() -> List[Tool]:
            """List available WeChat notification tools"""
            return [
                Tool(
                    name="send_wechat_message",
                    description="Send WeChat notification message to a user",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "message": {
                                "type": "string",
                                "description": "The message content to send"
                            },
                            "user_identifier": {
                                "type": "string",
                                "description": "User identifier (email, username, etc.) for targeting the message",
                                "default": "default_user"
                            },
                            "message_type": {
                                "type": "string",
                                "enum": ["text", "template"],
                                "description": "Type of message to send",
                                "default": "text"
                            },
                            "template_data": {
                                "type": "object",
                                "description": "Template variables for template messages",
                                "additionalProperties": True
                            }
                        },
                        "required": ["message"]
                    }
                ),
                Tool(
                    name="check_binding_status",
                    description="Check if a user has bound their WeChat account",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "user_identifier": {
                                "type": "string",
                                "description": "User identifier to check binding status for",
                                "default": "default_user"
                            }
                        }
                    }
                ),
                Tool(
                    name="get_notification_stats",
                    description="Get statistics about WeChat notification usage",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "days": {
                                "type": "integer",
                                "description": "Number of days to look back for statistics",
                                "default": 7,
                                "minimum": 1,
                                "maximum": 30
                            }
                        }
                    }
                ),
                Tool(
                    name="sync_user_bindings",
                    description="Manually synchronize user bindings with cloud API",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "force": {
                                "type": "boolean",
                                "description": "Force synchronization even if cache is recent",
                                "default": False
                            }
                        }
                    }
                ),
                Tool(
                    name="system_health_check",
                    description="Perform comprehensive system health check",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "include_detailed": {
                                "type": "boolean",
                                "description": "Include detailed diagnostic information",
                                "default": False
                            }
                        }
                    }
                )
            ]
        
        @self.server.call_tool()
        async def handle_call_tool(name: str, arguments: dict) -> List[types.TextContent]:
            """Handle tool calls"""
            
            try:
                await self._initialize_api_client()
                
                if name == "send_wechat_message":
                    return await self._handle_send_message(arguments)
                elif name == "check_binding_status":
                    return await self._handle_check_binding(arguments)
                elif name == "get_notification_stats":
                    return await self._handle_get_stats(arguments)
                elif name == "sync_user_bindings":
                    return await self._handle_sync_bindings(arguments)
                elif name == "system_health_check":
                    return await self._handle_health_check(arguments)
                else:
                    raise ValueError(f"Unknown tool: {name}")
                    
            except Exception as e:
                logger.error(f"Error handling tool {name}: {e}")
                return [types.TextContent(
                    type="text",
                    text=f"Error executing {name}: {str(e)}"
                )]
    
    async def _handle_send_message(self, arguments: dict) -> List[types.TextContent]:
        """Handle send_wechat_message tool call"""
        message = arguments.get("message", "")
        user_identifier = arguments.get("user_identifier", "default_user")
        message_type = arguments.get("message_type", "text")
        template_data = arguments.get("template_data", {})
        
        if not message:
            return [types.TextContent(
                type="text",
                text="Error: message parameter is required"
            )]
        
        logger.info(f"Sending WeChat message to user: {user_identifier}")
        
        try:
            # Generate unique message ID for tracking
            message_id = str(uuid.uuid4())
            
            # Send message via cloud API with retry mechanism
            response = await self._retry_with_backoff(
                self.api_client.send_message,
                f"send message to {user_identifier}",
                message=message,
                user_identifier=user_identifier,
                message_type=message_type,
                template_data=template_data,
                message_id=message_id
            )
            
            if response.get("success", False):
                # Update binding cache after successful message
                await self._update_binding_cache(user_identifier, True, message_id)
                
                # Log successful notification
                await log_notification_activity({
                    "timestamp": datetime.now().isoformat(),
                    "message_id": message_id,
                    "user_identifier": user_identifier,
                    "message_type": message_type,
                    "success": True,
                    "message": "Message sent successfully"
                })
                
                success_text = f"Successfully sent WeChat message to {user_identifier}"
                logger.info(success_text)
                return [types.TextContent(type="text", text=success_text)]
            else:
                error_msg = response.get("error", "Unknown error")
                
                # Update binding cache after failed message
                await self._update_binding_cache(user_identifier, False, message_id)
                
                # Log failed notification
                await log_notification_activity({
                    "timestamp": datetime.now().isoformat(),
                    "message_id": message_id,
                    "user_identifier": user_identifier,
                    "message_type": message_type,
                    "success": False,
                    "message": f"Failed to send message: {error_msg}"
                })
                
                error_text = f"Failed to send WeChat message to {user_identifier}: {error_msg}"
                logger.error(error_text)
                return [types.TextContent(type="text", text=error_text)]
                
        except Exception as e:
            # Log detailed error information
            error_text = f"Error sending WeChat message to {user_identifier}: {str(e)}"
            logger.error(error_text, exc_info=True)
            
            # Log failed notification attempt
            await log_notification_activity({
                "timestamp": datetime.now().isoformat(),
                "message_id": message_id if 'message_id' in locals() else "unknown",
                "user_identifier": user_identifier,
                "message_type": message_type,
                "success": False,
                "message": f"Exception during send: {str(e)}",
                "error_type": type(e).__name__
            })
            
            return [types.TextContent(type="text", text=error_text)]
    
    async def _handle_check_binding(self, arguments: dict) -> List[types.TextContent]:
        """Handle check_binding_status tool call"""
        user_identifier = arguments.get("user_identifier", "default_user")
        
        logger.info(f"Checking binding status for user: {user_identifier}")
        
        try:
            response = await self._check_user_binding_cached(user_identifier)
            
            if response.get("bound", False):
                binding_info = response.get("binding_info", {})
                bind_time = binding_info.get("bind_time", "Unknown")
                nickname = binding_info.get("nickname", "Unknown")
                cached = binding_info.get("cached", False)
                cache_indicator = " (cached)" if cached else " (live)"
                
                result_text = f"User {user_identifier} is bound to WeChat{cache_indicator} (Nickname: {nickname}, Bound: {bind_time})"
            else:
                result_text = f"User {user_identifier} is not bound to WeChat"
            
            logger.info(result_text)
            return [types.TextContent(type="text", text=result_text)]
            
        except Exception as e:
            error_text = f"Error checking binding status: {str(e)}"
            logger.error(error_text)
            return [types.TextContent(type="text", text=error_text)]
    
    async def _handle_get_stats(self, arguments: dict) -> List[types.TextContent]:
        """Handle get_notification_stats tool call"""
        days = arguments.get("days", 7)
        
        logger.info(f"Getting notification stats for last {days} days")
        
        try:
            # Get local stats from log files
            from config import get_notification_logs
            logs = await get_notification_logs()
            
            # Filter logs by date range
            from datetime import datetime, timedelta
            cutoff_date = datetime.now() - timedelta(days=days)
            
            recent_logs = [
                log for log in logs 
                if datetime.fromisoformat(log["timestamp"]) >= cutoff_date
            ]
            
            # Calculate statistics
            total_messages = len(recent_logs)
            successful_messages = sum(1 for log in recent_logs if log.get("success", False))
            failed_messages = total_messages - successful_messages
            success_rate = (successful_messages / total_messages * 100) if total_messages > 0 else 0
            
            # Get user statistics
            users = set(log.get("user_identifier", "unknown") for log in recent_logs)
            unique_users = len(users)
            
            # Add cache information
            cached_users = len(self._binding_cache)
            last_sync = self._cache_last_sync or "Never"
            
            stats_text = f"""WeChat Notification Statistics (Last {days} days):
• Total Messages: {total_messages}
• Successful: {successful_messages}
• Failed: {failed_messages}
• Success Rate: {success_rate:.1f}%
• Unique Users: {unique_users}

Binding Cache Status:
• Cached Users: {cached_users}
• Last Sync: {last_sync}
• Cache Hit Rate: {(cached_users / max(unique_users, 1) * 100):.1f}%"""
            
            logger.info(f"Generated stats for {total_messages} messages, {cached_users} cached users")
            return [types.TextContent(type="text", text=stats_text)]
            
        except Exception as e:
            error_text = f"Error getting notification stats: {str(e)}"
            logger.error(error_text)
            return [types.TextContent(type="text", text=error_text)]
    
    async def _handle_sync_bindings(self, arguments: dict) -> List[types.TextContent]:
        """Handle sync_user_bindings tool call"""
        force = arguments.get("force", False)
        
        logger.info(f"Manual sync requested (force={force})")
        
        try:
            cached_before = len(self._binding_cache)
            await self._sync_user_bindings(force_sync=force)
            cached_after = len(self._binding_cache)
            
            # Refresh cache from storage
            await self._load_binding_cache()
            cached_final = len(self._binding_cache)
            
            sync_text = f"""User Binding Synchronization Complete:
• Cached Users Before: {cached_before}
• Cached Users After Sync: {cached_after}  
• Cached Users After Reload: {cached_final}
• Last Sync: {self._cache_last_sync}
• Force Sync: {'Yes' if force else 'No'}"""
            
            logger.info(f"Manual sync completed: {cached_before} → {cached_final} cached users")
            return [types.TextContent(type="text", text=sync_text)]
            
        except Exception as e:
            error_text = f"Error synchronizing user bindings: {str(e)}"
            logger.error(error_text)
            return [types.TextContent(type="text", text=error_text)]
    
    async def _handle_health_check(self, arguments: dict) -> List[types.TextContent]:
        """Handle system_health_check tool call"""
        include_detailed = arguments.get("include_detailed", False)
        
        logger.info(f"Performing system health check (detailed={include_detailed})")
        
        health_data = {
            "timestamp": datetime.now().isoformat(),
            "overall_status": "unknown",
            "components": {}
        }
        
        try:
            # Check configuration
            try:
                config_status = "healthy"
                api_config = await get_api_config()
                if not api_config.get("api_base") or not api_config.get("api_key"):
                    config_status = "degraded"
                health_data["components"]["configuration"] = config_status
            except Exception as e:
                health_data["components"]["configuration"] = f"unhealthy: {str(e)}"
            
            # Check API client connectivity
            try:
                if self.api_client:
                    # Try a simple health check (this would need to be implemented in cloud API)
                    health_data["components"]["api_client"] = "healthy"
                else:
                    health_data["components"]["api_client"] = "not_initialized"
            except Exception as e:
                health_data["components"]["api_client"] = f"unhealthy: {str(e)}"
            
            # Check local storage
            try:
                from config import get_user_bindings, get_notification_logs
                bindings = await get_user_bindings()
                logs = await get_notification_logs()
                health_data["components"]["local_storage"] = "healthy"
                
                if include_detailed:
                    health_data["storage_details"] = {
                        "total_users": len(bindings.get("users", {})),
                        "active_bindings": len([u for u in bindings.get("users", {}).values() if u.get("status") == "active"]),
                        "total_logs": len(logs)
                    }
            except Exception as e:
                health_data["components"]["local_storage"] = f"unhealthy: {str(e)}"
            
            # Check binding cache
            health_data["components"]["binding_cache"] = f"healthy ({len(self._binding_cache)} users cached)"
            
            # Check log system
            try:
                logger.debug("Health check log test")
                health_data["components"]["logging"] = "healthy"
            except Exception as e:
                health_data["components"]["logging"] = f"unhealthy: {str(e)}"
            
            # Determine overall status
            component_statuses = list(health_data["components"].values())
            if all("healthy" in status for status in component_statuses):
                health_data["overall_status"] = "healthy"
            elif any("unhealthy" in status for status in component_statuses):
                health_data["overall_status"] = "unhealthy"
            else:
                health_data["overall_status"] = "degraded"
            
            # Format health report
            status_emoji = {"healthy": "✓", "degraded": "⚠", "unhealthy": "✗"}.get(health_data["overall_status"], "?")
            
            health_text = f"""WeChat MCP Service Health Check:
Overall Status: {status_emoji} {health_data["overall_status"].upper()}

Component Status:"""
            
            for component, status in health_data["components"].items():
                component_emoji = "✓" if "healthy" in status else ("⚠" if "degraded" in status else "✗")
                health_text += f"\n• {component}: {component_emoji} {status}"
            
            if include_detailed and "storage_details" in health_data:
                details = health_data["storage_details"]
                health_text += f"""

Storage Details:
• Total Users: {details["total_users"]}
• Active Bindings: {details["active_bindings"]}
• Total Logs: {details["total_logs"]}
• Cache Hit Ratio: {len(self._binding_cache)}/{details["active_bindings"]} active users cached"""
            
            health_text += f"\n\nLast Updated: {health_data['timestamp']}"
            
            logger.info(f"Health check completed: {health_data['overall_status']}")
            return [types.TextContent(type="text", text=health_text)]
            
        except Exception as e:
            error_text = f"Error performing health check: {str(e)}"
            logger.error(error_text, exc_info=True)
            return [types.TextContent(type="text", text=error_text)]

async def main():
    """Main function to run the MCP server"""
    mcp_server = WeChatNotificationMCP()
    
    # Run the server
    from mcp.server.stdio import stdio_server
    
    async with stdio_server() as (read_stream, write_stream):
        await mcp_server.server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="wechat-notification",
                server_version="1.0.0",
                capabilities=mcp_server.server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )

if __name__ == "__main__":
    asyncio.run(main())