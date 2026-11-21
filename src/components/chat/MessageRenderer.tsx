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
  GitBranch,
  Globe,
  Image as ImageIcon,
  Info,
  X,
} from '@phosphor-icons/react';
import type {
  EngineMode,
  GeneratedImageArtifact,
  MediaCard,
  PersonaId,
  RoutingModeId,
  SourceItem,
} from '../../types/onyx';
import { formatDownloadFilename } from '../../lib/artifacts';
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
  engine?: EngineMode;
  timestamp: string;
  thinkingLog?: string;
  thinkingDuration?: string;
  mediaCards?: MediaCard[];
  sources?: SourceItem[];
  generatedImage?: GeneratedImageArtifact;
  shouldAnimateReveal?: boolean;
  isStreamingLive?: boolean;
  onRegenerate?: () => void;
  onBranchChat?: () => void;
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
      <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-500">
        <span className="font-medium text-zinc-300">{modeLabel}</span>
        <span aria-hidden="true">·</span>
        <span>{personaName}</span>
      </div>

      <div className="inline-flex items-center gap-3 rounded-2xl bg-[#10121A] px-3.5 py-2.5">
        <OnyxOrb size="mini" animate />
        <span className="font-sans text-xs font-medium text-blue-100/90 onyx-status-shimmer">
          {statusLabel}
        </span>
        <span aria-hidden="true" className="flex items-center gap-1 pl-0.5">
          <span
            style={{ animationDelay: '0ms' }}
            className="h-1.5 w-1.5 rounded-full bg-blue-400 onyx-typing-dot"
          />
          <span
            style={{ animationDelay: '150ms' }}
            className="h-1.5 w-1.5 rounded-full bg-blue-300 onyx-typing-dot"
          />
          <span
            style={{ animationDelay: '300ms' }}
            className="h-1.5 w-1.5 rounded-full bg-sky-300 onyx-typing-dot"
          />
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
    <div className="rounded-2xl bg-[#111116] p-1.5">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        className="flex min-h-[38px] w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/[0.05] hover:text-white active:scale-[0.98] transition-colors duration-150"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Brain size={15} weight="regular" className="shrink-0 text-blue-400" />
          <span className="truncate font-medium text-zinc-200">
            View Reasoning Log
          </span>
          {duration && (
            <>
              <span aria-hidden="true" className="text-zinc-600">
                ·
              </span>
              <span className="shrink-0 font-mono text-zinc-500 tabular-nums">
                {duration}
              </span>
            </>
          )}
        </span>
        <CaretDown
          size={13}
          weight="bold"
          className={`shrink-0 text-zinc-500 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : 'rotate-0'
          }`}
        />
      </button>

      {isExpanded && (
        <div className="mt-1.5 rounded-xl bg-[#07070A] p-3">
          <pre className="m-0 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-zinc-400">
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
      className="group relative w-44 shrink-0 overflow-hidden rounded-2xl bg-[#131318] text-left hover:bg-[#1B1B22] active:scale-[0.97] transition-transform duration-150 sm:w-52"
    >
      <div className="relative h-32 w-full bg-[#0D0D11]">
        {src && !imgFailed ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 bg-[#1B1B22] animate-pulse" />
            )}
            <img
              src={src}
              alt={title}
              referrerPolicy="no-referrer"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgFailed(true)}
              className={`h-full w-full object-cover transition-opacity duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                imgLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-3 text-center">
            <ImageIcon size={20} weight="regular" className="text-zinc-500" />
            <span className="truncate font-mono text-xs text-zinc-500">
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
            <div className="mt-0.5 truncate text-xs text-zinc-400">
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
    <div className="overflow-hidden rounded-2xl bg-[#121217]">
      <div className="relative aspect-square w-full max-h-[380px] bg-[#16161C]">
        {!loaded && !failed && (
          <div
            role="status"
            aria-label="Generating image"
            className="absolute inset-0 flex flex-col justify-between p-4 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-28 rounded-md bg-white/[0.06]" />
              <div className="h-3.5 w-14 rounded-md bg-white/[0.06]" />
            </div>
            <div className="space-y-2">
              <div className="h-3.5 w-3/4 rounded-md bg-white/[0.06]" />
              <div className="h-3.5 w-1/2 rounded-md bg-white/[0.06]" />
            </div>
          </div>
        )}

        {failed ? (
          <div className="flex h-full min-h-[220px] w-full flex-col items-center justify-center gap-3 p-6 text-center">
            <ImageIcon size={24} weight="regular" className="text-zinc-500" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">
                Image preview could not load
              </p>
              <p className="font-mono text-xs text-zinc-500">
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
              className="flex h-9 items-center rounded-xl bg-white/[0.08] px-3.5 text-xs font-medium text-white hover:bg-white/[0.14] active:scale-[0.97]"
            >
              Try again
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
            className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
          >
            <img
              src={imageSrc}
              alt={artifact.prompt}
              referrerPolicy="no-referrer"
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
              className={`h-full w-full object-cover transition-opacity duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                loaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 bg-[#15151C] px-3.5 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-white">
            {artifact.prompt}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-zinc-400">
            {loaded ? 'Flux · Ready' : failed ? 'Flux · Unavailable' : 'Flux · Rendering'}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void triggerImageDownload(imageSrc, artifact.prompt)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-white/[0.08] px-3 text-xs font-medium text-white hover:bg-white/[0.14] active:scale-[0.96] transition-transform duration-150"
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
  engine = 'cloud',
  timestamp,
  thinkingLog,
  thinkingDuration,
  mediaCards,
  sources,
  generatedImage,
  shouldAnimateReveal = false,
  isStreamingLive = false,
  onRegenerate,
  onBranchChat,
}: MessageRendererProps) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [copiedAnswer, setCopiedAnswer] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Instant token-by-token streaming feel for newly arrived replies
  const [revealedContent, setRevealedContent] = useState<string>(() =>
    shouldAnimateReveal && !isStreamingLive ? '' : content
  );
  const [isRevealDone, setIsRevealDone] = useState<boolean>(
    () => !shouldAnimateReveal && !isStreamingLive
  );

  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isStreamingLive) {
      setRevealedContent(content);
      setIsRevealDone(false);
      return;
    }

    if (!shouldAnimateReveal) {
      setRevealedContent(content);
      setIsRevealDone(true);
      return;
    }

    const tokens = content.split(/(\s+)/);
    if (tokens.length <= 4) {
      setRevealedContent(content);
      setIsRevealDone(true);
      return;
    }

    setRevealedContent('');
    setIsRevealDone(false);

    const stepSize = Math.max(2, Math.ceil(tokens.length / 42));
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
    }, 16);

    return () => window.clearInterval(timer);
  }, [content, shouldAnimateReveal, isStreamingLive]);

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

  const modeLabel =
    engine === 'local' ? 'Local AI' : getRoutingModeOption(mode).label;
  const personaName = getPersonaOption(persona).name;

  async function handleCopyAnswer() {
    const ok = await copyMarkdownText(content);
    if (ok) {
      setCopiedAnswer(true);
      window.setTimeout(() => setCopiedAnswer(false), 2000);
    }
  }

  return (
    <div className="space-y-3">
      {/* 1. Reasoning Log Accordion */}
      {thinkingLog && (
        <ThinkingAuditAccordion
          thinkingLog={thinkingLog}
          duration={thinkingDuration}
        />
      )}

      {/* 2. Rich Media Gallery */}
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

      {/* 4. Fluid Borderless Editorial Serif Markdown Answer */}
      {revealedContent && (
        <div
          className={`min-w-0 max-w-full space-y-3.5 font-serif text-[15.5px] leading-[1.74] text-zinc-100/95 sm:text-[16.5px] ${
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
                <p className="break-words font-serif text-pretty leading-[1.74] text-zinc-100/92">
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
                <li className="break-words text-pretty leading-[1.7]">
                  {children}
                </li>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-300 underline decoration-blue-300/40 underline-offset-4 hover:text-blue-200 hover:decoration-blue-200"
                >
                  {children}
                </a>
              ),
              blockquote: ({ children }) => (
                <blockquote className="rounded-2xl bg-[#111116] px-4 py-3 font-serif text-[15px] leading-relaxed text-zinc-300">
                  {children}
                </blockquote>
              ),
              table: ({ children }) => (
                <div className="my-3 w-full overflow-x-auto rounded-2xl bg-[#111116] font-sans">
                  <table className="w-full border-collapse text-left text-xs sm:text-sm">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-[#181820] text-white">{children}</thead>
              ),
              th: ({ children }) => (
                <th className="px-3.5 py-2.5 font-semibold whitespace-nowrap text-white/90">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-3.5 py-2.5 text-zinc-300 tabular-nums">
                  {children}
                </td>
              ),
              tr: ({ children }) => (
                <tr className="odd:bg-[#111116] even:bg-[#15151C]">
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
                  <code className="rounded-md bg-[#181820] px-1.5 py-0.5 font-mono text-xs text-zinc-100">
                    {children}
                  </code>
                );
              },
            }}
          >
            {revealedContent}
          </ReactMarkdown>
          {isStreamingLive && (
            <span
              aria-hidden="true"
              className="inline-block h-4 w-1.5 animate-pulse rounded-sm bg-blue-400 align-middle"
            />
          )}
        </div>
      )}

      {/* 5. Web Source Chips */}
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
                className="inline-flex min-h-[34px] max-w-full items-center gap-1.5 rounded-full bg-[#15151C] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-[#1F1F29] hover:text-white active:scale-[0.97] transition-transform duration-150"
              >
                <Globe size={13} weight="regular" className="shrink-0 text-blue-400" />
                <span className="truncate">{source.title}</span>
                <ArrowUpRight
                  size={12}
                  weight="bold"
                  className="shrink-0 text-zinc-400"
                />
              </a>
            ) : (
              <span
                key={`source-chip-${idx}`}
                className="inline-flex min-h-[34px] max-w-full items-center gap-1.5 rounded-full bg-[#15151C] px-3 py-1.5 text-xs font-medium text-zinc-300"
              >
                <Globe size={13} weight="regular" className="shrink-0 text-zinc-400" />
                <span className="truncate">{source.title}</span>
              </span>
            )
          )}
        </div>
      )}

      {/* 6. Clean Assistant Action Bar (positioned so More popover NEVER overlaps text or clips at 390px) */}
      <div
        className={`flex flex-wrap items-center gap-1 pt-1 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isRevealDone
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-1 opacity-0'
        }`}
      >
        <button
          type="button"
          onClick={() => void handleCopyAnswer()}
          aria-label={copiedAnswer ? 'Answer copied' : 'Copy answer'}
          title={copiedAnswer ? 'Copied' : 'Copy'}
          className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs text-zinc-400 hover:bg-white/[0.06] hover:text-white active:scale-[0.96] transition-transform duration-150"
        >
          {copiedAnswer ? (
            <>
              <Check size={15} weight="bold" className="text-emerald-400" />
              <span className="text-zinc-200">Copied</span>
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
            className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/[0.06] hover:text-white active:scale-[0.96] transition-transform duration-150"
          >
            <ArrowClockwise size={16} weight="regular" />
          </button>
        )}

        {/* More (...) menu anchored cleanly above-left so it never clips off-screen or covers text */}
        <div ref={moreRef} className="relative">
          <button
            type="button"
            onClick={() => setIsMoreOpen((prev) => !prev)}
            aria-label="More response actions"
            aria-expanded={isMoreOpen}
            aria-haspopup="menu"
            title="More"
            className={`flex h-9 w-9 items-center justify-center rounded-xl active:scale-[0.96] transition-colors duration-150 ${
              isMoreOpen
                ? 'bg-white/[0.1] text-white'
                : 'text-zinc-400 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            <DotsThree size={19} weight="bold" />
          </button>

          <div
            role="menu"
            aria-label="Additional response actions"
            aria-hidden={!isMoreOpen}
            className={`absolute left-0 top-10 z-40 min-w-[196px] rounded-2xl bg-[#14141C] p-1.5 shadow-2xl transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isMoreOpen
                ? 'visible pointer-events-auto translate-y-0 scale-100 opacity-100'
                : 'invisible pointer-events-none -translate-y-1 scale-95 opacity-0'
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
                className="flex min-h-[38px] w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-left text-xs font-medium text-zinc-200 hover:bg-white/[0.08] hover:text-white active:scale-[0.97]"
              >
                <GitBranch size={15} weight="regular" className="shrink-0 text-blue-400" />
                <span>Branch in new chat</span>
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setShowDetails((prev) => !prev);
                setIsMoreOpen(false);
              }}
              className="flex min-h-[38px] w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-left text-xs font-medium text-zinc-200 hover:bg-white/[0.08] hover:text-white active:scale-[0.97]"
            >
              <Info size={15} weight="regular" className="shrink-0 text-zinc-400" />
              <span>Response details</span>
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Response Details panel */}
      {showDetails && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#111116] px-3.5 py-2.5 font-mono text-xs text-zinc-400">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-zinc-200">{modeLabel}</span>
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
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/[0.08] hover:text-white"
          >
            <X size={13} weight="bold" />
          </button>
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      <div
        aria-hidden={!lightbox}
        className={`fixed inset-0 z-50 flex items-center justify-center p-3 transition-opacity duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] sm:p-6 ${
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
            className="relative z-10 flex max-h-[90dvh] w-full max-w-[820px] flex-col overflow-hidden rounded-3xl bg-[#111116] p-2 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#17171F] px-4 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">
                  {lightbox.title}
                </div>
                {lightbox.caption && (
                  <div className="truncate text-xs text-zinc-400">
                    {lightbox.caption}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    void triggerImageDownload(lightbox.url, lightbox.title)
                  }
                  className="flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.08] px-3 text-xs font-medium text-white hover:bg-white/[0.14] active:scale-[0.96]"
                >
                  <DownloadSimple size={15} weight="bold" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLightbox(null)}
                  aria-label="Close image viewer"
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.08] text-zinc-300 hover:bg-white/[0.14] hover:text-white active:scale-[0.96]"
                >
                  <X size={16} weight="regular" />
                </button>
              </div>
            </div>

            <div className="mt-2 flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-[#000000] p-2">
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
