# SCNet DSH 完整架构部署图

> 单主架构 · 三层保活（cron / keepalive / screen 循环）· 5 项受管服务

本文档是 SCNet 太原 tycs2 集群部署 DeepSeek Harness 的完整架构图与组件清单——只看这 4 张图就能在脑子里重建整个系统。所有图采用内嵌 SVG（主图另存为 `diagrams/arch-overview.svg` 可直接拖到浏览器查看），兼容 GitHub / PeekView / 任何现代 markdown 渲染器。

## 1. 总体架构

<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="720" viewBox="0 0 1000 720" font-family="'PingFang SC','Microsoft YaHei','Noto Sans CJK SC',sans-serif" font-size="13">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M0,0 L10,5 L0,10 Z" fill="#37474f"/>
    </marker>
    <marker id="arrB" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M0,0 L10,5 L0,10 Z" fill="#1565c0"/>
    </marker>
  </defs>

  <rect width="1000" height="720" fill="#fafafa"/>

  <text x="500" y="28" text-anchor="middle" font-size="18" font-weight="bold" fill="#212121">SCNet DSH 部署架构 · 单主</text>

  <g>
    <rect x="40" y="70" width="120" height="60" rx="8" fill="#fff3e0" stroke="#37474f" stroke-width="1.5"/>
    <text x="100" y="95" text-anchor="middle" font-weight="bold" fill="#212121">用户接入</text>
    <text x="100" y="115" text-anchor="middle" font-size="11" fill="#555">浏览器 / Termius</text>
  </g>

  <g>
    <rect x="240" y="70" width="220" height="60" rx="8" fill="#e3f2fd" stroke="#37474f" stroke-width="1.5"/>
    <text x="350" y="95" text-anchor="middle" font-weight="bold" fill="#212121">SSH 入口（轮询）</text>
    <text x="350" y="115" text-anchor="middle" font-size="11" fill="#555">tycs2.hpccube.com:65141</text>
  </g>

  <line x1="160" y1="100" x2="240" y2="100" stroke="#37474f" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="200" y="92" text-anchor="middle" font-size="11" fill="#555">SSH 隧道 16097</text>

  <rect x="40" y="170" width="800" height="430" rx="10" fill="#ffffff" stroke="#37474f" stroke-width="2" stroke-dasharray="6,3"/>
  <rect x="40" y="170" width="800" height="28" rx="10" fill="#cfd8dc"/>
  <text x="60" y="189" font-size="12" font-weight="bold" fill="#212121">集群宿主：CentOS 7 · glibc 2.17 · Lustre /work/home/&lt;user&gt; 单域同步</text>

  <g>
    <rect x="70" y="220" width="370" height="50" rx="6" fill="#e8f5e9" stroke="#37474f" stroke-width="1.5"/>
    <text x="255" y="243" text-anchor="middle" font-weight="bold" fill="#212121">tylogin01 · 主节点</text>
    <text x="255" y="260" text-anchor="middle" font-size="11" fill="#555">唯一 dsh 进程所在地</text>
  </g>

  <g>
    <rect x="460" y="220" width="370" height="50" rx="6" fill="#e8f5e9" stroke="#37474f" stroke-width="1.5"/>
    <text x="645" y="243" text-anchor="middle" font-weight="bold" fill="#212121">tylogin02 · 备节点</text>
    <text x="645" y="260" text-anchor="middle" font-size="11" fill="#555">入口接入 + 内网桥接</text>
  </g>

  <text x="70" y="295" font-size="11" fill="#555">↓ Singularity rocky9.sif (Rocky 9.8 · glibc 2.34 · $HOME bind Lustre)</text>

  <rect x="70" y="305" width="370" height="270" rx="6" fill="#fff8e1" stroke="#37474f" stroke-width="1.5"/>
  <text x="255" y="325" text-anchor="middle" font-weight="bold" fill="#212121">主节点服务（4 项受管）</text>

  <rect x="90" y="340" width="110" height="50" rx="4" fill="#bbdefb" stroke="#37474f"/>
  <text x="145" y="362" text-anchor="middle" font-weight="bold" fill="#212121">dsh</text>
  <text x="145" y="378" text-anchor="middle" font-size="11" fill="#555">:3080</text>

  <rect x="215" y="340" width="120" height="50" rx="4" fill="#bbdefb" stroke="#37474f"/>
  <text x="275" y="362" text-anchor="middle" font-weight="bold" fill="#212121">gate</text>
  <text x="275" y="378" text-anchor="middle" font-size="11" fill="#555">:16097</text>

  <rect x="90" y="400" width="110" height="50" rx="4" fill="#c5cae9" stroke="#37474f"/>
  <text x="145" y="422" text-anchor="middle" font-weight="bold" fill="#212121">mcp</text>
  <text x="145" y="438" text-anchor="middle" font-size="11" fill="#555">:33333</text>

  <rect x="215" y="400" width="120" height="50" rx="4" fill="#c8e6c9" stroke="#37474f"/>
  <text x="275" y="422" text-anchor="middle" font-weight="bold" fill="#212121">xray</text>
  <text x="275" y="438" text-anchor="middle" font-size="11" fill="#555">出网代理</text>

  <text x="255" y="490" text-anchor="middle" font-size="11" fill="#888" font-style="italic">MCP 用户扩展槽</text>
  <text x="255" y="508" text-anchor="middle" font-size="11" fill="#888" font-style="italic">（可加 playwright 等）</text>

  <rect x="460" y="305" width="370" height="270" rx="6" fill="#fff8e1" stroke="#37474f" stroke-width="1.5"/>
  <text x="645" y="325" text-anchor="middle" font-weight="bold" fill="#212121">备节点服务（3 项受管）</text>

  <rect x="480" y="340" width="120" height="50" rx="4" fill="#bbdefb" stroke="#37474f"/>
  <text x="540" y="362" text-anchor="middle" font-weight="bold" fill="#212121">gate</text>
  <text x="540" y="378" text-anchor="middle" font-size="11" fill="#555">:16097</text>

  <rect x="615" y="340" width="120" height="50" rx="4" fill="#bbdefb" stroke="#37474f"/>
  <text x="675" y="362" text-anchor="middle" font-weight="bold" fill="#212121">bridge</text>
  <text x="675" y="378" text-anchor="middle" font-size="11" fill="#555">→ 主 :3080</text>

  <rect x="547" y="400" width="120" height="50" rx="4" fill="#c8e6c9" stroke="#37474f"/>
  <text x="607" y="422" text-anchor="middle" font-weight="bold" fill="#212121">xray</text>
  <text x="607" y="438" text-anchor="middle" font-size="11" fill="#555">出网代理</text>

  <text x="645" y="490" text-anchor="middle" font-size="11" fill="#888" font-style="italic">g / b / x = 3 项受管服务</text>

  <line x1="350" y1="130" x2="255" y2="220" stroke="#37474f" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="350" y1="130" x2="645" y2="220" stroke="#37474f" stroke-width="1.5" marker-end="url(#arr)"/>

  <path d="M 675 390 Q 415 595 200 390" fill="none" stroke="#1565c0" stroke-width="1.5" stroke-dasharray="5,3" marker-end="url(#arrB)"/>
  <text x="437" y="590" text-anchor="middle" font-size="11" fill="#1565c0">bridge 内网转发（tylogin02 :3080 → tylogin01 :3080）</text>

  <rect x="870" y="340" width="100" height="120" rx="6" fill="#eceff1" stroke="#37474f" stroke-width="1.5"/>
  <text x="920" y="365" text-anchor="middle" font-weight="bold" fill="#212121">外部</text>
  <text x="920" y="385" text-anchor="middle" font-size="11" fill="#555">npm / pypi</text>
  <text x="920" y="402" text-anchor="middle" font-size="11" fill="#555">CDN</text>
  <text x="920" y="430" text-anchor="middle" font-size="11" fill="#555" font-style="italic">xray 出网</text>
  <text x="920" y="448" text-anchor="middle" font-size="11" fill="#555" font-style="italic">目标</text>

  <line x1="335" y1="425" x2="870" y2="385" stroke="#37474f" stroke-width="1.5" stroke-dasharray="3,3" marker-end="url(#arr)"/>
  <line x1="667" y1="425" x2="870" y2="425" stroke="#37474f" stroke-width="1.5" stroke-dasharray="3,3" marker-end="url(#arr)"/>

  <rect x="40" y="620" width="800" height="80" rx="6" fill="#f1f8e9" stroke="#37474f" stroke-width="1.5" stroke-dasharray="3,3"/>
  <text x="440" y="648" text-anchor="middle" font-weight="bold" fill="#212121">保活三层（每节点）</text>
  <text x="440" y="672" text-anchor="middle" font-size="12" fill="#555">cron 每 2 min → keepalive.sh（pgrep-gated 按 hostname 分工）→ screen 循环（while true 二次自愈）</text>
  <text x="440" y="690" text-anchor="middle" font-size="11" fill="#888" font-style="italic">纪律：永不手动旁路 keepalive 启进程（RUNBOOK §4 踩坑 15）</text>
