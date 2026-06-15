/**
 * /plans command — list, filter, and sort plans interactively.
 *
 * The pure listing logic (filter / sort / format / load) lives in
 * `@dreki-gg/taskman`; this file is the pi-interactive shell around it.
 */

import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import type { RunPlanIO } from '@dreki-gg/taskman';
import { PlanListing } from '@dreki-gg/taskman';

// Re-export the engine listing types/helpers for the rest of the extension.
export type SortField = PlanListing.SortField;
export type StatusFilter = PlanListing.StatusFilter;
export type PlanListItem = PlanListing.PlanListItem;
export const {
  filterPlans,
  sortPlans,
  formatPlanList,
  loadPlanListItems,
  parseListArgs: parseArgs,
} = PlanListing;

export async function handleListPlans(
  ctx: ExtensionCommandContext,
  runPlanIO: RunPlanIO,
  args?: string,
): Promise<void> {
  const allItems = await runPlanIO(PlanListing.loadPlanListItems());

  if (allItems.length === 0) {
    ctx.ui.notify('No plans found in .plans/plans.jsonl', 'info');
    return;
  }

  // Parse inline args: /plans [filter] [sort] — e.g. /plans done tasks
  let filter: StatusFilter = 'all';
  let sort: SortField = 'date-desc';

  if (args?.trim()) {
    const parsed = PlanListing.parseListArgs(args.trim());
    filter = parsed.filter;
    sort = parsed.sort;
  } else {
    const filterChoice = await ctx.ui.select('Filter plans by status:', [
      'All',
      'In-progress',
      'Done',
      'Superseded',
      'Abandoned',
    ]);
    if (!filterChoice) return;

    const filterMap: Record<string, StatusFilter> = {
      All: 'all',
      'In-progress': 'in-progress',
      Done: 'done',
      Superseded: 'superseded',
      Abandoned: 'abandoned',
    };
    filter = filterMap[filterChoice] ?? 'all';

    const sortChoice = await ctx.ui.select('Sort by:', [
      'Newest first',
      'Oldest first',
      'Most tasks',
      'Name',
    ]);
    if (!sortChoice) return;

    const sortMap: Record<string, SortField> = {
      'Newest first': 'date-desc',
      'Oldest first': 'date-asc',
      'Most tasks': 'tasks',
      Name: 'name',
    };
    sort = sortMap[sortChoice] ?? 'date-desc';
  }

  const sorted = PlanListing.sortPlans(PlanListing.filterPlans(allItems, filter), sort);
  ctx.ui.notify(PlanListing.formatPlanList(sorted, filter, sort), 'info');
}
