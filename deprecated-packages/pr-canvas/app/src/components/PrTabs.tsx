import { A, useLocation } from '@solidjs/router';
import { For, Show } from 'solid-js';
import Icon, { type IconName } from '~/components/Icon';

export type BadgeTone = 'default' | 'success' | 'danger' | 'warning';

const badgeToneClass = (tone: BadgeTone) =>
  tone === 'success' ? 'badge-success' : tone === 'danger' ? 'badge-danger' : tone === 'warning' ? 'badge-warning' : '';

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
    <nav class="flex shrink-0 items-stretch gap-1 overflow-x-auto bg-bg-secondary px-2 lg:px-4 border-b border-border" aria-label="Pull request views">
      <For each={tabs()}>
        {(tab) => (
          <A
            href={tab.href}
            class="relative inline-flex flex-shrink-0 items-center gap-2 px-3.5 py-[11px] font-semibold text-text-secondary border-b-2 border-transparent hover:text-text-primary hover:no-underline"
            classList={{ 'text-text-primary border-accent': isActive(tab.href, tab.end) }}
            aria-current={isActive(tab.href, tab.end) ? 'page' : undefined}
          >
            <span class="inline-flex shrink-0">
              <Icon name={tab.icon} size={16} />
            </span>
            <span class="hidden sm:inline">{tab.label}</span>
            <Show when={tab.badge}>
              {(badge) => (
                <span class={`badge badge-compact ${badgeToneClass(badge().tone)}`}>
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
