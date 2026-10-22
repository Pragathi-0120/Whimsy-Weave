import { motion } from 'framer-motion';

export default function TypingIndicator({ label = 'AI is thinking...' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-2 py-2"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
        AI
      </div>
      <div className="rounded-2xl rounded-bl-md bg-gray-100 px-4 py-3 dark:bg-white/10">
        <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 animate-pulse-soft rounded-full bg-gray-400 dark:bg-gray-500"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
