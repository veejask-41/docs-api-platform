/**
 * Copyright (c) 2023-2025, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/*
 * Run `fn` on first load and after every instant-loading navigation.
 *
 * Material exposes `document$`, an RxJS subject that emits the new document
 * after each instant-loading swap. `DOMContentLoaded` fires only once, so any
 * handler bound to it silently stops running after the first soft navigation.
 * Falls back to DOMContentLoaded when instant loading is off or the bundle has
 * not defined document$ yet.
 */
function onDocument(fn) {
  if (typeof window.document$ !== 'undefined' && window.document$ &&
      typeof window.document$.subscribe === 'function') {
    window.document$.subscribe(function () { fn(); });
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn);
  } else {
    fn();
  }
}

/*
 * Instant loading replaces [data-md-component=container], and the primary
 * sidebar lives inside it (material/base.html), so the sidebar DOM is rebuilt
 * on every soft navigation and loses its scroll offset and expanded sections.
 * Capture both just before the swap and reapply them just after, so the
 * sidebar appears untouched.
 */
(function () {
  if (typeof window.document$ === 'undefined' || !window.document$) return;

  var saved = null;
  // One-shot gate: only apply `saved` to the single document$ emission caused
  // by the sidebar click that produced it. Without this, a later navigation
  // that document$ also reports -- browser back/forward, or a click on an
  // in-content link -- would silently reapply the same stale scroll/expansion
  // state, which is worse than not restoring at all.
  var pendingRestore = false;

  // Index of the top-level nav section the reader is currently inside. Used
  // to tell whether the reader stayed within the same product section or
  // jumped to a different one.
  //
  // "Not pruned" is NOT a usable test here: childless top-level pages (e.g.
  // Overview, Get Started) are never pruned either, since pruning only
  // applies to sections that have children (nav-item.html:150). So the first
  // non-pruned item is almost always one of those childless pages, at a
  // fixed low index (0 or 1) on every page regardless of which product
  // section is active -- verified live: AI Gateway and Cloud pages both
  // produced index 0 under that test. The one server-side marker that
  // actually singles out the active section is `md-nav__item--active`,
  // applied only to the top-level item the current page lives under
  // (nav-item.html:77-79); a nav subtree (nested `ul.md-nav__list`) is kept
  // as a fallback since only that same active section is ever rendered with
  // one.
  function activeSectionIndex() {
    var items = document.querySelectorAll('.md-nav--primary > .md-nav__list > .md-nav__item');
    for (var i = 0; i < items.length; i++) {
      if (items[i].className.indexOf('md-nav__item--active') !== -1) return i;
    }
    for (var j = 0; j < items.length; j++) {
      if (items[j].querySelector('.md-nav__list')) return j;
    }
    return -1;
  }

  function capture() {
    var wrap = document.querySelector('.md-sidebar--primary .md-sidebar__scrollwrap');
    if (!wrap) return;
    var open = [];
    document.querySelectorAll('.md-nav--primary input.md-nav__toggle').forEach(function (t) {
      if (t.checked && t.id) open.push(t.id);
    });
    saved = { scrollTop: wrap.scrollTop, open: open, sectionIndex: activeSectionIndex() };
    pendingRestore = true;
  }

  function restore() {
    // Consume the gate immediately: whether or not there is anything usable
    // to restore, this document$ emission must not leave a stale `saved`
    // available for a later, unrelated emission (e.g. a subsequent
    // back-button navigation) to pick up.
    var doRestore = pendingRestore;
    pendingRestore = false;
    if (!doRestore || !saved) return;
    var wrap = document.querySelector('.md-sidebar--primary .md-sidebar__scrollwrap');
    if (!wrap) return;
    // Re-open what the reader had open, on top of the server's active chain.
    // Ids belonging to a now-pruned section simply don't exist in the new
    // document, so getElementById returns null and this is a no-op for them.
    saved.open.forEach(function (id) {
      var t = document.getElementById(id);
      if (t && t.classList.contains('md-nav__toggle')) t.checked = true;
    });
    // Only carry the scroll offset over when the reader is still inside the
    // same top-level product section. Across a product change the sidebar's
    // whole shape is different (a new section expands, the old one prunes to
    // a single link), so an old pixel offset has no meaningful destination --
    // restoring it would scroll the reader somewhere arbitrary rather than
    // somewhere they recognize.
    if (saved.sectionIndex === -1 || saved.sectionIndex !== activeSectionIndex()) return;
    // Toggling checkboxes changes the sidebar's scroll height, so the offset
    // can only be applied once layout has settled. Setting it in the same
    // frame lands the reader at the wrong place, or at 0 on a short sidebar.
    //
    // requestAnimationFrame is the correct way to wait for that -- it runs
    // right before the next paint, once layout has settled -- but a hidden
    // or occluded tab (including some automated test environments) can defer
    // rAF indefinitely, silently dropping the restore. A setTimeout(fn, 0)
    // macrotask settles layout just as well (proven against this exact
    // capture/restore pair: a scrollTop of 320 landed exactly via a
    // macrotask) and always fires regardless of tab visibility, so it runs
    // as a fallback. A one-shot guard makes sure only whichever of the two
    // fires first actually applies the offset; the other becomes a no-op.
    var applied = false;
    function applyScroll() {
      if (applied) return;
      applied = true;
      wrap.scrollTop = saved.scrollTop;
    }
    requestAnimationFrame(applyScroll);
    setTimeout(applyScroll, 0);
  }

  // Capture on click, before the swap; restore after each new document.
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('.md-nav--primary a')) capture();
  }, true);

  window.document$.subscribe(function () { restore(); });
})();

