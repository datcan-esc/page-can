<script lang="ts">
  import { DEFAULT_SETTINGS } from '../lib/defaults';
  import { applyTheme } from '../lib/theme';
  import type { AppSettings, ThemeMode, ThemePreferences } from '../lib/types';
  import BaseDialog from './BaseDialog.svelte';
  import Icon from './Icon.svelte';

  export let settings: AppSettings;
  export let hasWallpaper: boolean;
  export let onClose: () => void;
  export let onSave: (settings: AppSettings) => Promise<void>;
  export let onWallpaper: (file: File) => Promise<void>;
  export let onRemoveWallpaper: () => Promise<void>;

  let draft: ThemePreferences = structuredClone(settings.theme);
  let processingWallpaper = false;
  let saving = false;
  let wallpaperError = '';

  $: applyTheme(draft);

  function setMode(mode: ThemeMode) {
    let cardColor = draft.cardColor;
    if (mode === 'light' && ['#17171a', '#16171c'].includes(cardColor.toLowerCase())) cardColor = '#ffffff';
    if (mode === 'dark' && cardColor.toLowerCase() === '#ffffff') cardColor = '#16171c';
    draft = { ...draft, mode, cardColor };
  }

  function resetDefaults() {
    draft = structuredClone(DEFAULT_SETTINGS.theme);
  }

  async function handleWallpaper(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    wallpaperError = '';
    processingWallpaper = true;
    try {
      await onWallpaper(file);
      hasWallpaper = true;
    } catch (error) {
      wallpaperError = error instanceof Error ? error.message : 'Fotoğraf işlenemedi.';
    } finally {
      processingWallpaper = false;
      input.value = '';
    }
  }

  async function removeCurrentWallpaper() {
    await onRemoveWallpaper();
    hasWallpaper = false;
  }

  function cancel() {
    applyTheme(settings.theme);
    onClose();
  }

  async function persist() {
    saving = true;
    await onSave({ ...settings, theme: draft });
    saving = false;
    onClose();
  }
</script>

<BaseDialog title="Görünüm" onClose={cancel} wide>
  <div class="appearance-grid">
    <section class="settings-section">
      <div class="setting-heading"><h3>Renk düzeni</h3></div>
      <div class="segmented-control mode-control">
        <button class:active={draft.mode === 'light'} type="button" onclick={() => setMode('light')}>Açık</button>
        <button class:active={draft.mode === 'dark'} type="button" onclick={() => setMode('dark')}>Koyu</button>
        <button class:active={draft.mode === 'system'} type="button" onclick={() => setMode('system')}>Sistem</button>
      </div>

      <div class="color-grid">
        <label class="color-field"><span>Ana renk</span><span class="color-input-wrap"><input type="color" bind:value={draft.primaryColor} /><code>{draft.primaryColor}</code></span></label>
        <label class="color-field"><span>Destek rengi</span><span class="color-input-wrap"><input type="color" bind:value={draft.secondaryColor} /><code>{draft.secondaryColor}</code></span></label>
        <label class="color-field"><span>Kart rengi</span><span class="color-input-wrap"><input type="color" bind:value={draft.cardColor} /><code>{draft.cardColor}</code></span></label>
      </div>

      <label class="range-field"><span><b>Kart opaklığı</b><output>{Math.round(draft.cardOpacity * 100)}%</output></span><input type="range" min="0.45" max="1" step="0.01" bind:value={draft.cardOpacity} /></label>
      <label class="range-field"><span><b>Kart bulanıklığı</b><output>{draft.cardBlur}px</output></span><input type="range" min="0" max="24" step="1" bind:value={draft.cardBlur} /></label>
    </section>

    <section class="settings-section">
      <div class="setting-heading"><h3>Arka plan</h3></div>
      <div class="wallpaper-actions">
        <label class="secondary-button file-button">
          <Icon name="image" size={16} />
          {processingWallpaper ? 'İşleniyor…' : hasWallpaper ? 'Değiştir' : 'Fotoğraf seç'}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onchange={handleWallpaper} disabled={processingWallpaper} />
        </label>
        {#if hasWallpaper}<button class="text-danger-button" type="button" onclick={removeCurrentWallpaper}>Kaldır</button>{/if}
      </div>
      {#if wallpaperError}<p class="form-error">{wallpaperError}</p>{/if}

      <label class="range-field"><span><b>Karartma</b><output>{Math.round(draft.wallpaperDim * 100)}%</output></span><input type="range" min="0" max="0.75" step="0.01" bind:value={draft.wallpaperDim} /></label>
      <label class="range-field"><span><b>Bulanıklık</b><output>{draft.wallpaperBlur}px</output></span><input type="range" min="0" max="20" step="1" bind:value={draft.wallpaperBlur} /></label>
      <label class="field-group"><span>Konum</span><select bind:value={draft.wallpaperPosition}><option value="50% 50%">Orta</option><option value="50% 0%">Üst</option><option value="50% 100%">Alt</option><option value="0% 50%">Sol</option><option value="100% 50%">Sağ</option></select></label>
    </section>
  </div>

  <svelte:fragment slot="footer">
    <button class="quiet-button" type="button" onclick={resetDefaults}>Varsayılanlar</button>
    <span class="footer-spacer"></span>
    <button class="secondary-button" type="button" onclick={cancel}>Vazgeç</button>
    <button class="primary-button" type="button" onclick={persist} disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
  </svelte:fragment>
</BaseDialog>
