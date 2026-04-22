import { Note } from './types';
import { getAllNotes, getNoteById, deleteNote } from './db';
import { createNote, calculateCurrentOpacity, visitNote, updateNoteContent, syncAllDecay } from './decayEngine';
import { renderDecayedText, updateDecayedText } from './decayRenderer';
import { openRecallModal } from './recallModal';
import { renderGhostList } from './ghostNotes';
import initHeatmap, { buildLegend } from './heatmap';

type TabName = 'notes' | 'ghosts' | 'heatmap';

let currentTab: TabName = 'notes';
let selectedNoteId: string | null = null;
let isNewNote = false; // Track if we just created a new note

// ─── Sidebar ────────────────────────────────────────

function createSidebar(): HTMLElement {
  const sidebar = document.createElement('div');
  sidebar.className = 'sidebar';

  // Logo / header
  const header = document.createElement('div');
  header.className = 'sidebar-header';

  const logo = document.createElement('div');
  logo.className = 'sidebar-logo';
  logo.textContent = 'DECAY';

  const tagline = document.createElement('div');
  tagline.className = 'sidebar-tagline';
  tagline.textContent = 'only what matters survives';

  header.appendChild(logo);
  header.appendChild(tagline);

  // Nav tabs
  const nav = document.createElement('div');
  nav.className = 'sidebar-nav';

  const tabs: { name: TabName; label: string; icon: string }[] = [
    { name: 'notes', label: 'Notes', icon: '◉' },
    { name: 'ghosts', label: 'Ghosts', icon: '◌' },
    { name: 'heatmap', label: 'Heatmap', icon: '▦' },
  ];

  for (const tab of tabs) {
    const btn = document.createElement('button');
    btn.className = `nav-tab ${tab.name === currentTab ? 'nav-tab--active' : ''}`;
    btn.dataset.tab = tab.name;
    btn.innerHTML = `<span class="nav-tab-icon">${tab.icon}</span> ${tab.label}`;
    btn.addEventListener('click', () => switchTab(tab.name));
    nav.appendChild(btn);
  }

  // New note button
  const newBtn = document.createElement('button');
  newBtn.id = 'new-note-btn';
  newBtn.className = 'new-note-btn';
  newBtn.textContent = '+ New Note';
  newBtn.addEventListener('click', handleNewNote);

  // Note list
  const noteList = document.createElement('div');
  noteList.id = 'note-list';
  noteList.className = 'note-list';

  // FIX 6: Status bar
  const statusBar = document.createElement('div');
  statusBar.id = 'sidebar-status';
  statusBar.className = 'sidebar-status';

  sidebar.appendChild(header);
  sidebar.appendChild(nav);
  sidebar.appendChild(newBtn);
  sidebar.appendChild(noteList);
  sidebar.appendChild(statusBar);

  return sidebar;
}

// ─── Main Content ───────────────────────────────────

function createMainContent(): HTMLElement {
  const main = document.createElement('div');
  main.className = 'main-content';
  main.id = 'main-content';

  // Empty state
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.id = 'empty-state';

  const emptyIcon = document.createElement('div');
  emptyIcon.className = 'empty-icon';
  emptyIcon.textContent = '◌';

  const emptyText = document.createElement('div');
  emptyText.className = 'empty-text';
  emptyText.textContent = 'Select a note or create a new one';

  const emptySubtext = document.createElement('div');
  emptySubtext.className = 'empty-subtext';
  emptySubtext.textContent = 'Every note you create begins to fade. Only what you revisit survives.';

  empty.appendChild(emptyIcon);
  empty.appendChild(emptyText);
  empty.appendChild(emptySubtext);
  main.appendChild(empty);

  // Editor (hidden by default)
  const editor = document.createElement('div');
  editor.className = 'note-editor';
  editor.id = 'note-editor';
  editor.style.display = 'none';
  main.appendChild(editor);

  // Ghost list view
  const ghostView = document.createElement('div');
  ghostView.id = 'ghost-view';
  ghostView.className = 'ghost-view';
  ghostView.style.display = 'none';
  main.appendChild(ghostView);

  // Heatmap view
  const heatmapView = document.createElement('div');
  heatmapView.id = 'heatmap-view';
  heatmapView.className = 'heatmap-view';
  heatmapView.style.display = 'none';
  main.appendChild(heatmapView);

  return main;
}

// ─── Note Editor ────────────────────────────────────

