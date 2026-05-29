import { createSignal, onMount } from 'solid-js';

const DIFFS_CDN = 'https://cdn.jsdelivr.net/npm/@pierre/diffs@1.2.4/+esm';

type DiffLayout = 'stacked' | 'split';

interface DiffPreviewProps {
  rawDiff: string;
}

export default function DiffPreview(props: DiffPreviewProps) {
  let containerRef: HTMLDivElement | undefined;
  let codeView: any;
  let parsedFiles: unknown;
  const [layout, setLayout] = createSignal<DiffLayout>('stacked');

  const renderDiff = () => {
    if (!containerRef || !codeView || !parsedFiles) return;
    containerRef.replaceChildren();
    new codeView(containerRef, {
      files: parsedFiles,
      layout: layout(),
      theme: 'github-dark',
      defaultCollapsed: true,
      collapsed: true,
    });
  };

  onMount(async () => {
    if (!containerRef) return;

    const module = await import(/* @vite-ignore */ DIFFS_CDN);
    codeView = module.CodeView;
    parsedFiles = module.parsePatchFiles(props.rawDiff);
    renderDiff();
  });

  const toggleLayout = () => {
    setLayout((current) => (current === 'stacked' ? 'split' : 'stacked'));
    renderDiff();
  };

  return (
    <section id="section-diff-preview" class="canvas-section diff-preview-section">
      <div class="section-header">
        <h2 class="section-title">Diffs</h2>
        <button type="button" class="diff-layout-toggle" onClick={toggleLayout}>
          {layout() === 'stacked' ? 'Split view' : 'Unified view'}
        </button>
      </div>
      <div ref={containerRef} class="pr-card diff-preview-container" />
    </section>
  );
}
