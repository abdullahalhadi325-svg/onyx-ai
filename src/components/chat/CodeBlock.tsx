import { useEffect, useState } from 'react';
import { Check, Code, Copy, Eye, X } from '@phosphor-icons/react';
import {
  buildPreviewSrcDoc,
  isPreviewableCodeLanguage,
} from '../../lib/artifacts';

interface CodeBlockProps {
  code: string;
  language?: string;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to execCommand fallback
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const normalizedLang = (language || 'text').trim().toLowerCase();
  const canPreview = isPreviewableCodeLanguage(normalizedLang);

  useEffect(() => {
    if (!isPreviewOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsPreviewOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewOpen]);

  async function handleCopy() {
    const ok = await copyTextToClipboard(code);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <>
      <div className="my-3 w-full max-w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#181818]">
        {/* Top bar (surface contrast, zero single-sided borders) */}
        <div className="flex items-center justify-between gap-2 bg-[#1F1F1F] px-3.5 py-2">
          <div className="flex min-w-0 items-center gap-2 font-mono text-xs text-white/65">
            <Code size={14} weight="regular" className="shrink-0 text-white/55" />
            <span className="truncate">{normalizedLang}</span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {canPreview && (
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#272727] px-2.5 text-xs font-medium text-white hover:bg-[#313131] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              >
                <Eye size={14} weight="regular" />
                <span>Preview</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? 'Code copied' : 'Copy code'}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#272727] px-2.5 text-xs font-medium text-white/90 hover:bg-[#313131] hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            >
              {copied ? (
                <>
                  <Check size={14} weight="bold" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} weight="regular" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Monospace code body */}
        <div className="w-full overflow-x-auto p-3.5">
          <pre className="m-0 font-mono text-xs leading-relaxed text-white/90">
            <code>{code}</code>
          </pre>
        </div>
      </div>

      {/* Sandboxed Live Preview Modal for HTML / SVG */}
      {canPreview && (
        <div
          aria-hidden={!isPreviewOpen}
          className={`fixed inset-0 z-50 flex items-center justify-center p-3 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:p-6 ${
            isPreviewOpen
              ? 'visible pointer-events-auto opacity-100'
              : 'invisible pointer-events-none opacity-0'
          }`}
        >
          <div
            onClick={() => setIsPreviewOpen(false)}
            className="absolute inset-0 bg-[#000000]/80 backdrop-blur-sm"
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-label={`${normalizedLang.toUpperCase()} live artifact preview`}
            className={`relative z-10 flex h-[min(80dvh,640px)] w-full max-w-[780px] flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#181818] p-2 shadow-2xl transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isPreviewOpen
                ? 'translate-y-0 scale-100 opacity-100'
                : 'translate-y-4 scale-95 opacity-0'
            }`}
          >
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#1F1F1F] px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <Eye size={16} weight="regular" className="shrink-0 text-white/75" />
                <span className="truncate text-sm font-semibold text-white">
                  Live Preview
                </span>
                <span aria-hidden="true" className="text-white/35">
                  ·
                </span>
                <span className="font-mono text-xs text-white/55">
                  {normalizedLang}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#272727] px-3 text-xs font-medium text-white hover:bg-[#313131] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  {copied ? (
                    <>
                      <Check size={14} weight="bold" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} weight="regular" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  aria-label="Close live preview"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-[#272727] text-white/80 hover:bg-[#313131] hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  <X size={16} weight="regular" />
                </button>
              </div>
            </div>

            <div className="mt-2 flex-1 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#000000]">
              {isPreviewOpen && (
                <iframe
                  title={`Onyx ${normalizedLang} artifact preview`}
                  sandbox="allow-scripts"
                  srcDoc={buildPreviewSrcDoc(code, normalizedLang)}
                  className="h-full w-full bg-[#000000]"
                />
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
