import type { PrOverview, PrCheck, PrComment, PrReview } from './types';

/** Minimal exec interface matching ExtensionAPI.exec() */
export type ExecFn = (
  command: string,
  args: string[],
  options?: { cwd?: string },
) => Promise<{ stdout: string; stderr: string; code: number }>;

export interface GhClient {
  fetchOverview(prRef: string): Promise<PrOverview>;
  fetchDiff(prRef: string): Promise<string>;
  fetchChecks(prRef: string): Promise<PrCheck[]>;
  fetchCommentsAndReviews(prRef: string): Promise<{ comments: PrComment[]; reviews: PrReview[] }>;
}

const PR_VIEW_FIELDS = [
  'number',
  'title',
  'body',
  'author',
  'state',
  'labels',
  'reviewRequests',
  'baseRefName',
  'headRefName',
  'url',
  'additions',
  'deletions',
  'createdAt',
  'updatedAt',
  'comments',
  'reviews',
].join(',');

export function createGhClient(exec: ExecFn): GhClient {
  async function gh(args: string[]): Promise<string> {
    const result = await exec('gh', args);
    if (result.code !== 0) {
      throw new Error(`gh ${args.join(' ')} failed: ${result.stderr}`);
    }
    return result.stdout;
  }

  return {
    async fetchOverview(prRef: string): Promise<PrOverview> {
      const json = await gh(['pr', 'view', prRef, '--json', PR_VIEW_FIELDS]);
      const data = JSON.parse(json);
      return {
        number: data.number,
        title: data.title,
        body: data.body ?? '',
        author: data.author ?? { login: 'unknown' },
        state: data.state ?? 'OPEN',
        labels: data.labels ?? [],
        reviewers: (data.reviewRequests ?? []).map((r: { login?: string }) => ({
          login: r.login ?? 'unknown',
        })),
        baseRefName: data.baseRefName ?? '',
        headRefName: data.headRefName ?? '',
        url: data.url ?? '',
        additions: data.additions ?? 0,
        deletions: data.deletions ?? 0,
        createdAt: data.createdAt ?? '',
        updatedAt: data.updatedAt ?? '',
      };
    },

    async fetchDiff(prRef: string): Promise<string> {
      return gh(['pr', 'diff', prRef]);
    },

    async fetchChecks(prRef: string): Promise<PrCheck[]> {
      const json = await gh(['pr', 'checks', prRef, '--json', 'name,state,description,detailsUrl']);
      const data = JSON.parse(json);
      if (!Array.isArray(data)) return [];
      return data.map((c: Record<string, string>) => ({
        name: c.name ?? '',
        state: c.state ?? 'PENDING',
        description: c.description ?? '',
        detailsUrl: c.detailsUrl ?? '',
      }));
    },

    async fetchCommentsAndReviews(
      prRef: string,
    ): Promise<{ comments: PrComment[]; reviews: PrReview[] }> {
      const json = await gh(['pr', 'view', prRef, '--json', 'comments,reviews']);
      const data = JSON.parse(json);

      const comments: PrComment[] = (data.comments ?? []).map((c: Record<string, unknown>) => ({
        author: (c.author as { login: string }) ?? { login: 'unknown' },
        body: (c.body as string) ?? '',
        createdAt: (c.createdAt as string) ?? '',
      }));

      const reviews: PrReview[] = (data.reviews ?? []).map((r: Record<string, unknown>) => ({
        author: (r.author as { login: string }) ?? { login: 'unknown' },
        state: (r.state as string) ?? 'COMMENTED',
        body: (r.body as string) ?? '',
        createdAt: (r.createdAt as string) ?? '',
        comments: ((r.comments as Record<string, unknown>[]) ?? []).map((c) => ({
          author: (c.author as { login: string }) ?? { login: 'unknown' },
          body: (c.body as string) ?? '',
          createdAt: (c.createdAt as string) ?? '',
          path: c.path as string | undefined,
          line: c.line as number | undefined,
        })),
      }));

      return { comments, reviews };
    },
  };
}
