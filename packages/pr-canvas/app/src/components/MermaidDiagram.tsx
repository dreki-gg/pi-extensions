import { Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js';

interface MermaidDiagramProps {
  source: string;
  class?: string;
}

interface MermaidApi {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, source: string) => Promise<{ svg: string }>;
}

let mermaidPromise: Promise<MermaidApi> | undefined;
let renderId = 0;

const importExternal = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<{ default: MermaidApi }>;

function loadMermaid(): Promise<MermaidApi> {
  mermaidPromise ??= importExternal('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs')
    .then((module) => module.default)
    .then((mermaid) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        htmlLabels: false,
        theme: 'dark',
        themeVariables: {
          darkMode: true,
          background: '#161b22',
          mainBkg: '#1c2128',
          primaryColor: '#1c2128',
          primaryTextColor: '#e6edf3',
          primaryBorderColor: '#3d444d',
          lineColor: '#58a6ff',
          secondaryColor: '#0d1117',
          tertiaryColor: '#161b22',
        },
      });
      return mermaid;
    });
  return mermaidPromise;
}

export default function MermaidDiagram(props: MermaidDiagramProps) {
  const [svg, setSvg] = createSignal('');
  const [error, setError] = createSignal('');
  const [mounted, setMounted] = createSignal(false);
  let disposed = false;

  onMount(() => setMounted(true));
  onCleanup(() => {
    disposed = true;
  });

  createEffect(() => {
    if (!mounted()) return;
    const source = props.source?.trim();
    if (!source) return;

    const id = `pr-canvas-mermaid-${++renderId}`;
    setSvg('');
    setError('');

    void loadMermaid()
      .then((mermaid) => mermaid.render(id, source))
      .then((result) => {
        if (!disposed) setSvg(result.svg);
      })
      .catch((err) => {
        if (!disposed) setError(err instanceof Error ? err.message : String(err));
      });
  });

  return (
    <div class={`mermaid-card ${props.class ?? ''}`}>
      <Show when={svg()} fallback={
        <pre class="mermaid-source"><code>{props.source}</code></pre>
      }>
        <div class="mermaid-rendered" innerHTML={svg()} />
      </Show>
      <Show when={error()}>
        <p class="mermaid-error">Mermaid render failed. Showing source above. {error()}</p>
      </Show>
    </div>
  );
}
