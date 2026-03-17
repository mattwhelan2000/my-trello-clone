"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useState } from 'react';
import { Action, SceneHeading, Character, Dialogue, Parenthetical, Transition } from './ScreenplayNodes';
import { ScreenplayShortcuts } from './KeyboardShortcuts';
import { PaginationExtension } from './PaginationExtension';
import Suggestions from './Suggestions';
import Sidebar from '../Sidebar';
import ElementSelector from './ElementSelector';
import Modal from '../Modal';

import { exportToFDX, importFromFDX } from '../../lib/fdxUtils';
import { generatePDF } from '../../lib/pdfUtils';

export default function ScriptEditor() {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({}),
      Action,
      SceneHeading,
      Character,
      Dialogue,
      Parenthetical,
      Transition,
      ScreenplayShortcuts,
      PaginationExtension,
    ],
    content: `
      <p data-type="sceneHeading" class="screenplay-scene-heading">INT. OFFICE - DAY</p>
      <p data-type="action" class="screenplay-action">We start our story here. A writer sits at a desk, typing furiously.</p>
    `,
    editorProps: {
      attributes: { class: 'focus:outline-none' },
    },
  });

  const [showTitlePage, setShowTitlePage] = useState(false);
  const [showCharacterList, setShowCharacterList] = useState(false);
  const [showLocationList, setShowLocationList] = useState(false);
  const [titlePageData, setTitlePageData] = useState({ title: 'UNTITLED SCRIPT', author: 'Author Name' });

  // Get active characters and locations
  const { characters, locations } = (() => {
    const chars = new Set<string>();
    const locs = new Set<string>();
    if (editor) {
      editor.getJSON().content?.forEach((node: any) => {
        const text = node.content?.map((c:any) => c.text).join('') || '';
        if (node.type === 'character' && text.trim()) chars.add(text.toUpperCase());
        if (node.type === 'sceneHeading' && text.trim()) locs.add(text.toUpperCase());
      });
    }
    return { characters: Array.from(chars), locations: Array.from(locs) };
  })();

  if (!editor) return null;

  const handleExportFDX = async () => {
    const xml = await exportToFDX(editor.getJSON());
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Script.fdx';
    a.click();
  };

  const handleImportFDX = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const json = await importFromFDX(text);
    editor.commands.setContent(json);
  };

  const handleExportPDF = () => {
    generatePDF(editor.getJSON());
  };

  const handleExportLists = () => {
    const json = editor.getJSON();
    const characters = new Set<string>();
    const locations = new Set<string>();

    json.content?.forEach((node: any) => {
      const text = node.content?.map((c:any) => c.text).join('') || '';
      if (node.type === 'character' && text.trim()) characters.add(text.toUpperCase());
      if (node.type === 'sceneHeading' && text.trim()) locations.add(text.toUpperCase());
    });

    const report = `SCRIPT REPORTS\n\nCHARACTERS:\n${Array.from(characters).join('\\n')}\n\nLOCATIONS:\n${Array.from(locations).join('\\n')}`;
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Script_Reports.txt';
    a.click();
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Sidebar editor={editor} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#333' }}>
        
        {/* Sticky Top toolbar */}
        <div style={{ width: '100%', display: 'flex', flexShrink: 0, justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', background: '#1a1d24', color: '#fff', zIndex: 50, borderBottom: '1px solid #2a2e38' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold', marginRight: 20 }}>FADEIN WEB</span>
            <button onClick={() => editor.chain().focus().setNode('sceneHeading').run()} className="toolbar-btn">Scene</button>
            <button onClick={() => editor.chain().focus().setNode('action').run()} className="toolbar-btn">Action</button>
            <button onClick={() => editor.chain().focus().setNode('character').run()} className="toolbar-btn">Character</button>
            <button onClick={() => editor.chain().focus().setNode('dialogue').run()} className="toolbar-btn">Dialogue</button>
            <button onClick={() => editor.chain().focus().setNode('parenthetical').run()} className="toolbar-btn">Parenthetical</button>
            <button onClick={() => editor.chain().focus().setNode('transition').run()} className="toolbar-btn">Transition</button>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowTitlePage(true)} style={{ padding: '6px 12px', background: '#3b82f6', borderRadius: 4, color: 'white', border: 'none', cursor: 'pointer' }}>Title Page</button>
            <button onClick={() => setShowCharacterList(true)} style={{ padding: '6px 12px', background: '#4b5563', borderRadius: 4, color: 'white', border: 'none', cursor: 'pointer' }}>Characters</button>
            <button onClick={() => setShowLocationList(true)} style={{ padding: '6px 12px', background: '#4b5563', borderRadius: 4, color: 'white', border: 'none', cursor: 'pointer' }}>Locations</button>
            
            <label style={{ cursor: 'pointer', background: '#4b5563', padding: '6px 12px', borderRadius: 4, color: 'white' }}>
              Import .fdx
              <input type="file" accept=".fdx, .xml" style={{ display: 'none' }} onChange={handleImportFDX} />
            </label>
            <button onClick={handleExportFDX} style={{ padding: '6px 12px', background: '#4b5563', borderRadius: 4, color: 'white', border: 'none', cursor: 'pointer' }}>Export .fdx</button>
            <button onClick={handleExportPDF} style={{ padding: '6px 12px', background: '#4b5563', borderRadius: 4, color: 'white', border: 'none', cursor: 'pointer' }}>Export PDF</button>
          </div>
        </div>

        {/* Scrollable Editor Area */}
        <div className="editor-container" style={{ flex: 1, overflowY: 'auto', position: 'relative', paddingBottom: '60vh', backgroundColor: '#333' }}>
          <div className="script-paper" style={{ margin: '2rem auto' }}>
            <EditorContent editor={editor} />
          </div>
          <Suggestions editor={editor} />
          <ElementSelector editor={editor} />
        </div>
      </div>

      {/* Modals */}
      <Modal isOpen={showTitlePage} onClose={() => setShowTitlePage(false)} title="Title Page">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#a0a0a0' }}>Title</label>
            <input 
              value={titlePageData.title} 
              onChange={e => setTitlePageData({...titlePageData, title: e.target.value})} 
              style={{ width: '100%', padding: '8px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '4px' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#a0a0a0' }}>Author</label>
            <input 
              value={titlePageData.author} 
              onChange={e => setTitlePageData({...titlePageData, author: e.target.value})} 
              style={{ width: '100%', padding: '8px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '4px' }} 
            />
          </div>
          <button onClick={() => setShowTitlePage(false)} style={{ padding: '8px', marginTop: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save</button>
        </div>
      </Modal>

      <Modal isOpen={showCharacterList} onClose={() => setShowCharacterList(false)} title="Character List">
        {characters.length === 0 ? <p style={{ color: '#a0a0a0' }}>No characters found in script.</p> : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {characters.map(c => (
              <li key={c} style={{ padding: '8px', borderBottom: '1px solid #2a2e38' }}>{c}</li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal isOpen={showLocationList} onClose={() => setShowLocationList(false)} title="Locations List">
        {locations.length === 0 ? <p style={{ color: '#a0a0a0' }}>No locations found in script.</p> : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {locations.map(l => (
              <li key={l} style={{ padding: '8px', borderBottom: '1px solid #2a2e38' }}>{l}</li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
