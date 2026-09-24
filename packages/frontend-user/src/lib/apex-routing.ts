import { marketingHref, productAppHref } from './app-origin';

const MARKETING_HOST = 'writehumanly.net';
const PRODUCT_APP_HOST = 'app.writehumanly.net';
const MARKETING_PATHS = [
  '/',
  '/about',
  '/blog',
  '/docs',
  '/privacy',
  '/pricing',
  '/research',
  '/terms',
] as const;
const PASS_THROUGH_PREFIXES = [
  '/_next',
  '/api',
  '/brand',
  '/health',
];
const PASS_THROUGH_PATHS = new Set([
  '/favicon.ico',
  '/apple-icon.png',
  '/manifest.json',
  '/robots.txt',
  '/sitemap.xml',
]);

function isPassThroughPath(pathname: string): boolean {
  return PASS_THROUGH_PATHS.has(pathname)
    || PASS_THROUGH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    || /\/[^/]+\.[^/]+$/.test(pathname);
}

function isMarketingPath(pathname: string): boolean {
  return MARKETING_PATHS.some((path) => (
    path === '/'
      ? pathname === path
      : pathname === path || pathname.startsWith(`${path}/`)
  ));
}

export function getCanonicalRedirectLocation(
  host: string | null | undefined,
  pathname: string,
  search = ''
): string | null {
  const normalizedHost = host?.split(':')[0].toLowerCase();
  if (!normalizedHost || isPassThroughPath(pathname)) {
    return null;
  }

  const targetPath = `${pathname}${search}`;
  if (normalizedHost === MARKETING_HOST && !isMarketingPath(pathname)) {
    return productAppHref(targetPath, { allowRelativeInNonProduction: false });
  }

  if (normalizedHost === PRODUCT_APP_HOST && isMarketingPath(pathname)) {
    return marketingHref(targetPath, { allowRelativeInNonProduction: false });
  }

  return null;
}
