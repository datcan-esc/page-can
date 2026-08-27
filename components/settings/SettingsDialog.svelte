<script lang="ts">
  import { DEFAULT_SETTINGS } from '../../lib/defaults';
  import { applyTheme } from '../../lib/theme';
  import type {
    AppSettings,
    ShortcutPreferences,
    ThemeMode,
    ThemePreferences,
  } from '../../lib/types';
  import type { WallpaperAnalysis } from '../../lib/wallpaper';
  import Button from '../ui/Button.svelte';
  import Dialog from '../ui/Dialog.svelte';
  import Icon from '../ui/Icon.svelte';
  import SegmentedToggle from '../ui/SegmentedToggle.svelte';
  import ShortcutField from '../ui/ShortcutField.svelte';
  import '../ui/form.css';
  import './settings.css';

  type SettingsSection = 'appearance' | 'wallpaper' | 'shortcuts';

  export let settings: AppSettings;
  export let hasWallpaper: boolean;
  export let wallpaperPreviewUrl = '';
  export let favoriteShortcuts: string[] = [];
  export let reservedShortcuts: string[] = [];
  export let onClose: () => void;
  export let onSave: (settings: AppSettings) => Promise<void>;
  export let onWallpaper: (file: File) => Promise<WallpaperAnalysis>;
  export let onAnalyzeWallpaper: () => Promise<WallpaperAnalysis | null>;
  export let onRemoveWallpaper: () => Promise<void>;

  let activeSection: SettingsSection = 'appearance';
  let themeDraft: ThemePreferences = structuredClone(settings.theme);
  let shortcutDraft: ShortcutPreferences = structuredClone(settings.shortcuts);
  let processingWallpaper = false;
  let saving = false;
  let wallpaperError = '';
  let saveError = '';
  let wallpaperInput: HTMLInputElement;

  const sections: Array<{
    id: SettingsSection;
    label: string;
    icon: string;
  }> = [
    { id: 'appearance', label: 'Görünüm', icon: 'sliders' },
    { id: 'wallpaper', label: 'Arka plan', icon: 'image' },
    { id: 'shortcuts', label: 'Kısayollar', icon: 'keyboard' },
  ];
  const themeOptions = [
    { value: 'light', label: 'Açık' },
    { value: 'dark', label: 'Koyu' },
    { value: 'system', label: 'Sistem' },
  ];

  $: applyTheme(themeDraft);

  function selectSection(section: SettingsSection) {
    activeSection = section;
    saveError = '';
  }

  function setMode(mode: ThemeMode) {
    let cardColor = themeDraft.cardColor;
    let pageBackgroundColor = themeDraft.pageBackgroundColor;
    if (mode === 'light') {
      if (['#17171a', '#16171c', '#141519', '#171719'].includes(cardColor.toLowerCase())) cardColor = '#ffffff';
      if (['#0d0e11', '#0a0a0b'].includes(pageBackgroundColor.toLowerCase())) pageBackgroundColor = '#f2f2f7';
    }
    if (mode === 'dark') {
      if (cardColor.toLowerCase() === '#ffffff') cardColor = '#171719';
      if (['#f2f2f7', '#f3f3f1'].includes(pageBackgroundColor.toLowerCase())) pageBackgroundColor = '#0a0a0b';
    }
    themeDraft = { ...themeDraft, mode, cardColor, pageBackgroundColor };
  }

  function resetDefaults() {
    const defaults = DEFAULT_SETTINGS.theme;
    saveError = '';

    if (activeSection === 'shortcuts') {
      shortcutDraft = structuredClone(DEFAULT_SETTINGS.shortcuts);
      return;
    }

    if (activeSection === 'wallpaper') {
      themeDraft = {
        ...themeDraft,
        wallpaperDim: defaults.wallpaperDim,
        wallpaperBlur: defaults.wallpaperBlur,
        wallpaperPosition: defaults.wallpaperPosition,
      };
      return;
    }

    themeDraft = {
      ...themeDraft,
      mode: defaults.mode,
      primaryColor: defaults.primaryColor,
      autoAccent: defaults.autoAccent,
      showFavoriteNames: defaults.showFavoriteNames,
      secondaryColor: defaults.secondaryColor,
      pageBackgroundColor: defaults.pageBackgroundColor,
      cardColor: defaults.cardColor,
      cardOpacity: defaults.cardOpacity,
      cardBlur: defaults.cardBlur,
      borderMode: defaults.borderMode,
      borderColor: defaults.borderColor,
    };
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
      if (themeDraft.autoAccent) {
        themeDraft = { ...themeDraft, primaryColor: analysis.accentColor };
      }
    } catch (error) {
      wallpaperError = error instanceof Error ? error.message : 'Fotoğraf işlenemedi.';
    } finally {
      processingWallpaper = false;
      input.value = '';
    }
  }

  async function removeCurrentWallpaper() {
    wallpaperError = '';
    processingWallpaper = true;
    try {
      await onRemoveWallpaper();
      hasWallpaper = false;
      if (themeDraft.autoAccent) {
        themeDraft = { ...themeDraft, primaryColor: DEFAULT_SETTINGS.theme.primaryColor };
      }
    } catch (error) {
      wallpaperError = error instanceof Error ? error.message : 'Fotoğraf kaldırılamadı.';
    } finally {
      processingWallpaper = false;
    }
  }

  async function toggleAutoAccent(event: Event) {
    const enabled = (event.currentTarget as HTMLInputElement).checked;
    themeDraft = { ...themeDraft, autoAccent: enabled };
    if (!enabled || !hasWallpaper) return;

    wallpaperError = '';
    processingWallpaper = true;
    try {
      const analysis = await onAnalyzeWallpaper();
      if (analysis) themeDraft = { ...themeDraft, primaryColor: analysis.accentColor };
    } catch {
      wallpaperError = 'Fotoğraftan vurgu rengi üretilemedi.';
    } finally {
      processingWallpaper = false;
    }
  }

  function validateShortcuts(): string {
    const reserved = [
      settings.pomodoro.shortcut,
      settings.media.shortcut,
      ...favoriteShortcuts,
      ...reservedShortcuts,
    ].filter(Boolean);

    if (/^[1-9]$/.test(shortcutDraft.revealKey)) {
      return '1–9 tuşları uygulama klasörlerindeki siteler için ayrılmıştır.';
    }
    if (shortcutDraft.revealKey && reserved.includes(shortcutDraft.revealKey)) {
      return 'Kısayolları gösterme tuşu başka bir eylem tarafından kullanılıyor.';
    }
    if (shortcutDraft.todoFocus && reserved.includes(shortcutDraft.todoFocus)) {
      return 'Görev ekleme alanı kısayolu başka bir eylem tarafından kullanılıyor.';
    }
    if (shortcutDraft.revealKey && shortcutDraft.revealKey === shortcutDraft.todoFocus) {
      return 'İki işlem için farklı tuşlar seçin.';
    }
    return '';
  }

  function cancel() {
    applyTheme(settings.theme);
    onClose();
  }

  async function persist() {
    saveError = validateShortcuts();
    if (saveError) {
      activeSection = 'shortcuts';
      return;
    }

    saving = true;
    try {
      await onSave({
        ...settings,
        theme: themeDraft,
        shortcuts: shortcutDraft,
      });
      onClose();
    } catch (error) {
      saveError = error instanceof Error ? error.message : 'Ayarlar kaydedilemedi.';
    } finally {
      saving = false;
    }
  }
