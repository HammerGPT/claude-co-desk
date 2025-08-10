# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Heliki OS 是基于Claude Code构建的数字员工协作平台，通过Web界面提供智能化的系统级AI服务。项目从简单的Claude CLI UI化工具演进为具备自主学习能力的数字员工管理平台，采用Python + FastAPI后端和原生前端技术栈。

## 产品战略定位

### 核心产品定位
**从"AI原生操作系统"演进为"数字员工协作平台"**
- 不是传统意义上的操作系统，而是基于Claude Code架构的新型AI协作平台
- 核心价值：让小企业主能够"雇佣"和"管理"具备自主学习能力的数字员工团队

### 技术架构基础
1. **智能文件管理系统**
   - 基于Claude Code对系统根目录的整体管理能力
   - 实现对全系统资源文件的智能化管理
   - 这是整个平台的技术基石

2. **数字员工协作机制**
   - 基于Claude Code框架的多智能体协作机制
   - 实现复杂任务的分解和协作完成
   - 保证员工的可指挥性和任务处理灵活性

3. **AI任务管理器**
   - 类似传统操作系统任务管理器，但针对AI进程
   - 监控数字员工状态、资源消耗、协作关系
   - 提供任务调度、暂停/恢复/终止等管理功能

4. **🔥 动态工具扩展系统** *(关键差异化亮点)*
   - **MCP服务器管理器**：自动发现、安装、更新MCP服务器
   - **工具需求分析器**：智能体能识别任务需要什么工具
   - **工具开发引擎**：当找不到合适工具时，自动开发MCP服务器
   - **工具安全审计**：确保动态添加的工具不会危害系统安全
   - **工具协作网络**：不同员工可以共享工具和数据

### 用户体验设计
1. **Hooks监督机制**
   - 防止全自动化跑偏
   - 关键操作前用户确认
   - 异常情况主动报告
   - 周期性工作汇报

2. **员工管理思维**
   - 用户角色：企业主/团队管理者
   - AI角色：HR总监（负责员工调度分工）
   - 数字员工：具备专业技能的自主工作单元
   - 成本透明：token消耗 = 员工工资
   - **员工成长能力**：能够根据任务需求自主学习新技能(获取新工具)

### 目标市场策略
**主要切入点：小企业主**
- 利用已有的员工雇佣和管理思维模式
- 解决"想扩大团队而不得"的痛点
- 提供性价比远超真实员工的数字化解决方案
- **独特价值**：雇佣的数字员工具备无限学习能力，可以掌握任何新技能

### 商业模式方向
**开源优先策略**
- 暂时不考虑直接收费（因为依赖Claude Code订阅）
- 考虑开源路径，倾向于GitLab模式（社区版开源+企业版）
- 通过开源建立开发者生态和用户基础
- **MCP工具生态**：可能的商业模式包括企业级工具开发服务

### 技术演进路径
1. **第一阶段**：完善智能文件管理系统
2. **第二阶段**：开发数字员工协作机制 + MCP工具管理器
3. **第三阶段**：构建完整的任务管理器 + 工具开发引擎
4. **第四阶段**：企业级功能和商业化

### 核心价值主张
**"让小企业主能够以极低成本雇佣一支具备无限学习能力的数字员工团队，实现7×24小时的智能化业务处理，并能根据业务需求自主获取新技能"**

### 关键技术优势
- **近100%任务完成率**：基于MCP协议的强大工具集成能力
- **自主技能扩展**：员工能识别需求并自动获取所需工具
- **真正的AI自动化**：从被动工具使用转向主动问题解决

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