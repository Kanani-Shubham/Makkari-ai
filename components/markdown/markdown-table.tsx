'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Table, Copy, Check, ChevronDown, Download, FileSpreadsheet } from 'lucide-react';
import { tableToTSV, tableToCSV, tableToMarkdown, ParsedTableData } from '@/lib/markdown/table-utils';
import { cn } from '@/lib/utils';

interface MarkdownTableProps {
  children?: React.ReactNode;
}

export function MarkdownTable({ children }: MarkdownTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [tableData, setTableData] = useState<ParsedTableData>({ headers: [], rows: [] });

  // Extract structured table data from the DOM
  useEffect(() => {
    if (!containerRef.current) return;

    const tableEl = containerRef.current.querySelector('table');
    if (!tableEl) return;

    const headers: string[] = [];
    const rows: string[][] = [];

    const thEls = tableEl.querySelectorAll('thead th');
    thEls.forEach((th) => headers.push(th.textContent?.trim() || ''));

    const trEls = tableEl.querySelectorAll('tbody tr');
    trEls.forEach((tr) => {
      const rowCells: string[] = [];
      const tdEls = tr.querySelectorAll('td');
      tdEls.forEach((td) => rowCells.push(td.textContent?.trim() || ''));
      if (rowCells.length > 0) rows.push(rowCells);
    });

    // Fallback if no thead exists
    if (headers.length === 0 && rows.length > 0) {
      const firstRow = rows.shift();
      if (firstRow) headers.push(...firstRow);
    }

    setTableData({ headers, rows });
  }, [children]);

  const handleCopy = (type: 'tsv' | 'csv' | 'markdown' = 'tsv') => {
    let text = '';
    if (type === 'tsv') text = tableToTSV(tableData);
    else if (type === 'csv') text = tableToCSV(tableData);
    else if (type === 'markdown') text = tableToMarkdown(tableData);

    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setShowDropdown(false);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleDownloadCsv = () => {
    const csvContent = tableToCSV(tableData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `table_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowDropdown(false);
  };

  const colCount = tableData.headers.length || 0;
  const rowCount = tableData.rows.length || 0;

  return (
    <div
      ref={containerRef}
      className="my-4 w-full max-w-full rounded-2xl border border-[#E8E5E0] dark:border-[#2E2E2E] bg-white dark:bg-[#1A1A1A] shadow-xs overflow-hidden"
    >
      {/* Table Toolbar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#F7F6F3] dark:bg-[#222222] border-b border-[#E8E5E0] dark:border-[#2E2E2E]">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5]">
          <Table className="w-3.5 h-3.5 text-[#D97757]" />
          <span>Table</span>
          {colCount > 0 && (
            <span className="text-[10px] text-[#6B6B6B] dark:text-[#9E9E9E] font-normal font-mono">
              ({rowCount} {rowCount === 1 ? 'row' : 'rows'} • {colCount} cols)
            </span>
          )}
        </div>

        {/* Copy / Export Button & Dropdown */}
        <div className="relative flex items-center">
          <button
            type="button"
            onClick={() => handleCopy('tsv')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-l-lg text-xs font-medium transition-all cursor-pointer',
              'bg-white dark:bg-[#2A2A2A] border border-r-0 border-[#E8E5E0] dark:border-[#383838]',
              'text-[#1A1A1A] dark:text-[#E5E5E5] hover:text-[#D97757] hover:bg-[#FAF9F6] dark:hover:bg-[#333333]'
            )}
            title="Copy table to clipboard (TSV for Sheets / Excel)"
          >
            {copiedType ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className={cn(
              'p-1 rounded-r-lg border border-[#E8E5E0] dark:border-[#383838] transition-colors cursor-pointer',
              'bg-white dark:bg-[#2A2A2A] text-[#6B6B6B] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5]',
              'hover:bg-[#FAF9F6] dark:hover:bg-[#333333]'
            )}
            title="More export options"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-[#242424] border border-[#E8E5E0] dark:border-[#333333] rounded-xl shadow-lg z-20 py-1 text-xs">
              <button
                type="button"
                onClick={() => handleCopy('tsv')}
                className="w-full text-left px-3 py-1.5 hover:bg-[#F7F6F3] dark:hover:bg-[#2E2E2E] text-[#1A1A1A] dark:text-[#E5E5E5] flex items-center justify-between"
              >
                <span>Copy Table (TSV)</span>
              </button>
              <button
                type="button"
                onClick={() => handleCopy('csv')}
                className="w-full text-left px-3 py-1.5 hover:bg-[#F7F6F3] dark:hover:bg-[#2E2E2E] text-[#1A1A1A] dark:text-[#E5E5E5]"
              >
                Copy as CSV
              </button>
              <button
                type="button"
                onClick={() => handleCopy('markdown')}
                className="w-full text-left px-3 py-1.5 hover:bg-[#F7F6F3] dark:hover:bg-[#2E2E2E] text-[#1A1A1A] dark:text-[#E5E5E5]"
              >
                Copy as Markdown
              </button>
              <div className="border-t border-[#E8E5E0] dark:border-[#333333] my-1" />
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="w-full text-left px-3 py-1.5 hover:bg-[#F7F6F3] dark:hover:bg-[#2E2E2E] text-[#D97757] font-medium flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download CSV</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Horizontal Scrollable Table Viewport */}
      <div className="w-full max-w-full overflow-x-auto">
        <table className="w-max min-w-full text-left text-xs border-collapse divide-y divide-[#E8E5E0] dark:divide-[#2E2E2E]">
          {children}
        </table>
      </div>
    </div>
  );
}

export function MarkdownThead({ children }: { children?: React.ReactNode }) {
  return <thead className="bg-[#FAF9F6] dark:bg-[#222222] font-semibold text-[#1A1A1A] dark:text-[#E5E5E5]">{children}</thead>;
}

export function MarkdownTbody({ children }: { children?: React.ReactNode }) {
  return <tbody className="divide-y divide-[#E8E5E0] dark:divide-[#2E2E2E] bg-white dark:bg-[#1A1A1A]">{children}</tbody>;
}

export function MarkdownTr({ children }: { children?: React.ReactNode }) {
  return <tr className="hover:bg-[#FBF9F5] dark:hover:bg-[#202020] transition-colors">{children}</tr>;
}

export function MarkdownTh({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] whitespace-nowrap text-left border-r border-[#E8E5E0]/60 dark:border-[#2E2E2E]/60 last:border-r-0">
      {children}
    </th>
  );
}

export function MarkdownTd({ children }: { children?: React.ReactNode }) {
  return (
    <td className="px-4 py-2.5 text-[#333333] dark:text-[#CCCCCC] align-top border-r border-[#E8E5E0]/60 dark:border-[#2E2E2E]/60 last:border-r-0 break-words max-w-sm">
      {children}
    </td>
  );
}
