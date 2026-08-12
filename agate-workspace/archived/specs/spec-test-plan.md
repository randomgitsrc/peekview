# Peek — 测试计划文档

> 版本: 3.0  
> 日期: 2026-04-23  
> 状态: 实施中  
> 变更: 根据软件工程化要求全面扩充，新增详细测试用例、性能测试、配置项测试、交互性测试、E2E 测试  
> 关联: [工作计划](../plans/work-plan.md)

---

## 1. 测试策略总览

| 层级 | 类型 | 工具 | 目标 | 覆盖率要求 |
|------|------|------|------|-----------|
| 单元测试 | 后端 | pytest | 业务逻辑、工具函数、服务层 | 核心模块 ≥ 80% |
| API 测试 | 后端 | pytest + httpx | 所有 HTTP 端点 | 100% 端点覆盖 |
| CLI 测试 | 后端 | pytest + Click | 所有 CLI 命令 | 100% 命令覆盖 |
| 安全测试 | 后端 | pytest | 路径遍历、XSS、SQL 注入、黑名单 | 关键漏洞场景 100% |
| 集成测试 | 后端 | pytest + TestClient | 端到端流程 | 核心流程覆盖 |
| 性能测试 | 后端 | pytest-benchmark | API 响应时间基准 | P0 指标达标 |
| 单元测试 | 前端 | Vitest + Vue Test Utils | 组件渲染与交互 | 核心组件 ≥ 70% |
| E2E 测试 | 前端 | Playwright | 关键用户流程 | 主流程覆盖 |

---

## 2. 后端测试详细计划

### 2.1 单元测试

#### models.py — 数据模型

| ID | 测试函数 | 描述 | 优先级 |
|----|---------|------|--------|
| M1 | `test_entry_creation()` | 创建条目，验证字段 | P0 |
| M2 | `test_entry_id_immutable()` | id 不可变（INTEGER AUTOINCREMENT）| P1 |
| M3 | `test_entry_slug_uniqueness()` | slug UNIQUE 约束 | P0 |
| M4 | `test_entry_slug_collision_suffix()` | slug 冲突自动加后缀 | P0 |
| M5 | `test_entry_expires_at()` | 过期时间解析 | P1 |
| M6 | `test_entry_tags_json()` | 标签 JSON 序列化/反序列化 | P1 |
| M7 | `test_entry_status_check_constraint()` | status 枚举约束 | P1 |
| M8 | `test_entry_user_id_default()` | user_id 默认 'default' | P1 |
| M9 | `test_file_creation()` | 创建文件记录 | P0 |
| M10 | `test_file_path_with_directory()` | path 保留目录结构（如 src/main.py）| P0 |
| M11 | `test_entry_files_relationship()` | 条目-文件级联关系 | P0 |
| M12 | `test_file_cascade_delete()` | 删除条目时级联删除文件记录 | P0 |

#### storage.py — 文件存储

| ID | 测试函数 | 描述 | 优先级 |
|----|---------|------|--------|
| S1 | `test_write_text_file()` | 写入文本文件 | P0 |
| S2 | `test_write_binary_file()` | 写入二进制文件 | P0 |
| S3 | `test_read_file()` | 读取文件内容 | P0 |
| S4 | `test_delete_entry_files()` | 删除条目目录 | P0 |
| S5 | `test_directory_structure_preserved()` | 目录结构保留（src/main.py → src/main.py）| P0 |
| S6 | `test_path_collision_handling()` | 同名文件不同目录不冲突 | P1 |
| S7 | `test_invalid_path_rejection()` | 非法路径拒绝（路径遍历防护）| P0 |
| S8 | `test_atomic_write_temp_then_rename()` | 原子写入：临时目录 → rename | P1 |
| S9 | `test_write_failure_cleanup()` | 写入失败时清理临时文件 | P1 |
| S10 | `test_sha256_computation()` | 文件内容校验和计算 | P1 |
| S11 | `test_get_disk_path_with_subdir()` | 动态路径计算：含目录结构 | P1 |
| S12 | `test_get_disk_path_no_subdir()` | 动态路径计算：无目录（根级文件）| P1 |

#### language.py — 语言检测

| ID | 测试函数 | 描述 | 优先级 |
|----|---------|------|--------|
| L1 | `test_extension_mapping()` | 扩展名 → 语言映射 | P1 |
| L2 | `test_filename_mapping()` | 特殊文件名映射（Makefile 等）| P1 |
| L3 | `test_unknown_extension()` | 未知扩展名返回 null | P1 |
| L4 | `test_binary_detection()` | 二进制文件检测 | P0 |
| L5 | `test_case_insensitive_extension()` | 扩展名大小写不敏感 | P1 |

#### cleanup.py — 过期清理

| ID | 测试函数 | 描述 | 优先级 |
|----|---------|------|--------|
| C1 | `test_expired_entry_detection()` | 检测过期条目 | P1 |
| C2 | `test_cleanup_deletes_files()` | 清理时删除文件 | P1 |
| C3 | `test_cleanup_deletes_db_record()` | 清理时删除数据库记录 | P1 |
| C4 | `test_no_cleanup_for_active()` | 未过期条目不清理 | P1 |
| C5 | `test_null_expires_at()` | 无过期时间不清理 | P1 |
| C6 | `test_cleanup_order_db_first()` | 清理顺序：先删 DB（事务），再删文件 | P1 |
| C7 | `test_cleanup_file_failure_logged()` | 文件删除失败记录日志 | P2 |
| C8 | `test_orphan_file_cleanup()` | 孤儿文件（data/ 中但 DB 无记录）清理 | P2 |
| C9 | `test_expires_in_1h()` | 1h 格式解析 | P1 |
| C10 | `test_expires_in_7d()` | 7d 格式解析 | P1 |
| C11 | `test_expires_in_30m()` | 30m 格式解析 | P2 |
| C12 | `test_expires_in_past_time()` | 已过去的时间 → 立即过期 | P1 |
| C13 | `test_expires_in_invalid_format()` | 非法格式 → 报错 | P1 |

