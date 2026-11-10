"""TPV0102 — UTC 序列化契约测试（P3 红灯基线）。

对应 P1-requirements.md 的 BDD-07 ~ BDD-11（序列化契约组）：

  BDD-07  叶响应模型的 datetime 字段在 JSON 输出中均以 ``Z`` 结尾（遍历口径）
  BDD-08  数据库表模型的时间字段在**非** JSON 序列化下不被响应层污染
  BDD-09  叶响应模型的时间字段在非 JSON 序列化下仍为 ``datetime`` 对象
  BDD-10  CLI remote 模式能解析带 ``Z`` 的 API 时间字符串（aware, UTC+0）
  BDD-11  CLI ``--json`` 输出的时间字段带时区标记

BDD-12（存量数据 UTC 语义一次性审计）**不在本文件**——``conftest.py`` 的
``isolate_config_file`` 是 ``autouse=True``，每个测试的 DB 都指向 ``tmp_path``，
在此 DB 上统计「未来 created_at 行数」必然为 0（恒绿假象）。P2 §6.1 约束 3 明确
要求该断言走一次性审计脚本 ``scripts/audit-utc-semantics.py``，对 debug DB 执行。

红灯形态：本模块依赖 P4 才实现的 ``peekview.timefmt`` 与
``peekview.models.UtcSerializeMixin``，当前为 collection ImportError（B 类，非
测试代码自身缺陷）。``test_mixin_not_in_table_mro`` 的函数名被 P2 §9 的
``P5_fitness``（``-k mixin_not_in_table_mro``）写死，不得改名——``-k`` 零命中时
pytest exit 5 会让 P5_fitness 假红。
"""

from __future__ import annotations

import importlib
import inspect
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from pydantic import BaseModel

from peekview import models as models_module
from peekview.timefmt import parse_iso, utc_iso_z

# 叶模型的统一基类（P4 落地后每个叶模型都继承它）。当前不存在 → import 失败即红灯。
from peekview.models import UtcSerializeMixin

# BDD 用例共用的已知 UTC 时刻（naive，语义即 UTC——与 DB 存量语义一致）
KNOWN_UTC = datetime(2026, 11, 10, 9, 43, 0)

# 响应模型里可能出现的 datetime 注解形态
_DATETIME_ANNOTATIONS = (datetime, datetime | None)


def _all_model_classes() -> list[type]:
    """``peekview.models`` 模块内定义的全部 Pydantic 模型类（含 table=True）。"""
    found = []
    for _name, obj in inspect.getmembers(models_module, inspect.isclass):
        if obj.__module__ != models_module.__name__:
            continue
        if not issubclass(obj, BaseModel):
            continue
        found.append(obj)
    return found


def _is_table_model(cls: type) -> bool:
    """``SQLModel`` 的 table 模型判定（``model_config['table']`` 为 True）。"""
    return bool(cls.model_config.get("table"))


def _table_models() -> list[type]:
    return [c for c in _all_model_classes() if _is_table_model(c)]


def _inherited_by_table_model(cls: type) -> bool:
    """``cls`` 是否出现在任何 ``table=True`` 模型的 MRO 里（如 EntryBase / UserBase）。"""
    for table_cls in _table_models():
        if table_cls is cls:
            continue
        if cls in table_cls.__mro__:
            return True
    return False


def _datetime_field_names(cls: type) -> list[str]:
    """类上注解为 datetime / datetime | None 的字段名（按声明顺序）。"""
    names = []
    for name, field in cls.model_fields.items():
        if field.annotation in _DATETIME_ANNOTATIONS:
            names.append(name)
    return names


def _leaf_response_models() -> list[type]:
    """BDD-07 的遍历口径：非 table 且**不被任何 table 模型继承**、含 datetime 字段的类。

    两个合取项缺一不可：
      * 缺 ``not table``        → 表模型自身被当作叶模型（会误判 python 模式）；
      * 缺 ``not inherited_by`` → ``EntryBase`` / ``UserBase`` 被误抓（P1 BDD-07 修订说明）。

    判据以遍历为准，**不硬编码** P1 附录的 15 类 / 31 字段（P2 §R6 + C-23④）。
    """
    leaves = []
    for cls in _all_model_classes():
        if _is_table_model(cls):
            continue
        if _inherited_by_table_model(cls):
            continue
        if not _datetime_field_names(cls):
            continue
        leaves.append(cls)
    return leaves


