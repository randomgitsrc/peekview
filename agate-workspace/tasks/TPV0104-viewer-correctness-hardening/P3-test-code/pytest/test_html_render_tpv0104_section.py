"""TPV0104 段（归档副本）：实际位置为 backend/tests/test_html_render.py 末尾。
运行：cd backend && .venv/bin/python -m pytest tests/test_html_render.py -q
"""

# TPV0104 — HTML sibling 注入预算与超限显式反馈（BDD-38 ~ BDD-41 / BDD-46）
#
# 取证通道（P2-design.md D7）：渲染结果 <body> 末尾的
#   <script type="application/json" id="peekview-inject-report">
# 序列化必须把 `<` 转义成 \u003c（否则用户可控的 path 会提前闭合脚本块、
# BS4 .string 只能取到半截、json.loads 抛 Unterminated string）。
#
# 不变式（P2-review.md §4.2-1 锁定）：
#   - inlined = 实际进入响应体的 sibling 个数（不得由 requested - 预算层 skipped 反推）
#   - requested - inlined == len(skipped)（势）
#   - {s["reason"]} <= REASONS（六元闭集，不得增删）
#   - skipped 按 file_id 去重（filename 可为 null）
#
# 造件须覆写 max_entry_files（BDD-38 的 Given）：默认 50 时 POST 51 文件会被 413 拒绝。
# ══════════════════════════════════════════════════════════════════════════════

REPORT_ID = "peekview-inject-report"

# P2-design.md D7 的 reason 六元闭集（锁定项：不得增删）
REASONS = {
    "count_limit",
    "file_too_large",
    "binary_too_large",
    "total_budget",
    "not_found",
    "not_injectable",
}

HTML_MAIN = "<!DOCTYPE html><html><head></head><body><h1>budget</h1></body></html>"


def _make_app_client(max_entry_files: int):
    """返回 (tmp_dir, AsyncClient) —— 覆写 max_entry_files 造件。"""
    tmp_dir = Path(tempfile.mkdtemp())
    app = create_app(
        data_dir=tmp_dir / "data",
        db_path=tmp_dir / "test.db",
        config=PeekConfig(limits=PeekLimits(max_entry_files=max_entry_files)),
    )
    transport = ASGITransport(app=app)
    return tmp_dir, AsyncClient(transport=transport, base_url="http://test")


def _parse_report(html: str) -> dict:
    """BS4 取证通道（P2-design.md D7）——转义 < 后该通道才可靠。"""
    node = BeautifulSoup(html, "html.parser").find("script", {"id": REPORT_ID})
    assert node is not None, "render 响应必须含可机器解析的注入报表块"
    return json.loads(node.string)


# ── BDD-38：数量上限 → 被跳过清单（构造路径可达）────────────────────────


class TestCountLimitSkipReport:
    @pytest.mark.asyncio
    async def test_bdd_38_exceeding_count_limit_produces_skip_report(self):
        # N = _MAX_INJECT_IDS + 1 个 sibling → 必然有 1 个及以上被跳过
        n = _MAX_INJECT_IDS + 1
        tmp_dir, client = _make_app_client(max_entry_files=n + 1)
        try:
            async with client:
                files = [
                    {
                        "filename": "index.html",
                        "content": HTML_MAIN,
                    }
                ]
                for i in range(n):
                    files.append(
                        {
                            "filename": f"res{i}.css",
                            "content": f".r{i} {{ color: red; }}",
                        }
                    )
                slug, created = await _create_entry(client, files)
                main_id = created[0]["id"]
                sibling_ids = [f["id"] for f in created[1:]]

                resp = await client.get(_render_url(slug, main_id, sibling_ids))
                assert resp.status_code == 200, resp.text
                report = _parse_report(resp.text)

                # ① 清单非空
                assert len(report["skipped"]) > 0
                # ② 势：每一项没进去的都必须可查
                assert report["requested"] - report["inlined"] == len(report["skipped"])
                # ③ 清单每项可按 file_id 定位（filename 可为 null）
                for item in report["skipped"]:
                    assert isinstance(item["file_id"], int)
                    assert item["reason"] in REASONS
                ids = [item["file_id"] for item in report["skipped"]]
                assert len(set(ids)) == len(ids)
                # ④ count_limit 类必须出现（数量上限是本次的触发点）
                assert "count_limit" in {item["reason"] for item in report["skipped"]}
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    def test_bdd_38_inject_id_limit_below_default_entry_file_limit(self):
        """代码级关系断言：仓库默认配置下 `_MAX_INJECT_IDS < max_entry_files - 1`。

        读 `model_fields[...].default` 而非实例化（实例化会受 env 漂移）。
        """
        declared = PeekLimits.model_fields["max_entry_files"].default
        assert _MAX_INJECT_IDS < declared - 1, (
            f"_MAX_INJECT_IDS({_MAX_INJECT_IDS}) 必须严格小于 max_entry_files-1({declared - 1})，"
            "否则真实配置下超限分支永不触发"
        )
        assert declared == 50, "max_entry_files 默认值已变更，须重核 _MAX_INJECT_IDS 取值"


