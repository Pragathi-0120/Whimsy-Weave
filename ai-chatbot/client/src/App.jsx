import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import { useChatApp } from './hooks/useChatApp';

export default function App() {
  const app = useChatApp();

  return (
    <div className="flex h-full min-h-screen bg-surface-light dark:bg-surface-dark">
      <Sidebar
        chats={app.chats}
        activeChatId={app.activeChatId}
        onSelect={app.setActiveChatId}
        onNewChat={app.newChat}
        onDelete={app.deleteChat}
        isOpen={app.sidebarOpen}
        onClose={() => app.setSidebarOpen(false)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-gray-200/60 px-4 py-3 dark:border-white/10 lg:px-6">
          <button
            type="button"
            onClick={() => app.setSidebarOpen(true)}
            className="rounded-lg p-2 text-sm hover:bg-gray-100 dark:hover:bg-white/10 lg:hidden"
            aria-label="Open sidebar"
          >
            Menu
          </button>

          <div className="flex-1 lg:hidden">
            <span className="font-display text-sm font-semibold">Whimsy AI</span>
          </div>

          <button
            type="button"
            onClick={app.toggleTheme}
            aria-label="Toggle theme"
            className="rounded-xl border border-gray-200/80 px-3 py-2 text-sm transition hover:bg-gray-100 dark:border-white/10 dark:hover:bg-white/10"
          >
            {app.theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </header>

        <ChatWindow
          messages={app.activeChat?.messages || []}
          theme={app.theme}
          status={app.status}
          error={app.error}
          onRegenerate={app.regenerateLast}
          onClear={app.clearActiveChat}
        />

        <ChatInput
          value={app.input}
          onChange={app.setInput}
          onSend={() => app.sendMessage()}
          onStop={app.stopGenerating}
          status={app.status}
          suggestedPrompts={!app.activeChat?.messages?.length ? app.suggestedPrompts : []}
          disabled={app.status === 'thinking' || app.status === 'streaming'}
        />
      </main>
    </div>
  );
}
