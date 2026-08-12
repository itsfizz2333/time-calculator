# 算到几点 · 时间接龙（网页版原型）

这是一个无需后端即可运行的高级时间计算网站原型，包含：

- 从现在或任意时间开始的正向计算
- 多段活动累计、排序、复制和删除
- 从目标时间倒推建议开始时间
- 最短/最长用时与结果范围
- 中文一句话转换成时间线
- 本地保存、分享链接、复制摘要、导出日历
- 深色模式、移动端布局和离线缓存
- 4 个有独立搜索意图的 SEO 页面、结构化数据、站点地图和 robots.txt

## 本地预览

不要直接双击文件测试全部功能；分享和离线缓存需要通过本地网页服务查看。在本目录运行任意静态服务器即可，例如：

```powershell
python -m http.server 8765
```

然后访问 `http://127.0.0.1:8765/`。

## 上线方式

整个目录可以直接部署到 Cloudflare Pages、Netlify、Vercel 或传统虚拟主机的网站根目录，不需要数据库。

## 换名称与域名

正式名称和域名确定后：

1. 在 `assets/config.js` 修改站点名称、产品名与域名。
2. 若更换名称，全局替换 HTML、`robots.txt` 和 `sitemap.xml` 中的 `算到几点`、`时间接龙`；正式域名已配置为 `https://timecalc.top/`。
3. 把 `assets/og-card.svg` 与 `assets/og-card.png` 换成正式品牌分享图；当前 PNG 已按 1200×630 输出。
4. 更新 `sitemap.xml` 的 `lastmod`，部署后在 Google Search Console 和 Bing Webmaster Tools 提交站点地图。

预览部署通过 `_headers` 阻止搜索引擎收录；正式发布前需删除该文件。