// Initialize version dropdown
function initVersionDropdown() {
  const dropdown = document.querySelector('.md-header__version-select-dropdown');
  
  if (dropdown) {
    // Add a click event listener to the dropdown link
    const dropdownLink = dropdown.querySelector('.dropdown-link');

    if (dropdownLink) {
      // Remove any existing event listeners by cloning
      const newDropdownLink = dropdownLink.cloneNode(true);
      dropdownLink.parentNode.replaceChild(newDropdownLink, dropdownLink);
      
      newDropdownLink.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        dropdown.classList.toggle('open');
      });
    }

    // Add a click event listener to close dropdown when clicking outside
    document.addEventListener('click', function(event) {
      if (!dropdown.contains(event.target)) {
        dropdown.classList.remove('open');
      }
    });
  }
}

// Run on every document ready - single initialization only
if (typeof window.versionDropdownInitialized === 'undefined') window.versionDropdownInitialized = false;
onDocument(function () {
  if (!window.versionDropdownInitialized) {
    initVersionDropdown();
    window.versionDropdownInitialized = true;
  }
});

// Wrap tabbed content and nav items
onDocument(function () {
  // Add a class to content tabs that has multiple child elements rather than a code block
  document.querySelectorAll('.tabbed-content').forEach(tabbedContent => {
    const tabbedBlocks = Array.from(tabbedContent.querySelectorAll('.tabbed-block'));

    // Check if each .tabbed-block has more than 1 child or if its immediate child is not .highlight
    const shouldAddClass = tabbedBlocks.some(tabbedBlock => 
      tabbedBlock.children.length > 1 || !tabbedBlock.firstElementChild.classList.contains('highlight')
    );

    if (shouldAddClass) {
      tabbedContent.classList.add('tab_with_no_code');
    }
  });

  // Toggle active state of nested nav items
  const activeNavItems = document.querySelectorAll('.md-nav__list > .md-nav__item.md-nav__item--active.md-nav__item--nested');

  if (activeNavItems) {
    activeNavItems.forEach((item) => {
      const checkbox = item.querySelector('input[type="checkbox"].md-nav__toggle.md-toggle');

      if (checkbox) {
        checkbox.checked = true;
      }
    });
  }

  // Menu items expand/collapse independently: expanding one item no longer
  // collapses its siblings. Each item stays open until the user collapses it.
});

/*
 * Handle opening external links in a new tab
 * and initialize JSON tree formatter
 */
onDocument(function () {
  // Open external links in new tab
  var links = document.links;
  for (var i = 0, linksLength = links.length; i < linksLength; i++) {
    if (links[i].hostname != window.location.hostname) {
      links[i].target = "_blank";
      links[i].setAttribute("rel", "noopener noreferrer");
      links[i].classList.add("externalLink");
    } else {
      links[i].classList.add("localLink");
    }
  }
  
  // Initialize JSON tree formatter
  var jsonTreeInputs = document.getElementsByClassName('jsonTreeInput');
  if (jsonTreeInputs && jsonTreeInputs.length > 0) {
    for (var i = 0; i < jsonTreeInputs.length; i++) {
      try {
        var jsonTreeInput = jsonTreeInputs[i];
        var jsonTreeOutput = jsonTreeInput.previousElementSibling;
        var level = jsonTreeInput.getAttribute('data-level');
        var levelInteger = level ? parseInt(level) : 1;
        var formatter = new JSONFormatter(JSON.parse(jsonTreeInput.innerHTML), levelInteger, { hoverPreviewEnabled: false });
        jsonTreeOutput.innerHTML = '';
        jsonTreeOutput.appendChild(formatter.render());
        jsonTreeInput.style.display = 'none';
      } catch (e) {
        console.error(e);
      }
    }
  }
});

