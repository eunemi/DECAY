import { Note } from './types';
import { getAllNotes } from './db';
import { calculateCurrentOpacity } from './decayEngine';

// ─── Types ──────────────────────────────────────────

interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
  noteId: string;
}

interface HeatmapController {
  render: (notes: Note[]) => void;
  update: () => Promise<void>;
  destroy: () => void;
}

// ─── Constants ──────────────────────────────────────

const CELL_SIZE = 80;
const CELL_GAP = 4;
const INNER_SIZE = CELL_SIZE - CELL_GAP; // 76px actual cell

// ─── Module-level state ─────────────────────────────

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let cellMap: Map<string, CellRect> = new Map();
let notesCache: Note[] = [];
let onNoteClickCb: (noteId: string) => void;
let tooltipEl: HTMLElement;
let resizeTimer: number;

// ─── Helpers ────────────────────────────────────────

function roundRect(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  if (typeof c.roundRect === 'function') {
    c.beginPath();
    c.roundRect(x, y, w, h, r);
  } else {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r);
    c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h);
    c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r);
    c.arcTo(x, y, x + r, y, r);
    c.closePath();
  }
}

// ─── 1. getColorForNote ─────────────────────────────

export function getColorForNote(opacity: number, status: string): string {
  if (status === 'ghost') return '#111111';

  const r = Math.round(75 + (245 - 75) * opacity);
  const g = Math.round(85 + (158 - 85) * opacity);
  const b = Math.round(99 + (11 - 99) * opacity);
  return `rgb(${r},${g},${b})`;
}

// ─── 3. render ──────────────────────────────────────

function render(notes: Note[]): void {
  notesCache = notes;

  const cols = Math.max(1, Math.floor(canvas.clientWidth / CELL_SIZE));
  const rows = Math.ceil(notes.length / cols);

  canvas.width = canvas.clientWidth;
  canvas.height = Math.max(rows * CELL_SIZE, CELL_SIZE);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  cellMap.clear();

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * CELL_SIZE + CELL_GAP / 2;
    const y = row * CELL_SIZE + CELL_GAP / 2;

    cellMap.set(note.id, { x, y, w: INNER_SIZE, h: INNER_SIZE, noteId: note.id });

    // Draw cell
    ctx.fillStyle = getColorForNote(note.opacity, note.status);
    roundRect(ctx, x, y, INNER_SIZE, INNER_SIZE, 6);
    ctx.fill();

    // Draw title text (truncated)
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '10px JetBrains Mono, monospace';
    const title = note.title.length > 10 ? note.title.slice(0, 9) + '…' : note.title;
    ctx.fillText(title, x + 6, y + INNER_SIZE - 8);
  }
}

// ─── 4. handleMouseMove ─────────────────────────────

function handleMouseMove(event: MouseEvent): void {
  const rect = canvas.getBoundingClientRect();
  const mx = event.clientX - rect.left;
  const my = event.clientY - rect.top;

  let found = false;

  for (const [, cell] of cellMap) {
    if (mx >= cell.x && mx <= cell.x + cell.w && my >= cell.y && my <= cell.y + cell.h) {
      const note = notesCache.find((n) => n.id === cell.noteId);
      if (note) {
        tooltipEl.style.display = 'block';
        tooltipEl.style.left = (event.clientX + 12) + 'px';
        tooltipEl.style.top = (event.clientY - 28) + 'px';
        tooltipEl.textContent = `${note.title} · ${Math.round(note.opacity * 100)}% memory`;
        canvas.style.cursor = 'pointer';
      }
      found = true;
      break;
    }
  }

  if (!found) {
    tooltipEl.style.display = 'none';
    canvas.style.cursor = 'default';
  }
}

// ─── 5. handleClick ─────────────────────────────────