function renderEditor(note: Note): void {
  const editor = document.getElementById('note-editor')!;
  const empty = document.getElementById('empty-state')!;
  const ghostView = document.getElementById('ghost-view')!;
  const heatmapView = document.getElementById('heatmap-view')!;

  empty.style.display = 'none';
  ghostView.style.display = 'none';
  heatmapView.style.display = 'none';
  editor.style.display = 'flex';
  editor.innerHTML = '';

  // Track current note state locally so blur handlers always see latest
  let currentTitle = note.title;
  let currentContent = note.content;
  let currentTags = [...note.tags];

  const result = calculateCurrentOpacity(note);

  // Header bar
  const headerBar = document.createElement('div');
  headerBar.className = 'editor-header';

  const titleInput = document.createElement('input');
  titleInput.className = 'editor-title';
  titleInput.type = 'text';
  titleInput.value = note.title;
  titleInput.placeholder = 'Untitled';

  // Opacity indicator
  const opacityBadge = document.createElement('div');
  opacityBadge.className = 'opacity-badge';
  const pct = Math.round(result.opacity * 100);
  opacityBadge.textContent = `${pct}%`;
  if (pct > 60) opacityBadge.style.color = '#22c55e';
  else if (pct > 30) opacityBadge.style.color = '#f59e0b';
  else opacityBadge.style.color = '#ef4444';

  // FIX 5: Delete note button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = '✕';
  deleteBtn.title = 'Delete note';
  deleteBtn.addEventListener('click', async () => {
    if (confirm('Delete this note permanently?')) {
      await deleteNote(note.id);
      selectedNoteId = null;
      editor.style.display = 'none';
      const emptyEl = document.getElementById('empty-state')!;
      emptyEl.style.display = 'flex';
      await renderNoteList();
      await updateStatusBar();
    }
  });

  headerBar.appendChild(titleInput);
  headerBar.appendChild(opacityBadge);

  // If note opacity is low, show recall prompt
  if (result.opacity < 0.4 && note.status === 'alive') {
    const recallBtn = document.createElement('button');
    recallBtn.className = 'recall-btn';
    recallBtn.textContent = '⚡ Fight for this note';
    recallBtn.addEventListener('click', async () => {
      await openRecallModal(note);
      await refreshUI();
    });
    headerBar.appendChild(recallBtn);
  }

  headerBar.appendChild(deleteBtn);

  // FIX 4: Tags row with input
  const tagsRow = document.createElement('div');
  tagsRow.className = 'editor-tags';

  function renderTagPills(): void {
    // Clear existing pills but keep the input
    const existingPills = tagsRow.querySelectorAll('.tag-pill');
    existingPills.forEach((p) => p.remove());

    // Insert pills before the tag input
    const tagInputEl = tagsRow.querySelector('.tag-input');
    for (const tag of currentTags) {
      const pill = document.createElement('span');
      pill.className = 'tag-pill';
      pill.innerHTML = `${tag} <span class="tag-remove" data-tag="${tag}">×</span>`;

      pill.querySelector('.tag-remove')!.addEventListener('click', async (e) => {
        e.stopPropagation();
        currentTags = currentTags.filter((t) => t !== tag);
        await saveCurrentNote();
        renderTagPills();
      });

      if (tagInputEl) {
        tagsRow.insertBefore(pill, tagInputEl);
      } else {
        tagsRow.appendChild(pill);
      }
    }
  }

  const tagInput = document.createElement('input');
  tagInput.className = 'tag-input';
  tagInput.type = 'text';
  tagInput.placeholder = '+ tag';
  tagInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.value.trim().replace(/,/g, '');
      if (val && !currentTags.includes(val)) {
        currentTags.push(val);
        tagInput.value = '';
        await saveCurrentNote();
        renderTagPills();
      }
    }
  });

  tagsRow.appendChild(tagInput);
  renderTagPills();

  // Content area — decayed text display + hidden textarea
  const contentWrap = document.createElement('div');
  contentWrap.className = 'editor-content-wrap';

  const decayDisplay = document.createElement('div');
  decayDisplay.className = 'decay-display';
  decayDisplay.id = 'decay-display';

  const contentTextarea = document.createElement('textarea');
  contentTextarea.className = 'editor-content';
  contentTextarea.value = note.content;
  contentTextarea.placeholder = 'Start writing...';

  // Render decayed text
  renderDecayedText(decayDisplay, note.content, result.opacity);

  // FIX 1: Save helper that uses local state (no double-read from stale closures)
  async function saveCurrentNote(): Promise<void> {
    const freshNote = await getNoteById(note.id);
    if (!freshNote) return;

    const updated: Note = {
      ...freshNote,
      title: currentTitle,
      content: currentContent,
      tags: currentTags,
      lastVisitedAt: Date.now(),
      opacity: 1.0,
      status: 'alive' as const,
    };

    const { saveNote } = await import('./db');
    await saveNote(updated);
    await renderNoteList();
    await updateStatusBar();
  }

  // Toggle between view and edit mode
  let isEditing = false;

  decayDisplay.addEventListener('click', () => {
    if (!isEditing) {
      isEditing = true;
      decayDisplay.style.display = 'none';
      contentTextarea.style.display = 'block';
      contentTextarea.focus();
    }
  });

  // FIX 1: Blur handler — save without re-rendering entire editor
  contentTextarea.addEventListener('blur', async () => {
    isEditing = false;
    contentTextarea.style.display = 'none';
    decayDisplay.style.display = 'block';

    const newContent = contentTextarea.value;
    if (newContent !== currentContent) {
      currentContent = newContent;
      await saveCurrentNote();
      renderDecayedText(decayDisplay, currentContent, 1.0);
    }
  });

  // FIX 1: Title blur — only save, don't re-render the editor
  titleInput.addEventListener('blur', async () => {
    const newTitle = titleInput.value;
    if (newTitle !== currentTitle) {
      currentTitle = newTitle;
      await saveCurrentNote();
    }
  });

  // Track title changes in real time
  titleInput.addEventListener('input', () => {
    currentTitle = titleInput.value;
  });

  contentTextarea.style.display = 'none';

  contentWrap.appendChild(decayDisplay);
  contentWrap.appendChild(contentTextarea);

  // Meta bar
  const metaBar = document.createElement('div');
  metaBar.className = 'editor-meta';

  const created = new Date(note.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
  const visited = new Date(note.lastVisitedAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  metaBar.innerHTML = `
    <span>Created: ${created}</span>
    <span>Last visit: ${visited}</span>
    <span>Recalls: ${note.recallAttempts}</span>
    <span>Decay rate: ${note.decayRate.toFixed(6)}/min</span>
  `;

  editor.appendChild(headerBar);
  editor.appendChild(tagsRow);
  editor.appendChild(contentWrap);
  editor.appendChild(metaBar);

  // FIX 2: Auto-select title text for new notes
  if (isNewNote) {
    isNewNote = false;
    titleInput.select();
    titleInput.focus();
  }
}

// ─── Note List (sidebar) ───────────────────────────

export async function renderNoteList(): Promise<void> {
  const container = document.getElementById('note-list');
  if (!container) return;

  const notes = await getAllNotes();
  const aliveNotes = notes.filter((n) => n.status === 'alive');
  container.innerHTML = '';

  if (aliveNotes.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'note-list-empty';
    empty.textContent = 'No notes yet';
    container.appendChild(empty);
    return;
  }

  for (const note of aliveNotes) {
    const result = calculateCurrentOpacity(note);
    const card = document.createElement('div');
    card.className = `note-card ${note.id === selectedNoteId ? 'note-card--selected' : ''}`;
    card.dataset.noteId = note.id;

    const title = document.createElement('div');
    title.className = 'note-card-title';
    title.textContent = note.title || 'Untitled';
    title.style.opacity = Math.max(0.3, result.opacity).toString();

    const preview = document.createElement('div');
    preview.className = 'note-card-preview';
    preview.textContent = note.content.slice(0, 60) + (note.content.length > 60 ? '...' : '');
    preview.style.opacity = Math.max(0.15, result.opacity * 0.6).toString();

    const meta = document.createElement('div');
    meta.className = 'note-card-meta';

    const opacityDot = document.createElement('span');
    opacityDot.className = 'opacity-dot';
    const pct = Math.round(result.opacity * 100);
    if (pct > 60) opacityDot.style.backgroundColor = '#22c55e';
    else if (pct > 30) opacityDot.style.backgroundColor = '#f59e0b';
    else opacityDot.style.backgroundColor = '#ef4444';

    const metaText = document.createElement('span');
    metaText.textContent = `${pct}%`;

    meta.appendChild(opacityDot);
    meta.appendChild(metaText);

    card.appendChild(title);
    card.appendChild(preview);
    card.appendChild(meta);

    card.addEventListener('click', async () => {
      selectedNoteId = note.id;
      const fresh = await visitNote(note.id);
      if (fresh) {
        renderEditor(fresh);
        renderNoteList();
      }
    });

    container.appendChild(card);
  }
}

// FIX 6: Status bar updater
async function updateStatusBar(): Promise<void> {
  const el = document.getElementById('sidebar-status');
  if (!el) return;

  const notes = await getAllNotes();
  const alive = notes.filter((n) => n.status === 'alive').length;
  const ghost = notes.filter((n) => n.status === 'ghost').length;
  const gone = notes.filter((n) => n.status === 'gone').length;

  el.innerHTML = `
    <span class="status-item"><span class="status-dot status-dot--alive"></span>${alive} alive</span>
    <span class="status-item"><span class="status-dot status-dot--ghost"></span>${ghost} ghost</span>
    <span class="status-item"><span class="status-dot status-dot--gone"></span>${gone} gone</span>
  `;
}

// ─── Tab Switching ──────────────────────────────────

async function switchTab(tab: TabName): Promise<void> {
  currentTab = tab;

  // Update nav buttons
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.classList.toggle('nav-tab--active', (btn as HTMLElement).dataset.tab === tab);
  });

  const empty = document.getElementById('empty-state')!;
  const editor = document.getElementById('note-editor')!;
  const ghostView = document.getElementById('ghost-view')!;
  const heatmapView = document.getElementById('heatmap-view')!;

  empty.style.display = 'none';
  editor.style.display = 'none';
  ghostView.style.display = 'none';
  heatmapView.style.display = 'none';

  if (tab === 'notes') {
    if (selectedNoteId) {
      editor.style.display = 'flex';
    } else {
      empty.style.display = 'flex';
    }
  } else if (tab === 'ghosts') {
    ghostView.style.display = 'block';
    ghostView.innerHTML = '';

    const ghostHeader = document.createElement('div');
    ghostHeader.className = 'ghost-view-header';
    ghostHeader.innerHTML = '<h2>Ghost Notes</h2><p>Notes that have fully decayed. Click to attempt reconstruction.</p>';
    ghostView.appendChild(ghostHeader);

    const ghostList = document.createElement('div');
    ghostList.className = 'ghost-list';
    ghostView.appendChild(ghostList);

    await renderGhostList(ghostList);

    if (ghostList.children.length === 0) {
      const emptyGhost = document.createElement('div');
      emptyGhost.className = 'ghost-empty';
      emptyGhost.textContent = 'No ghost notes. Your memories are safe — for now.';
      ghostList.appendChild(emptyGhost);
    }
  } else if (tab === 'heatmap') {
    heatmapView.style.display = 'block';
    heatmapView.innerHTML = '';

    // FIX 3: Heatmap header
    const heatmapHeader = document.createElement('div');
    heatmapHeader.className = 'heatmap-header';
    heatmapHeader.innerHTML = '<h2>Decay Map</h2><p>Visual heatmap of what\'s surviving in your knowledge. Bright = strong. Fading = at risk. Gone = you\'ve accepted it doesn\'t matter.</p>';
    heatmapView.appendChild(heatmapHeader);

    // FIX 7: Fetch notes with fresh opacity
    const rawNotes = await getAllNotes();
    const notes = rawNotes.map((n) => {
      const r = calculateCurrentOpacity(n);
      return { ...n, opacity: r.opacity, status: r.status };
    });

    // FIX 5 (empty state): Check if there are any notes
    if (notes.length === 0) {
      const emptyHeatmap = document.createElement('div');
      emptyHeatmap.className = 'heatmap-empty';
      emptyHeatmap.textContent = 'No notes to visualize. Create some notes and watch the map evolve.';
      heatmapView.appendChild(emptyHeatmap);
      return;
    }

    // Heatmap wrapper
    const wrap = document.createElement('div');
    wrap.className = 'heatmap-wrap';

    const canvas = document.createElement('canvas');
    canvas.className = 'heatmap-canvas';
    wrap.appendChild(canvas);

    heatmapView.appendChild(wrap);

    // Init controller and render
    const controller = initHeatmap(canvas, async (noteId) => {
      selectedNoteId = noteId;
      const fresh = await visitNote(noteId);
      if (fresh) {
        await switchTab('notes');
        renderEditor(fresh);
        await renderNoteList();
      }
    });

    controller.render(notes);

    // Legend
    wrap.appendChild(buildLegend());
  }
}

