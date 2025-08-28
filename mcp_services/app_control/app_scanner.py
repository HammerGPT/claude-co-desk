#!/usr/bin/env python3
"""
Application Scanner Module
Cross-platform system application discovery and CLI tool detection
"""

import os
import platform
import shutil
import logging
import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict, field

logger = logging.getLogger(__name__)

@dataclass
class ApplicationInfo:
    """Application information structure"""
    name: str
    type: str  # 'gui' or 'cli'
    path: str
    executable: Optional[str] = None
    platform: Optional[str] = None
    launch_command: Optional[str] = None
    tags: List[str] = field(default_factory=list)

class ApplicationScanner:
    """Cross-platform application scanner"""
    
    def __init__(self):
        self.platform = platform.system().lower()
        self.cache_file = Path.home() / '.heliki' / 'app_cache.json'
        self.tags_config_file = Path.home() / '.heliki' / 'user_app_tags.json'
        self._ensure_config_dir()
        self._load_user_tags()
        logger.info(f"Application scanner initialized for platform: {self.platform}")
    
    def _ensure_config_dir(self):
        """Ensure .heliki config directory exists"""
        config_dir = Path.home() / '.heliki'
        config_dir.mkdir(exist_ok=True)
    
    def _load_user_tags(self):
        """Load user-defined application tags"""
        self.user_tags = {}
        if self.tags_config_file.exists():
            try:
                with open(self.tags_config_file, 'r', encoding='utf-8') as f:
                    self.user_tags = json.load(f)
                logger.debug(f"Loaded {len(self.user_tags)} user tag configurations")
            except Exception as e:
                logger.warning(f"Failed to load user tags: {e}")
                self.user_tags = {}
    
    def save_user_tags(self):
        """Save user-defined application tags"""
        try:
            with open(self.tags_config_file, 'w', encoding='utf-8') as f:
                json.dump(self.user_tags, f, ensure_ascii=False, indent=2)
            logger.debug("User tags saved successfully")
        except Exception as e:
            logger.error(f"Failed to save user tags: {e}")
    
    def update_app_tags(self, app_name: str, tags: List[str]):
        """Update tags for a specific application"""
        self.user_tags[app_name] = tags
        self.save_user_tags()
        logger.debug(f"Updated tags for {app_name}: {tags}")
    
    def _get_app_smart_tags(self, app_info: ApplicationInfo) -> List[str]:
        """Generate smart tags for application based on name and type"""
        # Check user-defined tags first
        if app_info.name in self.user_tags:
            return self.user_tags[app_info.name]
        
        tags = []
        app_name_lower = app_info.name.lower()
        
        # Development tools
        dev_keywords = ['code', 'studio', 'xcode', 'terminal', 'git', 'docker', 'python', 'node', 'npm', 'java', 'go']
        if any(keyword in app_name_lower for keyword in dev_keywords):
            tags.append('development')
        
        # Design tools
        design_keywords = ['photoshop', 'sketch', 'figma', 'illustrator', 'design', 'creative']
        if any(keyword in app_name_lower for keyword in design_keywords):
            tags.append('design')
        
        # Browsers
        browser_keywords = ['chrome', 'safari', 'firefox', 'edge', 'browser']
        if any(keyword in app_name_lower for keyword in browser_keywords):
            tags.append('browser')
        
        # Office tools
        office_keywords = ['office', 'word', 'excel', 'powerpoint', 'pages', 'numbers', 'keynote', 'preview', 'finder']
        if any(keyword in app_name_lower for keyword in office_keywords):
            tags.append('office')
        
        # Media tools
        media_keywords = ['photo', 'video', 'audio', 'music', 'movie', 'image', 'media', 'player']
        if any(keyword in app_name_lower for keyword in media_keywords):
            tags.append('media')
        
        # System tools
        system_keywords = ['system', 'utility', 'monitor', 'activity', 'disk', 'backup', 'cleaner']
        if any(keyword in app_name_lower for keyword in system_keywords):
            tags.append('system')
        
        # CLI tools default to utility or development
        if app_info.type == 'cli':
            if not tags:  # If no specific category found
                if any(keyword in app_name_lower for keyword in ['git', 'python', 'node', 'npm', 'java', 'go', 'ruby']):
                    tags.append('development')
                else:
                    tags.append('utility')
        
        # If no tags assigned, default to utility
        if not tags:
            tags.append('utility')
        
        return tags
    
    def _load_cache(self) -> Optional[Dict]:
        """Load application cache if valid"""
        if not self.cache_file.exists():
            return None
        
        try:
            cache_age = time.time() - self.cache_file.stat().st_mtime
            if cache_age > 3600:  # Cache expires after 1 hour
                logger.debug("Application cache expired")
                return None
            
            with open(self.cache_file, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
            
            logger.debug(f"Loaded application cache with {len(cache_data)} entries")
            return cache_data
        except Exception as e:
            logger.warning(f"Failed to load cache: {e}")
            return None
    
    def _save_cache(self, applications: Dict[str, ApplicationInfo]):
        """Save application cache"""
        try:
            cache_data = {}
            for name, app in applications.items():
                cache_data[name] = asdict(app)
            
            with open(self.cache_file, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, ensure_ascii=False, indent=2)
            
            logger.debug(f"Saved application cache with {len(cache_data)} entries")
        except Exception as e:
            logger.error(f"Failed to save cache: {e}")
    
    def _restore_from_cache(self, cache_data: Dict) -> Dict[str, ApplicationInfo]:
        """Restore ApplicationInfo objects from cache data"""
        applications = {}
        for name, app_dict in cache_data.items():
            try:
                # Ensure tags field exists (for backward compatibility)
                if 'tags' not in app_dict:
                    app_dict['tags'] = []
                app_info = ApplicationInfo(**app_dict)
                applications[name] = app_info
            except Exception as e:
                logger.warning(f"Failed to restore app {name} from cache: {e}")
        return applications
    
    def scan_all_applications(self, use_cache: bool = True) -> Dict[str, ApplicationInfo]:
        """
        Scan all available applications on the system
        Returns dictionary with app name as key and ApplicationInfo as value
        """
        # Try to load from cache first
        if use_cache:
            cache_data = self._load_cache()
            if cache_data:
                logger.info(f"Loaded {len(cache_data)} applications from cache")
                return self._restore_from_cache(cache_data)
        
        logger.info("Starting comprehensive application scan")
        applications = {}
        
        # Scan GUI applications
        gui_apps = self._scan_gui_applications()
        logger.info(f"Found {len(gui_apps)} GUI applications")
        applications.update(gui_apps)
        
        # Scan CLI tools
        cli_tools = self._scan_cli_tools()
        logger.info(f"Found {len(cli_tools)} CLI tools")
        applications.update(cli_tools)
        
        # Apply smart tags to all applications
        for app_name, app_info in applications.items():
            app_info.tags = self._get_app_smart_tags(app_info)
        
        # Save to cache
        self._save_cache(applications)
        
        logger.info(f"Total applications discovered: {len(applications)}")
        return applications
    
    def _scan_gui_applications(self) -> Dict[str, ApplicationInfo]:
        """Scan GUI applications based on platform"""
        if self.platform == 'darwin':
            return self._scan_macos_applications()
        elif self.platform == 'windows':
            return self._scan_windows_applications()
        elif self.platform == 'linux':
            return self._scan_linux_applications()
        else:
            logger.warning(f"Unsupported platform for GUI scanning: {self.platform}")
            return {}
    
    def _scan_macos_applications(self) -> Dict[str, ApplicationInfo]:
        """Scan macOS applications from /Applications and ~/Applications"""
        applications = {}
        
        app_directories = [
            Path('/Applications'),
            Path.home() / 'Applications'
        ]
        
        for app_dir in app_directories:
            if not app_dir.exists():
                logger.debug(f"Application directory does not exist: {app_dir}")
                continue
                
            logger.debug(f"Scanning macOS applications in: {app_dir}")
            
            try:
                for app_path in app_dir.glob('*.app'):
                    if app_path.is_dir():
                        app_name = app_path.stem
                        app_info = ApplicationInfo(
                            name=app_name,
                            type='gui',
                            path=str(app_path),
                            platform='darwin',
                            launch_command=f'open -a "{app_name}"'
                        )
                        applications[app_name] = app_info
                        logger.debug(f"Discovered macOS app: {app_name}")
                        
            except Exception as e:
                logger.error(f"Error scanning {app_dir}: {e}")
        
        return applications
    
    def _scan_windows_applications(self) -> Dict[str, ApplicationInfo]:
        """Scan Windows applications from Program Files directories"""
        applications = {}
        
        app_directories = [
            Path('C:\\Program Files'),
            Path('C:\\Program Files (x86)'),
            Path(os.path.expanduser('~')) / 'AppData' / 'Local' / 'Programs'
        ]
        
        for app_dir in app_directories:
            if not app_dir.exists():
                logger.debug(f"Application directory does not exist: {app_dir}")
                continue
                
            logger.debug(f"Scanning Windows applications in: {app_dir}")
            
            try:
                for item in app_dir.iterdir():
                    if item.is_dir():
                        # Look for executable files in subdirectories
                        for exe_file in item.rglob('*.exe'):
                            if exe_file.is_file():
                                app_name = exe_file.stem
                                app_info = ApplicationInfo(
                                    name=app_name,
                                    type='gui',
                                    path=str(exe_file),
                                    executable=str(exe_file),
                                    platform='windows',
                                    launch_command=f'start "" "{exe_file}"'
                                )
                                applications[app_name] = app_info
                                logger.debug(f"Discovered Windows app: {app_name}")
                                break  # Only take the first exe in each directory
                                
            except Exception as e:
                logger.error(f"Error scanning {app_dir}: {e}")
        
        return applications
    
    def _scan_linux_applications(self) -> Dict[str, ApplicationInfo]:
        """Scan Linux applications from .desktop files"""
        applications = {}
        
        desktop_directories = [
            Path('/usr/share/applications'),
            Path.home() / '.local' / 'share' / 'applications'
        ]
        
        for desktop_dir in desktop_directories:
            if not desktop_dir.exists():
                logger.debug(f"Desktop directory does not exist: {desktop_dir}")
                continue
                
            logger.debug(f"Scanning Linux applications in: {desktop_dir}")
            
            try:
                for desktop_file in desktop_dir.glob('*.desktop'):
                    if desktop_file.is_file():
                        app_name = desktop_file.stem
                        app_info = ApplicationInfo(
                            name=app_name,
                            type='gui',
                            path=str(desktop_file),
                            platform='linux',
                            launch_command=f'gtk-launch "{app_name}"'
                        )
                        applications[app_name] = app_info
                        logger.debug(f"Discovered Linux app: {app_name}")
                        
            except Exception as e:
                logger.error(f"Error scanning {desktop_dir}: {e}")
        
        return applications
    
    def _scan_cli_tools(self) -> Dict[str, ApplicationInfo]:
        """Scan common CLI tools available in system PATH"""
        
        # Common CLI tools to check for
        common_cli_tools = [
            # Version control
            'git', 'svn', 'hg',
            # Container and virtualization
            'docker', 'podman', 'kubectl',
            # Programming languages
            'python', 'python3', 'node', 'npm', 'yarn', 'ruby', 'java', 'go',
            # Build tools  
            'make', 'cmake', 'gradle', 'maven',
            # Text processing
            'sed', 'awk', 'grep', 'rg', 'fd',
            # File operations
            'rsync', 'scp', 'curl', 'wget',
            # System tools
            'ssh', 'scp', 'zip', 'unzip', 'tar',
            # Media processing
            'ffmpeg', 'imagemagick', 'convert',
            # Database
            'mysql', 'psql', 'sqlite3', 'redis-cli',
            # Cloud tools
            'aws', 'gcloud', 'az',
            # Others
            'vim', 'nano', 'code', 'subl'
        ]
        
        applications = {}
        logger.debug(f"Checking {len(common_cli_tools)} common CLI tools")
        
        for tool_name in common_cli_tools:
            tool_path = shutil.which(tool_name)
            if tool_path:
                app_info = ApplicationInfo(
                    name=tool_name,
                    type='cli',
                    path=tool_path,
                    executable=tool_path,
                    platform=self.platform,
                    launch_command=tool_name
                )
                applications[tool_name] = app_info
                logger.debug(f"Discovered CLI tool: {tool_name} at {tool_path}")
        
        return applications
    
    def get_application_by_name(self, name: str) -> Optional[ApplicationInfo]:
        """Get specific application by name"""
        all_apps = self.scan_all_applications()
        return all_apps.get(name)
    
    def get_applications_by_type(self, app_type: str) -> Dict[str, ApplicationInfo]:
        """Get applications filtered by type ('gui' or 'cli')"""
        all_apps = self.scan_all_applications()
        return {name: app for name, app in all_apps.items() if app.type == app_type}
    
    def get_applications_by_tags(self, tags: List[str], match_all: bool = False) -> Dict[str, ApplicationInfo]:
        """Get applications filtered by tags
        
        Args:
            tags: List of tags to filter by
            match_all: If True, app must have ALL tags. If False, app must have ANY tag.
        """
        all_apps = self.scan_all_applications()
        filtered_apps = {}
        
        for name, app in all_apps.items():
            if match_all:
                # App must have all specified tags
                if all(tag in app.tags for tag in tags):
                    filtered_apps[name] = app
            else:
                # App must have at least one of the specified tags
                if any(tag in app.tags for tag in tags):
                    filtered_apps[name] = app
        
        return filtered_apps
    
    def get_all_tags(self) -> List[str]:
        """Get all unique tags from all applications"""
        all_apps = self.scan_all_applications()
        all_tags = set()
        for app in all_apps.values():
            all_tags.update(app.tags)
        return sorted(list(all_tags))
    
    def clear_cache(self):
        """Clear application cache"""
        if self.cache_file.exists():
            self.cache_file.unlink()
            logger.info("Application cache cleared")
    
    def to_dict(self, applications: Dict[str, ApplicationInfo]) -> Dict[str, Dict[str, Any]]:
        """Convert ApplicationInfo objects to dictionaries for JSON serialization"""
        return {name: asdict(app) for name, app in applications.items()}

def main():
    """Test the application scanner"""
    logging.basicConfig(level=logging.DEBUG)
    
    scanner = ApplicationScanner()
    apps = scanner.scan_all_applications()
    
    print(f"\nDiscovered {len(apps)} applications:")
    
    gui_apps = scanner.get_applications_by_type('gui')
    cli_apps = scanner.get_applications_by_type('cli')
    all_tags = scanner.get_all_tags()
    
    print(f"\nGUI Applications ({len(gui_apps)}):")
    for name, app in gui_apps.items():
        print(f"  {name}: {app.path} [tags: {', '.join(app.tags)}]")
    
    print(f"\nCLI Tools ({len(cli_apps)}):")
    for name, app in cli_apps.items():
        print(f"  {name}: {app.path} [tags: {', '.join(app.tags)}]")
    
    print(f"\nAll Tags ({len(all_tags)}): {', '.join(all_tags)}")
    
    # Test tag filtering
    dev_apps = scanner.get_applications_by_tags(['development'])
    print(f"\nDevelopment Applications ({len(dev_apps)}):")
    for name, app in dev_apps.items():
        print(f"  {name}: {app.type}")

if __name__ == "__main__":
    main()