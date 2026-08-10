import ReactDOM from 'react-dom/client';
import { GlossPanel } from '@/components/GlossPanel';
import { watchPageTheme } from '@/lib/pageTheme';
import { keepHostOnTop, watchHostOnTop } from '@/lib/widget';
import type { ExtensionMessage } from '@/lib/types';
import './style.css';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  excludeMatches: ['*://chromewebstore.google.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'gloss-panel',
      position: 'overlay',
      alignment: 'top-left',
      zIndex: 2147483647,
      isolateEvents: ['keydown', 'keyup', 'keypress'],
      anchor: () => document.documentElement,
      append: (_anchor, host) => {
        document.documentElement.append(host);
      },
      onMount(container, _shadow, shadowHost) {
        keepHostOnTop(shadowHost);
        const stopWatch = watchHostOnTop(shadowHost);
        const app = document.createElement('div');
        app.id = 'gloss-root';
        container.append(app);
        const stopTheme = watchPageTheme((dark) => {
          app.dataset.theme = dark ? 'dark' : 'light';
          void browser.runtime.sendMessage({
            type: 'SET_ICON_THEME',
            dark,
          } satisfies ExtensionMessage);
        });
        const root = ReactDOM.createRoot(app);
        root.render(<GlossPanel />);
        return { root, stopWatch, stopTheme };
      },
      onRemove(mounted) {
        mounted?.stopWatch();
        mounted?.stopTheme();
        mounted?.root.unmount();
      },
    });

    ui.mount();
  },
});