</script>

<Dialog
  title="Ayarlar"
  subtitle="Görünüm, arka plan ve kısayollar"
  onClose={cancel}
  onCancel={cancel}
  onConfirm={() => void persist()}
  confirmLabel="Kaydet"
  {saving}
  wide
>
  <div class="settings-layout">
    <nav class="settings-nav" aria-label="Ayar bölümleri">
      {#each sections as section}
        <button
          type="button"
          class="settings-nav__item"
          class:active={activeSection === section.id}
          aria-current={activeSection === section.id ? 'page' : undefined}
          onclick={() => selectSection(section.id)}
        >
          <span class="settings-nav__icon"><Icon name={section.icon} size={17} /></span>
          <span class="settings-nav__label">{section.label}</span>
        </button>
      {/each}

      <div class="settings-brand">
        <img src="/icons/can-icon-dark.png" alt="" width="26" height="26" />
        <span>made by <strong>.can</strong></span>
      </div>
    </nav>

    <div class="settings-panel">
      {#if activeSection === 'appearance'}
        <section class="settings-section" aria-labelledby="appearance-settings-title">
          <div class="setting-heading">
            <h3 id="appearance-settings-title">Görünüm</h3>
            <p>Tema, renkler ve kartların görünümünü düzenleyin.</p>
          </div>
          <SegmentedToggle
            value={themeDraft.mode}
            options={themeOptions}
            label="Renk düzeni"
            onChange={(mode) => setMode(mode as ThemeMode)}
          />

          <div class="color-grid">
            <label class="color-field"><span>Vurgu</span><span class="color-input-wrap"><input type="color" bind:value={themeDraft.primaryColor} onchange={() => (themeDraft.autoAccent = false)} /><code>{themeDraft.primaryColor}</code></span></label>
            <label class="color-field"><span>Arka plan</span><span class="color-input-wrap"><input type="color" bind:value={themeDraft.pageBackgroundColor} /><code>{themeDraft.pageBackgroundColor}</code></span></label>
            <label class="color-field"><span>Kart rengi</span><span class="color-input-wrap"><input type="color" bind:value={themeDraft.cardColor} /><code>{themeDraft.cardColor}</code></span></label>
          </div>

          <label class="toggle-row accent-toggle">
            <span><b>Fotoğraftan vurgu rengi</b><small>Duvar kâğıdındaki baskın tonu güvenli bir vurgu rengine dönüştürür.</small></span>
            <input type="checkbox" checked={themeDraft.autoAccent} onchange={toggleAutoAccent} />
          </label>

          <label class="toggle-row favorite-names-toggle">
            <span><b>İkon isimlerini göster</b><small>Favorilerde ve uygulama klasörlerinde adları ikonların altında gösterir.</small></span>
            <input type="checkbox" bind:checked={themeDraft.showFavoriteNames} />
          </label>

          <label class="range-field"><span><b>Kart opaklığı</b><output>{Math.round(themeDraft.cardOpacity * 100)}%</output></span><input type="range" min="0.45" max="1" step="0.01" bind:value={themeDraft.cardOpacity} /></label>
          <label class="range-field"><span><b>Kart bulanıklığı</b><output>{themeDraft.cardBlur}px</output></span><input type="range" min="0" max="24" step="1" bind:value={themeDraft.cardBlur} /></label>
        </section>
      {:else if activeSection === 'wallpaper'}
        <section class="settings-section" aria-labelledby="wallpaper-settings-title">
          <div class="setting-heading">
            <h3 id="wallpaper-settings-title">Arka plan</h3>
            <p>Duvar kâğıdını ve arkasındaki görsel efektleri yönetin.</p>
          </div>
          <div class="wallpaper-selection">
            <div class="wallpaper-thumbnail">
              {#if hasWallpaper && wallpaperPreviewUrl}
                <img
                  src={wallpaperPreviewUrl}
                  alt=""
                  style:object-position={themeDraft.wallpaperPosition}
                />
              {:else}
                <Icon name="image" size={22} />
              {/if}
            </div>

            <div class="wallpaper-selection__copy">
              <b>{hasWallpaper ? 'Seçili duvar kâğıdı' : 'Duvar kâğıdı seçilmedi'}</b>
              <small>{hasWallpaper ? 'Konum değişiklikleri önizlemeye yansır.' : 'Yeni sekme için bir fotoğraf seçin.'}</small>
            </div>

            <div class="wallpaper-actions">
              <Button variant="outlined" onclick={() => wallpaperInput?.click()} disabled={processingWallpaper}>
                <Icon name="image" size={16} />
                {processingWallpaper ? 'İşleniyor…' : hasWallpaper ? 'Değiştir' : 'Fotoğraf seç'}
              </Button>
              {#if hasWallpaper}<Button variant="ghost" onclick={removeCurrentWallpaper} disabled={processingWallpaper}>Kaldır</Button>{/if}
            </div>

            <input
              bind:this={wallpaperInput}
              class="visually-hidden"
              type="file"
              tabindex="-1"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onchange={handleWallpaper}
              disabled={processingWallpaper}
            />
          </div>
          {#if wallpaperError}<p class="form-error settings-inline-error">{wallpaperError}</p>{/if}

          <div class="wallpaper-controls">
            <label class="range-field"><span><b>Karartma</b><output>{Math.round(themeDraft.wallpaperDim * 100)}%</output></span><input type="range" min="0" max="0.75" step="0.01" bind:value={themeDraft.wallpaperDim} /></label>
            <label class="range-field"><span><b>Bulanıklık</b><output>{themeDraft.wallpaperBlur}px</output></span><input type="range" min="0" max="20" step="1" bind:value={themeDraft.wallpaperBlur} /></label>
            <label class="field-group wallpaper-position-field"><span><b>Konum</b><small>Görsel ekranı doldururken korunacak alanı belirler.</small></span><select bind:value={themeDraft.wallpaperPosition}><option value="50% 50%">Orta</option><option value="50% 0%">Üst</option><option value="50% 100%">Alt</option><option value="0% 50%">Sol</option><option value="100% 50%">Sağ</option></select></label>
          </div>
        </section>
      {:else}
        <section class="settings-section settings-section--shortcuts" aria-labelledby="shortcut-settings-title">
          <div class="setting-heading">
            <h3 id="shortcut-settings-title">Klavye kısayolları</h3>
            <p>İpuçlarını görünür yapın ve görev ekleme alanına doğrudan geçin.</p>
          </div>

          <div class="shortcut-settings-list">
            <ShortcutField
              value={shortcutDraft.revealKey}
              onChange={(value) => (shortcutDraft.revealKey = value)}
              label="Kısayol ipuçlarını göster"
              description="Bu tuş basılı tutulurken sayfadaki kullanılabilir kısayollar görünür."
              singleKeyOnly
            />
            <ShortcutField
              value={shortcutDraft.todoFocus}
              onChange={(value) => (shortcutDraft.todoFocus = value)}
              label="Görev ekleme alanına odaklan"
              description="Yeni sekmede yapılacaklar input’una doğrudan odaklanır."
            />
          </div>

          <div class="settings-note">
            <Icon name="keyboard" size={16} />
            <p>Favori ve klasör kısayolları üç nokta menüsünden; Pomodoro ve oynatıcı kısayolları kendi kart ayarlarından değiştirilebilir.</p>
          </div>
        </section>
      {/if}
    </div>
  </div>

  {#if saveError}<p class="form-error settings-save-error">{saveError}</p>{/if}

  <svelte:fragment slot="footer-leading">
    <Button variant="ghost" onclick={resetDefaults}>Varsayılana dön</Button>
  </svelte:fragment>
</Dialog>
