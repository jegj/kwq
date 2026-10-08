import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAssetUrl } from './asset-url.util.js';

describe('createAssetUrl', () => {
  let directory: string;
  let manifestPath: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'asset-url-'));
    manifestPath = join(directory, 'manifest.json');
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('appends the content hash from the manifest', () => {
    writeFileSync(manifestPath, JSON.stringify({ 'app.css': 'abc12345' }));

    expect(createAssetUrl(manifestPath)('app.css')).toBe(
      '/assets/app.css?v=abc12345',
    );
  });

  it('returns a plain url when the file is not in the manifest', () => {
    writeFileSync(manifestPath, JSON.stringify({}));

    expect(createAssetUrl(manifestPath)('app.css')).toBe('/assets/app.css');
  });

  it('returns a plain url when there is no manifest yet', () => {
    expect(createAssetUrl(manifestPath)('app.css')).toBe('/assets/app.css');
  });

  it('picks up a rebuilt manifest without a restart', () => {
    writeFileSync(manifestPath, JSON.stringify({ 'app.css': 'old00000' }));
    const asset = createAssetUrl(manifestPath);
    expect(asset('app.css')).toBe('/assets/app.css?v=old00000');

    writeFileSync(manifestPath, JSON.stringify({ 'app.css': 'new11111' }));
    const later = new Date(Date.now() + 5000);
    utimesSync(manifestPath, later, later);

    expect(asset('app.css')).toBe('/assets/app.css?v=new11111');
  });
});