def _instantiate_with_known_utc(cls: type) -> BaseModel:
    """用 ``model_construct`` 绕过必填校验，把所有 datetime 字段填成已知 UTC 时刻。

    ``model_construct`` 不走校验，因此无需为 str/int 等必填字段造数据；
    datetime 字段逐个填 ``KNOWN_UTC``，非 datetime 字段取字段默认值。
    """
    payload: dict[str, object] = {}
    for name in _datetime_field_names(cls):
        payload[name] = KNOWN_UTC
    return cls.model_construct(**payload)


def _walk_json_datetimes(value: object, path: str = "$") -> list[tuple[str, str]]:
    """递归收集 JSON dump 结果里的时间字符串（值为 str 且形似 ISO 时间）。"""
    found: list[tuple[str, str]] = []
    if isinstance(value, dict):
        for key, sub in value.items():
            found.extend(_walk_json_datetimes(sub, f"{path}.{key}"))
    elif isinstance(value, (list, tuple)):
        for index, sub in enumerate(value):
            found.extend(_walk_json_datetimes(sub, f"{path}[{index}]"))
    elif isinstance(value, str) and re.search(r"\d{4}-\d{2}-\d{2}", value):
        found.append((path, value))
    return found


class TestBdd07LeafModelsJsonEndsWithZ:
    """BDD-07：所有叶响应模型的 datetime 字段在 JSON 输出中以 Z 结尾。"""

    def test_bdd_07_all_leaf_models_json_datetime_ends_with_z(self) -> None:
        """遍历「非 table 且不被 table 模型继承」的类，逐个 datetime 字段断言 Z 结尾。"""
        leaves = _leaf_response_models()
        assert leaves, "BDD-07 遍历未命中任何叶响应模型——遍历口径写错了"

        offenders: list[str] = []
        for cls in leaves:
            instance = _instantiate_with_known_utc(cls)
            dumped = instance.model_dump(mode="json")
            for path, raw in _walk_json_datetimes(dumped):
                if not raw.endswith("Z"):
                    offenders.append(f"{cls.__name__}{path} = {raw!r}")
            # 该类的每个 datetime 字段都必须出现在 dump 里
            for name in _datetime_field_names(cls):
                assert name in dumped, f"{cls.__name__}.{name} 未出现在 model_dump 结果中"
                value = dumped[name]
                assert isinstance(value, str), (
                    f"{cls.__name__}.{name} 在 json 模式下应为 str，实际 {type(value).__name__}"
                )
                assert value.endswith("Z"), (
                    f"BDD-07 违约：{cls.__name__}.{name} = {value!r} 未以 Z 结尾"
                )

        assert not offenders, "BDD-07 违约项（未以 Z 结尾）：\n" + "\n".join(offenders)

    def test_bdd_07_leaf_scan_is_not_vacuous(self) -> None:
        """防空跑保护：遍历必须命中足够多的类与字段（**不断言 P1 附录的具体数字**）。"""
        leaves = _leaf_response_models()
        field_total = sum(len(_datetime_field_names(c)) for c in leaves)
        assert len(leaves) >= 10, f"BDD-07 遍历仅命中 {len(leaves)} 个叶模型，口径可能过窄"
        assert field_total >= 20, f"BDD-07 遍历仅命中 {field_total} 个 datetime 字段"

    def test_bdd_07_excludes_table_inherited_bases(self) -> None:
        """反证：``EntryBase`` / ``UserBase`` 必须被排除（被表模型继承）。"""
        excluded = [
            cls
            for cls in _all_model_classes()
            if not _is_table_model(cls)
            and _datetime_field_names(cls)
            and _inherited_by_table_model(cls)
        ]
        names = {c.__name__ for c in excluded}
        assert {"EntryBase", "UserBase"} <= names, (
            f"遍历口径失效：应被排除的被继承基类集合为 {sorted(names)}"
        )
        leaf_names = {c.__name__ for c in _leaf_response_models()}
        assert not (leaf_names & names), f"叶模型集合误含被继承基类：{sorted(leaf_names & names)}"

    def test_bdd_07_response_model_classes_covered(self) -> None:
        """``api/`` 里 ``response_model=`` 指名的类必须在覆盖集合内（P2 §3.3 契约核对）。

        含 datetime 的指名类若游离在覆盖集合外，FastAPI 的响应重校验会丢 Z。
        """
        api_dir = Path(models_module.__file__).resolve().parent / "api"
        pattern = re.compile(r"response_model\s*=\s*([A-Za-z_][A-Za-z0-9_]*)")
        named: set[str] = set()
        for source in sorted(api_dir.glob("*.py")):
            text = source.read_text(encoding="utf-8")
            named.update(pattern.findall(text))
        assert named, "未从 api/ 提取到任何 response_model 指名类——扫描逻辑失效"

        covered = {c.__name__ for c in _leaf_response_models()}
        datetime_named = {
            name
            for name in named
            if hasattr(models_module, name)
            and inspect.isclass(getattr(models_module, name))
            and issubclass(getattr(models_module, name), BaseModel)
            and _datetime_field_names(getattr(models_module, name))
        }
        assert datetime_named, "response_model 指名类中未发现含 datetime 的类——判据失效"
        uncovered = datetime_named - covered
        assert not uncovered, f"含 datetime 的 response_model 指名类未纳入序列化契约：{sorted(uncovered)}"


