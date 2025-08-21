# 社交图标资源

请将以下图标文件放置在此目录中：

## GitHub 图标
- `github-gray.png` - GitHub灰色图标（24x24px）
- `github-color.png` - GitHub彩色图标（24x24px）

## Twitter/X 图标
- `twitter-gray.png` - Twitter灰色图标（24x24px）
- `twitter-color.png` - Twitter彩色图标（24x24px）

## 抖音图标
- `douin-gray.png` - 抖音灰色图标（24x24px）
- `douyin-color.png` - 抖音彩色图标（24x24px）

## 微信图标
- `wechat-gray.png` - 微信灰色图标（24x24px）
- `wechat-color.png` - 微信彩色图标（24x24px）
- `wechat_qrcode.jpg` - 微信二维码图片（建议120x120px）

## 图标规格建议
- 格式：PNG（图标），JPG（二维码）
- 尺寸：24x24px（社交图标），120x120px（二维码）
- 背景：透明背景（PNG图标）
- 风格：简洁、清晰的图标设计

## 使用说明
- 灰色图标用于默认状态
- 彩色图标用于鼠标悬停状态
- 微信二维码会在鼠标悬停微信图标时显示
- 所有图标都有平滑的透明度过渡效果，避免抖动

## 修复的问题
- 使用透明度过渡替代display切换，避免图标抖动
- 固定容器尺寸（32x32px），图标居中对齐
- 使用transform: translate(-50%, -50%) 精确居中定位