// Set last visited valid page in session storage
onDocument(function () {
  // Check if the server indicated this page is valid
  const isPageValid = document.documentElement.getAttribute("data-page-valid") === "true";
  
  if (isPageValid) {
    sessionStorage.setItem("lastValidPage", window.location.href);
  }
});

/*
 * Reading versions
 * -------------------------------------------------------------------------
 * NOTE: this block's target DOM -- #version-select-dropdown,
 * #current-version-stable, .md-header__version-select-dropdown -- exists
 * nowhere in en/theme/ or the built site. initVersionDropdown() (above), its
 * latch, and applyVersionsData() below are therefore all unreachable in this
 * theme. Left in place rather than deleted -- removing it is a larger scope
 * decision than this fix covers.
 *
 * Writes both header content (#version-select-dropdown, survives an instant
 * swap) and versions-page content (#current-version-stable and friends,
 * replaced on every swap). It must therefore re-run on every navigation so
 * the versions page populates when reached by a soft navigation. The
 * versions.json XMLHttpRequest itself must not repeat on every navigation,
 * though: a successful response is memoised in the module-level versionsData
 * and re-applied from cache on a later page instead of being re-fetched, and
 * a failed attempt (network error, or the 404 this endpoint actually returns
 * here) is likewise latched in versionsLoadFailed -- a failure has no data to
 * reapply, so retrying it on every soft navigation would only repeat the same
 * console error forever, which is what this block used to do before this
 * flag was added. versionsRequestPending guards the moment between issuing
 * the request and it resolving, since this page loads theme.js twice (once
 * in <head>, before document$ exists, and once again in the footer, after it
 * does) which can otherwise call this handler twice in quick succession on a
 * cold load, before the first request has resolved.
 */
var versionsData = null;
var versionsRequestPending = false;
var versionsLoadFailed = false;

// Apply a parsed versions.json payload to whichever elements are present on
// the current page: the header's version dropdown, the versions-page tables,
// or both. Called both right after a fresh fetch and, on a later navigation,
// with the memoised versionsData.
function applyVersionsData(data, docSetUrl) {
  var dropdown = document.getElementById('version-select-dropdown');
  var checkVersionsPage = document.getElementById('current-version-stable');

  /*
   * Appending versions to the version selector dropdown
   */
  if (dropdown) {
      data.list.sort().forEach(function(key, index){
          var versionData = data.all[key];

          if(versionData) {
              var liElem = document.createElement('li');
              var docLinkType = data.all[key].doc.split(':')[0];
              var target = '_self';
              var url = data.all[key].doc;

              if ((docLinkType == 'https') || (docLinkType == 'http')) {
                  target = '_blank'
              }
              else {
                  url = docSetUrl + url;
              }
              var anchor = document.createElement('a');

              anchor.setAttribute('href', url);
              anchor.setAttribute('target', target);
              anchor.textContent = key;

              liElem.appendChild(anchor);

              dropdown.insertBefore(liElem, dropdown.firstChild);
          }
      });

      document.getElementById('show-all-versions-link')
          .setAttribute('href', docSetUrl + 'versions');
  }

  /*
   * Appending versions to the version tables in versions page
   */
  if (checkVersionsPage) {
      var previousVersions = [];

      Object.keys(data.all).forEach(function(key, index){
          if ((key !== data.current) && (key !== data['pre-release'])) {
              var docLinkType = data.all[key].doc.split(':')[0];
              var target = '_self';

              if ((docLinkType == 'https') || (docLinkType == 'http')) {
                  target = '_blank'
              }

              previousVersions.push('<tr>' +
                '<th>' + key + '</th>' +
                    '<td>' +
                        '<a href="' + data.all[key].doc + '" target="' +
                            target + '">Documentation</a>' +
                    '</td>' +
                    '<td>' +
                        '<a href="' + data.all[key].notes + '" target="' +
                            target + '">Release Notes</a>' +
                    '</td>' +
                '</tr>');
          }
      });

      // --- Past releases update ---
      var prevEl = document.getElementById('previous-versions');
      if (prevEl) {
        prevEl.innerHTML = previousVersions.join(' ');
      }

      // --- Current released version update ---
      var currentNum = document.getElementById('current-version-number');
      if (currentNum) {
        currentNum.textContent = data.current; // safer than innerHTML
      }

      var docLink = document.getElementById('current-version-documentation-link');
      if (docLink) {
        docLink.setAttribute('href', docSetUrl + data.all[data.current].doc);
      }

      var notesLink = document.getElementById('current-version-release-notes-link');
      if (notesLink) {
        notesLink.setAttribute('href', docSetUrl + data.all[data.current].notes);
      }

      // --- Pre-release version update ---
      var preRelLink = document.getElementById('pre-release-version-documentation-link');
      if (preRelLink) {
        preRelLink.setAttribute('href', docSetUrl + 'next/');
      }
  }
}

