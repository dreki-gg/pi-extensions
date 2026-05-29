import { o as ct, w as mt, D as ssr, p as escape, f as createComponent, S as Show, H as ssrHydrationKey, s as ht, l as createSignal, F as For, E as ssrAttribute, I as ssrStyle, h as createEffect, y as on, J as ssrStyleProperty, i as createMemo } from '../nitro/nitro.mjs';
import { f as f1, u as u1 } from './Icon-BaqE27Xx2.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:async_hooks';
import 'node:url';

var M = ["<span", ">All pull requests</span>"], P = ["<aside", ' class="canvas-sidebar"><!--$-->', '<!--/--><nav class="sidebar-nav" aria-label="Pull request sections">', "</nav></aside>"], F = ["<button", ' type="button" class="', '"', '><span class="sidebar-nav-icon">', '</span><span class="sidebar-nav-label">', "</span><!--$-->", "<!--/--></button>"], N = ["<span", ' class="sidebar-badge"', ">", "</span>"];
function O(t) {
  var _a, _b;
  const [s, c] = createSignal((_b = (_a = t.sections[0]) == null ? void 0 : _a.id) != null ? _b : "");
  return ssr(P, ssrHydrationKey(), escape(createComponent(u1, { href: "/", class: "sidebar-back", get children() {
    return [createComponent(f1, { name: "back", size: 16 }), ssr(M, ssrHydrationKey())];
  } })), escape(createComponent(For, { get each() {
    return t.sections;
  }, children: (o) => ssr(F, ssrHydrationKey(), `sidebar-nav-link ${s() === o.id ? "sidebar-nav-link-active" : ""}`, ssrAttribute("aria-current", s() === o.id ? "true" : escape(void 0, true), false), escape(createComponent(f1, { get name() {
    return o.icon;
  }, size: 18 })), escape(o.label), escape(createComponent(Show, { get when() {
    return o.badge;
  }, children: (m) => ssr(N, ssrHydrationKey(), ssrAttribute("data-tone", escape(m().tone, true), false), escape(m().text)) }))) })));
}
var T = ["<header", ' class="context-bar"><div class="context-bar-main"><span class="context-bar-number">#<!--$-->', '<!--/--></span><h1 class="context-bar-title"', ">", '</h1></div><div class="context-bar-meta"><span', ">", '</span><span class="context-bar-branch"><!--$-->', "<!--/--><!--$-->", "<!--/--> \u2190 <!--$-->", '<!--/--></span><span class="context-bar-stats"><span class="stat-add">+<!--$-->', '<!--/--></span><span class="stat-del">\u2212<!--$-->', '<!--/--></span></span><a class="context-bar-link"', ' target="_blank" rel="noreferrer">GitHub<!--$-->', "<!--/--></a></div></header>"];
const q = (t) => `state-pill state-${t.toLowerCase()}`;
function H(t) {
  return ssr(T, ssrHydrationKey(), escape(t.pr.number), ssrAttribute("title", escape(t.pr.title, true), false), escape(t.pr.title), ssrAttribute("class", escape(q(t.pr.state), true), false), escape(t.pr.state), escape(createComponent(f1, { name: "branch", size: 14 })), escape(t.pr.baseRefName), escape(t.pr.headRefName), escape(t.pr.additions), escape(t.pr.deletions), ssrAttribute("href", escape(t.pr.url, true), false), escape(createComponent(f1, { name: "external", size: 14 })));
}
var B = ["<p", ' class="ai-chat-hint">Ask anything about the changes, the diff, or why something was done.</p>'], K = ["<div", ' class="ai-chat-message ai-chat-message-assistant ai-chat-message-streaming"><p>', "</p></div>"], V = ["<aside", ' class="ai-chat-panel" aria-label="AI chat"><div class="ai-chat-header"><h2 class="ai-chat-title"><!--$-->', '<!--/-->Ask about this PR</h2><button type="button" class="ai-chat-close" aria-label="Close chat">', '</button></div><div class="ai-chat-messages"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", '<!--/--></div><form class="ai-chat-form"><div class="ai-chat-input-row"><input id="ai-chat-input" class="ai-chat-input" placeholder="Ask about this PR"', "", '><button type="submit" class="ai-chat-submit"', ' aria-label="Send message">', "</button></div></form></aside>"], j = ["<div", ' class="', '"><button type="button" class="ai-chat-toggle"', "><!--$-->", "<!--/--><span>Ask AI</span></button><!--$-->", "<!--/--></div>"], G = ["<div", ' class="', '"><p>', "</p></div>"];
function J(t) {
  const { store: s, sendAiChat: c } = mt(), [o, m] = createSignal(false), [r, l] = createSignal("");
  return ssr(j, ssrHydrationKey(), `ai-chat ${o() ? "ai-chat-open" : ""}`, ssrAttribute("aria-expanded", escape(o(), true), false), escape(createComponent(f1, { name: "robot", size: 18 })), escape(createComponent(Show, { get when() {
    return o();
  }, get children() {
    return ssr(V, ssrHydrationKey(), escape(createComponent(f1, { name: "robot", size: 16 })), escape(createComponent(f1, { name: "close", size: 16 })), escape(createComponent(Show, { get when() {
      return s.aiChat.messages.length === 0 && !s.aiChat.loading;
    }, get children() {
      return ssr(B, ssrHydrationKey());
    } })), escape(createComponent(For, { get each() {
      return s.aiChat.messages;
    }, children: (v) => ssr(G, ssrHydrationKey(), `ai-chat-message ai-chat-message-${escape(v.role, true)}`, escape(v.content)) })), escape(createComponent(Show, { get when() {
      return s.aiChat.loading && s.aiChat.streamingContent;
    }, get children() {
      return ssr(K, ssrHydrationKey(), escape(s.aiChat.streamingContent));
    } })), ssrAttribute("value", escape(r(), true), false), ssrAttribute("disabled", s.aiChat.loading, true), ssrAttribute("disabled", s.aiChat.loading || !r().trim(), true), escape(createComponent(f1, { name: "send", size: 16 })));
  } })));
}
var Q = ["<div", ' class="pr-labels">', "</div>"], W = ["<section", ' id="section-overview" class="canvas-section"><div class="pr-card overview-card"><dl class="overview-facts"><div class="overview-fact"><dt>Author</dt><dd class="overview-author"><!--$-->', "<!--/--><!--$-->", '<!--/--></dd></div><div class="overview-fact"><dt>Created</dt><dd>', '</dd></div><div class="overview-fact"><dt>Updated</dt><dd>', "</dd></div></dl><!--$-->", '<!--/--></div><div class="pr-card pr-body-card"><h2 class="section-subtitle">Description</h2><!--$-->', "<!--/--></div></section>"], X = ["<span", ' class="pr-label" style="', '">', "</span>"], Y = ["<p", ' class="empty-copy">No description provided.</p>'], Z = ["<p", ' class="pr-body-paragraph">', "</p>"];
const b = (t) => t ? new Date(t).toLocaleString() : "Unknown";
function ee(t) {
  return { "--label-color": `#${(t == null ? void 0 : t.replace("#", "")) || "8b949e"}` };
}
function te(t) {
  const s = () => t.pr.body.split(/\n{2,}/).map((c) => c.trim()).filter(Boolean);
  return ssr(W, ssrHydrationKey(), escape(createComponent(f1, { name: "user", size: 15 })), escape(t.pr.author.login), escape(b(t.pr.createdAt)), escape(b(t.pr.updatedAt)), escape(createComponent(Show, { get when() {
    return t.pr.labels.length > 0;
  }, get children() {
    return ssr(Q, ssrHydrationKey(), escape(createComponent(For, { get each() {
      return t.pr.labels;
    }, children: (c) => ssr(X, ssrHydrationKey(), ssrStyle(ee(c.color)), escape(c.name)) })));
  } })), escape(createComponent(Show, { get when() {
    return s().length > 0;
  }, get fallback() {
    return ssr(Y, ssrHydrationKey());
  }, get children() {
    return createComponent(For, { get each() {
      return s();
    }, children: (c) => ssr(Z, ssrHydrationKey(), escape(c)) });
  } })));
}
var ae = ["<section", ' id="section-file-tree" class="canvas-section"><div class="section-header"><h2 class="section-title">Files Changed</h2><span class="section-count"><!--$-->', "<!--/--> file<!--$-->", '<!--/--></span></div><div class="pierre-tree-container" style="', '"></div></section>'];
function se(t) {
  createEffect(on(() => t.files, async (o) => {
  }));
  const s = () => {
    var _a, _b;
    return (_b = (_a = t.files) == null ? void 0 : _a.length) != null ? _b : 0;
  }, c = () => Math.min(s() * 28 + 40, 500);
  return ssr(ae, ssrHydrationKey(), escape(s()), s() !== 1 ? "s" : "", ssrStyleProperty("min-height:", `${escape(c(), true)}px`));
}
var ne = ["<section", ' id="section-mind-map" class="canvas-section mind-map-section"><div class="section-header"><h2 class="section-title">Mind Map</h2></div><div class="mind-map-grid">', "</div></section>"], ie = ["<article", ' class="pr-card mind-map-card"><div class="mind-map-card-header"><span class="', '">', '</span><h3 class="mind-map-title">', '</h3></div><p class="mind-map-description">', '</p><ul class="mind-map-files">', "</ul></article>"], re = ["<li", ' class="mind-map-file">', "</li>"];
function ce(t) {
  return ssr(ne, ssrHydrationKey(), escape(createComponent(For, { get each() {
    return t.groups;
  }, children: (s) => ssr(ie, ssrHydrationKey(), `change-type-badge change-type-${escape(s.changeType, true)}`, escape(s.changeType), escape(s.label), escape(s.description), escape(createComponent(For, { get each() {
    return s.files;
  }, children: (c) => ssr(re, ssrHydrationKey(), escape(c)) }))) })));
}
var le = ["<section", ' id="section-diff-preview" class="canvas-section"><div class="section-header-row"><h2 class="section-title">Diff</h2><button type="button" class="pierre-control-btn">', '</button></div><div class="pierre-diffs-container"></div></section>'];
function oe(t) {
  const [s, c] = createSignal("stacked");
  async function o(m, r) {
  }
  return createEffect(on(() => [t.rawDiff, s()], ([m, r]) => {
    m && o();
  })), ssr(le, ssrHydrationKey(), s() === "stacked" ? "Split View" : "Unified View");
}
var de = ["<span", ' class="summary-pill summary-failure"><!--$-->', "<!--/--><!--$-->", "<!--/--> failing</span>"], me = ["<span", ' class="summary-pill summary-pending"><!--$-->', "<!--/--><!--$-->", "<!--/--> pending</span>"], ue = ["<span", ' class="summary-pill summary-success"><!--$-->', "<!--/--><!--$-->", "<!--/--> passed</span>"], he = ["<ul", ' class="checks-list">', "</ul>"], pe = ["<section", ' id="section-checks" class="canvas-section"><div class="section-header"><h2 class="section-title">CI Checks</h2><div class="checks-summary"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div></div><!--$-->", "<!--/--></section>"], ve = ["<div", ' class="pr-card empty-copy-card">No CI checks reported.</div>'], ge = ["<p", ' class="check-description">', "</p>"], $e = ["<a", ' class="check-details-link"', ' target="_blank" rel="noreferrer">Details<!--$-->', "<!--/--></a>"], be = ["<li", ' class="check-item"', '><span class="', '">', '</span><div class="check-content"><h3 class="check-name">', "</h3><!--$-->", "<!--/--></div><!--$-->", "<!--/--></li>"];
const A = (t) => t.toUpperCase() === "SUCCESS", x = (t) => ["FAILURE", "FAILED", "ERROR"].includes(t.toUpperCase()), $ = (t) => A(t) ? "success" : x(t) ? "failure" : "pending", f = { failure: 0, pending: 1, success: 2 };
function fe(t) {
  const s = createMemo(() => [...t.checks].sort((r, l) => f[$(r.state)] - f[$(l.state)])), c = () => t.checks.filter((r) => A(r.state)).length, o = () => t.checks.filter((r) => x(r.state)).length, m = () => t.checks.length - c() - o();
  return ssr(pe, ssrHydrationKey(), escape(createComponent(Show, { get when() {
    return o() > 0;
  }, get children() {
    return ssr(de, ssrHydrationKey(), escape(createComponent(f1, { name: "cross", size: 13 })), escape(o()));
  } })), escape(createComponent(Show, { get when() {
    return m() > 0;
  }, get children() {
    return ssr(me, ssrHydrationKey(), escape(createComponent(f1, { name: "dot", size: 13 })), escape(m()));
  } })), escape(createComponent(Show, { get when() {
    return c() > 0;
  }, get children() {
    return ssr(ue, ssrHydrationKey(), escape(createComponent(f1, { name: "check", size: 13 })), escape(c()));
  } })), escape(createComponent(Show, { get when() {
    return t.checks.length > 0;
  }, get fallback() {
    return ssr(ve, ssrHydrationKey());
  }, get children() {
    return ssr(he, ssrHydrationKey(), escape(createComponent(For, { get each() {
      return s();
    }, children: (r) => {
      const l = $(r.state);
      return ssr(be, ssrHydrationKey(), ssrAttribute("data-status", escape(l, true), false), `check-icon check-${escape(l, true)}`, escape(createComponent(f1, { name: l === "success" ? "check" : l === "failure" ? "cross" : "dot", size: 14 })), escape(r.name), escape(createComponent(Show, { get when() {
        return r.description;
      }, get children() {
        return ssr(ge, ssrHydrationKey(), escape(r.description));
      } })), escape(createComponent(Show, { get when() {
        return r.detailsUrl;
      }, get children() {
        return ssr($e, ssrHydrationKey(), ssrAttribute("href", escape(r.detailsUrl, true), false), escape(createComponent(f1, { name: "external", size: 13 })));
      } })));
    } })));
  } })));
}
var ye = ["<section", ' id="section-comments" class="canvas-section comments-section"><div class="section-header"><h2 class="section-title">Comments</h2></div><div class="reviews-list"><h3 class="section-subtitle">Reviews</h3><!--$-->', '<!--/--></div><div class="pr-comments-list"><h3 class="section-subtitle">PR comments</h3><!--$-->', "<!--/--></div></section>"], we = ["<p", ' class="empty-copy">No reviews yet.</p>'], _e = ["<p", ' class="comment-body">', "</p>"], ke = ["<article", ' class="pr-card review-item"><div class="comment-header"><span class="', '">', '</span><span class="comment-author">', '</span><time class="comment-date">', "</time></div><!--$-->", '<!--/--><div class="inline-comments-list">', "</div></article>"], Ce = ["<span", ' class="comment-location"><!--$-->', "<!--/-->:<!--$-->", "<!--/--></span>"], Se = ["<div", ' class="inline-comment"><div class="comment-header"><span class="comment-author">', "</span><!--$-->", '<!--/--></div><p class="comment-body">', "</p></div>"], Ae = ["<p", ' class="empty-copy">No PR comments yet.</p>'], xe = ["<article", ' class="pr-card comment-item"><div class="comment-header"><span class="comment-author">', '</span><time class="comment-date">', '</time></div><p class="comment-body">', "</p></article>"];
const y = (t) => t ? new Date(t).toLocaleString() : "Unknown";
function Re(t) {
  return ssr(ye, ssrHydrationKey(), escape(createComponent(For, { get each() {
    return t.reviews;
  }, get fallback() {
    return ssr(we, ssrHydrationKey());
  }, children: (s) => ssr(ke, ssrHydrationKey(), `review-state review-state-${escape(s.state.toLowerCase(), true)}`, escape(s.state), escape(s.author.login), escape(y(s.createdAt)), escape(createComponent(Show, { get when() {
    return s.body;
  }, get children() {
    return ssr(_e, ssrHydrationKey(), escape(s.body));
  } })), escape(createComponent(For, { get each() {
    return s.comments;
  }, children: (c) => ssr(Se, ssrHydrationKey(), escape(c.author.login), escape(createComponent(Show, { get when() {
    return c.path;
  }, get children() {
    return ssr(Ce, ssrHydrationKey(), escape(c.path), escape(c.line));
  } })), escape(c.body)) }))) })), escape(createComponent(For, { get each() {
    return t.comments;
  }, get fallback() {
    return ssr(Ae, ssrHydrationKey());
  }, children: (s) => ssr(xe, ssrHydrationKey(), escape(s.author.login), escape(y(s.createdAt)), escape(s.body)) })));
}
var Ie = ["<section", ' id="section-ai-summary" class="canvas-section ai-summary-section"><div class="section-header"><h2 class="section-title">AI Summary</h2></div><div class="ai-summary-grid"><article class="pr-card ai-summary-block"><h3 class="section-subtitle">Purpose</h3><p>', '</p></article><article class="pr-card ai-summary-block"><h3 class="section-subtitle">Impact</h3><p>', '</p></article><article class="pr-card ai-summary-block"><h3 class="section-subtitle">Highlights</h3><ul class="ai-summary-list">', '</ul></article><article class="pr-card ai-summary-block ai-summary-concerns"><h3 class="section-subtitle">Concerns</h3><ul class="ai-summary-list warning-list">', "</ul></article></div></section>"], w = ["<li", ">", "</li>"];
function De(t) {
  return ssr(Ie, ssrHydrationKey(), escape(t.summary.purpose), escape(t.summary.impact), escape(createComponent(For, { get each() {
    return t.summary.highlights;
  }, children: (s) => ssr(w, ssrHydrationKey(), escape(s)) })), escape(createComponent(For, { get each() {
    return t.summary.concerns;
  }, children: (s) => ssr(w, ssrHydrationKey(), escape(s)) })));
}
var Ue = ["<div", ' class="error-banner" role="alert">', "</div>"], ze = ["<div", ' class="pr-canvas-layout"><!--$-->', "<!--/--><!--$-->", '<!--/--><main class="pr-canvas-main"><!--$-->', "<!--/--><!--$-->", "<!--/--></main><!--$-->", "<!--/--></div>"], Le = ["<aside", ' class="canvas-sidebar canvas-sidebar-empty"></aside>'], Ee = ["<div", ' class="canvas-content"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"], Me = ["<p", ">Can't reach the PR Canvas server.</p>"], Pe = ["<p", ' class="loading-hint">Make sure <code>/pr-canvas start</code> is running, then reload this page.</p>'], Fe = ["<div", ' class="loading-state">', "</div>"], Ne = ["<div", ' class="spinner"></div>'], Oe = ["<p", ">Loading pull request...</p>"], Te = ["<div", ' class="empty-state"><p>Pull request data is not available.</p></div>'];
const qe = ["FAILURE", "FAILED", "ERROR"];
function He(t) {
  const s = t.data.files.length, c = t.mindMap.length, o = t.data.checks.filter((v) => qe.includes(v.state.toUpperCase())).length, m = t.data.checks.filter((v) => v.state.toUpperCase() === "SUCCESS").length, r = t.data.comments.length + t.data.reviews.length, l = t.aiSummary.concerns.length;
  return [{ id: "section-overview", label: "Overview", icon: "overview" }, { id: "section-file-tree", label: "Files", icon: "files", badge: s ? { text: String(s), tone: "default" } : void 0 }, { id: "section-mind-map", label: "Mind Map", icon: "mind-map", badge: c ? { text: String(c), tone: "default" } : void 0 }, { id: "section-diff-preview", label: "Diffs", icon: "diff" }, { id: "section-checks", label: "CI Checks", icon: "checks", badge: o > 0 ? { text: String(o), tone: "danger" } : m > 0 ? { text: String(m), tone: "success" } : void 0 }, { id: "section-comments", label: "Comments", icon: "comments", badge: r ? { text: String(r), tone: "default" } : void 0 }, { id: "section-ai-summary", label: "AI Summary", icon: "summary", badge: l ? { text: String(l), tone: "warning" } : void 0 }];
}
function We() {
  const t = ct(), { store: s, loadPr: c, subscribePr: o, connectionStatus: m } = mt(), r = () => Number(t.number);
  return ssr(ze, ssrHydrationKey(), escape(createComponent(ht, { get children() {
    return ["PR #", t.number, " \xB7 PR Canvas"];
  } })), escape(createComponent(Show, { get when() {
    return s.currentPr;
  }, get fallback() {
    return ssr(Le, ssrHydrationKey());
  }, children: (l) => createComponent(O, { get sections() {
    return He(l());
  } }) })), escape(createComponent(Show, { get when() {
    return s.error;
  }, get children() {
    return ssr(Ue, ssrHydrationKey(), escape(s.error));
  } })), escape(createComponent(Show, { get when() {
    return !s.loading;
  }, get fallback() {
    return createComponent(Be, { get status() {
      return m();
    } });
  }, get children() {
    return createComponent(Show, { get when() {
      return s.currentPr;
    }, get fallback() {
      return createComponent(Ke, {});
    }, children: (l) => [createComponent(H, { get pr() {
      return l().data.overview;
    } }), ssr(Ee, ssrHydrationKey(), escape(createComponent(te, { get pr() {
      return l().data.overview;
    } })), escape(createComponent(se, { get files() {
      return l().data.files;
    } })), escape(createComponent(ce, { get groups() {
      return l().mindMap;
    } })), escape(createComponent(oe, { get rawDiff() {
      return l().rawDiff;
    } })), escape(createComponent(fe, { get checks() {
      return l().data.checks;
    } })), escape(createComponent(Re, { get comments() {
      return l().data.comments;
    }, get reviews() {
      return l().data.reviews;
    } })), escape(createComponent(De, { get summary() {
      return l().aiSummary;
    } })))] });
  } })), escape(createComponent(J, { get prNumber() {
    return r();
  } })));
}
function Be(t) {
  return ssr(Fe, ssrHydrationKey(), escape(createComponent(Show, { get when() {
    return t.status === "closed";
  }, get fallback() {
    return [ssr(Ne, ssrHydrationKey()), ssr(Oe, ssrHydrationKey())];
  }, get children() {
    return [ssr(Me, ssrHydrationKey()), ssr(Pe, ssrHydrationKey())];
  } })));
}
function Ke() {
  return ssr(Te, ssrHydrationKey());
}

export { We as default };
//# sourceMappingURL=_number_2.mjs.map
