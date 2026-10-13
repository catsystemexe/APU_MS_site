export const DESKTOP_WORKSPACE_QUERY = "(min-width: 1024px), (min-width: 768px) and (orientation: landscape)";
export const DESKTOP_SPLIT_STORAGE_KEY = "apu.desktopSplit";
export const DEFAULT_DESKTOP_SPLIT = 30;
export const MIN_CHAT_WIDTH = 420;
export const MIN_WORKSPACE_WIDTH = 300;
export type DesktopTool = "build" | "output" | "chat";
export type DesktopView = "notepad" | "document";
export type DesktopWorkspace = { tool: DesktopTool; document: "analysis" | "output"; view: DesktopView };
export type WorkspaceAvailability = { chat: true; build: boolean; output: boolean; document: boolean };
export const INITIAL_INTAKE_WORKSPACE: DesktopWorkspace = { tool: "chat", document: "analysis", view: "notepad" };
export const INITIAL_PROCESSING_WORKSPACE: DesktopWorkspace = { tool: "build", document: "analysis", view: "document" };

export function workspaceAvailability(processing: boolean, buildAccessible: boolean, outputAccessible: boolean, hasAcceptedDocument: boolean): WorkspaceAvailability {
  return { chat: true, build: processing && buildAccessible, output: processing && outputAccessible, document: hasAcceptedDocument };
}

export function selectDesktopTool(current: DesktopWorkspace, tool: DesktopTool, availability: WorkspaceAvailability): DesktopWorkspace {
  if (!availability[tool]) return current;
  return { ...current, tool, document: tool === "chat" ? current.document : tool === "build" ? "analysis" : "output" };
}
export function selectDesktopView(current: DesktopWorkspace, view: DesktopView, availability: WorkspaceAvailability): DesktopWorkspace {
  if (view === "document" && !availability.document) return current;
  return current.view === view ? current : { ...current, view };
}

export function clampDesktopSplit(preferred: number, width: number) {
  if (width <= 0) return DEFAULT_DESKTOP_SPLIT;
  const minimum = (MIN_CHAT_WIDTH / width) * 100;
  const maximum = 100 - (MIN_WORKSPACE_WIDTH / width) * 100;
  if (minimum > maximum) return (MIN_CHAT_WIDTH / (MIN_CHAT_WIDTH + MIN_WORKSPACE_WIDTH)) * 100;
  return Math.min(maximum, Math.max(minimum, preferred));
}

export function readDesktopSplitPreference(stored: string | null) {
  // Previous versions wrote this key only on explicit resize/reset actions.
  // Preserve every valid saved ratio, including legacy 60; do not reinterpret it
  // as an automatic default. Only a fresh/invalid preference uses the new 30.
  const value = stored?.trim() ? Number(stored) : NaN;
  return Number.isFinite(value) && value > 0 && value < 100 ? value : DEFAULT_DESKTOP_SPLIT;
}
