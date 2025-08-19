# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Heliki OS 是基于Claude Code构建的数字员工协作平台，通过Web界面提供智能化的系统级AI服务。项目从简单的Claude CLI UI化工具演进为具备自主学习能力的数字员工管理平台，采用Python + FastAPI后端和原生前端技术栈。

** 开源状态：项目已完成开源准备，所有硬编码已清理，可安全部署到任何环境。**

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

4. ** 动态工具扩展系统** *(关键差异化亮点)*
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
- `config.py` - 🆕 统一配置系统，环境无关配置管理
- `tasks_storage.py` - 任务持久化存储管理
- `task_scheduler.py` - 定时任务调度器
- `mission_manager.py` - 任务执行目录管理
- `deploy_agents.py` - 数字员工自动部署系统

**核心API端点:**
- `/api/config` - 🆕 系统配置API，前后端配置同步
- `/api/projects` - 项目列表API，获取可用的Claude项目
- `/api/files/read` - 文件读取API，支持跨平台路径
- `/api/files/write` - 文件写入API
- `/api/task-files/{task_id}` - 任务文件管理API
- `/api/system-project/status` - 系统项目状态API
- `/api/system-project/agents` - 数字员工状态API

**WebSocket接口:**
- `/ws` - 聊天接口WebSocket，处理Claude对话
- `/shell` - 终端接口WebSocket，提供Shell交互，支持PTY

**核心类:**
- `ClaudeCLIIntegration` - Claude CLI进程集成和管理 (claude_cli.py:17)
- `ProjectManager` - 项目扫描和会话管理 (projects_manager.py)
- `ConnectionManager` - WebSocket连接池管理 (app.py)

### 前端架构 (原生 HTML/CSS/JS)

**核心组件:**
- `app.js` - 主应用协调器，环境检测和标签管理
- `websocket.js` - WebSocket管理和消息路由  
- `chat.js` - 聊天界面，消息渲染和Claude交互
- `sidebar_enhanced.js` - 🆕 增强侧边栏，项目会话层级结构
- `session_terminal.js` - 🆕 会话终端管理器，支持PTY Shell
- `task_manager_v2.js` - 🆕 任务管理器V2，支持定时任务
- `employees_manager.js` - 🆕 数字员工团队管理器

**扩展组件:**
- `files_drawer.js` - 文件抽屉组件，文件管理界面，支持任务文件
- `dashboard.js` - 🆕 任务管理器仪表板，系统概览
- `folder_selector.js` - 文件夹选择器，新建项目功能
- `syntax_highlighter.js` - 语法高亮组件
- `path_autocomplete.js` - 路径自动补全组件

**配置系统 (🆕 开源关键):**
- 所有组件支持 `loadConfig()` 动态配置加载
- 统一的 `getUserHome()` 方法替代硬编码路径
- `formatHomePath()` 跨平台路径显示格式化

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

## Shell初始化机制

### 系统架构概览

Heliki OS的Shell初始化是一个多层协作的复杂机制，涉及前端页签管理、WebSocket通信、PTY Shell进程管理等多个组件。

### 核心组件和职责

#### 1. 页签管理器 (sidebar_enhanced.js)
**职责**: 管理所有会话页签的创建、切换、状态维护

**核心方法**:
- `createTaskTab(taskId, taskName, initialCommand, workingDirectory)` - 创建任务页签
- `switchToSession(sessionId)` - 切换到指定会话
- `notifySessionSwitch(sessionData)` - 触发会话切换事件

**会话数据结构**:
```javascript
const sessionData = {
    project: {
        name: 'task-execution',  // 项目类型标识
        displayName: '任务执行',
        path: '/Users/yuhao'     // 工作目录
    },
    sessionId: 'task_xxx_xx',    // 唯一会话ID
    sessionName: '任务名称',
    isTask: true,                // 任务标识
    initialCommand: 'claude "完整命令内容" --add-dir /path'  // 完整执行命令
}
```

#### 2. WebSocket消息路由 (websocket.js)
**职责**: 处理前后端WebSocket消息，路由到对应处理器

**关键消息类型**:
```javascript
// 创建任务页签
{
    type: 'create-task-tab',
    taskId: 'task_xxx',
    taskName: '任务名称',
    initialCommand: 'claude "完整内容" --add-dir /path',
    workingDirectory: '/Users/yuhao'
}
```

