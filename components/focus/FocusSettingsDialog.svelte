<script lang="ts">
  import type { PomodoroPreferences } from '../../lib/types';
  import Dialog from '../ui/Dialog.svelte';
  import Input from '../ui/Input.svelte';
  import ShortcutField from '../ui/ShortcutField.svelte';
  import '../ui/form.css';
  import './focus.css';

  export let preferences: PomodoroPreferences;
  export let favoriteShortcuts: string[] = [];
  export let reservedShortcuts: string[] = [];
  export let onClose: () => void;
  export let onSave: (preferences: PomodoroPreferences) => Promise<void>;

  let draft = structuredClone(preferences);
  let error = '';
  let saving = false;

  async function submit() {
    error = '';
    const focusMinutes = Number(draft.focusMinutes);
    if (!Number.isFinite(focusMinutes) || focusMinutes < 1 || focusMinutes > 240) {
      error = 'Odak süresi 1 ile 240 dakika arasında olmalı.';
      return;
    }
    const idleMinutes = Number(draft.idleMinutes);
    if (!Number.isFinite(idleMinutes) || idleMinutes < 0 || idleMinutes > 60) {
      error = 'Hareketsizlik süresi 0 ile 60 dakika arasında olmalı.';
      return;
    }
    const checkInMinutes = Number(draft.checkInMinutes);
    if (
      !Number.isFinite(checkInMinutes)
      || checkInMinutes < 0
      || checkInMinutes > 240
      || (checkInMinutes > 0 && checkInMinutes < 15)
    ) {
      error = 'Sayaç kontrolü 0 veya 15 ile 240 dakika arasında olmalı.';
      return;
    }
    if (draft.shortcut && [...favoriteShortcuts, ...reservedShortcuts].includes(draft.shortcut)) {
      error = 'Bu klavye kısayolu zaten kullanılıyor.';
      return;
    }

    saving = true;
    try {
      await onSave({
        ...draft,
        focusMinutes: Math.round(focusMinutes),
        idleMinutes: Math.round(idleMinutes),
        checkInMinutes: Math.round(checkInMinutes),
      });
      onClose();
    } catch (saveError) {
      error = saveError instanceof Error ? saveError.message : 'Odak ayarları kaydedilemedi.';
    } finally {
      saving = false;
    }
  }
</script>

<Dialog
  title="Odak ayarları"
  subtitle="Süre, güvenlik ve klavye kısayolu"
  {onClose}
  onCancel={onClose}
  formId="focus-settings-form"
  confirmLabel="Kaydet"
  {saving}
>
  <form id="focus-settings-form" class="dialog-form" onsubmit={(event) => { event.preventDefault(); void submit(); }}>
    <Input
      bind:value={draft.focusMinutes}
      type="number"
      min={1}
      max={240}
      required
      suffix="dakika"
      label="Geri sayım süresi"
    />

    <Input
      bind:value={draft.idleMinutes}
      type="number"
      min={0}
      max={60}
      required
      suffix="dakika"
      label="Hareketsizlikte duraklat"
      description="Bu süre boyunca etkinlik olmazsa duraklatır. 0 hareketsizlik kontrolünü kapatır; ekran kilidi her zaman duraklatır."
    />

    <Input
      bind:value={draft.checkInMinutes}
      type="number"
      min={0}
      max={240}
      required
      suffix="dakika"
      label="Sayaç kontrolü"
      description="Sayaç açık kalırsa hâlâ odakta olup olmadığınızı sorar. En az 15 dakika; 0 kapatır."
    />

    <ShortcutField
      value={draft.shortcut}
      onChange={(value) => (draft.shortcut = value)}
      label="Başlat / duraklat"
      description="Tek harf, Space veya tuş kombinasyonuyla sayacı başlatır ve duraklatır."
    />
    {#if error}<p class="form-error">{error}</p>{/if}
  </form>

</Dialog>
