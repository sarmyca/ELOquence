'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, X } from 'lucide-react';
import { aiApi } from '@/lib/api';
import { springs } from '@/lib/animations';
import clsx from 'clsx';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  gameId: string;
  gameContext: string;
}

const MAX_MESSAGES = 10;

const SUGGESTED_QUESTIONS = [
  'Why was move 2 suboptimal?',
  'What should I look for in endgame?',
  'How can I improve my opening?',
];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block w-1.5 h-1.5 rounded-full bg-text-ghost"
          animate={{ y: [0, -4, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

export default function CoachChat({ gameId, gameContext }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [msgCount, setMsgCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, sending]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen]);

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || sending || msgCount >= MAX_MESSAGES) return;

    setInput('');
    const userMsg: Message = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    setMsgCount((c) => c + 1);

    try {
      const res = await aiApi.coachChat(gameId, trimmed, messages);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.data.response },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "Sorry, I couldn't respond. Please try again.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function fillSuggestion(q: string) {
    setInput(q);
    inputRef.current?.focus();
  }

  const limitReached = msgCount >= MAX_MESSAGES;

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!isOpen ? (
          /* Toggle button */
          <motion.div
            key="toggle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <button
              onClick={() => setIsOpen(true)}
              className="relative flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-tertiary border border-white/[0.08] text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors text-sm font-medium"
            >
              <MessageSquare size={14} />
              Ask Coach
              {messages.length === 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#538d4e] animate-pulse" />
              )}
            </button>
          </motion.div>
        ) : (
          /* Chat panel */
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={springs.slide}
            className="rounded-2xl bg-bg-secondary border border-white/[0.08] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <MessageSquare size={13} className="text-[#6aaa64]" />
                <span className="text-sm font-semibold text-text-primary">Coach Chat</span>
                <span className="text-[10px] font-mono text-text-ghost">
                  {msgCount}/{MAX_MESSAGES}
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-text-ghost hover:text-text-secondary transition-colors"
                aria-label="Close coach chat"
              >
                <X size={14} />
              </button>
            </div>

            {/* Game context pill */}
            {gameContext && (
              <div className="px-4 pt-2">
                <span className="text-[10px] text-text-ghost bg-bg-tertiary border border-white/[0.06] px-2 py-0.5 rounded-full">
                  {gameContext}
                </span>
              </div>
            )}

            {/* Messages area */}
            <div
              ref={scrollRef}
              className="flex flex-col gap-2 overflow-y-auto px-4 py-3 max-h-[300px]"
            >
              {messages.length === 0 && !sending && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-text-ghost mb-1">
                    Ask anything about this game.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => fillSuggestion(q)}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-bg-tertiary hover:bg-bg-elevated border border-white/[0.06] text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={clsx(
                    'flex',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={clsx(
                      'text-sm text-text-primary px-3 py-2 max-w-[85%]',
                      msg.role === 'user'
                        ? 'bg-[#538d4e]/15 rounded-xl rounded-br-sm'
                        : 'bg-bg-tertiary rounded-xl rounded-bl-sm'
                    )}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}

              {sending && (
                <div className="flex justify-start">
                  <div className="bg-bg-tertiary rounded-xl rounded-bl-sm">
                    <TypingIndicator />
                  </div>
                </div>
              )}
            </div>

            {/* Input area */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-white/[0.06]">
              {limitReached ? (
                <p className="flex-1 text-xs text-text-ghost text-center py-1">
                  Message limit reached ({MAX_MESSAGES}/{MAX_MESSAGES})
                </p>
              ) : (
                <>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about this game..."
                    disabled={sending}
                    className="flex-1 bg-bg-tertiary border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-white/[0.16] transition-colors disabled:opacity-50"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || sending}
                    className="p-2 rounded-lg bg-[#538d4e] hover:bg-[#6aaa64] disabled:opacity-40 transition-colors shrink-0"
                    aria-label="Send message"
                  >
                    <Send size={13} className="text-white" />
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
