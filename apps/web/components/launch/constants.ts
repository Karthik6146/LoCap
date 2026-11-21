/** Shared launch-page values. Figures come from README.md; keep them in sync. */
export const REPO_URL = 'https://github.com/Karthik6146/LoCap';

/** Section shell: one width and rhythm for every launch section. */
export const SECTION = 'mx-auto max-w-6xl px-6 py-24 border-t border-border';
export const SECTION_TITLE = 'font-display text-3xl font-medium tracking-tight text-gray-100 sm:text-4xl';
export const SECTION_LEDE = 'mt-4 max-w-2xl text-base leading-7 text-gray-400';

/** Launch site root: /launch inside the app, the site root in the static export (export-launch.mjs sets it to ''). */
const LAUNCH_HOME = process.env.NEXT_PUBLIC_LAUNCH_BASE ?? '/launch';
/** '#why' -> section on the home page; '/privacy' -> a launch sub-page. */
export const launchHref = (path: string) => (path.startsWith('#') ? (LAUNCH_HOME || '/') + path : LAUNCH_HOME + path);
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
export const NOTICES_URL = `${REPO_URL}/blob/main/THIRD_PARTY_NOTICES.md`;
