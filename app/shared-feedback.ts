export const SHARED_FEEDBACK_TYPES = ["bug", "improvement", "feature", "discussion", "observation"] as const;
export const SHARED_FEEDBACK_STATUSES = ["new", "in_progress", "discuss", "done", "rejected"] as const;
export type SharedFeedbackType = (typeof SHARED_FEEDBACK_TYPES)[number];
export type SharedFeedbackStatus = (typeof SHARED_FEEDBACK_STATUSES)[number];
export type SharedFeedbackDetail = { label: string; text: string };
export type SharedFeedbackItem = { id: string; type: SharedFeedbackType; title: string; status: SharedFeedbackStatus; createdAt: string; source: string; summary: string; details: SharedFeedbackDetail[]; note: string };
export type SharedFeedbackData = { version: 1; items: SharedFeedbackItem[] };
export type SharedFeedbackResult = { data: SharedFeedbackData | null; error: string | null };

export const SHARED_FEEDBACK_STATUS_LABELS: Record<SharedFeedbackStatus, string> = { new: "NOVÉ", in_progress: "ŘEŠÍME", discuss: "PROBRAT", done: "HOTOVO", rejected: "ZAMÍTNUTO" };
const STATUS_ORDER: Record<SharedFeedbackStatus, number> = { new: 0, in_progress: 1, discuss: 2, done: 4, rejected: 5 };
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function isNonEmptyString(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function isFeedbackItem(value: unknown): value is SharedFeedbackItem {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.id) && SHARED_FEEDBACK_TYPES.includes(value.type as SharedFeedbackType)
    && isNonEmptyString(value.title) && SHARED_FEEDBACK_STATUSES.includes(value.status as SharedFeedbackStatus)
    && isNonEmptyString(value.createdAt) && !Number.isNaN(Date.parse(value.createdAt)) && isNonEmptyString(value.source)
    && isNonEmptyString(value.summary) && Array.isArray(value.details)
    && value.details.every((detail) => isRecord(detail) && isNonEmptyString(detail.label) && isNonEmptyString(detail.text))
    && typeof value.note === "string";
}
export function parseSharedFeedback(value: unknown): SharedFeedbackResult {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.items)) return { data: null, error: "Shared Feedback data nemají podporovaný formát." };
  if (!value.items.every(isFeedbackItem)) return { data: null, error: "Shared Feedback obsahuje neplatnou položku." };
  if (new Set(value.items.map((item) => item.id)).size !== value.items.length) return { data: null, error: "Shared Feedback obsahuje duplicitní ID." };
  return { data: { version: 1, items: value.items }, error: null };
}
export function sortSharedFeedback(items: SharedFeedbackItem[]) {
  return [...items].sort((left, right) => STATUS_ORDER[left.status] - STATUS_ORDER[right.status] || Date.parse(right.createdAt) - Date.parse(left.createdAt));
}
