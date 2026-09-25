export function databasePoolMax(options: {
  serverless: boolean;
  configured: number;
}): number {
  if (options.serverless) return 1;
  if (!Number.isInteger(options.configured) || options.configured < 1) return 1;
  return Math.min(options.configured, 10);
}