onDocument(function () {
  var pageHeader = document.getElementById('page-header');
  if (!pageHeader) return;
  var docSetLang = pageHeader.getAttribute('data-lang') == null ? 'en' : pageHeader.getAttribute('data-lang');

  if (window.location.pathname.split('/')[1] !== docSetLang) {
    docSetLang = '';
  } else {
    docSetLang = docSetLang + '/';
  }

  var docSetUrl = window.location.origin + '/' + docSetLang;

  // Already have the data from an earlier navigation: re-apply it to this
  // page's DOM without re-fetching versions.json.
  if (versionsData) {
    applyVersionsData(versionsData, docSetUrl);
    return;
  }

  // A previous attempt already failed this session (see the header comment
  // above -- versions.json 404s in this theme): a single failed attempt is
  // enough, don't repeat the request on every soft navigation.
  if (versionsLoadFailed) return;

  // A request is already in flight (see the header comment above about
  // theme.js loading twice on a cold load): don't issue a second one.
  if (versionsRequestPending) return;
  versionsRequestPending = true;

  // Try to load from local first, fallback to remote
  var versionsUrl = docSetUrl + 'versions/assets/versions.json';

  var request = new XMLHttpRequest();

  request.open('GET', versionsUrl, true);

  // Add error handler
  request.onerror = function() {
    versionsRequestPending = false;
    versionsLoadFailed = true;
    console.error("Failed to load versions.json. CORS or network error.");
    // For development, you can add mock data here
    console.log("You can create a local versions.json file at: /en/versions/assets/versions.json");
  };

  request.onload = function() {
    versionsRequestPending = false;
    if (request.status >= 200 && request.status < 400) {
      var data;
      try {
        data = JSON.parse(request.responseText);
      } catch (e) {
        versionsLoadFailed = true;
        console.error("Failed to parse versions.json:", e);
        return;
      }
      versionsData = data;
      applyVersionsData(data, docSetUrl);
    } else {
      versionsLoadFailed = true;
      console.error("We reached our target server, but it returned an error");
    }
  };

  request.send();
});

// Lazily fetch the build-time version index (assets/version-index.json, see
// hooks.py). Shared across the per-section versioned nav below and the
// search breadcrumbs' version-scoping fallback further down, so the file
// only ever issues one fetch for it and both call sites see the same data.
// Memoised for the lifetime of the page load; never needed on the critical
// path of a normal page view.
//
// versionIndexData caches the parsed *payload* -- a network result, safe to
// reuse for every page for the rest of the session. It deliberately does NOT
// cache anything resolved from it (e.g. which version is "active"): that
// depends on the current URL/localStorage/DOM and can change every
// navigation. See getActiveVersions() below for why conflating the two was a
// bug (residual of Important 2).
var versionIndexPromise = null;
var versionIndexData = null;
function loadVersionIndex() {
  if (!versionIndexPromise) {
    var scope = window.__md_scope ||
      (document.querySelector('base')
        ? new URL(document.querySelector('base').href)
        : new URL('/', location));
    versionIndexPromise = fetch(new URL('assets/version-index.json', scope).href)
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (data) { versionIndexData = data; return data; })
      .catch(function () { versionIndexData = {}; return versionIndexData; });
  }
  return versionIndexPromise;
}

/*
 * Per-section versioned navigation
 * -------------------------------------------------------------------------
 * Sections configured under `extra.versioned_sections` in mkdocs.yml render a
 * version <select> plus one `.md-nav__version-group[data-md-version]` per
 * version (see partials/nav-item.html). Here we:
 *   1. Resolve the active version (URL segment > localStorage > default).
 *   2. Show only the active version's group.
 *   3. On change, keep the user on the equivalent page under the new version,
 *      falling back to that version's overview when it does not exist.
 *
 * The section markup (.md-nav__item--versioned and its groups) lives inside
 * the sidebar, which an instant-loading swap replaces on every navigation, so
 * this must re-run on every document$ emission rather than latch to once.
 */
