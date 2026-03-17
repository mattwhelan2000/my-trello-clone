import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const paginationPluginKey = new PluginKey('pagination');

const LINES_PER_PAGE = 54; // 9 printable inches * 6 lines/inch

function estimateNodeLines(node: any): number {
  const type = node.type.name;
  let lines = 0;
  
  if (type === 'sceneHeading' || type === 'transition' || type === 'character') {
    lines = 2; // 1 text line + 1 blank line above
  } else if (type === 'action') {
    const textLen = node.textContent.length || 1;
    lines = Math.ceil(textLen / 65) + 1; // Approx 65 chars per line + blank line overhead
  } else if (type === 'dialogue') {
    const textLen = node.textContent.length || 1;
    lines = Math.ceil(textLen / 35); // Dialogue is narrower
  } else if (type === 'parenthetical') {
    const textLen = node.textContent.length || 1;
    lines = Math.ceil(textLen / 25);
  } else {
    lines = 1;
  }
  return lines;
}

export const PaginationExtension = Extension.create({
  name: 'pagination',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: paginationPluginKey,
        state: {
          init(_, { doc }) {
            return calculateDecorations(doc);
          },
          apply(tr, old, oldState, newState) {
            if (!tr.docChanged) return old;
            return calculateDecorations(newState.doc);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

function calculateDecorations(doc: any) {
  const decorations: Decoration[] = [];
  
  let currentLine = 0;
  let pageNumber = 1;
  let lastCharacterName = '';

  doc.descendants((node: any, pos: number) => {
    if (node.isBlock && node.type.name !== 'doc') {
      if (node.type.name === 'character') {
         lastCharacterName = node.textContent.trim();
      }

      const nodeLines = estimateNodeLines(node);
      
      if (currentLine + nodeLines > LINES_PER_PAGE) {
         // Page Break needed before this node
         decorations.push(
            Decoration.widget(pos, () => {
              const el = document.createElement('div');
              el.className = 'page-break-indicator';
              
              let html = `<div class="page-divider"><span>Page ${pageNumber + 1}</span></div>`;

              // If it's dialogue that is getting pushed to the next page, inject (MORE) and (CONT'D)
              if (node.type.name === 'dialogue') {
                  html = `
                    <div style="font-family: var(--font-script); text-align: center; margin-left: 1in; margin-right: 1.5in;">(MORE)</div>
                    <div class="page-divider"><span>Page ${pageNumber + 1}</span></div>
                    <div style="font-family: var(--font-script); text-transform: uppercase; padding-left: 2.2in; margin-top: 1em;">${lastCharacterName} (CONT'D)</div>
                  `;
              }

              el.innerHTML = html;
              return el;
            })
         );
         
         currentLine = nodeLines; // Reset to top of new page
         pageNumber++;
      } else {
         // Check orphan character
         if (node.type.name === 'character' && currentLine >= LINES_PER_PAGE - 2) {
            decorations.push(
                Decoration.widget(pos, () => {
                  const el = document.createElement('div');
                  el.className = 'page-break-indicator';
                  el.innerHTML = `<div class="page-divider"><span>Page ${pageNumber + 1}</span></div>`;
                  return el;
                })
             );
             currentLine = nodeLines;
             pageNumber++;
         } else {
            currentLine += nodeLines;
         }
      }
      
      return false; // Skip traversing inline children
    }
    return true;
  });

  return DecorationSet.create(doc, decorations);
}
