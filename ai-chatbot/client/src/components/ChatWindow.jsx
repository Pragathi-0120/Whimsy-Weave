import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

export default function ChatWindow({
  messages,
  theme,
  status,
  error,
  onRegenerate,
  onClear
}) {
  const bottomRef = useRef(null);
  const isThinking = status === 'thinking';
  const isStreaming = status === 'streaming';
  const showTyping = isThinking || isStreaming;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const lastAssistantIdx = [...messages].reverse().findIndex((m) => m.role === 'assistant');
  const lastAssistantId = lastAssistantIdx >= 0 ? messages[messages.length - 1 - lastAssistantIdx]?.id : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-gray-200/60 px-4 py-3 dark:border-white/10 lg:px-6">
        <div>
          <h1 className="font-display text-base font-semibold sm:text-lg">Whimsy Shop Assistant</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {showTyping
              ? isStreaming
                ? 'Assistant is responding...'
                : 'Assistant is checking the best answer...'
              : 'Ask about products, gifts, orders, custom crochet, and contact details'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg px-3 py-1.5 text-xs text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-white/10 dark:hover:text-gray-200"
        >
          Clear chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin lg:px-8">
        {!messages.length && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-xl text-center"
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-xl font-semibold text-accent">
              W
            </div>
            <h2 className="font-display text-2xl font-semibold">How can I help with Whimsy & Weave?</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Ask for crochet gift suggestions, product categories, prices, custom orders, tracking, or support.
            </p>
          </motion.div>
        )}

        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                theme={theme}
                onRegenerate={onRegenerate}
                isLastAssistant={message.id === lastAssistantId && !isStreaming}
              />
            ))}
          </AnimatePresence>

          {showTyping && <TypingIndicator label={isStreaming ? 'Assistant is responding...' : 'Assistant is checking...'} />}
        </div>
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="mx-4 mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
