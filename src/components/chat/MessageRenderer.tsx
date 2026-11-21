import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowClockwise,
  ArrowUpRight,
  Brain,
  CaretDown,
  Check,
  Copy,
  DotsThree,
  DownloadSimple,
  FilePdf,
  GitBranch,
  Globe,
  Image as ImageIcon,
  Info,
  PaperPlaneTilt,
  Vault,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import type {
  GeneratedImageArtifact,
  MediaCard,
  PdfVaultInfo,
  PersonaId,
  RoutingModeId,
  SourceItem,
} from '../../types/onyx';
import {
  FRIENDLY_ENGINE_ERROR_MESSAGE,
  extractErrorDiagnostic,
  extractPdfMessageId,
  formatDownloadFilename,
  isBackendEngineError,
} from '../../lib/artifacts';
import {
  getPersonaOption,
  getRoutingModeOption,
} from '../../utils/onyxState';
import { OnyxOrb } from '../common/OnyxOrb';
import { CodeBlock } from './CodeBlock';

interface MessageRendererProps {
  messageId: string;
  content: string;
  mode: RoutingModeId;
  persona: PersonaId;
  timestamp: string;
  thinkingLog?: string;
  thinkingDuration?: string;
  mediaCards?: MediaCard[];
  sources?: SourceItem[];
  pdfVault?: PdfVaultInfo | null;
  generatedImage?: GeneratedImageArtifact;
  shouldAnimateReveal?: boolean;
  onRegenerate?: () => void;
  onSaveToVault?: () => void;
  onBranchChat?: () => void;
  onExportPdf?: () => void;
}

interface LightboxState {
  url: string;
  title: string;
  caption?: string;
}

async function copyMarkdownText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
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

async function triggerImageDownload(url: string, label: string): Promise<void> {
  const filename = formatDownloadFilename(label, 'png');
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (response.ok) {
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      return;
    }
  } catch {
    // Fall back to direct anchor when cross-origin fetch is restricted
  }

  const fallbackAnchor = document.createElement('a');
  fallbackAnchor.href = url;
  fallbackAnchor.download = filename;
  fallbackAnchor.target = '_blank';
  fallbackAnchor.rel = 'noopener noreferrer';
  document.body.appendChild(fallbackAnchor);
  fallbackAnchor.click();
  document.body.removeChild(fallbackAnchor);
}

