export class PersistenceError extends Error {
  constructor(
    public readonly operation: string,
    public readonly errorCode?: string,
  ) {
    super(`Persistence operation failed: ${operation}.`);
    this.name = "PersistenceError";
  }
}

export function persistenceError(operation: string, error: { code?: string } | null): PersistenceError {
  return new PersistenceError(operation, error?.code);
}
