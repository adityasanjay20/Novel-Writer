import React, { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, Strikethrough, Pilcrow, Heading1, Heading2, List, ListOrdered } from 'lucide-react';

// src/TiptapEditor.tsx

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null;
  }

  const menuButtonClass = "p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700";
  const activeMenuButtonClass = "bg-gray-300 dark:bg-gray-600";

  return (
    <div className="p-2 border-b dark:border-gray-700 flex flex-wrap items-center gap-1">
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={`${menuButtonClass} ${editor.isActive('bold') ? activeMenuButtonClass : ''}`} title="Bold">
        <Bold size={18} />
      </button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`${menuButtonClass} ${editor.isActive('italic') ? activeMenuButtonClass : ''}`} title="Italic">
        <Italic size={18} />
      </button>
      <button onClick={() => editor.chain().focus().toggleStrike().run()} className={`${menuButtonClass} ${editor.isActive('strike') ? activeMenuButtonClass : ''}`} title="Strikethrough">
        <Strikethrough size={18} />
      </button>
      <div className="w-[1px] h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
      <button onClick={() => editor.chain().focus().setParagraph().run()} className={`${menuButtonClass} ${editor.isActive('paragraph') ? activeMenuButtonClass : ''}`} title="Paragraph">
        <Pilcrow size={18} />
      </button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`${menuButtonClass} ${editor.isActive('heading', { level: 1 }) ? activeMenuButtonClass : ''}`} title="Heading 1">
        <Heading1 size={18} />
      </button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`${menuButtonClass} ${editor.isActive('heading', { level: 2 }) ? activeMenuButtonClass : ''}`} title="Heading 2">
        <Heading2 size={18} />
      </button>
      <div className="w-[1px] h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`${menuButtonClass} ${editor.isActive('bulletList') ? activeMenuButtonClass : ''}`} title="Bullet List">
        <List size={18} />
      </button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`${menuButtonClass} ${editor.isActive('orderedList') ? activeMenuButtonClass : ''}`} title="Ordered List">
        <ListOrdered size={18} />
      </button>
    </div>
  );
};

interface TiptapEditorProps {
  content: string;
  onChange: (newContent: string) => void;
  disabled: boolean;
}

const TiptapEditor: React.FC<TiptapEditorProps> = ({ content, onChange, disabled }) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: content,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Effect to update editor content when the scene changes
  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.getHTML() !== content) {
        editor.commands.setContent(content);
    }
  }, [content, editor]);
  
  // Effect to update editable status
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
        editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800">
      <MenuBar editor={editor} />
      <EditorContent editor={editor} className="tiptap flex-grow overflow-y-auto p-8 focus:outline-none" />
    </div>
  );
};

export default TiptapEditor;