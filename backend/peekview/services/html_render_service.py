"""HTML render service: sibling resource injection.

Replicates frontend `injectResources` logic (HtmlViewer.vue) using
BeautifulSoup with the stdlib html.parser backend.
"""

from __future__ import annotations

from dataclasses import dataclass

from bs4 import BeautifulSoup

_BYPASS_PREFIXES = ("http://", "https://", "data:", "blob:", "mailto:", "tel:", "//", "#", "/")

_MAX_INJECT_IDS = 50
_BINARY_SIZE_LIMIT = 768 * 1024


@dataclass
class SiblingFileData:
    filename: str
    path: str | None
    content: str
    language: str | None
    is_binary: bool
    mime_type: str | None


def normalize_ref(ref: str) -> str | None:
    """Normalize a reference for matching, returning None if it should be skipped.

    Mirrors the frontend `normalizeRef`: skip absolute/protocol/blob/data refs,
    strip leading `./`.
    """
    if not ref:
        return None
    ref = ref.strip()
    if not ref:
        return None
    for p in _BYPASS_PREFIXES:
        if ref.startswith(p):
            return None
    while ref.startswith("./"):
        ref = ref[2:]
    return ref if ref else None


def parse_inject_ids(inject: str | None, main_file_id: int) -> list[int]:
    """Parse comma-separated inject IDs, drop the main file_id, dedupe, cap at 50."""
    if not inject:
        return []
    seen: set[int] = set()
    result: list[int] = []
    for token in inject.split(","):
        token = token.strip()
        if not token:
            continue
        try:
            fid = int(token)
        except ValueError:
            continue
        if fid == main_file_id or fid in seen:
            continue
        seen.add(fid)
        result.append(fid)
        if len(result) >= _MAX_INJECT_IDS:
            break
    return result


def _detect_kind(f: SiblingFileData) -> str | None:
    """Detect file kind from extension or language. Returns "css", "js", or None."""
    targets = [f.filename.lower()]
    if f.path:
        targets.append(f.path.lower())
    for t in targets:
        if t.endswith(".css"):
            return "css"
        if t.endswith(".js"):
            return "js"
    if f.language:
        lang = f.language.lower()
        if lang == "css":
            return "css"
        if lang in ("javascript", "js"):
            return "js"
    return None


def _sibling_keys(f: SiblingFileData) -> list[str]:
    """Collect all normalized keys that identify this sibling for matching."""
    keys: list[str] = []
    by_name = normalize_ref(f.filename)
    if by_name:
        keys.append(by_name)
    if f.path:
        by_path = normalize_ref(f.path)
        if by_path and (not by_name or by_path != by_name):
            keys.append(by_path)
    return keys


def inject_resources(html: str, siblings: list[SiblingFileData]) -> str:
    """Inject sibling files into HTML.

    CSS: <link rel="stylesheet" href> → inline <style>
    JS:  <script src> (text/javascript) → inline <script> moved to body end
    Binary: img/video/audio/source/track[src] → data URI
    Favicon: <link rel="icon" href> → data URI

    Siblings not referenced in the HTML but explicitly requested are appended
    to <head> (CSS) or <body> end (JS).
    """
    if not siblings:
        return html

    soup = BeautifulSoup(html, "html.parser")

    text_siblings = [f for f in siblings if not f.is_binary]
    binary_siblings = [f for f in siblings if f.is_binary]

    # Build text content map: filename + path → content
    text_map: dict[str, str] = {}
    for f in text_siblings:
        for k in _sibling_keys(f):
            text_map[k] = f.content

    used_text_keys: set[str] = set()

    # CSS: <link rel="stylesheet"> → <style>
    for link in soup.find_all("link", rel="stylesheet"):
        href = link.get("href")
        key = normalize_ref(href or "")
        if not key or key not in text_map:
            continue
        used_text_keys.add(key)
        style = soup.new_tag("style")
        style.string = f"/* injected from: {key} */\n{text_map[key]}"
        link.replace_with(style)

    # JS: <script src> → inline, move to body end
    inline_scripts_to_append = []
    for script in list(soup.find_all("script", src=True)):
        src = script.get("src")
        key = normalize_ref(src or "")
        if not key or key not in text_map:
            continue
        type_attr = script.get("type")
        if type_attr and type_attr != "text/javascript":
            continue
        used_text_keys.add(key)
        inline = soup.new_tag("script")
        inline.string = f"/* injected from: {key} */\n{text_map[key]}"
        script.decompose()
        inline_scripts_to_append.append(inline)

    # Inject unreferenced text siblings
    for f in text_siblings:
        kind = _detect_kind(f)
        if not kind:
            continue
        if any(k in used_text_keys for k in _sibling_keys(f)):
            continue
        if kind == "css":
            if soup.head is None:
                head = soup.new_tag("head")
                if soup.html is not None:
                    soup.html.insert(0, head)
                else:
                    html_tag = soup.new_tag("html")
                    html_tag.append(head)
                    soup.append(html_tag)
            else:
                head = soup.head
            style = soup.new_tag("style")
            style.string = f"/* injected from: {f.filename} */\n{f.content}"
            head.append(style)
        elif kind == "js":
            inline = soup.new_tag("script")
            inline.string = f"/* injected from: {f.filename} */\n{f.content}"
            inline_scripts_to_append.append(inline)

    # Binary resources
    if binary_siblings:
        binary_map: dict[str, SiblingFileData] = {}
        for f in binary_siblings:
            by_name = normalize_ref(f.filename)
            if by_name:
                binary_map[by_name] = f
            if f.path:
                by_path = normalize_ref(f.path)
                if by_path and by_path != by_name:
                    binary_map[by_path] = f

        safe_src_tags = ("img", "video", "audio", "source", "track")
        for tag_name in safe_src_tags:
            for el in soup.find_all(tag_name, src=True):
                src = el.get("src")
                key = normalize_ref(src or "")
                if not key or key not in binary_map:
                    continue
                f = binary_map[key]
                el["src"] = f"data:{f.mime_type or 'application/octet-stream'};base64,{f.content}"

        # favicon
        for link in soup.find_all("link"):
            rel = link.get("rel")
            if not rel:
                continue
            rel_vals = rel if isinstance(rel, list) else [rel]
            rel_lower = " ".join(rel_vals).lower()
            if "icon" not in rel_lower and "shortcut icon" not in rel_lower:
                continue
            href = link.get("href")
            key = normalize_ref(href or "")
            if not key or key not in binary_map:
                continue
            f = binary_map[key]
            link["href"] = f"data:{f.mime_type or 'application/octet-stream'};base64,{f.content}"

    # Append inline scripts to body end (create body if missing)
    if inline_scripts_to_append:
        if soup.body is None:
            body = soup.new_tag("body")
            if soup.html is None:
                html_tag = soup.new_tag("html")
                html_tag.append(body)
                soup.append(html_tag)
            else:
                soup.html.append(body)
        for s in inline_scripts_to_append:
            soup.body.append(s)

    return str(soup)
