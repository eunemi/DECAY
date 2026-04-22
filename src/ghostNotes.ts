import { Note, ReconstructResult, ReconstructScoreResponse } from './types';
import { createNote } from './decayEngine';
import { renderGhostSilhouette } from './decayRenderer';
import { getAllNotes, saveNote, deleteNote } from './db';

const FONT_STACK = "'JetBrains Mono', 'Fira Code', monospace";

let activeModal: HTMLElement | null = null;

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function renderGhostCard(note: Note): HTMLElement {
  const card = document.createElement('div');
  card.className = 'ghost-card';

  const title = document.createElement('div');
  title.className = 'ghost-title';
  title.textContent = note.title;

  const body = document.createElement('div');
  body.className = 'ghost-body';
  renderGhostSilhouette(body, note.content);

  const meta = document.createElement('div');
  meta.className = 'ghost-meta';
  meta.textContent = `Created: ${formatDate(note.createdAt)}`;

  const label = document.createElement('div');
  label.className = 'ghost-label';
  label.textContent = 'Memory lost — reconstruct to recover';

  card.appendChild(title);
  card.appendChild(body);
  card.appendChild(meta);
  card.appendChild(label);

  card.addEventListener('click', () => {
    openReconstructModal(note);
  });

  return card;
}

export async function renderGhostList(container: HTMLElement): Promise<void> {
  const allNotes = await getAllNotes();
  const ghosts = allNotes.filter((n) => n.status === 'ghost');

  container.innerHTML = '';

  for (const ghost of ghosts) {
    const card = renderGhostCard(ghost);
    container.appendChild(card);
  }
}

