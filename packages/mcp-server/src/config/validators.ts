/**
 * Configuration validation functions
 */

export function validateUrl(value: string, field: string): void {
  if (!value) {
    throw new Error(`${field}: Required`);
  }
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    throw new Error(`${field}: Must start with http:// or https://`);
  }
  try {
    new URL(value);
  } catch {
    throw new Error(`${field}: Invalid URL format`);
  }
}

export function validatePort(value: number | string, field: string): void {
  const port = typeof value === 'string' ? parseInt(value, 10) : value;
  if (
    isNaN(port) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error(`${field}: Must be an integer between 1 and 65535`);
  }
}

export function validateLogLevel(value: string): void {
  const validLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLevels.includes(value.toLowerCase())) {
    throw new Error(
      `logging.level: Must be one of ${validLevels.join(', ')}`
    );
  }
}

export function validateCorsOrigins(value: string): void {
  const origins = value.split(',').map((s) => s.trim());
  for (const origin of origins) {
    if (origin === '*') continue;
    if (origin.includes('://')) {
      try {
        new URL(origin);
      } catch {
        throw new Error(`CORS origin "${origin}" is not a valid URL`);
      }
    } else {
      throw new Error(`CORS origin "${origin}" is not a valid URL`);
    }
  }
}
