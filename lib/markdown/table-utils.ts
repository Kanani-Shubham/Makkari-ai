export interface ParsedTableData {
  headers: string[];
  rows: string[][];
}

/**
 * Escapes values for standard RFC 4180 CSV
 */
export function escapeCsvCell(val: string): string {
  const clean = val.replace(/\r?\n/g, ' ').trim();
  if (/[",\n]/.test(clean)) {
    return `"${clean.replace(/"/g, '""')}"`;
  }
  return clean;
}

/**
 * Converts table data to TSV format for pasting into Excel / Google Sheets / Notion
 */
export function tableToTSV(data: ParsedTableData): string {
  const headerLine = data.headers.map((h) => h.replace(/\t|\r?\n/g, ' ').trim()).join('\t');
  const rowLines = data.rows.map((row) =>
    row.map((cell) => cell.replace(/\t|\r?\n/g, ' ').trim()).join('\t')
  );
  return [headerLine, ...rowLines].join('\n');
}

/**
 * Converts table data to clean CSV
 */
export function tableToCSV(data: ParsedTableData): string {
  const headerLine = data.headers.map(escapeCsvCell).join(',');
  const rowLines = data.rows.map((row) => row.map(escapeCsvCell).join(','));
  return [headerLine, ...rowLines].join('\n');
}

/**
 * Converts table data to GitHub Flavored Markdown table format
 */
export function tableToMarkdown(data: ParsedTableData): string {
  if (data.headers.length === 0) return '';

  const headerRow = `| ${data.headers.map((h) => h.trim()).join(' | ')} |`;
  const dividerRow = `| ${data.headers.map(() => '---').join(' | ')} |`;
  const dataRows = data.rows.map((row) => {
    // Pad row if needed
    const padded = [...row];
    while (padded.length < data.headers.length) padded.push('');
    return `| ${padded.slice(0, data.headers.length).map((c) => c.trim()).join(' | ')} |`;
  });

  return [headerRow, dividerRow, ...dataRows].join('\n');
}
