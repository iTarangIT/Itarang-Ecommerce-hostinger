/**
 * Recovery for a browser that is running an older build than the server.
 *
 * A browser or CDN that kept a previous release's HTML or JS asks for chunks
 * the current release no longer serves, and the page falls into an error
 * boundary on the client — no digest, nothing in the server log. `reset()`
 * cannot help because it re-renders with the same stale code; only a full
 * reload fetches the current build.
 *
 * A deploy restarts the server, and a navigation in flight at that moment has
 * its page data cut off ("Connection closed", "Failed to fetch"). That lands in
 * the same boundary with no digest, and a reload is the same cure, so those
 * errors are treated alike.
 *
 * The reload happens at most once per page per minute, so a chunk that is
 * genuinely missing shows the error screen instead of looping.
 */
const STALE_BUILD_PATTERN =
  /ChunkLoadError|Loading (CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Failed to find Server Action|Unexpected token '<'|^\S+ (Connection closed|Failed to fetch|NetworkError when attempting to fetch resource|Load failed|network error)\.?$/i;

const RELOAD_KEY = 'itarang_stale_reload';
const RELOAD_WINDOW_MS = 60_000;

export function isStaleBuildError(error: Error | undefined | null): boolean {
  if (!error) return false;
  return STALE_BUILD_PATTERN.test(`${error.name} ${error.message}`);
}

/** Reloads the page if it has not just done so. Returns whether it reloaded. */
export function reloadOnceForStaleBuild(): boolean {
  if (typeof window === 'undefined') return false;
  const key = `${RELOAD_KEY}:${window.location.pathname}`;
  try {
    const last = Number(window.sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return false;
    window.sessionStorage.setItem(key, String(Date.now()));
  } catch {
    // Storage blocked: reloading without a guard risks a loop, so don't.
    return false;
  }
  window.location.reload();
  return true;
}