class TestBdd08TableModelsNotPolluted:
    """BDD-08：表模型在 python 模式下不被响应层 serializer 污染（反向保护）。"""

    _ENTRY_DATETIME_FIELDS = (
        "created_at",
        "updated_at",
        "expires_at",
        "archived_at",
        "archive_delete_at",
    )
    _USER_DATETIME_FIELDS = ("created_at", "updated_at", "disabled_at")

    def test_bdd_08_table_models_python_dump_still_datetime(self) -> None:
        """``Entry`` / ``User`` 的 python 模式 dump 值仍为 ``datetime`` 且不以 Z 结尾。"""
        cases = [
            (models_module.Entry, self._ENTRY_DATETIME_FIELDS),
            (models_module.User, self._USER_DATETIME_FIELDS),
        ]
        for cls, field_names in cases:
            instance = cls.model_construct(
                **{name: KNOWN_UTC for name in field_names if name in cls.model_fields}
            )
            dumped = instance.model_dump()
            for name in field_names:
                if name not in cls.model_fields:
                    continue
                value = dumped[name]
                assert isinstance(value, datetime), (
                    f"BDD-08 违约：{cls.__name__}.{name} 被污染为 {type(value).__name__}"
                )
                assert not str(value).endswith("Z"), (
                    f"BDD-08 违约：{cls.__name__}.{name} 的字符串形态 {str(value)!r} 带 Z 后缀"
                )

    def test_bdd_08_table_models_json_dump_unchanged(self) -> None:
        """表模型 json 模式**不**走 Z 序列化器（mixin 不得挂到表模型上）。"""
        entry = models_module.Entry.model_construct(created_at=KNOWN_UTC, updated_at=KNOWN_UTC)
        dumped = entry.model_dump(mode="json")
        assert not dumped["created_at"].endswith("Z"), (
            "表模型 json dump 出现 Z 后缀 → UtcSerializeMixin 被表模型继承（P2 R1 触发）"
        )

    def test_bdd_08_usercolumns_are_naive_datetime_on_python_dump(self) -> None:
        """反向细化：``User.disabled_at``（naive 列）在 python 模式下仍是 datetime。"""
        user = models_module.User.model_construct(disabled_at=KNOWN_UTC)
        dumped = user.model_dump()
        assert isinstance(dumped["disabled_at"], datetime)

    def test_mixin_not_in_table_mro(self) -> None:
        """架构适应度：``UtcSerializeMixin`` 不出现在任何 ``table=True`` 模型的 MRO。

        **函数名被 P2 §9 的 ``P5_fitness`` 写死**（``-k mixin_not_in_table_mro``），
        改名会让 ``-k`` 零命中 → pytest exit 5 → P5_fitness 假红。
        """
        table_classes = _table_models()
        assert table_classes, "未找到任何 table=True 模型——遍历口径失效"

        polluted = [c.__name__ for c in table_classes if UtcSerializeMixin in c.__mro__]
        assert not polluted, (
            "BDD-08 违约：UtcSerializeMixin 出现在表模型 MRO 中（会污染 model_dump）："
            f"{sorted(polluted)}"
        )

    def test_bdd_08_mixin_is_used_by_leaf_models(self) -> None:
        """防空跑：至少有一个叶模型**确实**继承 mixin（否则上一条断言恒真）。"""
        leaves = _leaf_response_models()
        inheriting = [c.__name__ for c in leaves if UtcSerializeMixin in c.__mro__]
        assert inheriting, "没有任何叶模型继承 UtcSerializeMixin——Z 序列化器未落地"

    def test_bdd_08_entry_base_and_user_base_keep_plain_sqlmodel(self) -> None:
        """``EntryBase`` / ``UserBase`` 的基类声明必须保持 ``(SQLModel)``。"""
        assert UtcSerializeMixin not in models_module.EntryBase.__mro__[1:]
        assert UtcSerializeMixin not in models_module.UserBase.__mro__[1:]


