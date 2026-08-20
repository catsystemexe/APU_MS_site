export type SpeechRecognitionResultLike = {
  isFinal: boolean;
  [index: number]: { transcript: string };
};

export type SpeechTranscriptSegment = {
  transcript: string;
  isFinal: boolean;
};

function normalizeTranscript(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function looksLikeCumulativeRevision(previous: string, next: string) {
  if (previous === next) return true;
  if (next.startsWith(`${previous} `)) return true;

  const previousWords = previous.split(" ");
  const nextWords = next.split(" ");
  if (nextWords.length < previousWords.length || previousWords[0] !== nextWords[0]) return false;

  // Android's continuous recognizer can emit a corrected cumulative phrase as a
  // new final result (for example "test ras 2" -> "test raz dva tři"). In that
  // case the word boundary changes, so an exact prefix comparison is insufficient.
  let commonPrefixLength = 0;
  const shorterLength = Math.min(previous.length, next.length);
  while (
    commonPrefixLength < shorterLength
    && previous[commonPrefixLength] === next[commonPrefixLength]
  ) {
    commonPrefixLength += 1;
  }

  return commonPrefixLength >= Math.max(4, Math.floor(previous.length * 0.45));
}

export function updateSpeechTranscriptSegments(
  previous: SpeechTranscriptSegment[],
  results: ArrayLike<SpeechRecognitionResultLike>,
  resultIndex: number,
) {
  const next = previous.slice(0, Math.max(0, resultIndex));
  for (let index = Math.max(0, resultIndex); index < results.length; index += 1) {
    next[index] = {
      transcript: normalizeTranscript(results[index][0]?.transcript ?? ""),
      isFinal: results[index].isFinal,
    };
  }
  next.length = results.length;
  return next;
}

export function composeSpeechSegments(segments: SpeechTranscriptSegment[]) {
  const phrases: string[] = [];

  for (const segment of segments) {
    const transcript = normalizeTranscript(segment.transcript);
    if (!transcript) continue;

    const previous = phrases.at(-1);
    if (previous && looksLikeCumulativeRevision(previous, transcript)) {
      phrases[phrases.length - 1] = transcript;
    } else {
      phrases.push(transcript);
    }
  }

  return phrases.join(" ");
}

export function composeSpeechTranscript(results: ArrayLike<SpeechRecognitionResultLike>) {
  return composeSpeechSegments(updateSpeechTranscriptSegments([], results, 0));
}
