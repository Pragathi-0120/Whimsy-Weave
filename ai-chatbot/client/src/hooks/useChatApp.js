import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createChat,
  createId,
  deriveTitle,
  loadChats,
  loadTheme,
  saveChats,
  saveTheme
} from '../utils/storage';
import { streamChat } from '../services/chatApi';

const SUGGESTED_PROMPTS = [
  'Suggest a birthday gift under Rs. 500',
  'Track my order WW-20260529-ABC123',
  'Do you take custom crochet orders?',
  'What can I buy for a friend?',
  'How can I contact Whimsy & Weave?'
];

export function useChatApp() {
  const [chats, setChats] = useState(() => loadChats());
  const [activeChatId, setActiveChatId] = useState(() => loadChats()[0]?.id || null);
  const [theme, setTheme] = useState(() => loadTheme());
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('idle'); // idle | thinking | streaming | error
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const abortRef = useRef(null);

  const activeChat = chats.find((c) => c.id === activeChatId) || null;

  useEffect(() => {
    saveChats(chats);
  }, [chats]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!chats.length) {
      const chat = createChat();
      setChats([chat]);
      setActiveChatId(chat.id);
    } else if (!activeChatId) {
      setActiveChatId(chats[0].id);
    }
  }, [chats.length, activeChatId, chats]);

  const updateChat = useCallback((chatId, updater) => {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat;
        const next = typeof updater === 'function' ? updater(chat) : { ...chat, ...updater };
        return { ...next, updatedAt: Date.now() };
      })
    );
  }, []);

  const newChat = useCallback(() => {
    const chat = createChat();
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    setInput('');
    setError('');
    setSidebarOpen(false);
  }, []);

  const deleteChat = useCallback((chatId) => {
    setChats((prev) => {
      const filtered = prev.filter((c) => c.id !== chatId);
      if (filtered.length === 0) {
        const chat = createChat();
        setActiveChatId(chat.id);
        return [chat];
      }
      if (activeChatId === chatId) setActiveChatId(filtered[0].id);
      return filtered;
    });
  }, [activeChatId]);

  const clearActiveChat = useCallback(() => {
    if (!activeChatId) return;
    updateChat(activeChatId, (chat) => ({
      ...chat,
      title: 'New chat',
      messages: []
    }));
    setError('');
  }, [activeChatId, updateChat]);

  const sendMessage = useCallback(async (text, { regenerate = false } = {}) => {
    const content = (text || input).trim();
    if (!content || !activeChatId || status === 'streaming' || status === 'thinking') return;

    setError('');
    setInput('');

    let history = activeChat?.messages || [];

    if (regenerate) {
      const lastUserIndex = history.map((m) => m.role).lastIndexOf('user');
      if (lastUserIndex < 0) return;
      history = history.slice(0, lastUserIndex + 1);
    } else {
      const userMsg = {
        id: createId(),
        role: 'user',
        content,
        createdAt: Date.now()
      };
      history = [...history, userMsg];
    }

    const assistantId = createId();
    const assistantMsg = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: Date.now()
    };

    updateChat(activeChatId, (chat) => ({
      ...chat,
      title: deriveTitle(history),
      messages: [...history, assistantMsg]
    }));

    setStatus('thinking');
    const controller = new AbortController();
    abortRef.current = controller;

    const apiMessages = history.map(({ role, content: c }) => ({ role, content: c }));
    let failed = false;

    try {
      await new Promise((r) => setTimeout(r, 350 + Math.random() * 450));
      setStatus('streaming');

      await streamChat(apiMessages, {
        signal: controller.signal,
        onChunk: (chunk) => {
          updateChat(activeChatId, (chat) => ({
            ...chat,
            messages: chat.messages.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + chunk } : m
            )
          }));
        },
        onDone: () => setStatus('idle'),
        onError: (err) => {
          failed = true;
          setError(err.message);
          setStatus('error');
        }
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        failed = true;
        setError(err.message || 'Something went wrong.');
        setStatus('error');
        updateChat(activeChatId, (chat) => ({
          ...chat,
          messages: chat.messages.filter((m) => m.id !== assistantId)
        }));
      }
    } finally {
      abortRef.current = null;
      if (!failed) setStatus('idle');
    }
  }, [activeChat, activeChatId, input, status, updateChat]);

  const regenerateLast = useCallback(() => {
    const lastUser = [...(activeChat?.messages || [])].reverse().find((m) => m.role === 'user');
    if (lastUser) sendMessage(lastUser.content, { regenerate: true });
  }, [activeChat, sendMessage]);

  const stopGenerating = useCallback(() => {
    abortRef.current?.abort();
    setStatus('idle');
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return {
    chats,
    activeChat,
    activeChatId,
    setActiveChatId,
    theme,
    toggleTheme,
    input,
    setInput,
    status,
    error,
    sidebarOpen,
    setSidebarOpen,
    newChat,
    deleteChat,
    clearActiveChat,
    sendMessage,
    regenerateLast,
    stopGenerating,
    suggestedPrompts: SUGGESTED_PROMPTS
  };
}
