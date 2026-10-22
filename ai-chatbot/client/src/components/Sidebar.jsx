export default function Sidebar({
  chats,
  activeChatId,
  onSelect,
  onNewChat,
  onDelete,
  isOpen,
  onClose
}) {
  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col glass shadow-glass transition-transform duration-300 dark:shadow-glass-dark lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-gray-200/60 p-4 dark:border-white/10">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white">
              W
            </div>
            <span className="font-display text-sm font-semibold">Whimsy AI</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onNewChat}
          className="mx-3 mt-4 flex items-center justify-center gap-2 rounded-xl border border-gray-200/80 bg-white/80 px-4 py-2.5 text-sm font-medium transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
        >
          <span className="text-lg leading-none">+</span>
          New Chat
        </button>

        <div className="mt-4 flex-1 overflow-y-auto px-2 pb-4 scrollbar-thin">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`group mb-1 flex items-center gap-1 rounded-xl px-2 ${
                chat.id === activeChatId ? 'bg-gray-200/70 dark:bg-white/10' : 'hover:bg-gray-100/80 dark:hover:bg-white/5'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  onSelect(chat.id);
                  onClose?.();
                }}
                className="min-w-0 flex-1 truncate px-2 py-2.5 text-left text-sm"
              >
                {chat.title || 'New chat'}
              </button>
              <button
                type="button"
                aria-label="Delete chat"
                onClick={() => onDelete(chat.id)}
                className="rounded-lg px-2 py-1 text-xs text-gray-400 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
              >
                x
              </button>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