#### 3. 终端会话管理器 (session_terminal.js)
**职责**: 管理PTY Shell连接，处理终端交互

**核心流程**:
```
sessionSwitch事件 → switchToSession() → connectSession() → WebSocket连接
```

**Shell初始化消息**:
```javascript
ws.send(JSON.stringify({
    type: 'init',
    projectPath: project.path,           // 工作目录
    sessionId: originalSession?.id,      // 会话ID（恢复会话时）
    hasSession: !!originalSession,       // 是否为恢复会话
    initialCommand: initialCommand,      // 完整执行命令
    cols: 120, rows: 30
}));
```

#### 4. 后端PTY Shell处理器 (app.py)
**职责**: 接收WebSocket消息，启动和管理PTY Shell进程

**命令构建逻辑**:
```python
# start_shell方法中的命令构建
if initial_command:
    # 有初始命令：任务执行、继续会话等
    enhanced_command = f'"{claude_executable}" {initial_command.replace("claude", "").strip()} --dangerously-skip-permissions'
    shell_command = f'cd "{project_path}" && {enhanced_command}'
elif has_session and session_id:
    # 恢复会话
    shell_command = f'cd "{project_path}" && ("{claude_executable}" --resume {session_id} || "{claude_executable}")'
else:
    # 新建普通会话
    shell_command = f'cd "{project_path}" && "{claude_executable}"'
```

### 不同场景的Shell初始化

#### 场景1: 任务执行
**流程**: 
1. 用户点击"执行" → 后端构建完整命令
2. 发送`create-task-tab`消息（包含`initialCommand`）
3. 前端创建页签，设置`taskSessionData.initialCommand`
4. `switchToSession` → `sessionSwitch`事件 → `connectSession`
5. 发送包含`initialCommand`的`init`消息
6. 后端执行: `cd "/Users/yuhao" && "claude完整任务内容" --dangerously-skip-permissions`

#### 场景2: 继续上一次会话
**流程**:
1. 用户点击"继续会话" → 创建页签
2. 通过`terminalCommand`事件发送`claude -c`命令
3. 后端处理: `cd "/Users/yuhao" && "/Users/yuhao/.local/bin/claude" -c --dangerously-skip-permissions`

#### 场景3: 恢复指定会话
**流程**:
1. 用户点击会话 → 传递`sessionId`和`originalSession`
2. `hasSession=true`, `initialCommand=null`
3. 后端执行: `cd "/Users/yuhao" && ("claude" --resume session_id || "claude")`

#### 场景4: 新建会话
**流程**:
1. 创建页签，无特殊参数
2. `hasSession=false`, `initialCommand=null`
3. 后端执行: `cd "/Users/yuhao" && "claude"`

### 关键设计原则

#### 1. 数据流向
```
用户操作 → 后端构建命令 → WebSocket消息 → 前端页签管理 → 会话切换事件 → 终端连接 → PTY Shell启动
```

#### 2. 命令传递链
```
后端任务处理 → create-task-tab.initialCommand → taskSessionData.initialCommand → sessionSwitch.initialCommand → WebSocket.init.initialCommand → PTY Shell.initial_command
```

#### 3. 工作目录策略
- **任务执行**: 用户家目录 (`/Users/yuhao`)
- **项目会话**: 项目路径 (`/path/to/project`)
- **继续会话**: 用户家目录

#### 4. 权限处理
- 任务执行自动添加 `--dangerously-skip-permissions`
- 其他场景根据配置决定

### 常见问题和解决方案

#### 问题1: 命令被截断
**原因**: `initialCommand`传递链条中断
**解决**: 检查每个环节的参数传递，确保`initialCommand`正确设置

#### 问题2: 工作目录错误  
**原因**: `project.path`设置错误
**解决**: 在创建`taskSessionData`时正确设置`project.path`

#### 问题3: 会话类型判断错误
**原因**: `hasSession`标识错误
**解决**: 根据`originalSession`是否存在正确设置`hasSession`

##  关键保护机制 - 双引号命令拼接规则

###  重要警告：双引号拼接机制已最终修复，严禁再次修改

经过深度调试和多次修复，PTY Shell命令构建中的双引号问题已彻底解决，**严禁任何未来修改**：

###  最终正确的双引号处理机制

