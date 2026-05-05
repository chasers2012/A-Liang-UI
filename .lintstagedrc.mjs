export default {
  'apps/web/src/**/*.{js,jsx,ts,tsx,mjs,cjs}': (files) => {
    const webRelative = files.map((file) => file.replace(/^apps\/web\//, ''));
    const args = webRelative.map((f) => JSON.stringify(f)).join(' ');
    return `pnpm --dir apps/web lint:fix -- ${args}`;
  },
  '*.{js,jsx,ts,tsx,mjs,cjs,json,md,yml,yaml,css}': 'prettier --write',
};
