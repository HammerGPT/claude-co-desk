# WeChat Notification MCP Service

WeChat公众号通知MCP服务，为Claude Co-Desk提供微信通知功能。

## 功能特性

- **消息发送**: 通过云端API向用户发送微信通知
- **绑定管理**: 检查用户微信绑定状态
- **活动统计**: 获取通知发送统计信息
- **云端架构**: 敏感信息存储在云端，本地无需配置复杂参数

## 技术架构

### 云端服务架构
```
用户系统 → 本地MCP服务 → 云端API → 微信公众号 → 用户微信
```

### MCP工具

1. **send_wechat_message**
   - 发送微信通知消息
   - 支持文本消息和模板消息
   - 自动记录发送日志

2. **check_binding_status**
   - 检查用户微信绑定状态
   - 获取绑定时间和用户昵称

3. **get_notification_stats**
   - 获取通知发送统计信息
   - 支持指定时间范围

## 配置说明

### 环境变量配置（推荐）
```bash
export WECHAT_API_BASE="https://your-server.com/api"
export WECHAT_API_KEY="your-api-key"
export WECHAT_API_TIMEOUT="30"
export WECHAT_API_RETRY="3"
```

### 配置文件
如果未设置环境变量，服务将使用 `wechat_config.json` 文件：

```json
{
  "api_base": "https://your-server.com/api",
  "api_key": "your-api-key-here",
  "service_name": "Claude Co-Desk WeChat Notification",
  "version": "1.0.0",
  "timeout": 30,
  "retry_attempts": 3
}
```

## 文件结构

```
wechat_notification/
├── server.py              # MCP服务器主程序
├── api_client.py          # 云端API客户端
├── config.py              # 配置管理模块
├── requirements.txt       # Python依赖
├── README.md              # 说明文档
├── wechat_config.json     # API配置（自动生成）
├── user_bindings.json     # 用户绑定数据（自动生成）
└── notification_logs.json # 通知日志（自动生成）
```

## 依赖安装

```bash
pip install -r requirements.txt
```

## 使用方法

### 作为MCP服务器运行
```bash
cd mcp_services/wechat_notification
python server.py
```

### Claude Code集成
服务会自动被Claude Co-Desk发现和注册。用户可以在任务中使用：

```
用户: "分析完这个文件，微信通知我结果"
模型: [执行任务] → 调用 send_wechat_message
```

## 云端API接口规范

### 发送消息
```http
POST /wechat/send_message
Content-Type: application/json
Authorization: Bearer your-api-key

{
  "message": "消息内容",
  "user_identifier": "user@email.com",
  "message_type": "text",
  "message_id": "unique-id"
}
```

### 检查绑定状态
```http
GET /wechat/binding_status?user_identifier=user@email.com
Authorization: Bearer your-api-key
```

### 生成绑定二维码
```http
POST /wechat/generate_qr
Content-Type: application/json
Authorization: Bearer your-api-key

{
  "user_identifier": "user@email.com",
  "action": "bind"
}
```

## 日志和监控

- **配置日志**: 存储在服务目录的JSON文件中
- **活动日志**: 自动记录所有通知发送活动
- **错误日志**: 使用Python logging模块记录错误
- **日志轮转**: 自动保持最新1000条日志记录

## 安全考虑

- **敏感信息隔离**: AppID/AppSecret等敏感信息仅存储在云端
- **传输加密**: 所有API调用使用HTTPS加密
- **认证机制**: 使用Bearer Token进行API认证
- **用户隔离**: 不同用户的绑定数据完全隔离

## 开发和调试

### 测试连接
```python
from api_client import test_connection

success = await test_connection("https://api.server.com", "your-key")
print(f"Connection test: {'Success' if success else 'Failed'}")
```

### 查看配置状态
```python
from config import get_service_status

status = get_service_status()
print(json.dumps(status, indent=2))
```

## 错误处理

- **网络错误**: 自动重试机制
- **API错误**: 详细错误信息返回
- **配置错误**: 启动时验证并提示
- **超时处理**: 30秒超时保护

## 版本信息

- **版本**: 1.0.0
- **MCP协议**: 1.0.0+
- **Python要求**: 3.8+
- **依赖关系**: 见 requirements.txt