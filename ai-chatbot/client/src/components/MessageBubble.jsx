import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion } from 'framer-motion';
import { formatTime } from '../utils/storage';

export default function MessageBubble({ message, theme, onCopy, onRegenerate, isLastAssistant }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`group flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          isUser
            ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
            : 'bg-accent text-white'
        }`}
      >
        {isUser ? 'You' : 'AI'}
      </div>

      <div className={`max-w-[85%] sm:max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`rounded-2xl px-4 py-3 shadow-sm ${
            isUser
              ? 'rounded-br-md bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
              : 'rounded-bl-md bg-gray-100 dark:bg-white/10'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-pre:my-2 prose-pre:p-0">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    if (!inline && match) {
                      return (
                        <SyntaxHighlighter
                          style={theme === 'dark' ? oneDark : oneLight}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{ borderRadius: '0.75rem', fontSize: '0.85rem' }}
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      );
                    }
                    return (
                      <code className="rounded bg-black/10 px-1 py-0.5 dark:bg-white/10" {...props}>
                        {children}
                      </code>
                    );
                  }
                }}
              >
                {message.content || '...'}
              </ReactMarkdown>
            </div>
          )}
        </div>

        <div className={`mt-1 flex items-center gap-2 px-1 ${isUser ? 'flex-row-reverse' : ''}`}>
          <span className="text-[11px] text-gray-400">{formatTime(message.createdAt)}</span>
          {!isUser && message.content && (
            <>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] text-gray-400 opacity-0 transition hover:text-accent group-hover:opacity-100"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
              {isLastAssistant && (
                <button
                  type="button"
                  onClick={onRegenerate}
                  className="text-[11px] text-gray-400 opacity-0 transition hover:text-accent group-hover:opacity-100"
                >
                  Regenerate
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
