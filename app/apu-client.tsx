"use client";

import {
  CSSProperties,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Download,
  FlaskConical,
  FilePlus2,
  FolderOpen,
  Info,
  Mic,
  NotebookPen,
  Plus,
  ScanSearch,
  Settings,
  Save,
  Square,
  DollarSign,
  LogOut,
  X,
  FileText,
} from "lucide-react";
import { AccessSessionBoundary } from "./access-session-boundary";
import { notebookOwnerId } from "./notebook-storage";
import { Diagnostics } from "./conversation-diagnostics";
import { ACTIVE_APU_CORE_RELEASE_ID, ACTIVE_APU_CORE_VERSION, APU_SITE_RUNTIME_RELEASE } from "./core-config";
import { buildSessionExport, createSessionTelemetry, downloadSessionExport, mergeSessionTelemetry, type SessionTelemetry } from "./session-export";
import {
  appendModelUsageSessionRecords,
  createModelUsageSession,
  readModelUsageRecords,
  type ModelUsageRecordsResponse,
} from "./model-usage-collection";
import { compareUsageShadow, type UsageShadowComparison } from "./usage-shadow-comparison";
import { MODEL_CATALOG } from "./model-config";
import { AUTO_MODEL_SELECTION, type ModelSelection } from "./model-routing";
import { WorkspacePanel, type WorkspacePanel as WorkspacePanelId, usePersistentNotepad } from "./notepad";
import type { WorkingDocumentStyle } from "./document-presentation";
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
  type F2Path,
  replaceEntryFromConflict,
} from "./notepad-model";
import { findAssistantHighlightRanges } from "./assistant-highlights";
import ApuLogo from "./apu-logo";
import DialogActionCard from "./dialog-action-card";
import { AnalysisQuestionRow } from "./analysis-question-row";
import { F2EntrySummary } from "./f2-entry-summary";
import { resolveDialogEvent, resolveF2OutputNavigation, resolveTextDialogEvent, type ConversationPhase, type DialogAction } from "./dialog-action";
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
import { clampDesktopSplit, DEFAULT_DESKTOP_SPLIT, DESKTOP_SPLIT_STORAGE_KEY, DESKTOP_WORKSPACE_QUERY, INITIAL_INTAKE_WORKSPACE, INITIAL_PROCESSING_WORKSPACE, readDesktopSplitPreference, selectDesktopTool, selectDesktopView, workspaceAvailability, type DesktopTool, type DesktopView } from "./desktop-workspace";
import { F2BuildOperations } from "./f2-build-operations";
import { activeNeedRoutingKey, bindNeedRoutingDecision, createNeedRouter, type NeedRoutingDecision } from "./f2-need-routing";
import { DEV_TEST_SCENARIOS, type DevTestScenario } from "./dev-test-scenarios";
import { acceptRenderedPreview, addF2Context, advanceAcceptedF2Source, applyCurrentRozborComponentUpdate, applyF2BuildResult, canonicalF1NeedFingerprint, createCurrentRozborGenerationRequest, createCurrentRozborState, createF2BuildRequest, createF2PreviewSnapshot, createF2ToF3Snapshot, currentRozborSourceFingerprint, deriveRequiredCurrentRozborComponents, parameterizeF2Skill, parseF2BuildResult, parseF2RenderedPreview, parseGeneratedRozborComponents, previewStatus, reconcileRozborComponents, removeF2Context, synchronizeF2BuildWithCanonicalNeed, toggleF2Skill, type CurrentRozborState, type F2AnalysisContext, type F2ToF3Snapshot, type F2BuildState, type F2NotebookContextItem, type F2PreviewState } from "./f2-build-model";
import { acceptBuildDocumentUpdate, acceptWorkingDocumentMetadata, type WorkingDocumentMetadata } from "./working-document-lifecycle";
import { acceptF3Render, adoptF2Snapshot, createF3RenderRequest, createF3State, f3GenerationEligibility, isDefaultF3Presentation, markF3SourceStale, resetF3Presentation, parseF3RenderResult, updateF3Config, type F3Config, type F3State } from "./f3-finalization-model";

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorLike = { error: string };

const SPLIT_KEYBOARD_STEP = 2;

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
  analysisEntryHypotheses?: AnalysisState["hypotheses"];
  lifecycleRecords?: CompletedLifecycleRecord[];
};

function entryHypotheses(analysis: AnalysisState): AnalysisState["hypotheses"] { return analysis.hypotheses; }

function usesDesktopWorkspaceLayout() {
  return window.matchMedia(DESKTOP_WORKSPACE_QUERY).matches;
}

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content: "Popište mi situaci, se kterou chcete dnes pracovat.",
  createdAt: new Date().toISOString(),
};

const WELCOME_HELP = "Například: Při ranním kruhu často vstává, odchází od ostatních a při návratu se obtížně znovu zapojuje do společné činnosti.";

function WelcomeQuestion({ content }: { content: string }) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <span
      className="welcome-question"
      onMouseEnter={() => setHelpOpen(true)}
      onMouseLeave={() => setHelpOpen(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHelpOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setHelpOpen(false);
      }}
    >
      <span>{content}</span>
      <button
        type="button"
        className="welcome-help-trigger"
        aria-label="Zobrazit příklad situace"
        aria-expanded={helpOpen}
        aria-describedby={helpOpen ? "welcome-help" : undefined}
        onFocus={() => setHelpOpen(true)}
        onClick={() => setHelpOpen((open) => !open)}
      >
        <Info aria-hidden="true" />
      </button>
      {helpOpen && <span id="welcome-help" role="tooltip" className="welcome-help">{WELCOME_HELP}</span>}
    </span>
  );
}

const MODEL_OPTIONS = Object.values(MODEL_CATALOG);
const AUTO_MODEL_OPTION = { id: AUTO_MODEL_SELECTION, label: "Automaticky · Luna / Terra" } as const;
const COMMUNICATION_PROFILE_OPTIONS = Object.values(COMMUNICATION_PROFILES);
const CZK_PER_USD = 21.5;
const COST_TOOLTIP = "Přibližný přepočet podle usage dat API a nakonfigurovaných sazeb modelu při kurzu 1 USD = 21,5 Kč. Skutečná fakturace se může lišit.";
const UNKNOWN_COST_TOOLTIP = "Cenová sazba použitého modelu není nakonfigurována; tokeny jsou zobrazeny bez odhadu ceny.";
const INCOMPLETE_COST_TOOLTIP = "Úplný odhad ceny není k dispozici, protože některé volání nemá spolehlivá usage nebo cenová data. Známý subtotal zůstává uveden níže.";
const INPUT_PLACEHOLDER = "Napište APU...";
// Presentation only; phase/debug metadata remains available to session instrumentation.
const SHOW_INLINE_CHAT_DEBUG = false;

