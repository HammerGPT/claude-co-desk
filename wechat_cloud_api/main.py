#!/usr/bin/env python3
"""
WeChat Notification Cloud API Service
基于FastAPI的微信公众号通知云端服务
提供安全的微信公众号API访问和用户绑定管理
"""

import os
import json
import logging
import hashlib
import uuid
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import asyncio

from fastapi import FastAPI, HTTPException, Depends, Security, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import uvicorn

from wechat_api import WeChatPublicAPI, WeChatAPIError
from user_manager import UserBindingManager
from config import get_settings, Settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("wechat-cloud-api")

# FastAPI app initialization
app = FastAPI(
    title="WeChat Notification Cloud API",
    description="微信公众号通知云端服务API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Security
security = HTTPBearer()

# Global instances
settings: Settings = get_settings()

# CORS middleware - configured with settings
cors_origins = [origins.strip() for origins in settings.cors_origins.split(",")]
cors_methods = [methods.strip() for methods in settings.cors_methods.split(",")]
cors_headers = [headers.strip() for headers in settings.cors_headers.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=cors_methods,
    allow_headers=cors_headers,
)
wechat_api: Optional[WeChatPublicAPI] = None
user_manager: Optional[UserBindingManager] = None

# 微信模板消息配置
WECHAT_TEMPLATE_ID = "_SRxCTzhN3GyZdJwICYwyTizmiOXKDFzdEqq4sW8rb4"

def parse_message_to_template_data(message: str, user_identifier: str = "用户") -> Dict[str, Dict[str, str]]:
    """
    智能解析文字消息，转换为微信模板数据格式
    微信模板字段（工单完成通知）：
    - thing3: 项目名称
    - time11: 完成时间  
    - phrase15: 处理结果
    """
    
    # 默认模板数据（使用实际的微信模板字段名）
    template_data = {
        "thing3": {
            "value": "Claude Co-Desk",
            "color": "#173177"
        },
        "time11": {
            "value": datetime.now().strftime("%Y年%m月%d日 %H:%M"),
            "color": "#173177"
        },
        "phrase15": {
            "value": "处理完成",
            "color": "#173177"
        }
    }
    
    # 尝试从消息中提取项目名称
    project_patterns = [
        r"项目[:：]?\s*([^\n\r，,。.！!]+)",
        r"(?:完成|处理|执行)了?\s*([^\n\r，,。.！!]+)",
        r"^([^\n\r，,。.！!]{1,20})\s*(?:任务|项目|工作)",
    ]
    
    for pattern in project_patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            project_name = match.group(1).strip()
            if project_name and len(project_name) <= 30:  # thing字段限制长度
                template_data["thing3"]["value"] = project_name
                break
    
    # 尝试提取时间信息
    time_patterns = [
        r"(?:时间|于|在)\s*(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?\s*\d{1,2}:\d{1,2})",
        r"(\d{1,2}:\d{1,2})\s*(?:完成|结束|处理)",
        r"(?:今天|昨天|前天)\s*(\d{1,2}:\d{1,2})",
    ]
    
    for pattern in time_patterns:
        match = re.search(pattern, message)
        if match:
            time_str = match.group(1)
            # 将提取的时间转换为微信要求的格式
            if ":" in time_str and len(time_str) == 5:  # HH:MM 格式
                today = datetime.now()
                time_str = f"{today.year}年{today.month:02d}月{today.day:02d}日 {time_str}"
            template_data["time11"]["value"] = time_str
            break
    
    # 尝试提取处理结果
    result_patterns = [
        r"(?:结果|状态)[:：]?\s*([成功失败完成错误异常正常]+)",
        r"(?:已|成功|失败|完成|错误)\s*([^\n\r，,。.！!]{1,10})",
    ]
    
    for pattern in result_patterns:
        match = re.search(pattern, message)
        if match:
            result_str = match.group(1).strip()
            if result_str and len(result_str) <= 20:  # phrase字段限制20字符
                # 设置颜色：成功相关为绿色，失败相关为红色
                color = "#07C160" if any(word in result_str for word in ["成功", "完成", "正常"]) else "#FA5151"
                template_data["phrase15"]["value"] = result_str
                template_data["phrase15"]["color"] = color
                break
    
    logger.info(f"Parsed message template data: {template_data}")
    return template_data

# 挂载静态文件服务
from pathlib import Path
static_dir = Path(__file__).parent
app.mount("/test", StaticFiles(directory=str(static_dir), html=True), name="static")

# Request/Response Models
class SendMessageRequest(BaseModel):
    message: str = Field(..., description="消息内容")
    user_identifier: str = Field(..., description="用户标识符")
    message_type: str = Field(default="text", description="消息类型")
    template_data: Optional[Dict[str, Any]] = Field(default=None, description="模板数据")
    message_id: Optional[str] = Field(default=None, description="消息ID")

class SendMessageResponse(BaseModel):
    success: bool
    message_id: str
    message: str
    error: Optional[str] = None

class BindingStatusResponse(BaseModel):
    bound: bool
    binding_info: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class GenerateQRRequest(BaseModel):
    user_identifier: str = Field(..., description="用户标识符")
    action: str = Field(default="bind", description="二维码动作")

class GenerateQRResponse(BaseModel):
    success: bool
    qr_code_url: str
    bind_token: str
    expires_at: str
    error: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str
    services: Dict[str, str]

# Authentication
async def verify_api_key(credentials: HTTPAuthorizationCredentials = Security(security)):
    """验证API密钥"""
    token = credentials.credentials
    
    # 简单的API密钥验证
    valid_api_keys = [settings.api_keys] if isinstance(settings.api_keys, str) else settings.api_keys
    if token not in valid_api_keys:
        logger.warning(f"Invalid API key attempt: {token[:8]}...")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    
    return token

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    """应用启动事件"""
    global wechat_api, user_manager
    
    logger.info("Starting WeChat Cloud API Service...")
    
    try:
        # 初始化微信API客户端
        wechat_api = WeChatPublicAPI(
            app_id=settings.wechat_app_id,
            app_secret=settings.wechat_app_secret,
            token=settings.wechat_token,
            encoding_aes_key=settings.wechat_aes_key
        )
        
        # 初始化用户管理器
        user_manager = UserBindingManager(
            data_file=settings.user_bindings_file
        )
        
        logger.info("✓ WeChat API client initialized")
        logger.info("✓ User binding manager initialized")
        logger.info("✓ WeChat Cloud API Service started successfully")
        
    except Exception as e:
        logger.error(f"Failed to start service: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭事件"""
    logger.info("Shutting down WeChat Cloud API Service...")

# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """服务健康检查"""
    
    services_status = {}
    
    # 检查微信API连接
    try:
        if wechat_api:
            access_token = await wechat_api.get_access_token()
            services_status["wechat_api"] = "healthy" if access_token else "unhealthy"
        else:
            services_status["wechat_api"] = "not_initialized"
    except Exception as e:
        logger.error(f"WeChat API health check failed: {e}")
        services_status["wechat_api"] = "unhealthy"
    
    # 检查用户管理器
    try:
        if user_manager:
            services_status["user_manager"] = "healthy"
        else:
            services_status["user_manager"] = "not_initialized"
    except Exception as e:
        logger.error(f"User manager health check failed: {e}")
        services_status["user_manager"] = "unhealthy"
    
    return HealthResponse(
        status="healthy" if all(s == "healthy" for s in services_status.values()) else "degraded",
        timestamp=datetime.now().isoformat(),
        version="1.0.0",
        services=services_status
    )

@app.get("/wechat/test", response_class=HTMLResponse)
async def test_page():
    """测试页面"""
    try:
        with open("test_binding.html", "r", encoding="utf-8") as f:
            html_content = f.read()
        return HTMLResponse(content=html_content)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Test page not found")

# WeChat API endpoints
@app.post("/wechat/send_message", response_model=SendMessageResponse)
async def send_wechat_message(
    request: SendMessageRequest,
    api_key: str = Depends(verify_api_key)
):
    """发送微信消息"""
    
    if not wechat_api or not user_manager:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service not initialized"
        )
    
    message_id = request.message_id or str(uuid.uuid4())
    
    try:
        # 获取用户绑定信息
        binding = await user_manager.get_user_binding(request.user_identifier)
        if not binding:
            return SendMessageResponse(
                success=False,
                message_id=message_id,
                message="User not bound to WeChat",
                error="USER_NOT_BOUND"
            )
        
        openid = binding.get("openid")
        if not openid:
            return SendMessageResponse(
                success=False,
                message_id=message_id,
                message="Invalid binding data",
                error="INVALID_BINDING"
            )
        
        # 解析消息内容为模板数据
        template_data = parse_message_to_template_data(request.message, request.user_identifier)
        
        # 发送模板消息（完全替代文字消息）
        result = await wechat_api.send_template_message(
            openid=openid,
            template_id=WECHAT_TEMPLATE_ID,
            data=template_data
        )
        
        if result.get("errcode", 0) == 0:
            # 记录成功日志
            await user_manager.log_message_activity({
                "message_id": message_id,
                "user_identifier": request.user_identifier,
                "openid": openid,
                "message_type": request.message_type,
                "success": True,
                "timestamp": datetime.now().isoformat(),
                "wechat_response": result
            })
            
            return SendMessageResponse(
                success=True,
                message_id=message_id,
                message="Message sent successfully"
            )
        else:
            error_msg = result.get("errmsg", "Unknown WeChat API error")
            
            # 记录失败日志
            await user_manager.log_message_activity({
                "message_id": message_id,
                "user_identifier": request.user_identifier,
                "openid": openid,
                "message_type": request.message_type,
                "success": False,
                "timestamp": datetime.now().isoformat(),
                "error": error_msg,
                "wechat_response": result
            })
            
            return SendMessageResponse(
                success=False,
                message_id=message_id,
                message=f"Failed to send message: {error_msg}",
                error="WECHAT_API_ERROR"
            )
            
    except WeChatAPIError as e:
        logger.error(f"WeChat API error: {e}")
        return SendMessageResponse(
            success=False,
            message_id=message_id,
            message=f"WeChat API error: {str(e)}",
            error="WECHAT_API_ERROR"
        )
    except Exception as e:
        logger.error(f"Unexpected error sending message: {e}")
        return SendMessageResponse(
            success=False,
            message_id=message_id,
            message=f"Internal server error: {str(e)}",
            error="INTERNAL_ERROR"
        )

@app.get("/wechat/binding_status", response_model=BindingStatusResponse)
async def check_binding_status(
    user_identifier: str,
    api_key: str = Depends(verify_api_key)
):
    """检查用户绑定状态"""
    
    if not user_manager:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service not initialized"
        )
    
    try:
        binding = await user_manager.get_user_binding(user_identifier)
        
        if binding:
            return BindingStatusResponse(
                bound=True,
                binding_info={
                    "bind_time": binding.get("bind_time"),
                    "nickname": binding.get("nickname", "Unknown"),
                    "last_interaction": binding.get("last_interaction")
                }
            )
        else:
            return BindingStatusResponse(bound=False)
            
    except Exception as e:
        logger.error(f"Error checking binding status: {e}")
        return BindingStatusResponse(
            bound=False,
            error=str(e)
        )

