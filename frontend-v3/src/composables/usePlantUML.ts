export interface ValidationResult {
  ok: boolean
  reason?: string
}

export function validateSource(code: string): ValidationResult {
  throw new Error('not implemented: P4 will implement')
}

export async function render(code: string, theme?: 'dark' | 'light'): Promise<string> {
  throw new Error('not implemented: P4 will implement')
}

export async function ensureLoaded(): Promise<void> {
  throw new Error('not implemented: P4 will implement')
}
