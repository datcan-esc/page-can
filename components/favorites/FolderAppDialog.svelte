<script lang="ts">
  import type { FolderApp } from '../../lib/types';
  import { createId, normalizeUrl } from '../../lib/utils';
  import Dialog from '../ui/Dialog.svelte';
  import Input from '../ui/Input.svelte';
  import '../ui/form.css';

  export let app: FolderApp | null = null;
  export let folderName: string;
  export let onClose: () => void;
  export let onSave: (app: FolderApp) => Promise<void>;

  let name = app?.name ?? '';
  let url = app?.url ?? '';
  let error = '';
  let saving = false;

  async function submit() {
    error = '';
    if (!name.trim() || !url.trim()) {
      error = 'İsim ve site adresini girin.';
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
        id: app?.id ?? createId('folder-app'),
        name: name.trim(),
        url: normalizedUrl,
        createdAt: app?.createdAt ?? Date.now(),
      });
      onClose();
    } catch (saveError) {
      error = saveError instanceof Error ? saveError.message : 'Uygulama kaydedilemedi.';
    } finally {
      saving = false;
    }
  }
</script>

<Dialog
  title={app ? 'Uygulamayı düzenle' : 'Uygulama ekle'}
  subtitle={folderName}
  {onClose}
  formId="folder-app-form"
  confirmLabel={app ? 'Kaydet' : 'Ekle'}
  {saving}
>
  <form id="folder-app-form" class="dialog-form" onsubmit={(event) => { event.preventDefault(); void submit(); }}>
    <Input data-autofocus bind:value={name} label="İsim" maxLength={32} placeholder="Örn. YouTube" />
    <Input bind:value={url} type="text" inputmode="url" icon="globe" label="Site adresi" placeholder="youtube.com" />
    {#if error}<p class="form-error">{error}</p>{/if}
  </form>
</Dialog>
