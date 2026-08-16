import { tableToTSV, tableToCSV, tableToMarkdown, escapeCsvCell } from '../lib/markdown/table-utils';

function runTableTests() {
  console.log('===============================================================');
  console.log('MAKKARI AI: MARKDOWN TABLE RENDERING & EXPORT TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (!condition) {
      console.error(`❌ TEST FAILED: ${msg}`);
      throw new Error(msg);
    }
    passed++;
    console.log(`✅ ${msg}`);
  }

  // --- TEST 1: TSV Conversion for Spreadsheets ---
  console.log('--- TEST 1: TSV Conversion (Google Sheets / Excel) ---');
  const sampleTable = {
    headers: ['ID', 'Name', 'Email', 'Phone', 'Company'],
    rows: [
      ['001', 'Alice Johnson', 'alice@example.com', '+1 555-0199', 'Acme Corp'],
      ['002', 'Bob Smith', 'bob@example.com', '+1 555-0288', 'Beta LLC'],
    ],
  };

  const tsv = tableToTSV(sampleTable);
  assert(tsv.includes('ID\tName\tEmail\tPhone\tCompany'), 'Headers separated by tabs in TSV');
  assert(tsv.includes('001\tAlice Johnson\talice@example.com\t+1 555-0199\tAcme Corp'), 'Row cells separated by tabs in TSV');

  // --- TEST 2: RFC 4180 CSV Escaping ---
  console.log('\n--- TEST 2: RFC 4180 CSV Escaping ---');
  const csvTable = {
    headers: ['Item', 'Description', 'Price'],
    rows: [
      ['Laptop', 'High-end, 16" display', '$1,999.00'],
      ['Book', 'Title: "Mastering Next.js"', '$49.99'],
    ],
  };

  const csv = tableToCSV(csvTable);
  assert(csv.includes('"High-end, 16"" display"'), 'Quotes and commas escaped in CSV');
  assert(csv.includes('"$1,999.00"'), 'Currency with comma escaped in CSV');

  // --- TEST 3: GFM Markdown Table Re-serialization ---
  console.log('\n--- TEST 3: Markdown Table Serialization ---');
  const md = tableToMarkdown(sampleTable);
  assert(md.includes('| ID | Name | Email | Phone | Company |'), 'Markdown header row generated');
  assert(md.includes('| --- | --- | --- | --- | --- |'), 'Markdown separator row generated');
  assert(md.includes('| 001 | Alice Johnson | alice@example.com | +1 555-0199 | Acme Corp |'), 'Markdown data row formatted');

  // --- TEST 4: Empty Cell Padding ---
  console.log('\n--- TEST 4: Empty Cell Handling ---');
  const emptyCellTable = {
    headers: ['A', 'B', 'C'],
    rows: [['valA']], // missing B and C
  };
  const paddedMd = tableToMarkdown(emptyCellTable);
  assert(paddedMd.includes('| valA |  |  |'), 'Missing trailing cells padded with empty strings');

  console.log('\n===============================================================');
  console.log(`MARKDOWN TABLE TEST SUITE COMPLETE: ${passed}/${total} TESTS PASSED`);
  console.log('===============================================================');
}

runTableTests();
