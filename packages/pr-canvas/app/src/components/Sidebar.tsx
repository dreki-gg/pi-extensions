import { A } from '@solidjs/router';
import { For, createSignal, onCleanup, onMount } from 'solid-js';

export interface SidebarSection {
  id: string;
  label: string;
  icon: string;
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
      { rootMargin: '-20% 0px -65% 0px', threshold: [0.1, 0.25, 0.5] },
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
      <A href="/" class="sidebar-dashboard-link">
        ← Dashboard
      </A>
      <nav class="sidebar-nav" aria-label="Pull request sections">
        <For each={props.sections}>
          {(section) => (
            <button
              type="button"
              class="sidebar-nav-link"
              classList={{ 'sidebar-nav-link-active': activeSection() === section.id }}
              onClick={() => scrollToSection(section.id)}
            >
              <span class="sidebar-nav-icon" aria-hidden="true">{section.icon}</span>
              <span class="sidebar-nav-label">{section.label}</span>
            </button>
          )}
        </For>
      </nav>
    </aside>
  );
}
