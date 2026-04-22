import { Note, RecallResult, ScoreResponse } from './types';
import { recallSuccess } from './decayEngine';

let countdownInterval: number | null = null;
let modalElement: HTMLElement | null = null;

const FONT_STACK = "'JetBrains Mono', 'Fira Code', monospace";
const CIRCUMFERENCE = 2 * Math.PI * 34; // ≈ 213.6

let resolveModal: ((result: RecallResult) => void) | null = null;

export function openRecallModal(note: Note): Promise<RecallResult> {
  return new Promise<RecallResult>((resolve) => {
    resolveModal = resolve;

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
    card.style.maxWidth = '520px';
    card.style.width = '90%';
    card.style.backgroundColor = '#0f0f0f';
    card.style.border = '1px solid rgba(255,255,255,0.1)';
    card.style.borderRadius = '16px';
    card.style.padding = '32px';
    card.style.color = 'rgba(255,255,255,0.85)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '20px';
    card.dataset.role = 'recall-card';

    // --- Header ---
    const header = document.createElement('div');
    header.style.textAlign = 'center';

    const h2 = document.createElement('h2');
    h2.textContent = 'Fight for this note';
    h2.style.margin = '0 0 8px 0';
    h2.style.fontSize = '20px';
    h2.style.fontWeight = '600';
    h2.style.fontFamily = FONT_STACK;
    h2.style.color = 'rgba(255,255,255,0.85)';

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Explain it in your own words. You have 60 seconds.';
    subtitle.style.margin = '0';
    subtitle.style.fontSize = '13px';
    subtitle.style.color = 'rgba(255,255,255,0.4)';
    subtitle.style.fontFamily = FONT_STACK;

    header.appendChild(h2);
    header.appendChild(subtitle);

    // --- SVG Timer ---
    const timerWrap = document.createElement('div');
    timerWrap.style.display = 'flex';
    timerWrap.style.justifyContent = 'center';

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '80');
    svg.setAttribute('height', '80');
    svg.setAttribute('viewBox', '0 0 80 80');

    const bgCircle = document.createElementNS(svgNS, 'circle');
    bgCircle.setAttribute('cx', '40');
    bgCircle.setAttribute('cy', '40');
    bgCircle.setAttribute('r', '34');
    bgCircle.setAttribute('fill', 'none');
    bgCircle.setAttribute('stroke', 'rgba(255,255,255,0.1)');
    bgCircle.setAttribute('stroke-width', '4');

    const progressCircle = document.createElementNS(svgNS, 'circle');
    progressCircle.setAttribute('cx', '40');
    progressCircle.setAttribute('cy', '40');
    progressCircle.setAttribute('r', '34');
    progressCircle.setAttribute('fill', 'none');
    progressCircle.setAttribute('stroke', '#22c55e');
    progressCircle.setAttribute('stroke-width', '4');
    progressCircle.setAttribute('stroke-dasharray', CIRCUMFERENCE.toString());
    progressCircle.setAttribute('stroke-dashoffset', '0');
    progressCircle.setAttribute('stroke-linecap', 'round');
    progressCircle.setAttribute('transform', 'rotate(-90 40 40)');
    progressCircle.style.transition = 'stroke-dashoffset 1s linear, stroke 0.5s ease';

    const timerText = document.createElementNS(svgNS, 'text');
    timerText.setAttribute('x', '40');
    timerText.setAttribute('y', '40');
    timerText.setAttribute('text-anchor', 'middle');
    timerText.setAttribute('dominant-baseline', 'central');
    timerText.setAttribute('fill', 'rgba(255,255,255,0.85)');
    timerText.setAttribute('font-size', '18');
    timerText.setAttribute('font-family', FONT_STACK);
    timerText.textContent = '60';

    svg.appendChild(bgCircle);
    svg.appendChild(progressCircle);
    svg.appendChild(timerText);
    timerWrap.appendChild(svg);

    // --- Note title ---
    const titleDisplay = document.createElement('div');
    titleDisplay.style.textAlign = 'center';
    titleDisplay.style.fontSize = '15px';
    titleDisplay.style.fontWeight = '500';
    titleDisplay.style.color = 'rgba(255,255,255,0.6)';
    titleDisplay.style.fontFamily = FONT_STACK;
    titleDisplay.style.padding = '8px 12px';
    titleDisplay.style.backgroundColor = 'rgba(255,255,255,0.04)';
    titleDisplay.style.borderRadius = '8px';
    titleDisplay.textContent = note.title;

    // --- Textarea ---
    const textarea = document.createElement('textarea');
    textarea.placeholder = 'What was this note about? Explain it as if teaching someone...';
    textarea.style.width = '100%';
    textarea.style.minHeight = '120px';
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
    charCount.textContent = '0 / 50 minimum';

    // --- Footer ---
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.gap = '12px';
    footer.style.justifyContent = 'flex-end';

    const giveUpBtn = document.createElement('button');
    giveUpBtn.textContent = 'Give up';
    giveUpBtn.style.padding = '10px 20px';
    giveUpBtn.style.backgroundColor = 'transparent';
    giveUpBtn.style.border = '1px solid rgba(255,255,255,0.1)';
    giveUpBtn.style.borderRadius = '8px';
    giveUpBtn.style.color = 'rgba(255,255,255,0.4)';
    giveUpBtn.style.cursor = 'pointer';
    giveUpBtn.style.fontSize = '13px';
    giveUpBtn.style.fontFamily = FONT_STACK;

    const submitBtn = document.createElement('button');
    submitBtn.textContent = 'Submit';
    submitBtn.disabled = true;
    submitBtn.style.padding = '10px 24px';
    submitBtn.style.backgroundColor = '#22c55e';
    submitBtn.style.border = 'none';
    submitBtn.style.borderRadius = '8px';
    submitBtn.style.color = '#000';
    submitBtn.style.cursor = 'pointer';
    submitBtn.style.fontSize = '13px';
    submitBtn.style.fontWeight = '600';
    submitBtn.style.fontFamily = FONT_STACK;
    submitBtn.style.opacity = '0.4';

    footer.appendChild(giveUpBtn);
    footer.appendChild(submitBtn);

    // --- Assemble card ---
    card.appendChild(header);
    card.appendChild(timerWrap);
    card.appendChild(titleDisplay);
    card.appendChild(textarea);
    card.appendChild(charCount);
    card.appendChild(footer);
    overlay.appendChild(card);

    document.body.appendChild(overlay);
    modalElement = overlay;
    textarea.focus();

    // --- Textarea input handler ---
    textarea.addEventListener('input', () => {
      const len = textarea.value.length;
      charCount.textContent = `${len} / 50 minimum`;

      if (len >= 50) {
        charCount.style.color = '#22c55e';
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
      } else {
        charCount.style.color = 'rgba(255,255,255,0.3)';
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.4';
      }
    });

    // --- Countdown ---
    startCountdown(progressCircle, timerText, () => {
      // Time expired — auto-submit if enough text, otherwise fail
      if (textarea.value.length >= 50) {
        submitBtn.click();
      } else {
        closeRecallModal();
        if (resolveModal) {
          resolveModal({ success: false, score: 0, userText: textarea.value });
          resolveModal = null;
        }
      }
    });

    // --- Submit handler ---
    submitBtn.addEventListener('click', async () => {
      if (countdownInterval !== null) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }

      submitBtn.textContent = 'Scoring...';
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.6';
      giveUpBtn.style.display = 'none';
      textarea.disabled = true;

      try {
        const response = await scoreRecall(note.content, textarea.value);
        const success = response.score >= 0.6;

        if (success) {
          await recallSuccess(note.id);
        }

        showResult(success, response.score, response.feedback);

        if (resolveModal) {
          resolveModal({
            success,
            score: response.score,
            userText: textarea.value
          });
          resolveModal = null;
        }
      } catch (_err) {
        showResult(false, 0, 'Failed to score recall. Please try again.');
        if (resolveModal) {
          resolveModal({ success: false, score: 0, userText: textarea.value });
          resolveModal = null;
        }
      }
    });

    // --- Give up handler ---
    giveUpBtn.addEventListener('click', () => {
      closeRecallModal();
      if (resolveModal) {
        resolveModal({ success: false, score: 0, userText: '' });
        resolveModal = null;
      }
    });
  });
}

