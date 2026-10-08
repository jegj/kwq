import { rmSync } from 'node:fs';
import { build, context } from 'esbuild';

const watch = process.argv.includes('--watch');
const options = {
  entryPoints: [
    { in: 'assets/css/main.css', out: 'app' },
    { in: 'assets/js/app.js', out: 'app' },
    { in: 'assets/js/dashboard.js', out: 'dashboard' },
  ],
  bundle: true,
  minify: !watch,
  sourcemap: watch,
  outdir: 'dist/public',
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
