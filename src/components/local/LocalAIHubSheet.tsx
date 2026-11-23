import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowClockwise,
  ArrowUpRight,
  Check,
  Cloud,
  Copy,
  Cpu,
  DownloadSimple,
  HardDrives,
  Pause,
  Play,
  PlugsConnected,
  Power,
  TerminalWindow,
  Trash,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import localModelsRaw from '../../data/localModels.json';
import { checkLocalServerHealth } from '../../lib/api';
import { isValidHttpUrl } from '../../lib/artifacts';
import {
  cancelNativeModelDownload,
  deleteNativeModel,
  formatBytesCompact,
  formatMB,
  getNativeDownloadedModels,
  hasEnoughStorageForModel,
  isNativeLocalLLMAvailable,
  loadNativeModel,
  parseModelSizeToBytes,
  pauseNativeModelDownload,
  importNativeModelFromFile,
  startNativeModelDownload,
  subscribeToNativeDownloadProgress,
  unloadNativeModel,
} from '../../lib/localLLM';
import type {
  DownloadedLocalModel,
  EngineMode,
  LocalLLMDownloadProgressEvent,
  LocalModelEntry,
  LocalServerConfig,
  LocalServerStatus,
  PartialLocalModelDownload,
} from '../../types/onyx';

const LOCAL_MODELS = localModelsRaw as LocalModelEntry[];

type LocalHubTab = 'models' | 'server';
type ModelCategoryFilter = 'all' | 'general' | 'uncensored';

interface LocalAIHubSheetProps {
  isOpen: boolean;
  onClose: () => void;
  engineMode: EngineMode;
  onChangeEngineMode: (mode: EngineMode) => void;
  config: LocalServerConfig;
  onChangeConfig: (next: LocalServerConfig) => void;
  serverStatus: LocalServerStatus;
  serverLatencyMs: number | null;
  onUpdateServerStatus: (
    status: LocalServerStatus,
    latencyMs: number | null
  ) => void;
  loadedNativeModel: string | null;
  onChangeLoadedNativeModel: (fileName: string | null) => void;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export function LocalAIHubSheet({
  isOpen,
  onClose,
  engineMode,
  onChangeEngineMode,
  config,
  onChangeConfig,
  serverStatus,
  serverLatencyMs,
  onUpdateServerStatus,
  loadedNativeModel,
  onChangeLoadedNativeModel,
}: LocalAIHubSheetProps) {
  const nativeAvailable = isNativeLocalLLMAvailable();

  const [activeTab, setActiveTab] = useState<LocalHubTab>('models');
  const [categoryFilter, setCategoryFilter] =
    useState<ModelCategoryFilter>('all');
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string>(
    LOCAL_MODELS[0]?.fileName ?? 'qwen2.5-3b-instruct-q4_k_m.gguf'
  );
  const [urlError, setUrlError] = useState<string | null>(null);

  // Native GGUF inventory, downloads & storage state
  const [downloadedModels, setDownloadedModels] = useState<
    DownloadedLocalModel[]
  >([]);
  const [partialDownloads, setPartialDownloads] = useState<
    Record<string, PartialLocalModelDownload>
  >({});
  const [downloadProgressMap, setDownloadProgressMap] = useState<
    Record<string, LocalLLMDownloadProgressEvent>
  >({});
  const [availableStorageBytes, setAvailableStorageBytes] = useState<number>(0);
  const [totalStorageBytes, setTotalStorageBytes] = useState<number>(0);
  const [modelsStorageBytes, setModelsStorageBytes] = useState<number>(0);
  const [loadingModelFile, setLoadingModelFile] = useState<string | null>(null);
  const [deletingModelFile, setDeletingModelFile] = useState<string | null>(
    null
  );
  const [isRefreshingStorage, setIsRefreshingStorage] = useState(false);
  const [hubNotice, setHubNotice] = useState<string | null>(null);
  const [customModelUrl, setCustomModelUrl] = useState("");
  const [isImportingFile, setIsImportingFile] = useState(false);

  const customDownloadedModels = useMemo(() => {
    const presetFiles = new Set(LOCAL_MODELS.map((m) => m.fileName));
    return downloadedModels.filter((d) => !presetFiles.has(d.fileName));
  }, [downloadedModels]);

  async function handlePickLocalGgufFile() {
    if (!nativeAvailable) {
      setHubNotice("Phone file import works inside the installed Android APK.");
      return;
    }
    setIsImportingFile(true);
    setHubNotice("Copying .gguf file to Onyx secure storage...");
    try {
      const res = await importNativeModelFromFile();
      if (res?.imported) {
        setHubNotice(`Imported ${res.fileName} successfully! Tap Load Model below.`);
        await refreshDeviceInventory();
      }
    } catch (err) {
      setHubNotice(err instanceof Error ? err.message : "Could not import .gguf file.");
    } finally {
      setIsImportingFile(false);
    }
  }

  async function handleDownloadCustomUrl() {
    const trimmed = customModelUrl.trim();
    if (!isValidHttpUrl(trimmed) || !trimmed.toLowerCase().includes(".gguf")) {
      setHubNotice("Enter a valid direct .gguf download URL (e.g. HuggingFace resolve/main/...gguf).");
      return;
    }
    const rawSegment = trimmed.split("?")[0].split("/").pop() || `custom_${Date.now()}.gguf`;
    const safeFileName = rawSegment.replace(/[^a-zA-Z0-9._-]/g, "_");
    setCustomModelUrl("");
    setHubNotice(`Starting download for ${safeFileName}...`);
    try {
      await startNativeModelDownload({
        url: trimmed,
        fileName: safeFileName,
        modelId: `custom-${safeFileName}`,
      });
      await refreshDeviceInventory();
    } catch (err) {
      setHubNotice(err instanceof Error ? err.message : "Custom URL download failed.");
    }
  }

  const refreshDeviceInventory = useCallback(async () => {
    setIsRefreshingStorage(true);
    try {
      if (isNativeLocalLLMAvailable()) {
        const inventory = await getNativeDownloadedModels();
        if (inventory) {
          setDownloadedModels(inventory.models ?? []);
          const partialMap: Record<string, PartialLocalModelDownload> = {};
          for (const part of inventory.partials ?? []) {
            partialMap[part.fileName] = part;
          }
          setPartialDownloads(partialMap);
          setAvailableStorageBytes(inventory.availableStorageBytes ?? 0);
          setTotalStorageBytes(inventory.totalStorageBytes ?? 0);
          setModelsStorageBytes(inventory.modelsStorageBytes ?? 0);
          onChangeLoadedNativeModel(inventory.loadedModel ?? null);
        }
      } else if (
        typeof navigator !== 'undefined' &&
        navigator.storage &&
        typeof navigator.storage.estimate === 'function'
      ) {
        const estimate = await navigator.storage.estimate();
        const quota = estimate.quota ?? 0;
        const usage = estimate.usage ?? 0;
        setTotalStorageBytes(quota);
        setAvailableStorageBytes(Math.max(0, quota - usage));
        setModelsStorageBytes(0);
      }
    } catch {
      // Keep previous inventory cleanly
    } finally {
      setIsRefreshingStorage(false);
    }
  }, [onChangeLoadedNativeModel]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setHubNotice(null);
    void refreshDeviceInventory();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, refreshDeviceInventory]);

