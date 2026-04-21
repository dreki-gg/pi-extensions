/**
 * Agent discovery and configuration
 *
 * Supports two discovery strategies:
 * 1. Package-resolved: Uses pi's ResolvedPaths.agents from the package manager
 *    when available (pi forks with first-class agents resource support).
 *    Package agents are resolved, filtered, and toggleable via pi config.
 * 2. Legacy: Manual filesystem discovery from bundled, user, and project dirs.
 *    Used as fallback when ResolvedPaths.agents is not available.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getAgentDir, parseFrontmatter } from '@mariozechner/pi-coding-agent';
import type { ResolvedPaths } from '@mariozechner/pi-coding-agent';

export type AgentScope = 'user' | 'project' | 'both';
export type AgentSource = 'bundled' | 'user' | 'project' | 'package';
export type AgentSessionStrategy = 'inline' | 'fork-at';

export interface AgentConfig {
  name: string;
  description: string;
  tools?: string[];
  model?: string;
  thinking?: string;
  sessionStrategy?: AgentSessionStrategy;
  systemPrompt: string;
  source: AgentSource;
  filePath: string;
}

export interface AgentDiscoveryResult {
  agents: AgentConfig[];
  projectAgentsDir: string | null;
}

/** Bundled agents ship with the package (../../agents relative to extensions/subagent/) */
const bundledAgentsDir = path.resolve(import.meta.dirname, '..', '..', 'agents');

function parseSessionStrategy(value?: string): AgentSessionStrategy | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'inline' || normalized === 'fork-at') return normalized;
  return undefined;
}

function loadAgentsFromDir(dir: string, source: AgentSource): AgentConfig[] {
  const agents: AgentConfig[] = [];

  if (!fs.existsSync(dir)) {
    return agents;
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return agents;
  }

  for (const entry of entries) {
    if (!entry.name.endsWith('.md')) continue;
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;

    const filePath = path.join(dir, entry.name);
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const { frontmatter, body } = parseFrontmatter<Record<string, string>>(content);

    if (!frontmatter.name || !frontmatter.description) {
      continue;
    }

    const tools = frontmatter.tools
      ?.split(',')
      .map((t: string) => t.trim())
      .filter(Boolean);

    agents.push({
      name: frontmatter.name,
      description: frontmatter.description,
      tools: tools && tools.length > 0 ? tools : undefined,
      model: frontmatter.model,
      thinking: frontmatter.thinking,
      sessionStrategy: parseSessionStrategy(frontmatter.sessionStrategy),
      systemPrompt: body,
      source,
      filePath,
    });
  }

  return agents;
}

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function findNearestProjectAgentsDir(cwd: string): string | null {
  let currentDir = cwd;
  while (true) {
    const candidate = path.join(currentDir, '.pi', 'agents');
    if (isDirectory(candidate)) return candidate;

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) return null;
    currentDir = parentDir;
  }
}

/**
 * Load agents from package-manager resolved paths (enabled only).
 * This is called with pre-resolved paths from an async context.
 */
export function loadAgentsFromResolvedPaths(resolvedPaths: ResolvedPaths): AgentConfig[] {
  // Check if the agents field exists (compatibility with upstream pi)
  const agentResources = (resolvedPaths as unknown as Record<string, unknown>).agents;
  if (!agentResources || !Array.isArray(agentResources)) {
    return [];
  }

  const agents: AgentConfig[] = [];
  for (const resource of agentResources) {
    if (!resource.enabled) continue;
    const agent = loadAgentFromFile(resource.path, 'package');
    if (agent) agents.push(agent);
  }
  return agents;
}

function loadAgentFromFile(filePath: string, source: AgentSource): AgentConfig | null {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  const { frontmatter, body } = parseFrontmatter<Record<string, string>>(content);
  if (!frontmatter.name || !frontmatter.description) {
    return null;
  }

  const tools = frontmatter.tools
    ?.split(',')
    .map((t: string) => t.trim())
    .filter(Boolean);

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    tools: tools && tools.length > 0 ? tools : undefined,
    model: frontmatter.model,
    thinking: frontmatter.thinking,
    sessionStrategy: parseSessionStrategy(frontmatter.sessionStrategy),
    systemPrompt: body,
    source,
    filePath,
  };
}

export function discoverAgents(cwd: string, scope: AgentScope): AgentDiscoveryResult {
  const userDir = path.join(getAgentDir(), 'agents');
  const projectAgentsDir = findNearestProjectAgentsDir(cwd);

  // Bundled agents from the package itself (lowest priority)
  const bundledAgents = loadAgentsFromDir(bundledAgentsDir, 'bundled');

  const userAgents = scope === 'project' ? [] : loadAgentsFromDir(userDir, 'user');
  const projectAgents =
    scope === 'user' || !projectAgentsDir ? [] : loadAgentsFromDir(projectAgentsDir, 'project');

  // Priority: bundled (lowest) → user → project (highest, overrides by name)
  const agentMap = new Map<string, AgentConfig>();

  for (const agent of bundledAgents) agentMap.set(agent.name, agent);

  if (scope === 'both') {
    for (const agent of userAgents) agentMap.set(agent.name, agent);
    for (const agent of projectAgents) agentMap.set(agent.name, agent);
  } else if (scope === 'user') {
    for (const agent of userAgents) agentMap.set(agent.name, agent);
  } else {
    for (const agent of projectAgents) agentMap.set(agent.name, agent);
  }

  return { agents: Array.from(agentMap.values()), projectAgentsDir };
}

/**
 * Discover agents with package-resolved paths merged in.
 * Package-resolved agents (from pi.agents in installed packages) are loaded
 * at lowest priority, then overridden by bundled, user, and project agents.
 *
 * Falls back to discoverAgents() when resolvedPaths is not provided or
 * does not contain the agents field (upstream pi compatibility).
 */
export function discoverAgentsWithPackages(
  cwd: string,
  scope: AgentScope,
  resolvedPaths?: ResolvedPaths,
): AgentDiscoveryResult {
  const base = discoverAgents(cwd, scope);

  if (!resolvedPaths) return base;

  const packageAgents = loadAgentsFromResolvedPaths(resolvedPaths);
  if (packageAgents.length === 0) return base;

  // Package agents are lowest priority: existing agents override by name
  const agentMap = new Map<string, AgentConfig>();
  for (const agent of packageAgents) agentMap.set(agent.name, agent);
  for (const agent of base.agents) agentMap.set(agent.name, agent);

  return { agents: Array.from(agentMap.values()), projectAgentsDir: base.projectAgentsDir };
}

export { bundledAgentsDir };

export function formatAgentList(
  agents: AgentConfig[],
  maxItems: number,
): { text: string; remaining: number } {
  if (agents.length === 0) return { text: 'none', remaining: 0 };
  const listed = agents.slice(0, maxItems);
  const remaining = agents.length - listed.length;
  return {
    text: listed.map((a) => `${a.name} (${a.source}): ${a.description}`).join('; '),
    remaining,
  };
}
