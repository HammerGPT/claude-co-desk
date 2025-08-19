/**
 * 语法高亮工具类 - 基于Prism.js
 * 支持多种编程语言的语法高亮
 */

class SyntaxHighlighter {
    constructor() {
        this.languageMap = {
            // JavaScript相关
            'js': 'javascript',
            'jsx': 'jsx',
            'ts': 'typescript',
            'tsx': 'tsx',
            'mjs': 'javascript',
            'cjs': 'javascript',
            
            // Python
            'py': 'python',
            'pyw': 'python',
            'pyi': 'python',
            
            // Web相关
            'html': 'html',
            'htm': 'html',
            'css': 'css',
            'scss': 'scss',
            'sass': 'sass',
            'less': 'less',
            
            // 配置文件
            'json': 'json',
            'xml': 'xml',
            'yaml': 'yaml',
            'yml': 'yaml',
            'toml': 'toml',
            'ini': 'ini',
            
            // 标记语言
            'md': 'markdown',
            'markdown': 'markdown',
            'rst': 'rst',
            
            // Shell脚本
            'sh': 'bash',
            'bash': 'bash',
            'zsh': 'bash',
            'fish': 'bash',
            'ps1': 'powershell',
            
            // 其他编程语言
            'java': 'java',
            'c': 'c',
            'cpp': 'cpp',
            'cxx': 'cpp',
            'cc': 'cpp',
            'h': 'c',
            'hpp': 'cpp',
            'go': 'go',
            'rs': 'rust',
            'php': 'php',
            'rb': 'ruby',
            'swift': 'swift',
            'kt': 'kotlin',
            'scala': 'scala',
            
            // 数据库
            'sql': 'sql',
            
            // 配置和脚本
            'dockerfile': 'docker',
            'gitignore': 'gitignore',
            'makefile': 'makefile',
            
            // 文本文件
            'txt': 'text',
            'log': 'log'
        };
        
        this.themeMode = 'light'; // 'light' or 'dark'
        this.init();
    }
    