class TestBdd09LeafModelsPythonMode:
    """BDD-09：叶响应模型在 python 模式下时间字段仍是 ``datetime``。"""

    def test_bdd_09_leaf_models_python_dump_still_datetime(self) -> None:
        """``EntryResponse``（代表叶模型）python 模式 dump 值均为 ``datetime``。"""
        response = models_module.EntryResponse.model_construct(
            created_at=KNOWN_UTC,
            updated_at=KNOWN_UTC,
            expires_at=KNOWN_UTC,
            archived_at=KNOWN_UTC,
        )
        dumped = response.model_dump()
        for name in ("created_at", "updated_at", "expires_at", "archived_at"):
            value = dumped[name]
            assert isinstance(value, datetime), (
                f"BDD-09 违约：EntryResponse.{name} 为 {type(value).__name__}，应为 datetime"
            )
            assert not isinstance(value, str)

    def test_bdd_09_all_leaf_models_python_mode_is_datetime(self) -> None:
        """遍历全部叶模型：python 模式每个 datetime 字段都不是 ``str``。"""
        offenders: list[str] = []
        for cls in _leaf_response_models():
            instance = _instantiate_with_known_utc(cls)
            dumped = instance.model_dump()
            for name in _datetime_field_names(cls):
                if isinstance(dumped.get(name), str):
                    offenders.append(f"{cls.__name__}.{name} = {dumped[name]!r}")
        assert not offenders, "BDD-09 违约（python 模式返回了 str）：\n" + "\n".join(offenders)


class TestBdd10RemoteParsesZ:
    """BDD-10：CLI remote 模式能解析带 ``Z`` 的 API 时间字符串。"""

    def test_bdd_10_remote_parsed_time_is_aware_utc(self) -> None:
        """``parse_iso('...Z')`` → timezone-aware 且 UTC 偏移为 0。"""
        parsed = parse_iso("2026-11-10T09:43:00Z")
        assert parsed.tzinfo is not None, "解析结果应为 timezone-aware"
        assert parsed.utcoffset() == timedelta(0), f"偏移应为 0，实际 {parsed.utcoffset()}"
        assert (parsed.year, parsed.month, parsed.day) == (2026, 11, 10)
        assert (parsed.hour, parsed.minute, parsed.second) == (9, 43, 0)

    def test_bdd_10_z_suffix_parity_with_offset(self) -> None:
        """``Z`` 与 ``+00:00`` 解析为同一时刻（CPython 3.10 的 ``fromisoformat`` 不吃 Z）。"""
        assert parse_iso("2026-11-10T09:43:00Z") == parse_iso("2026-11-10T09:43:00+00:00")

    def test_bdd_10_remote_client_uses_timefmt_parse_iso(self) -> None:
        """remote 客户端的解析点必须改用 ``timefmt.parse_iso``（P2 §1.1 A4 的唯一改动点）。

        只有换成 ``parse_iso`` 才能吃下带 ``Z`` 的服务端时间（CPython 3.10 的
        ``fromisoformat`` 不接受 ``Z``）。此处断言模块源码引用了 ``parse_iso``。
        """
        client_module = importlib.import_module("peekview.client")
        source = Path(client_module.__file__).read_text(encoding="utf-8")
        assert "parse_iso" in source, "peekview.client 未使用 timefmt.parse_iso 解析带 Z 的时间"
        assert "datetime.fromisoformat" not in source, (
            "peekview.client 仍残留裸 datetime.fromisoformat（无法解析 Z 后缀）"
        )

    def test_bdd_10_naive_input_stays_parseable(self) -> None:
        """naive 输入（无 ``Z``）也必须能解析——不抛异常即可，取值语义见 ``utc_iso_z``。

        P2 §3.1 冻结的 ``parse_iso`` 实现是 ``fromisoformat(value.replace("Z","+00:00"))``：
        带 ``Z`` → aware UTC（BDD-10 的判据）；不带后缀 → 保持 naive。本用例只锁定
        「不抛异常」这一条，避免把实现细节写成断言。
        """
        parsed = parse_iso("2026-11-10T09:43:00")
        assert (parsed.year, parsed.month, parsed.day) == (2026, 11, 10)
        assert (parsed.hour, parsed.minute, parsed.second) == (9, 43, 0)


