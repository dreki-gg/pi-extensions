import { MiroClient } from './client.js';
import {
  type MiroProjectConfig,
  getCredentials,
  getCredentialStatus,
  loadProjectConfig,
} from './config.js';
import { loadDotEnv } from './dotenv.js';

const FALLBACK_CONFIG: MiroProjectConfig = { defaultShape: 'round_rectangle' };

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  details: Record<string, unknown>;
  isError?: boolean;
}

export function textResult(text: string, details: Record<string, unknown> = {}): ToolResult {
  return { content: [{ type: 'text', text }], details };
}

export function errorResult(text: string, details: Record<string, unknown> = {}): ToolResult {
  return { content: [{ type: 'text', text }], details, isError: true };
}

/**
 * Holds per-session config and lazily builds the Miro client. Shared across all
 * tools so config is loaded once but still recoverable if a tool runs before
 * `session_start` (reloads from cwd on demand).
 */
export class MiroRuntime {
  private config: MiroProjectConfig | null = null;

  async loadConfig(cwd: string): Promise<MiroProjectConfig> {
    loadDotEnv(cwd);
    this.config = await loadProjectConfig(cwd);
    return this.config;
  }

  async ensureConfig(cwd?: string): Promise<MiroProjectConfig> {
    if (this.config) return this.config;
    if (cwd) {
      loadDotEnv(cwd);
      try {
        this.config = await loadProjectConfig(cwd);
      } catch {
        this.config = { ...FALLBACK_CONFIG };
      }
      return this.config;
    }
    return { ...FALLBACK_CONFIG };
  }

  getConfig(): MiroProjectConfig | null {
    return this.config;
  }

  /** Build a client, or return a ready-to-send error result if no token. */
  client(): { client: MiroClient } | { error: ToolResult } {
    const credentials = getCredentials();
    if (!credentials) {
      const status = getCredentialStatus();
      return {
        error: errorResult(
          '❌ Missing MIRO_ACCESS_TOKEN. Set it in your environment or project .env to use Miro tools.',
          { error: 'missing_credentials', hasAccessToken: status.hasAccessToken },
        ),
      };
    }
    return { client: new MiroClient(credentials.accessToken) };
  }
}
