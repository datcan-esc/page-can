import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

async function createStorageHarness(initialState = {}) {
  const state = {
    local: structuredClone(initialState.local ?? {}),
    sync: structuredClone(initialState.sync ?? {}),
    bookmarks: structuredClone(initialState.bookmarks ?? { recent: [], tree: [] }),
    calls: { getRecent: 0, getTree: 0 },
    storageGets: { local: [], sync: [] },
  };
  globalThis.__pageCanStorageTestState = state;

  const server = await createServer({
    configFile: false,
    appType: 'custom',
    resolve: {
      alias: {
        'wxt/browser': fileURLToPath(new URL('./browser.mock.mjs', import.meta.url)),
      },
    },
    server: { middlewareMode: true, hmr: false, ws: false },
  });

  const storage = await server.ssrLoadModule('/lib/storage.ts');
  const scratchpad = await server.ssrLoadModule('/lib/scratchpad.ts');
  const todos = await server.ssrLoadModule('/lib/todos.ts');
  const utils = await server.ssrLoadModule('/lib/utils.ts');
  const bookmarks = await server.ssrLoadModule('/lib/bookmarks.ts');
  const notePreferences = await server.ssrLoadModule('/lib/note-preferences.ts');
  return {
    state,
    bookmarks,
    notePreferences,
    scratchpad,
    storage,
    todos,
    utils,
    async close() {
      await server.close();
      delete globalThis.__pageCanStorageTestState;
    },
  };
}

