import { o as ct, w as mt, D as ssr, p as escape, f as createComponent, S as Show, H as ssrHydrationKey, s as ht, l as createSignal, F as For, E as ssrAttribute, h as createEffect, y as on, I as ssrStyleProperty } from '../nitro/nitro.mjs';
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

var L = ["<aside", ' class="canvas-sidebar"><!--$-->', '<!--/--><nav class="sidebar-nav" aria-label="Pull request sections">', "</nav></aside>"], P = ["<button", ' type="button" class="', '"><span class="sidebar-nav-icon" aria-hidden="true">', '</span><span class="sidebar-nav-label">', "</span></button>"];
function M(t) {
  var _a, _b;
  const [s, c] = createSignal((_b = (_a = t.sections[0]) == null ? void 0 : _a.id) != null ? _b : "");
  return ssr(L, ssrHydrationKey(), escape(createComponent(A, { href: "/", class: "sidebar-dashboard-link", children: "\u2190 Dashboard" })), escape(createComponent(For, { get each() {
    return t.sections;
  }, children: (o) => ssr(P, ssrHydrationKey(), `sidebar-nav-link ${s() === o.id ? "sidebar-nav-link-active" : ""}`, escape(o.icon), escape(o.label)) })));
}
var N = ["<div", ' class="ai-chat-message ai-chat-message-assistant ai-chat-message-streaming"><p>', "</p></div>"], U = ["<aside", ' class="ai-chat-panel" aria-label="AI chat"><div class="ai-chat-header"><h2 class="ai-chat-title">AI Chat</h2><button type="button" class="ai-chat-close">\xD7</button></div><div class="ai-chat-messages"><!--$-->', "<!--/--><!--$-->", '<!--/--></div><form class="ai-chat-form"><label class="ai-chat-input-label" for="ai-chat-input">Ask about this PR</label><div class="ai-chat-input-row"><input id="ai-chat-input" class="ai-chat-input"', "", '><button type="submit" class="ai-chat-submit"', ">Send</button></div></form></aside>"], E = ["<div", ' class="', '"><button type="button" class="ai-chat-toggle">\u{1F916} AI Chat</button><!--$-->', "<!--/--></div>"], T = ["<div", ' class="', '"><p>', "</p></div>"];
function F(t) {
  const { store: s, sendAiChat: c } = mt(), [o, r] = createSignal(false), [l, h] = createSignal("");
  return ssr(E, ssrHydrationKey(), `ai-chat ${o() ? "ai-chat-open" : ""}`, escape(createComponent(Show, { get when() {
    return o();
  }, get children() {
    return ssr(U, ssrHydrationKey(), escape(createComponent(For, { get each() {
      return s.aiChat.messages;
    }, children: (u) => ssr(T, ssrHydrationKey(), `ai-chat-message ai-chat-message-${escape(u.role, true)}`, escape(u.content)) })), escape(createComponent(Show, { get when() {
      return s.aiChat.loading && s.aiChat.streamingContent;
    }, get children() {
      return ssr(N, ssrHydrationKey(), escape(s.aiChat.streamingContent));
    } })), ssrAttribute("value", escape(l(), true), false), ssrAttribute("disabled", s.aiChat.loading, true), ssrAttribute("disabled", s.aiChat.loading || !l().trim(), true));
  } })));
}
var O = ["<section", ' id="section-overview" class="canvas-section overview-section"><div class="section-header"><h1 class="section-title">#<!--$-->', "<!--/--> <!--$-->", "<!--/--></h1><span", ">", '</span></div><div class="pr-card overview-card"><div class="overview-meta"><span class="pr-author">\u{1F464} <!--$-->', '<!--/--></span><span class="pr-branches"><!--$-->', "<!--/--> \u2190 <!--$-->", '<!--/--></span><span class="pr-date">Created <!--$-->', '<!--/--></span><span class="pr-date">Updated <!--$-->', '<!--/--></span></div><div class="pr-labels">', '</div><div class="pr-stats overview-stats"><span class="stat-add">+<!--$-->', '<!--/--> additions</span><span class="stat-del">\u2212<!--$-->', '<!--/--> deletions</span></div><a class="github-link"', ' target="_blank" rel="noreferrer">View on GitHub</a></div><div class="pr-card pr-body-card"><h2 class="section-subtitle">Description</h2><!--$-->', "<!--/--></div></section>"], x = ["<span", ' class="pr-label"', ">", "</span>"], H = ["<p", ' class="empty-copy">No description provided.</p>'], q = ["<p", ' class="pr-body-paragraph">', "</p>"];
const V = (t) => `pr-state pr-state-${t.toLowerCase()}`, b = (t) => t ? new Date(t).toLocaleString() : "Unknown";
function B(t) {
  const s = () => t.pr.body.split(/\n{2,}/).map((c) => c.trim()).filter(Boolean);
  return ssr(O, ssrHydrationKey(), escape(t.pr.number), escape(t.pr.title), ssrAttribute("class", escape(V(t.pr.state), true), false), escape(t.pr.state), escape(t.pr.author.login), escape(t.pr.baseRefName), escape(t.pr.headRefName), escape(b(t.pr.createdAt)), escape(b(t.pr.updatedAt)), escape(createComponent(For, { get each() {
    return t.pr.labels;
  }, children: (c) => ssr(x, ssrHydrationKey(), ssrAttribute("data-color", escape(c.color, true), false), escape(c.name)) })), escape(t.pr.additions), escape(t.pr.deletions), ssrAttribute("href", escape(t.pr.url, true), false), escape(createComponent(Show, { get when() {
    return s().length > 0;
  }, get fallback() {
    return ssr(H, ssrHydrationKey());
  }, get children() {
    return createComponent(For, { get each() {
      return s();
    }, children: (c) => ssr(q, ssrHydrationKey(), escape(c)) });
  } })));
}
var j = ["<section", ' id="section-file-tree" class="canvas-section"><h2 class="section-title">\u{1F4C1} File Tree<span class="section-count"><!--$-->', "<!--/--> file<!--$-->", '<!--/--></span></h2><div class="pierre-tree-container" style="', '"></div></section>'];
function G(t) {
  createEffect(on(() => t.files, async (o) => {
  }));
  const s = () => {
    var _a, _b;
    return (_b = (_a = t.files) == null ? void 0 : _a.length) != null ? _b : 0;
  }, c = () => Math.min(s() * 28 + 40, 500);
  return ssr(j, ssrHydrationKey(), escape(s()), s() !== 1 ? "s" : "", ssrStyleProperty("min-height:", `${escape(c(), true)}px`));
}
var K = ["<section", ' id="section-mind-map" class="canvas-section mind-map-section"><div class="section-header"><h2 class="section-title">Mind Map</h2></div><div class="mind-map-grid">', "</div></section>"], z = ["<article", ' class="pr-card mind-map-card"><div class="mind-map-card-header"><span class="', '">', '</span><h3 class="mind-map-title">', '</h3></div><p class="mind-map-description">', '</p><ul class="mind-map-files">', "</ul></article>"], J = ["<li", ' class="mind-map-file">', "</li>"];
function Q(t) {
  return ssr(K, ssrHydrationKey(), escape(createComponent(For, { get each() {
    return t.groups;
  }, children: (s) => ssr(z, ssrHydrationKey(), `change-type-badge change-type-${escape(s.changeType, true)}`, escape(s.changeType), escape(s.label), escape(s.description), escape(createComponent(For, { get each() {
    return s.files;
  }, children: (c) => ssr(J, ssrHydrationKey(), escape(c)) }))) })));
}
var W = ["<section", ' id="section-diff-preview" class="canvas-section"><div class="section-header-row"><h2 class="section-title">\u{1F4DD} Diff Preview</h2><button type="button" class="pierre-control-btn">', '</button></div><div class="pierre-diffs-container"></div></section>'];
function X(t) {
  const [s, c] = createSignal("stacked");
  async function o(r, l) {
  }
  return createEffect(on(() => [t.rawDiff, s()], ([r, l]) => {
    r && o();
  })), ssr(W, ssrHydrationKey(), s() === "stacked" ? "Split View" : "Unified View");
}
var Y = ["<section", ' id="section-checks" class="canvas-section checks-section"><div class="section-header"><h2 class="section-title">CI Checks</h2></div><div class="pr-card checks-summary"><span class="check-success"><!--$-->', '<!--/--> passed</span><span class="check-failure"><!--$-->', '<!--/--> failed</span><span class="check-pending"><!--$-->', '<!--/--> pending</span></div><div class="checks-list">', "</div></section>"], Z = ["<article", ' class="pr-card check-item"><span class="', '">', '</span><div class="check-content"><h3 class="check-name">', '</h3><p class="check-description">', '</p><a class="check-details-link"', ' target="_blank" rel="noreferrer">Details</a></div></article>'];
const $ = (t) => t.toUpperCase() === "SUCCESS", g = (t) => ["FAILURE", "FAILED", "ERROR"].includes(t.toUpperCase()), ee = (t) => $(t) ? "\u2713" : g(t) ? "\u2717" : "\u25CB", te = (t) => $(t) ? "check-success" : g(t) ? "check-failure" : "check-pending";
function se(t) {
  const s = () => t.checks.filter((r) => $(r.state)).length, c = () => t.checks.filter((r) => g(r.state)).length, o = () => t.checks.length - s() - c();
  return ssr(Y, ssrHydrationKey(), escape(s()), escape(c()), escape(o()), escape(createComponent(For, { get each() {
    return t.checks;
  }, children: (r) => ssr(Z, ssrHydrationKey(), `check-icon ${escape(te(r.state), true)}`, escape(ee(r.state)), escape(r.name), escape(r.description), ssrAttribute("href", escape(r.detailsUrl, true), false)) })));
}
var ae = ["<section", ' id="section-comments" class="canvas-section comments-section"><div class="section-header"><h2 class="section-title">Comments</h2></div><div class="reviews-list"><h3 class="section-subtitle">Reviews</h3><!--$-->', '<!--/--></div><div class="pr-comments-list"><h3 class="section-subtitle">PR comments</h3><!--$-->', "<!--/--></div></section>"], ie = ["<p", ' class="empty-copy">No reviews yet.</p>'], ne = ["<p", ' class="comment-body">', "</p>"], ce = ["<article", ' class="pr-card review-item"><div class="comment-header"><span class="', '">', '</span><span class="comment-author">', '</span><time class="comment-date">', "</time></div><!--$-->", '<!--/--><div class="inline-comments-list">', "</div></article>"], re = ["<span", ' class="comment-location"><!--$-->', "<!--/-->:<!--$-->", "<!--/--></span>"], le = ["<div", ' class="inline-comment"><div class="comment-header"><span class="comment-author">', "</span><!--$-->", '<!--/--></div><p class="comment-body">', "</p></div>"], oe = ["<p", ' class="empty-copy">No PR comments yet.</p>'], de = ["<article", ' class="pr-card comment-item"><div class="comment-header"><span class="comment-author">', '</span><time class="comment-date">', '</time></div><p class="comment-body">', "</p></article>"];
const f = (t) => t ? new Date(t).toLocaleString() : "Unknown";
function me(t) {
  return ssr(ae, ssrHydrationKey(), escape(createComponent(For, { get each() {
    return t.reviews;
  }, get fallback() {
    return ssr(ie, ssrHydrationKey());
  }, children: (s) => ssr(ce, ssrHydrationKey(), `review-state review-state-${escape(s.state.toLowerCase(), true)}`, escape(s.state), escape(s.author.login), escape(f(s.createdAt)), escape(createComponent(Show, { get when() {
    return s.body;
  }, get children() {
    return ssr(ne, ssrHydrationKey(), escape(s.body));
  } })), escape(createComponent(For, { get each() {
    return s.comments;
  }, children: (c) => ssr(le, ssrHydrationKey(), escape(c.author.login), escape(createComponent(Show, { get when() {
    return c.path;
  }, get children() {
    return ssr(re, ssrHydrationKey(), escape(c.path), escape(c.line));
  } })), escape(c.body)) }))) })), escape(createComponent(For, { get each() {
    return t.comments;
  }, get fallback() {
    return ssr(oe, ssrHydrationKey());
  }, children: (s) => ssr(de, ssrHydrationKey(), escape(s.author.login), escape(f(s.createdAt)), escape(s.body)) })));
}
var pe = ["<section", ' id="section-ai-summary" class="canvas-section ai-summary-section"><div class="section-header"><h2 class="section-title">AI Summary</h2></div><div class="ai-summary-grid"><article class="pr-card ai-summary-block"><h3 class="section-subtitle">Purpose</h3><p>', '</p></article><article class="pr-card ai-summary-block"><h3 class="section-subtitle">Impact</h3><p>', '</p></article><article class="pr-card ai-summary-block"><h3 class="section-subtitle">Highlights</h3><ul class="ai-summary-list">', '</ul></article><article class="pr-card ai-summary-block ai-summary-concerns"><h3 class="section-subtitle">Concerns</h3><ul class="ai-summary-list warning-list">', "</ul></article></div></section>"], y = ["<li", ">", "</li>"];
function he(t) {
  return ssr(pe, ssrHydrationKey(), escape(t.summary.purpose), escape(t.summary.impact), escape(createComponent(For, { get each() {
    return t.summary.highlights;
  }, children: (s) => ssr(y, ssrHydrationKey(), escape(s)) })), escape(createComponent(For, { get each() {
    return t.summary.concerns;
  }, children: (s) => ssr(y, ssrHydrationKey(), escape(s)) })));
}
var ue = ["<div", ' class="error-banner">', "</div>"], ve = ["<div", ' class="pr-canvas-layout"><!--$-->', "<!--/--><!--$-->", '<!--/--><main class="pr-canvas-main"><!--$-->', "<!--/--><!--$-->", "<!--/--></main><!--$-->", "<!--/--></div>"], $e = ["<div", ' class="canvas-content"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"], ge = ["<div", ' class="loading-state"><div class="spinner"></div><p>Loading pull request...</p></div>'], be = ["<div", ' class="empty-state"><p>Pull request data is not available.</p></div>'];
const fe = [{ id: "section-overview", label: "Overview", icon: "\u{1F4CB}" }, { id: "section-file-tree", label: "File Tree", icon: "\u{1F4C1}" }, { id: "section-mind-map", label: "Mind Map", icon: "\u{1F9E0}" }, { id: "section-diff-preview", label: "Diffs", icon: "\u{1F4DD}" }, { id: "section-checks", label: "CI Checks", icon: "\u2705" }, { id: "section-comments", label: "Comments", icon: "\u{1F4AC}" }, { id: "section-ai-summary", label: "AI Summary", icon: "\u{1F916}" }];
function De() {
  const t = ct(), { store: s, loadPr: c, subscribePr: o } = mt(), r = () => Number(t.number);
  return ssr(ve, ssrHydrationKey(), escape(createComponent(ht, { get children() {
    return ["PR #", t.number, " \xB7 PR Canvas"];
  } })), escape(createComponent(M, { sections: fe })), escape(createComponent(Show, { get when() {
    return s.error;
  }, get children() {
    return ssr(ue, ssrHydrationKey(), escape(s.error));
  } })), escape(createComponent(Show, { get when() {
    return !s.loading;
  }, get fallback() {
    return createComponent(ye, {});
  }, get children() {
    return createComponent(Show, { get when() {
      return s.currentPr;
    }, get fallback() {
      return createComponent(ke, {});
    }, children: (l) => ssr($e, ssrHydrationKey(), escape(createComponent(B, { get pr() {
      return l().data.overview;
    } })), escape(createComponent(G, { get files() {
      return l().data.files;
    } })), escape(createComponent(Q, { get groups() {
      return l().mindMap;
    } })), escape(createComponent(X, { get rawDiff() {
      return l().rawDiff;
    } })), escape(createComponent(se, { get checks() {
      return l().data.checks;
    } })), escape(createComponent(me, { get comments() {
      return l().data.comments;
    }, get reviews() {
      return l().data.reviews;
    } })), escape(createComponent(he, { get summary() {
      return l().aiSummary;
    } }))) });
  } })), escape(createComponent(F, { get prNumber() {
    return r();
  } })));
}
function ye() {
  return ssr(ge, ssrHydrationKey());
}
function ke() {
  return ssr(be, ssrHydrationKey());
}

export { De as default };
//# sourceMappingURL=_number_2.mjs.map
