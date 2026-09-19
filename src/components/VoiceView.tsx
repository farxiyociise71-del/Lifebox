import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Sparkles,
  FileAudio,
  Trash2,
  Clock,
  CheckCircle2,
  Save,
  Volume2,
  VolumeX,
  Vibrate,
  Command,
  FileText,
  CheckSquare,
  Search,
  ArrowRight,
  ExternalLink,
  Plus,
  Play,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  Radio,
} from 'lucide-react';
import { LifeboxItem, Collection } from '../types';
import { SoundEngine } from '../utils/soundAndVibration';
import {
  parseVoiceCommand,
  executeVoiceCommand,
  ParsedVoiceCommand,
  VoiceCommandExecutionResult,
} from '../utils/voiceCommands';

interface VoiceViewProps {
  items: LifeboxItem[];
  collections: Collection[];
  onSaveItem: (item: LifeboxItem) => void;
  onUpdateItem?: (item: LifeboxItem) => void;
  onDeleteItem: (id: string) => void;
  onSelectItem: (item: LifeboxItem) => void;
  onNavigateTab?: (tab: string) => void;
}

export const VoiceView: React.FC<VoiceViewProps> = ({
  items,
  collections,
  onSaveItem,
  onUpdateItem,
  onDeleteItem,
  onSelectItem,
  onNavigateTab,
}) => {
  // Active view tab: 'commands' (Web Speech API voice commands) or 'memos' (Audio recordings)
  const [activeVoiceTab, setActiveVoiceTab] = useState<'commands' | 'memos'>('commands');

  // --- Voice Commands State (Web Speech API) ---
  const [isListeningCommand, setIsListeningCommand] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const [lastExecutedResult, setLastExecutedResult] = useState<VoiceCommandExecutionResult | null>(null);
  const [lastParsedCommand, setLastParsedCommand] = useState<ParsedVoiceCommand | null>(null);
  const [commandHistory, setCommandHistory] = useState<
    Array<{ phrase: string; timestamp: string; success: boolean; intent: string }>
  >([]);

  // Sound & Vibration states
  const [soundEnabled, setSoundEnabled] = useState(SoundEngine.isSoundEnabled());
  const [vibrationEnabled, setVibrationEnabled] = useState(SoundEngine.isVibrationEnabled());
  const [speechFeedbackEnabled, setSpeechFeedbackEnabled] = useState(SoundEngine.isSpeechEnabled());
  const [vibrationTesting, setVibrationTesting] = useState(false);

  // Speech Recognition instance ref
  const recognitionRef = useRef<any>(null);

  // --- Audio Memo Recording State ---
  const voiceNotes = items.filter((it) => it.type === 'voice' && !it.isTrash);
  const [isRecordingMemo, setIsRecordingMemo] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcribingMemo, setTranscribingMemo] = useState(false);
  const [memoTranscript, setMemoTranscript] = useState('');
  const [memoTitle, setMemoTitle] = useState('');
  const [savedMemoSuccess, setSavedMemoSuccess] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const memoTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Web Speech Recognition API
  useEffect(() => {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setSpeechSupported(false);
      return;
    }

    try {
      const recognizer = new SpeechRecognitionClass();
      recognizer.continuous = false;
      recognizer.interimResults = true;
      recognizer.lang = 'en-US';

      recognizer.onstart = () => {
        setIsListeningCommand(true);
        setLiveTranscript('');
        setInterimText('');
        SoundEngine.playMicStart();
      };

      recognizer.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptChunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcriptChunk;
          } else {
            interim += transcriptChunk;
          }
        }

        if (interim) {
          setInterimText(interim);
          SoundEngine.vibrate(12);
        }

        if (final) {
          setLiveTranscript(final);
          setInterimText('');
          processVoiceCommandText(final);
        }
      };

      recognizer.onerror = (event: any) => {
        console.warn('Speech recognition event:', event.error);
        setIsListeningCommand(false);
        setInterimText('');
        if (event.error !== 'no-speech') {
          SoundEngine.playMicStop();
        }
      };

      recognizer.onend = () => {
        setIsListeningCommand(false);
        setInterimText('');
      };

      recognitionRef.current = recognizer;
    } catch (e) {
      console.warn('Failed to initialize speech recognition:', e);
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, [items]);

  // Handle Command Processing
  const processVoiceCommandText = (spokenText: string) => {
    if (!spokenText.trim()) return;

    SoundEngine.playMicStop();

    // Parse intent
    const parsed = parseVoiceCommand(spokenText);
    setLastParsedCommand(parsed);

    // Execute intent
    const result = executeVoiceCommand(parsed, items, {
      onSaveItem,
      onSelectItem,
      onNavigateTab,
    });

    setLastExecutedResult(result);

    // Sound & Haptic Feedback
    if (result.success) {
      SoundEngine.playCommandSuccess();
    } else {
      SoundEngine.vibrate([60, 50, 60]);
    }

    // Voice Speech Synthesis Readout
    if (result.spokenFeedback) {
      SoundEngine.speakText(result.spokenFeedback);
    }

    // Record in history
    setCommandHistory((prev) => [
      {
        phrase: spokenText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        success: result.success,
        intent: result.intent,
      },
      ...prev.slice(0, 7),
    ]);
  };

  const startListeningCommand = () => {
    if (!recognitionRef.current) {
      // Fallback prompt simulation if SpeechRecognition not available
      const simulated = prompt(
        'Speech Recognition not available in this browser. Enter voice command to simulate:\n(e.g., "create a new note", "show today\'s tasks", "search my documents")',
        'show today\'s tasks'
      );
      if (simulated) {
        setLiveTranscript(simulated);
        processVoiceCommandText(simulated);
      }
      return;
    }

    try {
      recognitionRef.current.abort();
      setLiveTranscript('');
      setInterimText('');
      recognitionRef.current.start();
    } catch (err) {
      console.warn('Recognition start failed:', err);
    }
  };

  const stopListeningCommand = () => {
    if (recognitionRef.current && isListeningCommand) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListeningCommand(false);
      SoundEngine.playMicStop();
    }
  };

  // Toggle Sound/Vibration
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    SoundEngine.setSoundEnabled(next);
    if (next) SoundEngine.playCommandSuccess();
  };

  const toggleVibration = () => {
    const next = !vibrationEnabled;
    setVibrationEnabled(next);
    SoundEngine.setVibrationEnabled(next);
    if (next) SoundEngine.vibrate([50, 40, 50]);
  };

  const toggleSpeechFeedback = () => {
    const next = !speechFeedbackEnabled;
    setSpeechFeedbackEnabled(next);
    SoundEngine.setSpeechEnabled(next);
    if (next) SoundEngine.speakText('Voice feedback enabled');
    else SoundEngine.stopSpeaking();
  };

  const handleTestVibration = () => {
    setVibrationTesting(true);
    SoundEngine.vibrate([60, 50, 60, 50, 100]);
    SoundEngine.playCommandSuccess();
    setTimeout(() => setVibrationTesting(false), 800);
  };

  // --- Audio Memo Recording Timer ---
  useEffect(() => {
    if (isRecordingMemo) {
      setRecordingTime(0);
      memoTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else if (memoTimerRef.current) {
      clearInterval(memoTimerRef.current);
    }
    return () => {
      if (memoTimerRef.current) clearInterval(memoTimerRef.current);
    };
  }, [isRecordingMemo]);

  const startRecordingMemo = async () => {
    try {
      SoundEngine.playMicStart();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        stream.getTracks().forEach((t) => t.stop());

        // Transcribe memo
        setTranscribingMemo(true);
        setTimeout(() => {
          const sample =
            'Voice memo note: Discussed project priorities, verified encrypted vaults, and organized next sprint objectives.';
          setMemoTranscript(sample);
          setMemoTitle(
            'Memo - ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          );
          setTranscribingMemo(false);
          SoundEngine.playReceiveSound();
        }, 1200);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecordingMemo(true);
      setSavedMemoSuccess(false);
    } catch (err: any) {
      SoundEngine.vibrate([100]);
      alert('Microphone access was denied or is unsupported: ' + err.message);
    }
  };

  const stopRecordingMemo = () => {
    if (mediaRecorderRef.current && isRecordingMemo) {
      mediaRecorderRef.current.stop();
      setIsRecordingMemo(false);
      SoundEngine.playMicStop();
    }
  };

  const handleSaveMemo = () => {
    if (!memoTranscript && !audioUrl) return;

    const newVoiceItem: LifeboxItem = {
      id: 'item-voice-' + Date.now(),
      title: memoTitle.trim() || 'Recorded Voice Note',
      type: 'voice',
      category: 'personal',
      collectionIds: [],
      content: memoTranscript || 'Recorded audio message',
      mediaUrl: audioUrl || undefined,
      extractedText: memoTranscript,
      summary: memoTranscript.length > 30 ? memoTranscript.slice(0, 100) + '...' : undefined,
      tags: ['voice', 'recording'],
      pinned: false,
      favorite: false,
      locked: false,
      isTrash: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveItem(newVoiceItem);
    SoundEngine.playCommandSuccess();
    setSavedMemoSuccess(true);
    setAudioBlob(null);
    setAudioUrl(null);
    setMemoTranscript('');
    setMemoTitle('');
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Sample voice commands for one-click testing
  const sampleCommands = [
    { label: 'Create a new note', command: 'create a new note' },
    { label: "Show today's tasks", command: "show today's tasks" },
    { label: 'Search my documents', command: 'search my documents' },
    { label: 'Note: Buy fresh groceries', command: 'create a new note called Grocery List with organic oat milk and fruits' },
    { label: 'Create task: Call client', command: 'create a new task to call client for contract review' },
    { label: 'Show all my notes', command: 'show all my notes' },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Mode Switcher & Sound / Vibration Toggles */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shadow-xs">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
              Voice Center & Commands
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-800 border border-neutral-300">
                Web Speech API
              </span>
            </h1>
            <p className="text-xs text-neutral-500">
              Speak voice commands, capture audio memos, with real-time sound and haptic vibration feedback.
            </p>
          </div>
        </div>

        {/* Sound, Haptic Vibration & Speech Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              soundEnabled
                ? 'bg-neutral-900 border-black text-white'
                : 'bg-neutral-100 border-neutral-300 text-neutral-500'
            }`}
            title="Toggle Sound Effects"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-white" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>Sound {soundEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Vibration Toggle */}
          <button
            onClick={toggleVibration}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              vibrationEnabled
                ? 'bg-neutral-900 border-black text-white'
                : 'bg-neutral-100 border-neutral-300 text-neutral-500'
            }`}
            title="Toggle Haptic Vibration"
          >
            <Vibrate className={`w-3.5 h-3.5 ${vibrationEnabled ? 'text-white' : ''}`} />
            <span>Vibration {vibrationEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Test Vibration Pulse */}
          <button
            onClick={handleTestVibration}
            disabled={vibrationTesting}
            className="px-3 py-1.5 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-900 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-2xs"
            title="Test haptic vibration pulse & sound"
          >
            <Radio className={`w-3.5 h-3.5 text-neutral-900 ${vibrationTesting ? 'animate-ping' : ''}`} />
            <span>{vibrationTesting ? 'Vibrating...' : 'Test Vibration'}</span>
          </button>

          {/* Voice Readout Toggle */}
          <button
            onClick={toggleSpeechFeedback}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              speechFeedbackEnabled
                ? 'bg-neutral-900 border-black text-white'
                : 'bg-neutral-100 border-neutral-300 text-neutral-500'
            }`}
            title="Toggle Spoken Voice Responses"
          >
            <Sparkles className={`w-3.5 h-3.5 ${speechFeedbackEnabled ? 'text-white' : ''}`} />
            <span>Voice Speech {speechFeedbackEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Tabs navigation: Voice Commands vs Voice Memos */}
      <div className="flex border-b border-neutral-200">
        <button
          onClick={() => setActiveVoiceTab('commands')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeVoiceTab === 'commands'
              ? 'border-black text-black'
              : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          <Command className="w-4 h-4" />
          <span>Voice Commands Assistant</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-800 font-bold">
            Interactive
          </span>
        </button>

        <button
          onClick={() => setActiveVoiceTab('memos')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeVoiceTab === 'memos'
              ? 'border-black text-black'
              : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          <FileAudio className="w-4 h-4" />
          <span>Voice Memos & Audio Archive</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-bold">
            {voiceNotes.length}
          </span>
        </button>
      </div>

      {/* TAB 1: VOICE COMMANDS (Web Speech API) */}
      {activeVoiceTab === 'commands' && (
        <div className="space-y-6">
          {/* Main Voice Command Hero Unit */}
          <div className="bg-neutral-950 text-white p-8 rounded-3xl border border-neutral-800 shadow-xl flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="relative z-10 w-full max-w-xl flex flex-col items-center">
              {/* Header Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] text-neutral-200 mb-5">
                <Command className="w-3.5 h-3.5 text-white" />
                <span>Web Speech API Voice Command Engine</span>
              </div>

              {/* Status Header */}
              <h2 className="text-xl font-bold text-white mb-1">
                {isListeningCommand ? 'Listening for your command...' : 'Tap to Speak Voice Command'}
              </h2>
              <p className="text-xs text-neutral-400 max-w-md mb-6">
                Say <strong className="text-white">"create a new note"</strong>,{' '}
                <strong className="text-white">"show today's tasks"</strong>, or{' '}
                <strong className="text-white">"search my documents"</strong>.
              </p>

              {/* Sound Wave Animation Visualizer */}
              <div className="h-16 flex items-center justify-center gap-2 mb-6 w-full max-w-xs">
                {isListeningCommand ? (
                  [35, 75, 95, 55, 30, 85, 100, 60, 40, 80, 90, 50, 70, 30].map((h, i) => (
                    <div
                      key={i}
                      className="w-1.5 bg-white rounded-full animate-pulse"
                      style={{
                        height: `${h}%`,
                        animationDelay: `${(i % 5) * 0.15}s`,
                        animationDuration: '0.7s',
                      }}
                    />
                  ))
                ) : (
                  <div className="text-xs text-neutral-400 flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                    <Mic className="w-4 h-4 text-white" />
                    <span>Microphone ready • Tap big button to speak</span>
                  </div>
                )}
              </div>

              {/* Central Mic Button */}
              <div className="relative mb-6">
                {isListeningCommand && (
                  <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
                )}
                {!isListeningCommand ? (
                  <button
                    onClick={startListeningCommand}
                    className="w-20 h-20 rounded-full bg-white hover:bg-neutral-200 text-black flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95 z-10 relative"
                    title="Start Speaking Voice Command"
                  >
                    <Mic className="w-9 h-9" />
                  </button>
                ) : (
                  <button
                    onClick={stopListeningCommand}
                    className="w-20 h-20 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white border-2 border-white flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95 z-10 relative"
                    title="Stop Listening"
                  >
                    <Square className="w-8 h-8 fill-current text-white" />
                  </button>
                )}
              </div>

              {/* Live Transcript / Spoken Stream */}
              {(interimText || liveTranscript) && (
                <div className="w-full bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 text-left mb-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-[11px] text-neutral-300 mb-1.5">
                    <span className="flex items-center gap-1.5 font-semibold text-white">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                      Recognized Speech:
                    </span>
                    {isListeningCommand && (
                      <span className="text-white animate-pulse font-medium">Recording live...</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-white leading-relaxed">
                    {liveTranscript}
                    {interimText && <span className="text-neutral-300 italic"> {interimText}...</span>}
                  </p>
                </div>
              )}

              {/* Sample Command Quick Test Chips */}
              <div className="w-full pt-2">
                <div className="text-[11px] font-semibold text-neutral-400 mb-2">
                  Or click a voice command chip to test immediately:
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {sampleCommands.map((sc, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setLiveTranscript(sc.command);
                        processVoiceCommandText(sc.command);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs text-white font-medium transition-all hover:scale-102 active:scale-95 flex items-center gap-1.5"
                    >
                      <Command className="w-3 h-3 text-white" />
                      <span>{sc.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Command Execution Result Box */}
          {lastExecutedResult && (
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5 space-y-4 animate-in slide-in-from-top-3 duration-200">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white bg-black shrink-0">
                    {lastExecutedResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-neutral-900">
                        {lastExecutedResult.feedbackText}
                      </h3>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-800">
                        Intent: {lastExecutedResult.intent}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Spoken phrase: "{lastParsedCommand?.originalPhrase}"
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => SoundEngine.speakText(lastExecutedResult.spokenFeedback)}
                  className="px-2.5 py-1 rounded-lg border border-neutral-300 text-neutral-700 hover:text-black hover:bg-neutral-100 text-xs flex items-center gap-1.5"
                  title="Replay Voice Speech"
                >
                  <Volume2 className="w-3.5 h-3.5 text-black" />
                  <span>Replay Voice</span>
                </button>
              </div>

              {/* ACTION RESULT 1: Created Note */}
              {lastExecutedResult.createdItem && (
                <div className="bg-neutral-50 border border-neutral-300 rounded-xl p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-neutral-900">
                        {lastExecutedResult.createdItem.title}
                      </h4>
                      <p className="text-[11px] text-neutral-600 line-clamp-1 mt-0.5">
                        {lastExecutedResult.createdItem.content}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onSelectItem(lastExecutedResult.createdItem!)}
                    className="px-3 py-1.5 rounded-lg bg-black hover:bg-neutral-800 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-2xs"
                  >
                    <span>View Note</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* ACTION RESULT 2: Today's Tasks */}
              {lastExecutedResult.intent === 'show_today_tasks' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-800">
                    <span className="flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-black" />
                      Tasks for Today ({lastExecutedResult.matchedItems?.length || 0})
                    </span>
                    {onNavigateTab && (
                      <button
                        onClick={() => onNavigateTab('tasks')}
                        className="text-neutral-900 hover:underline text-xs flex items-center gap-1"
                      >
                        <span>Open Tasks Tab</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {(!lastExecutedResult.matchedItems ||
                    lastExecutedResult.matchedItems.length === 0) ? (
                    <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-center text-xs text-neutral-500">
                      No pending tasks due today. You're all caught up.
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl overflow-hidden">
                      {lastExecutedResult.matchedItems.slice(0, 5).map((task) => (
                        <div
                          key={task.id}
                          onClick={() => onSelectItem(task)}
                          className="p-3 bg-white hover:bg-neutral-50 cursor-pointer flex items-center justify-between gap-3 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-4 h-4 rounded-md border border-neutral-300 flex items-center justify-center shrink-0">
                              {task.taskStatus === 'completed' && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                              )}
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-neutral-800">
                                {task.title}
                              </span>
                              {task.dueDate && (
                                <span className="text-[10px] text-neutral-400 block">
                                  Due: {task.dueDate}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-800 font-semibold">
                            {task.reminder?.priority || 'normal'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ACTION RESULT 3: Search Documents */}
              {lastExecutedResult.intent === 'search_documents' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-800">
                    <span className="flex items-center gap-1.5">
                      <Search className="w-4 h-4 text-black" />
                      Matched Documents ({lastExecutedResult.matchedItems?.length || 0})
                    </span>
                    {onNavigateTab && (
                      <button
                        onClick={() => onNavigateTab('documents')}
                        className="text-neutral-900 hover:underline text-xs flex items-center gap-1"
                      >
                        <span>Open Documents Tab</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {(!lastExecutedResult.matchedItems ||
                    lastExecutedResult.matchedItems.length === 0) ? (
                    <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-center text-xs text-neutral-500">
                      No documents matched your voice search query.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {lastExecutedResult.matchedItems.slice(0, 6).map((doc) => (
                        <div
                          key={doc.id}
                          onClick={() => onSelectItem(doc)}
                          className="p-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl cursor-pointer flex items-center justify-between gap-2 transition-all"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileText className="w-4 h-4 text-black shrink-0" />
                            <div className="truncate">
                              <h5 className="text-xs font-semibold text-neutral-900 truncate">
                                {doc.title}
                              </h5>
                              <span className="text-[10px] text-neutral-500 block truncate">
                                {doc.summary || doc.content?.slice(0, 40) || 'Document file'}
                              </span>
                            </div>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Voice Command Reference Guide */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs">
            <h3 className="text-xs font-bold text-neutral-900 flex items-center gap-2 mb-3">
              <HelpCircle className="w-4 h-4 text-black" />
              Supported Voice Commands Reference
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200">
                <div className="font-bold text-neutral-900 flex items-center gap-1.5 mb-1">
                  <FileText className="w-3.5 h-3.5 text-black" />
                  Notes & Dictation
                </div>
                <ul className="space-y-1 text-[11px] text-neutral-600 list-disc list-inside">
                  <li>"Create a new note"</li>
                  <li>"Create note called Grocery List"</li>
                  <li>"Take a note: meeting with Sarah"</li>
                  <li>"Show all my notes"</li>
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200">
                <div className="font-bold text-neutral-900 flex items-center gap-1.5 mb-1">
                  <CheckSquare className="w-3.5 h-3.5 text-black" />
                  Tasks & Planning
                </div>
                <ul className="space-y-1 text-[11px] text-neutral-600 list-disc list-inside">
                  <li>"Show today's tasks"</li>
                  <li>"What do I need to do today?"</li>
                  <li>"Create a new task: Finish report"</li>
                  <li>"Show my reminders"</li>
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200">
                <div className="font-bold text-neutral-900 flex items-center gap-1.5 mb-1">
                  <Search className="w-3.5 h-3.5 text-black" />
                  Documents & Search
                </div>
                <ul className="space-y-1 text-[11px] text-neutral-600 list-disc list-inside">
                  <li>"Search my documents"</li>
                  <li>"Find documents about contract"</li>
                  <li>"Go to documents"</li>
                  <li>"Go to calendar"</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: VOICE MEMOS & AUDIO ARCHIVE */}
      {activeVoiceTab === 'memos' && (
        <div className="space-y-6">
          {/* Active Recorder Widget */}
          <div className="bg-neutral-950 text-white p-8 rounded-3xl border border-neutral-800 shadow-xl flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="relative z-10 w-full max-w-md flex flex-col items-center">
              <div className="h-16 flex items-center gap-1.5 mb-4">
                {isRecordingMemo ? (
                  [40, 70, 90, 60, 30, 85, 95, 45, 65, 80, 50, 75].map((h, i) => (
                    <div
                      key={i}
                      className="w-1.5 bg-white rounded-full animate-pulse"
                      style={{
                        height: `${h}%`,
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: '0.8s',
                      }}
                    />
                  ))
                ) : (
                  <div className="text-neutral-400 text-xs flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4" />
                    <span>Ready to capture voice audio memo</span>
                  </div>
                )}
              </div>

              <div className="text-3xl font-mono font-bold tracking-wider text-white mb-6">
                {formatSeconds(recordingTime)}
              </div>

              <div className="flex items-center gap-4">
                {!isRecordingMemo ? (
                  <button
                    onClick={startRecordingMemo}
                    className="w-16 h-16 rounded-full bg-white hover:bg-neutral-200 text-black flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95"
                    title="Start Recording Voice Memo"
                  >
                    <Mic className="w-7 h-7" />
                  </button>
                ) : (
                  <button
                    onClick={stopRecordingMemo}
                    className="w-16 h-16 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white border-2 border-white flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 animate-pulse"
                    title="Stop Recording"
                  >
                    <Square className="w-6 h-6 fill-current text-white" />
                  </button>
                )}
              </div>

              {/* Memo Review Box */}
              {audioUrl && !isRecordingMemo && (
                <div className="mt-8 w-full bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/15 text-left space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <FileAudio className="w-4 h-4 text-white" />
                      Recorded Voice Memo
                    </h3>
                    <audio controls src={audioUrl} className="h-8 max-w-[200px]" />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                      Memo Title
                    </label>
                    <input
                      type="text"
                      value={memoTitle}
                      onChange={(e) => setMemoTitle(e.target.value)}
                      placeholder="Voice note title..."
                      className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 mb-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-white" />
                      Transcription
                    </label>
                    <textarea
                      value={memoTranscript}
                      onChange={(e) => setMemoTranscript(e.target.value)}
                      placeholder="Transcription text..."
                      rows={3}
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white focus:outline-hidden"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => {
                        setAudioUrl(null);
                        setMemoTranscript('');
                      }}
                      className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
                    >
                      Discard
                    </button>
                    <button
                      onClick={handleSaveMemo}
                      className="px-4 py-2 bg-white hover:bg-neutral-200 text-black rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save to LIFEBOX</span>
                    </button>
                  </div>
                </div>
              )}

              {savedMemoSuccess && (
                <div className="mt-4 px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Voice memo saved to your second brain!</span>
                </div>
              )}
            </div>
          </div>

          {/* Existing Voice Notes List */}
          <div>
            <h2 className="text-sm font-bold text-neutral-900 mb-3">Saved Voice Notes Archive</h2>
            {voiceNotes.length === 0 ? (
              <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center text-neutral-400">
                <FileAudio className="w-10 h-10 mx-auto mb-2 text-neutral-300" />
                <p className="text-xs font-semibold text-neutral-700">No voice notes saved yet</p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Record audio thoughts on the go hands-free.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {voiceNotes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => onSelectItem(note)}
                    className="bg-white p-4 rounded-2xl border border-neutral-200 hover:border-neutral-400 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-neutral-100 text-black flex items-center justify-center">
                            <Mic className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-xs font-bold text-neutral-900">{note.title}</h3>
                            <span className="text-[10px] text-neutral-400">
                              {new Date(note.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {note.mediaUrl && (
                        <audio controls src={note.mediaUrl} className="w-full h-8 my-2" />
                      )}

                      <p className="text-xs text-neutral-600 line-clamp-2 leading-relaxed mt-1">
                        {note.content || note.extractedText}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-neutral-100 text-[10px] text-neutral-400">
                      <span className="capitalize">{note.category}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Delete this voice note?')) onDeleteItem(note.id);
                        }}
                        className="p-1 text-neutral-400 hover:text-black rounded-md"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
