#!/usr/bin/env node
import { N as readInitiativesManifest, P as upsertInitiativeEntry, S as initiativeRollup, T as reconcileInitiativeForPlan, V as upsertPlanEntry, X as makePlanRuntime, _ as applyInitiativeReconcile, a as filterPlans, b as collectPlanDrift, d as setTaskStatus, g as resolvePlanByName, i as loadInitiativeListItems, l as sortPlans, m as loadPlanData, n as formatInitiativeList, o as formatPlanList, s as loadPlanListItems, t as filterInitiatives, u as appendDeferredTask, v as applyReconcile, y as collectInitiativeDrift, z as readPlansManifest } from "./initiatives-Ij_teFl_.mjs";
import { Effect } from "effect";
import { Command } from "commander";
//#region src/cli/runtime.ts
/**
* Shared CLI plumbing: a single `runPlanIO` bridge plus stateless plan
* resolution that exits with a clear message when no single plan can be picked.
*/
const runPlanIO = makePlanRuntime();
var CliError = class extends Error {};
/**
* Resolve a target plan directory from an optional `--plan` hint, else the sole
* in-progress plan. Throws `CliError` (caught at the top level → exit 1) with
* the in-progress candidates when resolution is ambiguous or misses.
*/
async function resolvePlanDir(name) {
	const { planName, planDir, candidates } = await runPlanIO(resolvePlanByName({ name }));
	if (planName && planDir) return {
		planName,
		planDir
	};
	if (name) throw new CliError(`Plan "${name}" not found. In-progress plans: ${candidates.join(", ") || "(none)"}.`);
	if (candidates.length > 1) throw new CliError(`Multiple in-progress plans — pass --plan <name>. Candidates: ${candidates.join(", ")}.`);
	throw new CliError("No in-progress plan found in .plans/plans.jsonl. Pass --plan <name>.");
}
//#endregion
//#region src/cli/format.ts
const STATUS_GLYPH = {
	done: "✓",
	skipped: "⊘",
	blocked: "✗",
	pending: "○",
	deferred: "+"
};
/** Print either pretty JSON (when `json`) or the supplied human text. */
function emit(json, payload, human) {
	if (json) process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
	else process.stdout.write(human + "\n");
}
//#endregion
//#region src/cli/commands/status.ts
/**
* `taskman status` — progress + task ids/statuses for the resolved plan.
*/
async function statusCommand(opts) {
	const { planDir } = await resolvePlanDir(opts.plan);
	const plan = await runPlanIO(loadPlanData(planDir));
	if (!plan) throw new CliError(`No tasks.jsonl found in ${planDir}.`);
	const counts = {
		done: 0,
		skipped: 0,
		blocked: 0,
		pending: 0,
		deferred: 0
	};
	for (const task of plan.tasks) counts[task.status] += 1;
	const resolved = counts.done + counts.skipped;
	const parts = [
		`done ${counts.done}`,
		`skipped ${counts.skipped}`,
		`pending ${counts.pending}`
	];
	if (counts.blocked) parts.push(`blocked ${counts.blocked}`);
	if (counts.deferred) parts.push(`follow-up ${counts.deferred}`);
	const lines = plan.tasks.map((t) => `  ${STATUS_GLYPH[t.status]} ${t.id} [${t.status}] ${t.description}`);
	const human = `Plan: ${plan.title} (${plan.planName})\nProgress: ${resolved}/${plan.tasks.length} resolved — ${parts.join(", ")}\nTasks:\n${lines.join("\n")}`;
	emit(Boolean(opts.json), {
		active: true,
		plan_name: plan.planName,
		title: plan.title,
		total: plan.tasks.length,
		counts,
		task_ids: plan.tasks.map((t) => t.id)
	}, human);
}
//#endregion
//#region src/cli/commands/list.ts
/**
* `taskman list` (plans) and `taskman initiatives`.
*/
const PLAN_FILTERS = [
	"all",
	"in-progress",
	"done",
	"superseded",
	"abandoned"
];
const SORTS = [
	"name",
	"date-asc",
	"date-desc",
	"tasks"
];
async function listPlansCommand(opts) {
	const filter = PLAN_FILTERS.includes(opts.status ?? "") ? opts.status : "all";
	const sort = SORTS.includes(opts.sort) ? opts.sort : "date-desc";
	const result = sortPlans(filterPlans(await runPlanIO(loadPlanListItems()), filter), sort);
	emit(Boolean(opts.json), result, formatPlanList(result, filter, sort));
}
async function listInitiativesCommand(opts) {
	const filter = PLAN_FILTERS.includes(opts.status ?? "") ? opts.status : "all";
	const result = filterInitiatives(await runPlanIO(loadInitiativeListItems()), filter);
	emit(Boolean(opts.json), result, formatInitiativeList(result, filter));
}
//#endregion
//#region src/cli/commands/initiative-status.ts
/**
* `taskman initiative-status [name]` — member plans + readiness rollup.
*/
async function initiativeStatusCommand(name, opts) {
	const initiatives = await runPlanIO(readInitiativesManifest());
	if (initiatives.length === 0) throw new CliError("No initiatives in .plans/initiatives.jsonl.");
	let target = name;
	if (!target) {
		const inProgress = initiatives.filter((i) => i.status === "in-progress");
		if (inProgress.length === 1) target = inProgress[0].name;
		else throw new CliError(`Pass an initiative name. Initiatives: ${initiatives.map((i) => i.name).join(", ")}.`);
	}
	const entry = initiatives.find((i) => i.name === target);
	if (!entry) throw new CliError(`Initiative "${target}" not found. Available: ${initiatives.map((i) => i.name).join(", ")}.`);
	const plans = await runPlanIO(readPlansManifest());
	const rollup = initiativeRollup(entry.name, plans);
	const memberLines = rollup.members.map((m) => {
		const flag = m.status === "in-progress" ? m.ready ? "  [ready]" : `  [blocked by ${m.blockedBy?.join(", ")}]` : "";
		return `  ${m.status === "done" ? "✓" : "○"} ${m.name} [${m.status}] — ${m.title}${flag}`;
	});
	const human = `Initiative: ${entry.title} (${entry.name}) — ${entry.status}\nPlans: ${rollup.done}/${rollup.total} done — in-progress ${rollup.inProgress} (ready ${rollup.ready}, blocked ${rollup.blocked})\nMembers:\n${memberLines.join("\n")}`;
	emit(Boolean(opts.json), {
		...rollup,
		name: entry.name,
		status: entry.status
	}, human);
}
//#endregion
//#region src/cli/commands/update-task.ts
/**
* `taskman update-task <id> <status>` — set a task status + reconcile registry.
*/
const VALID$1 = [
	"done",
	"skipped",
	"blocked",
	"pending"
];
async function updateTaskCommand(taskId, status, opts) {
	if (!VALID$1.includes(status)) throw new CliError(`Invalid status "${status}". Use one of: ${VALID$1.join(", ")}.`);
	const { planName, planDir } = await resolvePlanDir(opts.plan);
	const result = await runPlanIO(setTaskStatus(planDir, taskId, status, opts.notes));
	emit(Boolean(opts.json), {
		plan_name: planName,
		task_id: result.task.id,
		status: result.task.status,
		finalizable: result.finalizable
	}, `${result.task.id} → ${result.task.status} in ${planName}` + (result.finalizable ? " (plan now finalizable)" : ""));
}
//#endregion
//#region src/cli/commands/add-task.ts
/**
* `taskman add-task <description>` — append a deferred follow-up task.
*/
async function addTaskCommand(description, opts) {
	if (!opts.reason) throw new CliError("--reason is required (why the follow-up matters).");
	const { planName, planDir } = await resolvePlanDir(opts.plan);
	const task = await runPlanIO(appendDeferredTask(planDir, {
		description,
		reason: opts.reason,
		details: opts.details
	}));
	emit(Boolean(opts.json), {
		plan_name: planName,
		task_id: task.id,
		description: task.description,
		status: task.status
	}, `Captured follow-up ${task.id}: ${task.description} (deferred) in ${planName}.`);
}
//#endregion
//#region src/cli/commands/reconcile.ts
/**
* `taskman reconcile [--apply]` — detect (and optionally repair) status drift.
*/
async function reconcileCommand(opts) {
	const planRows = await runPlanIO(collectPlanDrift());
	const initRows = await runPlanIO(collectInitiativeDrift());
	let repairedPlans = [];
	let repairedInits = [];
	if (opts.apply) {
		repairedPlans = await runPlanIO(applyReconcile(planRows).pipe(Effect.orDie));
		repairedInits = await runPlanIO(applyInitiativeReconcile(initRows).pipe(Effect.orDie));
	}
	const planDrift = planRows.filter((r) => r.drift);
	const initDrift = initRows.filter((r) => r.drift);
	const lines = [];
	if (planDrift.length === 0 && initDrift.length === 0) lines.push("No drift detected.");
	else {
		for (const r of planDrift) lines.push(`  plan ${r.name}: ${r.drift}` + (r.drift === "status" ? ` (${r.registryStatus} → ${r.derivedStatus}, ${r.direction})` : ""));
		for (const r of initDrift) lines.push(`  initiative ${r.name}: status (${r.registryStatus} → ${r.derivedStatus})`);
	}
	if (opts.apply) lines.push(`Applied: ${repairedPlans.length} plan(s), ${repairedInits.length} initiative(s) repaired.`);
	else if (planDrift.length || initDrift.length) lines.push("Run with --apply to repair safe (upgrade) drift.");
	emit(Boolean(opts.json), {
		plan_drift: planDrift,
		initiative_drift: initDrift,
		applied: opts.apply ? {
			plans: repairedPlans.map((r) => r.name),
			initiatives: repairedInits.map((r) => r.name)
		} : null
	}, lines.join("\n"));
}
//#endregion
//#region src/cli/commands/close.ts
/**
* `taskman close <status>` and `taskman close-initiative <status> [name]`.
*
* Sets a plan/initiative lifecycle status directly in the registry. Closing a
* plan re-projects its parent initiative.
*/
const VALID = [
	"done",
	"superseded",
	"abandoned",
	"in-progress"
];
function assertStatus(status) {
	if (!VALID.includes(status)) throw new CliError(`Invalid status "${status}". Use one of: ${VALID.join(", ")}.`);
	return status;
}
async function closePlanCommand(status, opts) {
	const s = assertStatus(status);
	const { planName } = await resolvePlanDir(opts.plan);
	await runPlanIO(upsertPlanEntry(planName, {
		status: s,
		reason: opts.reason
	}).pipe(Effect.andThen(reconcileInitiativeForPlan(planName))));
	emit(Boolean(opts.json), {
		plan_name: planName,
		status: s,
		reason: opts.reason ?? null
	}, `Plan ${planName} → ${s}${opts.reason ? ` (${opts.reason})` : ""}.`);
}
async function closeInitiativeCommand(status, name, opts) {
	const s = assertStatus(status);
	if (!name) throw new CliError("Initiative name is required.");
	await runPlanIO(upsertInitiativeEntry(name, {
		status: s,
		reason: opts.reason
	}));
	emit(Boolean(opts.json), {
		initiative: name,
		status: s,
		reason: opts.reason ?? null
	}, `Initiative ${name} → ${s}${opts.reason ? ` (${opts.reason})` : ""}.`);
}
//#endregion
//#region src/cli.ts
/**
* `taskman` CLI — drive the `.plans/` task ledger from any Node harness.
*
* Thin Commander wiring over the engine: each subcommand delegates to an action
* module under `cli/commands/`. Human text by default; `--json` for machines.
*/
function buildProgram() {
	const program = new Command();
	program.name("taskman").description("Task-management engine over a .plans/ JSONL ledger").version("0.1.0");
	program.command("status").description("Progress + task ids/statuses for the active plan").option("--plan <name>", "plan name (or .plans/<name>) to inspect").option("--json", "machine-readable JSON output").action((opts) => statusCommand(opts));
	program.command("list").description("List plans").option("--status <status>", "all|in-progress|done|superseded|abandoned").option("--sort <field>", "name|date-asc|date-desc|tasks").option("--json", "machine-readable JSON output").action((opts) => listPlansCommand(opts));
	program.command("initiatives").description("List initiatives").option("--status <status>", "all|in-progress|done|superseded|abandoned").option("--json", "machine-readable JSON output").action((opts) => listInitiativesCommand(opts));
	program.command("initiative-status").description("Member plans + readiness for an initiative").argument("[name]", "initiative name (defaults to the sole in-progress one)").option("--json", "machine-readable JSON output").action((name, opts) => initiativeStatusCommand(name, opts));
	program.command("update-task").description("Set a task status (done|skipped|blocked|pending)").argument("<id>", "task id, e.g. t-001").argument("<status>", "done|skipped|blocked|pending").option("--plan <name>", "plan to target").option("--notes <text>", "notes recorded on the task").option("--json", "machine-readable JSON output").action((id, status, opts) => updateTaskCommand(id, status, opts));
	program.command("add-task").description("Append a deferred follow-up task").argument("<description>", "short task label").requiredOption("--reason <text>", "why this follow-up matters").option("--plan <name>", "plan to target").option("--details <text>", "fuller implementation notes").option("--json", "machine-readable JSON output").action((description, opts) => addTaskCommand(description, opts));
	program.command("reconcile").description("Detect (and with --apply, repair) status drift").option("--apply", "repair safe in-progress→done drift").option("--json", "machine-readable JSON output").action((opts) => reconcileCommand(opts));
	program.command("close").description("Set a plan lifecycle status").argument("<status>", "done|superseded|abandoned|in-progress").option("--plan <name>", "plan to target").option("--reason <text>", "why (recorded in the registry)").option("--json", "machine-readable JSON output").action((status, opts) => closePlanCommand(status, opts));
	program.command("close-initiative").description("Set an initiative lifecycle status").argument("<status>", "done|superseded|abandoned|in-progress").argument("<name>", "initiative name").option("--reason <text>", "why (recorded in the registry)").option("--json", "machine-readable JSON output").action((status, name, opts) => closeInitiativeCommand(status, name, opts));
	return program;
}
async function main(argv = process.argv) {
	try {
		await buildProgram().parseAsync(argv);
	} catch (err) {
		const message = err instanceof CliError ? err.message : err instanceof Error ? err.message : String(err);
		process.stderr.write(`taskman: ${message}\n`);
		process.exitCode = 1;
	}
}
main();
//#endregion
export { buildProgram, main };
