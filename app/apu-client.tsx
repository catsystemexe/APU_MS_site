"use client";

import {
  CSSProperties,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowUp,
  Check,
  Download,
  FilePlus2,
  FolderOpen,
  Mic,
  NotebookPen,
  Plus,
  ScanSearch,
  Settings,
  Save,
  Square,
  TriangleAlert,
  UserRound,
  X,
  FileText,
} from "lucide-react";
import { Diagnostics, summarizeDiagnostics } from "./conversation-diagnostics";
import { ACTIVE_APU_CORE_RELEASE_ID, ACTIVE_APU_CORE_VERSION, APU_SITE_RUNTIME_RELEASE } from "./core-config";
import { buildSessionExport, createSessionTelemetry, downloadSessionExport, mergeSessionTelemetry, type SessionTelemetry } from "./session-export";
import {
  MODEL_CATALOG,
  baseModelName,
} from "./model-config";
import { AUTO_MODEL_SELECTION, type ModelSelection } from "./model-routing";
import { WorkspacePanel, type WorkspacePanel as WorkspacePanelId, usePersistentNotepad } from "./notepad";
import {
  applyCandidates,
  compactNotepad,
  createLocalId,
  ExtractionCandidate,
  ExtractionResult,
  getF1ToF2NeedContract,
  mapPedagogicalNeed,
  NotepadEntry,
  NotepadState,
  replaceEntryFromConflict,
} from "./notepad-model";
import { findAssistantHighlightRanges } from "./assistant-highlights";
import ApuLogo from "./apu-logo";
import DialogActionCard from "./dialog-action-card";
import { AnalysisQuestionRow } from "./analysis-question-row";
import { F2EntrySummary, type F2EntryHypothesis } from "./f2-entry-summary";
import { resolveTextDialogEvent, type ConversationPhase, type DialogAction } from "./dialog-action";
import {
  COLOR_THEMES,
  ColorThemeId,
  FONT_SIZE_OPTIONS,
  FontSizeId,
  TYPOGRAPHY_PRESETS,
  TypographyPresetId,
  useDesignPreferences,
} from "./design-system";
import {
  COMMUNICATION_PROFILES,
  CommunicationProfileId,
  DEFAULT_COMMUNICATION_PROFILE_ID,
} from "./communication-profile";
import {
  composeSpeechSegments,
  updateSpeechTranscriptSegments,
  type SpeechRecognitionResultLike,
  type SpeechTranscriptSegment,
} from "./speech-transcript";
import { splitAssistantMetadata, type DebugMapping } from "./response-metadata";
import { createProjectResetState, shouldResetCurrentProject } from "./project-session";
import { analysisChangeKeys, EMPTY_ANALYSIS, formatAnalysisChat, preserveAnalysisSelection, type AnalysisNextPrompt, type AnalysisState, type SuggestedNeed } from "./analysis-model";
import { CompletedLifecycleStatus, ProcessingStatus, type F1ProcessingStage } from "./processing-status";
import { addCompletedLifecycleRecord, withCompletedLifecycleRecord, type CompletedLifecycleRecord } from "./lifecycle-record";
import { DevLogPanel } from "./dev-log-panel";
import type { SharedFeedbackResult } from "./shared-feedback";
import { acceptRenderedPreview, addF2Context, applyPochopitBuildResult, createF2BuildState, createF2PreviewSnapshot, createPochopitBuildRequest, parameterizeF2Skill, previewStatus, removeF2Context, switchF2Path, toggleF2Skill, type F2BuildState, type F2NotebookContextItem, type F2PreviewState, type F2RenderedPreview, type PochopitBuildResult } from "./f2-build-model";

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorLike = { error: string };

const DESKTOP_SPLIT_STORAGE_KEY = "apu.desktopSplit";
const DEFAULT_DESKTOP_SPLIT = 60;
const MIN_CHAT_WIDTH = 420;
const MIN_WORKSPACE_WIDTH = 300;
const SPLIT_KEYBOARD_STEP = 2;

function clampDesktopSplit(preferred: number, width: number) {
  if (width <= 0) return DEFAULT_DESKTOP_SPLIT;
  const minimum = (MIN_CHAT_WIDTH / width) * 100;
  const maximum = 100 - (MIN_WORKSPACE_WIDTH / width) * 100;
  if (minimum > maximum) return (MIN_CHAT_WIDTH / (MIN_CHAT_WIDTH + MIN_WORKSPACE_WIDTH)) * 100;
  return Math.min(maximum, Math.max(minimum, preferred));
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return undefined;
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  diagnostics?: Diagnostics;
  controllerDiagnostics?: Diagnostics;
  dialogActions?: DialogAction[];
  debugText?: string;
  debugMapping?: DebugMapping;
  phaseLabel?: string;
  extractionDiagnostics?: Diagnostics;
  extraction?: ExtractionResult;
  extractionWarning?: string;
  sourceMessageId?: string;
  communicationProfile?: CommunicationProfileId;
  turnId?: string;
  createdAt?: string;
  telemetryRefs?: string[];
  analysisNextPrompt?: AnalysisNextPrompt;
  analysisEntryHypotheses?: F2EntryHypothesis[];
  lifecycleRecords?: CompletedLifecycleRecord[];
};

function entryHypotheses(analysis: AnalysisState): F2EntryHypothesis[] {
  return analysis.hypotheses.map(({ id, rank, title, summary }) => ({ id, rank, title, summary }));
}

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content: "Co dnes potřebujete?",
  createdAt: new Date().toISOString(),
};

const MODEL_OPTIONS = Object.values(MODEL_CATALOG);
const AUTO_MODEL_OPTION = { id: AUTO_MODEL_SELECTION, label: "Automaticky · Luna / Terra" } as const;
const COMMUNICATION_PROFILE_OPTIONS = Object.values(COMMUNICATION_PROFILES);
const CZK_PER_USD = 21.5;
const COST_TOOLTIP = "Přibližný přepočet podle usage dat API a nakonfigurovaných sazeb modelu při kurzu 1 USD = 21,5 Kč. Skutečná fakturace se může lišit.";
const UNKNOWN_COST_TOOLTIP = "Cenová sazba použitého modelu není nakonfigurována; tokeny jsou zobrazeny bez odhadu ceny.";
const INPUT_PLACEHOLDER = "Napište APU…";

