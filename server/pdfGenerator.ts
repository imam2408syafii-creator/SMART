import fs from 'fs';

/**
 * Generates a valid, standards-compliant PDF-1.4 document with clean text content
 * for DEMO assignment letters and supporting institutional documents.
 */
export function writeMinimalPdf(
  filePath: string,
  title: string,
  lines: string[]
): number {
  const escapePdfText = (text: string) =>
    text
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');

  const streamLines: string[] = [
    'BT',
    '/F1 14 Tf',
    '56 760 Td',
    `(${escapePdfText(title)}) Tj`,
    '0 -22 Td',
    '/F2 10 Tf',
  ];

  for (const line of lines) {
    streamLines.push(`(${escapePdfText(line)}) Tj`);
    streamLines.push('0 -16 Td');
  }

  streamLines.push('ET');
  const streamContent = streamLines.join('\n');

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(streamContent, 'utf8')} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  fs.writeFileSync(filePath, pdf, 'utf8');
  return fs.statSync(filePath).size;
}
