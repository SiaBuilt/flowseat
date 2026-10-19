# FlowSeat v0.2：找工位的工作台

已确认的目标用户：上海自由职业者、远程工作者、独立创业者。核心任务是比较可打开电脑的空间，再决定出发。保持品牌 FlowSeat / 流动工位、黑白极简、海外产品感。真实账号、地图数据与社区服务尚未接入；所有地点与价目明确演示。

本版采用 Anthropic frontend-design 的产品语境与视觉层级方法，参考 Impeccable 的 animate / layout 资料；只阅读文本，不安装或执行第三方脚本。

## 方向

从展示型官网改为直接操作的城市工位工作台。保留品牌字标与工位插画，把视觉记忆点集中在“点列表，地图定位，展开地点预览”的连续关系上。去掉大幅营销首屏与重复编号标题。

布局：紧凑顶栏与搜索 → 意图 / 类型 / 费用筛选 → 左列表右地图，移动端地图优先并可切换列表。详情页为紧凑场景图、决策卡与可切换信息面板。

```
[ FlowSeat       找工位 / 我的收藏            上海     账号 ]
[ 这一次，在哪里进入心流？     搜索               筛选 ]
[ 全部 / 独自专注 / 一起讨论 / 电话会议    地点类型 ]
[ 地点列表（选中高亮） ][ 地图标记 → 选中地点预览       ]
[ 地点对比浮条         ][ 缩放 / 复位 / 换一个         ]
```

颜色：ink #151515、paper #ffffff、canvas #f2f3f1、subtle #e7e9e5、muted #656962。正文字号不低于12px，费用与名字优先。字体使用平台自带 Helvetica Neue / PingFang SC，英文品牌沿用已有字标，不额外下载字体。

## 动效约定

焦点：地图标记选中时外圈出现、地点预览随选择短距切入。列表与地图共享选中状态，列表悬停仅临时强调地图点。
连续性：列表 / 地图切换、详情信息面板切换、筛选抽屉展开。反馈：收藏填充短促缩放、按钮按压、比较托盘出现。不会每个区块滚动飞入，不新增动画依赖。

反馈120–160ms，状态切换180–240ms，抽屉280ms；transform / opacity 为主。支持 prefers-reduced-motion，无自动循环、无持续视差。键盘焦点清晰，主要控件使用 button、输入框有可读标签，弹层支持 Esc，手机操作目标尽量44px。

## 来源

- https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md
- https://github.com/pbakaus/impeccable/blob/main/plugin/skills/impeccable/reference/animate.md
- https://github.com/pbakaus/impeccable/blob/main/plugin/skills/impeccable/reference/layout.md

保留既有费用 / 菜单 / 空位 / 体验 / 纠错能力。不虚构实时库存、实访评分或网络提交成功。