</svg>


## 2. 节点角色与服务清单

| 节点 | hostname | 角色 | 受管服务 | 关键端口 |
| :--- | :--- | :--- | :--- | :--- |
| 主 | `tylogin01` | 唯一 dsh 进程所在地 | dsh · gate · **mcp** · xray | 3080 / 16097 / 33333 / xray |
| 备 | `tylogin02` | 入口接入 + 内网桥接 | gate · bridge · xray | 16097 / 3080→主 / xray |
| 入口 | `tycs2.hpccube.com` | 轮询 DNS | （无服务） | 65141 (sshd) |

**关键设计：单主架构**——全集群**只有一个** dsh 进程跑在 tylogin01。备节点只做「内网 SSH 端口转发」把 3080 桥接到主节点，让用户从任意入口登录都能找到唯一的 dsh 真相源。

## 3. 接入与权限路径

<svg viewBox="0 0 900 260" xmlns="http://www.w3.org/2000/svg" font-family="'PingFang SC','Microsoft YaHei','Noto Sans CJK SC',sans-serif" font-size="13">
  <defs>
    <marker id="arr3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#37474f"/>
    </marker>
    <marker id="arrB" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#1565c0"/>
    </marker>
  </defs>

  <rect x="40" y="40" width="100" height="50" rx="6" fill="#fff3e0" stroke="#37474f"/>
  <text x="90" y="70" text-anchor="middle" font-weight="bold">用户</text>

  <rect x="220" y="40" width="160" height="50" rx="6" fill="#e3f2fd" stroke="#37474f"/>
  <text x="300" y="65" text-anchor="middle" font-weight="bold">入口 DNS</text>
  <text x="300" y="82" text-anchor="middle" font-size="11" fill="#555">tycs2 端口 65141</text>

  <line x1="140" y1="65" x2="220" y2="65" stroke="#37474f" stroke-width="1.5" marker-end="url(#arr3)"/>
  <text x="180" y="58" text-anchor="middle" font-size="10" fill="#555">SSH 隧道</text>

  <rect x="450" y="20" width="170" height="50" rx="6" fill="#e8f5e9" stroke="#37474f"/>
  <text x="535" y="48" text-anchor="middle" font-weight="bold">tylogin01</text>
  <text x="535" y="65" text-anchor="middle" font-size="11" fill="#555">gate :16097</text>

  <rect x="700" y="20" width="170" height="50" rx="6" fill="#e8f5e9" stroke="#37474f"/>
  <text x="785" y="48" text-anchor="middle" font-weight="bold">tylogin02</text>
  <text x="785" y="65" text-anchor="middle" font-size="11" fill="#555">gate :16097</text>

  <rect x="450" y="130" width="170" height="50" rx="6" fill="#fff8e1" stroke="#37474f"/>
  <text x="535" y="158" text-anchor="middle" font-weight="bold">主 dsh</text>
  <text x="535" y="175" text-anchor="middle" font-size="11" fill="#555">:3080</text>

  <rect x="700" y="130" width="170" height="50" rx="6" fill="#fff8e1" stroke="#37474f"/>
  <text x="785" y="158" text-anchor="middle" font-weight="bold">bridge</text>
  <text x="785" y="175" text-anchor="middle" font-size="11" fill="#555">:3080 → 主</text>

  <line x1="380" y1="65" x2="450" y2="50" stroke="#37474f" stroke-width="1.5" marker-end="url(#arr3)"/>
  <line x1="380" y1="65" x2="700" y2="50" stroke="#37474f" stroke-width="1.5" marker-end="url(#arr3)"/>
  <line x1="535" y1="70" x2="535" y2="130" stroke="#37474f" stroke-width="1.5" marker-end="url(#arr3)"/>
  <line x1="785" y1="70" x2="785" y2="130" stroke="#37474f" stroke-width="1.5" marker-end="url(#arr3)"/>
  <path d="M 785 155 Q 620 220 620 155" stroke="#1565c0" stroke-width="1.5" stroke-dasharray="5,3" fill="none" marker-end="url(#arrB)"/>
  <text x="700" y="225" text-anchor="middle" font-size="11" fill="#1565c0">bridge 内网转发（备 gate 流量绕到主 dsh）</text>

  <text x="450" y="240" text-anchor="middle" font-size="11" fill="#555">密码 → 24h token → 3650 天 cookie → dsh 页面 200</text>
