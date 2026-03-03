import { motion } from 'framer-motion';
import { Key, RotateCcw, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { cn } from '../ui/cn';
import { ProviderLogo } from '../providers/ProviderLogo';
import type { ApiKeyMetadata } from '../../../shared/types/vault.types';

interface KeyCardProps {
  keyData: ApiKeyMetadata;
  providerName: string;
  onRotate: (id: number) => void;
  onDelete: (id: number) => void;
  onToggleActive: (id: number, isActive: boolean) => void;
}

export function KeyCard({ keyData, providerName, onRotate, onDelete, onToggleActive }: KeyCardProps) {
  const age = keyData.createdAt
    ? formatAge(new Date(keyData.createdAt))
    : 'Unknown';

  const lastUsed = keyData.lastUsedAt
    ? formatAge(new Date(keyData.lastUsedAt)) + ' ago'
    : 'Never';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'glass rounded-[24px] border border-white/8 p-4 space-y-3',
        !keyData.isActive && 'opacity-60',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ProviderLogo providerId={keyData.providerId} size={20} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {keyData.keyLabel}
              </span>
              {!keyData.isActive && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  Inactive
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">{providerName}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggleActive(keyData.id, !keyData.isActive)}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title={keyData.isActive ? 'Deactivate' : 'Activate'}
          >
            {keyData.isActive ? (
              <ToggleRight className="h-4 w-4 text-green-500" />
            ) : (
              <ToggleLeft className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => onRotate(keyData.id)}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Rotate secret"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(keyData.id)}
            className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete key"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <Key className="h-3 w-3" />
          <code className="font-mono">{keyData.keyPrefix ?? '****'}...****</code>
        </div>
        <span>|</span>
        <span>Added {age} ago</span>
        <span>|</span>
        <span>Last used: {lastUsed}</span>
      </div>

      {keyData.notes && (
        <p className="text-[11px] text-muted-foreground/70 truncate">
          {keyData.notes}
        </p>
      )}
    </motion.div>
  );
}

function formatAge(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}
