"""
WeChat Public Account API Client
微信公众号API客户端封装
提供完整的微信公众号API功能，包括消息发送、二维码生成等
"""

import aiohttp
import json
import hashlib
import logging
import time
from typing import Dict, Optional, Any
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

logger = logging.getLogger("wechat-api")

class WeChatAPIError(Exception):
    """微信API错误"""
    pass

class WeChatPublicAPI:
    """微信公众号API客户端"""
    
    def __init__(self, app_id: str, app_secret: str, token: str = None, encoding_aes_key: str = None):
        self.app_id = app_id
        self.app_secret = app_secret
        self.token = token
        self.encoding_aes_key = encoding_aes_key
        
        # API URLs
        self.base_url = "https://api.weixin.qq.com"
        self.token_url = f"{self.base_url}/cgi-bin/token"
        self.message_url = f"{self.base_url}/cgi-bin/message/custom/send"
        self.qr_create_url = f"{self.base_url}/cgi-bin/qrcode/create"
        self.qr_show_url = "https://mp.weixin.qq.com/cgi-bin/showqrcode"
        
        # Access token cache
        self._access_token = None
        self._token_expires_at = None
        
        # HTTP session
        self._session: Optional[aiohttp.ClientSession] = None
        
        logger.info(f"WeChat API client initialized for AppID: {app_id}")
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """获取HTTP会话"""
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=30)
            # 完整的UTF-8编码头设置
            headers = {
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': 'application/json',
                'Accept-Charset': 'utf-8',
                'User-Agent': 'Claude-Co-Desk-WeChat-API/1.0'
            }
            connector = aiohttp.TCPConnector(enable_cleanup_closed=True)
            self._session = aiohttp.ClientSession(
                timeout=timeout,
                headers=headers,
                connector=connector
            )
        return self._session
    
    async def close(self):
        """关闭HTTP会话"""
        if self._session and not self._session.closed:
            await self._session.close()
    
    async def get_access_token(self) -> str:
        """获取访问令牌"""
        
        # 检查缓存的token是否有效
        if (self._access_token and 
            self._token_expires_at and 
            datetime.now() < self._token_expires_at):
            return self._access_token
        
        logger.info("Fetching new access token from WeChat API")
        
        params = {
            "grant_type": "client_credential",
            "appid": self.app_id,
            "secret": self.app_secret
        }
        
        session = await self._get_session()
        
        try:
            async with session.get(self.token_url, params=params) as response:
                data = await response.json()
                
                if "access_token" in data:
                    self._access_token = data["access_token"]
                    expires_in = data.get("expires_in", 7200)  # 默认2小时
                    # 提前5分钟过期，避免边界情况
                    self._token_expires_at = datetime.now() + timedelta(seconds=expires_in - 300)
                    
                    logger.info(f"Access token obtained, expires at {self._token_expires_at}")
                    return self._access_token
                else:
                    error_code = data.get("errcode", "unknown")
                    error_msg = data.get("errmsg", "Unknown error")
                    raise WeChatAPIError(f"Failed to get access token: {error_code} - {error_msg}")
                    
        except aiohttp.ClientError as e:
            logger.error(f"HTTP error getting access token: {e}")
            raise WeChatAPIError(f"Network error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error getting access token: {e}")
            raise WeChatAPIError(f"Unexpected error: {str(e)}")
    
    async def send_text_message(self, openid: str, content: str) -> Dict[str, Any]:
        """发送文本消息"""
        
        # 验证和清理消息内容
        if not content or not content.strip():
            raise WeChatAPIError("Message content cannot be empty")
        
        # 确保内容为UTF-8编码
        try:
            content_utf8 = content.encode('utf-8').decode('utf-8')
        except UnicodeError as e:
            logger.error(f"Content encoding error: {e}")
            raise WeChatAPIError(f"Message content encoding error: {str(e)}")
        
        logger.info(f"Sending message to {openid}: {content_utf8[:50]}...")
        logger.debug(f"Message content bytes: {content_utf8.encode('utf-8')}")
        
        access_token = await self.get_access_token()
        
        message_data = {
            "touser": openid,
            "msgtype": "text",
            "text": {
                "content": content_utf8
            }
        }
        
        # 手动序列化JSON确保中文不被转义
        json_payload = json.dumps(message_data, ensure_ascii=False, separators=(',', ':'))
        logger.info(f"JSON payload: {json_payload}")
        
        params = {"access_token": access_token}
        session = await self._get_session()
        
        try:
            async with session.post(
                self.message_url, 
                params=params,
                data=json_payload.encode('utf-8'),
                headers={
                    'Content-Type': 'application/json; charset=utf-8'
                }
            ) as response:
                # 获取响应内容用于调试
                response_text = await response.text()
                logger.debug(f"WeChat API response: {response_text}")
                
                result = await response.json()
                
                if result.get("errcode", 0) == 0:
                    logger.info(f"Message sent successfully to {openid}")
                else:
                    error_msg = result.get("errmsg", "Unknown error")
                    logger.error(f"Failed to send message to {openid}: {error_msg}")
                
                return result
                
        except aiohttp.ClientError as e:
            logger.error(f"HTTP error sending message: {e}")
            raise WeChatAPIError(f"Network error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error sending message: {e}")
            raise WeChatAPIError(f"Unexpected error: {str(e)}")
    
    async def create_qr_code(self, scene_str: str, expire_seconds: int = 3600) -> Dict[str, Any]:
        """创建临时二维码"""
        
        access_token = await self.get_access_token()
        
        qr_data = {
            "expire_seconds": expire_seconds,
            "action_name": "QR_STR_SCENE",
            "action_info": {
                "scene": {
                    "scene_str": scene_str
                }
            }
        }
        
        params = {"access_token": access_token}
        session = await self._get_session()
        
        try:
            async with session.post(
                self.qr_create_url,
                params=params,
                json=qr_data
            ) as response:
                result = await response.json()
                
                if result.get("errcode", 0) == 0 or "ticket" in result:
                    logger.info(f"QR code created successfully for scene: {scene_str}")
                else:
                    error_msg = result.get("errmsg", "Unknown error")
                    logger.error(f"Failed to create QR code: {error_msg}")
                
                return result
                
        except aiohttp.ClientError as e:
            logger.error(f"HTTP error creating QR code: {e}")
            raise WeChatAPIError(f"Network error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error creating QR code: {e}")
            raise WeChatAPIError(f"Unexpected error: {str(e)}")
    
    async def send_template_message(
        self, 
        openid: str, 
        template_id: str, 
        data: Dict[str, Dict[str, str]],
        url: str = None,
        miniprogram: Dict[str, str] = None
    ) -> Dict[str, Any]:
        """发送模板消息"""
        
        access_token = await self.get_access_token()
        
        template_data = {
            "touser": openid,
            "template_id": template_id,
            "data": data
        }
        
        if url:
            template_data["url"] = url
        
        if miniprogram:
            template_data["miniprogram"] = miniprogram
        
        # 手动序列化JSON确保中文不被转义
        json_payload = json.dumps(template_data, ensure_ascii=False, separators=(',', ':'))
        logger.info(f"Template JSON payload: {json_payload}")
        
        template_url = f"{self.base_url}/cgi-bin/message/template/send"
        params = {"access_token": access_token}
        session = await self._get_session()
        
        try:
            async with session.post(
                template_url,
                params=params,
                data=json_payload.encode('utf-8'),
                headers={
                    'Content-Type': 'application/json; charset=utf-8'
                }
            ) as response:
                # 获取响应内容用于调试
                response_text = await response.text()
                logger.debug(f"WeChat Template API response: {response_text}")
                
                result = await response.json()
                
                if result.get("errcode", 0) == 0:
                    logger.info(f"Template message sent successfully to {openid}")
                else:
                    error_msg = result.get("errmsg", "Unknown error")
                    logger.error(f"Failed to send template message to {openid}: {error_msg}")
                
                return result
                
        except aiohttp.ClientError as e:
            logger.error(f"HTTP error sending template message: {e}")
            raise WeChatAPIError(f"Network error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error sending template message: {e}")
            raise WeChatAPIError(f"Unexpected error: {str(e)}")
    
    def verify_signature(self, signature: str, timestamp: str, nonce: str) -> bool:
        """验证微信签名"""
        if not self.token:
            logger.warning("Token not configured, cannot verify signature")
            return False
        
        try:
            # 将token、timestamp、nonce三个参数进行字典序排序
            params = [self.token, timestamp, nonce]
            params.sort()
            
            # 将三个参数字符串拼接成一个字符串进行sha1加密
            temp_str = "".join(params)
            hash_obj = hashlib.sha1(temp_str.encode('utf-8'))
            hash_str = hash_obj.hexdigest()
            
            # 开发者获得加密后的字符串可与signature对比，标识该请求来源于微信
            return hash_str == signature
            
        except Exception as e:
            logger.error(f"Error verifying signature: {e}")
            return False
    
    def parse_xml_message(self, xml_data: str) -> Dict[str, str]:
        """解析XML消息"""
        try:
            root = ET.fromstring(xml_data)
            message = {}
            
            for child in root:
                message[child.tag] = child.text
            
            return message
            
        except ET.ParseError as e:
            logger.error(f"Error parsing XML message: {e}")
            raise WeChatAPIError(f"Invalid XML format: {str(e)}")
    
    def create_xml_response(self, to_user: str, from_user: str, msg_type: str, content: str) -> str:
        """创建XML响应"""
        timestamp = int(time.time())
        
        if msg_type == "text":
            xml_template = """
            <xml>
                <ToUserName><![CDATA[{to_user}]]></ToUserName>
                <FromUserName><![CDATA[{from_user}]]></FromUserName>
                <CreateTime>{timestamp}</CreateTime>
                <MsgType><![CDATA[text]]></MsgType>
                <Content><![CDATA[{content}]]></Content>
            </xml>
            """
            
            return xml_template.format(
                to_user=to_user,
                from_user=from_user,
                timestamp=timestamp,
                content=content
            ).strip()
        
        return ""
    
    async def get_user_info(self, openid: str) -> Dict[str, Any]:
        """获取用户基本信息"""
        
        access_token = await self.get_access_token()
        
        user_info_url = f"{self.base_url}/cgi-bin/user/info"
        params = {
            "access_token": access_token,
            "openid": openid,
            "lang": "zh_CN"
        }
        
        session = await self._get_session()
        
        try:
            async with session.get(user_info_url, params=params) as response:
                result = await response.json()
                
                if result.get("errcode", 0) == 0 or "openid" in result:
                    logger.info(f"User info retrieved successfully for {openid}")
                    logger.info(f"User info details: subscribe={result.get('subscribe', 'unknown')}, nickname='{result.get('nickname', '')}', headimgurl='{result.get('headimgurl', '')}'")
                else:
                    error_msg = result.get("errmsg", "Unknown error")
                    logger.error(f"Failed to get user info for {openid}: {error_msg}")
                    logger.error(f"Full API response: {result}")
                
                return result
                
        except aiohttp.ClientError as e:
            logger.error(f"HTTP error getting user info: {e}")
            raise WeChatAPIError(f"Network error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error getting user info: {e}")
            raise WeChatAPIError(f"Unexpected error: {str(e)}")
    
    async def __aenter__(self):
        """异步上下文管理器入口"""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """异步上下文管理器出口"""
        await self.close()