import process from 'node:process';globalThis._importMeta_=globalThis._importMeta_||{url:"file:///_entry.js",env:process.env};import http, { Server as Server$1 } from 'node:http';
import https, { Server } from 'node:https';
import { EventEmitter } from 'node:events';
import { Buffer as Buffer$1 } from 'node:buffer';
import { promises, existsSync } from 'node:fs';
import { resolve as resolve$1, dirname as dirname$1, join as join$1 } from 'node:path';
import { createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { pathToFileURL, fileURLToPath } from 'node:url';

const suspectProtoRx = /"(?:_|\\u0{2}5[Ff]){2}(?:p|\\u0{2}70)(?:r|\\u0{2}72)(?:o|\\u0{2}6[Ff])(?:t|\\u0{2}74)(?:o|\\u0{2}6[Ff])(?:_|\\u0{2}5[Ff]){2}"\s*:/;
const suspectConstructorRx = /"(?:c|\\u0063)(?:o|\\u006[Ff])(?:n|\\u006[Ee])(?:s|\\u0073)(?:t|\\u0074)(?:r|\\u0072)(?:u|\\u0075)(?:c|\\u0063)(?:t|\\u0074)(?:o|\\u006[Ff])(?:r|\\u0072)"\s*:/;
const JsonSigRx = /^\s*["[{]|^\s*-?\d{1,16}(\.\d{1,17})?([Ee][+-]?\d+)?\s*$/;
function jsonParseTransform(key, value) {
  if (key === "__proto__" || key === "constructor" && value && typeof value === "object" && "prototype" in value) {
    warnKeyDropped(key);
    return;
  }
  return value;
}
function warnKeyDropped(key) {
  console.warn(`[destr] Dropping "${key}" key to prevent prototype pollution.`);
}
function destr(value, options = {}) {
  if (typeof value !== "string") {
    return value;
  }
  if (value[0] === '"' && value[value.length - 1] === '"' && value.indexOf("\\") === -1) {
    return value.slice(1, -1);
  }
  const _value = value.trim();
  if (_value.length <= 9) {
    switch (_value.toLowerCase()) {
      case "true": {
        return true;
      }
      case "false": {
        return false;
      }
      case "undefined": {
        return void 0;
      }
      case "null": {
        return null;
      }
      case "nan": {
        return Number.NaN;
      }
      case "infinity": {
        return Number.POSITIVE_INFINITY;
      }
      case "-infinity": {
        return Number.NEGATIVE_INFINITY;
      }
    }
  }
  if (!JsonSigRx.test(value)) {
    if (options.strict) {
      throw new SyntaxError("[destr] Invalid JSON");
    }
    return value;
  }
  try {
    if (suspectProtoRx.test(value) || suspectConstructorRx.test(value)) {
      if (options.strict) {
        throw new Error("[destr] Possible prototype pollution");
      }
      return JSON.parse(value, jsonParseTransform);
    }
    return JSON.parse(value);
  } catch (error) {
    if (options.strict) {
      throw error;
    }
    return value;
  }
}

const HASH_RE = /#/g;
const AMPERSAND_RE = /&/g;
const SLASH_RE = /\//g;
const EQUAL_RE = /=/g;
const PLUS_RE = /\+/g;
const ENC_CARET_RE = /%5e/gi;
const ENC_BACKTICK_RE = /%60/gi;
const ENC_PIPE_RE = /%7c/gi;
const ENC_SPACE_RE = /%20/gi;
const ENC_SLASH_RE = /%2f/gi;
function encode(text) {
  return encodeURI("" + text).replace(ENC_PIPE_RE, "|");
}
function encodeQueryValue(input) {
  return encode(typeof input === "string" ? input : JSON.stringify(input)).replace(PLUS_RE, "%2B").replace(ENC_SPACE_RE, "+").replace(HASH_RE, "%23").replace(AMPERSAND_RE, "%26").replace(ENC_BACKTICK_RE, "`").replace(ENC_CARET_RE, "^").replace(SLASH_RE, "%2F");
}
function encodeQueryKey(text) {
  return encodeQueryValue(text).replace(EQUAL_RE, "%3D");
}
function decode$1(text = "") {
  try {
    return decodeURIComponent("" + text);
  } catch {
    return "" + text;
  }
}
function decodePath(text) {
  return decode$1(text.replace(ENC_SLASH_RE, "%252F"));
}
function decodeQueryKey(text) {
  return decode$1(text.replace(PLUS_RE, " "));
}
function decodeQueryValue(text) {
  return decode$1(text.replace(PLUS_RE, " "));
}

function parseQuery(parametersString = "") {
  const object = /* @__PURE__ */ Object.create(null);
  if (parametersString[0] === "?") {
    parametersString = parametersString.slice(1);
  }
  for (const parameter of parametersString.split("&")) {
    const s = parameter.match(/([^=]+)=?(.*)/) || [];
    if (s.length < 2) {
      continue;
    }
    const key = decodeQueryKey(s[1]);
    if (key === "__proto__" || key === "constructor") {
      continue;
    }
    const value = decodeQueryValue(s[2] || "");
    if (object[key] === void 0) {
      object[key] = value;
    } else if (Array.isArray(object[key])) {
      object[key].push(value);
    } else {
      object[key] = [object[key], value];
    }
  }
  return object;
}
function encodeQueryItem(key, value) {
  if (typeof value === "number" || typeof value === "boolean") {
    value = String(value);
  }
  if (!value) {
    return encodeQueryKey(key);
  }
  if (Array.isArray(value)) {
    return value.map(
      (_value) => `${encodeQueryKey(key)}=${encodeQueryValue(_value)}`
    ).join("&");
  }
  return `${encodeQueryKey(key)}=${encodeQueryValue(value)}`;
}
function stringifyQuery(query) {
  return Object.keys(query).filter((k) => query[k] !== void 0).map((k) => encodeQueryItem(k, query[k])).filter(Boolean).join("&");
}

const PROTOCOL_STRICT_REGEX = /^[\s\w\0+.-]{2,}:([/\\]{1,2})/;
const PROTOCOL_REGEX = /^[\s\w\0+.-]{2,}:([/\\]{2})?/;
const PROTOCOL_RELATIVE_REGEX = /^([/\\]\s*){2,}[^/\\]/;
const JOIN_LEADING_SLASH_RE = /^\.?\//;
function hasProtocol(inputString, opts = {}) {
  if (typeof opts === "boolean") {
    opts = { acceptRelative: opts };
  }
  if (opts.strict) {
    return PROTOCOL_STRICT_REGEX.test(inputString);
  }
  return PROTOCOL_REGEX.test(inputString) || (opts.acceptRelative ? PROTOCOL_RELATIVE_REGEX.test(inputString) : false);
}
function hasTrailingSlash(input = "", respectQueryAndFragment) {
  {
    return input.endsWith("/");
  }
}
function withoutTrailingSlash(input = "", respectQueryAndFragment) {
  {
    return (hasTrailingSlash(input) ? input.slice(0, -1) : input) || "/";
  }
}
function withTrailingSlash(input = "", respectQueryAndFragment) {
  {
    return input.endsWith("/") ? input : input + "/";
  }
}
function hasLeadingSlash(input = "") {
  return input.startsWith("/");
}
function withLeadingSlash(input = "") {
  return hasLeadingSlash(input) ? input : "/" + input;
}
function withBase(input, base) {
  if (isEmptyURL(base) || hasProtocol(input)) {
    return input;
  }
  const _base = withoutTrailingSlash(base);
  if (input.startsWith(_base)) {
    const nextChar = input[_base.length];
    if (!nextChar || nextChar === "/" || nextChar === "?") {
      return input;
    }
  }
  return joinURL(_base, input);
}
function withoutBase(input, base) {
  if (isEmptyURL(base)) {
    return input;
  }
  const _base = withoutTrailingSlash(base);
  if (!input.startsWith(_base)) {
    return input;
  }
  const nextChar = input[_base.length];
  if (nextChar && nextChar !== "/" && nextChar !== "?") {
    return input;
  }
  const trimmed = input.slice(_base.length).replace(/^\/+/, "");
  return "/" + trimmed;
}
function withQuery(input, query) {
  const parsed = parseURL(input);
  const mergedQuery = { ...parseQuery(parsed.search), ...query };
  parsed.search = stringifyQuery(mergedQuery);
  return stringifyParsedURL(parsed);
}
function getQuery(input) {
  return parseQuery(parseURL(input).search);
}
function isEmptyURL(url) {
  return !url || url === "/";
}
function isNonEmptyURL(url) {
  return url && url !== "/";
}
function joinURL(base, ...input) {
  let url = base || "";
  for (const segment of input.filter((url2) => isNonEmptyURL(url2))) {
    if (url) {
      const _segment = segment.replace(JOIN_LEADING_SLASH_RE, "");
      url = withTrailingSlash(url) + _segment;
    } else {
      url = segment;
    }
  }
  return url;
}

const protocolRelative = Symbol.for("ufo:protocolRelative");
function parseURL(input = "", defaultProto) {
  const _specialProtoMatch = input.match(
    /^[\s\0]*(blob:|data:|javascript:|vbscript:)(.*)/i
  );
  if (_specialProtoMatch) {
    const [, _proto, _pathname = ""] = _specialProtoMatch;
    return {
      protocol: _proto.toLowerCase(),
      pathname: _pathname,
      href: _proto + _pathname,
      auth: "",
      host: "",
      search: "",
      hash: ""
    };
  }
  if (!hasProtocol(input, { acceptRelative: true })) {
    return parsePath(input);
  }
  const [, protocol = "", auth, hostAndPath = ""] = input.replace(/\\/g, "/").match(/^[\s\0]*([\w+.-]{2,}:)?\/\/([^/@]+@)?(.*)/) || [];
  let [, host = "", path = ""] = hostAndPath.match(/([^#/?]*)(.*)?/) || [];
  if (protocol === "file:") {
    path = path.replace(/\/(?=[A-Za-z]:)/, "");
  }
  const { pathname, search, hash } = parsePath(path);
  return {
    protocol: protocol.toLowerCase(),
    auth: auth ? auth.slice(0, Math.max(0, auth.length - 1)) : "",
    host,
    pathname,
    search,
    hash,
    [protocolRelative]: !protocol
  };
}
function parsePath(input = "") {
  const [pathname = "", search = "", hash = ""] = (input.match(/([^#?]*)(\?[^#]*)?(#.*)?/) || []).splice(1);
  return {
    pathname,
    search,
    hash
  };
}
function stringifyParsedURL(parsed) {
  const pathname = parsed.pathname || "";
  const search = parsed.search ? (parsed.search.startsWith("?") ? "" : "?") + parsed.search : "";
  const hash = parsed.hash || "";
  const auth = parsed.auth ? parsed.auth + "@" : "";
  const host = parsed.host || "";
  const proto = parsed.protocol || parsed[protocolRelative] ? (parsed.protocol || "") + "//" : "";
  return proto + auth + host + pathname + search + hash;
}

const NODE_TYPES = {
  NORMAL: 0,
  WILDCARD: 1,
  PLACEHOLDER: 2
};

function createRouter$1(options = {}) {
  const ctx = {
    options,
    rootNode: createRadixNode(),
    staticRoutesMap: {}
  };
  const normalizeTrailingSlash = (p) => options.strictTrailingSlash ? p : p.replace(/\/$/, "") || "/";
  if (options.routes) {
    for (const path in options.routes) {
      insert(ctx, normalizeTrailingSlash(path), options.routes[path]);
    }
  }
  return {
    ctx,
    lookup: (path) => lookup(ctx, normalizeTrailingSlash(path)),
    insert: (path, data) => insert(ctx, normalizeTrailingSlash(path), data),
    remove: (path) => remove(ctx, normalizeTrailingSlash(path))
  };
}
function lookup(ctx, path) {
  const staticPathNode = ctx.staticRoutesMap[path];
  if (staticPathNode) {
    return staticPathNode.data;
  }
  const sections = path.split("/");
  const params = {};
  let paramsFound = false;
  let wildcardNode = null;
  let node = ctx.rootNode;
  let wildCardParam = null;
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (node.wildcardChildNode !== null) {
      wildcardNode = node.wildcardChildNode;
      wildCardParam = sections.slice(i).join("/");
    }
    const nextNode = node.children.get(section);
    if (nextNode === void 0) {
      if (node && node.placeholderChildren.length > 1) {
        const remaining = sections.length - i;
        node = node.placeholderChildren.find((c) => c.maxDepth === remaining) || null;
      } else {
        node = node.placeholderChildren[0] || null;
      }
      if (!node) {
        break;
      }
      if (node.paramName) {
        params[node.paramName] = section;
      }
      paramsFound = true;
    } else {
      node = nextNode;
    }
  }
  if ((node === null || node.data === null) && wildcardNode !== null) {
    node = wildcardNode;
    params[node.paramName || "_"] = wildCardParam;
    paramsFound = true;
  }
  if (!node) {
    return null;
  }
  if (paramsFound) {
    return {
      ...node.data,
      params: paramsFound ? params : void 0
    };
  }
  return node.data;
}
function insert(ctx, path, data) {
  let isStaticRoute = true;
  const sections = path.split("/");
  let node = ctx.rootNode;
  let _unnamedPlaceholderCtr = 0;
  const matchedNodes = [node];
  for (const section of sections) {
    let childNode;
    if (childNode = node.children.get(section)) {
      node = childNode;
    } else {
      const type = getNodeType(section);
      childNode = createRadixNode({ type, parent: node });
      node.children.set(section, childNode);
      if (type === NODE_TYPES.PLACEHOLDER) {
        childNode.paramName = section === "*" ? `_${_unnamedPlaceholderCtr++}` : section.slice(1);
        node.placeholderChildren.push(childNode);
        isStaticRoute = false;
      } else if (type === NODE_TYPES.WILDCARD) {
        node.wildcardChildNode = childNode;
        childNode.paramName = section.slice(
          3
          /* "**:" */
        ) || "_";
        isStaticRoute = false;
      }
      matchedNodes.push(childNode);
      node = childNode;
    }
  }
  for (const [depth, node2] of matchedNodes.entries()) {
    node2.maxDepth = Math.max(matchedNodes.length - depth, node2.maxDepth || 0);
  }
  node.data = data;
  if (isStaticRoute === true) {
    ctx.staticRoutesMap[path] = node;
  }
  return node;
}
function remove(ctx, path) {
  let success = false;
  const sections = path.split("/");
  let node = ctx.rootNode;
  for (const section of sections) {
    node = node.children.get(section);
    if (!node) {
      return success;
    }
  }
  if (node.data) {
    const lastSection = sections.at(-1) || "";
    node.data = null;
    if (Object.keys(node.children).length === 0 && node.parent) {
      node.parent.children.delete(lastSection);
      node.parent.wildcardChildNode = null;
      node.parent.placeholderChildren = [];
    }
    success = true;
  }
  return success;
}
function createRadixNode(options = {}) {
  return {
    type: options.type || NODE_TYPES.NORMAL,
    maxDepth: 0,
    parent: options.parent || null,
    children: /* @__PURE__ */ new Map(),
    data: options.data || null,
    paramName: options.paramName || null,
    wildcardChildNode: null,
    placeholderChildren: []
  };
}
function getNodeType(str) {
  if (str.startsWith("**")) {
    return NODE_TYPES.WILDCARD;
  }
  if (str[0] === ":" || str === "*") {
    return NODE_TYPES.PLACEHOLDER;
  }
  return NODE_TYPES.NORMAL;
}

function toRouteMatcher(router) {
  const table = _routerNodeToTable("", router.ctx.rootNode);
  return _createMatcher(table, router.ctx.options.strictTrailingSlash);
}
function _createMatcher(table, strictTrailingSlash) {
  return {
    ctx: { table },
    matchAll: (path) => _matchRoutes(path, table, strictTrailingSlash)
  };
}
function _createRouteTable() {
  return {
    static: /* @__PURE__ */ new Map(),
    wildcard: /* @__PURE__ */ new Map(),
    dynamic: /* @__PURE__ */ new Map()
  };
}
function _matchRoutes(path, table, strictTrailingSlash) {
  if (strictTrailingSlash !== true && path.endsWith("/")) {
    path = path.slice(0, -1) || "/";
  }
  const matches = [];
  for (const [key, value] of _sortRoutesMap(table.wildcard)) {
    if (path === key || path.startsWith(key + "/")) {
      matches.push(value);
    }
  }
  for (const [key, value] of _sortRoutesMap(table.dynamic)) {
    if (path.startsWith(key + "/")) {
      const subPath = "/" + path.slice(key.length).split("/").splice(2).join("/");
      matches.push(..._matchRoutes(subPath, value));
    }
  }
  const staticMatch = table.static.get(path);
  if (staticMatch) {
    matches.push(staticMatch);
  }
  return matches.filter(Boolean);
}
function _sortRoutesMap(m) {
  return [...m.entries()].sort((a, b) => a[0].length - b[0].length);
}
function _routerNodeToTable(initialPath, initialNode) {
  const table = _createRouteTable();
  function _addNode(path, node) {
    if (path) {
      if (node.type === NODE_TYPES.NORMAL && !(path.includes("*") || path.includes(":"))) {
        if (node.data) {
          table.static.set(path, node.data);
        }
      } else if (node.type === NODE_TYPES.WILDCARD) {
        table.wildcard.set(path.replace("/**", ""), node.data);
      } else if (node.type === NODE_TYPES.PLACEHOLDER) {
        const subTable = _routerNodeToTable("", node);
        if (node.data) {
          subTable.static.set("/", node.data);
        }
        table.dynamic.set(path.replace(/\/\*|\/:\w+/, ""), subTable);
        return;
      }
    }
    for (const [childPath, child] of node.children.entries()) {
      _addNode(`${path}/${childPath}`.replace("//", "/"), child);
    }
  }
  _addNode(initialPath, initialNode);
  return table;
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype && Object.getPrototypeOf(prototype) !== null) {
    return false;
  }
  if (Symbol.iterator in value) {
    return false;
  }
  if (Symbol.toStringTag in value) {
    return Object.prototype.toString.call(value) === "[object Module]";
  }
  return true;
}

function _defu(baseObject, defaults, namespace = ".", merger) {
  if (!isPlainObject(defaults)) {
    return _defu(baseObject, {}, namespace, merger);
  }
  const object = { ...defaults };
  for (const key of Object.keys(baseObject)) {
    if (key === "__proto__" || key === "constructor") {
      continue;
    }
    const value = baseObject[key];
    if (value === null || value === void 0) {
      continue;
    }
    if (merger && merger(object, key, value, namespace)) {
      continue;
    }
    if (Array.isArray(value) && Array.isArray(object[key])) {
      object[key] = [...value, ...object[key]];
    } else if (isPlainObject(value) && isPlainObject(object[key])) {
      object[key] = _defu(
        value,
        object[key],
        (namespace ? `${namespace}.` : "") + key.toString(),
        merger
      );
    } else {
      object[key] = value;
    }
  }
  return object;
}
function createDefu(merger) {
  return (...arguments_) => (
    // eslint-disable-next-line unicorn/no-array-reduce
    arguments_.reduce((p, c) => _defu(p, c, "", merger), {})
  );
}
const defu = createDefu();
const defuFn = createDefu((object, key, currentValue) => {
  if (object[key] !== void 0 && typeof currentValue === "function") {
    object[key] = currentValue(object[key]);
    return true;
  }
});

function o$2(n){throw new Error(`${n} is not implemented yet!`)}let i$2 = class i extends EventEmitter{__unenv__={};readableEncoding=null;readableEnded=true;readableFlowing=false;readableHighWaterMark=0;readableLength=0;readableObjectMode=false;readableAborted=false;readableDidRead=false;closed=false;errored=null;readable=false;destroyed=false;static from(e,t){return new i(t)}constructor(e){super();}_read(e){}read(e){}setEncoding(e){return this}pause(){return this}resume(){return this}isPaused(){return  true}unpipe(e){return this}unshift(e,t){}wrap(e){return this}push(e,t){return  false}_destroy(e,t){this.removeAllListeners();}destroy(e){return this.destroyed=true,this._destroy(e),this}pipe(e,t){return {}}compose(e,t){throw new Error("Method not implemented.")}[Symbol.asyncDispose](){return this.destroy(),Promise.resolve()}async*[Symbol.asyncIterator](){throw o$2("Readable.asyncIterator")}iterator(e){throw o$2("Readable.iterator")}map(e,t){throw o$2("Readable.map")}filter(e,t){throw o$2("Readable.filter")}forEach(e,t){throw o$2("Readable.forEach")}reduce(e,t,r){throw o$2("Readable.reduce")}find(e,t){throw o$2("Readable.find")}findIndex(e,t){throw o$2("Readable.findIndex")}some(e,t){throw o$2("Readable.some")}toArray(e){throw o$2("Readable.toArray")}every(e,t){throw o$2("Readable.every")}flatMap(e,t){throw o$2("Readable.flatMap")}drop(e,t){throw o$2("Readable.drop")}take(e,t){throw o$2("Readable.take")}asIndexedPairs(e){throw o$2("Readable.asIndexedPairs")}};let l$2 = class l extends EventEmitter{__unenv__={};writable=true;writableEnded=false;writableFinished=false;writableHighWaterMark=0;writableLength=0;writableObjectMode=false;writableCorked=0;closed=false;errored=null;writableNeedDrain=false;writableAborted=false;destroyed=false;_data;_encoding="utf8";constructor(e){super();}pipe(e,t){return {}}_write(e,t,r){if(this.writableEnded){r&&r();return}if(this._data===void 0)this._data=e;else {const s=typeof this._data=="string"?Buffer$1.from(this._data,this._encoding||t||"utf8"):this._data,a=typeof e=="string"?Buffer$1.from(e,t||this._encoding||"utf8"):e;this._data=Buffer$1.concat([s,a]);}this._encoding=t,r&&r();}_writev(e,t){}_destroy(e,t){}_final(e){}write(e,t,r){const s=typeof t=="string"?this._encoding:"utf8",a=typeof t=="function"?t:typeof r=="function"?r:void 0;return this._write(e,s,a),true}setDefaultEncoding(e){return this}end(e,t,r){const s=typeof e=="function"?e:typeof t=="function"?t:typeof r=="function"?r:void 0;if(this.writableEnded)return s&&s(),this;const a=e===s?void 0:e;if(a){const u=t===s?void 0:t;this.write(a,u,s);}return this.writableEnded=true,this.writableFinished=true,this.emit("close"),this.emit("finish"),this}cork(){}uncork(){}destroy(e){return this.destroyed=true,delete this._data,this.removeAllListeners(),this}compose(e,t){throw new Error("Method not implemented.")}[Symbol.asyncDispose](){return Promise.resolve()}};const c$2=class c{allowHalfOpen=true;_destroy;constructor(e=new i$2,t=new l$2){Object.assign(this,e),Object.assign(this,t),this._destroy=m$2(e._destroy,t._destroy);}};function _$4(){return Object.assign(c$2.prototype,i$2.prototype),Object.assign(c$2.prototype,l$2.prototype),c$2}function m$2(...n){return function(...e){for(const t of n)t(...e);}}const g$2=_$4();let A$3 = class A extends g$2{__unenv__={};bufferSize=0;bytesRead=0;bytesWritten=0;connecting=false;destroyed=false;pending=false;localAddress="";localPort=0;remoteAddress="";remoteFamily="";remotePort=0;autoSelectFamilyAttemptedAddresses=[];readyState="readOnly";constructor(e){super();}write(e,t,r){return  false}connect(e,t,r){return this}end(e,t,r){return this}setEncoding(e){return this}pause(){return this}resume(){return this}setTimeout(e,t){return this}setNoDelay(e){return this}setKeepAlive(e,t){return this}address(){return {}}unref(){return this}ref(){return this}destroySoon(){this.destroy();}resetAndDestroy(){const e=new Error("ERR_SOCKET_CLOSED");return e.code="ERR_SOCKET_CLOSED",this.destroy(e),this}};let y$3 = class y extends i$2{aborted=false;httpVersion="1.1";httpVersionMajor=1;httpVersionMinor=1;complete=true;connection;socket;headers={};trailers={};method="GET";url="/";statusCode=200;statusMessage="";closed=false;errored=null;readable=false;constructor(e){super(),this.socket=this.connection=e||new A$3;}get rawHeaders(){const e=this.headers,t=[];for(const r in e)if(Array.isArray(e[r]))for(const s of e[r])t.push(r,s);else t.push(r,e[r]);return t}get rawTrailers(){return []}setTimeout(e,t){return this}get headersDistinct(){return p$2(this.headers)}get trailersDistinct(){return p$2(this.trailers)}};function p$2(n){const e={};for(const[t,r]of Object.entries(n))t&&(e[t]=(Array.isArray(r)?r:[r]).filter(Boolean));return e}let w$4 = class w extends l$2{statusCode=200;statusMessage="";upgrading=false;chunkedEncoding=false;shouldKeepAlive=false;useChunkedEncodingByDefault=false;sendDate=false;finished=false;headersSent=false;strictContentLength=false;connection=null;socket=null;req;_headers={};constructor(e){super(),this.req=e;}assignSocket(e){e._httpMessage=this,this.socket=e,this.connection=e,this.emit("socket",e),this._flush();}_flush(){this.flushHeaders();}detachSocket(e){}writeContinue(e){}writeHead(e,t,r){e&&(this.statusCode=e),typeof t=="string"&&(this.statusMessage=t,t=void 0);const s=r||t;if(s&&!Array.isArray(s))for(const a in s)this.setHeader(a,s[a]);return this.headersSent=true,this}writeProcessing(){}setTimeout(e,t){return this}appendHeader(e,t){e=e.toLowerCase();const r=this._headers[e],s=[...Array.isArray(r)?r:[r],...Array.isArray(t)?t:[t]].filter(Boolean);return this._headers[e]=s.length>1?s:s[0],this}setHeader(e,t){return this._headers[e.toLowerCase()]=t,this}setHeaders(e){for(const[t,r]of Object.entries(e))this.setHeader(t,r);return this}getHeader(e){return this._headers[e.toLowerCase()]}getHeaders(){return this._headers}getHeaderNames(){return Object.keys(this._headers)}hasHeader(e){return e.toLowerCase()in this._headers}removeHeader(e){delete this._headers[e.toLowerCase()];}addTrailers(e){}flushHeaders(){}writeEarlyHints(e,t){typeof t=="function"&&t();}};const E$3=(()=>{const n=function(){};return n.prototype=Object.create(null),n})();function R$1(n={}){const e=new E$3,t=Array.isArray(n)||H$3(n)?n:Object.entries(n);for(const[r,s]of t)if(s){if(e[r]===void 0){e[r]=s;continue}e[r]=[...Array.isArray(e[r])?e[r]:[e[r]],...Array.isArray(s)?s:[s]];}return e}function H$3(n){return typeof n?.entries=="function"}function v$3(n={}){if(n instanceof Headers)return n;const e=new Headers;for(const[t,r]of Object.entries(n))if(r!==void 0){if(Array.isArray(r)){for(const s of r)e.append(t,String(s));continue}e.set(t,String(r));}return e}const S$1=new Set([101,204,205,304]);async function b$1(n,e){const t=new y$3,r=new w$4(t);t.url=e.url?.toString()||"/";let s;if(!t.url.startsWith("/")){const d=new URL(t.url);s=d.host,t.url=d.pathname+d.search+d.hash;}t.method=e.method||"GET",t.headers=R$1(e.headers||{}),t.headers.host||(t.headers.host=e.host||s||"localhost"),t.connection.encrypted=t.connection.encrypted||e.protocol==="https",t.body=e.body||null,t.__unenv__=e.context,await n(t,r);let a=r._data;(S$1.has(r.statusCode)||t.method.toUpperCase()==="HEAD")&&(a=null,delete r._headers["content-length"]);const u={status:r.statusCode,statusText:r.statusMessage,headers:r._headers,body:a};return t.destroy(),r.destroy(),u}async function C$2(n,e,t={}){try{const r=await b$1(n,{url:e,...t});return new Response(r.body,{status:r.status,statusText:r.statusText,headers:v$3(r.headers)})}catch(r){return new Response(r.toString(),{status:Number.parseInt(r.statusCode||r.code)||500,statusText:r.statusText})}}

function hasProp$1(obj, prop) {
  try {
    return prop in obj;
  } catch {
    return false;
  }
}

let H3Error$1 = class H3Error extends Error {
  static __h3_error__ = true;
  statusCode = 500;
  fatal = false;
  unhandled = false;
  statusMessage;
  data;
  cause;
  constructor(message, opts = {}) {
    super(message, opts);
    if (opts.cause && !this.cause) {
      this.cause = opts.cause;
    }
  }
  toJSON() {
    const obj = {
      message: this.message,
      statusCode: sanitizeStatusCode$1(this.statusCode, 500)
    };
    if (this.statusMessage) {
      obj.statusMessage = sanitizeStatusMessage$1(this.statusMessage);
    }
    if (this.data !== void 0) {
      obj.data = this.data;
    }
    return obj;
  }
};
function createError$2(input) {
  if (typeof input === "string") {
    return new H3Error$1(input);
  }
  if (isError$1(input)) {
    return input;
  }
  const err = new H3Error$1(input.message ?? input.statusMessage ?? "", {
    cause: input.cause || input
  });
  if (hasProp$1(input, "stack")) {
    try {
      Object.defineProperty(err, "stack", {
        get() {
          return input.stack;
        }
      });
    } catch {
      try {
        err.stack = input.stack;
      } catch {
      }
    }
  }
  if (input.data) {
    err.data = input.data;
  }
  if (input.statusCode) {
    err.statusCode = sanitizeStatusCode$1(input.statusCode, err.statusCode);
  } else if (input.status) {
    err.statusCode = sanitizeStatusCode$1(input.status, err.statusCode);
  }
  if (input.statusMessage) {
    err.statusMessage = input.statusMessage;
  } else if (input.statusText) {
    err.statusMessage = input.statusText;
  }
  if (err.statusMessage) {
    const originalMessage = err.statusMessage;
    const sanitizedMessage = sanitizeStatusMessage$1(err.statusMessage);
    if (sanitizedMessage !== originalMessage) {
      console.warn(
        "[h3] Please prefer using `message` for longer error messages instead of `statusMessage`. In the future, `statusMessage` will be sanitized by default."
      );
    }
  }
  if (input.fatal !== void 0) {
    err.fatal = input.fatal;
  }
  if (input.unhandled !== void 0) {
    err.unhandled = input.unhandled;
  }
  return err;
}
function sendError(event, error, debug) {
  if (event.handled) {
    return;
  }
  const h3Error = isError$1(error) ? error : createError$2(error);
  const responseBody = {
    statusCode: h3Error.statusCode,
    statusMessage: h3Error.statusMessage,
    stack: [],
    data: h3Error.data
  };
  if (debug) {
    responseBody.stack = (h3Error.stack || "").split("\n").map((l) => l.trim());
  }
  if (event.handled) {
    return;
  }
  const _code = Number.parseInt(h3Error.statusCode);
  setResponseStatus$1(event, _code, h3Error.statusMessage);
  event.node.res.setHeader("content-type", MIMES$1.json);
  event.node.res.end(JSON.stringify(responseBody, void 0, 2));
}
function isError$1(input) {
  return input?.constructor?.__h3_error__ === true;
}
function isMethod$1(event, expected, allowHead) {
  if (typeof expected === "string") {
    if (event.method === expected) {
      return true;
    }
  } else if (expected.includes(event.method)) {
    return true;
  }
  return false;
}
function assertMethod$1(event, expected, allowHead) {
  if (!isMethod$1(event, expected)) {
    throw createError$2({
      statusCode: 405,
      statusMessage: "HTTP method is not allowed."
    });
  }
}
function getRequestHeaders$1(event) {
  const _headers = {};
  for (const key in event.node.req.headers) {
    const val = event.node.req.headers[key];
    _headers[key] = Array.isArray(val) ? val.filter(Boolean).join(", ") : val;
  }
  return _headers;
}
function getRequestHeader$1(event, name) {
  const headers = getRequestHeaders$1(event);
  const value = headers[name.toLowerCase()];
  return value;
}
function getRequestHost$1(event, opts = {}) {
  if (opts.xForwardedHost) {
    const _header = event.node.req.headers["x-forwarded-host"];
    const xForwardedHost = (_header || "").split(",").shift()?.trim();
    if (xForwardedHost) {
      return xForwardedHost;
    }
  }
  return event.node.req.headers.host || "localhost";
}
function getRequestProtocol$1(event, opts = {}) {
  if (opts.xForwardedProto !== false && event.node.req.headers["x-forwarded-proto"] === "https") {
    return "https";
  }
  return event.node.req.connection?.encrypted ? "https" : "http";
}
function getRequestURL$1(event, opts = {}) {
  const host = getRequestHost$1(event, opts);
  const protocol = getRequestProtocol$1(event, opts);
  const path = (event.node.req.originalUrl || event.path).replace(
    /^[/\\]+/g,
    "/"
  );
  return new URL(path, `${protocol}://${host}`);
}

const RawBodySymbol$1 = Symbol.for("h3RawBody");
const PayloadMethods$1$1 = ["PATCH", "POST", "PUT", "DELETE"];
function readRawBody$1(event, encoding = "utf8") {
  assertMethod$1(event, PayloadMethods$1$1);
  const _rawBody = event._requestBody || event.web?.request?.body || event.node.req[RawBodySymbol$1] || event.node.req.rawBody || event.node.req.body;
  if (_rawBody) {
    const promise2 = Promise.resolve(_rawBody).then((_resolved) => {
      if (Buffer.isBuffer(_resolved)) {
        return _resolved;
      }
      if (typeof _resolved.pipeTo === "function") {
        return new Promise((resolve, reject) => {
          const chunks = [];
          _resolved.pipeTo(
            new WritableStream({
              write(chunk) {
                chunks.push(chunk);
              },
              close() {
                resolve(Buffer.concat(chunks));
              },
              abort(reason) {
                reject(reason);
              }
            })
          ).catch(reject);
        });
      } else if (typeof _resolved.pipe === "function") {
        return new Promise((resolve, reject) => {
          const chunks = [];
          _resolved.on("data", (chunk) => {
            chunks.push(chunk);
          }).on("end", () => {
            resolve(Buffer.concat(chunks));
          }).on("error", reject);
        });
      }
      if (_resolved.constructor === Object) {
        return Buffer.from(JSON.stringify(_resolved));
      }
      if (_resolved instanceof URLSearchParams) {
        return Buffer.from(_resolved.toString());
      }
      if (_resolved instanceof FormData) {
        return new Response(_resolved).bytes().then((uint8arr) => Buffer.from(uint8arr));
      }
      return Buffer.from(_resolved);
    });
    return encoding ? promise2.then((buff) => buff.toString(encoding)) : promise2;
  }
  if (!Number.parseInt(event.node.req.headers["content-length"] || "") && !/\bchunked\b/i.test(
    String(event.node.req.headers["transfer-encoding"] ?? "")
  )) {
    return Promise.resolve(void 0);
  }
  const promise = event.node.req[RawBodySymbol$1] = new Promise(
    (resolve, reject) => {
      const bodyData = [];
      event.node.req.on("error", (err) => {
        reject(err);
      }).on("data", (chunk) => {
        bodyData.push(chunk);
      }).on("end", () => {
        resolve(Buffer.concat(bodyData));
      });
    }
  );
  const result = encoding ? promise.then((buff) => buff.toString(encoding)) : promise;
  return result;
}
function getRequestWebStream$1(event) {
  if (!PayloadMethods$1$1.includes(event.method)) {
    return;
  }
  const bodyStream = event.web?.request?.body || event._requestBody;
  if (bodyStream) {
    return bodyStream;
  }
  const _hasRawBody = RawBodySymbol$1 in event.node.req || "rawBody" in event.node.req || "body" in event.node.req || "__unenv__" in event.node.req;
  if (_hasRawBody) {
    return new ReadableStream({
      async start(controller) {
        const _rawBody = await readRawBody$1(event, false);
        if (_rawBody) {
          controller.enqueue(_rawBody);
        }
        controller.close();
      }
    });
  }
  return new ReadableStream({
    start: (controller) => {
      event.node.req.on("data", (chunk) => {
        controller.enqueue(chunk);
      });
      event.node.req.on("end", () => {
        controller.close();
      });
      event.node.req.on("error", (err) => {
        controller.error(err);
      });
    }
  });
}

function handleCacheHeaders(event, opts) {
  const cacheControls = ["public", ...opts.cacheControls || []];
  let cacheMatched = false;
  if (opts.maxAge !== void 0) {
    cacheControls.push(`max-age=${+opts.maxAge}`, `s-maxage=${+opts.maxAge}`);
  }
  if (opts.modifiedTime) {
    const modifiedTime = new Date(opts.modifiedTime);
    const ifModifiedSince = event.node.req.headers["if-modified-since"];
    event.node.res.setHeader("last-modified", modifiedTime.toUTCString());
    if (ifModifiedSince && new Date(ifModifiedSince) >= modifiedTime) {
      cacheMatched = true;
    }
  }
  if (opts.etag) {
    event.node.res.setHeader("etag", opts.etag);
    const ifNonMatch = event.node.req.headers["if-none-match"];
    if (ifNonMatch === opts.etag) {
      cacheMatched = true;
    }
  }
  event.node.res.setHeader("cache-control", cacheControls.join(", "));
  if (cacheMatched) {
    event.node.res.statusCode = 304;
    if (!event.handled) {
      event.node.res.end();
    }
    return true;
  }
  return false;
}

const MIMES$1 = {
  html: "text/html",
  json: "application/json"
};

const DISALLOWED_STATUS_CHARS$1 = /[^\u0009\u0020-\u007E]/g;
function sanitizeStatusMessage$1(statusMessage = "") {
  return statusMessage.replace(DISALLOWED_STATUS_CHARS$1, "");
}
function sanitizeStatusCode$1(statusCode, defaultStatusCode = 200) {
  if (!statusCode) {
    return defaultStatusCode;
  }
  if (typeof statusCode === "string") {
    statusCode = Number.parseInt(statusCode, 10);
  }
  if (statusCode < 100 || statusCode > 999) {
    return defaultStatusCode;
  }
  return statusCode;
}
function splitCookiesString$1(cookiesString) {
  if (Array.isArray(cookiesString)) {
    return cookiesString.flatMap((c) => splitCookiesString$1(c));
  }
  if (typeof cookiesString !== "string") {
    return [];
  }
  const cookiesStrings = [];
  let pos = 0;
  let start;
  let ch;
  let lastComma;
  let nextStart;
  let cookiesSeparatorFound;
  const skipWhitespace = () => {
    while (pos < cookiesString.length && /\s/.test(cookiesString.charAt(pos))) {
      pos += 1;
    }
    return pos < cookiesString.length;
  };
  const notSpecialChar = () => {
    ch = cookiesString.charAt(pos);
    return ch !== "=" && ch !== ";" && ch !== ",";
  };
  while (pos < cookiesString.length) {
    start = pos;
    cookiesSeparatorFound = false;
    while (skipWhitespace()) {
      ch = cookiesString.charAt(pos);
      if (ch === ",") {
        lastComma = pos;
        pos += 1;
        skipWhitespace();
        nextStart = pos;
        while (pos < cookiesString.length && notSpecialChar()) {
          pos += 1;
        }
        if (pos < cookiesString.length && cookiesString.charAt(pos) === "=") {
          cookiesSeparatorFound = true;
          pos = nextStart;
          cookiesStrings.push(cookiesString.slice(start, lastComma));
          start = pos;
        } else {
          pos = lastComma + 1;
        }
      } else {
        pos += 1;
      }
    }
    if (!cookiesSeparatorFound || pos >= cookiesString.length) {
      cookiesStrings.push(cookiesString.slice(start));
    }
  }
  return cookiesStrings;
}

const defer$1 = typeof setImmediate === "undefined" ? (fn) => fn() : setImmediate;
function send$1(event, data, type) {
  if (type) {
    defaultContentType$1(event, type);
  }
  return new Promise((resolve) => {
    defer$1(() => {
      if (!event.handled) {
        event.node.res.end(data);
      }
      resolve();
    });
  });
}
function sendNoContent(event, code) {
  if (event.handled) {
    return;
  }
  if (!code && event.node.res.statusCode !== 200) {
    code = event.node.res.statusCode;
  }
  const _code = sanitizeStatusCode$1(code, 204);
  if (_code === 204) {
    event.node.res.removeHeader("content-length");
  }
  event.node.res.writeHead(_code);
  event.node.res.end();
}
function setResponseStatus$1(event, code, text) {
  if (code) {
    event.node.res.statusCode = sanitizeStatusCode$1(
      code,
      event.node.res.statusCode
    );
  }
  if (text) {
    event.node.res.statusMessage = sanitizeStatusMessage$1(text);
  }
}
function defaultContentType$1(event, type) {
  if (type && event.node.res.statusCode !== 304 && !event.node.res.getHeader("content-type")) {
    event.node.res.setHeader("content-type", type);
  }
}
function sendRedirect$1(event, location, code = 302) {
  event.node.res.statusCode = sanitizeStatusCode$1(
    code,
    event.node.res.statusCode
  );
  event.node.res.setHeader("location", location);
  const encodedLoc = location.replace(/"/g, "%22");
  const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${encodedLoc}"></head></html>`;
  return send$1(event, html, MIMES$1.html);
}
function getResponseHeader$1(event, name) {
  return event.node.res.getHeader(name);
}
function setResponseHeaders(event, headers) {
  for (const [name, value] of Object.entries(headers)) {
    event.node.res.setHeader(
      name,
      value
    );
  }
}
const setHeaders = setResponseHeaders;
function setResponseHeader$1(event, name, value) {
  event.node.res.setHeader(name, value);
}
function appendResponseHeader$1(event, name, value) {
  let current = event.node.res.getHeader(name);
  if (!current) {
    event.node.res.setHeader(name, value);
    return;
  }
  if (!Array.isArray(current)) {
    current = [current.toString()];
  }
  event.node.res.setHeader(name, [...current, value]);
}
function removeResponseHeader$1(event, name) {
  return event.node.res.removeHeader(name);
}
function isStream(data) {
  if (!data || typeof data !== "object") {
    return false;
  }
  if (typeof data.pipe === "function") {
    if (typeof data._read === "function") {
      return true;
    }
    if (typeof data.abort === "function") {
      return true;
    }
  }
  if (typeof data.pipeTo === "function") {
    return true;
  }
  return false;
}
function isWebResponse(data) {
  return typeof Response !== "undefined" && data instanceof Response;
}
function sendStream$1(event, stream) {
  if (!stream || typeof stream !== "object") {
    throw new Error("[h3] Invalid stream provided.");
  }
  event.node.res._data = stream;
  if (!event.node.res.socket) {
    event._handled = true;
    return Promise.resolve();
  }
  if (hasProp$1(stream, "pipeTo") && typeof stream.pipeTo === "function") {
    return stream.pipeTo(
      new WritableStream({
        write(chunk) {
          event.node.res.write(chunk);
        }
      })
    ).then(() => {
      event.node.res.end();
    });
  }
  if (hasProp$1(stream, "pipe") && typeof stream.pipe === "function") {
    return new Promise((resolve, reject) => {
      stream.pipe(event.node.res);
      if (stream.on) {
        stream.on("end", () => {
          event.node.res.end();
          resolve();
        });
        stream.on("error", (error) => {
          reject(error);
        });
      }
      event.node.res.on("close", () => {
        if (stream.abort) {
          stream.abort();
        }
      });
    });
  }
  throw new Error("[h3] Invalid or incompatible stream provided.");
}
function sendWebResponse$1(event, response) {
  for (const [key, value] of response.headers) {
    if (key === "set-cookie") {
      event.node.res.appendHeader(key, splitCookiesString$1(value));
    } else {
      event.node.res.setHeader(key, value);
    }
  }
  if (response.status) {
    event.node.res.statusCode = sanitizeStatusCode$1(
      response.status,
      event.node.res.statusCode
    );
  }
  if (response.statusText) {
    event.node.res.statusMessage = sanitizeStatusMessage$1(response.statusText);
  }
  if (response.redirected) {
    event.node.res.setHeader("location", response.url);
  }
  if (!response.body) {
    event.node.res.end();
    return;
  }
  return sendStream$1(event, response.body);
}

const PayloadMethods = /* @__PURE__ */ new Set(["PATCH", "POST", "PUT", "DELETE"]);
const ignoredHeaders = /* @__PURE__ */ new Set([
  "transfer-encoding",
  "accept-encoding",
  "connection",
  "keep-alive",
  "upgrade",
  "expect",
  "host",
  "accept"
]);
async function proxyRequest(event, target, opts = {}) {
  let body;
  let duplex;
  if (PayloadMethods.has(event.method)) {
    if (opts.streamRequest) {
      body = getRequestWebStream$1(event);
      duplex = "half";
    } else {
      body = await readRawBody$1(event, false).catch(() => void 0);
    }
  }
  const method = opts.fetchOptions?.method || event.method;
  const fetchHeaders = mergeHeaders$1(
    getProxyRequestHeaders(event, { host: target.startsWith("/") }),
    opts.fetchOptions?.headers,
    opts.headers
  );
  return sendProxy(event, target, {
    ...opts,
    fetchOptions: {
      method,
      body,
      duplex,
      ...opts.fetchOptions,
      headers: fetchHeaders
    }
  });
}
async function sendProxy(event, target, opts = {}) {
  let response;
  try {
    response = await _getFetch(opts.fetch)(target, {
      headers: opts.headers,
      ignoreResponseError: true,
      // make $ofetch.raw transparent
      ...opts.fetchOptions
    });
  } catch (error) {
    throw createError$2({
      status: 502,
      statusMessage: "Bad Gateway",
      cause: error
    });
  }
  event.node.res.statusCode = sanitizeStatusCode$1(
    response.status,
    event.node.res.statusCode
  );
  event.node.res.statusMessage = sanitizeStatusMessage$1(response.statusText);
  const cookies = [];
  for (const [key, value] of response.headers.entries()) {
    if (key === "content-encoding") {
      continue;
    }
    if (key === "content-length") {
      continue;
    }
    if (key === "set-cookie") {
      cookies.push(...splitCookiesString$1(value));
      continue;
    }
    event.node.res.setHeader(key, value);
  }
  if (cookies.length > 0) {
    event.node.res.setHeader(
      "set-cookie",
      cookies.map((cookie) => {
        if (opts.cookieDomainRewrite) {
          cookie = rewriteCookieProperty(
            cookie,
            opts.cookieDomainRewrite,
            "domain"
          );
        }
        if (opts.cookiePathRewrite) {
          cookie = rewriteCookieProperty(
            cookie,
            opts.cookiePathRewrite,
            "path"
          );
        }
        return cookie;
      })
    );
  }
  if (opts.onResponse) {
    await opts.onResponse(event, response);
  }
  if (response._data !== void 0) {
    return response._data;
  }
  if (event.handled) {
    return;
  }
  if (opts.sendStream === false) {
    const data = new Uint8Array(await response.arrayBuffer());
    return event.node.res.end(data);
  }
  if (response.body) {
    for await (const chunk of response.body) {
      event.node.res.write(chunk);
    }
  }
  return event.node.res.end();
}
function getProxyRequestHeaders(event, opts) {
  const headers = /* @__PURE__ */ Object.create(null);
  const reqHeaders = getRequestHeaders$1(event);
  for (const name in reqHeaders) {
    if (!ignoredHeaders.has(name) || name === "host" && opts?.host) {
      headers[name] = reqHeaders[name];
    }
  }
  return headers;
}
function fetchWithEvent(event, req, init, options) {
  return _getFetch(options?.fetch)(req, {
    ...init,
    context: init?.context || event.context,
    headers: {
      ...getProxyRequestHeaders(event, {
        host: typeof req === "string" && req.startsWith("/")
      }),
      ...init?.headers
    }
  });
}
function _getFetch(_fetch) {
  if (_fetch) {
    return _fetch;
  }
  if (globalThis.fetch) {
    return globalThis.fetch;
  }
  throw new Error(
    "fetch is not available. Try importing `node-fetch-native/polyfill` for Node.js."
  );
}
function rewriteCookieProperty(header, map, property) {
  const _map = typeof map === "string" ? { "*": map } : map;
  return header.replace(
    new RegExp(`(;\\s*${property}=)([^;]+)`, "gi"),
    (match, prefix, previousValue) => {
      let newValue;
      if (previousValue in _map) {
        newValue = _map[previousValue];
      } else if ("*" in _map) {
        newValue = _map["*"];
      } else {
        return match;
      }
      return newValue ? prefix + newValue : "";
    }
  );
}
function mergeHeaders$1(defaults, ...inputs) {
  const _inputs = inputs.filter(Boolean);
  if (_inputs.length === 0) {
    return defaults;
  }
  const merged = new Headers(defaults);
  for (const input of _inputs) {
    const entries = Array.isArray(input) ? input : typeof input.entries === "function" ? input.entries() : Object.entries(input);
    for (const [key, value] of entries) {
      if (value !== void 0) {
        merged.set(key, value);
      }
    }
  }
  return merged;
}

let H3Event$1 = class H3Event {
  "__is_event__" = true;
  // Context
  node;
  // Node
  web;
  // Web
  context = {};
  // Shared
  // Request
  _method;
  _path;
  _headers;
  _requestBody;
  // Response
  _handled = false;
  // Hooks
  _onBeforeResponseCalled;
  _onAfterResponseCalled;
  constructor(req, res) {
    this.node = { req, res };
  }
  // --- Request ---
  get method() {
    if (!this._method) {
      this._method = (this.node.req.method || "GET").toUpperCase();
    }
    return this._method;
  }
  get path() {
    return this._path || this.node.req.url || "/";
  }
  get headers() {
    if (!this._headers) {
      this._headers = _normalizeNodeHeaders$1(this.node.req.headers);
    }
    return this._headers;
  }
  // --- Respoonse ---
  get handled() {
    return this._handled || this.node.res.writableEnded || this.node.res.headersSent;
  }
  respondWith(response) {
    return Promise.resolve(response).then(
      (_response) => sendWebResponse$1(this, _response)
    );
  }
  // --- Utils ---
  toString() {
    return `[${this.method}] ${this.path}`;
  }
  toJSON() {
    return this.toString();
  }
  // --- Deprecated ---
  /** @deprecated Please use `event.node.req` instead. */
  get req() {
    return this.node.req;
  }
  /** @deprecated Please use `event.node.res` instead. */
  get res() {
    return this.node.res;
  }
};
function isEvent(input) {
  return hasProp$1(input, "__is_event__");
}
function createEvent(req, res) {
  return new H3Event$1(req, res);
}
function _normalizeNodeHeaders$1(nodeHeaders) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(nodeHeaders)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
    } else if (value) {
      headers.set(name, value);
    }
  }
  return headers;
}

function defineEventHandler$1(handler) {
  if (typeof handler === "function") {
    handler.__is_handler__ = true;
    return handler;
  }
  const _hooks = {
    onRequest: _normalizeArray$1(handler.onRequest),
    onBeforeResponse: _normalizeArray$1(handler.onBeforeResponse)
  };
  const _handler = (event) => {
    return _callHandler$1(event, handler.handler, _hooks);
  };
  _handler.__is_handler__ = true;
  _handler.__resolve__ = handler.handler.__resolve__;
  _handler.__websocket__ = handler.websocket;
  return _handler;
}
function _normalizeArray$1(input) {
  return input ? Array.isArray(input) ? input : [input] : void 0;
}
async function _callHandler$1(event, handler, hooks) {
  if (hooks.onRequest) {
    for (const hook of hooks.onRequest) {
      await hook(event);
      if (event.handled) {
        return;
      }
    }
  }
  const body = await handler(event);
  const response = { body };
  if (hooks.onBeforeResponse) {
    for (const hook of hooks.onBeforeResponse) {
      await hook(event, response);
    }
  }
  return response.body;
}
const eventHandler$1 = defineEventHandler$1;
function isEventHandler(input) {
  return hasProp$1(input, "__is_handler__");
}
function toEventHandler(input, _, _route) {
  return input;
}
function defineLazyEventHandler(factory) {
  let _promise;
  let _resolved;
  const resolveHandler = () => {
    if (_resolved) {
      return Promise.resolve(_resolved);
    }
    if (!_promise) {
      _promise = Promise.resolve(factory()).then((r) => {
        const handler2 = r.default || r;
        if (typeof handler2 !== "function") {
          throw new TypeError(
            "Invalid lazy handler result. It should be a function:",
            handler2
          );
        }
        _resolved = { handler: toEventHandler(r.default || r) };
        return _resolved;
      });
    }
    return _promise;
  };
  const handler = eventHandler$1((event) => {
    if (_resolved) {
      return _resolved.handler(event);
    }
    return resolveHandler().then((r) => r.handler(event));
  });
  handler.__resolve__ = resolveHandler;
  return handler;
}
const lazyEventHandler = defineLazyEventHandler;

function createApp(options = {}) {
  const stack = [];
  const handler = createAppEventHandler(stack, options);
  const resolve = createResolver(stack);
  handler.__resolve__ = resolve;
  const getWebsocket = cachedFn(() => websocketOptions(resolve, options));
  const app = {
    // @ts-expect-error
    use: (arg1, arg2, arg3) => use(app, arg1, arg2, arg3),
    resolve,
    handler,
    stack,
    options,
    get websocket() {
      return getWebsocket();
    }
  };
  return app;
}
function use(app, arg1, arg2, arg3) {
  if (Array.isArray(arg1)) {
    for (const i of arg1) {
      use(app, i, arg2, arg3);
    }
  } else if (Array.isArray(arg2)) {
    for (const i of arg2) {
      use(app, arg1, i, arg3);
    }
  } else if (typeof arg1 === "string") {
    app.stack.push(
      normalizeLayer({ ...arg3, route: arg1, handler: arg2 })
    );
  } else if (typeof arg1 === "function") {
    app.stack.push(normalizeLayer({ ...arg2, handler: arg1 }));
  } else {
    app.stack.push(normalizeLayer({ ...arg1 }));
  }
  return app;
}
function createAppEventHandler(stack, options) {
  const spacing = options.debug ? 2 : void 0;
  return eventHandler$1(async (event) => {
    event.node.req.originalUrl = event.node.req.originalUrl || event.node.req.url || "/";
    const _rawReqUrl = event.node.req.url || "/";
    const _reqPath = _decodePath(event._path || _rawReqUrl);
    event._path = _reqPath;
    const _needsRawUrl = _reqPath !== _rawReqUrl;
    let _layerPath;
    if (options.onRequest) {
      await options.onRequest(event);
    }
    for (const layer of stack) {
      if (layer.route.length > 1) {
        if (!_reqPath.startsWith(layer.route)) {
          continue;
        }
        _layerPath = _reqPath.slice(layer.route.length) || "/";
      } else {
        _layerPath = _reqPath;
      }
      if (layer.match && !layer.match(_layerPath, event)) {
        continue;
      }
      event._path = _layerPath;
      event.node.req.url = _needsRawUrl ? layer.route.length > 1 ? _rawReqUrl.slice(layer.route.length) || "/" : _rawReqUrl : _layerPath;
      const val = await layer.handler(event);
      const _body = val === void 0 ? void 0 : await val;
      if (_body !== void 0) {
        const _response = { body: _body };
        if (options.onBeforeResponse) {
          event._onBeforeResponseCalled = true;
          await options.onBeforeResponse(event, _response);
        }
        await handleHandlerResponse(event, _response.body, spacing);
        if (options.onAfterResponse) {
          event._onAfterResponseCalled = true;
          await options.onAfterResponse(event, _response);
        }
        return;
      }
      if (event.handled) {
        if (options.onAfterResponse) {
          event._onAfterResponseCalled = true;
          await options.onAfterResponse(event, void 0);
        }
        return;
      }
    }
    if (!event.handled) {
      throw createError$2({
        statusCode: 404,
        statusMessage: `Cannot find any path matching ${event.path || "/"}.`
      });
    }
    if (options.onAfterResponse) {
      event._onAfterResponseCalled = true;
      await options.onAfterResponse(event, void 0);
    }
  });
}
function createResolver(stack) {
  return async (path) => {
    let _layerPath;
    for (const layer of stack) {
      if (layer.route === "/" && !layer.handler.__resolve__) {
        continue;
      }
      if (!path.startsWith(layer.route)) {
        continue;
      }
      _layerPath = path.slice(layer.route.length) || "/";
      if (layer.match && !layer.match(_layerPath, void 0)) {
        continue;
      }
      let res = { route: layer.route, handler: layer.handler };
      if (res.handler.__resolve__) {
        const _res = await res.handler.__resolve__(_layerPath);
        if (!_res) {
          continue;
        }
        res = {
          ...res,
          ..._res,
          route: joinURL(res.route || "/", _res.route || "/")
        };
      }
      return res;
    }
  };
}
function normalizeLayer(input) {
  let handler = input.handler;
  if (handler.handler) {
    handler = handler.handler;
  }
  if (input.lazy) {
    handler = lazyEventHandler(handler);
  } else if (!isEventHandler(handler)) {
    handler = toEventHandler(handler, void 0, input.route);
  }
  return {
    route: withoutTrailingSlash(input.route),
    match: input.match,
    handler
  };
}
function handleHandlerResponse(event, val, jsonSpace) {
  if (val === null) {
    return sendNoContent(event);
  }
  if (val) {
    if (isWebResponse(val)) {
      return sendWebResponse$1(event, val);
    }
    if (isStream(val)) {
      return sendStream$1(event, val);
    }
    if (val.buffer) {
      return send$1(event, val);
    }
    if (val.arrayBuffer && typeof val.arrayBuffer === "function") {
      return val.arrayBuffer().then((arrayBuffer) => {
        return send$1(event, Buffer.from(arrayBuffer), val.type);
      });
    }
    if (val instanceof Error) {
      throw createError$2(val);
    }
    if (typeof val.end === "function") {
      return true;
    }
  }
  const valType = typeof val;
  if (valType === "string") {
    return send$1(event, val, MIMES$1.html);
  }
  if (valType === "object" || valType === "boolean" || valType === "number") {
    return send$1(event, JSON.stringify(val, void 0, jsonSpace), MIMES$1.json);
  }
  if (valType === "bigint") {
    return send$1(event, val.toString(), MIMES$1.json);
  }
  throw createError$2({
    statusCode: 500,
    statusMessage: `[h3] Cannot send ${valType} as response.`
  });
}
function cachedFn(fn) {
  let cache;
  return () => {
    if (!cache) {
      cache = fn();
    }
    return cache;
  };
}
function _decodePath(url) {
  const qIndex = url.indexOf("?");
  const path = qIndex === -1 ? url : url.slice(0, qIndex);
  const query = qIndex === -1 ? "" : url.slice(qIndex);
  const decodedPath = path.includes("%25") ? decodePath(path.replace(/%25/g, "%2525")) : decodePath(path);
  return decodedPath + query;
}
function websocketOptions(evResolver, appOptions) {
  return {
    ...appOptions.websocket,
    async resolve(info) {
      const url = info.request?.url || info.url || "/";
      const { pathname } = typeof url === "string" ? parseURL(url) : url;
      const resolved = await evResolver(pathname);
      return resolved?.handler?.__websocket__ || {};
    }
  };
}

const RouterMethods = [
  "connect",
  "delete",
  "get",
  "head",
  "options",
  "post",
  "put",
  "trace",
  "patch"
];
function createRouter(opts = {}) {
  const _router = createRouter$1({});
  const routes = {};
  let _matcher;
  const router = {};
  const addRoute = (path, handler, method) => {
    let route = routes[path];
    if (!route) {
      routes[path] = route = { path, handlers: {} };
      _router.insert(path, route);
    }
    if (Array.isArray(method)) {
      for (const m of method) {
        addRoute(path, handler, m);
      }
    } else {
      route.handlers[method] = toEventHandler(handler);
    }
    return router;
  };
  router.use = router.add = (path, handler, method) => addRoute(path, handler, method || "all");
  for (const method of RouterMethods) {
    router[method] = (path, handle) => router.add(path, handle, method);
  }
  const matchHandler = (path = "/", method = "get") => {
    const qIndex = path.indexOf("?");
    if (qIndex !== -1) {
      path = path.slice(0, Math.max(0, qIndex));
    }
    const matched = _router.lookup(path);
    if (!matched || !matched.handlers) {
      return {
        error: createError$2({
          statusCode: 404,
          name: "Not Found",
          statusMessage: `Cannot find any route matching ${path || "/"}.`
        })
      };
    }
    let handler = matched.handlers[method] || matched.handlers.all;
    if (!handler) {
      if (!_matcher) {
        _matcher = toRouteMatcher(_router);
      }
      const _matches = _matcher.matchAll(path).reverse();
      for (const _match of _matches) {
        if (_match.handlers[method]) {
          handler = _match.handlers[method];
          matched.handlers[method] = matched.handlers[method] || handler;
          break;
        }
        if (_match.handlers.all) {
          handler = _match.handlers.all;
          matched.handlers.all = matched.handlers.all || handler;
          break;
        }
      }
    }
    if (!handler) {
      return {
        error: createError$2({
          statusCode: 405,
          name: "Method Not Allowed",
          statusMessage: `Method ${method} is not allowed on this route.`
        })
      };
    }
    return { matched, handler };
  };
  const isPreemptive = opts.preemptive || opts.preemtive;
  router.handler = eventHandler$1((event) => {
    const match = matchHandler(
      event.path,
      event.method.toLowerCase()
    );
    if ("error" in match) {
      if (isPreemptive) {
        throw match.error;
      } else {
        return;
      }
    }
    event.context.matchedRoute = match.matched;
    const params = match.matched.params || {};
    event.context.params = params;
    return Promise.resolve(match.handler(event)).then((res) => {
      if (res === void 0 && isPreemptive) {
        return null;
      }
      return res;
    });
  });
  router.handler.__resolve__ = async (path) => {
    path = withLeadingSlash(path);
    const match = matchHandler(path);
    if ("error" in match) {
      return;
    }
    let res = {
      route: match.matched.path,
      handler: match.handler
    };
    if (match.handler.__resolve__) {
      const _res = await match.handler.__resolve__(path);
      if (!_res) {
        return;
      }
      res = { ...res, ..._res };
    }
    return res;
  };
  return router;
}
function toNodeListener(app) {
  const toNodeHandle = async function(req, res) {
    const event = createEvent(req, res);
    try {
      await app.handler(event);
    } catch (_error) {
      const error = createError$2(_error);
      if (!isError$1(_error)) {
        error.unhandled = true;
      }
      setResponseStatus$1(event, error.statusCode, error.statusMessage);
      if (app.options.onError) {
        await app.options.onError(error, event);
      }
      if (event.handled) {
        return;
      }
      if (error.unhandled || error.fatal) {
        console.error("[h3]", error.fatal ? "[fatal]" : "[unhandled]", error);
      }
      if (app.options.onBeforeResponse && !event._onBeforeResponseCalled) {
        await app.options.onBeforeResponse(event, { body: error });
      }
      await sendError(event, error, !!app.options.debug);
      if (app.options.onAfterResponse && !event._onAfterResponseCalled) {
        await app.options.onAfterResponse(event, { body: error });
      }
    }
  };
  return toNodeHandle;
}

function flatHooks(configHooks, hooks = {}, parentName) {
  for (const key in configHooks) {
    const subHook = configHooks[key];
    const name = parentName ? `${parentName}:${key}` : key;
    if (typeof subHook === "object" && subHook !== null) {
      flatHooks(subHook, hooks, name);
    } else if (typeof subHook === "function") {
      hooks[name] = subHook;
    }
  }
  return hooks;
}
const defaultTask = { run: (function_) => function_() };
const _createTask = () => defaultTask;
const createTask = typeof console.createTask !== "undefined" ? console.createTask : _createTask;
function serialTaskCaller(hooks, args) {
  const name = args.shift();
  const task = createTask(name);
  return hooks.reduce(
    (promise, hookFunction) => promise.then(() => task.run(() => hookFunction(...args))),
    Promise.resolve()
  );
}
function parallelTaskCaller(hooks, args) {
  const name = args.shift();
  const task = createTask(name);
  return Promise.all(hooks.map((hook) => task.run(() => hook(...args))));
}
function callEachWith(callbacks, arg0) {
  for (const callback of [...callbacks]) {
    callback(arg0);
  }
}

class Hookable {
  constructor() {
    this._hooks = {};
    this._before = void 0;
    this._after = void 0;
    this._deprecatedMessages = void 0;
    this._deprecatedHooks = {};
    this.hook = this.hook.bind(this);
    this.callHook = this.callHook.bind(this);
    this.callHookWith = this.callHookWith.bind(this);
  }
  hook(name, function_, options = {}) {
    if (!name || typeof function_ !== "function") {
      return () => {
      };
    }
    const originalName = name;
    let dep;
    while (this._deprecatedHooks[name]) {
      dep = this._deprecatedHooks[name];
      name = dep.to;
    }
    if (dep && !options.allowDeprecated) {
      let message = dep.message;
      if (!message) {
        message = `${originalName} hook has been deprecated` + (dep.to ? `, please use ${dep.to}` : "");
      }
      if (!this._deprecatedMessages) {
        this._deprecatedMessages = /* @__PURE__ */ new Set();
      }
      if (!this._deprecatedMessages.has(message)) {
        console.warn(message);
        this._deprecatedMessages.add(message);
      }
    }
    if (!function_.name) {
      try {
        Object.defineProperty(function_, "name", {
          get: () => "_" + name.replace(/\W+/g, "_") + "_hook_cb",
          configurable: true
        });
      } catch {
      }
    }
    this._hooks[name] = this._hooks[name] || [];
    this._hooks[name].push(function_);
    return () => {
      if (function_) {
        this.removeHook(name, function_);
        function_ = void 0;
      }
    };
  }
  hookOnce(name, function_) {
    let _unreg;
    let _function = (...arguments_) => {
      if (typeof _unreg === "function") {
        _unreg();
      }
      _unreg = void 0;
      _function = void 0;
      return function_(...arguments_);
    };
    _unreg = this.hook(name, _function);
    return _unreg;
  }
  removeHook(name, function_) {
    if (this._hooks[name]) {
      const index = this._hooks[name].indexOf(function_);
      if (index !== -1) {
        this._hooks[name].splice(index, 1);
      }
      if (this._hooks[name].length === 0) {
        delete this._hooks[name];
      }
    }
  }
  deprecateHook(name, deprecated) {
    this._deprecatedHooks[name] = typeof deprecated === "string" ? { to: deprecated } : deprecated;
    const _hooks = this._hooks[name] || [];
    delete this._hooks[name];
    for (const hook of _hooks) {
      this.hook(name, hook);
    }
  }
  deprecateHooks(deprecatedHooks) {
    Object.assign(this._deprecatedHooks, deprecatedHooks);
    for (const name in deprecatedHooks) {
      this.deprecateHook(name, deprecatedHooks[name]);
    }
  }
  addHooks(configHooks) {
    const hooks = flatHooks(configHooks);
    const removeFns = Object.keys(hooks).map(
      (key) => this.hook(key, hooks[key])
    );
    return () => {
      for (const unreg of removeFns.splice(0, removeFns.length)) {
        unreg();
      }
    };
  }
  removeHooks(configHooks) {
    const hooks = flatHooks(configHooks);
    for (const key in hooks) {
      this.removeHook(key, hooks[key]);
    }
  }
  removeAllHooks() {
    for (const key in this._hooks) {
      delete this._hooks[key];
    }
  }
  callHook(name, ...arguments_) {
    arguments_.unshift(name);
    return this.callHookWith(serialTaskCaller, name, ...arguments_);
  }
  callHookParallel(name, ...arguments_) {
    arguments_.unshift(name);
    return this.callHookWith(parallelTaskCaller, name, ...arguments_);
  }
  callHookWith(caller, name, ...arguments_) {
    const event = this._before || this._after ? { name, args: arguments_, context: {} } : void 0;
    if (this._before) {
      callEachWith(this._before, event);
    }
    const result = caller(
      name in this._hooks ? [...this._hooks[name]] : [],
      arguments_
    );
    if (result instanceof Promise) {
      return result.finally(() => {
        if (this._after && event) {
          callEachWith(this._after, event);
        }
      });
    }
    if (this._after && event) {
      callEachWith(this._after, event);
    }
    return result;
  }
  beforeEach(function_) {
    this._before = this._before || [];
    this._before.push(function_);
    return () => {
      if (this._before !== void 0) {
        const index = this._before.indexOf(function_);
        if (index !== -1) {
          this._before.splice(index, 1);
        }
      }
    };
  }
  afterEach(function_) {
    this._after = this._after || [];
    this._after.push(function_);
    return () => {
      if (this._after !== void 0) {
        const index = this._after.indexOf(function_);
        if (index !== -1) {
          this._after.splice(index, 1);
        }
      }
    };
  }
}
function createHooks() {
  return new Hookable();
}

const s$1=globalThis.Headers,i$1=globalThis.AbortController,l$1=globalThis.fetch||(()=>{throw new Error("[node-fetch-native] Failed to fetch: `globalThis.fetch` is not available!")});

class FetchError extends Error {
  constructor(message, opts) {
    super(message, opts);
    this.name = "FetchError";
    if (opts?.cause && !this.cause) {
      this.cause = opts.cause;
    }
  }
}
function createFetchError(ctx) {
  const errorMessage = ctx.error?.message || ctx.error?.toString() || "";
  const method = ctx.request?.method || ctx.options?.method || "GET";
  const url = ctx.request?.url || String(ctx.request) || "/";
  const requestStr = `[${method}] ${JSON.stringify(url)}`;
  const statusStr = ctx.response ? `${ctx.response.status} ${ctx.response.statusText}` : "<no response>";
  const message = `${requestStr}: ${statusStr}${errorMessage ? ` ${errorMessage}` : ""}`;
  const fetchError = new FetchError(
    message,
    ctx.error ? { cause: ctx.error } : void 0
  );
  for (const key of ["request", "options", "response"]) {
    Object.defineProperty(fetchError, key, {
      get() {
        return ctx[key];
      }
    });
  }
  for (const [key, refKey] of [
    ["data", "_data"],
    ["status", "status"],
    ["statusCode", "status"],
    ["statusText", "statusText"],
    ["statusMessage", "statusText"]
  ]) {
    Object.defineProperty(fetchError, key, {
      get() {
        return ctx.response && ctx.response[refKey];
      }
    });
  }
  return fetchError;
}

const payloadMethods = new Set(
  Object.freeze(["PATCH", "POST", "PUT", "DELETE"])
);
function isPayloadMethod(method = "GET") {
  return payloadMethods.has(method.toUpperCase());
}
function isJSONSerializable(value) {
  if (value === void 0) {
    return false;
  }
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean" || t === null) {
    return true;
  }
  if (t !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return true;
  }
  if (value.buffer) {
    return false;
  }
  if (value instanceof FormData || value instanceof URLSearchParams) {
    return false;
  }
  return value.constructor && value.constructor.name === "Object" || typeof value.toJSON === "function";
}
const textTypes = /* @__PURE__ */ new Set([
  "image/svg",
  "application/xml",
  "application/xhtml",
  "application/html"
]);
const JSON_RE = /^application\/(?:[\w!#$%&*.^`~-]*\+)?json(;.+)?$/i;
function detectResponseType(_contentType = "") {
  if (!_contentType) {
    return "json";
  }
  const contentType = _contentType.split(";").shift() || "";
  if (JSON_RE.test(contentType)) {
    return "json";
  }
  if (contentType === "text/event-stream") {
    return "stream";
  }
  if (textTypes.has(contentType) || contentType.startsWith("text/")) {
    return "text";
  }
  return "blob";
}
function resolveFetchOptions(request, input, defaults, Headers) {
  const headers = mergeHeaders(
    input?.headers ?? request?.headers,
    defaults?.headers,
    Headers
  );
  let query;
  if (defaults?.query || defaults?.params || input?.params || input?.query) {
    query = {
      ...defaults?.params,
      ...defaults?.query,
      ...input?.params,
      ...input?.query
    };
  }
  return {
    ...defaults,
    ...input,
    query,
    params: query,
    headers
  };
}
function mergeHeaders(input, defaults, Headers) {
  if (!defaults) {
    return new Headers(input);
  }
  const headers = new Headers(defaults);
  if (input) {
    for (const [key, value] of Symbol.iterator in input || Array.isArray(input) ? input : new Headers(input)) {
      headers.set(key, value);
    }
  }
  return headers;
}
async function callHooks(context, hooks) {
  if (hooks) {
    if (Array.isArray(hooks)) {
      for (const hook of hooks) {
        await hook(context);
      }
    } else {
      await hooks(context);
    }
  }
}

const retryStatusCodes = /* @__PURE__ */ new Set([
  408,
  // Request Timeout
  409,
  // Conflict
  425,
  // Too Early (Experimental)
  429,
  // Too Many Requests
  500,
  // Internal Server Error
  502,
  // Bad Gateway
  503,
  // Service Unavailable
  504
  // Gateway Timeout
]);
const nullBodyResponses = /* @__PURE__ */ new Set([101, 204, 205, 304]);
function createFetch(globalOptions = {}) {
  const {
    fetch = globalThis.fetch,
    Headers = globalThis.Headers,
    AbortController = globalThis.AbortController
  } = globalOptions;
  async function onError(context) {
    const isAbort = context.error && context.error.name === "AbortError" && !context.options.timeout || false;
    if (context.options.retry !== false && !isAbort) {
      let retries;
      if (typeof context.options.retry === "number") {
        retries = context.options.retry;
      } else {
        retries = isPayloadMethod(context.options.method) ? 0 : 1;
      }
      const responseCode = context.response && context.response.status || 500;
      if (retries > 0 && (Array.isArray(context.options.retryStatusCodes) ? context.options.retryStatusCodes.includes(responseCode) : retryStatusCodes.has(responseCode))) {
        const retryDelay = typeof context.options.retryDelay === "function" ? context.options.retryDelay(context) : context.options.retryDelay || 0;
        if (retryDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
        return $fetchRaw(context.request, {
          ...context.options,
          retry: retries - 1
        });
      }
    }
    const error = createFetchError(context);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(error, $fetchRaw);
    }
    throw error;
  }
  const $fetchRaw = async function $fetchRaw2(_request, _options = {}) {
    const context = {
      request: _request,
      options: resolveFetchOptions(
        _request,
        _options,
        globalOptions.defaults,
        Headers
      ),
      response: void 0,
      error: void 0
    };
    if (context.options.method) {
      context.options.method = context.options.method.toUpperCase();
    }
    if (context.options.onRequest) {
      await callHooks(context, context.options.onRequest);
      if (!(context.options.headers instanceof Headers)) {
        context.options.headers = new Headers(
          context.options.headers || {}
          /* compat */
        );
      }
    }
    if (typeof context.request === "string") {
      if (context.options.baseURL) {
        context.request = withBase(context.request, context.options.baseURL);
      }
      if (context.options.query) {
        context.request = withQuery(context.request, context.options.query);
        delete context.options.query;
      }
      if ("query" in context.options) {
        delete context.options.query;
      }
      if ("params" in context.options) {
        delete context.options.params;
      }
    }
    if (context.options.body && isPayloadMethod(context.options.method)) {
      if (isJSONSerializable(context.options.body)) {
        const contentType = context.options.headers.get("content-type");
        if (typeof context.options.body !== "string") {
          context.options.body = contentType === "application/x-www-form-urlencoded" ? new URLSearchParams(
            context.options.body
          ).toString() : JSON.stringify(context.options.body);
        }
        if (!contentType) {
          context.options.headers.set("content-type", "application/json");
        }
        if (!context.options.headers.has("accept")) {
          context.options.headers.set("accept", "application/json");
        }
      } else if (
        // ReadableStream Body
        "pipeTo" in context.options.body && typeof context.options.body.pipeTo === "function" || // Node.js Stream Body
        typeof context.options.body.pipe === "function"
      ) {
        if (!("duplex" in context.options)) {
          context.options.duplex = "half";
        }
      }
    }
    let abortTimeout;
    if (!context.options.signal && context.options.timeout) {
      const controller = new AbortController();
      abortTimeout = setTimeout(() => {
        const error = new Error(
          "[TimeoutError]: The operation was aborted due to timeout"
        );
        error.name = "TimeoutError";
        error.code = 23;
        controller.abort(error);
      }, context.options.timeout);
      context.options.signal = controller.signal;
    }
    try {
      context.response = await fetch(
        context.request,
        context.options
      );
    } catch (error) {
      context.error = error;
      if (context.options.onRequestError) {
        await callHooks(
          context,
          context.options.onRequestError
        );
      }
      return await onError(context);
    } finally {
      if (abortTimeout) {
        clearTimeout(abortTimeout);
      }
    }
    const hasBody = (context.response.body || // https://github.com/unjs/ofetch/issues/324
    // https://github.com/unjs/ofetch/issues/294
    // https://github.com/JakeChampion/fetch/issues/1454
    context.response._bodyInit) && !nullBodyResponses.has(context.response.status) && context.options.method !== "HEAD";
    if (hasBody) {
      const responseType = (context.options.parseResponse ? "json" : context.options.responseType) || detectResponseType(context.response.headers.get("content-type") || "");
      switch (responseType) {
        case "json": {
          const data = await context.response.text();
          const parseFunction = context.options.parseResponse || destr;
          context.response._data = parseFunction(data);
          break;
        }
        case "stream": {
          context.response._data = context.response.body || context.response._bodyInit;
          break;
        }
        default: {
          context.response._data = await context.response[responseType]();
        }
      }
    }
    if (context.options.onResponse) {
      await callHooks(
        context,
        context.options.onResponse
      );
    }
    if (!context.options.ignoreResponseError && context.response.status >= 400 && context.response.status < 600) {
      if (context.options.onResponseError) {
        await callHooks(
          context,
          context.options.onResponseError
        );
      }
      return await onError(context);
    }
    return context.response;
  };
  const $fetch = async function $fetch2(request, options) {
    const r = await $fetchRaw(request, options);
    return r._data;
  };
  $fetch.raw = $fetchRaw;
  $fetch.native = (...args) => fetch(...args);
  $fetch.create = (defaultOptions = {}, customGlobalOptions = {}) => createFetch({
    ...globalOptions,
    ...customGlobalOptions,
    defaults: {
      ...globalOptions.defaults,
      ...customGlobalOptions.defaults,
      ...defaultOptions
    }
  });
  return $fetch;
}

function createNodeFetch() {
  const useKeepAlive = JSON.parse(process.env.FETCH_KEEP_ALIVE || "false");
  if (!useKeepAlive) {
    return l$1;
  }
  const agentOptions = { keepAlive: true };
  const httpAgent = new http.Agent(agentOptions);
  const httpsAgent = new https.Agent(agentOptions);
  const nodeFetchOptions = {
    agent(parsedURL) {
      return parsedURL.protocol === "http:" ? httpAgent : httpsAgent;
    }
  };
  return function nodeFetchWithKeepAlive(input, init) {
    return l$1(input, { ...nodeFetchOptions, ...init });
  };
}
const fetch = globalThis.fetch ? (...args) => globalThis.fetch(...args) : createNodeFetch();
const Headers$1 = globalThis.Headers || s$1;
const AbortController$1 = globalThis.AbortController || i$1;
createFetch({ fetch, Headers: Headers$1, AbortController: AbortController$1 });

function wrapToPromise(value) {
  if (!value || typeof value.then !== "function") {
    return Promise.resolve(value);
  }
  return value;
}
function asyncCall(function_, ...arguments_) {
  try {
    return wrapToPromise(function_(...arguments_));
  } catch (error) {
    return Promise.reject(error);
  }
}
function isPrimitive(value) {
  const type = typeof value;
  return value === null || type !== "object" && type !== "function";
}
function isPureObject(value) {
  const proto = Object.getPrototypeOf(value);
  return !proto || proto.isPrototypeOf(Object);
}
function stringify(value) {
  if (isPrimitive(value)) {
    return String(value);
  }
  if (isPureObject(value) || Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value.toJSON === "function") {
    return stringify(value.toJSON());
  }
  throw new Error("[unstorage] Cannot stringify value!");
}
const BASE64_PREFIX = "base64:";
function serializeRaw(value) {
  if (typeof value === "string") {
    return value;
  }
  return BASE64_PREFIX + base64Encode(value);
}
function deserializeRaw(value) {
  if (typeof value !== "string") {
    return value;
  }
  if (!value.startsWith(BASE64_PREFIX)) {
    return value;
  }
  return base64Decode(value.slice(BASE64_PREFIX.length));
}
function base64Decode(input) {
  if (globalThis.Buffer) {
    return Buffer.from(input, "base64");
  }
  return Uint8Array.from(
    globalThis.atob(input),
    (c) => c.codePointAt(0)
  );
}
function base64Encode(input) {
  if (globalThis.Buffer) {
    return Buffer.from(input).toString("base64");
  }
  return globalThis.btoa(String.fromCodePoint(...input));
}

const storageKeyProperties = [
  "has",
  "hasItem",
  "get",
  "getItem",
  "getItemRaw",
  "set",
  "setItem",
  "setItemRaw",
  "del",
  "remove",
  "removeItem",
  "getMeta",
  "setMeta",
  "removeMeta",
  "getKeys",
  "clear",
  "mount",
  "unmount"
];
function prefixStorage(storage, base) {
  base = normalizeBaseKey(base);
  if (!base) {
    return storage;
  }
  const nsStorage = { ...storage };
  for (const property of storageKeyProperties) {
    nsStorage[property] = (key = "", ...args) => (
      // @ts-ignore
      storage[property](base + key, ...args)
    );
  }
  nsStorage.getKeys = (key = "", ...arguments_) => storage.getKeys(base + key, ...arguments_).then((keys) => keys.map((key2) => key2.slice(base.length)));
  nsStorage.keys = nsStorage.getKeys;
  nsStorage.getItems = async (items, commonOptions) => {
    const prefixedItems = items.map(
      (item) => typeof item === "string" ? base + item : { ...item, key: base + item.key }
    );
    const results = await storage.getItems(prefixedItems, commonOptions);
    return results.map((entry) => ({
      key: entry.key.slice(base.length),
      value: entry.value
    }));
  };
  nsStorage.setItems = async (items, commonOptions) => {
    const prefixedItems = items.map((item) => ({
      key: base + item.key,
      value: item.value,
      options: item.options
    }));
    return storage.setItems(prefixedItems, commonOptions);
  };
  return nsStorage;
}
function normalizeKey$1(key) {
  if (!key) {
    return "";
  }
  return key.split("?")[0]?.replace(/[/\\]/g, ":").replace(/:+/g, ":").replace(/^:|:$/g, "") || "";
}
function joinKeys(...keys) {
  return normalizeKey$1(keys.join(":"));
}
function normalizeBaseKey(base) {
  base = normalizeKey$1(base);
  return base ? base + ":" : "";
}
function filterKeyByDepth(key, depth) {
  if (depth === void 0) {
    return true;
  }
  let substrCount = 0;
  let index = key.indexOf(":");
  while (index > -1) {
    substrCount++;
    index = key.indexOf(":", index + 1);
  }
  return substrCount <= depth;
}
function filterKeyByBase(key, base) {
  if (base) {
    return key.startsWith(base) && key[key.length - 1] !== "$";
  }
  return key[key.length - 1] !== "$";
}

function defineDriver$1(factory) {
  return factory;
}

const DRIVER_NAME$1 = "memory";
const memory = defineDriver$1(() => {
  const data = /* @__PURE__ */ new Map();
  return {
    name: DRIVER_NAME$1,
    getInstance: () => data,
    hasItem(key) {
      return data.has(key);
    },
    getItem(key) {
      return data.get(key) ?? null;
    },
    getItemRaw(key) {
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
    setItemRaw(key, value) {
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
    },
    getKeys() {
      return [...data.keys()];
    },
    clear() {
      data.clear();
    },
    dispose() {
      data.clear();
    }
  };
});

function createStorage(options = {}) {
  const context = {
    mounts: { "": options.driver || memory() },
    mountpoints: [""],
    watching: false,
    watchListeners: [],
    unwatch: {}
  };
  const getMount = (key) => {
    for (const base of context.mountpoints) {
      if (key.startsWith(base)) {
        return {
          base,
          relativeKey: key.slice(base.length),
          driver: context.mounts[base]
        };
      }
    }
    return {
      base: "",
      relativeKey: key,
      driver: context.mounts[""]
    };
  };
  const getMounts = (base, includeParent) => {
    return context.mountpoints.filter(
      (mountpoint) => mountpoint.startsWith(base) || includeParent && base.startsWith(mountpoint)
    ).map((mountpoint) => ({
      relativeBase: base.length > mountpoint.length ? base.slice(mountpoint.length) : void 0,
      mountpoint,
      driver: context.mounts[mountpoint]
    }));
  };
  const onChange = (event, key) => {
    if (!context.watching) {
      return;
    }
    key = normalizeKey$1(key);
    for (const listener of context.watchListeners) {
      listener(event, key);
    }
  };
  const startWatch = async () => {
    if (context.watching) {
      return;
    }
    context.watching = true;
    for (const mountpoint in context.mounts) {
      context.unwatch[mountpoint] = await watch(
        context.mounts[mountpoint],
        onChange,
        mountpoint
      );
    }
  };
  const stopWatch = async () => {
    if (!context.watching) {
      return;
    }
    for (const mountpoint in context.unwatch) {
      await context.unwatch[mountpoint]();
    }
    context.unwatch = {};
    context.watching = false;
  };
  const runBatch = (items, commonOptions, cb) => {
    const batches = /* @__PURE__ */ new Map();
    const getBatch = (mount) => {
      let batch = batches.get(mount.base);
      if (!batch) {
        batch = {
          driver: mount.driver,
          base: mount.base,
          items: []
        };
        batches.set(mount.base, batch);
      }
      return batch;
    };
    for (const item of items) {
      const isStringItem = typeof item === "string";
      const key = normalizeKey$1(isStringItem ? item : item.key);
      const value = isStringItem ? void 0 : item.value;
      const options2 = isStringItem || !item.options ? commonOptions : { ...commonOptions, ...item.options };
      const mount = getMount(key);
      getBatch(mount).items.push({
        key,
        value,
        relativeKey: mount.relativeKey,
        options: options2
      });
    }
    return Promise.all([...batches.values()].map((batch) => cb(batch))).then(
      (r) => r.flat()
    );
  };
  const storage = {
    // Item
    hasItem(key, opts = {}) {
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      return asyncCall(driver.hasItem, relativeKey, opts);
    },
    getItem(key, opts = {}) {
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      return asyncCall(driver.getItem, relativeKey, opts).then(
        (value) => destr(value)
      );
    },
    getItems(items, commonOptions = {}) {
      return runBatch(items, commonOptions, (batch) => {
        if (batch.driver.getItems) {
          return asyncCall(
            batch.driver.getItems,
            batch.items.map((item) => ({
              key: item.relativeKey,
              options: item.options
            })),
            commonOptions
          ).then(
            (r) => r.map((item) => ({
              key: joinKeys(batch.base, item.key),
              value: destr(item.value)
            }))
          );
        }
        return Promise.all(
          batch.items.map((item) => {
            return asyncCall(
              batch.driver.getItem,
              item.relativeKey,
              item.options
            ).then((value) => ({
              key: item.key,
              value: destr(value)
            }));
          })
        );
      });
    },
    getItemRaw(key, opts = {}) {
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      if (driver.getItemRaw) {
        return asyncCall(driver.getItemRaw, relativeKey, opts);
      }
      return asyncCall(driver.getItem, relativeKey, opts).then(
        (value) => deserializeRaw(value)
      );
    },
    async setItem(key, value, opts = {}) {
      if (value === void 0) {
        return storage.removeItem(key);
      }
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      if (!driver.setItem) {
        return;
      }
      await asyncCall(driver.setItem, relativeKey, stringify(value), opts);
      if (!driver.watch) {
        onChange("update", key);
      }
    },
    async setItems(items, commonOptions) {
      await runBatch(items, commonOptions, async (batch) => {
        if (batch.driver.setItems) {
          return asyncCall(
            batch.driver.setItems,
            batch.items.map((item) => ({
              key: item.relativeKey,
              value: stringify(item.value),
              options: item.options
            })),
            commonOptions
          );
        }
        if (!batch.driver.setItem) {
          return;
        }
        await Promise.all(
          batch.items.map((item) => {
            return asyncCall(
              batch.driver.setItem,
              item.relativeKey,
              stringify(item.value),
              item.options
            );
          })
        );
      });
    },
    async setItemRaw(key, value, opts = {}) {
      if (value === void 0) {
        return storage.removeItem(key, opts);
      }
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      if (driver.setItemRaw) {
        await asyncCall(driver.setItemRaw, relativeKey, value, opts);
      } else if (driver.setItem) {
        await asyncCall(driver.setItem, relativeKey, serializeRaw(value), opts);
      } else {
        return;
      }
      if (!driver.watch) {
        onChange("update", key);
      }
    },
    async removeItem(key, opts = {}) {
      if (typeof opts === "boolean") {
        opts = { removeMeta: opts };
      }
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      if (!driver.removeItem) {
        return;
      }
      await asyncCall(driver.removeItem, relativeKey, opts);
      if (opts.removeMeta || opts.removeMata) {
        await asyncCall(driver.removeItem, relativeKey + "$", opts);
      }
      if (!driver.watch) {
        onChange("remove", key);
      }
    },
    // Meta
    async getMeta(key, opts = {}) {
      if (typeof opts === "boolean") {
        opts = { nativeOnly: opts };
      }
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      const meta = /* @__PURE__ */ Object.create(null);
      if (driver.getMeta) {
        Object.assign(meta, await asyncCall(driver.getMeta, relativeKey, opts));
      }
      if (!opts.nativeOnly) {
        const value = await asyncCall(
          driver.getItem,
          relativeKey + "$",
          opts
        ).then((value_) => destr(value_));
        if (value && typeof value === "object") {
          if (typeof value.atime === "string") {
            value.atime = new Date(value.atime);
          }
          if (typeof value.mtime === "string") {
            value.mtime = new Date(value.mtime);
          }
          Object.assign(meta, value);
        }
      }
      return meta;
    },
    setMeta(key, value, opts = {}) {
      return this.setItem(key + "$", value, opts);
    },
    removeMeta(key, opts = {}) {
      return this.removeItem(key + "$", opts);
    },
    // Keys
    async getKeys(base, opts = {}) {
      base = normalizeBaseKey(base);
      const mounts = getMounts(base, true);
      let maskedMounts = [];
      const allKeys = [];
      let allMountsSupportMaxDepth = true;
      for (const mount of mounts) {
        if (!mount.driver.flags?.maxDepth) {
          allMountsSupportMaxDepth = false;
        }
        const rawKeys = await asyncCall(
          mount.driver.getKeys,
          mount.relativeBase,
          opts
        );
        for (const key of rawKeys) {
          const fullKey = mount.mountpoint + normalizeKey$1(key);
          if (!maskedMounts.some((p) => fullKey.startsWith(p))) {
            allKeys.push(fullKey);
          }
        }
        maskedMounts = [
          mount.mountpoint,
          ...maskedMounts.filter((p) => !p.startsWith(mount.mountpoint))
        ];
      }
      const shouldFilterByDepth = opts.maxDepth !== void 0 && !allMountsSupportMaxDepth;
      return allKeys.filter(
        (key) => (!shouldFilterByDepth || filterKeyByDepth(key, opts.maxDepth)) && filterKeyByBase(key, base)
      );
    },
    // Utils
    async clear(base, opts = {}) {
      base = normalizeBaseKey(base);
      await Promise.all(
        getMounts(base, false).map(async (m) => {
          if (m.driver.clear) {
            return asyncCall(m.driver.clear, m.relativeBase, opts);
          }
          if (m.driver.removeItem) {
            const keys = await m.driver.getKeys(m.relativeBase || "", opts);
            return Promise.all(
              keys.map((key) => m.driver.removeItem(key, opts))
            );
          }
        })
      );
    },
    async dispose() {
      await Promise.all(
        Object.values(context.mounts).map((driver) => dispose(driver))
      );
    },
    async watch(callback) {
      await startWatch();
      context.watchListeners.push(callback);
      return async () => {
        context.watchListeners = context.watchListeners.filter(
          (listener) => listener !== callback
        );
        if (context.watchListeners.length === 0) {
          await stopWatch();
        }
      };
    },
    async unwatch() {
      context.watchListeners = [];
      await stopWatch();
    },
    // Mount
    mount(base, driver) {
      base = normalizeBaseKey(base);
      if (base && context.mounts[base]) {
        throw new Error(`already mounted at ${base}`);
      }
      if (base) {
        context.mountpoints.push(base);
        context.mountpoints.sort((a, b) => b.length - a.length);
      }
      context.mounts[base] = driver;
      if (context.watching) {
        Promise.resolve(watch(driver, onChange, base)).then((unwatcher) => {
          context.unwatch[base] = unwatcher;
        }).catch(console.error);
      }
      return storage;
    },
    async unmount(base, _dispose = true) {
      base = normalizeBaseKey(base);
      if (!base || !context.mounts[base]) {
        return;
      }
      if (context.watching && base in context.unwatch) {
        context.unwatch[base]?.();
        delete context.unwatch[base];
      }
      if (_dispose) {
        await dispose(context.mounts[base]);
      }
      context.mountpoints = context.mountpoints.filter((key) => key !== base);
      delete context.mounts[base];
    },
    getMount(key = "") {
      key = normalizeKey$1(key) + ":";
      const m = getMount(key);
      return {
        driver: m.driver,
        base: m.base
      };
    },
    getMounts(base = "", opts = {}) {
      base = normalizeKey$1(base);
      const mounts = getMounts(base, opts.parents);
      return mounts.map((m) => ({
        driver: m.driver,
        base: m.mountpoint
      }));
    },
    // Aliases
    keys: (base, opts = {}) => storage.getKeys(base, opts),
    get: (key, opts = {}) => storage.getItem(key, opts),
    set: (key, value, opts = {}) => storage.setItem(key, value, opts),
    has: (key, opts = {}) => storage.hasItem(key, opts),
    del: (key, opts = {}) => storage.removeItem(key, opts),
    remove: (key, opts = {}) => storage.removeItem(key, opts)
  };
  return storage;
}
function watch(driver, onChange, base) {
  return driver.watch ? driver.watch((event, key) => onChange(event, base + key)) : () => {
  };
}
async function dispose(driver) {
  if (typeof driver.dispose === "function") {
    await asyncCall(driver.dispose);
  }
}

const _assets = {

};

const normalizeKey = function normalizeKey(key) {
  if (!key) {
    return "";
  }
  return key.split("?")[0]?.replace(/[/\\]/g, ":").replace(/:+/g, ":").replace(/^:|:$/g, "") || "";
};

const assets$1 = {
  getKeys() {
    return Promise.resolve(Object.keys(_assets))
  },
  hasItem (id) {
    id = normalizeKey(id);
    return Promise.resolve(id in _assets)
  },
  getItem (id) {
    id = normalizeKey(id);
    return Promise.resolve(_assets[id] ? _assets[id].import() : null)
  },
  getMeta (id) {
    id = normalizeKey(id);
    return Promise.resolve(_assets[id] ? _assets[id].meta : {})
  }
};

function defineDriver(factory) {
  return factory;
}
function createError$1(driver, message, opts) {
  const err = new Error(`[unstorage] [${driver}] ${message}`, opts);
  if (Error.captureStackTrace) {
    Error.captureStackTrace(err, createError$1);
  }
  return err;
}
function createRequiredError(driver, name) {
  if (Array.isArray(name)) {
    return createError$1(
      driver,
      `Missing some of the required options ${name.map((n) => "`" + n + "`").join(", ")}`
    );
  }
  return createError$1(driver, `Missing required option \`${name}\`.`);
}

function ignoreNotfound(err) {
  return err.code === "ENOENT" || err.code === "EISDIR" ? null : err;
}
function ignoreExists(err) {
  return err.code === "EEXIST" ? null : err;
}
async function writeFile(path, data, encoding) {
  await ensuredir(dirname$1(path));
  return promises.writeFile(path, data, encoding);
}
function readFile(path, encoding) {
  return promises.readFile(path, encoding).catch(ignoreNotfound);
}
function unlink(path) {
  return promises.unlink(path).catch(ignoreNotfound);
}
function readdir(dir) {
  return promises.readdir(dir, { withFileTypes: true }).catch(ignoreNotfound).then((r) => r || []);
}
async function ensuredir(dir) {
  if (existsSync(dir)) {
    return;
  }
  await ensuredir(dirname$1(dir)).catch(ignoreExists);
  await promises.mkdir(dir).catch(ignoreExists);
}
async function readdirRecursive(dir, ignore, maxDepth) {
  if (ignore && ignore(dir)) {
    return [];
  }
  const entries = await readdir(dir);
  const files = [];
  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = resolve$1(dir, entry.name);
      if (entry.isDirectory()) {
        if (maxDepth === void 0 || maxDepth > 0) {
          const dirFiles = await readdirRecursive(
            entryPath,
            ignore,
            maxDepth === void 0 ? void 0 : maxDepth - 1
          );
          files.push(...dirFiles.map((f) => entry.name + "/" + f));
        }
      } else {
        if (!(ignore && ignore(entry.name))) {
          files.push(entry.name);
        }
      }
    })
  );
  return files;
}
async function rmRecursive(dir) {
  const entries = await readdir(dir);
  await Promise.all(
    entries.map((entry) => {
      const entryPath = resolve$1(dir, entry.name);
      if (entry.isDirectory()) {
        return rmRecursive(entryPath).then(() => promises.rmdir(entryPath));
      } else {
        return promises.unlink(entryPath);
      }
    })
  );
}

const PATH_TRAVERSE_RE = /\.\.:|\.\.$/;
const DRIVER_NAME = "fs-lite";
const unstorage_47drivers_47fs_45lite = defineDriver((opts = {}) => {
  if (!opts.base) {
    throw createRequiredError(DRIVER_NAME, "base");
  }
  opts.base = resolve$1(opts.base);
  const r = (key) => {
    if (PATH_TRAVERSE_RE.test(key)) {
      throw createError$1(
        DRIVER_NAME,
        `Invalid key: ${JSON.stringify(key)}. It should not contain .. segments`
      );
    }
    const resolved = join$1(opts.base, key.replace(/:/g, "/"));
    return resolved;
  };
  return {
    name: DRIVER_NAME,
    options: opts,
    flags: {
      maxDepth: true
    },
    hasItem(key) {
      return existsSync(r(key));
    },
    getItem(key) {
      return readFile(r(key), "utf8");
    },
    getItemRaw(key) {
      return readFile(r(key));
    },
    async getMeta(key) {
      const { atime, mtime, size, birthtime, ctime } = await promises.stat(r(key)).catch(() => ({}));
      return { atime, mtime, size, birthtime, ctime };
    },
    setItem(key, value) {
      if (opts.readOnly) {
        return;
      }
      return writeFile(r(key), value, "utf8");
    },
    setItemRaw(key, value) {
      if (opts.readOnly) {
        return;
      }
      return writeFile(r(key), value);
    },
    removeItem(key) {
      if (opts.readOnly) {
        return;
      }
      return unlink(r(key));
    },
    getKeys(_base, topts) {
      return readdirRecursive(r("."), opts.ignore, topts?.maxDepth);
    },
    async clear() {
      if (opts.readOnly || opts.noClear) {
        return;
      }
      await rmRecursive(r("."));
    }
  };
});

const storage = createStorage({});

storage.mount('/assets', assets$1);

storage.mount('data', unstorage_47drivers_47fs_45lite({"driver":"fsLite","base":"./.data/kv"}));

function useStorage(base = "") {
  return base ? prefixStorage(storage, base) : storage;
}

const e=globalThis.process?.getBuiltinModule?.("crypto")?.hash,r="sha256",s="base64url";function digest(t){if(e)return e(r,t,s);const o=createHash(r).update(t);return globalThis.process?.versions?.webcontainer?o.digest().toString(s):o.digest(s)}

const Hasher = /* @__PURE__ */ (() => {
  class Hasher2 {
    buff = "";
    #context = /* @__PURE__ */ new Map();
    write(str) {
      this.buff += str;
    }
    dispatch(value) {
      const type = value === null ? "null" : typeof value;
      return this[type](value);
    }
    object(object) {
      if (object && typeof object.toJSON === "function") {
        return this.object(object.toJSON());
      }
      const objString = Object.prototype.toString.call(object);
      let objType = "";
      const objectLength = objString.length;
      objType = objectLength < 10 ? "unknown:[" + objString + "]" : objString.slice(8, objectLength - 1);
      objType = objType.toLowerCase();
      let objectNumber = null;
      if ((objectNumber = this.#context.get(object)) === void 0) {
        this.#context.set(object, this.#context.size);
      } else {
        return this.dispatch("[CIRCULAR:" + objectNumber + "]");
      }
      if (typeof Buffer !== "undefined" && Buffer.isBuffer && Buffer.isBuffer(object)) {
        this.write("buffer:");
        return this.write(object.toString("utf8"));
      }
      if (objType !== "object" && objType !== "function" && objType !== "asyncfunction") {
        if (this[objType]) {
          this[objType](object);
        } else {
          this.unknown(object, objType);
        }
      } else {
        const keys = Object.keys(object).sort();
        const extraKeys = [];
        this.write("object:" + (keys.length + extraKeys.length) + ":");
        const dispatchForKey = (key) => {
          this.dispatch(key);
          this.write(":");
          this.dispatch(object[key]);
          this.write(",");
        };
        for (const key of keys) {
          dispatchForKey(key);
        }
        for (const key of extraKeys) {
          dispatchForKey(key);
        }
      }
    }
    array(arr, unordered) {
      unordered = unordered === void 0 ? false : unordered;
      this.write("array:" + arr.length + ":");
      if (!unordered || arr.length <= 1) {
        for (const entry of arr) {
          this.dispatch(entry);
        }
        return;
      }
      const contextAdditions = /* @__PURE__ */ new Map();
      const entries = arr.map((entry) => {
        const hasher = new Hasher2();
        hasher.dispatch(entry);
        for (const [key, value] of hasher.#context) {
          contextAdditions.set(key, value);
        }
        return hasher.toString();
      });
      this.#context = contextAdditions;
      entries.sort();
      return this.array(entries, false);
    }
    date(date) {
      return this.write("date:" + date.toJSON());
    }
    symbol(sym) {
      return this.write("symbol:" + sym.toString());
    }
    unknown(value, type) {
      this.write(type);
      if (!value) {
        return;
      }
      this.write(":");
      if (value && typeof value.entries === "function") {
        return this.array(
          [...value.entries()],
          true
          /* ordered */
        );
      }
    }
    error(err) {
      return this.write("error:" + err.toString());
    }
    boolean(bool) {
      return this.write("bool:" + bool);
    }
    string(string) {
      this.write("string:" + string.length + ":");
      this.write(string);
    }
    function(fn) {
      this.write("fn:");
      if (isNativeFunction(fn)) {
        this.dispatch("[native]");
      } else {
        this.dispatch(fn.toString());
      }
    }
    number(number) {
      return this.write("number:" + number);
    }
    null() {
      return this.write("Null");
    }
    undefined() {
      return this.write("Undefined");
    }
    regexp(regex) {
      return this.write("regex:" + regex.toString());
    }
    arraybuffer(arr) {
      this.write("arraybuffer:");
      return this.dispatch(new Uint8Array(arr));
    }
    url(url) {
      return this.write("url:" + url.toString());
    }
    map(map) {
      this.write("map:");
      const arr = [...map];
      return this.array(arr, false);
    }
    set(set) {
      this.write("set:");
      const arr = [...set];
      return this.array(arr, false);
    }
    bigint(number) {
      return this.write("bigint:" + number.toString());
    }
  }
  for (const type of [
    "uint8array",
    "uint8clampedarray",
    "unt8array",
    "uint16array",
    "unt16array",
    "uint32array",
    "unt32array",
    "float32array",
    "float64array"
  ]) {
    Hasher2.prototype[type] = function(arr) {
      this.write(type + ":");
      return this.array([...arr], false);
    };
  }
  function isNativeFunction(f) {
    if (typeof f !== "function") {
      return false;
    }
    return Function.prototype.toString.call(f).slice(
      -15
      /* "[native code] }".length */
    ) === "[native code] }";
  }
  return Hasher2;
})();
function serialize$1(object) {
  const hasher = new Hasher();
  hasher.dispatch(object);
  return hasher.buff;
}
function hash(value) {
  return digest(typeof value === "string" ? value : serialize$1(value)).replace(/[-_]/g, "").slice(0, 10);
}

function defaultCacheOptions() {
  return {
    name: "_",
    base: "/cache",
    swr: true,
    maxAge: 1
  };
}
function defineCachedFunction(fn, opts = {}) {
  opts = { ...defaultCacheOptions(), ...opts };
  const pending = {};
  const group = opts.group || "nitro/functions";
  const name = opts.name || fn.name || "_";
  const integrity = opts.integrity || hash([fn, opts]);
  const validate = opts.validate || ((entry) => entry.value !== void 0);
  async function get(key, resolver, shouldInvalidateCache, event) {
    const cacheKey = [opts.base, group, name, key + ".json"].filter(Boolean).join(":").replace(/:\/$/, ":index");
    let entry = await useStorage().getItem(cacheKey).catch((error) => {
      console.error(`[cache] Cache read error.`, error);
      useNitroApp().captureError(error, { event, tags: ["cache"] });
    }) || {};
    if (typeof entry !== "object") {
      entry = {};
      const error = new Error("Malformed data read from cache.");
      console.error("[cache]", error);
      useNitroApp().captureError(error, { event, tags: ["cache"] });
    }
    const ttl = (opts.maxAge ?? 0) * 1e3;
    if (ttl) {
      entry.expires = Date.now() + ttl;
    }
    const expired = shouldInvalidateCache || entry.integrity !== integrity || ttl && Date.now() - (entry.mtime || 0) > ttl || validate(entry) === false;
    const _resolve = async () => {
      const isPending = pending[key];
      if (!isPending) {
        if (entry.value !== void 0 && (opts.staleMaxAge || 0) >= 0 && opts.swr === false) {
          entry.value = void 0;
          entry.integrity = void 0;
          entry.mtime = void 0;
          entry.expires = void 0;
        }
        pending[key] = Promise.resolve(resolver());
      }
      try {
        entry.value = await pending[key];
      } catch (error) {
        if (!isPending) {
          delete pending[key];
        }
        throw error;
      }
      if (!isPending) {
        entry.mtime = Date.now();
        entry.integrity = integrity;
        delete pending[key];
        if (validate(entry) !== false) {
          let setOpts;
          if (opts.maxAge && !opts.swr) {
            setOpts = { ttl: opts.maxAge };
          }
          const promise = useStorage().setItem(cacheKey, entry, setOpts).catch((error) => {
            console.error(`[cache] Cache write error.`, error);
            useNitroApp().captureError(error, { event, tags: ["cache"] });
          });
          if (event?.waitUntil) {
            event.waitUntil(promise);
          }
        }
      }
    };
    const _resolvePromise = expired ? _resolve() : Promise.resolve();
    if (entry.value === void 0) {
      await _resolvePromise;
    } else if (expired && event && event.waitUntil) {
      event.waitUntil(_resolvePromise);
    }
    if (opts.swr && validate(entry) !== false) {
      _resolvePromise.catch((error) => {
        console.error(`[cache] SWR handler error.`, error);
        useNitroApp().captureError(error, { event, tags: ["cache"] });
      });
      return entry;
    }
    return _resolvePromise.then(() => entry);
  }
  return async (...args) => {
    const shouldBypassCache = await opts.shouldBypassCache?.(...args);
    if (shouldBypassCache) {
      return fn(...args);
    }
    const key = await (opts.getKey || getKey)(...args);
    const shouldInvalidateCache = await opts.shouldInvalidateCache?.(...args);
    const entry = await get(
      key,
      () => fn(...args),
      shouldInvalidateCache,
      args[0] && isEvent(args[0]) ? args[0] : void 0
    );
    let value = entry.value;
    if (opts.transform) {
      value = await opts.transform(entry, ...args) || value;
    }
    return value;
  };
}
function cachedFunction(fn, opts = {}) {
  return defineCachedFunction(fn, opts);
}
function getKey(...args) {
  return args.length > 0 ? hash(args) : "";
}
function escapeKey(key) {
  return String(key).replace(/\W/g, "");
}
function defineCachedEventHandler(handler, opts = defaultCacheOptions()) {
  const variableHeaderNames = (opts.varies || []).filter(Boolean).map((h) => h.toLowerCase()).sort();
  const _opts = {
    ...opts,
    getKey: async (event) => {
      const customKey = await opts.getKey?.(event);
      if (customKey) {
        return escapeKey(customKey);
      }
      const _path = event.node.req.originalUrl || event.node.req.url || event.path;
      let _pathname;
      try {
        _pathname = escapeKey(decodeURI(parseURL(_path).pathname)).slice(0, 16) || "index";
      } catch {
        _pathname = "-";
      }
      const _hashedPath = `${_pathname}.${hash(_path)}`;
      const _headers = variableHeaderNames.map((header) => [header, event.node.req.headers[header]]).map(([name, value]) => `${escapeKey(name)}.${hash(value)}`);
      return [_hashedPath, ..._headers].join(":");
    },
    validate: (entry) => {
      if (!entry.value) {
        return false;
      }
      if (entry.value.code >= 400) {
        return false;
      }
      if (entry.value.body === void 0) {
        return false;
      }
      if (entry.value.headers.etag === "undefined" || entry.value.headers["last-modified"] === "undefined") {
        return false;
      }
      return true;
    },
    group: opts.group || "nitro/handlers",
    integrity: opts.integrity || hash([handler, opts])
  };
  const _cachedHandler = cachedFunction(
    async (incomingEvent) => {
      const variableHeaders = {};
      for (const header of variableHeaderNames) {
        const value = incomingEvent.node.req.headers[header];
        if (value !== void 0) {
          variableHeaders[header] = value;
        }
      }
      const reqProxy = cloneWithProxy(incomingEvent.node.req, {
        headers: variableHeaders
      });
      const resHeaders = {};
      let _resSendBody;
      const resProxy = cloneWithProxy(incomingEvent.node.res, {
        statusCode: 200,
        writableEnded: false,
        writableFinished: false,
        headersSent: false,
        closed: false,
        getHeader(name) {
          return resHeaders[name];
        },
        setHeader(name, value) {
          resHeaders[name] = value;
          return this;
        },
        getHeaderNames() {
          return Object.keys(resHeaders);
        },
        hasHeader(name) {
          return name in resHeaders;
        },
        removeHeader(name) {
          delete resHeaders[name];
        },
        getHeaders() {
          return resHeaders;
        },
        end(chunk, arg2, arg3) {
          if (typeof chunk === "string") {
            _resSendBody = chunk;
          }
          if (typeof arg2 === "function") {
            arg2();
          }
          if (typeof arg3 === "function") {
            arg3();
          }
          return this;
        },
        write(chunk, arg2, arg3) {
          if (typeof chunk === "string") {
            _resSendBody = chunk;
          }
          if (typeof arg2 === "function") {
            arg2(void 0);
          }
          if (typeof arg3 === "function") {
            arg3();
          }
          return true;
        },
        writeHead(statusCode, headers2) {
          this.statusCode = statusCode;
          if (headers2) {
            if (Array.isArray(headers2) || typeof headers2 === "string") {
              throw new TypeError("Raw headers  is not supported.");
            }
            for (const header in headers2) {
              const value = headers2[header];
              if (value !== void 0) {
                this.setHeader(
                  header,
                  value
                );
              }
            }
          }
          return this;
        }
      });
      const event = createEvent(reqProxy, resProxy);
      event.fetch = (url, fetchOptions) => fetchWithEvent(event, url, fetchOptions, {
        fetch: useNitroApp().localFetch
      });
      event.$fetch = (url, fetchOptions) => fetchWithEvent(event, url, fetchOptions, {
        fetch: globalThis.$fetch
      });
      event.waitUntil = incomingEvent.waitUntil;
      event.context = incomingEvent.context;
      event.context.cache = {
        options: _opts
      };
      const body = await handler(event) || _resSendBody;
      const headers = event.node.res.getHeaders();
      headers.etag = String(
        headers.Etag || headers.etag || `W/"${hash(body)}"`
      );
      headers["last-modified"] = String(
        headers["Last-Modified"] || headers["last-modified"] || (/* @__PURE__ */ new Date()).toUTCString()
      );
      const cacheControl = [];
      if (opts.swr) {
        if (opts.maxAge) {
          cacheControl.push(`s-maxage=${opts.maxAge}`);
        }
        if (opts.staleMaxAge) {
          cacheControl.push(`stale-while-revalidate=${opts.staleMaxAge}`);
        } else {
          cacheControl.push("stale-while-revalidate");
        }
      } else if (opts.maxAge) {
        cacheControl.push(`max-age=${opts.maxAge}`);
      }
      if (cacheControl.length > 0) {
        headers["cache-control"] = cacheControl.join(", ");
      }
      const cacheEntry = {
        code: event.node.res.statusCode,
        headers,
        body
      };
      return cacheEntry;
    },
    _opts
  );
  return defineEventHandler$1(async (event) => {
    if (opts.headersOnly) {
      if (handleCacheHeaders(event, { maxAge: opts.maxAge })) {
        return;
      }
      return handler(event);
    }
    const response = await _cachedHandler(
      event
    );
    if (event.node.res.headersSent || event.node.res.writableEnded) {
      return response.body;
    }
    if (handleCacheHeaders(event, {
      modifiedTime: new Date(response.headers["last-modified"]),
      etag: response.headers.etag,
      maxAge: opts.maxAge
    })) {
      return;
    }
    event.node.res.statusCode = response.code;
    for (const name in response.headers) {
      const value = response.headers[name];
      if (name === "set-cookie") {
        event.node.res.appendHeader(
          name,
          splitCookiesString$1(value)
        );
      } else {
        if (value !== void 0) {
          event.node.res.setHeader(name, value);
        }
      }
    }
    return response.body;
  });
}
function cloneWithProxy(obj, overrides) {
  return new Proxy(obj, {
    get(target, property, receiver) {
      if (property in overrides) {
        return overrides[property];
      }
      return Reflect.get(target, property, receiver);
    },
    set(target, property, value, receiver) {
      if (property in overrides) {
        overrides[property] = value;
        return true;
      }
      return Reflect.set(target, property, value, receiver);
    }
  });
}
const cachedEventHandler = defineCachedEventHandler;

function klona(x) {
	if (typeof x !== 'object') return x;

	var k, tmp, str=Object.prototype.toString.call(x);

	if (str === '[object Object]') {
		if (x.constructor !== Object && typeof x.constructor === 'function') {
			tmp = new x.constructor();
			for (k in x) {
				if (x.hasOwnProperty(k) && tmp[k] !== x[k]) {
					tmp[k] = klona(x[k]);
				}
			}
		} else {
			tmp = {}; // null
			for (k in x) {
				if (k === '__proto__') {
					Object.defineProperty(tmp, k, {
						value: klona(x[k]),
						configurable: true,
						enumerable: true,
						writable: true,
					});
				} else {
					tmp[k] = klona(x[k]);
				}
			}
		}
		return tmp;
	}

	if (str === '[object Array]') {
		k = x.length;
		for (tmp=Array(k); k--;) {
			tmp[k] = klona(x[k]);
		}
		return tmp;
	}

	if (str === '[object Set]') {
		tmp = new Set;
		x.forEach(function (val) {
			tmp.add(klona(val));
		});
		return tmp;
	}

	if (str === '[object Map]') {
		tmp = new Map;
		x.forEach(function (val, key) {
			tmp.set(klona(key), klona(val));
		});
		return tmp;
	}

	if (str === '[object Date]') {
		return new Date(+x);
	}

	if (str === '[object RegExp]') {
		tmp = new RegExp(x.source, x.flags);
		tmp.lastIndex = x.lastIndex;
		return tmp;
	}

	if (str === '[object DataView]') {
		return new x.constructor( klona(x.buffer) );
	}

	if (str === '[object ArrayBuffer]') {
		return x.slice(0);
	}

	// ArrayBuffer.isView(x)
	// ~> `new` bcuz `Buffer.slice` => ref
	if (str.slice(-6) === 'Array]') {
		return new x.constructor(x);
	}

	return x;
}

const inlineAppConfig = {};



const appConfig$1 = defuFn(inlineAppConfig);

const NUMBER_CHAR_RE = /\d/;
const STR_SPLITTERS = ["-", "_", "/", "."];
function isUppercase(char = "") {
  if (NUMBER_CHAR_RE.test(char)) {
    return void 0;
  }
  return char !== char.toLowerCase();
}
function splitByCase(str, separators) {
  const splitters = STR_SPLITTERS;
  const parts = [];
  if (!str || typeof str !== "string") {
    return parts;
  }
  let buff = "";
  let previousUpper;
  let previousSplitter;
  for (const char of str) {
    const isSplitter = splitters.includes(char);
    if (isSplitter === true) {
      parts.push(buff);
      buff = "";
      previousUpper = void 0;
      continue;
    }
    const isUpper = isUppercase(char);
    if (previousSplitter === false) {
      if (previousUpper === false && isUpper === true) {
        parts.push(buff);
        buff = char;
        previousUpper = isUpper;
        continue;
      }
      if (previousUpper === true && isUpper === false && buff.length > 1) {
        const lastChar = buff.at(-1);
        parts.push(buff.slice(0, Math.max(0, buff.length - 1)));
        buff = lastChar + char;
        previousUpper = isUpper;
        continue;
      }
    }
    buff += char;
    previousUpper = isUpper;
    previousSplitter = isSplitter;
  }
  parts.push(buff);
  return parts;
}
function kebabCase(str, joiner) {
  return str ? (Array.isArray(str) ? str : splitByCase(str)).map((p) => p.toLowerCase()).join(joiner) : "";
}
function snakeCase(str) {
  return kebabCase(str || "", "_");
}

function getEnv(key, opts) {
  const envKey = snakeCase(key).toUpperCase();
  return destr(
    process.env[opts.prefix + envKey] ?? process.env[opts.altPrefix + envKey]
  );
}
function _isObject(input) {
  return typeof input === "object" && !Array.isArray(input);
}
function applyEnv(obj, opts, parentKey = "") {
  for (const key in obj) {
    const subKey = parentKey ? `${parentKey}_${key}` : key;
    const envValue = getEnv(subKey, opts);
    if (_isObject(obj[key])) {
      if (_isObject(envValue)) {
        obj[key] = { ...obj[key], ...envValue };
        applyEnv(obj[key], opts, subKey);
      } else if (envValue === void 0) {
        applyEnv(obj[key], opts, subKey);
      } else {
        obj[key] = envValue ?? obj[key];
      }
    } else {
      obj[key] = envValue ?? obj[key];
    }
    if (opts.envExpansion && typeof obj[key] === "string") {
      obj[key] = _expandFromEnv(obj[key]);
    }
  }
  return obj;
}
const envExpandRx = /\{\{([^{}]*)\}\}/g;
function _expandFromEnv(value) {
  return value.replace(envExpandRx, (match, key) => {
    return process.env[key] || match;
  });
}

const _inlineRuntimeConfig = {
  "app": {
    "baseURL": "/"
  },
  "nitro": {
    "routeRules": {
      "/_build/assets/**": {
        "headers": {
          "cache-control": "public, immutable, max-age=31536000"
        }
      }
    }
  }
};
const envOptions = {
  prefix: "NITRO_",
  altPrefix: _inlineRuntimeConfig.nitro.envPrefix ?? process.env.NITRO_ENV_PREFIX ?? "_",
  envExpansion: _inlineRuntimeConfig.nitro.envExpansion ?? process.env.NITRO_ENV_EXPANSION ?? false
};
const _sharedRuntimeConfig = _deepFreeze(
  applyEnv(klona(_inlineRuntimeConfig), envOptions)
);
function useRuntimeConfig(event) {
  {
    return _sharedRuntimeConfig;
  }
}
_deepFreeze(klona(appConfig$1));
function _deepFreeze(object) {
  const propNames = Object.getOwnPropertyNames(object);
  for (const name of propNames) {
    const value = object[name];
    if (value && typeof value === "object") {
      _deepFreeze(value);
    }
  }
  return Object.freeze(object);
}
new Proxy(/* @__PURE__ */ Object.create(null), {
  get: (_, prop) => {
    console.warn(
      "Please use `useRuntimeConfig()` instead of accessing config directly."
    );
    const runtimeConfig = useRuntimeConfig();
    if (prop in runtimeConfig) {
      return runtimeConfig[prop];
    }
    return void 0;
  }
});

function createContext$1(opts = {}) {
  let currentInstance;
  let isSingleton = false;
  const checkConflict = (instance) => {
    if (currentInstance && currentInstance !== instance) {
      throw new Error("Context conflict");
    }
  };
  let als;
  if (opts.asyncContext) {
    const _AsyncLocalStorage = opts.AsyncLocalStorage || globalThis.AsyncLocalStorage;
    if (_AsyncLocalStorage) {
      als = new _AsyncLocalStorage();
    } else {
      console.warn("[unctx] `AsyncLocalStorage` is not provided.");
    }
  }
  const _getCurrentInstance = () => {
    if (als) {
      const instance = als.getStore();
      if (instance !== void 0) {
        return instance;
      }
    }
    return currentInstance;
  };
  return {
    use: () => {
      const _instance = _getCurrentInstance();
      if (_instance === void 0) {
        throw new Error("Context is not available");
      }
      return _instance;
    },
    tryUse: () => {
      return _getCurrentInstance();
    },
    set: (instance, replace) => {
      if (!replace) {
        checkConflict(instance);
      }
      currentInstance = instance;
      isSingleton = true;
    },
    unset: () => {
      currentInstance = void 0;
      isSingleton = false;
    },
    call: (instance, callback) => {
      checkConflict(instance);
      currentInstance = instance;
      try {
        return als ? als.run(instance, callback) : callback();
      } finally {
        if (!isSingleton) {
          currentInstance = void 0;
        }
      }
    },
    async callAsync(instance, callback) {
      currentInstance = instance;
      const onRestore = () => {
        currentInstance = instance;
      };
      const onLeave = () => currentInstance === instance ? onRestore : void 0;
      asyncHandlers.add(onLeave);
      try {
        const r = als ? als.run(instance, callback) : callback();
        if (!isSingleton) {
          currentInstance = void 0;
        }
        return await r;
      } finally {
        asyncHandlers.delete(onLeave);
      }
    }
  };
}
function createNamespace(defaultOpts = {}) {
  const contexts = {};
  return {
    get(key, opts = {}) {
      if (!contexts[key]) {
        contexts[key] = createContext$1({ ...defaultOpts, ...opts });
      }
      return contexts[key];
    }
  };
}
const _globalThis = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : {};
const globalKey = "__unctx__";
const defaultNamespace = _globalThis[globalKey] || (_globalThis[globalKey] = createNamespace());
const getContext = (key, opts = {}) => defaultNamespace.get(key, opts);
const asyncHandlersKey = "__unctx_async_handlers__";
const asyncHandlers = _globalThis[asyncHandlersKey] || (_globalThis[asyncHandlersKey] = /* @__PURE__ */ new Set());

const nitroAsyncContext = getContext("nitro-app", {
  asyncContext: true,
  AsyncLocalStorage: AsyncLocalStorage 
});

function isPathInScope(pathname, base) {
  let canonical;
  try {
    const pre = pathname.replace(/%2f/gi, "/").replace(/%5c/gi, "\\");
    canonical = new URL(pre, "http://_").pathname;
  } catch {
    return false;
  }
  return !base || canonical === base || canonical.startsWith(base + "/");
}

const config = useRuntimeConfig();
const _routeRulesMatcher = toRouteMatcher(
  createRouter$1({ routes: config.nitro.routeRules })
);
function createRouteRulesHandler(ctx) {
  return eventHandler$1((event) => {
    const routeRules = getRouteRules(event);
    if (routeRules.headers) {
      setHeaders(event, routeRules.headers);
    }
    if (routeRules.redirect) {
      let target = routeRules.redirect.to;
      if (target.endsWith("/**")) {
        let targetPath = event.path;
        const strpBase = routeRules.redirect._redirectStripBase;
        if (strpBase) {
          if (!isPathInScope(event.path.split("?")[0], strpBase)) {
            throw createError$2({ statusCode: 400 });
          }
          targetPath = withoutBase(targetPath, strpBase);
        } else if (targetPath.startsWith("//")) {
          targetPath = targetPath.replace(/^\/+/, "/");
        }
        target = joinURL(target.slice(0, -3), targetPath);
      } else if (event.path.includes("?")) {
        const query = getQuery(event.path);
        target = withQuery(target, query);
      }
      return sendRedirect$1(event, target, routeRules.redirect.statusCode);
    }
    if (routeRules.proxy) {
      let target = routeRules.proxy.to;
      if (target.endsWith("/**")) {
        let targetPath = event.path;
        const strpBase = routeRules.proxy._proxyStripBase;
        if (strpBase) {
          if (!isPathInScope(event.path.split("?")[0], strpBase)) {
            throw createError$2({ statusCode: 400 });
          }
          targetPath = withoutBase(targetPath, strpBase);
        } else if (targetPath.startsWith("//")) {
          targetPath = targetPath.replace(/^\/+/, "/");
        }
        target = joinURL(target.slice(0, -3), targetPath);
      } else if (event.path.includes("?")) {
        const query = getQuery(event.path);
        target = withQuery(target, query);
      }
      return proxyRequest(event, target, {
        fetch: ctx.localFetch,
        ...routeRules.proxy
      });
    }
  });
}
function getRouteRules(event) {
  event.context._nitro = event.context._nitro || {};
  if (!event.context._nitro.routeRules) {
    event.context._nitro.routeRules = getRouteRulesForPath(
      withoutBase(event.path.split("?")[0], useRuntimeConfig().app.baseURL)
    );
  }
  return event.context._nitro.routeRules;
}
function getRouteRulesForPath(path) {
  return defu({}, ..._routeRulesMatcher.matchAll(path).reverse());
}

function _captureError(error, type) {
  console.error(`[${type}]`, error);
  useNitroApp().captureError(error, { tags: [type] });
}
function trapUnhandledNodeErrors() {
  process.on(
    "unhandledRejection",
    (error) => _captureError(error, "unhandledRejection")
  );
  process.on(
    "uncaughtException",
    (error) => _captureError(error, "uncaughtException")
  );
}
function joinHeaders(value) {
  return Array.isArray(value) ? value.join(", ") : String(value);
}
function normalizeFetchResponse(response) {
  if (!response.headers.has("set-cookie")) {
    return response;
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: normalizeCookieHeaders(response.headers)
  });
}
function normalizeCookieHeader(header = "") {
  return splitCookiesString$1(joinHeaders(header));
}
function normalizeCookieHeaders(headers) {
  const outgoingHeaders = new Headers();
  for (const [name, header] of headers) {
    if (name === "set-cookie") {
      for (const cookie of normalizeCookieHeader(header)) {
        outgoingHeaders.append("set-cookie", cookie);
      }
    } else {
      outgoingHeaders.set(name, joinHeaders(header));
    }
  }
  return outgoingHeaders;
}

function defineNitroErrorHandler(handler) {
  return handler;
}

const errorHandler$0 = defineNitroErrorHandler(
  function defaultNitroErrorHandler(error, event) {
    const res = defaultHandler(error, event);
    setResponseHeaders(event, res.headers);
    setResponseStatus$1(event, res.status, res.statusText);
    return send$1(event, JSON.stringify(res.body, null, 2));
  }
);
function defaultHandler(error, event, opts) {
  const isSensitive = error.unhandled || error.fatal;
  const statusCode = error.statusCode || 500;
  const statusMessage = error.statusMessage || "Server Error";
  const url = getRequestURL$1(event, { xForwardedHost: true, xForwardedProto: true });
  if (statusCode === 404) {
    const baseURL = "/";
    if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) {
      const redirectTo = `${baseURL}${url.pathname.slice(1)}${url.search}`;
      return {
        status: 302,
        statusText: "Found",
        headers: { location: redirectTo },
        body: `Redirecting...`
      };
    }
  }
  if (isSensitive && !opts?.silent) {
    const tags = [error.unhandled && "[unhandled]", error.fatal && "[fatal]"].filter(Boolean).join(" ");
    console.error(`[request error] ${tags} [${event.method}] ${url}
`, error);
  }
  const headers = {
    "content-type": "application/json",
    // Prevent browser from guessing the MIME types of resources.
    "x-content-type-options": "nosniff",
    // Prevent error page from being embedded in an iframe
    "x-frame-options": "DENY",
    // Prevent browsers from sending the Referer header
    "referrer-policy": "no-referrer",
    // Disable the execution of any js
    "content-security-policy": "script-src 'none'; frame-ancestors 'none';"
  };
  setResponseStatus$1(event, statusCode, statusMessage);
  if (statusCode === 404 || !getResponseHeader$1(event, "cache-control")) {
    headers["cache-control"] = "no-cache";
  }
  const body = {
    error: true,
    url: url.href,
    statusCode,
    statusMessage,
    message: isSensitive ? "Server Error" : error.message,
    data: isSensitive ? void 0 : error.data
  };
  return {
    status: statusCode,
    statusText: statusMessage,
    headers,
    body
  };
}

const errorHandlers = [errorHandler$0];

async function errorHandler(error, event) {
  for (const handler of errorHandlers) {
    try {
      await handler(error, event, { defaultHandler });
      if (event.handled) {
        return; // Response handled
      }
    } catch(error) {
      // Handler itself thrown, log and continue
      console.error(error);
    }
  }
  // H3 will handle fallback
}

const appConfig = {"name":"vinxi","routers":[{"name":"public","type":"static","base":"/","dir":"./public","root":"/Users/jalbarran/fun/drekki/pi-extensions/packages/pr-canvas/app","order":0,"outDir":"/Users/jalbarran/fun/drekki/pi-extensions/packages/pr-canvas/app/.vinxi/build/public"},{"name":"ssr","type":"http","link":{"client":"client"},"handler":"src/entry-server.tsx","extensions":["js","jsx","ts","tsx"],"target":"server","root":"/Users/jalbarran/fun/drekki/pi-extensions/packages/pr-canvas/app","base":"/","outDir":"/Users/jalbarran/fun/drekki/pi-extensions/packages/pr-canvas/app/.vinxi/build/ssr","order":1},{"name":"client","type":"client","base":"/_build","handler":"src/entry-client.tsx","extensions":["js","jsx","ts","tsx"],"target":"browser","root":"/Users/jalbarran/fun/drekki/pi-extensions/packages/pr-canvas/app","outDir":"/Users/jalbarran/fun/drekki/pi-extensions/packages/pr-canvas/app/.vinxi/build/client","order":2},{"name":"server-fns","type":"http","base":"/_server","handler":"node_modules/@solidjs/start/dist/runtime/server-handler.js","target":"server","root":"/Users/jalbarran/fun/drekki/pi-extensions/packages/pr-canvas/app","outDir":"/Users/jalbarran/fun/drekki/pi-extensions/packages/pr-canvas/app/.vinxi/build/server-fns","order":3}],"server":{"compressPublicAssets":{"brotli":true},"routeRules":{"/_build/assets/**":{"headers":{"cache-control":"public, immutable, max-age=31536000"}}},"experimental":{"asyncContext":true},"preset":"node-server","noExternals":true},"root":"/Users/jalbarran/fun/drekki/pi-extensions/packages/pr-canvas/app"};
					const buildManifest = {"ssr":{"_components-u6vAPa9_.js":{"file":"assets/components-u6vAPa9_.js","name":"components","imports":["_context-VkJfzLEW.js"]},"_context-VkJfzLEW.js":{"file":"assets/context-VkJfzLEW.js","name":"context"},"src/routes/index.tsx?pick=default&pick=$css":{"file":"index.js","name":"index","src":"src/routes/index.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_context-VkJfzLEW.js","_components-u6vAPa9_.js"]},"src/routes/pr/[number].tsx?pick=default&pick=$css":{"file":"_number_.js","name":"_number_","src":"src/routes/pr/[number].tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_context-VkJfzLEW.js","_components-u6vAPa9_.js"]},"virtual:$vinxi/handler/ssr":{"file":"ssr.js","name":"ssr","src":"virtual:$vinxi/handler/ssr","isEntry":true,"imports":["_context-VkJfzLEW.js"],"dynamicImports":["src/routes/index.tsx?pick=default&pick=$css","src/routes/index.tsx?pick=default&pick=$css","src/routes/pr/[number].tsx?pick=default&pick=$css","src/routes/pr/[number].tsx?pick=default&pick=$css"],"css":["assets/ssr-14LnX6eI.css"]}},"client":{"_components--pwY-tAv.js":{"file":"assets/components--pwY-tAv.js","name":"components","imports":["_context-DUTKMJGZ.js"]},"_context-DUTKMJGZ.js":{"file":"assets/context-DUTKMJGZ.js","name":"context"},"src/routes/index.tsx?pick=default&pick=$css":{"file":"assets/index-DVrB6r9Y.js","name":"index","src":"src/routes/index.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_context-DUTKMJGZ.js","_components--pwY-tAv.js"]},"src/routes/pr/[number].tsx?pick=default&pick=$css":{"file":"assets/_number_-C19dVD80.js","name":"_number_","src":"src/routes/pr/[number].tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_context-DUTKMJGZ.js","_components--pwY-tAv.js"]},"virtual:$vinxi/handler/client":{"file":"assets/client-CUd7QPYi.js","name":"client","src":"virtual:$vinxi/handler/client","isEntry":true,"imports":["_context-DUTKMJGZ.js"],"dynamicImports":["src/routes/index.tsx?pick=default&pick=$css","src/routes/pr/[number].tsx?pick=default&pick=$css"],"css":["assets/client-14LnX6eI.css"]}},"server-fns":{"_components-u6vAPa9_.js":{"file":"assets/components-u6vAPa9_.js","name":"components","imports":["_context-VkJfzLEW.js"]},"_context-VkJfzLEW.js":{"file":"assets/context-VkJfzLEW.js","name":"context"},"_server-fns-X44MLdAF.js":{"file":"assets/server-fns-X44MLdAF.js","name":"server-fns","dynamicImports":["src/routes/index.tsx?pick=default&pick=$css","src/routes/index.tsx?pick=default&pick=$css","src/routes/pr/[number].tsx?pick=default&pick=$css","src/routes/pr/[number].tsx?pick=default&pick=$css","src/app.tsx"]},"src/app.tsx":{"file":"assets/app-8N0XXXaK.js","name":"app","src":"src/app.tsx","isDynamicEntry":true,"imports":["_server-fns-X44MLdAF.js","_context-VkJfzLEW.js"],"css":["assets/app-14LnX6eI.css"]},"src/routes/index.tsx?pick=default&pick=$css":{"file":"index.js","name":"index","src":"src/routes/index.tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_context-VkJfzLEW.js","_components-u6vAPa9_.js"]},"src/routes/pr/[number].tsx?pick=default&pick=$css":{"file":"_number_.js","name":"_number_","src":"src/routes/pr/[number].tsx?pick=default&pick=$css","isEntry":true,"isDynamicEntry":true,"imports":["_context-VkJfzLEW.js","_components-u6vAPa9_.js"]},"virtual:$vinxi/handler/server-fns":{"file":"server-fns.js","name":"server-fns","src":"virtual:$vinxi/handler/server-fns","isEntry":true,"imports":["_server-fns-X44MLdAF.js"]}}};

					const routeManifest = {"ssr":{},"client":{},"server-fns":{}};

        function createProdApp(appConfig) {
          return {
            config: { ...appConfig, buildManifest, routeManifest },
            getRouter(name) {
              return appConfig.routers.find(router => router.name === name)
            }
          }
        }

        function plugin$2(app) {
          const prodApp = createProdApp(appConfig);
          globalThis.app = prodApp;
        }

function plugin$1(app) {
	globalThis.$handle = (event) => app.h3App.handler(event);
}

const genericMessage = "Invariant Violation";
const {
	setPrototypeOf = function (obj, proto) {
		obj.__proto__ = proto;
		return obj;
	},
} = Object;

class InvariantError extends Error {
	framesToPop = 1;
	name = genericMessage;
	constructor(/** @type {string | number} */ message = genericMessage) {
		super(
			typeof message === "number"
				? `${genericMessage}: ${message} (see https://github.com/apollographql/invariant-packages)`
				: message,
		);
		setPrototypeOf(this, InvariantError.prototype);
	}
}

/**
 * @param {any} condition
 * @param {string | number} message
 * @returns {asserts condition}
 */
function invariant(condition, message) {
	if (!condition) {
		throw new InvariantError(message);
	}
}

const _DRIVE_LETTER_START_RE$1 = /^[A-Za-z]:\//;
function normalizeWindowsPath$1(input = "") {
  if (!input) {
    return input;
  }
  return input.replace(/\\/g, "/").replace(_DRIVE_LETTER_START_RE$1, (r) => r.toUpperCase());
}

const _UNC_REGEX = /^[/\\]{2}/;
const _IS_ABSOLUTE_RE$1 = /^[/\\](?![/\\])|^[/\\]{2}(?!\.)|^[A-Za-z]:[/\\]/;
const _DRIVE_LETTER_RE$1 = /^[A-Za-z]:$/;
const normalize = function(path) {
  if (path.length === 0) {
    return ".";
  }
  path = normalizeWindowsPath$1(path);
  const isUNCPath = path.match(_UNC_REGEX);
  const isPathAbsolute = isAbsolute$1(path);
  const trailingSeparator = path[path.length - 1] === "/";
  path = normalizeString$1(path, !isPathAbsolute);
  if (path.length === 0) {
    if (isPathAbsolute) {
      return "/";
    }
    return trailingSeparator ? "./" : ".";
  }
  if (trailingSeparator) {
    path += "/";
  }
  if (_DRIVE_LETTER_RE$1.test(path)) {
    path += "/";
  }
  if (isUNCPath) {
    if (!isPathAbsolute) {
      return `//./${path}`;
    }
    return `//${path}`;
  }
  return isPathAbsolute && !isAbsolute$1(path) ? `/${path}` : path;
};
const join = function(...arguments_) {
  if (arguments_.length === 0) {
    return ".";
  }
  let joined;
  for (const argument of arguments_) {
    if (argument && argument.length > 0) {
      if (joined === void 0) {
        joined = argument;
      } else {
        joined += `/${argument}`;
      }
    }
  }
  if (joined === void 0) {
    return ".";
  }
  return normalize(joined.replace(/\/\/+/g, "/"));
};
function normalizeString$1(path, allowAboveRoot) {
  let res = "";
  let lastSegmentLength = 0;
  let lastSlash = -1;
  let dots = 0;
  let char = null;
  for (let index = 0; index <= path.length; ++index) {
    if (index < path.length) {
      char = path[index];
    } else if (char === "/") {
      break;
    } else {
      char = "/";
    }
    if (char === "/") {
      if (lastSlash === index - 1 || dots === 1) ; else if (dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res[res.length - 1] !== "." || res[res.length - 2] !== ".") {
          if (res.length > 2) {
            const lastSlashIndex = res.lastIndexOf("/");
            if (lastSlashIndex === -1) {
              res = "";
              lastSegmentLength = 0;
            } else {
              res = res.slice(0, lastSlashIndex);
              lastSegmentLength = res.length - 1 - res.lastIndexOf("/");
            }
            lastSlash = index;
            dots = 0;
            continue;
          } else if (res.length > 0) {
            res = "";
            lastSegmentLength = 0;
            lastSlash = index;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          res += res.length > 0 ? "/.." : "..";
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0) {
          res += `/${path.slice(lastSlash + 1, index)}`;
        } else {
          res = path.slice(lastSlash + 1, index);
        }
        lastSegmentLength = index - lastSlash - 1;
      }
      lastSlash = index;
      dots = 0;
    } else if (char === "." && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}
const isAbsolute$1 = function(p) {
  return _IS_ABSOLUTE_RE$1.test(p);
};

function virtualId(/** @type {string} */ moduleName) {
	return `virtual:${moduleName}`;
}

function handlerModule(
	/** @type {import("./router-mode").Router} */ router,
) {
	return router.handler?.endsWith(".html")
		? isAbsolute$1(router.handler)
			? router.handler
			: join(router.root, router.handler)
		: `$vinxi/handler/${router.name}`;
}

/**
 * Traverses the module graph and collects assets for a given chunk
 *
 * @param {any} manifest Client manifest
 * @param {string} id Chunk id
 * @param {Map<string, string[]>} assetMap Cache of assets
 * @param {string[]} stack Stack of chunk ids to prevent circular dependencies
 * @returns Array of asset URLs
 */
function findAssetsInViteManifest(manifest, id, assetMap = new Map(), stack = []) {
	if (stack.includes(id)) {
		return [];
	}

	const cached = assetMap.get(id);
	if (cached) {
		return cached;
	}
	const chunk = manifest[id];
	if (!chunk) {
		return [];
	}

	const assets = [
		...(chunk.assets?.filter(Boolean) || []),
		...(chunk.css?.filter(Boolean) || [])
	];
	if (chunk.imports) {
		stack.push(id);
		for (let i = 0, l = chunk.imports.length; i < l; i++) {
			assets.push(...findAssetsInViteManifest(manifest, chunk.imports[i], assetMap, stack));
		}
		stack.pop();
	}
	assets.push(chunk.file);
	const all = Array.from(new Set(assets));
	assetMap.set(id, all);

	return all;
}

/** @typedef {import("../app.js").App & { config: { buildManifest: { [key:string]: any } }}} ProdApp */

function createHtmlTagsForAssets(router, app, assets) {
	return assets
		.filter(
			(asset) =>
				asset.endsWith(".css") ||
				asset.endsWith(".js") ||
				asset.endsWith(".mjs"),
		)
		.map((asset) => ({
			tag: "link",
			attrs: {
				href: joinURL(app.config.server.baseURL ?? "/", router.base, asset),
				key: join(app.config.server.baseURL ?? "", router.base, asset),
				...(asset.endsWith(".css")
					? { rel: "stylesheet", fetchPriority: "high" }
					: { rel: "modulepreload" }),
			},
		}));
}

/**
 *
 * @param {ProdApp} app
 * @returns
 */
function createProdManifest(app) {
	const manifest = new Proxy(
		{},
		{
			get(target, routerName) {
				invariant(typeof routerName === "string", "Bundler name expected");
				const router = app.getRouter(routerName);
				const bundlerManifest = app.config.buildManifest[routerName];

				invariant(
					router.type !== "static",
					"manifest not available for static router",
				);
				return {
					handler: router.handler,
					async assets() {
						/** @type {{ [key: string]: string[] }} */
						let assets = {};
						assets[router.handler] = await this.inputs[router.handler].assets();
						for (const route of (await router.internals.routes?.getRoutes()) ??
							[]) {
							assets[route.filePath] = await this.inputs[
								route.filePath
							].assets();
						}
						return assets;
					},
					async routes() {
						return (await router.internals.routes?.getRoutes()) ?? [];
					},
					async json() {
						/** @type {{ [key: string]: { output: string; assets: string[]} }} */
						let json = {};
						for (const input of Object.keys(this.inputs)) {
							json[input] = {
								output: this.inputs[input].output.path,
								assets: await this.inputs[input].assets(),
							};
						}
						return json;
					},
					chunks: new Proxy(
						{},
						{
							get(target, chunk) {
								invariant(typeof chunk === "string", "Chunk expected");
								const chunkPath = join(
									router.outDir,
									router.base,
									chunk + ".mjs",
								);
								return {
									import() {
										if (globalThis.$$chunks[chunk + ".mjs"]) {
											return globalThis.$$chunks[chunk + ".mjs"];
										}
										return import(
											/* @vite-ignore */ pathToFileURL(chunkPath).href
										);
									},
									output: {
										path: chunkPath,
									},
								};
							},
						},
					),
					inputs: new Proxy(
						{},
						{
							ownKeys(target) {
								const keys = Object.keys(bundlerManifest)
									.filter((id) => bundlerManifest[id].isEntry)
									.map((id) => id);
								return keys;
							},
							getOwnPropertyDescriptor(k) {
								return {
									enumerable: true,
									configurable: true,
								};
							},
							get(target, input) {
								invariant(typeof input === "string", "Input expected");
								if (router.target === "server") {
									const id =
										input === router.handler
											? virtualId(handlerModule(router))
											: input;
									return {
										assets() {
											return createHtmlTagsForAssets(
												router,
												app,
												findAssetsInViteManifest(bundlerManifest, id),
											);
										},
										output: {
											path: join(
												router.outDir,
												router.base,
												bundlerManifest[id].file,
											),
										},
									};
								} else if (router.target === "browser") {
									const id =
										input === router.handler && !input.endsWith(".html")
											? virtualId(handlerModule(router))
											: input;
									return {
										import() {
											return import(
												/* @vite-ignore */ joinURL(
													app.config.server.baseURL ?? "",
													router.base,
													bundlerManifest[id].file,
												)
											);
										},
										assets() {
											return createHtmlTagsForAssets(
												router,
												app,
												findAssetsInViteManifest(bundlerManifest, id),
											);
										},
										output: {
											path: joinURL(
												app.config.server.baseURL ?? "",
												router.base,
												bundlerManifest[id].file,
											),
										},
									};
								}
							},
						},
					),
				};
			},
		},
	);

	return manifest;
}

function plugin() {
	globalThis.MANIFEST =
		createProdManifest(globalThis.app)
			;
}

const chunks = {};
			 



			 function app() {
				 globalThis.$$chunks = chunks;
			 }

const plugins = [
  plugin$2,
plugin$1,
plugin,
app
];

const assets = {
  "/favicon.ico": {
    "type": "image/vnd.microsoft.icon",
    "etag": "\"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk\"",
    "mtime": "2026-05-29T06:47:19.353Z",
    "size": 0,
    "path": "../public/favicon.ico"
  },
  "/assets/ssr-14LnX6eI.css": {
    "type": "text/css; charset=utf-8",
    "encoding": null,
    "etag": "\"28d6-eZbTlqwjHsTo00TZJ5735rE8nrs\"",
    "mtime": "2026-05-29T08:15:16.099Z",
    "size": 10454,
    "path": "../public/assets/ssr-14LnX6eI.css"
  },
  "/assets/ssr-14LnX6eI.css.br": {
    "type": "text/css; charset=utf-8",
    "encoding": "br",
    "etag": "\"a19-fSex06TEKOSA/RLhpwvfeiiZ+jI\"",
    "mtime": "2026-05-29T08:15:16.113Z",
    "size": 2585,
    "path": "../public/assets/ssr-14LnX6eI.css.br"
  },
  "/assets/ssr-14LnX6eI.css.gz": {
    "type": "text/css; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"bce-3JxRteyqBvR165s4toGZsGVMkk4\"",
    "mtime": "2026-05-29T08:15:16.113Z",
    "size": 3022,
    "path": "../public/assets/ssr-14LnX6eI.css.gz"
  },
  "/_server/assets/app-14LnX6eI.css": {
    "type": "text/css; charset=utf-8",
    "encoding": null,
    "etag": "\"28d6-eZbTlqwjHsTo00TZJ5735rE8nrs\"",
    "mtime": "2026-05-29T08:15:16.101Z",
    "size": 10454,
    "path": "../public/_server/assets/app-14LnX6eI.css"
  },
  "/_server/assets/app-14LnX6eI.css.br": {
    "type": "text/css; charset=utf-8",
    "encoding": "br",
    "etag": "\"a19-fSex06TEKOSA/RLhpwvfeiiZ+jI\"",
    "mtime": "2026-05-29T08:15:16.122Z",
    "size": 2585,
    "path": "../public/_server/assets/app-14LnX6eI.css.br"
  },
  "/_server/assets/app-14LnX6eI.css.gz": {
    "type": "text/css; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"bce-3JxRteyqBvR165s4toGZsGVMkk4\"",
    "mtime": "2026-05-29T08:15:16.121Z",
    "size": 3022,
    "path": "../public/_server/assets/app-14LnX6eI.css.gz"
  },
  "/_build/.vite/manifest.json": {
    "type": "application/json",
    "encoding": null,
    "etag": "\"521-GAJpZ+1EJAC96heDIDPUiOxVX4o\"",
    "mtime": "2026-05-29T08:15:16.101Z",
    "size": 1313,
    "path": "../public/_build/.vite/manifest.json"
  },
  "/_build/.vite/manifest.json.br": {
    "type": "application/json",
    "encoding": "br",
    "etag": "\"144-218gkxTwcx9TCsQtGyCSXdLDyck\"",
    "mtime": "2026-05-29T08:15:16.113Z",
    "size": 324,
    "path": "../public/_build/.vite/manifest.json.br"
  },
  "/_build/.vite/manifest.json.gz": {
    "type": "application/json",
    "encoding": "gzip",
    "etag": "\"169-sS9tyS94yaOEq/Jw0zPJDWjg8oQ\"",
    "mtime": "2026-05-29T08:15:16.113Z",
    "size": 361,
    "path": "../public/_build/.vite/manifest.json.gz"
  },
  "/_build/assets/_number_-C19dVD80.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"3d87-7LMQOgcmxLw/Ku4kkka8olGexTs\"",
    "mtime": "2026-05-29T08:15:16.100Z",
    "size": 15751,
    "path": "../public/_build/assets/_number_-C19dVD80.js"
  },
  "/_build/assets/_number_-C19dVD80.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"1119-c6X6YAN1pf5Pgd8ahMNq7hbkJK0\"",
    "mtime": "2026-05-29T08:15:16.121Z",
    "size": 4377,
    "path": "../public/_build/assets/_number_-C19dVD80.js.br"
  },
  "/_build/assets/_number_-C19dVD80.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"13f2-zSGiGpJswmc2zuTMjjMnfi/o9GM\"",
    "mtime": "2026-05-29T08:15:16.113Z",
    "size": 5106,
    "path": "../public/_build/assets/_number_-C19dVD80.js.gz"
  },
  "/_build/assets/client-14LnX6eI.css": {
    "type": "text/css; charset=utf-8",
    "encoding": null,
    "etag": "\"28d6-eZbTlqwjHsTo00TZJ5735rE8nrs\"",
    "mtime": "2026-05-29T08:15:16.101Z",
    "size": 10454,
    "path": "../public/_build/assets/client-14LnX6eI.css"
  },
  "/_build/assets/client-14LnX6eI.css.br": {
    "type": "text/css; charset=utf-8",
    "encoding": "br",
    "etag": "\"a19-fSex06TEKOSA/RLhpwvfeiiZ+jI\"",
    "mtime": "2026-05-29T08:15:16.113Z",
    "size": 2585,
    "path": "../public/_build/assets/client-14LnX6eI.css.br"
  },
  "/_build/assets/client-14LnX6eI.css.gz": {
    "type": "text/css; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"bce-3JxRteyqBvR165s4toGZsGVMkk4\"",
    "mtime": "2026-05-29T08:15:16.113Z",
    "size": 3022,
    "path": "../public/_build/assets/client-14LnX6eI.css.gz"
  },
  "/_build/assets/client-CUd7QPYi.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"1557-NHZe44xmEzZWYfDFqQWEuYNozsU\"",
    "mtime": "2026-05-29T08:15:16.122Z",
    "size": 5463,
    "path": "../public/_build/assets/client-CUd7QPYi.js.br"
  },
  "/_build/assets/client-CUd7QPYi.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"39c5-86FGCJXtJShixfpbqTMi4ylqHBU\"",
    "mtime": "2026-05-29T08:15:16.101Z",
    "size": 14789,
    "path": "../public/_build/assets/client-CUd7QPYi.js"
  },
  "/_build/assets/client-CUd7QPYi.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"17dc-eyYHF/Gu2JbOWTw3s+GyWJuwSNE\"",
    "mtime": "2026-05-29T08:15:16.113Z",
    "size": 6108,
    "path": "../public/_build/assets/client-CUd7QPYi.js.gz"
  },
  "/_build/assets/components--pwY-tAv.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": "\"32e-hAF2DdMXiqSl4DEIrC1yjBVqBo0\"",
    "mtime": "2026-05-29T08:15:16.101Z",
    "size": 814,
    "path": "../public/_build/assets/components--pwY-tAv.js"
  },
  "/_build/assets/context-DUTKMJGZ.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"a471-m/8+Fuh1nNyVL218yAFF/s4DgnM\"",
    "mtime": "2026-05-29T08:15:16.101Z",
    "size": 42097,
    "path": "../public/_build/assets/context-DUTKMJGZ.js"
  },
  "/_build/assets/context-DUTKMJGZ.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"3ed4-5sAuO39G+hp3sZPBtckOsZeoHrA\"",
    "mtime": "2026-05-29T08:15:16.113Z",
    "size": 16084,
    "path": "../public/_build/assets/context-DUTKMJGZ.js.gz"
  },
  "/_build/assets/context-DUTKMJGZ.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"393d-+OZo/xofSuRXyyHtfYx0q3+w2DI\"",
    "mtime": "2026-05-29T08:15:16.142Z",
    "size": 14653,
    "path": "../public/_build/assets/context-DUTKMJGZ.js.br"
  },
  "/_build/assets/index-DVrB6r9Y.js": {
    "type": "text/javascript; charset=utf-8",
    "encoding": null,
    "etag": "\"9cc-SgZHlO6+t/8a/enz4nBpd5Vb2Xk\"",
    "mtime": "2026-05-29T08:15:16.100Z",
    "size": 2508,
    "path": "../public/_build/assets/index-DVrB6r9Y.js"
  },
  "/_build/assets/index-DVrB6r9Y.js.br": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "br",
    "etag": "\"39f-whQOKbrzmoxpfVJXdTdRWQyswBI\"",
    "mtime": "2026-05-29T08:15:16.121Z",
    "size": 927,
    "path": "../public/_build/assets/index-DVrB6r9Y.js.br"
  },
  "/_build/assets/index-DVrB6r9Y.js.gz": {
    "type": "text/javascript; charset=utf-8",
    "encoding": "gzip",
    "etag": "\"429-FmGuaG/MutbVy8ypTQg5OnwU0NA\"",
    "mtime": "2026-05-29T08:15:16.121Z",
    "size": 1065,
    "path": "../public/_build/assets/index-DVrB6r9Y.js.gz"
  }
};

const _DRIVE_LETTER_START_RE = /^[A-Za-z]:\//;
function normalizeWindowsPath(input = "") {
  if (!input) {
    return input;
  }
  return input.replace(/\\/g, "/").replace(_DRIVE_LETTER_START_RE, (r) => r.toUpperCase());
}
const _IS_ABSOLUTE_RE = /^[/\\](?![/\\])|^[/\\]{2}(?!\.)|^[A-Za-z]:[/\\]/;
const _DRIVE_LETTER_RE = /^[A-Za-z]:$/;
function cwd() {
  if (typeof process !== "undefined" && typeof process.cwd === "function") {
    return process.cwd().replace(/\\/g, "/");
  }
  return "/";
}
const resolve = function(...arguments_) {
  arguments_ = arguments_.map((argument) => normalizeWindowsPath(argument));
  let resolvedPath = "";
  let resolvedAbsolute = false;
  for (let index = arguments_.length - 1; index >= -1 && !resolvedAbsolute; index--) {
    const path = index >= 0 ? arguments_[index] : cwd();
    if (!path || path.length === 0) {
      continue;
    }
    resolvedPath = `${path}/${resolvedPath}`;
    resolvedAbsolute = isAbsolute(path);
  }
  resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute);
  if (resolvedAbsolute && !isAbsolute(resolvedPath)) {
    return `/${resolvedPath}`;
  }
  return resolvedPath.length > 0 ? resolvedPath : ".";
};
function normalizeString(path, allowAboveRoot) {
  let res = "";
  let lastSegmentLength = 0;
  let lastSlash = -1;
  let dots = 0;
  let char = null;
  for (let index = 0; index <= path.length; ++index) {
    if (index < path.length) {
      char = path[index];
    } else if (char === "/") {
      break;
    } else {
      char = "/";
    }
    if (char === "/") {
      if (lastSlash === index - 1 || dots === 1) ; else if (dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res[res.length - 1] !== "." || res[res.length - 2] !== ".") {
          if (res.length > 2) {
            const lastSlashIndex = res.lastIndexOf("/");
            if (lastSlashIndex === -1) {
              res = "";
              lastSegmentLength = 0;
            } else {
              res = res.slice(0, lastSlashIndex);
              lastSegmentLength = res.length - 1 - res.lastIndexOf("/");
            }
            lastSlash = index;
            dots = 0;
            continue;
          } else if (res.length > 0) {
            res = "";
            lastSegmentLength = 0;
            lastSlash = index;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          res += res.length > 0 ? "/.." : "..";
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0) {
          res += `/${path.slice(lastSlash + 1, index)}`;
        } else {
          res = path.slice(lastSlash + 1, index);
        }
        lastSegmentLength = index - lastSlash - 1;
      }
      lastSlash = index;
      dots = 0;
    } else if (char === "." && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}
const isAbsolute = function(p) {
  return _IS_ABSOLUTE_RE.test(p);
};
const dirname = function(p) {
  const segments = normalizeWindowsPath(p).replace(/\/$/, "").split("/").slice(0, -1);
  if (segments.length === 1 && _DRIVE_LETTER_RE.test(segments[0])) {
    segments[0] += "/";
  }
  return segments.join("/") || (isAbsolute(p) ? "/" : ".");
};

function readAsset (id) {
  const serverDir = dirname(fileURLToPath(globalThis._importMeta_.url));
  return promises.readFile(resolve(serverDir, assets[id].path))
}

const publicAssetBases = {};

function isPublicAssetURL(id = '') {
  if (assets[id]) {
    return true
  }
  for (const base in publicAssetBases) {
    if (id.startsWith(base)) { return true }
  }
  return false
}

function getAsset (id) {
  return assets[id]
}

const METHODS = /* @__PURE__ */ new Set(["HEAD", "GET"]);
const EncodingMap = { gzip: ".gz", br: ".br" };
const _gZdetY = eventHandler$1((event) => {
  if (event.method && !METHODS.has(event.method)) {
    return;
  }
  let id = decodePath(
    withLeadingSlash(withoutTrailingSlash(parseURL(event.path).pathname))
  );
  let asset;
  const encodingHeader = String(
    getRequestHeader$1(event, "accept-encoding") || ""
  );
  const encodings = [
    ...encodingHeader.split(",").map((e) => EncodingMap[e.trim()]).filter(Boolean).sort(),
    ""
  ];
  for (const encoding of encodings) {
    for (const _id of [id + encoding, joinURL(id, "index.html" + encoding)]) {
      const _asset = getAsset(_id);
      if (_asset) {
        asset = _asset;
        id = _id;
        break;
      }
    }
  }
  if (!asset) {
    if (isPublicAssetURL(id)) {
      removeResponseHeader$1(event, "Cache-Control");
      throw createError$2({ statusCode: 404 });
    }
    return;
  }
  if (asset.encoding !== void 0) {
    appendResponseHeader$1(event, "Vary", "Accept-Encoding");
  }
  const ifNotMatch = getRequestHeader$1(event, "if-none-match") === asset.etag;
  if (ifNotMatch) {
    setResponseStatus$1(event, 304, "Not Modified");
    return "";
  }
  const ifModifiedSinceH = getRequestHeader$1(event, "if-modified-since");
  const mtimeDate = new Date(asset.mtime);
  if (ifModifiedSinceH && asset.mtime && new Date(ifModifiedSinceH) >= mtimeDate) {
    setResponseStatus$1(event, 304, "Not Modified");
    return "";
  }
  if (asset.type && !getResponseHeader$1(event, "Content-Type")) {
    setResponseHeader$1(event, "Content-Type", asset.type);
  }
  if (asset.etag && !getResponseHeader$1(event, "ETag")) {
    setResponseHeader$1(event, "ETag", asset.etag);
  }
  if (asset.mtime && !getResponseHeader$1(event, "Last-Modified")) {
    setResponseHeader$1(event, "Last-Modified", mtimeDate.toUTCString());
  }
  if (asset.encoding && !getResponseHeader$1(event, "Content-Encoding")) {
    setResponseHeader$1(event, "Content-Encoding", asset.encoding);
  }
  if (asset.size > 0 && !getResponseHeader$1(event, "Content-Length")) {
    setResponseHeader$1(event, "Content-Length", asset.size);
  }
  return readAsset(id);
});

function parseSetCookie$1(setCookieValue, options) {
  const parts = (setCookieValue || "").split(";").filter((str) => typeof str === "string" && !!str.trim());
  const nameValuePairStr = parts.shift() || "";
  const parsed = _parseNameValuePair$1(nameValuePairStr);
  const name = parsed.name;
  let value = parsed.value;
  try {
    value = options?.decode === false ? value : (options?.decode || decodeURIComponent)(value);
  } catch {
  }
  const cookie = {
    name,
    value
  };
  for (const part of parts) {
    const sides = part.split("=");
    const partKey = (sides.shift() || "").trimStart().toLowerCase();
    const partValue = sides.join("=");
    switch (partKey) {
      case "expires": {
        cookie.expires = new Date(partValue);
        break;
      }
      case "max-age": {
        cookie.maxAge = Number.parseInt(partValue, 10);
        break;
      }
      case "secure": {
        cookie.secure = true;
        break;
      }
      case "httponly": {
        cookie.httpOnly = true;
        break;
      }
      case "samesite": {
        cookie.sameSite = partValue;
        break;
      }
      default: {
        cookie[partKey] = partValue;
      }
    }
  }
  return cookie;
}
function _parseNameValuePair$1(nameValuePairStr) {
  let name = "";
  let value = "";
  const nameValueArr = nameValuePairStr.split("=");
  if (nameValueArr.length > 1) {
    name = nameValueArr.shift();
    value = nameValueArr.join("=");
  } else {
    value = nameValuePairStr;
  }
  return { name, value };
}

const ERROR = Symbol("error");
function castError(err) {
  if (err instanceof Error) return err;
  return new Error(typeof err === "string" ? err : "Unknown error", {
    cause: err
  });
}
function handleError(err, owner = Owner) {
  const fns = owner && owner.context && owner.context[ERROR];
  const error = castError(err);
  if (!fns) throw error;
  try {
    for (const f of fns) f(error);
  } catch (e) {
    handleError(e, owner && owner.owner || null);
  }
}
const UNOWNED = {
  context: null,
  owner: null,
  owned: null,
  cleanups: null
};
let Owner = null;
function createOwner() {
  const o = {
    owner: Owner,
    context: Owner ? Owner.context : null,
    owned: null,
    cleanups: null
  };
  if (Owner) {
    if (!Owner.owned) Owner.owned = [o];else Owner.owned.push(o);
  }
  return o;
}
function createRoot(fn, detachedOwner) {
  const owner = Owner,
    current = owner ,
    root = fn.length === 0 ? UNOWNED : {
      context: current ? current.context : null,
      owner: current,
      owned: null,
      cleanups: null
    };
  Owner = root;
  let result;
  try {
    result = fn(fn.length === 0 ? () => {} : () => cleanNode(root));
  } catch (err) {
    handleError(err);
  } finally {
    Owner = owner;
  }
  return result;
}
function createSignal(value, options) {
  return [() => value, v => {
    return value = typeof v === "function" ? v(value) : v;
  }];
}
function createComputed(fn, value) {
  Owner = createOwner();
  try {
    fn(value);
  } catch (err) {
    handleError(err);
  } finally {
    Owner = Owner.owner;
  }
}
const createRenderEffect = createComputed;
function createMemo(fn, value) {
  Owner = createOwner();
  let v;
  try {
    v = fn(value);
  } catch (err) {
    handleError(err);
  } finally {
    Owner = Owner.owner;
  }
  return () => v;
}
function batch(fn) {
  return fn();
}
const untrack = batch;
function on$1(deps, fn, options = {}) {
  const isArray = Array.isArray(deps);
  const defer = options.defer;
  return () => {
    if (defer) return undefined;
    let value;
    if (isArray) {
      value = [];
      for (let i = 0; i < deps.length; i++) value.push(deps[i]());
    } else value = deps();
    return fn(value);
  };
}
function onCleanup(fn) {
  if (Owner) {
    if (!Owner.cleanups) Owner.cleanups = [fn];else Owner.cleanups.push(fn);
  }
  return fn;
}
function cleanNode(node) {
  if (node.owned) {
    for (let i = 0; i < node.owned.length; i++) cleanNode(node.owned[i]);
    node.owned = null;
  }
  if (node.cleanups) {
    for (let i = 0; i < node.cleanups.length; i++) node.cleanups[i]();
    node.cleanups = null;
  }
}
function catchError(fn, handler) {
  const owner = createOwner();
  owner.context = {
    ...owner.context,
    [ERROR]: [handler]
  };
  Owner = owner;
  try {
    return fn();
  } catch (err) {
    handleError(err);
  } finally {
    Owner = Owner.owner;
  }
}
function createContext(defaultValue) {
  const id = Symbol("context");
  return {
    id,
    Provider: createProvider(id),
    defaultValue
  };
}
function useContext(context) {
  return Owner && Owner.context && Owner.context[context.id] !== undefined ? Owner.context[context.id] : context.defaultValue;
}
function getOwner() {
  return Owner;
}
function children(fn) {
  const memo = createMemo(() => resolveChildren(fn()));
  memo.toArray = () => {
    const c = memo();
    return Array.isArray(c) ? c : c != null ? [c] : [];
  };
  return memo;
}
function runWithOwner(o, fn) {
  const prev = Owner;
  Owner = o;
  try {
    return fn();
  } catch (err) {
    handleError(err);
  } finally {
    Owner = prev;
  }
}
function resolveChildren(children) {
  if (typeof children === "function" && !children.length) return resolveChildren(children());
  if (Array.isArray(children)) {
    const results = [];
    for (let i = 0; i < children.length; i++) {
      const result = resolveChildren(children[i]);
      if (Array.isArray(result)) {
        if (result.length < 32768) results.push.apply(results, result);else for (let j = 0; j < result.length; j++) results.push(result[j]);
      } else {
        results.push(result);
      }
    }
    return results;
  }
  return children;
}
function createProvider(id) {
  return function provider(props) {
    return createMemo(() => {
      Owner.context = {
        ...Owner.context,
        [id]: props.value
      };
      return children(() => props.children);
    });
  };
}

function escape$1(s, attr) {
  const t = typeof s;
  if (t !== "string") {
    if (t === "function") return escape$1(s());
    if (Array.isArray(s)) {
      for (let i = 0; i < s.length; i++) s[i] = escape$1(s[i]);
      return s;
    }
    return s;
  }
  const delim = "<";
  const escDelim = "&lt;";
  let iDelim = s.indexOf(delim);
  let iAmp = s.indexOf("&");
  if (iDelim < 0 && iAmp < 0) return s;
  let left = 0,
    out = "";
  while (iDelim >= 0 && iAmp >= 0) {
    if (iDelim < iAmp) {
      if (left < iDelim) out += s.substring(left, iDelim);
      out += escDelim;
      left = iDelim + 1;
      iDelim = s.indexOf(delim, left);
    } else {
      if (left < iAmp) out += s.substring(left, iAmp);
      out += "&amp;";
      left = iAmp + 1;
      iAmp = s.indexOf("&", left);
    }
  }
  if (iDelim >= 0) {
    do {
      if (left < iDelim) out += s.substring(left, iDelim);
      out += escDelim;
      left = iDelim + 1;
      iDelim = s.indexOf(delim, left);
    } while (iDelim >= 0);
  } else while (iAmp >= 0) {
    if (left < iAmp) out += s.substring(left, iAmp);
    out += "&amp;";
    left = iAmp + 1;
    iAmp = s.indexOf("&", left);
  }
  return left < s.length ? out + s.substring(left) : out;
}
function resolveSSRNode$1(node) {
  const t = typeof node;
  if (t === "string") return node;
  if (node == null || t === "boolean") return "";
  if (Array.isArray(node)) {
    let prev = {};
    let mapped = "";
    for (let i = 0, len = node.length; i < len; i++) {
      if (typeof prev !== "object" && typeof node[i] !== "object") mapped += `<!--!$-->`;
      mapped += resolveSSRNode$1(prev = node[i]);
    }
    return mapped;
  }
  if (t === "object") return node.t;
  if (t === "function") return resolveSSRNode$1(node());
  return String(node);
}
const sharedConfig = {
  context: undefined,
  getContextId() {
    if (!this.context) throw new Error(`getContextId cannot be used under non-hydrating context`);
    return getContextId(this.context.count);
  },
  getNextContextId() {
    if (!this.context) throw new Error(`getNextContextId cannot be used under non-hydrating context`);
    return getContextId(this.context.count++);
  }
};
function getContextId(count) {
  const num = String(count),
    len = num.length - 1;
  return sharedConfig.context.id + (len ? String.fromCharCode(96 + len) : "") + num;
}
function setHydrateContext(context) {
  sharedConfig.context = context;
}
function nextHydrateContext() {
  return sharedConfig.context ? {
    ...sharedConfig.context,
    id: sharedConfig.getNextContextId(),
    count: 0
  } : undefined;
}
function createUniqueId() {
  return sharedConfig.getNextContextId();
}
function createComponent(Comp, props) {
  if (sharedConfig.context && !sharedConfig.context.noHydrate) {
    const c = sharedConfig.context;
    setHydrateContext(nextHydrateContext());
    const r = Comp(props || {});
    setHydrateContext(c);
    return r;
  }
  return Comp(props || {});
}
function mergeProps(...sources) {
  const target = {};
  for (let i = 0; i < sources.length; i++) {
    let source = sources[i];
    if (typeof source === "function") source = source();
    if (source) {
      const descriptors = Object.getOwnPropertyDescriptors(source);
      for (const key in descriptors) {
        if (key in target) continue;
        Object.defineProperty(target, key, {
          enumerable: true,
          get() {
            for (let i = sources.length - 1; i >= 0; i--) {
              let v,
                s = sources[i];
              if (typeof s === "function") s = s();
              v = (s || {})[key];
              if (v !== undefined) return v;
            }
          }
        });
      }
    }
  }
  return target;
}
function splitProps(props, ...keys) {
  const descriptors = Object.getOwnPropertyDescriptors(props),
    split = k => {
      const clone = {};
      for (let i = 0; i < k.length; i++) {
        const key = k[i];
        if (descriptors[key]) {
          Object.defineProperty(clone, key, descriptors[key]);
          delete descriptors[key];
        }
      }
      return clone;
    };
  return keys.map(split).concat(split(Object.keys(descriptors)));
}
function simpleMap(props, wrap) {
  const list = props.each || [],
    len = list.length,
    fn = props.children;
  if (len) {
    let mapped = Array(len);
    for (let i = 0; i < len; i++) mapped[i] = wrap(fn, list[i], i);
    return mapped;
  }
  return props.fallback;
}
function For(props) {
  return simpleMap(props, (fn, item, i) => fn(item, () => i));
}
function Show(props) {
  let c;
  return props.when ? typeof (c = props.children) === "function" ? c(props.keyed ? props.when : () => props.when) : c : props.fallback || "";
}
function ErrorBoundary(props) {
  let error,
    res,
    clean,
    sync = true;
  const ctx = sharedConfig.context;
  const id = sharedConfig.getContextId();
  function displayFallback() {
    cleanNode(clean);
    ctx.serialize(id, error);
    setHydrateContext({
      ...ctx,
      count: 0
    });
    const f = props.fallback;
    return typeof f === "function" && f.length ? f(error, () => {}) : f;
  }
  createMemo(() => {
    clean = Owner;
    return catchError(() => res = props.children, err => {
      error = err;
      !sync && ctx.replace("e" + id, displayFallback);
      sync = true;
    });
  });
  if (error) return displayFallback();
  sync = false;
  return {
    t: `<!--!$e${id}-->${resolveSSRNode$1(escape$1(res))}<!--!$/e${id}-->`
  };
}
const SuspenseContext = createContext();
function lazy(fn) {
  let p;
  let load = id => {
    if (!p) {
      p = fn();
      p.then(mod => p.resolved = mod.default);
      if (id) sharedConfig.context.lazy[id] = p;
    }
    return p;
  };
  const contexts = new Set();
  const wrap = props => {
    const id = sharedConfig.context.id;
    let ref = sharedConfig.context.lazy[id];
    if (ref) p = ref;else load(id);
    if (p.resolved) return p.resolved(props);
    const ctx = useContext(SuspenseContext);
    const track = {
      _loading: true,
      error: undefined
    };
    if (ctx) {
      ctx.resources.set(id, track);
      contexts.add(ctx);
    }
    if (sharedConfig.context.async) {
      sharedConfig.context.block(p.then(() => {
        track._loading = false;
        notifySuspense(contexts);
      }));
    }
    return "";
  };
  wrap.preload = load;
  return wrap;
}
function suspenseComplete(c) {
  for (const r of c.resources.values()) {
    if (r._loading) return false;
  }
  return true;
}
function notifySuspense(contexts) {
  for (const c of contexts) {
    if (!suspenseComplete(c)) {
      continue;
    }
    c.completed();
    contexts.delete(c);
  }
}
function startTransition(fn) {
  fn();
}
function Suspense(props) {
  let done;
  const ctx = sharedConfig.context;
  const id = sharedConfig.getContextId();
  const o = createOwner();
  const value = ctx.suspense[id] || (ctx.suspense[id] = {
    resources: new Map(),
    completed: () => {
      const res = runSuspense();
      if (suspenseComplete(value)) {
        done(resolveSSRNode$1(escape$1(res)));
      }
    }
  });
  function suspenseError(err) {
    if (!done || !done(undefined, err)) {
      runWithOwner(o.owner, () => {
        throw err;
      });
    }
  }
  function runSuspense() {
    setHydrateContext({
      ...ctx,
      count: 0
    });
    cleanNode(o);
    return runWithOwner(o, () => createComponent(SuspenseContext.Provider, {
      value,
      get children() {
        return catchError(() => props.children, suspenseError);
      }
    }));
  }
  const res = runSuspense();
  if (suspenseComplete(value)) {
    delete ctx.suspense[id];
    return res;
  }
  done = ctx.async ? ctx.registerFragment(id) : undefined;
  return catchError(() => {
    if (ctx.async) {
      setHydrateContext({
        ...ctx,
        count: 0,
        id: ctx.id + "0F",
        noHydrate: true
      });
      const res = {
        t: `<template id="pl-${id}"></template>${resolveSSRNode$1(escape$1(props.fallback))}<!--pl-${id}-->`
      };
      setHydrateContext(ctx);
      return res;
    }
    setHydrateContext({
      ...ctx,
      count: 0,
      id: ctx.id + "0F"
    });
    ctx.serialize(id, "$$f");
    return props.fallback;
  }, suspenseError);
}

var M$1=(i=>(i[i.AggregateError=1]="AggregateError",i[i.ArrowFunction=2]="ArrowFunction",i[i.ErrorPrototypeStack=4]="ErrorPrototypeStack",i[i.ObjectAssign=8]="ObjectAssign",i[i.BigIntTypedArray=16]="BigIntTypedArray",i[i.RegExp=32]="RegExp",i))(M$1||{});var v$2=Symbol.asyncIterator,pr=Symbol.hasInstance,R=Symbol.isConcatSpreadable,C$1=Symbol.iterator,dr=Symbol.match,gr=Symbol.matchAll,yr=Symbol.replace,Nr=Symbol.search,br=Symbol.species,vr=Symbol.split,Cr=Symbol.toPrimitive,P$2=Symbol.toStringTag,Ar=Symbol.unscopables;var tt$1={0:"Symbol.asyncIterator",1:"Symbol.hasInstance",2:"Symbol.isConcatSpreadable",3:"Symbol.iterator",4:"Symbol.match",5:"Symbol.matchAll",6:"Symbol.replace",7:"Symbol.search",8:"Symbol.species",9:"Symbol.split",10:"Symbol.toPrimitive",11:"Symbol.toStringTag",12:"Symbol.unscopables"},ve={[v$2]:0,[pr]:1,[R]:2,[C$1]:3,[dr]:4,[gr]:5,[yr]:6,[Nr]:7,[br]:8,[vr]:9,[Cr]:10,[P$2]:11,[Ar]:12},nt$2={0:v$2,1:pr,2:R,3:C$1,4:dr,5:gr,6:yr,7:Nr,8:br,9:vr,10:Cr,11:P$2,12:Ar},ot$2={2:"!0",3:"!1",1:"void 0",0:"null",4:"-0",5:"1/0",6:"-1/0",7:"0/0"},o$1=void 0,at$3={2:true,3:false,1:o$1,0:null,4:-0,5:Number.POSITIVE_INFINITY,6:Number.NEGATIVE_INFINITY,7:Number.NaN};var Ce={0:"Error",1:"EvalError",2:"RangeError",3:"ReferenceError",4:"SyntaxError",5:"TypeError",6:"URIError"},st$3={0:Error,1:EvalError,2:RangeError,3:ReferenceError,4:SyntaxError,5:TypeError,6:URIError};function c$1(e,r,t,n,a,s,i,u,l,g,S,d){return {t:e,i:r,s:t,c:n,m:a,p:s,e:i,a:u,f:l,b:g,o:S,l:d}}function B$2(e){return c$1(2,o$1,e,o$1,o$1,o$1,o$1,o$1,o$1,o$1,o$1,o$1)}var H$2=B$2(2),J$2=B$2(3),Ae=B$2(1),Ee=B$2(0),it$3=B$2(4),ut$2=B$2(5),lt$3=B$2(6),ct$3=B$2(7);function mn(e){switch(e){case '"':return '\\"';case "\\":return "\\\\";case `
`:return "\\n";case "\r":return "\\r";case "\b":return "\\b";case "	":return "\\t";case "\f":return "\\f";case "<":return "\\x3C";case "\u2028":return "\\u2028";case "\u2029":return "\\u2029";default:return o$1}}function y$2(e){let r="",t=0,n;for(let a=0,s=e.length;a<s;a++)n=mn(e[a]),n&&(r+=e.slice(t,a)+n,t=a+1);return t===0?r=e:r+=e.slice(t),r}function pn(e){switch(e){case "\\\\":return "\\";case '\\"':return '"';case "\\n":return `
`;case "\\r":return "\r";case "\\b":return "\b";case "\\t":return "	";case "\\f":return "\f";case "\\x3C":return "<";case "\\u2028":return "\u2028";case "\\u2029":return "\u2029";default:return e}}function D$3(e){return e.replace(/(\\\\|\\"|\\n|\\r|\\b|\\t|\\f|\\u2028|\\u2029|\\x3C)/g,pn)}var L$3="__SEROVAL_REFS__",le$2="$R",Ie$1=`self.${le$2}`;function dn(e){return e==null?`${Ie$1}=${Ie$1}||[]`:`(${Ie$1}=${Ie$1}||{})["${y$2(e)}"]=[]`}var Er=new Map,U$4=new Map;function Ir(e){return Er.has(e)}function yn(e){return U$4.has(e)}function ft$3(e){if(Ir(e))return Er.get(e);throw new Re(e)}function St$2(e){if(yn(e))return U$4.get(e);throw new Pe(e)}typeof globalThis!="undefined"?Object.defineProperty(globalThis,L$3,{value:U$4,configurable:true,writable:false,enumerable:false}):typeof self!="undefined"?Object.defineProperty(self,L$3,{value:U$4,configurable:true,writable:false,enumerable:false}):typeof global!="undefined"&&Object.defineProperty(global,L$3,{value:U$4,configurable:true,writable:false,enumerable:false});function xe(e){return e instanceof EvalError?1:e instanceof RangeError?2:e instanceof ReferenceError?3:e instanceof SyntaxError?4:e instanceof TypeError?5:e instanceof URIError?6:0}function Nn(e){let r=Ce[xe(e)];return e.name!==r?{name:e.name}:e.constructor.name!==r?{name:e.constructor.name}:{}}function Z$1(e,r){let t=Nn(e),n=Object.getOwnPropertyNames(e);for(let a=0,s=n.length,i;a<s;a++)i=n[a],i!=="name"&&i!=="message"&&(i==="stack"?r&4&&(t=t||{},t[i]=e[i]):(t=t||{},t[i]=e[i]));return t}function Te(e){return Object.isFrozen(e)?3:Object.isSealed(e)?2:Object.isExtensible(e)?0:1}function Oe(e){switch(e){case Number.POSITIVE_INFINITY:return ut$2;case Number.NEGATIVE_INFINITY:return lt$3}return e!==e?ct$3:Object.is(e,-0)?it$3:c$1(0,o$1,e,o$1,o$1,o$1,o$1,o$1,o$1,o$1,o$1,o$1)}function $$1(e){return c$1(1,o$1,y$2(e),o$1,o$1,o$1,o$1,o$1,o$1,o$1,o$1,o$1)}function we(e){return c$1(3,o$1,""+e,o$1,o$1,o$1,o$1,o$1,o$1,o$1,o$1,o$1)}function pt$3(e){return c$1(4,e,o$1,o$1,o$1,o$1,o$1,o$1,o$1,o$1,o$1,o$1)}function he(e,r){let t=r.valueOf();return c$1(5,e,t!==t?"":r.toISOString(),o$1,o$1,o$1,o$1,o$1,o$1,o$1,o$1,o$1)}function ze$2(e,r){return c$1(6,e,o$1,y$2(r.source),r.flags,o$1,o$1,o$1,o$1,o$1,o$1,o$1)}function dt$3(e,r){return c$1(17,e,ve[r],o$1,o$1,o$1,o$1,o$1,o$1,o$1,o$1,o$1)}function gt$2(e,r){return c$1(18,e,y$2(ft$3(r)),o$1,o$1,o$1,o$1,o$1,o$1,o$1,o$1,o$1)}function ce$1(e,r,t){return c$1(25,e,t,y$2(r),o$1,o$1,o$1,o$1,o$1,o$1,o$1,o$1)}function _e$2(e,r,t){return c$1(9,e,o$1,o$1,o$1,o$1,o$1,t,o$1,o$1,Te(r),o$1)}function ke$1(e,r){return c$1(21,e,o$1,o$1,o$1,o$1,o$1,o$1,r,o$1,o$1,o$1)}function De$2(e,r,t){return c$1(15,e,o$1,r.constructor.name,o$1,o$1,o$1,o$1,t,r.byteOffset,o$1,r.length)}function Fe$1(e,r,t){return c$1(16,e,o$1,r.constructor.name,o$1,o$1,o$1,o$1,t,r.byteOffset,o$1,r.byteLength)}function Be$2(e,r,t){return c$1(20,e,o$1,o$1,o$1,o$1,o$1,o$1,t,r.byteOffset,o$1,r.byteLength)}function Ve$2(e,r,t){return c$1(13,e,xe(r),o$1,y$2(r.message),t,o$1,o$1,o$1,o$1,o$1,o$1)}function Me$2(e,r,t){return c$1(14,e,xe(r),o$1,y$2(r.message),t,o$1,o$1,o$1,o$1,o$1,o$1)}function Le$1(e,r){return c$1(7,e,o$1,o$1,o$1,o$1,o$1,r,o$1,o$1,o$1,o$1)}function Ue$1(e,r){return c$1(28,o$1,o$1,o$1,o$1,o$1,o$1,[e,r],o$1,o$1,o$1,o$1)}function je$2(e,r){return c$1(30,o$1,o$1,o$1,o$1,o$1,o$1,[e,r],o$1,o$1,o$1,o$1)}function Ye$2(e,r,t){return c$1(31,e,o$1,o$1,o$1,o$1,o$1,t,r,o$1,o$1,o$1)}function qe$1(e,r){return c$1(32,e,o$1,o$1,o$1,o$1,o$1,o$1,r,o$1,o$1,o$1)}function We$2(e,r){return c$1(33,e,o$1,o$1,o$1,o$1,o$1,o$1,r,o$1,o$1,o$1)}function Ge$2(e,r){return c$1(34,e,o$1,o$1,o$1,o$1,o$1,o$1,r,o$1,o$1,o$1)}function Ke$2(e,r,t,n){return c$1(35,e,t,o$1,o$1,o$1,o$1,r,o$1,o$1,o$1,n)}var bn={parsing:1,serialization:2,deserialization:3};function vn(e){return `Seroval Error (step: ${bn[e]})`}var Cn=(e,r)=>vn(e),fe$2=class fe extends Error{constructor(t,n){super(Cn(t));this.cause=n;}},z$1=class z extends fe$2{constructor(r){super("parsing",r);}},He$1=class He extends fe$2{constructor(r){super("deserialization",r);}};function _$3(e){return `Seroval Error (specific: ${e})`}var x$1=class x extends Error{constructor(t){super(_$3(1));this.value=t;}},h$2=class h extends Error{constructor(r){super(_$3(2));}},X$1=class X extends Error{constructor(r){super(_$3(3));}},V$2=class V extends Error{constructor(r){super(_$3(4));}},Re=class extends Error{constructor(t){super(_$3(5));this.value=t;}},Pe=class extends Error{constructor(r){super(_$3(6));}},Je$1=class Je extends Error{constructor(r){super(_$3(7));}},O$2=class O extends Error{constructor(r){super(_$3(8));}},Q=class extends Error{constructor(r){super(_$3(9));}};var j$1=class j{constructor(r,t){this.value=r;this.replacement=t;}};var ee$2=()=>{let e={p:0,s:0,f:0};return e.p=new Promise((r,t)=>{e.s=r,e.f=t;}),e},An=(e,r)=>{e.s(r),e.p.s=1,e.p.v=r;},En=(e,r)=>{e.f(r),e.p.s=2,e.p.v=r;},Nt=ee$2.toString(),bt$2=An.toString(),vt$2=En.toString(),Pr=()=>{let e=[],r=[],t=true,n=false,a=0,s=(l,g,S)=>{for(S=0;S<a;S++)r[S]&&r[S][g](l);},i=(l,g,S,d)=>{for(g=0,S=e.length;g<S;g++)d=e[g],!t&&g===S-1?l[n?"return":"throw"](d):l.next(d);},u=(l,g)=>(t&&(g=a++,r[g]=l),i(l),()=>{t&&(r[g]=r[a],r[a--]=void 0);});return {__SEROVAL_STREAM__:true,on:l=>u(l),next:l=>{t&&(e.push(l),s(l,"next"));},throw:l=>{t&&(e.push(l),s(l,"throw"),t=false,n=false,r.length=0);},return:l=>{t&&(e.push(l),s(l,"return"),t=false,n=true,r.length=0);}}},Ct=Pr.toString(),xr=e=>r=>()=>{let t=0,n={[e]:()=>n,next:()=>{if(t>r.d)return {done:true,value:void 0};let a=t++,s=r.v[a];if(a===r.t)throw s;return {done:a===r.d,value:s}}};return n},At$1=xr.toString(),Tr=(e,r)=>t=>()=>{let n=0,a=-1,s=false,i=[],u=[],l=(S=0,d=u.length)=>{for(;S<d;S++)u[S].s({done:true,value:void 0});};t.on({next:S=>{let d=u.shift();d&&d.s({done:false,value:S}),i.push(S);},throw:S=>{let d=u.shift();d&&d.f(S),l(),a=i.length,s=true,i.push(S);},return:S=>{let d=u.shift();d&&d.s({done:true,value:S}),l(),a=i.length,i.push(S);}});let g={[e]:()=>g,next:()=>{if(a===-1){let G=n++;if(G>=i.length){let rt=r();return u.push(rt),rt.p}return {done:false,value:i[G]}}if(n>a)return {done:true,value:void 0};let S=n++,d=i[S];if(S!==a)return {done:false,value:d};if(s)throw d;return {done:true,value:d}}};return g},Et$1=Tr.toString(),Or=e=>{let r=atob(e),t=r.length,n=new Uint8Array(t);for(let a=0;a<t;a++)n[a]=r.charCodeAt(a);return n.buffer},It$1=Or.toString();function Ze$2(e){return "__SEROVAL_SEQUENCE__"in e}function wr(e,r,t){return {__SEROVAL_SEQUENCE__:true,v:e,t:r,d:t}}function $e(e){let r=[],t=-1,n=-1,a=e[C$1]();for(;;)try{let s=a.next();if(r.push(s.value),s.done){n=r.length-1;break}}catch(s){t=r.length,r.push(s);}return wr(r,t,n)}var In=xr(C$1);function Rt$2(e){return In(e)}var Pt$1={},xt$1={};var Tt$1={0:{},1:{},2:{},3:{},4:{},5:{}},Ot$1={0:"[]",1:Nt,2:bt$2,3:vt$2,4:Ct,5:It$1};function Xe$2(e){return "__SEROVAL_STREAM__"in e}function re$1(){return Pr()}function Qe$2(e){let r=re$1(),t=e[v$2]();async function n(){try{let a=await t.next();a.done?r.return(a.value):(r.next(a.value),await n());}catch(a){r.throw(a);}}return n().catch(()=>{}),r}var Rn=Tr(v$2,ee$2);function wt$2(e){return Rn(e)}function me(e,r){return {plugins:r.plugins,mode:e,marked:new Set,features:63^(r.disabledFeatures||0),refs:r.refs||new Map,depthLimit:r.depthLimit||1e3}}function pe$1(e,r){e.marked.add(r);}function zr(e,r){let t=e.refs.size;return e.refs.set(r,t),t}function er$1(e,r){let t=e.refs.get(r);return t!=null?(pe$1(e,t),{type:1,value:pt$3(t)}):{type:0,value:zr(e,r)}}function Y$1(e,r){let t=er$1(e,r);return t.type===1?t:Ir(r)?{type:2,value:gt$2(t.value,r)}:t}function I$2(e,r){let t=Y$1(e,r);if(t.type!==0)return t.value;if(r in ve)return dt$3(t.value,r);throw new x$1(r)}function k$2(e,r){let t=er$1(e,Tt$1[r]);return t.type===1?t.value:c$1(26,t.value,r,o$1,o$1,o$1,o$1,o$1,o$1,o$1,o$1,o$1)}function rr$1(e){let r=er$1(e,Pt$1);return r.type===1?r.value:c$1(27,r.value,o$1,o$1,o$1,o$1,o$1,o$1,I$2(e,C$1),o$1,o$1,o$1)}function tr$1(e){let r=er$1(e,xt$1);return r.type===1?r.value:c$1(29,r.value,o$1,o$1,o$1,o$1,o$1,[k$2(e,1),I$2(e,v$2)],o$1,o$1,o$1,o$1)}function nr$1(e,r,t,n){return c$1(t?11:10,e,o$1,o$1,o$1,n,o$1,o$1,o$1,o$1,Te(r),o$1)}function or$1(e,r,t,n){return c$1(8,r,o$1,o$1,o$1,o$1,{k:t,v:n},o$1,k$2(e,0),o$1,o$1,o$1)}function zt(e,r,t){return c$1(22,r,t,o$1,o$1,o$1,o$1,o$1,k$2(e,1),o$1,o$1,o$1)}function ar(e,r,t){let n=new Uint8Array(t),a="";for(let s=0,i=n.length;s<i;s++)a+=String.fromCharCode(n[s]);return c$1(19,r,y$2(btoa(a)),o$1,o$1,o$1,o$1,o$1,k$2(e,5),o$1,o$1,o$1)}var oe$1=(t=>(t[t.Vanilla=1]="Vanilla",t[t.Cross=2]="Cross",t))(oe$1||{});function ai(e){return e}function Dt(e,r){for(let t=0,n=r.length;t<n;t++){let a=r[t];e.has(a)||(e.add(a),a.extends&&Dt(e,a.extends));}}function A$2(e){if(e){let r=new Set;return Dt(r,e),[...r]}}function Ft$2(e){switch(e){case "Int8Array":return Int8Array;case "Int16Array":return Int16Array;case "Int32Array":return Int32Array;case "Uint8Array":return Uint8Array;case "Uint16Array":return Uint16Array;case "Uint32Array":return Uint32Array;case "Uint8ClampedArray":return Uint8ClampedArray;case "Float32Array":return Float32Array;case "Float64Array":return Float64Array;case "BigInt64Array":return BigInt64Array;case "BigUint64Array":return BigUint64Array;default:throw new Je$1(e)}}var jn=1e6,Yn=1e4,qn=2e4;function Vt$1(e,r){switch(r){case 3:return Object.freeze(e);case 1:return Object.preventExtensions(e);case 2:return Object.seal(e);default:return e}}var Wn=1e3;function Mt$1(e,r){var n;let t=r.refs||new Map;return "types"in t||Object.assign(t,{types:new Map}),{mode:e,plugins:r.plugins,refs:t,features:(n=r.features)!=null?n:63^(r.disabledFeatures||0),depthLimit:r.depthLimit||Wn}}function Lt$2(e){return {mode:1,base:Mt$1(1,e),child:o$1,state:{marked:new Set(e.markedRefs)}}}var Fr=class{constructor(r,t){this._p=r;this.depth=t;}deserialize(r){return p$1(this._p,this.depth,r)}};function jt(e,r){if(r<0||!Number.isFinite(r)||!Number.isInteger(r))throw new O$2({t:4,i:r});if(e.refs.has(r))throw new Error("Conflicted ref id: "+r)}function Gn(e,r,t){return jt(e.base,r),e.state.marked.has(r)&&e.base.refs.set(r,t),t}function Kn(e,r,t){return jt(e.base,r),e.base.refs.set(r,t),t}function b(e,r,t){return e.mode===1?Gn(e,r,t):Kn(e,r,t)}function Br(e,r,t){if(Object.hasOwn(r,t))return r[t];throw new O$2(e)}function Hn(e,r){return b(e,r.i,St$2(D$3(r.s)))}function Jn(e,r,t){let n=t.a,a=n.length,s=b(e,t.i,new Array(a));for(let i=0,u;i<a;i++)u=n[i],u&&(s[i]=p$1(e,r,u));return Vt$1(s,t.o),s}function Zn(e){switch(e){case "constructor":case "__proto__":case "prototype":case "__defineGetter__":case "__defineSetter__":case "__lookupGetter__":case "__lookupSetter__":return  false;default:return  true}}function $n(e){switch(e){case v$2:case R:case P$2:case C$1:return  true;default:return  false}}function Bt$1(e,r,t){Zn(r)?e[r]=t:Object.defineProperty(e,r,{value:t,configurable:true,enumerable:true,writable:true});}function Xn(e,r,t,n,a){if(typeof n=="string")Bt$1(t,D$3(n),p$1(e,r,a));else {let s=p$1(e,r,n);switch(typeof s){case "string":Bt$1(t,s,p$1(e,r,a));break;case "symbol":$n(s)&&(t[s]=p$1(e,r,a));break;default:throw new O$2(n)}}}function Yt$1(e,r,t){e.base.refs.types.set(r,t);}function de$2(e,r,t,n){if(e.base.refs.types.get(t)!==n)throw new O$2(r)}function qt$1(e,r,t,n){let a=t.k;if(a.length>0)for(let i=0,u=t.v,l=a.length;i<l;i++)Xn(e,r,n,a[i],u[i]);return n}function Qn(e,r,t){let n=b(e,t.i,t.t===10?{}:Object.create(null));return qt$1(e,r,t.p,n),Vt$1(n,t.o),n}function eo(e,r){return b(e,r.i,new Date(r.s))}function ro(e,r){if(e.base.features&32){let t=D$3(r.c);if(t.length>qn)throw new O$2(r);return b(e,r.i,new RegExp(t,r.m))}throw new h$2(r)}function to(e,r,t){let n=b(e,t.i,new Set);for(let a=0,s=t.a,i=s.length;a<i;a++)n.add(p$1(e,r,s[a]));return n}function no(e,r,t){let n=b(e,t.i,new Map);for(let a=0,s=t.e.k,i=t.e.v,u=s.length;a<u;a++)n.set(p$1(e,r,s[a]),p$1(e,r,i[a]));return n}function oo(e,r){if(r.s.length>jn)throw new O$2(r);return b(e,r.i,Or(D$3(r.s)))}function ao(e,r,t){var u;let n=Ft$2(t.c),a=p$1(e,r,t.f),s=(u=t.b)!=null?u:0;if(s<0||s>a.byteLength)throw new O$2(t);return b(e,t.i,new n(a,s,t.l))}function so(e,r,t){var i;let n=p$1(e,r,t.f),a=(i=t.b)!=null?i:0;if(a<0||a>n.byteLength)throw new O$2(t);return b(e,t.i,new DataView(n,a,t.l))}function Wt(e,r,t,n){if(t.p){let a=qt$1(e,r,t.p,{});Object.defineProperties(n,Object.getOwnPropertyDescriptors(a));}return n}function io(e,r,t){let n=b(e,t.i,new AggregateError([],D$3(t.m)));return Wt(e,r,t,n)}function uo(e,r,t){let n=Br(t,st$3,t.s),a=b(e,t.i,new n(D$3(t.m)));return Wt(e,r,t,a)}function lo(e,r,t){let n=ee$2(),a=b(e,t.i,n.p),s=p$1(e,r,t.f);return t.s?n.s(s):n.f(s),a}function co(e,r,t){return b(e,t.i,Object(p$1(e,r,t.f)))}function fo(e,r,t){let n=e.base.plugins;if(n){let a=D$3(t.c);for(let s=0,i=n.length;s<i;s++){let u=n[s];if(u.tag===a)return b(e,t.i,u.deserialize(t.s,new Fr(e,r),{id:t.i}))}}throw new X$1(t.c)}function So(e,r){let t=b(e,r.i,b(e,r.s,ee$2()).p);return Yt$1(e,r.s,22),t}function mo(e,r,t){let n=e.base.refs.get(t.i);if(n)return de$2(e,t,t.i,22),n.s(p$1(e,r,t.a[1])),o$1;throw new V$2("Promise")}function po(e,r,t){let n=e.base.refs.get(t.i);if(n)return de$2(e,t,t.i,22),n.f(p$1(e,r,t.a[1])),o$1;throw new V$2("Promise")}function go(e,r,t){p$1(e,r,t.a[0]);let n=p$1(e,r,t.a[1]);return Rt$2(n)}function yo(e,r,t){p$1(e,r,t.a[0]);let n=p$1(e,r,t.a[1]);return wt$2(n)}function No(e,r,t){let n=b(e,t.i,re$1());Yt$1(e,t.i,31);let a=t.a,s=a.length;if(s)for(let i=0;i<s;i++)p$1(e,r,a[i]);return n}function bo(e,r,t){let n=e.base.refs.get(t.i);if(n)return de$2(e,t,t.i,31),n.next(p$1(e,r,t.f)),o$1;throw new V$2("Stream")}function vo(e,r,t){let n=e.base.refs.get(t.i);if(n)return de$2(e,t,t.i,31),n.throw(p$1(e,r,t.f)),o$1;throw new V$2("Stream")}function Co(e,r,t){let n=e.base.refs.get(t.i);if(n)return de$2(e,t,t.i,31),n.return(p$1(e,r,t.f)),o$1;throw new V$2("Stream")}function Ao(e,r,t){return p$1(e,r,t.f),o$1}function Eo(e,r,t){return p$1(e,r,t.a[1]),o$1}function Io(e,r,t){let n=b(e,t.i,wr([],t.s,t.l));for(let a=0,s=t.a.length;a<s;a++)n.v[a]=p$1(e,r,t.a[a]);return n}function p$1(e,r,t){if(r>e.base.depthLimit)throw new Q(e.base.depthLimit);switch(r+=1,t.t){case 2:return Br(t,at$3,t.s);case 0:return Number(t.s);case 1:return D$3(String(t.s));case 3:if(String(t.s).length>Yn)throw new O$2(t);return BigInt(t.s);case 4:return e.base.refs.get(t.i);case 18:return Hn(e,t);case 9:return Jn(e,r,t);case 10:case 11:return Qn(e,r,t);case 5:return eo(e,t);case 6:return ro(e,t);case 7:return to(e,r,t);case 8:return no(e,r,t);case 19:return oo(e,t);case 16:case 15:return ao(e,r,t);case 20:return so(e,r,t);case 14:return io(e,r,t);case 13:return uo(e,r,t);case 12:return lo(e,r,t);case 17:return Br(t,nt$2,t.s);case 21:return co(e,r,t);case 25:return fo(e,r,t);case 22:return So(e,t);case 23:return mo(e,r,t);case 24:return po(e,r,t);case 28:return go(e,r,t);case 30:return yo(e,r,t);case 31:return No(e,r,t);case 32:return bo(e,r,t);case 33:return vo(e,r,t);case 34:return Co(e,r,t);case 27:return Ao(e,r,t);case 29:return Eo(e,r,t);case 35:return Io(e,r,t);default:throw new h$2(t)}}function sr$1(e,r){try{return p$1(e,0,r)}catch(t){throw new He$1(t)}}var Ro=()=>T,Po=Ro.toString(),Gt=/=>/.test(Po);function ir(e,r){return Gt?(e.length===1?e[0]:"("+e.join(",")+")")+"=>"+(r.startsWith("{")?"("+r+")":r):"function("+e.join(",")+"){return "+r+"}"}function Kt$1(e,r){return Gt?(e.length===1?e[0]:"("+e.join(",")+")")+"=>{"+r+"}":"function("+e.join(",")+"){"+r+"}"}var Zt$1="hjkmoquxzABCDEFGHIJKLNPQRTUVWXYZ$_",Ht$1=Zt$1.length,$t$1="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$_",Jt$1=$t$1.length;function Vr(e){let r=e%Ht$1,t=Zt$1[r];for(e=(e-r)/Ht$1;e>0;)r=e%Jt$1,t+=$t$1[r],e=(e-r)/Jt$1;return t}var xo=/^[$A-Z_][0-9A-Z_$]*$/i;function Mr(e){let r=e[0];return (r==="$"||r==="_"||r>="A"&&r<="Z"||r>="a"&&r<="z")&&xo.test(e)}function ye(e){switch(e.t){case 0:return e.s+"="+e.v;case 2:return e.s+".set("+e.k+","+e.v+")";case 1:return e.s+".add("+e.v+")";case 3:return e.s+".delete("+e.k+")"}}function To(e){let r=[],t=e[0];for(let n=1,a=e.length,s,i=t;n<a;n++)s=e[n],s.t===0&&s.v===i.v?t={t:0,s:s.s,k:o$1,v:ye(t)}:s.t===2&&s.s===i.s?t={t:2,s:ye(t),k:s.k,v:s.v}:s.t===1&&s.s===i.s?t={t:1,s:ye(t),k:o$1,v:s.v}:s.t===3&&s.s===i.s?t={t:3,s:ye(t),k:s.k,v:o$1}:(r.push(t),t=s),i=s;return r.push(t),r}function on(e){if(e.length){let r="",t=To(e);for(let n=0,a=t.length;n<a;n++)r+=ye(t[n])+",";return r}return o$1}var Oo="Object.create(null)",wo="new Set",ho="new Map",zo="Promise.resolve",_o="Promise.reject",ko={3:"Object.freeze",2:"Object.seal",1:"Object.preventExtensions",0:o$1};function an(e,r){return {mode:e,plugins:r.plugins,features:r.features,marked:new Set(r.markedRefs),stack:[],flags:[],assignments:[]}}function lr(e){return {mode:2,base:an(2,e),state:e,child:o$1}}var Lr=class{constructor(r){this._p=r;}serialize(r){return f$1(this._p,r)}};function Fo(e,r){let t=e.valid.get(r);t==null&&(t=e.valid.size,e.valid.set(r,t));let n=e.vars[t];return n==null&&(n=Vr(t),e.vars[t]=n),n}function Bo(e){return le$2+"["+e+"]"}function m$1(e,r){return e.mode===1?Fo(e.state,r):Bo(r)}function w$3(e,r){e.marked.add(r);}function Ur(e,r){return e.marked.has(r)}function Yr(e,r,t){r!==0&&(w$3(e.base,t),e.base.flags.push({type:r,value:m$1(e,t)}));}function Vo(e){let r="";for(let t=0,n=e.flags,a=n.length;t<a;t++){let s=n[t];r+=ko[s.type]+"("+s.value+"),";}return r}function sn(e){let r=on(e.assignments),t=Vo(e);return r?t?r+t:r:t}function qr(e,r,t){e.assignments.push({t:0,s:r,k:o$1,v:t});}function Mo(e,r,t){e.base.assignments.push({t:1,s:m$1(e,r),k:o$1,v:t});}function ge(e,r,t,n){e.base.assignments.push({t:2,s:m$1(e,r),k:t,v:n});}function Xt$1(e,r,t){e.base.assignments.push({t:3,s:m$1(e,r),k:t,v:o$1});}function Ne$2(e,r,t,n){qr(e.base,m$1(e,r)+"["+t+"]",n);}function jr(e,r,t,n){qr(e.base,m$1(e,r)+"."+t,n);}function Lo(e,r,t,n){qr(e.base,m$1(e,r)+".v["+t+"]",n);}function F$3(e,r){return r.t===4&&e.stack.includes(r.i)}function ae$2(e,r,t){return e.mode===1&&!Ur(e.base,r)?t:m$1(e,r)+"="+t}function Uo(e){return L$3+'.get("'+e.s+'")'}function Qt$1(e,r,t,n){return t?F$3(e.base,t)?(w$3(e.base,r),Ne$2(e,r,n,m$1(e,t.i)),""):f$1(e,t):""}function jo(e,r){let t=r.i,n=r.a,a=n.length;if(a>0){e.base.stack.push(t);let s=Qt$1(e,t,n[0],0),i=s==="";for(let u=1,l;u<a;u++)l=Qt$1(e,t,n[u],u),s+=","+l,i=l==="";return e.base.stack.pop(),Yr(e,r.o,r.i),"["+s+(i?",]":"]")}return "[]"}function en(e,r,t,n){if(typeof t=="string"){let a=Number(t),s=a>=0&&a.toString()===t||Mr(t);if(F$3(e.base,n)){let i=m$1(e,n.i);return w$3(e.base,r.i),s&&a!==a?jr(e,r.i,t,i):Ne$2(e,r.i,s?t:'"'+t+'"',i),""}return (s?t:'"'+t+'"')+":"+f$1(e,n)}return "["+f$1(e,t)+"]:"+f$1(e,n)}function un(e,r,t){let n=t.k,a=n.length;if(a>0){let s=t.v;e.base.stack.push(r.i);let i=en(e,r,n[0],s[0]);for(let u=1,l=i;u<a;u++)l=en(e,r,n[u],s[u]),i+=(l&&i&&",")+l;return e.base.stack.pop(),"{"+i+"}"}return "{}"}function Yo(e,r){return Yr(e,r.o,r.i),un(e,r,r.p)}function qo(e,r,t,n){let a=un(e,r,t);return a!=="{}"?"Object.assign("+n+","+a+")":n}function Wo(e,r,t,n,a){let s=e.base,i=f$1(e,a),u=Number(n),l=u>=0&&u.toString()===n||Mr(n);if(F$3(s,a))l&&u!==u?jr(e,r.i,n,i):Ne$2(e,r.i,l?n:'"'+n+'"',i);else {let g=s.assignments;s.assignments=t,l&&u!==u?jr(e,r.i,n,i):Ne$2(e,r.i,l?n:'"'+n+'"',i),s.assignments=g;}}function Go(e,r,t,n,a){if(typeof n=="string")Wo(e,r,t,n,a);else {let s=e.base,i=s.stack;s.stack=[];let u=f$1(e,a);s.stack=i;let l=s.assignments;s.assignments=t,Ne$2(e,r.i,f$1(e,n),u),s.assignments=l;}}function Ko(e,r,t){let n=t.k,a=n.length;if(a>0){let s=[],i=t.v;e.base.stack.push(r.i);for(let u=0;u<a;u++)Go(e,r,s,n[u],i[u]);return e.base.stack.pop(),on(s)}return o$1}function Wr(e,r,t){if(r.p){let n=e.base;if(n.features&8)t=qo(e,r,r.p,t);else {w$3(n,r.i);let a=Ko(e,r,r.p);if(a)return "("+ae$2(e,r.i,t)+","+a+m$1(e,r.i)+")"}}return t}function Ho(e,r){return Yr(e,r.o,r.i),Wr(e,r,Oo)}function Jo(e){return 'new Date("'+e.s+'")'}function Zo(e,r){if(e.base.features&32)return "/"+r.c+"/"+r.m;throw new h$2(r)}function rn(e,r,t){let n=e.base;return F$3(n,t)?(w$3(n,r),Mo(e,r,m$1(e,t.i)),""):f$1(e,t)}function $o(e,r){let t=wo,n=r.a,a=n.length,s=r.i;if(a>0){e.base.stack.push(s);let i=rn(e,s,n[0]);for(let u=1,l=i;u<a;u++)l=rn(e,s,n[u]),i+=(l&&i&&",")+l;e.base.stack.pop(),i&&(t+="(["+i+"])");}return t}function tn(e,r,t,n,a){let s=e.base;if(F$3(s,t)){let i=m$1(e,t.i);if(w$3(s,r),F$3(s,n)){let l=m$1(e,n.i);return ge(e,r,i,l),""}if(n.t!==4&&n.i!=null&&Ur(s,n.i)){let l="("+f$1(e,n)+",["+a+","+a+"])";return ge(e,r,i,m$1(e,n.i)),Xt$1(e,r,a),l}let u=s.stack;return s.stack=[],ge(e,r,i,f$1(e,n)),s.stack=u,""}if(F$3(s,n)){let i=m$1(e,n.i);if(w$3(s,r),t.t!==4&&t.i!=null&&Ur(s,t.i)){let l="("+f$1(e,t)+",["+a+","+a+"])";return ge(e,r,m$1(e,t.i),i),Xt$1(e,r,a),l}let u=s.stack;return s.stack=[],ge(e,r,f$1(e,t),i),s.stack=u,""}return "["+f$1(e,t)+","+f$1(e,n)+"]"}function Xo(e,r){let t=ho,n=r.e.k,a=n.length,s=r.i,i=r.f,u=m$1(e,i.i),l=e.base;if(a>0){let g=r.e.v;l.stack.push(s);let S=tn(e,s,n[0],g[0],u);for(let d=1,G=S;d<a;d++)G=tn(e,s,n[d],g[d],u),S+=(G&&S&&",")+G;l.stack.pop(),S&&(t+="(["+S+"])");}return i.t===26&&(w$3(l,i.i),t="("+f$1(e,i)+","+t+")"),t}function Qo(e,r){return q$3(e,r.f)+'("'+r.s+'")'}function ea(e,r){return "new "+r.c+"("+f$1(e,r.f)+","+r.b+","+r.l+")"}function ra(e,r){return "new DataView("+f$1(e,r.f)+","+r.b+","+r.l+")"}function ta(e,r){let t=r.i;e.base.stack.push(t);let n=Wr(e,r,'new AggregateError([],"'+r.m+'")');return e.base.stack.pop(),n}function na(e,r){return Wr(e,r,"new "+Ce[r.s]+'("'+r.m+'")')}function oa(e,r){let t,n=r.f,a=r.i,s=r.s?zo:_o,i=e.base;if(F$3(i,n)){let u=m$1(e,n.i);t=s+(r.s?"().then("+ir([],u)+")":"().catch("+Kt$1([],"throw "+u)+")");}else {i.stack.push(a);let u=f$1(e,n);i.stack.pop(),t=s+"("+u+")";}return t}function aa(e,r){return "Object("+f$1(e,r.f)+")"}function q$3(e,r){let t=f$1(e,r);return r.t===4?t:"("+t+")"}function sa(e,r){if(e.mode===1)throw new h$2(r);return "("+ae$2(e,r.s,q$3(e,r.f)+"()")+").p"}function ia(e,r){if(e.mode===1)throw new h$2(r);return q$3(e,r.a[0])+"("+m$1(e,r.i)+","+f$1(e,r.a[1])+")"}function ua(e,r){if(e.mode===1)throw new h$2(r);return q$3(e,r.a[0])+"("+m$1(e,r.i)+","+f$1(e,r.a[1])+")"}function la(e,r){let t=e.base.plugins;if(t)for(let n=0,a=t.length;n<a;n++){let s=t[n];if(s.tag===r.c)return e.child==null&&(e.child=new Lr(e)),s.serialize(r.s,e.child,{id:r.i})}throw new X$1(r.c)}function ca(e,r){let t="",n=false;return r.f.t!==4&&(w$3(e.base,r.f.i),t="("+f$1(e,r.f)+",",n=true),t+=ae$2(e,r.i,"("+At$1+")("+m$1(e,r.f.i)+")"),n&&(t+=")"),t}function fa(e,r){return q$3(e,r.a[0])+"("+f$1(e,r.a[1])+")"}function Sa(e,r){let t=r.a[0],n=r.a[1],a=e.base,s="";t.t!==4&&(w$3(a,t.i),s+="("+f$1(e,t)),n.t!==4&&(w$3(a,n.i),s+=(s?",":"(")+f$1(e,n)),s&&(s+=",");let i=ae$2(e,r.i,"("+Et$1+")("+m$1(e,n.i)+","+m$1(e,t.i)+")");return s?s+i+")":i}function ma(e,r){return q$3(e,r.a[0])+"("+f$1(e,r.a[1])+")"}function pa(e,r){let t=ae$2(e,r.i,q$3(e,r.f)+"()"),n=r.a.length;if(n){let a=f$1(e,r.a[0]);for(let s=1;s<n;s++)a+=","+f$1(e,r.a[s]);return "("+t+","+a+","+m$1(e,r.i)+")"}return t}function da(e,r){return m$1(e,r.i)+".next("+f$1(e,r.f)+")"}function ga(e,r){return m$1(e,r.i)+".throw("+f$1(e,r.f)+")"}function ya(e,r){return m$1(e,r.i)+".return("+f$1(e,r.f)+")"}function nn(e,r,t,n){let a=e.base;return F$3(a,n)?(w$3(a,r),Lo(e,r,t,m$1(e,n.i)),""):f$1(e,n)}function Na(e,r){let t=r.a,n=t.length,a=r.i;if(n>0){e.base.stack.push(a);let s=nn(e,a,0,t[0]);for(let i=1,u=s;i<n;i++)u=nn(e,a,i,t[i]),s+=(u&&s&&",")+u;if(e.base.stack.pop(),s)return "{__SEROVAL_SEQUENCE__:!0,v:["+s+"],t:"+r.s+",d:"+r.l+"}"}return "{__SEROVAL_SEQUENCE__:!0,v:[],t:-1,d:0}"}function ba(e,r){switch(r.t){case 17:return tt$1[r.s];case 18:return Uo(r);case 9:return jo(e,r);case 10:return Yo(e,r);case 11:return Ho(e,r);case 5:return Jo(r);case 6:return Zo(e,r);case 7:return $o(e,r);case 8:return Xo(e,r);case 19:return Qo(e,r);case 16:case 15:return ea(e,r);case 20:return ra(e,r);case 14:return ta(e,r);case 13:return na(e,r);case 12:return oa(e,r);case 21:return aa(e,r);case 22:return sa(e,r);case 25:return la(e,r);case 26:return Ot$1[r.s];case 35:return Na(e,r);default:throw new h$2(r)}}function f$1(e,r){switch(r.t){case 2:return ot$2[r.s];case 0:return ""+r.s;case 1:return '"'+r.s+'"';case 3:return r.s+"n";case 4:return m$1(e,r.i);case 23:return ia(e,r);case 24:return ua(e,r);case 27:return ca(e,r);case 28:return fa(e,r);case 29:return Sa(e,r);case 30:return ma(e,r);case 31:return pa(e,r);case 32:return da(e,r);case 33:return ga(e,r);case 34:return ya(e,r);default:return ae$2(e,r.i,ba(e,r))}}function fr(e,r){let t=f$1(e,r),n=r.i;if(n==null)return t;let a=sn(e.base),s=m$1(e,n),i=e.state.scopeId,u=i==null?"":le$2,l=a?"("+t+","+a+s+")":t;if(u==="")return r.t===10&&!a?"("+l+")":l;let g=i==null?"()":"("+le$2+'["'+y$2(i)+'"])';return "("+ir([u],l)+")"+g}var Kr=class{constructor(r,t){this._p=r;this.depth=t;}parse(r){return E$2(this._p,this.depth,r)}},Hr=class{constructor(r,t){this._p=r;this.depth=t;}parse(r){return E$2(this._p,this.depth,r)}parseWithError(r){return W$3(this._p,this.depth,r)}isAlive(){return this._p.state.alive}pushPendingState(){Qr(this._p);}popPendingState(){be(this._p);}onParse(r){se$2(this._p,r);}onError(r){$r(this._p,r);}};function va(e){return {alive:true,pending:0,initial:true,buffer:[],onParse:e.onParse,onError:e.onError,onDone:e.onDone}}function Jr(e){return {type:2,base:me(2,e),state:va(e)}}function Ca(e,r,t){let n=[];for(let a=0,s=t.length;a<s;a++)a in t?n[a]=E$2(e,r,t[a]):n[a]=0;return n}function Aa(e,r,t,n){return _e$2(t,n,Ca(e,r,n))}function Zr(e,r,t){let n=Object.entries(t),a=[],s=[];for(let i=0,u=n.length;i<u;i++)a.push(y$2(n[i][0])),s.push(E$2(e,r,n[i][1]));return C$1 in t&&(a.push(I$2(e.base,C$1)),s.push(Ue$1(rr$1(e.base),E$2(e,r,$e(t))))),v$2 in t&&(a.push(I$2(e.base,v$2)),s.push(je$2(tr$1(e.base),E$2(e,r,e.type===1?re$1():Qe$2(t))))),P$2 in t&&(a.push(I$2(e.base,P$2)),s.push($$1(t[P$2]))),R in t&&(a.push(I$2(e.base,R)),s.push(t[R]?H$2:J$2)),{k:a,v:s}}function Gr(e,r,t,n,a){return nr$1(t,n,a,Zr(e,r,n))}function Ea(e,r,t,n){return ke$1(t,E$2(e,r,n.valueOf()))}function Ia(e,r,t,n){return De$2(t,n,E$2(e,r,n.buffer))}function Ra(e,r,t,n){return Fe$1(t,n,E$2(e,r,n.buffer))}function Pa(e,r,t,n){return Be$2(t,n,E$2(e,r,n.buffer))}function ln(e,r,t,n){let a=Z$1(n,e.base.features);return Ve$2(t,n,a?Zr(e,r,a):o$1)}function xa(e,r,t,n){let a=Z$1(n,e.base.features);return Me$2(t,n,a?Zr(e,r,a):o$1)}function Ta(e,r,t,n){let a=[],s=[];for(let[i,u]of n.entries())a.push(E$2(e,r,i)),s.push(E$2(e,r,u));return or$1(e.base,t,a,s)}function Oa(e,r,t,n){let a=[];for(let s of n.keys())a.push(E$2(e,r,s));return Le$1(t,a)}function wa(e,r,t,n){let a=Ye$2(t,k$2(e.base,4),[]);return e.type===1||(Qr(e),n.on({next:s=>{if(e.state.alive){let i=W$3(e,r,s);i&&se$2(e,qe$1(t,i));}},throw:s=>{if(e.state.alive){let i=W$3(e,r,s);i&&se$2(e,We$2(t,i));}be(e);},return:s=>{if(e.state.alive){let i=W$3(e,r,s);i&&se$2(e,Ge$2(t,i));}be(e);}})),a}function ha(e,r,t){if(this.state.alive){let n=W$3(this,r,t);n&&se$2(this,c$1(23,e,o$1,o$1,o$1,o$1,o$1,[k$2(this.base,2),n],o$1,o$1,o$1,o$1)),be(this);}}function za(e,r,t){if(this.state.alive){let n=W$3(this,r,t);n&&se$2(this,c$1(24,e,o$1,o$1,o$1,o$1,o$1,[k$2(this.base,3),n],o$1,o$1,o$1,o$1));}be(this);}function _a(e,r,t,n){let a=zr(e.base,{});return e.type===2&&(Qr(e),n.then(ha.bind(e,a,r),za.bind(e,a,r))),zt(e.base,t,a)}function ka(e,r,t,n,a){for(let s=0,i=a.length;s<i;s++){let u=a[s];if(u.parse.sync&&u.test(n))return ce$1(t,u.tag,u.parse.sync(n,new Kr(e,r),{id:t}))}return o$1}function Da(e,r,t,n,a){for(let s=0,i=a.length;s<i;s++){let u=a[s];if(u.parse.stream&&u.test(n))return ce$1(t,u.tag,u.parse.stream(n,new Hr(e,r),{id:t}))}return o$1}function cn(e,r,t,n){let a=e.base.plugins;return a?e.type===1?ka(e,r,t,n,a):Da(e,r,t,n,a):o$1}function Fa(e,r,t,n){let a=[];for(let s=0,i=n.v.length;s<i;s++)a[s]=E$2(e,r,n.v[s]);return Ke$2(t,a,n.t,n.d)}function Ba(e,r,t,n,a){switch(a){case Object:return Gr(e,r,t,n,false);case o$1:return Gr(e,r,t,n,true);case Date:return he(t,n);case Error:case EvalError:case RangeError:case ReferenceError:case SyntaxError:case TypeError:case URIError:return ln(e,r,t,n);case Number:case Boolean:case String:case BigInt:return Ea(e,r,t,n);case ArrayBuffer:return ar(e.base,t,n);case Int8Array:case Int16Array:case Int32Array:case Uint8Array:case Uint16Array:case Uint32Array:case Uint8ClampedArray:case Float32Array:case Float64Array:return Ia(e,r,t,n);case DataView:return Pa(e,r,t,n);case Map:return Ta(e,r,t,n);case Set:return Oa(e,r,t,n);}if(a===Promise||n instanceof Promise)return _a(e,r,t,n);let s=e.base.features;if(s&32&&a===RegExp)return ze$2(t,n);if(s&16)switch(a){case BigInt64Array:case BigUint64Array:return Ra(e,r,t,n);}if(s&1&&typeof AggregateError!="undefined"&&(a===AggregateError||n instanceof AggregateError))return xa(e,r,t,n);if(n instanceof Error)return ln(e,r,t,n);if(C$1 in n||v$2 in n)return Gr(e,r,t,n,!!a);throw new x$1(n)}function Va(e,r,t,n){if(Array.isArray(n))return Aa(e,r,t,n);if(Xe$2(n))return wa(e,r,t,n);if(Ze$2(n))return Fa(e,r,t,n);let a=n.constructor;if(a===j$1)return E$2(e,r,n.replacement);let s=cn(e,r,t,n);return s||Ba(e,r,t,n,a)}function Ma(e,r,t){let n=Y$1(e.base,t);if(n.type!==0)return n.value;let a=cn(e,r,n.value,t);if(a)return a;throw new x$1(t)}function E$2(e,r,t){if(r>=e.base.depthLimit)throw new Q(e.base.depthLimit);switch(typeof t){case "boolean":return t?H$2:J$2;case "undefined":return Ae;case "string":return $$1(t);case "number":return Oe(t);case "bigint":return we(t);case "object":{if(t){let n=Y$1(e.base,t);return n.type===0?Va(e,r+1,n.value,t):n.value}return Ee}case "symbol":return I$2(e.base,t);case "function":return Ma(e,r,t);default:throw new x$1(t)}}function se$2(e,r){e.state.initial?e.state.buffer.push(r):Xr(e,r,false);}function $r(e,r){if(e.state.onError)e.state.onError(r);else throw r instanceof z$1?r:new z$1(r)}function fn(e){e.state.onDone&&e.state.onDone();}function Xr(e,r,t){try{e.state.onParse(r,t);}catch(n){$r(e,n);}}function Qr(e){e.state.pending++;}function be(e){--e.state.pending<=0&&fn(e);}function W$3(e,r,t){try{return E$2(e,r,t)}catch(n){return $r(e,n),o$1}}function et$1(e,r){let t=W$3(e,0,r);t&&(Xr(e,t,true),e.state.initial=false,La(e,e.state),e.state.pending<=0&&Sr(e));}function La(e,r){for(let t=0,n=r.buffer.length;t<n;t++)Xr(e,r.buffer[t],false);}function Sr(e){e.state.alive&&(fn(e),e.state.alive=false);}function Sn(e,r){let t=A$2(r.plugins),n=Jr({plugins:t,refs:r.refs,disabledFeatures:r.disabledFeatures,onParse(a,s){let i=lr({plugins:t,features:n.base.features,scopeId:r.scopeId,markedRefs:n.base.marked}),u;try{u=fr(i,a);}catch(l){r.onError&&r.onError(l);return}r.onSerialize(u,s);},onError:r.onError,onDone:r.onDone});return et$1(n,e),Sr.bind(null,n)}function iu(e,r){let t=A$2(r.plugins),n=Jr({plugins:t,refs:r.refs,disabledFeatures:r.disabledFeatures,depthLimit:r.depthLimit,onParse:r.onParse,onError:r.onError,onDone:r.onDone});return et$1(n,e),Sr.bind(null,n)}var mr$1=class mr{constructor(r){this.options=r;this.alive=true;this.flushed=false;this.done=false;this.pending=0;this.cleanups=[];this.refs=new Map;this.keys=new Set;this.ids=0;this.plugins=A$2(r.plugins);}write(r,t){this.alive&&!this.flushed&&(this.pending++,this.keys.add(r),this.cleanups.push(Sn(t,{plugins:this.plugins,scopeId:this.options.scopeId,refs:this.refs,disabledFeatures:this.options.disabledFeatures,onError:this.options.onError,onSerialize:(n,a)=>{this.alive&&this.options.onData(a?this.options.globalIdentifier+'["'+y$2(r)+'"]='+n:n);},onDone:()=>{this.alive&&(this.pending--,this.pending<=0&&this.flushed&&!this.done&&this.options.onDone&&(this.options.onDone(),this.done=true));}})));}getNextID(){for(;this.keys.has(""+this.ids);)this.ids++;return ""+this.ids}push(r){let t=this.getNextID();return this.write(t,r),t}flush(){this.alive&&(this.flushed=true,this.pending<=0&&!this.done&&this.options.onDone&&(this.options.onDone(),this.done=true));}close(){if(this.alive){for(let r=0,t=this.cleanups.length;r<t;r++)this.cleanups[r]();!this.done&&this.options.onDone&&(this.options.onDone(),this.done=true),this.alive=false;}}};function Pu(e,r={}){var i;let t=A$2(r.plugins),n=r.disabledFeatures||0,a=(i=e.f)!=null?i:63,s=Lt$2({plugins:t,markedRefs:e.m,features:a&~n,disabledFeatures:n});return sr$1(s,e.t)}

var u$1=e=>{let r=new AbortController,a=r.abort.bind(r);return e.then(a,a),r};function E$1(e){e(this.reason);}function D$2(e){this.addEventListener("abort",E$1.bind(this,e),{once:true});}function c(e){return new Promise(D$2.bind(e))}var i={},F$2=ai({tag:"seroval-plugins/web/AbortControllerFactoryPlugin",test(e){return e===i},parse:{sync(){return i},async async(){return await Promise.resolve(i)},stream(){return i}},serialize(){return u$1.toString()},deserialize(){return u$1}}),A$1=ai({tag:"seroval-plugins/web/AbortSignal",extends:[F$2],test(e){return typeof AbortSignal=="undefined"?false:e instanceof AbortSignal},parse:{sync(e,r){return e.aborted?{reason:r.parse(e.reason)}:{}},async async(e,r){if(e.aborted)return {reason:await r.parse(e.reason)};let a=await c(e);return {reason:await r.parse(a)}},stream(e,r){if(e.aborted)return {reason:r.parse(e.reason)};let a=c(e);return {factory:r.parse(i),controller:r.parse(a)}}},serialize(e,r){return e.reason?"AbortSignal.abort("+r.serialize(e.reason)+")":e.controller&&e.factory?"("+r.serialize(e.factory)+")("+r.serialize(e.controller)+").signal":"(new AbortController).signal"},deserialize(e,r){return e.reason?AbortSignal.abort(r.deserialize(e.reason)):e.controller?u$1(r.deserialize(e.controller)).signal:new AbortController().signal}}),O$1=A$1;function d(e){return {detail:e.detail,bubbles:e.bubbles,cancelable:e.cancelable,composed:e.composed}}var U$3=ai({tag:"seroval-plugins/web/CustomEvent",test(e){return typeof CustomEvent=="undefined"?false:e instanceof CustomEvent},parse:{sync(e,r){return {type:r.parse(e.type),options:r.parse(d(e))}},async async(e,r){return {type:await r.parse(e.type),options:await r.parse(d(e))}},stream(e,r){return {type:r.parse(e.type),options:r.parse(d(e))}}},serialize(e,r){return "new CustomEvent("+r.serialize(e.type)+","+r.serialize(e.options)+")"},deserialize(e,r){return new CustomEvent(r.deserialize(e.type),r.deserialize(e.options))}}),L$2=U$3;var _$2=ai({tag:"seroval-plugins/web/DOMException",test(e){return typeof DOMException=="undefined"?false:e instanceof DOMException},parse:{sync(e,r){return {name:r.parse(e.name),message:r.parse(e.message)}},async async(e,r){return {name:await r.parse(e.name),message:await r.parse(e.message)}},stream(e,r){return {name:r.parse(e.name),message:r.parse(e.message)}}},serialize(e,r){return "new DOMException("+r.serialize(e.message)+","+r.serialize(e.name)+")"},deserialize(e,r){return new DOMException(r.deserialize(e.message),r.deserialize(e.name))}}),q$2=_$2;function f(e){return {bubbles:e.bubbles,cancelable:e.cancelable,composed:e.composed}}var k$1=ai({tag:"seroval-plugins/web/Event",test(e){return typeof Event=="undefined"?false:e instanceof Event},parse:{sync(e,r){return {type:r.parse(e.type),options:r.parse(f(e))}},async async(e,r){return {type:await r.parse(e.type),options:await r.parse(f(e))}},stream(e,r){return {type:r.parse(e.type),options:r.parse(f(e))}}},serialize(e,r){return "new Event("+r.serialize(e.type)+","+r.serialize(e.options)+")"},deserialize(e,r){return new Event(r.deserialize(e.type),r.deserialize(e.options))}}),Y=k$1;var V$1=ai({tag:"seroval-plugins/web/File",test(e){return typeof File=="undefined"?false:e instanceof File},parse:{async async(e,r){return {name:await r.parse(e.name),options:await r.parse({type:e.type,lastModified:e.lastModified}),buffer:await r.parse(await e.arrayBuffer())}}},serialize(e,r){return "new File(["+r.serialize(e.buffer)+"],"+r.serialize(e.name)+","+r.serialize(e.options)+")"},deserialize(e,r){return new File([r.deserialize(e.buffer)],r.deserialize(e.name),r.deserialize(e.options))}}),m=V$1;function y$1(e){let r=[];return e.forEach((a,t)=>{r.push([t,a]);}),r}var o={},v$1=(e,r=new FormData,a=0,t=e.length,s)=>{for(;a<t;a++)s=e[a],r.append(s[0],s[1]);return r},G$1=ai({tag:"seroval-plugins/web/FormDataFactory",test(e){return e===o},parse:{sync(){return o},async async(){return await Promise.resolve(o)},stream(){return o}},serialize(){return v$1.toString()},deserialize(){return o}}),J$1=ai({tag:"seroval-plugins/web/FormData",extends:[m,G$1],test(e){return typeof FormData=="undefined"?false:e instanceof FormData},parse:{sync(e,r){return {factory:r.parse(o),entries:r.parse(y$1(e))}},async async(e,r){return {factory:await r.parse(o),entries:await r.parse(y$1(e))}},stream(e,r){return {factory:r.parse(o),entries:r.parse(y$1(e))}}},serialize(e,r){return "("+r.serialize(e.factory)+")("+r.serialize(e.entries)+")"},deserialize(e,r){return v$1(r.deserialize(e.entries))}}),K$1=J$1;function g$1(e){let r=[];return e.forEach((a,t)=>{r.push([t,a]);}),r}var W$2=ai({tag:"seroval-plugins/web/Headers",test(e){return typeof Headers=="undefined"?false:e instanceof Headers},parse:{sync(e,r){return {value:r.parse(g$1(e))}},async async(e,r){return {value:await r.parse(g$1(e))}},stream(e,r){return {value:r.parse(g$1(e))}}},serialize(e,r){return "new Headers("+r.serialize(e.value)+")"},deserialize(e,r){return new Headers(r.deserialize(e.value))}}),l=W$2;var n={},P$1=e=>new ReadableStream({start:r=>{e.on({next:a=>{try{r.enqueue(a);}catch(t){}},throw:a=>{r.error(a);},return:()=>{try{r.close();}catch(a){}}});}}),x=ai({tag:"seroval-plugins/web/ReadableStreamFactory",test(e){return e===n},parse:{sync(){return n},async async(){return await Promise.resolve(n)},stream(){return n}},serialize(){return P$1.toString()},deserialize(){return n}});function w$2(e){let r=re$1(),a=e.getReader();async function t(){try{let s=await a.read();s.done?r.return(s.value):(r.next(s.value),await t());}catch(s){r.throw(s);}}return t().catch(()=>{}),r}var ee$1=ai({tag:"seroval/plugins/web/ReadableStream",extends:[x],test(e){return typeof ReadableStream=="undefined"?false:e instanceof ReadableStream},parse:{sync(e,r){return {factory:r.parse(n),stream:r.parse(re$1())}},async async(e,r){return {factory:await r.parse(n),stream:await r.parse(w$2(e))}},stream(e,r){return {factory:r.parse(n),stream:r.parse(w$2(e))}}},serialize(e,r){return "("+r.serialize(e.factory)+")("+r.serialize(e.stream)+")"},deserialize(e,r){let a=r.deserialize(e.stream);return P$1(a)}}),p=ee$1;function N$1(e,r){return {body:r,cache:e.cache,credentials:e.credentials,headers:e.headers,integrity:e.integrity,keepalive:e.keepalive,method:e.method,mode:e.mode,redirect:e.redirect,referrer:e.referrer,referrerPolicy:e.referrerPolicy}}var ae$1=ai({tag:"seroval-plugins/web/Request",extends:[p,l],test(e){return typeof Request=="undefined"?false:e instanceof Request},parse:{async async(e,r){return {url:await r.parse(e.url),options:await r.parse(N$1(e,e.body&&!e.bodyUsed?await e.clone().arrayBuffer():null))}},stream(e,r){return {url:r.parse(e.url),options:r.parse(N$1(e,e.body&&!e.bodyUsed?e.clone().body:null))}}},serialize(e,r){return "new Request("+r.serialize(e.url)+","+r.serialize(e.options)+")"},deserialize(e,r){return new Request(r.deserialize(e.url),r.deserialize(e.options))}}),te$1=ae$1;function h$1(e){return {headers:e.headers,status:e.status,statusText:e.statusText}}var oe=ai({tag:"seroval-plugins/web/Response",extends:[p,l],test(e){return typeof Response=="undefined"?false:e instanceof Response},parse:{async async(e,r){return {body:await r.parse(e.body&&!e.bodyUsed?await e.clone().arrayBuffer():null),options:await r.parse(h$1(e))}},stream(e,r){return {body:r.parse(e.body&&!e.bodyUsed?e.clone().body:null),options:r.parse(h$1(e))}}},serialize(e,r){return "new Response("+r.serialize(e.body)+","+r.serialize(e.options)+")"},deserialize(e,r){return new Response(r.deserialize(e.body),r.deserialize(e.options))}}),ne$1=oe;var le$1=ai({tag:"seroval-plugins/web/URL",test(e){return typeof URL=="undefined"?false:e instanceof URL},parse:{sync(e,r){return {value:r.parse(e.href)}},async async(e,r){return {value:await r.parse(e.href)}},stream(e,r){return {value:r.parse(e.href)}}},serialize(e,r){return "new URL("+r.serialize(e.value)+")"},deserialize(e,r){return new URL(r.deserialize(e.value))}}),pe=le$1;var de$1=ai({tag:"seroval-plugins/web/URLSearchParams",test(e){return typeof URLSearchParams=="undefined"?false:e instanceof URLSearchParams},parse:{sync(e,r){return {value:r.parse(e.toString())}},async async(e,r){return {value:await r.parse(e.toString())}},stream(e,r){return {value:r.parse(e.toString())}}},serialize(e,r){return "new URLSearchParams("+r.serialize(e.value)+")"},deserialize(e,r){return new URLSearchParams(r.deserialize(e.value))}}),fe$1=de$1;

const booleans = ["allowfullscreen", "async", "alpha",
"autofocus",
"autoplay", "checked", "controls", "default", "disabled", "formnovalidate", "hidden",
"indeterminate", "inert",
"ismap", "loop", "multiple", "muted", "nomodule", "novalidate", "open", "playsinline", "readonly", "required", "reversed", "seamless",
"selected", "adauctionheaders",
"browsingtopics",
"credentialless",
"defaultchecked", "defaultmuted", "defaultselected", "defer", "disablepictureinpicture", "disableremoteplayback", "preservespitch",
"shadowrootclonable", "shadowrootcustomelementregistry",
"shadowrootdelegatesfocus", "shadowrootserializable",
"sharedstoragewritable"
];
const BooleanAttributes = /*#__PURE__*/new Set(booleans);
const ChildProperties = /*#__PURE__*/new Set(["innerHTML", "textContent", "innerText", "children"]);
const Aliases = /*#__PURE__*/Object.assign(Object.create(null), {
  className: "class",
  htmlFor: "for"
});

const ES2017FLAG = M$1.AggregateError
| M$1.BigIntTypedArray;
const GLOBAL_IDENTIFIER = '_$HY.r';
function createSerializer({
  onData,
  onDone,
  scopeId,
  onError,
  plugins: customPlugins
}) {
  const defaultPlugins = [O$1,
  L$2, q$2, Y,
  K$1, l, p, te$1, ne$1, fe$1, pe];
  const allPlugins = customPlugins ? [...customPlugins, ...defaultPlugins] : defaultPlugins;
  return new mr$1({
    scopeId,
    plugins: allPlugins,
    globalIdentifier: GLOBAL_IDENTIFIER,
    disabledFeatures: ES2017FLAG,
    onData,
    onDone,
    onError
  });
}
function getLocalHeaderScript(id) {
  return dn(id) + ';';
}

const VOID_ELEMENTS = /^(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr)$/i;
const REPLACE_SCRIPT = `function $df(e,n,o,t){if(n=document.getElementById(e),o=document.getElementById("pl-"+e)){for(;o&&8!==o.nodeType&&o.nodeValue!=="pl-"+e;)t=o.nextSibling,o.remove(),o=t;_$HY.done?o.remove():o.replaceWith(n.content)}n.remove(),_$HY.fe(e)}`;
function renderToString(code, options = {}) {
  const {
    renderId
  } = options;
  let scripts = "";
  const serializer = createSerializer({
    scopeId: renderId,
    plugins: options.plugins,
    onData(script) {
      if (!scripts) {
        scripts = getLocalHeaderScript(renderId);
      }
      scripts += script + ";";
    },
    onError: options.onError
  });
  sharedConfig.context = {
    id: renderId || "",
    count: 0,
    suspense: {},
    lazy: {},
    assets: [],
    nonce: options.nonce,
    serialize(id, p) {
      !sharedConfig.context.noHydrate && serializer.write(id, p);
    },
    roots: 0,
    nextRoot() {
      return this.renderId + "i-" + this.roots++;
    }
  };
  let html = createRoot(d => {
    setTimeout(d);
    return resolveSSRNode(escape(code()));
  });
  sharedConfig.context.noHydrate = true;
  serializer.close();
  html = injectAssets(sharedConfig.context.assets, html);
  if (scripts.length) html = injectScripts(html, scripts, options.nonce);
  return html;
}
function renderToStream(code, options = {}) {
  let {
    nonce,
    onCompleteShell,
    onCompleteAll,
    renderId,
    noScripts
  } = options;
  let dispose;
  const blockingPromises = [];
  const pushTask = task => {
    if (noScripts) return;
    if (!tasks && !firstFlushed) {
      tasks = getLocalHeaderScript(renderId);
    }
    tasks += task + ";";
    if (!timer && firstFlushed) {
      timer = setTimeout(writeTasks);
    }
  };
  const onDone = () => {
    writeTasks();
    doShell();
    onCompleteAll && onCompleteAll({
      write(v) {
        !completed && buffer.write(v);
      }
    });
    writable && writable.end();
    completed = true;
    if (firstFlushed) dispose();
  };
  const serializer = createSerializer({
    scopeId: options.renderId,
    plugins: options.plugins,
    onData: pushTask,
    onDone,
    onError: options.onError
  });
  const flushEnd = () => {
    if (!registry.size) {
      queue(() => queue(() => serializer.flush()));
    }
  };
  const registry = new Map();
  const writeTasks = () => {
    if (tasks.length && !completed && firstFlushed) {
      buffer.write(`<script${nonce ? ` nonce="${nonce}"` : ""}>${tasks}</script>`);
      tasks = "";
    }
    timer && clearTimeout(timer);
    timer = null;
  };
  let context;
  let writable;
  let tmp = "";
  let tasks = "";
  let firstFlushed = false;
  let completed = false;
  let shellCompleted = false;
  let scriptFlushed = false;
  let timer = null;
  let buffer = {
    write(payload) {
      tmp += payload;
    }
  };
  sharedConfig.context = context = {
    id: renderId || "",
    count: 0,
    async: true,
    resources: {},
    lazy: {},
    suspense: {},
    assets: [],
    nonce,
    block(p) {
      if (!firstFlushed) blockingPromises.push(p);
    },
    replace(id, payloadFn) {
      if (firstFlushed) return;
      const placeholder = `<!--!$${id}-->`;
      const first = html.indexOf(placeholder);
      if (first === -1) return;
      const last = html.indexOf(`<!--!$/${id}-->`, first + placeholder.length);
      html = html.slice(0, first) + resolveSSRNode(escape(payloadFn())) + html.slice(last + placeholder.length + 1);
    },
    serialize(id, p, wait) {
      const serverOnly = sharedConfig.context.noHydrate;
      if (!firstFlushed && wait && typeof p === "object" && "then" in p) {
        blockingPromises.push(p);
        !serverOnly && p.then(d => {
          serializer.write(id, d);
        }).catch(e => {
          serializer.write(id, e);
        });
      } else if (!serverOnly) serializer.write(id, p);
    },
    roots: 0,
    nextRoot() {
      return this.renderId + "i-" + this.roots++;
    },
    registerFragment(key) {
      if (!registry.has(key)) {
        let resolve, reject;
        const p = new Promise((r, rej) => (resolve = r, reject = rej));
        registry.set(key, err => queue(() => queue(() => {
          err ? reject(err) : resolve(true);
          queue(flushEnd);
        })));
        serializer.write(key, p);
      }
      return (value, error) => {
        if (registry.has(key)) {
          const resolve = registry.get(key);
          registry.delete(key);
          if (waitForFragments(registry, key)) {
            resolve();
            return;
          }
          if (!completed) {
            if (!firstFlushed) {
              queue(() => html = replacePlaceholder(html, key, value !== undefined ? value : ""));
              resolve(error);
            } else {
              buffer.write(`<template id="${key}">${value !== undefined ? value : " "}</template>`);
              pushTask(`$df("${key}")${!scriptFlushed ? ";" + REPLACE_SCRIPT : ""}`);
              resolve(error);
              scriptFlushed = true;
            }
          }
        }
        return firstFlushed;
      };
    }
  };
  let html = createRoot(d => {
    dispose = d;
    return resolveSSRNode(escape(code()));
  });
  function doShell() {
    if (shellCompleted) return;
    sharedConfig.context = context;
    context.noHydrate = true;
    html = injectAssets(context.assets, html);
    if (tasks.length) html = injectScripts(html, tasks, nonce);
    buffer.write(html);
    tasks = "";
    onCompleteShell && onCompleteShell({
      write(v) {
        !completed && buffer.write(v);
      }
    });
    shellCompleted = true;
  }
  return {
    then(fn) {
      function complete() {
        dispose();
        fn(tmp);
      }
      if (onCompleteAll) {
        let ogComplete = onCompleteAll;
        onCompleteAll = options => {
          ogComplete(options);
          complete();
        };
      } else onCompleteAll = complete;
      queue(flushEnd);
    },
    pipe(w) {
      allSettled(blockingPromises).then(() => {
        setTimeout(() => {
          doShell();
          buffer = writable = w;
          buffer.write(tmp);
          firstFlushed = true;
          if (completed) {
            dispose();
            writable.end();
          } else flushEnd();
        });
      });
    },
    pipeTo(w) {
      return allSettled(blockingPromises).then(() => {
        let resolve;
        const p = new Promise(r => resolve = r);
        setTimeout(() => {
          doShell();
          const encoder = new TextEncoder();
          const writer = w.getWriter();
          writable = {
            end() {
              writer.releaseLock();
              w.close().catch(() => {});
              resolve();
            }
          };
          buffer = {
            write(payload) {
              writer.write(encoder.encode(payload)).catch(() => {});
            }
          };
          buffer.write(tmp);
          firstFlushed = true;
          if (completed) {
            dispose();
            writable.end();
          } else flushEnd();
        });
        return p;
      });
    }
  };
}
function HydrationScript(props) {
  const {
    nonce
  } = sharedConfig.context;
  return ssr(generateHydrationScript({
    nonce,
    ...props
  }));
}
function ssr(t, ...nodes) {
  if (nodes.length) {
    let result = "";
    for (let i = 0; i < nodes.length; i++) {
      result += t[i];
      const node = nodes[i];
      if (node !== undefined) result += resolveSSRNode(node);
    }
    t = result + t[nodes.length];
  }
  return {
    t
  };
}
function ssrClassList(value) {
  if (!value) return "";
  let classKeys = Object.keys(value),
    result = "";
  for (let i = 0, len = classKeys.length; i < len; i++) {
    const key = classKeys[i],
      classValue = !!value[key];
    if (!key || key === "undefined" || !classValue) continue;
    i && (result += " ");
    result += escape(key);
  }
  return result;
}
function ssrStyle(value) {
  if (!value) return "";
  if (typeof value === "string") return escape(value, true);
  let result = "";
  const k = Object.keys(value);
  for (let i = 0; i < k.length; i++) {
    const s = k[i];
    const v = value[s];
    if (v != undefined) {
      if (i) result += ";";
      const r = escape(v, true);
      if (r != undefined && r !== "undefined") {
        result += `${s}:${r}`;
      }
    }
  }
  return result;
}
function ssrElement(tag, props, children, needsId) {
  if (props == null) props = {};else if (typeof props === "function") props = props();
  const skipChildren = VOID_ELEMENTS.test(tag);
  const keys = Object.keys(props);
  let result = `<${tag}${ssrHydrationKey() } `;
  let classResolved;
  for (let i = 0; i < keys.length; i++) {
    const prop = keys[i];
    if (ChildProperties.has(prop)) {
      if (children === undefined && !skipChildren) children = tag === "script" || tag === "style" || prop === "innerHTML" ? props[prop] : escape(props[prop]);
      continue;
    }
    const value = props[prop];
    if (prop === "style") {
      result += `style="${ssrStyle(value)}"`;
    } else if (prop === "class" || prop === "className" || prop === "classList") {
      if (classResolved) continue;
      let n;
      result += `class="${escape(((n = props.class) ? n + " " : "") + ((n = props.className) ? n + " " : ""), true) + ssrClassList(props.classList)}"`;
      classResolved = true;
    } else if (BooleanAttributes.has(prop)) {
      if (value) result += prop;else continue;
    } else if (value == undefined || prop === "ref" || prop.slice(0, 2) === "on" || prop.slice(0, 5) === "prop:") {
      continue;
    } else if (prop.slice(0, 5) === "bool:") {
      if (!value) continue;
      result += escape(prop.slice(5));
    } else if (prop.slice(0, 5) === "attr:") {
      result += `${escape(prop.slice(5))}="${escape(value, true)}"`;
    } else {
      result += `${Aliases[prop] || escape(prop)}="${escape(value, true)}"`;
    }
    if (i !== keys.length - 1) result += " ";
  }
  if (skipChildren) return {
    t: result + "/>"
  };
  if (typeof children === "function") children = children();
  return {
    t: result + `>${resolveSSRNode(children, true)}</${tag}>`
  };
}
function ssrAttribute(key, value, isBoolean) {
  return isBoolean ? value ? " " + key : "" : value != null ? ` ${key}="${value}"` : "";
}
function ssrHydrationKey() {
  const hk = getHydrationKey();
  return hk ? ` data-hk="${hk}"` : "";
}
function escape(s, attr) {
  const t = typeof s;
  if (t !== "string") {
    if (!attr && t === "function") return escape(s());
    if (!attr && Array.isArray(s)) {
      s = s.slice();
      for (let i = 0; i < s.length; i++) s[i] = escape(s[i]);
      return s;
    }
    if (attr && t === "boolean") return String(s);
    return s;
  }
  const delim = attr ? '"' : "<";
  const escDelim = attr ? "&quot;" : "&lt;";
  let iDelim = s.indexOf(delim);
  let iAmp = s.indexOf("&");
  if (iDelim < 0 && iAmp < 0) return s;
  let left = 0,
    out = "";
  while (iDelim >= 0 && iAmp >= 0) {
    if (iDelim < iAmp) {
      if (left < iDelim) out += s.substring(left, iDelim);
      out += escDelim;
      left = iDelim + 1;
      iDelim = s.indexOf(delim, left);
    } else {
      if (left < iAmp) out += s.substring(left, iAmp);
      out += "&amp;";
      left = iAmp + 1;
      iAmp = s.indexOf("&", left);
    }
  }
  if (iDelim >= 0) {
    do {
      if (left < iDelim) out += s.substring(left, iDelim);
      out += escDelim;
      left = iDelim + 1;
      iDelim = s.indexOf(delim, left);
    } while (iDelim >= 0);
  } else while (iAmp >= 0) {
    if (left < iAmp) out += s.substring(left, iAmp);
    out += "&amp;";
    left = iAmp + 1;
    iAmp = s.indexOf("&", left);
  }
  return left < s.length ? out + s.substring(left) : out;
}
function resolveSSRNode(node, top) {
  const t = typeof node;
  if (t === "string") return node;
  if (node == null || t === "boolean") return "";
  if (Array.isArray(node)) {
    let prev = {};
    let mapped = "";
    for (let i = 0, len = node.length; i < len; i++) {
      if (!top && typeof prev !== "object" && typeof node[i] !== "object") mapped += `<!--!$-->`;
      mapped += resolveSSRNode(prev = node[i]);
    }
    return mapped;
  }
  if (t === "object") return node.t;
  if (t === "function") return resolveSSRNode(node());
  return String(node);
}
function getHydrationKey() {
  const hydrate = sharedConfig.context;
  return hydrate && !hydrate.noHydrate && sharedConfig.getNextContextId();
}
function useAssets(fn) {
  sharedConfig.context.assets.push(() => resolveSSRNode(escape(fn())));
}
function generateHydrationScript({
  eventNames = ["click", "input"],
  nonce
} = {}) {
  return `<script${nonce ? ` nonce="${nonce}"` : ""}>window._$HY||(e=>{let t=e=>e&&e.hasAttribute&&(e.hasAttribute("data-hk")?e:t(e.host&&e.host.nodeType?e.host:e.parentNode));["${eventNames.join('", "')}"].forEach((o=>document.addEventListener(o,(o=>{if(!e.events)return;let s=t(o.composedPath&&o.composedPath()[0]||o.target);s&&!e.completed.has(s)&&e.events.push([s,o])}))))})(_$HY={events:[],completed:new WeakSet,r:{},fe(){}});</script><!--xs-->`;
}
function Hydration(props) {
  if (!sharedConfig.context.noHydrate) return props.children;
  const context = sharedConfig.context;
  sharedConfig.context = {
    ...context,
    count: 0,
    id: sharedConfig.getNextContextId(),
    noHydrate: false
  };
  const res = props.children;
  sharedConfig.context = context;
  return res;
}
function NoHydration(props) {
  if (sharedConfig.context) sharedConfig.context.noHydrate = true;
  return props.children;
}
function queue(fn) {
  return Promise.resolve().then(fn);
}
function allSettled(promises) {
  let length = promises.length;
  return Promise.allSettled(promises).then(() => {
    if (promises.length !== length) return allSettled(promises);
    return;
  });
}
function injectAssets(assets, html) {
  if (!assets || !assets.length) return html;
  let out = "";
  for (let i = 0, len = assets.length; i < len; i++) out += assets[i]();
  const index = html.indexOf("</head>");
  if (index === -1) return html;
  return html.slice(0, index) + out + html.slice(index);
}
function injectScripts(html, scripts, nonce) {
  const tag = `<script${nonce ? ` nonce="${nonce}"` : ""}>${scripts}</script>`;
  const index = html.indexOf("<!--xs-->");
  if (index > -1) {
    return html.slice(0, index) + tag + html.slice(index);
  }
  return html + tag;
}
function waitForFragments(registry, key) {
  for (const k of [...registry.keys()].reverse()) {
    if (key.startsWith(k)) return true;
  }
  return false;
}
function replacePlaceholder(html, key, value) {
  const marker = `<template id="pl-${key}">`;
  const close = `<!--pl-${key}-->`;
  const first = html.indexOf(marker);
  if (first === -1) return html;
  const last = html.indexOf(close, first + marker.length);
  return html.slice(0, first) + value + html.slice(last + close.length);
}
const RequestContext = Symbol();
function getRequestEvent() {
  return globalThis[RequestContext] ? globalThis[RequestContext].getStore() || sharedConfig.context && sharedConfig.context.event || console.log("RequestEvent is missing. This is most likely due to accessing `getRequestEvent` non-managed async scope in a partially polyfilled environment. Try moving it above all `await` calls.") : undefined;
}

const isServer = true;

function provideRequestEvent(init, cb) {
  const ctx = globalThis[RequestContext] = globalThis[RequestContext] || new AsyncLocalStorage();
  return ctx.run(init, cb);
}

const NullObject = /* @__PURE__ */ (() => {
  const C = function() {
  };
  C.prototype = /* @__PURE__ */ Object.create(null);
  return C;
})();
function parse(str, options) {
  if (typeof str !== "string") {
    throw new TypeError("argument str must be a string");
  }
  const obj = new NullObject();
  const opt = {};
  const dec = opt.decode || decode;
  let index = 0;
  while (index < str.length) {
    const eqIdx = str.indexOf("=", index);
    if (eqIdx === -1) {
      break;
    }
    let endIdx = str.indexOf(";", index);
    if (endIdx === -1) {
      endIdx = str.length;
    } else if (endIdx < eqIdx) {
      index = str.lastIndexOf(";", eqIdx - 1) + 1;
      continue;
    }
    const key = str.slice(index, eqIdx).trim();
    if (opt?.filter && !opt?.filter(key)) {
      index = endIdx + 1;
      continue;
    }
    if (void 0 === obj[key]) {
      let val = str.slice(eqIdx + 1, endIdx).trim();
      if (val.codePointAt(0) === 34) {
        val = val.slice(1, -1);
      }
      obj[key] = tryDecode(val, dec);
    }
    index = endIdx + 1;
  }
  return obj;
}
function decode(str) {
  return str.includes("%") ? decodeURIComponent(str) : str;
}
function tryDecode(str, decode2) {
  try {
    return decode2(str);
  } catch {
    return str;
  }
}

const fieldContentRegExp = /^[\u0009\u0020-\u007E\u0080-\u00FF]+$/;
function serialize(name, value, options) {
  const opt = options || {};
  const enc = opt.encode || encodeURIComponent;
  if (typeof enc !== "function") {
    throw new TypeError("option encode is invalid");
  }
  if (!fieldContentRegExp.test(name)) {
    throw new TypeError("argument name is invalid");
  }
  const encodedValue = enc(value);
  if (encodedValue && !fieldContentRegExp.test(encodedValue)) {
    throw new TypeError("argument val is invalid");
  }
  let str = name + "=" + encodedValue;
  if (void 0 !== opt.maxAge && opt.maxAge !== null) {
    const maxAge = opt.maxAge - 0;
    if (Number.isNaN(maxAge) || !Number.isFinite(maxAge)) {
      throw new TypeError("option maxAge is invalid");
    }
    str += "; Max-Age=" + Math.floor(maxAge);
  }
  if (opt.domain) {
    if (!fieldContentRegExp.test(opt.domain)) {
      throw new TypeError("option domain is invalid");
    }
    str += "; Domain=" + opt.domain;
  }
  if (opt.path) {
    if (!fieldContentRegExp.test(opt.path)) {
      throw new TypeError("option path is invalid");
    }
    str += "; Path=" + opt.path;
  }
  if (opt.expires) {
    if (!isDate(opt.expires) || Number.isNaN(opt.expires.valueOf())) {
      throw new TypeError("option expires is invalid");
    }
    str += "; Expires=" + opt.expires.toUTCString();
  }
  if (opt.httpOnly) {
    str += "; HttpOnly";
  }
  if (opt.secure) {
    str += "; Secure";
  }
  if (opt.priority) {
    const priority = typeof opt.priority === "string" ? opt.priority.toLowerCase() : opt.priority;
    switch (priority) {
      case "low": {
        str += "; Priority=Low";
        break;
      }
      case "medium": {
        str += "; Priority=Medium";
        break;
      }
      case "high": {
        str += "; Priority=High";
        break;
      }
      default: {
        throw new TypeError("option priority is invalid");
      }
    }
  }
  if (opt.sameSite) {
    const sameSite = typeof opt.sameSite === "string" ? opt.sameSite.toLowerCase() : opt.sameSite;
    switch (sameSite) {
      case true: {
        str += "; SameSite=Strict";
        break;
      }
      case "lax": {
        str += "; SameSite=Lax";
        break;
      }
      case "strict": {
        str += "; SameSite=Strict";
        break;
      }
      case "none": {
        str += "; SameSite=None";
        break;
      }
      default: {
        throw new TypeError("option sameSite is invalid");
      }
    }
  }
  if (opt.partitioned) {
    str += "; Partitioned";
  }
  return str;
}
function isDate(val) {
  return Object.prototype.toString.call(val) === "[object Date]" || val instanceof Date;
}

function parseSetCookie(setCookieValue, options) {
  const parts = (setCookieValue || "").split(";").filter((str) => typeof str === "string" && !!str.trim());
  const nameValuePairStr = parts.shift() || "";
  const parsed = _parseNameValuePair(nameValuePairStr);
  const name = parsed.name;
  let value = parsed.value;
  try {
    value = options?.decode === false ? value : (options?.decode || decodeURIComponent)(value);
  } catch {
  }
  const cookie = {
    name,
    value
  };
  for (const part of parts) {
    const sides = part.split("=");
    const partKey = (sides.shift() || "").trimStart().toLowerCase();
    const partValue = sides.join("=");
    switch (partKey) {
      case "expires": {
        cookie.expires = new Date(partValue);
        break;
      }
      case "max-age": {
        cookie.maxAge = Number.parseInt(partValue, 10);
        break;
      }
      case "secure": {
        cookie.secure = true;
        break;
      }
      case "httponly": {
        cookie.httpOnly = true;
        break;
      }
      case "samesite": {
        cookie.sameSite = partValue;
        break;
      }
      default: {
        cookie[partKey] = partValue;
      }
    }
  }
  return cookie;
}
function _parseNameValuePair(nameValuePairStr) {
  let name = "";
  let value = "";
  const nameValueArr = nameValuePairStr.split("=");
  if (nameValueArr.length > 1) {
    name = nameValueArr.shift();
    value = nameValueArr.join("=");
  } else {
    value = nameValuePairStr;
  }
  return { name, value };
}

function hasProp(obj, prop) {
  try {
    return prop in obj;
  } catch {
    return false;
  }
}

class H3Error extends Error {
  static __h3_error__ = true;
  statusCode = 500;
  fatal = false;
  unhandled = false;
  statusMessage;
  data;
  cause;
  constructor(message, opts = {}) {
    super(message, opts);
    if (opts.cause && !this.cause) {
      this.cause = opts.cause;
    }
  }
  toJSON() {
    const obj = {
      message: this.message,
      statusCode: sanitizeStatusCode(this.statusCode, 500)
    };
    if (this.statusMessage) {
      obj.statusMessage = sanitizeStatusMessage(this.statusMessage);
    }
    if (this.data !== void 0) {
      obj.data = this.data;
    }
    return obj;
  }
}
function createError(input) {
  if (typeof input === "string") {
    return new H3Error(input);
  }
  if (isError(input)) {
    return input;
  }
  const err = new H3Error(input.message ?? input.statusMessage ?? "", {
    cause: input.cause || input
  });
  if (hasProp(input, "stack")) {
    try {
      Object.defineProperty(err, "stack", {
        get() {
          return input.stack;
        }
      });
    } catch {
      try {
        err.stack = input.stack;
      } catch {
      }
    }
  }
  if (input.data) {
    err.data = input.data;
  }
  if (input.statusCode) {
    err.statusCode = sanitizeStatusCode(input.statusCode, err.statusCode);
  } else if (input.status) {
    err.statusCode = sanitizeStatusCode(input.status, err.statusCode);
  }
  if (input.statusMessage) {
    err.statusMessage = input.statusMessage;
  } else if (input.statusText) {
    err.statusMessage = input.statusText;
  }
  if (err.statusMessage) {
    const originalMessage = err.statusMessage;
    const sanitizedMessage = sanitizeStatusMessage(err.statusMessage);
    if (sanitizedMessage !== originalMessage) {
      console.warn(
        "[h3] Please prefer using `message` for longer error messages instead of `statusMessage`. In the future, `statusMessage` will be sanitized by default."
      );
    }
  }
  if (input.fatal !== void 0) {
    err.fatal = input.fatal;
  }
  if (input.unhandled !== void 0) {
    err.unhandled = input.unhandled;
  }
  return err;
}
function isError(input) {
  return input?.constructor?.__h3_error__ === true;
}
function isMethod(event, expected, allowHead) {
  if (typeof expected === "string") {
    if (event.method === expected) {
      return true;
    }
  } else if (expected.includes(event.method)) {
    return true;
  }
  return false;
}
function assertMethod(event, expected, allowHead) {
  if (!isMethod(event, expected)) {
    throw createError({
      statusCode: 405,
      statusMessage: "HTTP method is not allowed."
    });
  }
}
function getRequestHeaders(event) {
  const _headers = {};
  for (const key in event.node.req.headers) {
    const val = event.node.req.headers[key];
    _headers[key] = Array.isArray(val) ? val.filter(Boolean).join(", ") : val;
  }
  return _headers;
}
function getRequestHeader(event, name) {
  const headers = getRequestHeaders(event);
  const value = headers[name.toLowerCase()];
  return value;
}
function getRequestHost(event, opts = {}) {
  if (opts.xForwardedHost) {
    const xForwardedHost = event.node.req.headers["x-forwarded-host"];
    if (xForwardedHost) {
      return xForwardedHost;
    }
  }
  return event.node.req.headers.host || "localhost";
}
function getRequestProtocol(event, opts = {}) {
  if (opts.xForwardedProto !== false && event.node.req.headers["x-forwarded-proto"] === "https") {
    return "https";
  }
  return event.node.req.connection?.encrypted ? "https" : "http";
}
function getRequestURL(event, opts = {}) {
  const host = getRequestHost(event, opts);
  const protocol = getRequestProtocol(event, opts);
  const path = (event.node.req.originalUrl || event.path).replace(
    /^[/\\]+/g,
    "/"
  );
  return new URL(path, `${protocol}://${host}`);
}
function getRequestIP(event, opts = {}) {
  if (event.context.clientAddress) {
    return event.context.clientAddress;
  }
  if (opts.xForwardedFor) {
    const xForwardedFor = getRequestHeader(event, "x-forwarded-for")?.split(",").shift()?.trim();
    if (xForwardedFor) {
      return xForwardedFor;
    }
  }
  if (event.node.req.socket.remoteAddress) {
    return event.node.req.socket.remoteAddress;
  }
}

const RawBodySymbol = Symbol.for("h3RawBody");
const PayloadMethods$1 = ["PATCH", "POST", "PUT", "DELETE"];
function readRawBody(event, encoding = "utf8") {
  assertMethod(event, PayloadMethods$1);
  const _rawBody = event._requestBody || event.web?.request?.body || event.node.req[RawBodySymbol] || event.node.req.rawBody || event.node.req.body;
  if (_rawBody) {
    const promise2 = Promise.resolve(_rawBody).then((_resolved) => {
      if (Buffer.isBuffer(_resolved)) {
        return _resolved;
      }
      if (typeof _resolved.pipeTo === "function") {
        return new Promise((resolve, reject) => {
          const chunks = [];
          _resolved.pipeTo(
            new WritableStream({
              write(chunk) {
                chunks.push(chunk);
              },
              close() {
                resolve(Buffer.concat(chunks));
              },
              abort(reason) {
                reject(reason);
              }
            })
          ).catch(reject);
        });
      } else if (typeof _resolved.pipe === "function") {
        return new Promise((resolve, reject) => {
          const chunks = [];
          _resolved.on("data", (chunk) => {
            chunks.push(chunk);
          }).on("end", () => {
            resolve(Buffer.concat(chunks));
          }).on("error", reject);
        });
      }
      if (_resolved.constructor === Object) {
        return Buffer.from(JSON.stringify(_resolved));
      }
      if (_resolved instanceof URLSearchParams) {
        return Buffer.from(_resolved.toString());
      }
      if (_resolved instanceof FormData) {
        return new Response(_resolved).bytes().then((uint8arr) => Buffer.from(uint8arr));
      }
      return Buffer.from(_resolved);
    });
    return encoding ? promise2.then((buff) => buff.toString(encoding)) : promise2;
  }
  if (!Number.parseInt(event.node.req.headers["content-length"] || "") && !String(event.node.req.headers["transfer-encoding"] ?? "").split(",").map((e) => e.trim()).filter(Boolean).includes("chunked")) {
    return Promise.resolve(void 0);
  }
  const promise = event.node.req[RawBodySymbol] = new Promise(
    (resolve, reject) => {
      const bodyData = [];
      event.node.req.on("error", (err) => {
        reject(err);
      }).on("data", (chunk) => {
        bodyData.push(chunk);
      }).on("end", () => {
        resolve(Buffer.concat(bodyData));
      });
    }
  );
  const result = encoding ? promise.then((buff) => buff.toString(encoding)) : promise;
  return result;
}
function getRequestWebStream(event) {
  if (!PayloadMethods$1.includes(event.method)) {
    return;
  }
  const bodyStream = event.web?.request?.body || event._requestBody;
  if (bodyStream) {
    return bodyStream;
  }
  const _hasRawBody = RawBodySymbol in event.node.req || "rawBody" in event.node.req || "body" in event.node.req || "__unenv__" in event.node.req;
  if (_hasRawBody) {
    return new ReadableStream({
      async start(controller) {
        const _rawBody = await readRawBody(event, false);
        if (_rawBody) {
          controller.enqueue(_rawBody);
        }
        controller.close();
      }
    });
  }
  return new ReadableStream({
    start: (controller) => {
      event.node.req.on("data", (chunk) => {
        controller.enqueue(chunk);
      });
      event.node.req.on("end", () => {
        controller.close();
      });
      event.node.req.on("error", (err) => {
        controller.error(err);
      });
    }
  });
}

const MIMES = {
  html: "text/html"};

const DISALLOWED_STATUS_CHARS = /[^\u0009\u0020-\u007E]/g;
function sanitizeStatusMessage(statusMessage = "") {
  return statusMessage.replace(DISALLOWED_STATUS_CHARS, "");
}
function sanitizeStatusCode(statusCode, defaultStatusCode = 200) {
  if (!statusCode) {
    return defaultStatusCode;
  }
  if (typeof statusCode === "string") {
    statusCode = Number.parseInt(statusCode, 10);
  }
  if (statusCode < 100 || statusCode > 999) {
    return defaultStatusCode;
  }
  return statusCode;
}

function getDistinctCookieKey(name, opts) {
  return [name, opts.domain || "", opts.path || "/"].join(";");
}

function parseCookies(event) {
  return parse(event.node.req.headers.cookie || "");
}
function getCookie(event, name) {
  return parseCookies(event)[name];
}
function setCookie(event, name, value, serializeOptions = {}) {
  if (!serializeOptions.path) {
    serializeOptions = { path: "/", ...serializeOptions };
  }
  const newCookie = serialize(name, value, serializeOptions);
  const currentCookies = splitCookiesString(
    event.node.res.getHeader("set-cookie")
  );
  if (currentCookies.length === 0) {
    event.node.res.setHeader("set-cookie", newCookie);
    return;
  }
  const newCookieKey = getDistinctCookieKey(name, serializeOptions);
  event.node.res.removeHeader("set-cookie");
  for (const cookie of currentCookies) {
    const parsed = parseSetCookie(cookie);
    const key = getDistinctCookieKey(parsed.name, parsed);
    if (key === newCookieKey) {
      continue;
    }
    event.node.res.appendHeader("set-cookie", cookie);
  }
  event.node.res.appendHeader("set-cookie", newCookie);
}
function splitCookiesString(cookiesString) {
  if (Array.isArray(cookiesString)) {
    return cookiesString.flatMap((c) => splitCookiesString(c));
  }
  if (typeof cookiesString !== "string") {
    return [];
  }
  const cookiesStrings = [];
  let pos = 0;
  let start;
  let ch;
  let lastComma;
  let nextStart;
  let cookiesSeparatorFound;
  const skipWhitespace = () => {
    while (pos < cookiesString.length && /\s/.test(cookiesString.charAt(pos))) {
      pos += 1;
    }
    return pos < cookiesString.length;
  };
  const notSpecialChar = () => {
    ch = cookiesString.charAt(pos);
    return ch !== "=" && ch !== ";" && ch !== ",";
  };
  while (pos < cookiesString.length) {
    start = pos;
    cookiesSeparatorFound = false;
    while (skipWhitespace()) {
      ch = cookiesString.charAt(pos);
      if (ch === ",") {
        lastComma = pos;
        pos += 1;
        skipWhitespace();
        nextStart = pos;
        while (pos < cookiesString.length && notSpecialChar()) {
          pos += 1;
        }
        if (pos < cookiesString.length && cookiesString.charAt(pos) === "=") {
          cookiesSeparatorFound = true;
          pos = nextStart;
          cookiesStrings.push(cookiesString.slice(start, lastComma));
          start = pos;
        } else {
          pos = lastComma + 1;
        }
      } else {
        pos += 1;
      }
    }
    if (!cookiesSeparatorFound || pos >= cookiesString.length) {
      cookiesStrings.push(cookiesString.slice(start));
    }
  }
  return cookiesStrings;
}

const defer = typeof setImmediate === "undefined" ? (fn) => fn() : setImmediate;
function send(event, data, type) {
  {
    defaultContentType(event, type);
  }
  return new Promise((resolve) => {
    defer(() => {
      if (!event.handled) {
        event.node.res.end(data);
      }
      resolve();
    });
  });
}
function setResponseStatus(event, code, text) {
  if (code) {
    event.node.res.statusCode = sanitizeStatusCode(
      code,
      event.node.res.statusCode
    );
  }
  if (text) {
    event.node.res.statusMessage = sanitizeStatusMessage(text);
  }
}
function getResponseStatus(event) {
  return event.node.res.statusCode;
}
function getResponseStatusText(event) {
  return event.node.res.statusMessage;
}
function defaultContentType(event, type) {
  if (event.node.res.statusCode !== 304 && !event.node.res.getHeader("content-type")) {
    event.node.res.setHeader("content-type", type);
  }
}
function sendRedirect(event, location, code = 302) {
  event.node.res.statusCode = sanitizeStatusCode(
    code,
    event.node.res.statusCode
  );
  event.node.res.setHeader("location", location);
  const encodedLoc = location.replace(/"/g, "%22");
  const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${encodedLoc}"></head></html>`;
  return send(event, html, MIMES.html);
}
function getResponseHeaders(event) {
  return event.node.res.getHeaders();
}
function getResponseHeader(event, name) {
  return event.node.res.getHeader(name);
}
function setResponseHeader(event, name, value) {
  event.node.res.setHeader(name, value);
}
const setHeader = setResponseHeader;
function appendResponseHeader(event, name, value) {
  let current = event.node.res.getHeader(name);
  if (!current) {
    event.node.res.setHeader(name, value);
    return;
  }
  if (!Array.isArray(current)) {
    current = [current.toString()];
  }
  event.node.res.setHeader(name, [...current, value]);
}
function removeResponseHeader(event, name) {
  return event.node.res.removeHeader(name);
}
function sendStream(event, stream) {
  if (!stream || typeof stream !== "object") {
    throw new Error("[h3] Invalid stream provided.");
  }
  event.node.res._data = stream;
  if (!event.node.res.socket) {
    event._handled = true;
    return Promise.resolve();
  }
  if (hasProp(stream, "pipeTo") && typeof stream.pipeTo === "function") {
    return stream.pipeTo(
      new WritableStream({
        write(chunk) {
          event.node.res.write(chunk);
        }
      })
    ).then(() => {
      event.node.res.end();
    });
  }
  if (hasProp(stream, "pipe") && typeof stream.pipe === "function") {
    return new Promise((resolve, reject) => {
      stream.pipe(event.node.res);
      if (stream.on) {
        stream.on("end", () => {
          event.node.res.end();
          resolve();
        });
        stream.on("error", (error) => {
          reject(error);
        });
      }
      event.node.res.on("close", () => {
        if (stream.abort) {
          stream.abort();
        }
      });
    });
  }
  throw new Error("[h3] Invalid or incompatible stream provided.");
}
function sendWebResponse(event, response) {
  for (const [key, value] of response.headers) {
    if (key === "set-cookie") {
      event.node.res.appendHeader(key, splitCookiesString(value));
    } else {
      event.node.res.setHeader(key, value);
    }
  }
  if (response.status) {
    event.node.res.statusCode = sanitizeStatusCode(
      response.status,
      event.node.res.statusCode
    );
  }
  if (response.statusText) {
    event.node.res.statusMessage = sanitizeStatusMessage(response.statusText);
  }
  if (response.redirected) {
    event.node.res.setHeader("location", response.url);
  }
  if (!response.body) {
    event.node.res.end();
    return;
  }
  return sendStream(event, response.body);
}

class H3Event {
  "__is_event__" = true;
  // Context
  node;
  // Node
  web;
  // Web
  context = {};
  // Shared
  // Request
  _method;
  _path;
  _headers;
  _requestBody;
  // Response
  _handled = false;
  // Hooks
  _onBeforeResponseCalled;
  _onAfterResponseCalled;
  constructor(req, res) {
    this.node = { req, res };
  }
  // --- Request ---
  get method() {
    if (!this._method) {
      this._method = (this.node.req.method || "GET").toUpperCase();
    }
    return this._method;
  }
  get path() {
    return this._path || this.node.req.url || "/";
  }
  get headers() {
    if (!this._headers) {
      this._headers = _normalizeNodeHeaders(this.node.req.headers);
    }
    return this._headers;
  }
  // --- Respoonse ---
  get handled() {
    return this._handled || this.node.res.writableEnded || this.node.res.headersSent;
  }
  respondWith(response) {
    return Promise.resolve(response).then(
      (_response) => sendWebResponse(this, _response)
    );
  }
  // --- Utils ---
  toString() {
    return `[${this.method}] ${this.path}`;
  }
  toJSON() {
    return this.toString();
  }
  // --- Deprecated ---
  /** @deprecated Please use `event.node.req` instead. */
  get req() {
    return this.node.req;
  }
  /** @deprecated Please use `event.node.res` instead. */
  get res() {
    return this.node.res;
  }
}
function _normalizeNodeHeaders(nodeHeaders) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(nodeHeaders)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
    } else if (value) {
      headers.set(name, value);
    }
  }
  return headers;
}

function defineEventHandler(handler) {
  if (typeof handler === "function") {
    handler.__is_handler__ = true;
    return handler;
  }
  const _hooks = {
    onRequest: _normalizeArray(handler.onRequest),
    onBeforeResponse: _normalizeArray(handler.onBeforeResponse)
  };
  const _handler = (event) => {
    return _callHandler(event, handler.handler, _hooks);
  };
  _handler.__is_handler__ = true;
  _handler.__resolve__ = handler.handler.__resolve__;
  _handler.__websocket__ = handler.websocket;
  return _handler;
}
function _normalizeArray(input) {
  return input ? Array.isArray(input) ? input : [input] : void 0;
}
async function _callHandler(event, handler, hooks) {
  if (hooks.onRequest) {
    for (const hook of hooks.onRequest) {
      await hook(event);
      if (event.handled) {
        return;
      }
    }
  }
  const body = await handler(event);
  const response = { body };
  if (hooks.onBeforeResponse) {
    for (const hook of hooks.onBeforeResponse) {
      await hook(event, response);
    }
  }
  return response.body;
}
const eventHandler = defineEventHandler;

var __defProp$1 = Object.defineProperty;
var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$1 = (obj, key, value) => __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
function _e$1(e) {
  let n;
  const t = _$1(e), s = { duplex: "half", method: e.method, headers: e.headers };
  return e.node.req.body instanceof ArrayBuffer ? new Request(t, { ...s, body: e.node.req.body }) : new Request(t, { ...s, get body() {
    return n || (n = Ge$1(e), n);
  } });
}
function Ne$1(e) {
  var _a;
  return (_a = e.web) != null ? _a : e.web = { request: _e$1(e), url: _$1(e) }, e.web.request;
}
function je$1() {
  return Qe$1();
}
const U$2 = /* @__PURE__ */ Symbol("$HTTPEvent");
function Me$1(e) {
  return typeof e == "object" && (e instanceof H3Event || (e == null ? void 0 : e[U$2]) instanceof H3Event || (e == null ? void 0 : e.__is_event__) === true);
}
function u(e) {
  return function(...n) {
    var _a;
    let t = n[0];
    if (Me$1(t)) n[0] = t instanceof H3Event || t.__is_event__ ? t : t[U$2];
    else {
      if (!((_a = globalThis.app.config.server.experimental) == null ? void 0 : _a.asyncContext)) throw new Error("AsyncLocalStorage was not enabled. Use the `server.experimental.asyncContext: true` option in your app configuration to enable it. Or, pass the instance of HTTPEvent that you have as the first argument to the function.");
      if (t = je$1(), !t) throw new Error("No HTTPEvent found in AsyncLocalStorage. Make sure you are using the function within the server runtime.");
      n.unshift(t);
    }
    return e(...n);
  };
}
const _$1 = u(getRequestURL), De$1 = u(getRequestIP), S = u(setResponseStatus), E = u(getResponseStatus), We$1 = u(getResponseStatusText), y = u(getResponseHeaders), q$1 = u(getResponseHeader), Be$1 = u(setResponseHeader), N = u(appendResponseHeader), ze$1 = u(parseCookies), Je = u(getCookie), Xe$1 = u(setCookie), h = u(setHeader), Ge$1 = u(getRequestWebStream), Ke$1 = u(removeResponseHeader), Ve$1 = u(Ne$1);
function Ze$1() {
  var _a;
  return getContext("nitro-app", { asyncContext: !!((_a = globalThis.app.config.server.experimental) == null ? void 0 : _a.asyncContext), AsyncLocalStorage: AsyncLocalStorage });
}
function Qe$1() {
  return Ze$1().use().event;
}
const w$1 = "Invariant Violation", { setPrototypeOf: Ye$1 = function(e, n) {
  return e.__proto__ = n, e;
} } = Object;
let T$1 = class T extends Error {
  constructor(n = w$1) {
    super(typeof n == "number" ? `${w$1}: ${n} (see https://github.com/apollographql/invariant-packages)` : n);
    __publicField$1(this, "framesToPop", 1);
    __publicField$1(this, "name", w$1);
    Ye$1(this, T.prototype);
  }
};
function et(e, n) {
  if (!e) throw new T$1(n);
}
const v = "solidFetchEvent";
function tt(e) {
  return { request: Ve$1(e), response: ot$1(e), clientAddress: De$1(e), locals: {}, nativeEvent: e };
}
function nt$1(e) {
  return { ...e };
}
function rt$1(e) {
  if (!e.context[v]) {
    const n = tt(e);
    e.context[v] = n;
  }
  return e.context[v];
}
function H$1(e, n) {
  for (const [t, s] of n.entries()) N(e, t, s);
}
let st$2 = class st {
  constructor(n) {
    __publicField$1(this, "event");
    this.event = n;
  }
  get(n) {
    const t = q$1(this.event, n);
    return Array.isArray(t) ? t.join(", ") : t || null;
  }
  has(n) {
    return this.get(n) !== null;
  }
  set(n, t) {
    return Be$1(this.event, n, t);
  }
  delete(n) {
    return Ke$1(this.event, n);
  }
  append(n, t) {
    N(this.event, n, t);
  }
  getSetCookie() {
    const n = q$1(this.event, "Set-Cookie");
    return Array.isArray(n) ? n : [n];
  }
  forEach(n) {
    return Object.entries(y(this.event)).forEach(([t, s]) => n(Array.isArray(s) ? s.join(", ") : s, t, this));
  }
  entries() {
    return Object.entries(y(this.event)).map(([n, t]) => [n, Array.isArray(t) ? t.join(", ") : t])[Symbol.iterator]();
  }
  keys() {
    return Object.keys(y(this.event))[Symbol.iterator]();
  }
  values() {
    return Object.values(y(this.event)).map((n) => Array.isArray(n) ? n.join(", ") : n)[Symbol.iterator]();
  }
  [Symbol.iterator]() {
    return this.entries()[Symbol.iterator]();
  }
};
function ot$1(e) {
  return { get status() {
    return E(e);
  }, set status(n) {
    S(e, n);
  }, get statusText() {
    return We$1(e);
  }, set statusText(n) {
    S(e, E(e), n);
  }, headers: new st$2(e) };
}
const j = [{ page: true, $component: { src: "src/routes/index.tsx?pick=default&pick=$css", build: () => import('../build/index.mjs'), import: () => import('../build/index.mjs') }, path: "/", filePath: "/Users/jalbarran/fun/drekki/pi-extensions/packages/pr-canvas/app/src/routes/index.tsx" }, { page: true, $component: { src: "src/routes/pr/[number].tsx?pick=default&pick=$css", build: () => import('../build/_number_.mjs'), import: () => import('../build/_number_.mjs') }, path: "/pr/:number", filePath: "/Users/jalbarran/fun/drekki/pi-extensions/packages/pr-canvas/app/src/routes/pr/[number].tsx" }], at$2 = it$2(j.filter((e) => e.page));
function it$2(e) {
  function n(t, s, o, a) {
    const i = Object.values(t).find((c) => o.startsWith(c.id + "/"));
    return i ? (n(i.children || (i.children = []), s, o.slice(i.id.length)), t) : (t.push({ ...s, id: o, path: o.replace(/\([^)/]+\)/g, "").replace(/\/+/g, "/") }), t);
  }
  return e.sort((t, s) => t.path.length - s.path.length).reduce((t, s) => n(t, s, s.path, s.path), []);
}
function ct$2(e) {
  return e.$HEAD || e.$GET || e.$POST || e.$PUT || e.$PATCH || e.$DELETE;
}
createRouter$1({ routes: j.reduce((e, n) => {
  if (!ct$2(n)) return e;
  let t = n.path.replace(/\([^)/]+\)/g, "").replace(/\/+/g, "/").replace(/\*([^/]*)/g, (s, o) => `**:${o}`).split("/").map((s) => s.startsWith(":") || s.startsWith("*") ? s : encodeURIComponent(s)).join("/");
  if (/:[^/]*\?/g.test(t)) throw new Error(`Optional parameters are not supported in API routes: ${t}`);
  if (e[t]) throw new Error(`Duplicate API routes for "${t}" found at "${e[t].route.path}" and "${n.path}"`);
  return e[t] = { route: n }, e;
}, {}) });
var lt$2 = " ";
const pt$2 = { style: (e) => ssrElement("style", e.attrs, () => e.children), link: (e) => ssrElement("link", e.attrs, void 0), script: (e) => e.attrs.src ? ssrElement("script", mergeProps(() => e.attrs, { get id() {
  return e.key;
} }), () => ssr(lt$2)) : null, noscript: (e) => ssrElement("noscript", e.attrs, () => escape(e.children)) };
function dt$2(e, n) {
  let { tag: t, attrs: { key: s, ...o } = { key: void 0 }, children: a } = e;
  return pt$2[t]({ attrs: { ...o, nonce: n }, key: s, children: a });
}
function ft$2(e, n, t, s = "default") {
  return lazy(async () => {
    var _a;
    {
      const a = (await e.import())[s], c = (await ((_a = n.inputs) == null ? void 0 : _a[e.src].assets())).filter((l) => l.tag === "style" || l.attrs.rel === "stylesheet");
      return { default: (l) => [...c.map((g) => dt$2(g)), createComponent(a, l)] };
    }
  });
}
function M() {
  function e(t) {
    return { ...t, ...t.$$route ? t.$$route.require().route : void 0, info: { ...t.$$route ? t.$$route.require().route.info : {}, filesystem: true }, component: t.$component && ft$2(t.$component, globalThis.MANIFEST.client, globalThis.MANIFEST.ssr), children: t.children ? t.children.map(e) : void 0 };
  }
  return at$2.map(e);
}
const Ft$1 = () => getRequestEvent().routes ;
function ht$2(e) {
  const n = Je(e.nativeEvent, "flash");
  if (n) try {
    let t = JSON.parse(n);
    if (!t || !t.result) return;
    const s = [...t.input.slice(0, -1), new Map(t.input[t.input.length - 1])], o = t.error ? new Error(t.result) : t.result;
    return { input: s, url: t.url, pending: false, result: t.thrown ? void 0 : o, error: t.thrown ? o : void 0 };
  } catch (t) {
    console.error(t);
  } finally {
    Xe$1(e.nativeEvent, "flash", "", { maxAge: 0 });
  }
}
async function gt$1(e) {
  const n = globalThis.MANIFEST.client;
  return globalThis.MANIFEST.ssr, e.response.headers.set("Content-Type", "text/html"), Object.assign(e, { manifest: await n.json(), assets: [...await n.inputs[n.handler].assets()], router: { submission: ht$2(e) }, routes: M(), complete: false, $islands: /* @__PURE__ */ new Set() });
}
const mt$2 = /* @__PURE__ */ new Set([301, 302, 303, 307, 308]);
function Rt$1(e) {
  return e.status && mt$2.has(e.status) ? e.status : 302;
}
const yt$1 = {}, k = [O$1, L$2, q$2, Y, K$1, l, p, te$1, ne$1, fe$1, pe], St$1 = 64, D$1 = M$1.RegExp;
function W$1(e) {
  const n = new TextEncoder().encode(e), t = n.length, s = t.toString(16), o = "00000000".substring(0, 8 - s.length) + s, a = new TextEncoder().encode(`;0x${o};`), i = new Uint8Array(12 + t);
  return i.set(a), i.set(n, 12), i;
}
function C(e, n) {
  return new ReadableStream({ start(t) {
    Sn(n, { scopeId: e, plugins: k, onSerialize(s, o) {
      t.enqueue(W$1(o ? `(${dn(e)},${s})` : s));
    }, onDone() {
      t.close();
    }, onError(s) {
      t.error(s);
    } });
  } });
}
function bt$1(e) {
  return new ReadableStream({ start(n) {
    iu(e, { disabledFeatures: D$1, depthLimit: St$1, plugins: k, onParse(t) {
      n.enqueue(W$1(JSON.stringify(t)));
    }, onDone() {
      n.close();
    }, onError(t) {
      n.error(t);
    } });
  } });
}
async function P(e) {
  return Pu(JSON.parse(e), { plugins: k, disabledFeatures: D$1 });
}
async function wt$1(e) {
  const n = rt$1(e), t = n.request, s = t.headers.get("X-Server-Id"), o = t.headers.get("X-Server-Instance"), a = t.headers.has("X-Single-Flight"), i = new URL(t.url);
  let c, d;
  if (s) et(typeof s == "string", "Invalid server function"), [c, d] = decodeURIComponent(s).split("#");
  else if (c = i.searchParams.get("id"), d = i.searchParams.get("name"), !c || !d) return new Response(null, { status: 404 });
  const l = yt$1[c];
  let g;
  if (!l) return new Response(null, { status: 404 });
  g = await l.importer();
  const B = g[l.functionName];
  let f = [];
  if (!o || e.method === "GET") {
    const r = i.searchParams.get("args");
    if (r) {
      const p = await P(r);
      for (const m of p) f.push(m);
    }
  }
  if (e.method === "POST") {
    const r = t.headers.get("content-type"), p = e.node.req, m = p instanceof ReadableStream, z = p.body instanceof ReadableStream, J = m && p.locked || z && p.body.locked, X = m ? p : p.body, b = J ? t : new Request(t, { ...t, body: X });
    t.headers.get("x-serialized") ? f = await P(await b.text()) : (r == null ? void 0 : r.startsWith("multipart/form-data")) || (r == null ? void 0 : r.startsWith("application/x-www-form-urlencoded")) ? f.push(await b.formData()) : (r == null ? void 0 : r.startsWith("application/json")) && (f = await b.json());
  }
  try {
    let r = await provideRequestEvent(n, async () => (sharedConfig.context = { event: n }, n.locals.serverFunctionMeta = { id: c + "#" + d }, B(...f)));
    if (a && o && (r = await L$1(n, r)), r instanceof Response) {
      if (r.headers && r.headers.has("X-Content-Raw")) return r;
      o && (r.headers && H$1(e, r.headers), r.status && (r.status < 300 || r.status >= 400) && S(e, r.status), r.customBody ? r = await r.customBody() : r.body == null && (r = null));
    }
    if (!o) return F$1(r, t, f);
    return h(e, "x-serialized", "true"), h(e, "content-type", "text/javascript"), C(o, r);
    return bt$1(r);
  } catch (r) {
    if (r instanceof Response) a && o && (r = await L$1(n, r)), r.headers && H$1(e, r.headers), r.status && (!o || r.status < 300 || r.status >= 400) && S(e, r.status), r.customBody ? r = r.customBody() : r.body == null && (r = null), h(e, "X-Error", "true");
    else if (o) {
      const p = r instanceof Error ? r.message : typeof r == "string" ? r : "true";
      h(e, "X-Error", p.replace(/[\r\n]+/g, ""));
    } else r = F$1(r, t, f, true);
    return o ? (h(e, "x-serialized", "true"), h(e, "content-type", "text/javascript"), C(o, r)) : r;
  }
}
function F$1(e, n, t, s) {
  const o = new URL(n.url), a = e instanceof Error;
  let i = 302, c;
  return e instanceof Response ? (c = new Headers(e.headers), e.headers.has("Location") && (c.set("Location", new URL(e.headers.get("Location"), o.origin + "").toString()), i = Rt$1(e))) : c = new Headers({ Location: new URL(n.headers.get("referer")).toString() }), e && c.append("Set-Cookie", `flash=${encodeURIComponent(JSON.stringify({ url: o.pathname + o.search, result: a ? e.message : e, thrown: s, error: a, input: [...t.slice(0, -1), [...t[t.length - 1].entries()]] }))}; Secure; HttpOnly;`), new Response(null, { status: i, headers: c });
}
let $;
function vt$1(e) {
  var _a;
  const n = new Headers(e.request.headers), t = ze$1(e.nativeEvent), s = e.response.headers.getSetCookie();
  n.delete("cookie");
  let o = false;
  return ((_a = e.nativeEvent.node) == null ? void 0 : _a.req) && (o = true, e.nativeEvent.node.req.headers.cookie = ""), s.forEach((a) => {
    if (!a) return;
    const { maxAge: i, expires: c, name: d, value: l } = parseSetCookie$1(a);
    if (i != null && i <= 0) {
      delete t[d];
      return;
    }
    if (c != null && c.getTime() <= Date.now()) {
      delete t[d];
      return;
    }
    t[d] = l;
  }), Object.entries(t).forEach(([a, i]) => {
    n.append("cookie", `${a}=${i}`), o && (e.nativeEvent.node.req.headers.cookie += `${a}=${i};`);
  }), n;
}
async function L$1(e, n) {
  let t, s = new URL(e.request.headers.get("referer")).toString();
  n instanceof Response && (n.headers.has("X-Revalidate") && (t = n.headers.get("X-Revalidate").split(",")), n.headers.has("Location") && (s = new URL(n.headers.get("Location"), new URL(e.request.url).origin + "").toString()));
  const o = nt$1(e);
  return o.request = new Request(s, { headers: vt$1(e) }), await provideRequestEvent(o, async () => {
    await gt$1(o), $ || ($ = (await import('../build/app-8N0XXXaK.mjs')).default), o.router.dataOnly = t || true, o.router.previousUrl = e.request.headers.get("referer");
    try {
      renderToString(() => {
        sharedConfig.context.event = o, $();
      });
    } catch (c) {
      console.log(c);
    }
    const a = o.router.data;
    if (!a) return n;
    let i = false;
    for (const c in a) a[c] === void 0 ? delete a[c] : i = true;
    return i && (n instanceof Response ? n.customBody && (a._$value = n.customBody()) : (a._$value = n, n = new Response(null, { status: 200 })), n.customBody = () => a, n.headers.set("X-Single-Flight", "true")), n;
  });
}
const Lt$1 = eventHandler(wt$1);

function isWrappable(obj) {
  return obj != null && typeof obj === "object" && (Object.getPrototypeOf(obj) === Object.prototype || Array.isArray(obj));
}
function setProperty(state, property, value, force) {
  if (property === "__proto__") return;
  if (state[property] === value) return;
  if (value === undefined) {
    delete state[property];
  } else state[property] = value;
}
function mergeStoreNode(state, value, force) {
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (isUnsafeKey(key)) continue;
    setProperty(state, key, value[key]);
  }
}
function isUnsafeKey(property) {
  return property === "__proto__" || property === "constructor" || property === "prototype";
}
function updateArray(current, next) {
  if (typeof next === "function") next = next(current);
  if (Array.isArray(next)) {
    if (current === next) return;
    let i = 0,
      len = next.length;
    for (; i < len; i++) {
      const value = next[i];
      if (current[i] !== value) setProperty(current, i, value);
    }
    setProperty(current, "length", len);
  } else mergeStoreNode(current, next);
}
function updatePath(current, path, traversed = []) {
  let part,
    next = current;
  if (path.length > 1) {
    part = path.shift();
    const partType = typeof part,
      isArray = Array.isArray(current);
    if (partType === "string" && (part === "__proto__" || path.length > 1 && isUnsafeKey(part))) return;
    if (Array.isArray(part)) {
      for (let i = 0; i < part.length; i++) {
        updatePath(current, [part[i]].concat(path), traversed);
      }
      return;
    } else if (isArray && partType === "function") {
      for (let i = 0; i < current.length; i++) {
        if (part(current[i], i)) updatePath(current, [i].concat(path), traversed);
      }
      return;
    } else if (isArray && partType === "object") {
      const {
        from = 0,
        to = current.length - 1,
        by = 1
      } = part;
      for (let i = from; i <= to; i += by) {
        updatePath(current, [i].concat(path), traversed);
      }
      return;
    } else if (path.length > 1) {
      updatePath(current[part], path, [part].concat(traversed));
      return;
    }
    next = current[part];
    traversed = [part].concat(traversed);
  }
  let value = path[0];
  if (typeof value === "function") {
    value = value(next, traversed);
    if (value === next) return;
  }
  if (part === undefined && value == undefined) return;
  if (part === undefined || isWrappable(next) && isWrappable(value) && !Array.isArray(value)) {
    mergeStoreNode(next, value);
  } else setProperty(current, part, value);
}
function createStore(state) {
  const isArray = Array.isArray(state);
  function setStore(...args) {
    isArray && args.length === 1 ? updateArray(state, args[0]) : updatePath(state, args);
  }
  return [state, setStore];
}

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
function se$1(r) {
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
      if (y && I$1(P, m(R))) c.params[R] = P;
      else if (y || !I$1(P, R)) return null;
      c.path += `/${P}`;
    }
    if (o) {
      const p = l ? d.slice(-l).join("/") : "";
      if (I$1(p, m(o))) c.params[o] = p;
      else return null;
    }
    return c;
  };
}
function I$1(r, n) {
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
const Ie = 100, Fe = createContext(), ce = createContext(), B$1 = () => _e(useContext(Fe), "<A> and 'use' router primitives can be only used inside a Route."), ke = () => useContext(ce) || B$1().base, st$1 = (r) => {
  const n = ke();
  return createMemo(() => n.resolvePath(r()));
}, at$1 = (r) => {
  const n = B$1();
  return createMemo(() => {
    const e = r();
    return e !== void 0 ? n.renderPath(e) : e;
  });
}, it$1 = () => B$1().location, ct$1 = () => B$1().params;
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
  }, t), s = createMemo(() => o().pathname), a = createMemo(() => o().search, true), i = createMemo(() => o().hash), d = () => "", l = on$1(a, () => se$1(o()));
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
function lt$1() {
  return w;
}
function ut$1(r, n, e, t = {}) {
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
  return createRenderEffect(on$1(o, (u) => y("native", u), { defer: true })), { base: z, location: j, params: pe, isRouting: m, renderPath: d, parsePath: i, navigatorFactory: ge, matches: H, beforeLeave: l, preloadRoute: ve, singleFlight: t.singleFlight === void 0 ? true : t.singleFlight, submissions: D };
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
      f && S && runWithOwner(e(), () => S({ params: N, location: { pathname: u.pathname, search: u.search, hash: u.hash, query: se$1(u), state: null, key: "" }, intent: "preload" }));
    }
    w = C;
  }
  function Pe() {
    const u = getRequestEvent();
    return u && u.router && u.router.submission ? [u.router.submission] : [];
  }
}
function dt$1(r, n, e, t) {
  const { base: o, location: s, params: a } = r, { pattern: i, component: d, preload: l } = t().route, c = createMemo(() => t().path);
  d && d.preload && d.preload();
  const m = l ? l({ params: a, location: s, intent: w || "initial" }) : void 0;
  return { parent: n, pattern: i, path: c, outlet: () => d ? createComponent(d, { params: a, location: s, data: m, get children() {
    return e();
  } }) : e(), resolvePath(h) {
    return _(o.path(), h, c());
  } };
}
const ue = createContext(), de = ["title", "meta"], U$1 = [], K = ["name", "http-equiv", "content", "charset", "media"].concat(["property"]), q = (r, n) => {
  const e = Object.fromEntries(Object.entries(r.props).filter(([t]) => n.includes(t)).sort());
  return (Object.hasOwn(e, "name") || Object.hasOwn(e, "property")) && (e.name = e.name || e.property, delete e.property), r.tag + JSON.stringify(e);
};
function ze() {
  const r = [];
  return useAssets(() => ssr(Xe(r))), { addTag(n) {
    if (de.indexOf(n.tag) !== -1) {
      const e = n.tag === "title" ? U$1 : K, t = q(n, e), o = r.findIndex((s) => s.tag === n.tag && q(s, e) === t);
      o !== -1 && r.splice(o, 1);
    }
    return r.push(n), r.length;
  }, removeTag(n, e) {
  } };
}
const ft$1 = (r) => {
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
const ht$1 = (r) => Ge("title", r, { escape: true, close: true });
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
const fe = createContext(), Ze = "ws://localhost:3001", pt$1 = (r) => {
  const n = Qe(Ze), e = Ye(n);
  return createComponent(fe.Provider, { value: e, get children() {
    return r.children;
  } });
};
function mt$1() {
  const r = useContext(fe);
  if (!r) throw new Error("usePrStore must be used within a PrStoreProvider");
  return r;
}

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, key + "" , value);
function rt(e) {
  let t;
  const r = Z(e), s = { duplex: "half", method: e.method, headers: e.headers };
  return e.node.req.body instanceof ArrayBuffer ? new Request(r, { ...s, body: e.node.req.body }) : new Request(r, { ...s, get body() {
    return t || (t = pt(e), t);
  } });
}
function nt(e) {
  var _a;
  return (_a = e.web) != null ? _a : e.web = { request: rt(e), url: Z(e) }, e.web.request;
}
function st() {
  return yt();
}
const X = /* @__PURE__ */ Symbol("$HTTPEvent");
function ot(e) {
  return typeof e == "object" && (e instanceof H3Event || (e == null ? void 0 : e[X]) instanceof H3Event || (e == null ? void 0 : e.__is_event__) === true);
}
function g(e) {
  return function(...t) {
    var _a;
    let r = t[0];
    if (ot(r)) t[0] = r instanceof H3Event || r.__is_event__ ? r : r[X];
    else {
      if (!((_a = globalThis.app.config.server.experimental) == null ? void 0 : _a.asyncContext)) throw new Error("AsyncLocalStorage was not enabled. Use the `server.experimental.asyncContext: true` option in your app configuration to enable it. Or, pass the instance of HTTPEvent that you have as the first argument to the function.");
      if (r = st(), !r) throw new Error("No HTTPEvent found in AsyncLocalStorage. Make sure you are using the function within the server runtime.");
      t.unshift(r);
    }
    return e(...t);
  };
}
const Z = g(getRequestURL), at = g(getRequestIP), O = g(setResponseStatus), D = g(getResponseStatus), it = g(getResponseStatusText), L = g(getResponseHeaders), W = g(getResponseHeader), ct = g(setResponseHeader), ut = g(appendResponseHeader), B = g(sendRedirect), lt = g(getCookie), dt = g(setCookie), ht = g(setHeader), pt = g(getRequestWebStream), ft = g(removeResponseHeader), mt = g(nt);
function gt() {
  var _a;
  return getContext("nitro-app", { asyncContext: !!((_a = globalThis.app.config.server.experimental) == null ? void 0 : _a.asyncContext), AsyncLocalStorage: AsyncLocalStorage });
}
function yt() {
  return gt().use().event;
}
const ee = [{ page: true, $component: { src: "src/routes/index.tsx?pick=default&pick=$css", build: () => import('../build/index2.mjs'), import: () => import('../build/index2.mjs') }, path: "/", filePath: "/Users/jalbarran/fun/drekki/pi-extensions/packages/pr-canvas/app/src/routes/index.tsx" }, { page: true, $component: { src: "src/routes/pr/[number].tsx?pick=default&pick=$css", build: () => import('../build/_number_2.mjs'), import: () => import('../build/_number_2.mjs') }, path: "/pr/:number", filePath: "/Users/jalbarran/fun/drekki/pi-extensions/packages/pr-canvas/app/src/routes/pr/[number].tsx" }], wt = bt(ee.filter((e) => e.page));
function bt(e) {
  function t(r, s, n, o) {
    const a = Object.values(r).find((i) => n.startsWith(i.id + "/"));
    return a ? (t(a.children || (a.children = []), s, n.slice(a.id.length)), r) : (r.push({ ...s, id: n, path: n.replace(/\([^)/]+\)/g, "").replace(/\/+/g, "/") }), r);
  }
  return e.sort((r, s) => r.path.length - s.path.length).reduce((r, s) => t(r, s, s.path, s.path), []);
}
function Rt(e, t) {
  const r = St.lookup(e);
  if (r && r.route) {
    const s = r.route, n = t === "HEAD" ? s.$HEAD || s.$GET : s[`$${t}`];
    if (n === void 0) return;
    const o = s.page === true && s.$component !== void 0;
    return { handler: n, params: r.params, isPage: o };
  }
}
function vt(e) {
  return e.$HEAD || e.$GET || e.$POST || e.$PUT || e.$PATCH || e.$DELETE;
}
const St = createRouter$1({ routes: ee.reduce((e, t) => {
  if (!vt(t)) return e;
  let r = t.path.replace(/\([^)/]+\)/g, "").replace(/\/+/g, "/").replace(/\*([^/]*)/g, (s, n) => `**:${n}`).split("/").map((s) => s.startsWith(":") || s.startsWith("*") ? s : encodeURIComponent(s)).join("/");
  if (/:[^/]*\?/g.test(r)) throw new Error(`Optional parameters are not supported in API routes: ${r}`);
  if (e[r]) throw new Error(`Duplicate API routes for "${r}" found at "${e[r].route.path}" and "${t.path}"`);
  return e[r] = { route: t }, e;
}, {}) }), H = "solidFetchEvent";
function Et(e) {
  return { request: mt(e), response: Tt(e), clientAddress: at(e), locals: {}, nativeEvent: e };
}
function $t(e) {
  if (!e.context[H]) {
    const t = Et(e);
    e.context[H] = t;
  }
  return e.context[H];
}
class At {
  constructor(t) {
    __publicField(this, "event");
    this.event = t;
  }
  get(t) {
    const r = W(this.event, t);
    return Array.isArray(r) ? r.join(", ") : r || null;
  }
  has(t) {
    return this.get(t) !== null;
  }
  set(t, r) {
    return ct(this.event, t, r);
  }
  delete(t) {
    return ft(this.event, t);
  }
  append(t, r) {
    ut(this.event, t, r);
  }
  getSetCookie() {
    const t = W(this.event, "Set-Cookie");
    return Array.isArray(t) ? t : [t];
  }
  forEach(t) {
    return Object.entries(L(this.event)).forEach(([r, s]) => t(Array.isArray(s) ? s.join(", ") : s, r, this));
  }
  entries() {
    return Object.entries(L(this.event)).map(([t, r]) => [t, Array.isArray(r) ? r.join(", ") : r])[Symbol.iterator]();
  }
  keys() {
    return Object.keys(L(this.event))[Symbol.iterator]();
  }
  values() {
    return Object.values(L(this.event)).map((t) => Array.isArray(t) ? t.join(", ") : t)[Symbol.iterator]();
  }
  [Symbol.iterator]() {
    return this.entries()[Symbol.iterator]();
  }
}
function Tt(e) {
  return { get status() {
    return D(e);
  }, set status(t) {
    O(e, t);
  }, get statusText() {
    return it(e);
  }, set statusText(t) {
    O(e, D(e), t);
  }, headers: new At(e) };
}
var kt = " ";
const xt = { style: (e) => ssrElement("style", e.attrs, () => e.children), link: (e) => ssrElement("link", e.attrs, void 0), script: (e) => e.attrs.src ? ssrElement("script", mergeProps(() => e.attrs, { get id() {
  return e.key;
} }), () => ssr(kt)) : null, noscript: (e) => ssrElement("noscript", e.attrs, () => escape(e.children)) };
function I(e, t) {
  let { tag: r, attrs: { key: s, ...n } = { key: void 0 }, children: o } = e;
  return xt[r]({ attrs: { ...n, nonce: t }, key: s, children: o });
}
function Pt(e, t, r, s = "default") {
  return lazy(async () => {
    var _a;
    {
      const o = (await e.import())[s], i = (await ((_a = t.inputs) == null ? void 0 : _a[e.src].assets())).filter((l) => l.tag === "style" || l.attrs.rel === "stylesheet");
      return { default: (l) => [...i.map((w) => I(w)), createComponent(o, l)] };
    }
  });
}
function te() {
  function e(r) {
    return { ...r, ...r.$$route ? r.$$route.require().route : void 0, info: { ...r.$$route ? r.$$route.require().route.info : {}, filesystem: true }, component: r.$component && Pt(r.$component, globalThis.MANIFEST.client, globalThis.MANIFEST.ssr), children: r.children ? r.children.map(e) : void 0 };
  }
  return wt.map(e);
}
const Lt = () => getRequestEvent().routes ;
function Ht(e) {
  const t = lt(e.nativeEvent, "flash");
  if (t) try {
    let r = JSON.parse(t);
    if (!r || !r.result) return;
    const s = [...r.input.slice(0, -1), new Map(r.input[r.input.length - 1])], n = r.error ? new Error(r.result) : r.result;
    return { input: s, url: r.url, pending: false, result: r.thrown ? void 0 : n, error: r.thrown ? n : void 0 };
  } catch (r) {
    console.error(r);
  } finally {
    dt(e.nativeEvent, "flash", "", { maxAge: 0 });
  }
}
async function qt(e) {
  const t = globalThis.MANIFEST.client;
  return globalThis.MANIFEST.ssr, e.response.headers.set("Content-Type", "text/html"), Object.assign(e, { manifest: await t.json(), assets: [...await t.inputs[t.handler].assets()], router: { submission: Ht(e) }, routes: te(), complete: false, $islands: /* @__PURE__ */ new Set() });
}
const Ot = /* @__PURE__ */ new Set([301, 302, 303, 307, 308]);
function U(e) {
  return e.status && Ot.has(e.status) ? e.status : 302;
}
function It(e, t, r = {}, s) {
  return eventHandler({ handler: (n) => {
    const o = $t(n);
    return provideRequestEvent(o, async () => {
      const a = Rt(new URL(o.request.url).pathname, o.request.method);
      if (a) {
        const f = await a.handler.import(), y = o.request.method === "HEAD" ? f.HEAD || f.GET : f[o.request.method];
        o.params = a.params || {}, sharedConfig.context = { event: o };
        const c = await y(o);
        if (c !== void 0) return c;
        if (o.request.method !== "GET") throw new Error(`API handler for ${o.request.method} "${o.request.url}" did not return a response.`);
        if (!a.isPage) return;
      }
      const i = await t(o), u = typeof r == "function" ? await r(i) : { ...r }, l = u.mode || "stream";
      if (u.nonce && (i.nonce = u.nonce), l === "sync") {
        const f = renderToString(() => (sharedConfig.context.event = i, e(i)), u);
        if (i.complete = true, i.response && i.response.headers.get("Location")) {
          const y = U(i.response);
          return B(n, i.response.headers.get("Location"), y);
        }
        return f;
      }
      if (u.onCompleteAll) {
        const f = u.onCompleteAll;
        u.onCompleteAll = (y) => {
          G(i)(y), f(y);
        };
      } else u.onCompleteAll = G(i);
      if (u.onCompleteShell) {
        const f = u.onCompleteShell;
        u.onCompleteShell = (y) => {
          z(i, n)(), f(y);
        };
      } else u.onCompleteShell = z(i, n);
      const w = renderToStream(() => (sharedConfig.context.event = i, e(i)), u);
      if (i.response && i.response.headers.get("Location")) {
        const f = U(i.response);
        return B(n, i.response.headers.get("Location"), f);
      }
      if (l === "async") return w;
      const { writable: S, readable: v } = new TransformStream();
      return w.pipeTo(S), v;
    });
  } });
}
function z(e, t) {
  return () => {
    if (e.response && e.response.headers.get("Location")) {
      const r = U(e.response);
      O(t, r), ht(t, "Location", e.response.headers.get("Location"));
    }
  };
}
function G(e) {
  return ({ write: t }) => {
    e.complete = true;
    const r = e.response && e.response.headers.get("Location");
    r && t(`<script>window.location="${r}"<\/script>`);
  };
}
function Ut(e, t, r) {
  return It(e, qt, t);
}
const re = (e) => (t) => {
  const { base: r } = t, s = children(() => t.children), n = createMemo(() => De(s(), t.base || ""));
  let o;
  const a = ut$1(e, n, () => o, { base: r, singleFlight: t.singleFlight, transformUrl: t.transformUrl });
  return e.create && e.create(a), createComponent(Fe.Provider, { value: a, get children() {
    return createComponent(Ft, { routerState: a, get root() {
      return t.root;
    }, get preload() {
      return t.rootPreload || t.rootLoad;
    }, get children() {
      return [(o = getOwner()) && null, createComponent(_t, { routerState: a, get branches() {
        return n();
      } })];
    } });
  } });
};
function Ft(e) {
  const t = e.routerState.location, r = e.routerState.params, s = createMemo(() => e.preload && untrack(() => {
    e.preload({ params: r, location: t, intent: lt$1() || "initial" });
  }));
  return createComponent(Show, { get when() {
    return e.root;
  }, keyed: true, get fallback() {
    return e.children;
  }, children: (n) => createComponent(n, { params: r, location: t, get data() {
    return s();
  }, get children() {
    return e.children;
  } }) });
}
function _t(e) {
  {
    const n = getRequestEvent();
    if (n && n.router && n.router.dataOnly) {
      Mt(n, e.routerState, e.branches);
      return;
    }
    n && ((n.router || (n.router = {})).matches || (n.router.matches = e.routerState.matches().map(({ route: o, path: a, params: i }) => ({ path: o.originalPath, pattern: o.pattern, match: a, params: i, info: o.info }))));
  }
  const t = [];
  let r;
  const s = createMemo(on$1(e.routerState.matches, (n, o, a) => {
    let i = o && n.length === o.length;
    const u = [];
    for (let l = 0, w = n.length; l < w; l++) {
      const S = o && o[l], v = n[l];
      a && S && v.route.key === S.route.key ? u[l] = a[l] : (i = false, t[l] && t[l](), createRoot((f) => {
        t[l] = f, u[l] = dt$1(e.routerState, u[l - 1] || e.routerState.base, J(() => s()[l + 1]), () => {
          var _a;
          const y = e.routerState.matches();
          return (_a = y[l]) != null ? _a : y[0];
        });
      }));
    }
    return t.splice(n.length).forEach((l) => l()), a && i ? a : (r = u[0], u);
  }));
  return J(() => s() && r)();
}
const J = (e) => () => createComponent(Show, { get when() {
  return e();
}, keyed: true, children: (t) => createComponent(ce.Provider, { value: t, get children() {
  return t.outlet();
} }) });
function Mt(e, t, r) {
  const s = new URL(e.request.url), n = F(r, new URL(e.router.previousUrl || e.request.url).pathname), o = F(r, s.pathname);
  for (let a = 0; a < o.length; a++) {
    (!n[a] || o[a].route !== n[a].route) && (e.router.dataOnly = true);
    const { route: i, params: u } = o[a];
    i.preload && i.preload({ params: u, location: t.location, intent: "preload" });
  }
}
function Bt(e) {
  const t = new URL(e);
  return t.pathname + t.search;
}
function Kt(e) {
  let t;
  const r = { value: e.url || (t = getRequestEvent()) && Bt(t.request.url) || "" };
  return re({ signal: [() => r, (s) => Object.assign(r, s)] })(e);
}
function Jt(e) {
  return Kt(e);
}
function Vt() {
  return createComponent(Jt, { root: (e) => createComponent(ft$1, { get children() {
    return createComponent(pt$1, { get children() {
      return createComponent(Suspense, { get children() {
        return e.children;
      } });
    } });
  } }), get children() {
    return createComponent(Lt, {});
  } });
}
const ne = (e) => {
  const t = getRequestEvent();
  return t.response.status = e.code, t.response.statusText = e.text, onCleanup(() => !t.nativeEvent.handled && !t.complete && (t.response.status = 200)), null;
} ;
var Yt = ["<span", ' style="font-size:1.5em;text-align:center;position:fixed;left:0px;bottom:55%;width:100%;">', "</span>"], Qt = ["<span", ' style="font-size:1.5em;text-align:center;position:fixed;left:0px;bottom:55%;width:100%;">500 | Internal Server Error</span>'];
const Xt = (e) => {
  const t = "500 | Internal Server Error" ;
  return createComponent(ErrorBoundary, { fallback: (r) => (console.error(r), [ssr(Yt, ssrHydrationKey(), escape(t)), createComponent(ne, { code: 500 })]), get children() {
    return e.children;
  } });
}, Zt = (e) => {
  let t = false;
  const r = catchError(() => e.children, (s) => {
    console.error(s), t = !!s;
  });
  return t ? [ssr(Qt, ssrHydrationKey()), createComponent(ne, { code: 500 })] : r;
};
var V = ["<script", ">", "<\/script>"], er = ["<script", ' type="module"', " async", "><\/script>"], tr = ["<script", ' type="module" async', "><\/script>"];
const rr = ssr("<!DOCTYPE html>");
function se(e, t, r = []) {
  for (let s = 0; s < t.length; s++) {
    const n = t[s];
    if (n.path !== e[0].path) continue;
    let o = [...r, n];
    if (n.children) {
      const a = e.slice(1);
      if (a.length === 0 || (o = se(a, n.children, o), !o)) continue;
    }
    return o;
  }
}
function nr(e) {
  const t = getRequestEvent(), r = t.nonce;
  let s = [];
  return Promise.resolve().then(async () => {
    let n = [];
    if (t.router && t.router.matches) {
      const o = [...t.router.matches];
      for (; o.length && (!o[0].info || !o[0].info.filesystem); ) o.shift();
      const a = o.length && se(o, t.routes);
      if (a) {
        const i = globalThis.MANIFEST.client.inputs;
        for (let u = 0; u < a.length; u++) {
          const l = a[u], w = i[l.$component.src];
          n.push(w.assets());
        }
      }
    }
    s = await Promise.all(n).then((o) => [...new Map(o.flat().map((a) => [a.attrs.key, a])).values()].filter((a) => a.attrs.rel === "modulepreload" && !t.assets.find((i) => i.attrs.key === a.attrs.key)));
  }), useAssets(() => s.length ? s.map((n) => I(n)) : void 0), createComponent(NoHydration, { get children() {
    return [rr, createComponent(Zt, { get children() {
      return createComponent(e.document, { get assets() {
        return [createComponent(HydrationScript, {}), t.assets.map((n) => I(n, r))];
      }, get scripts() {
        return r ? [ssr(V, ssrHydrationKey() + ssrAttribute("nonce", escape(r, true), false), `window.manifest = ${JSON.stringify(t.manifest)}`), ssr(er, ssrHydrationKey(), ssrAttribute("nonce", escape(r, true), false), ssrAttribute("src", escape(globalThis.MANIFEST.client.inputs[globalThis.MANIFEST.client.handler].output.path, true), false))] : [ssr(V, ssrHydrationKey(), `window.manifest = ${JSON.stringify(t.manifest)}`), ssr(tr, ssrHydrationKey(), ssrAttribute("src", escape(globalThis.MANIFEST.client.inputs[globalThis.MANIFEST.client.handler].output.path, true), false))];
      }, get children() {
        return createComponent(Hydration, { get children() {
          return createComponent(Xt, { get children() {
            return createComponent(Vt, {});
          } });
        } });
      } });
    } })];
  } });
}
var sr = ['<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/favicon.ico">', "</head>"], or = ["<html", ' lang="en">', '<body><div id="app">', "</div><!--$-->", "<!--/--></body></html>"];
const mr = Ut(() => createComponent(nr, { document: ({ assets: e, children: t, scripts: r }) => ssr(or, ssrHydrationKey(), createComponent(NoHydration, { get children() {
  return ssr(sr, escape(e));
} }), escape(t), escape(r)) }));

const handlers = [
  { route: '', handler: _gZdetY, lazy: false, middleware: true, method: undefined },
  { route: '/_server', handler: Lt$1, lazy: false, middleware: true, method: undefined },
  { route: '/', handler: mr, lazy: false, middleware: true, method: undefined }
];

function createNitroApp() {
  const config = useRuntimeConfig();
  const hooks = createHooks();
  const captureError = (error, context = {}) => {
    const promise = hooks.callHookParallel("error", error, context).catch((error_) => {
      console.error("Error while capturing another error", error_);
    });
    if (context.event && isEvent(context.event)) {
      const errors = context.event.context.nitro?.errors;
      if (errors) {
        errors.push({ error, context });
      }
      if (context.event.waitUntil) {
        context.event.waitUntil(promise);
      }
    }
  };
  const h3App = createApp({
    debug: destr(false),
    onError: (error, event) => {
      captureError(error, { event, tags: ["request"] });
      return errorHandler(error, event);
    },
    onRequest: async (event) => {
      event.context.nitro = event.context.nitro || { errors: [] };
      const fetchContext = event.node.req?.__unenv__;
      if (fetchContext?._platform) {
        event.context = {
          _platform: fetchContext?._platform,
          // #3335
          ...fetchContext._platform,
          ...event.context
        };
      }
      if (!event.context.waitUntil && fetchContext?.waitUntil) {
        event.context.waitUntil = fetchContext.waitUntil;
      }
      event.fetch = (req, init) => fetchWithEvent(event, req, init, { fetch: localFetch });
      event.$fetch = (req, init) => fetchWithEvent(event, req, init, {
        fetch: $fetch
      });
      event.waitUntil = (promise) => {
        if (!event.context.nitro._waitUntilPromises) {
          event.context.nitro._waitUntilPromises = [];
        }
        event.context.nitro._waitUntilPromises.push(promise);
        if (event.context.waitUntil) {
          event.context.waitUntil(promise);
        }
      };
      event.captureError = (error, context) => {
        captureError(error, { event, ...context });
      };
      await nitroApp$1.hooks.callHook("request", event).catch((error) => {
        captureError(error, { event, tags: ["request"] });
      });
    },
    onBeforeResponse: async (event, response) => {
      await nitroApp$1.hooks.callHook("beforeResponse", event, response).catch((error) => {
        captureError(error, { event, tags: ["request", "response"] });
      });
    },
    onAfterResponse: async (event, response) => {
      await nitroApp$1.hooks.callHook("afterResponse", event, response).catch((error) => {
        captureError(error, { event, tags: ["request", "response"] });
      });
    }
  });
  const router = createRouter({
    preemptive: true
  });
  const nodeHandler = toNodeListener(h3App);
  const localCall = (aRequest) => b$1(
    nodeHandler,
    aRequest
  );
  const localFetch = (input, init) => {
    if (!input.toString().startsWith("/")) {
      return globalThis.fetch(input, init);
    }
    return C$2(
      nodeHandler,
      input,
      init
    ).then((response) => normalizeFetchResponse(response));
  };
  const $fetch = createFetch({
    fetch: localFetch,
    Headers: Headers$1,
    defaults: { baseURL: config.app.baseURL }
  });
  globalThis.$fetch = $fetch;
  h3App.use(createRouteRulesHandler({ localFetch }));
  for (const h of handlers) {
    let handler = h.lazy ? lazyEventHandler(h.handler) : h.handler;
    if (h.middleware || !h.route) {
      const middlewareBase = (config.app.baseURL + (h.route || "/")).replace(
        /\/+/g,
        "/"
      );
      h3App.use(middlewareBase, handler);
    } else {
      const routeRules = getRouteRulesForPath(
        h.route.replace(/:\w+|\*\*/g, "_")
      );
      if (routeRules.cache) {
        handler = cachedEventHandler(handler, {
          group: "nitro/routes",
          ...routeRules.cache
        });
      }
      router.use(h.route, handler, h.method);
    }
  }
  h3App.use(config.app.baseURL, router.handler);
  {
    const _handler = h3App.handler;
    h3App.handler = (event) => {
      const ctx = { event };
      return nitroAsyncContext.callAsync(ctx, () => _handler(event));
    };
  }
  const app = {
    hooks,
    h3App,
    router,
    localCall,
    localFetch,
    captureError
  };
  return app;
}
function runNitroPlugins(nitroApp2) {
  for (const plugin of plugins) {
    try {
      plugin(nitroApp2);
    } catch (error) {
      nitroApp2.captureError(error, { tags: ["plugin"] });
      throw error;
    }
  }
}
const nitroApp$1 = createNitroApp();
function useNitroApp() {
  return nitroApp$1;
}
runNitroPlugins(nitroApp$1);

const debug = (...args) => {
};
function GracefulShutdown(server, opts) {
  opts = opts || {};
  const options = Object.assign(
    {
      signals: "SIGINT SIGTERM",
      timeout: 3e4,
      development: false,
      forceExit: true,
      onShutdown: (signal) => Promise.resolve(signal),
      preShutdown: (signal) => Promise.resolve(signal)
    },
    opts
  );
  let isShuttingDown = false;
  const connections = {};
  let connectionCounter = 0;
  const secureConnections = {};
  let secureConnectionCounter = 0;
  let failed = false;
  let finalRun = false;
  function onceFactory() {
    let called = false;
    return (emitter, events, callback) => {
      function call() {
        if (!called) {
          called = true;
          return Reflect.apply(callback, this, arguments);
        }
      }
      for (const e of events) {
        emitter.on(e, call);
      }
    };
  }
  const signals = options.signals.split(" ").map((s) => s.trim()).filter((s) => s.length > 0);
  const once = onceFactory();
  once(process, signals, (signal) => {
    debug("received shut down signal", signal);
    shutdown(signal).then(() => {
      if (options.forceExit) {
        process.exit(failed ? 1 : 0);
      }
    }).catch((error) => {
      debug("server shut down error occurred", error);
      process.exit(1);
    });
  });
  function isFunction(functionToCheck) {
    const getType = Object.prototype.toString.call(functionToCheck);
    return /^\[object\s([A-Za-z]+)?Function]$/.test(getType);
  }
  function destroy(socket, force = false) {
    if (socket._isIdle && isShuttingDown || force) {
      socket.destroy();
      if (socket.server instanceof http.Server) {
        delete connections[socket._connectionId];
      } else {
        delete secureConnections[socket._connectionId];
      }
    }
  }
  function destroyAllConnections(force = false) {
    debug("Destroy Connections : " + (force ? "forced close" : "close"));
    let counter = 0;
    let secureCounter = 0;
    for (const key of Object.keys(connections)) {
      const socket = connections[key];
      const serverResponse = socket._httpMessage;
      if (serverResponse && !force) {
        if (!serverResponse.headersSent) {
          serverResponse.setHeader("connection", "close");
        }
      } else {
        counter++;
        destroy(socket);
      }
    }
    debug("Connections destroyed : " + counter);
    debug("Connection Counter    : " + connectionCounter);
    for (const key of Object.keys(secureConnections)) {
      const socket = secureConnections[key];
      const serverResponse = socket._httpMessage;
      if (serverResponse && !force) {
        if (!serverResponse.headersSent) {
          serverResponse.setHeader("connection", "close");
        }
      } else {
        secureCounter++;
        destroy(socket);
      }
    }
    debug("Secure Connections destroyed : " + secureCounter);
    debug("Secure Connection Counter    : " + secureConnectionCounter);
  }
  server.on("request", (req, res) => {
    req.socket._isIdle = false;
    if (isShuttingDown && !res.headersSent) {
      res.setHeader("connection", "close");
    }
    res.on("finish", () => {
      req.socket._isIdle = true;
      destroy(req.socket);
    });
  });
  server.on("connection", (socket) => {
    if (isShuttingDown) {
      socket.destroy();
    } else {
      const id = connectionCounter++;
      socket._isIdle = true;
      socket._connectionId = id;
      connections[id] = socket;
      socket.once("close", () => {
        delete connections[socket._connectionId];
      });
    }
  });
  server.on("secureConnection", (socket) => {
    if (isShuttingDown) {
      socket.destroy();
    } else {
      const id = secureConnectionCounter++;
      socket._isIdle = true;
      socket._connectionId = id;
      secureConnections[id] = socket;
      socket.once("close", () => {
        delete secureConnections[socket._connectionId];
      });
    }
  });
  process.on("close", () => {
    debug("closed");
  });
  function shutdown(sig) {
    function cleanupHttp() {
      destroyAllConnections();
      debug("Close http server");
      return new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) {
            return reject(err);
          }
          return resolve(true);
        });
      });
    }
    debug("shutdown signal - " + sig);
    if (options.development) {
      debug("DEV-Mode - immediate forceful shutdown");
      return process.exit(0);
    }
    function finalHandler() {
      if (!finalRun) {
        finalRun = true;
        if (options.finally && isFunction(options.finally)) {
          debug("executing finally()");
          options.finally();
        }
      }
      return Promise.resolve();
    }
    function waitForReadyToShutDown(totalNumInterval) {
      debug(`waitForReadyToShutDown... ${totalNumInterval}`);
      if (totalNumInterval === 0) {
        debug(
          `Could not close connections in time (${options.timeout}ms), will forcefully shut down`
        );
        return Promise.resolve(true);
      }
      const allConnectionsClosed = Object.keys(connections).length === 0 && Object.keys(secureConnections).length === 0;
      if (allConnectionsClosed) {
        debug("All connections closed. Continue to shutting down");
        return Promise.resolve(false);
      }
      debug("Schedule the next waitForReadyToShutdown");
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(waitForReadyToShutDown(totalNumInterval - 1));
        }, 250);
      });
    }
    if (isShuttingDown) {
      return Promise.resolve();
    }
    debug("shutting down");
    return options.preShutdown(sig).then(() => {
      isShuttingDown = true;
      cleanupHttp();
    }).then(() => {
      const pollIterations = options.timeout ? Math.round(options.timeout / 250) : 0;
      return waitForReadyToShutDown(pollIterations);
    }).then((force) => {
      debug("Do onShutdown now");
      if (force) {
        destroyAllConnections(force);
      }
      return options.onShutdown(sig);
    }).then(finalHandler).catch((error) => {
      const errString = typeof error === "string" ? error : JSON.stringify(error);
      debug(errString);
      failed = true;
      throw errString;
    });
  }
  function shutdownManual() {
    return shutdown("manual");
  }
  return shutdownManual;
}

function getGracefulShutdownConfig() {
  return {
    disabled: !!process.env.NITRO_SHUTDOWN_DISABLED,
    signals: (process.env.NITRO_SHUTDOWN_SIGNALS || "SIGTERM SIGINT").split(" ").map((s) => s.trim()),
    timeout: Number.parseInt(process.env.NITRO_SHUTDOWN_TIMEOUT || "", 10) || 3e4,
    forceExit: !process.env.NITRO_SHUTDOWN_NO_FORCE_EXIT
  };
}
function setupGracefulShutdown(listener, nitroApp) {
  const shutdownConfig = getGracefulShutdownConfig();
  if (shutdownConfig.disabled) {
    return;
  }
  GracefulShutdown(listener, {
    signals: shutdownConfig.signals.join(" "),
    timeout: shutdownConfig.timeout,
    forceExit: shutdownConfig.forceExit,
    onShutdown: async () => {
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn("Graceful shutdown timeout, force exiting...");
          resolve();
        }, shutdownConfig.timeout);
        nitroApp.hooks.callHook("close").catch((error) => {
          console.error(error);
        }).finally(() => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  });
}

const cert = process.env.NITRO_SSL_CERT;
const key = process.env.NITRO_SSL_KEY;
const nitroApp = useNitroApp();
const server = cert && key ? new Server({ key, cert }, toNodeListener(nitroApp.h3App)) : new Server$1(toNodeListener(nitroApp.h3App));
const port = destr(process.env.NITRO_PORT || process.env.PORT) || 3e3;
const host = process.env.NITRO_HOST || process.env.HOST;
const path = process.env.NITRO_UNIX_SOCKET;
const listener = server.listen(path ? { path } : { port, host }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  const protocol = cert && key ? "https" : "http";
  const addressInfo = listener.address();
  if (typeof addressInfo === "string") {
    console.log(`Listening on unix socket ${addressInfo}`);
    return;
  }
  const baseURL = (useRuntimeConfig().app.baseURL || "").replace(/\/$/, "");
  const url = `${protocol}://${addressInfo.family === "IPv6" ? `[${addressInfo.address}]` : addressInfo.address}:${addressInfo.port}${baseURL}`;
  console.log(`Listening on ${url}`);
});
trapUnhandledNodeErrors();
setupGracefulShutdown(listener, nitroApp);
const nodeServer = {};

export { A, splitProps as B, ssr as C, ssrAttribute as D, ssrElement as E, For as F, ssrHydrationKey as G, st$1 as H, startTransition as I, untrack as J, useAssets as K, useContext as L, Show as S, Ft$1 as a, Suspense as b, at$1 as c, batch as d, children as e, createComponent as f, createContext as g, createMemo as h, createRenderEffect as i, createRoot as j, createSignal as k, createStore as l, createUniqueId as m, ct$1 as n, escape as o, getOwner as p, getRequestEvent as q, ht$1 as r, isServer as s, it$1 as t, mergeProps as u, mt$1 as v, nodeServer as w, on$1 as x, onCleanup as y, runWithOwner as z };
//# sourceMappingURL=nitro.mjs.map