    /**
     * 初始化语法高亮器
     */
    init() {
        // 配置Prism.js自动加载器
        if (window.Prism && window.Prism.plugins && window.Prism.plugins.autoloader) {
            window.Prism.plugins.autoloader.languages_path = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/';
        }
        
        // 监听主题变化
        this.detectTheme();
        
        // 监听系统主题变化
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                this.detectTheme();
            });
        }
    }
    
    /**
     * 检测当前主题
     */
    detectTheme() {
        const isDark = document.body.classList.contains('dark') || 
                      window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.themeMode = isDark ? 'dark' : 'light';
    }
    
    /**
     * 根据文件扩展名获取语言标识
     */
    getLanguageFromExtension(filename) {
        if (!filename) return 'text';
        
        const ext = filename.split('.').pop()?.toLowerCase();
        if (!ext) return 'text';
        
        return this.languageMap[ext] || 'text';
    }
    
    /**
     * 获取语言的显示名称
     */
    getLanguageDisplayName(language) {
        const displayNames = {
            'javascript': 'JavaScript',
            'typescript': 'TypeScript',
            'jsx': 'React JSX',
            'tsx': 'React TSX',
            'python': 'Python',
            'html': 'HTML',
            'css': 'CSS',
            'scss': 'SCSS',
            'sass': 'Sass',
            'less': 'Less',
            'json': 'JSON',
            'xml': 'XML',
            'yaml': 'YAML',
            'markdown': 'Markdown',
            'bash': 'Shell Script',
            'powershell': 'PowerShell',
            'java': 'Java',
            'c': 'C',
            'cpp': 'C++',
            'go': 'Go',
            'rust': 'Rust',
            'php': 'PHP',
            'ruby': 'Ruby',
            'swift': 'Swift',
            'kotlin': 'Kotlin',
            'scala': 'Scala',
            'sql': 'SQL',
            'docker': 'Dockerfile',
            'text': '纯文本'
        };
        
        return displayNames[language] || language.toUpperCase();
    }
    
    /**
     * 高亮代码
     */
    highlightCode(code, language = 'text') {
        if (!window.Prism || !code) {
            return this.escapeHtml(code);
        }
        
        try {
            // 确保语言存在
            if (language !== 'text' && !window.Prism.languages[language]) {
                // 如果语言不存在，尝试加载
                return this.loadLanguageAndHighlight(code, language);
            }
            
            if (language === 'text') {
                return `<pre class="language-text"><code>${this.escapeHtml(code)}</code></pre>`;
            }
            
            const highlighted = window.Prism.highlight(code, window.Prism.languages[language], language);
            return `<pre class="language-${language} line-numbers"><code>${highlighted}</code></pre>`;
            
        } catch (error) {
            console.warn('语法高亮失败:', error);
            return `<pre class="language-text"><code>${this.escapeHtml(code)}</code></pre>`;
        }
    }
    
    /**
     * 异步加载语言包并高亮
     */
    async loadLanguageAndHighlight(code, language) {
        try {
            // 动态加载语言包
            const script = document.createElement('script');
            script.src = `https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-${language}.min.js`;
            
            return new Promise((resolve) => {
                script.onload = () => {
                    try {
                        if (window.Prism.languages[language]) {
                            const highlighted = window.Prism.highlight(code, window.Prism.languages[language], language);
                            resolve(`<pre class="language-${language} line-numbers"><code>${highlighted}</code></pre>`);
                        } else {
                            resolve(`<pre class="language-text"><code>${this.escapeHtml(code)}</code></pre>`);
                        }
                    } catch (error) {
                        resolve(`<pre class="language-text"><code>${this.escapeHtml(code)}</code></pre>`);
                    }
                };
                
                script.onerror = () => {
                    resolve(`<pre class="language-text"><code>${this.escapeHtml(code)}</code></pre>`);
                };
                
                document.head.appendChild(script);
            });
            
        } catch (error) {
            return `<pre class="language-text"><code>${this.escapeHtml(code)}</code></pre>`;
        }
    }
    
    /**
     * 为现有的textarea元素添加语法高亮
     */
    enhanceTextarea(textarea, filename) {
        if (!textarea) return;
        
        const language = this.getLanguageFromExtension(filename);
        const container = textarea.parentElement;
        
        // 创建语法高亮容器
        const highlightContainer = document.createElement('div');
        highlightContainer.className = 'syntax-highlight-container';
        highlightContainer.style.position = 'relative';
        
        // 创建高亮显示层
        const highlightLayer = document.createElement('div');
        highlightLayer.className = 'syntax-highlight-layer';
        highlightLayer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
            font-family: inherit;
            font-size: inherit;
            line-height: inherit;
            padding: inherit;
            margin: 0;
            border: none;
            background: transparent;
            overflow: hidden;
            white-space: pre;
            word-wrap: break-word;
            color: transparent;
        `;
        
        // 设置textarea样式
        textarea.style.position = 'relative';
        textarea.style.background = 'transparent';
        textarea.style.zIndex = '2';
        textarea.style.color = 'inherit';
        
        // 插入高亮层
        container.insertBefore(highlightContainer, textarea);
        highlightContainer.appendChild(highlightLayer);
        highlightContainer.appendChild(textarea);
        
        // 同步滚动和内容
        const updateHighlight = () => {
            const code = textarea.value;
            this.highlightCode(code, language).then(highlighted => {
                highlightLayer.innerHTML = highlighted;
                highlightLayer.scrollTop = textarea.scrollTop;
                highlightLayer.scrollLeft = textarea.scrollLeft;
            });
        };
        
        // 绑定事件
        textarea.addEventListener('input', updateHighlight);
        textarea.addEventListener('scroll', () => {
            highlightLayer.scrollTop = textarea.scrollTop;
            highlightLayer.scrollLeft = textarea.scrollLeft;
        });
        
        // 初始高亮
        updateHighlight();
        
        return {
            update: updateHighlight,
            destroy: () => {
                highlightContainer.remove();
            }
        };
    }
    
    /**
     * 获取文件类型图标
     */
    getFileTypeIcon(filename) {
        const language = this.getLanguageFromExtension(filename);
        const icons = {
            'javascript': '',
            'typescript': '',
            'jsx': '',
            'tsx': '',
            'python': '',
            'html': '',
            'css': '',
            'scss': '',
            'sass': '',
            'json': '',
            'xml': '',
            'yaml': '',
            'markdown': '',
            'bash': '',
            'java': '',
            'c': '',
            'cpp': '',
            'go': '',
            'rust': '',
            'php': '',
            'ruby': '',
            'swift': '',
            'sql': '',
            'docker': '',
            'text': ''
        };
        
        return icons[language] || '';
    }
    
    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 创建全局实例
window.syntaxHighlighter = new SyntaxHighlighter();