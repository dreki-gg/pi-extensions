/** Validates that a path represents a collection (odd number of segments). */
export function validateCollectionPath(path: string): void {
  if (path.endsWith('/')) {
    throw new Error(`Path cannot end with a trailing slash: "${path}"`);
  }
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) {
    throw new Error('Path cannot be empty');
  }
  if (segments.length % 2 === 0) {
    throw new Error(
      `"${path}" is a document path (even segments). Expected a collection path (odd segments).`,
    );
  }
}

/** Validates that a path represents a document (even number of segments). */
export function validateDocumentPath(path: string): void {
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) {
    throw new Error('Path cannot be empty');
  }
  if (segments.length % 2 !== 0) {
    throw new Error(
      `"${path}" is a collection path (odd segments). Expected a document path (even segments).`,
    );
  }
}
