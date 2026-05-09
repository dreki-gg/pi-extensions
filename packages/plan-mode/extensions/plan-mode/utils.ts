/**
 * Pure utility functions for plan mode.
 */

export interface TodoItem {
  step: number;
  text: string;
  completed: boolean;
}

// ── Destructive bash patterns (blocked in plan mode) ────────────────────────
const DESTRUCTIVE_PATTERNS = [
  /\brm\b/i,
  /\brmdir\b/i,
  /\bmv\b/i,
  /\bcp\b/i,
  /\bmkdir\b/i,
  /\btouch\b/i,
  /\bchmod\b/i,
  /\bchown\b/i,
  /\bchgrp\b/i,
  /\bln\b/i,
  /\btee\b/i,
  /\btruncate\b/i,
  /\bdd\b/i,
  /\bshred\b/i,
  // stdout redirect — but NOT stderr redirects like 2>/dev/null or 2>&1
  /(?<!\d)>(?!>|&)/,
  />>/,
  /\bnpm\s+(install|uninstall|update|ci|link|publish)/i,
  /\byarn\s+(add|remove|install|publish)/i,
  /\bpnpm\s+(add|remove|install|publish)/i,
  /\bpip\s+(install|uninstall)/i,
  /\bapt(-get)?\s+(install|remove|purge|update|upgrade)/i,
  /\bbrew\s+(install|uninstall|upgrade)/i,
  /\bgit\s+(add|commit|push|pull|merge|rebase|reset|checkout|branch\s+-[dD]|stash|cherry-pick|revert|tag|init|clone)/i,
  /\bsudo\b/i,
  /\bsu\b/i,
  /\bkill\b/i,
  /\bpkill\b/i,
  /\bkillall\b/i,
  /\breboot\b/i,
  /\bshutdown\b/i,
  /\bsystemctl\s+(start|stop|restart|enable|disable)/i,
  /\bservice\s+\S+\s+(start|stop|restart)/i,
  /\b(vim?|nano|emacs|code|subl)\b/i,
  // Windows equivalents
  /\bdel\b/i,
  /\brd\b/i,
  /\bcopy\b/i,
  /\bmove\b/i,
  /\bren\b/i,
  /\brename\b/i,
  /\bicacls\b/i,
  /\battrib\b/i,
  /\bpowershell\b/i,
  /\bpwsh\b/i,
];

// ── Safe read-only bash patterns (allowed in plan mode) ─────────────────────
const SAFE_PATTERNS = [
  /^\s*cat\b/,
  /^\s*head\b/,
  /^\s*tail\b/,
  /^\s*less\b/,
  /^\s*more\b/,
  /^\s*grep\b/,
  /^\s*find\b/,
  /^\s*ls\b/,
  /^\s*pwd\b/,
  /^\s*echo\b/,
  /^\s*printf\b/,
  /^\s*wc\b/,
  /^\s*sort\b/,
  /^\s*uniq\b/,
  /^\s*diff\b/,
  /^\s*file\b/,
  /^\s*stat\b/,
  /^\s*du\b/,
  /^\s*df\b/,
  /^\s*tree\b/,
  /^\s*which\b/,
  /^\s*whereis\b/,
  /^\s*type\b/,
  /^\s*env\b/,
  /^\s*printenv\b/,
  /^\s*uname\b/,
  /^\s*whoami\b/,
  /^\s*id\b/,
  /^\s*date\b/,
  /^\s*cal\b/,
  /^\s*uptime\b/,
  /^\s*ps\b/,
  /^\s*top\b/,
  /^\s*htop\b/,
  /^\s*free\b/,
  /^\s*git\s+(status|log|diff|show|branch|remote|config\s+--get)/i,
  /^\s*git\s+ls-/i,
  /^\s*npm\s+(list|ls|view|info|search|outdated|audit)/i,
  /^\s*yarn\s+(list|info|why|audit)/i,
  /^\s*pnpm\s+(list|ls|why|audit|outdated)/i,
  /^\s*node\s+--version/i,
  /^\s*python\s+--version/i,
  /^\s*curl\s/i,
  /^\s*wget\s+-O\s*-/i,
  /^\s*jq\b/,
  /^\s*sed\s+-n/i,
  /^\s*awk\b/,
  /^\s*rg\b/,
  /^\s*fd\b/,
  /^\s*bat\b/,
  /^\s*eza\b/,
  // Windows equivalents
  /^\s*dir\b/,
  /^\s*where\b/,
  /^\s*set\b/,
  /^\s*systeminfo\b/,
  /^\s*tasklist\b/,
];

/**
 * Check if a command is safe for plan mode.
 *
 * For simple commands, checks that the command starts with a safe pattern and
 * doesn't contain destructive patterns. For piped commands, each segment is
 * checked individually. Special exceptions allow `mkdir -p` for `.plans/` paths.
 */
export function isSafeCommand(command: string): boolean {
  // Special case: allow mkdir for .plans/ directory (planner needs this)
  if (/^\s*mkdir\s+(-p\s+)?\.plans(\/|\\|\s|$)/.test(command)) {
    return true;
  }

  // Split piped commands and check each segment independently
  const segments = splitPipeSegments(command);
  return segments.every((seg) => {
    const trimmed = seg.trim();
    const isDestructive = DESTRUCTIVE_PATTERNS.some((p) => p.test(trimmed));
    const isSafe = SAFE_PATTERNS.some((p) => p.test(trimmed));
    return !isDestructive && isSafe;
  });
}

/**
 * Split a command on unquoted pipe (`|`) characters.
 * Respects single/double quotes and escaped characters.
 */
function splitPipeSegments(command: string): string[] {
  const segments: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (const ch of command) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      current += ch;
      escaped = true;
      continue;
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }
    if (ch === '|' && !inSingle && !inDouble) {
      segments.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current) segments.push(current);
  return segments;
}

// ── Plan extraction ─────────────────────────────────────────────────────────

export function cleanStepText(text: string): string {
  let cleaned = text
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  if (cleaned.length > 60) {
    cleaned = `${cleaned.slice(0, 57)}...`;
  }
  return cleaned;
}

export function extractTodoItems(message: string): TodoItem[] {
  const items: TodoItem[] = [];
  const headerMatch = message.match(/\*{0,2}Plan:\*{0,2}\s*\n/i);
  if (!headerMatch) return items;

  const planSection = message.slice(message.indexOf(headerMatch[0]) + headerMatch[0].length);
  const numberedPattern = /^\s*(\d+)[.)]\s+\*{0,2}([^*\n]+)/gm;

  for (const match of planSection.matchAll(numberedPattern)) {
    const text = match[2]
      .trim()
      .replace(/\*{1,2}$/, '')
      .trim();

    if (text.length <= 5) continue;
    if (text.startsWith('`') || text.startsWith('/') || text.startsWith('-')) continue;

    const cleaned = cleanStepText(text);
    if (cleaned.length <= 3) continue;

    items.push({ step: items.length + 1, text: cleaned, completed: false });
  }

  return items;
}

export function extractDoneSteps(message: string): number[] {
  const steps: number[] = [];
  for (const match of message.matchAll(/\[DONE:(\d+)\]/gi)) {
    const step = Number(match[1]);
    if (Number.isFinite(step)) steps.push(step);
  }
  return steps;
}

export function markCompletedSteps(text: string, items: TodoItem[]): number {
  const doneSteps = extractDoneSteps(text);
  for (const step of doneSteps) {
    const item = items.find((t) => t.step === step);
    if (item) item.completed = true;
  }
  return doneSteps.length;
}

// ── Plan name utilities ─────────────────────────────────────────────────────

export function toKebabCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