function createMessageId() {
  return globalThis.crypto?.randomUUID?.() ??
    `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("cs-CZ").format(value);
}

function formatTelemetryDuration(value: number | null | undefined) {
  return value == null ? "—" : `${formatInteger(value)} ms`;
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
};

function DeveloperHeaderControls({
  onSelectScenario,
}: {
  onSelectScenario: (scenario: DevTestScenario) => void;
}) {
  const [scenarioMenuOpen, setScenarioMenuOpen] = useState(false);
  const scenarioPickerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!scenarioMenuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!scenarioPickerRef.current?.contains(event.target as Node)) setScenarioMenuOpen(false);
    };
    const closeWithEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setScenarioMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [scenarioMenuOpen]);

  return (
    <span className="developer-controls">
      <span className="developer-indicator" title="Developer režim je aktivní">DEV ON</span>
      <span className="dev-scenario-picker" ref={scenarioPickerRef}>
        <button
          type="button"
          className="developer-log-toggle"
          aria-label="Testovací scénáře"
          aria-expanded={scenarioMenuOpen}
          aria-controls="dev-scenario-menu"
          title="Testovací scénáře"
          onClick={() => setScenarioMenuOpen((value) => !value)}
        >
          <FlaskConical aria-hidden="true" />
        </button>
        {scenarioMenuOpen && <span id="dev-scenario-menu" className="dev-scenario-menu" role="menu" aria-label="Testovací scénáře">
          {([1, 2, 3] as const).map((difficulty) => <span key={difficulty} className="dev-scenario-column" role="group" aria-label={`Obtížnost ${difficulty}`}>
            <strong className="dev-scenario-path">Obtížnost {difficulty}</strong>
            {DEV_TEST_SCENARIOS.filter((scenario) => scenario.difficulty === difficulty)
              .map((scenario) => <button
                key={scenario.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  onSelectScenario(scenario);
                  setScenarioMenuOpen(false);
                }}
              >
                <strong>{scenario.difficulty} · {scenario.load}</strong>
                <span>{scenario.subtitle}</span>
                <span>{scenario.label}</span>
              </button>)}
          </span>)}
        </span>}
      </span>
    </span>
  );
}

export default function ApuClient(props: ApuClientProps) {
  return <AccessSessionBoundary key={`${notebookOwnerId(props)}:${props.isDeveloper}`} identity={props}>
    {controls => <ApuWorkspace {...props} {...controls} />}
  </AccessSessionBoundary>;
}

function ApuWorkspace({ email, isDeveloper, onLogout, registerInvalidation }: ApuClientProps & {
  onLogout: (hasWork: boolean) => void;
  registerInvalidation: (callback: (logout?: boolean) => void) => () => void;
}) {
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
  const [isChatAtBottom, setIsChatAtBottom] = useState(true);
  const [activePanel, setActivePanel] = useState<WorkspacePanelId>("notepad");
  const [preferredDesktopSplit, setPreferredDesktopSplit] = useState(DEFAULT_DESKTOP_SPLIT);
  const [effectiveDesktopSplit, setEffectiveDesktopSplit] = useState(DEFAULT_DESKTOP_SPLIT);
  const [isResizingWorkspace, setIsResizingWorkspace] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [desktopWorkspace, setDesktopWorkspace] = useState(INITIAL_INTAKE_WORKSPACE);
  const [documentMetadata, setDocumentMetadata] = useState<WorkingDocumentMetadata | null>(null);
  const projectEpochRef = useRef(0);
  const assistantRequestRef = useRef<{ requestId: string; assistantId: string; epoch: number; previewAllowed: boolean } | null>(null);
  const [dialogActionsPreview, setDialogActionsPreview] = useState<{ requestId: string; assistantId: string; actions: DialogAction[] } | null>(null);
  const [documentStyle, setDocumentStyle] = useState<WorkingDocumentStyle>("a");
  const [f3ControlsTarget, setF3ControlsTarget] = useState<HTMLDivElement | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisState>(EMPTY_ANALYSIS);
  const [storedF2Build, setF2Build] = useState<F2BuildState | null>(null);
  const [currentRozbor, setCurrentRozbor] = useState<CurrentRozborState>(() => createCurrentRozborState());
  const [rozborGenerationStatus, setRozborGenerationStatus] = useState<"idle" | "loading" | "error">("idle");
  const [rozborGenerationError, setRozborGenerationError] = useState<string | null>(null);
  const latestCurrentRozborRef = useRef(currentRozbor);
  latestCurrentRozborRef.current = currentRozbor;
  const [f2Preview, setF2Preview] = useState<F2PreviewState>(null);
  const [f2BuildStatus, setF2BuildStatus] = useState<"idle" | "loading" | "error">("idle");
  const [f2BuildError, setF2BuildError] = useState<string | null>(null);
  const [f2PreviewStatus, setF2PreviewStatus] = useState<"idle" | "loading" | "error">("idle");
  const [f2PreviewError, setF2PreviewError] = useState<string | null>(null);
  const [acceptedF2Source, setAcceptedF2Source] = useState<F2ToF3Snapshot | null>(null);
  const [f3State, setF3State] = useState<F3State | null>(null);
  const acceptedF2SourceRef = useRef(acceptedF2Source);
  acceptedF2SourceRef.current = acceptedF2Source;
  const f3StateRef = useRef(f3State);
  f3StateRef.current = f3State;
  const f3GenerationEpochRef = useRef<number | null>(null);
  const [f3Status, setF3Status] = useState<"idle" | "loading" | "error">("idle");
  const [f3Error, setF3Error] = useState<string | null>(null);
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
  const [modelUsageSession, setModelUsageSession] = useState(createModelUsageSession);
  const usageShadowComparisonRef = useRef<UsageShadowComparison | null>(null);
  const sessionRef = useRef({ id: createMessageId(), startedAt: new Date().toISOString() });
  const telemetryClockRef = useRef(new Map<string, { actionStartedAt: number }>());
  const [isDictating, setIsDictating] = useState(false);
  const [isDictationSupported, setIsDictationSupported] = useState(false);
  const [dictationNotice, setDictationNotice] = useState<string | null>(null);
  const design = useDesignPreferences();
  const { entries: notepad, setEntries: setNotepad, hydrated: isNotepadHydrated, invalidate: invalidateNotebook } = usePersistentNotepad({ email, isDeveloper });
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatContentRef = useRef<HTMLDivElement>(null);
  const chatAtBottomRef = useRef(true);
  const chatCardRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const statsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsDrawerRef = useRef<HTMLElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechSegmentsRef = useRef<SpeechTranscriptSegment[]>([]);
  const dictationSessionRef = useRef(0);
  const dictationShouldContinueRef = useRef(false);
  const dictationPrefixRef = useRef("");
  const sourceF2Need = useMemo(() => getF1ToF2NeedContract(notepad, activeNeedId), [notepad, activeNeedId]);
  const sourceNeedKey = sourceF2Need ? activeNeedRoutingKey(sourceF2Need) : null;
  const latestSourceNeedKeyRef = useRef(sourceNeedKey);
  latestSourceNeedKeyRef.current = sourceNeedKey;
  const [needRoute, setNeedRoute] = useState<{ key: string; decision: NeedRoutingDecision } | null>(null);
  const [needRouteError, setNeedRouteError] = useState<string | null>(null);
  const [needClarification, setNeedClarification] = useState("");
  const needRouterRef = useRef<ReturnType<typeof createNeedRouter> | null>(null);
  if (!needRouterRef.current) {
    const routerProjectEpoch = projectEpochRef.current;
    needRouterRef.current = createNeedRouter(async (routingInput) => {
      if (routerProjectEpoch !== projectEpochRef.current) throw new Error("Projekt byl ukončen.");
      const response = await fetch("/api/need-route", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(routingInput) });
      const payload = await response.json().catch(() => null) as ({ decision?: unknown; error?: string } & ModelUsageRecordsResponse) | null;
      collectModelUsageRecords(payload, routerProjectEpoch);
      if (!response.ok || !payload?.decision) throw new Error(payload?.error || "Cíl potřeby se nepodařilo určit.");
      return payload.decision;
    });
  }
  const canonicalF2Need = useMemo(() => sourceF2Need && needRoute?.key === sourceNeedKey
    ? bindNeedRoutingDecision(sourceF2Need, needRoute.decision) : null, [sourceF2Need, sourceNeedKey, needRoute]);
  // Hide a previous Build immediately, before synchronization effects run.
  const f2Build = canonicalF2Need && storedF2Build && canonicalF1NeedFingerprint(storedF2Build.canonicalNeed) === canonicalF1NeedFingerprint(canonicalF2Need)
    && storedF2Build.activePath === canonicalF2Need.initialF2Path ? storedF2Build : null;
  const activeF2Path = canonicalF2Need?.initialF2Path ?? "POCHOPIT"; // Placeholder is never an active Build.
  const activeRozbor = currentRozbor[activeF2Path];
  const currentAnalysisContext = useMemo(() => analysisSnapshotContext(notepad, analysis, canonicalF2Need?.needId), [notepad, analysis, canonicalF2Need?.needId]);
  const latestRozborSourceRef = useRef({ need: canonicalF2Need, hypotheses: analysis.hypotheses, activePath: activeF2Path, analysisContext: currentAnalysisContext });
  latestRozborSourceRef.current = { need: canonicalF2Need, hypotheses: analysis.hypotheses, activePath: activeF2Path, analysisContext: currentAnalysisContext };
  const currentRozborNeedFingerprintRef = useRef<string | null>(null);
  const isProcessingWorkspace = phase !== "intake";
  const isF2DesktopLayout = isDesktop && isProcessingWorkspace;
  const documentPanel = isDesktop ? (desktopWorkspace.view === "notepad" ? "notepad" : desktopWorkspace.document) : activePanel;
  const isChatReadOnly = phase === "output" || (isDesktop && isProcessingWorkspace && desktopWorkspace.document === "output");
  const currentRozborReconciliation = useMemo(() => canonicalF2Need
    ? reconcileRozborComponents(deriveRequiredCurrentRozborComponents(activeF2Path, canonicalF2Need, analysis.hypotheses, activeRozbor.config), activeRozbor.components)
    : null, [activeF2Path, activeRozbor, analysis.hypotheses, canonicalF2Need]);
  // F3 observes the last accepted content/configuration, never pending Build selections.
  const currentF2ToF3SourceFingerprint = useMemo(() => canonicalF2Need && acceptedF2Source
    ? currentRozborSourceFingerprint(canonicalF2Need, analysis.hypotheses, activeF2Path, acceptedF2Source.currentRozbor, currentAnalysisContext)
    : null, [activeF2Path, analysis.hypotheses, canonicalF2Need, acceptedF2Source, currentAnalysisContext]);
  const latestF2ToF3FingerprintRef = useRef(currentF2ToF3SourceFingerprint);
  latestF2ToF3FingerprintRef.current = currentF2ToF3SourceFingerprint;
  const currentF2ToF3Source = useMemo(() => {
    if (!canonicalF2Need || !acceptedF2Source || acceptedF2Source.sourceFingerprint !== currentF2ToF3SourceFingerprint)
      return { snapshot: null, error: "Rozbor čeká na úspěšnou analýzu aktuálního Zápisníku a potřeby." };
    return { snapshot: acceptedF2Source, error: null };
  }, [canonicalF2Need, acceptedF2Source, currentF2ToF3SourceFingerprint]);
  const navigationAvailability = workspaceAvailability(isProcessingWorkspace, Boolean(sourceF2Need || f2Build), Boolean(currentF2ToF3Source.snapshot || f3State), Boolean(acceptedF2Source || f3State));

  const hasActiveRozborOperation = Boolean(currentRozborReconciliation && (currentRozborReconciliation.keep.length + currentRozborReconciliation.missing.length + currentRozborReconciliation.stale.length > 0));
  const isCurrentRozborUpdatePending = Boolean(currentRozborReconciliation && !currentRozborReconciliation.isRozborCurrent);

  function analysisSnapshotContext(notepadState: NotepadState, value: AnalysisState, needId?: string): F2AnalysisContext {
    return { mainUncertainty: value.mainUncertainty, summary: value.chatUpdate.summary,
      needAnalysis: value.needs.find((item) => item.needId === needId) ?? null,
      notebookContext: compactNotepad(notepadState).map(({ category, text }) => ({ category, text })) };
  }

  function collectModelUsageRecords(response: unknown, projectEpoch: number) {
    if (projectEpoch !== projectEpochRef.current) return;
    const records = readModelUsageRecords(response);
    if (!records.length) return;
    setModelUsageSession((current) => projectEpoch === projectEpochRef.current
      ? appendModelUsageSessionRecords(current, records) : current);
  }

  async function resolveActiveNeed(need: NonNullable<typeof sourceF2Need>) {
    const projectEpoch = projectEpochRef.current;
    const key = activeNeedRoutingKey(need);
    const decision = await needRouterRef.current!(need);
    if (projectEpoch !== projectEpochRef.current) throw new Error("Projekt byl ukončen.");
    if (latestSourceNeedKeyRef.current !== key) throw new Error("Pedagogická potřeba se mezitím změnila.");
    setNeedRoute({ key, decision });
    setNeedRouteError(null);
    return bindNeedRoutingDecision(need, decision);
  }

  useEffect(() => {
    if (phase === "intake" || !sourceF2Need) return;
    let cancelled = false;
    const projectEpoch = projectEpochRef.current;
    setNeedRouteError(null);
    setNeedClarification("");
    void needRouterRef.current!(sourceF2Need).then((decision) => {
      if (!cancelled && projectEpoch === projectEpochRef.current && latestSourceNeedKeyRef.current === sourceNeedKey) setNeedRoute({ key: sourceNeedKey!, decision });
    }).catch((cause) => {
      if (!cancelled && projectEpoch === projectEpochRef.current) setNeedRouteError(cause instanceof Error ? cause.message : "Cíl potřeby se nepodařilo určit.");
    });
    return () => { cancelled = true; };
    // Only authoritative active need changes request routing; never Build edits or developer mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceNeedKey, phase === "intake"]);

  useEffect(() => {
    if (phase === "intake") return;
    if (!canonicalF2Need) { setF2Build(null); return; }
    setF2Build((current) => synchronizeF2BuildWithCanonicalNeed(
      current,
      canonicalF2Need,
      analysis.mainUncertainty ? [analysis.mainUncertainty] : [],
      analysis.hypotheses,
    ));
  }, [analysis.hypotheses, analysis.mainUncertainty, canonicalF2Need, phase]);
  useEffect(() => {
    const needFingerprint = canonicalF2Need ? canonicalF1NeedFingerprint(canonicalF2Need) : null;
    if (currentRozborNeedFingerprintRef.current !== needFingerprint) {
      currentRozborNeedFingerprintRef.current = needFingerprint;
      setCurrentRozbor(createCurrentRozborState());
    }
  }, [canonicalF2Need]);
  useEffect(() => {
    if (currentF2ToF3Source.snapshot) setF3State((current) => current ?? createF3State(currentF2ToF3Source.snapshot));
  }, [currentF2ToF3Source.snapshot]);
  useEffect(() => {
    setF3State((current) => current ? markF3SourceStale(current, currentF2ToF3SourceFingerprint ?? "unresolved-active-need") : current);
  }, [currentF2ToF3SourceFingerprint]);
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
  const quickResponseSubmittingRef = useRef(false);

  useEffect(() => () => {
    assistantRequestRef.current = null;
    projectEpochRef.current += 1;
  }, []);

  useEffect(() => {
    if (phase !== "intake" || desktopWorkspace.tool !== "chat") {
      setDialogActionsPreview(null);
      if (assistantRequestRef.current) assistantRequestRef.current.previewAllowed = false;
    }
  }, [phase, desktopWorkspace.tool]);

  function clearDialogActionsPreview(requestId: string) {
    setDialogActionsPreview((current) => current?.requestId === requestId ? null : current);
  }

  useEffect(() => {
    setPreferredDesktopSplit(readDesktopSplitPreference(window.localStorage.getItem(DESKTOP_SPLIT_STORAGE_KEY)));
    const media = window.matchMedia(DESKTOP_WORKSPACE_QUERY);
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const card = chatCardRef.current;
    if (!card) return;
    const updateEffectiveSplit = () => {
      setEffectiveDesktopSplit(clampDesktopSplit(preferredDesktopSplit, card.clientWidth));
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
    const card = chatCardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const preferred = ((clientX - rect.left - card.clientLeft) / card.clientWidth) * 100;
    const effective = clampDesktopSplit(preferred, card.clientWidth);
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
      const width = chatCardRef.current?.clientWidth ?? 0;
      savePreferredDesktopSplit(clampDesktopSplit(effectiveDesktopSplit + direction * SPLIT_KEYBOARD_STEP, width));
    }
  }
  const f1ProcessingSequenceRef = useRef<{ assistantId: string; complete: boolean } | null>(null);
  const f1MainPreparingRef = useRef<string | null>(null);

  const legacyDiagnostics = useMemo(
    () => messages.flatMap((message) => [message.diagnostics, message.controllerDiagnostics, message.extractionDiagnostics]),
    [messages],
  );
  useEffect(() => {
    usageShadowComparisonRef.current = compareUsageShadow(legacyDiagnostics, modelUsageSession);
  }, [legacyDiagnostics, modelUsageSession]);
  const canonicalUsageSummary = useMemo(() => {
    const { records, summary } = modelUsageSession;
    const hasReported = (field: "cached_input_tokens" | "cache_write_tokens" | "reasoning_tokens") =>
      records.some((record) => record.usage[field] !== null);
    const fileSearchCalls = records.reduce((total, record) => total + record.file_search_calls, 0);
    return {
      inputTokens: summary.input_tokens,
      cachedInputTokens: hasReported("cached_input_tokens") ? summary.cached_input_tokens : undefined,
      cacheWriteTokens: hasReported("cache_write_tokens") ? summary.cache_write_tokens : undefined,
      outputTokens: summary.output_tokens,
      reasoningTokens: hasReported("reasoning_tokens") ? summary.reasoning_tokens : undefined,
      totalTokens: summary.normalized_total_tokens,
      fileSearchCalls: fileSearchCalls > 0 ? fileSearchCalls : undefined,
      estimatedCostUsd: summary.complete_estimated_cost_usd,
      knownCostSubtotalUsd: summary.known_cost_subtotal_usd,
      unpricedCallCount: summary.unpriced_call_count,
      responseCount: summary.call_count,
    };
  }, [modelUsageSession]);
  const hasUnreadNotepadChange = useMemo(
    () => Object.values(notepad).some((items) => items.some((entry) => entry.visibility === "unseen")),
    [notepad],
  );
  const hasUnreadAnalysisChange = unseenAnalysisKeys.size > 0;
  const latestTelemetry = sessionTelemetry.at(-1);
  const costTooltip = canonicalUsageSummary.estimatedCostUsd === null
    ? canonicalUsageSummary.knownCostSubtotalUsd > 0 ? INCOMPLETE_COST_TOOLTIP : UNKNOWN_COST_TOOLTIP
    : COST_TOOLTIP;
  const activeDialogMessageId = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant" && message.dialogActions?.length)?.id,
    [messages],
  );
  const compactAnalysisNotebook = useMemo(() => compactNotepad(notepad), [notepad]);
  const compactAnalysisNotebookKey = useMemo(() => JSON.stringify(compactAnalysisNotebook), [compactAnalysisNotebook]);

  function updateChatScrollPosition() {
    const list = chatScrollRef.current;
    // Hidden tools must not overwrite the last visible scroll position.
    if (!list?.clientHeight) return;
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight <= 48;
    chatAtBottomRef.current = atBottom;
    setIsChatAtBottom(atBottom);
  }

  function scrollChatToBottom() {
    const list = chatScrollRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  useEffect(() => {
    const list = chatScrollRef.current;
    if (!list?.clientHeight) return;
    if (chatAtBottomRef.current) list.scrollTo({ top: list.scrollHeight });
    updateChatScrollPosition();
  }, [messages, isLoading]);

  useEffect(() => {
    const list = chatScrollRef.current;
    const content = chatContentRef.current;
    if (!list || !content) return;
    const observer = new ResizeObserver(() => {
      if (!list.clientHeight) return;
      if (chatAtBottomRef.current) list.scrollTo({ top: list.scrollHeight });
      updateChatScrollPosition();
    });
    observer.observe(list);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isDiagnosticsDrawerOpen) return;
    (settingsDrawerRef.current?.querySelector("select") as HTMLSelectElement | null)?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (!settingsDrawerRef.current?.contains(event.target as Node) && !settingsButtonRef.current?.contains(event.target as Node)) setIsDiagnosticsDrawerOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDiagnosticsDrawerOpen(false);
        settingsButtonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [isDiagnosticsDrawerOpen]);

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
  }, [input, isDictating, isChatReadOnly]);

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
    setIsDictating(true);
    startRecognitionCycle(session);
  }

  function handleInputChange(value: string) {
    if (isDictating) cancelDictation();
    setDictationNotice(null);
    setComposerInput(value);
  }

  function selectDevTestScenario(scenario: DevTestScenario) {
    if (input.trim() && !window.confirm("Composer už obsahuje text. Chcete ho nahradit testovacím scénářem?")) return;
    if (isDictating) cancelDictation();
    setDictationNotice(null);
    setComposerInput(scenario.text);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function selectTool(tool: DesktopTool) {
    if (!navigationAvailability[tool]) return;
    if (tool === "build") { returnToF2(); return; }
    if (tool === "output") {
      if (isDictating) cancelDictation();
      enterF3();
      return;
    }
    setDesktopWorkspace((current) => selectDesktopTool(current, tool, navigationAvailability));
  }

  function selectRightView(view: DesktopView) {
    setDesktopWorkspace((current) => selectDesktopView(current, view, navigationAvailability));
  }

  function returnToF2() {
    if (!navigationAvailability.build) return;
    setPhase("development"); setActivePanel("analysis");
    setDesktopWorkspace((current) => selectDesktopTool(current, "build", navigationAvailability));
    setF3Error(null);
  }

  function togglePanel(panel: WorkspacePanelId) {
    setActivePanel((current) => current === panel ? null : panel);
  }

  function f2Situation(): F2NotebookContextItem[] {
    return Object.entries(notepad).flatMap(([category, items]) => items.map((item) => ({ category: category as F2NotebookContextItem["category"], text: item.text })));
  }

  async function executeF2Build() {
    if (!f2Build) return;
    const projectEpoch = projectEpochRef.current;
    setF2BuildStatus("loading"); setF2BuildError(null);
    try {
      const buildRequest = createF2BuildRequest(f2Build, f2Situation(), selectedModel);
      const response = await fetch("/api/f2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "build", model: selectedModel, build: buildRequest }) });
      const payload = await response.json().catch(() => null) as ({ result?: unknown; error?: string } & ModelUsageRecordsResponse) | null;
      collectModelUsageRecords(payload, projectEpoch);
      if (!response.ok || !payload?.result) throw new Error(payload?.error || "Build se nepodařilo rozpracovat.");
      if (projectEpoch !== projectEpochRef.current) return;
      const result = parseF2BuildResult(payload.result, buildRequest.activePath);
      setF2Build((current) => current ? applyF2BuildResult(current, result, buildRequest.activePath, buildRequest.buildRevision) : current);
      setF2BuildStatus("idle");
    } catch (cause) { if (projectEpoch !== projectEpochRef.current) return; setF2BuildError(cause instanceof Error ? cause.message : "Build se nepodařilo rozpracovat."); setF2BuildStatus("error"); }
  }

  // Both asynchronous generation and synchronous removal commit through this path.
  function commitBuildDocument(updated: CurrentRozborState, need: NonNullable<typeof canonicalF2Need>, hypotheses: AnalysisState["hypotheses"], path: F2ToF3Snapshot["activePath"], context: F2AnalysisContext) {
    const result = acceptBuildDocumentUpdate(acceptedF2SourceRef.current, f3StateRef.current, need, hypotheses, path, updated[path], context);
    setCurrentRozbor(updated);
    acceptedF2SourceRef.current = result.snapshot;
    setAcceptedF2Source(result.snapshot);
    f3StateRef.current = result.f3;
    setF3State(result.f3);
  }

  async function generateCurrentRozbor() {
    if (!f2Build || !canonicalF2Need || rozborGenerationStatus === "loading") return;
    const projectEpoch = projectEpochRef.current;
    const path = f2Build.activePath;
    const pathState = currentRozbor[path];
    const required = deriveRequiredCurrentRozborComponents(path, canonicalF2Need, analysis.hypotheses, pathState.config);
    const reconciliation = reconcileRozborComponents(required, pathState.components);
    if (reconciliation.isRozborCurrent) return;
    const request = createCurrentRozborGenerationRequest(path, canonicalF2Need, analysis.hypotheses, pathState.config, pathState.components);
    const updateSignature = JSON.stringify([path, required.map(({ id, kind, hypothesisId, fingerprint }) => [id, kind, hypothesisId, fingerprint]), currentAnalysisContext]);
    if (!request) {
      setRozborGenerationError(null);
      const updated = applyCurrentRozborComponentUpdate(currentRozbor, path, required, []);
      commitBuildDocument(updated, canonicalF2Need, analysis.hypotheses, path, currentAnalysisContext);
      setRozborGenerationStatus("idle");
      return;
    }
    setRozborGenerationStatus("loading"); setRozborGenerationError(null);
    try {
      const response = await fetch("/api/f2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "generate-rozbor-components", model: selectedModel, request }) });
      const payload = await response.json().catch(() => null) as ({ components?: unknown; error?: string; diagnostic?: string } & ModelUsageRecordsResponse) | null;
      collectModelUsageRecords(payload, projectEpoch);
      if (!response.ok || !payload?.components) throw new Error(isDeveloper && payload?.diagnostic ? `${payload.error ?? "Rozbor se nepodařilo vytvořit."} ${payload.diagnostic}` : payload?.error || "Rozbor se nepodařilo vytvořit.");
      const generated = parseGeneratedRozborComponents({ components: payload.components }, request.components);
      if (projectEpoch !== projectEpochRef.current) return;
      const latest = latestRozborSourceRef.current;
      if (!latest.need) throw new Error("Výsledek byl zahozen, protože se mezitím změnil výchozí Rozbor nebo Build.");
      const latestPathState = latestCurrentRozborRef.current[latest.activePath];
      const currentSpecs = deriveRequiredCurrentRozborComponents(latest.activePath, latest.need, latest.hypotheses, latestPathState.config);
      const currentSignature = JSON.stringify([latest.activePath, currentSpecs.map(({ id, kind, hypothesisId, fingerprint }) => [id, kind, hypothesisId, fingerprint]), latest.analysisContext]);
      if (currentSignature !== updateSignature || JSON.stringify(latestPathState.config) !== JSON.stringify(request.config)) throw new Error("Výsledek byl zahozen, protože se mezitím změnil výchozí Rozbor nebo Build.");
      const updated = applyCurrentRozborComponentUpdate(latestCurrentRozborRef.current, path, required, generated);
      commitBuildDocument(updated, latest.need, latest.hypotheses, path, latest.analysisContext);
      setRozborGenerationStatus("idle");
    } catch (cause) { if (projectEpoch !== projectEpochRef.current) return; setRozborGenerationError(cause instanceof Error ? cause.message : "Rozbor se nepodařilo vytvořit."); setRozborGenerationStatus("error"); }
  }

  async function renderF2Preview() {
    if (!f2Build) return;
    const projectEpoch = projectEpochRef.current;
    setF2PreviewStatus("loading"); setF2PreviewError(null);
    try {
      const snapshot = createF2PreviewSnapshot(f2Build);
      const response = await fetch("/api/f2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "preview", model: selectedModel, snapshot }) });
      const payload = await response.json().catch(() => null) as ({ result?: unknown; error?: string } & ModelUsageRecordsResponse) | null;
      collectModelUsageRecords(payload, projectEpoch);
      if (!response.ok || !payload?.result) throw new Error(payload?.error || "Preview se nepodařilo vytvořit.");
      if (projectEpoch !== projectEpochRef.current) return;
      setF2Preview(acceptRenderedPreview(snapshot, parseF2RenderedPreview(payload.result))); setF2PreviewStatus("idle"); setActivePanel("output");
    } catch (cause) { if (projectEpoch !== projectEpochRef.current) return; setF2PreviewError(cause instanceof Error ? cause.message : "Preview se nepodařilo vytvořit."); setF2PreviewStatus("error"); }
  }

  function enterF3() {
    if (!currentF2ToF3Source.snapshot && !f3State) return;
    if (currentF2ToF3Source.snapshot) setF3State((current) => current ?? createF3State(currentF2ToF3Source.snapshot));
    setDesktopWorkspace((current) => selectDesktopTool(current, "output", navigationAvailability));
    setF3Error(null); setPhase("output"); setActivePanel("output");
  }

  function resetDocumentPresentation() {
    if (!f3State || f3Status === "loading" || rozborGenerationStatus === "loading" || f3GenerationEpochRef.current === projectEpochRef.current) return;
    if (documentStyle === "a" && isDefaultF3Presentation(f3State)) return;
    setF3State((current) => current ? resetF3Presentation(current) : current);
    setDocumentStyle("a");
  }

  async function renderF3() {
    const projectEpoch = projectEpochRef.current;
    if (!f3State || f3State.sourceSnapshot.sourceFingerprint !== latestF2ToF3FingerprintRef.current || f3GenerationEpochRef.current === projectEpoch || !f3GenerationEligibility(f3State, f3Status === "loading" || rozborGenerationStatus === "loading").enabled) return;
    f3GenerationEpochRef.current = projectEpoch;
    setF3Status("loading"); setF3Error(null);
    try {
      const renderRequest = createF3RenderRequest(f3State, selectedModel);
      const response = await fetch("/api/f3", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(renderRequest) });
      const payload = await response.json().catch(() => null) as ({ result?: unknown; error?: string; diagnostic?: string } & ModelUsageRecordsResponse) | null;
      collectModelUsageRecords(payload, projectEpoch);
      if (!response.ok || !payload?.result) throw new Error(isDeveloper && payload?.diagnostic ? `${payload.error ?? "Finální výstup se nepodařilo vytvořit."} ${payload.diagnostic}` : payload?.error || "Finální výstup se nepodařilo vytvořit.");
      if (projectEpoch !== projectEpochRef.current) return;
      const result = parseF3RenderResult(payload.result);
      if (renderRequest.sourceSnapshot.sourceFingerprint !== latestF2ToF3FingerprintRef.current) throw new Error("Výsledek byl zahozen, protože se mezitím změnil zdrojový Rozbor.");
      setF3State((current) => current ? acceptF3Render(current, result, renderRequest) : current); setF3Status("idle");
    } catch (cause) { if (projectEpoch !== projectEpochRef.current) return; setF3Error(cause instanceof Error ? cause.message : "Finální výstup se nepodařilo vytvořit."); setF3Status("error"); }
    finally { if (f3GenerationEpochRef.current === projectEpoch) f3GenerationEpochRef.current = null; }
  }

  async function refreshStructuredAnalysis(notepadState: NotepadState, focusInstruction = "", turnId?: string, requestId?: string, transitionFrom?: "F1" | "F2" | "F3") {
    const projectEpoch = projectEpochRef.current;
    setAnalysisStatus("loading");
    setAnalysisError(null);
    try {
      const sourceNeed = getF1ToF2NeedContract(notepadState, activeNeedId);
      const resolvedNeed = sourceNeed ? await resolveActiveNeed(sourceNeed) : null;
      if (projectEpoch !== projectEpochRef.current) return null;
      if (sourceNeed && !resolvedNeed) { setAnalysisStatus("idle"); return null; }
      // Derived request mapping only; canonical F1 text and extraction remain unchanged.
      const notebook = compactNotepad(notepadState).map((item) => item.id === resolvedNeed?.needId && item.category === "goals"
        ? { ...item, needMapping: { f2Path: resolvedNeed.initialF2Path, f3Target: resolvedNeed.f3Target } } : item);
      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notebook,
          previousAnalysis: analysis.hypotheses.length ? analysis : null,
          selectedHypothesisId,
          activeNeedId,
          focusInstruction,
          skippedQuestions: skippedAnalysisQuestions,
          canonicalNeed: resolvedNeed,
          ...(turnId ? { turnId } : {}),
        }),
      });
      const responseResult = await response.json().catch(() => null) as ({ analysis?: AnalysisState; diagnostics?: Diagnostics; telemetry?: Partial<SessionTelemetry>; error?: string } & ModelUsageRecordsResponse) | null;
      collectModelUsageRecords(responseResult, projectEpoch);
      if (!response.ok || !responseResult?.analysis) throw new Error(responseResult?.error || "Rozbor se nepodařilo aktualizovat.");
      if (projectEpoch !== projectEpochRef.current) return null;
      if (sourceNeed && latestSourceNeedKeyRef.current !== activeNeedRoutingKey(sourceNeed)) throw new Error("Pedagogická potřeba se mezitím změnila.");
      const result = responseResult as { analysis: AnalysisState; diagnostics?: Diagnostics; telemetry?: Partial<SessionTelemetry> } & ModelUsageRecordsResponse;
      if (turnId && requestId && result.telemetry) {
        setSessionTelemetry((current) => current.map((item) => item.request_id === requestId
          ? mergeSessionTelemetry(item, { ...result.telemetry, phase: "F2", ...(transitionFrom ? { transition_from: transitionFrom } : {}) } as Partial<SessionTelemetry>) : item));
      }
      if (resolvedNeed) {
        const context = analysisSnapshotContext(notepadState, result.analysis, resolvedNeed.needId);
        const baseline = createCurrentRozborState()[resolvedNeed.initialF2Path];
        createF2ToF3Snapshot(resolvedNeed, result.analysis.hypotheses, resolvedNeed.initialF2Path, baseline, 0, context);
        const previous = acceptedF2SourceRef.current;
        const unchanged = previous && previous.sourceFingerprint === currentRozborSourceFingerprint(resolvedNeed, result.analysis.hypotheses, resolvedNeed.initialF2Path, previous.currentRozbor, context);
        const accepted = unchanged ? previous : advanceAcceptedF2Source(previous, resolvedNeed, result.analysis.hypotheses, resolvedNeed.initialF2Path, baseline, context);
        acceptedF2SourceRef.current = accepted;
        setAcceptedF2Source(accepted);
        const acceptedAt = new Date().toISOString();
        setDocumentMetadata((current) => acceptWorkingDocumentMetadata(current, acceptedAt));
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
          if (projectEpoch !== projectEpochRef.current) return;
          const startedAt = telemetryClockRef.current.get(requestId)?.actionStartedAt;
          const userVisible = startedAt === undefined ? null : Math.round(performance.now() - startedAt);
          setSessionTelemetry((current) => current.map((item) => item.request_id === requestId
            ? mergeSessionTelemetry(item, { latency_ms: { analysis_user_visible_ms: userVisible } }) : item));
        }));
      }
      return result;
    } catch (cause) {
      if (projectEpoch !== projectEpochRef.current) return null;
      setAnalysisError(cause instanceof Error ? cause.message : "Rozbor se nepodařilo aktualizovat.");
      setAnalysisStatus("error");
      throw cause;
    }
  }

  async function submitNeedClarification(event: FormEvent) {
    event.preventDefault();
    if (!sourceF2Need || !needClarification.trim() || isLoading || analysisStatus === "loading") return;
    const text = `${sourceF2Need.needText}\nPožadovaný výsledek: ${needClarification.trim()}`;
    if (text.length > 2000) return;
    const next = { ...notepad, goals: notepad.goals.map((item) => item.id === sourceF2Need.needId
      ? { ...item, text, origin: "manual" as const, source: undefined, needMapping: mapPedagogicalNeed(text) } : item) };
    setNotepad(next);
    try { await refreshStructuredAnalysis(next); } catch { /* Existing analysis error UI owns retry. */ }
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
    const requestScope = assistantRequestRef.current;
    const isCurrentRequest = () => requestScope?.requestId === requestId && requestScope.assistantId === assistantId
      && assistantRequestRef.current === requestScope && projectEpochRef.current === requestScope.epoch;
    if (!requestScope || !isCurrentRequest()) return;
    const textTransition = resolveTextDialogEvent(rawText, compactNotepad(notepadForChat), phase);
    if (phase === "intake" && (dialogEvent === "continue_to_solution" || textTransition === "continue_to_solution")) {
      const navigation = resolveDialogEvent("continue_to_solution", compactNotepad(notepadForChat), phase);
      if (navigation?.phase !== "development") {
        clearF1ProcessingStatus();
        clearDialogActionsPreview(requestId);
        setMessages((current) => current.map((message) => message.id === assistantId ? {
          ...message, content: "", dialogActions: navigation?.dialog_actions ?? [], phaseLabel: "[FÁZE 1]",
        } : message));
        return;
      }
      setPhase("development");
      const result = await refreshStructuredAnalysis(notepadForChat, "", turnId, requestId, "F1");
      if (!isCurrentRequest()) return;
      if (!result) { setMessages((current) => current.filter((message) => message.id !== assistantId)); return; }
      if (usesDesktopWorkspaceLayout()) {
        setActivePanel("analysis");
        setDesktopWorkspace(INITIAL_PROCESSING_WORKSPACE);
      }
      setMessages((current) => current.map((message) => message.id === assistantId ? withCompletedLifecycleRecord({
        ...message, content: "", analysisEntryHypotheses: entryHypotheses(result.analysis), analysisNextPrompt: result.analysis.chatUpdate.nextPrompt, phaseLabel: "[FÁZE 2]",
        ...(result.diagnostics ? { diagnostics: result.diagnostics } : {}),
      }, { operation: "analysis-entry", state: "completed", label: "Vytvořeny pracovní hypotézy" }) : message));
      return;
    }
    if (phase === "development" && !dialogEvent) {
      const result = await refreshStructuredAnalysis(notepadForChat, rawText, turnId, requestId);
      if (!isCurrentRequest()) return;
      if (!result) { setMessages((current) => current.filter((message) => message.id !== assistantId)); return; }
      setMessages((current) => current.map((message) => message.id === assistantId ? {
        ...withCompletedLifecycleRecord(message, {
          operation: result.analysis.chatUpdate.kind === "entry" ? "analysis-entry" : "analysis-update",
          state: "completed",
          label: result.analysis.chatUpdate.kind === "entry" ? "Vytvořeny pracovní hypotézy" : "Aktualizován Rozbor",
        }),
        ...(result.analysis.chatUpdate.kind === "entry"
          ? { content: "", analysisEntryHypotheses: entryHypotheses(result.analysis) }
          : { content: formatAnalysisChat(result.analysis) }),
        analysisNextPrompt: result.analysis.chatUpdate.nextPrompt,
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
        requestId,
        turnId,
      }),
    });

    if (!isCurrentRequest()) { await request.body?.cancel().catch(() => {}); return; }
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
      if (!line.trim() || !isCurrentRequest()) return;
      const event = JSON.parse(line);
      collectModelUsageRecords(event, requestScope.epoch);
      if (event.type === "dialog_actions_preview" && phase === "intake" && requestScope?.previewAllowed
        && !receivedDone && Array.isArray(event.dialogActions) && event.dialogActions.length > 0) {
        setDialogActionsPreview({ requestId, assistantId, actions: event.dialogActions as DialogAction[] });
      }
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
        clearDialogActionsPreview(requestId);
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
      if (!isCurrentRequest()) { await reader.cancel().catch(() => {}); return; }
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
      if (!isCurrentRequest()) return;
      if (!result) { setMessages((current) => current.filter((message) => message.id !== assistantId)); return; }
      if (usesDesktopWorkspaceLayout()) {
        setActivePanel("analysis");
        setDesktopWorkspace(INITIAL_PROCESSING_WORKSPACE);
      }
      setMessages((current) => current.map((message) => message.id === assistantId ? withCompletedLifecycleRecord({
        ...message, content: "", analysisEntryHypotheses: entryHypotheses(result.analysis), analysisNextPrompt: result.analysis.chatUpdate.nextPrompt,
        phaseLabel: "[FÁZE 2]",
        ...(result.diagnostics ? { diagnostics: result.diagnostics } : {}),
      }, { operation: "analysis-entry", state: "completed", label: "Vytvořeny pracovní hypotézy" }) : message));
    }
  }

  function handleF2OutputNavigation(rawText: string, dialogEvent?: string, silent = false) {
    if (phase !== "development") return false;
    const textEvent = dialogEvent ? null : resolveTextDialogEvent(rawText, compactNotepad(notepad), phase);
    const resolution = resolveF2OutputNavigation(textEvent, dialogEvent, Boolean(currentF2ToF3Source.snapshot));
    if (!resolution) return false;

    const turnId = `turn-${createMessageId()}`;
    const userMessage: Message = { id: createMessageId(), role: "user", content: rawText, turnId, createdAt: new Date().toISOString(), phaseLabel: "[FÁZE 2]" };
    const content = resolution === "enter_f3"
      ? "Otevírám Výstup. Pracovní analýza je připravena k tisku, uložení do PDF nebo kopírování. Další podobu Výstupu můžete vytvořit podle potřeby."
      : (currentF2ToF3Source.error ?? "Nejprve dokončete výchozí Rozbor; pak můžete otevřít pracovní analýzu ve Výstupu.");
    setMessages((current) => [...current, ...(silent ? [] : [userMessage]), { id: createMessageId(), role: "assistant", content, turnId, createdAt: new Date().toISOString(), communicationProfile }]);
    setComposerInput("");
    setError(null);
    setFailedInput(null);
    if (resolution === "enter_f3" && currentF2ToF3Source.snapshot) {
      setF3State((current) => current ?? createF3State(currentF2ToF3Source.snapshot));
      setDesktopWorkspace({ tool: "output", document: "output", view: "document" });
      setPhase("output");
      setActivePanel("output");
    } else {
      setActivePanel("analysis");
    }
    return true;
  }

  async function sendMessage(rawText: string, options?: { dialogEvent?: string; silent?: boolean; explicitNeed?: F2Path }) {
    if (isChatReadOnly) { setError("Chat u Výstupu zatím slouží jen k prohlížení historie. Pro pokračování v rozhovoru se vraťte do Rozboru."); return; }
    const text = rawText.trim();
    if (!text || isLoading || !isNotepadHydrated) return;
    chatAtBottomRef.current = true;

    if (isDictating) cancelDictation();
    if (handleF2OutputNavigation(rawText, options?.dialogEvent, options?.silent)) return;

    const turnId = `turn-${createMessageId()}`;
    const requestId = `req-${createMessageId()}`;
    const startedAt = new Date().toISOString();
    telemetryClockRef.current.set(requestId, { actionStartedAt: performance.now() });
    const userMessage: Message = { id: createMessageId(), role: "user", content: rawText, turnId, createdAt: startedAt, telemetryRefs: [requestId], phaseLabel: phase === "intake" ? "[FÁZE 1]" : phase === "development" ? "[FÁZE 2]" : "[FÁZE 3]" };
    const assistantId = createMessageId();
    const requestScope = { requestId, assistantId, epoch: projectEpochRef.current, previewAllowed: phase === "intake" };
    assistantRequestRef.current = requestScope;
    setDialogActionsPreview(null);
    const isCurrentRequest = () => assistantRequestRef.current === requestScope && projectEpochRef.current === requestScope.epoch;
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
            ...(options?.explicitNeed ? { explicitNeed: options.explicitNeed } : {}),
            turnId,
          }),
        });

        if (!extractionRequest.ok) {
          const detail = await extractionRequest.json().catch(() => null) as { error?: string } | null;
          collectModelUsageRecords(detail, requestScope.epoch);
          throw new Error(detail?.error || "Zápisník se nepodařilo aktualizovat.");
        }

        const result = await extractionRequest.json() as {
          extraction: ExtractionResult;
          diagnostics?: Diagnostics;
          telemetry?: Partial<SessionTelemetry>;
        } & ModelUsageRecordsResponse;
        collectModelUsageRecords(result, requestScope.epoch);
        if (!isCurrentRequest()) return;
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
        if (!isCurrentRequest()) return;
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
      if (!isCurrentRequest()) return;
      if (phase === "development") {
        setAnalysisFocus({ text: rawText, nonce: Date.now() });
      }
    } catch (cause) {
      if (!isCurrentRequest()) return;
      clearF1ProcessingStatus();
      setMessages((current) => current.filter((message) => message.id !== assistantId));
      setFailedInput(rawText);
      setError(cause instanceof Error ? cause.message : "Nastala technická chyba.");
    } finally {
      if (isCurrentRequest()) {
        clearDialogActionsPreview(requestId);
        assistantRequestRef.current = null;
        setSessionTelemetry((current) => current.map((item) => item.request_id === requestId
          ? mergeSessionTelemetry(item, { completed_at: new Date().toISOString(), latency_ms: { total: Math.max(0, Date.now() - new Date(item.started_at).getTime()) } }) : item));
        setIsLoading(false);
      }
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
    projectEpochRef.current += 1;
    assistantRequestRef.current = null;
    setDialogActionsPreview(null);
    clearF1ProcessingStatus();
    setDocumentMetadata(null);
    acceptedF2SourceRef.current = null;
    f3StateRef.current = null;
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
    needRouterRef.current = null;
    setNeedRoute(null); setNeedRouteError(null); setNeedClarification("");
    setF2Build(null); setF2Preview(null); setF2BuildStatus("idle"); setF2BuildError(null); setF2PreviewStatus("idle"); setF2PreviewError(null);
    setCurrentRozbor(createCurrentRozborState());
    setRozborGenerationStatus("idle"); setRozborGenerationError(null);
    setDesktopWorkspace(INITIAL_INTAKE_WORKSPACE);
    setAcceptedF2Source(null);
    setF3State(null); setF3Status("idle"); setF3Error(null);
    setSessionTelemetry([]);
    setModelUsageSession(createModelUsageSession());
    telemetryClockRef.current.clear();
    sessionRef.current = { id: createMessageId(), startedAt: new Date().toISOString() };
  }

  useLayoutEffect(() => registerInvalidation((logout) => {
    if (logout === undefined) {
      // Pause asynchronous continuations while Access identity is uncertain,
      // retaining accepted work for a successful revalidation/retry.
      if (isDictating || hasDictationDraft) {
        mergeDictationTranscript(currentDictationTranscript());
        setComposerInput([dictationPrefixRef.current.trimEnd(), dictationTranscriptRef.current.trim()].filter(Boolean).join(" "));
      }
      cancelDictation();
      const pending = assistantRequestRef.current || isLoading || analysisStatus === "loading" || f2BuildStatus === "loading"
        || f2PreviewStatus === "loading" || rozborGenerationStatus === "loading" || f3Status === "loading"
        || (phase !== "intake" && sourceF2Need && !canonicalF2Need);
      if (!pending) return; // Idle checks retain the accepted Need Router cache.
      projectEpochRef.current += 1;
      assistantRequestRef.current = null;
      needRouterRef.current = null;
      setDialogActionsPreview(null);
      clearF1ProcessingStatus();
      if (isLoading) {
        setFailedInput(messages.filter(message => message.role === "user").at(-1)?.content ?? null);
        setError("Ověření přihlášení přerušilo požadavek. Po ověření ho můžete zopakovat.");
      }
      setIsLoading(false);
      const interrupted = "Po ověření přihlášení aktualizaci zopakujte.";
      if (analysisStatus === "loading") { setAnalysisStatus("error"); setAnalysisError(interrupted); }
      if (f2BuildStatus === "loading") { setF2BuildStatus("error"); setF2BuildError(interrupted); }
      if (f2PreviewStatus === "loading") { setF2PreviewStatus("error"); setF2PreviewError(interrupted); }
      if (rozborGenerationStatus === "loading") { setRozborGenerationStatus("error"); setRozborGenerationError(interrupted); }
      if (f3Status === "loading") { setF3Status("error"); setF3Error(interrupted); }
      f3GenerationEpochRef.current = null;
      return;
    }
    invalidateNotebook(logout);
    resetCurrentProject();
    setIsDiagnosticsDrawerOpen(false);
    usageShadowComparisonRef.current = null;
  }));

  function selectDialogAction(id: string, label: string) {
    const controlledText = id === "continue_to_solution" ? "Přejít do Rozboru" : label;
    void sendMessage(controlledText, { dialogEvent: id, silent: id === "continue_to_solution" });
  }

  async function submitTeacherNeedQuickResponse(response: string, path: F2Path) {
    if (quickResponseSubmittingRef.current) return;
    quickResponseSubmittingRef.current = true;
    try {
      await sendMessage(response, { explicitNeed: path });
    } finally {
      quickResponseSubmittingRef.current = false;
    }
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
    if (isDesktop && isProcessingWorkspace) setDesktopWorkspace((current) => selectDesktopTool(current, "chat", navigationAvailability));
    const sourceMessageId = entry.source.messageId;
    requestAnimationFrame(() => document.getElementById(`message-${sourceMessageId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    }));
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
    const requestScope = { requestId, assistantId, epoch: projectEpochRef.current, previewAllowed: phase === "intake" };
    assistantRequestRef.current = requestScope;
    setDialogActionsPreview(null);
    const isCurrentRequest = () => assistantRequestRef.current === requestScope && projectEpochRef.current === requestScope.epoch;
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
      if (!isCurrentRequest()) return;
      setMessages((current) => current.filter((item) => item.id !== assistantId));
      setFailedInput(message.content);
      setError(cause instanceof Error ? cause.message : "Nastala technická chyba.");
    } finally {
      if (isCurrentRequest()) {
        clearDialogActionsPreview(requestId);
        assistantRequestRef.current = null;
        setSessionTelemetry((current) => current.map((item) => item.request_id === requestId
          ? mergeSessionTelemetry(item, { completed_at: new Date().toISOString(), latency_ms: { total: Math.max(0, Date.now() - new Date(item.started_at).getTime()) } }) : item));
        setIsLoading(false);
      }
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
        className={`chat-card${isResizingWorkspace ? " is-resizing-workspace" : ""}${isProcessingWorkspace ? " is-processing-workspace" : " is-intake-workspace"}`}
        style={{ "--desktop-chat-split": `${effectiveDesktopSplit}%` } as CSSProperties}
        aria-label="Pracovní prostor APU"
      >
        <header className="app-header">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <ApuLogo variant="horizontal" />
            </span>
            <span className="account-email" title={email}>{email}</span>
            {isDeveloper && <DeveloperHeaderControls
              onSelectScenario={selectDevTestScenario}
            />}
            {isDeveloper && <div className="conversation-diagnostics" ref={statsRef}>
              <button
                ref={statsButtonRef}
                className="stats-trigger"
                type="button"
                aria-expanded={isStatsOpen}
                aria-controls="conversation-stats-popover"
                aria-haspopup="dialog"
                onClick={() => setIsStatsOpen((open) => !open)}
                aria-label="Telemetrie a náklady konverzace"
                title="Telemetrie a náklady konverzace"
              >
                <DollarSign aria-hidden="true" />
              </button>

              {isStatsOpen && (
                <div
                  id="conversation-stats-popover"
                  className="stats-popover"
                  role="dialog"
                  aria-label="Detail spotřeby této konverzace"
                >
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
                  <strong>Tato konverzace</strong>
                  <dl>
                    <div><dt>Vstupní tokeny</dt><dd>{formatInteger(canonicalUsageSummary.inputTokens)}</dd></div>
                    {canonicalUsageSummary.cachedInputTokens !== undefined && (
                      <div><dt>z toho cachované</dt><dd>{formatInteger(canonicalUsageSummary.cachedInputTokens)}</dd></div>
                    )}
                    {canonicalUsageSummary.cacheWriteTokens !== undefined && (
                      <div><dt>zapsané do cache</dt><dd>{formatInteger(canonicalUsageSummary.cacheWriteTokens)}</dd></div>
                    )}
                    <div><dt>Výstupní tokeny</dt><dd>{formatInteger(canonicalUsageSummary.outputTokens)}</dd></div>
                    {canonicalUsageSummary.reasoningTokens !== undefined && (
                      <div><dt>Reasoning tokeny</dt><dd>{formatInteger(canonicalUsageSummary.reasoningTokens)}</dd></div>
                    )}
                    <div className="stats-total"><dt>Celkem</dt><dd>{formatInteger(canonicalUsageSummary.totalTokens)}</dd></div>
                    {canonicalUsageSummary.fileSearchCalls !== undefined && (
                      <div><dt>Vyhledání v KB</dt><dd>{formatInteger(canonicalUsageSummary.fileSearchCalls)}</dd></div>
                    )}
                    <div title={costTooltip}><dt>Odhad ceny</dt><dd>{formatCost(canonicalUsageSummary.estimatedCostUsd)}</dd></div>
                    {canonicalUsageSummary.estimatedCostUsd === null && canonicalUsageSummary.knownCostSubtotalUsd > 0 && (
                      <div><dt>Známý subtotal</dt><dd>{formatCost(canonicalUsageSummary.knownCostSubtotalUsd)}</dd></div>
                    )}
                    {canonicalUsageSummary.unpricedCallCount > 0 && (
                      <div><dt>Neoceněná volání</dt><dd>{formatInteger(canonicalUsageSummary.unpricedCallCount)}</dd></div>
                    )}
                    <div><dt>API volání</dt><dd>{formatInteger(canonicalUsageSummary.responseCount)}</dd></div>
                  </dl>
                  <p>{costTooltip}</p>
                  {latestTelemetry && <details className="stats-telemetry">
                    <summary>Telemetrie posledního tahu</summary>
                    <dl>
                      <div><dt>Fáze</dt><dd>{latestTelemetry.phase}</dd></div>
                      <div><dt>První viditelná odpověď</dt><dd>{formatTelemetryDuration(latestTelemetry.latency_ms.user_to_first_token ?? latestTelemetry.latency_ms.analysis_user_visible_ms)}</dd></div>
                      <div><dt>Celkový čas</dt><dd>{formatTelemetryDuration(latestTelemetry.latency_ms.total)}</dd></div>
                      {latestTelemetry.stages.map((stage, index) => <div key={`${stage.name}-${index}`}><dt>{stage.name} · {stage.status}</dt><dd>{formatTelemetryDuration(stage.duration_ms)}</dd></div>)}
                    </dl>
                  </details>}
                </div>
              )}
            </div>}
            {isDeveloper && <div className="header-session-export">
              <button
                className={`stats-trigger session-export-trigger${exportStatus === "downloaded" ? " is-confirmed" : ""}`}
                type="button"
                onClick={exportSessionJson}
                aria-label="Stáhnout APU Session JSON"
                title="Stáhnout APU Session JSON"
              >
                {exportStatus === "downloaded"
                  ? <Check aria-hidden="true" />
                  : <Download aria-hidden="true" />}
              </button>
              <span className="session-export-feedback" role="status" aria-live="polite">
                {exportStatus === "downloaded" ? "APU Session JSON byl stažen."
                      : exportStatus === "error" ? "Export se nepodařilo dokončit."
                        : ""}
              </span>
            </div>}
            <h1 className="sr-only">APU — Asistent pedagogické podpory</h1>
          </div>

          <nav className="project-actions" aria-label="Projekt a účet">
            <button
              ref={settingsButtonRef}
              className={isDiagnosticsDrawerOpen ? "is-active" : undefined}
              type="button"
              onClick={() => setIsDiagnosticsDrawerOpen((open) => !open)}
              aria-expanded={isDiagnosticsDrawerOpen}
              aria-controls="diagnostics-drawer"
              aria-label={isDiagnosticsDrawerOpen ? "Zavřít nastavení" : "Otevřít nastavení"}
              title="Nastavení"
            >
              <Settings aria-hidden="true" />
            </button>
            <button type="button" onClick={requestNewProject} disabled={isLoading} aria-label="Nový projekt" title="Nový projekt">
              <FilePlus2 aria-hidden="true" />
            </button>
            <button type="button" disabled aria-label="Uložit projekt – připravuje se" title="Uložení projektu připravujeme">
              <Save aria-hidden="true" />
            </button>
            <button type="button" disabled aria-label="Otevřít projekt – připravuje se" title="Otevírání projektů připravujeme">
              <FolderOpen aria-hidden="true" />
            </button>
            <button type="button" onClick={() => onLogout(messages.some(message => message.id !== WELCOME.id) || Boolean(input.trim()) || hasDictationDraft || Object.values(notepad).some(items => items.length > 0) || Boolean(acceptedF2Source || f3State) || isLoading)} aria-label="Odhlásit se" title="Odhlásit se">
              <LogOut aria-hidden="true" />
            </button>
          </nav>
          <aside
            ref={settingsDrawerRef}
            id="diagnostics-drawer"
            className={`diagnostics-drawer${isDiagnosticsDrawerOpen ? " is-open" : ""}`}
            aria-label="Nastavení APU"
            aria-hidden={!isDiagnosticsDrawerOpen}
            inert={!isDiagnosticsDrawerOpen}
          >
            <div className="diagnostics-drawer-content">
              <div className="diagnostics-drawer-body">
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
          </aside>
        </header>

        <div className="desktop-tools" data-tool={desktopWorkspace.tool}>
          <nav className="desktop-tool-tabs" aria-label="Nástroje pracovního prostoru">
            {([['chat', 'Chat'], ['build', 'Obsah'], ['output', 'Výstup']] as const).map(([tool, label]) => <button key={tool} type="button" disabled={!navigationAvailability[tool]} aria-pressed={desktopWorkspace.tool === tool} aria-controls={`desktop-tool-${tool}`} onClick={() => selectTool(tool)}>{label}</button>)}
          </nav>
          <div id="desktop-tool-chat" className="workspace-chat">
          <div className="chat-scroll-region">
          <fieldset className="chat-history" disabled={isChatReadOnly} aria-label={isChatReadOnly ? "Historie konverzace — pouze pro čtení" : "Konverzace"}>
        <div className="message-list" ref={chatScrollRef} onScroll={updateChatScrollPosition} tabIndex={0} role="region" aria-label="Zprávy konverzace" aria-live="polite" aria-busy={isLoading}>
          <div ref={chatContentRef}>
          {messages.map((message) => (
            <div className="message-turn" key={message.id}>
              <article id={`message-${message.id}`} className={`message message--${message.role}`}>
              {message.role === "assistant" ? (
                <div className="message-author">
                  <ApuLogo className="message-avatar-logo" />
                  {message.phaseLabel && (SHOW_INLINE_CHAT_DEBUG || !/^\[FÁZE\s+[123]\]$/i.test(message.phaseLabel)) && (
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
              <div className={message.role === "assistant" && (message.content || message.analysisEntryHypotheses)
                ? `assistant-response${message.analysisEntryHypotheses ? " assistant-response--f2-entry" : ""}`
                : message.role === "user" ? "user-response" : undefined}>
                <div className="message-content">
                  {message.id === WELCOME.id
                    ? <WelcomeQuestion content={message.content} />
                    : message.content
                    ? (
                        <HighlightedMessage
                          message={message}
                          notepad={notepad}
                        />
                      )
                    : message.analysisEntryHypotheses
                      ? <F2EntrySummary
                          onOpenAnalysis={() => { if (isDesktop) selectRightView("document"); else setActivePanel("analysis"); }}
                          onOpenBuild={() => selectTool("build")}
                        />
                      : message.dialogActions?.length
                      ? null
                      : f1ProcessingStatus?.assistantId === message.id
                      ? <ProcessingStatus stage={f1ProcessingStatus.stage} />
                      : <span className="typing"><i /><i /><i /></span>}
                </div>
                {message.role === "assistant" && message.analysisNextPrompt?.type === "question" && (
                  <AnalysisQuestionRow text={message.analysisNextPrompt.text} className="analysis-chat-question" />
                )}
                {message.role === "assistant" && isLoading && phase === "intake" && desktopWorkspace.tool === "chat"
                  && dialogActionsPreview?.assistantId === message.id
                  && !message.dialogActions?.length && (
                  <div className="dialog-actions-preview" role="group" aria-label="Předběžný náhled možností" aria-busy="true">
                    <small className="processing-status">Možnosti budou dostupné po dokončení odpovědi.</small>
                    {dialogActionsPreview.actions.map((action, actionIndex) => (
                      <DialogActionCard key={`${action.type}-${action.target}-${actionIndex}`} action={action} active={false}
                        onSelect={selectDialogAction} />
                    ))}
                  </div>
                )}
                {message.role === "assistant" && message.dialogActions?.map((action, actionIndex) => (
                  <DialogActionCard
                    key={`${action.type}-${action.target}-${actionIndex}`}
                    action={action}
                    active={message.id === activeDialogMessageId && !isLoading}
                    onSelect={selectDialogAction}
                    onQuickResponse={(response, path) => void submitTeacherNeedQuickResponse(response, path)}
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
              {SHOW_INLINE_CHAT_DEBUG && isDeveloper && message.role === "assistant" && message.debugText && (
                <aside className="response-diagnostics" aria-label="Technická poznámka odpovědi">
                  <div className="diagnostic-debug">{message.debugText}</div>
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
        </div>

          </fieldset>
          {!isChatAtBottom && <button type="button" className="chat-scroll-bottom" aria-label="Přejít na nejnovější zprávy" title="Přejít na nejnovější zprávy" onClick={scrollChatToBottom}><ArrowDown aria-hidden="true" /></button>}
          </div>
          {isChatReadOnly ? <div className="composer chat-read-only" role="status">Chat u Výstupu zatím slouží jen k prohlížení historie. Pro pokračování v rozhovoru se vraťte do Rozboru.</div> : (
        <form className="composer" onSubmit={submit}>
          <div className={`composer-field${isDictating ? " is-dictating" : ""}`}>
            <label className="sr-only" htmlFor="message">Zpráva pro APU</label>
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
          )}
          </div>
          <div id="desktop-tool-build" className="workspace-build">
        {phase !== "intake" && sourceF2Need && !canonicalF2Need && <section className="f2-situation" aria-label="Upřesnění pedagogické potřeby">
          {needRoute?.key === sourceNeedKey && needRoute.decision.clarification ? <form onSubmit={(event) => void submitNeedClarification(event)}>
            <label className="f2-parameter"><span>{needRoute.decision.clarification}</span><input aria-label="Požadovaný pedagogický výsledek" value={needClarification} maxLength={Math.max(0, 2000 - sourceF2Need.needText.length - 24)} onChange={(event) => setNeedClarification(event.target.value)} /></label>
            <button type="submit" disabled={!needClarification.trim() || analysisStatus === "loading"}>Upřesnit potřebu</button>
          </form> : needRouteError ? <><p role="alert">{needRouteError}</p><button type="button" onClick={() => void resolveActiveNeed(sourceF2Need).catch((cause) => setNeedRouteError(cause.message))}>Zkusit znovu</button></> : <p role="status">Určuji zaměření podle pedagogické potřeby…</p>}
        </section>}
        {f2Build && <section className="f2-build-shell" aria-label="Obsah">
          <header className="f2-build-header"><h2>Obsah</h2></header>
          <div className="f2-build-body">
            <F2BuildOperations activeF2Path={activeF2Path} currentRozbor={currentRozbor} setCurrentRozbor={setCurrentRozbor} />
          </div>
          <footer className="f2-build-actions">
            {isCurrentRozborUpdatePending && <p className="f2-pending-notice" role="status">Změny Obsahu zatím nejsou přijaty do dokumentu.</p>}
            {rozborGenerationError && <p className="f2-generation-error" role="alert">{rozborGenerationError}</p>}
            <button type="button" className="f2-build-action" onClick={() => void generateCurrentRozbor()} disabled={rozborGenerationStatus === "loading" || !isCurrentRozborUpdatePending || (!hasActiveRozborOperation && activeRozbor.components.length === 0)} title="Přijmout zvolené analytické změny do Rozboru">{rozborGenerationStatus === "loading" ? "AKTUALIZUJI DOKUMENT" : "AKTUALIZOVAT DOKUMENT"}</button>
          </footer>
        </section>}


          </div>
          <div id="desktop-tool-output" className="workspace-output-tools" ref={setF3ControlsTarget}>{!f3State && !currentF2ToF3Source.snapshot && <p role="status">Výstup bude dostupný po úspěšném Rozboru. Potřebu můžete upřesnit v Obsahu.</p>}</div>
        </div>

        <WorkspacePanel
          desktopNavigation={isDesktop ? { view: desktopWorkspace.view, documentPanel: desktopWorkspace.document, documentAvailable: navigationAvailability.document, onView: selectRightView } : undefined}
          notebookReadOnly={Boolean(acceptedF2Source)}
          onDocumentReset={resetDocumentPresentation}
          documentMetadata={documentMetadata}
          documentUpdating={rozborGenerationStatus === "loading" || f3Status === "loading"}
          documentStyle={documentStyle}
          onDocumentStyle={setDocumentStyle}
          activePanel={documentPanel}
          f3ControlsTarget={isF2DesktopLayout ? f3ControlsTarget : null}
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
          onContinueToOutput={() => void sendMessage("Přejít k Výstupu", {
            dialogEvent: "continue_to_output",
            silent: true,
          })}
          f2Build={f2Build}
          currentRozbor={currentRozbor}
          f2Preview={f2Build ? previewStatus(f2Preview, f2Build) : f2Preview}
          f2ToF3Snapshot={currentF2ToF3Source.snapshot}
          f2ToF3SourceError={currentF2ToF3Source.error}
          f2BuildStatus={f2BuildStatus}
          f2BuildError={f2BuildError}
          f2PreviewStatus={f2PreviewStatus}
          f2PreviewError={f2PreviewError}
          onF2SkillToggle={(id) => setF2Build((current) => current ? toggleF2Skill(current, id) : current)}
          onF2ParameterChange={(id, value) => setF2Build((current) => current ? parameterizeF2Skill(current, id, value) : current)}
          onF2ContextAdd={(text) => setF2Build((current) => current ? addF2Context(current, { id: createLocalId("f2-context"), text }) : current)}
          onF2ContextRemove={(id) => setF2Build((current) => current ? removeF2Context(current, id) : current)}
          onF2Execute={() => void executeF2Build()}
          onF2Preview={() => void renderF2Preview()}
          f3State={f3State}
          f3Status={f3Status}
          f3Error={f3Error}
          onF3Representation={(representation) => setF3State((current) => current ? { ...current, representation } : current)}
          onF3Config={(change: Partial<F3Config>) => setF3State((current) => current ? updateF3Config(current, change) : current)}
          onF3Render={() => void renderF3()}
          onF3Adopt={() => setF3State((current) => current && currentF2ToF3Source.snapshot ? adoptF2Snapshot(current, currentF2ToF3Source.snapshot) : current)}
          onF3Return={returnToF2}
        />

        {documentPanel && <div
          className="workspace-resize-handle"
          role="separator"
          aria-label="Změnit šířku nástrojů a dokumentu"
          aria-orientation="vertical"
          aria-valuemin={Math.round(clampDesktopSplit(0, chatCardRef.current?.clientWidth ?? 720))}
          aria-valuemax={Math.round(clampDesktopSplit(100, chatCardRef.current?.clientWidth ?? 720))}
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

        <nav className="tool-rail" aria-label="Rychlé nástroje">
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
      </section>
    </main>
  );
}
