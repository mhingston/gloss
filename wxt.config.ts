import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  webExt: {
    binaries: {
      chrome: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    },
    chromiumArgs: [
      '--user-data-dir=./.wxt/chrome-data',
      '--disable-features=DisableLoadExtensionCommandLineSwitch',
    ],
    startUrls: ['chrome://extensions', 'https://example.com'],
  },
  manifest: {
    name: 'Gloss',
    description: 'Personalize any website with a floating orb. Unpacked only.',
    permissions: ['storage', 'tabs', 'userScripts'],
    host_permissions: ['<all_urls>'],
    commands: {
      'toggle-gloss': {
        suggested_key: {
          default: 'Ctrl+Shift+Y',
          mac: 'Command+Shift+Y',
        },
        description: 'Toggle Gloss',
      },
    },
    action: {
      default_title: 'Gloss',
    },
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
  },
});
