import { Builder, parseStringPromise } from 'xml2js';

const TIPTAP_TO_FDX_TYPES: Record<string, string> = {
  sceneHeading: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  dialogue: 'Dialogue',
  parenthetical: 'Parenthetical',
  transition: 'Transition',
};

const FDX_TO_TIPTAP_TYPES: Record<string, string> = {
  'Scene Heading': 'sceneHeading',
  'Action': 'action',
  'Character': 'character',
  'Dialogue': 'dialogue',
  'Parenthetical': 'parenthetical',
  'Transition': 'transition',
};

export async function exportToFDX(tiptapJson: any): Promise<string> {
  const paragraphs = tiptapJson.content.map((node: any) => {
    const fdxType = TIPTAP_TO_FDX_TYPES[node.type] || 'Action';
    
    // Handle text content which might be fragmented in Tiptap
    let textStr = '';
    if (node.content) {
      textStr = node.content.map((c: any) => c.text || '').join('');
    }

    return {
      $: { Type: fdxType },
      Text: textStr,
    };
  });

  const obj = {
    FinalDraft: {
      $: { DocumentType: 'Script', Template: 'No', Version: '1' },
      Content: [
        {
          Paragraph: paragraphs,
        },
      ],
    },
  };

  const builder = new Builder();
  return builder.buildObject(obj);
}

export async function importFromFDX(xmlString: string): Promise<any> {
    try {
        const parsed = await parseStringPromise(xmlString);
        let paragraphs = parsed?.FinalDraft?.Content?.[0]?.Paragraph;
        if (!paragraphs) return { type: 'doc', content: [] };

        if (!Array.isArray(paragraphs)) {
            paragraphs = [paragraphs];
        }

        const tiptapNodes = paragraphs.map((p: any) => {
            const typeStr = p.$?.Type || 'Action';
            const tiptapType = FDX_TO_TIPTAP_TYPES[typeStr] || 'action';
            
            let textValue = '';
            if (p.Text) {
                if (Array.isArray(p.Text)) {
                   textValue = p.Text.map((t: any) => (typeof t === 'string' ? t : t._ || '')).join('');
                } else if (typeof p.Text === 'string') {
                    textValue = p.Text;
                } else if (p.Text._) {
                    textValue = p.Text._;
                }
            }

            return {
                type: tiptapType,
                content: textValue ? [{ type: 'text', text: textValue }] : undefined,
            };
        });

        return {
            type: 'doc',
            content: tiptapNodes,
        };
    } catch (e) {
        console.error("Error parsing FDX", e);
        return { type: 'doc', content: [] };
    }
}
