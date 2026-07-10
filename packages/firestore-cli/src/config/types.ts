export interface FirestoreEnvironmentConfig {
  readonly name: string;
  readonly projectId: string;
  readonly serviceAccountKeyPath: string;
  readonly defaultCollection?: string;
}

export interface FirestoreProjectConfig extends FirestoreEnvironmentConfig {
  readonly defaultEnvironment: string;
  readonly environments: Record<string, FirestoreEnvironmentConfig>;
  readonly maxSampleSize: number;
  readonly scanPaths: string[];
  readonly scanExclude: string[];
  /** Absolute path of the config file that was loaded. */
  readonly configPath: string;
  /** Directory that owns the config (used to resolve relative SA paths). */
  readonly configDir: string;
}

export interface RawEnvironmentConfig {
  readonly projectId?: unknown;
  readonly serviceAccountKeyPath?: unknown;
  readonly serviceAccount?: unknown;
  readonly defaultCollection?: unknown;
}

export interface RawConfig extends RawEnvironmentConfig {
  readonly defaultEnvironment?: unknown;
  readonly environments?: unknown;
  readonly maxSampleSize?: unknown;
  readonly scanPaths?: unknown;
  readonly scanExclude?: unknown;
}