export function openReconstructModal(note: Note): Promise<ReconstructResult> {
  return new Promise<ReconstructResult>((resolve) => {
    // --- Overlay ---
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.85)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.fontFamily = FONT_STACK;

    // --- Card ---
    const card = document.createElement('div');
    card.style.maxWidth = '560px';
    card.style.width = '90%';
    card.style.backgroundColor = '#0f0f0f';
    card.style.border = '1px solid rgba(255,255,255,0.1)';
    card.style.borderRadius = '16px';
    card.style.padding = '32px';
    card.style.color = 'rgba(255,255,255,0.85)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '20px';
    card.dataset.role = 'reconstruct-card';

    // --- Header ---
    const header = document.createElement('div');
    header.style.textAlign = 'center';

    const h2 = document.createElement('h2');
    h2.textContent = 'Reconstruct from memory';
    h2.style.margin = '0 0 8px 0';
    h2.style.fontSize = '20px';
    h2.style.fontWeight = '600';
    h2.style.fontFamily = FONT_STACK;
    h2.style.color = 'rgba(255,255,255,0.85)';

    const subtitle = document.createElement('p');
    subtitle.textContent = 'The original is gone. Write what you remember. Your version becomes the note.';
    subtitle.style.margin = '0';
    subtitle.style.fontSize = '13px';
    subtitle.style.color = 'rgba(255,255,255,0.4)';
    subtitle.style.fontFamily = FONT_STACK;

    header.appendChild(h2);
    header.appendChild(subtitle);

    // --- Info section ---
    const info = document.createElement('div');
    info.style.backgroundColor = 'rgba(255,255,255,0.03)';
    info.style.borderRadius = '10px';
    info.style.padding = '16px';
    info.style.display = 'flex';
    info.style.flexDirection = 'column';
    info.style.gap = '8px';

    const infoTitle = document.createElement('div');
    infoTitle.textContent = note.title;
    infoTitle.style.fontSize = '15px';
    infoTitle.style.fontWeight = '500';
    infoTitle.style.color = 'rgba(255,255,255,0.5)';
    infoTitle.style.filter = 'blur(2px)';
    infoTitle.style.fontFamily = FONT_STACK;

    const infoDate = document.createElement('div');
    infoDate.textContent = `Created: ${formatDate(note.createdAt)}`;
    infoDate.style.fontSize = '11px';
    infoDate.style.color = 'rgba(255,255,255,0.25)';
    infoDate.style.fontFamily = FONT_STACK;

    info.appendChild(infoTitle);
    info.appendChild(infoDate);

    if (note.tags.length > 0) {
      const tagsRow = document.createElement('div');
      tagsRow.style.display = 'flex';
      tagsRow.style.flexWrap = 'wrap';
      tagsRow.style.gap = '6px';
      tagsRow.style.marginTop = '4px';

      for (const tag of note.tags) {
        const pill = document.createElement('span');
        pill.textContent = tag;
        pill.style.fontSize = '11px';
        pill.style.padding = '3px 10px';
        pill.style.borderRadius = '99px';
        pill.style.backgroundColor = 'rgba(255,255,255,0.06)';
        pill.style.color = 'rgba(255,255,255,0.3)';
        pill.style.fontFamily = FONT_STACK;
        tagsRow.appendChild(pill);
      }

      info.appendChild(tagsRow);
    }

    // --- Textarea ---
    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Write everything you remember about this note...';
    textarea.style.width = '100%';
    textarea.style.minHeight = '180px';
    textarea.style.resize = 'vertical';
    textarea.style.backgroundColor = 'rgba(255,255,255,0.04)';
    textarea.style.border = '1px solid rgba(255,255,255,0.1)';
    textarea.style.borderRadius = '10px';
    textarea.style.padding = '14px';
    textarea.style.color = 'rgba(255,255,255,0.85)';
    textarea.style.fontSize = '14px';
    textarea.style.fontFamily = FONT_STACK;
    textarea.style.outline = 'none';
    textarea.style.boxSizing = 'border-box';

    // --- Char count ---
    const charCount = document.createElement('div');
    charCount.style.fontSize = '12px';
    charCount.style.color = 'rgba(255,255,255,0.3)';
    charCount.style.textAlign = 'right';
    charCount.style.fontFamily = FONT_STACK;
    charCount.textContent = '0 / 30 minimum';

    // --- Footer ---
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.gap = '12px';
    footer.style.justifyContent = 'flex-end';
    footer.dataset.role = 'reconstruct-footer';

    const letItGoBtn = document.createElement('button');
    letItGoBtn.textContent = 'Let it go';
    letItGoBtn.style.padding = '10px 20px';
    letItGoBtn.style.backgroundColor = 'transparent';
    letItGoBtn.style.border = '1px solid rgba(239,68,68,0.3)';
    letItGoBtn.style.borderRadius = '8px';
    letItGoBtn.style.color = '#ef4444';
    letItGoBtn.style.cursor = 'pointer';
    letItGoBtn.style.fontSize = '13px';
    letItGoBtn.style.fontFamily = FONT_STACK;

    const reconstructBtn = document.createElement('button');
    reconstructBtn.textContent = 'Reconstruct';
    reconstructBtn.disabled = true;
    reconstructBtn.style.padding = '10px 24px';
    reconstructBtn.style.backgroundColor = '#22c55e';
    reconstructBtn.style.border = 'none';
    reconstructBtn.style.borderRadius = '8px';
    reconstructBtn.style.color = '#000';
    reconstructBtn.style.cursor = 'pointer';
    reconstructBtn.style.fontSize = '13px';
    reconstructBtn.style.fontWeight = '600';
    reconstructBtn.style.fontFamily = FONT_STACK;
    reconstructBtn.style.opacity = '0.4';

    footer.appendChild(letItGoBtn);
    footer.appendChild(reconstructBtn);

    // --- Assemble ---
    card.appendChild(header);
    card.appendChild(info);
    card.appendChild(textarea);
    card.appendChild(charCount);
    card.appendChild(footer);
    overlay.appendChild(card);

    document.body.appendChild(overlay);
    activeModal = overlay;
    textarea.focus();

    // --- Textarea input ---
    textarea.addEventListener('input', () => {
      const len = textarea.value.length;
      charCount.textContent = `${len} / 30 minimum`;

      if (len >= 30) {
        charCount.style.color = '#22c55e';
        reconstructBtn.disabled = false;
        reconstructBtn.style.opacity = '1';
      } else {
        charCount.style.color = 'rgba(255,255,255,0.3)';
        reconstructBtn.disabled = true;
        reconstructBtn.style.opacity = '0.4';
      }
    });

    // --- Reconstruct handler ---
    reconstructBtn.addEventListener('click', async () => {
      reconstructBtn.textContent = 'Evaluating...';
      reconstructBtn.disabled = true;
      reconstructBtn.style.opacity = '0.6';
      letItGoBtn.style.display = 'none';
      textarea.disabled = true;

      try {
        const scoreResponse = await evaluateReconstruction(note.content, textarea.value);

        await handleReconstruction(note, textarea.value, scoreResponse, card, textarea, (result) => {
          resolve(result);
        });
      } catch (_err) {
        showResultScreen(card, false, 0, 'Failed to evaluate reconstruction.', [], () => {
          closeModal();
          resolve({ reconstructed: false, newContent: '' });
        }, null);
      }
    });

    // --- Let it go handler ---
    letItGoBtn.addEventListener('click', () => {
      closeModal();
      resolve({ reconstructed: false, newContent: '' });
    });
  });
}

