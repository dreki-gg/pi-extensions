import { D as ssr, p as escape, f as createComponent, H as ssrHydrationKey, S as Show, l as createSignal, F as For, E as ssrAttribute, I as ssrStyle, i as createMemo } from '../nitro/nitro.mjs';
import { d as ct, m as mt, h as ht } from './context-DYtVF_Lv.mjs';
import { f as f1, u as u1 } from './Icon-BaqE27Xx.mjs';
import { d } from './ContextBar-CG7B5UuO.mjs';
import { M as MarkdownIt } from '../_/index2.mjs';
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
var N = ["<span", ">All pull requests</span>"], D = ["<aside", ' class="canvas-sidebar"><!--$-->', '<!--/--><nav class="sidebar-nav" aria-label="Pull request sections">', "</nav></aside>"], F = ["<span", ' class="sidebar-nav-icon">', "</span>"], O = ["<span", ' class="sidebar-nav-label">', "</span>"], T = ["<span", ' class="sidebar-badge"', ">", "</span>"], q = ["<button", ' type="button" class="', '"', ">", "</button>"];
function B(t) {
  var _a2, _b;
  const [s, c] = createSignal((_b = (_a2 = t.sections[0]) == null ? void 0 : _a2.id) != null ? _b : "");
  return ssr(D, ssrHydrationKey(), escape(createComponent(u1, { href: "/", class: "sidebar-back", get children() {
    return [createComponent(f1, { name: "back", size: 16 }), ssr(N, ssrHydrationKey())];
  } })), escape(createComponent(For, { get each() {
    return t.sections;
  }, children: (l) => {
    const m = [ssr(F, ssrHydrationKey(), escape(createComponent(f1, { get name() {
      return l.icon;
    }, size: 18 }))), ssr(O, ssrHydrationKey(), escape(l.label)), createComponent(Show, { get when() {
      return l.badge;
    }, children: (i) => ssr(T, ssrHydrationKey(), ssrAttribute("data-tone", escape(i().tone, true), false), escape(i().text)) })];
    return createComponent(Show, { get when() {
      return l.href;
    }, get fallback() {
      return ssr(q, ssrHydrationKey(), `sidebar-nav-link ${s() === l.id ? "sidebar-nav-link-active" : ""}`, ssrAttribute("aria-current", s() === l.id ? "true" : escape(void 0, true), false), escape(m));
    }, children: (i) => createComponent(u1, { get href() {
      return i();
    }, class: "sidebar-nav-link sidebar-nav-link-route", children: m }) });
  } })));
}
var H = ["<p", ' class="ai-chat-hint">Ask anything about the changes, the diff, or why something was done.</p>'], K = ["<div", ' class="ai-chat-message ai-chat-message-assistant ai-chat-message-streaming"><p>', "</p></div>"], j = ["<aside", ' class="ai-chat-panel" aria-label="AI chat"><div class="ai-chat-header"><h2 class="ai-chat-title"><!--$-->', '<!--/-->Ask about this PR</h2><button type="button" class="ai-chat-close" aria-label="Close chat">', '</button></div><div class="ai-chat-messages"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", '<!--/--></div><form class="ai-chat-form"><div class="ai-chat-input-row"><input id="ai-chat-input" class="ai-chat-input" placeholder="Ask about this PR"', "", '><button type="submit" class="ai-chat-submit"', ' aria-label="Send message">', "</button></div></form></aside>"], G = ["<div", ' class="', '"><button type="button" class="ai-chat-toggle"', "><!--$-->", "<!--/--><span>Ask AI</span></button><!--$-->", "<!--/--></div>"], J = ["<div", ' class="', '"><p>', "</p></div>"];
function Q(t) {
  const { store: s, sendAiChat: c } = mt(), [l, m] = createSignal(false), [i, o] = createSignal("");
  return ssr(G, ssrHydrationKey(), `ai-chat ${l() ? "ai-chat-open" : ""}`, ssrAttribute("aria-expanded", escape(l(), true), false), escape(createComponent(f1, { name: "robot", size: 18 })), escape(createComponent(Show, { get when() {
    return l();
  }, get children() {
    return ssr(j, ssrHydrationKey(), escape(createComponent(f1, { name: "robot", size: 16 })), escape(createComponent(f1, { name: "close", size: 16 })), escape(createComponent(Show, { get when() {
      return s.aiChat.messages.length === 0 && !s.aiChat.loading;
    }, get children() {
      return ssr(H, ssrHydrationKey());
    } })), escape(createComponent(For, { get each() {
      return s.aiChat.messages;
    }, children: (g) => ssr(J, ssrHydrationKey(), `ai-chat-message ai-chat-message-${escape(g.role, true)}`, escape(g.content)) })), escape(createComponent(Show, { get when() {
      return s.aiChat.loading && s.aiChat.streamingContent;
    }, get children() {
      return ssr(K, ssrHydrationKey(), escape(s.aiChat.streamingContent));
    } })), ssrAttribute("value", escape(i(), true), false), ssrAttribute("disabled", s.aiChat.loading, true), ssrAttribute("disabled", s.aiChat.loading || !i().trim(), true), escape(createComponent(f1, { name: "send", size: 16 })));
  } })));
}
const f = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: true }), V = (_a = f.renderer.rules.link_open) != null ? _a : ((t, s, c, l, m) => m.renderToken(t, s, c));
f.renderer.rules.link_open = (t, s, c, l, m) => {
  const i = t[s];
  return i.attrSet("target", "_blank"), i.attrSet("rel", "noopener noreferrer"), V(t, s, c, l, m);
};
function W(t) {
  return (t == null ? void 0 : t.trim()) ? f.render(t) : "";
}
var X = ["<div", ' class="', '">', "</div>"];
function Y(t) {
  var _a2;
  const s = createMemo(() => W(t.source));
  return ssr(X, ssrHydrationKey(), `markdown-body ${escape((_a2 = t.class) != null ? _a2 : "", true)}`, s());
}
var Z = ["<div", ' class="pr-labels">', "</div>"], ee = ["<section", ' id="section-overview" class="canvas-section"><div class="pr-card overview-card"><dl class="overview-facts"><div class="overview-fact"><dt>Author</dt><dd class="overview-author"><!--$-->', "<!--/--><!--$-->", '<!--/--></dd></div><div class="overview-fact"><dt>Created</dt><dd>', '</dd></div><div class="overview-fact"><dt>Updated</dt><dd>', "</dd></div></dl><!--$-->", '<!--/--></div><div class="pr-card pr-body-card"><h2 class="section-subtitle">Description</h2><!--$-->', "<!--/--></div></section>"], te = ["<span", ' class="pr-label" style="', '">', "</span>"], ae = ["<p", ' class="empty-copy">No description provided.</p>'];
const k = (t) => t ? new Date(t).toLocaleString() : "Unknown";
function se(t) {
  return { "--label-color": `#${(t == null ? void 0 : t.replace("#", "")) || "8b949e"}` };
}
function ne(t) {
  const s = () => t.pr.body.trim().length > 0;
  return ssr(ee, ssrHydrationKey(), escape(createComponent(f1, { name: "user", size: 15 })), escape(t.pr.author.login), escape(k(t.pr.createdAt)), escape(k(t.pr.updatedAt)), escape(createComponent(Show, { get when() {
    return t.pr.labels.length > 0;
  }, get children() {
    return ssr(Z, ssrHydrationKey(), escape(createComponent(For, { get each() {
      return t.pr.labels;
    }, children: (c) => ssr(te, ssrHydrationKey(), ssrStyle(se(c.color)), escape(c.name)) })));
  } })), escape(createComponent(Show, { get when() {
    return s();
  }, get fallback() {
    return ssr(ae, ssrHydrationKey());
  }, get children() {
    return createComponent(Y, { get source() {
      return t.pr.body;
    } });
  } })));
}
var re = ["<section", ' id="section-mind-map" class="canvas-section mind-map-section"><div class="section-header"><h2 class="section-title">Mind Map</h2></div><div class="mind-map-grid">', "</div></section>"], ie = ["<article", ' class="pr-card mind-map-card"><div class="mind-map-card-header"><span class="', '">', '</span><h3 class="mind-map-title">', '</h3></div><p class="mind-map-description">', '</p><ul class="mind-map-files">', "</ul></article>"], ce = ["<li", ' class="mind-map-file">', "</li>"];
function le(t) {
  return ssr(re, ssrHydrationKey(), escape(createComponent(For, { get each() {
    return t.groups;
  }, children: (s) => ssr(ie, ssrHydrationKey(), `change-type-badge change-type-${escape(s.changeType, true)}`, escape(s.changeType), escape(s.label), escape(s.description), escape(createComponent(For, { get each() {
    return s.files;
  }, children: (c) => ssr(ce, ssrHydrationKey(), escape(c)) }))) })));
}
var oe = ["<span", ' class="summary-pill summary-failure"><!--$-->', "<!--/--><!--$-->", "<!--/--> failing</span>"], de = ["<span", ' class="summary-pill summary-pending"><!--$-->', "<!--/--><!--$-->", "<!--/--> pending</span>"], me = ["<span", ' class="summary-pill summary-success"><!--$-->', "<!--/--><!--$-->", "<!--/--> passed</span>"], ue = ["<ul", ' class="checks-list">', "</ul>"], he = ["<section", ' id="section-checks" class="canvas-section"><div class="section-header"><h2 class="section-title">CI Checks</h2><div class="checks-summary"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div></div><!--$-->", "<!--/--></section>"], pe = ["<div", ' class="pr-card empty-copy-card">No CI checks reported.</div>'], ge = ["<p", ' class="check-description">', "</p>"], ve = ["<a", ' class="check-details-link"', ' target="_blank" rel="noreferrer">Details<!--$-->', "<!--/--></a>"], $e = ["<li", ' class="check-item"', '><span class="', '">', '</span><div class="check-content"><h3 class="check-name">', "</h3><!--$-->", "<!--/--></div><!--$-->", "<!--/--></li>"];
const I = (t) => t.toUpperCase() === "SUCCESS", M = (t) => ["FAILURE", "FAILED", "ERROR"].includes(t.toUpperCase()), $ = (t) => I(t) ? "success" : M(t) ? "failure" : "pending", w = { failure: 0, pending: 1, success: 2 };
function be(t) {
  const s = createMemo(() => [...t.checks].sort((i, o) => w[$(i.state)] - w[$(o.state)])), c = () => t.checks.filter((i) => I(i.state)).length, l = () => t.checks.filter((i) => M(i.state)).length, m = () => t.checks.length - c() - l();
  return ssr(he, ssrHydrationKey(), escape(createComponent(Show, { get when() {
    return l() > 0;
  }, get children() {
    return ssr(oe, ssrHydrationKey(), escape(createComponent(f1, { name: "cross", size: 13 })), escape(l()));
  } })), escape(createComponent(Show, { get when() {
    return m() > 0;
  }, get children() {
    return ssr(de, ssrHydrationKey(), escape(createComponent(f1, { name: "dot", size: 13 })), escape(m()));
  } })), escape(createComponent(Show, { get when() {
    return c() > 0;
  }, get children() {
    return ssr(me, ssrHydrationKey(), escape(createComponent(f1, { name: "check", size: 13 })), escape(c()));
  } })), escape(createComponent(Show, { get when() {
    return t.checks.length > 0;
  }, get fallback() {
    return ssr(pe, ssrHydrationKey());
  }, get children() {
    return ssr(ue, ssrHydrationKey(), escape(createComponent(For, { get each() {
      return s();
    }, children: (i) => {
      const o = $(i.state);
      return ssr($e, ssrHydrationKey(), ssrAttribute("data-status", escape(o, true), false), `check-icon check-${escape(o, true)}`, escape(createComponent(f1, { name: o === "success" ? "check" : o === "failure" ? "cross" : "dot", size: 14 })), escape(i.name), escape(createComponent(Show, { get when() {
        return i.description;
      }, get children() {
        return ssr(ge, ssrHydrationKey(), escape(i.description));
      } })), escape(createComponent(Show, { get when() {
        return i.detailsUrl;
      }, get children() {
        return ssr(ve, ssrHydrationKey(), ssrAttribute("href", escape(i.detailsUrl, true), false), escape(createComponent(f1, { name: "external", size: 13 })));
      } })));
    } })));
  } })));
}
var fe = ["<section", ' id="section-comments" class="canvas-section comments-section"><div class="section-header"><h2 class="section-title">Comments</h2></div><div class="reviews-list"><h3 class="section-subtitle">Reviews</h3><!--$-->', '<!--/--></div><div class="pr-comments-list"><h3 class="section-subtitle">PR comments</h3><!--$-->', "<!--/--></div></section>"], ye = ["<p", ' class="empty-copy">No reviews yet.</p>'], ke = ["<p", ' class="comment-body">', "</p>"], we = ["<article", ' class="pr-card review-item"><div class="comment-header"><span class="', '">', '</span><span class="comment-author">', '</span><time class="comment-date">', "</time></div><!--$-->", '<!--/--><div class="inline-comments-list">', "</div></article>"], _e = ["<span", ' class="comment-location"><!--$-->', "<!--/-->:<!--$-->", "<!--/--></span>"], Ce = ["<div", ' class="inline-comment"><div class="comment-header"><span class="comment-author">', "</span><!--$-->", '<!--/--></div><p class="comment-body">', "</p></div>"], Se = ["<p", ' class="empty-copy">No PR comments yet.</p>'], Ae = ["<article", ' class="pr-card comment-item"><div class="comment-header"><span class="comment-author">', '</span><time class="comment-date">', '</time></div><p class="comment-body">', "</p></article>"];
const _ = (t) => t ? new Date(t).toLocaleString() : "Unknown";
function Re(t) {
  return ssr(fe, ssrHydrationKey(), escape(createComponent(For, { get each() {
    return t.reviews;
  }, get fallback() {
    return ssr(ye, ssrHydrationKey());
  }, children: (s) => ssr(we, ssrHydrationKey(), `review-state review-state-${escape(s.state.toLowerCase(), true)}`, escape(s.state), escape(s.author.login), escape(_(s.createdAt)), escape(createComponent(Show, { get when() {
    return s.body;
  }, get children() {
    return ssr(ke, ssrHydrationKey(), escape(s.body));
  } })), escape(createComponent(For, { get each() {
    return s.comments;
  }, children: (c) => ssr(Ce, ssrHydrationKey(), escape(c.author.login), escape(createComponent(Show, { get when() {
    return c.path;
  }, get children() {
    return ssr(_e, ssrHydrationKey(), escape(c.path), escape(c.line));
  } })), escape(c.body)) }))) })), escape(createComponent(For, { get each() {
    return t.comments;
  }, get fallback() {
    return ssr(Se, ssrHydrationKey());
  }, children: (s) => ssr(Ae, ssrHydrationKey(), escape(s.author.login), escape(_(s.createdAt)), escape(s.body)) })));
}
var Ie = ["<section", ' id="section-ai-summary" class="canvas-section ai-summary-section"><div class="section-header"><h2 class="section-title">AI Summary</h2></div><div class="ai-summary-grid"><article class="pr-card ai-summary-block"><h3 class="section-subtitle">Purpose</h3><p>', '</p></article><article class="pr-card ai-summary-block"><h3 class="section-subtitle">Impact</h3><p>', '</p></article><article class="pr-card ai-summary-block"><h3 class="section-subtitle">Highlights</h3><ul class="ai-summary-list">', '</ul></article><article class="pr-card ai-summary-block ai-summary-concerns"><h3 class="section-subtitle">Concerns</h3><ul class="ai-summary-list warning-list">', "</ul></article></div></section>"], C = ["<li", ">", "</li>"];
function Me(t) {
  return ssr(Ie, ssrHydrationKey(), escape(t.summary.purpose), escape(t.summary.impact), escape(createComponent(For, { get each() {
    return t.summary.highlights;
  }, children: (s) => ssr(C, ssrHydrationKey(), escape(s)) })), escape(createComponent(For, { get each() {
    return t.summary.concerns;
  }, children: (s) => ssr(C, ssrHydrationKey(), escape(s)) })));
}
var xe = ["<div", ' class="error-banner" role="alert">', "</div>"], Ue = ["<div", ' class="pr-canvas-layout"><!--$-->', "<!--/--><!--$-->", '<!--/--><main class="pr-canvas-main"><!--$-->', "<!--/--><!--$-->", "<!--/--></main><!--$-->", "<!--/--></div>"], ze = ["<aside", ' class="canvas-sidebar canvas-sidebar-empty"></aside>'], Ee = ["<div", ' class="canvas-content"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"], Le = ["<p", ">Can't reach the PR Canvas server.</p>"], Pe = ["<p", ' class="loading-hint">Make sure <code>/pr-canvas start</code> is running, then reload this page.</p>'], Ne = ["<div", ' class="loading-state">', "</div>"], De = ["<div", ' class="spinner"></div>'], Fe = ["<p", ">Loading pull request...</p>"], Oe = ["<div", ' class="empty-state"><p>Pull request data is not available.</p></div>'];
const Te = ["FAILURE", "FAILED", "ERROR"];
function qe(t) {
  const s = t.number, c = t.data.files.length, l = t.mindMap.length, m = t.data.checks.filter((v) => Te.includes(v.state.toUpperCase())).length, i = t.data.checks.filter((v) => v.state.toUpperCase() === "SUCCESS").length, o = t.data.comments.length + t.data.reviews.length, g = t.aiSummary.concerns.length;
  return [{ id: "section-overview", label: "Overview", icon: "overview" }, { id: "files-changed", label: "Files changed", icon: "files", href: `/pr/${s}/files`, badge: c ? { text: String(c), tone: "default" } : void 0 }, { id: "section-mind-map", label: "Mind Map", icon: "mind-map", badge: l ? { text: String(l), tone: "default" } : void 0 }, { id: "section-checks", label: "CI Checks", icon: "checks", badge: m > 0 ? { text: String(m), tone: "danger" } : i > 0 ? { text: String(i), tone: "success" } : void 0 }, { id: "section-comments", label: "Comments", icon: "comments", badge: o ? { text: String(o), tone: "default" } : void 0 }, { id: "section-ai-summary", label: "AI Summary", icon: "summary", badge: g ? { text: String(g), tone: "warning" } : void 0 }];
}
function Xe() {
  const t = ct(), { store: s, loadPr: c, subscribePr: l, connectionStatus: m } = mt(), i = () => Number(t.number);
  return ssr(Ue, ssrHydrationKey(), escape(createComponent(ht, { get children() {
    return ["PR #", t.number, " \xB7 PR Canvas"];
  } })), escape(createComponent(Show, { get when() {
    return s.currentPr;
  }, get fallback() {
    return ssr(ze, ssrHydrationKey());
  }, children: (o) => createComponent(B, { get sections() {
    return qe(o());
  } }) })), escape(createComponent(Show, { get when() {
    return s.error;
  }, get children() {
    return ssr(xe, ssrHydrationKey(), escape(s.error));
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
      return createComponent(He, {});
    }, children: (o) => [createComponent(d, { get pr() {
      return o().data.overview;
    } }), ssr(Ee, ssrHydrationKey(), escape(createComponent(ne, { get pr() {
      return o().data.overview;
    } })), escape(createComponent(le, { get groups() {
      return o().mindMap;
    } })), escape(createComponent(be, { get checks() {
      return o().data.checks;
    } })), escape(createComponent(Re, { get comments() {
      return o().data.comments;
    }, get reviews() {
      return o().data.reviews;
    } })), escape(createComponent(Me, { get summary() {
      return o().aiSummary;
    } })))] });
  } })), escape(createComponent(Q, { get prNumber() {
    return i();
  } })));
}
function Be(t) {
  return ssr(Ne, ssrHydrationKey(), escape(createComponent(Show, { get when() {
    return t.status === "closed";
  }, get fallback() {
    return [ssr(De, ssrHydrationKey()), ssr(Fe, ssrHydrationKey())];
  }, get children() {
    return [ssr(Le, ssrHydrationKey()), ssr(Pe, ssrHydrationKey())];
  } })));
}
function He() {
  return ssr(Oe, ssrHydrationKey());
}

export { Xe as default };
//# sourceMappingURL=index2.mjs.map
