"""
WeChat Cloud API Client
Handles communication with the cloud-based WeChat notification service
"""

import aiohttp
import json
import logging
from typing import Dict, Optional, Any
import asyncio

logger = logging.getLogger("wechat-api-client")

class WeChatAPIClient:
    """Client for communicating with WeChat cloud notification API"""
    
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.session: Optional[aiohttp.ClientSession] = None
        
        logger.info(f"WeChat API Client initialized with base URL: {base_url}")
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session"""
        if self.session is None or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=30)  # 30 second timeout
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "Claude-CoDesk-WeChat-MCP/1.0",
                "Authorization": f"Bearer {self.api_key}"
            }
            self.session = aiohttp.ClientSession(
                timeout=timeout,
                headers=headers
            )
        return self.session
    
    async def close(self):
        """Close the HTTP session"""
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def _make_request(
        self, 
        method: str, 
        endpoint: str, 
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Make HTTP request to the API"""
        session = await self._get_session()
        url = f"{self.base_url}{endpoint}"
        
        try:
            logger.debug(f"Making {method} request to {url}")
            
            if method.upper() == "GET":
                async with session.get(url, params=data) as response:
                    result = await self._handle_response(response)
            elif method.upper() == "POST":
                async with session.post(url, json=data) as response:
                    result = await self._handle_response(response)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            logger.debug(f"API request successful: {endpoint}")
            return result
            
        except aiohttp.ClientError as e:
            logger.error(f"HTTP client error for {endpoint}: {e}")
            return {
                "success": False,
                "error": f"Network error: {str(e)}"
            }
        except Exception as e:
            logger.error(f"Unexpected error for {endpoint}: {e}")
            return {
                "success": False,
                "error": f"Unexpected error: {str(e)}"
            }
    
    async def _handle_response(self, response: aiohttp.ClientResponse) -> Dict[str, Any]:
        """Handle HTTP response"""
        try:
            content = await response.text()
            
            if response.status == 200:
                try:
                    return json.loads(content)
                except json.JSONDecodeError:
                    return {"success": True, "data": content}
            else:
                logger.error(f"API error {response.status}: {content}")
                return {
                    "success": False,
                    "error": f"HTTP {response.status}: {content}"
                }
                
        except Exception as e:
            logger.error(f"Error handling response: {e}")
            return {
                "success": False,
                "error": f"Response handling error: {str(e)}"
            }
    
    async def send_message(
        self,
        message: str,
        user_identifier: str,
        message_type: str = "text",
        template_data: Optional[Dict[str, Any]] = None,
        message_id: Optional[str] = None,
        task_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send WeChat message via cloud API - using same format as test functionality"""
        
        # Determine task name with priority: direct parameter > template_data > intelligent fallback
        final_task_name = "AI任务"  # Default fallback
        
        if task_name and task_name.strip():
            # Use directly passed task_name (highest priority)
            final_task_name = task_name.strip()[:15]  # Limit to 15 characters
        elif template_data and template_data.get("task_name"):
            # Use task_name from template_data (medium priority)
            final_task_name = str(template_data["task_name"]).strip()[:15]
        else:
            # Smart fallback based on message content (lowest priority)
            message_lower = message.lower()
            if any(keyword in message_lower for keyword in ["天气", "weather", "预报", "气温"]):
                final_task_name = "天气预报"
            elif any(keyword in message_lower for keyword in ["文档", "document", "文件", "file"]):
                final_task_name = "文档处理"
            elif any(keyword in message_lower for keyword in ["分析", "analysis", "报告", "report"]):
                final_task_name = "数据分析"
            elif any(keyword in message_lower for keyword in ["搜索", "search", "查询", "query"]):
                final_task_name = "信息搜索"
        
        # Use same payload format as working test functionality (app.py:2631-2635)
        payload = {
            "user_identifier": user_identifier,
            "message": message,
            "task_name": final_task_name
        }
        
        # Add optional fields for compatibility
        if message_id:
            payload["message_id"] = message_id
        if message_type != "text":
            payload["message_type"] = message_type
        if template_data and "template_data" in template_data:
            payload["template_data"] = template_data["template_data"]
        
        logger.info(f"Sending message to user {user_identifier} via cloud API (same format as test)")
        
        return await self._make_request("POST", "/send_message", payload)
    
    async def check_binding_status(self, user_identifier: str) -> Dict[str, Any]:
        """Check if user is bound to WeChat"""
        
        params = {"user_identifier": user_identifier}
        
        logger.info(f"Checking binding status for user {user_identifier}")
        
        return await self._make_request("GET", "/binding_status", params)
    
    async def generate_binding_qr(self, user_identifier: str) -> Dict[str, Any]:
        """Generate binding QR code for user"""
        
        payload = {
            "user_identifier": user_identifier,
            "action": "bind"
        }
        
        logger.info(f"Generating binding QR code for user {user_identifier}")
        
        return await self._make_request("POST", "/generate_qr", payload)
    
    async def get_api_status(self) -> Dict[str, Any]:
        """Check API service status"""
        
        logger.debug("Checking API service status")
        
        return await self._make_request("GET", "/health")
    
    async def __aenter__(self):
        """Async context manager entry"""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()

# Utility functions for easier usage

async def create_client(base_url: str, api_key: str) -> WeChatAPIClient:
    """Create and return a WeChat API client"""
    return WeChatAPIClient(base_url, api_key)

async def test_connection(base_url: str, api_key: str) -> bool:
    """Test connection to the WeChat API"""
    async with WeChatAPIClient(base_url, api_key) as client:
        try:
            response = await client.get_api_status()
            return response.get("success", False)
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return False