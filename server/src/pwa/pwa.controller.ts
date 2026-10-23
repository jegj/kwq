import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Controller, Get, Header } from '@nestjs/common';

// Copied next to this file by nest-cli `assets`, so it resolves in src/ and dist/.
const serviceWorker = readFileSync(join(import.meta.dirname, 'sw.js'), 'utf8');

const BACKGROUND = '#13171f';

const manifest = JSON.stringify({
  name: 'kwq',
  short_name: 'kwq',
  start_url: '/app/dashboard',
  scope: '/',
  display: 'standalone',
  theme_color: BACKGROUND,
  background_color: BACKGROUND,
  icons: [
    { src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png' },
    {
      src: '/assets/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
});

// Public on purpose: browsers fetch both without the session cookie, and a
// login redirect would break installability.
@Controller()
export class PwaController {
  // no-cache so a new worker is picked up on the next visit, not pinned by
  // the immutable /assets/ cache header.
  @Get('sw.js')
  @Header('Content-Type', 'text/javascript; charset=utf-8')
  @Header('Cache-Control', 'no-cache')
  worker() {
    return serviceWorker;
  }

  @Get('manifest.webmanifest')
  @Header('Content-Type', 'application/manifest+json; charset=utf-8')
  manifest() {
    return manifest;
  }
}