@app.post("/wechat/generate_qr", response_model=GenerateQRResponse)
async def generate_binding_qr(
    request: GenerateQRRequest,
    api_key: str = Depends(verify_api_key)
):
    """生成绑定二维码"""
    
    if not wechat_api or not user_manager:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service not initialized"
        )
    
    try:
        # 生成绑定token
        bind_token = f"bind_{uuid.uuid4().hex[:8]}_{int(datetime.now().timestamp())}"
        expires_at = datetime.now() + timedelta(hours=1)  # 1小时过期
        
        # 保存绑定token
        await user_manager.save_bind_token(bind_token, {
            "user_identifier": request.user_identifier,
            "action": request.action,
            "created_at": datetime.now().isoformat(),
            "expires_at": expires_at.isoformat(),
            "status": "pending"
        })
        
        # 生成微信二维码
        qr_result = await wechat_api.create_qr_code(
            scene_str=bind_token,
            expire_seconds=3600  # 1小时
        )
        
        if qr_result.get("errcode", 0) == 0:
            ticket = qr_result.get("ticket")
            qr_code_url = f"https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket={ticket}"
            
            return GenerateQRResponse(
                success=True,
                qr_code_url=qr_code_url,
                bind_token=bind_token,
                expires_at=expires_at.isoformat()
            )
        else:
            error_msg = qr_result.get("errmsg", "Failed to create QR code")
            return GenerateQRResponse(
                success=False,
                qr_code_url="",
                bind_token="",
                expires_at="",
                error=error_msg
            )
            
    except Exception as e:
        logger.error(f"Error generating QR code: {e}")
        return GenerateQRResponse(
            success=False,
            qr_code_url="",
            bind_token="",
            expires_at="",
            error=str(e)
        )

