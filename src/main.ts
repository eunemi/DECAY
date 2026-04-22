import './styles/main.css';
import './styles/notes.css';
import './styles/modal.css';
import './styles/heatmap.css';

import { initDB } from './db';
import { syncAllDecay } from './decayEngine';
import { initUI, renderNoteList, refreshUI } from './ui';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Init IndexedDB
  await initDB();

  // 2. Run first syncAllDecay()
  await syncAllDecay();

  // 3. Build UI shell
  initUI();

  // 4. Render note list
  await renderNoteList();

  // 5. Start 60s sync interval
  setInterval(async () => {
    await refreshUI();
  }, 60000);

  console.log('DECAY initialized — only what matters survives.');
});
