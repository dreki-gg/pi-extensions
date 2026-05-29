import { v as mergeProps, C as splitProps, J as st, c as at, u as it, i as createMemo, A as A$1, G as ssrElement, D as ssr, p as escape, H as ssrHydrationKey, E as ssrAttribute } from '../nitro/nitro.mjs';

function u1(l) {
  l = mergeProps({ inactiveClass: "inactive", activeClass: "active" }, l);
  const [, s] = splitProps(l, ["href", "state", "class", "activeClass", "inactiveClass", "end"]), p = st(() => l.href), y = at(p), x = it(), a = createMemo(() => {
    const m = p();
    if (m === void 0) return [false, false];
    const i = A$1(m.split(/[?#]/, 1)[0]).toLowerCase(), c = decodeURI(A$1(x.pathname).toLowerCase());
    return [l.end ? i === c : c.startsWith(i + "/") || c === i, i === c];
  });
  return ssrElement("a", mergeProps(s, { get href() {
    return y() || l.href;
  }, get state() {
    return JSON.stringify(l.state);
  }, get classList() {
    return { ...l.class && { [l.class]: true }, [l.inactiveClass]: !a()[0], [l.activeClass]: a()[0], ...s.classList };
  }, link: true, get "aria-current"() {
    return a()[1] ? "page" : void 0;
  } }), void 0);
}
var w = ["<rect", ' x="4" y="3" width="16" height="18" rx="2"></rect>'], C = ["<line", ' x1="8" y1="8" x2="16" y2="8"></line>'], L = ["<line", ' x1="8" y1="12" x2="16" y2="12"></line>'], k = ["<line", ' x1="8" y1="16" x2="13" y2="16"></line>'], z = ["<path", ' d="M4 6a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z"></path>'], h = ["<circle", ' cx="6" cy="6" r="2.5"></circle>'], H = ["<circle", ' cx="18" cy="9" r="2.5"></circle>'], P = ["<circle", ' cx="9" cy="18" r="2.5"></circle>'], A = ["<line", ' x1="8.3" y1="7" x2="15.7" y2="8.2"></line>'], b = ["<line", ' x1="6.6" y1="8.4" x2="8.4" y2="15.6"></line>'], I = ["<rect", ' x="5" y="3" width="14" height="18" rx="2"></rect>'], V = ["<line", ' x1="9" y1="9" x2="9" y2="13"></line>'], R = ["<line", ' x1="7" y1="11" x2="11" y2="11"></line>'], S = ["<line", ' x1="13" y1="16" x2="17" y2="16"></line>'], j = ["<circle", ' cx="12" cy="12" r="9"></circle>'], B = ["<path", ' d="M8.5 12.5l2.4 2.4 4.6-5"></path>'], E = ["<path", ' d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z"></path>'], J = ["<path", ' d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"></path>'], K = ["<circle", ' cx="12" cy="8" r="3.5"></circle>'], N = ["<path", ' d="M5 20a7 7 0 0 1 14 0"></path>'], O = ["<circle", ' cx="6" cy="18" r="2.5"></circle>'], T = ["<circle", ' cx="18" cy="8" r="2.5"></circle>'], U = ["<path", ' d="M6 8.5v7"></path>'], W = ["<path", ' d="M18 10.5a6 6 0 0 1-6 6H6"></path>'], q = ["<path", ' d="M14 5h5v5"></path>'], D = ["<path", ' d="M19 5l-8 8"></path>'], F = ["<path", ' d="M18 13.5V18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4.5"></path>'], G = ["<line", ' x1="6" y1="6" x2="18" y2="18"></line>'], Q = ["<line", ' x1="18" y1="6" x2="6" y2="18"></line>'], X = ["<path", ' d="M21 4L3 11l7 3 3 7 8-17z"></path>'], Y = ["<path", ' d="M10 14l4-4"></path>'], Z = ["<line", ' x1="19" y1="12" x2="5" y2="12"></line>'], t1 = ["<polyline", ' points="11 18 5 12 11 6"></polyline>'], e1 = ["<rect", ' x="5" y="8" width="14" height="11" rx="2.5"></rect>'], l1 = ["<line", ' x1="12" y1="4.5" x2="12" y2="8"></line>'], i1 = ["<circle", ' cx="12" cy="4" r="1"></circle>'], c1 = ["<line", ' x1="9.5" y1="13" x2="9.5" y2="14.5"></line>'], r1 = ["<line", ' x1="14.5" y1="13" x2="14.5" y2="14.5"></line>'], a1 = ["<path", ' d="M12 4l9 16H3z"></path>'], n1 = ["<line", ' x1="12" y1="10" x2="12" y2="14"></line>'], s1 = ["<circle", ' cx="12" cy="17" r="0.7"></circle>'], p1 = ["<polyline", ' points="5 12.5 10 17.5 19 7"></polyline>'], m1 = ["<line", ' x1="7" y1="7" x2="17" y2="17"></line>'], o1 = ["<line", ' x1="17" y1="7" x2="7" y2="17"></line>'], h1 = ["<circle", ' cx="12" cy="12" r="4" fill="currentColor" stroke="none"></circle>'], y1 = ["<svg", ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">', "</svg>"];
const x1 = { overview: [ssr(w, ssrHydrationKey()), ssr(C, ssrHydrationKey()), ssr(L, ssrHydrationKey()), ssr(k, ssrHydrationKey())], files: ssr(z, ssrHydrationKey()), "mind-map": [ssr(h, ssrHydrationKey()), ssr(H, ssrHydrationKey()), ssr(P, ssrHydrationKey()), ssr(A, ssrHydrationKey()), ssr(b, ssrHydrationKey())], diff: [ssr(I, ssrHydrationKey()), ssr(V, ssrHydrationKey()), ssr(R, ssrHydrationKey()), ssr(S, ssrHydrationKey())], checks: [ssr(j, ssrHydrationKey()), ssr(B, ssrHydrationKey())], comments: ssr(E, ssrHydrationKey()), summary: ssr(J, ssrHydrationKey()), user: [ssr(K, ssrHydrationKey()), ssr(N, ssrHydrationKey())], branch: [ssr(h, ssrHydrationKey()), ssr(O, ssrHydrationKey()), ssr(T, ssrHydrationKey()), ssr(U, ssrHydrationKey()), ssr(W, ssrHydrationKey())], external: [ssr(q, ssrHydrationKey()), ssr(D, ssrHydrationKey()), ssr(F, ssrHydrationKey())], close: [ssr(G, ssrHydrationKey()), ssr(Q, ssrHydrationKey())], send: [ssr(X, ssrHydrationKey()), ssr(Y, ssrHydrationKey())], back: [ssr(Z, ssrHydrationKey()), ssr(t1, ssrHydrationKey())], robot: [ssr(e1, ssrHydrationKey()), ssr(l1, ssrHydrationKey()), ssr(i1, ssrHydrationKey()), ssr(c1, ssrHydrationKey()), ssr(r1, ssrHydrationKey())], warning: [ssr(a1, ssrHydrationKey()), ssr(n1, ssrHydrationKey()), ssr(s1, ssrHydrationKey())], check: ssr(p1, ssrHydrationKey()), cross: [ssr(m1, ssrHydrationKey()), ssr(o1, ssrHydrationKey())], dot: ssr(h1, ssrHydrationKey()) };
function f1(l) {
  var _a, _b;
  return ssr(y1, ssrHydrationKey() + ssrAttribute("class", escape(l.class, true), false) + ssrAttribute("width", escape((_a = l.size) != null ? _a : 18, true), false) + ssrAttribute("height", escape((_b = l.size) != null ? _b : 18, true), false), escape(x1[l.name]));
}

export { f1 as f, u1 as u };
//# sourceMappingURL=Icon-BaqE27Xx2.mjs.map
