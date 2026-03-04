import { useUiStore } from '../../store/ui-store';
import {
  PROVIDER_CATALOG_BY_ID,
  normalizeProviderCatalogId,
} from '../../../shared/constants/provider-catalog';

const logoModules = import.meta.glob('../../../assets/logos/*', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

function getAssetPath(fileName: string): string | null {
  return logoModules[`../../../assets/logos/${fileName}`] ?? null;
}

interface ProviderLogoProps {
  providerId: string;
  size?: number;
  className?: string;
}

export function ProviderLogo({ providerId, size = 20, className }: ProviderLogoProps) {
  const { theme } = useUiStore();
  const resolvedProviderId = normalizeProviderCatalogId(providerId);
  const provider = PROVIDER_CATALOG_BY_ID[resolvedProviderId];
  const logo = (
    theme === 'light' && provider?.lightModeLogoFile
      ? getAssetPath(provider.lightModeLogoFile)
      : provider?.logoFile
        ? getAssetPath(provider.logoFile)
        : null
  );

  if (logo) {
    return (
      <img
        src={logo}
        alt={`${providerId} logo`}
        width={size}
        height={size}
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.2,
          objectFit: 'contain',
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.2,
        background: 'oklch(0.45 0.1 260)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: size * 0.4,
        fontWeight: 700,
        color: 'oklch(0.9 0 0)',
        textTransform: 'uppercase',
        lineHeight: 1,
      }}
    >
      {providerId.slice(0, 2)}
    </div>
  );
}
