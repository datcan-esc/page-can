<script lang="ts">
  import type { Favorite } from '../../lib/types';
  import { createId, normalizeUrl } from '../../lib/utils';
  import ChoicePicker, { type ChoiceOption } from '../ui/ChoicePicker.svelte';
  import Dialog from '../ui/Dialog.svelte';
  import Input from '../ui/Input.svelte';
  import ShortcutField from '../ui/ShortcutField.svelte';
  import '../ui/form.css';

  export let favorite: Favorite | null = null;
  export let favorites: Favorite[] = [];
  export let reservedShortcuts: string[] = [];
  export let onClose: () => void;
  export let onSave: (favorite: Favorite) => Promise<void>;

  let kind: Favorite['kind'] = favorite?.kind ?? 'site';
  let name = favorite?.name ?? '';
  let url = favorite?.kind === 'site' ? favorite.url : '';
  let shortcut = favorite?.shortcut ?? '';
  let error = '';
  let saving = false;
  const kindOptions: ChoiceOption[] = [
    {
      value: 'site',
      label: 'Site',
      icon: 'globe',
    },
    {
      value: 'folder',
      label: 'Uygulama klasörü',
      icon: 'grid',
    },
  ];

  async function submit() {
    error = '';
    if (!name.trim()) {
      error = kind === 'folder' ? 'Klasör adını girin.' : 'İsim alanını doldurun.';
      return;
    }

    const conflict = shortcut && favorites.some((item) =>
      item.id !== favorite?.id && item.shortcut === shortcut);
    if (conflict || (shortcut && reservedShortcuts.includes(shortcut))) {
      error = 'Bu klavye kısayolu zaten kullanılıyor.';
      return;
    }

    if (kind === 'folder') {
      saving = true;
      try {
        await onSave({
          kind: 'folder',
          id: favorite?.id ?? createId('favorite-folder'),
          name: name.trim(),
          shortcut,
          apps: favorite?.kind === 'folder' ? favorite.apps : [],
          createdAt: favorite?.createdAt ?? Date.now(),
        });
        onClose();
      } catch (saveError) {
        error = saveError instanceof Error ? saveError.message : 'Uygulama klasörü kaydedilemedi.';
      } finally {
        saving = false;
      }
      return;
    }

    if (!url.trim()) {
      error = 'Site adresini girin.';
      return;
    }

    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeUrl(url);
    } catch {
      error = 'Geçerli bir site adresi girin.';
      return;
    }

    saving = true;
    try {
      await onSave({
        kind: 'site',
        id: favorite?.id ?? createId('favorite'),
        name: name.trim(),
        url: normalizedUrl,
        shortcut,
        createdAt: favorite?.createdAt ?? Date.now(),
      });
      onClose();
    } catch (saveError) {
      error = saveError instanceof Error ? saveError.message : 'Favori kaydedilemedi.';
    } finally {
      saving = false;
    }
  }
</script>

<Dialog
  title={favorite?.kind === 'folder' ? 'Uygulama klasörünü düzenle' : favorite ? 'Favoriyi düzenle' : 'Favori ekle'}
  subtitle={favorite?.kind === 'folder' ? 'Klasör bilgileri ve klavye kısayolu' : favorite ? 'Site bilgileri ve klavye kısayolu' : 'Site veya uygulama klasörü'}
  {onClose}
  formId="favorite-form"
  confirmLabel={favorite ? 'Kaydet' : 'Ekle'}
  {saving}
>
  <form id="favorite-form" class="dialog-form" onsubmit={(event) => { event.preventDefault(); void submit(); }}>
    {#if !favorite}
      <ChoicePicker
        value={kind}
        options={kindOptions}
        label="Ne eklemek istiyorsunuz?"
        onChange={(value) => { kind = value as Favorite['kind']; error = ''; }}
      />
    {/if}

    <Input
      data-autofocus
      bind:value={name}
      label={kind === 'folder' ? 'Klasör adı' : 'İsim'}
      maxLength={32}
      placeholder={kind === 'folder' ? 'Örn. Sosyal' : 'Örn. YouTube'}
    />

    {#if kind === 'site'}
      <Input bind:value={url} type="text" inputmode="url" icon="globe" label="Site adresi" placeholder="youtube.com" />
    {:else}
      <p class="favorite-folder-hint">Klasöre en fazla 9 site ekleyebilirsiniz. Klasör açıkken siteler sırasıyla 1–9 tuşlarıyla açılır.</p>
    {/if}
    <ShortcutField
      value={shortcut}
      onChange={(value) => (shortcut = value)}
      description={kind === 'folder'
        ? 'Yeni sekmede bir yazı alanı odakta değilken bu tuşla klasörü açar.'
        : 'Yeni sekmede bir yazı alanı odakta değilken bu tuşla siteyi açar.'}
    />
    {#if error}<p class="form-error">{error}</p>{/if}
  </form>

</Dialog>
