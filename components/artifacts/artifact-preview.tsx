'use client';

import React, { useMemo, useState } from 'react';
import { ConversationArtifact, ArtifactFile } from '@/lib/artifacts/types';
import { RotateCw, Smartphone, Monitor, Tablet, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ArtifactPreviewProps {
  artifact: ConversationArtifact;
  activeFile?: ArtifactFile;
}

export function ArtifactPreview({ artifact, activeFile }: ArtifactPreviewProps) {
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [reloadKey, setReloadKey] = useState(0);

  // Bundle HTML, CSS, and JS from artifact files into a single sandboxed document
  const bundledHtml = useMemo(() => {
    const htmlFile = artifact.files.find((f) => f.filename.endsWith('.html') || f.language === 'html') || activeFile;
    const cssFiles = artifact.files.filter((f) => f.filename.endsWith('.css') || f.language === 'css');
    const jsFiles = artifact.files.filter((f) => f.filename.endsWith('.js') || f.language === 'javascript');

    if (!htmlFile) {
      return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;color:#666;">No HTML entry file found in artifact.</body></html>`;
    }

    let rawHtml = htmlFile.content || '';

    // Inject strict CSP meta tag
    const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: https:; font-src data: https:; media-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none';">`;
    if (rawHtml.includes('<head>')) {
      rawHtml = rawHtml.replace('<head>', `<head>\n  ${cspMeta}`);
    } else if (rawHtml.includes('<html>')) {
      rawHtml = rawHtml.replace('<html>', `<html><head>${cspMeta}</head>`);
    } else {
      rawHtml = `<head>${cspMeta}</head>\n${rawHtml}`;
    }

    // Inject all CSS files
    if (cssFiles.length > 0) {
      const combinedCss = cssFiles.map((c) => `<style>\n${c.content}\n</style>`).join('\n');
      if (rawHtml.includes('</head>')) {
        rawHtml = rawHtml.replace('</head>', `${combinedCss}\n</head>`);
      } else {
        rawHtml = `${combinedCss}\n${rawHtml}`;
      }
    }

    // Inject all JS files
    if (jsFiles.length > 0) {
      const combinedJs = jsFiles.map((j) => `<script>\n${j.content}\n</script>`).join('\n');
      if (rawHtml.includes('</body>')) {
        rawHtml = rawHtml.replace('</body>', `${combinedJs}\n</body>`);
      } else {
        rawHtml = `${rawHtml}\n${combinedJs}`;
      }
    }

    return rawHtml;
  }, [artifact.files, activeFile]);

  const handleOpenNewTab = () => {
    const blob = new Blob([bundledHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <div className="flex flex-col h-full bg-[#EFECE6] dark:bg-[#151515]">
      {/* Viewport & Refresh Bar */}
      <div className="px-4 py-2 bg-white dark:bg-[#1E1E1E] border-b border-[#E8E5E0] dark:border-[#2E2E2E] flex items-center justify-between">
        <div className="flex items-center gap-1 bg-[#F7F6F3] dark:bg-[#2A2A2A] p-0.5 rounded-xl">
          <button
            type="button"
            onClick={() => setDeviceView('desktop')}
            className={cn(
              'p-1.5 rounded-lg text-[#6B6B6B] dark:text-[#9E9E9E] transition-colors',
              deviceView === 'desktop' && 'bg-white dark:bg-[#1E1E1E] text-[#1A1A1A] dark:text-[#E5E5E5] shadow-xs'
            )}
            title="Desktop View"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDeviceView('tablet')}
            className={cn(
              'p-1.5 rounded-lg text-[#6B6B6B] dark:text-[#9E9E9E] transition-colors',
              deviceView === 'tablet' && 'bg-white dark:bg-[#1E1E1E] text-[#1A1A1A] dark:text-[#E5E5E5] shadow-xs'
            )}
            title="Tablet View"
          >
            <Tablet className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDeviceView('mobile')}
            className={cn(
              'p-1.5 rounded-lg text-[#6B6B6B] dark:text-[#9E9E9E] transition-colors',
              deviceView === 'mobile' && 'bg-white dark:bg-[#1E1E1E] text-[#1A1A1A] dark:text-[#E5E5E5] shadow-xs'
            )}
            title="Mobile View"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="p-1.5 rounded-lg text-[#6B6B6B] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] hover:bg-[#F7F6F3] dark:hover:bg-[#2A2A2A] transition-colors"
            title="Reload Preview"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleOpenNewTab}
            className="p-1.5 rounded-lg text-[#6B6B6B] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] hover:bg-[#F7F6F3] dark:hover:bg-[#2A2A2A] transition-colors"
            title="Open in New Tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sandboxed Iframe Container */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div
          className={cn(
            'h-full bg-white transition-all duration-300 rounded-2xl shadow-xl overflow-hidden border border-[#E8E5E0] dark:border-[#2E2E2E]',
            deviceView === 'desktop' && 'w-full',
            deviceView === 'tablet' && 'w-[768px]',
            deviceView === 'mobile' && 'w-[375px]'
          )}
        >
          <iframe
            key={reloadKey}
            srcDoc={bundledHtml}
            sandbox="allow-scripts allow-modals allow-forms"
            title="Live Sandboxed Preview"
            className="w-full h-full border-0"
          />
        </div>
      </div>
    </div>
  );
}
