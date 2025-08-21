/**
 * Claude Co-Desk 国际化系统
 * 支持中英文切换，默认语言为English
 */

const TEXTS = {
    // 默认语言为English
    en: {
        // 应用基础
        'app.title': 'Claude Co-Desk',
        'app.loading': 'Starting Claude Co-Desk',
        
        // 侧边栏和导航
        'nav.refresh': 'Refresh Projects',
        'nav.settings': 'Settings',
        'nav.newProject': 'New Project',
        'nav.menu': 'Menu',
        'nav.files': 'Files',
        'nav.createTask': 'Create New Task',
        'nav.agentsTeam': 'Digital Team',
        'nav.expandCollapse': 'Expand/Collapse',
        'nav.darkMode': 'Switch to Dark Mode',
        'nav.lightMode': 'Switch to Light Mode',
        'nav.tasks': 'Tasks',
        'nav.projects': 'Projects',
        
        // 搜索
        'search.projects': 'Search projects...',
        'search.sessions': 'Search sessions...',
        
        // 会话相关
        'session.new': 'New Session',
        'session.newChat': 'New Chat',
        'session.continue': 'Continue',
        'session.continueLastSession': 'Continue',
        'session.noSessions': 'No sessions',
        'session.continueSession': 'Continue Session',
        'session.name': 'Session Name',
        'session.placeholder': 'New session',
        'session.create': 'Create Session',
        'session.terminated': 'Session terminated',
        'session.created': 'Session created successfully',
        'session.loadFailed': 'Failed to load session messages',
        'session.existing': 'Existing Session',
        'session.delete': 'Delete Session',
        'session.confirmDelete': 'Are you sure you want to delete this session? This action cannot be undone.',
        'session.deleteSuccess': 'Session deleted successfully',
        'session.deleteFailed': 'Failed to delete session',
        'session.closeSession': 'Close Session',
        'session.closeTask': 'Close Task',
        'session.loadMore': 'Load More Sessions',
        
        // 任务管理
        'task.create': 'Create Task',
        'task.name': 'Task Name',
        'task.goal': 'Task Goal',
        'task.nameExample': 'e.g.: Data Collection Task',
        'task.goalPlaceholder': 'Describe the specific objectives and requirements of the task...',
        'task.addFirst': 'Click "Add Task" to create your first task',
        'task.selectOrCreate': 'Select a task from the left list to view details, or click "Add Task" to create a new daily task',
        'task.noTasks': 'No tasks yet',
        'task.running': 'Running',
        'task.completed': 'Completed',
        'task.failed': 'Failed',
        'task.pending': 'Pending',
        'task.execute': 'Execute',
        'task.edit': 'Edit',
        'task.delete': 'Delete',
        'task.save': 'Save',
        'task.cancel': 'Cancel',
        'task.add': 'Add Task',
        'task.standalone': 'Standalone Task',
        'task.paths': 'File/Directory Paths',
        'task.pathsPlaceholder': 'Enter keywords to search files/folders, click dropdown items to add',
        'task.refresh': 'Refresh List',
        'task.unnamed': 'Unnamed Task',
        'task.noDescription': 'No description',
        'task.immediate': 'Execute Immediately',
        'task.scheduled': 'Scheduled',
        'task.inProgress': 'In Progress',
        'task.deleteNotFound': 'Task to delete does not exist',
        'task.networkError': 'Network error occurred while deleting task',
        'task.noTasks': 'No tasks yet',
        'task.noTasksEmpty': 'No tasks',
        'task.createFirst': 'Create New Task',
        'task.autoMode': 'Auto Mode',
        'task.autoModeDescription': 'Skip permission confirmations to improve execution efficiency',
        'task.verboseLogs': 'Enable Task Logs',
        'task.verboseLogsDescription': 'Show detailed execution process and debug information',
        'task.resourceFiles': 'Resource Files',
        'task.resourceHelp': 'Select files or folders that the model needs to reference/read',
        'task.resourcePlaceholder': 'Enter keywords to intelligently search for files/folders, click dropdown items to add',
        'task.addButton': 'Add',
        'task.noResources': 'No referenced files or folders',
        'task.executionMode': 'Execution Mode',
        'task.executeImmediate': 'Execute Immediately',
        'task.executeScheduled': 'Scheduled Execution',
        'task.scheduleSettings': 'Schedule Settings',
        'task.scheduleDaily': 'Daily',
        'task.scheduleWeekly': 'Weekly',
        'task.fillNameAndGoal': 'Please fill in task name and goal',
        'task.details': 'Task Details',
        'task.executionModeLabel': 'Execution Mode',
        'task.statusInfo': 'Status Information',
        'task.saveChanges': 'Save Changes',
        'task.saveFailed': 'Failed to save task',
        'task.executionFailed': 'Task execution failed',
        'task.executionFailedWithError': 'Task execution failed: ',
        'task.taskNotFound': 'Task not found, please refresh and try again',
        'task.systemConnectionError': 'System connection error, please refresh and try again',
        'task.executing': 'Executing task: ',
        'task.saveSuccess': 'Task saved successfully',
        'task.deleteSuccess': 'Task deleted successfully',
        'task.createSuccess': 'Task created successfully',
        'task.updateSuccess': 'Task updated successfully',
        'task.noResourceFiles': 'No resource files set',
        'task.verboseLogsMode': 'Task Logs Mode',
        'task.scheduleDaily': 'Daily',
        'task.scheduleWeekly': 'Weekly',
        'task.scheduledExecution': 'Scheduled -',
        'task.reExecute': 'Re-execute',
        'task.reExecuteTitle': 'Restart execution of this task',
        'task.continueExecution': 'Continue Execution',
        'task.reExecutingTask': 'Re-executing task: ',
        'task.continueTask': 'Continue Task',
        'task.continueTaskTitle': 'Resume previous Claude CLI session to continue this task',
        
        // 项目管理
        'project.loading': 'Loading projects...',
        'project.loadFailed': 'Failed to load projects',
        'project.networkError': 'Network error, unable to load projects',
        'project.noProjects': 'No projects found',
        'project.workingDirectory': 'Working Directory',
        'project.unknownPath': 'Unknown Path',
        'project.search': 'Search projects...',
        'project.expand': 'Expand',
        'project.collapse': 'Collapse',
        'project.sessionsCount': 'sessions',
        'project.selectFolder': 'Select Project Folder',
        'project.searchFolders': 'Search folders...',
        'project.loading': 'Loading...',
        'project.currentSelection': 'Current Selection:',
        'project.notSelected': 'Not selected',
        'project.confirmAdd': 'Confirm Add Project',
        'project.cancel': 'Cancel',
        'project.alreadyExists': 'This folder is already an existing project, please select another folder',
        'project.createFailed': 'Failed to create new project, please refresh and try again',
        'project.noFolders': 'No folders under this directory',
        'project.newProjectSession': 'New Project Session',
        
        // MCP工具
        'mcp.tools': 'MCP Tools',
        'mcp.refresh': 'Refresh List',
        'mcp.add': 'Add Tool',
        'mcp.management': 'MCP Tools Management',
        'mcp.description': 'Manage Claude\'s MCP (Model Context Protocol) tool extensions',
        'mcp.workProject': 'Working Project:',
        'mcp.addTool': 'Add MCP Tool',
        'mcp.installedTools': 'Installed Tools',
        'mcp.loadingTools': 'Loading tool list...',
        'mcp.query': 'Describe the tool functionality you need, or enter MCP server installation command directly...',
        'mcp.examples': 'Functionality examples:\n• I need to connect and operate PostgreSQL database\n• I want a tool that can process PDF files\n• I need Slack integration to send messages\n\nDirect installation examples:\n• npx -y @modelcontextprotocol/server-filesystem /path/to/files\n• npx -y @modelcontextprotocol/server-github\n• npx -y @modelcontextprotocol/server-memory',
        'mcp.noTools': 'No MCP tools',
        'mcp.noInstalledTools': 'No installed MCP tools',
        'mcp.workingDirectory': 'Working Directory',
        'mcp.toolsCountUnit': 'tools',
        
        // 文件管理
        'files.taskFiles': 'Task Files',
        'files.browser': 'File Browser',
        'files.projectFiles': 'Files',
        'files.noTaskFiles': 'No files generated for task yet',
        'files.noProjectFiles': 'No files in this project',
        'files.loadTaskFilesFailed': 'Failed to load task files',
        'files.loadProjectFilesFailed': 'Failed to load project files',
        'files.readFileFailed': 'Unable to read file',
        'files.networkErrorRead': 'Network error, unable to read file',
        'files.networkErrorOpen': 'Network error, unable to open file',
        'files.saveFileFailed': 'Failed to save file',
        'files.networkErrorSave': 'Network error, unable to save file',
        'files.openFileFailed': 'Unable to open file',
        'files.readLargeFileFailed': 'Unable to read large file',
        'files.networkErrorLargeFile': 'Network error, unable to open large file',
        'files.getFileListFailed': 'Failed to get file list',
        'files.networkErrorFileList': 'Network error, unable to get file list',
        'files.searchFailed': 'Search failed',
        'files.loadFoldersFailed': 'Failed to load folders',
        'files.networkErrorFolders': 'Network error, unable to load folders',
        'files.checkingFile': 'Checking file',
        
        // 数字员工
        'agents.title': 'Agents',
        'agents.teamManagement': 'Agents Team Management',
        'agents.deploy': 'Deploy Agent',
        'agents.status': 'Agent Status',
        'agents.manage': 'Manage Team',
        'agents.initialize': 'Initialize',
        'agents.systemNotLoaded': 'System status not loaded, please try again later',
        'agents.tabSystemNotLoaded': 'Tab system not loaded, please refresh and try again',
        'agents.systemRoot': 'System Root Directory',
        'agents.systemInitialization': 'System Initialization',
        'agents.initializationFailed': 'Failed to create initialization session: ',
        'agents.noActiveTerminal': 'No active terminal session found, please make sure initialization tab is open',
        'agents.terminalUnavailable': 'Terminal connection unavailable, please check if Claude Code is running normally',
        
        // 通用操作
        'common.confirm': 'Connect',
        'common.cancel': 'Cancel',
        'common.save': 'Save',
        'common.delete': 'Delete',
        'common.edit': 'Edit',
        'common.close': 'Close',
        'common.loading': 'Loading...',
        'common.error': 'Error',
        'common.success': 'Success',
        'common.warning': 'Warning',
        'common.info': 'Information',
        'common.retryCheck': 'Retry Check',
        'common.forceContinue': 'Force Continue',
        'common.retry': 'Retry',
        
        // 错误消息
        'error.networkError': 'Network error',
        'error.loadFailed': 'Loading failed',
        'error.saveFailed': 'Save failed',
        'error.unknown': 'Unknown error',
        'error.incompleteEnvironment': 'Incomplete Environment Configuration',
        
        // 设置
        'settings.title': 'Settings',
        'settings.language': 'Language',
        'settings.theme': 'Theme',
        'settings.general': 'General Settings',
        'settings.languageDescription': 'Select interface display language',
        'settings.about': 'About System',
        'settings.aboutDescription': 'System information and version details',
        'settings.aboutTitle': 'Claude Co-Desk',
        'settings.aboutSubtitle': 'Digital Employee Collaboration Platform',
        'settings.aboutBuiltWith': 'Built with Claude Code',
        
        // 状态消息
        'status.initializing': 'Initializing...',
        'status.connecting': 'Connecting...',
        'status.connected': 'Connected',
        'status.disconnected': 'Disconnected',
        'status.ready': 'Ready',
        
        // 启动流程状态
        'init.detectingEnvironment': 'Detecting environment...',
        'init.foundClaude': 'Claude CLI detected',
        'init.checkingProjects': 'Checking projects directory',
        'init.connectingWebSocket': 'Connecting to WebSocket',
        'init.loadingComponents': 'Loading system components',
        'init.loadingProjects': 'Loading projects',
        'init.systemReady': 'System ready',
        'init.claudeDetection': 'Claude CLI detection',
        'init.projectsCheck': 'Projects directory check',
        'init.websocketConnection': 'WebSocket connection',
        'init.componentInit': 'Component initialization',
        'init.projectLoad': 'Project loading',
        
        // 侧边栏
        'sidebar.noTasks': '0 Tasks',
        'sidebar.noProjects': '0 Projects',
        'sidebar.tasksCount': 'tasks',
        'sidebar.projectsCount': 'projects',
        
        // 仪表板
        'dashboard.welcome': 'Welcome to Claude Co-Desk Digital Workspace',
        'dashboard.subtitle': 'AI collaboration platform based on Claude Code, unleashing AI\'s full computer control potential',
        'dashboard.systemStatus': 'System Status',
        'dashboard.claudeCli': 'Claude CLI',
        'dashboard.executionPath': 'Execution Path',
        'dashboard.agentsCount': 'Agents Count',
        'dashboard.totalTasks': 'Total Tasks',
        'dashboard.immediateTasks': 'Immediate Tasks',
        'dashboard.mcpTools': 'MCP Tools',
        'dashboard.workingDirectory': 'Working Directory',
        'dashboard.mcpLoading': 'Loading MCP tools status...',
        'dashboard.mcpLoadFailed': 'Unable to get MCP tools status',
        'dashboard.mcpManageTip': 'Settings - MCP Tools to add tools',
        'dashboard.initializeSystem': 'Initialize Digital Agents System',
        'dashboard.initializeDesc': 'Configure your dedicated AI team and start intelligent workflows',
        'dashboard.welcomeInfo': 'Tasks: system-wide operations, Projects: single folder development',
        'dashboard.systemNotReady': 'System components not loaded, please refresh and try again',
        'dashboard.taskManagerNotReady': 'Task manager not loaded, please refresh and try again',
        'dashboard.claudeNotFound': 'Claude CLI not found'
    },
    
    // 中文翻译
    zh: {
        // 应用基础
        'app.title': 'Claude Co-Desk',
        'app.loading': '正在启动 Claude Co-Desk',
        
        // 侧边栏和导航
        'nav.refresh': '刷新项目',
        'nav.settings': '设置',
        'nav.newProject': '新建项目',
        'nav.menu': '菜单',
        'nav.files': '文件',
        'nav.createTask': '创建新任务',
        'nav.agentsTeam': '数字员工团队',
        'nav.expandCollapse': '展开/折叠',
        'nav.darkMode': '切换到暗色模式',
        'nav.lightMode': '切换到亮色模式',
        'nav.tasks': '任务',
        'nav.projects': '项目',
        
        // 搜索
        'search.projects': '搜索项目...',
        'search.sessions': '搜索会话...',
        
        // 会话相关
        'session.new': '新建会话',
        'session.newChat': '新建会话',
        'session.continue': '继续',
        'session.continueLastSession': '继续上个会话',
        'session.noSessions': '暂无会话',
        'session.continueSession': '继续会话',
        'session.name': '会话名称',
        'session.placeholder': '新建会话',
        'session.create': '创建会话',
        'session.terminated': '会话已中止',
        'session.created': '新会话创建成功',
        'session.loadFailed': '加载会话消息失败',
        'session.existing': '现有会话',
        'session.delete': '删除会话',
        'session.confirmDelete': '确定要删除这个会话吗？此操作无法撤销。',
        'session.deleteSuccess': '会话删除成功',
        'session.deleteFailed': '删除会话失败',
        'session.closeSession': '关闭会话',
        'session.closeTask': '关闭任务',
        'session.loadMore': '加载更多会话',
        
        // 任务管理
        'task.create': '创建任务',
        'task.name': '任务名称',
        'task.goal': '任务目标',
        'task.nameExample': '例如：信息收集任务',
        'task.goalPlaceholder': '描述任务的具体目标和要求...',
        'task.addFirst': '点击"新增任务"来创建第一个任务',
        'task.selectOrCreate': '从左侧列表选择一个任务查看详情，或点击"新增任务"创建新的每日任务',
        'task.noTasks': '还没有任务',
        'task.running': '运行中',
        'task.completed': '已完成',
        'task.failed': '失败',
        'task.pending': '待执行',
        'task.execute': '执行',
        'task.edit': '编辑',
        'task.delete': '删除',
        'task.save': '保存',
        'task.cancel': '取消',
        'task.add': '新增任务',
        'task.standalone': '独立任务',
        'task.paths': '文件/目录路径',
        'task.pathsPlaceholder': '输入关键词智能搜索文件/文件夹，点击下拉项即可添加',
        'task.refresh': '刷新列表',
        'task.unnamed': '未命名任务',
        'task.noDescription': '无描述',
        'task.immediate': '立即执行',
        'task.scheduled': '定时',
        'task.inProgress': '进行中',
        'task.deleteNotFound': '要删除的任务不存在',
        'task.networkError': '删除任务时发生网络错误',
        'task.noTasks': '暂无任务',
        'task.noTasksEmpty': '暂无任务',
        'task.createFirst': '创建新任务',
        'task.autoMode': '全自动模式',
        'task.autoModeDescription': '启用后将自动跳过权限确认，提升执行效率',
        'task.verboseLogs': '打开任务日志',
        'task.verboseLogsDescription': '显示详细的执行过程和调试信息',
        'task.resourceFiles': '资源文件',
        'task.resourceHelp': '选择需要模型引用/读取的文件或者文件夹',
        'task.resourcePlaceholder': '输入关键词智能搜索文件/文件夹，点击下拉项即可添加',
        'task.addButton': '添加',
        'task.noResources': '暂无引用文件或文件夹',
        'task.executionMode': '执行方式',
        'task.executeImmediate': '立即执行',
        'task.executeScheduled': '定时执行',
        'task.scheduleSettings': '定时设置',
        'task.scheduleDaily': '每日',
        'task.scheduleWeekly': '每周',
        'task.fillNameAndGoal': '请填写任务名称和目标',
        'task.details': '任务详情',
        'task.executionModeLabel': '执行模式',
        'task.statusInfo': '状态信息',
        'task.saveChanges': '保存修改',
        'task.saveFailed': '保存任务失败',
        'task.executionFailed': '任务执行失败',
        'task.executionFailedWithError': '任务执行失败: ',
        'task.taskNotFound': '任务不存在，请刷新页面重试',
        'task.systemConnectionError': '系统连接异常，请刷新页面重试',
        'task.executing': '正在执行任务: ',
        'task.saveSuccess': '任务保存成功',
        'task.deleteSuccess': '任务删除成功',
        'task.createSuccess': '任务创建成功',
        'task.updateSuccess': '任务修改成功',
        'task.noResourceFiles': '未设置资源文件',
        'task.verboseLogsMode': '任务日志模式',
        'task.scheduleDaily': '每日',
        'task.scheduleWeekly': '每周',
        'task.scheduledExecution': '定时执行 -',
        'task.reExecute': '重新执行',
        'task.reExecuteTitle': '重新开始执行此任务',
        'task.continueExecution': '继续执行',
        'task.reExecutingTask': '重新执行任务: ',
        'task.continueTask': '继续任务',
        'task.continueTaskTitle': '恢复之前的Claude CLI会话继续此任务',
        
        // 项目管理
        'project.loading': '正在加载项目...',
        'project.loadFailed': '加载项目失败',
        'project.networkError': '网络错误，无法加载项目',
        'project.noProjects': '未找到项目',
        'project.workingDirectory': '工作目录',
        'project.unknownPath': '未知路径',
        'project.search': '搜索项目...',
        'project.expand': '展开',
        'project.collapse': '折叠',
        'project.sessionsCount': '个会话',
        'project.selectFolder': '选择项目文件夹',
        'project.searchFolders': '搜索文件夹...',
        'project.loading': '加载中...',
        'project.currentSelection': '当前选择:',
        'project.notSelected': '未选择',
        'project.confirmAdd': '确认添加项目',
        'project.cancel': '取消',
        'project.alreadyExists': '此文件夹已是现有项目，请选择其他文件夹',
        'project.createFailed': '创建新项目失败，请刷新页面后重试',
        'project.noFolders': '此目录下没有文件夹',
        'project.newProjectSession': '新项目会话',
        
        // MCP工具
        'mcp.tools': 'MCP工具',
        'mcp.refresh': '刷新列表',
        'mcp.add': '添加工具',
        'mcp.management': 'MCP工具管理',
        'mcp.description': '管理Claude的MCP（Model Context Protocol）工具扩展',
        'mcp.workProject': '工作项目：',
        'mcp.addTool': '添加MCP工具',
        'mcp.installedTools': '已安装工具',
        'mcp.loadingTools': '加载工具列表中...',
        'mcp.query': '请描述您需要的工具功能，或直接输入MCP服务器安装命令...',
        'mcp.examples': '功能需求示例：\n• 我需要连接和操作PostgreSQL数据库\n• 我想要一个能够处理PDF文件的工具\n• 我需要与Slack集成发送消息的功能\n\n直接安装命令示例：\n• npx -y @modelcontextprotocol/server-filesystem /path/to/files\n• npx -y @modelcontextprotocol/server-github\n• npx -y @modelcontextprotocol/server-memory',
        'mcp.noTools': '无MCP工具',
        'mcp.noInstalledTools': '暂无已安装的MCP工具',
        'mcp.workingDirectory': '工作目录',
        'mcp.toolsCountUnit': '个',
        
        // 文件管理
        'files.taskFiles': '任务文件',
        'files.browser': '文件浏览器',
        'files.projectFiles': '文件',
        'files.noTaskFiles': '任务暂未生成文件',
        'files.noProjectFiles': '此项目暂无文件',
        'files.loadTaskFilesFailed': '加载任务文件失败',
        'files.loadProjectFilesFailed': '加载项目文件失败',
        'files.readFileFailed': '无法读取文件',
        'files.networkErrorRead': '网络错误，无法读取文件',
        'files.networkErrorOpen': '网络错误，无法打开文件',
        'files.saveFileFailed': '保存文件失败',
        'files.networkErrorSave': '网络错误，无法保存文件',
        'files.openFileFailed': '无法打开文件',
        'files.readLargeFileFailed': '无法读取大文件',
        'files.networkErrorLargeFile': '网络错误，无法打开大文件',
        'files.getFileListFailed': '获取文件列表失败',
        'files.networkErrorFileList': '网络错误，无法获取文件列表',
        'files.searchFailed': '搜索失败',
        'files.loadFoldersFailed': '加载文件夹失败',
        'files.networkErrorFolders': '网络错误，无法加载文件夹',
        'files.checkingFile': '正在检查文件',
        
        // 数字员工
        'agents.title': '数字员工团队',
        'agents.teamManagement': '数字员工团队管理',
        'agents.deploy': '部署员工',
        'agents.status': '员工状态',
        'agents.manage': '团队管理',
        'agents.initialize': '初始化',
        'agents.systemNotLoaded': '系统状态未加载，请稍后重试',
        'agents.tabSystemNotLoaded': '页签系统未加载，请刷新页面重试',
        'agents.systemRoot': '系统根目录',
        'agents.systemInitialization': '系统初始化',
        'agents.initializationFailed': '创建初始化会话失败: ',
        'agents.noActiveTerminal': '未找到活跃的终端会话，请确保初始化页签已打开',
        'agents.terminalUnavailable': '终端连接不可用，请检查Claude Code是否正常启动',
        
        // 通用操作
        'common.confirm': '连接',
        'common.cancel': '取消',
        'common.save': '保存',
        'common.delete': '删除',
        'common.edit': '编辑',
        'common.close': '关闭',
        'common.loading': '加载中...',
        'common.error': '错误',
        'common.success': '成功',
        'common.warning': '警告',
        'common.info': '信息',
        'common.retryCheck': '重新检测',
        'common.forceContinue': '强制继续',
        'common.retry': '重试',
        
        // 错误消息
        'error.networkError': '网络错误',
        'error.loadFailed': '加载失败',
        'error.saveFailed': '保存失败',
        'error.unknown': '未知错误',
        'error.incompleteEnvironment': '环境配置不完整',
        
        // 设置
        'settings.title': '设置',
        'settings.language': '语言',
        'settings.theme': '主题',
        'settings.general': '通用设置',
        'settings.languageDescription': '选择界面显示语言',
        'settings.about': '关于系统',
        'settings.aboutDescription': '系统信息和版本详情',
        'settings.aboutTitle': 'Claude Co-Desk',
        'settings.aboutSubtitle': '数字员工协作平台',
        'settings.aboutBuiltWith': '基于Claude Code构建',
        
        // 状态消息
        'status.initializing': '初始化中...',
        'status.connecting': '连接中...',
        'status.connected': '已连接',
        'status.disconnected': '已断开',
        'status.ready': '就绪',
        
        // 启动流程状态
        'init.detectingEnvironment': '正在检测环境...',
        'init.foundClaude': '已检测到Claude CLI',
        'init.checkingProjects': '正在检查项目目录',
        'init.connectingWebSocket': '正在连接WebSocket',
        'init.loadingComponents': '正在加载系统组件',
        'init.loadingProjects': '正在加载项目列表',
        'init.systemReady': '系统就绪',
        'init.claudeDetection': 'Claude CLI检测',
        'init.projectsCheck': '项目目录检查',
        'init.websocketConnection': 'WebSocket连接',
        'init.componentInit': '组件初始化',
        'init.projectLoad': '项目加载',
        
        // 侧边栏
        'sidebar.noTasks': '0 个任务',
        'sidebar.noProjects': '0 个项目',
        'sidebar.tasksCount': '个任务',
        'sidebar.projectsCount': '个项目',
        
        // 仪表板
        'dashboard.welcome': '欢迎使用 Claude Co-Desk 数字工作台',
        'dashboard.subtitle': '基于Claude Code的智能协作平台，释放AI对计算机的完全操控潜能',
        'dashboard.systemStatus': '系统状态',
        'dashboard.claudeCli': 'Claude CLI',
        'dashboard.executionPath': '执行路径',
        'dashboard.agentsCount': '智能体数量',
        'dashboard.totalTasks': '总任务数',
        'dashboard.immediateTasks': '即时任务',
        'dashboard.mcpTools': 'MCP工具',
        'dashboard.workingDirectory': '工作目录',
        'dashboard.mcpLoading': '正在加载MCP工具状态...',
        'dashboard.mcpLoadFailed': '无法获取MCP工具状态',
        'dashboard.mcpManageTip': '设置 - MCP工具 可以添加工具',
        'dashboard.initializeSystem': '初始化数字员工系统',
        'dashboard.initializeDesc': '配置您的专属AI团队，开始智能化工作流程',
        'dashboard.welcomeInfo': '任务：全系统操作，项目：单文件夹开发',
        'dashboard.systemNotReady': '系统组件未加载完成，请刷新页面重试',
        'dashboard.taskManagerNotReady': '任务管理器未加载完成，请刷新页面重试',
        'dashboard.claudeNotFound': 'Claude CLI未找到'
    }
};