async function evaluateReconstruction(
  originalContent: string,
  userReconstruction: string
): Promise<ReconstructScoreResponse> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: 'You are evaluating a memory reconstruction attempt. Score from 0.0 to 1.0 based on conceptual overlap. Different words are fine; different concepts are not. Return ONLY valid JSON, no markdown: { "score": number, "feedback": string, "preservedConcepts": string[] }',
      messages: [{
        role: 'user',
        content: `Original:\n${originalContent}\n\nReconstruction:\n${userReconstruction}`
      }]
    })
  });

  const data = await response.json();
  const text: string = data.content[0].text;
  return JSON.parse(text) as ReconstructScoreResponse;
}

async function handleReconstruction(
  note: Note,
  userText: string,
  scoreResponse: ReconstructScoreResponse,
  cardEl: HTMLElement,
  textarea: HTMLTextAreaElement,
  onComplete: (result: ReconstructResult) => void
): Promise<void> {
  if (scoreResponse.score >= 0.5) {
    // Success — create new note, override decay rate, delete ghost
    const newNote = await createNote(note.title, userText, note.tags);
    await saveNote({ ...newNote, decayRate: 0.00002 });
    await deleteNote(note.id);

    showResultScreen(
      cardEl,
      true,
      scoreResponse.score,
      scoreResponse.feedback,
      scoreResponse.preservedConcepts,
      () => {
        closeModal();
        onComplete({ reconstructed: true, newContent: userText });
      },
      null
    );
  } else {
    // Partial fail — show preserved concepts, offer retry
    showResultScreen(
      cardEl,
      false,
      scoreResponse.score,
      scoreResponse.feedback,
      scoreResponse.preservedConcepts,
      () => {
        closeModal();
        onComplete({ reconstructed: false, newContent: '' });
      },
      () => {
        // Try again — restore the form
        textarea.value = '';
        textarea.disabled = false;
        restoreForm(cardEl, textarea);
      }
    );
  }
}

