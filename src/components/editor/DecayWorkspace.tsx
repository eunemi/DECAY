import React, { useState } from 'react';
import { LeftToolDock } from './LeftToolDock';
import { RichTextEditor } from './RichTextEditor';
import { DrawingOverlay } from './DrawingOverlay';
import { useEditorStore } from './store';
import { Note } from '../../types';

interface DecayWorkspaceProps {
  note: Note;
  onSave: (note: Note) => void;
  onClose: () => void;
}

export const DecayWorkspace: React.FC<DecayWorkspaceProps> = ({ note, onSave, onClose }) => {
  const { isFocusMode, toggleFocusMode } = useEditorStore();
  const [title, setTitle] = useState(note.title);

  const handleContentChange = (content: string) => {
    onSave({ ...note, content, title });
  };

  const handleTitleBlur = () => {
    if (title !== note.title) {
      onSave({ ...note, title });
    }
  };

  return (
    <>
      <div className="note-detail-atmosphere" aria-hidden="true" />
      
      {!isFocusMode && (
        <header className="note-detail-topbar" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40 }}>
          <button className="note-detail-back" type="button" onClick={onClose}>BACK</button>
          <div className="note-detail-brand">MEMENTO</div>
          <div className="note-detail-actions">
            <button className="note-detail-action" onClick={toggleFocusMode} type="button">FOCUS</button>
            <button className="note-detail-action note-detail-action--outline" type="button">REINFORCE</button>
            <button className="note-detail-action" type="button">SYNC</button>
            <button className="note-detail-action" type="button">DELETE</button>
          </div>
        </header>
      )}

      <main className="note-detail-canvas" style={{ paddingTop: isFocusMode ? 40 : 120 }}>
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <LeftToolDock />
          
          <div 
            style={{ 
              position: 'relative', 
              width: '100%',
              maxWidth: 720, 
              margin: '0 auto',
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div className="note-detail-header" style={{ opacity: isFocusMode ? 0.3 : 1, transition: 'opacity 0.3s' }}>
              <input
                className="note-detail-title"
                style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', letterSpacing: 'inherit' }}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                placeholder="Untitled"
              />
              <div className="note-detail-meta">
                <span className="note-detail-status note-detail-status--active">STATUS: {note.status.toUpperCase()}</span>
              </div>
            </div>

            <div style={{ position: 'relative', flex: 1, marginTop: 24, zIndex: 10 }}>
              <RichTextEditor initialContent={note.content} onChange={handleContentChange} />
              <DrawingOverlay />
            </div>
          </div>
          
          {/* Right margin contextual widgets placeholder */}
          {!isFocusMode && (
            <div 
              className="contextual-panel"
              style={{
                position: 'absolute',
                right: -240,
                top: 100,
                width: 220,
                display: 'flex',
                flexDirection: 'column',
                gap: 16
              }}
            >
              {/* Example Summary Widget */}
              <div style={{
                padding: 16,
                background: 'rgba(255,255,255,0.02)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 12,
                color: 'rgba(255,255,255,0.6)',
                fontSize: 12
              }}>
                <div style={{ fontWeight: 600, color: '#fff', marginBottom: 8, letterSpacing: '0.05em' }}>SUMMARY</div>
                <div>AI generated summary of this note will appear here as you type.</div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
};
