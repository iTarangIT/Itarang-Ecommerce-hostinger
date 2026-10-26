import { describe, expect, it } from 'vitest';
import { isStaleBuildError } from './stale-build';

function err(message: string, name = 'Error'): Error {
  const e = new Error(message);
  e.name = name;
  return e;
}

describe('isStaleBuildError', () => {
  it('recognises the errors an outdated build produces', () => {
    expect(isStaleBuildError(err('Loading chunk 4521 failed.', 'ChunkLoadError'))).toBe(true);
    expect(isStaleBuildError(err('Loading CSS chunk app-layout failed.'))).toBe(true);
    expect(isStaleBuildError(err('Failed to fetch dynamically imported module: /x.js'))).toBe(true);
    expect(isStaleBuildError(err('Failed to find Server Action "abc".'))).toBe(true);
  });

  it('recognises page data cut off by a server restart', () => {
    expect(isStaleBuildError(err('Connection closed.'))).toBe(true);
    expect(isStaleBuildError(err('Failed to fetch', 'TypeError'))).toBe(true);
    expect(isStaleBuildError(err('NetworkError when attempting to fetch resource.', 'TypeError'))).toBe(true);
    expect(isStaleBuildError(err('Load failed', 'TypeError'))).toBe(true);
  });

  it('leaves ordinary errors alone', () => {
    expect(isStaleBuildError(err('Failed to fetch the order summary for #123'))).toBe(false);
    expect(isStaleBuildError(err('Cannot read properties of undefined'))).toBe(false);
    expect(isStaleBuildError(err('An error occurred in the Server Components render.'))).toBe(false);
    expect(isStaleBuildError(undefined)).toBe(false);
  });
});