#### config.py — 配置管理

| ID | 测试函数 | 描述 | 优先级 |
|----|---------|------|--------|
| CF1 | `test_default_config()` | 默认配置值 | P1 |
| CF2 | `test_load_from_yaml()` | 从 config.yaml 加载 | P2 |
| CF3 | `test_env_override()` | 环境变量覆盖配置 | P1 |
| CF4 | `test_missing_config_file()` | 无配置文件时使用默认值 | P2 |
| CF5 | `test_invalid_config_yaml()` | 配置文件格式错误 → 明确报错 | P2 |
| CF6 | `test_limits_defaults()` | limits 各项默认值 | P1 |
| CF7 | `test_forbidden_paths_config()` | 黑名单路径可配置 | P1 |
| CF8 | `test_base_url_fallback()` | base_url 空时 fallback 到 localhost | P1 |

### 2.2 服务层测试

#### entry_service.py — 条目业务逻辑

| ID | 测试函数 | 描述 | 优先级 |
|----|---------|------|--------|
| ES1 | `test_create_entry_content_upload()` | 内容直传创建 | P0 |
| ES2 | `test_create_entry_local_path()` | 本地路径创建 | P0 |
| ES3 | `test_create_entry_dir_upload()` | 目录递归上传创建 | P0 |
| ES4 | `test_create_entry_mixed()` | 混合模式创建 | P0 |
| ES5 | `test_create_entry_auto_slug()` | 自动生成 slug | P0 |
| ES6 | `test_create_entry_custom_slug()` | 自定义 slug | P0 |
| ES7 | `test_create_entry_slug_conflict()` | slug 冲突 → 自动后缀 | P0 |
| ES8 | `test_create_entry_with_tags()` | 带标签创建 | P1 |
| ES9 | `test_create_entry_with_expires()` | 带过期时间创建 | P1 |
| ES10 | `test_create_entry_empty_files()` | 无文件创建 → 允许 | P1 |
| ES11 | `test_delete_entry_cascades()` | 删除条目级联清理 | P0 |
| ES12 | `test_get_entry_by_slug()` | 按 slug 查询 | P0 |
| ES13 | `test_list_entries_pagination()` | 分页查询 | P0 |
| ES14 | `test_list_entries_fts_search()` | FTS5 全文搜索 | P0 |
| ES15 | `test_list_entries_tag_filter()` | 标签过滤 | P1 |
| ES16 | `test_list_entries_status_filter()` | 状态过滤 | P1 |
| ES17 | `test_list_entries_combined_filter()` | 组合过滤 | P1 |

#### file_service.py — 文件处理逻辑

| ID | 测试函数 | 描述 | 优先级 |
|----|---------|------|--------|
| FS1 | `test_validate_local_path_allowed()` | 允许的路径 | P0 |
| FS2 | `test_validate_local_path_forbidden_ssh()` | ~/.ssh/ 被拒绝 | P0 |
| FS3 | `test_validate_local_path_forbidden_gnupg()` | ~/.gnupg/ 被拒绝 | P0 |
| FS4 | `test_validate_local_path_forbidden_env()` | .env 文件被拒绝 | P0 |
| FS5 | `test_validate_local_path_traversal()` | 路径遍历被拒绝 | P0 |
| FS6 | `test_validate_local_path_symlink()` | 符号链接被拒绝 | P0 |
| FS7 | `test_validate_local_path_not_exists()` | 不存在文件 → FileNotFoundError | P1 |
| FS8 | `test_validate_local_path_is_dir()` | 指向目录 → 明确报错 | P1 |
| FS9 | `test_copy_file_to_data_dir()` | 复制文件到数据目录 | P0 |
| FS10 | `test_copy_preserves_content()` | 复制后内容一致 | P1 |
| FS11 | `test_scan_directory_recursive()` | 目录递归扫描 | P0 |
| FS12 | `test_scan_directory_ignores_git()` | 跳过 .git/ | P1 |
| FS13 | `test_scan_directory_ignores_hidden()` | 跳过隐藏文件 | P1 |
| FS14 | `test_scan_directory_ignores_node_modules()` | 跳过 node_modules/ | P1 |
| FS15 | `test_detect_binary_file()` | 二进制文件检测 | P0 |
| FS16 | `test_detect_text_file()` | 文本文件检测 | P0 |
| FS17 | `test_file_size_limit_check()` | 文件大小限制校验 | P0 |
| FS18 | `test_entry_size_limit_check()` | 条目总大小限制校验 | P0 |
| FS19 | `test_entry_file_count_limit()` | 条目文件数限制校验 | P0 |

### 2.3 API 测试

#### POST /entries — 创建条目

**正向用例**:

| ID | 测试函数 | 描述 | 优先级 |
|----|---------|------|--------|
| A1 | `test_create_entry_with_content()` | 内容直传 | P0 |
| A2 | `test_create_entry_with_local_path()` | 本地路径引用 | P0 |
| A3 | `test_create_entry_with_dirs()` | 目录上传 | P0 |
| A4 | `test_create_entry_mixed()` | 混合模式 | P0 |
| A5 | `test_create_entry_with_slug()` | 指定 slug | P0 |
| A6 | `test_create_entry_slug_collision()` | slug 冲突自动后缀 | P0 |
| A7 | `test_create_entry_without_slug()` | 自动生成随机码 | P0 |
| A8 | `test_create_entry_with_tags()` | 带标签 | P1 |
| A9 | `test_create_entry_with_expires()` | 带过期时间 | P1 |
| A10 | `test_create_entry_binary_file()` | 二进制文件 | P0 |
| A11 | `test_create_entry_image_file()` | 图片文件 | P0 |

**错误响应测试**:

