import { Note } from './types';
import { getAllNotes, getNoteById, deleteNote, saveNote } from './db';
import { createNote, calculateCurrentOpacity, visitNote, syncAllDecay } from './decayEngine';
import { renderDecayedText, updateDecayedText } from './decayRenderer';
import { openRecallModal } from './recallModal';
import { renderGhostList } from './ghostNotes';
import initHeatmap, { buildLegend } from './heatmap';
import { mountDecayWorkspace, unmountDecayWorkspace } from './components/editor/mount';

type TabName = 'notes' | 'ghosts' | 'heatmap';

interface HeatmapController {
  render: (notes: Note[]) => void;
  update: () => Promise<void>;
  destroy: () => void;
}

let currentTab: TabName = 'notes';
let selectedNoteId: string | null = null;
let isNewNote = false;
let heatmapController: HeatmapController | null = null;
let noteSearchQuery = '';
let activeDetailNoteId: string | null = null;

type OpacityStatus = 'ACTIVE' | 'SURVIVING' | 'FADING' | 'GHOST';

function getOpacityStatus(opacityPct: number): OpacityStatus {
  if (opacityPct > 65) return 'ACTIVE';
  if (opacityPct > 38) return 'SURVIVING';
  if (opacityPct > 15) return 'FADING';
  return 'GHOST';
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return 'Last week';
}

function formatNoteTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = date.toLocaleDateString('en-US', { day: '2-digit' });
  const year = date.toLocaleDateString('en-US', { year: 'numeric' });
  const time = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${month} ${day}, ${year} · ${time}`;
}

function applyNoteSearchFilter(query: string): void {
  const container = document.getElementById('note-list');
  if (!container) return;

  const normalizedQuery = query.trim().toLowerCase();
  const cards = Array.from(container.querySelectorAll<HTMLElement>('.note-card'));
  let visibleCount = 0;

  cards.forEach((card) => {
    const haystack = (card.dataset.searchText || '').toLowerCase();
    const shouldShow = normalizedQuery.length === 0 || haystack.includes(normalizedQuery);
    card.style.display = shouldShow ? 'block' : 'none';
    if (shouldShow) visibleCount += 1;
  });

  container.querySelector('.note-list-empty--search')?.remove();

  if (cards.length > 0 && visibleCount === 0) {
    const empty = document.createElement('div');
    empty.className = 'note-list-empty note-list-empty--search';
    empty.textContent = 'NO MATCHING NOTES';
    container.appendChild(empty);
  }
}

function getWorkspaceShell(): HTMLElement | null {
  return document.getElementById('workspace-shell');
}

function getWorkspaceColumns(): HTMLElement | null {
  return document.querySelector('.workspace-columns');
}

function getDetailView(): HTMLElement | null {
  return document.getElementById('note-detail-view');
}

function closeDetailView(): void {
  const detailView = getDetailView();
  const columns = getWorkspaceColumns();
  if (!detailView || !columns) return;

  unmountDecayWorkspace();

  detailView.classList.remove('note-detail-view--open');
  detailView.setAttribute('aria-hidden', 'true');
  columns.classList.remove('workspace-columns--hidden');
  activeDetailNoteId = null;
}

function openDetailView(note: Note): void {
  const detailView = getDetailView();
  const columns = getWorkspaceColumns();
  if (!detailView || !columns) return;

  activeDetailNoteId = note.id;

  mountDecayWorkspace(
    detailView,
    note,
    async (updatedNote) => {
      await saveNote(updatedNote);
      await renderNoteList();
    },
    () => {
      closeDetailView();
    }
  );

  columns.classList.add('workspace-columns--hidden');
  detailView.classList.add('note-detail-view--open');
  detailView.setAttribute('aria-hidden', 'false');
}

function closeWorkspace(): void {
  closeDetailView();
  getWorkspaceShell()?.classList.remove('workspace-shell--open');
}

async function openWorkspace(tab: TabName): Promise<void> {
  closeDetailView();
  getWorkspaceShell()?.classList.add('workspace-shell--open');
  await switchTab(tab);
}

function createMainContent(): HTMLElement {
  const main = document.createElement('div');
  main.className = 'main-content';
  main.id = 'main-content';

  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.id = 'empty-state';
  empty.innerHTML = `
    <div class="empty-icon">◌</div>
    <div class="empty-text">Select a note or create a new one</div>
    <div class="empty-subtext">Every note fades unless you revisit it.</div>
  `;

  const editor = document.createElement('div');
  editor.className = 'note-editor';
  editor.id = 'note-editor';
  editor.style.display = 'none';

  const ghostView = document.createElement('div');
  ghostView.id = 'ghost-view';
  ghostView.className = 'ghost-view';
  ghostView.style.display = 'none';

  const heatmapView = document.createElement('div');
  heatmapView.id = 'heatmap-view';
  heatmapView.className = 'heatmap-view';
  heatmapView.style.display = 'none';

  main.appendChild(empty);
  main.appendChild(editor);
  main.appendChild(ghostView);
  main.appendChild(heatmapView);

  return main;
}

function createLandingShell(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'decay-page';

  root.innerHTML = `
    <div class="ambient-layer" aria-hidden="true">
      <div class="ambient-glow ambient-glow--left"></div>
      <div class="ambient-glow ambient-glow--right"></div>
      <div class="lost-thoughts fade-edges">
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    } else {
      entry.target.classList.remove('visible');
    }
  });
});
// The mind is a sieve, not a vault.
// What remains is what matters.
function forget(thought, retention) {
  if (retention < threshold) {
    return null;
  }
  return condense(thought);
}
      </div>
    </div>

    <nav class="top-app-bar">
      <div class="top-app-inner">
        <div class="brand">DECAY</div>
        <div class="top-links" role="tablist" aria-label="Primary navigation">
          <button id="nav-manifesto" class="top-link" type="button">MANIFESTO</button>
          <button class="top-link nav-tab nav-tab--active" data-tab="notes" type="button">LOG</button>
          <button class="top-link nav-tab" data-tab="ghosts" type="button">VOID</button>
          <button class="top-link nav-tab" data-tab="heatmap" type="button">ARCHIVE</button>
        </div>
        <button id="enter-btn" class="enter-btn" type="button">ENTER</button>
      </div>
    </nav>

    <main class="landing-main">
      <section class="hero-section" id="hero-section">
        <div class="hero-content">
          <h1>What if forgetting<br/>is the feature?</h1>
          <p>Your mind was never meant to store everything.</p>
          <div class="hero-actions">
            <button id="start-writing-btn" class="hero-btn hero-btn--primary" type="button">START WRITING</button>
            <button id="watch-fade-btn" class="hero-btn hero-btn--secondary" type="button">WATCH HOW IT FADES</button>
          </div>
        </div>
        <div class="decay-line" aria-hidden="true"></div>
      </section>

      <section class="split-section" id="manifesto-section">
        <div class="split-copy">
          <h2>You were taught to remember everything.</h2>
          <p class="decay-text">
            We built infinite digital vaults, hoarding <span class="decay-word-1">every fleeting thought,</span>
            <span class="decay-word-2">bookmark,</span> and <span class="decay-word-3">half-baked idea.</span>
            The result isn't clarity. It's noise. The burden of retention outweighs the value of the insight.
          </p>
        </div>
        <div class="split-visual glass-panel">
          <div class="split-visual-overlay"></div>
          <div class="tag-cloud">
            <span>GROCERY_LIST_FINAL_V2</span>
            <span>RANDOM_URL_SAVE</span>
            <span>MEETING_NOTES_2021</span>
            <span>THOUGHT_0394</span>
          </div>
        </div>
      </section>

      <section class="split-section split-section--reverse">
        <div class="split-visual glass-panel split-visual--line">
          <div class="core-line"></div>
          <span class="core-label">CORE_INSIGHT</span>
        </div>
        <div class="split-copy">
          <h2>But clarity comes from forgetting.</h2>
          <p>
            Decay intentionally lets the irrelevant fade. What survives is what matters. A system that
            mimics the organic filtering of the human mind, leaving you with sharp, focused intent.
          </p>
        </div>
      </section>

      <section class="demo-section">
        <div class="demo-head">
          <h3>The fading process</h3>
          <p>HOVER TO RESTORE CONTEXT</p>
        </div>
        <div class="demo-card glass-panel">
          <p>
            <span class="demo-strong">The core thesis is strong.</span>
            <span class="decay-text decay-word-2">I should probably review the secondary sources when I have time next week, maybe Thursday.</span>
            <span class="demo-strong">We need to pivot the architecture to prioritize latency.</span>
            <span class="decay-text decay-word-1">Also need to buy coffee beans and call mom.</span>
            <span class="demo-strong">Execute by Q3.</span>
          </p>
          <div class="demo-cursor"></div>
        </div>
      </section>
    </main>

    <footer class="landing-footer">
      <div class="footer-inner">
        <div>© 2026 DECAY — PERSISTENCE IS FUTILE</div>
        <div class="footer-links">
          <span>PRIVACY</span>
          <span>TERMS</span>
          <span>COGNITION</span>
        </div>
      </div>
    </footer>
  `;

  const workspaceShell = document.createElement('div');
  workspaceShell.id = 'workspace-shell';
  workspaceShell.className = 'workspace-shell';

  const workspacePanel = document.createElement('div');
  workspacePanel.className = 'workspace-panel';

  workspacePanel.innerHTML = `
    <div class="workspace-backdrop" id="workspace-backdrop"></div>
    <div class="workspace-frame glass-panel">
      <div class="workspace-ghost-text" aria-hidden="true">
        fragments remaining. logic unspooling. context lost in transfer. retrieve. fragments remaining.
      </div>
      <div class="workspace-columns">
        <aside class="workspace-rail">
          <div class="workspace-brand-block">
            <h2 class="workspace-brand">DECAY</h2>
            <p class="workspace-brand-subtitle">PRECISION MEMORY</p>
          </div>
          <div class="workspace-nav">
            <button class="workspace-nav-item nav-tab nav-tab--active" data-tab="notes" type="button">
              <span class="workspace-nav-icon">▣</span>
              <span>ALL NOTES</span>
            </button>
            <button class="workspace-nav-item nav-tab" type="button">
              <span class="workspace-nav-icon">◐</span>
              <span>SURVIVING</span>
            </button>
            <button class="workspace-nav-item nav-tab" type="button">
              <span class="workspace-nav-icon">◒</span>
              <span>FADING</span>
            </button>
            <button class="workspace-nav-item nav-tab" data-tab="ghosts" type="button">
              <span class="workspace-nav-icon">◌</span>
              <span>GHOSTS</span>
            </button>
            <button class="workspace-nav-item nav-tab" data-tab="heatmap" type="button">
              <span class="workspace-nav-icon">◎</span>
              <span>ARCHIVE</span>
            </button>
          </div>
          <button id="new-note-btn" class="new-note-btn" type="button">+ NEW NOTE</button>
        </aside>
        <section class="workspace-list-panel">
          <header class="workspace-list-header">
            <div class="workspace-list-title-row">
              <h3 class="workspace-list-title">Memory Bank</h3>
              <button class="workspace-filter-btn" type="button" aria-label="Filter memory bank">≡</button>
            </div>
            <label class="workspace-search-wrap" for="note-search">
              <span class="workspace-search-icon">⌕</span>
              <input id="note-search" class="workspace-search" type="text" autocomplete="off" placeholder="Search thoughts... [/]">
            </label>
            <div id="sidebar-status" class="sidebar-status"></div>
          </header>
          <div id="note-list" class="note-list"></div>
        </section>
        <section class="workspace-main-panel" style="display: none;">
          <div class="workspace-main-head">
            <div class="workspace-title">STATUS: ACTIVE SYNC</div>
            <button id="workspace-close" class="workspace-close" type="button">CLOSE</button>
          </div>
          <div class="workspace-main-content"></div>
        </section>
      </div>
      <section id="note-detail-view" class="note-detail-view" aria-hidden="true"></section>
    </div>
  `;

  const workspaceMainContent = workspacePanel.querySelector('.workspace-main-content') as HTMLElement;
  workspaceMainContent.appendChild(createMainContent());

  const workspaceSearch = workspacePanel.querySelector('#note-search') as HTMLInputElement | null;
  if (workspaceSearch) {
    workspaceSearch.addEventListener('input', () => {
      noteSearchQuery = workspaceSearch.value;
      applyNoteSearchFilter(noteSearchQuery);
    });
  }

  workspaceShell.appendChild(workspacePanel);
  root.appendChild(workspaceShell);

  return root;
}

function wireStaticInteractions(): void {
  const searchInput = document.getElementById('note-search') as HTMLInputElement | null;

  document.getElementById('nav-manifesto')?.addEventListener('click', () => {
    document.getElementById('manifesto-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.querySelectorAll<HTMLElement>('.nav-tab').forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab as TabName | undefined;
      if (!tab) return;
      void openWorkspace(tab);
    });
  });

  document.getElementById('enter-btn')?.addEventListener('click', () => {
    void openWorkspace('notes');
  });

  document.getElementById('start-writing-btn')?.addEventListener('click', () => {
    selectedNoteId = null;
    void openWorkspace('notes');
  });

  document.getElementById('watch-fade-btn')?.addEventListener('click', () => {
    void openWorkspace('notes');
  });

  document.getElementById('workspace-close')?.addEventListener('click', () => {
    closeWorkspace();
  });

  document.getElementById('workspace-backdrop')?.addEventListener('click', () => {
    closeWorkspace();
  });

  document.getElementById('new-note-btn')?.addEventListener('click', () => {
    void handleNewNote();
  });

  // Event listeners for static UI within detail view are removed as they are now handled by React

  window.addEventListener('keydown', (event) => {
    if (event.key === '/' && searchInput && document.activeElement !== searchInput) {
      const active = document.activeElement as HTMLElement | null;
      const isTextInput =
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.isContentEditable);
      if (!isTextInput) {
        event.preventDefault();
        searchInput.focus();
      }
      return;
    }

    if (event.key === 'Escape') {
      const detailView = getDetailView();
      if (detailView?.classList.contains('note-detail-view--open')) {
        closeDetailView();
        return;
      }

      if (searchInput && document.activeElement === searchInput && searchInput.value) {
        searchInput.value = '';
        noteSearchQuery = '';
        applyNoteSearchFilter(noteSearchQuery);
        return;
      }
      closeWorkspace();
    }
  });
}

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

  let currentTitle = note.title;
  let currentContent = note.content;
  let currentTags = [...note.tags];

  const result = calculateCurrentOpacity(note);

  const headerBar = document.createElement('div');
  headerBar.className = 'editor-header';

  const titleInput = document.createElement('input');
  titleInput.className = 'editor-title';
  titleInput.type = 'text';
  titleInput.value = note.title;
  titleInput.placeholder = 'Untitled';

  const opacityBadge = document.createElement('div');
  opacityBadge.className = 'opacity-badge';
  const pct = Math.round(result.opacity * 100);
  opacityBadge.textContent = `${pct}%`;
  if (pct > 60) opacityBadge.style.color = '#b2d5ff';
  else if (pct > 30) opacityBadge.style.color = '#f59e0b';
  else opacityBadge.style.color = '#ff7b9a';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = '✕';
  deleteBtn.title = 'Delete note';
  deleteBtn.addEventListener('click', async () => {
    if (!confirm('Delete this note permanently?')) return;

    await deleteNote(note.id);
    selectedNoteId = null;
    editor.style.display = 'none';
    empty.style.display = 'flex';
    await renderNoteList();
    await updateStatusBar();
  });

  headerBar.appendChild(titleInput);
  headerBar.appendChild(opacityBadge);

  if (result.opacity < 0.4 && note.status === 'alive') {
    const recallBtn = document.createElement('button');
    recallBtn.className = 'recall-btn';
    recallBtn.textContent = '⚡ FIGHT FOR THIS NOTE';
    recallBtn.addEventListener('click', async () => {
      await openRecallModal(note);
      await refreshUI();
    });
    headerBar.appendChild(recallBtn);
  }

  headerBar.appendChild(deleteBtn);

  const tagsRow = document.createElement('div');
  tagsRow.className = 'editor-tags';

  function renderTagPills(): void {
    tagsRow.querySelectorAll('.tag-pill').forEach((pill) => pill.remove());
    const tagInputEl = tagsRow.querySelector('.tag-input');

    for (const tag of currentTags) {
      const pill = document.createElement('span');
      pill.className = 'tag-pill';
      pill.innerHTML = `${tag} <span class="tag-remove" data-tag="${tag}">×</span>`;

      pill.querySelector('.tag-remove')?.addEventListener('click', async (event) => {
        event.stopPropagation();
        currentTags = currentTags.filter((existingTag) => existingTag !== tag);
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
  tagInput.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const value = tagInput.value.trim().replace(/,/g, '');
      if (value && !currentTags.includes(value)) {
        currentTags.push(value);
        tagInput.value = '';
        await saveCurrentNote();
        renderTagPills();
      }
    }
  });

  tagsRow.appendChild(tagInput);
  renderTagPills();

  const contentWrap = document.createElement('div');
  contentWrap.className = 'editor-content-wrap';

  const decayDisplay = document.createElement('div');
  decayDisplay.className = 'decay-display';
  decayDisplay.id = 'decay-display';

  const contentTextarea = document.createElement('textarea');
  contentTextarea.className = 'editor-content';
  contentTextarea.value = note.content;
  contentTextarea.placeholder = 'Start writing...';

  renderDecayedText(decayDisplay, note.content, result.opacity);

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
      status: 'alive',
    };

    await saveNote(updated);
    await renderNoteList();
    await updateStatusBar();
  }

  let isEditing = false;

  decayDisplay.addEventListener('click', () => {
    if (isEditing) return;
    isEditing = true;
    decayDisplay.style.display = 'none';
    contentTextarea.style.display = 'block';
    contentTextarea.focus();
  });

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

  titleInput.addEventListener('blur', async () => {
    const newTitle = titleInput.value;
    if (newTitle !== currentTitle) {
      currentTitle = newTitle;
      await saveCurrentNote();
    }
  });

  titleInput.addEventListener('input', () => {
    currentTitle = titleInput.value;
  });

  contentTextarea.style.display = 'none';

  contentWrap.appendChild(decayDisplay);
  contentWrap.appendChild(contentTextarea);

  const metaBar = document.createElement('div');
  metaBar.className = 'editor-meta';

  const created = new Date(note.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const visited = new Date(note.lastVisitedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  metaBar.innerHTML = `
    <span>CREATED ${created}</span>
    <span>LAST VISIT ${visited}</span>
    <span>RECALLS ${note.recallAttempts}</span>
    <span>DECAY ${note.decayRate.toFixed(6)}/MIN</span>
  `;

  editor.appendChild(metaBar);
  editor.appendChild(headerBar);
  editor.appendChild(tagsRow);
  editor.appendChild(contentWrap);

  if (isNewNote) {
    isNewNote = false;
    titleInput.select();
    titleInput.focus();
  }
}

export async function renderNoteList(): Promise<void> {
  const container = document.getElementById('note-list');
  if (!container) return;

  const notes = await getAllNotes();
  const aliveNotes = notes.filter((note) => note.status === 'alive');
  container.innerHTML = '';

  if (aliveNotes.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'note-list-empty';
    empty.textContent = 'NO NOTES YET';
    container.appendChild(empty);
    return;
  }

  for (const note of aliveNotes) {
    const result = calculateCurrentOpacity(note);
    const pct = Math.round(result.opacity * 100);
    const statusLabel = getOpacityStatus(pct);
    const timeLabel = formatRelativeTime(note.lastVisitedAt);

    const card = document.createElement('div');
    card.className = `note-card ${note.id === selectedNoteId ? 'note-card--selected' : ''}`;
    card.classList.add(`note-card--${statusLabel.toLowerCase()}`);
    card.dataset.noteId = note.id;

    const titleText = note.title || 'Untitled';
    const previewText = note.content.slice(0, 120) + (note.content.length > 120 ? '...' : '');
    card.dataset.searchText = `${titleText} ${note.content}`;

    const meta = document.createElement('div');
    meta.className = 'note-card-meta';
    meta.innerHTML = `
      <span class="note-card-status">${statusLabel}</span>
      <span class="note-card-time">${timeLabel}</span>
    `;

    const title = document.createElement('div');
    title.className = 'note-card-title';
    title.textContent = titleText;
    title.style.opacity = Math.max(0.3, result.opacity).toString();

    const preview = document.createElement('div');
    preview.className = 'note-card-preview';
    preview.textContent = previewText;
    preview.style.opacity = Math.max(0.15, result.opacity * 0.78).toString();

    const strength = document.createElement('div');
    strength.className = 'note-card-strength';
    strength.innerHTML = `<span class="opacity-dot"></span><span>${pct}%</span>`;

    const opacityDot = strength.querySelector('.opacity-dot') as HTMLElement;
    if (pct > 60) opacityDot.style.backgroundColor = '#4f7cff';
    else if (pct > 30) opacityDot.style.backgroundColor = '#9aa4b2';
    else opacityDot.style.backgroundColor = '#646b77';

    card.appendChild(meta);
    card.appendChild(title);
    card.appendChild(preview);
    card.appendChild(strength);

    card.addEventListener('click', async () => {
      await openWorkspace('notes');
      selectedNoteId = note.id;
      const fresh = await visitNote(note.id);
      if (!fresh) return;

      openDetailView(fresh);
      await renderNoteList();
      await updateStatusBar();
    });

    container.appendChild(card);
  }

  applyNoteSearchFilter(noteSearchQuery);
}

async function updateStatusBar(): Promise<void> {
  const element = document.getElementById('sidebar-status');
  if (!element) return;

  const notes = await getAllNotes();
  const alive = notes.filter((note) => note.status === 'alive').length;
  const ghost = notes.filter((note) => note.status === 'ghost').length;
  const gone = notes.filter((note) => note.status === 'gone').length;

  element.innerHTML = `
    <span class="status-item"><span class="status-dot status-dot--alive"></span>ALIVE ${alive}</span>
    <span class="status-item"><span class="status-dot status-dot--ghost"></span>GHOST ${ghost}</span>
    <span class="status-item"><span class="status-dot status-dot--gone"></span>GONE ${gone}</span>
  `;
}
async function switchTab(tab: TabName): Promise<void> {
  currentTab = tab;

  document.querySelectorAll('.nav-tab').forEach((button) => {
    button.classList.toggle('nav-tab--active', (button as HTMLElement).dataset.tab === tab);
  });

  const empty = document.getElementById('empty-state');
  const editor = document.getElementById('note-editor');
  const ghostView = document.getElementById('ghost-view');
  const heatmapView = document.getElementById('heatmap-view');
  if (!empty || !editor || !ghostView || !heatmapView) return;

  empty.style.display = 'none';
  editor.style.display = 'none';
  ghostView.style.display = 'none';
  heatmapView.style.display = 'none';

  if (tab !== 'notes') {
    closeDetailView();
  }

  if (tab !== 'heatmap' && heatmapController) {
    heatmapController.destroy();
    heatmapController = null;
  }

  if (tab === 'notes') {
    if (!selectedNoteId) {
      empty.style.display = 'flex';
      return;
    }

    const note = await getNoteById(selectedNoteId);
    if (!note || note.status !== 'alive') {
      selectedNoteId = null;
      empty.style.display = 'flex';
      return;
    }

    renderEditor(note);
    return;
  }

  if (tab === 'ghosts') {
    ghostView.style.display = 'block';
    ghostView.innerHTML = '';

    const ghostHeader = document.createElement('div');
    ghostHeader.className = 'ghost-view-header';
    ghostHeader.innerHTML = '<h2>Ghost Notes</h2><p>Notes that have fully decayed. Click a card to reconstruct from memory.</p>';
    ghostView.appendChild(ghostHeader);

    const ghostList = document.createElement('div');
    ghostList.className = 'ghost-list';
    ghostView.appendChild(ghostList);

    await renderGhostList(ghostList);

    if (ghostList.children.length === 0) {
      const emptyGhost = document.createElement('div');
      emptyGhost.className = 'ghost-empty';
      emptyGhost.textContent = 'No ghost notes. Your memories are safe for now.';
      ghostList.appendChild(emptyGhost);
    }

    return;
  }

  heatmapView.style.display = 'block';
  heatmapView.innerHTML = '';

  const heatmapHeader = document.createElement('div');
  heatmapHeader.className = 'heatmap-header';
  heatmapHeader.innerHTML = '<h2>Decay Map</h2><p>Visual heatmap of what\'s surviving in your knowledge. Bright = strong. Fading = at risk.</p>';
  heatmapView.appendChild(heatmapHeader);

  const rawNotes = await getAllNotes();
  const notes = rawNotes.map((note) => {
    const result = calculateCurrentOpacity(note);
    return { ...note, opacity: result.opacity, status: result.status };
  });

  if (notes.length === 0) {
    const emptyHeatmap = document.createElement('div');
    emptyHeatmap.className = 'heatmap-empty';
    emptyHeatmap.textContent = 'No notes to visualize yet.';
    heatmapView.appendChild(emptyHeatmap);
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'heatmap-wrap';

  const canvas = document.createElement('canvas');
  canvas.className = 'heatmap-canvas';
  wrap.appendChild(canvas);

  heatmapView.appendChild(wrap);

  heatmapController = initHeatmap(canvas, async (noteId) => {
    selectedNoteId = noteId;
    const fresh = await visitNote(noteId);
    if (!fresh) return;

    await switchTab('notes');
    openDetailView(fresh);
    await renderNoteList();
    await updateStatusBar();
  }) as unknown as HeatmapController;

  heatmapController.render(notes);
  wrap.appendChild(buildLegend());
}

async function handleNewNote(): Promise<void> {
  await openWorkspace('notes');

  const note = await createNote('Untitled', '', []);
  selectedNoteId = note.id;
  currentTab = 'notes';
  isNewNote = false;

  await renderNoteList();
  await updateStatusBar();
}

async function refreshUI(): Promise<void> {
  await syncAllDecay();
  await renderNoteList();
  await updateStatusBar();

  const detailView = getDetailView();
  if (detailView?.classList.contains('note-detail-view--open') && activeDetailNoteId) {
    const activeNote = await getNoteById(activeDetailNoteId);
    if (activeNote) {
      openDetailView(activeNote);
    } else {
      closeDetailView();
    }
  }

  if (currentTab === 'heatmap' && heatmapController) {
    await heatmapController.update();
  }

  if (!(selectedNoteId && currentTab === 'notes')) return;

  const note = await getNoteById(selectedNoteId);
  if (note && note.status === 'alive') {
    const display = document.getElementById('decay-display');
    if (!display) return;

    const result = calculateCurrentOpacity(note);
    updateDecayedText(display, result.opacity);
    return;
  }

  selectedNoteId = null;
  const editor = document.getElementById('note-editor');
  const empty = document.getElementById('empty-state');
  if (editor && empty) {
    editor.style.display = 'none';
    empty.style.display = 'flex';
  }
}

export function initUI(): void {
  if (heatmapController) {
    heatmapController.destroy();
    heatmapController = null;
  }

  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = '';
  app.appendChild(createLandingShell());
  wireStaticInteractions();

  void updateStatusBar();
}

export { refreshUI, switchTab };
