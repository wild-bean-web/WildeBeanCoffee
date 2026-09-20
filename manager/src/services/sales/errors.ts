export class SalesServiceError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 403 | 404 | 409 | 502,
    public readonly code: string,
  ) {
    super(message);
    this.name = "SalesServiceError";
  }
}
