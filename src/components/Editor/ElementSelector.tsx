"use client";

import { useEffect, useState } from 'react';
import { Editor } from '@tiptap/react';

interface ElementSelectorProps {
  editor: Editor | null;
}

const ELEMENTS = [
  { label: 'Scene Heading', type: 'sceneHeading', shortcut: 'S' },
  { label: 'Action', type: 'action', shortcut: 'A' },
  { label: 'Character', type: 'character', shortcut: 'C' },
  { label: 'Parenthetical', type: 'parenthetical', shortcut: 'P' },
  { label: 'Dialogue', type: 'dialogue', shortcut: 'D' },
  { label: 'Transition', type: 'transition', shortcut: 'T' },
];

export default function ElementSelector({ editor }: ElementSelectorProps) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(1);

  useEffect(() => {
    if (!editor) return;

    const handleShow = (e: any) => {
      const { view, state } = editor;
      const { selection } = state;
      const { bottom, left } = view.coordsAtPos(selection.from);
      
      const suggestedType = e.detail?.suggestedType || 'action';
      const defaultIndex = ELEMENTS.findIndex(el => el.type === suggestedType);

      setCoords({ top: bottom + 5, left });
      setSelectedIndex(defaultIndex >= 0 ? defaultIndex : 1); 
      setShow(true);
    };

    window.addEventListener('showElementSelector', handleShow);
    return () => window.removeEventListener('showElementSelector', handleShow);
  }, [editor]);

  useEffect(() => {
    if (!show || !editor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev + 1) % ELEMENTS.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev - 1 + ELEMENTS.length) % ELEMENTS.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        insertElement(ELEMENTS[selectedIndex].type);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShow(false);
        editor.commands.focus();
      } else {
        // Attempt quick select via shortcut keys
        const match = ELEMENTS.find(el => el.shortcut.toLowerCase() === e.key.toLowerCase());
        if (match) {
            e.preventDefault();
            e.stopPropagation();
            insertElement(match.type);
        } else {
            // Typing normal letters should just dismiss it and let the text go to the editor
            setShow(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [show, selectedIndex, editor]);

  const insertElement = (type: string) => {
    if (!editor) return;
    editor.chain().focus().setNode(type).run();
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        background: '#fff',
        border: '1px solid #ccc',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        zIndex: 1000,
        color: '#000',
        minWidth: '200px',
        fontFamily: 'var(--font-ui)',
        fontSize: '14px',
        borderRadius: '4px',
        overflow: 'hidden'
      }}
    >
      <div style={{ padding: '6px 12px', background: '#f3f4f6', fontWeight: 'bold', fontSize: '12px', borderBottom: '1px solid #e5e7eb' }}>
        Elements
      </div>
      {ELEMENTS.map((item, i) => (
        <div
          key={item.type}
          onClick={() => insertElement(item.type)}
          onMouseEnter={() => setSelectedIndex(i)}
          style={{
            padding: '8px 12px',
            background: i === selectedIndex ? '#3b82f6' : 'transparent',
            color: i === selectedIndex ? '#fff' : '#000',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between'
          }}
        >
          <span>{item.label}</span>
          <span style={{ opacity: 0.5 }}>[{item.shortcut}]</span>
        </div>
      ))}
    </div>
  );
}
