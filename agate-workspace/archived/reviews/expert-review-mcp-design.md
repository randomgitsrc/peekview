# MCP 设计文档专家评审意见

> 评审日期: 2026-05-24
> 评审范围:
> - docs/specs/spec-mcp-peeklink-command.md
> - docs/specs/spec-mcp-publish-files.md  
> - docs/decisions/mcp-vs-cli-positioning.md

---

## 总体评价

| 文档 | 设计质量 | 完整性 | 安全性 | 可行性 |
|------|---------|--------|--------|--------|
| `/peeklink` 命令 | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| `publish_files` | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| 定位决策 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | N/A | N/A |

**主要发现**: 安全边界需要加强，但不应牺牲便利性

---

## 一、spec-mcp-peeklink-command.md

### 问题 1: 路径解析歧义（重要）

**问题**: "基于项目根目录"定义不明确

```bash
/peeklink src/main.py
```

- 用户可能在子目录中运行命令
- 多工作区场景下根目录不确定

**建议修复**:
```bash
# 自动检测 git 根目录
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
```

### 问题 2: 缺少 allowlist 检查（安全风险）

**问题**: CLI 直接读文件可能访问敏感路径
```bash
/peeklink ~/.ssh/id_rsa  # 可以执行，但不应该
```

**建议修复**: 添加硬编码黑名单
```typescript
const SENSITIVE_PATHS = [
  /\/\.ssh\/.*/, /\/\.gnupg\/.*/, /\/\.aws\/.*/,
  /.*\.key$/, /.*\.pem$/, /.*\.p12$/
];
```

### 问题 3: 缺少过滤功能

**问题**: `/peeklink src/` 会包含 `__pycache__`、`.pyc` 等

**建议**: 支持 `.peekviewignore` 或 `--exclude` 参数

---

## 二、spec-mcp-publish-files.md

### 问题 1: Staging 目录设计（已修正）

**原设计**: `/tmp/peekview-staging`

**问题**:
- 需要预先创建
- 跨平台问题（Windows）
- 多用户冲突

**修正方案**:
```typescript
// 默认使用用户目录
const STAGING_DIR = path.join(os.homedir(), '.peekview', 'staging');

// 可配置
staging_dir: ~/.peekview/staging  # 默认
# 或 staging_dir: /tmp/peekview-staging  # 用户自定义
```

**权限**: `0700`（仅当前用户）
**清理**: 启动时删除 7 天前文件

### 问题 2: allowlist 配置过于严格

**问题**: 默认拒绝所有路径，用户体验差

**修正方案**: 渐进式安全模型
```typescript
const DEFAULT_CONFIG = {
  mode: 'permissive',  // permissive | strict
  
  // 第一层：自动允许（零配置）
  autoAllowed: [
    process.cwd(),
    path.join(os.homedir(), '.peekview', 'staging'),
    os.tmpdir(),
  ],
  
  // 第二层：硬编码黑名单（始终拒绝）
  sensitivePatterns: [/* ... */],
  
  // 第三层：用户配置（可选增强）
  allowedPaths: [],  // 默认空，不额外限制
};
```

### 问题 3: 二进制文件处理不完善

**问题**: 所有非 UTF-8 文件被跳过，用户无感知

**建议**: 区分跳过原因并提供反馈
```typescript
skipped: [
  { path: "/project/logo.png", reason: "binary" },
  { path: "/project/huge.log", reason: "too_large" },
]
```

### 问题 4: 文件大小限制过于保守

**问题**: 2MB 单文件上限与 PeekView API（10MB）不一致

**建议**: 提升到 10MB / 100MB

### 问题 5: 路径安全边界

**问题**: 未处理符号链接和路径遍历

**建议修复**:
```typescript
async function validatePath(filePath: string): Promise<void> {
  // 1. 解析真实路径（处理符号链接）
  const realPath = await fs.realpath(filePath);
  
  // 2. 检查路径遍历
  if (realPath.includes('..')) throw new Error('路径遍历攻击');
  
  // 3. 检查是否在允许范围内
  // ...
}
```

---

## 三、mcp-vs-cli-positioning.md

### 问题 1: `create_entry` 性能修复不完整

**问题**: 文档说通过"工具描述引导"修复，但大 content 本身仍慢

**建议**: 明确说明 `create_entry` 适合 **< 1000 tokens** 的小内容，大内容用 `publish_files`

### 问题 2: 缺少迁移指导

**问题**: 现有用户从 `create_entry` 迁移到 `publish_files` 无指南

**建议**: 添加迁移检查清单:
- 你是否在用 `create_entry` 发布本地文件？→ 改用 `publish_files`
- 发布前是否调用了 `read_file`？→ 改用 `publish_files`
- 内容是否来自 Agent 生成？→ 保持 `create_entry`

---

## 关键修复建议汇总

### P0（必须修复）

1. **staging 目录**: 默认 `~/.peekview/staging/`，可配置
2. **allowlist 模式**: 默认 `permissive`（宽松），可选 `strict`
3. **硬编码黑名单**: 敏感路径始终拒绝

### P1（强烈建议）

1. **路径安全**: 符号链接跟随 + 路径遍历检查
2. **二进制反馈**: 明确告知跳过原因
3. **文件大小**: 提升到 10MB/100MB

### P2（可选优化）

1. **自动清理**: staging 目录定期清理
2. **过滤功能**: include/exclude 模式

---

## 结论

设计方案整体正确，解决性能问题的思路可行。

**主要风险点**:
1. 安全配置过于严格会牺牲用户体验
2. 路径安全问题需要加固

**建议实施方案**:
1. 采用渐进式安全模型（三层防护）
2. staging 目录默认使用用户 home 目录
3. 保持向后兼容（`create_entry` 不变，新增 `publish_files`）

---

*评审完成: 2026-05-24*