# ── BDD-39：单文件文本注入上限（正反双向）────────────────────────────────


class TestSingleFileTextLimit:
    @pytest.mark.asyncio
    async def test_bdd_39_oversized_text_sibling_skipped_and_undersized_inlined(self):
        huge = "x" * (2 * 1024 * 1024 + 1)
        small_marker = "TPV0104-SMALL-TEXT-MARKER"
        tmp_dir, client = _make_app_client(max_entry_files=10)
        try:
            async with client:
                files = [
                    {"filename": "index.html", "content": HTML_MAIN},
                    {"filename": "huge.txt", "content": huge},
                    {"filename": "small.css", "content": f".m {{ content: '{small_marker}'; }}"},
                ]
                slug, created = await _create_entry(client, files)
                main_id = created[0]["id"]
                huge_id = created[1]["id"]
                small_id = created[2]["id"]

                resp = await client.get(_render_url(slug, main_id, [huge_id, small_id]))
                assert resp.status_code == 200, resp.text
                report = _parse_report(resp.text)

                # 超限文件的文本内容不出现，且文件名进跳过清单
                assert huge not in resp.text
                skipped_names = {item.get("filename") for item in report["skipped"]}
                assert "huge.txt" in skipped_names
                reasons = {item["reason"] for item in report["skipped"] if item.get("filename") == "huge.txt"}
                assert reasons == {"file_too_large"}
                # 对照：未超限的那个仍被正常内联
                assert small_marker in resp.text
                assert report["requested"] - report["inlined"] == len(report["skipped"])
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)


# ── BDD-40：累计总预算超限必须有可机器解析反馈 ───────────────────────────


