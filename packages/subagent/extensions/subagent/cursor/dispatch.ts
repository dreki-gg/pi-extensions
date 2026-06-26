/**
 * Single routing seam for subagent backends.
 *
 * Models prefixed with `cursor:` run through Cursor's ACP server (Composer
 * family); everything else spawns a pi process as before. Both backends return
 * the identical SpawnPiAgentResult shape, so callers are backend-agnostic.
 */

import { spawnPiAgent, type SpawnPiAgentOptions, type SpawnPiAgentResult } from '../spawn-utils.js';
import { parseCursorModel } from './model.js';
import { runCursorAcpAgent } from './acp-runner.js';

export function dispatchSubagent(options: SpawnPiAgentOptions): Promise<SpawnPiAgentResult> {
  if (parseCursorModel(options.model).isCursor) {
    return runCursorAcpAgent(options);
  }
  return spawnPiAgent(options);
}
