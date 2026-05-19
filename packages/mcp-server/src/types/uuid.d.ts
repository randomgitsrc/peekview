declare module 'uuid' {
  export function validate(uuid: string): boolean;
  export function v4(): string;
  export function v4(options: { random: number[] }): string;
}