onDocument(function () {
  // Version-scoped root nav sections (extra.version_scoped_navs): rendered
  // hidden (see nav-item.html / _version-select.css), revealed while the
  // current URL contains the matching version as a path segment — e.g.
  // Developer Portal and AI Workspace appear at root level on /next/... and
  // /api-gateway/next/... pages.
  var pathSegments = window.location.pathname.split('/').filter(Boolean);
  document.querySelectorAll('.md-nav--primary [data-md-scoped-version]').forEach(function (el) {
    var visible = pathSegments.indexOf(el.getAttribute('data-md-scoped-version')) !== -1;
    el.classList.toggle('md-nav__scoped--visible', visible);
  });

  document.querySelectorAll('.md-nav__item--versioned').forEach(function (section) {
    var slug = section.getAttribute('data-md-versioned-section');
    var defaultVersion = section.getAttribute('data-md-default-version');
    var select = section.querySelector('.md-nav__version-dropdown');
    var groups = Array.prototype.slice.call(
      section.querySelectorAll('.md-nav__version-group')
    );
    if (!slug || !select || groups.length === 0) return;

    var storageKey = 'docVersion:' + slug;

    // Available version values, in configured order. Read from the section
    // attribute rather than the rendered groups: only the active group is
    // rendered, so the group list is not the version list.
    var versionsAttr = section.getAttribute('data-md-versions') || '';
    var versions = versionsAttr
      ? versionsAttr.split(',')
      : groups.map(function (g) { return g.getAttribute('data-md-version'); });

    // Resolve the active version: URL path segment wins, then stored
    // preference, then the configured default.
    function versionFromPath() {
      // Match ".../<slug>/<version>/..." anywhere in the path.
      var parts = window.location.pathname.split('/').filter(Boolean);
      var idx = parts.lastIndexOf(slug);
      if (idx !== -1 && idx + 1 < parts.length) {
        var candidate = parts[idx + 1];
        if (versions.indexOf(candidate) !== -1) return candidate;
      }
      return null;
    }

    var stored = null;
    try {
      stored = window.localStorage.getItem(storageKey);
    } catch (e) {
      stored = null;
    }

    // The server renders exactly one group per section and names it here.
    // That rendered version is the single source of truth: it is what the
    // reader is actually looking at, so the dropdown and search scoping must
    // agree with it rather than with a URL/localStorage/default guess that
    // can now disagree with the DOM (e.g. a stored preference on a
    // non-versioned page, where the server has no URL hint and renders the
    // configured default). Fall back to the old resolution order only if the
    // attribute is missing.
    var renderedVersion = section.getAttribute('data-md-active-version');
    var active =
      (renderedVersion && versions.indexOf(renderedVersion) !== -1 ? renderedVersion : null) ||
      versionFromPath() ||
      (versions.indexOf(stored) !== -1 ? stored : null) ||
      (versions.indexOf(defaultVersion) !== -1 ? defaultVersion : versions[0]);

    function showVersion(version) {
      // Only the active version's group is rendered server-side. Never
      // deactivate a group that has no sibling, or the section's subtopics
      // vanish (this happens on non-versioned pages where localStorage holds
      // a different version than the one the server rendered).
      if (groups.length > 1) {
        groups.forEach(function (g) {
          g.classList.toggle('is-active', g.getAttribute('data-md-version') === version);
        });
      } else if (groups.length === 1) {
        groups[0].classList.add('is-active');
      }
      // A version can be active without being offered in the dropdown (e.g.
      // "next" exists in the nav but is reachable only by URL). Append it
      // under its own group so the select reflects the active version
      // instead of going blank, and so the user can switch back to a
      // released version.
      if (!select.querySelector('option[value="' + version + '"]')) {
        var unreleasedGroup = select.querySelector('optgroup[label="Unreleased"]');
        if (!unreleasedGroup) {
          unreleasedGroup = document.createElement('optgroup');
          unreleasedGroup.label = 'Unreleased';
          select.appendChild(unreleasedGroup);
        }
        var option = document.createElement('option');
        option.value = version;
        option.textContent = version;
        unreleasedGroup.appendChild(option);
      }
      if (select.value !== version) select.value = version;
      // Do not persist here: showVersion() runs on every page load (to sync
      // the dropdown/groups to the rendered version), not only on an
      // explicit reader choice. Persisting unconditionally would silently
      // overwrite a stored preference with the server-rendered default the
      // moment the reader views a non-versioned page. The dropdown's
      // 'change' handler below is the only place that writes localStorage,
      // since that is the reader's actual choice.
    }

    showVersion(active);

    // Collect the set of page paths available in a given version's group, plus
    // that version's overview (first link) as the fallback target.
    function groupForVersion(version) {
      return groups.filter(function (g) {
        return g.getAttribute('data-md-version') === version;
      })[0];
    }

    function pathTailAfterVersion(pathname, version) {
      // Returns the part of the path after "<slug>/<version>/", or null.
      var marker = '/' + slug + '/' + version + '/';
      var i = pathname.indexOf(marker);
      if (i === -1) return null;
      return pathname.slice(i + marker.length);
    }

    select.addEventListener('change', function () {
      var target = select.value;
      var current = versionFromPath();
      var tail = current ? pathTailAfterVersion(window.location.pathname, current) : null;
      if (tail === null) tail = '';

      // Persist before navigating so the new page restores the same version.
      try {
        window.localStorage.setItem(storageKey, target);
      } catch (e) {
        /* ignore */
      }

      var scope = window.__md_scope ||
        (document.querySelector('base')
          ? new URL(document.querySelector('base').href)
          : new URL('/', location));

      loadVersionIndex().then(function (index) {
        var entry = index[slug];
        var pages = (entry && entry.pages && entry.pages[target]) || [];
        // No page data for this version (index fetch failed or the slug/
        // version is missing from it): don't guess a "<slug>/<target>/" URL,
        // since unlike a real page tail that root is not guaranteed to
        // exist. Just reflect the selection, mirroring the previous
        // behaviour when a version's rendered group had no links.
        if (pages.length === 0) {
          showVersion(target);
          return;
        }
        // Same page under the new version when it exists, else that version's
        // first page (its overview) — mirrors the previous DOM-based fallback.
        var chosen = pages.indexOf(tail) !== -1 ? tail : (pages[0] || '');
        window.location.href =
          new URL(slug + '/' + target + '/' + chosen, scope).href;
      });
    });
  });
});

