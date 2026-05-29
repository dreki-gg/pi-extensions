import { O as useContext, g as createContext, f as createComponent, N as useAssets, z as onCleanup, l as createSignal, m as createStore, i as createMemo, j as createRenderEffect, y as on, B as runWithOwner, r as getRequestEvent, M as untrack, q as getOwner, D as ssr, p as escape, L as startTransition, t as isServer, d as batch, n as createUniqueId } from '../nitro/nitro.mjs';

function je() {
  let r = /* @__PURE__ */ new Set();
  function n(o) {
    return r.add(o), () => r.delete(o);
  }
  let e = false;
  function t(o, s) {
    if (e) return !(e = false);
    const a = { to: o, options: s, defaultPrevented: false, preventDefault: () => a.defaultPrevented = true };
    for (const i of r) i.listener({ ...a, from: i.location, retry: (d) => {
      d && (e = true), i.navigate(o, { ...s, resolve: false });
    } });
    return !a.defaultPrevented;
  }
  return { subscribe: n, confirm: t };
}
const Le = /^(?:[a-z0-9]+:)?\/\//i, Me = /^\/+|(\/)\/+$/g, Ne = "http://sr";
function A(r, n = false) {
  const e = r.replace(Me, "$1");
  return e ? n || /^[?#]/.test(e) ? e : "/" + e : "";
}
function _(r, n, e) {
  if (Le.test(n)) return;
  const t = A(r), o = e && A(e);
  let s = "";
  return !o || n.startsWith("/") ? s = t : o.toLowerCase().indexOf(t.toLowerCase()) !== 0 ? s = t + o : s = o, (s || "/") + A(n, !s);
}
function _e(r, n) {
  if (r == null) throw new Error(n);
  return r;
}
function qe(r, n) {
  return A(r).replace(/\/*(\*.*)?$/g, "") + A(n);
}
function se(r) {
  const n = {};
  return r.searchParams.forEach((e, t) => {
    t in n ? Array.isArray(n[t]) ? n[t].push(e) : n[t] = [n[t], e] : n[t] = e;
  }), n;
}
function We(r, n, e) {
  const [t, o] = r.split("/*", 2), s = t.split("/").filter(Boolean), a = s.length;
  return (i) => {
    const d = i.split("/").filter(Boolean), l = d.length - a;
    if (l < 0 || l > 0 && o === void 0 && !n) return null;
    const c = { path: a ? "" : "/", params: {} }, m = (p) => e === void 0 ? void 0 : e[p];
    for (let p = 0; p < a; p++) {
      const h = s[p], y = h[0] === ":", P = y ? d[p] : d[p].toLowerCase(), R = y ? h.slice(1) : h.toLowerCase();
      if (y && I(P, m(R))) c.params[R] = P;
      else if (y || !I(P, R)) return null;
      c.path += `/${P}`;
    }
    if (o) {
      const p = l ? d.slice(-l).join("/") : "";
      if (I(p, m(o))) c.params[o] = p;
      else return null;
    }
    return c;
  };
}
function I(r, n) {
  const e = (t) => t === r;
  return n === void 0 ? true : typeof n == "string" ? e(n) : typeof n == "function" ? n(r) : Array.isArray(n) ? n.some(e) : n instanceof RegExp ? n.test(r) : false;
}
function Be(r) {
  const [n, e] = r.pattern.split("/*", 2), t = n.split("/").filter(Boolean);
  return t.reduce((o, s) => o + (s.startsWith(":") ? 2 : 3), t.length - (e === void 0 ? 0 : 1));
}
function ae(r) {
  const n = /* @__PURE__ */ new Map(), e = getOwner();
  return new Proxy({}, { get(t, o) {
    return n.has(o) || runWithOwner(e, () => n.set(o, createMemo(() => r()[o]))), n.get(o)();
  }, getOwnPropertyDescriptor() {
    return { enumerable: true, configurable: true };
  }, ownKeys() {
    return Reflect.ownKeys(r());
  }, has(t, o) {
    return o in r();
  } });
}
function ie(r) {
  let n = /(\/?\:[^\/]+)\?/.exec(r);
  if (!n) return [r];
  let e = r.slice(0, n.index), t = r.slice(n.index + n[0].length);
  const o = [e, e += n[1]];
  for (; n = /^(\/\:[^\/]+)\?/.exec(t); ) o.push(e += n[1]), t = t.slice(n[0].length);
  return ie(t).reduce((s, a) => [...s, ...o.map((i) => i + a)], []);
}
const Ie = 100, Fe = createContext(), ce = createContext(), B = () => _e(useContext(Fe), "<A> and 'use' router primitives can be only used inside a Route."), ke = () => useContext(ce) || B().base, st = (r) => {
  const n = ke();
  return createMemo(() => n.resolvePath(r()));
}, at = (r) => {
  const n = B();
  return createMemo(() => {
    const e = r();
    return e !== void 0 ? n.renderPath(e) : e;
  });
}, it = () => B().location, ct = () => B().params;
function Ue(r, n = "") {
  const { component: e, preload: t, load: o, children: s, info: a } = r, i = !s || Array.isArray(s) && !s.length, d = { key: r, component: e, preload: t || o, info: a };
  return le(r.path).reduce((l, c) => {
    for (const m of ie(c)) {
      const p = qe(n, m);
      let h = i ? p : p.split("/*", 1)[0];
      h = h.split("/").map((y) => y.startsWith(":") || y.startsWith("*") ? y : encodeURIComponent(y)).join("/"), l.push({ ...d, originalPath: c, pattern: h, matcher: We(h, !i, r.matchFilters) });
    }
    return l;
  }, []);
}
function Ke(r, n = 0) {
  return { routes: r, score: Be(r[r.length - 1]) * 1e4 - n, matcher(e) {
    const t = [];
    for (let o = r.length - 1; o >= 0; o--) {
      const s = r[o], a = s.matcher(e);
      if (!a) return null;
      t.unshift({ ...a, route: s });
    }
    return t;
  } };
}
function le(r) {
  return Array.isArray(r) ? r : [r];
}
function De(r, n = "", e = [], t = []) {
  const o = le(r);
  for (let s = 0, a = o.length; s < a; s++) {
    const i = o[s];
    if (i && typeof i == "object") {
      i.hasOwnProperty("path") || (i.path = "");
      const d = Ue(i, n);
      for (const l of d) {
        e.push(l);
        const c = Array.isArray(i.children) && i.children.length === 0;
        if (i.children && !c) De(i.children, l.pattern, e, t);
        else {
          const m = Ke([...e], t.length);
          t.push(m);
        }
        e.pop();
      }
    }
  }
  return e.length ? t : t.sort((s, a) => a.score - s.score);
}
function F(r, n) {
  for (let e = 0, t = r.length; e < t; e++) {
    const o = r[e].matcher(n);
    if (o) return o;
  }
  return [];
}
function He(r, n, e) {
  const t = new URL(Ne), o = createMemo((c) => {
    const m = r();
    try {
      return new URL(m, t);
    } catch {
      return console.error(`Invalid path ${m}`), c;
    }
  }, t), s = createMemo(() => o().pathname), a = createMemo(() => o().search, true), i = createMemo(() => o().hash), d = () => "", l = on(a, () => se(o()));
  return { get pathname() {
    return s();
  }, get search() {
    return a();
  }, get hash() {
    return i();
  }, get state() {
    return n();
  }, get key() {
    return d();
  }, query: e ? e(l) : ae(l) };
}
let w;
function lt() {
  return w;
}
function ut(r, n, e, t = {}) {
  const { signal: [o, s], utils: a = {} } = r, i = a.parsePath || ((u) => u), d = a.renderPath || ((u) => u), l = a.beforeLeave || je(), c = _("", t.base || "");
  if (c === void 0) throw new Error(`${c} is not a valid base path`);
  c && !o().value && s({ value: c, replace: true, scroll: false });
  const [m, p] = createSignal(false);
  let h;
  const y = (u, f) => {
    f.value === P() && f.state === $() || (h === void 0 && p(true), w = u, h = f, startTransition(() => {
      h === f && (R(h.value), he(h.state), isServer);
    }).finally(() => {
      h === f && batch(() => {
        w = void 0, p(false), h = void 0;
      });
    }));
  }, [P, R] = createSignal(o().value), [$, he] = createSignal(o().state), j = He(P, $, a.queryWrapper), L = [], D = createSignal(Pe() ), H = createMemo(() => typeof t.transformUrl == "function" ? F(n(), t.transformUrl(j.pathname)) : F(n(), j.pathname)), J = () => {
    const u = H(), f = {};
    for (let g = 0; g < u.length; g++) Object.assign(f, u[g].params);
    return f;
  }, pe = a.paramsWrapper ? a.paramsWrapper(J, n) : ae(J), z = { pattern: c, path: () => c, outlet: () => null, resolvePath(u) {
    return _(c, u);
  } };
  return createRenderEffect(on(o, (u) => y("native", u), { defer: true })), { base: z, location: j, params: pe, isRouting: m, renderPath: d, parsePath: i, navigatorFactory: ge, matches: H, beforeLeave: l, preloadRoute: ve, singleFlight: t.singleFlight === void 0 ? true : t.singleFlight, submissions: D };
  function me(u, f, g) {
    untrack(() => {
      if (typeof f == "number") {
        f && (a.go ? a.go(f) : console.warn("Router integration does not support relative routing"));
        return;
      }
      const C = !f || f[0] === "?", { replace: M, resolve: b, scroll: N, state: S } = { replace: false, resolve: !C, scroll: true, ...g }, x = b ? u.resolvePath(f) : _(C && j.pathname || "", f);
      if (x === void 0) throw new Error(`Path '${f}' is not a routable path`);
      if (L.length >= Ie) throw new Error("Too many redirects");
      const G = P();
      if (x !== G || S !== $()) {
        const V = getRequestEvent();
        V && (V.response = { status: 302, headers: new Headers({ Location: x }) }), s({ value: x, replace: M, scroll: N, state: S });
      }
    });
  }
  function ge(u) {
    return u = u || useContext(ce) || z, (f, g) => me(u, f, g);
  }
  function ve(u, f) {
    const g = F(n(), u.pathname), C = w;
    w = "preload";
    for (let M in g) {
      const { route: b, params: N } = g[M];
      b.component && b.component.preload && b.component.preload();
      const { preload: S } = b;
      f && S && runWithOwner(e(), () => S({ params: N, location: { pathname: u.pathname, search: u.search, hash: u.hash, query: se(u), state: null, key: "" }, intent: "preload" }));
    }
    w = C;
  }
  function Pe() {
    const u = getRequestEvent();
    return u && u.router && u.router.submission ? [u.router.submission] : [];
  }
}
function dt(r, n, e, t) {
  const { base: o, location: s, params: a } = r, { pattern: i, component: d, preload: l } = t().route, c = createMemo(() => t().path);
  d && d.preload && d.preload();
  const m = l ? l({ params: a, location: s, intent: w || "initial" }) : void 0;
  return { parent: n, pattern: i, path: c, outlet: () => d ? createComponent(d, { params: a, location: s, data: m, get children() {
    return e();
  } }) : e(), resolvePath(h) {
    return _(o.path(), h, c());
  } };
}
const ue = createContext(), de = ["title", "meta"], U = [], K = ["name", "http-equiv", "content", "charset", "media"].concat(["property"]), q = (r, n) => {
  const e = Object.fromEntries(Object.entries(r.props).filter(([t]) => n.includes(t)).sort());
  return (Object.hasOwn(e, "name") || Object.hasOwn(e, "property")) && (e.name = e.name || e.property, delete e.property), r.tag + JSON.stringify(e);
};
function ze() {
  const r = [];
  return useAssets(() => ssr(Xe(r))), { addTag(n) {
    if (de.indexOf(n.tag) !== -1) {
      const e = n.tag === "title" ? U : K, t = q(n, e), o = r.findIndex((s) => s.tag === n.tag && q(s, e) === t);
      o !== -1 && r.splice(o, 1);
    }
    return r.push(n), r.length;
  }, removeTag(n, e) {
  } };
}
const ft = (r) => {
  const n = ze() ;
  return createComponent(ue.Provider, { value: n, get children() {
    return r.children;
  } });
}, Ge = (r, n, e) => (Ve({ tag: r, props: n, setting: e, id: createUniqueId(), get name() {
  return n.name || n.property;
} }), null);
function Ve(r) {
  const n = useContext(ue);
  if (!n) throw new Error("<MetaProvider /> should be in the tree");
  createRenderEffect(() => {
    const e = n.addTag(r);
    onCleanup(() => n.removeTag(r, e));
  });
}
function Xe(r) {
  return r.map((n) => {
    var _a, _b;
    const t = Object.keys(n.props).map((s) => s === "children" ? "" : ` ${s}="${escape(n.props[s], true)}"`).join("");
    let o = n.props.children;
    return Array.isArray(o) && (o = o.join("")), ((_a = n.setting) == null ? void 0 : _a.close) ? `<${n.tag} data-sm="${n.id}"${t}>${((_b = n.setting) == null ? void 0 : _b.escape) ? escape(o) : o || ""}</${n.tag}>` : `<${n.tag} data-sm="${n.id}"${t}/>`;
  }).join("");
}
const ht = (r) => Ge("title", r, { escape: true, close: true });
function Qe(r) {
  const [n, e] = createSignal("connecting"), t = /* @__PURE__ */ new Map();
  let o = null, s = null, a = 1e3, i = false;
  function d() {
    i || (e("connecting"), o = new WebSocket(r), o.onopen = () => {
      e("open"), a = 1e3;
    }, o.onmessage = (l) => {
      try {
        const c = JSON.parse(l.data), m = t.get(c.type);
        if (m) for (const h of m) h(c);
        const p = t.get("*");
        if (p) for (const h of p) h(c);
      } catch {
      }
    }, o.onclose = () => {
      e("closed"), o = null, i || (s = setTimeout(() => {
        a = Math.min(a * 1.5, 3e4), d();
      }, a));
    }, o.onerror = () => {
    });
  }
  return d(), onCleanup(() => {
    i = true, s && clearTimeout(s), o && o.close();
  }), { status: n, send(l) {
    o && o.readyState === WebSocket.OPEN && o.send(JSON.stringify(l));
  }, on(l, c) {
    t.has(l) || t.set(l, /* @__PURE__ */ new Set()), t.get(l).add(c);
  }, off(l, c) {
    var _a;
    (_a = t.get(l)) == null ? void 0 : _a.delete(c);
  } };
}
function Ye(r) {
  const [n, e] = createStore({ prs: [], currentPr: null, aiChat: { messages: [], loading: false, streamingContent: "" }, loading: false, error: null });
  return r.on("pr:list:result", (t) => {
    e("prs", t.prs), e("loading", false);
  }), r.on("pr:data:result", (t) => {
    e("currentPr", { number: t.number, data: t.data, rawDiff: t.rawDiff, mindMap: t.mindMap, aiSummary: t.aiSummary }), e("loading", false);
  }), r.on("pr:update", (t) => {
    n.currentPr && n.currentPr.number === t.number && t.data && e("currentPr", "data", t.data);
  }), r.on("ai:chat:response", (t) => {
    e("aiChat", "messages", (o) => [...o, { role: "assistant", content: t.message }]), e("aiChat", "loading", false);
  }), r.on("ai:chat:stream", (t) => {
    if (t.done) {
      const o = n.aiChat.streamingContent + t.chunk;
      e("aiChat", "messages", (s) => [...s, { role: "assistant", content: o }]), e("aiChat", "streamingContent", ""), e("aiChat", "loading", false);
    } else e("aiChat", "streamingContent", (o) => o + t.chunk);
  }), r.on("error", (t) => {
    e("error", t.message), e("loading", false), e("aiChat", "loading", false);
  }), { store: n, loadPrList() {
    e("loading", true), e("error", null), r.send({ type: "pr:list" });
  }, loadPr(t) {
    e("loading", true), e("error", null), r.send({ type: "pr:data", number: t });
  }, subscribePr(t) {
    r.send({ type: "pr:subscribe", number: t });
  }, sendAiChat(t, o) {
    e("aiChat", "messages", (s) => [...s, { role: "user", content: t }]), e("aiChat", "loading", true), e("aiChat", "streamingContent", ""), r.send({ type: "ai:chat", message: t, prNumber: o });
  }, clearError() {
    e("error", null);
  } };
}
const fe = createContext(), Ze = "ws://localhost:3001", pt = (r) => {
  const n = Qe(Ze), e = Ye(n);
  return createComponent(fe.Provider, { value: e, get children() {
    return r.children;
  } });
};
function mt() {
  const r = useContext(fe);
  if (!r) throw new Error("usePrStore must be used within a PrStoreProvider");
  return r;
}

export { A, De as D, F, Fe as a, at as b, ce as c, ct as d, dt as e, ft as f, ht as h, it as i, lt as l, mt as m, pt as p, st as s, ut as u };
//# sourceMappingURL=context-VkJfzLEW.mjs.map
