import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, Strikethrough, Code } from 'lucide-react';

interface RichTextEditorProps {
  initialContent: string;
  onChange: (content: string) => void;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ initialContent, onChange }) => {
  const [mounted, setMounted] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[70vh] max-w-[920px] mx-auto prose-p:my-1 prose-p:leading-snug prose-headings:my-3 prose-ul:my-1 prose-li:my-0',
      },
    },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!editor || !mounted) {
    return null;
  }

  return (
    <div className="rich-text-editor-container" style={{ position: 'relative', zIndex: 10, minHeight: '70vh' }}>
      {/* Floating Toolbar (BubbleMenu) */}
      {/* @ts-expect-error tippyOptions typing mismatch in current TipTap types */}
      <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '6px',
          background: 'rgba(20, 20, 20, 0.8)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
        }}>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            style={{ padding: '6px', color: editor.isActive('bold') ? '#fff' : 'rgba(255,255,255,0.6)', borderRadius: '4px', background: editor.isActive('bold') ? 'rgba(255,255,255,0.1)' : 'transparent' }}
          >
            <Bold size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            style={{ padding: '6px', color: editor.isActive('italic') ? '#fff' : 'rgba(255,255,255,0.6)', borderRadius: '4px', background: editor.isActive('italic') ? 'rgba(255,255,255,0.1)' : 'transparent' }}
          >
            <Italic size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            style={{ padding: '6px', color: editor.isActive('strike') ? '#fff' : 'rgba(255,255,255,0.6)', borderRadius: '4px', background: editor.isActive('strike') ? 'rgba(255,255,255,0.1)' : 'transparent' }}
          >
            <Strikethrough size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCode().run()}
            style={{ padding: '6px', color: editor.isActive('code') ? '#fff' : 'rgba(255,255,255,0.6)', borderRadius: '4px', background: editor.isActive('code') ? 'rgba(255,255,255,0.1)' : 'transparent' }}
          >
            <Code size={16} />
          </button>
        </div>
      </BubbleMenu>

      {/* Slash Commands Stub (FloatingMenu) */}
      {/* @ts-expect-error tippyOptions typing mismatch in current TipTap types */}
      <FloatingMenu editor={editor} tippyOptions={{ duration: 100 }}>
        <div style={{
          padding: '6px',
          background: 'rgba(20, 20, 20, 0.8)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: '12px'
        }}>
          Type / for commands
        </div>
      </FloatingMenu>

      <EditorContent editor={editor} />
    </div>
  );
};
