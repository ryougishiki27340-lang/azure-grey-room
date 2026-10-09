# Azure's Grey Room

一个分享 **杉菜水姫（すぎな みき）/ Innocent Grey** 美术素材与相关资讯的个人站点。
纯静态：手写的 HTML + CSS + JS，**没有框架、没有构建步骤、没有外部依赖**，双击 `index.html` 就能看。
视觉形式参考 [Axi's Blog](https://axi404.top)（Astro 主题 Axi）。

## 目录结构

```
azure-blog/
├── index.html                  # 首页：关于、素材橱窗、作品橱窗、统计、最新文章、链接
├── gallery.html                # 素材画廊（12 张 + 灯箱 + 版权与来源清单）
├── favicon.svg
├── assets/
│   ├── css/style.css           # 全部样式与设计变量（深浅色主题）
│   ├── js/main.js              # 交互脚本（主题、目录、阅读进度、筛选、灯箱、站点配置）
│   └── img/
│       ├── avatar.jpg          # 头像（官方原画裁切）
│       ├── cover-*.jpg         # 三篇文章封面
│       ├── banner-gallery.jpg  # 画廊页横幅
│       ├── gallery/g01-g20.jpg # 画廊素材（g01-g12 来自官方宣传图，g13-g20 为游戏背景素材）
│       └── works/*.jpg         # 作品标题图（官方 capsule，460×215）
└── posts/
    ├── index.html              # 文章列表（原画赏析 / 作品资讯 分类筛选）
    ├── sugina-miki-style.html  # 杉菜水姫的用色笔记
    ├── innocent-grey-history.html  # 作品年表与海外版本动向
    └── kara-no-shojo-trilogy.html  # 《殻ノ少女》三部曲
```

## ⚠️ 素材版权（请先读这一段）

本站图片全部来自 **Innocent Grey / 有限会社グングニル 的官方公开宣传素材与官方商店页面**
（Steam 商店页的主视觉、官方 capsule 与游戏截图）以及本人持有的正版游戏的画面提取，
**版权归 有限会社グングニル 及 杉菜水姫 所有**。

它适合作为**个人、非商业性质**的原画整理与资料记录；如果你要把这个站点公开上线，请务必：

1. 保留页脚与画廊页的「素材版权与来源」说明，不要删除署名；
2. 不要用于任何商业用途（广告、付费内容、带货等）；
3. 不要提供原图打包下载；
4. 收到权利人通知后立即移除相关图片。

想要完全干净的素材，请把 `assets/img/` 换成你自己的插画或已获授权的图片。

## 本地预览

直接双击 `index.html`。若想更接近线上环境（让 `localStorage` 正常工作），在本目录起一个静态服务：

```bash
python -m http.server 8080
# 然后访问 http://localhost:8080
```

## 图片是怎么来的

所有图片都是从官方商店页下载后本地裁切生成的，完整流程保存在 `_build/prepare.ps1`
（Windows PowerShell + System.Drawing，直接运行即可；原图缓存目录不存在时会自动重新下载）：

1. 用 Steam 各作的 `appdetails` 接口取 `background_raw`、`header_image` 与 `screenshots`
   （作品 ID：CARTAGRA 4290390、殻ノ少女 965810、The Shell I/II/III 2258770/2712550/3296790、
   FLOWERS 春/夏/秋/冬 452440/858940/1238730/1921560），缓存到 `%TEMP%\ig-research\dl`；
2. 用 `Crop-Fill`（按目标比例裁剪，支持焦点坐标与缩放）生成 512×512 头像、1200×630 文章封面、
   1600×520 横幅，以及 1200×533（2.25:1 宽银幕，会裁掉游戏截图底部的对话框 UI）的画廊图；
3. 用 `Scale-Width` 把官方 capsule 转成 460×215 的作品标题图。

换一张图只需要改脚本里的映射再跑一次，或者直接替换 `assets/img/` 下的同名文件。

### 游戏画面提取（可选）

画廊里的 `g13-g20.jpg` 是从正版游戏《虚ノ少女》的 `root.pfs` 封包中只读提取的背景图，
使用的工具是 [GARbro](https://github.com/morkt/GARbro)（支持 Artemis 引擎的 `.pfs`）。
游戏文件本身没有被修改或移动；提取只输出到临时目录。

## 站点配置

`assets/js/main.js` 顶部：

```js
var SITE = {
  startDate: '2024-03-15', // 站点上线日期，用于计算「已运行天数」
  wordsPerMinute: 400 // 阅读速度（字/分钟），用于估算阅读时长
};
```

## 需要你替换的占位内容

- 联系方式：`hello@example.com`、`https://github.com/`（首页与各文章页页脚）。
- 文章正文里的示例域名 `https://azure.example.com/...`（在每篇文章的版权块里）。
- 统计数字：「最近更新」写死在首页，「已运行天数」由脚本按 `SITE.startDate` 计算。

## 部署

1. 新建仓库，把本目录里的全部文件推上去；
2. 仓库 **Settings → Pages**，Source 选择分支与根目录 `/`；
3. 等一两分钟，访问 `https://<用户名>.github.io/<仓库名>/`；
4. 想用自己的域名，填 Custom domain 并按提示添加 DNS 记录、开启 HTTPS。

纯静态站点放到 Cloudflare Pages、Vercel、对象存储等任何静态托管上都能直接用。

## 公网访问（临时隧道）

不想注册账号时，可以用 Windows 自带的 SSH 通过免费隧道把本地站点发布到公网：

```powershell
# 1. 启动本地服务（127.0.0.1:8080，IPv4/IPv6 双栈）
Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','C:\Users\doctor\azure-blog\_build\serve.ps1' -WindowStyle Hidden

# 2. 建立公网隧道（二选一，输出里会打印公网网址）
ssh -o StrictHostKeyChecking=accept-new -R 80:localhost:8080 nokey@localhost.run
ssh -o StrictHostKeyChecking=accept-new -R 80:localhost:8080 serveo.net
```

注意：这种隧道是**临时的**——电脑关机或进程退出后链接失效，重连会换一个新网址。
想要固定不变的网址，还是建议用 GitHub Pages（免费）或注册 Cloudflare / serveo 账号保留子域名。

## 已实现的交互

- 主题按钮在「跟随系统 → 亮色 → 暗色」间循环，选择记在 `localStorage` 的 `theme` 键；
- 吸顶导航离开页首后变成玻璃卡片，移动端收起为汉堡菜单；
- 文章页有右侧目录（带滚动进度条）、右下角阅读进度圆环、标题 `#` 锚点、代码复制按钮；
- 画廊与首页橱窗支持点击放大的灯箱（Esc 或点击空白处关闭）；
- 文章列表页支持按分类筛选（与 `#art` / `#news` 锚点联动）。
