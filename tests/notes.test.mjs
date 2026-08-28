import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

const encoder = new TextEncoder();
let modifiedClock = 1_000;

function bytesFrom(value) {
  if (typeof value === 'string') return encoder.encode(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  throw new TypeError('Unsupported fake write value.');
}

class FakeFileHandle {
  kind = 'file';

  constructor(name, value = '', failWrite = false) {
    this.name = name;
    this.bytes = bytesFrom(value);
    this.lastModified = modifiedClock++;
    this.failWrite = failWrite;
  }

  async getFile() {
    const snapshot = this.bytes.slice();
    return {
      size: snapshot.byteLength,
      lastModified: this.lastModified,
      async arrayBuffer() {
        return snapshot.buffer.slice(snapshot.byteOffset, snapshot.byteOffset + snapshot.byteLength);
      },
    };
  }

  async createWritable() {
    let next = this.bytes.slice();
    let aborted = false;
    return {
      write: async (value) => {
        if (this.failWrite) throw new DOMException('Fake write failure', 'NoModificationAllowedError');
        next = bytesFrom(value);
      },
      close: async () => {
        if (aborted) return;
        this.bytes = next;
        this.lastModified = modifiedClock++;
      },
      abort: async () => { aborted = true; },
    };
  }

  async isSameEntry(other) {
    return other === this;
  }

  externalWrite(value) {
    this.bytes = bytesFrom(value);
    this.lastModified = modifiedClock++;
  }

  text() {
    return new TextDecoder().decode(this.bytes);
  }
}

class FakeDirectoryHandle {
  kind = 'directory';

  constructor(name) {
    this.name = name;
    this.children = new Map();
    this.failedWrites = new Set();
  }

  addFile(name, value = '') {
    const handle = new FakeFileHandle(name, value, this.failedWrites.has(name));
    this.children.set(name, handle);
    return handle;
  }

  addDirectory(name) {
    const handle = new FakeDirectoryHandle(name);
    this.children.set(name, handle);
    return handle;
  }

  failWrite(name) {
    this.failedWrites.add(name);
  }

  async getFileHandle(name, options = {}) {
    const existing = this.children.get(name);
    if (existing?.kind === 'file') return existing;
    if (existing) throw new DOMException('Type mismatch', 'TypeMismatchError');
    if (!options.create) throw new DOMException('Missing file', 'NotFoundError');
    return this.addFile(name);
  }

  async getDirectoryHandle(name, options = {}) {
    const existing = this.children.get(name);
    if (existing?.kind === 'directory') return existing;
    if (existing) throw new DOMException('Type mismatch', 'TypeMismatchError');
    if (!options.create) throw new DOMException('Missing directory', 'NotFoundError');
    return this.addDirectory(name);
  }

  async removeEntry(name, options = {}) {
    const existing = this.children.get(name);
    if (!existing) throw new DOMException('Missing entry', 'NotFoundError');
    if (existing.kind === 'directory' && existing.children.size && !options.recursive) {
      throw new DOMException('Directory is not empty', 'InvalidModificationError');
    }
    this.children.delete(name);
  }

  async resolve(handle) {
    for (const [name, child] of this.children) {
      if (child === handle) return [name];
    }
    return null;
  }

  async isSameEntry(other) {
    return other === this;
  }

  async *entries() {
    yield* this.children.entries();
  }
}

test('yerel not klasörü yardımcıları ve repository', async (t) => {
  const server = await createServer({
    configFile: false,
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  const notes = await server.ssrLoadModule('/lib/notes.ts');
  const directory = await server.ssrLoadModule('/lib/note-directory.ts');

  try {
    await t.test('dosya ve kategori adlarını platformlar arasında güvenli tutar', () => {
      assert.equal(notes.sanitizeNoteTitle('  Rapor: Ağustos?.txt  '), 'Rapor Ağustos');
      assert.equal(notes.sanitizeNoteTitle('CON'), 'CON notu');
      assert.equal(notes.sanitizeNoteTitle('.gizli'), 'gizli');
      assert.equal(notes.sanitizeCategoryName('.page-can-trash'), 'Yeni kategori');
      assert.equal(notes.uniqueNoteFileName('Not', ['Not.txt']), 'Not (2).txt');
      assert.equal(notes.uniqueCategoryName('Proje', ['proje']), 'Proje (2)');
      assert.equal(notes.isTextNoteFileName('.gizli.txt'), false);
      assert.equal(notes.isTextNoteFileName('Prompt.TXT'), true);
      assert.equal(notes.normalizeNoteText('bir\r\niki\rüç'), 'bir\niki\nüç');
    });

    await t.test('klasör seçiciyi doğrudan yazma izni ve Belgeler başlangıcıyla açar', async () => {
      const root = new FakeDirectoryHandle('Notlar');
      let receivedOptions;
      const target = {
        async showDirectoryPicker(options) {
          receivedOptions = options;
          return root;
        },
      };
      assert.equal(directory.supportsNotesDirectoryAccess(target), true);
      assert.equal(await directory.pickNotesDirectory(target), root);
      assert.deepEqual(receivedOptions, {
        id: 'page-can-notes',
        mode: 'readwrite',
        startIn: 'documents',
      });

      const cancelledTarget = {
        async showDirectoryPicker() {
          throw new DOMException('Cancelled', 'AbortError');
        },
      };
      assert.equal(await directory.pickNotesDirectory(cancelledTarget), null);
    });

    await t.test('yalnızca görünür kategorileri ve txt notlarını listeler', async () => {
      const root = new FakeDirectoryHandle('Notlar');
      root.addFile('Kategorisiz.txt', 'ana not');
      root.addFile('görsel.png', 'png');
      root.addDirectory('.gizli').addFile('saklı.txt', 'saklı');
      root.addDirectory('Promptlar').addFile('Kod.txt', 'prompt');
      const repository = new directory.DirectoryNotesRepository(root);

      const snapshot = await repository.snapshot();
      assert.deepEqual(snapshot.categories, [{ name: 'Promptlar' }]);
      assert.deepEqual(snapshot.uncategorizedNotes.map((note) => note.title), ['Kategorisiz']);
      assert.equal(snapshot.hasNotes, true);
      assert.deepEqual((await repository.listNotes('Promptlar')).map((note) => note.title), ['Kod']);
    });

    await t.test('not oluşturur, otomatik kaydeder ve dış değişikliği ezmez', async () => {
      const root = new FakeDirectoryHandle('Notlar');
      const repository = new directory.DirectoryNotesRepository(root);
      const created = await repository.createNote(null, 'Deneme', 'ilk');
      assert.equal(created.ref.fileName, 'Deneme.txt');
      assert.equal(root.children.get('Deneme.txt').text(), 'ilk');

      const saved = await repository.saveNote(created.ref, 'ikinci', created.version);
      assert.equal(saved.text, 'ikinci');
      root.children.get('Deneme.txt').externalWrite('dışarıdan');

      await assert.rejects(
        repository.saveNote(saved.ref, 'extension değişikliği', saved.version),
        (error) => error instanceof directory.NotesConflictError,
      );
      assert.equal(root.children.get('Deneme.txt').text(), 'dışarıdan');
    });

    await t.test('notları doğrulayarak taşır ve silinenleri çöp klasöründe korur', async () => {
      const root = new FakeDirectoryHandle('Notlar');
      root.addDirectory('Promptlar');
      const repository = new directory.DirectoryNotesRepository(root);
      const created = await repository.createNote(null, 'Taşınacak', 'önemli içerik');
      const moved = await repository.moveNote(created.ref, 'Promptlar');

      assert.equal(root.children.has('Taşınacak.txt'), false);
      assert.equal(root.children.get('Promptlar').children.get('Taşınacak.txt').text(), 'önemli içerik');
      await repository.trashNote(moved.ref);

      assert.equal(root.children.get('Promptlar').children.has('Taşınacak.txt'), false);
      assert.equal(
        root.children
          .get('.page-can-trash')
          .children.get('Promptlar')
          .children.get('Taşınacak.txt')
          .text(),
        'önemli içerik',
      );
    });

    await t.test('hedef yazılamazsa kaynak notu yerinde bırakır', async () => {
      const root = new FakeDirectoryHandle('Notlar');
      const target = root.addDirectory('Hedef');
      target.failWrite('Kritik.txt');
      root.addFile('Kritik.txt', 'kaybolmamalı');
      const repository = new directory.DirectoryNotesRepository(root);

      await assert.rejects(
        repository.moveNote({ category: null, fileName: 'Kritik.txt' }, 'Hedef'),
        (error) => error instanceof DOMException && error.name === 'NoModificationAllowedError',
      );
      assert.equal(root.children.get('Kritik.txt').text(), 'kaybolmamalı');
      assert.equal(target.children.has('Kritik.txt'), false);
    });

    await t.test('taşıma sırasında dışarıdan değişen kaynak notu silmez', async () => {
      const root = new FakeDirectoryHandle('Notlar');
      const target = root.addDirectory('Hedef');
      const source = root.addFile('Canlı.txt', 'ilk sürüm');
      const originalGetFileHandle = target.getFileHandle.bind(target);
      target.getFileHandle = async (name, options) => {
        const handle = await originalGetFileHandle(name, options);
        const originalCreateWritable = handle.createWritable.bind(handle);
        handle.createWritable = async () => {
          const writable = await originalCreateWritable();
          const originalClose = writable.close.bind(writable);
          writable.close = async () => {
            await originalClose();
            source.externalWrite('dışarıdaki yeni sürüm');
          };
          return writable;
        };
        return handle;
      };
      const repository = new directory.DirectoryNotesRepository(root);

      await assert.rejects(
        repository.moveNote({ category: null, fileName: 'Canlı.txt' }, 'Hedef'),
        (error) => error instanceof directory.NotesConflictError,
      );
      assert.equal(root.children.get('Canlı.txt').text(), 'dışarıdaki yeni sürüm');
      assert.equal(target.children.has('Canlı.txt'), false);
    });

    await t.test('bilinmeyen içerikli kategoriyi extension içinden yeniden adlandırmaz', async () => {
      const root = new FakeDirectoryHandle('Notlar');
      const mixed = root.addDirectory('Karışık');
      mixed.addFile('Not.txt', 'metin');
      mixed.addFile('fotoğraf.jpg', 'görsel');
      const repository = new directory.DirectoryNotesRepository(root);

      await assert.rejects(
        repository.renameCategory('Karışık', 'Arşiv'),
        (error) => error?.code === 'category-has-unknown-entries',
      );
      assert.equal(root.children.has('Karışık'), true);
      assert.equal(root.children.has('Arşiv'), false);
    });

    await t.test('yalnızca boş kategorilerin kaldırılmasına izin verir', async () => {
      const root = new FakeDirectoryHandle('Notlar');
      root.addDirectory('Boş');
      root.addDirectory('Dolu').addFile('Not.txt', 'metin');
      const repository = new directory.DirectoryNotesRepository(root);

      await repository.removeEmptyCategory('Boş');
      assert.equal(root.children.has('Boş'), false);
      await assert.rejects(
        repository.removeEmptyCategory('Dolu'),
        (error) => error?.code === 'category-not-empty',
      );
      assert.equal(root.children.has('Dolu'), true);
    });
  } finally {
    await server.close();
  }
});
