const DATA_IMAGE_RE = /data:\s*image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi;
const MD_IMAGE_RE = /!\[([^\]]*)\]\(\s*(data:\s*image\/[^)\s]+;base64,[a-z0-9+/=]+)\s*\)/gi;
const IMG_TAG_RE = /<img\b[^>]*>/gi;

function placeholder(alt: string, uri: string): string {
  const kb = (uri.length * 3 / 4) / 1024;
  const kbText = kb >= 10 ? kb.toFixed(0) : kb.toFixed(2);
  return `[image: ${alt} (${kbText} KB, base64)]`;
}

function replaceImgTag(tag: string): string {
  const src = tag.match(/\bsrc\s*=\s*"?(data:\s*image\/[^"\s>]+;base64,[a-z0-9+/=]+)"?/i);
  if (!src) return tag;
  const alt = tag.match(/\balt\s*=\s*"([^"]*)"/i);
  return placeholder(alt ? alt[1] : '', src[1]);
}

export function purifyContent(content: string): string {
  let out = content.replace(MD_IMAGE_RE, (_match, alt: string, uri: string) => placeholder(alt, uri));
  out = out.replace(IMG_TAG_RE, replaceImgTag);
  return out.replace(DATA_IMAGE_RE, (uri: string) => placeholder('', uri));
}
