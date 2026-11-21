import React, { useMemo, useState } from 'react';
import { Calendar, CheckSquare, FileText, Lock, Mail, Search, X } from 'lucide-react';
import type { AppTab, WorkspaceState } from '../types';

interface SearchModalProps {
  workspace: WorkspaceState;
  onClose: () => void;
  onNavigate: (tab: AppTab) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ workspace, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | 'documents' | 'emails' | 'tasks' | 'events'>('all');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (text: string) => !q || text.toLowerCase().includes(q);

    return {
      documents:
        category === 'all' || category === 'documents'
          ? workspace.documents.filter((d) => match(`${d.title} ${d.content} ${d.category}`))
          : [],
      emails:
        category === 'all' || category === 'emails'
          ? workspace.emails.filter((m) => match(`${m.subject} ${m.body} ${m.from} ${m.to}`))
          : [],
      tasks:
        category === 'all' || category === 'tasks'
          ? workspace.tasks.filter((t) => match(`${t.title} ${t.description} ${t.column}`))
          : [],
      events:
        category === 'all' || category === 'events'
          ? workspace.events.filter((e) => match(`${e.title} ${e.notes} ${e.location}`))
          : [],
    };
  }, [query, category, workspace]);

  const totalCount =
    results.documents.length + results.emails.length + results.tasks.length + results.events.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-12 md:pt-20">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-white/10">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search encrypted documents, emails, meetings, and tasks..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none min-h-[36px]"
          />
          <button
            onClick={onClose}
            aria-label="Close search"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-slate-200 dark:border-white/10 overflow-x-auto">
          {(['all', 'documents', 'emails', 'tasks', 'events'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setCategory(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors whitespace-nowrap shrink-0 ${
                category === tab
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              {tab}
            </button>
          ))}
          <span className="ml-auto text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
            {totalCount} matches
          </span>
        </div>

        <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-200 dark:divide-white/5">
          {totalCount === 0 && (
            <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              No matching records found for "{query}".
            </div>
          )}

          {results.documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => {
                onNavigate('team');
                onClose();
              }}
              className="w-full text-left px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-white/[0.03] flex items-start gap-3 transition-colors"
            >
              <FileText className="w-4 h-4 mt-0.5 text-indigo-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {doc.title}
                  </span>
                  {doc.encrypted && <Lock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">{doc.content}</p>
              </div>
              <span className="text-xs text-slate-400 capitalize shrink-0">{doc.category}</span>
            </button>
          ))}

          {results.events.map((evt) => (
            <button
              key={evt.id}
              onClick={() => {
                onNavigate('calendar');
                onClose();
              }}
              className="w-full text-left px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-white/[0.03] flex items-start gap-3 transition-colors"
            >
              <Calendar className="w-4 h-4 mt-0.5 text-sky-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-slate-900 dark:text-white truncate block">
                  {evt.title}
                </span>
                <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                  {new Date(evt.startIso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {evt.location}
                </p>
              </div>
              <span className="text-xs text-slate-400 capitalize shrink-0">{evt.priority}</span>
            </button>
          ))}

          {results.emails.map((mail) => (
            <button
              key={mail.id}
              onClick={() => {
                onNavigate('inbox');
                onClose();
              }}
              className="w-full text-left px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-white/[0.03] flex items-start gap-3 transition-colors"
            >
              <Mail className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-slate-900 dark:text-white truncate block">
                  {mail.subject}
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {mail.from} · {mail.body}
                </p>
              </div>
              <span className="text-xs text-slate-400 capitalize shrink-0">{mail.folder}</span>
            </button>
          ))}

          {results.tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => {
                onNavigate('projects');
                onClose();
              }}
              className="w-full text-left px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-white/[0.03] flex items-start gap-3 transition-colors"
            >
              <CheckSquare className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-slate-900 dark:text-white truncate block">
                  {task.title}
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{task.description}</p>
              </div>
              <span className="text-xs text-slate-400 capitalize shrink-0">{task.column.replace('_', ' ')}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
