import { Document, Packer, Paragraph, TextRun, Header, Footer, Table, TableRow, TableCell, WidthType, BorderStyle, HeadingLevel, PageNumber, AlignmentType } from 'docx';
import { GeneratedReviewerDocument, GeneratedReviewerPart } from '@/lib/ai/schemas';

export async function renderReviewerDocx(doc: GeneratedReviewerDocument): Promise<Buffer> {
  const children: any[] = [];

  // Generate Parts
  for (const part of doc.parts) {
    children.push(...renderPartToDocx(part));
  }

  const docxDocument = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Arial",
            size: 20, // Half-points (10pt)
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720, // 0.5in
              right: 720,
              bottom: 1008, // 0.7in
              left: 720,
            }
          },
          column: {
            space: 500, // Gap between columns (~0.35in)
            count: 2,   // Two column layout
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: doc.title,
                    bold: true,
                    size: 36, // 18pt
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.LEFT,
                border: {
                  bottom: {
                    color: "000000",
                    space: 5,
                    style: BorderStyle.THICK,
                    size: 10,
                  }
                },
                children: [
                  new TextRun({
                    text: doc.subject.toUpperCase(),
                    color: "666666",
                    size: 20, // 10pt
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `${doc.subject} — REVIEWER`,
                    color: "666666",
                    size: 16, // 8pt
                  }),
                  new TextRun({
                    text: "    Page ",
                    color: "666666",
                    size: 16,
                  }),
                  new PageNumber(),
                ],
              }),
            ],
          }),
        },
        children: children,
      }
    ],
  });

  const b64 = await Packer.toBase64String(docxDocument);
  return Buffer.from(b64, 'base64');
}

function renderPartToDocx(part: GeneratedReviewerPart): any[] {
  switch (part.type) {
    case 'heading':
      return [
        new Paragraph({
          text: part.text || '',
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 240, after: 120 },
        }),
      ];
    case 'paragraph':
      return [
        new Paragraph({
          children: [new TextRun(part.text || '')],
          spacing: { after: 120 },
          alignment: AlignmentType.JUSTIFIED,
        }),
      ];
    case 'note':
      const noteChildren = [];
      if (part.title) {
        noteChildren.push(
          new Paragraph({
            children: [new TextRun({ text: `📝 ${part.title}`, bold: true })],
          })
        );
      }
      (part.bullets || []).forEach(b => {
        noteChildren.push(
          new Paragraph({
            text: b,
            bullet: { level: 0 }
          })
        );
      });
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            left: { style: BorderStyle.THICK, size: 15, color: "4b5563" },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: "f3f4f6" },
                  children: noteChildren,
                })
              ]
            })
          ],
        }),
        new Paragraph({ text: "" }) // Spacing
      ];
    case 'table':
      const headerRow = new TableRow({
        children: (part.columns || []).map(col => new TableCell({
          shading: { fill: "f3f4f6" },
          children: [new Paragraph({ children: [new TextRun({ text: col, bold: true })] })]
        })),
      });
      const dataRows = (part.rows || []).map(row => new TableRow({
        children: row.map(cell => new TableCell({
          children: [new Paragraph(cell)]
        }))
      }));
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...dataRows],
        }),
        new Paragraph({ text: "" }) // Spacing
      ];
    case 'process':
      return (part.steps || []).map((step, idx) => 
        new Paragraph({
          text: `${idx + 1}. ${step}`,
          spacing: { after: 60 }
        })
      );
    default:
      return [];
  }
}