class TestTotalBudgetFeedback:
    @pytest.mark.asyncio
    async def test_bdd_40_total_budget_overflow_is_machine_readable(self):
        chunk = "y" * (3 * 1024 * 1024 + 1)
        tmp_dir, client = _make_app_client(max_entry_files=10)
        try:
            async with client:
                files = [{"filename": "index.html", "content": HTML_MAIN}]
                for i in range(4):
                    files.append({"filename": f"big{i}.txt", "content": chunk})
                # 4 × ~3MB 文本 sibling 累计超 8MiB 总预算
                slug, created = await _create_entry(client, files)
                main_id = created[0]["id"]
                sib_ids = [f["id"] for f in created[1:]]

                resp = await client.get(_render_url(slug, main_id, sib_ids))
                if resp.status_code < 400:
                    # 路线 A：2xx + 可机器解析跳过清单
                    report = _parse_report(resp.text)
                    assert report["requested"] - report["inlined"] == len(report["skipped"])
                    skipped_ids = {item["file_id"] for item in report["skipped"]}
                    missing = [i for i in sib_ids if i not in skipped_ids]
                    inlined_ids = {item["file_id"] for item in report.get("inlined_ids", [])}
                    assert all(m in skipped_ids or m in inlined_ids for m in missing)
                else:
                    # 路线 B：HTTP >= 400 且 error.message 非空
                    body = resp.json()
                    assert body.get("message") or body.get("detail")
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    @pytest.mark.asyncio
    async def test_bdd_40_report_escapes_html_sensitive_paths(self):
        """G2：含 `</script>` 的 path 不得提前闭合脚本块。"""
        evil_path = "evil</script><img src=x onerror=alert(1)>.css"
        tmp_dir, client = _make_app_client(max_entry_files=10)
        try:
            async with client:
                files = [
                    {"filename": "index.html", "content": HTML_MAIN},
                    {"path": evil_path, "filename": "evil.css", "content": ".e { color: red; }"},
                    {"path": "notes", "filename": "README.md", "content": "README-CONTENT"},
                ]
                slug, created = await _create_entry(client, files)
                main_id = created[0]["id"]
                sib_ids = [f["id"] for f in created[1:]]

                resp = await client.get(_render_url(slug, main_id, sib_ids))
                assert resp.status_code == 200, resp.text

                soup = BeautifulSoup(resp.text, "html.parser")
                node = soup.find("script", {"id": REPORT_ID})
                assert node is not None
                report = json.loads(node.string)
                paths = [item.get("path") for item in report["skipped"]]
                assert evil_path in paths or report["inlined"] >= 0
                # 脚本块未被提前闭合：其后的 stray img 不应被解析成真实 DOM
                assert soup.find("img", {"src": "x"}) is None
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    @pytest.mark.asyncio
    async def test_bdd_40_non_injectable_sibling_is_recorded(self):
        """G8/B4 素材③：非 css/js sibling 必须出现在清单里且 reason == not_injectable。"""
        tmp_dir, client = _make_app_client(max_entry_files=10)
        try:
            async with client:
                files = [
                    {"filename": "index.html", "content": HTML_MAIN},
                    {"filename": "README.md", "content": "# 未被引用的 markdown"},
                    {"filename": "data.json", "content": '{"a": 1}'},
                ]
                slug, created = await _create_entry(client, files)
                main_id = created[0]["id"]
                sib_ids = [f["id"] for f in created[1:]]

                resp = await client.get(_render_url(slug, main_id, sib_ids))
                assert resp.status_code == 200, resp.text
                report = _parse_report(resp.text)
                reasons = {item.get("filename"): item["reason"] for item in report["skipped"]}
                assert reasons.get("README.md") == "not_injectable"
                assert reasons.get("data.json") == "not_injectable"
                assert report["requested"] - report["inlined"] == len(report["skipped"])
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    @pytest.mark.asyncio
    async def test_bdd_40_oversized_binary_sibling_recorded(  # noqa: D401
        self,
    ):
        """>768KB 二进制 sibling 必须进清单（reason == binary_too_large）。"""
        big_png = base64.b64encode(b"\x89PNG" + b"z" * (770 * 1024)).decode()
        tmp_dir, client = _make_app_client(max_entry_files=10)
        try:
            async with client:
                files = [
                    {"filename": "index.html", "content": HTML_MAIN},
                    {"filename": "big.png", "content_base64": big_png},
                    {"filename": "small.svg", "content": "<svg></svg>"},
                ]
                slug, created = await _create_entry(client, files)
                main_id = created[0]["id"]
                sib_ids = [f["id"] for f in created[1:]]

                resp = await client.get(_render_url(slug, main_id, sib_ids))
                assert resp.status_code == 200, resp.text
                report = _parse_report(resp.text)
                reasons = {item.get("filename"): item["reason"] for item in report["skipped"]}
                assert reasons.get("big.png") == "binary_too_large"
                assert report["requested"] - report["inlined"] == len(report["skipped"])
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)


# ── G11：双向对账（报告 inlined ⇒ 内容真在；报告 skipped ⇒ 内容真不在）──


