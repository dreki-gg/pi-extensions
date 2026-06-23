import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Project config (.pi/jira.json)
// ---------------------------------------------------------------------------

export interface JiraProjectConfig {
  /** Path/name of the Atlassian CLI binary. Default "acli". */
  acliPath: string;
  /** Default project key, used to qualify bare issue numbers and JQL. */
  defaultProject?: string;
  /**
   * Comma-separated field set passed to `acli jira workitem view --fields`.
   * Tuned for agent context (description + comments) rather than acli defaults.
   */
  viewFields: string;
  /** Default max results for `jira_search`. Default 25. */
  searchLimit: number;
}

interface RawConfig {
  acliPath?: unknown;
  defaultProject?: unknown;
  viewFields?: unknown;
  searchLimit?: unknown;
}

/** Curated field set: rich enough for context without dumping every custom field. */
export const DEFAULT_VIEW_FIELDS =
  'summary,issuetype,status,priority,assignee,reporter,labels,components,parent,description,comment,created,updated';

export const DEFAULT_CONFIG: JiraProjectConfig = {
  acliPath: 'acli',
  viewFields: DEFAULT_VIEW_FIELDS,
  searchLimit: 25,
};

/**
 * Loads and validates `.pi/jira.json` from the project root.
 * Returns defaults if the file does not exist. Throws on invalid JSON or
 * invalid field types.
 */
export async function loadProjectConfig(cwd: string): Promise<JiraProjectConfig> {
  const configPath = join(cwd, '.pi', 'jira.json');

  let raw: string;
  try {
    raw = await readFile(configPath, 'utf-8');
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ...DEFAULT_CONFIG };
    }
    throw new Error(`Failed to read ${configPath}: ${(err as Error).message}`);
  }

  let parsed: RawConfig;
  try {
    parsed = JSON.parse(raw) as RawConfig;
  } catch {
    throw new Error(`Invalid JSON in ${configPath}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${configPath} must be a JSON object`);
  }

  return validateConfig(parsed, configPath);
}

function validateConfig(raw: RawConfig, configPath: string): JiraProjectConfig {
  const config: JiraProjectConfig = { ...DEFAULT_CONFIG };

  if (raw.acliPath !== undefined) {
    if (typeof raw.acliPath !== 'string' || raw.acliPath.trim() === '') {
      throw new Error(`${configPath}: "acliPath" must be a non-empty string`);
    }
    config.acliPath = raw.acliPath;
  }

  if (raw.defaultProject !== undefined) {
    if (typeof raw.defaultProject !== 'string') {
      throw new Error(`${configPath}: "defaultProject" must be a string`);
    }
    config.defaultProject = raw.defaultProject;
  }

  if (raw.viewFields !== undefined) {
    if (typeof raw.viewFields !== 'string' || raw.viewFields.trim() === '') {
      throw new Error(`${configPath}: "viewFields" must be a non-empty string`);
    }
    config.viewFields = raw.viewFields;
  }

  if (raw.searchLimit !== undefined) {
    if (
      typeof raw.searchLimit !== 'number' ||
      !Number.isInteger(raw.searchLimit) ||
      raw.searchLimit < 1
    ) {
      throw new Error(`${configPath}: "searchLimit" must be a positive integer`);
    }
    config.searchLimit = raw.searchLimit;
  }

  return config;
}

/**
 * Qualifies a bare issue number with the default project (e.g. "123" -> "PROJ-123").
 * Leaves already-qualified keys (containing a dash) untouched.
 */
export function qualifyKey(key: string, defaultProject?: string): string {
  const trimmed = key.trim();
  if (/^\d+$/.test(trimmed) && defaultProject) {
    return `${defaultProject}-${trimmed}`;
  }
  return trimmed;
}
