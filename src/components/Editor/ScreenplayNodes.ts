import { Node, mergeAttributes } from '@tiptap/core';

export interface ScreenplayElementOptions {
  HTMLAttributes: Record<string, any>;
}

export const createScreenplayNode = (name: string, cssClass: string, nextTypeOnEnter: string) => {
  return Node.create<ScreenplayElementOptions>({
    name,
    group: 'block',
    content: 'inline*',
    parseHTML() {
      return [{ tag: `p[data-type="${name}"]` }];
    },
    renderHTML({ HTMLAttributes }) {
      return ['p', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-type': name, class: cssClass }), 0];
    },
    addKeyboardShortcuts() {
      return {
        Enter: ({ editor }) => {
          const { state, view } = editor;
          const { selection } = state;
          const { $from, empty } = selection;
          
          if (!empty) return false;
          if ($from.parent.type.name !== name) return false;

          const isAtEnd = $from.parentOffset === $from.parent.content.size;
          
          if (isAtEnd) {
            // If the current node is empty, hitting enter opens the element selector
            if ($from.parent.content.size === 0) {
               let suggestedType = 'sceneHeading'; // Default
               
               // Find the previous node to infer what comes next
               const prevPos = $from.before();
               if (prevPos > 0) {
                 const prevNode = state.doc.resolve(prevPos).nodeBefore;
                 if (prevNode) {
                    const pType = prevNode.type.name;
                    if (pType === 'sceneHeading') suggestedType = 'action';
                    else if (pType === 'action') suggestedType = 'character'; // Updated based on user request (Action -> Character)
                    else if (pType === 'character') suggestedType = 'dialogue'; // Hit enter after character implies dialogue
                    else if (pType === 'dialogue') suggestedType = 'action';
                    else if (pType === 'parenthetical') suggestedType = 'dialogue';
                    else if (pType === 'transition') suggestedType = 'sceneHeading';
                 }
               }

               const event = new CustomEvent('showElementSelector', { detail: { pos: selection.from, suggestedType } });
               window.dispatchEvent(event);
               return true; // prevent default behavior
            }

            return editor.chain().insertContent({ type: nextTypeOnEnter }).focus().run();
          }
          return false;
        },
      };
    },
  });
};

export const Action = createScreenplayNode('action', 'screenplay-action', 'action');
export const SceneHeading = createScreenplayNode('sceneHeading', 'screenplay-scene-heading', 'action');
export const Character = createScreenplayNode('character', 'screenplay-character', 'dialogue');
export const Dialogue = createScreenplayNode('dialogue', 'screenplay-dialogue', 'action');
export const Parenthetical = createScreenplayNode('parenthetical', 'screenplay-parenthetical', 'dialogue');
export const Transition = createScreenplayNode('transition', 'screenplay-transition', 'sceneHeading');
