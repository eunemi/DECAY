import React from 'react';
import { Pencil, Highlighter, Square, Circle, Eraser, Image as ImageIcon } from 'lucide-react';
import { useEditorStore } from './store';
import { motion, AnimatePresence } from 'framer-motion';

export const LeftToolDock: React.FC = () => {
  const { isDrawMode, isFocusMode, toggleDrawMode } = useEditorStore();

  return (
    <AnimatePresence>
      {!isFocusMode && (
        <motion.div
          initial={{ opacity: 0, x: -20, y: '-50%' }}
          animate={{ opacity: 1, x: 0, y: '-50%' }}
          exit={{ opacity: 0, x: -20, y: '-50%' }}
          style={{
            position: 'fixed',
            left: 24,
            top: '50%',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            padding: '16px 8px',
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: 24,
            zIndex: 30,
          }}
        >
          <ToolButton icon={<Pencil size={18} />} active={isDrawMode} onClick={toggleDrawMode} title="Draw (Layer 2)" />
          <ToolButton icon={<Highlighter size={18} />} onClick={() => {}} title="Highlight" />
          <ToolButton icon={<Square size={18} />} onClick={() => {}} title="Rectangle" />
          <ToolButton icon={<Circle size={18} />} onClick={() => {}} title="Circle" />
          <ToolButton icon={<Eraser size={18} />} onClick={() => {}} title="Eraser" />
          <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
          <ToolButton icon={<ImageIcon size={18} />} onClick={() => {}} title="Insert Media" />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const ToolButton = ({ icon, active, onClick, title }: { icon: React.ReactNode, active?: boolean, onClick: () => void, title: string }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      background: active ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
      color: active ? '#fff' : 'rgba(255, 255, 255, 0.5)',
      border: 'none',
      borderRadius: '50%',
      width: 36,
      height: 36,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s',
    }}
    onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
    onMouseLeave={(e) => (e.currentTarget.style.color = active ? '#fff' : 'rgba(255, 255, 255, 0.5)')}
  >
    {icon}
  </button>
);
