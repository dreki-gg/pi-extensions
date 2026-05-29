import { f as createComponent, a as Ft, b as Suspense, r as getRequestEvent, e as children, i as createMemo, q as getOwner, L as untrack, S as Show, y as on, k as createRoot } from '../nitro/nitro.mjs';
import { f as ft, p as pt, u as ut$1, a as Fe, D as De, l as lt, e as dt, F, c as ce } from './context-VkJfzLEW.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:async_hooks';
import 'node:url';

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
    t.preload({ params: o, location: r, intent: lt() || "initial" });
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
  {
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
        r[l] = R, m[l] = dt(t.routerState, m[l - 1] || t.routerState.base, k(() => n()[l + 1]), () => {
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
function ut(t) {
  const r = new URL(t);
  return r.pathname + r.search;
}
function ct(t) {
  let r;
  const o = { value: t.url || (r = getRequestEvent()) && ut(r.request.url) || "" };
  return I({ signal: [() => o, (n) => Object.assign(o, n)] })(t);
}
function ht(t) {
  return ct(t);
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
