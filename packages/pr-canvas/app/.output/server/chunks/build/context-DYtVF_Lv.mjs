import { N as useContext, g as createContext, f as createComponent, M as useAssets, z as onCleanup, l as createSignal, m as createStore, i as createMemo, j as createRenderEffect, y as on, B as runWithOwner, r as getRequestEvent, L as untrack, q as getOwner, D as ssr, p as escape, K as startTransition, t as isServer, d as batch, n as createUniqueId } from '../nitro/nitro.mjs';

function Ne() {
  let n = /* @__PURE__ */ new Set();
  function r(o) {
    return n.add(o), () => n.delete(o);
  }
  let e = false;
  function t(o, s) {
    if (e) return !(e = false);
    const a = { to: o, options: s, defaultPrevented: false, preventDefault: () => a.defaultPrevented = true };
    for (const i of n) i.listener({ ...a, from: i.location, retry: (d) => {
      d && (e = true), i.navigate(o, { ...s, resolve: false });
    } });
    return !a.defaultPrevented;
  }
  return { subscribe: r, confirm: t };
}
const je = /^(?:[a-z0-9]+:)?\/\//i, Le = /^\/+|(\/)\/+$/g, Me = "http://sr";
function A(n, r = false) {
  const e = n.replace(Le, "$1");
  return e ? r || /^[?#]/.test(e) ? e : "/" + e : "";
}
function q(n, r, e) {
  if (je.test(r)) return;
  const t = A(n), o = e && A(e);
  let s = "";
  return !o || r.startsWith("/") ? s = t : o.toLowerCase().indexOf(t.toLowerCase()) !== 0 ? s = t + o : s = o, (s || "/") + A(r, !s);
}
function qe(n, r) {
  if (n == null) throw new Error(r);
  return n;
}
function We(n, r) {
  return A(n).replace(/\/*(\*.*)?$/g, "") + A(r);
}
function se(n) {
  const r = {};
  return n.searchParams.forEach((e, t) => {
    t in r ? Array.isArray(r[t]) ? r[t].push(e) : r[t] = [r[t], e] : r[t] = e;
  }), r;
}
function _e(n, r, e) {
  const [t, o] = n.split("/*", 2), s = t.split("/").filter(Boolean), a = s.length;
  return (i) => {
    const d = i.split("/").filter(Boolean), h = d.length - a;
    if (h < 0 || h > 0 && o === void 0 && !r) return null;
    const c = { path: a ? "" : "/", params: {} }, u = (f) => e === void 0 ? void 0 : e[f];
    for (let f = 0; f < a; f++) {
      const m = s[f], g = m[0] === ":", v = g ? d[f] : d[f].toLowerCase(), R = g ? m.slice(1) : m.toLowerCase();
      if (g && I(v, u(R))) c.params[R] = v;
      else if (g || !I(v, R)) return null;
      c.path += `/${v}`;
    }
    if (o) {
      const f = h ? d.slice(-h).join("/") : "";
      if (I(f, u(o))) c.params[o] = f;
      else return null;
    }
    return c;
  };
}
function I(n, r) {
  const e = (t) => t === n;
  return r === void 0 ? true : typeof r == "string" ? e(r) : typeof r == "function" ? r(n) : Array.isArray(r) ? r.some(e) : r instanceof RegExp ? r.test(n) : false;
}
function Be(n) {
  const [r, e] = n.pattern.split("/*", 2), t = r.split("/").filter(Boolean);
  return t.reduce((o, s) => o + (s.startsWith(":") ? 2 : 3), t.length - (e === void 0 ? 0 : 1));
}
function ae(n) {
  const r = /* @__PURE__ */ new Map(), e = getOwner();
  return new Proxy({}, { get(t, o) {
    return r.has(o) || runWithOwner(e, () => r.set(o, createMemo(() => n()[o]))), r.get(o)();
  }, getOwnPropertyDescriptor() {
    return { enumerable: true, configurable: true };
  }, ownKeys() {
    return Reflect.ownKeys(n());
  }, has(t, o) {
    return o in n();
  } });
}
function ie(n) {
  let r = /(\/?\:[^\/]+)\?/.exec(n);
  if (!r) return [n];
  let e = n.slice(0, r.index), t = n.slice(r.index + r[0].length);
  const o = [e, e += r[1]];
  for (; r = /^(\/\:[^\/]+)\?/.exec(t); ) o.push(e += r[1]), t = t.slice(r[0].length);
  return ie(t).reduce((s, a) => [...s, ...o.map((i) => i + a)], []);
}
const Ie = 100, Fe = createContext(), ce = createContext(), B = () => qe(useContext(Fe), "<A> and 'use' router primitives can be only used inside a Route."), ke = () => useContext(ce) || B().base, st = (n) => {
  const r = ke();
  return createMemo(() => r.resolvePath(n()));
}, at = (n) => {
  const r = B();
  return createMemo(() => {
    const e = n();
    return e !== void 0 ? r.renderPath(e) : e;
  });
}, it = () => B().location, ct = () => B().params;
function Ue(n, r = "") {
  const { component: e, preload: t, load: o, children: s, info: a } = n, i = !s || Array.isArray(s) && !s.length, d = { key: n, component: e, preload: t || o, info: a };
  return le(n.path).reduce((h, c) => {
    for (const u of ie(c)) {
      const f = We(r, u);
      let m = i ? f : f.split("/*", 1)[0];
      m = m.split("/").map((g) => g.startsWith(":") || g.startsWith("*") ? g : encodeURIComponent(g)).join("/"), h.push({ ...d, originalPath: c, pattern: m, matcher: _e(m, !i, n.matchFilters) });
    }
    return h;
  }, []);
}
function Ke(n, r = 0) {
  return { routes: n, score: Be(n[n.length - 1]) * 1e4 - r, matcher(e) {
    const t = [];
    for (let o = n.length - 1; o >= 0; o--) {
      const s = n[o], a = s.matcher(e);
      if (!a) return null;
      t.unshift({ ...a, route: s });
    }
    return t;
  } };
}
function le(n) {
  return Array.isArray(n) ? n : [n];
}
function De(n, r = "", e = [], t = []) {
  const o = le(n);
  for (let s = 0, a = o.length; s < a; s++) {
    const i = o[s];
    if (i && typeof i == "object") {
      i.hasOwnProperty("path") || (i.path = "");
      const d = Ue(i, r);
      for (const h of d) {
        e.push(h);
        const c = Array.isArray(i.children) && i.children.length === 0;
        if (i.children && !c) De(i.children, h.pattern, e, t);
        else {
          const u = Ke([...e], t.length);
          t.push(u);
        }
        e.pop();
      }
    }
  }
  return e.length ? t : t.sort((s, a) => a.score - s.score);
}
function F(n, r) {
  for (let e = 0, t = n.length; e < t; e++) {
    const o = n[e].matcher(r);
    if (o) return o;
  }
  return [];
}
function He(n, r, e) {
  const t = new URL(Me), o = createMemo((c) => {
    const u = n();
    try {
      return new URL(u, t);
    } catch {
      return console.error(`Invalid path ${u}`), c;
    }
  }, t), s = createMemo(() => o().pathname), a = createMemo(() => o().search, true), i = createMemo(() => o().hash), d = () => "", h = on(a, () => se(o()));
  return { get pathname() {
    return s();
  }, get search() {
    return a();
  }, get hash() {
    return i();
  }, get state() {
    return r();
  }, get key() {
    return d();
  }, query: e ? e(h) : ae(h) };
}
let w;
function lt() {
  return w;
}
function ut(n, r, e, t = {}) {
  const { signal: [o, s], utils: a = {} } = n, i = a.parsePath || ((l) => l), d = a.renderPath || ((l) => l), h = a.beforeLeave || Ne(), c = q("", t.base || "");
  if (c === void 0) throw new Error(`${c} is not a valid base path`);
  c && !o().value && s({ value: c, replace: true, scroll: false });
  const [u, f] = createSignal(false);
  let m;
  const g = (l, p) => {
    p.value === v() && p.state === $() || (m === void 0 && f(true), w = l, m = p, startTransition(() => {
      m === p && (R(m.value), he(m.state), isServer);
    }).finally(() => {
      m === p && batch(() => {
        w = void 0, f(false), m = void 0;
      });
    }));
  }, [v, R] = createSignal(o().value), [$, he] = createSignal(o().state), N = He(v, $, a.queryWrapper), j = [], D = createSignal(Pe() ), H = createMemo(() => typeof t.transformUrl == "function" ? F(r(), t.transformUrl(N.pathname)) : F(r(), N.pathname)), J = () => {
    const l = H(), p = {};
    for (let y = 0; y < l.length; y++) Object.assign(p, l[y].params);
    return p;
  }, pe = a.paramsWrapper ? a.paramsWrapper(J, r) : ae(J), z = { pattern: c, path: () => c, outlet: () => null, resolvePath(l) {
    return q(c, l);
  } };
  return createRenderEffect(on(o, (l) => g("native", l), { defer: true })), { base: z, location: N, params: pe, isRouting: u, renderPath: d, parsePath: i, navigatorFactory: ge, matches: H, beforeLeave: h, preloadRoute: ve, singleFlight: t.singleFlight === void 0 ? true : t.singleFlight, submissions: D };
  function me(l, p, y) {
    untrack(() => {
      if (typeof p == "number") {
        p && (a.go ? a.go(p) : console.warn("Router integration does not support relative routing"));
        return;
      }
      const C = !p || p[0] === "?", { replace: L, resolve: b, scroll: M, state: S } = { replace: false, resolve: !C, scroll: true, ...y }, x = b ? l.resolvePath(p) : q(C && N.pathname || "", p);
      if (x === void 0) throw new Error(`Path '${p}' is not a routable path`);
      if (j.length >= Ie) throw new Error("Too many redirects");
      const G = v();
      if (x !== G || S !== $()) {
        const V = getRequestEvent();
        V && (V.response = { status: 302, headers: new Headers({ Location: x }) }), s({ value: x, replace: L, scroll: M, state: S });
      }
    });
  }
  function ge(l) {
    return l = l || useContext(ce) || z, (p, y) => me(l, p, y);
  }
  function ve(l, p) {
    const y = F(r(), l.pathname), C = w;
    w = "preload";
    for (let L in y) {
      const { route: b, params: M } = y[L];
      b.component && b.component.preload && b.component.preload();
      const { preload: S } = b;
      p && S && runWithOwner(e(), () => S({ params: M, location: { pathname: l.pathname, search: l.search, hash: l.hash, query: se(l), state: null, key: "" }, intent: "preload" }));
    }
    w = C;
  }
  function Pe() {
    const l = getRequestEvent();
    return l && l.router && l.router.submission ? [l.router.submission] : [];
  }
}
function ft(n, r, e, t) {
  const { base: o, location: s, params: a } = n, { pattern: i, component: d, preload: h } = t().route, c = createMemo(() => t().path);
  d && d.preload && d.preload();
  const u = h ? h({ params: a, location: s, intent: w || "initial" }) : void 0;
  return { parent: r, pattern: i, path: c, outlet: () => d ? createComponent(d, { params: a, location: s, data: u, get children() {
    return e();
  } }) : e(), resolvePath(m) {
    return q(o.path(), m, c());
  } };
}
const ue = createContext(), fe = ["title", "meta"], U = [], K = ["name", "http-equiv", "content", "charset", "media"].concat(["property"]), W = (n, r) => {
  const e = Object.fromEntries(Object.entries(n.props).filter(([t]) => r.includes(t)).sort());
  return (Object.hasOwn(e, "name") || Object.hasOwn(e, "property")) && (e.name = e.name || e.property, delete e.property), n.tag + JSON.stringify(e);
};
function ze() {
  const n = [];
  return useAssets(() => ssr(Xe(n))), { addTag(r) {
    if (fe.indexOf(r.tag) !== -1) {
      const e = r.tag === "title" ? U : K, t = W(r, e), o = n.findIndex((s) => s.tag === r.tag && W(s, e) === t);
      o !== -1 && n.splice(o, 1);
    }
    return n.push(r), n.length;
  }, removeTag(r, e) {
  } };
}
const dt = (n) => {
  const r = ze() ;
  return createComponent(ue.Provider, { value: r, get children() {
    return n.children;
  } });
}, Ge = (n, r, e) => (Ve({ tag: n, props: r, setting: e, id: createUniqueId(), get name() {
  return r.name || r.property;
} }), null);
function Ve(n) {
  const r = useContext(ue);
  if (!r) throw new Error("<MetaProvider /> should be in the tree");
  createRenderEffect(() => {
    const e = r.addTag(n);
    onCleanup(() => r.removeTag(n, e));
  });
}
function Xe(n) {
  return n.map((r) => {
    var _a, _b;
    const t = Object.keys(r.props).map((s) => s === "children" ? "" : ` ${s}="${escape(r.props[s], true)}"`).join("");
    let o = r.props.children;
    return Array.isArray(o) && (o = o.join("")), ((_a = r.setting) == null ? void 0 : _a.close) ? `<${r.tag} data-sm="${r.id}"${t}>${((_b = r.setting) == null ? void 0 : _b.escape) ? escape(o) : o || ""}</${r.tag}>` : `<${r.tag} data-sm="${r.id}"${t}/>`;
  }).join("");
}
const ht = (n) => Ge("title", n, { escape: true, close: true });
function Qe(n) {
  const [r, e] = createSignal("connecting"), t = /* @__PURE__ */ new Map();
  let o = [], s = null, a = null, i = 1e3, d = false;
  function h() {
    if (!s || s.readyState !== WebSocket.OPEN) return;
    const u = o;
    o = [];
    for (const f of u) s.send(JSON.stringify(f));
  }
  function c() {
    d || (e("connecting"), s = new WebSocket(n), s.onopen = () => {
      e("open"), i = 1e3, h();
    }, s.onmessage = (u) => {
      try {
        const f = JSON.parse(u.data), m = t.get(f.type);
        if (m) for (const v of m) v(f);
        const g = t.get("*");
        if (g) for (const v of g) v(f);
      } catch {
      }
    }, s.onclose = () => {
      e("closed"), s = null, d || (a = setTimeout(() => {
        i = Math.min(i * 1.5, 3e4), c();
      }, i));
    }, s.onerror = () => {
    });
  }
  return c(), onCleanup(() => {
    d = true, a && clearTimeout(a), s && s.close();
  }), { status: r, send(u) {
    s && s.readyState === WebSocket.OPEN ? s.send(JSON.stringify(u)) : o.push(u);
  }, on(u, f) {
    t.has(u) || t.set(u, /* @__PURE__ */ new Set()), t.get(u).add(f);
  }, off(u, f) {
    var _a;
    (_a = t.get(u)) == null ? void 0 : _a.delete(f);
  } };
}
function Ye(n) {
  const [r, e] = createStore({ prs: [], currentPr: null, aiChat: { messages: [], loading: false, streamingContent: "" }, loading: false, error: null });
  return n.on("pr:list:result", (t) => {
    e("prs", t.prs), e("loading", false);
  }), n.on("pr:data:result", (t) => {
    e("currentPr", { number: t.number, data: t.data, rawDiff: t.rawDiff, mindMap: t.mindMap, aiSummary: t.aiSummary }), e("loading", false);
  }), n.on("pr:update", (t) => {
    r.currentPr && r.currentPr.number === t.number && t.data && e("currentPr", "data", t.data);
  }), n.on("ai:chat:response", (t) => {
    e("aiChat", "messages", (o) => [...o, { role: "assistant", content: t.message }]), e("aiChat", "loading", false);
  }), n.on("ai:chat:stream", (t) => {
    if (t.done) {
      const o = r.aiChat.streamingContent + t.chunk;
      e("aiChat", "messages", (s) => [...s, { role: "assistant", content: o }]), e("aiChat", "streamingContent", ""), e("aiChat", "loading", false);
    } else e("aiChat", "streamingContent", (o) => o + t.chunk);
  }), n.on("error", (t) => {
    e("error", t.message), e("loading", false), e("aiChat", "loading", false);
  }), { store: r, connectionStatus: n.status, loadPrList() {
    e("loading", true), e("error", null), n.send({ type: "pr:list" });
  }, loadPr(t) {
    e("loading", true), e("error", null), n.send({ type: "pr:data", number: t });
  }, subscribePr(t) {
    n.send({ type: "pr:subscribe", number: t });
  }, sendAiChat(t, o) {
    e("aiChat", "messages", (s) => [...s, { role: "user", content: t }]), e("aiChat", "loading", true), e("aiChat", "streamingContent", ""), n.send({ type: "ai:chat", message: t, prNumber: o });
  }, clearError() {
    e("error", null);
  } };
}
const de = createContext(), Ze = "ws://localhost:3001", pt = (n) => {
  const r = Qe(Ze), e = Ye(r);
  return createComponent(de.Provider, { value: e, get children() {
    return n.children;
  } });
};
function mt() {
  const n = useContext(de);
  if (!n) throw new Error("usePrStore must be used within a PrStoreProvider");
  return n;
}

export { A, De as D, F, Fe as a, at as b, ce as c, ct as d, dt as e, ft as f, ht as h, it as i, lt as l, mt as m, pt as p, st as s, ut as u };
//# sourceMappingURL=context-DYtVF_Lv.mjs.map
