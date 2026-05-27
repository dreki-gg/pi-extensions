export interface ContextFolder {
  path: string;
  label?: string;
}

export interface ContextFoldersConfig {
  folders: ContextFolder[];
}

export interface ResolvedFolder {
  path: string;
  label: string;
  exists: boolean;
}
