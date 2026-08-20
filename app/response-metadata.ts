export type DebugMapping = {
  profiles: string;
  blocks: string;
  zones: string;
};

export const UNKNOWN_DEBUG_MAPPING: DebugMapping = {
  profiles: "?",
  blocks: "?",
  zones: "?",
};

const DEBUG_LINE_PATTERN = /\[DEBUG\s*\|[^\]\r\n]*\]/gi;
const DEBUG_MAPPING_PATTERN = /\[DEBUG\s*\|\s*Profil\s*:\s*([^|\]]+)\s*\|\s*Blok\s*:\s*([^|\]]+)\s*\|\s*Z[oó]na\s*:\s*([^\]]+)\]/i;
const MODE_LABEL_PATTERN = /\[(?:FÁZE\s+[123]|⚡\s*RYCHLE|⚠\s*BEZPEČÍ|INFO)\]/i;

function cleanMappingValue(value: string) {
  return value.trim().replace(/\s*\/\s*/g, " / ") || "?";
}

export function formatDebugMapping(mapping: DebugMapping) {
  return `[DEBUG | Profil: ${mapping.profiles} | Blok: ${mapping.blocks} | Zóna: ${mapping.zones}]`;
}

export function parseDebugMapping(value?: string): DebugMapping | null {
  if (!value) return null;
  const match = value.match(DEBUG_MAPPING_PATTERN);
  if (!match) return null;
  return {
    profiles: cleanMappingValue(match[1]),
    blocks: cleanMappingValue(match[2]),
    zones: cleanMappingValue(match[3]),
  };
}

export function splitAssistantMetadata(content: string, options: { ensureDebug?: boolean } = {}) {
  const debugLines = content.match(DEBUG_LINE_PATTERN) ?? [];
  const debugMapping = debugLines
    .map((line) => parseDebugMapping(line))
    .findLast((mapping): mapping is DebugMapping => mapping !== null) ?? null;
  const phaseLabel = content.match(MODE_LABEL_PATTERN)?.[0] ?? "";
  const shouldHaveDebug = options.ensureDebug && phaseLabel.toUpperCase() !== "[INFO]";
  const resolvedMapping = debugMapping ?? (shouldHaveDebug ? UNKNOWN_DEBUG_MAPPING : null);
  const visibleContent = content
    .replace(DEBUG_LINE_PATTERN, "\n")
    .replace(MODE_LABEL_PATTERN, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return {
    visibleContent,
    debugText: resolvedMapping ? formatDebugMapping(resolvedMapping) : "",
    debugMapping: resolvedMapping,
    phaseLabel,
  };
}