/*
 * Search result breadcrumbs + version scoping
 * -------------------------------------------------------------------------
 * Across products / versions many pages share a title ("Overview", "Regex
 * Guardrail", ...). Material's search results show only the title, so results
 * are ambiguous and (because every version is indexed) the same page appears
 * once per version. We:
 *   1. Load a URL -> breadcrumb map produced at build time
 *      (assets/search-breadcrumbs.json, see hooks.py) and inject the breadcrumb
 *      (e.g. "AI Gateway › 1.1.0 › LLM Proxy › Guardrails") under each result.
 *   2. Hide results from a NON-active version of a versioned product, so a user
 *      who selected 1.0.0 only sees 1.0.0 hits (plus non-versioned results such
 *      as Cloud / Guides). Active version is resolved exactly like the nav
 *      selector: URL segment > localStorage > configured default.
 *
 * getActiveVersions() reads `.md-nav__item--versioned` DOM (populated by
 * nav-item.html only for the section the reader is currently inside; Task 5
 * prunes every other level-1 section to a plain link with no data-md-*
 * attributes at all). A page outside any versioned product -- or inside one,
 * viewing a different product's results -- therefore has none of that DOM
 * for some or all slugs, and falls back to the build-time version index
 * instead (see getActiveVersions()).
 *
 * Nothing about *which version is active* is cached across calls -- only the
 * fetched version-index.json payload is (see loadVersionIndex() above). An
 * earlier version of this fix memoised the resolved active-version map
 * itself; that let a fallback resolution computed while no versioned `<li>`
 * was in the DOM (URL/localStorage-derived) outlive the DOM actually
 * appearing on a later decorate() pass, hiding the reader's own rendered
 * version and showing a stale one instead. The rendered DOM must always win
 * over a stored preference when both exist (ruling R16 on this branch), so
 * every getActiveVersions() call re-checks the DOM first, from scratch.
 */

// Resolve the active version for `slug` the same way the nav selector does,
// minus the rendered-DOM step (there's no DOM to read here): URL path
// segment, then localStorage, then the configured default.
function resolveActiveVersionFromIndex(slug, versions, def) {
  var parts = window.location.pathname.split('/').filter(Boolean);
  var idx = parts.lastIndexOf(slug);
  if (idx !== -1 && idx + 1 < parts.length && versions.indexOf(parts[idx + 1]) !== -1) {
    return parts[idx + 1];
  }
  try {
    var stored = window.localStorage.getItem('docVersion:' + slug);
    if (versions.indexOf(stored) !== -1) return stored;
  } catch (e) { /* ignore */ }
  return versions.indexOf(def) !== -1 ? def : versions[0];
}

