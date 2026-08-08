import { mount } from 'svelte';
import App from './App.svelte';
import './style.css';
import { loadSettings } from '../../lib/storage';
import { applyTheme } from '../../lib/theme';
import { DEFAULT_SETTINGS } from '../../lib/defaults';

async function bootstrap() {
  let settings = structuredClone(DEFAULT_SETTINGS);
  let initialError = '';
  try {
    settings = await loadSettings();
  } catch {
    initialError = 'Ayarlar yüklenemedi; varsayılan görünüm kullanılıyor.';
  }
  applyTheme(settings.theme);

  mount(App, {
    target: document.getElementById('app')!,
    props: { initialSettings: settings, initialError },
  });
}

void bootstrap();
