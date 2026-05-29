import { D as ssr, p as escape, f as createComponent, E as ssrAttribute, H as ssrHydrationKey } from '../nitro/nitro.mjs';
import { f as f1 } from './Icon-BaqE27Xx.mjs';

var c = ["<header", ' class="context-bar"><div class="context-bar-main"><span class="context-bar-number">#<!--$-->', '<!--/--></span><h1 class="context-bar-title"', ">", '</h1></div><div class="context-bar-meta"><span', ">", '</span><span class="context-bar-branch"><!--$-->', "<!--/--><!--$-->", "<!--/--> \u2190 <!--$-->", '<!--/--></span><span class="context-bar-stats"><span class="stat-add">+<!--$-->', '<!--/--></span><span class="stat-del">\u2212<!--$-->', '<!--/--></span></span><a class="context-bar-link"', ' target="_blank" rel="noreferrer">GitHub<!--$-->', "<!--/--></a></div></header>"];
const i = (a) => `state-pill state-${a.toLowerCase()}`;
function d(a) {
  return ssr(c, ssrHydrationKey(), escape(a.pr.number), ssrAttribute("title", escape(a.pr.title, true), false), escape(a.pr.title), ssrAttribute("class", escape(i(a.pr.state), true), false), escape(a.pr.state), escape(createComponent(f1, { name: "branch", size: 14 })), escape(a.pr.baseRefName), escape(a.pr.headRefName), escape(a.pr.additions), escape(a.pr.deletions), ssrAttribute("href", escape(a.pr.url, true), false), escape(createComponent(f1, { name: "external", size: 14 })));
}

export { d };
//# sourceMappingURL=ContextBar-CG7B5UuO.mjs.map
