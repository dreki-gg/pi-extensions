import { A, useLocation } from '@solidjs/router';
import { For, Show } from 'solid-js';
import Icon, { type IconName } from '~/components/Icon';

export type BadgeTone = 'default' | 'success' | 'danger' | 'warning';

interface PrTabsProps {
  prNumber: number;
  fileCount: number;
  groupCount: number;
  failingChecks: number;
  passingChecks: number;
}

interface TabDef {
  label: string;
  icon: IconName;
  href: string;
  end: boolean;
  badge?: { text: string; tone: BadgeTone };
}

export default function PrTabs(props: PrTabsProps) {
  const location = useLocation();
  const base = () => `/pr/${props.prNumber}`;

  const tabs = (): TabDef[] => {
    const checkBadge =
      props.failingChecks > 0
        ? { text: String(props.failingChecks), tone: 'danger' as const }
        : props.passingChecks > 0
          ? { text: String(props.passingChecks), tone: 'success' as const }
          : undefined;
    return [
      { label: 'Overview', icon: 'overview', href: base(), end: true },
      {
        label: 'Files changed',
        icon: 'files',
        href: `${base()}/files`,
        end: false,
        badge: props.fileCount ? { text: String(props.fileCount), tone: 'default' } : undefined,
      },
      {
        label: 'Mind Map',
        icon: 'mind-map',
        href: `${base()}/mind-map`,
        end: false,
        badge: props.groupCount ? { text: String(props.groupCount), tone: 'default' } : undefined,
      },
      {
        label: 'PR Checks',
        icon: 'checks',
        href: `${base()}/checks`,
        end: false,
        badge: checkBadge,
      },
    ];
  };

  const isActive = (href: string, end: boolean) => {
    const path = location.pathname.replace(/\/$/, '');
    const target = href.replace(/\/$/, '');
    return end ? path === target : path === target || path.startsWith(`${target}/`);
  };

  return (
    <nav class="pr-tabs" aria-label="Pull request views">
      <For each={tabs()}>
        {(tab) => (
          <A
            href={tab.href}
            class="pr-tab"
            classList={{ 'pr-tab-active': isActive(tab.href, tab.end) }}
            aria-current={isActive(tab.href, tab.end) ? 'page' : undefined}
          >
            <span class="pr-tab-icon">
              <Icon name={tab.icon} size={16} />
            </span>
            <span class="pr-tab-label">{tab.label}</span>
            <Show when={tab.badge}>
              {(badge) => (
                <span class="sidebar-badge" data-tone={badge().tone}>
                  {badge().text}
                </span>
              )}
            </Show>
          </A>
        )}
      </For>
    </nav>
  );
}