@app.get("/wechat/webhook", response_class=PlainTextResponse)
async def wechat_webhook_verify(signature: str, timestamp: str, nonce: str, echostr: str):
    """微信webhook URL验证"""
    import hashlib
    
    # 验证签名
    token = settings.wechat_token
    tmp_arr = [token, timestamp, nonce]
    tmp_arr.sort()
    tmp_str = ''.join(tmp_arr)
    tmp_signature = hashlib.sha1(tmp_str.encode()).hexdigest()
    
    logger.info(f"验证参数 - token: {token}, timestamp: {timestamp}, nonce: {nonce}")
    logger.info(f"生成的签名: {tmp_signature}")
    logger.info(f"微信发送的签名: {signature}")
    
    if tmp_signature == signature:
        logger.info(f"Webhook verification successful, returning: {echostr}")
        return PlainTextResponse(content=echostr)  # 返回纯文本
    else:
        logger.error(f"Webhook verification failed: {tmp_signature} != {signature}")
        raise HTTPException(status_code=403, detail="Invalid signature")

@app.post("/wechat/webhook")
async def wechat_webhook(request: Request):
    """微信事件回调处理"""
    
    if not wechat_api or not user_manager:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service not initialized"
        )
    
    try:
        # 获取原始XML数据
        xml_data = await request.body()
        xml_str = xml_data.decode('utf-8')
        logger.info(f"Received webhook XML: {xml_str}")
        
        # 解析XML数据
        import xml.etree.ElementTree as ET
        root = ET.fromstring(xml_str)
        
        # 提取字段
        msg_type = root.find('MsgType')
        msg_type = msg_type.text if msg_type is not None else None
        
        event_type = root.find('Event')
        event_type = event_type.text if event_type is not None else None
        
        from_user = root.find('FromUserName')
        from_user = from_user.text if from_user is not None else None
        
        event_key = root.find('EventKey')
        event_key = event_key.text if event_key is not None else None
        
        logger.info(f"Parsed: MsgType={msg_type}, Event={event_type}, FromUser={from_user}, EventKey={event_key}")
        
        # 处理首次关注事件
        if msg_type == "event" and event_type == "subscribe":
            openid = from_user
            
            # 如果关注时携带场景值（扫码关注），处理绑定
            if event_key and event_key.startswith("qrscene_bind_"):
                scene_str = event_key.replace("qrscene_", "")
                bind_token = scene_str
                token_info = await user_manager.get_bind_token(bind_token)
                
                if token_info and token_info.get("status") == "pending":
                    user_identifier = token_info.get("user_identifier")
                    
                    # 检查该OpenID是否已经绑定过
                    existing_binding = await user_manager.get_user_binding_by_openid(openid)
                    if not existing_binding:
                        # 创建新用户绑定
                        await user_manager.create_user_binding(user_identifier, {
                            "openid": openid,
                            "bind_time": datetime.now().isoformat(),
                            "nickname": "WeChat User", 
                            "bind_token": bind_token
                        })
                        
                        # 更新token状态
                        await user_manager.update_bind_token(bind_token, {"status": "completed"})
                        
                        # 发送绑定成功中英文消息
                        bind_success_message = "感谢关注暴躁哐哐，已完成Claude Co-Desk系统通知注册。AI任务完成会自动收到通知信息。\n\nThank you for following BaoZao-KuangKuang. Claude Co-Desk system notification registration completed. You will automatically receive notifications when AI tasks are completed."
                        
                        await wechat_api.send_text_message(openid, bind_success_message)
                        
                        logger.info(f"User {user_identifier} bound successfully with openid {openid} on subscribe")
                    else:
                        # 用户已绑定，发送重复绑定提示
                        duplicate_message = "已注册Claude Co-Desk系统通知。\n\nAlready registered for Claude Co-Desk system notifications."
                        await wechat_api.send_text_message(openid, duplicate_message)
                        logger.info(f"OpenID {openid} already bound, sent duplicate binding message")
            else:
                # 普通关注，发送欢迎消息
                welcome_message = "感谢关注暴躁哐哐，已完成Claude Co-Desk系统通知注册。AI任务完成会自动收到通知信息。\n\nThank you for following BaoZao-KuangKuang. Claude Co-Desk system notification registration completed. You will automatically receive notifications when AI tasks are completed."
                
                try:
                    await wechat_api.send_text_message(openid, welcome_message)
                    logger.info(f"Welcome message sent to new follower: {openid}")
                except Exception as e:
                    logger.error(f"Failed to send welcome message to {openid}: {e}")
        
        elif msg_type == "event" and event_type == "SCAN":
            # 处理扫码事件
            openid = from_user
            scene_str = event_key
            
            if scene_str and scene_str.startswith("bind_"):
                # 处理绑定扫码
                bind_token = scene_str
                token_info = await user_manager.get_bind_token(bind_token)
                
                logger.info(f"Processing bind token: {bind_token}, token_info: {token_info}")
                
                if token_info and token_info.get("status") == "pending":
                    user_identifier = token_info.get("user_identifier")
                    
                    # 检查该OpenID是否已经绑定过
                    existing_binding = await user_manager.get_user_binding_by_openid(openid)
                    if existing_binding:
                        # 用户已绑定，发送重复绑定文字消息
                        duplicate_message = "已注册Claude Co-Desk系统通知。\n\nAlready registered for Claude Co-Desk system notifications."
                        
                        await wechat_api.send_text_message(openid, duplicate_message)
                        
                        # 更新token状态为已完成（避免pending状态堆积）
                        await user_manager.update_bind_token(bind_token, {"status": "completed"})
                        logger.info(f"OpenID {openid} already bound to {existing_binding.get('user_identifier')}, skipping duplicate binding")
                    else:
                        # 创建新用户绑定
                        await user_manager.create_user_binding(user_identifier, {
                            "openid": openid,
                            "bind_time": datetime.now().isoformat(),
                            "nickname": "WeChat User",
                            "bind_token": bind_token
                        })
                        
                        # 更新token状态
                        await user_manager.update_bind_token(bind_token, {"status": "completed"})
                        
                        # 发送绑定成功中英文消息
                        bind_success_message = "感谢关注暴躁哐哐，已完成Claude Co-Desk系统通知注册。AI任务完成会自动收到通知信息。\n\nThank you for following BaoZao-KuangKuang. Claude Co-Desk system notification registration completed. You will automatically receive notifications when AI tasks are completed."
                        
                        await wechat_api.send_text_message(openid, bind_success_message)
                        
                        logger.info(f"User {user_identifier} bound successfully with openid {openid}")
        
        return PlainTextResponse(content="success")
        
    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        import traceback
        traceback.print_exc()
        return PlainTextResponse(content="error")

# Development server
if __name__ == "__main__":
    host = settings.host
    port = settings.port
    
    logger.info(f"Starting WeChat Cloud API Service on {host}:{port}")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True if os.getenv("ENV") == "development" else False,
        log_level="info"
    )