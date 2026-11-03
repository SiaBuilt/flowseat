# FlowSeat Web service

uni-app 客户端 + Vinext API + Cloudflare D1；同一套前端，不另做 React 页面。当前项目已绑定 Sites 原地址，保留原有私有访问范围。

`client/` 是同版本跨端客户端源码快照，`public/` 是其 Web 产物。`app/route.ts` 返回该网页，`app/api/[...path]` 调用 `server/api.mjs`。数据模型在 `db/schema.ts`，迁移在 `drizzle/`；已应用的迁移不可修改。

独立重建需 Node.js 22.13+：

```sh
npm ci
npm --prefix client ci
npm run build:client
npm run build
npm test
```

在完整工作区，应编辑 `apps/client`，执行根目录 `npm run build:web` 与 `npm run sync:web`，再构建本服务。不要同时编辑两份客户端。

本地运行：`npm run dev -- --port 4173 --hostname 127.0.0.1`。本地数据库与云端数据库分离；首次开发先构建一次并使用 Wrangler 把 `drizzle` 中待应用迁移按顺序应用到 `.wrangler/state`。不要反复重放已应用 SQL。

本地登录由官方 Sites 开发插件模拟，只用于 loopback 开发。生产登录与身份请求头由托管平台提供，不包含本地模拟入口。`.dev.vars` 仅本地使用，禁止提交。

生产审核授权只通过托管平台环境变量 `REVIEWER_USER_IDS` 设置实际网站身份标识；默认空列表。不得用前端参数、本地存储或任意请求体授予角色。修改运行时变量后需要部署已保存版本以生效。

Web 已接入腾讯地图，支持地点聚类、同坐标选择及地图与列表联动；需在运行环境配置 `TENCENT_MAP_KEY`。地点导航支持坐标跳转，未知坐标使用地址搜索。历史版本说明见 [RELEASE-v0.4.md](RELEASE-v0.4.md)，最新产品范围以仓库根目录 README 为准。`0001_public_candidates.sql` 仅将六条公开资料写入待审核队列，不自动发布，不覆盖已有审核结果。没有真实收费。当前仍为私有预览；公众开放、官方微信登录与小程序验收尚待完成。
