/**
 * `taskman list` (plans) and `taskman initiatives`.
 */

import {
  loadPlanListItems,
  filterPlans,
  sortPlans,
  formatPlanList,
  type SortField,
  type StatusFilter as PlanStatusFilter,
} from '../../listing/plans.js';
import {
  loadInitiativeListItems,
  filterInitiatives,
  formatInitiativeList,
  type StatusFilter as InitStatusFilter,
} from '../../listing/initiatives.js';
import { runPlanIO } from '../runtime.js';
import { emit } from '../format.js';

const PLAN_FILTERS = ['all', 'in-progress', 'done', 'superseded', 'abandoned'] as const;
const SORTS: SortField[] = ['name', 'date-asc', 'date-desc', 'tasks'];

export async function listPlansCommand(opts: {
  status?: string;
  sort?: string;
  json?: boolean;
}): Promise<void> {
  const filter = (PLAN_FILTERS as readonly string[]).includes(opts.status ?? '')
    ? (opts.status as PlanStatusFilter)
    : 'all';
  const sort: SortField = SORTS.includes(opts.sort as SortField)
    ? (opts.sort as SortField)
    : 'date-desc';

  const items = await runPlanIO(loadPlanListItems());
  const result = sortPlans(filterPlans(items, filter), sort);
  emit(Boolean(opts.json), result, formatPlanList(result, filter, sort));
}

export async function listInitiativesCommand(opts: {
  status?: string;
  json?: boolean;
}): Promise<void> {
  const filter = (PLAN_FILTERS as readonly string[]).includes(opts.status ?? '')
    ? (opts.status as InitStatusFilter)
    : 'all';
  const items = await runPlanIO(loadInitiativeListItems());
  const result = filterInitiatives(items, filter);
  emit(Boolean(opts.json), result, formatInitiativeList(result, filter));
}
