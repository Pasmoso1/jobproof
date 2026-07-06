export type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

export type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

/** Errors that mean live dictation cannot work — fall back to recording quietly. */
const LIVE_DICTATION_FALLBACK_ERRORS = new Set([
  "not-allowed",
  "service-not-allowed",
  "network",
  "audio-capture",
  "language-not-supported",
  "no-speech",
]);

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isMobileUserAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function isMediaRecorderSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

/**
 * Live browser speech-to-text is unreliable on mobile (API exists but fails immediately).
 * Only offer live dictation on non-mobile browsers where the API is present.
 */
export function isLiveDictationSupported(): boolean {
  if (!getSpeechRecognitionCtor()) return false;
  if (isMobileUserAgent()) return false;
  return true;
}

export function isLiveDictationFallbackError(errorCode: string | undefined): boolean {
  return LIVE_DICTATION_FALLBACK_ERRORS.has(String(errorCode ?? "").toLowerCase());
}

export const LIVE_DICTATION_UNAVAILABLE_MESSAGE =
  "Live dictation is not available on this browser. You can record an audio note instead.";

export const MIC_BLOCKED_MESSAGE =
  "Microphone access was blocked. You can type notes manually or upload an audio file.";

export function pickAudioRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) return "audio/ogg;codecs=opus";
  return "audio/webm";
}