/**
 * 国际化系统类
 */
class I18n {
    constructor() {
        this.currentLanguage = this.getStoredLanguage() || 'en'; // 默认英文
        this.observers = new Set(); // 观察者模式，用于语言切换通知
        this.components = new Map(); // 全局组件注册表，用于统一管理动态内容刷新
    }
    
    /**
     * 获取存储的语言设置
     */
    getStoredLanguage() {
        try {
            return localStorage.getItem('app_language');
        } catch (error) {
            console.warn('Failed to get language from localStorage:', error);
            return null;
        }
    }
    
    /**
     * 设置当前语言
     */
    setLanguage(lang) {
        if (lang !== 'en' && lang !== 'zh') {
            console.warn('Unsupported language:', lang);
            return;
        }
        
        this.currentLanguage = lang;
        
        try {
            localStorage.setItem('app_language', lang);
        } catch (error) {
            console.warn('Failed to save language to localStorage:', error);
        }
        
        // 通知观察者语言已更改
        this.notifyObservers(lang);
        
        // 更新HTML lang属性
        document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    }
    
    /**
     * 获取当前语言
     */
    getCurrentLanguage() {
        return this.currentLanguage;
    }
    
    /**
     * 获取翻译文本
     */
    t(key) {
        const texts = TEXTS[this.currentLanguage] || TEXTS.en;
        return texts[key] || key;
    }
    
