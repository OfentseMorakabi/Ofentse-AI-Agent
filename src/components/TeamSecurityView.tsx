import React, { useState } from 'react';
import {
  Check,
  CloudUpload,
  Download,
  FileSpreadsheet,
  FileText,
  Fingerprint,
  Lock,
  RotateCcw,
  Shield,
  Users,
} from 'lucide-react';
import type {
  EncryptedBackupRecord,
  TeamMember,
  TeamPermissions,
  UserTier,
  WorkspaceState,
} from '../types';
import { decryptPayload, encryptPayload } from '../lib/crypto';
import { exportWorkspaceCsv, exportWorkspacePdf } from '../lib/exportUtils';

interface TeamSecurityViewProps {
  workspace: WorkspaceState;
  backups: EncryptedBackupRecord[];
  userTier: UserTier;
  deviceId: string;
  onTierChange: (tier: UserTier) => void;
  onUpdateMemberPermissions: (
    memberId: string,
    role: TeamMember['role'],
    permissions: TeamPermissions
  ) => Promise<void>;
  onBackupCreated: (record: EncryptedBackupRecord, allBackups: EncryptedBackupRecord[]) => void;
  onRestoreWorkspace: (restored: WorkspaceState) => Promise<void>;
  onOpenBiometricConfig: () => void;
}