</svg>

`gate.js` 角色：免 token 长期 cookie（3650 天，浏览器侧钳到约 400 天上限）；密码输错三次弹 401；WebSocket 握手 `/api/remote.mux` 用 101 验证；跨节点走 bridge 拿 303 = 备 gate 重铸 token，dsh 接受。

## 4. 容器内 dsh 配置层

`~/.dsh/profiles/web/cordis.patch.yml` 是 dsh 启动时合并的配置补丁层（id-targeted 改已有条目、`- insert:` 加新条目）：

```yaml
# 改已有条目（id 必须是 dsh bundle 里存在的）
- id: connection
  config:
    trustedHosts: !!js ctx.webRuntime.trustedHosts
    cookieMaxAgeDays: 3650

# 加新条目必须用 insert 形式
- insert:
    - id: mcp-xxx                        # MCP server 唯一 id
      name: "@deepseek-ai/dsh-mcp-client"
      config:
        serverName: my-server            # 业务名
        transport: streamable-http       # 传输协议
        url: http://127.0.0.1:<port>/mcp
        headers:                          # 可选鉴权
          Authorization: "Bearer ..."
        failOnStartupError: false         # server 暂时不可用不阻塞 dsh 启动
```

`!!js` 表达式在 dsh 启动时求值；硬编码 bearer token 也可（`~/.dsh` 目录权限 700）。