// ─── New Note ───────────────────────────────────────

async function handleNewNote(): Promise<void> {
  const note = await createNote('Untitled', '', []);
  selectedNoteId = note.id;
  currentTab = 'notes';
  isNewNote = true; // FIX 2: flag so renderEditor auto-selects title

  // Update tabs
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.classList.toggle('nav-tab--active', (btn as HTMLElement).dataset.tab === 'notes');
  });

  await renderNoteList();
  renderEditor(note);
  await updateStatusBar();
}

// ─── Refresh ────────────────────────────────────────

async function refreshUI(): Promise<void> {
  await syncAllDecay();
  await renderNoteList();
  await updateStatusBar();

  if (selectedNoteId && currentTab === 'notes') {
    const note = await getNoteById(selectedNoteId);
    if (note && note.status === 'alive') {
      const display = document.getElementById('decay-display');
      if (display) {
        const result = calculateCurrentOpacity(note);
        updateDecayedText(display, result.opacity);
      }
    } else {
      // Note ghosted or gone
      selectedNoteId = null;
      const editor = document.getElementById('note-editor')!;
      const empty = document.getElementById('empty-state')!;
      editor.style.display = 'none';
      empty.style.display = 'flex';
    }
  }
}

// ─── Initialize ─────────────────────────────────────

export function initUI(): void {
  const app = document.getElementById('app')!;
  app.innerHTML = '';

  app.appendChild(createSidebar());
  app.appendChild(createMainContent());

  // Initial status bar
  updateStatusBar();
}

export { refreshUI, switchTab };
