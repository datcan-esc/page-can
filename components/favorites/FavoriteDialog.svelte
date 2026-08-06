<script lang="ts">
  import type { Favorite } from '../../lib/types';
  import { createId, normalizeUrl } from '../../lib/utils';
  import Dialog from '../ui/Dialog.svelte';
  import Input from '../ui/Input.svelte';
  import ShortcutField from '../ui/ShortcutField.svelte';
  import '../ui/form.css';

  export let favorite: Favorite | null = null;
  export let favorites: Favorite[] = [];
  export let reservedShortcut = '';
  export let onClose: () => void;
  export let onSave: (favorite: Favorite) => Promise<void>;

  let name = favorite?.name ?? '';
  let url = favorite?.url ?? '';
  let shortcut = favorite?.shortcut ?? '';
  let error = '';
  let saving = false;

  async function submit() {
    error = '';
    if (!name.trim() || !url.trim()) {
      error = 'İsim ve adres alanlarını doldurun.';
      return;
    }

    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeUrl(url);
    } catch {
      error = 'Geçerli bir site adresi girin.';
      return;
    }

    const conflict = shortcut && favorites.some((item) =>
      item.id !== favorite?.id && item.shortcut === shortcut);
    if (conflict || (shortcut && shortcut === reservedShortcut)) {
      error = 'Bu klavye kısayolu zaten kullanılıyor.';
      return;
    }

    saving = true;
    await onSave({
      id: favorite?.id ?? createId('favorite'),
      name: name.trim(),
      url: normalizedUrl,
      shortcut,
      createdAt: favorite?.createdAt ?? Date.now(),
    });
    saving = false;
    onClose();
  }
</script>

<Dialog
  title={favorite ? 'Favoriyi düzenle' : 'Favori ekle'}
  subtitle="Site bilgileri ve klavye kısayolu"
  {onClose}
  formId="favorite-form"
  confirmLabel={favorite ? 'Kaydet' : 'Ekle'}
  {saving}
>
  <form id="favorite-form" class="dialog-form" onsubmit={(event) => { event.preventDefault(); void submit(); }}>
    <Input data-autofocus bind:value={name} label="İsim" maxLength={32} placeholder="Örn. GitHub" />
    <Input bind:value={url} type="url" inputmode="url" icon="globe" label="Site adresi" placeholder="github.com" />
    <ShortcutField
      value={shortcut}
      onChange={(value) => (shortcut = value)}
      description="Yeni sekmede bir yazı alanı odakta değilken bu tuşla siteyi açar."
    />
    {#if error}<p class="form-error">{error}</p>{/if}
  </form>

</Dialog>
