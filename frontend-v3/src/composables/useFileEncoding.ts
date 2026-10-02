export function isBinaryContent(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false
  if (bytes.includes(0)) return true
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return false
  } catch {
    return true
  }
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }
  return btoa(binary)
}

export interface EncodedFileContent {
  isBinary: boolean
  content?: string
  contentBase64?: string
}

export async function readFileAsEncoded(file: File): Promise<EncodedFileContent> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  if (isBinaryContent(bytes)) {
    return { isBinary: true, contentBase64: arrayBufferToBase64(buffer) }
  }
  return { isBinary: false, content: new TextDecoder().decode(bytes) }
}

export function useFileEncoding() {
  return { isBinaryContent, arrayBufferToBase64, readFileAsEncoded }
}
