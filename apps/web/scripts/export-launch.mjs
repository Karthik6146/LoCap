// Builds the /launch page as a static site for GitHub Pages.
// The full app cannot use `output: 'export'` (API routes, database pages), so this copies only the
// launch page and what it imports into a staging folder and builds that.
// Usage (from apps/web): node scripts/export-launch.mjs   -> static site in apps/web/.launch-export/out
// BASE_PATH defaults to /LoCap (https://<user>.github.io/LoCap/). Set BASE_PATH= for a custom domain root.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const stage = join(web, '.launch-export');
const basePath = process.env.BASE_PATH ?? '/LoCap';

rmSync(stage, { recursive: true, force: true });
mkdirSync(join(stage, 'app'), { recursive: true });

const copy = (from, to = from) => cpSync(join(web, from), join(stage, to), { recursive: true });
copy('app/layout.tsx');
copy('app/icon.svg');
copy('public');
copy('components/ui');
copy('components/launch');
copy('components/caption-overlay.tsx');
copy('tailwind.config.ts');
copy('postcss.config.mjs');
copy('next-env.d.ts');

// Absolute font URLs in CSS are not rewritten by basePath.
writeFileSync(join(stage, 'app/globals.css'), readFileSync(join(web, 'app/globals.css'), 'utf8').replaceAll("url('/fonts/", `url('${basePath}/fonts/`));
// The launch page becomes the site root and its sub-pages move up with it; links use launchHref(), which
// reads NEXT_PUBLIC_LAUNCH_BASE (set to '' for this build below).
copy('app/launch/page.tsx', 'app/page.tsx');
for (const page of ['privacy', 'terms', 'open-source']) copy(`app/launch/${page}`, `app/${page}`);

writeFileSync(join(stage, 'tsconfig.json'), JSON.stringify({
  extends: '../../../tsconfig.base.json',
  compilerOptions: { lib: ['dom', 'dom.iterable', 'esnext'], allowJs: true, skipLibCheck: true, strict: true, noEmit: true, esModuleInterop: true, module: 'esnext', moduleResolution: 'bundler', resolveJsonModule: true, isolatedModules: true, jsx: 'preserve', incremental: false, plugins: [{ name: 'next' }], paths: { '@/*': ['./*'] } },
  include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
  exclude: ['node_modules', 'out', '.next'],
}, null, 2));

writeFileSync(join(stage, 'next.config.mjs'), `export default ${JSON.stringify({
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ['@clipx/captions', '@clipx/types'],
  eslint: { ignoreDuringBuilds: true },
}, null, 2)};\n`);

// Call Next's CLI directly with the stage dir: `npx` inside a workspace runs from the workspace root.
const nextBin = createRequire(join(web, 'package.json')).resolve('next/dist/bin/next');
execSync(`"${process.execPath}" "${nextBin}" build "${stage}"`, { cwd: stage, stdio: 'inherit', env: { ...process.env, NEXT_PUBLIC_LAUNCH_BASE: '' } });

const out = join(stage, 'out');
for (const page of ['index.html', 'privacy/index.html', 'terms/index.html', 'open-source/index.html']) {
  if (!existsSync(join(out, page))) throw new Error(`Export failed: no ${page} in ${out}`);
}
// GitHub Pages runs Jekyll by default, which drops the _next folder.
writeFileSync(join(out, '.nojekyll'), '');
console.log(`\nStatic launch site ready: ${out} (base path "${basePath || '/'}")`);
