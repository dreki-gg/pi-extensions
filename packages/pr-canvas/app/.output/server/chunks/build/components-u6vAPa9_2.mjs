import { u as mergeProps, B as splitProps, H as st, c as at, t as it, h as createMemo, A as A$1, E as ssrElement } from '../nitro/nitro.mjs';

function A(e) {
  e = mergeProps({ inactiveClass: "inactive", activeClass: "active" }, e);
  const [, r] = splitProps(e, ["href", "state", "class", "activeClass", "inactiveClass", "end"]), i = st(() => e.href), o = at(i), l = it(), a = createMemo(() => {
    const n = i();
    if (n === void 0) return [false, false];
    const t = A$1(n.split(/[?#]/, 1)[0]).toLowerCase(), s = decodeURI(A$1(l.pathname).toLowerCase());
    return [e.end ? t === s : s.startsWith(t + "/") || s === t, t === s];
  });
  return ssrElement("a", mergeProps(r, { get href() {
    return o() || e.href;
  }, get state() {
    return JSON.stringify(e.state);
  }, get classList() {
    return { ...e.class && { [e.class]: true }, [e.inactiveClass]: !a()[0], [e.activeClass]: a()[0], ...r.classList };
  }, link: true, get "aria-current"() {
    return a()[1] ? "page" : void 0;
  } }), void 0);
}

export { A };
//# sourceMappingURL=components-u6vAPa9_2.mjs.map