| ID | 测试函数 | 描述 | 预期错误码 | 优先级 |
|----|---------|------|-----------|--------|
| A12 | `test_create_entry_missing_summary()` | 缺少概述 | 400 VALIDATION_ERROR | P0 |
| A13 | `test_create_entry_invalid_slug_chars()` | slug 含中文/空格/特殊字符 | 400 INVALID_SLUG | P0 |
| A14 | `test_create_entry_slug_too_long()` | slug 超长 | 400 INVALID_SLUG | P0 |
| A15 | `test_create_entry_local_path_not_found()` | local_path 文件不存在 | 404 FILE_NOT_FOUND | P0 |
| A16 | `test_create_entry_local_path_forbidden()` | local_path 在黑名单 | 403 FORBIDDEN_PATH | P0 |
| A17 | `test_create_entry_local_path_is_dir()` | local_path 是目录 | 400 VALIDATION_ERROR | P1 |
| A18 | `test_create_entry_file_too_large()` | 文件超限 | 413 PAYLOAD_TOO_LARGE | P0 |
| A19 | `test_create_entry_too_many_files()` | 文件数超限 | 413 PAYLOAD_TOO_LARGE | P0 |
| A20 | `test_create_entry_total_size_exceeded()` | 条目总大小超限 | 413 PAYLOAD_TOO_LARGE | P0 |
| A21 | `test_create_entry_empty_summary()` | 概述为纯空白 | 400 VALIDATION_ERROR | P1 |
| A22 | `test_create_entry_invalid_expires()` | expires_in 格式非法 | 400 VALIDATION_ERROR | P1 |
| A23 | `test_create_entry_invalid_base64()` | base64 内容非法 | 400 VALIDATION_ERROR | P1 |
| A24 | `test_create_entry_duplicate_path()` | 同条目内重复文件路径 | 400 VALIDATION_ERROR | P1 |

#### GET /entries — 列表查询

| ID | 测试函数 | 描述 | 优先级 |
|----|---------|------|--------|
| A25 | `test_list_entries_pagination()` | 分页 | P0 |
| A26 | `test_list_entries_fts_search()` | FTS5 关键词搜索 | P0 |
| A27 | `test_list_entries_tag_filter()` | 标签过滤 | P1 |
| A28 | `test_list_entries_status_filter()` | 状态过滤 | P1 |
| A29 | `test_list_entries_combined_filter()` | 搜索 + 标签 + 状态 + 分页组合 | P1 |
| A30 | `test_list_entries_empty_result()` | 无结果返回空列表 | P1 |
| A31 | `test_list_entries_sort_order()` | 按创建时间倒序 | P1 |
| A32 | `test_list_entries_default_archived_hidden()` | archived 默认不显示 | P1 |
| A33 | `test_list_entries_empty_search()` | 空搜索关键词 → 返回全部 | P2 |
| A34 | `test_list_entries_search_sql_injection()` | 搜索特殊字符 → 无害化 | P0 |
| A35 | `test_list_entries_search_chinese()` | 中文关键词搜索 | P1 |
| A36 | `test_list_entries_invalid_page()` | page=0/-1 → 边界处理 | P2 |
| A37 | `test_list_entries_invalid_per_page()` | per_page=0/10000 → 限制 | P2 |

#### GET /entries/{slug} — 详情查询

| ID | 测试函数 | 描述 | 优先级 |
|----|---------|------|--------|
| A38 | `test_get_entry_success()` | 正常获取 | P0 |
| A39 | `test_get_entry_not_found()` | 不存在 → 404 NOT_FOUND | P0 |
| A40 | `test_get_entry_with_files()` | 包含文件列表 | P0 |
| A41 | `test_get_entry_by_slug()` | 按 slug 查询（非 id）| P0 |
| A42 | `test_get_entry_with_content_param()` | ?include=files.content 参数 | P1 |

#### DELETE /entries/{slug} — 删除条目

| ID | 测试函数 | 描述 | 优先级 |
|----|---------|------|--------|
| A43 | `test_delete_entry_success()` | 正常删除 | P0 |
| A44 | `test_delete_cascades_files()` | 级联删除文件 | P0 |
| A45 | `test_delete_removes_data_dir()` | 删除条目数据目录 | P0 |
| A46 | `test_delete_not_found()` | 不存在 → 404 NOT_FOUND | P0 |

#### GET /entries/{slug}/files/{file_id} — 单文件下载

| ID | 测试函数 | 描述 | 优先级 |
|----|---------|------|--------|
| A47 | `test_download_file_success()` | 正常下载 | P0 |
| A48 | `test_download_file_content_matches()` | 下载内容与上传内容一致（hash 比对）| P0 |
| A49 | `test_download_file_content_type()` | Content-Type 响应头正确 | P1 |
| A50 | `test_download_file_content_disposition()` | Content-Disposition 响应头 | P1 |
| A51 | `test_download_file_not_found()` | 文件不存在 → 404 | P0 |
| A52 | `test_download_entry_not_found()` | 条目不存在 → 404 | P0 |

#### GET /entries/{slug}/download — 打包下载

| ID | 测试函数 | 描述 | 优先级 |
|----|---------|------|--------|
| A53 | `test_download_zip()` | 下载 zip | P0 |
| A54 | `test_download_zip_content_integrity()` | zip 内容完整性（文件数、内容、路径）| P0 |
| A55 | `test_download_zip_preserves_structure()` | zip 内保留目录结构 | P0 |
| A56 | `test_download_empty_entry()` | 空条目 → 404 | P1 |
| A57 | `test_download_not_found()` | 条目不存在 → 404 | P0 |

#### GET /health — 健康检查

| ID | 测试函数 | 描述 | 优先级 |
|----|---------|------|--------|
| A58 | `test_health_check()` | 返回 200 | P0 |

### 2.4 CLI 测试

