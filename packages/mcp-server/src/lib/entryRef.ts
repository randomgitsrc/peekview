export class EntryRefError extends Error {}

export interface EntryRef {
  kind: 'url' | 'slug';
  host: string;
  slug: string;
  shareToken?: string;
}

const HTTP_LOCALHOST = new Set(['localhost', '127.0.0.1', '::1']);

export function parseEntryRef(ref: string, config: { peekviewUrl: string }): EntryRef {
  const input = ref.trim();
  if (!input) {
    throw new EntryRefError('无法识别为 PeekView 链接或 slug');
  }

  if (!input.includes('://') && !input.includes('/')) {
    return {
      kind: 'slug',
      host: config.peekviewUrl.replace(/\/$/, ''),
      slug: input,
    };
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new EntryRefError('无法识别为 PeekView 链接或 slug');
  }

  if (url.protocol === 'http:') {
    if (!HTTP_LOCALHOST.has(url.hostname)) {
      throw new EntryRefError(`不支持的 host：http 仅允许 localhost/127.0.0.1`);
    }
  } else if (url.protocol !== 'https:') {
    throw new EntryRefError(`协议不支持：${url.protocol.replace(/:$/, '')}`);
  }

  const rawPath = input.slice(input.indexOf(url.host) + url.host.length);
  if (rawPath.includes('..')) {
    throw new EntryRefError('无法识别为 PeekView 链接');
  }

  const shareToken = url.searchParams.get('share') || undefined;

  const pathname = url.pathname.replace(/\/+$/, '');
  let slug: string;
  if (pathname.startsWith('/api/v1/entries/')) {
    const rest = pathname.slice('/api/v1/entries/'.length);
    if (!rest.endsWith('/raw') || !rest) {
      throw new EntryRefError('无法识别为 PeekView 链接');
    }
    slug = rest.slice(0, -'/raw'.length);
  } else if (pathname.endsWith('/raw')) {
    slug = pathname.slice(0, -'/raw'.length).replace(/^\/+/, '');
  } else {
    const seg = pathname.slice(1);
    if (!seg || seg.includes('/')) {
      throw new EntryRefError('无法识别为 PeekView 链接');
    }
    slug = seg;
  }

  if (!slug) {
    throw new EntryRefError('无法识别为 PeekView 链接');
  }

  const result: EntryRef = {
    kind: 'url',
    host: url.origin,
    slug,
  };
  if (shareToken) result.shareToken = shareToken;
  return result;
}
