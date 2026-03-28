export class SpeechRecognitionService {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;

  constructor() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-US";
    }
  }

  start(
    onResult: (transcript: string, isFinal: boolean) => void,
    onEnd?: () => void
  ) {
    if (!this.recognition) {
      console.error("Speech recognition not supported");
      return;
    }
    this.isListening = true;

    this.recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        onResult(finalTranscript, true);
      } else if (interimTranscript) {
        onResult(interimTranscript, false);
      }
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        // Auto-restart if still supposed to be listening
        try { this.recognition?.start(); } catch {}
      } else {
        onEnd?.();
      }
    };

    this.recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.error("Speech recognition error:", event.error);
      }
    };

    try {
      this.recognition.start();
    } catch {}
  }

  stop() {
    this.isListening = false;
    this.recognition?.stop();
  }

  isSupported() {
    return this.recognition !== null;
  }
}

export function playAudioBase64(base64Audio: string): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(`data:audio/mpeg;base64,${base64Audio}`);
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    audio.play().catch(() => resolve());
  });
}
