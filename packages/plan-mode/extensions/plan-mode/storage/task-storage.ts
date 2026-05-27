import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isTaskMeta, isTaskRecord, type TaskMeta, type TaskRecord } from '../types.js';
import { writeFileAtomic } from './atomic-write.js';

const TASKS_FILE = 'tasks.jsonl';

export interface TasksSnapshot { meta: TaskMeta; tasks: TaskRecord[] }

export async function readTasksJsonl(planDir: string): Promise<TasksSnapshot | undefined> {
  let text: string;
  try { text = await readFile(join(planDir, TASKS_FILE), 'utf8'); } catch { return undefined; }
  if (!text.trim()) throw new Error('tasks.jsonl is missing meta record');

  let meta: TaskMeta | undefined;
  const tasks: TaskRecord[] = [];
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    if (!raw.trim()) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch (error) { throw new Error(`Invalid JSONL at line ${index + 1}: ${(error as Error).message}`); }
    if (isTaskMeta(parsed)) meta = parsed;
    else if (isTaskRecord(parsed)) tasks.push(parsed);
    else throw new Error(`Invalid tasks.jsonl record at line ${index + 1}`);
  }
  if (!meta) throw new Error('tasks.jsonl is missing meta record');
  return { meta, tasks };
}

export async function writeTasksJsonl(planDir: string, meta: TaskMeta, tasks: TaskRecord[]): Promise<void> {
  await mkdir(planDir, { recursive: true });
  const content = [meta, ...tasks].map((record) => JSON.stringify(record)).join('\n') + '\n';
  await writeFileAtomic(join(planDir, TASKS_FILE), content);
}

export async function updateTask(planDir: string, taskId: string, updates: Partial<Omit<TaskRecord, '_type' | 'id' | 'created_at'>>): Promise<TaskRecord> {
  const snapshot = await readTasksJsonl(planDir);
  if (!snapshot) throw new Error(`No tasks.jsonl found in ${planDir}`);
  const index = snapshot.tasks.findIndex((task) => task.id === taskId);
  if (index === -1) throw new Error(`Task not found: ${taskId}`);
  const updated: TaskRecord = { ...snapshot.tasks[index], ...updates, updated_at: new Date().toISOString() };
  snapshot.tasks[index] = updated;
  await writeTasksJsonl(planDir, snapshot.meta, snapshot.tasks);
  return updated;
}