function handleClick(event: MouseEvent): void {
  const rect = canvas.getBoundingClientRect();
  const mx = event.clientX - rect.left;
  const my = event.clientY - rect.top;

  for (const [, cell] of cellMap) {
    if (mx >= cell.x && mx <= cell.x + cell.w && my >= cell.y && my <= cell.y + cell.h) {
      onNoteClickCb(cell.noteId);
      break;
    }
  }
}

// ─── 6. update ──────────────────────────────────────

async function update(): Promise<void> {
  const notes = await getAllNotes();
  const mapped = notes.map((note) => {
    const result = calculateCurrentOpacity(note);
    return { ...note, opacity: result.opacity, status: result.status };
  });
  render(mapped);
}

// ─── 7. destroy ─────────────────────────────────────

let handleMouseLeave: () => void;
let handleResize: () => void;

function destroy(): void {
  canvas.removeEventListener('mousemove', handleMouseMove);
  canvas.removeEventListener('click', handleClick);
  canvas.removeEventListener('mouseleave', handleMouseLeave);
  window.removeEventListener('resize', handleResize);
  tooltipEl?.remove();
}

// ─── 2. initHeatmap ─────────────────────────────────

function initHeatmap(
  canvasEl: HTMLCanvasElement,
  onNoteClick: (noteId: string) => void
): HeatmapController {
  canvas = canvasEl;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Cannot get 2d context from heatmap canvas');
  ctx = context;
  onNoteClickCb = onNoteClick;

  // Create tooltip
  tooltipEl = document.createElement('div');
  tooltipEl.id = 'decay-tooltip';
  tooltipEl.style.position = 'fixed';
  tooltipEl.style.display = 'none';
  tooltipEl.style.background = '#0f0f0f';
  tooltipEl.style.border = '1px solid rgba(255,255,255,0.15)';
  tooltipEl.style.borderRadius = '8px';
  tooltipEl.style.padding = '8px 12px';
  tooltipEl.style.fontSize = '12px';
  tooltipEl.style.color = 'rgba(255,255,255,0.8)';
  tooltipEl.style.pointerEvents = 'none';
  tooltipEl.style.zIndex = '9998';
  tooltipEl.style.fontFamily = 'monospace';
  document.body.appendChild(tooltipEl);

  // Mouse leave handler
  handleMouseLeave = () => {
    tooltipEl.style.display = 'none';
  };

  // Debounced resize handler
  handleResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (notesCache.length > 0) {
        render(notesCache);
      }
    }, 200);
  };

  // Attach event listeners
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('click', handleClick);
  canvas.addEventListener('mouseleave', handleMouseLeave);
  window.addEventListener('resize', handleResize);

  return { render, update, destroy };
}

// ─── buildLegend ────────────────────────────────────

export function buildLegend(): HTMLElement {
  const legend = document.createElement('div');
  legend.className = 'heatmap-legend';

  const items: { color: string; label: string; border?: string }[] = [
    { color: '#f59e0b', label: 'Strong memory' },
    { color: '#b45309', label: 'Fading' },
    { color: '#4b5563', label: 'At risk' },
    { color: '#111111', label: 'Ghost', border: 'rgba(255,255,255,0.1)' },
  ];

  for (const item of items) {
    const el = document.createElement('div');
    el.className = 'legend-item';

    const swatch = document.createElement('div');
    swatch.className = 'legend-swatch';
    swatch.style.backgroundColor = item.color;
    if (item.border) {
      swatch.style.border = `1px solid ${item.border}`;
    }

    const label = document.createElement('span');
    label.textContent = item.label;

    el.appendChild(swatch);
    el.appendChild(label);
    legend.appendChild(el);
  }

  // Trailing text
  const hint = document.createElement('div');
  hint.className = 'legend-item';
  hint.style.marginLeft = '8px';
  hint.style.color = 'rgba(255,255,255,0.2)';
  hint.textContent = 'Visit notes to keep them alive';
  legend.appendChild(hint);

  return legend;
}

// ─── Exports ────────────────────────────────────────

export default initHeatmap;
export { initHeatmap };