## 5. 三层保活

<svg viewBox="0 0 820 200" xmlns="http://www.w3.org/2000/svg" font-family="'PingFang SC','Microsoft YaHei','Noto Sans CJK SC',sans-serif" font-size="13">
  <defs>
    <marker id="arr5" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#37474f"/>
    </marker>
  </defs>

  <rect x="40" y="60" width="180" height="80" rx="8" fill="#c8e6c9" stroke="#37474f" stroke-width="1.5"/>
  <text x="130" y="90" text-anchor="middle" font-weight="bold">cron</text>
  <text x="130" y="110" text-anchor="middle" font-size="11" fill="#555">每 2 min</text>
  <text x="130" y="125" text-anchor="middle" font-size="11" fill="#555">节点本地</text>

  <rect x="320" y="60" width="200" height="80" rx="8" fill="#bbdefb" stroke="#37474f" stroke-width="1.5"/>
  <text x="420" y="88" text-anchor="middle" font-weight="bold">keepalive.sh</text>
  <text x="420" y="108" text-anchor="middle" font-size="11" fill="#555">pgrep-gated</text>
  <text x="420" y="125" text-anchor="middle" font-size="11" fill="#555">按 hostname 分工</text>

  <rect x="620" y="60" width="180" height="80" rx="8" fill="#fff8e1" stroke="#37474f" stroke-width="1.5"/>
  <text x="710" y="88" text-anchor="middle" font-weight="bold">screen 循环</text>
  <text x="710" y="108" text-anchor="middle" font-size="11" fill="#555">while true</text>
  <text x="710" y="125" text-anchor="middle" font-size="11" fill="#555">二次自愈</text>

  <line x1="220" y1="100" x2="320" y2="100" stroke="#37474f" stroke-width="1.5" marker-end="url(#arr5)"/>
  <line x1="520" y1="100" x2="620" y2="100" stroke="#37474f" stroke-width="1.5" marker-end="url(#arr5)"/>

  <text x="130" y="35" text-anchor="middle" font-size="11" fill="#555">第 1 层 · 巡检</text>
  <text x="420" y="35" text-anchor="middle" font-size="11" fill="#555">第 2 层 · 补启</text>
  <text x="710" y="35" text-anchor="middle" font-size="11" fill="#555">第 3 层 · 自愈</text>

  <text x="410" y="175" text-anchor="middle" font-size="11" fill="#888" font-style="italic">纪律：永不手动旁路 keepalive 启进程（RUNBOOK §4 踩坑 15）</text>
