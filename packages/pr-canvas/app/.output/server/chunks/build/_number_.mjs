import { D as ssr, p as escape, f as createComponent, H as ssrHydrationKey, S as Show, l as createSignal, F as For, E as ssrAttribute, I as ssrStyle, h as createEffect, y as on, J as ssrStyleProperty, i as createMemo } from '../nitro/nitro.mjs';
import { d as ct, m as mt, h as ht } from './context-DYtVF_Lv.mjs';
import { f as f1, u as u1 } from './Icon-BaqE27Xx.mjs';
import { M as MarkdownIt } from '../_/index.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:async_hooks';
import 'node:url';

var _a;
var F = ["<span", ">All pull requests</span>"], N = ["<aside", ' class="canvas-sidebar"><!--$-->', '<!--/--><nav class="sidebar-nav" aria-label="Pull request sections">', "</nav></aside>"], O = ["<button", ' type="button" class="', '"', '><span class="sidebar-nav-icon">', '</span><span class="sidebar-nav-label">', "</span><!--$-->", "<!--/--></button>"], T = ["<span", ' class="sidebar-badge"', ">", "</span>"];
function q(t) {
  var _a2, _b;
  const [s, c] = createSignal((_b = (_a2 = t.sections[0]) == null ? void 0 : _a2.id) != null ? _b : "");
  return ssr(N, ssrHydrationKey(), escape(createComponent(u1, { href: "/", class: "sidebar-back", get children() {
    return [createComponent(f1, { name: "back", size: 16 }), ssr(F, ssrHydrationKey())];
  } })), escape(createComponent(For, { get each() {
    return t.sections;
  }, children: (l) => ssr(O, ssrHydrationKey(), `sidebar-nav-link ${s() === l.id ? "sidebar-nav-link-active" : ""}`, ssrAttribute("aria-current", s() === l.id ? "true" : escape(void 0, true), false), escape(createComponent(f1, { get name() {
    return l.icon;
  }, size: 18 })), escape(l.label), escape(createComponent(Show, { get when() {
    return l.badge;
  }, children: (d) => ssr(T, ssrHydrationKey(), ssrAttribute("data-tone", escape(d().tone, true), false), escape(d().text)) }))) })));
}
var H = ["<header", ' class="context-bar"><div class="context-bar-main"><span class="context-bar-number">#<!--$-->', '<!--/--></span><h1 class="context-bar-title"', ">", '</h1></div><div class="context-bar-meta"><span', ">", '</span><span class="context-bar-branch"><!--$-->', "<!--/--><!--$-->", "<!--/--> \u2190 <!--$-->", '<!--/--></span><span class="context-bar-stats"><span class="stat-add">+<!--$-->', '<!--/--></span><span class="stat-del">\u2212<!--$-->', '<!--/--></span></span><a class="context-bar-link"', ' target="_blank" rel="noreferrer">GitHub<!--$-->', "<!--/--></a></div></header>"];
const B = (t) => `state-pill state-${t.toLowerCase()}`;
function K(t) {
  return ssr(H, ssrHydrationKey(), escape(t.pr.number), ssrAttribute("title", escape(t.pr.title, true), false), escape(t.pr.title), ssrAttribute("class", escape(B(t.pr.state), true), false), escape(t.pr.state), escape(createComponent(f1, { name: "branch", size: 14 })), escape(t.pr.baseRefName), escape(t.pr.headRefName), escape(t.pr.additions), escape(t.pr.deletions), ssrAttribute("href", escape(t.pr.url, true), false), escape(createComponent(f1, { name: "external", size: 14 })));
}
var j = ["<p", ' class="ai-chat-hint">Ask anything about the changes, the diff, or why something was done.</p>'], G = ["<div", ' class="ai-chat-message ai-chat-message-assistant ai-chat-message-streaming"><p>', "</p></div>"], J = ["<aside", ' class="ai-chat-panel" aria-label="AI chat"><div class="ai-chat-header"><h2 class="ai-chat-title"><!--$-->', '<!--/-->Ask about this PR</h2><button type="button" class="ai-chat-close" aria-label="Close chat">', '</button></div><div class="ai-chat-messages"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", '<!--/--></div><form class="ai-chat-form"><div class="ai-chat-input-row"><input id="ai-chat-input" class="ai-chat-input" placeholder="Ask about this PR"', "", '><button type="submit" class="ai-chat-submit"', ' aria-label="Send message">', "</button></div></form></aside>"], Q = ["<div", ' class="', '"><button type="button" class="ai-chat-toggle"', "><!--$-->", "<!--/--><span>Ask AI</span></button><!--$-->", "<!--/--></div>"], V = ["<div", ' class="', '"><p>', "</p></div>"];
function W(t) {
  const { store: s, sendAiChat: c } = mt(), [l, d] = createSignal(false), [r, o] = createSignal("");
  return ssr(Q, ssrHydrationKey(), `ai-chat ${l() ? "ai-chat-open" : ""}`, ssrAttribute("aria-expanded", escape(l(), true), false), escape(createComponent(f1, { name: "robot", size: 18 })), escape(createComponent(Show, { get when() {
    return l();
  }, get children() {
    return ssr(J, ssrHydrationKey(), escape(createComponent(f1, { name: "robot", size: 16 })), escape(createComponent(f1, { name: "close", size: 16 })), escape(createComponent(Show, { get when() {
      return s.aiChat.messages.length === 0 && !s.aiChat.loading;
    }, get children() {
      return ssr(j, ssrHydrationKey());
    } })), escape(createComponent(For, { get each() {
      return s.aiChat.messages;
    }, children: (v) => ssr(V, ssrHydrationKey(), `ai-chat-message ai-chat-message-${escape(v.role, true)}`, escape(v.content)) })), escape(createComponent(Show, { get when() {
      return s.aiChat.loading && s.aiChat.streamingContent;
    }, get children() {
      return ssr(G, ssrHydrationKey(), escape(s.aiChat.streamingContent));
    } })), ssrAttribute("value", escape(r(), true), false), ssrAttribute("disabled", s.aiChat.loading, true), ssrAttribute("disabled", s.aiChat.loading || !r().trim(), true), escape(createComponent(f1, { name: "send", size: 16 })));
  } })));
}
const f = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: true }), X = (_a = f.renderer.rules.link_open) != null ? _a : ((t, s, c, l, d) => d.renderToken(t, s, c));
f.renderer.rules.link_open = (t, s, c, l, d) => {
  const r = t[s];
  return r.attrSet("target", "_blank"), r.attrSet("rel", "noopener noreferrer"), X(t, s, c, l, d);
};
function Y(t) {
  return (t == null ? void 0 : t.trim()) ? f.render(t) : "";
}
var Z = ["<div", ' class="', '">', "</div>"];
function ee(t) {
  var _a2;
  const s = createMemo(() => Y(t.source));
  return ssr(Z, ssrHydrationKey(), `markdown-body ${escape((_a2 = t.class) != null ? _a2 : "", true)}`, s());
}
var te = ["<div", ' class="pr-labels">', "</div>"], se = ["<section", ' id="section-overview" class="canvas-section"><div class="pr-card overview-card"><dl class="overview-facts"><div class="overview-fact"><dt>Author</dt><dd class="overview-author"><!--$-->', "<!--/--><!--$-->", '<!--/--></dd></div><div class="overview-fact"><dt>Created</dt><dd>', '</dd></div><div class="overview-fact"><dt>Updated</dt><dd>', "</dd></div></dl><!--$-->", '<!--/--></div><div class="pr-card pr-body-card"><h2 class="section-subtitle">Description</h2><!--$-->', "<!--/--></div></section>"], ae = ["<span", ' class="pr-label" style="', '">', "</span>"], ne = ["<p", ' class="empty-copy">No description provided.</p>'];
const b = (t) => t ? new Date(t).toLocaleString() : "Unknown";
function ie(t) {
  return { "--label-color": `#${(t == null ? void 0 : t.replace("#", "")) || "8b949e"}` };
}
function re(t) {
  const s = () => t.pr.body.trim().length > 0;
  return ssr(se, ssrHydrationKey(), escape(createComponent(f1, { name: "user", size: 15 })), escape(t.pr.author.login), escape(b(t.pr.createdAt)), escape(b(t.pr.updatedAt)), escape(createComponent(Show, { get when() {
    return t.pr.labels.length > 0;
  }, get children() {
    return ssr(te, ssrHydrationKey(), escape(createComponent(For, { get each() {
      return t.pr.labels;
    }, children: (c) => ssr(ae, ssrHydrationKey(), ssrStyle(ie(c.color)), escape(c.name)) })));
  } })), escape(createComponent(Show, { get when() {
    return s();
  }, get fallback() {
    return ssr(ne, ssrHydrationKey());
  }, get children() {
    return createComponent(ee, { get source() {
      return t.pr.body;
    } });
  } })));
}
var ce = ["<section", ' id="section-file-tree" class="canvas-section"><div class="section-header"><h2 class="section-title">Files Changed</h2><span class="section-count"><!--$-->', "<!--/--> file<!--$-->", '<!--/--></span></div><div class="pierre-tree-container" style="', '"></div></section>'];
function le(t) {
  createEffect(on(() => t.files, async (l) => {
  }));
  const s = () => {
    var _a2, _b;
    return (_b = (_a2 = t.files) == null ? void 0 : _a2.length) != null ? _b : 0;
  }, c = () => Math.min(s() * 28 + 40, 500);
  return ssr(ce, ssrHydrationKey(), escape(s()), s() !== 1 ? "s" : "", ssrStyleProperty("min-height:", `${escape(c(), true)}px`));
}
var oe = ["<section", ' id="section-mind-map" class="canvas-section mind-map-section"><div class="section-header"><h2 class="section-title">Mind Map</h2></div><div class="mind-map-grid">', "</div></section>"], de = ["<article", ' class="pr-card mind-map-card"><div class="mind-map-card-header"><span class="', '">', '</span><h3 class="mind-map-title">', '</h3></div><p class="mind-map-description">', '</p><ul class="mind-map-files">', "</ul></article>"], me = ["<li", ' class="mind-map-file">', "</li>"];
function ue(t) {
  return ssr(oe, ssrHydrationKey(), escape(createComponent(For, { get each() {
    return t.groups;
  }, children: (s) => ssr(de, ssrHydrationKey(), `change-type-badge change-type-${escape(s.changeType, true)}`, escape(s.changeType), escape(s.label), escape(s.description), escape(createComponent(For, { get each() {
    return s.files;
  }, children: (c) => ssr(me, ssrHydrationKey(), escape(c)) }))) })));
}
var he = ["<section", ' id="section-diff-preview" class="canvas-section"><div class="section-header-row"><h2 class="section-title">Diff</h2><button type="button" class="pierre-control-btn">', '</button></div><div class="pierre-diffs-container"></div></section>'];
function pe(t) {
  const [s, c] = createSignal("unified");
  async function l(d, r) {
  }
  return createEffect(on(() => [t.rawDiff, s()], ([d, r]) => {
    d && l();
  })), ssr(he, ssrHydrationKey(), s() === "unified" ? "Split view" : "Unified view");
}
var ve = ["<span", ' class="summary-pill summary-failure"><!--$-->', "<!--/--><!--$-->", "<!--/--> failing</span>"], ge = ["<span", ' class="summary-pill summary-pending"><!--$-->', "<!--/--><!--$-->", "<!--/--> pending</span>"], $e = ["<span", ' class="summary-pill summary-success"><!--$-->', "<!--/--><!--$-->", "<!--/--> passed</span>"], fe = ["<ul", ' class="checks-list">', "</ul>"], be = ["<section", ' id="section-checks" class="canvas-section"><div class="section-header"><h2 class="section-title">CI Checks</h2><div class="checks-summary"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div></div><!--$-->", "<!--/--></section>"], ye = ["<div", ' class="pr-card empty-copy-card">No CI checks reported.</div>'], we = ["<p", ' class="check-description">', "</p>"], ke = ["<a", ' class="check-details-link"', ' target="_blank" rel="noreferrer">Details<!--$-->', "<!--/--></a>"], _e = ["<li", ' class="check-item"', '><span class="', '">', '</span><div class="check-content"><h3 class="check-name">', "</h3><!--$-->", "<!--/--></div><!--$-->", "<!--/--></li>"];
const R = (t) => t.toUpperCase() === "SUCCESS", I = (t) => ["FAILURE", "FAILED", "ERROR"].includes(t.toUpperCase()), $ = (t) => R(t) ? "success" : I(t) ? "failure" : "pending", y = { failure: 0, pending: 1, success: 2 };
function Ce(t) {
  const s = createMemo(() => [...t.checks].sort((r, o) => y[$(r.state)] - y[$(o.state)])), c = () => t.checks.filter((r) => R(r.state)).length, l = () => t.checks.filter((r) => I(r.state)).length, d = () => t.checks.length - c() - l();
  return ssr(be, ssrHydrationKey(), escape(createComponent(Show, { get when() {
    return l() > 0;
  }, get children() {
    return ssr(ve, ssrHydrationKey(), escape(createComponent(f1, { name: "cross", size: 13 })), escape(l()));
  } })), escape(createComponent(Show, { get when() {
    return d() > 0;
  }, get children() {
    return ssr(ge, ssrHydrationKey(), escape(createComponent(f1, { name: "dot", size: 13 })), escape(d()));
  } })), escape(createComponent(Show, { get when() {
    return c() > 0;
  }, get children() {
    return ssr($e, ssrHydrationKey(), escape(createComponent(f1, { name: "check", size: 13 })), escape(c()));
  } })), escape(createComponent(Show, { get when() {
    return t.checks.length > 0;
  }, get fallback() {
    return ssr(ye, ssrHydrationKey());
  }, get children() {
    return ssr(fe, ssrHydrationKey(), escape(createComponent(For, { get each() {
      return s();
    }, children: (r) => {
      const o = $(r.state);
      return ssr(_e, ssrHydrationKey(), ssrAttribute("data-status", escape(o, true), false), `check-icon check-${escape(o, true)}`, escape(createComponent(f1, { name: o === "success" ? "check" : o === "failure" ? "cross" : "dot", size: 14 })), escape(r.name), escape(createComponent(Show, { get when() {
        return r.description;
      }, get children() {
        return ssr(we, ssrHydrationKey(), escape(r.description));
      } })), escape(createComponent(Show, { get when() {
        return r.detailsUrl;
      }, get children() {
        return ssr(ke, ssrHydrationKey(), ssrAttribute("href", escape(r.detailsUrl, true), false), escape(createComponent(f1, { name: "external", size: 13 })));
      } })));
    } })));
  } })));
}
var Se = ["<section", ' id="section-comments" class="canvas-section comments-section"><div class="section-header"><h2 class="section-title">Comments</h2></div><div class="reviews-list"><h3 class="section-subtitle">Reviews</h3><!--$-->', '<!--/--></div><div class="pr-comments-list"><h3 class="section-subtitle">PR comments</h3><!--$-->', "<!--/--></div></section>"], Ae = ["<p", ' class="empty-copy">No reviews yet.</p>'], xe = ["<p", ' class="comment-body">', "</p>"], Re = ["<article", ' class="pr-card review-item"><div class="comment-header"><span class="', '">', '</span><span class="comment-author">', '</span><time class="comment-date">', "</time></div><!--$-->", '<!--/--><div class="inline-comments-list">', "</div></article>"], Ie = ["<span", ' class="comment-location"><!--$-->', "<!--/-->:<!--$-->", "<!--/--></span>"], De = ["<div", ' class="inline-comment"><div class="comment-header"><span class="comment-author">', "</span><!--$-->", '<!--/--></div><p class="comment-body">', "</p></div>"], Me = ["<p", ' class="empty-copy">No PR comments yet.</p>'], Ue = ["<article", ' class="pr-card comment-item"><div class="comment-header"><span class="comment-author">', '</span><time class="comment-date">', '</time></div><p class="comment-body">', "</p></article>"];
const w = (t) => t ? new Date(t).toLocaleString() : "Unknown";
function ze(t) {
  return ssr(Se, ssrHydrationKey(), escape(createComponent(For, { get each() {
    return t.reviews;
  }, get fallback() {
    return ssr(Ae, ssrHydrationKey());
  }, children: (s) => ssr(Re, ssrHydrationKey(), `review-state review-state-${escape(s.state.toLowerCase(), true)}`, escape(s.state), escape(s.author.login), escape(w(s.createdAt)), escape(createComponent(Show, { get when() {
    return s.body;
  }, get children() {
    return ssr(xe, ssrHydrationKey(), escape(s.body));
  } })), escape(createComponent(For, { get each() {
    return s.comments;
  }, children: (c) => ssr(De, ssrHydrationKey(), escape(c.author.login), escape(createComponent(Show, { get when() {
    return c.path;
  }, get children() {
    return ssr(Ie, ssrHydrationKey(), escape(c.path), escape(c.line));
  } })), escape(c.body)) }))) })), escape(createComponent(For, { get each() {
    return t.comments;
  }, get fallback() {
    return ssr(Me, ssrHydrationKey());
  }, children: (s) => ssr(Ue, ssrHydrationKey(), escape(s.author.login), escape(w(s.createdAt)), escape(s.body)) })));
}
var Ee = ["<section", ' id="section-ai-summary" class="canvas-section ai-summary-section"><div class="section-header"><h2 class="section-title">AI Summary</h2></div><div class="ai-summary-grid"><article class="pr-card ai-summary-block"><h3 class="section-subtitle">Purpose</h3><p>', '</p></article><article class="pr-card ai-summary-block"><h3 class="section-subtitle">Impact</h3><p>', '</p></article><article class="pr-card ai-summary-block"><h3 class="section-subtitle">Highlights</h3><ul class="ai-summary-list">', '</ul></article><article class="pr-card ai-summary-block ai-summary-concerns"><h3 class="section-subtitle">Concerns</h3><ul class="ai-summary-list warning-list">', "</ul></article></div></section>"], k = ["<li", ">", "</li>"];
function Le(t) {
  return ssr(Ee, ssrHydrationKey(), escape(t.summary.purpose), escape(t.summary.impact), escape(createComponent(For, { get each() {
    return t.summary.highlights;
  }, children: (s) => ssr(k, ssrHydrationKey(), escape(s)) })), escape(createComponent(For, { get each() {
    return t.summary.concerns;
  }, children: (s) => ssr(k, ssrHydrationKey(), escape(s)) })));
}
var Pe = ["<div", ' class="error-banner" role="alert">', "</div>"], Fe = ["<div", ' class="pr-canvas-layout"><!--$-->', "<!--/--><!--$-->", '<!--/--><main class="pr-canvas-main"><!--$-->', "<!--/--><!--$-->", "<!--/--></main><!--$-->", "<!--/--></div>"], Ne = ["<aside", ' class="canvas-sidebar canvas-sidebar-empty"></aside>'], Oe = ["<div", ' class="canvas-content"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"], Te = ["<p", ">Can't reach the PR Canvas server.</p>"], qe = ["<p", ' class="loading-hint">Make sure <code>/pr-canvas start</code> is running, then reload this page.</p>'], He = ["<div", ' class="loading-state">', "</div>"], Be = ["<div", ' class="spinner"></div>'], Ke = ["<p", ">Loading pull request...</p>"], je = ["<div", ' class="empty-state"><p>Pull request data is not available.</p></div>'];
const Ge = ["FAILURE", "FAILED", "ERROR"];
function Je(t) {
  const s = t.data.files.length, c = t.mindMap.length, l = t.data.checks.filter((v) => Ge.includes(v.state.toUpperCase())).length, d = t.data.checks.filter((v) => v.state.toUpperCase() === "SUCCESS").length, r = t.data.comments.length + t.data.reviews.length, o = t.aiSummary.concerns.length;
  return [{ id: "section-overview", label: "Overview", icon: "overview" }, { id: "section-file-tree", label: "Files", icon: "files", badge: s ? { text: String(s), tone: "default" } : void 0 }, { id: "section-mind-map", label: "Mind Map", icon: "mind-map", badge: c ? { text: String(c), tone: "default" } : void 0 }, { id: "section-diff-preview", label: "Diffs", icon: "diff" }, { id: "section-checks", label: "CI Checks", icon: "checks", badge: l > 0 ? { text: String(l), tone: "danger" } : d > 0 ? { text: String(d), tone: "success" } : void 0 }, { id: "section-comments", label: "Comments", icon: "comments", badge: r ? { text: String(r), tone: "default" } : void 0 }, { id: "section-ai-summary", label: "AI Summary", icon: "summary", badge: o ? { text: String(o), tone: "warning" } : void 0 }];
}
function st() {
  const t = ct(), { store: s, loadPr: c, subscribePr: l, connectionStatus: d } = mt(), r = () => Number(t.number);
  return ssr(Fe, ssrHydrationKey(), escape(createComponent(ht, { get children() {
    return ["PR #", t.number, " \xB7 PR Canvas"];
  } })), escape(createComponent(Show, { get when() {
    return s.currentPr;
  }, get fallback() {
    return ssr(Ne, ssrHydrationKey());
  }, children: (o) => createComponent(q, { get sections() {
    return Je(o());
  } }) })), escape(createComponent(Show, { get when() {
    return s.error;
  }, get children() {
    return ssr(Pe, ssrHydrationKey(), escape(s.error));
  } })), escape(createComponent(Show, { get when() {
    return !s.loading;
  }, get fallback() {
    return createComponent(Qe, { get status() {
      return d();
    } });
  }, get children() {
    return createComponent(Show, { get when() {
      return s.currentPr;
    }, get fallback() {
      return createComponent(Ve, {});
    }, children: (o) => [createComponent(K, { get pr() {
      return o().data.overview;
    } }), ssr(Oe, ssrHydrationKey(), escape(createComponent(re, { get pr() {
      return o().data.overview;
    } })), escape(createComponent(le, { get files() {
      return o().data.files;
    } })), escape(createComponent(ue, { get groups() {
      return o().mindMap;
    } })), escape(createComponent(pe, { get rawDiff() {
      return o().rawDiff;
    } })), escape(createComponent(Ce, { get checks() {
      return o().data.checks;
    } })), escape(createComponent(ze, { get comments() {
      return o().data.comments;
    }, get reviews() {
      return o().data.reviews;
    } })), escape(createComponent(Le, { get summary() {
      return o().aiSummary;
    } })))] });
  } })), escape(createComponent(W, { get prNumber() {
    return r();
  } })));
}
function Qe(t) {
  return ssr(He, ssrHydrationKey(), escape(createComponent(Show, { get when() {
    return t.status === "closed";
  }, get fallback() {
    return [ssr(Be, ssrHydrationKey()), ssr(Ke, ssrHydrationKey())];
  }, get children() {
    return [ssr(Te, ssrHydrationKey()), ssr(qe, ssrHydrationKey())];
  } })));
}
function Ve() {
  return ssr(je, ssrHydrationKey());
}

export { st as default };
//# sourceMappingURL=_number_.mjs.map
