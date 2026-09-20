export class InventoryServiceError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 409 | 503,
    public readonly code: string,
  ) {
    super(message);
    this.name = "InventoryServiceError";
  }
}
