# Heliki OS Shell初始化机制文档

## 系统架构概览

Heliki OS的Shell初始化是一个多层协作的复杂机制，涉及前端页签管理、WebSocket通信、PTY Shell进程管理等多个组件。

## 核心组件和职责

### 1. 页签管理器 (sidebar_enhanced.js)
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

### 2. WebSocket消息路由 (websocket.js)
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

// 会话切换事件 (内部事件)
{
    type: 'sessionSwitch',
    detail: {
        sessionId, project, sessionName, 
        originalSession, initialCommand
    }
}
```

### 3. 终端会话管理器 (session_terminal.js)
**职责**: 管理PTY Shell连接，处理终端交互

**核心流程**:
```
sessionSwitch事件 → switchToSession() → connectSession() → WebSocket连接
```

**关键方法**:
- `switchToSession(sessionId, project, sessionName, originalSession, initialCommand)`
- `connectSession(sessionId, project, originalSession, initialCommand)`

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

### 4. 后端PTY Shell处理器 (app.py)
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

## 不同场景的Shell初始化

### 场景1: 任务执行
**流程**: 
1. 用户点击"执行" → 后端构建完整命令
2. 发送`create-task-tab`消息（包含`initialCommand`）
3. 前端创建页签，设置`taskSessionData.initialCommand`
4. `switchToSession` → `sessionSwitch`事件 → `connectSession`
5. 发送包含`initialCommand`的`init`消息
6. 后端执行: `cd "/Users/yuhao" && "claude完整任务内容" --dangerously-skip-permissions`

### 场景2: 继续上一次会话
**流程**:
1. 用户点击"继续会话" → 创建页签
2. 通过`terminalCommand`事件发送`claude -c`命令
3. 后端处理: `cd "/Users/yuhao" && "/Users/yuhao/.local/bin/claude" -c --dangerously-skip-permissions`

### 场景3: 恢复指定会话
**流程**:
1. 用户点击会话 → 传递`sessionId`和`originalSession`
2. `hasSession=true`, `initialCommand=null`
3. 后端执行: `cd "/Users/yuhao" && ("claude" --resume session_id || "claude")`

### 场景4: 新建会话
**流程**:
1. 创建页签，无特殊参数
2. `hasSession=false`, `initialCommand=null`
3. 后端执行: `cd "/Users/yuhao" && "claude"`

## 关键设计原则

### 1. 数据流向
```
用户操作 → 后端构建命令 → WebSocket消息 → 前端页签管理 → 会话切换事件 → 终端连接 → PTY Shell启动
```

### 2. 命令传递链
```
后端任务处理 → create-task-tab.initialCommand → taskSessionData.initialCommand → sessionSwitch.initialCommand → WebSocket.init.initialCommand → PTY Shell.initial_command
```

### 3. 工作目录策略
- **任务执行**: 用户家目录 (`/Users/yuhao`)
- **项目会话**: 项目路径 (`/path/to/project`)
- **继续会话**: 用户家目录

### 4. 权限处理
- 任务执行自动添加 `--dangerously-skip-permissions`
- 其他场景根据配置决定

## 常见问题和解决方案

### 问题1: 命令被截断
**原因**: `initialCommand`传递链条中断
**解决**: 检查每个环节的参数传递，确保`initialCommand`正确设置

### 问题2: 工作目录错误  
**原因**: `project.path`设置错误
**解决**: 在创建`taskSessionData`时正确设置`project.path`

### 问题3: 会话类型判断错误
**原因**: `hasSession`标识错误
**解决**: 根据`originalSession`是否存在正确设置`hasSession`

## 扩展指南

### 添加新的会话类型
1. 定义新的`project.name`标识
2. 在`session_terminal.js`中添加对应的处理逻辑
3. 在后端`start_shell`中添加命令构建分支
4. 更新WebSocket消息处理

### 修改命令构建逻辑
**位置**: `app.py` 的 `start_shell` 方法
**注意**: 保持与现有场景的兼容性

## 调试技巧

### 关键日志点
1. **前端**: `🎯 创建任务页签`, `📋 初始命令`, `🔄 切换到会话终端`
2. **后端**: `🚀 使用增强初始命令`, `🚀 启动PTY Shell`

### 问题排查步骤
1. 检查前端是否收到正确的WebSocket消息
2. 检查`taskSessionData`是否正确设置
3. 检查`sessionSwitch`事件是否传递正确参数
4. 检查后端是否接收到正确的`init`消息
5. 检查PTY Shell命令构建逻辑

---

*此文档应该同步到项目的CLAUDE.md中，作为核心架构文档的一部分*