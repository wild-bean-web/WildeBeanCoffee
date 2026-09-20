export class LocationScopeError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
    public readonly code: string = "LOCATION_REQUIRED",
  ) {
    super(message);
    this.name = "LocationScopeError";
  }
}
