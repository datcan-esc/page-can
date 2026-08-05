import { mount } from 'svelte';
import App from './App.svelte';
import './style.css';
import { loadSettings } from '../../lib/storage';
import { applyTheme } from '../../lib/theme';

async function bootstrap() {
  const settings = await loadSettings();
  applyTheme(settings.theme);

  mount(App, {
    target: document.getElementById('app')!,
    props: { initialSettings: settings },
  });
}

void bootstrap();
