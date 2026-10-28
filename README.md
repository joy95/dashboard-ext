# 自定义仪表盘（Chrome 扩展）

一个**零构建、直接加载即用**的 Chrome / Edge 新标签页仪表盘。参考 `mini-chrome-ext`（OpenWork）的仪表盘与小组件思路，但**剔除了所有需要授权 / 登录的部分**（本地 Desktop 服务、Native Messaging、飞书 / SSO 登录、各业务模块对内部域名的鉴权、天气 / AI 搜索等需 API Key 的功能），只保留你真正要的能力。

## 功能

- **可自定义仪表盘**：12 列响应式网格，编辑态可拖拽排序、调整尺寸（多种预设比例）。
- **添加小组件**：点击「＋ 添加小组件」从面板选择，内置：
  - 🕒 时钟、📅 日历、✅ 待办清单、📝 随手记、🔗 常用链接、⏳ 倒计时
- **自定义添加网站**：🌐「自定义网站」组件，填入任意网址即可内嵌展示；部分禁止被内嵌的站点会显示空白，可用组件上的「↗」在新标签打开。
- **自动刷新**：
  - 每个「自定义网站」组件可单独设置自动刷新间隔（30 秒 / 1 / 5 / 15 / 30 分钟），也可手动点「⟳」刷新。
  - 顶栏「刷新全部」重载整个仪表盘（含所有内嵌网站）。
  - 设置里可开启「整页自动刷新」（定期重载页面，默认关闭）。
- **本地存储**：所有布局与配置存于 `chrome.storage.local`，不依赖任何服务器，无登录。
- **主题**：橄榄绿（暗）/ 浅色 两套。

## 与参考插件的区别（已剔除的授权部分）

| 参考 OpenWork | 本扩展 |
| --- | --- |
| Tauri 桌面应用 + 本地 Node 服务（WebSocket RPC） | 无，纯前端 |
| Chrome Native Messaging Host | 无 |
| 飞书 / SSO 统一登录、Cookie 拉取 | 无 |
| 需 API Key 的天气、AI 搜索、报告等 | 已移除 |
| pnpm monorepo + React + Vite 构建链 | 零构建，原生 HTML/CSS/JS |

## 安装（开发者模式加载已解压扩展）

1. 打开 Chrome，访问 `chrome://extensions`
2. 右上角打开「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本目录 `dashboard-ext/`
4. 打开新标签页即可看到仪表盘

> Edge 用户：访问 `edge://extensions`，同样开启开发者模式后加载。
> 修改代码后，回到扩展管理页点击「刷新」即可生效。

## 目录结构

```
dashboard-ext/
  manifest.json         MV3 清单（newtab 覆盖 + storage 权限）
  index.html            仪表盘页面
  css/styles.css        主题与样式
  js/storage.js         存储层（chrome.storage 封装）
  js/widgets.js         小组件注册表（渲染 + 配置编辑器）
  js/grid.js            网格渲染与编辑交互
  js/app.js             启动 / 工具栏 / 添加面板 / 设置
  icons/                橄榄绿仪表盘风格图标
```

## 如何扩展新组件

在 `js/widgets.js` 的 `TYPES` 中新增一项，实现 `render(el, w, api)` 与可选的 `editor()`，并在 `sizes` 里声明可用尺寸即可自动出现在「添加小组件」面板。数据型组件把状态写到 `w.config`，通过 `api.save()` 持久化。
