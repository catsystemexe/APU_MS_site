import sharedFeedbackJson from "../data/shared-feedback.json";
import { parseSharedFeedback } from "./shared-feedback";
export function loadSharedFeedback() { return parseSharedFeedback(sharedFeedbackJson); }