// Build the { slug: { active, versions } } map straight from a fetched
// version-index.json payload, for pages with no versioned nav DOM to read.
function resolveActiveVersionsFromIndex(index) {
  var resolved = {};
  Object.keys(index).forEach(function (slug) {
    var entry = index[slug] || {};
    var versions = entry.versions || [];
    resolved[slug] = {
      active: resolveActiveVersionFromIndex(slug, versions, entry.default),
      versions: versions
    };
  });
  return resolved;
}

if (typeof window.searchBreadcrumbsInitialized === 'undefined') window.searchBreadcrumbsInitialized = false;
onDocument(function () {
  if (window.searchBreadcrumbsInitialized) return;
  window.searchBreadcrumbsInitialized = true;

  var output = document.querySelector('[data-md-component="search-result"]');
  if (!output) return;

  // Material exposes the site root as an absolute URL in `window.__md_scope`
  // (set on every page, e.g. https://host/bijira/docs/). Use it to build the
  // fetch URL and to turn a result's pathname into a build-time breadcrumb key.
  // Fall back to a <base> tag, then the server root.
  var scope = window.__md_scope ||
    (document.querySelector('base') ? new URL(document.querySelector('base').href) : new URL('/', location));
  var basePath = scope.pathname;
  if (basePath.charAt(basePath.length - 1) !== '/') basePath += '/';

  var breadcrumbs = null;
  var pending = false;

  // Resolve, per versioned product (slug), which version is "active" for this
  // page. Reads the global versioned-nav DOM, mirroring the nav selector
  // logic, when that DOM exists on this page; falls back to the build-time
  // version index otherwise (see the block comment above).
  function getActiveVersions() {
    // Re-checked from scratch on every call -- see the block comment above
    // for why the resolved map itself must never be cached across calls.
    var sections = document.querySelectorAll('.md-nav__item--versioned');
    if (sections.length === 0) {
      // Nothing rendered on this page for any versioned product (see the
      // block comment above). Fall back to assets/version-index.json
      // (hooks.py), which knows every slug's versions and default
      // regardless of which page is currently on screen.
      if (versionIndexData) {
        // Already fetched (this session or an earlier call on this page):
        // resolve synchronously so this decorate() pass is accurate now.
        return resolveActiveVersionsFromIndex(versionIndexData);
      }
      // Not fetched yet: kick off (or reuse) the request and redecorate once
      // it resolves. This call returns {} -- nothing hidden this round --
      // rather than block; by the time the fetch settles, a versioned `<li>`
      // may since have appeared on screen too, in which case the redecorate
      // triggered here takes the DOM branch instead and this fetch's result
      // is simply unused for that pass.
      loadVersionIndex().then(function () { decorate(); });
      return {};
    }
    var activeVersions = {};
    sections.forEach(function (section) {
      var slug = section.getAttribute('data-md-versioned-section');
      var def = section.getAttribute('data-md-default-version');
      if (!slug) return;
      // Read the full version list from the section attribute; only the active
      // version's group is rendered, so walking groups would see just one.
      var attr = section.getAttribute('data-md-versions') || '';
      var versions = attr ? attr.split(',') : [];
      if (!versions.length) {
        section.querySelectorAll('.md-nav__version-group').forEach(function (g) {
          var v = g.getAttribute('data-md-version');
          if (v) versions.push(v);
        });
      }
      // The rendered version is authoritative (see the nav selector's
      // identical resolution above): it is the version whose links are
      // actually in the sidebar, so search scoping must filter for that,
      // not for a URL/localStorage/default guess that can disagree with it.
      var active = null;
      var rendered = section.getAttribute('data-md-active-version');
      if (rendered && versions.indexOf(rendered) !== -1) active = rendered;
      if (!active) {
        var parts = window.location.pathname.split('/').filter(Boolean);
        var idx = parts.lastIndexOf(slug);
        if (idx !== -1 && idx + 1 < parts.length && versions.indexOf(parts[idx + 1]) !== -1) {
          active = parts[idx + 1];
        }
      }
      if (!active) {
        try {
          var s = window.localStorage.getItem('docVersion:' + slug);
          if (versions.indexOf(s) !== -1) active = s;
        } catch (e) { /* ignore */ }
      }
      if (!active) active = versions.indexOf(def) !== -1 ? def : versions[0];
      activeVersions[slug] = { active: active, versions: versions };
    });
    return activeVersions;
  }

  function keyForHref(href) {
    var path;
    try {
      path = new URL(href, scope).pathname;
    } catch (e) {
      return null;
    }
    // Strip the base path prefix to match the JSON keys (relative page URLs).
    if (basePath !== '/' && path.indexOf(basePath) === 0) {
      path = path.slice(basePath.length);
    } else {
      path = path.replace(/^\//, '');
    }
    if (path && path.charAt(path.length - 1) !== '/') path += '/';
    return path;
  }

  // Version values used by version-scoped doc sets (extra.version_scoped_navs),
  // whose pages live under "<version>/..." (e.g. next/ai-workspace/...).
  var scopedVersions = null;
  function getScopedVersions() {
    if (scopedVersions) return scopedVersions;
    scopedVersions = {};
    document.querySelectorAll('.md-nav--primary [data-md-scoped-version]').forEach(function (el) {
      scopedVersions[el.getAttribute('data-md-scoped-version')] = true;
    });
    return scopedVersions;
  }

  // True if the page key belongs to a non-active version (should be hidden).
  // `activeVersionsSnapshot` is resolved once per decorate() pass (see
  // below) rather than looked up per item -- getActiveVersions() itself is
  // no longer memoised across calls, so calling it once per pass instead of
  // once per result avoids re-scanning the DOM for every search hit.
  function isHiddenVersion(key, activeVersionsSnapshot) {
    if (!key) return false;
    var parts = key.split('/');
    if (parts.length < 2) return false;
    // Version-scoped doc sets: hide unless that version is in the current URL
    // (mirrors the nav visibility rule for these sections).
    if (getScopedVersions()[parts[0]]) {
      return window.location.pathname.split('/').indexOf(parts[0]) === -1;
    }
    var cfg = activeVersionsSnapshot[parts[0]];
    if (!cfg) return false;
    if (cfg.versions.indexOf(parts[1]) === -1) return false; // not a version segment
    return parts[1] !== cfg.active;
  }

  function decorate() {
    if (!breadcrumbs) return;
    var items = output.querySelectorAll('.md-search-result__item');
    var visible = 0;
    // Resolved fresh for this pass -- see getActiveVersions() and the block
    // comment above it for why this must never be cached across passes.
    var activeVersionsSnapshot = getActiveVersions();
    items.forEach(function (item) {
      var link = item.querySelector('.md-search-result__link');
      if (!link) return;
      var key = keyForHref(link.getAttribute('href') || link.href);

      // 1. Version scoping: hide results from non-active versions.
      var hide = isHiddenVersion(key, activeVersionsSnapshot);
      item.style.display = hide ? 'none' : '';
      if (!hide) visible++;

      // 2. Breadcrumb: inject once, under the document-level result title.
      if (!item.querySelector('.md-search-result__breadcrumbs')) {
        var crumbs = key && breadcrumbs[key];
        if (crumbs && crumbs.length) {
          var el = document.createElement('div');
          el.className = 'md-search-result__breadcrumbs';
          el.textContent = crumbs.join(' › '); // " > "
          var title = link.querySelector('.md-search-result__title');
          if (title && title.parentNode) {
            title.parentNode.insertBefore(el, title.nextSibling);
          } else {
            link.insertBefore(el, link.firstChild);
          }
        }
      }
    });

    // Keep the "N matching documents" meta count honest about what's shown.
    // Idempotent: only writes when the number actually changes (loop-safe).
    var meta = output.querySelector('.md-search-result__meta');
    if (meta && items.length && /\d/.test(meta.textContent)) {
      var desired = meta.textContent.replace(/\d[\d,]*/, String(visible));
      if (meta.textContent !== desired) meta.textContent = desired;
    }
  }

  function ensureLoadedThenDecorate() {
    if (breadcrumbs) {
      decorate();
      return;
    }
    if (pending) return;
    pending = true;
    var url = new URL('assets/search-breadcrumbs.json', scope).href;
    fetch(url)
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (data) { breadcrumbs = data; decorate(); })
      .catch(function () { breadcrumbs = {}; });
  }

  // Results are rendered asynchronously and re-rendered on each keystroke, so
  // observe the output container and (re)decorate whenever it changes.
  var observer = new MutationObserver(function () { ensureLoadedThenDecorate(); });
  observer.observe(output, { childList: true, subtree: true });
});

