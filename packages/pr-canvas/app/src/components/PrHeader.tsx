import { A } from '@solidjs/router';
import Icon from '~/components/Icon';
import type { PrOverview } from '~/lib/types';

interface PrHeaderProps {
  pr: PrOverview;
}

const stateClass = (state: string) => `state-pill state-${state.toLowerCase()}`;

export default function PrHeader(props: PrHeaderProps) {
  return (
    <header class="pr-header">
      <div class="pr-header-main">
        <span class="pr-header-number">#{props.pr.number}</span>
        <h1 class="pr-header-title" title={props.pr.title}>
          {props.pr.title}
        </h1>
        <span class={stateClass(props.pr.state)}>{props.pr.state}</span>
      </div>

      <div class="pr-header-meta">
        <span class="pr-header-branch" title={`${props.pr.baseRefName} ← ${props.pr.headRefName}`}>
          <Icon name="branch" size={14} />
          {props.pr.baseRefName} ← {props.pr.headRefName}
        </span>
        <span class="pr-header-stats">
          <span class="stat-add">+{props.pr.additions}</span>
          <span class="stat-del">−{props.pr.deletions}</span>
        </span>
        <a class="pr-header-link" href={props.pr.url} target="_blank" rel="noreferrer">
          GitHub
          <Icon name="external" size={14} />
        </a>
        <A href="/" class="pr-header-back">
          <Icon name="back" size={15} />
          <span>All PRs</span>
        </A>
      </div>
    </header>
  );
}