test('storage sınırları ve todo migration', async (t) => {
  await t.test('başlangıçta tam yer imi ağacını okumaz', async () => {
    const recent = Array.from({ length: 8 }, (_, index) => ({
      id: String(index),
      title: `Yer imi ${index}`,
      url: `https://example.com/${index}`,
      dateAdded: index,
    }));
    const harness = await createStorageHarness({
      bookmarks: {
        recent,
        tree: [{ id: 'root', title: '', children: recent }],
      },
    });
    try {
      assert.equal((await harness.bookmarks.loadRecentBookmarks()).length, 5);
      assert.deepEqual(harness.state.calls, { getRecent: 1, getTree: 0 });
      assert.equal((await harness.bookmarks.loadAllBookmarks()).length, 8);
      assert.deepEqual(harness.state.calls, { getRecent: 1, getTree: 1 });
    } finally {
      await harness.close();
    }
  });

  await t.test('URL, tarih aralıkları ve sayı kısayollarını normalize eder', async () => {
    const harness = await createStorageHarness();
    try {
      assert.equal(harness.utils.normalizeUrl('example.com'), 'https://example.com/');
      assert.deepEqual(
        harness.utils.localWeekRange(new Date(2026, 7, 9, 12)),
        { start: '2026-08-03', end: '2026-08-09' },
      );
      assert.deepEqual(
        harness.utils.localMonthRange(new Date(2026, 7, 9, 12)),
        { start: '2026-08-01', end: '2026-08-31' },
      );
      const numberEvent = {
        key: '1',
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        isComposing: false,
        repeat: false,
      };
      assert.equal(harness.utils.numberShortcutIndex(numberEvent), 0);
      assert.equal(harness.utils.numberShortcutIndex({ ...numberEvent, key: '9' }), 8);
      assert.equal(harness.utils.numberShortcutIndex({ ...numberEvent, key: '0' }), null);
      assert.equal(harness.utils.numberShortcutIndex({ ...numberEvent, ctrlKey: true }), null);
      assert.equal(harness.utils.singleKeyFromEvent({ ...numberEvent, key: 'Shift', shiftKey: true }), 'Shift');
      assert.equal(harness.utils.singleKeyFromEvent({ ...numberEvent, key: 'k' }), 'K');
    } finally {
      await harness.close();
    }
  });

  await t.test('öğeleri kimlikleriyle yeniden sıralar', async () => {
    const harness = await createStorageHarness();
    try {
      const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
      const movedForward = harness.utils.moveItemById(items, 'a', 'c');
      const movedBackward = harness.utils.moveItemById(items, 'd', 'b');

      assert.deepEqual(movedForward.map((item) => item.id), ['b', 'c', 'a', 'd']);
      assert.deepEqual(movedBackward.map((item) => item.id), ['a', 'd', 'b', 'c']);
      assert.deepEqual(items.map((item) => item.id), ['a', 'b', 'c', 'd']);
      assert.equal(harness.utils.moveItemById(items, 'missing', 'b'), items);
      assert.equal(harness.utils.moveItemById(items, 'b', 'b'), items);
    } finally {
      await harness.close();
    }
  });

  await t.test('geçersiz ayarları güvenli varsayılanlara çevirir', async () => {
    const harness = await createStorageHarness();
    try {
      const settings = harness.storage.normalizeSettings({
        theme: { cardOpacity: 99, primaryColor: 'not-a-color' },
        pomodoro: { focusMinutes: Number.NaN, shortcut: 42 },
      });
      assert.equal(settings.theme.cardOpacity, 1);
      assert.equal(settings.theme.primaryColor, '#5e5ce6');
      assert.equal(settings.pomodoro.focusMinutes, 25);
      assert.equal(settings.pomodoro.shortcut, 'Space');
      assert.equal(settings.pomodoro.idleMinutes, 15);
      assert.equal(settings.pomodoro.checkInMinutes, 60);
      assert.equal(settings.media.shortcut, '');
      assert.deepEqual(settings.shortcuts, { revealKey: 'Shift', todoFocus: '' });

      const shortcuts = harness.storage.normalizeSettings({
        shortcuts: { revealKey: 'Alt', todoFocus: 'Ctrl+T' },
      });
      assert.deepEqual(shortcuts.shortcuts, { revealKey: 'Alt', todoFocus: 'Ctrl+T' });
    } finally {
      await harness.close();
    }
  });

  await t.test('sayaç güvenlik ayarlarını sınırlar ve 0 ile kapatmaya izin verir', async () => {
    const harness = await createStorageHarness();
    try {
      const limited = harness.storage.normalizeSettings({
        pomodoro: { idleMinutes: 99, checkInMinutes: 4 },
      });
      assert.equal(limited.pomodoro.idleMinutes, 60);
      assert.equal(limited.pomodoro.checkInMinutes, 15);

      const disabled = harness.storage.normalizeSettings({
        pomodoro: { idleMinutes: 0, checkInMinutes: 0 },
      });
      assert.equal(disabled.pomodoro.idleMinutes, 0);
      assert.equal(disabled.pomodoro.checkInMinutes, 0);
    } finally {
      await harness.close();
    }
  });

  await t.test('eski favorileri korur ve uygulama klasörlerini 9 siteyle sınırlar', async () => {
    const folderApps = Array.from({ length: 11 }, (_, index) => ({
      id: `app-${index}`,
      name: `Uygulama ${index}`,
      url: `app${index}.example.com`,
      createdAt: index,
    }));
    const harness = await createStorageHarness({
      local: {
        favorites: [
          {
            id: 'legacy-site',
            name: 'Eski favori',
            url: 'example.com',
            shortcut: 'E',
            createdAt: 1,
          },
          {
            kind: 'folder',
            id: 'folder',
            name: 'Araçlar',
            shortcut: 'Ctrl+K',
            apps: folderApps,
            createdAt: 2,
          },
          {
            kind: 'folder',
            id: 'legacy-folder',
            name: 'Eski klasör',
            apps: [],
            createdAt: 3,
          },
        ],
      },
    });
    try {
      const favorites = await harness.storage.loadFavorites();
      assert.deepEqual(favorites[0], {
        kind: 'site',
        id: 'legacy-site',
        name: 'Eski favori',
        url: 'https://example.com/',
        shortcut: 'E',
        createdAt: 1,
      });
      assert.equal(favorites[1].kind, 'folder');
      assert.equal(favorites[1].shortcut, 'Ctrl+K');
      assert.equal(favorites[1].apps.length, 9);
      assert.equal(favorites[1].apps[0].url, 'https://app0.example.com/');
      assert.equal(favorites[2].shortcut, '');

      await harness.storage.saveFavorites(favorites);
      assert.equal(harness.state.local.favorites[0].kind, 'site');
      assert.equal(harness.state.local.favorites[1].apps.length, 9);
      assert.equal(harness.state.local.favorites[2].shortcut, '');
    } finally {
      await harness.close();
    }
  });

  await t.test('eski todo listesini aktif ve tamamlanan anahtarlarına taşır', async () => {
    const harness = await createStorageHarness({
      local: {
        todos: [
          { id: 'active', title: 'Açık görev', completed: false, createdAt: 1 },
          { id: 'done', title: 'Biten görev', completed: true, createdAt: 2, completedAt: 3 },
        ],
      },
    });
    try {
      const active = await harness.storage.loadActiveTodos();
      const completed = await harness.storage.loadCompletedTodos();
      assert.deepEqual(active.map((todo) => todo.id), ['active']);
      assert.deepEqual(completed.map((todo) => todo.id), ['done']);
      assert.equal('todos' in harness.state.local, false);
      assert.deepEqual(harness.state.local.activeTodos.map((todo) => todo.id), ['active']);
      assert.deepEqual(harness.state.local.completedTodos.map((todo) => todo.id), ['done']);
    } finally {
      await harness.close();
    }
  });

  await t.test('uzun ve çok satırlı todo metnini ortak kurala göre normalize eder', async () => {
    const harness = await createStorageHarness();
    try {
      const normalized = harness.todos.normalizeTodoText(
        `  İlk satır  \r\nİkinci satır\n\n\n${'x'.repeat(600)}  `,
      );
      assert.equal(normalized.startsWith('İlk satır\nİkinci satır\n\n'), true);
      assert.equal(normalized.includes('\r'), false);
      assert.equal(normalized.includes('\n\n\n'), false);
      assert.equal(normalized.length, harness.todos.TODO_TEXT_MAX_LENGTH);
    } finally {
      await harness.close();
    }
  });

  await t.test('todo taslağının yalnızca başındaki birden fazla etiketi ayırır', async () => {
    const harness = await createStorageHarness();
    try {
      assert.deepEqual(
        harness.todos.parseTodoDraft('#Page-Can #Bug  Bildirim hatasını düzelt'),
        { title: 'Bildirim hatasını düzelt', tagNames: ['Page-Can', 'Bug'] },
      );
      assert.deepEqual(
        harness.todos.parseTodoDraft('#İş #iş Raporu hazırla'),
        { title: 'Raporu hazırla', tagNames: ['İş'] },
      );
      assert.deepEqual(
        harness.todos.parseTodoDraft('Rapor içinde #iş ifadesini kullan'),
        { title: 'Rapor içinde #iş ifadesini kullan', tagNames: [] },
      );
      assert.equal(
        harness.todos.todoTagColor('PAGE-CAN'),
        harness.todos.todoTagColor('page-can'),
      );
      const longTitle = 'x'.repeat(600);
      const longDraft = harness.todos.parseTodoDraft(`#uzun #metin ${longTitle}`);
      assert.deepEqual(longDraft.tagNames, ['uzun', 'metin']);
      assert.equal(longDraft.title.length, harness.todos.TODO_TEXT_MAX_LENGTH);

      const resolved = harness.todos.resolveTodoTags(['İş', 'Yeni'], [
        { id: 'work', name: 'iş', color: '#123456', createdAt: 1 },
      ], 2);
      assert.equal(resolved.tags.length, 2);
      assert.deepEqual(resolved.tagIds[0], 'work');
      assert.equal(resolved.tags[1].name, 'Yeni');
      assert.equal(resolved.tags[1].createdAt, 2);

      const filters = [{ id: 'work' }, { id: 'personal' }];
      assert.equal(harness.todos.cycleTodoTagFilter(filters, '', 1), 'work');
      assert.equal(harness.todos.cycleTodoTagFilter(filters, 'work', 1), 'personal');
      assert.equal(harness.todos.cycleTodoTagFilter(filters, 'personal', 1), '');
      assert.equal(harness.todos.cycleTodoTagFilter(filters, '', -1), 'personal');
    } finally {
      await harness.close();
    }
  });

  await t.test('etiket önerisini yalnızca taslağın öndeki etiket alanında açar', async () => {
    const harness = await createStorageHarness();
    try {
      assert.deepEqual(
        harness.todos.todoTagTriggerAt('#pa', 3),
        { start: 0, end: 3, query: 'pa' },
      );
      assert.deepEqual(
        harness.todos.todoTagTriggerAt('#iş #ac', 7),
        { start: 4, end: 7, query: 'ac' },
      );
      assert.equal(harness.todos.todoTagTriggerAt('Görev #iş', 9), null);
    } finally {
      await harness.close();
    }
  });

  await t.test('etiketleri kalıcı kayıtta normalize eder ve todo ile birlikte saklar', async () => {
    const harness = await createStorageHarness({
      local: {
        todoTags: [
          { id: 'work', name: 'İş', color: '#123456', createdAt: 1 },
          { id: 'duplicate', name: 'iş', color: 'red', createdAt: 2 },
          { id: '', name: 'Geçersiz', color: '#abcdef', createdAt: 3 },
        ],
      },
    });
    try {
      const tags = await harness.storage.loadTodoTags();
      assert.equal(tags.length, 1);
      assert.equal(tags[0].id, 'work');
      assert.equal(tags[0].color, '#123456');

      await harness.storage.saveActiveTodos([
        {
          id: 'task',
          title: 'Raporu hazırla',
          tagIds: ['work', 'work'],
          completed: false,
          createdAt: 4,
        },
      ], tags);
      assert.deepEqual(harness.state.local.activeTodos[0].tagIds, ['work']);
      assert.deepEqual(harness.state.local.todoTags.map((tag) => tag.id), ['work']);
    } finally {
      await harness.close();
    }
  });

  await t.test('metin alanını yerelde saklar ve 3.000 kelimeyle sınırlar', async () => {
    const harness = await createStorageHarness();
    try {
      const longText = `${Array.from({ length: 3_010 }, (_, index) => `kelime-${index}`).join(' ')}\r\nson`;
      await harness.storage.saveScratchpadText(longText);

      const stored = await harness.storage.loadScratchpadText();
      assert.equal(harness.scratchpad.countScratchpadWords(stored), 3_000);
      assert.equal(stored.includes('\r'), false);
      assert.equal(harness.state.local.scratchpadText, stored);
      assert.equal(harness.storage.storageKeys.scratchpad, 'scratchpadText');

      await harness.storage.clearScratchpadText();
      assert.equal(await harness.storage.loadScratchpadText(), '');
      assert.equal('scratchpadText' in harness.state.local, false);
    } finally {
      await harness.close();
    }
  });

  await t.test('not defterinin yalnızca küçük arayüz durumunu tarayıcıda saklar', async () => {
    const harness = await createStorageHarness({
      local: {
        notesUiState: {
          hasNotes: true,
          lastNote: { category: 'Promptlar', fileName: 'Kod.txt' },
          lastCategory: 'Promptlar',
          migrationVersion: 1,
          folderColors: {
            Promptlar: 'purple',
            Arşiv: 'invalid',
            constructor: 'red',
          },
          unexpected: 'ignored',
        },
      },
    });
    try {
      assert.deepEqual(await harness.notePreferences.loadNotesUiState(), {
        hasNotes: true,
        lastNote: { category: 'Promptlar', fileName: 'Kod.txt' },
        lastCategory: 'Promptlar',
        migrationVersion: 1,
        folderColors: { Promptlar: 'purple' },
      });
      await harness.notePreferences.updateNotesUiState({ hasNotes: false, lastCategory: null });
      assert.equal(harness.state.local.notesUiState.hasNotes, false);
      assert.equal(harness.state.local.notesUiState.lastCategory, null);
      assert.deepEqual(
        harness.state.local.notesUiState.lastNote,
        { category: 'Promptlar', fileName: 'Kod.txt' },
      );
    } finally {
      await harness.close();
    }
  });

  await t.test('aktif görev açılışı tamamlanan görevleri okumaz', async () => {
    const harness = await createStorageHarness({
      local: {
        activeTodos: [{ id: 'active', title: 'Açık görev', completed: false, createdAt: 1 }],
        completedTodos: [{ id: 'done', title: 'Biten görev', completed: true, createdAt: 2 }],
      },
    });
    try {
      await harness.storage.loadActiveTodos();
      assert.equal(
        harness.state.storageGets.local.flat().includes('completedTodos'),
        false,
      );
      await harness.storage.loadCompletedTodos();
      assert.equal(
        harness.state.storageGets.local.flat().includes('completedTodos'),
        true,
      );
    } finally {
      await harness.close();
    }
  });

  await t.test('yeni tamamlanan görevi eski tamamlananları silmeden ekler', async () => {
    const harness = await createStorageHarness({
      local: {
        activeTodos: [{ id: 'next', title: 'Yeni görev', completed: false, createdAt: 4 }],
        completedTodos: [{ id: 'done', title: 'Eski görev', completed: true, createdAt: 1, completedAt: 2 }],
      },
    });
    try {
      await harness.storage.moveTodosToCompleted([], [
        { id: 'next', title: 'Yeni görev', completed: true, createdAt: 4, completedAt: 5 },
      ]);
      assert.deepEqual(
        harness.state.local.completedTodos.map((todo) => todo.id).sort(),
        ['done', 'next'],
      );
      assert.deepEqual(harness.state.local.activeTodos, []);
    } finally {
      await harness.close();
    }
  });

  await t.test('yalnızca istenen istatistik aralığını döndürür', async () => {
    const harness = await createStorageHarness();
    try {
      const values = [
        { date: '2026-08-02', focusSeconds: 60, completedSessions: 1 },
        { date: '2026-08-03', focusSeconds: 120, completedSessions: 1 },
        { date: '2026-08-09', focusSeconds: 180, completedSessions: 2 },
        { date: '2026-08-10', focusSeconds: 240, completedSessions: 2 },
      ];
      assert.deepEqual(
        harness.storage.statsInRange(values, { start: '2026-08-03', end: '2026-08-09' })
          .map((item) => item.date),
        ['2026-08-03', '2026-08-09'],
      );
    } finally {
      await harness.close();
    }
  });
});
