# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Heliki OS 是基于Claude Code构建的系统级AI操作系统，通过Web界面提供对Claude CLI的访问。项目移植并简化了claudecodeui的核心功能，采用Python + FastAPI后端和原生前端技术栈。

## 开发命令

### 启动开发服务器
```bash
python app.py
```
应用将在 `http://localhost:3005` 启动

### 安装依赖
```bash
pip install -r requirements.txt
```

### 前置条件检查
确保Claude CLI已安装并可用：
```bash
claude --version  # 验证Claude CLI是否可用
ls ~/.claude/projects/  # 验证项目目录是否存在
```

## 架构设计

### 后端架构 (Python + FastAPI)

**主要模块:**
- `app.py` - FastAPI应用主入口，包含WebSocket路由和API端点
- `claude_cli.py` - Claude CLI集成模块，负责进程管理和通信
- WebSocket双通道设计:
  - `/ws` - 聊天接口WebSocket 
  - `/shell` - 终端接口WebSocket

**核心类:**
- `EnvironmentChecker` - 环境检测和验证
- `ProjectScanner` - 项目扫描和管理
- `ConnectionManager` - WebSocket连接管理
- `ClaudeCLIIntegration` - Claude CLI进程集成

### 前端架构 (原生 HTML/CSS/JS)

**组件化设计:**
- `app.js` - 主应用协调器，环境检测和标签管理
- `websocket.js` - WebSocket管理和消息路由
- `chat.js` - 聊天界面，消息渲染和Claude交互
- `sidebar.js` - 侧边栏，项目列表和选择
- `terminal.js` - 终端模拟器，Shell集成

**CSS架构:**
- `main.css` - CSS变量系统和全局样式
- `components.css` - 组件特定样式和响应式设计

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

### 移植策略
- 我提供的任何功能或者需要修复的bug，都先在 @claudecodeui/ 项目寻找解决办法。我们首要目标就是移植其中的功能

参考claudecodeui的实现方式，所有功能开发应首先查看 `claudecodeui/` 目录中的对应实现，确保功能对等性。

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

## 协作指南

### 开发需求处理原则
- 修改任何需求、功能以及修复bug，必须首先告诉我你在Claudecodeui项目中寻找对应的解决方案（找到或者对方没有实现）
- 在todos中始终要告诉我此次行动的目标
- 分析Claudecodeui的解决方案
- 提供你的解决办法(不要过度设计)