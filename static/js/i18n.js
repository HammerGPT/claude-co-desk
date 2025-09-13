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
        'task.roleLabel': 'Role',
        'task.skipPermissionsLabel': 'Skip Permissions',
        'task.verboseLogsLabel': 'Verbose Logs',
        'task.statusLabel': 'Task Status',
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
        'task.notificationSettings': 'Notification Settings',
        'task.enableNotifications': 'Enable task completion notifications',
        'task.enableNotificationsDescription': 'Send notifications when task completes',
        'task.notificationMethodsTitle': 'Notification Methods',
        'task.noNotifications': 'No notifications',
        'task.role': 'AI Employee Role',
        'task.selectRole': 'Please select role type',
        'task.goalSettings': 'Goal Settings',
        'task.goalSettingsHelp': 'Set specific goals according to your business requirements (used to evaluate AI employee work effectiveness):',
        'task.goalExampleTitle': 'Goal Setting Examples:',
        'task.goalConfigPlaceholder': 'Please refer to the examples above to set specific work goals, key indicators, and expected outcomes...',
        'task.goalConfigHelp': 'Clear goal setting will help AI employees provide more professional work results',
        'task.description': 'Task Description',
        'task.descriptionPlaceholder': 'Describe the specific work content and background information to be completed...',
        'task.descriptionHelp': 'Detailed description of work content, background and requirements',
        'task.roleHelp': 'Choose the most suitable professional AI employee for this task',
        'task.nameHelp': 'Concise and clear task title',
        
        // 角色类型
        'roles.salesSpecialist': 'Sales Specialist',
        'roles.contentOperations': 'Content Operations',
        'roles.customerService': 'Customer Service',
        'roles.marketResearcher': 'Market Researcher',
        'roles.dataAnalyst': 'Data Analyst',
        'roles.productManager': 'Product Manager',
        'roles.financeAssistant': 'Finance Assistant',
        'roles.workAssistant': 'Work Assistant',
        'roles.documentManager': 'Document Manager',
        'roles.infoCollector': 'Info Collector',
        'roles.fullstackEngineer': 'Fullstack Engineer',
        'roles.mcpManager': 'MCP Manager',
        'roles.workVerifier': 'Work Verifier',
        
        // 项目管理
        'project.loading': 'Loading projects...',
        'project.loadFailed': 'Failed to load projects',
        'project.networkError': 'Network error, unable to load projects',
        'project.noProjects': 'No projects found',
        'project.workingDirectory': 'Main Directory',
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
        'mcp.toolRequirementsTitle': 'Describe Your Tool Requirements',
        'mcp.toolRequirementsDesc': 'Describe the MCP tool functionality you want to add in detail, and the AI assistant will search and recommend suitable tools for you.',
        'mcp.smartAddButton': 'Smart Add MCP',
        'mcp.queryPlaceholder': 'Describe the tool functionality you need, or enter MCP server installation command directly...\n\nFunctionality examples:\n• I need to connect and operate PostgreSQL database\n• I want a tool that can process PDF files\n• I need Slack integration to send messages\n\nDirect installation examples:\n• npx -y @modelcontextprotocol/server-filesystem /path/to/files\n• npx -y @modelcontextprotocol/server-github\n• npx -y @modelcontextprotocol/server-memory\n• uv --directory /path/to/server run server.py',
        'mcp.assistant': 'MCP Tool Assistant',
        'mcp.searchingTools': 'Searching for suitable tools...',
        'mcp.collapse': 'Collapse',
        'mcp.noTools': 'No MCP tools',
        'mcp.noInstalledTools': 'No installed MCP tools',
        'mcp.workingDirectory': 'Home Directory',
        'mcp.toolsCountUnit': 'tools',
        'mcp.statusRunning': 'Running',
        'mcp.statusDisabled': 'Disabled',
        'mcp.noDescription': 'No description',
        'mcp.loadToolsFailed': 'Failed to load tool list',
        
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
        'agents.initializationStarted': 'System Initialization Started',
        'agents.initializationInProgress': 'Initializing system, please wait...',
        'agents.initializationTabCreated': 'New tab created, Claude will start and send initialization instructions',
        'agents.manualSendGuidance': 'Manual Send (Backup)',
        'agents.doNotCloseTab': 'Please do not close this tab during initialization',
        'agents.deploymentSuccess': 'Digital Employee Team Deployed Successfully!',
        'agents.deploymentCount': 'Deployed {count} professional digital employees',
        'agents.availableEmployees': 'Available Employees:',
        'agents.deploymentComplete': 'You can now directly call these digital employees through Claude Code!',
        'agents.employeeNames': {
            'document-manager': 'Document Manager',
            'work-assistant': 'Work Assistant', 
            'finance-assistant': 'Finance Assistant',
            'info-collector': 'Info Collector',
            'fullstack-engineer': 'Fullstack Engineer',
            'ai-product-manager': 'AI Product Manager',
            'mcp-manager': 'MCP Manager'
        },
        
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
        'common.yes': 'Yes',
        'common.no': 'No',
        'common.enabled': 'Enabled',
        'common.disabled': 'Disabled',
        
        // 移动端测试
        'mobile.taskName': 'Task Name',
        'mobile.taskNamePlaceholder': 'Enter task name...',
        'mobile.taskGoal': 'Task Goal',
        'mobile.taskGoalPlaceholder': 'Enter task goal...',
        'mobile.taskDescription': 'Task Description',
        'mobile.taskDescriptionPlaceholder': 'Enter task description...',
        'mobile.aiRole': 'AI Employee Role',
        'mobile.aiRoleSelect': 'Select role...',
        'mobile.goalConfig': 'Goal Configuration',
        'mobile.goalConfigPlaceholder': 'Specific goal configuration and constraints...',
        'mobile.resources': 'Resource Files',
        'mobile.resourcesPlaceholder': 'List resource files (one per line)...',
        'mobile.executionMode': 'Execution Mode',
        'mobile.immediate': 'Immediate',
        'mobile.scheduled': 'Scheduled',
        'mobile.skipPermissions': 'Skip Permissions',
        'mobile.verboseLogs': 'Verbose Logs',
        'mobile.notifications': 'Notification Settings',
        'mobile.enableNotifications': 'Enable Notifications',
        'mobile.notifyEmail': 'Email',
        'mobile.notifyWechat': 'WeChat',
        
        // PC功能提示
        'mobile.pcFeatureHint.settings': 'System settings feature, please use on PC for full experience',
        'mobile.pcFeatureHint.projectManagement': 'Project management feature, please use on PC',
        'mobile.pcFeatureHint.agentsTeam': 'Digital employee team management, please use on PC',
        'mobile.pcFeatureHint.fileManagement': 'File management feature, please use on PC',
        'mobile.pcFeatureHint.default': 'This feature is available on PC',
        'mobile.executeTask': 'Execute Mobile Task',
        'mobile.continueSession': 'Continue Session',
        'mobile.executing': 'Executing mobile task...',
        'mobile.executedSuccessfully': 'Task Executed Successfully',
        'mobile.executionFailed': 'Task Execution Failed',
        'mobile.taskId': 'Task ID',
        'mobile.sessionId': 'Session ID',
        'mobile.status': 'Status',
        'mobile.exitCode': 'Exit Code',
        'mobile.viewResult': 'View Task Result',
        'mobile.viewConversation': 'View Conversation',
        'mobile.continuingSession': 'Continuing session...',
        'mobile.sessionContinued': 'Session Continued Successfully',
        'mobile.continueSessionFailed': 'Continue Session Failed',
        'mobile.noActiveSession': 'No active session to continue',
        'mobile.followUpPrompt': 'Enter follow-up task for the session:',
        'mobile.followUpTitle': 'Ask Follow-up Question',
        'mobile.followUpDescription': 'Continue the conversation for task "{taskName}" by asking a follow-up question:',
        'mobile.followUpPlaceholder': 'Enter your follow-up question... (Ctrl+Enter to send)',
        'mobile.sendFollowUp': 'Send Follow-up',
        'mobile.requestFailed': 'Request Failed',
        'mobile.serverError': 'Failed to send request to server',
        'mobile.sessionMissing': 'Task conversation information is missing, please try again later',
        'mobile.sessionMissingTitle': 'Conversation Not Available',
        'mobile.continueConversationPlaceholder': 'Continue conversation...',
        'mobile.sendingMessage': 'Sending...',
        'mobile.messageSentFailed': 'Failed to send message',
        'mobile.retryMessage': 'Retry',
        'mobile.loadingConversation': 'Loading conversation history...',
        'mobile.noConversationHistory': 'No conversation history',
        'mobile.noConversationDescription': 'This task hasn\'t generated any conversation records yet',
        
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
        
        // 通知配置
        'notifications.settings': 'Notification Settings',
        'notifications.description': 'Configure system task completion notification methods',
        'notifications.email': 'Email Notification',
        'notifications.notConfigured': 'Not Configured',
        'notifications.emailAddress': 'Email Address',
        'notifications.emailAddressHelp': 'Email address used to send notification emails',
        'notifications.senderName': 'Sender Name',
        'notifications.senderNameHelp': 'Display name for email sender',
        'notifications.appPassword': 'App Password',
        'notifications.appPasswordHelp': 'App password (not login password)',
        'notifications.getPasswordHelp': 'How to get?',
        'notifications.detectedConfig': 'Detected Configuration',
        'notifications.provider': 'Provider',
        'notifications.smtpHost': 'SMTP Server',
        'notifications.smtpPort': 'Port',
        'notifications.testConfig': 'Send Test Email',
        'notifications.saveConfig': 'Save Configuration',
        'notifications.passwordHelp': 'App Password Help',
        'notifications.fillRequired': 'Please fill in complete email address and app password',
        'notifications.unsupportedProvider': 'Unsupported email provider, please use supported email services',
        'notifications.configured': 'Configured',
        'notifications.configuredNotTested': 'Configured (Not Tested)',
        'notifications.testSuccess': 'Test email sent successfully! Please check your inbox',
        'notifications.testFailed': 'Test failed',
        'notifications.saveSuccess': 'Email configuration saved successfully!',
        'notifications.saveFailed': 'Save failed',
        'notifications.networkError': 'Network error',
        'notifications.appPasswordPlaceholder': 'Enter app password',
        'notifications.smtpPortHelp': 'Select SMTP server port, usually 587 or 465',
        'notifications.port587': '587 (STARTTLS Recommended)',
        'notifications.port465': '465 (SSL/TLS)',
        'notifications.port25': '25 (Standard SMTP)',
        'notifications.port2525': '2525 (Alternative Port)',
        
        // WeChat Notification
        'notifications.wechat': 'WeChat Notification',
        'notifications.wechatNotBound': 'Not Bound',
        'notifications.wechatBound': 'Bound',
        'notifications.wechatBindingTitle': 'WeChat Account Binding',
        'notifications.wechatBindingDesc': 'Bind your WeChat account to receive task completion notifications',
        'notifications.bindWechat': 'Bind WeChat',
        'notifications.testWechat': 'Send Test',
        'notifications.unbindWechat': 'Unbind',
        'notifications.wechatBinding': 'WeChat Account Binding',
        'notifications.step1': 'Use WeChat to scan the QR code below',
        'notifications.step2': 'Follow the official account and send verification code',
        'notifications.step3': 'You can receive notifications after successful binding',
        'notifications.generatingQR': 'Generating QR code...',
        'notifications.qrHint': 'Please use WeChat Scan function',
        'notifications.qrExpire': 'QR code expires in 5 minutes',
        'notifications.qrExpired': 'QR code expired',
        'notifications.qrExpireIn': 'Expires in',
        'notifications.qrGenerateError': 'Failed to generate QR code',
        'notifications.retryQR': 'Regenerate',
        'notifications.waitingBinding': 'Waiting for WeChat binding...',
        'notifications.refreshStatus': 'Refresh Status',
        'notifications.bindingSuccess': 'WeChat binding successful!',
        'notifications.testWeChatSuccess': 'Test notification sent successfully',
        'notifications.testWeChatFailed': 'Test notification failed',
        'notifications.confirmUnbind': 'Are you sure you want to unbind WeChat account?',
        'notifications.unbindSuccess': 'WeChat account unbound successfully',
        'notifications.unbindFailed': 'Failed to unbind WeChat account',
        'notifications.wechatUser': 'WeChat User',
        'notifications.boundTime': 'Bound at: ',
        'notifications.bound': 'Bound',
        'notifications.needConfig': 'Need Setup',
        'notifications.needBind': 'Need Binding',
        'notifications.needConfigInSettings': 'Go to Settings to configure',
        'notifications.needBindInSettings': 'Go to Settings to bind',
        'notifications.statusUnknown': 'Status Unknown',
        'common.sending': 'Sending...',
        'common.loading': 'Loading...',
        
        // Email provider names
        'providers.qq': 'QQ Mail',
        'providers.foxmail': 'QQ Mail (Foxmail)',
        'providers.163': 'NetEase 163 Mail',
        'providers.126': 'NetEase 126 Mail',
        'providers.gmail': 'Gmail',
        'providers.outlook': 'Outlook.com',
        'providers.hotmail': 'Hotmail',
        'providers.live': 'Live.com',
        'providers.exmail': 'Tencent Enterprise Mail',
        'providers.custom': 'Enterprise Custom Mail',
        'providers.actual': 'Current Configuration',
        
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
        'dashboard.networkAccess': 'Local Access',
        'dashboard.publicAccess': 'Public Access',
        'dashboard.mcpTools': 'MCP Tools',
        'dashboard.workingDirectory': 'Work Directory',
        'dashboard.mcpLoading': 'Loading MCP tools status...',
        'dashboard.mcpLoadFailed': 'Unable to get MCP tools status',
        'dashboard.mcpManageTip': 'Settings - MCP Tools to add tools',
        'dashboard.initializeSystem': 'Initialize Digital Agents System',
        'dashboard.initializeDesc': 'Configure your dedicated AI team and start intelligent workflows',
        'dashboard.welcomeInfo': 'Tasks: Supporting complex system-level tasks | Project: Claude Code operating mode',
        'dashboard.systemNotReady': 'System components not loaded, please refresh and try again',
        'dashboard.taskManagerNotReady': 'Task manager not loaded, please refresh and try again',
        'dashboard.claudeNotFound': 'Claude CLI not found',
        'dashboard.systemApps': 'Applications',
        'dashboard.guiApps': 'GUI Applications',
        'dashboard.cliTools': 'CLI Tools',
        'dashboard.manageMoreApps': 'Manage More Apps',
        'dashboard.launch': 'Launch',
        'dashboard.launching': 'Launching...',
        'dashboard.launchFailed': 'Failed to launch application',
        'dashboard.appsLoading': 'Loading applications...',
        'dashboard.noAppsFound': 'No applications found',
        'dashboard.appsManageTip': 'Settings - Application Management to manage apps',
        'dashboard.manageMcpTools': 'Manage MCP Tools',
        'dashboard.getPublicLink': 'Get Public Link',
        'dashboard.gettingPublicLink': 'Getting Public Link...',
        'dashboard.publicLinkReady': 'Public Link Ready',
        'dashboard.publicLinkDesc': 'Your local service is now accessible from the internet:',
        'dashboard.copyLink': 'Copy Link',
        'dashboard.openLink': 'Open Link',
        'dashboard.close': 'Close',
        'dashboard.linkCopied': 'Link copied to clipboard!',
        'dashboard.poweredBy': 'Powered by',
        'dashboard.publicLinkFailed': 'Failed to get public link',
        'dashboard.publicLinkError': 'Error getting public link',
        
        // 初始化引导
        'initGuide.welcomeTitle': 'Welcome to Claude Co-Desk!',
        'initGuide.welcomeMessage': 'To get started, we need to initialize your system. This will set up your digital workspace and deploy AI agents to help you with various tasks.',
        'initGuide.startInit': 'Start Initialization',
        'initGuide.skipForNow': 'Skip for Now',
        'initGuide.bannerTitle': 'System Initialization Required',
        'initGuide.bannerMessage': 'Complete setup to unlock all features',
        'initGuide.initializeNow': 'Initialize Now',
        'initGuide.remindLater': 'Later',
        'initGuide.systemNotReady': 'System not ready. Please refresh and try again.',
        
        // 应用控制
        'apps.title': 'Application Control',
        'apps.management': 'Application',
        'apps.managementDescription': 'Discover and manage system applications for Claude Code integration',
        'apps.scanApps': 'Scan Applications',
        'apps.refresh': 'Refresh',
        'apps.noApps': 'No applications found',
        'apps.localApps': 'Local Applications',
        'apps.cliTools': 'CLI Tools',
        'apps.discovered': 'applications discovered',
        'apps.mcpServer': 'MCP Server',
        'apps.status': 'Status',
        'apps.connected': 'Connected',
        'apps.disconnected': 'Disconnected',
        'apps.launching': 'Launching application...',
        'apps.launchSuccess': 'Application launched successfully',
        'apps.launchFailed': 'Failed to launch application',
        'apps.scanSuccess': 'Applications scanned successfully',
        'apps.scanFailed': 'Failed to scan applications',
        'apps.configuring': 'Configuring MCP server...',
        'apps.configSuccess': 'MCP server configured successfully',
        'apps.configFailed': 'Failed to configure MCP server',
        'apps.type': 'Type',
        'apps.path': 'Path',
        'apps.platform': 'Platform',
        'apps.launch': 'Launch',
        'apps.info': 'Info',
        'apps.editTagsFor': 'Edit Tags for',
        'apps.currentTags': 'Current Tags:',
        'apps.noTags': 'No tags',
        'apps.addTag': 'Add Tag:',
        'apps.enterTagName': 'Enter tag name...',
        'apps.add': 'Add',
        'apps.commonTags': 'Common Tags:',
        'apps.saveTags': 'Save Tags'
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
        'task.roleLabel': '选择角色',
        'task.skipPermissionsLabel': '跳过权限检查',
        'task.verboseLogsLabel': '详细日志',
        'task.statusLabel': '任务状态',
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
        'task.notificationSettings': '通知设置',
        'task.enableNotifications': '启用任务完成通知',
        'task.enableNotificationsDescription': '任务完成后发送通知提醒',
        'task.notificationMethodsTitle': '通知方式',
        'task.noNotifications': '不通知',
        'task.role': 'AI员工角色',
        'task.selectRole': '请选择角色类型',
        'task.goalSettings': '目标设定',
        'task.goalSettingsHelp': '请根据您的业务需求设定具体目标（将用于评估AI员工的工作效果）：',
        'task.goalExampleTitle': '目标设定示例：',
        'task.goalConfigPlaceholder': '请参考上方示例，设定具体的工作目标、关键指标和预期成果...',
        'task.goalConfigHelp': '明确的目标设定将帮助AI员工提供更专业的工作成果',
        'task.description': '任务描述',
        'task.descriptionPlaceholder': '描述需要完成的具体工作内容和背景信息...',
        'task.descriptionHelp': '详细说明工作内容、背景和要求',
        'task.roleHelp': '选择最适合处理此任务的专业AI员工',
        'task.nameHelp': '简洁明确的任务标题',
        
        // 角色类型
        'roles.salesSpecialist': '销售专员',
        'roles.contentOperations': '内容运营',
        'roles.customerService': '客服专员',
        'roles.marketResearcher': '市场调研员',
        'roles.dataAnalyst': '数据分析师',
        'roles.productManager': '产品经理',
        'roles.financeAssistant': '财务助手',
        'roles.workAssistant': '工作助理',
        'roles.documentManager': '文档管理员',
        'roles.infoCollector': '信息收集员',
        'roles.fullstackEngineer': '全栈工程师',
        'roles.mcpManager': 'MCP管理员',
        'roles.workVerifier': '工作验证员',
        
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
        'mcp.toolRequirementsTitle': '描述您的工具需求',
        'mcp.toolRequirementsDesc': '详细描述您希望添加的MCP工具功能，AI助手将为您搜索和推荐合适的工具。',
        'mcp.smartAddButton': '智能添加MCP',
        'mcp.queryPlaceholder': '请描述您需要的工具功能，或直接输入MCP服务器安装命令...\n\n功能需求示例：\n• 我需要连接和操作PostgreSQL数据库\n• 我想要一个能够处理PDF文件的工具\n• 我需要与Slack集成发送消息的功能\n\n直接安装命令示例：\n• npx -y @modelcontextprotocol/server-filesystem /path/to/files\n• npx -y @modelcontextprotocol/server-github\n• npx -y @modelcontextprotocol/server-memory\n• uv --directory /path/to/server run server.py',
        'mcp.assistant': 'MCP工具助手',
        'mcp.searchingTools': '正在搜索合适的工具...',
        'mcp.collapse': '收起',
        'mcp.noTools': '无MCP工具',
        'mcp.noInstalledTools': '暂无已安装的MCP工具',
        'mcp.workingDirectory': '工作目录',
        'mcp.toolsCountUnit': '个',
        'mcp.statusRunning': '运行中',
        'mcp.statusDisabled': '已禁用',
        'mcp.noDescription': '暂无描述',
        'mcp.loadToolsFailed': '加载工具列表失败',
        
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
        'agents.initializationStarted': '系统初始化已启动',
        'agents.initializationInProgress': '正在初始化系统，请稍候...',
        'agents.initializationTabCreated': '新页签已创建，将直接启动Claude并发送初始化指令',
        'agents.manualSendGuidance': '手动发送引导（备用）',
        'agents.doNotCloseTab': '初始化期间请勿关闭此页签',
        'agents.deploymentSuccess': '数字员工团队部署成功！',
        'agents.deploymentCount': '已部署 {count} 个专业数字员工',
        'agents.availableEmployees': '可用员工：',
        'agents.deploymentComplete': '现在可以通过Claude Code直接调用这些数字员工了！',
        'agents.employeeNames': {
            'document-manager': '文档管理员',
            'work-assistant': '工作助理', 
            'finance-assistant': '财务助理',
            'info-collector': '信息收集员',
            'fullstack-engineer': '全栈工程师',
            'ai-product-manager': 'AI产品经理',
            'mcp-manager': 'MCP管理员'
        },
        
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
        'common.yes': '是',
        'common.no': '否',
        'common.enabled': '启用',
        'common.disabled': '禁用',
        
        // 移动端测试
        'mobile.taskName': '任务名称',
        'mobile.taskNamePlaceholder': '输入任务名称...',
        'mobile.taskGoal': '任务目标',
        'mobile.taskGoalPlaceholder': '输入任务目标...',
        'mobile.taskDescription': '任务描述',
        'mobile.taskDescriptionPlaceholder': '输入任务描述...',
        'mobile.aiRole': 'AI员工角色',
        'mobile.aiRoleSelect': '选择角色...',
        'mobile.goalConfig': '目标设定',
        'mobile.goalConfigPlaceholder': '具体的目标配置和约束条件...',
        'mobile.resources': '资源文件',
        'mobile.resourcesPlaceholder': '列出资源文件（每行一个）...',
        'mobile.executionMode': '执行方式',
        'mobile.immediate': '立即执行',
        'mobile.scheduled': '定时执行',
        'mobile.skipPermissions': '跳过权限',
        'mobile.verboseLogs': '详细日志',
        'mobile.notifications': '通知设置',
        'mobile.enableNotifications': '启用通知',
        'mobile.notifyEmail': '邮件',
        'mobile.notifyWechat': '微信',
        
        // PC功能提示
        'mobile.pcFeatureHint.settings': '系统设置功能请在PC端使用，以获得完整体验',
        'mobile.pcFeatureHint.projectManagement': '项目管理功能请在PC端使用',
        'mobile.pcFeatureHint.agentsTeam': '数字员工团队管理请在PC端使用',
        'mobile.pcFeatureHint.fileManagement': '文件管理功能请在PC端使用',
        'mobile.pcFeatureHint.default': '此功能请在PC端使用',
        'mobile.executeTask': '执行移动端任务',
        'mobile.continueSession': '继续会话',
        'mobile.executing': '正在执行移动端任务...',
        'mobile.executedSuccessfully': '任务执行成功',
        'mobile.executionFailed': '任务执行失败',
        'mobile.taskId': '任务ID',
        'mobile.sessionId': '会话ID',
        'mobile.status': '状态',
        'mobile.exitCode': '退出码',
        'mobile.viewResult': '查看任务结果',
        'mobile.viewConversation': '查看会话',
        'mobile.continuingSession': '正在继续会话...',
        'mobile.sessionContinued': '会话继续成功',
        'mobile.continueSessionFailed': '继续会话失败',
        'mobile.noActiveSession': '没有活跃会话可继续',
        'mobile.followUpPrompt': '输入会话的后续任务：',
        'mobile.followUpTitle': '发送追问',
        'mobile.followUpDescription': '向任务"{taskName}"的会话继续追问：',
        'mobile.followUpPlaceholder': '输入您的追问内容... (Ctrl+Enter发送)',
        'mobile.sendFollowUp': '发送追问',
        'mobile.requestFailed': '请求失败',
        'mobile.serverError': '发送请求到服务器失败',
        'mobile.sessionMissing': '任务会话信息缺失，请稍后再试',
        'mobile.sessionMissingTitle': '会话不可用',
        'mobile.continueConversationPlaceholder': '继续对话...',
        'mobile.sendingMessage': '发送中...',
        'mobile.messageSentFailed': '消息发送失败',
        'mobile.retryMessage': '重试',
        'mobile.loadingConversation': '正在加载对话历史...',
        'mobile.noConversationHistory': '暂无对话历史',
        'mobile.noConversationDescription': '该任务还没有生成对话记录',
        
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
        
        // 通知配置
        'notifications.settings': '通知配置',
        'notifications.description': '配置系统任务完成通知方式',
        'notifications.email': '邮件通知',
        'notifications.notConfigured': '未配置',
        'notifications.emailAddress': '邮箱地址',
        'notifications.emailAddressHelp': '用于发送通知邮件的邮箱地址',
        'notifications.senderName': '发送人名称',
        'notifications.senderNameHelp': '邮件发送人显示名称',
        'notifications.appPassword': '应用密码',
        'notifications.appPasswordHelp': '应用密码（非登录密码）',
        'notifications.getPasswordHelp': '如何获取？',
        'notifications.detectedConfig': '检测到配置',
        'notifications.provider': '服务商',
        'notifications.smtpHost': 'SMTP服务器',
        'notifications.smtpPort': '端口',
        'notifications.testConfig': '发送测试邮件',
        'notifications.saveConfig': '保存配置',
        'notifications.passwordHelp': '应用密码获取帮助',
        'notifications.fillRequired': '请填写完整的邮箱地址和应用密码',
        'notifications.unsupportedProvider': '不支持的邮箱服务商，请使用支持的邮箱',
        'notifications.configured': '配置完成',
        'notifications.configuredNotTested': '配置完成（未测试）',
        'notifications.testSuccess': '测试邮件发送成功！请检查收件箱',
        'notifications.testFailed': '测试失败',
        'notifications.saveSuccess': '邮件配置保存成功！',
        'notifications.saveFailed': '保存失败',
        'notifications.networkError': '网络错误',
        'notifications.appPasswordPlaceholder': '请输入应用密码',
        'notifications.smtpPortHelp': '选择SMTP服务器端口，通常587或465',
        'notifications.port587': '587 (STARTTLS推荐)',
        'notifications.port465': '465 (SSL/TLS)',
        'notifications.port25': '25 (标准SMTP)',
        'notifications.port2525': '2525 (备用端口)',
        
        // 微信通知
        'notifications.wechat': '微信通知',
        'notifications.wechatNotBound': '未绑定',
        'notifications.wechatBound': '已绑定',
        'notifications.wechatBindingTitle': '微信账号绑定',
        'notifications.wechatBindingDesc': '绑定您的微信账号以接收任务完成通知',
        'notifications.bindWechat': '绑定微信',
        'notifications.testWechat': '发送测试',
        'notifications.unbindWechat': '解除绑定',
        'notifications.wechatBinding': '微信账号绑定',
        'notifications.step1': '使用微信扫描下方二维码',
        'notifications.step2': '关注公众号并发送验证码',
        'notifications.step3': '绑定成功后即可接收通知',
        'notifications.generatingQR': '正在生成二维码...',
        'notifications.qrHint': '请使用微信扫一扫功能',
        'notifications.qrExpire': '二维码5分钟内有效',
        'notifications.qrExpired': '二维码已过期',
        'notifications.qrExpireIn': '剩余时间',
        'notifications.qrGenerateError': '生成二维码失败',
        'notifications.retryQR': '重新生成',
        'notifications.waitingBinding': '等待微信绑定...',
        'notifications.refreshStatus': '刷新状态',
        'notifications.bindingSuccess': '微信绑定成功！',
        'notifications.testWeChatSuccess': '测试通知发送成功',
        'notifications.testWeChatFailed': '测试通知发送失败',
        'notifications.confirmUnbind': '确定要解除微信账号绑定吗？',
        'notifications.unbindSuccess': '微信账号解绑成功',
        'notifications.unbindFailed': '解除微信绑定失败',
        'notifications.wechatUser': '微信用户',
        'notifications.boundTime': '绑定时间：',
        'notifications.bound': '已绑定',
        'notifications.needConfig': '需要配置',
        'notifications.needBind': '需要绑定',
        'notifications.needConfigInSettings': '去设置中配置',
        'notifications.needBindInSettings': '去设置中绑定',
        'notifications.statusUnknown': '状态未知',
        'common.sending': '发送中...',
        'common.loading': '加载中...',
        
        // 邮箱提供商名称
        'providers.qq': 'QQ邮箱',
        'providers.foxmail': 'QQ邮箱(Foxmail)',
        'providers.163': '网易163邮箱',
        'providers.126': '网易126邮箱',
        'providers.gmail': 'Gmail',
        'providers.outlook': 'Outlook.com',
        'providers.hotmail': 'Hotmail',
        'providers.live': 'Live.com',
        'providers.exmail': '腾讯企业邮箱',
        'providers.custom': '企业自定义邮箱',
        'providers.actual': '当前配置',
        
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
        'dashboard.networkAccess': '网络访问',
        'dashboard.mcpTools': 'MCP工具',
        'dashboard.workingDirectory': '工作目录',
        'dashboard.mcpLoading': '正在加载MCP工具状态...',
        'dashboard.mcpLoadFailed': '无法获取MCP工具状态',
        'dashboard.mcpManageTip': '设置 - MCP工具 可以添加工具',
        'dashboard.initializeSystem': '初始化数字员工系统',
        'dashboard.initializeDesc': '配置您的专属AI团队，开始智能化工作流程',
        'dashboard.welcomeInfo': '任务：支持系统级复杂任务丨项目：Claude Code操作模式',
        'dashboard.systemNotReady': '系统组件未加载完成，请刷新页面重试',
        'dashboard.taskManagerNotReady': '任务管理器未加载完成，请刷新页面重试',
        'dashboard.claudeNotFound': 'Claude CLI未找到',
        'dashboard.systemApps': '系统应用',
        'dashboard.guiApps': 'GUI应用',
        'dashboard.cliTools': 'CLI工具',
        'dashboard.manageMoreApps': '管理更多应用',
        'dashboard.launch': '启动',
        'dashboard.launching': '启动中...',
        'dashboard.launchFailed': '应用启动失败',
        'dashboard.appsLoading': '正在加载应用...',
        'dashboard.noAppsFound': '未找到应用',
        'dashboard.appsManageTip': '设置 - 应用管理 可以管理应用',
        'dashboard.manageMcpTools': '管理MCP工具',
        'dashboard.getPublicLink': '获取公网链接',
        'dashboard.gettingPublicLink': '正在获取公网链接...',
        'dashboard.publicLinkReady': '公网链接已就绪',
        'dashboard.publicLinkDesc': '您的本地服务现在可以从互联网访问：',
        'dashboard.copyLink': '复制链接',
        'dashboard.openLink': '打开链接',
        'dashboard.close': '关闭',
        'dashboard.linkCopied': '链接已复制到剪贴板！',
        'dashboard.poweredBy': '技术支持',
        'dashboard.publicLinkFailed': '获取公网链接失败',
        'dashboard.publicLinkError': '获取公网链接时出错',
        
        // 初始化引导
        'initGuide.welcomeTitle': '欢迎使用 Claude Co-Desk！',
        'initGuide.welcomeMessage': '开始使用前，我们需要初始化您的系统。这将设置您的数字工作区并部署AI智能体来协助您完成各种任务。',
        'initGuide.startInit': '开始初始化',
        'initGuide.skipForNow': '暂时跳过',
        'initGuide.bannerTitle': '需要系统初始化',
        'initGuide.bannerMessage': '完成设置以解锁所有功能',
        'initGuide.initializeNow': '立即初始化',
        'initGuide.remindLater': '稍后',
        'initGuide.systemNotReady': '系统未就绪，请刷新后重试。',
        
        // 应用控制
        'apps.title': '应用控制',
        'apps.management': '应用管理',
        'apps.managementDescription': '发现并管理系统应用程序，用于Claude Code集成',
        'apps.scanApps': '扫描应用',
        'apps.refresh': '刷新',
        'apps.noApps': '未发现应用',
        'apps.localApps': '本地应用',
        'apps.cliTools': '命令行工具',
        'apps.discovered': '个应用已发现',
        'apps.mcpServer': 'MCP服务器',
        'apps.status': '状态',
        'apps.connected': '已连接',
        'apps.disconnected': '已断开',
        'apps.launching': '正在启动应用...',
        'apps.launchSuccess': '应用启动成功',
        'apps.launchFailed': '应用启动失败',
        'apps.scanSuccess': '应用扫描成功',
        'apps.scanFailed': '应用扫描失败',
        'apps.configuring': '正在配置MCP服务器...',
        'apps.configSuccess': 'MCP服务器配置成功',
        'apps.configFailed': 'MCP服务器配置失败',
        'apps.type': '类型',
        'apps.path': '路径',
        'apps.platform': '平台',
        'apps.launch': '启动',
        'apps.info': '详情',
        'apps.editTagsFor': '编辑标签：',
        'apps.currentTags': '当前标签：',
        'apps.noTags': '无标签',
        'apps.addTag': '添加标签：',
        'apps.enterTagName': '输入标签名称...',
        'apps.add': '添加',
        'apps.commonTags': '常用标签：',
        'apps.saveTags': '保存标签'
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
    }
    
    /**
     * 取消注册组件
     * @param {string} name - 组件名称
     */
    unregisterComponent(name) {
        if (this.components.has(name)) {
            this.components.delete(name);
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
            } catch (error) {
                console.error(`Component ${name} language refresh failed:`, error);
            }
        });
        
        // 刷新通知状态以保持数据一致性
        setTimeout(() => {
            if (window.enhancedSidebar && typeof window.enhancedSidebar.refreshNotificationStatus === 'function') {
                try {
                    window.enhancedSidebar.refreshNotificationStatus();
                    console.log('Notification status refreshed after language change');
                } catch (error) {
                    console.error('Failed to refresh notification status after language change:', error);
                }
            }
        }, 500);
        
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