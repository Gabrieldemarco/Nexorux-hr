export async function downloadPdf(filename: string, title: string, rows: Record<string, unknown>[]) {
  const { jsPDF } = await import('jspdf');
  const document = new jsPDF();
  document.setFontSize(16);
  document.text(title, 14, 18);
  document.setFontSize(9);
  document.text(`Generado: ${new Date().toLocaleString()}`, 14, 26);

  let y = 38;
  rows.forEach((row, index) => {
    const line = Object.entries(row)
      .map(([key, value]) => `${key}: ${String(value ?? '-')}`)
      .join(' | ');
    const lines = document.splitTextToSize(`${index + 1}. ${line}`, 180);
    if (y + lines.length * 5 > 280) {
      document.addPage();
      y = 18;
    }
    document.text(lines, 14, y);
    y += lines.length * 5 + 3;
  });

  document.save(filename);
}