| ID | 测试函数 | 描述 | 命令 | 优先级 |
|----|---------|------|------|--------|
| CLI1 | `test_serve_default_port()` | 默认端口 8080 | peek serve | P0 |
| CLI2 | `test_serve_custom_port()` | 自定义端口 | peek serve -p 3000 | P0 |
| CLI3 | `test_serve_config_file()` | 从配置文件读取 | peek serve --config config.yaml | P2 |
| CLI4 | `test_serve_port_in_use()` | 端口被占用 → 明确报错 | peek serve -p 8080 (occupied) | P1 |
| CLI5 | `test_create_basic()` | 基础创建 | peek create file.txt -s "summary" | P0 |
| CLI6 | `test_create_with_slug()` | 指定 slug | peek create -s "summary" --slug my-slug | P0 |
| CLI7 | `test_create_with_tags()` | 指定标签 | peek create -s "summary" -t python -t cli | P1 |
| CLI8 | `test_create_with_expires()` | 指定过期时间 | peek create -s "summary" --expires 1h | P1 |
| CLI9 | `test_create_multiple_files()` | 多个文件 | peek create *.py -s "Project" | P0 |
| CLI10 | `test_create_local_path()` | 本地路径 | peek create /path/to/file.py -s "summary" | P0 |
| CLI11 | `test_create_with_dir()` | 目录上传 | peek create src/ -s "Source code" | P0 |
| CLI12 | `test_create_output_format()` | 输出格式验证（URL）| peek create ... | P1 |
| CLI13 | `test_create_missing_summary()` | 缺少 summary → 错误提示 | peek create file.txt | P0 |
| CLI14 | `test_create_file_not_found()` | 指定不存在的文件 → 错误 | peek create not-exist.py | P0 |
| CLI15 | `test_list_basic()` | 基础列表 | peek list | P0 |
| CLI16 | `test_list_search()` | 搜索 | peek list -q "python" | P0 |
| CLI17 | `test_list_tag_filter()` | 标签过滤 | peek list -t python | P1 |
| CLI18 | `test_list_pagination()` | 分页 | peek list --page 2 | P1 |
| CLI19 | `test_get_success()` | 获取详情 | peek get my-entry | P0 |
| CLI20 | `test_get_not_found()` | 不存在 → 错误提示 | peek get not-exist | P0 |
| CLI21 | `test_delete_success()` | 删除成功 | peek delete my-entry | P0 |
| CLI22 | `test_delete_not_found()` | 不存在 → 错误提示 | peek delete not-exist | P0 |

### 2.5 集成测试

| ID | 测试函数 | 场景描述 | 优先级 |
|----|---------|----------|--------|
| I1 | `test_full_lifecycle()` | 完整生命周期：创建→验证→更新→下载→删除→清理验证 | P0 |
| I2 | `test_concurrent_creates()` | 并发创建条目，验证 slug 冲突处理正确 | P1 |
| I3 | `test_expired_cleanup_integration()` | 创建过期条目，触发清理，验证已删除 | P1 |
| I4 | `test_cli_to_api_to_db_to_fs()` | CLI 创建 → API 验证 → DB 检查 → 文件系统验证 | P0 |
| I5 | `test_file_content_integrity()` | 上传 → 下载 → 内容 hash 比对（文本 + 二进制）| P0 |
| I6 | `test_search_filter_pagination_combo()` | 创建多个条目 → 复杂查询组合 | P1 |
| I7 | `test_service_restart_persistence()` | 创建条目 → 重启服务 → 数据完整（DB + 文件）| P0 |
| I8 | `test_expired_query_interaction()` | 创建过期条目 → 过期 → 列表不显示 → 详情 404 | P1 |
| I9 | `test_static_file_hosting()` | 前端 build → FastAPI 托管 → 页面可访问 | P0 |
| I10 | `test_dir_upload_preserves_structure()` | 目录上传 → 文件系统保留结构 → 前端目录树正确 | P0 |
| I11 | `test_local_path_copy_not_move()` | local_path 上传 → 原文件仍存在 → peek 副本独立 | P0 |
| I12 | `test_error_response_format_consistency()` | 各种错误场景 → 响应格式一致 | P0 |

---

## 3. 安全测试

### 3.1 路径遍历

| ID | 测试函数 | 描述 | 预期结果 | 优先级 |
|----|---------|------|---------|--------|
| SEC1 | `test_path_traversal_relative()` | local_path: "../../etc/passwd" | 拒绝 | P0 |
| SEC2 | `test_path_traversal_in_file_path()` | path: "../../../etc/shadow" | 拒绝 | P0 |
| SEC3 | `test_path_traversal_url_encoded()` | "..%2F..%2Fetc%2Fpasswd" | 拒绝 | P0 |
| SEC4 | `test_path_traversal_double_encoded()` | 双重 URL 编码 | 拒绝 | P0 |
| SEC5 | `test_path_traversal_null_byte()` | "../../../etc/passwd%00.png" | 拒绝 | P0 |

### 3.2 local_path 黑名单

| ID | 测试函数 | 描述 | 预期结果 | 优先级 |
|----|---------|------|---------|--------|
| SEC6 | `test_forbidden_ssh_dir()` | ~/.ssh/id_rsa | 403 FORBIDDEN_PATH | P0 |
| SEC7 | `test_forbidden_gnupg_dir()` | ~/.gnupg/ | 403 FORBIDDEN_PATH | P0 |
| SEC8 | `test_forbidden_env_file()` | .env | 403 FORBIDDEN_PATH | P0 |
| SEC9 | `test_forbidden_etc_shadow()` | /etc/shadow | 403 FORBIDDEN_PATH | P0 |
| SEC10 | `test_forbidden_symlink()` | 符号链接 | 403 FORBIDDEN_PATH | P0 |
| SEC11 | `test_symlink_to_forbidden()` | 符号链接指向 ~/.ssh/ | 403 FORBIDDEN_PATH | P0 |
| SEC12 | `test_forbidden_path_in_config()` | 配置中自定义黑名单 → 生效 | P2 |

### 3.3 SQL 注入

| ID | 测试函数 | 描述 | 预期结果 | 优先级 |
|----|---------|------|---------|--------|
| SEC13 | `test_sql_injection_in_tags()` | tags: ["'; DROP TABLE entries; --"] | 无害化 | P0 |
| SEC14 | `test_sql_injection_in_search()` | search?q=' OR 1=1 -- | 无害化 | P0 |
| SEC15 | `test_sql_injection_in_slug()` | slug 含 SQL 特殊字符 | 400 或无害化 | P0 |

