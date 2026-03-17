"use client";

import { useEffect, useState } from 'react';
import { Editor } from '@tiptap/react';

interface SuggestionsProps {
  editor: Editor | null;
}

const COMMON_LOCATION_PREFIXES = ['INT. ', 'EXT. ', 'INT./EXT. ', 'I/E. '];
const COMMON_TIMES = [' - DAY', ' - NIGHT', ' - CONTINUOUS', ' - LATER', ' - MOMENTS LATER'];

export default function Suggestions({ editor }: SuggestionsProps) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [items, setItems] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!editor) return;

    const updateSuggestions = () => {
      const { state, view } = editor;
      const { selection } = state;
      if (!selection.empty) {
        setShow(false);
        return;
      }

      const $pos = selection.$from;
      const node = $pos.parent;
      const nodeType = node.type.name;
      const text = node.textContent.toUpperCase();

      // Dynamically extract characters and locations from document
      const docChars = new Set<string>();
      const docLocs = new Set<string>();
      
      editor.state.doc.descendants((n) => {
        const nText = n.textContent?.trim().toUpperCase();
        if (!nText) return;
        if (n.type.name === 'character') docChars.add(nText);
        if (n.type.name === 'sceneHeading') docLocs.add(nText);
      });

      let newItems: string[] = [];

      if (nodeType === 'sceneHeading') {
        if (text.length === 0 || text === 'I' || text === 'E') {
          newItems = COMMON_LOCATION_PREFIXES.filter(l => l.startsWith(text));
        } else if (text.includes('- ') === false && text.length > 5) {
            newItems = COMMON_TIMES;
        } else if (text.length > 3 && !text.includes('- ')) {
            // Suggest existing locations that match the typed text
            const existingLocations = Array.from(docLocs).filter(l => l !== text && l.startsWith(text));
            if (existingLocations.length > 0) newItems = existingLocations;
        }
      } else if (nodeType === 'character') {
        if (text.length > 0) {
          newItems = Array.from(docChars).filter(c => c.startsWith(text) && c !== text);
        }
      }

      if (newItems.length > 0) {
        const { top, left } = view.coordsAtPos(selection.from);
        setItems(newItems);
        setCoords({ top: top + 20, left });
        setShow(true);
      } else {
        setShow(false);
      }
    };

    editor.on('transaction', updateSuggestions);
    editor.view.dom.addEventListener('keydown', handleKeyDown);

    return () => {
      editor.off('transaction', updateSuggestions);
      editor.view.dom.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!show) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + items.length) % items.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertItem(items[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShow(false);
    }
  };

  const insertItem = (item: string) => {
    if (!editor) return;
    const { state } = editor;
    const { selection } = state;
    const nodeType = selection.$from.parent.type.name;
    const currentText = selection.$from.parent.textContent;

    if (nodeType === 'sceneHeading' && COMMON_TIMES.includes(item)) {
        editor.chain().focus().insertContent(item).run();
    } else {
        editor.chain().focus().deleteRange({ from: selection.from - currentText.length, to: selection.from }).insertContent(item).run();
    }
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
        minWidth: '150px',
        fontFamily: 'var(--font-ui)',
        fontSize: '14px',
      }}
    >
      {items.map((item, i) => (
        <div
          key={item}
          onClick={() => insertItem(item)}
          style={{
            padding: '8px 12px',
            background: i === selectedIndex ? '#3b82f6' : 'transparent',
            color: i === selectedIndex ? '#fff' : '#000',
            cursor: 'pointer',
          }}
        >
          {item}
        </div>
      ))}
    </div>
  );
}
