'use client';

import React, { useState } from 'react';
import { useArtifactStore } from '@/lib/store/use-artifact-store';
import { ArtifactPreview } from './artifact-preview';
import { ArtifactCodeViewer } from './artifact-code-viewer';
import { ArtifactFileTree } from './artifact-file-tree';
import JSZip from 'jszip';
import {
  X,
  Maximize2,
  Minimize2,
  Download,
  Code2,
  Eye,
  Layers,
  ArrowLeft,
  FolderTree,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { detectFileInfo } from '@/lib/files/file-type';

export function ArtifactWorkspace() {
  const {
    activeArtifact,
    activeFileId,
    viewMode,
    isWorkspaceOpen,
    isFullscreen,
    closeWorkspace,
    setViewMode,
    toggleFullscreen,
  } = useArtifactStore();

  const [showFileTree, setShowFileTree] = useState(true);
  const [isZipping, setIsZipping] = useState(false);

  if (!isWorkspaceOpen || !activeArtifact) return null;

  const files = activeArtifact.files || [];
  const activeFile = files.find((f) => f.id === activeFileId) || files[0];
  const fileInfo = activeFile ? detectFileInfo(activeFile.filename) : null;
  const isHtmlCapable = files.some((f) => f.filename.endsWith('.html') || f.language === 'html');

  // Bulk ZIP Download
  const handleDownloadZip = async () => {
    if (files.length === 0) return;
    setIsZipping(true);

    try {
      const zip = new JSZip();
      const folderName = (activeArtifact.title || 'makkari-project').toLowerCase().replace(/[^a-z0-9-_]/g, '_');
      const rootFolder = zip.folder(folderName);

      for (const f of files) {
        rootFolder?.file(f.filename, f.content || '');
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${folderName}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[ARTIFACT_WORKSPACE] Error creating ZIP archive:', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col bg-white dark:bg-[#1E1E1E] border-l border-[#E8E5E0] dark:border-[#2E2E2E] shadow-2xl transition-all duration-200 z-30',
        isFullscreen
          ? 'fixed inset-0 w-full h-full'
          : 'w-full lg:w-[50vw] xl:w-[45vw] h-[calc(100vh-3.5rem)]'
      )}
    >
      {/* Top Workspace Header */}
      <div className="h-12 px-4 bg-white dark:bg-[#1E1E1E] border-b border-[#E8E5E0] dark:border-[#2E2E2E] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={closeWorkspace}
            className="p-1.5 rounded-lg text-[#6B6B6B] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] hover:bg-[#F7F6F3] dark:hover:bg-[#2A2A2A] lg:hidden"
            title="Back to Chat"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {files.length > 1 && (
            <button
              type="button"
              onClick={() => setShowFileTree(!showFileTree)}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                showFileTree
                  ? 'bg-[#D97757]/10 text-[#D97757]'
                  : 'text-[#6B6B6B] hover:bg-[#F7F6F3] dark:hover:bg-[#2A2A2A]'
              )}
              title="Toggle Project Files"
            >
              <FolderTree className="w-4 h-4" />
            </button>
          )}

          <div className="min-w-0 truncate">
            <h3 className="text-xs font-semibold text-[#1A1A1A] dark:text-[#E5E5E5] truncate">
              {activeArtifact.title || (activeFile ? activeFile.filename : 'Workspace Artifact')}
            </h3>
            {activeFile && (
              <span className="text-[10px] text-[#6B6B6B] dark:text-[#9E9E9E] font-mono block truncate">
                {activeFile.filename}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mode Switcher: Preview vs Code */}
          {isHtmlCapable && (
            <div className="flex items-center bg-[#F7F6F3] dark:bg-[#2A2A2A] p-0.5 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={cn(
                  'flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer',
                  viewMode === 'preview'
                    ? 'bg-white dark:bg-[#181818] text-[#1A1A1A] dark:text-[#E5E5E5] shadow-xs font-semibold'
                    : 'text-[#6B6B6B] dark:text-[#9E9E9E]'
                )}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('code')}
                className={cn(
                  'flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer',
                  viewMode === 'code'
                    ? 'bg-white dark:bg-[#181818] text-[#1A1A1A] dark:text-[#E5E5E5] shadow-xs font-semibold'
                    : 'text-[#6B6B6B] dark:text-[#9E9E9E]'
                )}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Code</span>
              </button>
            </div>
          )}

          {/* Download Button */}
          {files.length > 1 ? (
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={isZipping}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#F7F6F3] dark:bg-[#2A2A2A] hover:bg-[#EFECE6] dark:hover:bg-[#333333] text-xs font-medium text-[#1A1A1A] dark:text-[#E5E5E5] transition-colors cursor-pointer"
              title="Download Project ZIP"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isZipping ? 'Zipping...' : 'ZIP'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (activeFile?.content) {
                  const blob = new Blob([activeFile.content], { type: activeFile.mime_type });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = activeFile.filename;
                  a.click();
                  URL.revokeObjectURL(url);
                }
              }}
              className="p-1.5 rounded-lg text-[#6B6B6B] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] hover:bg-[#F7F6F3] dark:hover:bg-[#2A2A2A] transition-colors"
              title="Download File"
            >
              <Download className="w-4 h-4" />
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg text-[#6B6B6B] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] hover:bg-[#F7F6F3] dark:hover:bg-[#2A2A2A] transition-colors hidden sm:block"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={closeWorkspace}
            className="p-1.5 rounded-lg text-[#6B6B6B] hover:text-[#1A1A1A] dark:hover:text-[#E5E5E5] hover:bg-[#F7F6F3] dark:hover:bg-[#2A2A2A] transition-colors"
            title="Close Workspace"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Optional Multi-File Tree Sidebar */}
        {files.length > 1 && showFileTree && (
          <ArtifactFileTree files={files} />
        )}

        {/* Content View: Live Sandboxed Preview vs Syntax-Highlighted Code */}
        <div className="flex-1 h-full overflow-hidden">
          {viewMode === 'preview' && isHtmlCapable ? (
            <ArtifactPreview artifact={activeArtifact} activeFile={activeFile} />
          ) : activeFile ? (
            <ArtifactCodeViewer file={activeFile} />
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-[#6B6B6B]">
              No file selected
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
