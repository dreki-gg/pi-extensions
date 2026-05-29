import { errorDetails, errorMessage } from '../errors.js';

export function textResult(text: string, details?: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text }],
    details: (details ?? {}) as Record<string, unknown>,
  };
}

export function errorResult(text: string, details?: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text }],
    details: (details ?? {}) as Record<string, unknown>,
    isError: true,
  };
}

export function firestoreErrorResult(error: unknown) {
  const message = errorMessage(error);
  return errorResult(`❌ Firestore error: ${message}`, errorDetails(error));
}

export function notConfiguredError() {
  return errorResult(
    '❌ Firestore not configured. Create `.pi/firestore.json` with `projectId` and `serviceAccountKeyPath`.',
    { error: 'not_configured' },
  );
}