  // Listen to real-time native download progress events
  useEffect(() => {
    if (!nativeAvailable) {
      return;
    }

    let unsubscribe: (() => void) | null = null;
    let disposed = false;

    subscribeToNativeDownloadProgress((event) => {
      if (disposed) {
        return;
      }
      setDownloadProgressMap((prev) => ({
        ...prev,
        [event.fileName]: event,
      }));

      if (
        event.status === 'completed' ||
        event.status === 'cancelled' ||
        event.status === 'paused' ||
        event.status === 'error'
      ) {
        if (event.status === 'error' && event.error) {
          setHubNotice(event.error);
        }
        if (event.status === 'completed' || event.status === 'cancelled') {
          setDownloadProgressMap((prev) => {
            const next = { ...prev };
            delete next[event.fileName];
            return next;
          });
        }
        void refreshDeviceInventory();
      }
    })
      .then((cleanup) => {
        if (disposed) {
          cleanup?.();
        } else {
          unsubscribe = cleanup;
        }
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [nativeAvailable, refreshDeviceInventory]);

  const downloadedByFile = useMemo(() => {
    const map = new Map<string, DownloadedLocalModel>();
    for (const item of downloadedModels) {
      map.set(item.fileName, item);
    }
    return map;
  }, [downloadedModels]);

  const filteredModels =
    categoryFilter === 'all'
      ? LOCAL_MODELS
      : LOCAL_MODELS.filter((model) => model.category === categoryFilter);

  const termuxCommand = `./llama-server -m ~/models/${selectedFileName} --host 127.0.0.1 --port 8080 -c 4096 --threads 6`;

  async function handleStartOrResumeDownload(model: LocalModelEntry) {
    setHubNotice(null);
    const modelSizeBytes = parseModelSizeToBytes(model.size);
    const partialBytes = partialDownloads[model.fileName]?.downloadedBytes ?? 0;
    const remainingBytes = Math.max(0, modelSizeBytes - partialBytes);

    if (
      availableStorageBytes > 0 &&
      !hasEnoughStorageForModel(availableStorageBytes, remainingBytes)
    ) {
      setHubNotice(
        `Low device storage: ${formatBytesCompact(availableStorageBytes)} free, need at least ${formatBytesCompact(remainingBytes + 350 * 1024 * 1024)} free for ${model.name}.`
      );
      return;
    }

    setDownloadProgressMap((prev) => ({
      ...prev,
      [model.fileName]: {
        modelId: model.id,
        fileName: model.fileName,
        downloadedBytes: partialBytes,
        totalBytes: modelSizeBytes,
        downloadedMB: Math.round((partialBytes / (1024 * 1024)) * 10) / 10,
        totalMB: Math.round((modelSizeBytes / (1024 * 1024)) * 10) / 10,
        progress:
          modelSizeBytes > 0
            ? Math.round((partialBytes / modelSizeBytes) * 1000) / 10
            : 0,
        speedMBps: 0,
        status: 'downloading',
      },
    }));

    try {
      await startNativeModelDownload({
        url: model.huggingfaceUrl,
        fileName: model.fileName,
        modelId: model.id,
      });
      await refreshDeviceInventory();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Download interrupted';
      setHubNotice(message);
      await refreshDeviceInventory();
    }
  }

  async function handlePauseDownload(fileName: string) {
    setHubNotice(null);
    try {
      await pauseNativeModelDownload(fileName);
    } catch {
      // Ignore pause error
    }
  }

  async function handleCancelDownload(fileName: string) {
    setHubNotice(null);
    try {
      await cancelNativeModelDownload(fileName);
      setDownloadProgressMap((prev) => {
        const next = { ...prev };
        delete next[fileName];
        return next;
      });
      await refreshDeviceInventory();
    } catch {
      // Ignore cancel error
    }
  }

  async function handleLoadNativeModel(model: LocalModelEntry) {
    setHubNotice(null);
    setLoadingModelFile(model.fileName);
    try {
      const res = await loadNativeModel({
        fileName: model.fileName,
        nCtx: 2048,
      });
      if (res.loaded) {
        onChangeLoadedNativeModel(res.fileName);
        onChangeConfig({
          ...config,
          modelName: model.fileName,
        });
        onChangeEngineMode('local');
        await refreshDeviceInventory();
      }
    } catch (err) {
      setHubNotice(
        err instanceof Error ? err.message : 'Could not load GGUF model.'
      );
    } finally {
      setLoadingModelFile(null);
    }
  }

  async function handleUnloadNativeModel() {
    setHubNotice(null);
    try {
      await unloadNativeModel();
      onChangeLoadedNativeModel(null);
      await refreshDeviceInventory();
    } catch (err) {
      setHubNotice(
        err instanceof Error ? err.message : 'Could not unload model.'
      );
    }
  }

  async function handleDeleteNativeModel(fileName: string) {
    setHubNotice(null);
    setDeletingModelFile(fileName);
    try {
      await deleteNativeModel(fileName);
      if (loadedNativeModel === fileName) {
        onChangeLoadedNativeModel(null);
      }
      setDownloadProgressMap((prev) => {
        const next = { ...prev };
        delete next[fileName];
        return next;
      });
      await refreshDeviceInventory();
    } catch (err) {
      setHubNotice(
        err instanceof Error ? err.message : 'Could not delete model file.'
      );
    } finally {
      setDeletingModelFile(null);
    }
  }

  async function handleTestConnection() {
    if (!isValidHttpUrl(config.endpointUrl)) {
      setUrlError('Enter a valid http:// or https:// endpoint URL.');
      onUpdateServerStatus('offline', null);
      return;
    }
    setUrlError(null);
    onUpdateServerStatus('checking', null);
    const result = await checkLocalServerHealth(config.endpointUrl);
    if (result.connected) {
      onUpdateServerStatus('connected', result.latencyMs ?? null);
    } else {
      onUpdateServerStatus('offline', null);
    }
  }

  async function handleCopyTermux() {
    const ok = await copyText(termuxCommand);
    if (ok) {
      setCopiedCommand(true);
      window.setTimeout(() => setCopiedCommand(false), 2000);
    }
  }

  function handleSelectModelForServer(model: LocalModelEntry) {
    setSelectedFileName(model.fileName);
    onChangeConfig({
      ...config,
      modelName: model.id,
    });
    setActiveTab('server');
  }

  const statusBadge =
    serverStatus === 'connected'
      ? {
          label: serverLatencyMs ? `Online · ${serverLatencyMs}ms` : 'Online',
          dotClass: 'bg-emerald-400',
          textClass: 'text-emerald-300',
        }
      : serverStatus === 'checking'
        ? {
            label: 'Checking...',
            dotClass: 'bg-[var(--onyx-accent)] animate-pulse',
            textClass: 'text-[var(--onyx-accent-soft)]',
          }
        : serverStatus === 'offline'
          ? {
              label: 'Not reachable',
              dotClass: 'bg-amber-400',
              textClass: 'text-amber-200',
            }
          : {
              label: 'Idle',
              dotClass: 'bg-zinc-500',
              textClass: 'text-zinc-400',
            };

  const storageUsedPercent =
    totalStorageBytes > 0
      ? Math.min(
          100,
          Math.max(
            2,
            Math.round(
              ((totalStorageBytes - availableStorageBytes) /
                totalStorageBytes) *
                100
            )
          )
        )
      : 0;

  return (
    <div
      aria-hidden={!isOpen}
      className={`fixed inset-0 z-50 flex items-end justify-center transition-opacity duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] sm:items-center ${
        isOpen
          ? 'visible pointer-events-auto opacity-100'
          : 'invisible pointer-events-none opacity-0'
      }`}
    >
      <div
        onClick={onClose}
        className="absolute inset-0 bg-[#000000]/80 backdrop-blur-sm"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label="Local AI Engine and GGUF Model Hub"
        className={`relative z-10 flex max-h-[90dvh] w-full max-w-[540px] flex-col overflow-hidden rounded-t-3xl bg-[#09090B] shadow-2xl transition-[transform,opacity] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] sm:m-4 sm:rounded-3xl ${
          isOpen ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}
      >
        {/* Drag handle */}
        <div
          aria-hidden="true"
          className="mx-auto mt-3 mb-2 h-1 w-9 shrink-0 rounded-full bg-white/15 sm:hidden"
        />

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-3 pb-3">
          <div className="min-w-0">
            <h2 className="font-serif text-xl font-medium tracking-tight text-white">
              Local AI Engine
            </h2>
            <p className="mt-0.5 font-sans text-xs text-zinc-400">
              {nativeAvailable
                ? 'Native on-device llama.cpp GGUF inference · Zero external apps'
                : 'On-device GGUF model hub · Web browser falls back to 127.0.0.1:8080'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Local AI hub"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-white/[0.07] hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--onyx-accent)]/50 transition-transform duration-150"
          >
            <X size={18} weight="regular" />
          </button>
        </div>

        {/* Cloud vs Local Active Engine Switcher */}
        <div className="shrink-0 px-5 pb-3">
          <div
            role="tablist"
            aria-label="Active inference engine"
            className="grid grid-cols-2 gap-1.5 rounded-2xl bg-[#131317] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={engineMode === 'cloud'}
              onClick={() => onChangeEngineMode('cloud')}
              className={`flex h-10 items-center justify-center gap-2 rounded-xl font-sans text-xs font-medium active:scale-[0.97] transition-transform duration-150 ${
                engineMode === 'cloud'
                  ? 'onyx-accent-btn text-white shadow-sm '
                  : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <Cloud size={16} weight="regular" />
              <span>Cloud AI</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={engineMode === 'local'}
              onClick={() => onChangeEngineMode('local')}
              className={`flex h-10 items-center justify-center gap-2 rounded-xl font-sans text-xs font-medium active:scale-[0.97] transition-transform duration-150 ${
                engineMode === 'local'
                  ? 'onyx-accent-btn text-white shadow-sm '
                  : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <Cpu size={16} weight="regular" />
              <span>Local AI</span>
            </button>
          </div>
        </div>

        {/* Sub-navigation tabs */}
        <div className="flex shrink-0 items-center gap-2 px-5 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('models')}
            aria-pressed={activeTab === 'models'}
            className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl font-sans text-xs font-medium active:scale-[0.97] transition-colors duration-150 ${
              activeTab === 'models'
                ? 'bg-white/[0.1] text-white'
                : 'onyx-bento-card-subtle text-zinc-400 hover:text-white'
            }`}
          >
            <DownloadSimple size={15} weight="regular" />
            <span>
              GGUF Models ({downloadedModels.length}/{LOCAL_MODELS.length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('server')}
            aria-pressed={activeTab === 'server'}
            className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl font-sans text-xs font-medium active:scale-[0.97] transition-colors duration-150 ${
              activeTab === 'server'
                ? 'bg-white/[0.1] text-white'
                : 'onyx-bento-card-subtle text-zinc-400 hover:text-white'
            }`}
          >
            <HardDrives size={15} weight="regular" />
            <span>Web Server Fallback</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
          {activeTab === 'models' ? (
            <div className="space-y-3.5">
              {/* Native Engine & Device Storage Card */}
              <div className="space-y-3 rounded-2xl onyx-bento-card-subtle p-3.5">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        loadedNativeModel
                          ? 'bg-emerald-400'
                          : nativeAvailable
                            ? 'bg-[var(--onyx-accent)]'
                            : 'bg-zinc-500'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="font-sans text-xs font-medium text-white">
                        {nativeAvailable
                          ? 'Android Native llama.cpp Engine'
                          : 'Browser Mode · Native APK Bridge Ready'}
                      </div>
                      <div className="truncate font-mono text-[11px] text-zinc-400">
                        {loadedNativeModel
                          ? `Loaded in RAM: ${loadedNativeModel}`
                          : nativeAvailable
                            ? 'No GGUF loaded in memory yet'
                            : 'Install Onyx Android APK for direct on-device GGUF execution'}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {loadedNativeModel && nativeAvailable && (
                      <button
                        type="button"
                        onClick={() => void handleUnloadNativeModel()}
                        className="flex h-8 items-center gap-1 rounded-lg bg-white/[0.07] px-2.5 font-sans text-[11px] font-medium text-zinc-200 hover:bg-white/[0.14] active:scale-[0.96] transition-transform duration-150"
                      >
                        <Power size={13} weight="bold" />
                        <span>Unload</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void refreshDeviceInventory()}
                      disabled={isRefreshingStorage}
                      aria-label="Refresh device storage and downloaded models"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-zinc-400 hover:bg-white/[0.1] hover:text-white active:scale-[0.96] disabled:opacity-50"
                    >
                      <ArrowClockwise
                        size={14}
                        weight="bold"
                        className={isRefreshingStorage ? 'animate-spin' : ''}
                      />
                    </button>
                  </div>
                </div>

                {/* Storage Meter */}
                {availableStorageBytes > 0 && (
                  <div className="space-y-1.5 pt-0.5">
                    <div className="flex items-center justify-between gap-2 font-mono text-[11px] tabular-nums">
                      <span className="text-zinc-300">
                        {formatBytesCompact(availableStorageBytes)} free
                      </span>
                      <span className="text-zinc-500">
                        {nativeAvailable
                          ? `Models: ${formatBytesCompact(modelsStorageBytes)}`
                          : `Browser quota: ${formatBytesCompact(totalStorageBytes)}`}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1D1E26]">
                      <div
                        className="h-full rounded-full onyx-accent-btn transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                        style={{ width: `${storageUsedPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Custom .GGUF Importer (Phone Storage + Direct URL) */}
              <div className="space-y-2.5 rounded-2xl border border-white/[0.08] onyx-bento-card-subtle p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-sans text-xs font-semibold text-white">
                      Import Custom .GGUF Model
                    </p>
                    <p className="font-sans text-[11px] text-zinc-400">
                      Load from phone storage or direct HuggingFace URL
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isImportingFile}
                    onClick={() => void handlePickLocalGgufFile()}
                    className="shrink-0 rounded-xl onyx-accent-btn px-3 py-1.5 font-sans text-xs font-medium text-white hover:bg-[var(--onyx-accent)] active:scale-[0.97] disabled:opacity-50"
                  >
                    {isImportingFile ? "Importing..." : "+ Pick File"}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={customModelUrl}
                    onChange={(e) => setCustomModelUrl(e.target.value)}
                    placeholder="https://huggingface.co/.../model.gguf"
                    className="h-9 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#18181D] px-3 font-mono text-[11px] text-white placeholder:text-zinc-500 focus:border-[var(--onyx-accent)]/60 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void handleDownloadCustomUrl()}
                    className="h-9 shrink-0 rounded-xl bg-white/[0.08] px-3 font-sans text-xs font-medium text-white hover:bg-white/[0.14] active:scale-[0.97]"
                  >
                    URL
                  </button>
                </div>

                {customDownloadedModels.length > 0 && (
                  <div className="space-y-2 pt-1.5 border-t border-white/[0.06]">
                    {customDownloadedModels.map((cm) => {
                      const isLoaded = loadedNativeModel === cm.fileName;
                      return (
                        <div
                          key={cm.fileName}
                          className="flex items-center justify-between gap-2 rounded-xl bg-[#18181D] px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-mono text-[11px] text-zinc-100">
                              {cm.fileName}
                            </p>
                            <p className="font-mono text-[10px] text-zinc-400">
                              {formatBytesCompact(cm.sizeBytes)}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                if (isLoaded) {
                                  await unloadNativeModel();
                                  onChangeLoadedNativeModel(null);
                                } else {
                                  setHubNotice(`Loading ${cm.fileName}...`);
                                  const res = await loadNativeModel({ fileName: cm.fileName });
                                  if (res?.loaded) {
                                    onChangeLoadedNativeModel(cm.fileName);
                                    setHubNotice(`${cm.fileName} is now active in RAM!`);
                                  }
                                }
                              }}
                              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${isLoaded ? "bg-emerald-500/20 text-emerald-300" : "onyx-accent-btn text-white"}`}
                            >
                              {isLoaded ? "Unload" : "Load"}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (isLoaded) {
                                  await unloadNativeModel();
                                  onChangeLoadedNativeModel(null);
                                }
                                await deleteNativeModel(cm.fileName);
                                await refreshDeviceInventory();
                              }}
                              className="rounded-lg bg-white/[0.06] p-1.5 text-zinc-400 hover:text-red-400"
                            >
                              <Trash size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Notice Banner */}
              {hubNotice && (
                <div
                  role="status"
                  className="flex items-start justify-between gap-2 rounded-2xl bg-[#181612] px-3.5 py-2.5 text-xs text-amber-200"
                >
                  <span className="flex min-w-0 items-start gap-2">
                    <WarningCircle
                      size={15}
                      weight="regular"
                      className="mt-0.5 shrink-0 text-amber-300"
                    />
                    <span className="leading-relaxed">{hubNotice}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setHubNotice(null)}
                    aria-label="Dismiss notice"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-amber-200/70 hover:text-white"
                  >
                    <X size={12} weight="bold" />
                  </button>
                </div>
              )}

              {/* Category Filter */}
              <div className="flex items-center gap-1.5">
                {(['all', 'general', 'uncensored'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setCategoryFilter(filter)}
                    aria-pressed={categoryFilter === filter}
                    className={`h-8 rounded-full px-3 font-sans text-xs font-medium capitalize active:scale-[0.96] transition-colors duration-150 ${
                      categoryFilter === filter
                        ? 'onyx-accent-btn text-white'
                        : 'bg-[#141418] text-zinc-400 hover:text-white'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {/* Curated Hugging Face GGUF Model Cards */}
              <div className="space-y-2.5">
                {filteredModels.map((model) => {
                  const downloadedEntry = downloadedByFile.get(model.fileName);
                  const liveProgress = downloadProgressMap[model.fileName];
                  const partialEntry = partialDownloads[model.fileName];
                  const isDownloading = liveProgress?.status === 'downloading';
                  const isPaused =
                    liveProgress?.status === 'paused' ||
                    (!isDownloading && !downloadedEntry && Boolean(partialEntry));
                  const isLoaded = loadedNativeModel === model.fileName;
                  const isLoadingThis = loadingModelFile === model.fileName;
                  const isDeletingThis = deletingModelFile === model.fileName;
                  const isServerSelected = config.modelName === model.id;

                  const expectedBytes = parseModelSizeToBytes(model.size);
                  const currentDownloadedBytes =
                    liveProgress?.downloadedBytes ??
                    partialEntry?.downloadedBytes ??
                    0;
                  const currentTotalBytes =
                    liveProgress && liveProgress.totalBytes > 0
                      ? liveProgress.totalBytes
                      : expectedBytes;
                  const progressPct =
                    liveProgress && liveProgress.progress > 0
                      ? liveProgress.progress
                      : currentTotalBytes > 0
                        ? Math.min(
                            100,
                            Math.round(
                              (currentDownloadedBytes / currentTotalBytes) *
                                1000
                            ) / 10
                          )
                        : 0;

                  const lowStorageWarning =
                    nativeAvailable &&
                    !downloadedEntry &&
                    availableStorageBytes > 0 &&
                    !hasEnoughStorageForModel(
                      availableStorageBytes,
                      Math.max(0, expectedBytes - currentDownloadedBytes)
                    );

                  return (
                    <div
                      key={model.id}
                      className="space-y-2.5 rounded-2xl onyx-bento-card-subtle p-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="truncate font-sans text-sm font-medium text-white">
                              {model.name}
                            </h3>
                            <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-[var(--onyx-accent-soft)]">
                              {model.quantization}
                            </span>
                            {model.category === 'uncensored' && (
                              <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] text-amber-200">
                                Uncensored
                              </span>
                            )}
                            {isLoaded && (
                              <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                                Active in RAM
                              </span>
                            )}
                          </div>
                          <p className="mt-1 font-sans text-xs leading-relaxed text-zinc-400">
                            {model.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-zinc-500 tabular-nums">
                        <span>
                          {downloadedEntry
                            ? `${formatBytesCompact(downloadedEntry.sizeBytes)} on device`
                            : model.size}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{model.ramRequired}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-zinc-400">
                          {model.recommendedFor}
                        </span>
                      </div>

                      {lowStorageWarning && (
                        <div className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-2.5 py-1.5 font-mono text-[11px] text-amber-200">
                          <WarningCircle size={13} weight="bold" className="shrink-0" />
                          <span>
                            Low storage · free space below model size + 350 MB buffer
                          </span>
                        </div>
                      )}

                      {/* Live Download Progress Strip (Downloading or Paused) */}
                      {(isDownloading || isPaused) && (
                        <div className="space-y-1.5 rounded-xl bg-[#0A0A0E] p-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 font-mono text-[11px] tabular-nums">
                            <span className="text-zinc-200 whitespace-nowrap">
                              {isDownloading ? 'DL' : 'Paused'} ·{' '}
                              {formatMB(currentDownloadedBytes).replace(' MB', '')}/
                              {formatMB(currentTotalBytes)}
                            </span>
                            <span className="text-[var(--onyx-accent-soft)] whitespace-nowrap">
                              {progressPct.toFixed(0)}%
                              {isDownloading &&
                              liveProgress &&
                              liveProgress.speedMBps > 0
                                ? ` · ${liveProgress.speedMBps.toFixed(1)} MB/s`
                                : ''}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1C1D25]">
                            <div
                              className={`h-full rounded-full transition-[width] duration-200 ease-out ${
                                isPaused ? 'bg-amber-400' : 'onyx-accent-btn'
                              }`}
                              style={{
                                width: `${Math.min(100, Math.max(2, progressPct))}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Action Controls */}
                      <div className="flex items-center gap-2 pt-0.5">
                        {nativeAvailable ? (
                          downloadedEntry ? (
                            <>
                              {isLoaded ? (
                                <button
                                  type="button"
                                  onClick={() => void handleUnloadNativeModel()}
                                  className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500/20 px-3 font-sans text-xs font-medium text-emerald-200 hover:bg-emerald-500/30 active:scale-[0.97] transition-transform duration-150"
                                >
                                  <Power size={14} weight="bold" />
                                  <span>Loaded · Unload</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={Boolean(loadingModelFile)}
                                  onClick={() =>
                                    void handleLoadNativeModel(model)
                                  }
                                  className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl onyx-accent-btn px-3 font-sans text-xs font-medium text-white hover:bg-[var(--onyx-accent)] active:scale-[0.97] disabled:opacity-50 transition-transform duration-150"
                                >
                                  <Cpu size={14} weight="bold" />
                                  <span>
                                    {isLoadingThis
                                      ? 'Loading into RAM...'
                                      : 'Load Model'}
                                  </span>
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={isDeletingThis || isLoadingThis}
                                onClick={() =>
                                  void handleDeleteNativeModel(model.fileName)
                                }
                                aria-label={`Delete ${model.name}`}
                                className="flex h-9 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-zinc-300 hover:bg-white/[0.12] hover:text-white active:scale-[0.96] disabled:opacity-50"
                              >
                                <Trash size={15} weight="regular" />
                              </button>
                            </>
                          ) : isDownloading ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  void handlePauseDownload(model.fileName)
                                }
                                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/[0.08] px-3 font-sans text-xs font-medium text-white hover:bg-white/[0.14] active:scale-[0.97]"
                              >
                                <Pause size={14} weight="fill" />
                                <span>Pause</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleCancelDownload(model.fileName)
                                }
                                className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white/[0.05] px-3 font-sans text-xs font-medium text-zinc-300 hover:bg-white/[0.1] hover:text-white active:scale-[0.97]"
                              >
                                <X size={14} weight="bold" />
                                <span>Cancel</span>
                              </button>
                            </>
                          ) : isPaused ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleStartOrResumeDownload(model)
                                }
                                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl onyx-accent-btn px-3 font-sans text-xs font-medium text-white hover:bg-[var(--onyx-accent)] active:scale-[0.97]"
                              >
                                <Play size={14} weight="fill" />
                                <span>Resume</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleCancelDownload(model.fileName)
                                }
                                className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white/[0.05] px-3 font-sans text-xs font-medium text-zinc-300 hover:bg-white/[0.1] hover:text-white active:scale-[0.97]"
                              >
                                <Trash size={14} weight="regular" />
                                <span>Cancel</span>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              disabled={lowStorageWarning}
                              onClick={() =>
                                void handleStartOrResumeDownload(model)
                              }
                              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl onyx-accent-btn px-3 font-sans text-xs font-medium text-white hover:bg-[var(--onyx-accent)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 transition-transform duration-150"
                            >
                              <DownloadSimple size={14} weight="bold" />
                              <span>Download GGUF ({model.size})</span>
                            </button>
                          )
                        ) : (
                          /* Web Browser Fallback Controls */
                          <>
                            <a
                              href={model.huggingfaceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl onyx-accent-btn px-3 font-sans text-xs font-medium text-white hover:bg-[var(--onyx-accent)] active:scale-[0.97] transition-transform duration-150"
                            >
                              <DownloadSimple size={14} weight="bold" />
                              <span>Download GGUF</span>
                              <ArrowUpRight size={12} weight="bold" />
                            </a>

                            <button
                              type="button"
                              onClick={() => handleSelectModelForServer(model)}
                              className={`flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 font-sans text-xs font-medium active:scale-[0.97] transition-colors duration-150 ${
                                isServerSelected
                                  ? 'bg-emerald-500/20 text-emerald-200'
                                  : 'bg-white/[0.06] text-zinc-200 hover:bg-white/[0.12]'
                              }`}
                            >
                              {isServerSelected ? (
                                <>
                                  <Check size={13} weight="bold" />
                                  <span>Selected</span>
                                </>
                              ) : (
                                <span>Use in Server</span>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Connection Status Bar */}
              <div className="flex items-center justify-between gap-3 rounded-2xl onyx-bento-card-subtle p-3.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusBadge.dotClass}`}
                  />
                  <div className="min-w-0">
                    <div className="font-sans text-xs font-medium text-white">
                      Local Server Fallback Status
                    </div>
                    <div
                      className={`font-mono text-[11px] ${statusBadge.textClass}`}
                    >
                      {statusBadge.label}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleTestConnection()}
                  disabled={serverStatus === 'checking'}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#1E2436] px-3 font-sans text-xs font-medium text-[var(--onyx-accent-soft)] hover:bg-[#26304A] active:scale-[0.96] disabled:opacity-50 transition-transform duration-150"
                >
                  <PlugsConnected size={14} weight="regular" />
                  <span>
                    {serverStatus === 'checking' ? 'Testing...' : 'Test'}
                  </span>
                </button>
              </div>

              {/* Endpoint & Generation Parameters */}
              <div className="space-y-3 rounded-2xl onyx-bento-card-subtle p-4">
                <div>
                  <label
                    htmlFor="onyx-local-endpoint"
                    className="mb-1.5 block font-sans text-xs font-medium text-zinc-300"
                  >
                    OpenAI-Compatible Endpoint URL (Web Fallback)
                  </label>
                  <input
                    id="onyx-local-endpoint"
                    type="url"
                    value={config.endpointUrl}
                    onChange={(event) => {
                      setUrlError(null);
                      onChangeConfig({
                        ...config,
                        endpointUrl: event.target.value,
                      });
                    }}
                    placeholder="http://127.0.0.1:8080/v1/chat/completions"
                    className="h-10 w-full rounded-xl bg-[#09090B] px-3 font-mono text-xs text-white placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                  />
                  {urlError && (
                    <p className="mt-1 font-sans text-[11px] text-amber-300">
                      {urlError}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="onyx-local-model"
                    className="mb-1.5 block font-sans text-xs font-medium text-zinc-300"
                  >
                    Active Model Identifier
                  </label>
                  <input
                    id="onyx-local-model"
                    type="text"
                    value={config.modelName}
                    onChange={(event) =>
                      onChangeConfig({
                        ...config,
                        modelName: event.target.value,
                      })
                    }
                    placeholder="qwen2.5-3b-instruct-q4_k_m"
                    className="h-10 w-full rounded-xl bg-[#09090B] px-3 font-mono text-xs text-white placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label
                        htmlFor="onyx-local-temp"
                        className="font-sans text-xs font-medium text-zinc-300"
                      >
                        Temperature
                      </label>
                      <span className="font-mono text-xs text-[var(--onyx-accent-soft)] tabular-nums">
                        {config.temperature.toFixed(1)}
                      </span>
                    </div>
                    <input
                      id="onyx-local-temp"
                      type="range"
                      min={0}
                      max={1.5}
                      step={0.1}
                      value={config.temperature}
                      onChange={(event) =>
                        onChangeConfig({
                          ...config,
                          temperature: Number(event.target.value),
                        })
                      }
                      className="w-full accent-[var(--onyx-accent)]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="onyx-local-max-tokens"
                      className="mb-1.5 block font-sans text-xs font-medium text-zinc-300"
                    >
                      Max Tokens
                    </label>
                    <input
                      id="onyx-local-max-tokens"
                      type="number"
                      min={128}
                      max={4096}
                      step={128}
                      value={config.maxTokens}
                      onChange={(event) =>
                        onChangeConfig({
                          ...config,
                          maxTokens: Math.max(
                            128,
                            Math.min(4096, Number(event.target.value) || 1024)
                          ),
                        })
                      }
                      className="h-9 w-full rounded-xl bg-[#09090B] px-3 font-mono text-xs text-white tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                    />
                  </div>
                </div>
              </div>

              {/* Desktop / Browser llama-server CLI Reference */}
              <div className="rounded-2xl onyx-bento-card-subtle p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-sans text-xs font-medium text-zinc-200">
                    <TerminalWindow
                      size={15}
                      weight="regular"
                      className="text-[var(--onyx-accent)]"
                    />
                    <span>Desktop / Browser llama-server Reference</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopyTermux()}
                    className="flex h-8 items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 font-sans text-[11px] font-medium text-zinc-200 hover:bg-white/[0.12] active:scale-[0.96] transition-transform duration-150"
                  >
                    {copiedCommand ? (
                      <>
                        <Check
                          size={13}
                          weight="bold"
                          className="text-emerald-400"
                        />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} weight="regular" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-xl bg-[#060608] p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
                  {termuxCommand}
                </pre>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
