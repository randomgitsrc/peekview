
## [Step 1] Read dispatch-context + role definition + AGENTS.md
- Dispatch-context: T070 P3, test-designer role, 24 BDDs, vitest framework
- Test grouping: 5 files (publishFiles.cwd-guard, config.allowed-paths, cli.config-list, cli.config-verify, server.health)
- BDD-18~24: manual verification only
- ui_affected: false — no Playwright needed
- Key constraints: mock process.cwd(), YAML input, mock fs/env, supertest for /health

## [Step 2] Read P1-requirements.md + P2-design.md
- 24 BDDs total: BDD-1~17 automatable, BDD-18~24 manual verification
- P2 design: Method A (minimal invasive fix + diagnostic enhancement)
- CWD guard fix: isCwdRoot && !trustAllPaths && allowedPaths.length === 0 → reject
- allowed_paths tolerance: typeof raw === 'string' → split(':').filter(p => p.length > 0)
- config list: call mergeConfig, append runtime section (cwd, mode, allowed_paths)
- config verify: append allowed_paths readability check
- /health: append cwd, mode, allowed_paths to config object
- Test grouping per dispatch-context: 5 test files

## [Step 3] Read source code files
- publishFiles.ts: CWD guard at L338-346, checks `path.resolve(cwd) === path.parse(cwd).root` → rejects unconditionally
- merge.ts: L81-82, `fileConfig.server.allowed_paths.map(expandHome)` — assumes array, no string tolerance
- server.ts: /health at L231-266, config object has source/path/peekview_url/public_url/api_key_configured
- cli/config.ts: configListAction L141-193 (reads file only, no runtime), verifyAction L425-498 (no allowed_paths check)

## [Step 4] Read existing test files
- publishFiles.test.ts: Uses msw mockServer, makeConfig helper, vi.spyOn for process.cwd mock
- config-merge.test.ts: Direct mergeConfig calls, process.env mutation per test
- cli-config.test.ts: Isolated HOME via mkdtemp, saveConfigToFile/loadConfigFromFile
- server.test.ts: supertest + createExpressApp, mock client.validateToken/ping
- Existing CWD guard test at L326-339: mocks process.cwd() to root, expects rejection
- Key patterns: makeConfig helper, msw for HTTP mocking, vi.spyOn for process mocks

## [Step 5] Read types.ts, health.test.ts, config/file.ts, config.ts
- ServerConfig = MergedConfig from merge.ts (has configSource, configPath, mode, allowedPaths, trustAllPaths, pathNamespaces)
- health.test.ts: Uses describe.skip unless RUN_REAL_MCP_HEALTH=1 (real server test, not unit)
- config/file.ts: ConfigFileData type, allowed_paths is string[] in interface
- config.ts: loadConfig = loadConfigFromFile + mergeConfig
- vitest config: fileParallelism: false, setupFiles: setup.ts, include: tests/**/*.test.ts

## [Step 6] Write test code files
- t070-publishFiles-cwd-guard.test.ts: BDD-1~6 (6 tests)
- t070-config-allowed-paths.test.ts: BDD-7~9 (3 tests)
- t070-cli-config-list.test.ts: BDD-10~12 (3 tests)
- t070-cli-config-verify.test.ts: BDD-13~14 (2 tests)
- t070-server-health.test.ts: BDD-15~17 (3 tests)
- Total: 17 tests, 11 RED + 6 GREEN (regression guards)

## [Step 7] Write P3-test-cases.md
- Written to docs/tasks/T070-mcp-docker-deployability/P3-test-cases.md
- BDD-18~24 marked as manual verification

## [Step 8] Run tests — confirmed red lights
- 11 tests fail (assertion failure / runtime error due to missing implementation)
- 6 tests pass (regression guards for "behavior unchanged" BDDs)
- All failures are genuine red lights (not import/syntax errors)
