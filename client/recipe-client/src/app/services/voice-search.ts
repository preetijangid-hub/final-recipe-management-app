import { Injectable, signal } from '@angular/core';

// Minimal shape of the Web Speech API pieces used here. TypeScript does not
// ship these types, and webkitSpeechRecognition is still prefixed in Chrome.
type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string; confidence: number };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionErrorLike = {
  error: string;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const getSpeechRecognition = (): SpeechRecognitionConstructor | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const speechWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return (
    speechWindow.SpeechRecognition ??
    speechWindow.webkitSpeechRecognition ??
    null
  );
};

export const isVoiceSearchSupported = (): boolean =>
  getSpeechRecognition() !== null;

// Turns the browser error codes into sentences users can act on. Exported
// for the unit tests, because the real API cannot be triggered in a test.
export const describeSpeechError = (code: string): string => {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was blocked. Allow it in your browser settings to search by voice.';

    case 'no-speech':
      return 'No speech was detected. Please try again and speak clearly.';

    case 'audio-capture':
      return 'No microphone was found on this device.';

    case 'network':
      return 'Voice search needs a network connection today. Please type your search instead.';

    case 'aborted':
      return 'Voice search was stopped.';

    default:
      return 'Voice search is not available right now. Please type your search instead.';
  }
};

@Injectable({
  providedIn: 'root',
})
export class VoiceSearchService {
  readonly supported = isVoiceSearchSupported();

  readonly listening = signal(false);

  readonly errorMessage = signal('');

  private recognition: SpeechRecognitionLike | null = null;

  private onResult: ((transcript: string) => void) | null = null;

  // Starts listening once. A second call while already listening is ignored,
  // so the microphone button cannot open two sessions.
  start(onResult: (transcript: string) => void): void {
    if (!this.supported || this.listening()) {
      return;
    }

    const Recognition = getSpeechRecognition();

    if (!Recognition) {
      return;
    }

    this.errorMessage.set('');
    this.onResult = onResult;

    const recognition = new Recognition();

    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const result = event.results[event.resultIndex];

      const transcript = result?.[0]?.transcript?.trim() ?? '';

      if (!transcript) {
        this.errorMessage.set(
          'Nothing was recognised. Please try speaking again.'
        );

        return;
      }

      this.onResult?.(transcript);
    };

    recognition.onerror = (event) => {
      this.errorMessage.set(describeSpeechError(event.error));
    };

    recognition.onend = () => {
      this.listening.set(false);
    };

    this.recognition = recognition;
    this.listening.set(true);

    try {
      recognition.start();
    } catch {
      // Some browsers throw when a session is already active.
      this.listening.set(false);
      this.errorMessage.set(
        'Voice search could not be started. Please try again.'
      );
    }
  }

  stop(): void {
    this.recognition?.stop();
    this.listening.set(false);
  }

  clearError(): void {
    this.errorMessage.set('');
  }
}