### 3.4 XSS

| ID | 测试函数 | 描述 | 预期结果 | 优先级 |
|----|---------|------|---------|--------|
| SEC16 | `test_xss_in_summary()` | summary 含 <script> | 前端转义 | P0 |
| SEC17 | `test_xss_in_markdown_img_onerror()` | Markdown <img onerror=alert(1)> | 转义 | P0 |
| SEC18 | `test_xss_in_markdown_iframe()` | Markdown <iframe src=...> | 转义 | P0 |
| SEC19 | `test_xss_in_markdown_svg_onload()` | Markdown <svg onload=...> | 转义 | P0 |
| SEC20 | `test_xss_in_code_content()` | 文件内容含 <script> | 转义（不执行）| P0 |
| SEC21 | `test_markdown_html_disabled()` | markdown-it html:false 生效 | P1 |
| SEC22 | `test_sanitize_html_filters_dangerous()` | sanitize-html 过滤危险标签 | P0 |

### 3.5 其他安全

| ID | 测试函数 | 描述 | 预期结果 | 优先级 |
|----|---------|------|---------|--------|
| SEC23 | `test_ssrf_local_path()` | local_path 为 http:// URL | 拒绝 | P1 |
| SEC24 | `test_dos_large_file()` | 上传超大文件 | 413 限制 | P0 |
| SEC25 | `test_dos_many_files()` | 上传过多文件 | 413 限制 | P0 |
| SEC26 | `test_info_leak_in_error()` | 错误响应不含堆栈/SQL/内部路径 | P0 |
| SEC27 | `test_db_file_not_exposed()` | GET /peek.db → 404 | P0 |
| SEC28 | `test_cors_config()` | CORS 策略验证 | P1 |

---

## 4. 前端测试详细计划

### 4.1 组件测试（Vitest）

#### CodeViewer.vue — 代码查看器

| ID | 测试函数 | 描述 | 优先级 |
|----|---------|------|--------|
| FC1 | `test_render_code_with_shiki()` | Shiki 高亮渲染 | P0 |
| FC2 | `test_line_numbers_display()` | 行号正确显示 | P0 |
| FC3 | `test_line_numbers_non_selectable()` | 行号 user-select: none | P1 |
| FC4 | `test_wrap_toggle_changes_layout()` | 点击换行按钮切换布局 | P0 |
| FC5 | `test_wrap_line_numbers_align()` | 换行时行号与代码对齐 | P0 |
| FC6 | `test_copy_button_writes_clipboard()` | 复制按钮写入剪贴板（不含行号）| P0 |
| FC7 | `test_copy_button_shows_feedback()` | 复制成功视觉反馈 | P0 |
| FC8 | `test_empty_file_display()` | 空文件显示"Empty file" | P1 |
| FC9 | `test_long_line_scroll()` | 超长单行代码滚动行为 | P1 |
| FC10 | `test_language_fallback_text()` | 未知语言 fallback 到 text | P1 |
| FC11 | `test_loading_skeleton()` | 加载中显示骨架屏 | P0 |
| FC12 | `test_shiki_error_fallback()` | Shiki 错误 fallback 到纯文本 | P1 |

#### MarkdownViewer.vue — Markdown 渲染

| ID | 测试函数 | 描述 | 优先级 |
|----|---------|------|--------|
| FM1 | `test_render_markdown()` | Markdown 渲染 | P0 |
| FM2 | `test_render_code_blocks()` | 代码块高亮 | P0 |
| FM3 | `test_render_code_blocks_with_copy()` | 代码块带复制按钮 | P0 |
| FM4 | `test_render_tables()` | 表格渲染 | P1 |
| FM5 | `test_render_tables_scroll()` | 宽表格横向滚动 | P1 |
| FM6 | `test_render_headings_with_ids()` | 标题带 id 属性 | P0 |
| FM7 | `test_headings_emitted_to_parent()` | headings 事件发送到父组件 | P0 |
| FM8 | `test_xss_prevention()` | 危险 HTML 标签被过滤 | P0 |
| FM9 | `test_malformed_markdown()` | 畸形 Markdown 不崩溃 | P1 |
| FM10 | `test_inline_code_styling()` | 行内代码样式 | P2 |
| FM11 | `test_blockquote_styling()` | 引用块样式 | P2 |

#### FileTree.vue — 目录树

| ID | 测试函数 | 描述 | 优先级 |
|----|---------|------|--------|
| FT1 | `test_render_tree_structure()` | 树形结构渲染（目录/文件层级）| P0 |
| FT2 | `test_click_file_emits_select()` | 点击文件触发 select 事件 | P0 |
| FT3 | `test_active_file_highlighted()` | 当前文件高亮 | P0 |
| FT4 | `test_directory_expand_collapse()` | 目录展开/收起 | P0 |
| FT5 | `test_directory_icon_changes()` | 目录图标随状态变化 | P2 |
| FT6 | `test_file_icon_by_language()` | 不同语言文件显示不同图标 | P2 |
| FT7 | `test_deep_nested_structure()` | 深层嵌套结构渲染 | P1 |
| FT8 | `test_sort_directories_first()` | 目录优先排序 | P1 |

#### ThemeToggle.vue — 主题切换

| ID | 测试函数 | 描述 | 优先级 |
|----|---------|------|--------|
| FTG1 | `test_toggle_dark_mode()` | 切换到暗色模式 | P0 |
| FTG2 | `test_toggle_light_mode()` | 切换到亮色模式 | P0 |
| FTG3 | `test_aria_label_updates()` | aria-label 随状态更新 | P1 |
| FTG4 | `test_icon_changes()` | 图标随主题变化 | P2 |

#### MobileBottomBar.vue — 移动端底部栏

