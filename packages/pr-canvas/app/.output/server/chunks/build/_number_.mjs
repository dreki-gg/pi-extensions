import { C as ssr, o as escape, f as createComponent, G as ssrHydrationKey, S as Show, k as createSignal, F as For, D as ssrAttribute } from '../nitro/nitro.mjs';
import { d as ct, m as mt, h as ht } from './context-VkJfzLEW.mjs';
import { A } from './components-u6vAPa9_.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:async_hooks';
import 'node:url';

var I = ["<aside", ' class="canvas-sidebar"><!--$-->', '<!--/--><nav class="sidebar-nav" aria-label="Pull request sections">', "</nav></aside>"], R = ["<button", ' type="button" class="', '"><span class="sidebar-nav-icon" aria-hidden="true">', '</span><span class="sidebar-nav-label">', "</span></button>"];
function D(t) {
  var _a, _b;
  const [s, c] = createSignal((_b = (_a = t.sections[0]) == null ? void 0 : _a.id) != null ? _b : "");
  return ssr(I, ssrHydrationKey(), escape(createComponent(A, { href: "/", class: "sidebar-dashboard-link", children: "\u2190 Dashboard" })), escape(createComponent(For, { get each() {
    return t.sections;
  }, children: (o) => ssr(R, ssrHydrationKey(), `sidebar-nav-link ${s() === o.id ? "sidebar-nav-link-active" : ""}`, escape(o.icon), escape(o.label)) })));
}
var L = ["<div", ' class="ai-chat-message ai-chat-message-assistant ai-chat-message-streaming"><p>', "</p></div>"], M = ["<aside", ' class="ai-chat-panel" aria-label="AI chat"><div class="ai-chat-header"><h2 class="ai-chat-title">AI Chat</h2><button type="button" class="ai-chat-close">\xD7</button></div><div class="ai-chat-messages"><!--$-->', "<!--/--><!--$-->", '<!--/--></div><form class="ai-chat-form"><label class="ai-chat-input-label" for="ai-chat-input">Ask about this PR</label><div class="ai-chat-input-row"><input id="ai-chat-input" class="ai-chat-input"', "", '><button type="submit" class="ai-chat-submit"', ">Send</button></div></form></aside>"], N = ["<div", ' class="', '"><button type="button" class="ai-chat-toggle">\u{1F916} AI Chat</button><!--$-->', "<!--/--></div>"], P = ["<div", ' class="', '"><p>', "</p></div>"];
function U(t) {
  const { store: s, sendAiChat: c } = mt(), [o, r] = createSignal(false), [l, h] = createSignal("");
  return ssr(N, ssrHydrationKey(), `ai-chat ${o() ? "ai-chat-open" : ""}`, escape(createComponent(Show, { get when() {
    return o();
  }, get children() {
    return ssr(M, ssrHydrationKey(), escape(createComponent(For, { get each() {
      return s.aiChat.messages;
    }, children: (u) => ssr(P, ssrHydrationKey(), `ai-chat-message ai-chat-message-${escape(u.role, true)}`, escape(u.content)) })), escape(createComponent(Show, { get when() {
      return s.aiChat.loading && s.aiChat.streamingContent;
    }, get children() {
      return ssr(L, ssrHydrationKey(), escape(s.aiChat.streamingContent));
    } })), ssrAttribute("value", escape(l(), true), false), ssrAttribute("disabled", s.aiChat.loading, true), ssrAttribute("disabled", s.aiChat.loading || !l().trim(), true));
  } })));
}
var T = ["<section", ' id="section-overview" class="canvas-section overview-section"><div class="section-header"><h1 class="section-title">#<!--$-->', "<!--/--> <!--$-->", "<!--/--></h1><span", ">", '</span></div><div class="pr-card overview-card"><div class="overview-meta"><span class="pr-author">\u{1F464} <!--$-->', '<!--/--></span><span class="pr-branches"><!--$-->', "<!--/--> \u2190 <!--$-->", '<!--/--></span><span class="pr-date">Created <!--$-->', '<!--/--></span><span class="pr-date">Updated <!--$-->', '<!--/--></span></div><div class="pr-labels">', '</div><div class="pr-stats overview-stats"><span class="stat-add">+<!--$-->', '<!--/--> additions</span><span class="stat-del">\u2212<!--$-->', '<!--/--> deletions</span></div><a class="github-link"', ' target="_blank" rel="noreferrer">View on GitHub</a></div><div class="pr-card pr-body-card"><h2 class="section-subtitle">Description</h2><!--$-->', "<!--/--></div></section>"], E = ["<span", ' class="pr-label"', ">", "</span>"], F = ["<p", ' class="empty-copy">No description provided.</p>'], O = ["<p", ' class="pr-body-paragraph">', "</p>"];
const q = (t) => `pr-state pr-state-${t.toLowerCase()}`, f = (t) => t ? new Date(t).toLocaleString() : "Unknown";
function x(t) {
  const s = () => t.pr.body.split(/\n{2,}/).map((c) => c.trim()).filter(Boolean);
  return ssr(T, ssrHydrationKey(), escape(t.pr.number), escape(t.pr.title), ssrAttribute("class", escape(q(t.pr.state), true), false), escape(t.pr.state), escape(t.pr.author.login), escape(t.pr.baseRefName), escape(t.pr.headRefName), escape(f(t.pr.createdAt)), escape(f(t.pr.updatedAt)), escape(createComponent(For, { get each() {
    return t.pr.labels;
  }, children: (c) => ssr(E, ssrHydrationKey(), ssrAttribute("data-color", escape(c.color, true), false), escape(c.name)) })), escape(t.pr.additions), escape(t.pr.deletions), ssrAttribute("href", escape(t.pr.url, true), false), escape(createComponent(Show, { get when() {
    return s().length > 0;
  }, get fallback() {
    return ssr(F, ssrHydrationKey());
  }, get children() {
    return createComponent(For, { get each() {
      return s();
    }, children: (c) => ssr(O, ssrHydrationKey(), escape(c)) });
  } })));
}
var H = ["<section", ' id="section-file-tree" class="canvas-section file-tree-section"><div class="section-header"><h2 class="section-title">File Tree</h2></div><div class="pr-card file-tree-container"></div></section>'];
function B(t) {
  return ssr(H, ssrHydrationKey());
}
var j = ["<section", ' id="section-mind-map" class="canvas-section mind-map-section"><div class="section-header"><h2 class="section-title">Mind Map</h2></div><div class="mind-map-grid">', "</div></section>"], G = ["<article", ' class="pr-card mind-map-card"><div class="mind-map-card-header"><span class="', '">', '</span><h3 class="mind-map-title">', '</h3></div><p class="mind-map-description">', '</p><ul class="mind-map-files">', "</ul></article>"], K = ["<li", ' class="mind-map-file">', "</li>"];
function V(t) {
  return ssr(j, ssrHydrationKey(), escape(createComponent(For, { get each() {
    return t.groups;
  }, children: (s) => ssr(G, ssrHydrationKey(), `change-type-badge change-type-${escape(s.changeType, true)}`, escape(s.changeType), escape(s.label), escape(s.description), escape(createComponent(For, { get each() {
    return s.files;
  }, children: (c) => ssr(K, ssrHydrationKey(), escape(c)) }))) })));
}
var z = ["<section", ' id="section-diff-preview" class="canvas-section diff-preview-section"><div class="section-header"><h2 class="section-title">Diffs</h2><button type="button" class="diff-layout-toggle">', '</button></div><div class="pr-card diff-preview-container"></div></section>'];
function J(t) {
  const [s, c] = createSignal("stacked");
  return ssr(z, ssrHydrationKey(), s() === "stacked" ? "Split view" : "Unified view");
}
var Q = ["<section", ' id="section-checks" class="canvas-section checks-section"><div class="section-header"><h2 class="section-title">CI Checks</h2></div><div class="pr-card checks-summary"><span class="check-success"><!--$-->', '<!--/--> passed</span><span class="check-failure"><!--$-->', '<!--/--> failed</span><span class="check-pending"><!--$-->', '<!--/--> pending</span></div><div class="checks-list">', "</div></section>"], W = ["<article", ' class="pr-card check-item"><span class="', '">', '</span><div class="check-content"><h3 class="check-name">', '</h3><p class="check-description">', '</p><a class="check-details-link"', ' target="_blank" rel="noreferrer">Details</a></div></article>'];
const g = (t) => t.toUpperCase() === "SUCCESS", b = (t) => ["FAILURE", "FAILED", "ERROR"].includes(t.toUpperCase()), X = (t) => g(t) ? "\u2713" : b(t) ? "\u2717" : "\u25CB", Y = (t) => g(t) ? "check-success" : b(t) ? "check-failure" : "check-pending";
function Z(t) {
  const s = () => t.checks.filter((r) => g(r.state)).length, c = () => t.checks.filter((r) => b(r.state)).length, o = () => t.checks.length - s() - c();
  return ssr(Q, ssrHydrationKey(), escape(s()), escape(c()), escape(o()), escape(createComponent(For, { get each() {
    return t.checks;
  }, children: (r) => ssr(W, ssrHydrationKey(), `check-icon ${escape(Y(r.state), true)}`, escape(X(r.state)), escape(r.name), escape(r.description), ssrAttribute("href", escape(r.detailsUrl, true), false)) })));
}
var ee = ["<section", ' id="section-comments" class="canvas-section comments-section"><div class="section-header"><h2 class="section-title">Comments</h2></div><div class="reviews-list"><h3 class="section-subtitle">Reviews</h3><!--$-->', '<!--/--></div><div class="pr-comments-list"><h3 class="section-subtitle">PR comments</h3><!--$-->', "<!--/--></div></section>"], te = ["<p", ' class="empty-copy">No reviews yet.</p>'], se = ["<p", ' class="comment-body">', "</p>"], ae = ["<article", ' class="pr-card review-item"><div class="comment-header"><span class="', '">', '</span><span class="comment-author">', '</span><time class="comment-date">', "</time></div><!--$-->", '<!--/--><div class="inline-comments-list">', "</div></article>"], ie = ["<span", ' class="comment-location"><!--$-->', "<!--/-->:<!--$-->", "<!--/--></span>"], ne = ["<div", ' class="inline-comment"><div class="comment-header"><span class="comment-author">', "</span><!--$-->", '<!--/--></div><p class="comment-body">', "</p></div>"], ce = ["<p", ' class="empty-copy">No PR comments yet.</p>'], re = ["<article", ' class="pr-card comment-item"><div class="comment-header"><span class="comment-author">', '</span><time class="comment-date">', '</time></div><p class="comment-body">', "</p></article>"];
const y = (t) => t ? new Date(t).toLocaleString() : "Unknown";
function le(t) {
  return ssr(ee, ssrHydrationKey(), escape(createComponent(For, { get each() {
    return t.reviews;
  }, get fallback() {
    return ssr(te, ssrHydrationKey());
  }, children: (s) => ssr(ae, ssrHydrationKey(), `review-state review-state-${escape(s.state.toLowerCase(), true)}`, escape(s.state), escape(s.author.login), escape(y(s.createdAt)), escape(createComponent(Show, { get when() {
    return s.body;
  }, get children() {
    return ssr(se, ssrHydrationKey(), escape(s.body));
  } })), escape(createComponent(For, { get each() {
    return s.comments;
  }, children: (c) => ssr(ne, ssrHydrationKey(), escape(c.author.login), escape(createComponent(Show, { get when() {
    return c.path;
  }, get children() {
    return ssr(ie, ssrHydrationKey(), escape(c.path), escape(c.line));
  } })), escape(c.body)) }))) })), escape(createComponent(For, { get each() {
    return t.comments;
  }, get fallback() {
    return ssr(ce, ssrHydrationKey());
  }, children: (s) => ssr(re, ssrHydrationKey(), escape(s.author.login), escape(y(s.createdAt)), escape(s.body)) })));
}
var oe = ["<section", ' id="section-ai-summary" class="canvas-section ai-summary-section"><div class="section-header"><h2 class="section-title">AI Summary</h2></div><div class="ai-summary-grid"><article class="pr-card ai-summary-block"><h3 class="section-subtitle">Purpose</h3><p>', '</p></article><article class="pr-card ai-summary-block"><h3 class="section-subtitle">Impact</h3><p>', '</p></article><article class="pr-card ai-summary-block"><h3 class="section-subtitle">Highlights</h3><ul class="ai-summary-list">', '</ul></article><article class="pr-card ai-summary-block ai-summary-concerns"><h3 class="section-subtitle">Concerns</h3><ul class="ai-summary-list warning-list">', "</ul></article></div></section>"], k = ["<li", ">", "</li>"];
function de(t) {
  return ssr(oe, ssrHydrationKey(), escape(t.summary.purpose), escape(t.summary.impact), escape(createComponent(For, { get each() {
    return t.summary.highlights;
  }, children: (s) => ssr(k, ssrHydrationKey(), escape(s)) })), escape(createComponent(For, { get each() {
    return t.summary.concerns;
  }, children: (s) => ssr(k, ssrHydrationKey(), escape(s)) })));
}
var me = ["<div", ' class="error-banner">', "</div>"], pe = ["<div", ' class="pr-canvas-layout"><!--$-->', "<!--/--><!--$-->", '<!--/--><main class="pr-canvas-main"><!--$-->', "<!--/--><!--$-->", "<!--/--></main><!--$-->", "<!--/--></div>"], he = ["<div", ' class="canvas-content"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"], ue = ["<div", ' class="loading-state"><div class="spinner"></div><p>Loading pull request...</p></div>'], ve = ["<div", ' class="empty-state"><p>Pull request data is not available.</p></div>'];
const $e = [{ id: "section-overview", label: "Overview", icon: "\u{1F4CB}" }, { id: "section-file-tree", label: "File Tree", icon: "\u{1F4C1}" }, { id: "section-mind-map", label: "Mind Map", icon: "\u{1F9E0}" }, { id: "section-diff-preview", label: "Diffs", icon: "\u{1F4DD}" }, { id: "section-checks", label: "CI Checks", icon: "\u2705" }, { id: "section-comments", label: "Comments", icon: "\u{1F4AC}" }, { id: "section-ai-summary", label: "AI Summary", icon: "\u{1F916}" }];
function _e() {
  const t = ct(), { store: s, loadPr: c, subscribePr: o } = mt(), r = () => Number(t.number);
  return ssr(pe, ssrHydrationKey(), escape(createComponent(ht, { get children() {
    return ["PR #", t.number, " \xB7 PR Canvas"];
  } })), escape(createComponent(D, { sections: $e })), escape(createComponent(Show, { get when() {
    return s.error;
  }, get children() {
    return ssr(me, ssrHydrationKey(), escape(s.error));
  } })), escape(createComponent(Show, { get when() {
    return !s.loading;
  }, get fallback() {
    return createComponent(ge, {});
  }, get children() {
    return createComponent(Show, { get when() {
      return s.currentPr;
    }, get fallback() {
      return createComponent(be, {});
    }, children: (l) => ssr(he, ssrHydrationKey(), escape(createComponent(x, { get pr() {
      return l().data.overview;
    } })), escape(createComponent(B, { get files() {
      return l().data.files;
    } })), escape(createComponent(V, { get groups() {
      return l().mindMap;
    } })), escape(createComponent(J, { get rawDiff() {
      return l().rawDiff;
    } })), escape(createComponent(Z, { get checks() {
      return l().data.checks;
    } })), escape(createComponent(le, { get comments() {
      return l().data.comments;
    }, get reviews() {
      return l().data.reviews;
    } })), escape(createComponent(de, { get summary() {
      return l().aiSummary;
    } }))) });
  } })), escape(createComponent(U, { get prNumber() {
    return r();
  } })));
}
function ge() {
  return ssr(ue, ssrHydrationKey());
}
function be() {
  return ssr(ve, ssrHydrationKey());
}

export { _e as default };
//# sourceMappingURL=_number_.mjs.map