**PTY Shell智能双引号处理**（app.py:503-512行）：
```python
# 有参数的情况
if main_command.startswith('"') and main_command.endswith('"'):
    enhanced_command = f'"{claude_executable}" {main_command} {remaining_params}'
else:
    enhanced_command = f'"{claude_executable}" "{main_command}" {remaining_params}'

# 无参数的情况
if command_content.startswith('"') and command_content.endswith('"'):
    enhanced_command = f'"{claude_executable}" {command_content}'
else:
    enhanced_command = f'"{claude_executable}" "{command_content}"'
```

**其他位置保持不变**：
1. **app.py:2091行** - 定时任务批量执行：`task_command_parts = [enhanced_goal]`
2. **task_scheduler.py:450行** - 定时任务调度器：`base_command_parts = [enhanced_command]`
3. **app.py:2416行** - 手动任务执行：`task_command_parts = ['claude', f'"{enhanced_command}"']`
4. **app.py:2519行** - MCP智能体命令：`task_command_parts = ['claude', f'"{agent_command}"']`

### 🔐 核心保护原则

1. **PTY Shell智能检测机制**：
   - 自动检测命令内容是否已被双引号包围
   - 避免双重双引号问题（如：`""命令内容""`）
   - 确保即时任务和定时任务的命令格式一致

2. **绝对禁止的行为**：
   - 在PTY Shell之外的任何地方添加双引号
   - 修改现有的双引号检测逻辑
   - "善意"的双引号保护添加

3. **命令传递链路保护**：
   ```
   任务执行 → ['claude', f'"{enhanced_command}"'] → "claude \"命令内容\""
   ↓
   PTY Shell接收 → 检测到已有双引号 → 不再添加双引号
   ↓
   最终执行 → "/path/claude" "命令内容" --参数
   ```

###  未来开发警告

**任何声称"修复双引号问题"的代码变更都是错误的！**
- 如遇命令截断，优先排查其他原因
- 双引号机制已经完美，无需任何修改
- 本机制适用于所有命令场景：即时任务、定时任务、MCP调用

### 🔍 验证方法
修改后必须测试以下场景确保命令不会被截断：
- PTY Shell任务执行（长命令带空格）
- 定时任务执行
- MCP智能体调用
- 手动任务执行

## 协作指南

###  硬编码严格禁令
**项目已完成开源准备，绝对禁止任何形式的硬编码！**

**已彻底清理的硬编码类型：**
-  用户路径：`/Users/yuhao` →  使用 `Config.get_user_home()`
-  用户名：`yuhao` →  使用系统配置API
-  服务器地址：`localhost:3005` →  使用环境变量 `HELIKI_HOST`, `HELIKI_PORT`
-  Claude CLI路径：`/Users/yuhao/.local/bin/claude` →  动态检测
-  固定回复文本 →  使用配置系统

**配置系统架构：**
- 后端：`config.py` 提供统一配置管理
- API：`/api/config` 提供前后端配置同步
- 前端：各组件通过 `loadConfig()` 获取动态配置
- 环境变量：支持 `HELIKI_HOST`, `HELIKI_PORT` 等自定义

### 表情符号严格禁令
**项目已完成专业化改造，绝对禁止任何形式的表情符号！**

**表情符号禁用规则：**
- 禁止在任何前端代码中使用表情符号（包括JS、CSS、HTML）
- 禁止在console.log日志中使用表情符号
- 禁止在用户界面文本中使用表情符号
- 禁止在CSS content属性中使用表情符号
- 禁止在HTML模板字符串中使用表情符号
- 禁止在错误和状态提示信息中使用表情符号

**已清理的表情符号范围：**
- Unicode表情符号范围: `[\u{1F300}-\u{1F9FF}]`
- 符号和图标范围: `[\u{2600}-\u{26FF}]`
- 杂项符号范围: `[\u{2700}-\u{27BF}]`

**替代方案：**
- 使用专业的PNG图标系统替代表情符号
- 使用纯文字描述替代表情符号
- 使用CSS类名和样式实现视觉效果
- 保持界面的专业性和一致性

**开发需求处理原则：**
- 修改任何需求、功能以及修复bug，必须首先告诉我你在Claudecodeui项目中寻找对应的解决方案（找到或者对方没有实现）
- 在todos中始终要告诉我此次行动的目标
- 分析Claudecodeui的解决方案
- 提供你的解决办法(不要过度设计)
- **绝对禁止硬编码**：任何路径、URL、用户信息都必须通过配置系统获取
- **绝对禁止表情符号**：保持代码和界面的专业性