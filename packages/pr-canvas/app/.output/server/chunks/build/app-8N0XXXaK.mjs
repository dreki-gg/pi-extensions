import { createComponent, isServer, getRequestEvent, delegateEvents } from 'solid-js/web';
import { Suspense, createSignal, onCleanup, children, createMemo, getOwner, sharedConfig, untrack, Show, on, createRoot } from 'solid-js';
import { F as Ft } from '../nitro/nitro.mjs';
import { f as ft, p as pt, D as De, u as ut$1, a as Fe, N as Ne, l as lt$1, e as dt$1, F, c as ce, r as rt$1, o as oe, j as je, g as ot$1 } from './context-VkJfzLEW.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:async_hooks';
import 'vinxi/lib/invariant';
import 'vinxi/lib/path';
import 'node:url';
import 'solid-js/web/storage';
import 'seroval';
import 'seroval-plugins/web';
import 'solid-js/store';

const I = (t) => (r) => {
  const { base: o } = r, n = children(() => r.children), e = createMemo(() => De(n(), r.base || ""));
  let s;
  const u = ut$1(t, e, () => s, { base: o, singleFlight: r.singleFlight, transformUrl: r.transformUrl });
  return t.create && t.create(u), createComponent(Fe.Provider, { value: u, get children() {
    return createComponent(et, { routerState: u, get root() {
      return r.root;
    }, get preload() {
      return r.rootPreload || r.rootLoad;
    }, get children() {
      return [(s = getOwner()) && null, createComponent(rt, { routerState: u, get branches() {
        return e();
      } })];
    } });
  } });
};
function et(t) {
  const r = t.routerState.location, o = t.routerState.params, n = createMemo(() => t.preload && untrack(() => {
    t.preload({ params: o, location: r, intent: lt$1() || "initial" });
  }));
  return createComponent(Show, { get when() {
    return t.root;
  }, keyed: true, get fallback() {
    return t.children;
  }, children: (e) => createComponent(e, { params: o, location: r, get data() {
    return n();
  }, get children() {
    return t.children;
  } }) });
}
function rt(t) {
  if (isServer) {
    const e = getRequestEvent();
    if (e && e.router && e.router.dataOnly) {
      nt(e, t.routerState, t.branches);
      return;
    }
    e && ((e.router || (e.router = {})).matches || (e.router.matches = t.routerState.matches().map(({ route: s, path: u, params: f }) => ({ path: s.originalPath, pattern: s.pattern, match: u, params: f, info: s.info }))));
  }
  const r = [];
  let o;
  const n = createMemo(on(t.routerState.matches, (e, s, u) => {
    let f = s && e.length === s.length;
    const m = [];
    for (let l = 0, w = e.length; l < w; l++) {
      const b = s && s[l], g = e[l];
      u && b && g.route.key === b.route.key ? m[l] = u[l] : (f = false, r[l] && r[l](), createRoot((R) => {
        r[l] = R, m[l] = dt$1(t.routerState, m[l - 1] || t.routerState.base, k(() => n()[l + 1]), () => {
          var _a;
          const p = t.routerState.matches();
          return (_a = p[l]) != null ? _a : p[0];
        });
      }));
    }
    return r.splice(e.length).forEach((l) => l()), u && f ? u : (o = m[0], m);
  }));
  return k(() => n() && o)();
}
const k = (t) => () => createComponent(Show, { get when() {
  return t();
}, keyed: true, children: (r) => createComponent(ce.Provider, { value: r, get children() {
  return r.outlet();
} }) });
function nt(t, r, o) {
  const n = new URL(t.request.url), e = F(o, new URL(t.router.previousUrl || t.request.url).pathname), s = F(o, n.pathname);
  for (let u = 0; u < s.length; u++) {
    (!e[u] || s[u].route !== e[u].route) && (t.router.dataOnly = true);
    const { route: f, params: m } = s[u];
    f.preload && f.preload({ params: m, location: r.location, intent: "preload" });
  }
}
function ot([t, r], o, n) {
  return [t, n ? (e) => r(n(e)) : r];
}
function at(t) {
  let r = false;
  const o = (e) => typeof e == "string" ? { value: e } : e, n = ot(createSignal(o(t.get()), { equals: (e, s) => e.value === s.value && e.state === s.state }), void 0, (e) => (!r && t.set(e), sharedConfig.registry && !sharedConfig.done && (sharedConfig.done = true), e));
  return t.init && onCleanup(t.init((e = t.get()) => {
    r = true, n[1](o(e)), r = false;
  })), I({ signal: n, create: t.create, utils: t.utils });
}
function it(t, r, o) {
  return t.addEventListener(r, o), () => t.removeEventListener(r, o);
}
function st(t, r) {
  const o = t && document.getElementById(t);
  o ? o.scrollIntoView() : r && window.scrollTo(0, 0);
}
function ut(t) {
  const r = new URL(t);
  return r.pathname + r.search;
}
function ct(t) {
  let r;
  const o = { value: t.url || (r = getRequestEvent()) && ut(r.request.url) || "" };
  return I({ signal: [() => o, (n) => Object.assign(o, n)] })(t);
}
const lt = /* @__PURE__ */ new Map();
function dt(t = true, r = false, o = "/_server", n) {
  return (e) => {
    const s = e.base.path(), u = e.navigatorFactory(e.base);
    let f, m;
    function l(a) {
      return a.namespaceURI === "http://www.w3.org/2000/svg";
    }
    function w(a) {
      if (a.defaultPrevented || a.button !== 0 || a.metaKey || a.altKey || a.ctrlKey || a.shiftKey) return;
      const i = a.composedPath().find((A) => A instanceof Node && A.nodeName.toUpperCase() === "A");
      if (!i || r && !i.hasAttribute("link")) return;
      const d = l(i), c = d ? i.href.baseVal : i.href;
      if ((d ? i.target.baseVal : i.target) || !c && !i.hasAttribute("state")) return;
      const v = (i.getAttribute("rel") || "").split(/\s+/);
      if (i.hasAttribute("download") || v && v.includes("external")) return;
      const y = d ? new URL(c, document.baseURI) : new URL(c);
      if (!(y.origin !== window.location.origin || s && y.pathname && !y.pathname.toLowerCase().startsWith(s.toLowerCase()))) return [i, y];
    }
    function b(a) {
      const i = w(a);
      if (!i) return;
      const [d, c] = i, E = e.parsePath(c.pathname + c.search + c.hash), v = d.getAttribute("state");
      a.preventDefault(), u(E, { resolve: false, replace: d.hasAttribute("replace"), scroll: !d.hasAttribute("noscroll"), state: v ? JSON.parse(v) : void 0 });
    }
    function g(a) {
      const i = w(a);
      if (!i) return;
      const [d, c] = i;
      n && (c.pathname = n(c.pathname)), e.preloadRoute(c, d.getAttribute("preload") !== "false");
    }
    function R(a) {
      clearTimeout(f);
      const i = w(a);
      if (!i) return m = null;
      const [d, c] = i;
      m !== d && (n && (c.pathname = n(c.pathname)), f = setTimeout(() => {
        e.preloadRoute(c, d.getAttribute("preload") !== "false"), m = d;
      }, 20));
    }
    function p(a) {
      if (a.defaultPrevented) return;
      let i = a.submitter && a.submitter.hasAttribute("formaction") ? a.submitter.getAttribute("formaction") : a.target.getAttribute("action");
      if (!i) return;
      if (!i.startsWith("https://action/")) {
        const c = new URL(i, Ne);
        if (i = e.parsePath(c.pathname + c.search), !i.startsWith(o)) return;
      }
      if (a.target.method.toUpperCase() !== "POST") throw new Error("Only POST forms are supported for Actions");
      const d = lt.get(i);
      if (d) {
        a.preventDefault();
        const c = new FormData(a.target, a.submitter);
        d.call({ r: e, f: a.target }, a.target.enctype === "multipart/form-data" ? c : new URLSearchParams(c));
      }
    }
    delegateEvents(["click", "submit"]), document.addEventListener("click", b), t && (document.addEventListener("mousemove", R, { passive: true }), document.addEventListener("focusin", g, { passive: true }), document.addEventListener("touchstart", g, { passive: true })), document.addEventListener("submit", p), onCleanup(() => {
      document.removeEventListener("click", b), t && (document.removeEventListener("mousemove", R), document.removeEventListener("focusin", g), document.removeEventListener("touchstart", g)), document.removeEventListener("submit", p);
    });
  };
}
function ht(t) {
  if (isServer) return ct(t);
  const r = () => {
    const n = window.location.pathname.replace(/^\/+/, "/") + window.location.search, e = window.history.state && window.history.state._depth && Object.keys(window.history.state).length === 1 ? void 0 : window.history.state;
    return { value: n + window.location.hash, state: e };
  }, o = je();
  return at({ get: r, set({ value: n, replace: e, scroll: s, state: u }) {
    e ? window.history.replaceState(rt$1(u), "", n) : window.history.pushState(u, "", n), st(decodeURIComponent(window.location.hash.slice(1)), s), oe();
  }, init: (n) => it(window, "popstate", ot$1(n, (e) => {
    if (e) return !o.confirm(e);
    {
      const s = r();
      return !o.confirm(s.value, { state: s.state });
    }
  })), create: dt(t.preload, t.explicitLinks, t.actionBase, t.transformUrl), utils: { go: (n) => window.history.go(n), beforeLeave: o } })(t);
}
function Pt() {
  return createComponent(ht, { root: (t) => createComponent(ft, { get children() {
    return createComponent(pt, { get children() {
      return createComponent(Suspense, { get children() {
        return t.children;
      } });
    } });
  } }), get children() {
    return createComponent(Ft, {});
  } });
}

export { Pt as default };
//# sourceMappingURL=app-8N0XXXaK.mjs.map
