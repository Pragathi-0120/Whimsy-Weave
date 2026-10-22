import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export default function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  status,
  suggestedPrompts,
  disabled
}) {
  const textareaRef = useRef(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onChange(value ? `${value} ${transcript}` : transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
  }, [onChange, value]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const toggleVoice = () => {
    const rec = recognitionRef.current;
    if (!rec) {
      alert('Voice input is not supported in this browser.');
      return;
    }
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      rec.start();
      setListening(true);
    }
  };

  const isBusy = status === 'thinking' || status === 'streaming';

  return (
    <div className="border-t border-gray-200/60 bg-white/60 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-black/20 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {suggestedPrompts?.length > 0 && !value && (
          <div className="mb-3 flex flex-wrap gap-2">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onChange(prompt)}
                className="rounded-full border border-gray-200/80 bg-white/80 px-3 py-1.5 text-xs text-gray-600 transition hover:border-accent/40 hover:text-accent dark:border-white/10 dark:bg-white/5 dark:text-gray-300"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        <motion.div layout className="relative flex items-end gap-2 rounded-2xl border border-gray-200/80 bg-white/90 p-2 shadow-glass dark:border-white/10 dark:bg-panel-dark/90 dark:shadow-glass-dark">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about products, gifts, tracking, or custom orders..."
            disabled={disabled}
            className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-gray-400 disabled:opacity-50"
          />

          <button
            type="button"
            onClick={toggleVoice}
            aria-label="Voice input"
            className={`flex h-10 w-12 shrink-0 items-center justify-center rounded-xl text-xs font-medium transition ${
              listening ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100 dark:hover:bg-white/10'
            }`}
          >
            Mic
          </button>

          {isBusy ? (
            <button
              type="button"
              onClick={onStop}
              className="flex h-10 shrink-0 items-center justify-center rounded-xl bg-gray-800 px-4 text-sm font-medium text-white dark:bg-gray-200 dark:text-gray-900"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!value.trim() || disabled}
              className="flex h-10 shrink-0 items-center justify-center rounded-xl bg-accent px-4 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          )}
        </motion.div>

        <p className="mt-2 text-center text-[11px] text-gray-400">
          Enter to send | Shift+Enter for new line | Works in demo mode even if the AI server is offline
        </p>
      </div>
    </div>
  );
}
