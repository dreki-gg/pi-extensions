import { Context, Effect } from 'effect';
import type { GhCliError, AiChatError } from './errors';

// ── ExecService ────────────────────────────────────────────────────────
/** Shell command execution — wraps pi.exec() */
export class ExecService extends Context.Tag('ExecService')<
  ExecService,
  {
    readonly exec: (
      command: string,
      args: string[],
    ) => Effect.Effect<{ stdout: string; stderr: string; code: number }, GhCliError>;
  }
>() {}

// ── AiService ──────────────────────────────────────────────────────────
/** AI model access — wraps pi.sendMessage() */
export class AiService extends Context.Tag('AiService')<
  AiService,
  {
    readonly chat: (message: string, context: string) => Effect.Effect<string, AiChatError>;
  }
>() {}