function showResultScreen(
  cardEl: HTMLElement,
  success: boolean,
  score: number,
  feedback: string,
  preservedConcepts: string[],
  onClose: () => void,
  onRetry: (() => void) | null
): void {
  cardEl.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.alignItems = 'center';
  wrapper.style.gap = '16px';
  wrapper.style.textAlign = 'center';
  wrapper.style.fontFamily = FONT_STACK;

  // Icon
  const icon = document.createElement('div');
  icon.style.fontSize = '48px';
  icon.style.lineHeight = '1';

  if (success) {
    icon.textContent = '✓';
    icon.style.color = '#22c55e';
  } else {
    icon.textContent = '✗';
    icon.style.color = '#f59e0b';
  }

  // Headline
  const headline = document.createElement('div');
  headline.style.fontSize = '16px';
  headline.style.fontWeight = '600';
  headline.style.color = 'rgba(255,255,255,0.85)';
  headline.style.fontFamily = FONT_STACK;

  if (success) {
    headline.textContent = 'Note reborn from memory.';
  } else {
    headline.textContent = 'Not quite there yet.';
  }

  // Sub-headline
  const subheadline = document.createElement('div');
  subheadline.style.fontSize = '13px';
  subheadline.style.color = 'rgba(255,255,255,0.4)';
  subheadline.style.fontFamily = FONT_STACK;

  if (success) {
    subheadline.textContent = 'A new note has been created with a much slower decay rate.';
  } else {
    subheadline.textContent = 'Keep trying — the ghost remains until you remember.';
  }

  // Score
  const scoreDisplay = document.createElement('div');
  scoreDisplay.style.fontSize = '24px';
  scoreDisplay.style.fontWeight = '700';
  scoreDisplay.style.color = success ? '#22c55e' : '#f59e0b';
  scoreDisplay.style.fontFamily = FONT_STACK;
  scoreDisplay.textContent = `Score: ${Math.round(score * 100)}%`;

  wrapper.appendChild(icon);
  wrapper.appendChild(headline);
  wrapper.appendChild(subheadline);
  wrapper.appendChild(scoreDisplay);

  // Preserved concepts pills (shown for both, but especially useful on fail)
  if (preservedConcepts.length > 0) {
    const conceptsLabel = document.createElement('div');
    conceptsLabel.style.fontSize = '11px';
    conceptsLabel.style.color = 'rgba(255,255,255,0.3)';
    conceptsLabel.style.fontFamily = FONT_STACK;
    conceptsLabel.textContent = 'Preserved concepts:';

    const pillsRow = document.createElement('div');
    pillsRow.style.display = 'flex';
    pillsRow.style.flexWrap = 'wrap';
    pillsRow.style.gap = '6px';
    pillsRow.style.justifyContent = 'center';

    for (const concept of preservedConcepts) {
      const pill = document.createElement('span');
      pill.textContent = concept;
      pill.style.fontSize = '12px';
      pill.style.padding = '4px 12px';
      pill.style.borderRadius = '99px';
      pill.style.backgroundColor = success
        ? 'rgba(34,197,94,0.12)'
        : 'rgba(245,158,11,0.12)';
      pill.style.color = success ? '#22c55e' : '#f59e0b';
      pill.style.fontFamily = FONT_STACK;
      pillsRow.appendChild(pill);
    }

    wrapper.appendChild(conceptsLabel);
    wrapper.appendChild(pillsRow);
  }

  // Feedback
  const feedbackEl = document.createElement('p');
  feedbackEl.style.fontSize = '13px';
  feedbackEl.style.color = 'rgba(255,255,255,0.4)';
  feedbackEl.style.margin = '0';
  feedbackEl.style.lineHeight = '1.6';
  feedbackEl.style.fontFamily = FONT_STACK;
  feedbackEl.textContent = feedback;
  wrapper.appendChild(feedbackEl);

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '12px';
  btnRow.style.marginTop = '8px';

  if (onRetry) {
    const retryBtn = document.createElement('button');
    retryBtn.textContent = 'Try again';
    retryBtn.style.padding = '10px 24px';
    retryBtn.style.backgroundColor = 'rgba(255,255,255,0.06)';
    retryBtn.style.border = '1px solid rgba(255,255,255,0.1)';
    retryBtn.style.borderRadius = '8px';
    retryBtn.style.color = 'rgba(255,255,255,0.6)';
    retryBtn.style.cursor = 'pointer';
    retryBtn.style.fontSize = '13px';
    retryBtn.style.fontFamily = FONT_STACK;
    retryBtn.addEventListener('click', onRetry);
    btnRow.appendChild(retryBtn);
  }

  const closeBtn = document.createElement('button');
  closeBtn.textContent = success ? 'Close' : 'Give up';
  closeBtn.style.padding = '10px 24px';
  closeBtn.style.backgroundColor = success ? '#22c55e' : 'transparent';
  closeBtn.style.border = success ? 'none' : '1px solid rgba(239,68,68,0.3)';
  closeBtn.style.borderRadius = '8px';
  closeBtn.style.color = success ? '#000' : '#ef4444';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.fontSize = '13px';
  closeBtn.style.fontWeight = '600';
  closeBtn.style.fontFamily = FONT_STACK;
  closeBtn.addEventListener('click', onClose);
  btnRow.appendChild(closeBtn);

  wrapper.appendChild(btnRow);
  cardEl.appendChild(wrapper);
}

