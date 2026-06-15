/**
 * /initiatives command — list, filter, and sort initiatives interactively.
 *
 * The pure listing logic lives in `@dreki-gg/taskman`; this file is the
 * pi-interactive shell around it.
 */

import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import type { RunPlanIO } from '@dreki-gg/taskman';
import { InitiativeListing } from '@dreki-gg/taskman';

export type StatusFilter = InitiativeListing.StatusFilter;
export type InitiativeListItem = InitiativeListing.InitiativeListItem;
export const {
  filterInitiatives,
  formatInitiativeList,
  loadInitiativeListItems,
  parseInitiativeFilter: parseFilter,
} = InitiativeListing;

export async function handleListInitiatives(
  ctx: ExtensionCommandContext,
  runPlanIO: RunPlanIO,
  args?: string,
): Promise<void> {
  const items = await runPlanIO(InitiativeListing.loadInitiativeListItems());
  if (items.length === 0) {
    ctx.ui.notify('No initiatives found in .plans/initiatives.jsonl', 'info');
    return;
  }

  let filter: StatusFilter = 'all';
  if (args?.trim()) {
    filter = InitiativeListing.parseInitiativeFilter(args.trim());
  } else {
    const choice = await ctx.ui.select('Filter initiatives by status:', [
      'All',
      'In-progress',
      'Done',
      'Superseded',
      'Abandoned',
    ]);
    if (!choice) return;
    const map: Record<string, StatusFilter> = {
      All: 'all',
      'In-progress': 'in-progress',
      Done: 'done',
      Superseded: 'superseded',
      Abandoned: 'abandoned',
    };
    filter = map[choice] ?? 'all';
  }

  ctx.ui.notify(
    InitiativeListing.formatInitiativeList(InitiativeListing.filterInitiatives(items, filter), filter),
    'info',
  );
}
