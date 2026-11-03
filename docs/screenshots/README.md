# Web 目标效果截图

`web-explore.jpg`、`web-detail.jpg`、`web-compare.jpg`、`web-contribute.jpg` 由当前功能版 Web 的独立本机截图环境实际操作截取。视口为 1440 × 1050；探索与对比使用完整视口截图，详情为 1440 × 1905、投稿为 1440 × 2590 的完整页面截图。投稿仅填写，未提交。旧的非 `web-` 图片保留作历史素材。

## 真实基础信息与设想条件

地点名称、地址、GCJ-02 坐标、类型、区域及基础来源直接取自仓库数据，不编造真实地址，也不代表本轮实时核验：

- `data/shanghai-real-discovery.json`：Cafe OnAir昂云咖啡(利西店)、WeWork中国(威海路社区店)。
- `data/shanghai-expansion-20261025.json`：和平书院、时不我待自习馆·自助(北外滩滨江店)、ideaPod reserved工作咖啡(洛克外滩源店)。
- `data/shanghai-expansion-20261027.json`：徐家汇书院(徐汇区图书馆)、黄浦区图书馆城市书房。
- `data/shanghai-expansion-20261101.json`：北外滩街道图书馆。

仓库已有明确值沿用，包括 `server/research.mjs` 中四处图书馆的开放时间。缺失的费用、插座、座椅、Wi-Fi、分区、进入与停留规则等，用目标状态设想补齐；咖啡馆/工位空间缺失的时间也属于设想。原本无依据的办公许可布尔值属于待确认，在截图环境补为目标状态，不构成许可结论。每条数据的 `targetPreview.assumedFields` 可查看精确补齐字段列表。

设想字段不添加官方、实访或商家证据，不挂真实来源链接作背书；基础资料链接与历史研究记录保留原用途和日期。原始插画仍为示意图。每页统一显示「目标效果，部分条件为设想」，不在每个卡片上重复标注。截图不能作为真实费用、设施、营业状态或审核完成的证明。

## 本机复现

在项目根目录执行（Node.js 22.13+）：

```sh
npm run build:web
npm run sync:web
node scripts/readme-demo.mjs
```

打开 `http://127.0.0.1:8863/`，详情可用 `/#/pages/index/index?id=source-f97015e6b64bf8feb7d28635`，投稿可用 `/#/pages/contribute/index`。探索页选两处「对比」即可查看对比表。完成后 Ctrl+C，独立内存数据随进程销毁。

脚本使用当前客户端与 API，关闭真实地点自动导入，不连接生产数据库，不模拟真实登录。服务仅监听 `127.0.0.1`，不可发布到公网。地图从被 Git 忽略的 `site-preview/.dev.vars` 读取 `TENCENT_MAP_KEY`，不打印密钥；缺少配置时地图关闭。

为避免把目标条件误称真实核实，脚本仅在 HTTP 静态响应中调整来源提示和「社区收录」措辞，并在 HTML 顶部加入统一目标效果提示，不修改生产源码或构建产物。因此这些是当前 Web 的目标效果截图，非原样生产页面。
