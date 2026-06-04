import path from 'node:path';
import { SessionManager, type SessionInfo } from '@earendil-works/pi-coding-agent';
import type { PastChatIndex, PastChatItem, ResolvedPastChatFolder } from './types';
import { buildToken, hashSessionPath } from './tokens';

const MAX_SEARCH_TEXT = 8_000;

function dateText(date: Date): string {
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export function getSessionTitle(session: SessionInfo): string {
  const name = session.name?.trim();
  if (name) return name;

  const first = session.firstMessage?.replace(/\s+/g, ' ').trim();
  if (first) return first.length > 90 ? `${first.slice(0, 87)}...` : first;

  return path.basename(session.path);
}

export function buildSearchableText(
  session: SessionInfo,
  title: string,
  sourceLabel: string,
): string {
  return [
    title,
    sourceLabel,
    session.cwd,
    path.basename(session.cwd),
    session.firstMessage,
    session.allMessagesText?.slice(0, MAX_SEARCH_TEXT),
    dateText(session.created),
    dateText(session.modified),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function assignIds(
  sessions: Array<{ session: SessionInfo; source: PastChatItem['source'] }>,
): PastChatItem[] {
  const used = new Set<string>();

  return sessions.map(({ session, source }) => {
    let length = 12;
    let id = hashSessionPath(session.path, length);
    while (used.has(id)) {
      length += 2;
      id = hashSessionPath(session.path, length);
    }
    used.add(id);

    const title = getSessionTitle(session);
    return {
      id,
      token: buildToken('@session:', id),
      aliases: [buildToken('@session:', id), buildToken('@chat:', id)],
      session,
      title,
      source,
      searchableText: buildSearchableText(session, title, source.label),
    };
  });
}

async function listSource(
  cwd: string,
  label: string,
  current: boolean,
): Promise<Array<{ session: SessionInfo; source: PastChatItem['source'] }>> {
  const sessions = await SessionManager.list(cwd);
  return sessions.map((session) => ({ session, source: { cwd, label, current } }));
}

export function sortPastChatItems(items: PastChatItem[]): PastChatItem[] {
  return [...items].sort((a, b) => {
    if (a.source.current !== b.source.current) return a.source.current ? -1 : 1;
    return b.session.modified.getTime() - a.session.modified.getTime();
  });
}

export function createPastChatIndex(): PastChatIndex {
  let items: PastChatItem[] = [];
  let byId = new Map<string, PastChatItem>();

  return {
    async refresh(cwd: string, folders: ResolvedPastChatFolder[]): Promise<void> {
      const sources = [
        ...(await listSource(cwd, 'Current', true)),
        ...(
          await Promise.all(
            folders
              .filter((folder) => folder.exists)
              .map((folder) => listSource(folder.path, folder.label, false)),
          )
        ).flat(),
      ];

      items = sortPastChatItems(assignIds(sources));
      byId = new Map(items.map((item) => [item.id, item]));
    },

    getItems(): PastChatItem[] {
      return [...items];
    },

    resolveToken(token: string): PastChatItem | undefined {
      const id = token.split(':', 2)[1];
      return id ? byId.get(id) : undefined;
    },
  };
}
