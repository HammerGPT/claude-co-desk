"""
WeChat Notification MCP Service
A Model Context Protocol server for WeChat public account notifications
"""

__version__ = "1.0.0"
__author__ = "Claude Co-Desk Team"
__description__ = "WeChat Notification MCP Service for Claude Co-Desk"

# Module exports
from .server import WeChatNotificationMCP
from .api_client import WeChatAPIClient
from .config import get_config, get_api_config

__all__ = [
    "WeChatNotificationMCP",
    "WeChatAPIClient", 
    "get_config",
    "get_api_config"
]