import React, { useMemo, useState } from 'react';
import { Check, Lock, Mail, Send, Sparkles, X } from 'lucide-react';
import type { EmailMessage } from '../types';

interface EmailViewProps {
  emails: EmailMessage[];
  canSendEmail: boolean;
  onSendEmail: (draft: {
    to: string;
    subject: string;
    body: string;
    priority: 'urgent' | 'normal';
  }) => Promise<void>;
  onMarkRead: (id: string) => void;
  onDraftWithVoice: (prompt: string) => void;
}

export const EmailView: React.FC<EmailViewProps> = ({
  emails,
  canSendEmail,
  onSendEmail,
  onMarkRead,
  onDraftWithVoice,
}) => {
  const [filter, setFilter] = useState<'all' | 'urgent' | 'sent'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(emails[0]?.id ?? null);
  const [composing, setComposing] = useState(false);
  const [confirmingSend, setConfirmingSend] = useState(false);
  const [sending, setSending] = useState(false);

  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'urgent' | 'normal'>('normal');

  const filtered = useMemo(() => {
    return emails.filter((m) => {
      if (filter === 'urgent') return m.priority === 'urgent';
      if (filter === 'sent') return m.folder === 'sent';
      return true;
    });
  }, [emails, filter]);

  const selectedEmail = useMemo(
    () => emails.find((m) => m.id === selectedId) ?? filtered[0] ?? null,
    [emails, selectedId, filtered]
  );

  const handleOpenCompose = (replyTo?: EmailMessage) => {
    if (!canSendEmail) return;
    if (replyTo) {
      setTo(replyTo.from);
      setSubject(replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`);
      setBody(`\n\n--- On ${new Date(replyTo.timestampIso).toLocaleString()} ${replyTo.from} wrote ---\n${replyTo.body}`);
      setPriority(replyTo.priority);
    } else {
      setTo('');
      setSubject('');
      setBody('');
      setPriority('normal');
    }
    setComposing(true);
    setConfirmingSend(false);
  };

  const executeConfirmedSend = async () => {
    setSending(true);
    try {
      await onSendEmail({ to: to.trim(), subject: subject.trim(), body: body.trim(), priority });
      setConfirmingSend(false);
      setComposing(false);
      setFilter('sent');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Encrypted Mail &amp; Urgent Triage
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Priority inbox filtering with SHA-256 payload verification and confirmation-gated dispatch
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B]">
            {(['all', 'urgent', 'sent'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors whitespace-nowrap shrink-0 ${
                  filter === tab
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          {canSendEmail && (
            <button
              onClick={() => handleOpenCompose()}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 text-xs font-medium text-white whitespace-nowrap shrink-0"
            >
              <Mail className="w-4 h-4" />
              Compose
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Thread List */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] overflow-hidden divide-y divide-slate-200 dark:divide-white/5">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No messages in this view.
            </div>
          ) : (
            filtered.map((mail) => {
              const active = selectedEmail?.id === mail.id;
              return (
                <button
                  key={mail.id}
                  onClick={() => {
                    setSelectedId(mail.id);
                    if (mail.unread) onMarkRead(mail.id);
                  }}
                  className={`w-full text-left p-4 transition-colors ${
                    active
                      ? 'bg-indigo-500/10'
                      : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs truncate ${
                        mail.unread
                          ? 'font-semibold text-slate-900 dark:text-white'
                          : 'font-medium text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {mail.folder === 'sent' ? `To: ${mail.to}` : mail.from}
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                      {new Date(mail.timestampIso).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`text-sm truncate ${
                        mail.unread
                          ? 'font-semibold text-slate-900 dark:text-white'
                          : 'font-medium text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {mail.subject}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    {mail.priority === 'urgent' && (
                      <span className="text-rose-500 font-medium shrink-0">Urgent ·</span>
                    )}
                    <span className="truncate">{mail.body}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Message Reader */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] p-6">
          {selectedEmail ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {selectedEmail.subject}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>From {selectedEmail.from}</span>
                    <span aria-hidden="true">·</span>
                    <span>To {selectedEmail.to}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {new Date(selectedEmail.timestampIso).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-600 dark:text-emerald-400">
                  <Lock className="w-3.5 h-3.5" />
                  <span>{selectedEmail.encryptedDigest}</span>
                </div>
              </div>

              <div className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap min-h-[140px]">
                {selectedEmail.body}
              </div>

              {canSendEmail && (
                <div className="pt-4 border-t border-slate-200 dark:border-white/10 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => handleOpenCompose(selectedEmail)}
                    className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 text-xs font-medium text-white"
                  >
                    <Send className="w-4 h-4" />
                    Reply
                  </button>
                  <button
                    onClick={() =>
                      onDraftWithVoice(
                        `Draft a concise professional reply to ${selectedEmail.from} regarding "${selectedEmail.subject}"`
                      )
                    }
                    className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 px-4 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
                  >
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    Draft AI Reply
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Select a message to inspect its encrypted payload.
            </div>
          )}
        </div>
      </div>

      {/* Compose & Confirmation Modal */}
      {composing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {confirmingSend ? 'Confirm Email Dispatch' : 'Compose Encrypted Email'}
              </h3>
              <button
                onClick={() => {
                  setComposing(false);
                  setConfirmingSend(false);
                }}
                aria-label="Close composer"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!confirmingSend ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setConfirmingSend(true);
                }}
                className="space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    required
                    type="email"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="Recipient email"
                    className="sm:col-span-2 min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0A0C10] px-3.5 text-sm text-slate-900 dark:text-white"
                  />
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as 'urgent' | 'normal')}
                    className="min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0A0C10] px-3 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <input
                  required
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject"
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0A0C10] px-3.5 text-sm text-slate-900 dark:text-white"
                />
                <textarea
                  required
                  rows={5}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your message..."
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0A0C10] p-3.5 text-sm text-slate-900 dark:text-white"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setComposing(false)}
                    className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-600 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="min-h-[44px] px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
                  >
                    Review &amp; Send
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs space-y-1.5 text-slate-700 dark:text-slate-200">
                  <div>
                    <span className="text-slate-400">Recipient:</span> {to}
                  </div>
                  <div>
                    <span className="text-slate-400">Subject:</span> {subject}
                  </div>
                  <div>
                    <span className="text-slate-400">Priority:</span> {priority}
                  </div>
                  <p className="pt-2 border-t border-amber-500/20 whitespace-pre-wrap">{body}</p>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setConfirmingSend(false)}
                    className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-600 dark:text-slate-300"
                  >
                    Back to Edit
                  </button>
                  <button
                    onClick={executeConfirmedSend}
                    disabled={sending}
                    className="min-h-[44px] px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium inline-flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    {sending ? 'Dispatching...' : 'Confirm & Send Now'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
