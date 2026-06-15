# T010 HANDOVER — apikey local 模式解锁

状态：P0-P2 完成，P4-P8 交接 OpenCode

## 待执行

```bash
# P4 实现
# 改动：backend/peekview/cli.py
# 四个函数 apikey_create/apikey_list/apikey_revoke/apikey_cleanup
# 各自去掉 if not _is_remote_mode 的报错
# 加 --user 选项，local 模式查 user_id 后调 ApiKeyService

# P5 gate
pytest backend/tests/ -q --tb=short

# 新增测试（如无现有覆盖）
# backend/tests/test_cli_apikey.py 或追加到现有 test_cli.py

# P8
make bump-version  # backend/frontend
# 填写 CHANGELOG
git commit --amend && git push origin main
```

## 关键参考

- 现有 apikey_create 在 cli.py 第 1550 行附近
- ApiKeyService 在 backend/peekview/services/apikey_service.py
- username→id 查询：`select(User).where(User.username == username)`
- BDD 验收条件：P1-requirements.md（6条 AC）
