import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface OfflineIndicatorProps {
  pendingCount: number;
  onSyncNow?: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ pendingCount, onSyncNow }) => {
  const isOnline = useOnlineStatus();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-5 left-4 z-40 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/15 backdrop-blur-md px-3.5 py-2 text-xs font-medium text-amber-800 dark:text-amber-200">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>
        {!isOnline
          ? `Offline Mode · ${pendingCount} queued change${pendingCount === 1 ? '' : 's'}`
          : `Syncing ${pendingCount} offline change${pendingCount === 1 ? '' : 's'}`}
      </span>
      {isOnline && onSyncNow && (
        <button
          onClick={onSyncNow}
          className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-1 text-xs font-semibold hover:bg-amber-500/30"
        >
          <RefreshCw className="w-3 h-3" />
          Sync
        </button>
      )}
    </div>
  );
};