</svg>

## 6. Playwright + Chromium 扩展

按第 4 节的 MCP 模式，把浏览器当第 2 个 MCP server 加入（不破坏单主架构）：

<svg viewBox="0 0 800 460" xmlns="http://www.w3.org/2000/svg" font-family="'PingFang SC','Microsoft YaHei','Noto Sans CJK SC',sans-serif" font-size="13">
  <defs>
    <marker id="arr6" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#37474f"/>
    </marker>
    <marker id="arr6d" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#888"/>
    </marker>
  </defs>

  <rect x="320" y="30" width="160" height="60" rx="8" fill="#bbdefb" stroke="#37474f" stroke-width="1.5"/>
  <text x="400" y="55" text-anchor="middle" font-weight="bold">dsh</text>
  <text x="400" y="75" text-anchor="middle" font-size="11" fill="#555">主节点 :3080</text>

  <rect x="100" y="160" width="200" height="80" rx="8" fill="#c5cae9" stroke="#37474f" stroke-width="1.5"/>
  <text x="200" y="185" text-anchor="middle" font-weight="bold">mcp 33333</text>
  <text x="200" y="205" text-anchor="middle" font-size="11" fill="#555">已就位</text>
  <text x="200" y="222" text-anchor="middle" font-size="11" fill="#555" font-style="italic">第 1 个 MCP</text>

  <rect x="500" y="160" width="200" height="80" rx="8" fill="#c5cae9" stroke="#37474f" stroke-width="1.5"/>
  <text x="600" y="185" text-anchor="middle" font-weight="bold">mcp-playwright</text>
  <text x="600" y="205" text-anchor="middle" font-size="11" fill="#555">33444 待加</text>
  <text x="600" y="222" text-anchor="middle" font-size="11" fill="#555" font-style="italic">第 2 个 MCP</text>

  <rect x="500" y="290" width="200" height="80" rx="8" fill="#fff8e1" stroke="#37474f" stroke-width="1.5"/>
  <text x="600" y="315" text-anchor="middle" font-weight="bold">chromium</text>
  <text x="600" y="335" text-anchor="middle" font-size="11" fill="#555">headless 子进程</text>
  <text x="600" y="352" text-anchor="middle" font-size="11" fill="#555" font-style="italic">~200MB Lustre 持久</text>

  <rect x="100" y="290" width="200" height="80" rx="8" fill="#f1f8e9" stroke="#37474f" stroke-width="1.5" stroke-dasharray="4,2"/>
  <text x="200" y="315" text-anchor="middle" font-weight="bold">npm @playwright/mcp</text>
  <text x="200" y="335" text-anchor="middle" font-size="11" fill="#555">容器内 node22 装</text>
  <text x="200" y="352" text-anchor="middle" font-size="11" fill="#555" font-style="italic">用户家目录持久</text>

  <rect x="320" y="400" width="160" height="40" rx="6" fill="#f1f8e9" stroke="#37474f" stroke-dasharray="3,3"/>
  <text x="400" y="425" text-anchor="middle" font-size="12" fill="#555">keepalive v3.3 第 5 屏</text>

  <line x1="400" y1="90" x2="280" y2="160" stroke="#37474f" stroke-width="1.5" marker-end="url(#arr6)"/>
  <line x1="400" y1="90" x2="520" y2="160" stroke="#37474f" stroke-width="1.5" marker-end="url(#arr6)"/>
  <line x1="600" y1="240" x2="600" y2="290" stroke="#37474f" stroke-width="1.5" marker-end="url(#arr6)"/>
  <line x1="200" y1="290" x2="500" y2="240" stroke="#1565c0" stroke-width="1.5" stroke-dasharray="3,3" marker-end="url(#arr6)"/>
  <text x="350" y="260" text-anchor="middle" font-size="11" fill="#1565c0">npm install</text>
  <line x1="400" y1="400" x2="580" y2="370" stroke="#888" stroke-width="1.2" stroke-dasharray="3,3" marker-end="url(#arr6d)"/>
  <text x="500" y="390" text-anchor="middle" font-size="11" fill="#888">守护</text>

  <text x="200" y="135" text-anchor="middle" font-size="10" fill="#555">streamable-http</text>
  <text x="600" y="135" text-anchor="middle" font-size="10" fill="#555">streamable-http</text>
