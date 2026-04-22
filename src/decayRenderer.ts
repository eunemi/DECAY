// Visual decay rendering — per-character opacity dissolution

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export function renderDecayedText(container: HTMLElement, text: string, opacity: number): void {
  container.innerHTML = '';

  for (const char of text) {
    if (char === '\n') {
      container.appendChild(document.createElement('br'));
      continue;
    }

    const charOpacity = clamp(opacity + (Math.random() * 0.15 - 0.075), 0, 1);
    const span = document.createElement('span');
    span.className = 'decay-char';
    span.style.opacity = charOpacity.toString();
    span.textContent = char;
    container.appendChild(span);
  }
}

export function updateDecayedText(container: HTMLElement, opacity: number): void {
  const spans = container.querySelectorAll<HTMLSpanElement>('.decay-char');

  requestAnimationFrame(() => {
    spans.forEach((span) => {
      const charOpacity = clamp(opacity + (Math.random() * 0.15 - 0.075), 0, 1);
      span.style.opacity = charOpacity.toString();
    });
  });
}

export function startDecayAnimation(
  container: HTMLElement,
  fromOpacity: number,
  toOpacity: number,
  durationMs: number
): Promise<void> {
  return new Promise((resolve) => {
    const startTime = performance.now();

    function tick(now: number): void {
      const elapsed = now - startTime;

      if (elapsed >= durationMs) {
        updateDecayedText(container, toOpacity);
        resolve();
        return;
      }

      const currentOpacity = fromOpacity + (toOpacity - fromOpacity) * (elapsed / durationMs);
      updateDecayedText(container, currentOpacity);
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  });
}

export function renderGhostSilhouette(container: HTMLElement, text: string): void {
  container.innerHTML = '';
  container.classList.add('ghost-silhouette');

  for (const char of text) {
    if (char === '\n') {
      container.appendChild(document.createElement('br'));
      continue;
    }

    const span = document.createElement('span');
    span.className = 'decay-char';
    span.style.opacity = '0.04';
    span.textContent = char;
    container.appendChild(span);
  }
}

export function clearRenderer(container: HTMLElement): void {
  container.innerHTML = '';
  container.classList.remove('ghost-silhouette');
}
