/**
 * Routes available to users with limited ("off-season") access:
 * either the whole app is set to inactive mode, or the leader is
 * not active in the current period.
 */
export const LIMITED_ACCESS_ROUTES = [
  '/',
  '/chat',
  '/leaders',
  '/profile',
  '/mer',
  '/lederpass',
  '/klineliste',
  '/kline-tinder',
  '/snus',
  '/feedback',
  '/pov',
  '/slurker',
] as const;

export function isLimitedAccessRoute(path: string): boolean {
  const clean = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return (LIMITED_ACCESS_ROUTES as readonly string[]).includes(clean);
}