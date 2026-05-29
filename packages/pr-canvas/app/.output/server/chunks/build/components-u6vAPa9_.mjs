import { ssrElement, mergeProps as mergeProps$1 } from 'solid-js/web';
import { mergeProps, splitProps, createMemo } from 'solid-js';
import { s as st, b as at, i as it, A as A$1 } from './context-VkJfzLEW.mjs';

function A(e) {
  e = mergeProps({ inactiveClass: "inactive", activeClass: "active" }, e);
  const [, r] = splitProps(e, ["href", "state", "class", "activeClass", "inactiveClass", "end"]), i = st(() => e.href), o = at(i), l = it(), a = createMemo(() => {
    const n = i();
    if (n === void 0) return [false, false];
    const t = A$1(n.split(/[?#]/, 1)[0]).toLowerCase(), s = decodeURI(A$1(l.pathname).toLowerCase());
    return [e.end ? t === s : s.startsWith(t + "/") || s === t, t === s];
  });
  return ssrElement("a", mergeProps$1(r, { get href() {
    return o() || e.href;
  }, get state() {
    return JSON.stringify(e.state);
  }, get classList() {
    return { ...e.class && { [e.class]: true }, [e.inactiveClass]: !a()[0], [e.activeClass]: a()[0], ...r.classList };
  }, link: true, get "aria-current"() {
    return a()[1] ? "page" : void 0;
  } }), void 0, true);
}

export { A };
//# sourceMappingURL=components-u6vAPa9_.mjs.map