function restoreForm(cardEl: HTMLElement, textarea: HTMLTextAreaElement): void {
  cardEl.innerHTML = '';

  // Rebuild header
  const header = document.createElement('div');
  header.style.textAlign = 'center';

  const h2 = document.createElement('h2');
  h2.textContent = 'Try again';
  h2.style.margin = '0 0 8px 0';
  h2.style.fontSize = '20px';
  h2.style.fontWeight = '600';
  h2.style.fontFamily = FONT_STACK;
  h2.style.color = 'rgba(255,255,255,0.85)';

  const subtitle = document.createElement('p');
  subtitle.textContent = 'The ghost remains. Write what you remember.';
  subtitle.style.margin = '0';
  subtitle.style.fontSize = '13px';
  subtitle.style.color = 'rgba(255,255,255,0.4)';
  subtitle.style.fontFamily = FONT_STACK;

  header.appendChild(h2);
  header.appendChild(subtitle);

  // Char count
  const charCount = document.createElement('div');
  charCount.style.fontSize = '12px';
  charCount.style.color = 'rgba(255,255,255,0.3)';
  charCount.style.textAlign = 'right';
  charCount.style.fontFamily = FONT_STACK;
  charCount.textContent = '0 / 30 minimum';

  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    charCount.textContent = `${len} / 30 minimum`;
    charCount.style.color = len >= 30 ? '#22c55e' : 'rgba(255,255,255,0.3)';
  });

  cardEl.appendChild(header);
  cardEl.appendChild(textarea);
  cardEl.appendChild(charCount);
  textarea.focus();
}

function closeModal(): void {
  if (activeModal) {
    activeModal.remove();
    activeModal = null;
  }
}

export function handleLetItGo(noteId: string, cardElement: HTMLElement): void {
  const label = cardElement.querySelector('.ghost-label');
  if (!label) return;

  const originalText = label.textContent;

  label.textContent = '';

  const confirmWrap = document.createElement('div');
  confirmWrap.style.display = 'flex';
  confirmWrap.style.flexDirection = 'column';
  confirmWrap.style.gap = '8px';
  confirmWrap.style.fontFamily = FONT_STACK;

  const confirmText = document.createElement('div');
  confirmText.textContent = 'Are you sure? This note will be gone forever.';
  confirmText.style.fontSize = '11px';
  confirmText.style.color = '#ef4444';

  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '8px';

  const yesBtn = document.createElement('button');
  yesBtn.textContent = 'Yes, release it';
  yesBtn.style.padding = '4px 12px';
  yesBtn.style.backgroundColor = 'transparent';
  yesBtn.style.border = '1px solid rgba(239,68,68,0.4)';
  yesBtn.style.borderRadius = '6px';
  yesBtn.style.color = '#ef4444';
  yesBtn.style.cursor = 'pointer';
  yesBtn.style.fontSize = '11px';
  yesBtn.style.fontFamily = FONT_STACK;

  const keepBtn = document.createElement('button');
  keepBtn.textContent = 'Keep ghost';
  keepBtn.style.padding = '4px 12px';
  keepBtn.style.backgroundColor = 'transparent';
  keepBtn.style.border = '1px solid rgba(255,255,255,0.1)';
  keepBtn.style.borderRadius = '6px';
  keepBtn.style.color = 'rgba(255,255,255,0.4)';
  keepBtn.style.cursor = 'pointer';
  keepBtn.style.fontSize = '11px';
  keepBtn.style.fontFamily = FONT_STACK;

  yesBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await deleteNote(noteId);

    cardElement.style.transition = 'opacity 400ms ease';
    cardElement.style.opacity = '0';
    setTimeout(() => {
      cardElement.remove();
    }, 400);
  });

  keepBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    label.textContent = originalText;
  });

  btnRow.appendChild(yesBtn);
  btnRow.appendChild(keepBtn);
  confirmWrap.appendChild(confirmText);
  confirmWrap.appendChild(btnRow);
  label.appendChild(confirmWrap);
}
