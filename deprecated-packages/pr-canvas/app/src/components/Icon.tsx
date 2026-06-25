import type { JSX } from 'solid-js';

// A single consistent line-icon family (24x24, 1.5 stroke, round joins).
// Replaces emoji throughout the UI so glyphs align, theme, and scale cleanly.
export type IconName =
  | 'overview'
  | 'files'
  | 'mind-map'
  | 'diff'
  | 'checks'
  | 'comments'
  | 'summary'
  | 'user'
  | 'branch'
  | 'external'
  | 'close'
  | 'send'
  | 'back'
  | 'robot'
  | 'warning'
  | 'check'
  | 'cross'
  | 'dot';

const PATHS: Record<IconName, JSX.Element> = {
  overview: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <line x1="8" y1="8" x2="16" y2="8" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="13" y2="16" />
    </>
  ),
  files: (
    <path d="M4 6a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" />
  ),
  'mind-map': (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="9" r="2.5" />
      <circle cx="9" cy="18" r="2.5" />
      <line x1="8.3" y1="7" x2="15.7" y2="8.2" />
      <line x1="6.6" y1="8.4" x2="8.4" y2="15.6" />
    </>
  ),
  diff: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <line x1="9" y1="9" x2="9" y2="13" />
      <line x1="7" y1="11" x2="11" y2="11" />
      <line x1="13" y1="16" x2="17" y2="16" />
    </>
  ),
  checks: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.4 2.4 4.6-5" />
    </>
  ),
  comments: <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z" />,
  summary: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  branch: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="8" r="2.5" />
      <path d="M6 8.5v7" />
      <path d="M18 10.5a6 6 0 0 1-6 6H6" />
    </>
  ),
  external: (
    <>
      <path d="M14 5h5v5" />
      <path d="M19 5l-8 8" />
      <path d="M18 13.5V18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4.5" />
    </>
  ),
  close: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  send: (
    <>
      <path d="M21 4L3 11l7 3 3 7 8-17z" />
      <path d="M10 14l4-4" />
    </>
  ),
  back: (
    <>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="11 18 5 12 11 6" />
    </>
  ),
  robot: (
    <>
      <rect x="5" y="8" width="14" height="11" rx="2.5" />
      <line x1="12" y1="4.5" x2="12" y2="8" />
      <circle cx="12" cy="4" r="1" />
      <line x1="9.5" y1="13" x2="9.5" y2="14.5" />
      <line x1="14.5" y1="13" x2="14.5" y2="14.5" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4l9 16H3z" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <circle cx="12" cy="17" r="0.7" />
    </>
  ),
  check: <polyline points="5 12.5 10 17.5 19 7" />,
  cross: (
    <>
      <line x1="7" y1="7" x2="17" y2="17" />
      <line x1="17" y1="7" x2="7" y2="17" />
    </>
  ),
  dot: <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />,
};

interface IconProps {
  name: IconName;
  size?: number;
  class?: string;
}

export default function Icon(props: IconProps) {
  return (
    <svg
      class={props.class}
      width={props.size ?? 18}
      height={props.size ?? 18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {PATHS[props.name]}
    </svg>
  );
}
