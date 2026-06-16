#!/usr/bin/env node
import { J as writeTasksJsonl, N as readInitiativesManifest, P as upsertInitiativeEntry, S as initiativeRollup, T as reconcileInitiativeForPlan, V as upsertPlanEntry, W as saveHandoff, X as makePlanRuntime, _ as applyInitiativeReconcile, a as filterPlans, b as collectPlanDrift, d as setTaskStatus, f as nextTaskId, g as resolvePlanByName, i as loadInitiativeListItems, l as sortPlans, m as loadPlanData, n as formatInitiativeList, o as formatPlanList, p as toKebabCase, s as loadPlanListItems, t as filterInitiatives, u as appendDeferredTask, v as applyReconcile, y as collectInitiativeDrift, z as readPlansManifest } from "./initiatives-Ij_teFl_.mjs";
import { Effect } from "effect";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
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
//#region src/cli/input.ts
/**
* Content resolution for CLI commands that accept markdown / JSON payloads from
* a foreign harness: an inline string, a file path, or piped stdin.
*/
/** Read all of stdin as a UTF-8 string (used when neither inline nor file is given). */
async function readStdin() {
	const chunks = [];
	for await (const chunk of process.stdin) chunks.push(chunk);
	return Buffer.concat(chunks).toString("utf8");
}
/**
* Resolve payload content from, in priority order: an inline value, a `--file`
* path (or `-` for stdin), else piped stdin. Throws `CliError` when nothing is
* provided and stdin is a TTY (no piped input).
*/
async function resolveContent(inline, file, label) {
	if (inline !== void 0) return inline;
	if (file !== void 0 && file !== "-") try {
		return await readFile(file, "utf8");
	} catch {
		throw new CliError(`Could not read ${label} file: ${file}`);
	}
	if (process.stdin.isTTY) throw new CliError(`No ${label} provided. Pass it inline, via --${label}-file, or on stdin.`);
	return readStdin();
}
//#endregion
//#region src/cli/commands/create-plan.ts
/**
* `taskman create-plan` — create a plan from a foreign harness.
*
* The CLI sibling of plan-mode's `submit_plan` tool: writes tasks.jsonl,
* HANDOFF.md, and a plans.jsonl registry entry in one transaction, then
* re-projects the parent initiative (when linked). Handoff/tasks payloads come
* from inline values, files, or stdin so any harness can drive it.
*/
/** Parse and validate the `--tasks` JSON payload into TaskInput[]. */
function parseTasks(raw) {
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new CliError("--tasks must be a JSON array of { description, ... } objects.");
	}
	if (!Array.isArray(parsed) || parsed.length === 0) throw new CliError("--tasks must be a non-empty JSON array.");
	return parsed.map((entry, i) => {
		if (typeof entry !== "object" || entry === null) throw new CliError(`Task at index ${i} is not an object.`);
		const { description } = entry;
		if (typeof description !== "string" || description.trim() === "") throw new CliError(`Task at index ${i} is missing a "description".`);
		const t = entry;
		return {
			id: t.id,
			description: t.description,
			details: t.details,
			depends_on: t.depends_on
		};
	});
}
/** Assign explicit IDs where given, generate t-NNN for the rest. */
function assignIds(inputs, now) {
	const ids = inputs.map((t) => t.id).filter((id) => Boolean(id));
	const records = [];
	for (const input of inputs) {
		const id = input.id ?? nextTaskId(ids);
		if (!input.id) ids.push(id);
		records.push({
			_type: "task",
			id,
			description: input.description.slice(0, 60),
			details: input.details ?? "",
			status: "pending",
			depends_on: input.depends_on,
			created_at: now,
			updated_at: now
		});
	}
	return records;
}
async function createPlanCommand(opts) {
	if (!opts.name) throw new CliError("--name is required.");
	if (!opts.title) throw new CliError("--title is required.");
	const planName = toKebabCase(opts.name);
	const planDir = `.plans/${planName}`;
	const initiative = opts.initiative ? toKebabCase(opts.initiative) : void 0;
	const dependsOnPlans = opts.dependsOn ? opts.dependsOn.split(",").map((s) => toKebabCase(s.trim())).filter(Boolean) : void 0;
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const handoff = await resolveContent(opts.handoff, opts.handoffFile, "handoff");
	const tasks = assignIds(parseTasks(await resolveContent(opts.tasks, opts.tasksFile, "tasks")), now);
	const meta = {
		_type: "meta",
		title: opts.title,
		plan_name: planName,
		created_at: now
	};
	const unknownInitiative = await runPlanIO(Effect.gen(function* () {
		yield* writeTasksJsonl(planDir, meta, tasks);
		yield* saveHandoff(planDir, handoff);
		yield* upsertPlanEntry(planName, {
			status: "in-progress",
			title: opts.title,
			initiative,
			depends_on: dependsOnPlans
		});
		yield* reconcileInitiativeForPlan(planName);
		if (!initiative) return false;
		return !(yield* readInitiativesManifest()).some((entry) => entry.name === initiative);
	}));
	const linkSuffix = initiative ? ` Linked to initiative "${initiative}"${unknownInitiative ? " (no initiatives.jsonl entry yet — create it with submit_initiative)" : ""}.` : "";
	emit(Boolean(opts.json), {
		plan_name: planName,
		plan_dir: planDir,
		task_count: tasks.length,
		task_ids: tasks.map((t) => t.id),
		initiative: initiative ?? null,
		depends_on: dependsOnPlans ?? null,
		unknown_initiative: unknownInitiative
	}, `Plan "${opts.title}" saved with ${tasks.length} tasks in ${planDir}.${linkSuffix}`);
}
//#endregion
//#region src/cli/commands/create-handoff.ts
/**
* `taskman create-handoff [content]` — write/replace HANDOFF.md for a plan.
*
* Lets a foreign harness hand off markdown without going through the plan-mode
* extension: content comes from an inline argument, `--file <path>`, or stdin.
*/
async function createHandoffCommand(content, opts) {
	const { planName, planDir } = await resolvePlanDir(opts.plan);
	const markdown = await resolveContent(content, opts.file, "handoff");
	await runPlanIO(saveHandoff(planDir, markdown));
	emit(Boolean(opts.json), {
		plan_name: planName,
		path: `${planDir}/HANDOFF.md`,
		bytes: Buffer.byteLength(markdown)
	}, `Wrote HANDOFF.md (${Buffer.byteLength(markdown)} bytes) for ${planName}.`);
}
//#endregion
//#region src/cli.ts
/**
* `taskman` CLI — drive the `.plans/` task ledger from any Node harness.
*
* Thin Commander wiring over the engine: each subcommand delegates to an action
* module under `cli/commands/`. Human text by default; `--json` for machines.
*/
/** Read the shipped package version (dist/cli.mjs → ../package.json). */
function packageVersion() {
	try {
		const pkgUrl = new URL("../package.json", import.meta.url);
		return JSON.parse(readFileSync(pkgUrl, "utf-8")).version ?? "0.0.0";
	} catch {
		return "0.0.0";
	}
}
function buildProgram() {
	const program = new Command();
	program.name("taskman").description("Task-management engine over a .plans/ JSONL ledger").version(packageVersion());
	program.command("status").description("Progress + task ids/statuses for the active plan").option("--plan <name>", "plan name (or .plans/<name>) to inspect").option("--json", "machine-readable JSON output").action((opts) => statusCommand(opts));
	program.command("list").description("List plans").option("--status <status>", "all|in-progress|done|superseded|abandoned").option("--sort <field>", "name|date-asc|date-desc|tasks").option("--json", "machine-readable JSON output").action((opts) => listPlansCommand(opts));
	program.command("initiatives").description("List initiatives").option("--status <status>", "all|in-progress|done|superseded|abandoned").option("--json", "machine-readable JSON output").action((opts) => listInitiativesCommand(opts));
	program.command("initiative-status").description("Member plans + readiness for an initiative").argument("[name]", "initiative name (defaults to the sole in-progress one)").option("--json", "machine-readable JSON output").action((name, opts) => initiativeStatusCommand(name, opts));
	program.command("update-task").description("Set a task status (done|skipped|blocked|pending)").argument("<id>", "task id, e.g. t-001").argument("<status>", "done|skipped|blocked|pending").option("--plan <name>", "plan to target").option("--notes <text>", "notes recorded on the task").option("--json", "machine-readable JSON output").action((id, status, opts) => updateTaskCommand(id, status, opts));
	program.command("add-task").description("Append a deferred follow-up task").argument("<description>", "short task label").requiredOption("--reason <text>", "why this follow-up matters").option("--plan <name>", "plan to target").option("--details <text>", "fuller implementation notes").option("--json", "machine-readable JSON output").action((description, opts) => addTaskCommand(description, opts));
	program.command("reconcile").description("Detect (and with --apply, repair) status drift").option("--apply", "repair safe in-progress→done drift").option("--json", "machine-readable JSON output").action((opts) => reconcileCommand(opts));
	program.command("create-plan").description("Create a plan (tasks.jsonl + HANDOFF.md + registry entry) from any harness").requiredOption("--name <name>", "short kebab-case plan name").requiredOption("--title <title>", "human-readable plan title").option("--handoff <text>", "HANDOFF.md markdown (inline)").option("--handoff-file <path>", "read HANDOFF.md markdown from a file (\"-\" for stdin)").option("--tasks <json>", "tasks as an inline JSON array of { description, ... }").option("--tasks-file <path>", "read the tasks JSON array from a file (\"-\" for stdin)").option("--initiative <name>", "parent initiative name to link this plan to").option("--depends-on <names>", "comma-separated plan names this plan depends on").option("--json", "machine-readable JSON output").action((opts) => createPlanCommand(opts));
	program.command("create-handoff").description("Write/replace HANDOFF.md for a plan from any harness").argument("[content]", "HANDOFF.md markdown (inline); else use --file or stdin").option("--plan <name>", "plan to target").option("--file <path>", "read markdown from a file (\"-\" for stdin)").option("--json", "machine-readable JSON output").action((content, opts) => createHandoffCommand(content, opts));
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