class TestBdd11CliJsonTimezoneMarker:
    """BDD-11：CLI ``--json`` 输出的时间字段带显式时区标记。"""

    def test_bdd_11_utc_iso_z_contract(self) -> None:
        """``utc_iso_z`` 的三条契约：None 透传 / naive 按 UTC / 非 UTC 输入归一。"""
        assert utc_iso_z(None) is None
        assert utc_iso_z(KNOWN_UTC) == "2026-11-10T09:43:00Z"

        shanghai = timezone(timedelta(hours=8))
        same_instant = datetime(2026, 11, 10, 17, 43, 0, tzinfo=shanghai)
        rendered = utc_iso_z(same_instant)
        assert rendered == "2026-11-10T09:43:00Z", f"非 UTC aware 值应归一到 Z，实际 {rendered!r}"
        assert "+08:00" not in rendered

    def test_bdd_11_utc_iso_z_is_idempotent_for_aware_utc(self) -> None:
        """aware UTC 输入不重复加后缀、不产生 ``+00:00``。"""
        aware = KNOWN_UTC.replace(tzinfo=timezone.utc)
        rendered = utc_iso_z(aware)
        assert rendered.endswith("Z")
        assert "+00:00" not in rendered

    def test_bdd_11_cli_json_datetime_has_tz_marker(self) -> None:
        """``create -j`` / ``list -j`` / ``get -j`` 的每个非 null 时间值带 Z 或 +00:00。

        注意 stdout 噪声：``jieba`` 初始化日志会写进 CliRunner 的 stdout（实测），
        故从第一个 ``{`` 开始取 JSON。
        """
        from click.testing import CliRunner

        from peekview.cli import cli

        runner = CliRunner()
        with runner.isolated_filesystem():
            create_result = runner.invoke(
                cli, ["create", "-s", "BDD-11 契约", "--slug", "bdd11-entry", "-j"]
            )
            assert create_result.exit_code == 0, create_result.output

            for command in (["list", "-j"], ["get", "bdd11-entry", "-j"]):
                result = runner.invoke(cli, command)
                assert result.exit_code == 0, f"{command} 失败：{result.output}"
                payload = _extract_json(result.output)
                timestamps = _walk_json_datetimes(payload)
                assert timestamps, f"{command} 的输出里没有任何时间字段——判据失效"
                for path, raw in timestamps:
                    assert raw.endswith("Z") or raw.endswith("+00:00"), (
                        f"BDD-11 违约：{command} 的 {path} = {raw!r} 无时区标记"
                    )


def _extract_json(output: str) -> object:
    """从 CLI 输出里取出 JSON（跳过 ``jieba`` 等向 stdout 打印的前置噪声）。"""
    start = output.find("{")
    assert start >= 0, f"CLI 输出中未找到 JSON：{output[:200]!r}"
    return json.loads(output[start:])


class TestBdd12NotInPytestSuite:
    """BDD-12 的 pytest 侧守卫：确认它**没有**被误写成 pytest 用例。"""

    def test_bdd_12_audit_is_not_a_pytest_case(self) -> None:
        """BDD-12 必须由 ``scripts/audit-utc-semantics.py`` 承载（P2 §6.1 约束 3）。

        理由：``conftest.py`` 的 ``isolate_config_file`` 是 ``autouse=True``，
        每个测试的 DB 指向 ``tmp_path``，在 tmp DB 上统计「未来 created_at 行数」
        必然 0 → 恒绿假象。此用例在 P4 实现该脚本后转绿。
        """
        repo_root = Path(models_module.__file__).resolve().parents[2]
        script = repo_root / "scripts" / "audit-utc-semantics.py"
        assert script.is_file(), f"BDD-12 的审计脚本缺失：{script}"
        source = script.read_text(encoding="utf-8")
        assert "bdd12" in source.lower(), "审计脚本缺少 bdd12 判据函数"