| ID | 测试函数 | 描述 | 优先级 |
|----|---------|------|--------|
| FMB1 | `test_multi_file_shows_hamburger()` | 多文件：显示汉堡按钮 + 文件计数 | P0 |
| FMB2 | `test_single_file_shows_filename()` | 单文件：显示文件名（无汉堡）| P0 |
| FMB3 | `test_code_file_shows_wrap_button()` | 代码文件显示 Wrap 按钮 | P0 |
| FMB4 | `test_markdown_hides_wrap_button()` | Markdown 隐藏 Wrap 按钮 | P0 |
| FMB5 | `test_markdown_with_toc_shows_toc_button()` | Markdown 有标题显示 TOC 按钮 | P0 |
| FMB6 | `test_wrap_button_toggles()` | Wrap 按钮切换状态 | P0 |
| FMB7 | `test_copy_button_copies_content()` | Copy 按钮复制内容 | P0 |
| FMB8 | `test_copy_shows_feedback()` | Copy 成功显示反馈 | P0 |
| FMB9 | `test_download_emits_event()` | Download 触发事件 | P0 |
| FMB10 | `test_hamburger_opens_file_drawer()` | 汉堡按钮打开文件抽屉 | P0 |
| FMB11 | `test_toc_button_opens_toc_drawer()` | TOC 按钮打开 TOC 抽屉 | P0 |

### 4.2 Composables 测试

#### useTheme.ts

| ID | 测试函数 | 描述 | 优先级 |
|----|---------|------|--------|
| CT1 | `test_reads_initial_from_dom()` | 从 DOM data-theme 读取初始值 | P0 |
| CT2 | `test_toggle_updates_dom()` | toggle 更新 DOM 属性 | P0 |
| CT3 | `test_toggle_persists_to_localstorage()` | toggle 持久化到 localStorage | P0 |
| CT4 | `test_isDark_computed()` | isDark 是计算属性 | P1 |

#### useEntry.ts

| ID | 测试函数 | 描述 | 优先级 |
|----|---------|------|--------|
| CE1 | `test_fetch_entry_makes_request()` | fetch 发起正确请求 | P0 |
| CE2 | `test_loading_state_during_fetch()` | fetch 期间 loading 为 true | P0 |
| CE3 | `test_error_state_on_failure()` | fetch 失败 error 有值 | P0 |
| CE4 | `test_error_code_preserved()` | 错误码被保留 | P0 |
| CE5 | `test_cache_hit_uses_cached_data()` | 缓存命中使用缓存数据 | P0 |
| CE6 | `test_cache_expired_refetches()` | 缓存过期重新获取 | P0 |
| CE7 | `test_clearCache_clears_specific()` | clearCache 清除指定条目 | P1 |
| CE8 | `test_clearCache_clears_all()` | clearCache 清除全部 | P1 |

### 4.3 API 层测试

#### client.ts

| ID | 测试函数 | 描述 | 优先级 |
|----|---------|------|--------|
| CA1 | `test_listEntries_formats_request()` | listEntries 请求格式正确 | P0 |
| CA2 | `test_getEntry_includes_params()` | getEntry 包含参数 | P0 |
| CA3 | `test_fetchFileContent_returns_text()` | fetchFileContent 返回文本 | P0 |
| CA4 | `test_downloadFile_returns_url()` | downloadFile 返回 URL | P0 |
| CA5 | `test_error_response_parsed_to_PeekApiError()` | 错误响应解析为 PeekApiError | P0 |
| CA6 | `test_error_code_extracted()` | 错误码被提取 | P0 |

### 4.4 页面级测试

#### EntryListView.vue

| ID | 测试函数 | 描述 | 优先级 |
|----|---------|------|--------|
| PL1 | `test_renders_entry_list()` | 渲染条目列表 | P0 |
| PL2 | `test_search_input_debounced()` | 搜索输入防抖 | P0 |
| PL3 | `test_pagination_buttons()` | 分页按钮 | P0 |
| PL4 | `test_loading_shows_skeleton()` | 加载显示骨架屏 | P0 |
| PL5 | `test_error_shows_retry()` | 错误显示重试按钮 | P0 |
| PL6 | `test_click_entry_navigates()` | 点击条目跳转 | P0 |
| PL7 | `test_empty_state_display()` | 无数据空状态 | P1 |

#### EntryDetailView.vue

| ID | 测试函数 | 描述 | 优先级 |
|----|---------|------|--------|
| PD1 | `test_renders_entry_details()` | 渲染条目详情 | P0 |
| PD2 | `test_renders_file_tree()` | 渲染文件树 | P0 |
| PD3 | `test_click_file_switches_content()` | 点击文件切换内容 | P0 |
| PD4 | `test_url_query_file_param()` | URL ?file= 参数 | P0 |
| PD5 | `test_loading_shows_skeleton()` | 加载显示骨架屏 | P0 |
| PD6 | `test_error_shows_retry()` | 错误显示重试 | P0 |
| PD7 | `test_markdown_shows_toc_sidebar()` | Markdown 显示 TOC 侧边栏 | P0 |
| PD8 | `test_binary_shows_download()` | 二进制文件显示下载 | P0 |

### 4.5 E2E 测试（Playwright）

#### 桌面端测试 (e2e/desktop.spec.ts)

| ID | 测试场景 | 步骤 | 优先级 |
|----|---------|------|--------|
| ED1 | 查看多文件代码条目 | 创建多文件条目 → 访问 → 验证三栏布局 → 点击文件树切换 → 验证 Toolbar | P0 |
| ED2 | 代码换行切换 | 访问代码文件 → 点击 Wrap → 验证换行 → 点击 Unwrap → 验证恢复 | P0 |
| ED3 | 复制代码不含行号 | 访问代码文件 → 点击 Copy → 验证剪贴板内容不含行号 | P0 |
| ED4 | 主题切换持久化 | 切换暗色 → 刷新 → 验证保持暗色 | P0 |
| ED5 | Markdown 目录跳转 | 访问 Markdown → 点击 TOC 项 → 验证滚动到对应位置 | P0 |

