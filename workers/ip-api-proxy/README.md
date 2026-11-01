# IP API 跨域代理 Worker

自定义 IP 信息 API 没有返回跨域头，浏览器无法直接调用。这个 Cloudflare Worker 把请求转发给上游，再在响应上加上 `Access-Control-Allow-Origin: *`。

- 上游地址不写在代码里，而是从 Worker 的变量 `UPSTREAM_URL` 读取。可以只填域名，会自动补上 `https://`。
- 密钥也不存放在 Worker 里：前端请求中的 `key` 和 `ip` 参数会原样透传给上游。
- 响应只保留响应体和 `Content-Type`，不转发上游的其他响应头；请求上游失败时也只返回通用错误，避免暴露上游地址。

## 部署

方式一：在 Cloudflare 控制台操作。

1. 依次进入 Workers & Pages → Create → 选择 Hello World 模板，创建一个 Worker。
2. 点 Edit code，用 `worker.js` 的内容替换默认代码，再点 Deploy。
3. 在这个 Worker 的 Settings → Variables and Secrets 里添加变量 `UPSTREAM_URL`，值填上游地址。类型选 Secret 或 Text 都可以，选 Secret 时控制台里不会明文显示。

方式二：用 wrangler 命令行，在本目录执行：

```bash
npx wrangler deploy
```

```bash
npx wrangler secret put UPSTREAM_URL
```

`wrangler.toml` 设置了 `keep_vars = true`，用 wrangler 重新部署时不会清掉在控制台添加的变量。

## 在面板中启用

在 设置 → 面板 → 网络与数据源 中填写「自定义IP API地址」（即 Worker 的地址）和「自定义IP API密钥」。面板里没有内置地址，两项都填写后才会启用自定义 API。

## 验证

```bash
curl -i 'https://<你的 Worker 地址>/?key=<你的密钥>&ip=1.1.1.1'
```

响应头里应该有 `access-control-allow-origin: *`，响应体是包含 `geo` 字段的 JSON。如果返回 500 和 `UPSTREAM_URL is not configured or invalid`，说明变量没有配置好。