export function OnyxErrorCard({
  onRetry,
  message = FRIENDLY_ENGINE_ERROR_MESSAGE,
  diagnostic,
}: {
  onRetry?: () => void;
  message?: string;
  diagnostic?: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-2xl border border-red-500/25 bg-[#1C1214] p-4 sm:flex-row sm:items-center sm:justify-between onyx-fade-up"
    >
      <div className="flex min-w-0 items-start gap-3">
        <WarningCircle
          size={19}
          weight="regular"
          className="mt-0.5 shrink-0 text-red-400"
        />
        <div className="min-w-0 space-y-1">
          <p className="font-sans text-sm leading-relaxed text-red-100/90 text-pretty">
            {message}
          </p>
          {diagnostic && (
            <p className="break-words font-mono text-[11px] leading-snug text-red-200/50">
              {diagnostic}
            </p>
          )}
        </div>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-red-400/25 bg-red-500/15 px-4 font-sans text-xs font-medium text-red-100 hover:bg-red-500/25 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 transition-transform duration-150"
        >
          <ArrowClockwise size={14} weight="bold" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
}

export function OnyxThinkingPulse({
  statusLabel,
  modeLabel,
  personaName,
}: {
  statusLabel: string;
  modeLabel: string;
  personaName: string;
}) {
  return (
    <div
      role="status"
      aria-label={statusLabel}
      className="space-y-2.5 onyx-fade-up"
    >
      <div className="flex items-center gap-1.5 font-mono text-xs text-white/50">
        <span className="font-medium text-white/80">{modeLabel}</span>
        <span aria-hidden="true">·</span>
        <span>{personaName}</span>
      </div>

      <div className="inline-flex items-center gap-3 rounded-2xl border border-blue-400/20 bg-[#12141C] px-3.5 py-2.5">
        <OnyxOrb size="mini" animate />
        <span className="font-mono text-xs font-medium text-blue-100/85 onyx-status-shimmer">
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

function ThinkingAuditAccordion({
  thinkingLog,
  duration,
}: {
  thinkingLog: string;
  duration?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#131209] p-2">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        className="flex min-h-[40px] w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-white/80 hover:bg-[#272727] hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Brain size={15} weight="regular" className="shrink-0 text-white/75" />
          <span className="truncate font-medium text-white/90">
            View Multi-Agent Thinking &amp; Audit
          </span>
          {duration && (
            <>
              <span aria-hidden="true" className="text-white/35">
                ·
              </span>
              <span className="shrink-0 font-mono text-white/50 tabular-nums">
                {duration}
              </span>
            </>
          )}
        </span>
        <CaretDown
          size={13}
          weight="bold"
          className={`shrink-0 text-white/55 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isExpanded ? 'rotate-180' : 'rotate-0'
          }`}
        />
      </button>

      {isExpanded && (
        <div className="mt-1.5 rounded-xl border border-white/[0.08] bg-[#000000]/60 p-3">
          <pre className="m-0 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-white/75">
            {thinkingLog}
          </pre>
        </div>
      )}
    </div>
  );
}

function GalleryCard({
  card,
  onOpenLightbox,
}: {
  card: MediaCard;
  onOpenLightbox: (item: LightboxState) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const src = card.imageUrl || card.url || '';
  const title = card.title || card.caption || 'Media visual';

  return (
    <button
      type="button"
      onClick={() => {
        if (src) {
          onOpenLightbox({ url: src, title, caption: card.caption });
        }
      }}
      aria-label={`Inspect ${title}`}
      className="group relative w-44 shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-[#1F1F1F] text-left hover:bg-[#272727] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:w-52"
    >
      <div className="relative h-32 w-full bg-[#181818]">
        {src && !imgFailed ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 bg-[#272727] animate-pulse" />
            )}
            <img
              src={src}
              alt={title}
              referrerPolicy="no-referrer"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgFailed(true)}
              className={`h-full w-full object-cover transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                imgLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-3 text-center">
            <ImageIcon size={20} weight="regular" className="text-white/50" />
            <span className="truncate font-mono text-xs text-white/50">
              {card.kind || 'Visual'}
            </span>
          </div>
        )}
      </div>

      {(card.title || card.caption) && (
        <div className="p-2.5">
          <div className="truncate text-xs font-medium text-white">
            {card.title || card.caption}
          </div>
          {card.title && card.caption && (
            <div className="mt-0.5 truncate text-xs text-white/50">
              {card.caption}
            </div>
          )}
        </div>
      )}
    </button>
  );
}

function GeneratedImageCard({
  artifact,
  onOpenLightbox,
}: {
  artifact: GeneratedImageArtifact;
  onOpenLightbox: (item: LightboxState) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const imageSrc =
    attempt === 0 ? artifact.url : `${artifact.url}&seed=${attempt}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#181818]">
      <div className="relative aspect-square w-full max-h-[380px] bg-[#1F1F1F]">
        {!loaded && !failed && (
          <div
            role="status"
            aria-label="Generating image"
            className="absolute inset-0 flex flex-col justify-between p-4 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-28 rounded-md bg-[#272727]" />
              <div className="h-3.5 w-14 rounded-md bg-[#272727]" />
            </div>
            <div className="space-y-2">
              <div className="h-3.5 w-3/4 rounded-md bg-[#272727]" />
              <div className="h-3.5 w-1/2 rounded-md bg-[#272727]" />
            </div>
          </div>
        )}

        {failed ? (
          <div className="flex h-full min-h-[220px] w-full flex-col items-center justify-center gap-3 p-6 text-center">
            <ImageIcon size={24} weight="regular" className="text-white/50" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">
                Image preview could not load
              </p>
              <p className="font-mono text-xs text-white/50">
                Pollinations Flux endpoint may be busy.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFailed(false);
                setLoaded(false);
                setAttempt((prev) => prev + 1);
              }}
              className="flex h-9 items-center rounded-xl border border-white/[0.08] bg-[#272727] px-3.5 text-xs font-medium text-white hover:bg-[#313131] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              Retry render
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() =>
              onOpenLightbox({
                url: imageSrc,
                title: artifact.prompt,
                caption: 'Generated via Pollinations Flux',
              })
            }
            aria-label="Open generated image fullscreen"
            className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            <img
              src={imageSrc}
              alt={artifact.prompt}
              referrerPolicy="no-referrer"
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
              className={`h-full w-full object-cover transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                loaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 bg-[#1F1F1F] px-3.5 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-white">
            {artifact.prompt}
          </div>
          <div className="mt-0.5 font-mono text-xs text-white/45">
            {loaded ? 'Flux · Ready' : failed ? 'Flux · Unavailable' : 'Flux · Rendering'}
          </div>
        </div>

        <button
          type="button"
          onClick={() => triggerImageDownload(imageSrc, artifact.prompt)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#272727] px-3 text-xs font-medium text-white hover:bg-[#313131] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        >
          <DownloadSimple size={15} weight="bold" />
          <span>Download</span>
        </button>
      </div>
    </div>
  );
}

export function MessageRenderer({
  content,
  mode,
  persona,
  timestamp,
  thinkingLog,
  thinkingDuration,
  mediaCards,
  sources,
  pdfVault,
  generatedImage,
  shouldAnimateReveal = false,
  onRegenerate,
  onSaveToVault,
  onBranchChat,
  onExportPdf,
}: MessageRendererProps) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [copiedAnswer, setCopiedAnswer] = useState(false);
  const [savedToVault, setSavedToVault] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Fast silky word-chunk reveal for newly arrived live responses
  const [revealedContent, setRevealedContent] = useState<string>(() =>
    shouldAnimateReveal && !isBackendEngineError(content) ? '' : content
  );
  const [isRevealDone, setIsRevealDone] = useState<boolean>(
    () => !shouldAnimateReveal || isBackendEngineError(content)
  );

  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shouldAnimateReveal || isBackendEngineError(content)) {
      setRevealedContent(content);
      setIsRevealDone(true);
      return;
    }

    const tokens = content.split(/(\s+)/);
    if (tokens.length <= 8) {
      setRevealedContent(content);
      setIsRevealDone(true);
      return;
    }

    setRevealedContent('');
    setIsRevealDone(false);

    const stepSize = Math.max(4, Math.ceil(tokens.length / 36));
    let cursor = 0;

    const timer = window.setInterval(() => {
      cursor += stepSize;
      if (cursor >= tokens.length) {
        setRevealedContent(content);
        setIsRevealDone(true);
        window.clearInterval(timer);
      } else {
        setRevealedContent(tokens.slice(0, cursor).join(''));
      }
    }, 22);

    return () => window.clearInterval(timer);
  }, [content, shouldAnimateReveal]);

  useEffect(() => {
    if (!lightbox) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setLightbox(null);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [lightbox]);

  useEffect(() => {
    if (!isMoreOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMoreOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMoreOpen]);

  const pdfMessageId = extractPdfMessageId(pdfVault);
  const modeLabel = getRoutingModeOption(mode).label;
  const personaName = getPersonaOption(persona).name;

  async function handleCopyAnswer() {
    const ok = await copyMarkdownText(content);
    if (ok) {
      setCopiedAnswer(true);
      window.setTimeout(() => setCopiedAnswer(false), 2000);
    }
  }

  function handleSaveVaultClick() {
    onSaveToVault?.();
    setSavedToVault(true);
    window.setTimeout(() => setSavedToVault(false), 2200);
  }

  // Intercept backend error text payloads cleanly with tiny diagnostic line
  if (isBackendEngineError(content)) {
    return (
      <OnyxErrorCard
        diagnostic={extractErrorDiagnostic(content)}
        onRetry={onRegenerate}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* 1. Thinking & Audit Accordion */}
      {thinkingLog && (
        <ThinkingAuditAccordion
          thinkingLog={thinkingLog}
          duration={thinkingDuration}
        />
      )}

      {/* 2. Rich Media Gallery (horizontally scrollable above text) */}
      {mediaCards && mediaCards.length > 0 && (
        <div
          aria-label="Media gallery"
          className="flex w-full gap-2.5 overflow-x-auto pb-1"
        >
          {mediaCards.map((card, idx) => (
            <GalleryCard
              key={`gallery-${idx}`}
              card={card}
              onOpenLightbox={setLightbox}
            />
          ))}
        </div>
      )}

      {/* 3. Pollinations Generated Image Card */}
      {generatedImage && (
        <GeneratedImageCard
          artifact={generatedImage}
          onOpenLightbox={setLightbox}
        />
      )}

      {/* 4. Rich Editorial Serif Markdown Answer (Claude-style Source Serif 4) */}
      {revealedContent && (
        <div
          className={`min-w-0 max-w-full space-y-3.5 font-serif text-[15.5px] leading-[1.72] text-zinc-100/95 sm:text-[16.5px] ${
            shouldAnimateReveal ? 'onyx-chunk-in' : ''
          }`}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="pt-1.5 font-serif text-2xl font-medium tracking-tight text-white text-balance">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="pt-1.5 font-serif text-xl font-medium tracking-tight text-white text-balance">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="pt-1 font-serif text-lg font-medium text-white text-balance">
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="font-serif text-pretty leading-[1.72] text-zinc-100/92">
                  {children}
                </p>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-white">{children}</strong>
              ),
              em: ({ children }) => (
                <span className="font-medium text-white">{children}</span>
              ),
              ul: ({ children }) => (
                <ul className="list-disc space-y-1.5 pl-5 font-serif text-zinc-100/90">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal space-y-1.5 pl-5 font-serif text-zinc-100/90">
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="text-pretty leading-[1.7]">{children}</li>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-300 underline decoration-blue-300/40 underline-offset-4 hover:text-blue-200 hover:decoration-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40"
                >
                  {children}
                </a>
              ),
              blockquote: ({ children }) => (
                <blockquote className="rounded-2xl border border-white/[0.08] bg-[#121216] px-4 py-3 font-serif text-[15px] leading-relaxed text-zinc-300">
                  {children}
                </blockquote>
              ),
              table: ({ children }) => (
                <div className="my-3 w-full overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#141418] font-sans">
                  <table className="w-full border-collapse text-left text-xs sm:text-sm">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-[#1F1F1F] text-white">{children}</thead>
              ),
              th: ({ children }) => (
                <th className="px-3.5 py-2.5 font-semibold whitespace-nowrap text-white/90">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-3.5 py-2.5 text-white/75 tabular-nums">
                  {children}
                </td>
              ),
              tr: ({ children }) => (
                <tr className="odd:bg-[#181818] even:bg-[#1F1F1F]/50">
                  {children}
                </tr>
              ),
              pre: ({ children }) => <>{children}</>,
              code: ({ className, children }) => {
                const match = /language-([a-zA-Z0-9_-]+)/.exec(className || '');
                const text = String(children).replace(/\n$/, '');
                const isFenced = Boolean(match) || text.includes('\n');

                if (isFenced) {
                  return <CodeBlock code={text} language={match?.[1] || 'text'} />;
                }

                return (
                  <code className="rounded-md border border-white/[0.08] bg-[#1F1F1F] px-1.5 py-0.5 font-mono text-xs text-white/90">
                    {children}
                  </code>
                );
              },
            }}
          >
            {revealedContent}
          </ReactMarkdown>
        </div>
      )}

      {/* 5. Web Source Chips (below answer) */}
      {sources && sources.length > 0 && (
        <div
          aria-label="Web sources"
          className="flex flex-wrap items-center gap-2 pt-1"
        >
          {sources.map((source, idx) =>
            source.url ? (
              <a
                key={`source-chip-${idx}`}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[36px] max-w-full items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#1F1F1F] px-3 py-1.5 text-xs font-medium text-white/85 hover:bg-[#313131] hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              >
                <Globe size={13} weight="regular" className="shrink-0 text-white/55" />
                <span className="truncate">{source.title}</span>
                <ArrowUpRight
                  size={12}
                  weight="bold"
                  className="shrink-0 text-white/50"
                />
              </a>
            ) : (
              <span
                key={`source-chip-${idx}`}
                className="inline-flex min-h-[36px] max-w-full items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#1F1F1F] px-3 py-1.5 text-xs font-medium text-white/75"
              >
                <Globe size={13} weight="regular" className="shrink-0 text-white/55" />
                <span className="truncate">{source.title}</span>
              </span>
            )
          )}
        </div>
      )}

      {/* 6. Telegram PDF Vault Status Pill */}
      {pdfVault && (
        <div className="pt-1">
          <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-white/[0.08] bg-[#131209] px-3.5 py-1.5 text-xs text-white/90">
            <PaperPlaneTilt
              size={14}
              weight="regular"
              className="shrink-0 text-white/80"
            />
            <span className="font-medium">PDF Saved to Telegram Vault</span>
            {pdfMessageId && (
              <>
                <span aria-hidden="true" className="text-white/35">
                  ·
                </span>
                <span className="font-mono text-white/65 tabular-nums">
                  ID #{pdfMessageId}
                </span>
              </>
            )}
            {pdfVault.url && (
              <a
                href={pdfVault.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-xs text-white underline decoration-white/35 underline-offset-4 hover:decoration-white"
              >
                <span>Open</span>
                <ArrowUpRight size={12} weight="bold" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* 7. Assistant Message Action Bar (fades in after reveal completes) */}
      <div
        className={`flex flex-wrap items-center gap-1 pt-1 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isRevealDone
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-1 opacity-0'
        }`}
      >
        <button
          type="button"
          onClick={handleCopyAnswer}
          aria-label={copiedAnswer ? 'Answer copied' : 'Copy answer'}
          title={copiedAnswer ? 'Copied' : 'Copy'}
          className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs text-white/55 hover:bg-[#1F1F1F] hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-transform duration-150"
        >
          {copiedAnswer ? (
            <>
              <Check size={15} weight="bold" className="text-white" />
              <span className="text-white">Copied</span>
            </>
          ) : (
            <Copy size={16} weight="regular" />
          )}
        </button>

        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            aria-label="Regenerate response"
            title="Regenerate"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white/55 hover:bg-[#1F1F1F] hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-transform duration-150"
          >
            <ArrowClockwise size={16} weight="regular" />
          </button>
        )}

        {onSaveToVault && (
          <button
            type="button"
            onClick={handleSaveVaultClick}
            aria-label={savedToVault ? 'Saved to vault' : 'Save to vault'}
            title="Save to Vault"
            className={`flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              savedToVault
                ? 'border border-white/[0.12] bg-[#131209] text-white'
                : 'text-white/55 hover:bg-[#1F1F1F] hover:text-white'
            }`}
          >
            {savedToVault ? (
              <>
                <Check size={15} weight="bold" />
                <span>Saved</span>
              </>
            ) : (
              <Vault size={16} weight="regular" />
            )}
          </button>
        )}

        {/* More (...) compact dark menu */}
        <div ref={moreRef} className="relative">
          <button
            type="button"
            onClick={() => setIsMoreOpen((prev) => !prev)}
            aria-label="More response actions"
            aria-expanded={isMoreOpen}
            aria-haspopup="menu"
            title="More"
            className={`flex h-9 w-9 items-center justify-center rounded-xl active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isMoreOpen
                ? 'border border-white/[0.08] bg-[#272727] text-white'
                : 'text-white/55 hover:bg-[#1F1F1F] hover:text-white'
            }`}
          >
            <DotsThree size={19} weight="bold" />
          </button>

          <div
            role="menu"
            aria-label="Additional response actions"
            aria-hidden={!isMoreOpen}
            className={`absolute right-0 bottom-11 z-30 w-52 rounded-2xl border border-white/[0.08] bg-[#1F1F1F] p-1.5 shadow-2xl transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isMoreOpen
                ? 'visible pointer-events-auto translate-y-0 scale-100 opacity-100'
                : 'invisible pointer-events-none translate-y-1 scale-95 opacity-0'
            }`}
          >
            {onBranchChat && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsMoreOpen(false);
                  onBranchChat();
                }}
                className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-white/85 hover:bg-[#313131] hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                <GitBranch size={15} weight="regular" className="shrink-0 text-white/65" />
                <span>Branch in new chat</span>
              </button>
            )}

            {onExportPdf && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsMoreOpen(false);
                  onExportPdf();
                }}
                className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-white/85 hover:bg-[#313131] hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                <FilePdf size={15} weight="regular" className="shrink-0 text-white/65" />
                <span>Export PDF</span>
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setShowDetails((prev) => !prev);
                setIsMoreOpen(false);
              }}
              className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-white/85 hover:bg-[#313131] hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              <Info size={15} weight="regular" className="shrink-0 text-white/65" />
              <span>Response details</span>
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Response Details panel */}
      {showDetails && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/[0.08] bg-[#181818] px-3.5 py-2.5 font-mono text-xs text-white/65">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-white/90">{modeLabel}</span>
            <span aria-hidden="true">·</span>
            <span>Persona: {personaName}</span>
            {timestamp && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{timestamp}</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowDetails(false)}
            aria-label="Close response details"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/50 hover:bg-[#313131] hover:text-white"
          >
            <X size={13} weight="bold" />
          </button>
        </div>
      )}

      {/* Fullscreen Lightbox Modal for Media Gallery & Generated Images */}
      <div
        aria-hidden={!lightbox}
        className={`fixed inset-0 z-50 flex items-center justify-center p-3 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:p-6 ${
          lightbox
            ? 'visible pointer-events-auto opacity-100'
            : 'invisible pointer-events-none opacity-0'
        }`}
      >
        <div
          onClick={() => setLightbox(null)}
          className="absolute inset-0 bg-[#000000]/90 backdrop-blur-md"
        />

        {lightbox && (
          <section
            role="dialog"
            aria-modal="true"
            aria-label={lightbox.title}
            className="relative z-10 flex max-h-[90dvh] w-full max-w-[820px] flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#181818] p-2 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#1F1F1F] px-4 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">
                  {lightbox.title}
                </div>
                {lightbox.caption && (
                  <div className="truncate text-xs text-white/55">
                    {lightbox.caption}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    triggerImageDownload(lightbox.url, lightbox.title)
                  }
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#272727] px-3 text-xs font-medium text-white hover:bg-[#313131] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  <DownloadSimple size={15} weight="bold" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLightbox(null)}
                  aria-label="Close image viewer"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-[#272727] text-white/80 hover:bg-[#313131] hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  <X size={16} weight="regular" />
                </button>
              </div>
            </div>

            <div className="mt-2 flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-[#000000] p-2">
              <img
                src={lightbox.url}
                alt={lightbox.title}
                referrerPolicy="no-referrer"
                className="max-h-[72dvh] w-auto max-w-full rounded-xl object-contain"
              />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
