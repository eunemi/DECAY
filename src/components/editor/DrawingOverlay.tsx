import React from 'react';
import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import { useEditorStore } from './store';

export const DrawingOverlay: React.FC = () => {
  const { isDrawMode } = useEditorStore();

  return (
    <div
      className={isDrawMode ? 'drawing-mode-active' : 'drawing-mode-inactive'}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 20,
        pointerEvents: isDrawMode ? 'auto' : 'none',
      }}
    >
      <style>{`
        /* Aggressively strip background from Tldraw */
        .tl-container,
        .tl-canvas,
        .tl-background,
        .tl-ui-layout,
        .tl-glass,
        div[class^="tl-"], 
        div[class*=" tl-"] {
          background: transparent !important;
          background-color: transparent !important;
          --color-background: transparent !important;
        }

        /* Force pointer events NONE when inactive */
        .drawing-mode-inactive,
        .drawing-mode-inactive .tl-container,
        .drawing-mode-inactive .tl-canvas,
        .drawing-mode-inactive * {
          pointer-events: none !important;
        }

        /* Hide the watermark to prevent it from blocking text */
        .tl-watermark_logo, 
        .tl-watermark,
        [class*="watermark"] {
          display: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `}</style>
      <Tldraw
        hideUi
        inferDarkMode
      />
    </div>
  );
};
