/**
 * Color theming for diagrams. Each group is assigned a coordinated color
 * (frame background + node fill/border + connector stroke) from a curated
 * palette, so a rendered diagram is color-coded by group with zero effort.
 *
 * Frame fills are constrained by the Miro API to a fixed palette — every
 * `frameFill` below is a member of that allowed set.
 */

export interface GroupTheme {
  /** Frame background (must be a Miro-allowed frame fill color). */
  frameFill: string;
  /** Node fill (arbitrary hex; rendered with light opacity). */
  nodeFill: string;
  /** Node border + title text accent. */
  nodeBorder: string;
  /** Connector stroke for edges originating in this group. */
  connector: string;
}

/** Curated, visually distinct group palette. frameFill ∈ Miro allowed set. */
export const GROUP_PALETTE: readonly GroupTheme[] = [
  { frameFill: '#a6ccf5', nodeFill: '#e8f1fc', nodeBorder: '#2d7ff9', connector: '#2d7ff9' }, // blue
  { frameFill: '#d5f692', nodeFill: '#eef9d8', nodeBorder: '#56ad2d', connector: '#56ad2d' }, // green
  { frameFill: '#fff9b1', nodeFill: '#fffbd6', nodeBorder: '#caa400', connector: '#caa400' }, // yellow
  { frameFill: '#ffcee0', nodeFill: '#ffe6f0', nodeBorder: '#e34c84', connector: '#e34c84' }, // pink
  { frameFill: '#67c6c0', nodeFill: '#e2f5f3', nodeBorder: '#1fa39b', connector: '#1fa39b' }, // teal
  { frameFill: '#b384bb', nodeFill: '#f2e9f4', nodeBorder: '#8a4f96', connector: '#8a4f96' }, // purple
  { frameFill: '#ff9d48', nodeFill: '#ffeede', nodeBorder: '#e07a1f', connector: '#e07a1f' }, // orange
  { frameFill: '#7b92ff', nodeFill: '#e9ecff', nodeBorder: '#4a63e0', connector: '#4a63e0' }, // indigo
];

/** Theme for ungrouped nodes (entry points, loose nodes). */
export const NEUTRAL_THEME: GroupTheme = {
  frameFill: '#f5f6f8',
  nodeFill: '#1f2436',
  nodeBorder: '#1f2436',
  connector: '#9aa0a6',
};

/** Fill opacity applied to node fills so colors read as soft tints. */
export const NODE_FILL_OPACITY = '1';

/**
 * Assign a palette theme to each group id, cycling the palette so even many
 * groups stay distinct. Deterministic in input order.
 */
export function assignGroupThemes(groupIds: readonly string[]): Map<string, GroupTheme> {
  const themes = new Map<string, GroupTheme>();
  groupIds.forEach((id, index) => {
    themes.set(id, GROUP_PALETTE[index % GROUP_PALETTE.length]);
  });
  return themes;
}
