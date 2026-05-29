import { D as ssr, p as escape, f as createComponent, H as ssrHydrationKey, S as Show, F as For } from '../nitro/nitro.mjs';
import { m as mt, h as ht } from './context-VkJfzLEW.mjs';
import { u as u1, f as f1 } from './Icon-r-WyPaTQ.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:async_hooks';
import 'node:url';

var m = ["<div", ' class="error-banner">', "</div>"], g = ["<div", ' class="pr-list">', "</div>"], v = ["<div", ' class="dashboard"><!--$-->', '<!--/--><header class="dashboard-header"><h1>PR Canvas</h1><p class="dashboard-subtitle">Select a Pull Request to review</p></header><!--$-->', "<!--/--><!--$-->", "<!--/--></div>"], $ = ["<div", ' class="pr-card-header"><span class="pr-number">#<!--$-->', '<!--/--></span><span class="', '">', "</span></div>"], f = ["<h3", ' class="pr-title">', "</h3>"], b = ["<span", ' class="pr-date">', "</span>"], w = ["<div", ' class="pr-card-meta"><span class="pr-author"><!--$-->', "<!--/--> <!--$-->", '<!--/--></span><span class="pr-stats"><span class="stat-add">+<!--$-->', '<!--/--></span> <span class="stat-del">\u2212<!--$-->', "<!--/--></span></span><!--$-->", "<!--/--></div>"], _ = ["<div", ' class="loading-state"><div class="spinner"></div><p>Loading pull requests...</p></div>'], y = ["<div", ` class="empty-state"><p>No open pull requests found.</p><p class="empty-hint">Make sure you're in a Git repository with open PRs.</p></div>`];
function A() {
  const { store: n, loadPrList: i } = mt();
  return ssr(v, ssrHydrationKey(), escape(createComponent(ht, { children: "PR Canvas" })), escape(createComponent(Show, { get when() {
    return n.error;
  }, get children() {
    return ssr(m, ssrHydrationKey(), escape(n.error));
  } })), escape(createComponent(Show, { get when() {
    return !n.loading;
  }, get fallback() {
    return createComponent(P, {});
  }, get children() {
    return createComponent(Show, { get when() {
      return n.prs.length > 0;
    }, get fallback() {
      return createComponent(S, {});
    }, get children() {
      return ssr(g, ssrHydrationKey(), escape(createComponent(For, { get each() {
        return n.prs;
      }, children: (t) => createComponent(u1, { get href() {
        return `/pr/${t.number}`;
      }, class: "pr-card", get children() {
        return [ssr($, ssrHydrationKey(), escape(t.number), `state-pill state-${escape(t.state.toLowerCase(), true)}`, escape(t.state)), ssr(f, ssrHydrationKey(), escape(t.title)), ssr(w, ssrHydrationKey(), escape(createComponent(f1, { name: "user", size: 14 })), escape(t.author.login), escape(t.additions), escape(t.deletions), escape(createComponent(Show, { get when() {
          return t.createdAt;
        }, get children() {
          return ssr(b, ssrHydrationKey(), escape(new Date(t.createdAt).toLocaleDateString()));
        } })))];
      } }) })));
    } });
  } })));
}
function P() {
  return ssr(_, ssrHydrationKey());
}
function S() {
  return ssr(y, ssrHydrationKey());
}

export { A as default };
//# sourceMappingURL=index.mjs.map
