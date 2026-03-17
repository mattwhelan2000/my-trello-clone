import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

// @ts-ignore
pdfMake.vfs = pdfFonts && pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : globalThis.pdfMake ? globalThis.pdfMake.vfs : pdfFonts;

export const generatePDF = (tiptapJson: any) => {
  const content = tiptapJson.content.map((node: any) => {
    let text = node.content?.map((c: any) => c.text).join('') || '';
    
    // Margins are in points [left, top, right, bottom]
    let margin: [number, number, number, number] = [0, 0, 0, 12]; 
    let alignment: 'left' | 'right' | 'center' = 'left';
    let bold = false;
    
    switch (node.type) {
      case 'sceneHeading':
        bold = true;
        text = text.toUpperCase();
        break;
      case 'character':
        margin = [160, 12, 0, 0]; 
        text = text.toUpperCase();
        break;
      case 'dialogue':
        margin = [80, 0, 110, 0];
        break;
      case 'parenthetical':
        margin = [120, 0, 150, 0];
        text = text.startsWith('(') ? text : `(${text})`;
        break;
      case 'transition':
        alignment = 'right';
        margin = [0, 12, 0, 12];
        text = text.toUpperCase();
        break;
      case 'action':
      default:
        break;
    }

    return {
      text,
      margin,
      alignment,
      bold,
      fontSize: 12
    };
  });

  const docDefinition: any = {
    content,
    pageMargins: [108, 72, 72, 72], // 1.5", 1", 1", 1"
    defaultStyle: {
      fontSize: 12,
      // pdfmake uses Roboto by default if Courier isn't mapped properly, but we'll let it use the default monospace if it falls back
    }
  };

  pdfMake.createPdf(docDefinition).download('Script.pdf');
};
