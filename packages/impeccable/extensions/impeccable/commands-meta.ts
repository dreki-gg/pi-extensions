// Command catalog for the /impeccable router. Descriptions + argument hints
// are ported from upstream impeccable (skill/scripts/command-metadata.json).
// Apache-2.0 (c) Paul Bakaus; see NOTICE.

export type ImpeccableCategory = 'Build' | 'Evaluate' | 'Refine' | 'Enhance' | 'Fix';

export interface ImpeccableCommand {
  command: string;
  category: ImpeccableCategory;
  argumentHint: string;
  description: string;
}

export const IMPECCABLE_COMMANDS: ImpeccableCommand[] = [
  {
    command: 'craft',
    category: 'Build',
    argumentHint: '[feature description]',
    description:
      'Full confirmed-brief-then-build flow. Runs multi-round shape discovery first, resolves visual probe and north-star mock gates when available, then builds and visually iterates. Use when building a new feature end-to-end.',
  },
  {
    command: 'shape',
    category: 'Build',
    argumentHint: '[feature to shape]',
    description:
      'Plan UX and UI before code. Runs a required multi-round discovery interview, uses visual probes when available, and produces a user-confirmed design brief for implementation.',
  },
  {
    command: 'init',
    category: 'Build',
    argumentHint: '',
    description:
      'Sets up a project for impeccable. Runs a multi-round discovery interview when context is missing and writes PRODUCT.md (strategic: users, brand, principles); offers DESIGN.md (visual: colors, typography, components) when code exists; pre-configures live mode; then recommends the best commands to run next. Every other command reads these files before doing work. Use once per project.',
  },
  {
    command: 'document',
    category: 'Build',
    argumentHint: '',
    description:
      'Generate a DESIGN.md file that captures the current visual design system. Auto-extracts colors, typography, spacing, radii, and component patterns from the codebase, then asks the user to confirm descriptive language for atmosphere and color character. Follows the Google Stitch DESIGN.md format so the file is tool-compatible. Use when you need a visual design spec an AI agent can follow to stay on-brand.',
  },
  {
    command: 'extract',
    category: 'Build',
    argumentHint: '[target]',
    description:
      'Pull reusable patterns, components, and design tokens into the design system. Identifies repeated patterns and consolidates them. Use when you have drift across the codebase and want to bring things back to a consistent system.',
  },
  {
    command: 'critique',
    category: 'Evaluate',
    argumentHint: '[area (feature, page, component...)]',
    description:
      'Evaluate design from a UX perspective, assessing visual hierarchy, information architecture, emotional resonance, cognitive load, and overall quality with quantitative scoring, persona-based testing, automated anti-pattern detection, and actionable feedback. Use when the user asks to review, critique, evaluate, or give feedback on a design or component.',
  },
  {
    command: 'audit',
    category: 'Evaluate',
    argumentHint: '[area (feature, page, component...)]',
    description:
      'Run technical quality checks across accessibility, performance, theming, responsive design, and anti-patterns. Generates a scored report with P0-P3 severity ratings and actionable plan. Use when the user wants an accessibility check, performance audit, or technical quality review.',
  },
  {
    command: 'polish',
    category: 'Refine',
    argumentHint: '[target]',
    description:
      'Performs a final quality pass fixing alignment, spacing, consistency, and micro-detail issues before shipping. Use when the user mentions polish, finishing touches, pre-launch review, something looks off, or wants to go from good to great.',
  },
  {
    command: 'bolder',
    category: 'Refine',
    argumentHint: '[target]',
    description:
      'Amplify safe or boring designs to make them more visually interesting and stimulating. Increases impact while maintaining usability. Use when the user says the design looks bland, generic, too safe, lacks personality, or wants more visual impact and character.',
  },
  {
    command: 'quieter',
    category: 'Refine',
    argumentHint: '[target]',
    description:
      'Tones down visually aggressive or overstimulating designs, reducing intensity while preserving quality. Use when the user mentions too bold, too loud, overwhelming, aggressive, garish, or wants a calmer, more refined aesthetic.',
  },
  {
    command: 'distill',
    category: 'Refine',
    argumentHint: '[target]',
    description:
      'Strip designs to their essence by removing unnecessary complexity. Great design is simple, powerful, and clean. Use when the user asks to simplify, declutter, reduce noise, remove elements, or make a UI cleaner and more focused.',
  },
  {
    command: 'harden',
    category: 'Refine',
    argumentHint: '[target]',
    description:
      'Make interfaces production-ready: error handling, i18n, text overflow, edge case management, and resilience under real-world data. Use when the user asks to harden, make production-ready, handle edge cases, add error states, or fix overflow and i18n issues.',
  },
  {
    command: 'onboard',
    category: 'Refine',
    argumentHint: '[target]',
    description:
      'Design onboarding flows, first-run experiences, and empty states that guide new users to value. Covers welcome screens, account setup, progressive disclosure, contextual tooltips, feature announcements, and activation moments. Use when the user mentions onboarding, first-time users, empty states, activation, getting started, new user flows, or the aha moment.',
  },
  {
    command: 'animate',
    category: 'Enhance',
    argumentHint: '[target]',
    description:
      'Review a feature and enhance it with purposeful animations, micro-interactions, and motion effects that improve usability and delight. Use when the user mentions adding animation, transitions, micro-interactions, motion design, hover effects, or making the UI feel more alive.',
  },
  {
    command: 'colorize',
    category: 'Enhance',
    argumentHint: '[target]',
    description:
      'Add strategic color to features that are too monochromatic or lack visual interest, making interfaces more engaging and expressive. Use when the user mentions the design looking gray, dull, lacking warmth, needing more color, or wanting a more vibrant or expressive palette.',
  },
  {
    command: 'typeset',
    category: 'Enhance',
    argumentHint: '[target]',
    description:
      'Improves typography by fixing font choices, hierarchy, sizing, weight, and readability so text feels intentional. Use when the user mentions fonts, type, readability, text hierarchy, sizing looks off, or wants more polished, intentional typography.',
  },
  {
    command: 'layout',
    category: 'Enhance',
    argumentHint: '[target]',
    description:
      'Improve layout, spacing, and visual rhythm. Fixes monotonous grids, inconsistent spacing, and weak visual hierarchy. Use when the user mentions layout feeling off, spacing issues, visual hierarchy, crowded UI, alignment problems, or wanting better composition.',
  },
  {
    command: 'delight',
    category: 'Enhance',
    argumentHint: '[target]',
    description:
      'Add moments of joy, personality, and unexpected touches that make interfaces memorable and enjoyable to use. Elevates functional to delightful. Use when the user asks to add polish, personality, animations, micro-interactions, delight, or make an interface feel fun or memorable.',
  },
  {
    command: 'overdrive',
    category: 'Enhance',
    argumentHint: '[target]',
    description:
      'Pushes interfaces past conventional limits with technically ambitious implementations — shaders, spring physics, scroll-driven reveals, 60fps animations. Use when the user wants to wow, impress, go all-out, or make something that feels extraordinary.',
  },
  {
    command: 'clarify',
    category: 'Fix',
    argumentHint: '[target]',
    description:
      'Improve unclear UX copy, error messages, microcopy, labels, and instructions to make interfaces easier to understand. Use when the user mentions confusing text, unclear labels, bad error messages, hard-to-follow instructions, or wanting better UX writing.',
  },
  {
    command: 'adapt',
    category: 'Fix',
    argumentHint: '[target] [context (mobile, tablet, print...)]',
    description:
      'Adapt designs to work across different screen sizes, devices, contexts, or platforms. Implements breakpoints, fluid layouts, and touch targets. Use when the user mentions responsive design, mobile layouts, breakpoints, viewport adaptation, or cross-device compatibility.',
  },
  {
    command: 'optimize',
    category: 'Fix',
    argumentHint: '[target]',
    description:
      'Diagnoses and fixes UI performance across loading speed, rendering, animations, images, and bundle size. Use when the user mentions slow, laggy, janky, performance, bundle size, load time, or wants a faster, smoother experience.',
  },
];

export const IMPECCABLE_COMMAND_NAMES = new Set(IMPECCABLE_COMMANDS.map((c) => c.command));

export interface CommandCompletionItem {
  value: string;
  label: string;
  description?: string;
}

/**
 * Argument completions for `/impeccable`. Completes the sub-command name while
 * the user is still typing the first token. Returns `null` once a command and a
 * trailing space have been typed (the rest is a freeform target we cannot
 * usefully complete).
 */
export function getCommandCompletions(argumentPrefix: string): CommandCompletionItem[] | null {
  // A space means the first token is finished — we are now in target text.
  if (/\s/.test(argumentPrefix)) return null;

  const prefix = argumentPrefix.toLowerCase();
  return IMPECCABLE_COMMANDS.filter((c) => c.command.startsWith(prefix)).map((c) => ({
    value: c.command,
    label: c.argumentHint ? `${c.command} ${c.argumentHint}` : c.command,
    description: `${c.category} — ${c.description}`,
  }));
}
