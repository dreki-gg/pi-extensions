import type { SessionInfo } from '@earendil-works/pi-coding-agent';
import type { PastChatCache, PastChatCacheEntry, PastChatsConfig } from './schema';

export type {
  PastChatCache,
  PastChatCacheEntry,
  PastChatFolderConfig,
  PastChatSummaryConfig,
  PastChatsConfig,
} from './schema';

export type ResolvedPastChatFolder = {
  path: string;
  label: string;
  exists: boolean;
  current?: boolean;
};

export type PastChatSource = {
  cwd: string;
  label: string;
  current: boolean;
};

export type PastChatItem = {
  id: string;
  token: string;
  aliases: string[];
  session: SessionInfo;
  title: string;
  source: PastChatSource;
  searchableText: string;
};

export type PastChatIndex = {
  refresh(cwd: string, folders: ResolvedPastChatFolder[]): Promise<void>;
  getItems(): PastChatItem[];
  resolveToken(token: string): PastChatItem | undefined;
};

export type PastChatsRuntimeState = {
  cwd: string;
  config: PastChatsConfig;
  folders: ResolvedPastChatFolder[];
  index: PastChatIndex;
};