#### 移动端测试 (e2e/mobile.spec.ts)

| ID | 测试场景 | 步骤 | 优先级 |
|----|---------|------|--------|
| EM1 | 多文件底部栏显示 | 模拟 iPhone → 创建多文件条目 → 验证 "☰ 3 files" | P0 |
| EM2 | 单文件底部栏显示 | 模拟 iPhone → 创建单文件条目 → 验证显示文件名 | P0 |
| EM3 | Markdown 隐藏 Wrap 按钮 | 模拟 iPhone → 访问 Markdown → 验证无 Wrap 按钮 | P0 |
| EM4 | 文件抽屉导航 | 模拟 iPhone → 点击汉堡 → 验证抽屉弹出 → 点击文件 → 验证内容切换 | P0 |
| EM5 | TOC 抽屉导航 | 模拟 iPhone → 访问 Markdown → 点击 TOC → 验证抽屉 → 点击标题 → 验证滚动 | P0 |
| EM6 | 换行时行号对齐 | 模拟 iPhone → 访问长行代码 → 点击 Wrap → 验证行号与第一行对齐 | P0 |
| EM7 | 代码横向滚动 | 模拟 iPhone → 访问不换行代码 → 触摸滑动 → 验证横向滚动 | P1 |

#### 端到端生命周期 (e2e/lifecycle.spec.ts)

| ID | 测试场景 | 步骤 | 优先级 |
|----|---------|------|--------|
| EL1 | 完整生命周期 | CLI 创建 → 前端验证 → API 验证 → CLI 删除 → 验证清理 | P0 |
| EL2 | 搜索过滤 | 创建多个条目 → 搜索 → 验证过滤结果 | P1 |
| EL3 | 主题切换跨页面 | 列表页切换 → 进入详情 → 验证主题保持 | P1 |

---

## 5. 性能测试

### 5.1 API 基准测试

| ID | 测试函数 | 描述 | 阈值 | 优先级 |
|----|---------|------|------|--------|
| PB1 | `test_create_entry_benchmark()` | 创建条目 | < 200ms | P1 |
| PB2 | `test_get_entry_benchmark()` | 获取详情 | < 200ms | P1 |
| PB3 | `test_list_entries_benchmark()` | 列表查询 | < 100ms | P1 |
| PB4 | `test_fts_search_benchmark()` | FTS5 搜索 1000 条目 | < 200ms | P1 |
| PB5 | `test_download_file_benchmark()` | 单文件下载 | < 50ms | P2 |
| PB6 | `test_zip_download_benchmark()` | 打包下载 50 文件 | < 500ms | P2 |

### 5.2 文件操作性能

| ID | 测试函数 | 描述 | 阈值 | 优先级 |
|----|---------|------|------|--------|
| PF1 | `test_large_file_upload_performance()` | 10MB 文件上传 | < 2s | P1 |
| PF2 | `test_directory_scan_performance()` | 1000 文件目录扫描 | < 3s | P2 |
| PF3 | `test_sha256_large_file()` | 100MB 文件 SHA256 | < 5s | P2 |

### 5.3 前端性能

| ID | 测试函数 | 描述 | 阈值 | 优先级 |
|----|---------|------|------|--------|
| PP1 | `test_first_contentful_paint()` | 首屏内容绘制 | < 1s | P1 |
| PP2 | `test_largest_contentful_paint()` | 最大内容绘制 | < 1.5s | P1 |
| PP3 | `test_shiki_large_file_render()` | 5000 行代码渲染 | < 500ms | P2 |
| PP4 | `test_entry_list_scroll()` | 大量条目列表滚动 | 流畅 60fps | P2 |

---

## 6. 配置项测试

### 6.1 环境变量矩阵

| ID | 配置项 | 测试场景 | 预期结果 | 优先级 |
|----|--------|---------|---------|--------|
| CFG1 | PEEK_DATA_DIR | 自定义数据目录 | 文件存储到指定目录 | P2 |
| CFG2 | PEEK_DB_PATH | 自定义数据库路径 | SQLite 文件创建到指定路径 | P2 |
| CFG3 | PEEK_ALLOWED_PATHS | 配置 allowlist | local_path 只允许列表内路径 | P0 |
| CFG4 | PEEK_ALLOWED_PATHS | allowlist 为空 | 禁止所有 local_path | P1 |
| CFG5 | PEEK_API_KEY | 设置 API Key | 请求需带 Authorization 头 | P0 |
| CFG6 | PEEK_API_KEY | 未设置 API Key | 无需认证 | P0 |
| CFG7 | PEEK_CORS_ORIGINS | 配置多个源 | CORS 响应头正确 | P2 |
| CFG8 | PEEK_HOST/PEEK_PORT | 自定义绑定 | 服务绑定到指定地址 | P1 |

### 6.2 配置组合测试

| ID | 场景 | 配置组合 | 预期结果 | 优先级 |
|----|------|---------|---------|--------|
| CFG9 | 完整自定义 | DATA_DIR + DB_PATH + ALLOWED_PATHS + API_KEY | 全部生效 | P2 |
| CFG10 | 冲突处理 | DB_PATH 在 DATA_DIR 之外 | 正常工作 | P2 |
| CFG11 | 热重载 | 修改配置文件 | 需重启生效 | P2 |

---

## 7. 交互性测试

### 7.1 移动端触摸手势

| ID | 测试场景 | 描述 | 优先级 |
|----|---------|------|--------|
| IX1 | 抽屉滑出 | 点击汉堡按钮 → 抽屉从底部滑出 | P0 |
| IX2 | 抽屉关闭（点击遮罩）| 点击遮罩层 → 抽屉关闭 | P0 |
| IX3 | 抽屉关闭（点击关闭按钮）| 点击关闭按钮 → 抽屉关闭 | P0 |
| IX4 | 代码横向滚动 | 不换行代码左右滑动 | P0 |
| IX5 | TOC 抽屉滑出 | 点击 TOC 按钮 → 抽屉滑出 | P0 |