function startCountdown(
  progressCircle: SVGCircleElement,
  timerText: SVGTextElement,
  onExpire: () => void
): void {
  let secondsLeft = 60;

  countdownInterval = window.setInterval(() => {
    secondsLeft--;

    timerText.textContent = secondsLeft.toString();

    const offset = CIRCUMFERENCE * (1 - secondsLeft / 60);
    progressCircle.setAttribute('stroke-dashoffset', offset.toString());

    if (secondsLeft > 30) {
      progressCircle.setAttribute('stroke', '#22c55e');
    } else if (secondsLeft > 10) {
      progressCircle.setAttribute('stroke', '#f59e0b');
    } else {
      progressCircle.setAttribute('stroke', '#ef4444');
    }

    if (secondsLeft <= 0) {
      if (countdownInterval !== null) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      onExpire();
    }
  }, 1000);
}

async function scoreRecall(originalContent: string, userRecallText: string): Promise<ScoreResponse> {
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
      max_tokens: 200,
      system: 'You are evaluating a memory recall attempt. Score from 0.0 to 1.0 how well the user recalled the key concepts and meaning of the original note. Do not penalize for different wording — reward understanding. Return ONLY valid JSON, no markdown: { "score": number, "feedback": string }',
      messages: [{
        role: 'user',
        content: `Original note:\n${originalContent}\n\nUser's recall:\n${userRecallText}`
      }]
    })
  });

  const data = await response.json();
  const text: string = data.content[0].text;
  const parsed: ScoreResponse = JSON.parse(text);
  return parsed;
}

