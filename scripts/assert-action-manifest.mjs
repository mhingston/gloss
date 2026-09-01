import { readFile } from 'node:fs/promises';

const manifestPath = process.argv[2] ?? '.output/chrome-mv3/manifest.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const action = manifest.action ?? manifest.browser_action;

if (!action) {
  console.error(`Expected an extension action in ${manifestPath}.`);
  process.exit(1);
}

if (action.default_popup) {
  console.error(
    `Unexpected action.default_popup (${JSON.stringify(action.default_popup)}) in ${manifestPath}. ` +
      'Gloss toolbar clicks must be handled by browser.action.onClicked.',
  );
  process.exit(1);
}

console.log(`Verified ${manifestPath}: toolbar action has no default popup.`);