    /**
     * 添加语言切换观察者
     */
    addObserver(callback) {
        this.observers.add(callback);
    }
    
    /**
     * 注册组件的刷新方法
     * @param {string} name - 组件名称
     * @param {Function} refreshMethod - 组件刷新方法
     */
    registerComponent(name, refreshMethod) {
        if (typeof refreshMethod !== 'function') {
            console.warn('Component refresh method must be a function:', name);
            return;
        }
        this.components.set(name, refreshMethod);
        console.log(`组件 ${name} 已注册语言切换刷新方法`);
    }
    
    /**
     * 取消注册组件
     * @param {string} name - 组件名称
     */
    unregisterComponent(name) {
        if (this.components.has(name)) {
            this.components.delete(name);
            console.log(`组件 ${name} 已取消注册`);
        }
    }
    
    /**
     * 移除语言切换观察者
     */
    removeObserver(callback) {
        this.observers.delete(callback);
    }
    
    /**
     * 通知观察者语言已更改
     */
    notifyObservers(lang) {
        // 首先更新静态页面文本
        this.updatePageTexts();
        
        // 然后刷新所有注册的动态组件
        this.components.forEach((refreshMethod, name) => {
            try {
                refreshMethod();
                console.log(`组件 ${name} 语言切换刷新完成`);
            } catch (error) {
                console.error(`组件 ${name} 语言切换刷新失败:`, error);
            }
        });
        
        // 最后通知观察者（保持向后兼容）
        this.observers.forEach(callback => {
            try {
                callback(lang);
            } catch (error) {
                console.error('Error in language change observer:', error);
            }
        });
    }
    
    /**
     * 更新页面中所有带有data-i18n属性的元素
     */
    updatePageTexts() {
        // 更新元素内容
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (key) {
                element.textContent = this.t(key);
            }
        });
        
        // 更新元素title属性
        const titleElements = document.querySelectorAll('[data-i18n-title]');
        titleElements.forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            if (key) {
                element.setAttribute('title', this.t(key));
            }
        });
        
        // 更新元素placeholder属性
        const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
        placeholderElements.forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            if (key) {
                element.setAttribute('placeholder', this.t(key));
            }
        });
    }
    
    /**
     * 获取支持的语言列表
     */
    getSupportedLanguages() {
        return [
            { code: 'en', name: 'English' },
            { code: 'zh', name: '中文' }
        ];
    }
}

// 创建全局i18n实例
window.i18n = new I18n();

// 全局翻译函数
window.t = (key) => window.i18n.t(key);

// 导出(如果使用模块系统)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { I18n, TEXTS };
}

console.log('🌍 I18n system initialized, current language:', window.i18n.getCurrentLanguage());

// 页面加载完成后初始化文本
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.i18n.updatePageTexts();
    });
} else {
    // 如果DOM已经加载完成，直接更新
    window.i18n.updatePageTexts();
}