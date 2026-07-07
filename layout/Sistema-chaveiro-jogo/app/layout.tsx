import './globals.css';
import type { Metadata } from 'next';
import { Providers } from './Providers';

const reactDevtoolsGuard = `
(function () {
  if (typeof window === 'undefined') return;

  const key = '__REACT_DEVTOOLS_GLOBAL_HOOK__';
  const existing = window[key];
  const safeHook = {
    supportsFiber: true,
    renderers: new Map(),
    inject: function () {},
    onCommitFiberRoot: function () {},
    onCommitFiber: function () {},
    onPostCommitFiberRoot: function () {},
    checkDCE: function () {},
    registerInternalModuleStart: function () {},
    registerInternalModuleStop: function () {},
    subscribe: function () {},
    disconnect: function () {}
  };

  if (existing && typeof existing === 'object') {
    Object.assign(safeHook, existing);
    safeHook.inject = function () {};
    safeHook.onCommitFiberRoot = function () {};
    safeHook.onCommitFiber = function () {};
    safeHook.onPostCommitFiberRoot = function () {};
    safeHook.checkDCE = function () {};
    safeHook.registerInternalModuleStart = function () {};
    safeHook.registerInternalModuleStop = function () {};
  }

  Object.defineProperty(window, key, {
    configurable: false,
    writable: false,
    value: safeHook
  });
})();
`;

export const metadata: Metadata = {
  title: 'RetroKey',
  description: 'A retro gaming experience with NFC cartridges.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: reactDevtoolsGuard }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
