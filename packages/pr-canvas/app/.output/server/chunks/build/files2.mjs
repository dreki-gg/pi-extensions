import { o as ct, w as mt, l as createSignal, D as ssr, p as escape, f as createComponent, S as Show, H as ssrHydrationKey, s as ht, h as createEffect, y as on, E as ssrAttribute, F as For } from '../nitro/nitro.mjs';
import { d } from './ContextBar-CG7B5UuO2.mjs';
import { u as u1, f as f1 } from './Icon-BaqE27Xx2.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:async_hooks';
import 'node:url';

var D = ["<ul", ' class="file-change-list">', "</ul>"], L = ["<span", ' class="file-change-dir">', "</span>"], R = ["<span", ' class="stat-add">+<!--$-->', "<!--/--></span>"], T = ["<span", ' class="stat-del">\u2212<!--$-->', "<!--/--></span>"], x = ["<li", '><button type="button" class="', '"', '><span class="', '">', '</span><span class="file-change-path"><span class="file-change-name">', "</span><!--$-->", '<!--/--></span><span class="file-change-stats"><!--$-->', "<!--/--><!--$-->", "<!--/--></span></button></li>"];
const B = { added: "A", modified: "M", deleted: "D", renamed: "R" };
function N(a) {
  const e = a.lastIndexOf("/");
  return e === -1 ? { dir: "", name: a } : { dir: a.slice(0, e + 1), name: a.slice(e + 1) };
}
function I(a) {
  return ssr(D, ssrHydrationKey(), escape(createComponent(For, { get each() {
    return a.files;
  }, children: (e) => {
    const l = N(e.path);
    return ssr(x, ssrHydrationKey(), `file-change-row ${a.selected === e.path ? "file-change-row-active" : ""}`, ssrAttribute("aria-current", a.selected === e.path ? "true" : escape(void 0, true), false) + ssrAttribute("title", escape(e.path, true), false), `file-status file-status-${escape(e.status, true)}`, escape(B[e.status]), escape(l.name), escape(createComponent(Show, { get when() {
      return l.dir;
    }, get children() {
      return ssr(L, ssrHydrationKey(), escape(l.dir));
    } })), escape(createComponent(Show, { get when() {
      return e.additions > 0;
    }, get children() {
      return ssr(R, ssrHydrationKey(), escape(e.additions));
    } })), escape(createComponent(Show, { get when() {
      return e.deletions > 0;
    }, get children() {
      return ssr(T, ssrHydrationKey(), escape(e.deletions));
    } })));
  } })));
}
var q = ["<div", ' class="file-diff-panel"><div class="file-diff-toolbar"><span class="file-diff-current"', ">", '</span><button type="button" class="pierre-control-btn">', '</button></div><div class="file-diff-surface"></div></div>'];
function E(a) {
  const [e, l] = createSignal(/* @__PURE__ */ new Map()), [p, d] = createSignal(false), [u, m] = createSignal("unified");
  createEffect(on(() => a.rawDiff, async (i) => {
    if (!i) {
      l(/* @__PURE__ */ new Map());
      return;
    }
    const _ = (await import('../_/index.mjs')).parsePatchFiles(i), $ = /* @__PURE__ */ new Map();
    for (const P of _) for (const v of P.files) $.set(v.name, v);
    l($), d(true);
  }));
  async function o() {
  }
  return createEffect(on(() => [a.path, p(), u()], o)), ssr(q, ssrHydrationKey(), ssrAttribute("title", escape(a.path, true), false), escape(a.path || "Select a file"), u() === "unified" ? "Split view" : "Unified view");
}
var O = ["<div", ' class="files-page"><!--$-->', "<!--/--><!--$-->", '<!--/--><main class="files-main">', "</main></div>"], U = ["<aside", ' class="files-rail files-rail-empty"></aside>'], j = ["<span", ">Overview</span>"], z = ["<aside", ' class="files-rail"><!--$-->', '<!--/--><div class="files-rail-header"><h2 class="files-rail-title">Files changed</h2><span class="files-rail-count">', "</span></div><!--$-->", "<!--/--></aside>"], H = ["<div", ' class="files-empty">This pull request has no file changes.</div>'], K = ["<p", ">Can't reach the PR Canvas server.</p>"], G = ["<p", ' class="loading-hint">Make sure <code>/pr-canvas start</code> is running, then reload this page.</p>'], J = ["<div", ' class="loading-state">', "</div>"], Q = ["<div", ' class="spinner"></div>'], V = ["<p", ">Loading pull request...</p>"];
function ne() {
  const a = ct(), { store: e, loadPr: l, connectionStatus: p } = mt(), d$1 = () => Number(a.number), [u, m] = createSignal(""), o = () => e.currentPr && e.currentPr.number === d$1() ? e.currentPr : void 0;
  return ssr(O, ssrHydrationKey(), escape(createComponent(ht, { get children() {
    return ["Files \xB7 PR #", a.number];
  } })), escape(createComponent(Show, { get when() {
    return e.currentPr;
  }, get fallback() {
    return ssr(U, ssrHydrationKey());
  }, children: (i) => ssr(z, ssrHydrationKey(), escape(createComponent(u1, { get href() {
    return `/pr/${a.number}`;
  }, class: "sidebar-back", get children() {
    return [createComponent(f1, { name: "back", size: 16 }), ssr(j, ssrHydrationKey())];
  } })), escape(i().data.files.length), escape(createComponent(I, { get files() {
    return i().data.files;
  }, get selected() {
    return u();
  }, onSelect: m }))) })), escape(createComponent(Show, { get when() {
    return o();
  }, get fallback() {
    return createComponent(W, { get status() {
      return p();
    } });
  }, children: (i) => [createComponent(d, { get pr() {
    return i().data.overview;
  } }), createComponent(Show, { get when() {
    return i().data.files.length > 0;
  }, get fallback() {
    return ssr(H, ssrHydrationKey());
  }, get children() {
    return createComponent(E, { get rawDiff() {
      return i().rawDiff;
    }, get path() {
      return u();
    } });
  } })] })));
}
function W(a) {
  return ssr(J, ssrHydrationKey(), escape(createComponent(Show, { get when() {
    return a.status === "closed";
  }, get fallback() {
    return [ssr(Q, ssrHydrationKey()), ssr(V, ssrHydrationKey())];
  }, get children() {
    return [ssr(K, ssrHydrationKey()), ssr(G, ssrHydrationKey())];
  } })));
}

export { ne as default };
//# sourceMappingURL=files2.mjs.map
