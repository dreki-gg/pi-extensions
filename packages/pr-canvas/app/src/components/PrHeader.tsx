import { A } from '@solidjs/router';
import Icon from '~/components/Icon';
import type { PrOverview } from '~/lib/types';

interface PrHeaderProps {
  pr: PrOverview;
}

const stateClass = (state: string) =>
  `badge ${['open', 'merged'].includes(state.toLowerCase()) ? 'badge-success' : state.toLowerCase() === 'closed' ? 'badge-danger' : ''}`;

export default function PrHeader(props: PrHeaderProps) {
  return (
    <header class="flex shrink-0 flex-wrap items-center justify-between gap-2.5 bg-bg-secondary px-4 py-3 lg:flex-nowrap lg:gap-5 lg:px-6 lg:py-3.5 border-b border-border">
      <div class="flex min-w-0 items-center gap-3">
        <span class="shrink-0 text-text-muted tabular-nums">#{props.pr.number}</span>
        <h1 class="m-0 truncate text-base font-semibold tracking-tight" title={props.pr.title}>
          {props.pr.title}
        </h1>
        <span class={stateClass(props.pr.state)}>{props.pr.state}</span>
      </div>

      <div class="flex shrink-0 items-center gap-3 lg:gap-[18px]">
        <span class="inline-flex max-w-[340px] items-center gap-1.5 truncate font-mono text-xs text-text-secondary" title={`${props.pr.baseRefName} ← ${props.pr.headRefName}`}>
          <Icon name="branch" size={14} />
          {props.pr.baseRefName} ← {props.pr.headRefName}
        </span>
        <span class="inline-flex gap-2 font-mono font-semibold tabular-nums">
          <span class="text-green">+{props.pr.additions}</span>
          <span class="text-red">−{props.pr.deletions}</span>
        </span>
        <a class="inline-flex items-center gap-1.5 font-semibold text-text-secondary hover:text-accent hover:no-underline" href={props.pr.url} target="_blank" rel="noreferrer">
          GitHub
          <Icon name="external" size={14} />
        </a>
        <A href="/" class="inline-flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1.5 font-semibold text-text-secondary hover:border-border-light hover:bg-bg-tertiary hover:text-text-primary hover:no-underline">
          <Icon name="back" size={15} />
          <span>All PRs</span>
        </A>
      </div>
    </header>
  );
}