function createMessageId() {
  return globalThis.crypto?.randomUUID?.() ??
    `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("cs-CZ").format(value);
}

function formatCostNumber(valueUsd: number) {
  const valueCzk = valueUsd * CZK_PER_USD;
  const digits = valueCzk >= 10 ? 1 : valueCzk >= 0.1 ? 2 : 3;
  return `${new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: valueCzk === 0 ? 2 : 0,
    maximumFractionDigits: digits,
  }).format(valueCzk)} Kč`;
}

function formatCost(value: number | null) {
  return value === null ? "≈ —" : `≈ ${formatCostNumber(value)}`;
}

function displayModel(model: string) {
  const base = baseModelName(model);
  return base ? MODEL_CATALOG[base].label : model;
}

function assistantSourceRanges(message: Message, notepad: NotepadState) {
  if (message.role !== "assistant" || !message.sourceMessageId) return [];
  const facts = Object.values(notepad)
    .flat()
    .filter((entry) => entry.source?.messageId === message.sourceMessageId)
    .flatMap((entry) => [entry.text, entry.source?.quote ?? ""])
    .filter(Boolean);
  return findAssistantHighlightRanges(message.content, facts);
}

function HighlightedMessage({
  message,
  notepad,
}: {
  message: Message;
  notepad: NotepadState;
}) {
  if (message.role !== "assistant") return message.content;
  const ranges = assistantSourceRanges(message, notepad);
  if (!ranges.length) return message.content;

  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) parts.push(message.content.slice(cursor, range.start));
    parts.push(
      <span
        className="source-highlight"
        key={`${range.start}-${range.end}`}
        title="Tato formulace APU odpovídá zápisu v Zápisníku"
      >
        {message.content.slice(range.start, range.end)}
      </span>,
    );
    cursor = range.end;
  }
  if (cursor < message.content.length) parts.push(message.content.slice(cursor));
  return parts;
}

type ApuClientProps = {
  email: string;
  isDeveloper: boolean;
  sharedFeedback: SharedFeedbackResult | null;
};

function DeveloperHeaderControls({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <span className="developer-controls">
      <span className="developer-indicator" title="Developer režim je aktivní">DEV ON</span>
      <button
        type="button"
        className="developer-log-toggle"
        aria-label={open ? "Skrýt DEV LOG" : "Zobrazit DEV LOG"}
        aria-expanded={open}
        aria-controls="dev-log-panel"
        title={open ? "Skrýt DEV LOG" : "Zobrazit DEV LOG"}
        onClick={onToggle}
      >
        <TriangleAlert aria-hidden="true" />
      </button>
    </span>
  );
}

export default function ApuClient({ email, isDeveloper, sharedFeedback }: ApuClientProps) {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [responseId, setResponseId] = useState<string | null>(null);
  const [phase, setPhase] = useState<ConversationPhase>("intake");
  const [selectedModel, setSelectedModel] = useState<ModelSelection>(AUTO_MODEL_SELECTION);
  const [communicationProfile, setCommunicationProfile] = useState<CommunicationProfileId>(DEFAULT_COMMUNICATION_PROFILE_ID);
  const [isLoading, setIsLoading] = useState(false);
  const [failedInput, setFailedInput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isDiagnosticsDrawerOpen, setIsDiagnosticsDrawerOpen] = useState(false);
  const [isDevLogOpen, setIsDevLogOpen] = useState(false);
  const [isDevLogRendered, setIsDevLogRendered] = useState(false);
  const [activePanel, setActivePanel] = useState<WorkspacePanelId>("notepad");
  const [preferredDesktopSplit, setPreferredDesktopSplit] = useState(DEFAULT_DESKTOP_SPLIT);
  const [effectiveDesktopSplit, setEffectiveDesktopSplit] = useState(DEFAULT_DESKTOP_SPLIT);
  const [isResizingWorkspace, setIsResizingWorkspace] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisState>(EMPTY_ANALYSIS);
  const [f2Build, setF2Build] = useState<F2BuildState | null>(null);
  const [f2Preview, setF2Preview] = useState<F2PreviewState>(null);
  const [f2BuildStatus, setF2BuildStatus] = useState<"idle" | "loading" | "error">("idle");
  const [f2BuildError, setF2BuildError] = useState<string | null>(null);
  const [f2PreviewStatus, setF2PreviewStatus] = useState<"idle" | "loading" | "error">("idle");
  const [f2PreviewError, setF2PreviewError] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [selectedHypothesisId, setSelectedHypothesisId] = useState<string | null>(null);
  const [activeNeedId, setActiveNeedId] = useState<string | null>(null);
  const [analysisRefresh, setAnalysisRefresh] = useState(0);
  const [skippedAnalysisQuestions, setSkippedAnalysisQuestions] = useState<string[]>([]);
  const [analysisFocus, setAnalysisFocus] = useState<{ text: string; nonce: number } | null>(null);
  const [unseenAnalysisKeys, setUnseenAnalysisKeys] = useState<Set<string>>(() => new Set());
  const [highlightedAnalysisKeys, setHighlightedAnalysisKeys] = useState<Set<string>>(() => new Set());
  const [exportStatus, setExportStatus] = useState<"idle" | "downloaded" | "error">("idle");
  const [sessionTelemetry, setSessionTelemetry] = useState<SessionTelemetry[]>([]);
  const sessionRef = useRef({ id: createMessageId(), startedAt: new Date().toISOString() });
  const telemetryClockRef = useRef(new Map<string, { actionStartedAt: number }>());
  const [isDictating, setIsDictating] = useState(false);
  const [isDictationSupported, setIsDictationSupported] = useState(false);
  const [dictationNotice, setDictationNotice] = useState<string | null>(null);
  const design = useDesignPreferences();
  const { entries: notepad, setEntries: setNotepad, hydrated: isNotepadHydrated } = usePersistentNotepad();
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatCardRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const statsButtonRef = useRef<HTMLButtonElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechSegmentsRef = useRef<SpeechTranscriptSegment[]>([]);
  const dictationSessionRef = useRef(0);
  const dictationShouldContinueRef = useRef(false);
  const dictationPrefixRef = useRef("");
  const canonicalF2Need = useMemo(() => getF1ToF2NeedContract(notepad, activeNeedId), [notepad, activeNeedId]);

  useEffect(() => {
    if (phase === "intake" || !canonicalF2Need) return;
    setF2Build((current) => {
      if (!current || current.canonicalNeed.needId !== canonicalF2Need.needId) {
        setF2Preview(null);
        return createF2BuildState(canonicalF2Need, analysis.mainUncertainty ? [analysis.mainUncertainty] : [], analysis.hypotheses);
      }
      if (!current.analytical.uncertainties.length && current.processedRevision === null && analysis.mainUncertainty) return { ...current, analytical: { ...current.analytical, uncertainties: [{ missing: analysis.mainUncertainty, importance: "Může zpřesnit analytický obraz.", limitation: "Omezuje míru jistoty, nikoli možnost pokračovat v rozboru." }] } };
      return current;
    });
  }, [analysis.hypotheses, analysis.mainUncertainty, canonicalF2Need, phase]);
  const dictationTranscriptRef = useRef("");
  const dictationFinalizedSessionRef = useRef(0);
  const dictationRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef("");
  const submitAfterDictationRef = useRef(false);
  const dictationSubmitQueuedRef = useRef(false);
  const dictationSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dictationSubmitReady, setDictationSubmitReady] = useState(0);
  const [hasDictationDraft, setHasDictationDraft] = useState(false);
  const [f1ProcessingStatus, setF1ProcessingStatus] = useState<{ assistantId: string; stage: F1ProcessingStage } | null>(null);
  const f1ProcessingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stored = Number.parseFloat(window.localStorage.getItem(DESKTOP_SPLIT_STORAGE_KEY) ?? "");
    if (Number.isFinite(stored) && stored > 0 && stored < 100) setPreferredDesktopSplit(stored);
  }, []);

  useEffect(() => {
    const card = chatCardRef.current;
    if (!card) return;
    const updateEffectiveSplit = () => {
      setEffectiveDesktopSplit(clampDesktopSplit(preferredDesktopSplit, card.getBoundingClientRect().width));
    };
    updateEffectiveSplit();
    const observer = new ResizeObserver(updateEffectiveSplit);
    observer.observe(card);
    return () => observer.disconnect();
  }, [preferredDesktopSplit]);

  function savePreferredDesktopSplit(value: number) {
    setPreferredDesktopSplit(value);
    window.localStorage.setItem(DESKTOP_SPLIT_STORAGE_KEY, String(value));
  }

  function updateDesktopSplitFromClientX(clientX: number) {
    const rect = chatCardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const preferred = ((clientX - rect.left) / rect.width) * 100;
    const effective = clampDesktopSplit(preferred, rect.width);
    setEffectiveDesktopSplit(effective);
    savePreferredDesktopSplit(effective);
  }

  function handleSplitKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Home") {
      event.preventDefault();
      savePreferredDesktopSplit(DEFAULT_DESKTOP_SPLIT);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      const width = chatCardRef.current?.getBoundingClientRect().width ?? 0;
      savePreferredDesktopSplit(clampDesktopSplit(effectiveDesktopSplit + direction * SPLIT_KEYBOARD_STEP, width));
    }
  }
  const f1ProcessingSequenceRef = useRef<{ assistantId: string; complete: boolean } | null>(null);
  const f1MainPreparingRef = useRef<string | null>(null);
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);

  useEffect(() => {
    if (isDevLogOpen) { setIsDevLogRendered(true); return; }
    const timer = window.setTimeout(() => setIsDevLogRendered(false), 240);
    return () => window.clearTimeout(timer);
  }, [isDevLogOpen]);

  const summary = useMemo(
    () => summarizeDiagnostics(messages.flatMap((message) => [message.diagnostics, message.controllerDiagnostics, message.extractionDiagnostics])),
    [messages],
  );
  const hasUnreadNotepadChange = useMemo(
    () => Object.values(notepad).some((items) => items.some((entry) => entry.visibility === "unseen")),
    [notepad],
  );
  const hasUnreadAnalysisChange = unseenAnalysisKeys.size > 0;
  const costTooltip = summary.estimatedCostUsd === null ? UNKNOWN_COST_TOOLTIP : COST_TOOLTIP;
  const activeDialogMessageId = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant" && message.dialogActions?.length)?.id,
    [messages],
  );
  const compactAnalysisNotebook = useMemo(() => compactNotepad(notepad), [notepad]);
  const compactAnalysisNotebookKey = useMemo(() => JSON.stringify(compactAnalysisNotebook), [compactAnalysisNotebook]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isStatsOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!statsRef.current?.contains(event.target as Node)) setIsStatsOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsStatsOpen(false);
        statsButtonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [isStatsOpen]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  }, [input, isComposerExpanded]);

  useEffect(() => {
    setIsDictationSupported(Boolean(getSpeechRecognitionConstructor()));
    return () => {
      dictationSessionRef.current += 1;
      if (dictationSubmitTimerRef.current) clearTimeout(dictationSubmitTimerRef.current);
      if (dictationRestartTimerRef.current) clearTimeout(dictationRestartTimerRef.current);
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  function setComposerInput(value: string) {
    inputRef.current = value;
    setInput(value);
  }

  function queueDictationSubmit() {
    if (!submitAfterDictationRef.current || dictationSubmitQueuedRef.current) return;
    dictationSubmitQueuedRef.current = true;
    if (dictationSubmitTimerRef.current) clearTimeout(dictationSubmitTimerRef.current);
    dictationSubmitTimerRef.current = null;
    setDictationSubmitReady((ready) => ready + 1);
  }

  function cancelDictation() {
    dictationSessionRef.current += 1;
    dictationShouldContinueRef.current = false;
    submitAfterDictationRef.current = false;
    dictationSubmitQueuedRef.current = false;
    if (dictationSubmitTimerRef.current) clearTimeout(dictationSubmitTimerRef.current);
    if (dictationRestartTimerRef.current) clearTimeout(dictationRestartTimerRef.current);
    dictationSubmitTimerRef.current = null;
    dictationRestartTimerRef.current = null;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    setIsDictating(false);
    setHasDictationDraft(false);
    setIsComposerExpanded(Boolean(inputRef.current.trim()));
    recognition?.abort();
  }

  function currentDictationTranscript() {
    return composeSpeechSegments(speechSegmentsRef.current);
  }

  function mergeDictationTranscript(transcript: string) {
    if (!transcript.trim()) return;
    dictationTranscriptRef.current = composeSpeechSegments([
      { transcript: dictationTranscriptRef.current, isFinal: true },
      { transcript, isFinal: true },
    ]);
  }

  function finalizeDictation(session: number) {
    if (dictationSessionRef.current !== session || dictationFinalizedSessionRef.current === session) return;
    dictationFinalizedSessionRef.current = session;
    if (dictationRestartTimerRef.current) clearTimeout(dictationRestartTimerRef.current);
    if (dictationSubmitTimerRef.current) clearTimeout(dictationSubmitTimerRef.current);
    dictationRestartTimerRef.current = null;
    dictationSubmitTimerRef.current = null;
    mergeDictationTranscript(currentDictationTranscript());
    speechSegmentsRef.current = [];
    const dictated = dictationTranscriptRef.current.trim();
    const prefix = dictationPrefixRef.current.trimEnd();
    const completed = [prefix, dictated].filter(Boolean).join(" ");
    setComposerInput(completed);
    setIsComposerExpanded(Boolean(completed));
    setHasDictationDraft(false);
    setIsDictating(false);
    recognitionRef.current = null;
    queueDictationSubmit();
  }

  function startRecognitionCycle(session: number) {
    if (!dictationShouldContinueRef.current || dictationSessionRef.current !== session) return;

    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) return;
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    speechSegmentsRef.current = [];

    recognition.lang = "cs-CZ";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      if (dictationSessionRef.current !== session) return;
      speechSegmentsRef.current = updateSpeechTranscriptSegments(
        speechSegmentsRef.current,
        event.results,
        event.resultIndex,
      );
      setHasDictationDraft(Boolean(dictationTranscriptRef.current || currentDictationTranscript()));
    };
    recognition.onerror = (event) => {
      if (dictationSessionRef.current !== session || event.error === "aborted") return;
      if (event.error === "no-speech") return;
      const notices: Record<string, string> = {
        "not-allowed": "Přístup k mikrofonu nebyl povolen.",
        "service-not-allowed": "Rozpoznávání řeči není v zařízení povolené.",
        "audio-capture": "Mikrofon není dostupný.",
        "network": "Diktování se nepodařilo připojit ke službě rozpoznávání.",
      };
      dictationShouldContinueRef.current = false;
      setDictationNotice(notices[event.error] ?? "Diktování se nepodařilo spustit.");
    };
    recognition.onend = () => {
      if (dictationSessionRef.current !== session) return;
      mergeDictationTranscript(currentDictationTranscript());
      speechSegmentsRef.current = [];
      recognitionRef.current = null;

      if (dictationShouldContinueRef.current) {
        dictationRestartTimerRef.current = setTimeout(() => startRecognitionCycle(session), 160);
        return;
      }
      finalizeDictation(session);
    };

    try {
      recognition.start();
    } catch {
      dictationShouldContinueRef.current = false;
      recognitionRef.current = null;
      setDictationNotice("Diktování se nepodařilo znovu spustit.");
      finalizeDictation(session);
    }
  }

  function stopDictation(submitAfterStop = false) {
    const session = dictationSessionRef.current;
    dictationShouldContinueRef.current = false;
    submitAfterDictationRef.current = submitAfterStop;
    dictationSubmitQueuedRef.current = false;
    if (dictationRestartTimerRef.current) clearTimeout(dictationRestartTimerRef.current);
    dictationRestartTimerRef.current = null;
    setIsDictating(false);
    const recognition = recognitionRef.current;
    if (recognition) recognition.stop();
    else finalizeDictation(session);
    dictationSubmitTimerRef.current = setTimeout(() => finalizeDictation(session), 800);
  }

  function startDictation() {
    if (isDictating) {
      stopDictation(false);
      return;
    }

    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setDictationNotice("Diktování tento prohlížeč nepodporuje.");
      return;
    }

    const session = dictationSessionRef.current + 1;
    dictationSessionRef.current = session;
    dictationFinalizedSessionRef.current = 0;
    dictationShouldContinueRef.current = true;
    dictationPrefixRef.current = input;
    dictationTranscriptRef.current = "";
    speechSegmentsRef.current = [];
    setDictationNotice(null);
    setHasDictationDraft(false);
    setIsComposerExpanded(false);
    setIsDictating(true);
    startRecognitionCycle(session);
  }

  function handleInputChange(value: string) {
    if (isDictating) cancelDictation();
    setDictationNotice(null);
    setIsComposerExpanded(true);
    setComposerInput(value);
  }

  function expandComposer() {
    if (isDictating || isLoading || !isNotepadHydrated) return;
    setIsComposerExpanded(true);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function togglePanel(panel: WorkspacePanelId) {
    setActivePanel((current) => current === panel ? null : panel);
  }

  function f2Situation(): F2NotebookContextItem[] {
    return Object.entries(notepad).flatMap(([category, items]) => items.map((item) => ({ category: category as F2NotebookContextItem["category"], text: item.text })));
  }

  async function executeF2Build() {
    if (!f2Build) return;
    setF2BuildStatus("loading"); setF2BuildError(null);
    try {
      const buildRequest = createPochopitBuildRequest(f2Build, f2Situation(), selectedModel);
      const response = await fetch("/api/f2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "build", model: selectedModel, build: buildRequest }) });
      const payload = await response.json().catch(() => null) as { result?: PochopitBuildResult; error?: string } | null;
      if (!response.ok || !payload?.result) throw new Error(payload?.error || "Build se nepodařilo rozpracovat.");
      setF2Build((current) => current ? applyPochopitBuildResult(current, payload.result!, buildRequest.buildRevision) : current);
      setF2BuildStatus("idle");
    } catch (cause) { setF2BuildError(cause instanceof Error ? cause.message : "Build se nepodařilo rozpracovat."); setF2BuildStatus("error"); }
  }

  async function renderF2Preview() {
    if (!f2Build) return;
    setF2PreviewStatus("loading"); setF2PreviewError(null);
    try {
      const snapshot = createF2PreviewSnapshot(f2Build);
      const response = await fetch("/api/f2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "preview", model: selectedModel, snapshot }) });
      const payload = await response.json().catch(() => null) as { result?: F2RenderedPreview; error?: string } | null;
      if (!response.ok || !payload?.result) throw new Error(payload?.error || "Preview se nepodařilo vytvořit.");
      setF2Preview(acceptRenderedPreview(snapshot, payload.result)); setF2PreviewStatus("idle"); setActivePanel("output");
    } catch (cause) { setF2PreviewError(cause instanceof Error ? cause.message : "Preview se nepodařilo vytvořit."); setF2PreviewStatus("error"); }
  }

  async function refreshStructuredAnalysis(notepadState: NotepadState, focusInstruction = "", turnId?: string, requestId?: string, transitionFrom?: "F1" | "F2" | "F3") {
    setAnalysisStatus("loading");
    setAnalysisError(null);
    try {
      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notebook: compactNotepad(notepadState),
          previousAnalysis: analysis.hypotheses.length ? analysis : null,
          selectedHypothesisId,
          activeNeedId,
          focusInstruction,
          skippedQuestions: skippedAnalysisQuestions,
          canonicalNeed: getF1ToF2NeedContract(notepadState, activeNeedId),
          ...(turnId ? { turnId } : {}),
        }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(detail?.error || "Rozbor se nepodařilo aktualizovat.");
      }
      const result = await response.json() as { analysis: AnalysisState; diagnostics?: Diagnostics; telemetry?: Partial<SessionTelemetry> };
      if (turnId && requestId && result.telemetry) {
        setSessionTelemetry((current) => current.map((item) => item.request_id === requestId
          ? mergeSessionTelemetry(item, { ...result.telemetry, phase: "F2", ...(transitionFrom ? { transition_from: transitionFrom } : {}) } as Partial<SessionTelemetry>) : item));
      }
      const changes = analysisChangeKeys(analysis, result.analysis);
      setUnseenAnalysisKeys((current) => new Set([...current, ...changes]));
      setAnalysis(result.analysis);
      const selection = preserveAnalysisSelection({ selectedHypothesisId, activeNeedId }, result.analysis);
      setSelectedHypothesisId(selection.selectedHypothesisId);
      setActiveNeedId(selection.activeNeedId);
      setAnalysisStatus("ready");
      if (turnId && requestId) {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const startedAt = telemetryClockRef.current.get(requestId)?.actionStartedAt;
          const userVisible = startedAt === undefined ? null : Math.round(performance.now() - startedAt);
          setSessionTelemetry((current) => current.map((item) => item.request_id === requestId
            ? mergeSessionTelemetry(item, { latency_ms: { analysis_user_visible_ms: userVisible } }) : item));
        }));
      }
      return result;
    } catch (cause) {
      setAnalysisError(cause instanceof Error ? cause.message : "Rozbor se nepodařilo aktualizovat.");
      setAnalysisStatus("error");
      throw cause;
    }
  }

  function markAnalysisSeen(key: string) {
    setUnseenAnalysisKeys((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current); next.delete(key); return next;
    });
    setHighlightedAnalysisKeys((current) => new Set(current).add(key));
    window.setTimeout(() => setHighlightedAnalysisKeys((current) => {
      const next = new Set(current); next.delete(key); return next;
    }), 1800);
  }

  function markNotepadEntrySeen(entryId: string) {
    setNotepad((current) => Object.fromEntries(Object.entries(current).map(([category, items]) => [category,
      items.map((entry) => entry.id === entryId ? { ...entry, visibility: "seen" as const } : entry),
    ])) as NotepadState);
  }

  function clearF1ProcessingStatus() {
    if (f1ProcessingTimerRef.current) clearTimeout(f1ProcessingTimerRef.current);
    f1ProcessingTimerRef.current = null;
    f1ProcessingSequenceRef.current = null;
    f1MainPreparingRef.current = null;
    setF1ProcessingStatus(null);
  }

  function showF1ProcessingStatus(assistantId: string, stage: F1ProcessingStage) {
    setF1ProcessingStatus({ assistantId, stage });
  }

  function startF1ProcessingSequence(assistantId: string, notebookChanged: boolean) {
    const stages: Array<{ stage: F1ProcessingStage; holdMs: number }> = notebookChanged
      ? [
          { stage: "input_processed", holdMs: 380 },
          { stage: "notebook_updating", holdMs: 180 },
          { stage: "notebook_updated", holdMs: 380 },
        ]
      : [{ stage: "input_processed", holdMs: 380 }];
    let index = 0;
    f1ProcessingSequenceRef.current = { assistantId, complete: false };

    const advance = () => {
      const current = f1ProcessingSequenceRef.current;
      if (!current || current.assistantId !== assistantId) return;
      const next = stages[index];
      if (!next) {
        current.complete = true;
        if (f1MainPreparingRef.current === assistantId) showF1ProcessingStatus(assistantId, "preparing_response");
        return;
      }
      showF1ProcessingStatus(assistantId, next.stage);
      index += 1;
      f1ProcessingTimerRef.current = setTimeout(advance, next.holdMs);
    };

    advance();
  }

  function markF1MainPreparing(assistantId: string) {
    f1MainPreparingRef.current = assistantId;
    const sequence = f1ProcessingSequenceRef.current;
    if (!sequence || (sequence.assistantId === assistantId && sequence.complete)) {
      showF1ProcessingStatus(assistantId, "preparing_response");
    }
  }

  async function requestAssistant(
    rawText: string,
    assistantId: string,
    notepadForChat: NotepadState,
    sourceMessageId: string,
    turnId: string,
    requestId: string,
    dialogEvent?: string,
    controllerFastPathEligible = false,
  ) {
    const textTransition = resolveTextDialogEvent(rawText, compactNotepad(notepadForChat), phase);
    if (phase === "intake" && (dialogEvent === "continue_to_solution" || textTransition === "continue_to_solution")) {
      setPhase("development");
      const result = await refreshStructuredAnalysis(notepadForChat, "", turnId, requestId, "F1");
      setMessages((current) => current.map((message) => message.id === assistantId ? withCompletedLifecycleRecord({
        ...message, content: "", analysisEntryHypotheses: entryHypotheses(result.analysis), analysisNextPrompt: result.analysis.chatUpdate.nextPrompt, phaseLabel: "[FÁZE 2]",
        ...(result.diagnostics ? { diagnostics: result.diagnostics } : {}),
      }, { operation: "analysis-entry", state: "completed", label: "Vytvořeny pracovní hypotézy" }) : message));
      return;
    }
    const phaseTwoTransition = phase === "development" ? textTransition : null;
    if (phase === "development" && !dialogEvent && phaseTwoTransition !== "continue_to_output") {
      const result = await refreshStructuredAnalysis(notepadForChat, rawText, turnId, requestId);
      setMessages((current) => current.map((message) => message.id === assistantId ? {
        ...withCompletedLifecycleRecord(message, {
          operation: result.analysis.chatUpdate.kind === "entry" ? "analysis-entry" : "analysis-update",
          state: "completed",
          label: result.analysis.chatUpdate.kind === "entry" ? "Vytvořeny pracovní hypotézy" : "Aktualizován Rozbor",
        }),
        content: formatAnalysisChat(result.analysis), analysisNextPrompt: result.analysis.chatUpdate.nextPrompt,
        phaseLabel: "[FÁZE 2]",
        ...(result.diagnostics ? { diagnostics: result.diagnostics } : {}),
      } : message));
      return;
    }
    const pendingSide = [...messages].reverse()
      .find((message) => message.role === "assistant" && message.dialogActions?.some((action) => action.type === "SIDE"))
      ?.dialogActions?.find((action) => action.type === "SIDE");
    const askedRefinementTargets = [...new Set(messages.flatMap((message) =>
      message.role === "assistant"
        ? (message.dialogActions ?? []).filter((action) => action.type === "SIDE").map((action) => action.target)
        : [],
    ))];
    const functionalMapping = [...messages].reverse().find((message) => message.debugMapping)?.debugMapping;
    const request = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: rawText,
        previousResponseId: responseId,
        model: selectedModel,
        communicationProfile,
        selectedHypothesisId,
        activeNeedId,
        analysisContext: {
          hypothesis: (() => {
            const item = analysis.hypotheses.find((hypothesis) => hypothesis.id === selectedHypothesisId);
            return item ? { title: item.title, summary: item.summary, limitations: item.limitations, unknowns: item.unknowns } : null;
          })(),
          need: (() => {
            const item = analysis.needs.find((need) => need.needId === activeNeedId);
            return item ? { title: item.title, direction: item.direction, limitations: item.limitations } : null;
          })(),
          analysisMode: analysis.mode,
          mainUncertainty: analysis.mainUncertainty,
        },
        notebook: compactNotepad(notepadForChat, { excludeSourceMessageId: sourceMessageId }),
        intakeNotebook: compactNotepad(notepadForChat),
        phase,
        askedRefinementTargets,
        ...(pendingSide ? { pendingSide: { target: pendingSide.target, question: pendingSide.question } } : {}),
        ...(functionalMapping ? { functionalMapping } : {}),
        ...(dialogEvent ? { dialogEvent } : {}),
        ...(controllerFastPathEligible ? { controllerFastPathEligible: true } : {}),
        turnId,
      }),
    });

    if (!request.ok || !request.body) {
      const detail = await request.json().catch(() => null) as { error?: string } | null;
      throw new Error(detail?.error || "APU teď nemůže odpovědět.");
    }

    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let completeText = "";
    let receivedDone = false;
    let completedPhase: ConversationPhase | null = null;
    let receivedFirstDelta = false;

    const processLine = (line: string) => {
      if (!line.trim()) return;
      const event = JSON.parse(line);
      if (event.type === "status" && event.status === "preparing_response" && phase === "intake") {
        markF1MainPreparing(assistantId);
      }
      if (event.type === "delta") {
        if (!receivedFirstDelta) {
          const firstDelta = performance.now();
          receivedFirstDelta = true;
          if (phase === "intake") clearF1ProcessingStatus();
          const actionStartedAt = telemetryClockRef.current.get(requestId)?.actionStartedAt;
          const userToFirstToken = actionStartedAt === undefined ? null : Math.round(firstDelta - actionStartedAt);
          setSessionTelemetry((current) => current.map((item) => item.request_id === requestId
            ? mergeSessionTelemetry(item, { latency_ms: { user_to_first_token: userToFirstToken } }) : item));
        }
        completeText += event.text;
        const snapshot = splitAssistantMetadata(completeText);
        setMessages((current) => current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: snapshot.visibleContent,
              }
            : message,
        ));
      }
      if (event.type === "done") {
        receivedDone = true;
        const separated = splitAssistantMetadata(completeText, { ensureDebug: true });
        completeText = separated.visibleContent;
        if (event.responseId) setResponseId(event.responseId);
        if (event.phase) {
          const nextPhase = event.phase as ConversationPhase;
          completedPhase = nextPhase;
          setPhase(nextPhase);
          if (phase === "development" && nextPhase === "output") setActivePanel("output");
        }
        if (event.diagnostics || event.controllerDiagnostics || event.dialogActions) {
          setMessages((current) => current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  ...(event.diagnostics ? { diagnostics: event.diagnostics as Diagnostics } : {}),
                  ...(event.controllerDiagnostics ? { controllerDiagnostics: event.controllerDiagnostics as Diagnostics } : {}),
                  ...(Array.isArray(event.dialogActions) ? { dialogActions: event.dialogActions as DialogAction[] } : {}),
                  content: separated.visibleContent,
                  ...(separated.debugText ? { debugText: separated.debugText } : {}),
                  ...(separated.debugMapping ? { debugMapping: separated.debugMapping } : {}),
                  ...(typeof event.phaseLabel === "string" ? { phaseLabel: event.phaseLabel } : {}),
                }
              : message,
          ));
        }
        if (event.telemetry) {
          setSessionTelemetry((current) => current.map((item) => item.request_id === requestId
            ? mergeSessionTelemetry(item, event.telemetry as Partial<SessionTelemetry>) : item));
          setMessages((current) => current.map((message) => message.id === assistantId
            ? { ...message, telemetryRefs: [requestId] } : message));
        }
      }
      if (event.type === "error") throw new Error(event.message);
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) processLine(line);
    }

    buffer += decoder.decode();
    if (buffer.trim()) processLine(buffer);
    if (!completeText || !receivedDone) throw new Error("Model nevrátil dokončenou odpověď s usage daty.");
    if (phase === "intake" && completedPhase === "development") {
      const result = await refreshStructuredAnalysis(notepadForChat, "", turnId, requestId, "F1");
      setMessages((current) => current.map((message) => message.id === assistantId ? withCompletedLifecycleRecord({
        ...message, content: "", analysisEntryHypotheses: entryHypotheses(result.analysis), analysisNextPrompt: result.analysis.chatUpdate.nextPrompt,
        phaseLabel: "[FÁZE 2]",
        ...(result.diagnostics ? { diagnostics: result.diagnostics } : {}),
      }, { operation: "analysis-entry", state: "completed", label: "Vytvořeny pracovní hypotézy" }) : message));
    }
  }

  async function sendMessage(rawText: string, options?: { dialogEvent?: string; silent?: boolean }) {
    const text = rawText.trim();
    if (!text || isLoading || !isNotepadHydrated) return;

    if (isDictating) cancelDictation();

    const turnId = `turn-${createMessageId()}`;
    const requestId = `req-${createMessageId()}`;
    const startedAt = new Date().toISOString();
    telemetryClockRef.current.set(requestId, { actionStartedAt: performance.now() });
    const userMessage: Message = { id: createMessageId(), role: "user", content: rawText, turnId, createdAt: startedAt, telemetryRefs: [requestId], phaseLabel: phase === "intake" ? "[FÁZE 1]" : phase === "development" ? "[FÁZE 2]" : "[FÁZE 3]" };
    const assistantId = createMessageId();
    const isF1ProcessingTurn = phase === "intake" && !options?.dialogEvent;
    setSessionTelemetry((current) => [...current, createSessionTelemetry({ requestId, turnId, phase, startedAt })]);
    setMessages((current) => [
      ...current,
      ...(options?.silent ? [] : [userMessage]),
      {
        id: assistantId,
        role: "assistant",
        content: "",
        turnId,
        createdAt: new Date().toISOString(),
        telemetryRefs: [requestId],
        ...(options?.silent ? {} : { sourceMessageId: userMessage.id }),
        communicationProfile,
      },
    ]);
    setComposerInput("");
    setIsComposerExpanded(false);
    setError(null);
    setFailedInput(null);
    setIsLoading(true);
    if (isF1ProcessingTurn) showF1ProcessingStatus(assistantId, "processing_input");

    let requiresDecision = false;
    let controllerFastPathEligible = false;
    try {
      let notepadForChat = notepad;
      if (options?.dialogEvent) {
        await requestAssistant(rawText, assistantId, notepadForChat, options.silent ? "" : userMessage.id, turnId, requestId, options.dialogEvent);
        return;
      }
      try {
        const answersNeedQuestion = [...messages].reverse().find(
          (message) => message.role === "assistant" && message.dialogActions?.length,
        )?.dialogActions?.some((action) => action.type === "MAIN" && action.target === "teacher_need") ?? false;
        const extractionRequest = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: rawText,
            notebook: compactNotepad(notepad),
            answersNeedQuestion,
            turnId,
          }),
        });

        if (!extractionRequest.ok) {
          const detail = await extractionRequest.json().catch(() => null) as { error?: string } | null;
          throw new Error(detail?.error || "Zápisník se nepodařilo aktualizovat.");
        }

        const result = await extractionRequest.json() as {
          extraction: ExtractionResult;
          diagnostics?: Diagnostics;
          telemetry?: Partial<SessionTelemetry>;
        };
        if (result.telemetry) setSessionTelemetry((current) => current.map((item) => item.request_id === requestId
          ? mergeSessionTelemetry(item, result.telemetry as Partial<SessionTelemetry>) : item));
        const boundaryRequiresDecision = result.extraction.situationRelation === "different" ||
          result.extraction.situationRelation === "uncertain";
        const hasConflicts = result.extraction.candidates.some((candidate) => candidate.action === "conflict");
        requiresDecision = boundaryRequiresDecision || hasConflicts;

        if (!boundaryRequiresDecision) {
          const applied = applyCandidates(notepad, userMessage.id, result.extraction.candidates);
          notepadForChat = applied.state;
          controllerFastPathEligible = !hasConflicts && applied.added.length > 0;
          if (isF1ProcessingTurn) startF1ProcessingSequence(assistantId, applied.added.length > 0);
          if (applied.added.length) {
            setNotepad(applied.state);
            setMessages((current) => addCompletedLifecycleRecord(current, assistantId, {
              operation: "notebook", state: "completed", label: "Doplněn Zápisník",
            }));
          }
        }

        setMessages((current) => current.map((message) =>
          message.id === userMessage.id
            ? {
                ...message,
                extractionDiagnostics: result.diagnostics,
                ...((boundaryRequiresDecision || hasConflicts) ? { extraction: result.extraction } : {}),
              }
            : message,
        ));
      } catch (extractionCause) {
        setMessages((current) => current.map((message) =>
          message.id === userMessage.id
            ? {
                ...message,
                extractionWarning: extractionCause instanceof Error
                  ? extractionCause.message
                  : "Zápisník se nepodařilo aktualizovat.",
              }
            : message,
        ));
      }
      if (requiresDecision) {
        clearF1ProcessingStatus();
        setMessages((current) => current.filter((message) => message.id !== assistantId));
        return;
      }
      await requestAssistant(rawText, assistantId, notepadForChat, userMessage.id, turnId, requestId, undefined, controllerFastPathEligible);
      if (phase === "development") {
        setAnalysisFocus({ text: rawText, nonce: Date.now() });
      }
    } catch (cause) {
      clearF1ProcessingStatus();
      setMessages((current) => current.filter((message) => message.id !== assistantId));
      setFailedInput(rawText);
      setError(cause instanceof Error ? cause.message : "Nastala technická chyba.");
    } finally {
      setSessionTelemetry((current) => current.map((item) => item.request_id === requestId
        ? mergeSessionTelemetry(item, { completed_at: new Date().toISOString(), latency_ms: { total: Math.max(0, Date.now() - new Date(item.started_at).getTime()) } }) : item));
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!dictationSubmitReady) return;
    submitAfterDictationRef.current = false;
    dictationSubmitQueuedRef.current = false;
    void sendMessage(inputRef.current);
    // The counter is only a signal emitted after SpeechRecognition has flushed its final result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dictationSubmitReady]);

  function submitCurrentInput() {
    if (isDictating) {
      stopDictation(true);
      return;
    }
    void sendMessage(inputRef.current);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    submitCurrentInput();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitCurrentInput();
    }
  }

  function resetCurrentProject() {
    const reset = createProjectResetState(WELCOME);
    cancelDictation();
    speechSegmentsRef.current = [];
    dictationPrefixRef.current = "";
    dictationTranscriptRef.current = "";
    dictationFinalizedSessionRef.current = 0;
    setMessages(reset.messages);
    setNotepad(reset.notepad);
    setResponseId(reset.responseId);
    setPhase(reset.phase);
    setActivePanel(reset.activePanel);
    setError(reset.error);
    setFailedInput(reset.failedInput);
    setComposerInput(reset.composerInput);
    setIsComposerExpanded(reset.isComposerExpanded);
    setIsLoading(reset.isLoading);
    setIsStatsOpen(false);
    setExportStatus(reset.exportStatus);
    setDictationNotice(reset.dictationNotice);
    setHasDictationDraft(reset.hasDictationDraft);
    setAnalysis(EMPTY_ANALYSIS);
    setAnalysisStatus("idle");
    setAnalysisError(null);
    setSelectedHypothesisId(null);
    setActiveNeedId(null);
    setSkippedAnalysisQuestions([]);
    setAnalysisFocus(null);
    setUnseenAnalysisKeys(new Set());
    setHighlightedAnalysisKeys(new Set());
    setSessionTelemetry([]);
    telemetryClockRef.current.clear();
    sessionRef.current = { id: createMessageId(), startedAt: new Date().toISOString() };
  }

  function selectDialogAction(id: string, label: string) {
    const controlledText = id === "continue_to_solution" ? "Přejít do Rozboru" : label;
    void sendMessage(controlledText, { dialogEvent: id, silent: id === "continue_to_solution" });
  }

  function confirmSuggestedNeed(need: SuggestedNeed) {
    const normalized = need.title.trim().toLocaleLowerCase("cs-CZ");
    if (notepad.goals.some((item) => item.text.trim().toLocaleLowerCase("cs-CZ") === normalized)) return;
    setNotepad({
      ...notepad,
      goals: [...notepad.goals, { id: createLocalId("need"), text: need.title, origin: "manual", reviewStatus: "reviewed", needMapping: mapPedagogicalNeed(need.title) }],
    });
    setAnalysis((current) => ({
      ...current,
      suggestedNeeds: current.suggestedNeeds.filter((item) => item.id !== need.id),
    }));
  }

  function skipAnalysisQuestion(questionId: string) {
    const questionText = [...analysis.hypotheses.flatMap((item) => [item.question, ...item.questions]), ...analysis.needs.flatMap((item) => [item.question, ...item.questions])]
      .filter((question): question is NonNullable<typeof question> => question !== null)
      .find((question) => question.id === questionId)?.text.trim().toLocaleLowerCase("cs-CZ");
    if (questionText) setSkippedAnalysisQuestions((current) => [...new Set([...current, questionText])]);
    setAnalysis((current) => ({
      ...current,
      hypotheses: current.hypotheses.map((item) => ({
        ...item,
        question: item.question?.id === questionId ? null : item.question,
        questions: item.questions.map((question) => question.id === questionId ? { ...question, status: "skipped" as const } : question).filter((question) => question.status === "active"),
      })),
      needs: current.needs.map((item) => ({
        ...item,
        question: item.question?.id === questionId ? null : item.question,
        questions: item.questions.map((question) => question.id === questionId ? { ...question, status: "skipped" as const } : question).filter((question) => question.status === "active"),
      })),
    }));
  }

  function requestNewProject() {
    const hasNotepadContent = Object.values(notepad).some((items) => items.length > 0);
    const hasUnsavedChat = messages.some((message) => message.id !== WELCOME.id) || input.trim().length > 0 || hasNotepadContent;
    if (!shouldResetCurrentProject(
      hasUnsavedChat,
      () => window.confirm("Nový projekt smaže aktuální konverzaci i obsah Zápisníku v tomto zařízení. Chceš pokračovat?"),
    )) return;
    resetCurrentProject();
  }

  function navigateToSource(entry: NotepadEntry) {
    if (!entry.source) return;
    document.getElementById(`message-${entry.source.messageId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  function updateExtractionReview(messageId: string, update: (result: ExtractionResult) => ExtractionResult | undefined) {
    setMessages((current) => current.map((message) => {
      if (message.id !== messageId || !message.extraction) return message;
      return { ...message, extraction: update(message.extraction) };
    }));
  }

  async function resumeAfterReview(message: Message, notebookState: NotepadState) {
    if (isLoading) return;
    const assistantId = createMessageId();
    const turnId = message.turnId ?? `turn-${createMessageId()}`;
    const requestId = `req-${createMessageId()}`;
    const startedAt = new Date().toISOString();
    telemetryClockRef.current.set(requestId, { actionStartedAt: performance.now() });
    setSessionTelemetry((current) => [...current, createSessionTelemetry({ requestId, turnId, phase, startedAt })]);
    setMessages((current) => [...current, {
      id: assistantId,
      role: "assistant",
      content: "",
      sourceMessageId: message.id,
      turnId,
      createdAt: startedAt,
      telemetryRefs: [requestId],
      communicationProfile,
    }]);
    setError(null);
    setFailedInput(null);
    setIsLoading(true);
    try {
      await requestAssistant(message.content, assistantId, notebookState, message.id, turnId, requestId);
    } catch (cause) {
      setMessages((current) => current.filter((item) => item.id !== assistantId));
      setFailedInput(message.content);
      setError(cause instanceof Error ? cause.message : "Nastala technická chyba.");
    } finally {
      setSessionTelemetry((current) => current.map((item) => item.request_id === requestId
        ? mergeSessionTelemetry(item, { completed_at: new Date().toISOString(), latency_ms: { total: Math.max(0, Date.now() - new Date(item.started_at).getTime()) } }) : item));
      setIsLoading(false);
    }
  }

  function resolveBoundary(message: Message, applyToCurrent: boolean) {
    if (!message.extraction) return;
    if (applyToCurrent) {
      const applied = applyCandidates(notepad, message.id, message.extraction.candidates);
      setNotepad(applied.state);
      const conflicts = message.extraction.candidates.filter((candidate) => candidate.action === "conflict");
      updateExtractionReview(message.id, (result) => {
        return conflicts.length
          ? { ...result, situationRelation: "same", situationReason: null, candidates: conflicts }
          : undefined;
      });
      if (!conflicts.length) void resumeAfterReview(message, applied.state);
    } else {
      updateExtractionReview(message.id, () => undefined);
      void resumeAfterReview(message, notepad);
    }
  }

  function resolveConflict(
    message: Message,
    candidate: ExtractionCandidate,
    decision: "replace" | "other-period" | "keep",
  ) {
    let nextNotepad = notepad;
    if (decision === "replace") {
      nextNotepad = replaceEntryFromConflict(notepad, message.id, candidate);
      setNotepad(nextNotepad);
    }
    if (decision === "other-period") {
      const applied = applyCandidates(notepad, message.id, [{ ...candidate, action: "add" }]);
      nextNotepad = applied.state;
      setNotepad(nextNotepad);
    }
    const remaining = message.extraction?.candidates.filter(
      (item) => item !== candidate && item.action === "conflict",
    ) ?? [];
    updateExtractionReview(message.id, (result) => {
      const candidates = result.candidates.filter((item) => item !== candidate);
      return candidates.some((item) => item.action === "conflict")
        ? { ...result, candidates }
        : undefined;
    });
    if (!remaining.length) void resumeAfterReview(message, nextNotepad);
  }

  function exportSessionJson() {
    try {
      downloadSessionExport(buildSessionExport({
        session: {
          id: sessionRef.current.id, startedAt: sessionRef.current.startedAt, phase, communicationProfile, activePanel,
          appVersion: APU_SITE_RUNTIME_RELEASE, coreVersion: ACTIVE_APU_CORE_VERSION,
          coreReleaseId: ACTIVE_APU_CORE_RELEASE_ID, runtimeWrapper: "app/runtime-instructions.ts",
        },
        messages, notepad, analysis: analysis.hypotheses.length || analysis.needs.length ? analysis : null,
        output: null, telemetry: sessionTelemetry,
      }));
      setExportStatus("downloaded");
    } catch {
      setExportStatus("error");
    }
    window.setTimeout(() => setExportStatus("idle"), 2600);
  }

  return (
    <main className="app-shell">
      <section
        ref={chatCardRef}
        className={`chat-card${isDevLogOpen ? " is-dev-log-open" : ""}${isResizingWorkspace ? " is-resizing-workspace" : ""}`}
        style={{ "--desktop-chat-split": `${effectiveDesktopSplit}%` } as CSSProperties}
        aria-label="Konverzace s APU"
      >
        <header className="app-header">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <ApuLogo variant="horizontal" />
            </span>
            <span className="account-email" title={email}>{email}</span>
            {isDeveloper && <DeveloperHeaderControls open={isDevLogOpen} onToggle={() => setIsDevLogOpen((value) => !value)} />}
            <h1 className="sr-only">APU — Asistent pedagogické podpory</h1>
          </div>

          {isDeveloper && <div className="conversation-diagnostics" ref={statsRef}>
            <div className="model-row">
              <label htmlFor="model-select">Model</label>
              <div className="model-select-wrap">
                <select
                  id="model-select"
                  value={selectedModel}
                  onChange={(event) => setSelectedModel(event.target.value as ModelSelection)}
                  disabled={isLoading}
                  aria-describedby="model-state"
                >
                  <option value={AUTO_MODEL_OPTION.id}>{AUTO_MODEL_OPTION.label}</option>
                  {MODEL_OPTIONS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>
              <span id="model-state" className={`model-state${isLoading ? " is-working" : ""}`} aria-live="polite">
                {isLoading ? "Pracuje…" : "pro další odpověď"}
              </span>
            </div>

            <button
              ref={statsButtonRef}
              className="stats-trigger"
              type="button"
              aria-expanded={isStatsOpen}
              aria-controls="conversation-stats-popover"
              onClick={() => setIsStatsOpen((open) => !open)}
              title={costTooltip}
            >
              <span className="stats-desktop">
                Konverzace · <b>IN</b> {formatInteger(summary.inputTokens)} · <b>OUT</b> {formatInteger(summary.outputTokens)} · <b>Σ</b> {formatInteger(summary.totalTokens)} tok. · <b>{formatCost(summary.estimatedCostUsd)}</b>
              </span>
              <span className="stats-mobile">
                <b>{formatCost(summary.estimatedCostUsd)}</b>
              </span>
              <span className="info-icon" aria-hidden="true">i</span>
            </button>

            {isStatsOpen && (
              <div
                id="conversation-stats-popover"
                className="stats-popover"
                role="dialog"
                aria-label="Detail spotřeby této konverzace"
              >
                <strong>Tato konverzace</strong>
                <dl>
                  <div><dt>Vstupní tokeny</dt><dd>{formatInteger(summary.inputTokens)}</dd></div>
                  {summary.cachedInputTokens !== undefined && (
                    <div><dt>z toho cachované</dt><dd>{formatInteger(summary.cachedInputTokens)}</dd></div>
                  )}
                  {summary.cacheWriteTokens !== undefined && (
                    <div><dt>zapsané do cache</dt><dd>{formatInteger(summary.cacheWriteTokens)}</dd></div>
                  )}
                  <div><dt>Výstupní tokeny</dt><dd>{formatInteger(summary.outputTokens)}</dd></div>
                  {summary.reasoningTokens !== undefined && (
                    <div><dt>Reasoning tokeny</dt><dd>{formatInteger(summary.reasoningTokens)}</dd></div>
                  )}
                  <div className="stats-total"><dt>Celkem</dt><dd>{formatInteger(summary.totalTokens)}</dd></div>
                  {summary.fileSearchCalls !== undefined && (
                    <div><dt>Vyhledání v KB</dt><dd>{formatInteger(summary.fileSearchCalls)}</dd></div>
                  )}
                  <div title={costTooltip}><dt>Odhad ceny</dt><dd>{formatCost(summary.estimatedCostUsd)}</dd></div>
                  <div><dt>API volání</dt><dd>{formatInteger(summary.responseCount)}</dd></div>
                </dl>
                <p>{costTooltip}</p>
              </div>
            )}
          </div>}

          <nav className="project-actions" aria-label="Projekt a účet">
            <button type="button" onClick={requestNewProject} disabled={isLoading} aria-label="Nový projekt" title="Nový projekt">
              <FilePlus2 aria-hidden="true" />
            </button>
            <button type="button" disabled aria-label="Uložit projekt – připravuje se" title="Uložení projektu připravujeme">
              <Save aria-hidden="true" />
            </button>
            <button type="button" disabled aria-label="Otevřít projekt – připravuje se" title="Otevírání projektů připravujeme">
              <FolderOpen aria-hidden="true" />
            </button>
            <button type="button" disabled aria-label="Přihlášení – připravuje se" title="Přihlášení připravujeme">
              <UserRound aria-hidden="true" />
            </button>
          </nav>
        </header>

        <div className="message-list" aria-live="polite" aria-busy={isLoading}>
          {messages.map((message) => (
            <div className="message-turn" key={message.id}>
              <article id={`message-${message.id}`} className={`message message--${message.role}`}>
              {message.role === "assistant" ? (
                <div className="message-author">
                  <ApuLogo className="message-avatar-logo" />
                  {message.phaseLabel && (
                    <span className="message-phase">{message.phaseLabel.replace(/^\[|\]$/g, "")}</span>
                  )}
                </div>
              ) : (
                <span className="message-label">Vy</span>
              )}
              {message.role === "assistant" && message.lifecycleRecords && message.lifecycleRecords.length > 0 && (
                <div className="message-lifecycle-records" aria-label="Dokončené kroky">
                  {message.lifecycleRecords.map((record) => (
                    <CompletedLifecycleStatus key={record.operation} record={record} />
                  ))}
                </div>
              )}
              <div className={message.role === "assistant" && (message.content || message.analysisEntryHypotheses) ? "assistant-response" : undefined}>
                <div className="message-content">
                  {message.content
                    ? (
                        <HighlightedMessage
                          message={message}
                          notepad={notepad}
                        />
                      )
                    : message.analysisEntryHypotheses
                      ? <F2EntrySummary hypotheses={message.analysisEntryHypotheses} onOpenAnalysis={() => setActivePanel("analysis")} />
                      : f1ProcessingStatus?.assistantId === message.id
                      ? <ProcessingStatus stage={f1ProcessingStatus.stage} />
                      : <span className="typing"><i /><i /><i /></span>}
                </div>
                {message.role === "assistant" && message.analysisNextPrompt?.type === "question" && (
                  <AnalysisQuestionRow text={message.analysisNextPrompt.text} className="analysis-chat-question" />
                )}
                {message.role === "assistant" && message.dialogActions?.map((action, actionIndex) => (
                  <DialogActionCard
                    key={`${action.type}-${action.target}-${actionIndex}`}
                    action={action}
                    active={message.id === activeDialogMessageId && !isLoading}
                    onSelect={selectDialogAction}
                  />
                ))}
              </div>
              {message.extractionWarning && (
                <p className="extraction-warning">Zápisník: {message.extractionWarning} Chat pokračoval beze změny zápisu.</p>
              )}
              {message.extraction && (
                <aside className="extraction-review" aria-label="Kontrola zápisu do Zápisníku">
                  {(message.extraction.situationRelation === "different" || message.extraction.situationRelation === "uncertain") ? (
                    <div className="situation-review">
                      <strong>Tohle může být jiná řešená situace.</strong>
                      {message.extraction.situationReason && <p>{message.extraction.situationReason}</p>}
                      <div className="review-actions">
                        <button type="button" onClick={() => resolveBoundary(message, true)}>Patří sem</button>
                        <button type="button" className="is-secondary" onClick={() => resolveBoundary(message, false)}>Nezapisovat</button>
                      </div>
                    </div>
                  ) : (
                    message.extraction.candidates
                      .filter((candidate) => candidate.action === "conflict")
                      .map((candidate, index) => (
                        <div className="conflict-review" key={`${candidate.category}-${candidate.start}-${index}`}>
                          <strong>Nový údaj mění existující zápis.</strong>
                          <p>Nově: „{candidate.notebookText}“</p>
                          <div className="review-actions">
                            <button type="button" onClick={() => resolveConflict(message, candidate, "replace")}>Změnit údaj</button>
                            <button type="button" className="is-secondary" onClick={() => resolveConflict(message, candidate, "other-period")}>Jiné období</button>
                            <button type="button" className="is-secondary" onClick={() => resolveConflict(message, candidate, "keep")}>Ponechat původní</button>
                          </div>
                        </div>
                      ))
                  )}
                </aside>
              )}
              {isDeveloper && message.role === "assistant" && message.diagnostics && (
                <aside className="response-diagnostics" aria-label="Diagnostika odpovědi">
                  {message.debugText && <div className="diagnostic-debug">{message.debugText}</div>}
                  <div className="diagnostic-usage">
                    <span className="diagnostic-model" title={`Server potvrdil: ${message.diagnostics.model}`}>
                      {displayModel(message.diagnostics.model)}
                    </span>
                    {message.diagnostics.reasoning && (
                      <span title="Reasoning skutečně použitý pro tento request">reasoning {message.diagnostics.reasoning}</span>
                    )}
                    {message.diagnostics.knowledgeBaseEnabled !== undefined && (
                      <span title="Knowledge Base podle skutečně sestaveného requestu">
                        KB {message.diagnostics.knowledgeBaseEnabled ? "zapnuto" : "vypnuto"}
                      </span>
                    )}
                    <span title="Kompletní vstupní tokeny reportované API včetně instrukcí, historie a načteného kontextu">
                      IN {formatInteger(message.diagnostics.inputTokens)}
                    </span>
                    <span title="Výstupní tokeny včetně interního reasoningu">
                      OUT {formatInteger(message.diagnostics.outputTokens)}
                    </span>
                    <span title="Mechanický součet IN + OUT">Σ {formatInteger(message.diagnostics.inputTokens + message.diagnostics.outputTokens)}</span>
                    <span className="diagnostic-cost" title={message.diagnostics.estimatedCostUsd === null ? UNKNOWN_COST_TOOLTIP : COST_TOOLTIP}>
                      {formatCost(message.diagnostics.estimatedCostUsd)}
                    </span>
                    {message.controllerDiagnostics && (
                      <span className="diagnostic-controller" title="Samostatné volání Quest Controlleru">
                        QC IN {formatInteger(message.controllerDiagnostics.inputTokens)} · OUT {formatInteger(message.controllerDiagnostics.outputTokens)} · {formatCost(message.controllerDiagnostics.estimatedCostUsd)}
                      </span>
                    )}
                  </div>
                </aside>
              )}
              </article>
            </div>
          ))}

          {error && (
            <div className="error-box" role="alert">
              <div>
                <strong>Odpověď se nepodařilo načíst</strong>
                <span>{error}</span>
              </div>
              {failedInput && (
                <button type="button" onClick={() => void sendMessage(failedInput)} disabled={isLoading}>
                  Zkusit znovu
                </button>
              )}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form className="composer" onSubmit={submit}>
          <div className={`composer-field${isComposerExpanded && !isDictating ? " is-expanded" : ""}${isDictating ? " is-dictating" : ""}`}>
            <label className="sr-only" htmlFor="message">Zpráva pro APU</label>
            {isComposerExpanded && !isDictating && (
              <textarea
                ref={textareaRef}
                id="message"
                rows={1}
                value={input}
                onChange={(event) => handleInputChange(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={INPUT_PLACEHOLDER}
                disabled={isLoading || !isNotepadHydrated}
              />
            )}
            <div className="composer-toolbar">
              <button
                className={`composer-left-action${isDictating ? " is-cancel" : ""}`}
                type="button"
                onClick={() => {
                  if (isDictating) cancelDictation();
                  else setDictationNotice("Přidávání příloh zatím není aktivní.");
                }}
                disabled={isLoading || !isNotepadHydrated}
                aria-label={isDictating ? "Zahodit diktovaný text" : "Přidat přílohu (připravujeme)"}
                title={isDictating ? "Zahodit diktovaný text" : "Přidat přílohu (připravujeme)"}
              >
                {isDictating ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
              </button>
              {isDictating ? (
                <div className="composer-listening" aria-live="polite">
                  <span className="dictation-waveform" role="status" aria-label="Diktování je aktivní">
                    {Array.from({ length: 15 }, (_, index) => <i key={index} aria-hidden="true" />)}
                  </span>
                </div>
              ) : (
                <button
                  className="composer-entry-trigger"
                  type="button"
                  onClick={expandComposer}
                  disabled={isLoading || !isNotepadHydrated}
                  aria-label="Napsat zprávu pro APU"
                >
                  {!isComposerExpanded && <span>{INPUT_PLACEHOLDER}</span>}
                </button>
              )}
              <div className="composer-actions">
                <button
                  className={`dictation-button${isDictating ? " is-active" : ""}`}
                  type="button"
                  onClick={startDictation}
                  disabled={isLoading || !isNotepadHydrated}
                  aria-pressed={isDictating}
                  aria-label={isDictating ? "Zastavit diktování" : "Spustit diktování"}
                  title={isDictationSupported
                    ? isDictating ? "Zastavit diktování" : "Nadiktovat zprávu"
                    : "Diktování tento prohlížeč nepodporuje"}
                >
                  {isDictating ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
                </button>
                <button
                  className="send-button"
                  type="submit"
                  disabled={(!input.trim() && !hasDictationDraft) || isLoading || !isNotepadHydrated}
                  aria-label={isLoading ? "APU odpovídá" : "Odeslat zprávu"}
                  title={isLoading ? "APU odpovídá" : "Odeslat"}
                >
                  <ArrowUp aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
          <p className={`composer-hint${dictationNotice ? " is-error" : ""}`} aria-live="polite">
            {dictationNotice ?? (isDictating
              ? "Poslouchám… Diktování ukončíte tlačítkem Stop nebo Odeslat."
              : "Enter odešle · Shift + Enter vloží nový řádek")}
          </p>
        </form>

        <WorkspacePanel
          activePanel={activePanel}
          entries={notepad}
          onEntriesChange={setNotepad}
          onEntryNavigate={navigateToSource}
          onEntrySeen={markNotepadEntrySeen}
          phase={phase}
          analysis={analysis}
          analysisStatus={analysisStatus}
          analysisError={analysisError}
          selectedHypothesisId={selectedHypothesisId}
          activeNeedId={activeNeedId}
          onSelectHypothesis={setSelectedHypothesisId}
          onSelectNeed={setActiveNeedId}
          onRetryAnalysis={() => void refreshStructuredAnalysis(notepad, analysisFocus?.text ?? "")}
          onSkipAnalysisQuestion={skipAnalysisQuestion}
          unseenAnalysisKeys={unseenAnalysisKeys}
          highlightedAnalysisKeys={highlightedAnalysisKeys}
          onAnalysisItemSeen={markAnalysisSeen}
          onConfirmSuggestedNeed={confirmSuggestedNeed}
          onContinueToOutput={() => void sendMessage("Přejít k vytvoření výstupu", {
            dialogEvent: "continue_to_output",
            silent: true,
          })}
          f2Build={f2Build}
          f2Preview={f2Build ? previewStatus(f2Preview, f2Build) : f2Preview}
          f2BuildStatus={f2BuildStatus}
          f2BuildError={f2BuildError}
          f2PreviewStatus={f2PreviewStatus}
          f2PreviewError={f2PreviewError}
          onF2PathChange={(path) => setF2Build((current) => current ? switchF2Path(current, path) : current)}
          onF2SkillToggle={(id) => setF2Build((current) => current ? toggleF2Skill(current, id) : current)}
          onF2ParameterChange={(id, value) => setF2Build((current) => current ? parameterizeF2Skill(current, id, value) : current)}
          onF2ContextAdd={(text) => setF2Build((current) => current ? addF2Context(current, { id: createLocalId("f2-context"), text }) : current)}
          onF2ContextRemove={(id) => setF2Build((current) => current ? removeF2Context(current, id) : current)}
          onF2Execute={() => void executeF2Build()}
          onF2Preview={() => void renderF2Preview()}
        />

        {activePanel && <div
          className="workspace-resize-handle"
          role="separator"
          aria-label="Změnit šířku chatu a pracovního panelu"
          aria-orientation="vertical"
          aria-valuemin={Math.round(clampDesktopSplit(0, chatCardRef.current?.getBoundingClientRect().width ?? 720))}
          aria-valuemax={Math.round(clampDesktopSplit(100, chatCardRef.current?.getBoundingClientRect().width ?? 720))}
          aria-valuenow={Math.round(effectiveDesktopSplit)}
          tabIndex={0}
          onKeyDown={handleSplitKeyDown}
          onDoubleClick={() => savePreferredDesktopSplit(DEFAULT_DESKTOP_SPLIT)}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            setIsResizingWorkspace(true);
            updateDesktopSplitFromClientX(event.clientX);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) updateDesktopSplitFromClientX(event.clientX);
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            setIsResizingWorkspace(false);
          }}
          onPointerCancel={() => setIsResizingWorkspace(false)}
        />}

        {isDeveloper && <aside
          id="diagnostics-drawer"
          className={`diagnostics-drawer${isDiagnosticsDrawerOpen ? " is-open" : ""}`}
          aria-label="Nastavení modelu, diagnostiky a vzhledu"
        >
          <div className="diagnostics-drawer-content">
            <div className="diagnostics-drawer-body">
              <section className="settings-section" aria-labelledby="model-settings-title">
                <h2 id="model-settings-title">Model</h2>
                <label className="sr-only" htmlFor="drawer-model-select">Model pro další odpověď</label>
                <select
                  id="drawer-model-select"
                  value={selectedModel}
                  onChange={(event) => setSelectedModel(event.target.value as ModelSelection)}
                  disabled={isLoading}
                >
                  <option value={AUTO_MODEL_OPTION.id}>{AUTO_MODEL_OPTION.label}</option>
                  {MODEL_OPTIONS.map((model) => (
                    <option key={model.id} value={model.id}>{model.label}</option>
                  ))}
                </select>
              </section>
              <section className="settings-section" aria-labelledby="profile-settings-title">
                <h2 id="profile-settings-title">Komunikační profil</h2>
                <label className="sr-only" htmlFor="drawer-profile-select">Komunikační profil APU pro další odpověď</label>
                <select
                  id="drawer-profile-select"
                  value={communicationProfile}
                  onChange={(event) => setCommunicationProfile(event.target.value as CommunicationProfileId)}
                  disabled={isLoading}
                >
                  {COMMUNICATION_PROFILE_OPTIONS.map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.label}</option>
                  ))}
                </select>
              </section>
              <section className="settings-section" aria-labelledby="usage-settings-title">
                <h2 id="usage-settings-title">Tato konverzace</h2>
                <dl>
                  <div className="stats-token-pair">
                    <div><dt>IN</dt><dd>{formatInteger(summary.inputTokens)}</dd></div>
                    <div><dt>OUT</dt><dd>{formatInteger(summary.outputTokens)}</dd></div>
                  </div>
                  <div><dt>Celkem</dt><dd>{formatInteger(summary.totalTokens)} tok.</dd></div>
                  <div><dt>Odhad ceny</dt><dd>{formatCost(summary.estimatedCostUsd)}</dd></div>
                </dl>
              </section>
              <section className="settings-section design-settings-body" aria-labelledby="design-settings-title">
                <h2 id="design-settings-title">Vzhled</h2>
                <label htmlFor="color-theme-select">Barevná paleta</label>
                <select
                  id="color-theme-select"
                  value={design.colorTheme}
                  onChange={(event) => design.setColorTheme(event.target.value as ColorThemeId)}
                >
                  {COLOR_THEMES.map((theme) => <option key={theme.id} value={theme.id}>{theme.label}</option>)}
                </select>

                <label htmlFor="typography-select">Písmo</label>
                <select
                  id="typography-select"
                  value={design.typography}
                  onChange={(event) => design.setTypography(event.target.value as TypographyPresetId)}
                >
                  {TYPOGRAPHY_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
                </select>

                <label htmlFor="font-size-select">Velikost písma</label>
                <select
                  id="font-size-select"
                  value={design.fontSize}
                  onChange={(event) => design.setFontSize(event.target.value as FontSizeId)}
                >
                  {FONT_SIZE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>

                <button className="design-reset" type="button" onClick={design.reset}>Vrátit APU Default</button>
              </section>
            </div>
          </div>
        </aside>}

        <nav className="tool-rail" aria-label="Rychlé nástroje">
          {isDeveloper && <button
            className={`tool-rail-button tool-rail-diagnostics${isDiagnosticsDrawerOpen ? " is-active" : ""}`}
            type="button"
            onClick={() => setIsDiagnosticsDrawerOpen((open) => !open)}
            aria-expanded={isDiagnosticsDrawerOpen}
            aria-controls="diagnostics-drawer"
            aria-label={isDiagnosticsDrawerOpen ? "Zavřít nastavení" : "Otevřít nastavení"}
            title="Nastavení"
          >
            <Settings aria-hidden="true" />
          </button>}
          <button
            className={`tool-rail-button tool-rail-copy${exportStatus === "downloaded" ? " is-confirmed" : ""}`}
            type="button"
            onClick={exportSessionJson}
            aria-label="Stáhnout APU Session JSON"
            title="Stáhnout APU Session JSON"
          >
            {exportStatus === "downloaded"
              ? <Check aria-hidden="true" />
              : <Download aria-hidden="true" />}
          </button>
          <span className="export-feedback" role="status" aria-live="polite">
            {exportStatus === "downloaded" ? "APU Session JSON byl stažen."
                  : exportStatus === "error" ? "Export se nepodařilo dokončit."
                    : ""}
          </span>
          {([
            { id: "notepad" as const, label: "Zápisník", Icon: NotebookPen },
            { id: "analysis" as const, label: "Rozbor", Icon: ScanSearch },
            { id: "output" as const, label: "Výstup", Icon: FileText },
          ]).map(({ id, label, Icon }) => (
            <button
              className={`tool-rail-button tool-rail-workspace tool-rail-${id}${activePanel === id ? " is-active" : ""}${(id === "notepad" && hasUnreadNotepadChange) || (id === "analysis" && hasUnreadAnalysisChange) ? " has-update" : ""}`}
              key={id}
              type="button"
              onClick={() => togglePanel(id)}
              aria-expanded={activePanel === id}
              aria-controls="workspace-panel-content"
              aria-label={activePanel === id ? `Zavřít ${label.toLocaleLowerCase("cs")}` : `Otevřít ${label.toLocaleLowerCase("cs")}`}
              title={label}
            >
              <Icon aria-hidden="true" />
              {((id === "notepad" && hasUnreadNotepadChange) || (id === "analysis" && hasUnreadAnalysisChange)) && <span className="notepad-update-badge" aria-hidden="true" />}
            </button>
          ))}
        </nav>
        {isDeveloper && isDevLogRendered && sharedFeedback && <DevLogPanel result={sharedFeedback} open={isDevLogOpen} onClose={() => setIsDevLogOpen(false)} />}
      </section>
    </main>
  );
}
