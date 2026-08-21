import re
import os
import json
import hashlib

_HOOKS_DIR = os.path.dirname(os.path.abspath(__file__))

# Populated in on_pre_build; used by on_post_page and on_post_build.
_partial_hashes: dict[str, str] = {}
_theme_css_version: str = ""

# Maps each page URL to its breadcrumb (list of ancestor section titles).
# Populated in on_nav; written to a JSON asset in on_post_build so the search
# results UI can show which doc set / version a result belongs to.
_breadcrumbs: dict[str, list[str]] = {}

# Per-slug index of which page tails exist in which version. Populated in
# on_nav; written to a JSON asset in on_post_build so the sidebar's version
# dropdown can resolve an equivalent destination without needing every
# version's nav rendered into the DOM.
_version_index = {}


def _file_hash(path: str) -> str:
    """Return the first 8 hex characters of the MD5 hash of a file's content."""
    with open(path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()[:8]


def on_pre_build(config, **kwargs):
    """Pre-compute content hashes from source CSS files.

    The combined hash of theme.css + every partial is stored as the version
    string added to the <link> tag in HTML, so any change to any partial also
    busts the theme.css browser/CDN cache.
    """
    global _theme_css_version
    _partial_hashes.clear()

    css_src_dir = os.path.join(_HOOKS_DIR, "theme", "material", "assets", "css")
    partials_src_dir = os.path.join(css_src_dir, "partials")

    # Collect raw bytes of theme.css + all partials for a combined hash
    combined = bytearray()

    theme_css_src = os.path.join(css_src_dir, "theme.css")
    if os.path.exists(theme_css_src):
        with open(theme_css_src, "rb") as f:
            combined += f.read()

    if os.path.exists(partials_src_dir):
        for fname in sorted(os.listdir(partials_src_dir)):
            if fname.endswith(".css"):
                path = os.path.join(partials_src_dir, fname)
                data = open(path, "rb").read()
                combined += data
                _partial_hashes[fname] = hashlib.md5(data).hexdigest()[:8]

    _theme_css_version = hashlib.md5(combined).hexdigest()[:8]


def _has_reachable_page(item):
    """Return True if `item` (a mkdocs nav Section/Page/Link) resolves to a
    URL, or anything in its subtree does.

    Mirrors first_page_url() in theme/material/partials/nav-item.html, which
    walks a level-1 section's subtree depth-first looking for the first page
    to link a pruned section to (see the "Level-1 sections the reader is not
    currently inside render as a single link" branch there). If nothing in
    the subtree resolves, that macro returns "", `| trim` leaves it falsy,
    and the `{% if target %}` guard silently drops the entire <li> -- i.e.
    the whole product/section vanishes from the sidebar, the only product
    switcher on this site (navigation.tabs is off; there is no header nav).
    """
    if getattr(item, "url", None):
        return True
    for child in getattr(item, "children", None) or []:
        if _has_reachable_page(child):
            return True
    return False


def on_nav(nav, config, files):
    """Build a URL -> breadcrumb map from the navigation tree.

    The breadcrumb is the list of ancestor section titles for each page (e.g.
    ["API Gateway", "1.1.0", "Policies"]). This is used to disambiguate search
    results that share the same title across versions / doc sets.
    """
    versioned_sections = config["extra"].get("versioned_sections") or {}

    # A level-1 section with children but no reachable page anywhere in its
    # subtree would silently disappear from the sidebar the moment the reader
    # isn't inside it (see _has_reachable_page's docstring). Checking once
    # here, over the whole nav tree, catches it for every page in a single
    # pass instead of only when a reader happens to land elsewhere and the
    # per-page pruning branch in nav-item.html silently no-ops. A loud build
    # failure that names the section beats a product quietly missing from
    # navigation.
    for item in nav.items:
        if getattr(item, "children", None) and not _has_reachable_page(item):
            raise ValueError(
                f"Navigation section {item.title!r} has children but no "
                "reachable page anywhere in its subtree. "
                "theme/material/partials/nav-item.html's first_page_url() "
                "would return an empty target for it, and its pruning "
                "branch would then silently drop this section from the "
                "sidebar -- the only product switcher on this site. Add a "
                "page under this section, or remove the section from the "
                "navigation."
            )

        # The whole-subtree check above is not enough for a versioned
        # section: nav-item.html's pruning branch does not link to just any
        # reachable page in the subtree, it specifically calls
        # first_page_url(default_version_group) -- the child titled
        # versioned_cfg.default. A different version elsewhere in the same
        # section (e.g. "next") can be fully reachable, which satisfies the
        # check above, while the default version's own subtree is empty,
        # which still yields an empty target and a silently dropped <li>.
        # Check that specific child directly. (A default title with no
        # matching child at all is a different, config-vs-nav mismatch --
        # see the versioned_sections cross-check below -- so this is a
        # no-op here rather than a duplicate error.)
        versioned_cfg = versioned_sections.get(getattr(item, "title", None))
        if versioned_cfg:
            default_title = versioned_cfg.get("default")
            default_child = next(
                (
                    child
                    for child in getattr(item, "children", None) or []
                    if getattr(child, "title", None) == default_title
                ),
                None,
            )
            if default_child is not None and not _has_reachable_page(default_child):
                raise ValueError(
                    f"Navigation section {item.title!r}'s default version "
                    f"group {default_title!r} (extra.versioned_sections."
                    f"{item.title!r}.default) has no reachable page "
                    "anywhere in its subtree. nav-item.html's pruning "
                    "branch links a pruned copy of this section to "
                    "first_page_url(default_version_group), so an "
                    "unreachable default version leaves that link empty "
                    "and the section's <li> is silently dropped for every "
                    "reader not currently inside it. Add a page under this "
                    "version, or change extra.versioned_sections's "
                    "'default'."
                )

    # Cross-check extra.versioned_sections against the nav tree itself.
    # Version-group titles are literal YAML nav keys, so a mismatch (a typo,
    # a trailing space, "1.3" vs "1.3.0") is silent everywhere else: a
    # missing default falls back to the section's first child ("next" for
    # every product here), and a missing/renamed version simply never
    # matches in the URL-matching loop, leaving zero version groups
    # rendered. Both are green builds. Catch them here instead.
    nav_items_by_title = {
        getattr(item, "title", None): item for item in nav.items
    }
    for section, cfg in versioned_sections.items():
        nav_item = nav_items_by_title.get(section)
        if nav_item is None:
            continue
        child_titles = [
            getattr(child, "title", None)
            for child in getattr(nav_item, "children", None) or []
        ]
        configured_versions = cfg.get("versions") or []
        missing_versions = [v for v in configured_versions if v not in child_titles]
        if missing_versions:
            raise ValueError(
                f"extra.versioned_sections.{section!r} configures version(s) "
                f"{missing_versions!r} that do not exist as a child nav "
                f"title under the {section!r} section (found "
                f"{child_titles!r}). Version-group titles are literal nav "
                "keys, so this must be a typo in mkdocs.yml or the nav "
                "tree -- fix whichever one is wrong."
            )
        default = cfg.get("default")
        if default not in child_titles:
            raise ValueError(
                f"extra.versioned_sections.{section!r}.default is "
                f"{default!r}, which is not among the {section!r} "
                f"section's child nav titles (found {child_titles!r}). "
                "nav-item.html falls back to the section's first child "
                "when this doesn't match, silently pointing every pruned "
                "link at that child (typically the unreleased 'next' "
                "version) instead of the configured default."
            )

    _breadcrumbs.clear()
    for page in nav.pages:
        crumbs = []
        item = page.parent
        while item is not None:
            if getattr(item, "title", None):
                crumbs.insert(0, item.title)
            item = item.parent
        if page.url and crumbs:
            _breadcrumbs[page.url] = crumbs

    # Build a per-slug index of which page tails exist in which version, so the
    # sidebar's version dropdown can resolve an equivalent destination without
    # needing every version's nav rendered into the DOM. See theme.js.
    _version_index.clear()
    for section, cfg in versioned_sections.items():
        slug = cfg.get("slug")
        if not slug:
            raise ValueError(
                f"extra.versioned_sections.{section!r} in mkdocs.yml has no "
                f"'slug' (got {slug!r}); the version index cannot key this "
                "section without one."
            )
        versions = cfg.get("versions") or []
        if not versions:
            raise ValueError(
                f"extra.versioned_sections.{section!r} (slug {slug!r}) in "
                f"mkdocs.yml has an empty or missing 'versions' list (got "
                f"{cfg.get('versions')!r}); its version dropdown would have "
                "nowhere to navigate."
            )
        default = cfg.get("default")
        if default not in versions:
            raise ValueError(
                f"extra.versioned_sections.{section!r} (slug {slug!r}) in "
                f"mkdocs.yml has 'default' {default!r} which is not a member "
                f"of 'versions' {versions!r}."
            )
    slug_to_cfg = {
        cfg["slug"]: cfg for cfg in versioned_sections.values() if cfg.get("slug")
    }
    for slug, cfg in slug_to_cfg.items():
        released = list(cfg.get("versions") or [])
        # "next" is rendered as its own version group in the nav (see
        # nav-item.html) even though it is deliberately absent from the
        # config's `versions` list, so it never appears as a dropdown
        # <option> (see theme.js showVersion()'s "Unreleased" optgroup
        # path). It still needs to be a recognised version for client-side
        # path resolution and search scoping, so list it here too -- first,
        # matching the position the nav actually renders it in.
        recognised = ["next"] + [v for v in released if v != "next"]
        _version_index[slug] = {
            "default": cfg.get("default"),
            "versions": recognised,
            # Not pre-seeded per version: the nav.pages walk below adds a
            # version's key (and its pages) on demand, so a version with no
            # matching pages simply has no key rather than an empty list.
            "pages": {},
        }
    for page in nav.pages:
        if not page.url:
            continue
        parts = page.url.strip("/").split("/")
        for i in range(len(parts) - 1):
            slug, version = parts[i], parts[i + 1]
            entry = _version_index.get(slug)
            if not entry:
                continue
            # Accept a path segment as a version only when it is one of the
            # slug's recognised versions (its configured released versions,
            # plus "next"). Never pattern-match an arbitrary segment into a
            # version key -- an ordinary content directory that happens to
            # sit at this depth must not be mistaken for one.
            if version not in entry["versions"]:
                continue
            tail = "/".join(parts[i + 2:])
            entry["pages"].setdefault(version, []).append(
                f"{tail}/" if tail else ""
            )
            break

    return nav


def _built_page_tails(version_dir):
    """Yield the tail (relative path, trailing slash, "" for the version
    root) of every built page under version_dir -- an already-verified
    "<site_dir>/<slug>/<version>" directory. Walks the filesystem rather
    than nav.pages so it also finds pages nav.pages does not know about,
    such as redirect-plugin stubs for retired URLs."""
    for root, _dirs, filenames in os.walk(version_dir):
        if "index.html" not in filenames:
            continue
        rel = os.path.relpath(root, version_dir)
        yield "" if rel == "." else rel.replace(os.sep, "/") + "/"


def on_post_build(config, **kwargs):
    """Append content-hash query strings to @import URLs inside the built theme.css
    so that CDN / browser caches are busted whenever a partial file changes.
    Also writes the search breadcrumb map collected in on_nav."""
    site_dir = config["site_dir"]

    # Write the breadcrumb map for the search results UI.
    breadcrumbs_path = os.path.join(site_dir, "assets", "search-breadcrumbs.json")
    os.makedirs(os.path.dirname(breadcrumbs_path), exist_ok=True)
    with open(breadcrumbs_path, "w", encoding="utf-8") as f:
        json.dump(_breadcrumbs, f, ensure_ascii=False)

    # Extend each version's page list with every page mkdocs actually wrote
    # to disk for it, not only the ones reachable by walking nav.pages (see
    # on_nav): a version also carries redirect-plugin stubs for retired URLs
    # (plugins.redirects.redirect_maps in mkdocs.yml), and a reader who
    # lands on one still needs the version switcher to resolve from it. This
    # runs after nav.pages has already populated each list (in on_nav), so a
    # version's first *real* nav page -- its overview -- stays first; this
    # only appends tails nav.pages didn't already find, and only ever within
    # a "<site_dir>/<slug>/<version>" directory already confirmed to belong
    # to one of that slug's recognised versions, never from a generic scan.
    for slug, entry in _version_index.items():
        slug_dir = os.path.join(site_dir, slug)
        for version in entry["versions"]:
            version_dir = os.path.join(slug_dir, version)
            if not os.path.isdir(version_dir):
                continue
            existing = entry["pages"].setdefault(version, [])
            seen = set(existing)
            for tail in _built_page_tails(version_dir):
                if tail not in seen:
                    existing.append(tail)
                    seen.add(tail)

    # Write the version index consumed by the sidebar version dropdown.
    version_index_path = os.path.join(site_dir, "assets", "version-index.json")
    with open(version_index_path, "w", encoding="utf-8") as f:
        json.dump(_version_index, f, ensure_ascii=False)

    theme_css_path = os.path.join(site_dir, "assets", "css", "theme.css")

    if not os.path.exists(theme_css_path):
        return

    with open(theme_css_path, "r", encoding="utf-8") as f:
        content = f.read()

    def _add_hash(match):
        url = match.group(1)
        base_url = url.split("?")[0]
        fname = os.path.basename(base_url)
        version = _partial_hashes.get(fname)
        if version:
            return f"@import url('{base_url}?v={version}')"
        return match.group(0)

    new_content = re.sub(r"@import url\('([^']+)'\)", _add_hash, content)

    with open(theme_css_path, "w", encoding="utf-8") as f:
        f.write(new_content)


def on_post_page(output, page, config, **kwargs):
    # Add cache-busting version to the theme.css <link> tag so CDN/browser
    # cache is invalidated whenever theme.css or any of its partials change.
    if _theme_css_version:
        output = re.sub(
            r'(<link[^>]+href="[^"]*assets/css/theme\.css)(")',
            rf'\1?v={_theme_css_version}\2',
            output,
        )

    if page.is_homepage:
        return output

    first = next(iter(page.toc), None)
    # we want the page's title to be derived from the frontmatter's title key.
    # if frontmatter or title key is unavailable, we fall back to the page's H1
    # heading
    if page.meta and page.meta.get("title"):
        title = page.meta["title"]
    elif first and first.level == 1:
        title = re.sub(r"<[^>]+>", "", first.title).strip()
    elif page.title:
        title = re.sub(r"<[^>]+>", "", page.title).strip()
    else:
        return output

    suffix = config.get("extra", {}).get("page_title_suffix", "")
    full_title = f"{title} | {suffix}" if suffix else title

    return re.sub(r"<title>.*?</title>", f"<title>{full_title}</title>", output, count=1)

# Matches a YAML frontmatter block at the start of a file.
FRONTMATTER_RE = re.compile(r"\A-{3}[ \t]*\n.*?\n(?:-{3}|\.{3})[ \t]*\n", re.DOTALL)


def _raw_frontmatter(src_path: str) -> str:
    """
    Return the page's frontmatter block as written in the source file.
    """
    try:
        with open(src_path, encoding="utf-8-sig") as f:
            source = f.read()
    except OSError:
        return ""
    match = FRONTMATTER_RE.match(source)
    return match.group(0) if match else ""


def _drop_tags_from_search(page):
    """Stop frontmatter tags from dominating search ranking.

    Material weights `tags` very heavily. Broad tags (e.g. the homepage's
    "platform-overview", "api-management") tokenize into common query words and
    let unrelated pages outrank the exact page a user searched for. There is no
    `tags` plugin in this project, so tags exist only to feed search — removing
    them from the index restores title/content-driven ranking with no other
    side effects.
    """
    if isinstance(page.meta, dict) and page.meta.get("tags"):
        page.meta["tags"] = []


def on_page_markdown(markdown, page, config, **kwargs):
    """Write Markdown files to a parallel .md file in the build output.

    For example, it creates the file `SITE_DIR/cloud/ai-gateway/overview.md`
    alongside the HTML page.
    """
    # Keep tags out of the search index (see helper above).
    _drop_tags_from_search(page)

    site_dir = config["site_dir"]
    # page.url is like "cloud/ai-gateway/overview/" so strip trailing slash
    # to produce "cloud/ai-gateway/overview.md".
    # When use_directory_urls is false, page.url ends in .html so strip that too.
    url_path = page.url.rstrip("/")
    if url_path.endswith(".html"):
        url_path = url_path[:-5]
    # If page.url is the homepage, after the rstrip, it becomes ""
    if not url_path:
        url_path = "index"
    md_output_path = os.path.join(site_dir, url_path + ".md")
    parent_dir = os.path.dirname(md_output_path)
    if parent_dir:
        os.makedirs(parent_dir, exist_ok=True)
    with open(md_output_path, "w", encoding="utf-8") as f:
        frontmatter = _raw_frontmatter(page.file.abs_src_path)
        if frontmatter:
            f.write(frontmatter)
            if not markdown.startswith("\n"):
                f.write("\n")
        f.write(markdown)
    return markdown
