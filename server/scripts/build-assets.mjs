import { createHash } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { build, context } from 'esbuild';

const watch = process.argv.includes('--watch');
const OUTDIR = 'dist/public';
const ENTRIES = ['app.css', 'app.js', 'dashboard.js'];

// Content hashes the server appends as ?v= (see src/common/asset-url.util.ts),
// so URLs only change when a file's bytes do.
const writeManifest = {
  name: 'manifest',
  setup(build) {
    build.onEnd(() => {
      const hashes = Object.fromEntries(
        ENTRIES.map((name) => [
          name,
          createHash('sha256')
            .update(readFileSync(`${OUTDIR}/${name}`))
            .digest('hex')
            .slice(0, 8),
        ]),
      );
      writeFileSync(`${OUTDIR}/manifest.json`, JSON.stringify(hashes));
    });
  },
};
const options = {
  entryPoints: [
    { in: 'assets/css/main.css', out: 'app' },
    { in: 'assets/js/app.js', out: 'app' },
    { in: 'assets/js/dashboard.js', out: 'dashboard' },
  ],
  bundle: true,
  minify: !watch,
  sourcemap: watch,
  outdir: OUTDIR,
  plugins: [writeManifest],
  logLevel: 'info',
};

// Start clean so stale files (old sourcemaps, renamed entries) never ship.
rmSync(options.outdir, { recursive: true, force: true });

if (!watch) {
  await build(options);
} else {
  const ctx = await context(options);
  await ctx.watch();
}
