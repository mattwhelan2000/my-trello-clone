import { Extension } from '@tiptap/core';

const formatCycle = [
  'sceneHeading',
  'action',
  'character',
  'dialogue',
  'parenthetical',
  'transition',
];

export const ScreenplayShortcuts = Extension.create({
  name: 'screenplayShortcuts',

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const { $from, empty } = selection;

        if (!empty) return false;

        const currentType = $from.parent.type.name;
        const isAtEnd = $from.parentOffset === $from.parent.content.size;
        
        // Final Draft Defaults on empty elements:
        if ($from.parent.content.size === 0) {
            // Action -> Tab -> Character
            if (currentType === 'action') {
                editor.chain().focus().setNode('character').run();
                return true;
            }
            // Character -> Tab -> Transition
            if (currentType === 'character') {
                editor.chain().focus().setNode('transition').run();
                return true;
            }
            // Scene Heading -> Tab -> Action
            if (currentType === 'sceneHeading') {
                editor.chain().focus().setNode('action').run();
                return true;
            }
        }

        // If not empty or not hitting specific overrides, cycle normally
        let currentIndex = formatCycle.indexOf(currentType);
        
        if (currentIndex === -1) {
            currentIndex = 1; 
        }

        const nextIndex = (currentIndex + 1) % formatCycle.length;
        const nextType = formatCycle[nextIndex];

        editor.chain().focus().setNode(nextType).run();
        return true;
      },
    };
  },
});
