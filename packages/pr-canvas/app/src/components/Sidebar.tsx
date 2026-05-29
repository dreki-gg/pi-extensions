import { A } from '@solidjs/router';
import { For, Show, createSignal, onCleanup, onMount } from 'solid-js';
import Icon, { type IconName } from '~/components/Icon';

export type BadgeTone = 'default' | 'success' | 'danger' | 'warning';

export interface SidebarSection {
  id: string;
  label: string;
  icon: IconName;
  badge?: { text: string; tone: BadgeTone };
}

interface SidebarProps {
  sections: SidebarSection[];
}

export default function Sidebar(props: SidebarProps) {
  const [activeSection, setActiveSection] = createSignal(props.sections[0]?.id ?? '');

  onMount(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible?.target.id) {
          setActiveSection(visible.target.id);
        }
      },
      { rootMargin: '-25% 0px -65% 0px', threshold: [0.1, 0.25, 0.5] },
    );

    for (const section of props.sections) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }

    onCleanup(() => observer.disconnect());
  });

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <aside class="canvas-sidebar">
      <A href="/" class="sidebar-back">
        <Icon name="back" size={16} />
        <span>All pull requests</span>
      </A>

      <nav class="sidebar-nav" aria-label="Pull request sections">
        <For each={props.sections}>
          {(section) => (
            <button
              type="button"
              class="sidebar-nav-link"
              classList={{ 'sidebar-nav-link-active': activeSection() === section.id }}
              aria-current={activeSection() === section.id ? 'true' : undefined}
              onClick={() => scrollToSection(section.id)}
            >
              <span class="sidebar-nav-icon">
                <Icon name={section.icon} size={18} />
              </span>
              <span class="sidebar-nav-label">{section.label}</span>
              <Show when={section.badge}>
                {(badge) => (
                  <span class="sidebar-badge" data-tone={badge().tone}>
                    {badge().text}
                  </span>
                )}
              </Show>
            </button>
          )}
        </For>
      </nav>
    </aside>
  );
}
