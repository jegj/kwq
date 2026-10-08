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

if (!watch) {
  await build(options);
} else {
  const ctx = await context(options);
  await ctx.watch();
}
