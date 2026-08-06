<script lang="ts">
  import type { Favorite } from '../lib/types';
  import { createId, normalizeUrl } from '../lib/utils';
  import BaseDialog from './BaseDialog.svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import ShortcutInput from './ShortcutInput.svelte';

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

<BaseDialog title={favorite ? 'Favoriyi düzenle' : 'Favori ekle'} {onClose}>
  <form id="favorite-form" class="dialog-form" onsubmit={(event) => { event.preventDefault(); void submit(); }}>
    <label class="field-group">
      <span>İsim</span>
      <input data-autofocus bind:value={name} maxlength="32" placeholder="Örn. GitHub" />
    </label>
    <label class="field-group">
      <span>Site adresi</span>
      <input bind:value={url} inputmode="url" placeholder="github.com" />
    </label>
    <ShortcutInput value={shortcut} onChange={(value) => (shortcut = value)} label="Klavye kısayolu" />
    {#if error}<p class="form-error">{error}</p>{/if}
  </form>

  <svelte:fragment slot="footer">
    <Button variant="secondary" onclick={onClose}>Vazgeç</Button>
    <span class="footer-spacer"></span>
    <Button variant="primary" type="submit" form="favorite-form" disabled={saving}>
      <Icon name={favorite ? 'check' : 'plus'} size={16} />
      {saving ? 'Kaydediliyor…' : favorite ? 'Kaydet' : 'Ekle'}
    </Button>
  </svelte:fragment>
</BaseDialog>
