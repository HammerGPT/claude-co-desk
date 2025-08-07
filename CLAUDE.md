# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Heliki OS 是基于Claude Code构建的系统级AI操作系统，通过Web界面提供对Claude CLI的访问。项目移植并简化了claudecodeui的核心功能，采用Python + FastAPI后端和原生前端技术栈。

## 开发命令

### 环境设置
```bash
# 创建Python虚拟环境（如果不存在）
python -m venv venv

# 激活虚拟环境（必须先激活）
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 启动开发服务器
```bash
# 确保在虚拟环境中运行
python app.py
```
应用将在 `http://localhost:3005` 启动

### 前置条件检查
确保Claude CLI已安装并可用：
```bash
claude --version  # 验证Claude CLI是否可用
ls ~/.claude/projects/  # 验证项目目录是否存在
```

### 调试和验证
```bash
# 检查Python依赖
pip list

# 验证FastAPI服务状态
curl http://localhost:3005/health

# 检查WebSocket连接
# 在浏览器开发者工具中查看WebSocket连接状态
```

## 架构设计

### 后端架构 (Python + FastAPI)

**主要模块:**
- `app.py` - FastAPI应用主入口，包含WebSocket路由和API端点
- `claude_cli.py` - Claude CLI集成模块，负责进程管理和通信  
- `projects_manager.py` - 项目管理器，处理Claude项目扫描和会话管理

**WebSocket接口:**
- `/ws` - 聊天接口WebSocket，处理Claude对话
- `/shell` - 终端接口WebSocket，提供Shell交互
- `/api/projects` - 项目列表API，获取可用的Claude项目
- `/api/file-tree/{project_path:path}` - 文件树API，浏览项目文件

**核心类:**
- `ClaudeCLIIntegration` - Claude CLI进程集成和管理 (claude_cli.py:17)
- `ProjectManager` - 项目扫描和会话管理 (projects_manager.py)
- `ConnectionManager` - WebSocket连接池管理 (app.py)

### 前端架构 (原生 HTML/CSS/JS)

**核心组件:**
- `app.js` - 主应用协调器，环境检测和标签管理
- `websocket.js` - WebSocket管理和消息路由  
- `chat.js` - 聊天界面，消息渲染和Claude交互
- `sidebar.js` - 侧边栏，项目列表和选择
- `terminal.js` - 终端模拟器，Shell集成

**扩展组件:**
- `file_tree.js` - 文件树组件，文件浏览和导航
- `files_drawer.js` - 文件抽屉组件，文件管理界面
- `session_terminal.js` - 会话终端组件，支持会话恢复
- `sidebar_enhanced.js` - 增强侧边栏，更丰富的项目管理
- `syntax_highlighter.js` - 语法高亮组件

**CSS架构:**
- `main.css` - CSS变量系统和全局样式
- `components.css` - 基础组件样式
- `enhanced_components.css` - 增强组件样式
- `file_tree.css` - 文件树专用样式
- `session_mode.css` - 会话模式样式

### Claude CLI集成机制

**进程管理:**
- 异步进程启动 (`asyncio.create_subprocess_exec`)
- 实时输出处理 (逐行读取 + 超时保护)
- 流式JSON解析和WebSocket转发
- 会话ID捕获和管理

**关键参数:**
- `--output-format stream-json` - 流式JSON输出
- `--print` - 直接执行命令模式
- `--resume` - 会话恢复功能

## 重要设计决策

### WebSocket通信协议
**聊天消息格式:**
```javascript
// 发送给Claude
{type: 'claude-command', command: '用户消息', options: {projectPath, sessionId, ...}}

// Claude响应
{type: 'claude-response', data: {content, session_id, ...}}
{type: 'claude-error', error: '错误信息'}
{type: 'claude-complete', exitCode: 0}
```

**终端消息格式:**
```javascript
// 初始化终端
{type: 'init', projectPath: '项目路径', sessionId: 'xxx', hasSession: false}

// 终端输出
{type: 'output', data: '终端输出内容'}
{type: 'url_open', url: 'http://...'}
```

### 错误处理策略
- 环境检测失败 → 显示详细错误状态
- WebSocket连接失败 → 自动重连机制
- Claude CLI进程错误 → 超时保护和进程清理

### 项目选择机制
项目选择状态在多个组件间共享：
- `sidebar.js` 管理项目列表和选择状态
- `chat.js` 和 `terminal.js` 监听项目选择事件
- 通过全局事件 `projectSelected` 进行组件间通信

## 调试和开发

### 日志级别
开发时建议启用详细日志查看WebSocket通信和Claude CLI交互过程。

### 常见问题排查
- 聊天卡住 → 检查Claude CLI进程状态和输出处理日志
- 终端连接失败 → 验证项目路径和Claude CLI可用性
- 静态资源404 → 检查静态文件路由配置

### 开发时需注意
- 端口配置在 `app.py` 末尾 (当前为3005)
- 所有静态资源通过多重路由映射 (`/static`, `/css`, `/js`, `/assets`)
- WebSocket连接需要处理重连和错误恢复
- Claude CLI集成需要考虑进程生命周期管理

### 环境管理
- 项目需要在python虚拟环境中运行，所有涉及到项目的调试先进入虚拟环境
- 虚拟环境目录：`venv/` (已存在，勿删除)

### 测试和质量保证
项目当前没有自动化测试框架，建议：
- 手动测试WebSocket连接功能
- 验证Claude CLI集成是否正常
- 测试项目选择和文件浏览功能
- 检查终端模拟器的shell集成

## 协作指南

### 开发需求处理原则
- 修改任何需求、功能以及修复bug，必须首先告诉我你在Claudecodeui项目中寻找对应的解决方案（找到或者对方没有实现）
- 在todos中始终要告诉我此次行动的目标
- 分析Claudecodeui的解决方案
- 提供你的解决办法(不要过度设计)