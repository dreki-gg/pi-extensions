import { w as mt, D as ssr, p as escape, f as createComponent, S as Show, H as ssrHydrationKey, F as For, s as ht } from '../nitro/nitro.mjs';
import { A } from './components-u6vAPa9_2.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:async_hooks';
import 'node:url';

var h = ["<div", ' class="error-banner">', "</div>"], m = ["<div", ' class="pr-list">', "</div>"], g = ["<div", ' class="dashboard"><!--$-->', '<!--/--><header class="dashboard-header"><h1>PR Canvas</h1><p class="dashboard-subtitle">Select a Pull Request to review</p></header><!--$-->', "<!--/--><!--$-->", "<!--/--></div>"], v = ["<div", ' class="pr-card-header"><span class="pr-number">#<!--$-->', '<!--/--></span><span class="', '">', "</span></div>"], $ = ["<h3", ' class="pr-title">', "</h3>"], f = ["<span", ' class="pr-date">', "</span>"], b = ["<div", ' class="pr-card-meta"><span class="pr-author">\u{1F464} <!--$-->', '<!--/--></span><span class="pr-stats"><span class="stat-add">+<!--$-->', '<!--/--></span> <span class="stat-del">\u2212<!--$-->', "<!--/--></span></span><!--$-->", "<!--/--></div>"], w = ["<div", ' class="loading-state"><div class="spinner"></div><p>Loading pull requests...</p></div>'], _ = ["<div", ` class="empty-state"><p>No open pull requests found.</p><p class="empty-hint">Make sure you're in a Git repository with open PRs.</p></div>`];
function q() {
  const { store: n, loadPrList: d } = mt();
  return ssr(g, ssrHydrationKey(), escape(createComponent(ht, { children: "PR Canvas" })), escape(createComponent(Show, { get when() {
    return n.error;
  }, get children() {
    return ssr(h, ssrHydrationKey(), escape(n.error));
  } })), escape(createComponent(Show, { get when() {
    return !n.loading;
  }, get fallback() {
    return createComponent(y, {});
  }, get children() {
    return createComponent(Show, { get when() {
      return n.prs.length > 0;
    }, get fallback() {
      return createComponent(P, {});
    }, get children() {
      return ssr(m, ssrHydrationKey(), escape(createComponent(For, { get each() {
        return n.prs;
      }, children: (t) => createComponent(A, { get href() {
        return `/pr/${t.number}`;
      }, class: "pr-card", get children() {
        return [ssr(v, ssrHydrationKey(), escape(t.number), `pr-state pr-state-${escape(t.state.toLowerCase(), true)}`, escape(t.state)), ssr($, ssrHydrationKey(), escape(t.title)), ssr(b, ssrHydrationKey(), escape(t.author.login), escape(t.additions), escape(t.deletions), escape(createComponent(Show, { get when() {
          return t.createdAt;
        }, get children() {
          return ssr(f, ssrHydrationKey(), escape(new Date(t.createdAt).toLocaleDateString()));
        } })))];
      } }) })));
    } });
  } })));
}
function y() {
  return ssr(w, ssrHydrationKey());
}
function P() {
  return ssr(_, ssrHydrationKey());
}

export { q as default };
//# sourceMappingURL=index2.mjs.map