export const TeamSecurityView: React.FC<TeamSecurityViewProps> = ({
  workspace,
  backups,
  userTier,
  deviceId,
  onTierChange,
  onUpdateMemberPermissions,
  onBackupCreated,
  onRestoreWorkspace,
  onOpenBiometricConfig,
}) => {
  const [passphrase, setPassphrase] = useState('aether-vault-2026');
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentMember = workspace.team[0];
  const canExport = currentMember?.permissions.canExportData ?? true;
  const canBackup = currentMember?.permissions.canManageBackups ?? true;

  const handleCreateEncryptedBackup = async () => {
    if (!passphrase.trim()) {
      setErrorMsg('Enter an encryption passphrase before creating a cloud backup.');
      return;
    }
    setBackupBusy(true);
    setErrorMsg(null);
    setFeedback(null);

    try {
      const sealed = await encryptPayload(workspace, passphrase);
      const itemCount =
        workspace.events.length +
        workspace.emails.length +
        workspace.tasks.length +
        workspace.documents.length +
        workspace.reminders.length;

      const res = await fetch('/api/backup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceName: `Web Client (${deviceId})`,
          itemCount,
          sizeBytes: sealed.sizeBytes,
          checksumSha256: sealed.checksumSha256,
          ivBase64: sealed.ivBase64,
          saltBase64: sealed.saltBase64,
          ciphertextBase64: sealed.ciphertextBase64,
        }),
      });
      const data = (await res.json()) as {
        backup?: EncryptedBackupRecord;
        backups?: EncryptedBackupRecord[];
        error?: string;
      };
      if (!res.ok || !data.backup) {
        throw new Error(data.error || 'Backup upload failed.');
      }
      onBackupCreated(data.backup, data.backups || [data.backup, ...backups]);
      setFeedback(`AES-256-GCM snapshot sealed (${data.backup.checksumSha256.slice(0, 14)}).`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Backup encryption failed.');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleRestoreBackup = async (record: EncryptedBackupRecord) => {
    setRestoreId(record.id);
    setErrorMsg(null);
    setFeedback(null);
    try {
      const decrypted = await decryptPayload<WorkspaceState>(
        record.ciphertextBase64,
        record.ivBase64,
        record.saltBase64,
        passphrase
      );
      await onRestoreWorkspace(decrypted);
      setFeedback(`Restored ${record.itemCount} encrypted items from snapshot.`);
    } catch {
      setErrorMsg('Decryption failed. Verify your encryption passphrase matches the snapshot.');
    } finally {
      setRestoreId(null);
    }
  };

  const handleDownloadBackupFile = (record: EncryptedBackupRecord) => {
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aether-backup-${record.id}.aether.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Team Collaboration, Permissions &amp; Cloud Vault
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Granular access control, AES-256-GCM cloud backups, biometric lock, and PDF/CSV exports
          </p>
        </div>

        {/* Free vs Pro Tier Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B]">
          <button
            onClick={() => onTierChange('free')}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              userTier === 'free'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Free Tier (Core Voice + Offline)
          </button>
          <button
            onClick={() => onTierChange('pro')}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              userTier === 'pro'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Pro Workspace (Team + Vault)
          </button>
        </div>
      </div>

      {/* Security, Biometrics & Exports Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <Fingerprint className="w-5 h-5 text-indigo-500" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Biometric &amp; Passkey Vault
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Protect mobile and desktop sessions with Touch ID / Face ID WebAuthn passkeys and an offline PIN fallback.
          </p>
          <button
            onClick={onOpenBiometricConfig}
            className="w-full min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
          >
            Configure Biometrics &amp; PIN
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-sky-500" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Executive Reports (PDF &amp; CSV)
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Export synced calendars, tasks, and encrypted document audits locally with zero server exposure.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={!canExport}
              onClick={() => exportWorkspacePdf(workspace)}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-40"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
            <button
              disabled={!canExport}
              onClick={() => exportWorkspaceCsv(workspace)}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-40"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-emerald-500" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Plan Capabilities ({userTier === 'free' ? 'Free User' : 'Pro Team'})
            </h2>
          </div>
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              Siri-like voice commands, reminders &amp; offline access
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              Calendar conflict checks &amp; drag-and-drop tasks
            </li>
            <li className="flex items-center gap-2">
              <Check
                className={`w-3.5 h-3.5 shrink-0 ${
                  userTier === 'pro' ? 'text-emerald-500' : 'text-slate-400'
                }`}
              />
              {userTier === 'pro'
                ? 'Active: Encrypted cloud backups & team RBAC'
                : 'Upgrade to Pro for team RBAC & cloud snapshots'}
            </li>
          </ul>
        </div>
      </div>

      {/* Granular Team Permissions Matrix */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Team Access &amp; Granular Permissions
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {userTier === 'free' ? 'Previewing RBAC (Pro to edit)' : 'Real-time SSE synced'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-3 px-5 font-medium">Member</th>
                <th className="py-3 px-4 font-medium">Role</th>
                <th className="py-3 px-4 font-medium text-center">Calendar</th>
                <th className="py-3 px-4 font-medium text-center">Email</th>
                <th className="py-3 px-4 font-medium text-center">Tasks</th>
                <th className="py-3 px-4 font-medium text-center">Exports</th>
                <th className="py-3 px-4 font-medium text-center">Backups</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {workspace.team.map((member) => {
                const permKeys: Array<keyof TeamPermissions> = [
                  'canEditCalendar',
                  'canSendEmail',
                  'canManageTasks',
                  'canExportData',
                  'canManageBackups',
                ];
                return (
                  <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <img
                          src={member.avatar}
                          alt={member.name}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-white/10"
                        />
                        <div>
                          <div className="font-medium text-slate-900 dark:text-white">{member.name}</div>
                          <div className="text-slate-500 dark:text-slate-400">
                            {member.email} · {member.status}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        disabled={userTier === 'free'}
                        value={member.role}
                        onChange={(e) =>
                          onUpdateMemberPermissions(
                            member.id,
                            e.target.value as TeamMember['role'],
                            member.permissions
                          )
                        }
                        className="min-h-[36px] rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0A0C10] px-2.5 text-xs capitalize text-slate-800 dark:text-slate-200 disabled:opacity-50"
                      >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </td>
                    {permKeys.map((key) => (
                      <td key={key} className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          disabled={userTier === 'free'}
                          checked={member.permissions[key]}
                          onChange={(e) =>
                            onUpdateMemberPermissions(member.id, member.role, {
                              ...member.permissions,
                              [key]: e.target.checked,
                            })
                          }
                          aria-label={`${member.name} ${key}`}
                          className="w-4 h-4 accent-indigo-600 rounded cursor-pointer disabled:opacity-40"
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Encrypted Cloud Backup Vault */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11141B] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Encrypted Cloud Backup (AES-256-GCM)
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Client-side PBKDF2-SHA256 encryption before upload
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Vault encryption passphrase"
            className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0A0C10] px-3.5 text-sm font-mono text-slate-900 dark:text-white"
          />
          <button
            disabled={backupBusy || !canBackup || userTier === 'free'}
            onClick={handleCreateEncryptedBackup}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-5 text-xs font-medium text-white whitespace-nowrap shrink-0"
          >
            <CloudUpload className="w-4 h-4" />
            {backupBusy ? 'Encrypting & Uploading...' : 'Create Encrypted Snapshot'}
          </button>
        </div>

        {feedback && <p className="text-xs text-emerald-600 dark:text-emerald-400">{feedback}</p>}
        {errorMsg && <p className="text-xs text-rose-600 dark:text-rose-400">{errorMsg}</p>}

        {backups.length > 0 && (
          <div className="divide-y divide-slate-200 dark:divide-white/5 border-t border-slate-200 dark:border-white/10 pt-2">
            {backups.map((bkp) => (
              <div key={bkp.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">
                    {bkp.deviceName} · {bkp.itemCount} items
                  </div>
                  <div className="font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                    {new Date(bkp.createdAtIso).toLocaleString()} · {(bkp.sizeBytes / 1024).toFixed(1)} KB · sha256:
                    {bkp.checksumSha256.slice(0, 12)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadBackupFile(bkp)}
                    className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                  >
                    Download .aether
                  </button>
                  <button
                    disabled={restoreId === bkp.id || userTier === 'free'}
                    onClick={() => handleRestoreBackup(bkp)}
                    className="min-h-[36px] px-3 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium inline-flex items-center gap-1.5 disabled:opacity-40"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {restoreId === bkp.id ? 'Decrypting...' : 'Restore'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
