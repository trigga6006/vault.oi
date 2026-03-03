import claudeLogo from '../../../assets/logos/claude-color.png';
import openaiLogo from '../../../assets/logos/openai.png';
import fireworksLogo from '../../../assets/logos/fireworks-color.png';
import geminiLogo from '../../../assets/logos/gemini-color.png';
import perplexityLogo from '../../../assets/logos/perplexity-color.png';
import grokLogo from '../../../assets/logos/grok.png';
import ollamaLogo from '../../../assets/logos/ollama.png';
import mistralLogo from '../../../assets/logos/mistral-color.png';
import deepseekLogo from '../../../assets/logos/deepseek-color.png';
import qwenLogo from '../../../assets/logos/qwen-color.png';
import huggingfaceLogo from '../../../assets/logos/huggingface-color.png';
import copilotLogo from '../../../assets/logos/copilot-color.png';
import bytedanceLogo from '../../../assets/logos/bytedance-color.png';
import midjourneyLogo from '../../../assets/logos/midjourney.png';
import cohereLogo from '../../../assets/logos/cohere-color.png';
import cursorLogo from '../../../assets/logos/cursor.png';

export const PROVIDER_LOGOS: Record<string, string> = {
  anthropic: claudeLogo,
  openai: openaiLogo,
  fireworks: fireworksLogo,
  google: geminiLogo,
  perplexity: perplexityLogo,
  xai: grokLogo,
  ollama: ollamaLogo,
  mistral: mistralLogo,
  deepseek: deepseekLogo,
  qwen: qwenLogo,
  huggingface: huggingfaceLogo,
  copilot: copilotLogo,
  bytedance: bytedanceLogo,
  midjourney: midjourneyLogo,
  cohere: cohereLogo,
  cursor: cursorLogo,
};

interface ProviderLogoProps {
  providerId: string;
  size?: number;
  className?: string;
}

export function ProviderLogo({ providerId, size = 20, className }: ProviderLogoProps) {
  const logo = PROVIDER_LOGOS[providerId];

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

  // Fallback: colored avatar with first 2 letters
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
