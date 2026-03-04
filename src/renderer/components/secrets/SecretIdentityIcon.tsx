import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Bell,
  Bug,
  Cloud,
  Clock3,
  CreditCard,
  Database,
  Folder,
  Globe,
  HardDrive,
  KeyRound,
  Languages,
  LockKeyhole,
  Mail,
  MapPin,
  Palette,
  Plug,
  Search,
  Server,
  Settings2,
  Shield,
  ToggleLeft,
  User,
  Webhook,
  Workflow,
  Wrench,
} from 'lucide-react';
import { PROVIDER_CATALOG_BY_ID, normalizeProviderCatalogId } from '../../../shared/constants/provider-catalog';
import { inferKnownProviderId } from '../../../shared/constants/provider-inference';
import { ProviderLogo } from '../providers/ProviderLogo';

interface SecretIdentityIconProps {
  providerId?: string | null;
  keyName?: string | null;
  size?: number;
  className?: string;
}

const GENERIC_SECRET_ICON_RULES: Array<{ pattern: RegExp; icon: LucideIcon }> = [
  { pattern: /DATABASE|DB_|DB$|POSTGRES|PG_|MYSQL|MONGO|REDIS|SQLITE|SUPABASE|PLANETSCALE|NEON/i, icon: Database },
  { pattern: /DEBUG|LOG_LEVEL|TRACE|VERBOSE/i, icon: Bug },
  { pattern: /TIMEOUT|TTL|EXPIR|RETRY|INTERVAL|CRON|SCHEDULE|DELAY|BACKOFF/i, icon: Clock3 },
  { pattern: /URL|URI|HOST|DOMAIN|ORIGIN|ENDPOINT|BASE_URL|SITE_URL|APP_URL|PUBLIC_URL|REST_URL|WS_URL/i, icon: Globe },
  { pattern: /PORT|PROXY|GATEWAY|SOCKET|WEBSOCKET|INGRESS|EGRESS/i, icon: Server },
  { pattern: /PRIVATE_KEY|PUBLIC_KEY|API_KEY|ACCESS_KEY|TOKEN|JWT|SIGNING|SECRET/i, icon: KeyRound },
  { pattern: /PASSWORD|PASSWD|PASS|PWD/i, icon: LockKeyhole },
  { pattern: /USER(NAME)?|ACCOUNT|OWNER|ORG|TEAM/i, icon: User },
  { pattern: /EMAIL|MAIL|SMTP/i, icon: Mail },
  { pattern: /WEBHOOK|HOOK/i, icon: Webhook },
  { pattern: /BUCKET|STORAGE|S3|BLOB|UPLOAD|ASSET|FILESYSTEM|FS_/i, icon: HardDrive },
  { pattern: /CACHE/i, icon: HardDrive },
  { pattern: /REGION|ZONE|LOCATION|GEO/i, icon: MapPin },
  { pattern: /THEME|COLOR|PALETTE|BRAND/i, icon: Palette },
  { pattern: /FEATURE|FLAG|ENABLE|DISABLE|ENABLED|DISABLED|TOGGLE/i, icon: ToggleLeft },
  { pattern: /SEARCH|INDEX|QUERY/i, icon: Search },
  { pattern: /PAYMENT|BILLING|STRIPE|PRICE/i, icon: CreditCard },
  { pattern: /METRIC|ANALYTIC|TELEMETRY|TRACING|OTEL|SENTRY|MONITOR/i, icon: Activity },
  { pattern: /QUEUE|BROKER|KAFKA|RABBIT|TOPIC|STREAM|PIPELINE|WORKFLOW/i, icon: Workflow },
  { pattern: /PATH|DIR|DIRECTORY|ROOT|HOME|WORKSPACE/i, icon: Folder },
  { pattern: /LANG|LOCALE|I18N|L10N|TIMEZONE|TZ/i, icon: Languages },
  { pattern: /CLOUD|CDN/i, icon: Cloud },
  { pattern: /PLUGIN|EXTENSION|INTEGRATION|ADAPTER/i, icon: Plug },
  { pattern: /CERT|CERTIFICATE|TLS|SSL|CA_/i, icon: Shield },
  { pattern: /NOTIFY|ALERT|BELL/i, icon: Bell },
  { pattern: /CONFIG|SETTING|OPTION/i, icon: Settings2 },
];

function resolveGenericIcon(source: string): LucideIcon | null {
  for (const rule of GENERIC_SECRET_ICON_RULES) {
    if (rule.pattern.test(source)) {
      return rule.icon;
    }
  }

  return null;
}

export function SecretIdentityIcon({
  providerId,
  keyName,
  size = 20,
  className,
}: SecretIdentityIconProps) {
  const normalizedProviderId = providerId ? normalizeProviderCatalogId(providerId) : null;
  if (normalizedProviderId && PROVIDER_CATALOG_BY_ID[normalizedProviderId]) {
    return <ProviderLogo providerId={normalizedProviderId} size={size} className={className} />;
  }

  const inferredProviderId = inferKnownProviderId(`${providerId ?? ''} ${keyName ?? ''}`);
  if (inferredProviderId) {
    return <ProviderLogo providerId={inferredProviderId} size={size} className={className} />;
  }

  const genericIcon = resolveGenericIcon(`${providerId ?? ''} ${keyName ?? ''}`);
  if (!genericIcon) {
    if (providerId) {
      return <ProviderLogo providerId={providerId} size={size} className={className} />;
    }
    const FallbackIcon = Wrench;
    return <GenericIconBadge icon={FallbackIcon} size={size} className={className} />;
  }

  return <GenericIconBadge icon={genericIcon} size={size} className={className} />;
}

function GenericIconBadge({
  icon: Icon,
  size,
  className,
}: {
  icon: LucideIcon;
  size: number;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.24,
        background: 'color-mix(in oklab, var(--color-secondary) 82%, transparent)',
        border: '1px solid color-mix(in oklab, var(--color-border) 82%, transparent)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon
        style={{
          width: Math.max(12, size * 0.58),
          height: Math.max(12, size * 0.58),
          color: 'var(--color-foreground)',
        }}
      />
    </span>
  );
}
