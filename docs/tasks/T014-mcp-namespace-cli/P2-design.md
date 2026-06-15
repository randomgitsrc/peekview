---
phase: P2
task_id: T014
parent: P1-requirements.md
trace_id: T014-P2-20260615
status: approved
---

# P2 方案设计 — T014 MCP path_namespace CLI

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
| `packages/mcp-server/src/config/file.ts` | ConfigFileData.server 加 `path_namespaces` 字段声明 |
| `packages/mcp-server/src/cli/config.ts` | 新增 `namespace` 子命令组（add/remove/list）；config list 补 path_namespaces 输出 |
| `packages/mcp-server/tests/cli/config.test.ts`（或新文件）| namespace 命令测试 |

## 一、ConfigFileData 类型更新

```typescript
// config/file.ts
export interface ConfigFileData {
  peekview?: { ... };
  server?: {
    host?: string;
    port?: number;
    cors_origins?: string;
    mode?: 'local' | 'remote';
    allowed_paths?: string[];
    trust_all_paths?: boolean;
    path_namespaces?: Record<string, Record<string, string>>;  // 新增
  };
  logging?: { level?: string };
  [key: string]: Record<string, unknown> | undefined;
}
```

## 二、CLI 命令设计

在 `cli/config.ts` 里，`configCommand` 下新增 `namespace` 子命令组：

### namespace add

```
peekview-mcp config namespace add <ns> <container_path> <host_path>
```

```typescript
.action((ns: string, containerPath: string, hostPath: string) => {
  // 校验 container_path 以 / 开头
  if (!containerPath.startsWith('/')) {
    console.error('Error: container_path 必须是绝对路径（以 / 开头）');
    process.exit(1);
  }
  const config = loadConfigFromFile() || {};
  if (!config.server) config.server = {};
  if (!config.server.path_namespaces) config.server.path_namespaces = {};
  if (!config.server.path_namespaces[ns]) config.server.path_namespaces[ns] = {};
  config.server.path_namespaces[ns][containerPath] = hostPath;
  saveConfigToFile(config);
  console.log(`✓ 已添加 namespace ${ns}: ${containerPath} → ${hostPath}`);
  console.log('  ⚠ Restart service to apply: peekview-mcp service restart');
})
```

### namespace remove

```
peekview-mcp config namespace remove <ns> [container_path]
```

```typescript
.action((ns: string, containerPath: string | undefined) => {
  const config = loadConfigFromFile() || {};
  const namespaces = config.server?.path_namespaces;
  if (!namespaces?.[ns]) {
    console.error(`Error: namespace '${ns}' not found`);
    process.exit(1);
  }
  if (containerPath) {
    // 删单条映射
    delete namespaces[ns][containerPath];
    if (Object.keys(namespaces[ns]).length === 0) {
      delete namespaces[ns];  // 空了就删整个 ns
    }
    console.log(`✓ 已移除 ${ns}: ${containerPath}`);
  } else {
    // 删整个 namespace，需要确认（用 --yes 跳过）
    // 若无 --yes，提示确认
    delete namespaces[ns];
    console.log(`✓ 已删除 namespace ${ns}`);
  }
  saveConfigToFile(config);
})
```

remove 整个 namespace 的确认：加 `--yes` 选项跳过，无 `--yes` 时用 readline 交互确认。

### namespace list

```
peekview-mcp config namespace list [ns]
```

```typescript
.action((ns: string | undefined) => {
  const config = loadConfigFromFile();
  const namespaces = config?.server?.path_namespaces;
  if (!namespaces || Object.keys(namespaces).length === 0) {
    console.log('(no namespaces configured)');
    return;
  }
  const toShow = ns ? { [ns]: namespaces[ns] } : namespaces;
  for (const [nsId, mappings] of Object.entries(toShow)) {
    if (!mappings) { console.log(`  ${nsId}: (not found)`); continue; }
    console.log(`${nsId}:`);
    for (const [from, to] of Object.entries(mappings)) {
      console.log(`  ${from} → ${to}`);
    }
  }
})
```

### config list 补 path_namespaces

在现有 `config list` 命令输出末尾加：

```typescript
const namespaces = config?.server?.path_namespaces;
if (namespaces && Object.keys(namespaces).length > 0) {
  console.log('\npath_namespaces:');
  for (const [ns, mappings] of Object.entries(namespaces)) {
    console.log(`  ${ns}:`);
    for (const [from, to] of Object.entries(mappings || {})) {
      console.log(`    ${from} → ${to}`);
    }
  }
}
```

## 三、不含 namespace test 命令

v3 plan 明确决策：运行时 server.ts 已校验 unknown namespace → 400，CLI test 的价值低，不做。

## 四、YAML 注释保留

`saveConfigToFile` 使用 `YAML.stringify()` 重新序列化，**不保留原有注释**（现有行为，不引入新问题，和其他 config 操作一致）。