function showResult(success: boolean, score: number, feedback: string): void {
  if (!modalElement) return;

  const card = modalElement.querySelector('[data-role="recall-card"]') as HTMLElement;
  if (!card) return;

  card.innerHTML = '';

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
    icon.textContent = '!';
    icon.style.color = '#f59e0b';
  }

  // Headline
  const headline = document.createElement('div');
  headline.style.fontSize = '16px';
  headline.style.fontWeight = '600';
  headline.style.color = 'rgba(255,255,255,0.85)';
  headline.style.fontFamily = FONT_STACK;

  if (success) {
    headline.textContent = 'Note saved! Decay rate slowed by 50%.';
  } else {
    headline.textContent = 'This note will continue to fade.';
  }

  // Score
  const scoreDisplay = document.createElement('div');
  scoreDisplay.style.fontSize = '24px';
  scoreDisplay.style.fontWeight = '700';
  scoreDisplay.style.color = success ? '#22c55e' : '#f59e0b';
  scoreDisplay.style.fontFamily = FONT_STACK;
  scoreDisplay.textContent = `Score: ${Math.round(score * 100)}%`;

  // Feedback
  const feedbackEl = document.createElement('p');
  feedbackEl.style.fontSize = '13px';
  feedbackEl.style.color = 'rgba(255,255,255,0.4)';
  feedbackEl.style.margin = '0';
  feedbackEl.style.lineHeight = '1.6';
  feedbackEl.style.fontFamily = FONT_STACK;
  feedbackEl.textContent = feedback;

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.marginTop = '8px';
  closeBtn.style.padding = '10px 32px';
  closeBtn.style.backgroundColor = 'rgba(255,255,255,0.06)';
  closeBtn.style.border = '1px solid rgba(255,255,255,0.1)';
  closeBtn.style.borderRadius = '8px';
  closeBtn.style.color = 'rgba(255,255,255,0.6)';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.fontSize = '13px';
  closeBtn.style.fontFamily = FONT_STACK;
  closeBtn.addEventListener('click', () => closeRecallModal());

  wrapper.appendChild(icon);
  wrapper.appendChild(headline);
  wrapper.appendChild(scoreDisplay);
  wrapper.appendChild(feedbackEl);
  wrapper.appendChild(closeBtn);
  card.appendChild(wrapper);
}

export function closeRecallModal(): void {
  if (countdownInterval !== null) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  if (modalElement) {
    modalElement.remove();
    modalElement = null;
  }
}
