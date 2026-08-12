## P2 进度日志

### [Step 1] 输入文件已读取
- P0-brief.md: 环境约束确认，调试环境 make debug (127.0.0.1:8888, /tmp/peekview-debug/)
- P1-requirements.md: 9 条 BDD，14 种 Shiki 无 grammar 语言，2 种需对齐（mathematica→wolfram, registry→reg）
- useShiki.ts: 124 行，静态 import 16 种语言，highlight() + highlightCode() 两处回退逻辑
- language.py: 407 行，EXTENSION_MAP + FILENAME_MAP，detect_language() 函数
- types/index.ts: File.language 为 string | null，无语言枚举约束

### [Step 2] 关键发现
- useShiki.ts 第 86-87 行和 108-109 行：两处独立的 loadedLangs 检查 + text 回退，需统一改为 ensureLanguage 调用
- language.py 第 88 行 .m → objective-c 被第 121 行 .m → matlab 覆盖（dict 后者覆盖前者）
- language.py 第 134 行 .reg → registry 需改为 reg
- language.py 第 122-124 行 mathematica 需改为 wolfram

### [Step 3] 最小验证完成
- shiki v1.29.2 `loadLanguage(grammar)` 返回 Promise，必须 await
- `loadLanguage` 幂等：重复调用不报错
- 动态 import `shiki/langs/xxx.mjs` 可行，grammar 对象在 `.default` 上
- `getLoadedLanguages()` 正确检测已注册语言
- 后端 90 种语言 ID：76 种直接匹配 Shiki，2 种需映射（mathematica→wolfram, registry→reg），12 种无 Shiki grammar
- `objective-c` 是 Shiki 正确 ID（`objc` 是别名），不需要改
- `vb` 是 VB.NET ≠ VBScript，P1 判定正确不映射

### [Step 4] 设计完成，写入 P2-design.md
