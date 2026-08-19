import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: 'page-can',
    description: 'Favoriler, yer imleri, odak takibi ve yapılacaklar için sade yeni sekme deneyimi.',
    version: '0.1.0',
    permissions: [
      'storage',
      'bookmarks',
      'alarms',
      'notifications',
      'favicon',
      'scripting',
    ],
    host_permissions: [
      'https://www.youtube.com/*',
      'https://music.youtube.com/*',
    ],
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
  },
});
