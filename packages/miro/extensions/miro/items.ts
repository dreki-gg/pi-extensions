/**
 * Pure helpers for reading and editing existing board items. Kept free of any
 * SDK/network coupling so the normalization and update-request mapping are
 * fully unit-testable (mirrors how `layout.ts` stays pure).
 */

/** Item types the Miro `getItems` endpoint can filter by. */
export const LISTABLE_ITEM_TYPES = [
  'text',
  'shape',
  'sticky_note',
  'image',
  'document',
  'card',
  'app_card',
  'preview',
  'frame',
  'embed',
] as const;
export type ListableItemType = (typeof LISTABLE_ITEM_TYPES)[number];

/** Item types `miro_update_item` can edit (the ones we map a request for). */
export const UPDATABLE_ITEM_TYPES = ['shape', 'text', 'sticky_note', 'frame'] as const;
export type UpdatableItemType = (typeof UPDATABLE_ITEM_TYPES)[number];

/** A normalized, LLM-friendly view of a board item. */
export interface BoardItem {
  id: string;
  type: string;
  /** Display text (shape/text/sticky content, or frame title). */
  label?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/** The subset of a raw Miro item we read. Loosely typed to match the SDK. */
export interface RawItem {
  id: string;
  type: string;
  position?: { x?: number; y?: number };
  geometry?: { width?: number; height?: number };
  data?: { content?: string; title?: string };
}

/** Requested edits to an item. All fields optional — only set ones change. */
export interface ItemChanges {
  /** New text (shape/text/sticky content, or frame title). */
  content?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fillColor?: string;
  textColor?: string;
  borderColor?: string;
}

/** A per-type Miro update request body: `{ data?, style?, position?, geometry? }`. */
export interface UpdateRequest {
  data?: Record<string, string>;
  style?: Record<string, string>;
  position?: { x: number; y: number };
  geometry?: { width?: number; height?: number };
}

/** Flatten a raw Miro item into the compact `BoardItem` shape. */
export function normalizeItem(raw: RawItem): BoardItem {
  const label = raw.data?.content ?? raw.data?.title;
  return {
    id: raw.id,
    type: raw.type,
    ...(label !== undefined ? { label } : {}),
    ...(raw.position?.x !== undefined ? { x: raw.position.x } : {}),
    ...(raw.position?.y !== undefined ? { y: raw.position.y } : {}),
    ...(raw.geometry?.width !== undefined ? { width: raw.geometry.width } : {}),
    ...(raw.geometry?.height !== undefined ? { height: raw.geometry.height } : {}),
  };
}

export function isUpdatableType(type: string): type is UpdatableItemType {
  return (UPDATABLE_ITEM_TYPES as readonly string[]).includes(type);
}

/**
 * Build the type-specific Miro update request for `changes`, merging position
 * and size over the item's current values (Miro position/geometry updates are
 * replace-not-patch, so partial edits must carry the unchanged axis). Throws on
 * an item type we don't map a request for.
 */
export function buildUpdateRequest(
  type: string,
  current: RawItem,
  changes: ItemChanges,
): UpdateRequest {
  if (!isUpdatableType(type)) {
    throw new Error(
      `Updating "${type}" items is not supported (updatable: ${UPDATABLE_ITEM_TYPES.join(', ')}).`,
    );
  }

  const request: UpdateRequest = {};

  if (changes.content !== undefined) {
    // Frames carry their label as `title`; everything else as `content`.
    request.data = type === 'frame' ? { title: changes.content } : { content: changes.content };
  }

  const style = buildStyle(type, changes);
  if (style) request.style = style;

  if (changes.x !== undefined || changes.y !== undefined) {
    const x = changes.x ?? current.position?.x;
    const y = changes.y ?? current.position?.y;
    if (x !== undefined && y !== undefined) request.position = { x, y };
  }

  if (changes.width !== undefined || changes.height !== undefined) {
    const geometry: { width?: number; height?: number } = {};
    const width = changes.width ?? current.geometry?.width;
    const height = changes.height ?? current.geometry?.height;
    if (width !== undefined) geometry.width = width;
    // Text items are width-only; never send a height for them.
    if (height !== undefined && type !== 'text') geometry.height = height;
    if (Object.keys(geometry).length > 0) request.geometry = geometry;
  }

  return request;
}

/** Map color changes to the style subset each item type accepts. */
function buildStyle(
  type: UpdatableItemType,
  changes: ItemChanges,
): Record<string, string> | undefined {
  const style: Record<string, string> = {};
  if (type === 'shape') {
    if (changes.fillColor) style.fillColor = changes.fillColor;
    if (changes.borderColor) style.borderColor = changes.borderColor;
    if (changes.textColor) style.color = changes.textColor;
  } else if (type === 'text') {
    if (changes.textColor) style.color = changes.textColor;
    if (changes.fillColor) style.fillColor = changes.fillColor;
  } else if (type === 'frame' || type === 'sticky_note') {
    if (changes.fillColor) style.fillColor = changes.fillColor;
  }
  return Object.keys(style).length > 0 ? style : undefined;
}
