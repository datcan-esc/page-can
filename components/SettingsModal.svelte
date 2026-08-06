<script lang="ts">
  import { DEFAULT_SETTINGS } from '../lib/defaults';
  import { applyTheme } from '../lib/theme';
  import type { AppSettings, ThemeMode, ThemePreferences } from '../lib/types';
  import type { WallpaperAnalysis } from '../lib/wallpaper';
  import BaseDialog from './BaseDialog.svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  export let settings: AppSettings;
  export let hasWallpaper: boolean;
  export let onClose: () => void;
  export let onSave: (settings: AppSettings) => Promise<void>;
  export let onWallpaper: (file: File) => Promise<WallpaperAnalysis>;
  export let onAnalyzeWallpaper: () => Promise<WallpaperAnalysis | null>;
  export let onRemoveWallpaper: () => Promise<void>;

  let draft: ThemePreferences = structuredClone(settings.theme);
  let processingWallpaper = false;
  let saving = false;
  let wallpaperError = '';
  let wallpaperInput: HTMLInputElement;

  $: applyTheme(draft);

  function setMode(mode: ThemeMode) {
    let cardColor = draft.cardColor;
    let pageBackgroundColor = draft.pageBackgroundColor;
    if (mode === 'light') {
      if (['#17171a', '#16171c', '#141519', '#171719'].includes(cardColor.toLowerCase())) cardColor = '#ffffff';
      if (['#0d0e11', '#0a0a0b'].includes(pageBackgroundColor.toLowerCase())) pageBackgroundColor = '#f2f2f7';
    }
    if (mode === 'dark') {
      if (cardColor.toLowerCase() === '#ffffff') cardColor = '#171719';
      if (['#f2f2f7', '#f3f3f1'].includes(pageBackgroundColor.toLowerCase())) pageBackgroundColor = '#0a0a0b';
    }
    draft = { ...draft, mode, cardColor, pageBackgroundColor };
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
      const analysis = await onWallpaper(file);
      hasWallpaper = true;
      if (draft.autoAccent) {
        draft = { ...draft, primaryColor: analysis.accentColor };
      }
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
    if (draft.autoAccent) {
      draft = { ...draft, primaryColor: DEFAULT_SETTINGS.theme.primaryColor };
    }
  }

  async function toggleAutoAccent(event: Event) {
    const enabled = (event.currentTarget as HTMLInputElement).checked;
    draft = { ...draft, autoAccent: enabled };
    if (!enabled || !hasWallpaper) return;

    wallpaperError = '';
    processingWallpaper = true;
    try {
      const analysis = await onAnalyzeWallpaper();
      if (analysis) draft = { ...draft, primaryColor: analysis.accentColor };
    } catch {
      wallpaperError = 'Fotoğraftan vurgu rengi üretilemedi.';
    } finally {
      processingWallpaper = false;
    }
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
        <Button variant="unstyled" size="sm" class={draft.mode === 'light' ? 'active' : ''} onclick={() => setMode('light')}>Açık</Button>
        <Button variant="unstyled" size="sm" class={draft.mode === 'dark' ? 'active' : ''} onclick={() => setMode('dark')}>Koyu</Button>
        <Button variant="unstyled" size="sm" class={draft.mode === 'system' ? 'active' : ''} onclick={() => setMode('system')}>Sistem</Button>
      </div>

      <div class="color-grid">
        <label class="color-field"><span>Vurgu</span><span class="color-input-wrap"><input type="color" bind:value={draft.primaryColor} onchange={() => (draft.autoAccent = false)} /><code>{draft.primaryColor}</code></span></label>
        <label class="color-field"><span>Arka plan</span><span class="color-input-wrap"><input type="color" bind:value={draft.pageBackgroundColor} /><code>{draft.pageBackgroundColor}</code></span></label>
        <label class="color-field"><span>Kart rengi</span><span class="color-input-wrap"><input type="color" bind:value={draft.cardColor} /><code>{draft.cardColor}</code></span></label>
      </div>

      <label class="toggle-row accent-toggle">
        <span><b>Fotoğraftan vurgu rengi</b><small>Duvar kâğıdındaki baskın tonu güvenli bir vurgu rengine dönüştürür.</small></span>
        <input type="checkbox" checked={draft.autoAccent} onchange={toggleAutoAccent} />
      </label>

      <label class="toggle-row favorite-names-toggle">
        <span><b>Favori isimlerini göster</b><small>Site adlarını favori ikonlarının altında gösterir.</small></span>
        <input type="checkbox" bind:checked={draft.showFavoriteNames} />
      </label>

      <label class="range-field"><span><b>Kart opaklığı</b><output>{Math.round(draft.cardOpacity * 100)}%</output></span><input type="range" min="0.45" max="1" step="0.01" bind:value={draft.cardOpacity} /></label>
      <label class="range-field"><span><b>Kart bulanıklığı</b><output>{draft.cardBlur}px</output></span><input type="range" min="0" max="24" step="1" bind:value={draft.cardBlur} /></label>
    </section>

    <section class="settings-section">
      <div class="setting-heading"><h3>Arka plan</h3></div>
      <div class="wallpaper-actions">
        <Button variant="secondary" onclick={() => wallpaperInput?.click()} disabled={processingWallpaper}>
          <Icon name="image" size={16} />
          {processingWallpaper ? 'İşleniyor…' : hasWallpaper ? 'Değiştir' : 'Fotoğraf seç'}
        </Button>
        <input
          bind:this={wallpaperInput}
          class="visually-hidden"
          type="file"
          tabindex="-1"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onchange={handleWallpaper}
          disabled={processingWallpaper}
        />
        {#if hasWallpaper}<Button variant="secondary" onclick={removeCurrentWallpaper}>Kaldır</Button>{/if}
      </div>
      {#if wallpaperError}<p class="form-error">{wallpaperError}</p>{/if}

      <label class="range-field"><span><b>Karartma</b><output>{Math.round(draft.wallpaperDim * 100)}%</output></span><input type="range" min="0" max="0.75" step="0.01" bind:value={draft.wallpaperDim} /></label>
      <label class="range-field"><span><b>Bulanıklık</b><output>{draft.wallpaperBlur}px</output></span><input type="range" min="0" max="20" step="1" bind:value={draft.wallpaperBlur} /></label>
      <label class="field-group"><span>Konum</span><select bind:value={draft.wallpaperPosition}><option value="50% 50%">Orta</option><option value="50% 0%">Üst</option><option value="50% 100%">Alt</option><option value="0% 50%">Sol</option><option value="100% 50%">Sağ</option></select></label>
    </section>
  </div>

  <svelte:fragment slot="footer">
    <Button variant="text" onclick={resetDefaults}>Varsayılanlar</Button>
    <span class="footer-spacer"></span>
    <Button variant="secondary" onclick={cancel}>Vazgeç</Button>
    <Button variant="primary" onclick={persist} disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Button>
  </svelte:fragment>
</BaseDialog>
