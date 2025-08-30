# WeChat Cloud API Service

微信公众号通知云端API服务，为Claude Co-Desk提供安全的微信通知功能。

## 🌟 功能特性

- **安全架构**: 敏感信息（AppSecret）仅存储在云端，本地服务通过API调用
- **完整API**: 提供消息发送、用户绑定、二维码生成等完整功能
- **用户管理**: 完善的用户绑定管理和消息日志系统
- **监控统计**: 提供详细的使用统计和健康检查
- **容器部署**: 支持Docker和云服务器部署
- **高可用性**: 支持多进程部署和负载均衡

## 📋 API接口

### 核心接口

| 接口 | 方法 | 描述 |
|------|------|------|
| `/health` | GET | 服务健康检查 |
| `/wechat/send_message` | POST | 发送微信消息 |
| `/wechat/binding_status` | GET | 检查用户绑定状态 |
| `/wechat/generate_qr` | POST | 生成绑定二维码 |
| `/wechat/webhook` | POST | 微信事件回调处理 |

### API认证

所有API接口需要Bearer Token认证：
```bash
Authorization: Bearer your-api-key
```

### 接口示例

#### 发送消息
```bash
curl -X POST "https://your-server.com/wechat/send_message" \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "这是一条测试消息",
    "user_identifier": "user@example.com",
    "message_type": "text"
  }'
```

#### 检查绑定状态
```bash
curl -X GET "https://your-server.com/wechat/binding_status?user_identifier=user@example.com" \
  -H "Authorization: Bearer your-api-key"
```

#### 生成绑定二维码
```bash
curl -X POST "https://your-server.com/wechat/generate_qr" \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "user_identifier": "user@example.com",
    "action": "bind"
  }'
```

## 🚀 快速部署

### 方法1: Docker部署（推荐）

1. **克隆项目并进入目录**
```bash
git clone <your-repo>
cd wechat_cloud_api
```

2. **配置环境变量**
```bash
# 复制环境配置模板
cp .env.example .env

# 编辑配置文件，填入实际的微信配置
vim .env
```

3. **使用Docker Compose启动**
```bash
# 构建并启动服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f wechat-api
```

4. **验证部署**
```bash
# 健康检查
curl http://localhost:8000/health
```

### 方法2: 传统服务器部署

1. **环境准备**
```bash
# 安装Python 3.11+
python3 --version

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

2. **配置环境变量**
```bash
# 设置环境变量
export WECHAT_APP_SECRET="your-app-secret"
export WECHAT_TOKEN="your-token"
export WECHAT_API_KEYS='["your-api-key"]'
```

3. **启动服务**
```bash
# 开发环境
python main.py

# 生产环境（使用Gunicorn）
gunicorn main:app -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### 方法3: 云服务部署

#### Heroku部署
```bash
# 安装Heroku CLI
# 登录Heroku
heroku login

# 创建应用
heroku create your-wechat-api

# 设置环境变量
heroku config:set WECHAT_APP_SECRET=your-secret
heroku config:set WECHAT_TOKEN=your-token
heroku config:set WECHAT_API_KEYS='["your-api-key"]'

# 部署
git push heroku main
```

#### AWS Lambda部署（需要额外配置）
```bash
# 安装Mangum适配器
pip install mangum

# 使用Serverless Framework或AWS SAM部署
# 详见具体云服务商文档
```

## ⚙️ 配置说明

### 环境变量配置

| 环境变量 | 必需 | 默认值 | 说明 |
|----------|------|--------|------|
| `WECHAT_APP_ID` | 是 | wx245aa02d3bbdcbeb | 微信公众号AppID |
| `WECHAT_APP_SECRET` | 是 | - | 微信公众号AppSecret |
| `WECHAT_TOKEN` | 否 | heliki_wechat_token | 微信Token |
| `WECHAT_AES_KEY` | 否 | - | 微信AES加密密钥 |
| `WECHAT_API_KEYS` | 是 | - | API访问密钥列表 |
| `WECHAT_HOST` | 否 | 0.0.0.0 | 服务监听地址 |
| `WECHAT_PORT` | 否 | 8000 | 服务端口 |
| `WECHAT_DEBUG` | 否 | false | 调试模式 |

### 微信公众号配置

1. **在微信公众平台设置服务器配置**
   - 服务器地址(URL): `https://your-domain.com/wechat/webhook`
   - 令牌(Token): 与环境变量 `WECHAT_TOKEN` 保持一致
   - 消息加解密方式: 建议选择"安全模式"

2. **配置IP白名单**
   - 在微信公众平台添加服务器IP到白名单
   - 确保服务器可以访问微信API

## 📊 监控和维护

### 健康检查
```bash
# 检查服务状态
curl http://localhost:8000/health

# 响应示例
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "version": "1.0.0",
  "services": {
    "wechat_api": "healthy",
    "user_manager": "healthy"
  }
}
```

### 日志查看
```bash
# Docker环境
docker-compose logs -f wechat-api

# 传统部署
tail -f logs/wechat_api.log
```

### 数据备份
```bash
# 备份用户绑定数据
cp data/user_bindings.json backup/user_bindings_$(date +%Y%m%d).json
```

## 🔒 安全最佳实践

1. **API密钥管理**
   - 定期轮换API密钥
   - 不同环境使用不同的密钥
   - 不要在代码中硬编码密钥

2. **网络安全**
   - 使用HTTPS部署
   - 配置防火墙限制访问
   - 启用请求频率限制

3. **数据保护**
   - 定期备份用户数据
   - 加密敏感信息存储
   - 遵循数据保护法规

## 🐛 故障排查

### 常见问题

1. **微信API调用失败**
   ```
   原因: AppSecret错误或IP不在白名单
   解决: 检查配置和IP白名单设置
   ```

2. **用户绑定失败**
   ```
   原因: 二维码过期或Token无效
   解决: 重新生成绑定二维码
   ```

3. **服务启动失败**
   ```
   原因: 端口被占用或配置错误
   解决: 检查端口和环境变量配置
   ```

### 调试模式
```bash
# 启用调试模式
export WECHAT_DEBUG=true
python main.py
```

## 📈 性能优化

1. **缓存配置**
   - 启用Redis缓存access_token
   - 设置合适的缓存过期时间

2. **并发处理**
   - 根据服务器配置调整worker数量
   - 使用负载均衡分发请求

3. **数据库优化**
   - 定期清理过期数据
   - 建立适当的索引

## 🤝 贡献指南

1. Fork项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开Pull Request

## 📄 许可证

本项目采用MIT许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 支持

如果您在使用过程中遇到问题：

1. 查看本文档的故障排查部分
2. 检查GitHub Issues是否有类似问题
3. 创建新的Issue描述问题

---

**开发团队**: Claude Co-Desk Team  
**版本**: v1.0.0  
**更新时间**: 2025-01-15