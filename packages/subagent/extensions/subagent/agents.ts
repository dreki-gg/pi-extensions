/**
 * Agent discovery and configuration
 *
 * Uses pi's ResolvedPaths.prompts from the package manager to discover
 * agent prompts from installed packages. User and project prompts are
 * discovered from the filesystem and override package prompts by name.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getAgentDir, parseFrontmatter } from '@earendil-works/pi-coding-agent';
import type { ResolvedPaths } from '@earendil-works/pi-coding-agent';

export type AgentScope = 'user' | 'project' | 'both';
export type AgentSource = 'user' | 'project' | 'package';
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
  projectPromptsDir: string | null;
}

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

function findNearestProjectPromptsDir(cwd: string): string | null {
  let currentDir = cwd;
  while (true) {
    const candidate = path.join(currentDir, '.pi', 'prompts');
    if (isDirectory(candidate)) return candidate;

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) return null;
    currentDir = parentDir;
  }
}

/**
 * Load agents from package-manager resolved prompt paths (enabled only).
 */
function loadAgentsFromResolvedPaths(resolvedPaths: ResolvedPaths): AgentConfig[] {
  const promptResources = (resolvedPaths as unknown as Record<string, unknown>).prompts;
  if (!Array.isArray(promptResources)) return [];

  const agents: AgentConfig[] = [];
  for (const resource of promptResources) {
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

/**
 * Discover agents from package-resolved prompts, user, and project directories.
 *
 * Priority: package (lowest) → user → project (highest, overrides by name).
 */
export function discoverAgents(
  cwd: string,
  scope: AgentScope,
  resolvedPaths?: ResolvedPaths,
): AgentDiscoveryResult {
  const userDir = path.join(getAgentDir(), 'prompts');
  const projectPromptsDir = findNearestProjectPromptsDir(cwd);

  const packageAgents = resolvedPaths ? loadAgentsFromResolvedPaths(resolvedPaths) : [];
  const userAgents = scope === 'project' ? [] : loadAgentsFromDir(userDir, 'user');
  const projectAgents =
    scope === 'user' || !projectPromptsDir ? [] : loadAgentsFromDir(projectPromptsDir, 'project');

  const agentMap = new Map<string, AgentConfig>();

  // Package agents are lowest priority
  for (const agent of packageAgents) agentMap.set(agent.name, agent);

  if (scope === 'both') {
    for (const agent of userAgents) agentMap.set(agent.name, agent);
    for (const agent of projectAgents) agentMap.set(agent.name, agent);
  } else if (scope === 'user') {
    for (const agent of userAgents) agentMap.set(agent.name, agent);
  } else {
    for (const agent of projectAgents) agentMap.set(agent.name, agent);
  }

  return { agents: Array.from(agentMap.values()), projectPromptsDir };
}
