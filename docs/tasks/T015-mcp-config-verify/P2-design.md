---
phase: P2
task_id: T015
parent: P1-requirements.md
trace_id: T015-P2-20260615
status: approved
---

# P2 方案设计 — T015 MCP config verify + unset

## 声明字段

```yaml
packages: [mcp-server]
domains: [mcp]
ui_affected: false
gate_commands:
  P5: "cd packages/mcp-server && npm test"
```

## 改动文件

| 文件 | 改动 |
|------|------|
| `packages/mcp-server/src/cli/config.ts` | 新增 `verify` 命令、`unset` 命令 |
| `packages/mcp-server/tests/cli/config.test.ts`（或新文件）| verify + unset 测试 |

不改动：validators.ts（格式校验已有，verify 里接线但不重复实现）

---

## 一、config verify 实现

```typescript
configCommand
  .command('verify')
  .description('Verify configuration — check connectivity and authentication')
  .action(async () => {
    const configPath = CONFIG_FILE_PATH;
    let allOk = true;

    // Step 1: 配置文件存在性
    if (!existsSync(configPath)) {
      console.log(`❌ 配置文件不存在：${configPath}`);
      process.exit(1);
    }
    console.log(`✅ 配置文件：${configPath}`);

    const config = loadConfigFromFile();

    // Step 2: peekview.url 必填检查
    const peekviewUrl = config?.peekview?.url;
    if (!peekviewUrl) {
      console.log('❌ peekview.url 未配置（必填）');
      process.exit(1);
    }

    // Step 3: 格式校验（接线 validators.ts）
    try {
      validateUrl(peekviewUrl, 'peekview.url');
    } catch (e) {
      console.log(`❌ peekview.url 格式错误：${e instanceof Error ? e.message : e}`);
      allOk = false;
    }

    // Step 4: 连通性测试 GET {peekviewUrl}/health
    if (allOk) {
      try {
        const res = await fetch(`${peekviewUrl}/health`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          console.log(`✅ peekview.url：${peekviewUrl} — 可达`);
        } else {
          console.log(`❌ peekview.url：${peekviewUrl} — 响应 ${res.status}`);
          allOk = false;
        }
      } catch {
        console.log(`❌ peekview.url：${peekviewUrl} — 连接失败`);
        allOk = false;
      }
    }

    // Step 5: API key 认证验证（仅当 URL 可达时）
    const apiKey = config?.peekview?.api_key;
    if (allOk) {
      if (!apiKey) {
        console.log('⚠️  api_key 未配置（某些操作需要）');
      } else {
        const maskedKey = apiKey.slice(0, 6) + '...' + apiKey.slice(-4);
        try {
          const res = await fetch(`${peekviewUrl}/api/v1/entries?per_page=1`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(5000),
          });
          if (res.status === 200 || res.status === 401 === false) {
            console.log(`✅ api_key：${maskedKey} — 认证有效`);
          } else if (res.status === 401) {
            console.log(`❌ api_key：${maskedKey} — 认证失败（401）`);
            allOk = false;
          } else {
            console.log(`⚠️  api_key：${maskedKey} — 响应 ${res.status}（无法确认）`);
          }
        } catch {
          console.log(`⚠️  api_key：无法验证（连接失败）`);
        }
      }
    }

    // Step 6: public_url（可选，只做存在性提示）
    const publicUrl = config?.peekview?.public_url;
    if (publicUrl) {
      console.log(`✅ peekview.public_url：${publicUrl}`);
    } else {
      console.log('⚠️  peekview.public_url 未配置（可选）');
    }

    if (!allOk) process.exit(1);
  });
```

**设计决策**：
- 直接 fetch PeekView backend（不需要 MCP Server 运行）
- `/health` 验证连通性，`/api/v1/entries?per_page=1` 验证 API key
- `AbortSignal.timeout(5000)` 防止长时间挂起
- 格式校验接线 validators.ts 的 `validateUrl`

---

## 二、config unset 实现

```typescript
configCommand
  .command('unset')
  .argument('<key>', "Configuration key (e.g., peekview.url)")
  .description('Remove a configuration value')
  .action((key: string) => {
    const parts = key.split('.');
    if (parts.length !== 2) {
      console.error("Error: Invalid key format. Use 'section.key' format.");
      process.exit(1);
    }
    const [section, prop] = parts;

    const existing = loadConfigFromFile();
    if (!existing) {
      console.log(`${key} 未设置，无需删除`);
      return;
    }

    const sectionData = existing[section] as Record<string, unknown> | undefined;
    if (!sectionData || !(prop in sectionData)) {
      console.log(`${key} 未设置，无需删除`);
      return;
    }

    // 删除 key
    delete sectionData[prop];

    // section 变空时删除整个 section
    if (Object.keys(sectionData).length === 0) {
      delete existing[section];
    }

    saveConfigToFile(existing);
    console.log(`✓ 已删除 ${key}`);
    console.log(`  ⚠ Restart service to apply: peekview-mcp service restart`);
  });
```

---

## 三、注册到 configCommand

在 config.ts 末尾（`configCommand.addCommand(allowedPathCmd)` 附近）加：

```typescript
configCommand.addCommand(verifyCmd);  // 或直接用 .command() 链式写法
```

实际用 `.command()` 链式写法更简洁，无需单独 addCommand。

---

## 四、认证验证的状态码处理

`GET /api/v1/entries` 的预期响应：
- 200：有效的 admin/user key，或公开访问
- 401：key 无效或过期
- 403：key 有效但无权限（极少见）
- 其他：网络问题

200/403 均视为「认证有效」（key 被接受，只是权限不同）；401 视为「认证失败」。