</svg>

### 安装步骤（路径 A · 全纳管规则过）

1. **装包**：`npm install --prefix $HOME/opt/playwright-mcp @playwright/mcp`
2. **装浏览器**：`npx playwright install chromium --with-deps`（首次约 200MB，CDN 已验证 206）
3. **启服务**：`node $HOME/opt/playwright-mcp/node_modules/.bin/playwright-mcp --port 33444`
4. **cordis.patch.yml 加 insert 条目**（同 §4 模板）
5. **keepalive.sh v3.3**：主节点分支加第 5 个 screen 循环（pgrep `@playwright/mcp`）
6. **scnet-mgr.py**：PAT 加 `playwright`、EXPECT 加 `("tylogin01","playwright")`、status 加行
7. **重启 dsh**：`scnet-mgr restart --service dsh`，`scnet-mgr status` 验证 12/12 全绿

### 风险与降级

| 风险 | 概率 | 降级 |
| :--- | :--- | :--- |
| 装包名实为 `@microsoft/playwright/mcp` | 中 | `npm search playwright-mcp` 实测两个都试 |
| chromium 下载慢（200MB 经 xray） | 中 | 配 `PLAYWRIGHT_DOWNLOAD_HOST` 指向 aliyun 镜像 |
| chromium 需要 GUI 库（libnss、libxss 等） | 低 | `--with-deps` 让 playwright 自动 dnf install（容器内 dnf 可用） |
| 容器内 root 不可写 SIF | 已确认 | 全部装到 `$HOME`，`$HOME` 是 Lustre 挂载（11P 空闲） |

### 收益：agent 新增工具

- `browser_navigate(url)` —— 打开页面
- `browser_snapshot()` —— 取可访问性树（比 screenshot 省 token）
- `browser_click(ref)` / `browser_type(ref, text)` —— 元素操作
- `browser_screenshot()` —— 视觉验证（需配合 vision skill）
- `browser_evaluate(js)` —— 执行 JS 取数据

典型用例：抓 SCNet 控制台作业列表截图、给 dsh UI 做视觉回归、登录需要 JS 渲染的页面、操作传统 Web 监控面板。

## 7. 纳管规则（五条判据）

新服务要进 keepalive 之前，逐条核对：

1. **长驻**（非一次性 / 定时任务）
2. **静默失败**（越静默越必须管）
3. **幂等无状态**（重启无代价）
4. **健康判据可测**（pgrep 模式 / 端口探测）
5. **拓扑明确**（主节点 only / 双节点 / 备节点）

Playwright MCP 5 条全过：长驻 ✓、工具静默失效 ✓、无状态 ✓、`pgrep mcp-playwright` 可测 ✓、仅主节点 ✓——可收编。