### 7.2 键盘导航无障碍

| ID | 测试场景 | 描述 | 优先级 |
|----|---------|------|--------|
| IA1 | Tab 导航 | 按 Tab 顺序访问所有交互元素 | P1 |
| IA2 | Enter 激活 | 按 Enter 激活按钮/链接 | P0 |
| IA3 | Space 激活 | 按 Space 激活按钮 | P0 |
| IA4 | Escape 关闭抽屉 | 按 Escape 关闭抽屉 | P1 |
| IA5 | 焦点可见 | 焦点状态清晰可见 | P1 |
| IA6 | ARIA 属性 | 按钮/链接有正确的 aria-label | P1 |

### 7.3 屏幕适配

| ID | 测试场景 | 断点 | 优先级 |
|----|---------|------|--------|
| IR1 | 桌面三栏布局 | ≥ 1024px | P0 |
| IR2 | 平板适配 | 768px - 1023px | P1 |
| IR3 | 移动端单栏 | < 768px | P0 |
| IR4 | 小屏移动端 | < 375px | P1 |

---

## 8. 测试覆盖率要求

| 层级 | 模块 | 最低覆盖率 | 说明 |
|------|------|-----------|------|
| 后端 | services/ | 80% | 业务逻辑层必须高覆盖 |
| 后端 | api/ | 80% | 所有端点必须覆盖 |
| 后端 | models/ | 70% | 数据模型 |
| 后端 | storage/ | 70% | 文件存储 |
| 后端 | 整体 | 70% | 含 CLI、config 等 |
| 前端 | components/ | 70% | 核心组件必须覆盖 |
| 前端 | composables/ | 70% | 状态管理逻辑 |
| 前端 | views/ | 60% | 页面级组件 |
| E2E | 关键流程 | 100% | 主用户流程 |

---

## 9. 测试数据工厂

```python
# backend/tests/factories.py
class EntryFactory:
    """测试数据工厂 — 减少每个测试手动构造数据的冗余"""
    
    def __init__(self, test_db, temp_data_dir):
        self.test_db = test_db
        self.temp_data_dir = temp_data_dir
        self._counter = 0

    def create(self, **kwargs):
        self._counter += 1
        defaults = {
            "summary": f"Test entry {self._counter}",
            "tags": [],
            "files": [],
        }
        defaults.update(kwargs)
        # 调用 entry_service.create_entry()
        ...

    def create_batch(self, n, **kwargs):
        return [self.create(**kwargs) for _ in range(n)]
    
    def create_with_files(self, file_contents: dict[str, str], **kwargs):
        """创建带文件的条目"""
        # file_contents: {"src/main.py": "print('hello')", ...}
        ...
```

---

## 10. CI 配置

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: cd backend && pip install -e ".[test]"
      - run: cd backend && pytest -v --cov=peek --cov-fail-under=70 -n auto
      - run: cd backend && pytest -v --cov=peek.services --cov=peek.api --cov-fail-under=80
  
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd frontend && npm ci
      - run: cd frontend && npm run test:unit -- --coverage
      - run: cd frontend && npm run build
  
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: cd backend && pip install -e ".[test]"
      - run: cd frontend && npm ci
      - run: cd frontend && npx playwright install
      - run: cd frontend && npm run test:e2e
```

---

## 11. 测试优先级总览

### P0 — 必须实现（阻塞发布）

- [ ] 后端：models, storage, language 单元测试
- [ ] 后端：entry_service, file_service 服务层测试
- [ ] 后端：API 正向/错误测试（POST/GET/DELETE /entries）
- [ ] 后端：安全测试（路径遍历、黑名单、XSS、SQL 注入）
- [ ] 后端：CLI 核心命令测试
- [ ] 后端：集成测试（完整生命周期）
- [ ] 前端：useTheme, useEntry composables 测试
- [ ] 前端：CodeViewer 组件测试（高亮、行号、复制、换行）
- [ ] 前端：FileTree 组件测试（树形、点击、高亮）
- [ ] 前端：MobileBottomBar 组件测试（按钮显示逻辑）
- [ ] 前端：EntryListView, EntryDetailView 页面测试

### P1 — 应该实现（影响体验）

- [ ] 后端：cleanup, config 单元测试
- [ ] 后端：更多 API 边界测试
- [ ] 后端：性能基准测试
- [ ] 后端：更多集成测试场景
- [ ] 前端：MarkdownViewer 组件测试
- [ ] 前端：API 层测试
- [ ] 前端：E2E 测试（桌面端）
- [ ] 前端：E2E 测试（移动端）
- [ ] 前端：首屏性能测试

### P2 — 可以延后（锦上添花）

- [ ] 后端：配置项组合测试
- [ ] 后端：大文件性能测试
- [ ] 前端：边缘情况测试
- [ ] 前端：可访问性测试
- [ ] 前端：视觉回归测试

---

## 12. 测试实现状态跟踪

| 模块 | 测试文件 | 状态 | 通过数 | 总数 | 覆盖率 |
|------|---------|------|--------|------|--------|
| 后端 models | test_models.py | 🚧 | - | 12 | - |
| 后端 storage | test_storage.py | 🚧 | - | 12 | - |
| 后端 language | test_language.py | ✅ | 5 | 5 | 100% |
| 后端 services | test_services.py | 🚧 | - | 36 | - |
| 后端 API | test_api.py | ✅ | 40+ | 58 | 80%+ |
| 后端 CLI | test_cli.py | ✅ | 32 | 32 | 90%+ |
| 后端 security | test_security.py | ✅ | 26 | 26 | 100% |
| 前端 composables | *.spec.ts | 🚧 | - | 13 | - |
| 前端 components | *.spec.ts | 🚧 | - | 40+ | - |
| 前端 E2E | *.spec.ts | 🚧 | - | 20 | - |

**图例**: ✅ 已完成 | 🚧 进行中 | ⏳ 待开始

---

*本文档依据 [work-plan.md](../plans/work-plan.md) Phase 1 要求更新*
