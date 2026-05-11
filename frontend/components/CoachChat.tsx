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
          className="block w-1.5 h-1.5 rounded-full bg-text-secondary"
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
    <div className="w-full h-full">
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
              className="relative flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-elevated border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-muted transition-colors text-sm font-medium"
            >
              <MessageSquare size={14} />
              Ask Coach
              {messages.length === 0 && (
                <span
                  className="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: 'var(--tile-correct)' }}
                />
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
            className="rounded-2xl bg-bg-base border border-border-subtle overflow-hidden flex flex-col h-full"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <MessageSquare size={13} style={{ color: 'var(--tile-correct)' }} />
                <span className="text-sm font-semibold text-text-primary">Coach Chat</span>
                <span className="text-[10px] font-mono text-text-secondary">
                  {msgCount}/{MAX_MESSAGES}
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-text-secondary hover:text-text-primary transition-colors"
                aria-label="Close coach chat"
              >
                <X size={14} />
              </button>
            </div>

            {/* Game context pill */}
            {gameContext && (
              <div className="px-4 pt-2">
                <span className="text-[10px] text-text-secondary bg-bg-elevated border border-border-subtle px-2 py-0.5 rounded-full">
                  {gameContext}
                </span>
              </div>
            )}

            {/* Messages area */}
            <div
              ref={scrollRef}
              className="flex flex-col gap-2 overflow-y-auto px-4 py-3 flex-1 min-h-0"
            >
              {messages.length === 0 && !sending && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-text-secondary mb-1">
                    Ask anything about this game.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => fillSuggestion(q)}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-bg-elevated hover:bg-bg-muted border border-border-subtle text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
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
                  {msg.role === 'user' ? (
                    <div className="text-sm text-text-primary px-4 py-2.5 max-w-[85%] rounded-2xl rounded-br-sm bg-bg-elevated border border-border-default">
                      {msg.content}
                    </div>
                  ) : (
                    <div
                      className="text-sm text-text-primary px-4 py-2.5 max-w-[85%] rounded-2xl rounded-bl-sm border"
                      style={{
                        background: 'rgb(from var(--tile-correct) r g b / 0.10)',
                        borderColor: 'rgb(from var(--tile-correct) r g b / 0.30)',
                      }}
                    >
                      {msg.content}
                    </div>
                  )}
                </motion.div>
              ))}

              {sending && (
                <div className="flex justify-start">
                  <div
                    className="rounded-2xl rounded-bl-sm border"
                    style={{
                      background: 'rgb(from var(--tile-correct) r g b / 0.10)',
                      borderColor: 'rgb(from var(--tile-correct) r g b / 0.30)',
                    }}
                  >
                    <TypingIndicator />
                  </div>
                </div>
              )}
            </div>

            {/* Input area */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-border-subtle">
              {limitReached ? (
                <p className="flex-1 text-xs text-text-secondary text-center py-1">
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
                    className="flex-1 bg-bg-elevated border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-border-strong transition-colors disabled:opacity-50"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || sending}
                    className="p-2 rounded-lg disabled:opacity-40 transition-colors shrink-0"
                    style={{ backgroundColor: 'var(--tile-correct)' }}
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
