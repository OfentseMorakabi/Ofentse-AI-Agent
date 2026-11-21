import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarCheck,
  Check,
  Mail,
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { AgentAction, AgentCommandResponse, WorkspaceState } from '../types';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  isOnline: boolean;
  initialPrompt?: string | null;
  onClose: () => void;
  onWorkspaceUpdated: (next: WorkspaceState) => void;
  onConfirmSendEmail: (draft: {
    to: string;
    subject: string;
    body: string;
    priority: 'urgent' | 'normal';
  }) => Promise<void>;
  onBookEvent: (evt: {
    title: string;
    startIso: string;
    endIso: string;
    attendees: string[];
    location: string;
    priority: string;
    notes: string;
  }) => Promise<void>;
  onOfflineCommand: (commandText: string) => Promise<string>;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const SAMPLE_VOICE_PROMPTS = [
  'Schedule a product sync tomorrow at 2pm with Elena',
  'Send an urgent email to Marcus about the offline benchmark',
  'Remind me in 30 minutes to approve WebAuthn keys',
  'Move API Migration task to In Progress',
  'Check and resolve any calendar conflicts today',
];

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  isOnline,
  initialPrompt,
  onClose,
  onWorkspaceUpdated,
  onConfirmSendEmail,
  onBookEvent,
  onOfflineCommand,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(true);
  const [inputText, setInputText] = useState('');
  const [transcript, setTranscript] = useState('');
  const [replyText, setReplyText] = useState<string | null>(null);
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>([14, 24, 34, 22, 42, 28, 18, 30, 20]);
  const [sendingIndex, setSendingIndex] = useState<number | null>(null);
  const [resolvedIndices, setResolvedIndices] = useState<number[]>([]);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen && initialPrompt) {
      setInputText(initialPrompt);
    }
  }, [isOpen, initialPrompt]);

  useEffect(() => {
    return () => {
      stopAudioMonitoring();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  if (!isOpen) return null;

  const stopAudioMonitoring = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const speakResponse = (text: string) => {
    if (!speakReplies || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.04;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {
      // ignore speech synthesis restrictions
    }
  };

  const submitCommand = async (commandText: string) => {
    const cleaned = commandText.trim();
    if (!cleaned) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setTranscript(cleaned);
    setActions([]);
    setResolvedIndices([]);

    try {
      if (!isOnline) {
        const offlineMsg = await onOfflineCommand(cleaned);
        setReplyText(offlineMsg);
        speakResponse(offlineMsg);
        setIsProcessing(false);
        return;
      }

      const res = await fetch('/api/agent/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: cleaned,
          currentLocalIso: new Date().toISOString(),
        }),
      });
      const data = (await res.json()) as AgentCommandResponse & {
        error?: string;
        workspace?: WorkspaceState;
      };

      if (!res.ok) {
        throw new Error(data.error || 'Voice command failed.');
      }

      setReplyText(data.replyText);
      setActions(data.actions || []);
      speakResponse(data.replyText);

      if (data.workspace) {
        onWorkspaceUpdated(data.workspace);
      }
      setInputText('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not reach Aether agent.';
      setErrorMsg(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const startWaveformVisualizer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 32;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        const bars = Array.from({ length: 9 }, (_, i) => {
          const val = dataArray[i % dataArray.length] ?? 0;
          return Math.max(12, Math.min(54, Math.round((val / 255) * 54) + 10));
        });
        setAudioLevels(bars);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      return stream;
    } catch {
      return null;
    }
  };

  const startVoiceCapture = async () => {
    setErrorMsg(null);
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;

    if (SpeechRec) {
      try {
        await startWaveformVisualizer();
        const recognition = new SpeechRec();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        let finalTranscript = '';
        recognition.onresult = (event) => {
          let interim = '';
          for (let i = 0; i < event.results.length; i++) {
            const piece = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += piece + ' ';
            } else {
              interim += piece;
            }
          }
          const combined = (finalTranscript || interim).trim();
          setTranscript(combined);
          setInputText(combined);
        };
        recognition.onerror = (ev) => {
          setIsListening(false);
          stopAudioMonitoring();
          if (ev.error !== 'no-speech' && ev.error !== 'aborted') {
            setErrorMsg(`Microphone error: ${ev.error}. You can type your command below.`);
          }
        };
        recognition.onend = () => {
          setIsListening(false);
          stopAudioMonitoring();
          if (finalTranscript.trim()) {
            submitCommand(finalTranscript.trim());
          }
        };

        recognitionRef.current = recognition;
        setIsListening(true);
        recognition.start();
        return;
      } catch {
        stopAudioMonitoring();
      }
    }

    // Fallback to MediaRecorder -> Gemini 3.5 Transcribe
    try {
      const stream = (await startWaveformVisualizer()) || (await navigator.mediaDevices.getUserMedia({ audio: true }));
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stopAudioMonitoring();
        setIsListening(false);
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = String(reader.result || '').split(',')[1];
          if (!base64) return;
          setIsProcessing(true);
          try {
            const tr = await fetch('/api/agent/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioBase64: base64, mimeType: blob.type || 'audio/webm' }),
            });
            const data = (await tr.json()) as { transcript?: string; error?: string };
            if (!tr.ok) throw new Error(data.error || 'Transcription error');
            if (data.transcript) {
              await submitCommand(data.transcript);
            }
          } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Transcription failed.');
            setIsProcessing(false);
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      setIsListening(true);
      recorder.start();
    } catch {
      setErrorMsg('Microphone permission unavailable. Enter your natural language command below.');
    }
  };

  const stopVoiceCapture = () => {
    setIsListening(false);
    stopAudioMonitoring();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleConfirmEmailAction = async (idx: number, action: AgentAction) => {
    setSendingIndex(idx);
    try {
      await onConfirmSendEmail({
        to: String(action.payload.to || ''),
        subject: String(action.payload.subject || ''),
        body: String(action.payload.body || ''),
        priority: action.payload.priority === 'urgent' ? 'urgent' : 'normal',
      });
      setResolvedIndices((prev) => [...prev, idx]);
      setReplyText(`Email sent to ${String(action.payload.to)}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send email.');
    } finally {
      setSendingIndex(null);
    }
  };

  const handleBookSuggestedSlot = async (idx: number, action: AgentAction, useSuggested: boolean) => {
    setSendingIndex(idx);
    try {
      const startIso = useSuggested
        ? String(action.conflictDetails?.suggestedSlotStartIso)
        : String(action.payload.startIso);
      const endIso = useSuggested
        ? String(action.conflictDetails?.suggestedSlotEndIso)
        : String(action.payload.endIso);
      await onBookEvent({
        title: String(action.payload.title || 'Meeting'),
        startIso,
        endIso,
        attendees: Array.isArray(action.payload.attendees) ? action.payload.attendees.map(String) : [],
        location: String(action.payload.location || 'Encrypted Bridge'),
        priority: String(action.payload.priority || 'medium'),
        notes: String(action.payload.notes || ''),
      });
      setResolvedIndices((prev) => [...prev, idx]);
      setReplyText(
        `Scheduled "${String(action.payload.title)}" for ${new Date(startIso).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to book slot.');
    } finally {
      setSendingIndex(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-md p-0 md:p-4">
      <div className="w-full md:max-w-xl rounded-t-3xl md:rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] overflow-hidden max-h-[90vh] flex flex-col">
        <div className="md:hidden w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3" />

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Aether Voice Assistant
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isOnline
                ? 'Natural language calendar, email, reminder & task control'
                : 'Offline Voice Queue active · Syncs automatically when online'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSpeakReplies((v) => !v)}
              aria-label={speakReplies ? 'Mute spoken replies' : 'Enable spoken replies'}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              {speakReplies ? <Volume2 className="w-4 h-4 text-indigo-500" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              aria-label="Close voice assistant"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Siri-like Acoustic Orb & Waveform */}
          <div className="flex flex-col items-center justify-center py-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0A0C10]">
            <div className="flex items-end justify-center gap-1.5 h-12 mb-4">
              {audioLevels.map((h, i) => (
                <div
                  key={i}
                  style={{ height: `${isListening ? h : isProcessing ? 18 + (i % 3) * 8 : 10}px` }}
                  className={`w-1.5 rounded-full transition-all duration-150 ${
                    isListening
                      ? 'bg-indigo-500'
                      : isProcessing
                      ? 'bg-sky-500'
                      : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={isListening ? stopVoiceCapture : startVoiceCapture}
              disabled={isProcessing}
              className={`min-h-[64px] min-w-[64px] rounded-full flex items-center justify-center transition-transform active:scale-95 ${
                isListening
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
              }`}
              aria-label={isListening ? 'Stop listening' : 'Tap to speak'}
            >
              {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            <span className="mt-3 text-xs font-medium text-slate-600 dark:text-slate-300">
              {isListening
                ? 'Listening... Tap to finish'
                : isProcessing
                ? 'Parsing intent & executing...'
                : 'Tap microphone or type a command'}
            </span>
          </div>

          {transcript && (
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] px-4 py-3">
              <div className="text-[11px] font-medium text-slate-400">You said</div>
              <p className="text-sm text-slate-900 dark:text-white mt-0.5">{transcript}</p>
            </div>
          )}

          {replyText && (
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3">
              <div className="text-[11px] font-medium text-indigo-600 dark:text-indigo-300">Aether</div>
              <p className="text-sm text-slate-900 dark:text-white mt-0.5 leading-relaxed">{replyText}</p>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-600 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* Action Cards */}
          {actions.length > 0 && (
            <div className="space-y-3">
              {actions.map((action, idx) => {
                const isDone = resolvedIndices.includes(idx);

                if (action.type === 'send_email' && action.status === 'needs_confirmation' && !isDone) {
                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-300">
                          <Mail className="w-4 h-4" />
                          Confirm Outgoing Email
                        </div>
                        <span className="text-xs font-mono text-slate-500">
                          {String(action.payload.priority || 'normal')}
                        </span>
                      </div>
                      <div className="text-xs space-y-1 text-slate-700 dark:text-slate-300">
                        <div>
                          <span className="text-slate-400">To:</span> {String(action.payload.to)}
                        </div>
                        <div>
                          <span className="text-slate-400">Subject:</span> {String(action.payload.subject)}
                        </div>
                        <p className="pt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                          {String(action.payload.body)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleConfirmEmailAction(idx, action)}
                          disabled={sendingIndex === idx}
                          className="flex-1 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          {sendingIndex === idx ? 'Sending...' : 'Confirm & Send'}
                        </button>
                        <button
                          onClick={() => setResolvedIndices((p) => [...p, idx])}
                          className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                }

                if (action.status === 'conflict_detected' && action.conflictDetails && !isDone) {
                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-3"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-300">
                        <AlertTriangle className="w-4 h-4" />
                        Scheduling Conflict Detected
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        Overlaps with <strong>{action.conflictDetails.conflictingEventTitle}</strong>. Next open
                        slot:{' '}
                        <span className="font-mono tabular-nums">
                          {new Date(action.conflictDetails.suggestedSlotStartIso).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          –{' '}
                          {new Date(action.conflictDetails.suggestedSlotEndIso).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleBookSuggestedSlot(idx, action, true)}
                          disabled={sendingIndex === idx}
                          className="flex-1 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center justify-center gap-1.5"
                        >
                          <CalendarCheck className="w-4 h-4" />
                          Book Open Slot
                        </button>
                        <button
                          onClick={() => handleBookSuggestedSlot(idx, action, false)}
                          disabled={sendingIndex === idx}
                          className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                        >
                          Double-Book
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3.5 py-2.5 text-xs"
                  >
                    <span className="font-medium text-emerald-700 dark:text-emerald-300">
                      {isDone ? 'Confirmed' : action.summary}
                    </span>
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Tap Voice Prompt Examples */}
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              Quick Voice &amp; Command Prompts
            </div>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_VOICE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => submitCommand(prompt)}
                  disabled={isProcessing}
                  className="text-left rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.06] px-3 py-2 text-xs text-slate-700 dark:text-slate-300 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Text Command Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitCommand(inputText);
          }}
          className="p-4 border-t border-slate-200 dark:border-white/10 flex items-center gap-2 bg-slate-50 dark:bg-[#0A0C10]"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask Aether to schedule, email, remind, or update tasks..."
            className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] px-3.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={isProcessing || !inputText.trim()}
            aria-label="Send command"
            className="min-h-[44px] min-w-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white flex items-center justify-center transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