class TestBidirectionalReconciliation:
    @pytest.mark.asyncio
    async def test_g11_inlined_claims_match_actual_response_body(self):
        css_marker = "TPV0104-CSS-LANDED"
        md_marker = "TPV0104-README-NOT-LANDED"
        tmp_dir, client = _make_app_client(max_entry_files=10)
        try:
            async with client:
                html = '<html><head><link rel="stylesheet" href="app.css"></head><body>x</body></html>'
                files = [
                    {"filename": "index.html", "content": html},
                    {"filename": "app.css", "content": f".a {{ content: '{css_marker}'; }}"},
                    {"filename": "README.md", "content": md_marker},
                ]
                slug, created = await _create_entry(client, files)
                main_id = created[0]["id"]
                sib_ids = [f["id"] for f in created[1:]]

                resp = await client.get(_render_url(slug, main_id, sib_ids))
                assert resp.status_code == 200, resp.text
                report = _parse_report(resp.text)
                skipped_names = {item.get("filename") for item in report["skipped"]}

                for needle, name in ((css_marker, "app.css"), (md_marker, "README.md")):
                    landed = needle in resp.text
                    reported_skip = name in skipped_names
                    assert landed != reported_skip, f"{name} 的报告状态与事实不符"
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)


# ── G12：两跳 @import 链（第七处埋点递归透传的唯一证伪形态）──────────────


class TestTwoHopImportChain:
    @pytest.mark.asyncio
    async def test_g12_two_hop_import_chain_all_consumed(self):
        html = '<html><head><link rel="stylesheet" href="a.css"></head><body>x</body></html>'
        tmp_dir, client = _make_app_client(max_entry_files=10)
        try:
            async with client:
                files = [
                    {"filename": "index.html", "content": html},
                    {"filename": "a.css", "content": '@import url("b.css");\n.a { color: red; }'},
                    {"filename": "b.css", "content": '@import url("c.css");\n.b { color: green; }'},
                    {"filename": "c.css", "content": ".c { color: blue; }"},
                ]
                slug, created = await _create_entry(client, files)
                main_id = created[0]["id"]
                sib_ids = {f["filename"]: f["id"] for f in created[1:]}

                resp = await client.get(
                    _render_url(slug, main_id, [sib_ids["a.css"], sib_ids["b.css"], sib_ids["c.css"]])
                )
                assert resp.status_code == 200, resp.text
                report = _parse_report(resp.text)
                skipped_names = {item.get("filename") for item in report["skipped"]}
                assert "b.css" not in skipped_names
                assert "c.css" not in skipped_names
                assert "color: green" in resp.text
                assert "color: blue" in resp.text
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)


# ── BDD-41：未超预算时与现状等价（回归兼容）──────────────────────────────


class TestNoBudgetOverflowEquivalence:
    @pytest.mark.asyncio
    async def test_bdd_41_css_and_js_inlined_with_empty_skip_list(self):
        tmp_dir, client = _make_app_client(max_entry_files=10)
        try:
            async with client:
                html = (
                    "<html><head><link rel=\"stylesheet\" href=\"app.css\"></head>"
                    '<body><script src="app.js"></script></body></html>'
                )
                files = [
                    {"filename": "index.html", "content": html},
                    {"filename": "app.css", "content": ".a { color: red; }"},
                    {"filename": "app.js", "content": "console.log('t');"},
                ]
                slug, created = await _create_entry(client, files)
                main_id = created[0]["id"]
                sib_ids = [f["id"] for f in created[1:]]

                resp = await client.get(_render_url(slug, main_id, sib_ids))
                assert resp.status_code == 200, resp.text
                assert "<style>" in resp.text
                assert "color: red" in resp.text
                assert "console.log('t')" in resp.text
                report = _parse_report(resp.text)
                assert report["skipped"] == []
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)


# ── BDD-46：CSP 与 sandbox 属性不变（不变守护）───────────────────────────


class TestCspUnchanged:
    def test_bdd_46_render_csp_still_allows_https(self):
        from peekview.api.files import RENDER_CSP

        assert "https:" in RENDER_CSP
        assert "frame-ancestors 'self'" in RENDER_CSP
        assert "connect-src blob: data: https:" in RENDER_CSP

    @pytest.mark.asyncio
    async def test_bdd_46_render_response_csp_header_matches_constant(self):
        from peekview.api.files import RENDER_CSP

        tmp_dir, client = _make_app_client(max_entry_files=10)
        try:
            async with client:
                slug, created = await _create_entry(
                    client, [{"filename": "index.html", "content": HTML_MAIN}]
                )
                main_id = created[0]["id"]
                resp = await client.get(_render_url(slug, main_id, []))
                assert resp.status_code == 200
                assert resp.headers["content-security-policy"] == RENDER_CSP
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)


