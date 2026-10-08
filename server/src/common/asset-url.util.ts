import { readFileSync, statSync } from 'node:fs';

type Manifest = Record<string, string>;

// Builds `asset('app.css')` -> '/assets/app.css?v=<content hash>' from the
// manifest written by scripts/build-assets.mjs. The manifest is re-read when
// its mtime changes so the dev watcher's rebuilds show up without a restart.
export function createAssetUrl(manifestPath: string) {
  let loadedAt = 0;
  let manifest: Manifest = {};

  const refresh = () => {
    try {
      const { mtimeMs } = statSync(manifestPath);
      if (mtimeMs === loadedAt) return;
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      loadedAt = mtimeMs;
    } catch {
      manifest = {};
      loadedAt = 0;
    }
  };

  return (name: string): string => {
    refresh();
    const hash = manifest[name];
    return hash ? `/assets/${name}?v=${hash}` : `/assets/${name}`;
  };
}
