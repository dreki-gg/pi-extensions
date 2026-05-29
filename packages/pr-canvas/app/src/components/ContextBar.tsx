import Icon from '~/components/Icon';
import type { PrOverview } from '~/lib/types';

interface ContextBarProps {
  pr: PrOverview;
}

const stateClass = (state: string) => `state-pill state-${state.toLowerCase()}`;

export default function ContextBar(props: ContextBarProps) {
  return (
    <header class="context-bar">
      <div class="context-bar-main">
        <span class="context-bar-number">#{props.pr.number}</span>
        <h1 class="context-bar-title" title={props.pr.title}>
          {props.pr.title}
        </h1>
      </div>

      <div class="context-bar-meta">
        <span class={stateClass(props.pr.state)}>{props.pr.state}</span>
        <span class="context-bar-branch">
          <Icon name="branch" size={14} />
          {props.pr.baseRefName} ← {props.pr.headRefName}
        </span>
        <span class="context-bar-stats">
          <span class="stat-add">+{props.pr.additions}</span>
          <span class="stat-del">−{props.pr.deletions}</span>
        </span>
        <a class="context-bar-link" href={props.pr.url} target="_blank" rel="noreferrer">
          GitHub
          <Icon name="external" size={14} />
        </a>
      </div>
    </header>
  );
}
