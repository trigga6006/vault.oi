import { Notification } from 'electron';
import { alertRepo } from '../database/repositories/alert.repo';
import { metricsService } from './metrics-service';

export class AlertService {
  private evaluationTimer: ReturnType<typeof setInterval> | null = null;

  start(intervalMs = 60000): void {
    if (this.evaluationTimer) return;
    this.evaluationTimer = setInterval(() => {
      this.evaluateRules().catch((err) => {
        console.error('[AlertService] Evaluation error:', err);
      });
    }, intervalMs);
    console.log('[AlertService] Started alert evaluation');
  }

  stop(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = null;
    }
  }

  async evaluateRules(): Promise<void> {
    const rules = await alertRepo.getEnabledRules();
    const now = new Date();

    for (const rule of rules) {
      // Check cooldown
      if (rule.lastTriggeredAt) {
        const lastTriggered = new Date(rule.lastTriggeredAt);
        const cooldownMs = rule.cooldownMinutes * 60 * 1000;
        if (now.getTime() - lastTriggered.getTime() < cooldownMs) continue;
      }

      const windowStart = new Date(now.getTime() - rule.windowMinutes * 60 * 1000);
      const summary = await metricsService.getSummary(
        windowStart.toISOString(),
        now.toISOString(),
        rule.providerId ?? undefined,
      );

      let metricValue: number;
      switch (rule.metric) {
        case 'cost_total':
          metricValue = summary.totalCostUsd;
          break;
        case 'error_rate':
          metricValue = summary.errorRate;
          break;
        case 'latency_p95':
          metricValue = summary.p95LatencyMs ?? 0;
          break;
        case 'token_usage':
          metricValue = summary.totalInputTokens + summary.totalOutputTokens;
          break;
        case 'rate_limit_hits':
          metricValue = 0; // Would need dedicated tracking
          break;
        default:
          continue;
      }

      let triggered = false;
      switch (rule.condition) {
        case 'gt':
          triggered = metricValue > rule.threshold;
          break;
        case 'lt':
          triggered = metricValue < rule.threshold;
          break;
        case 'gte':
          triggered = metricValue >= rule.threshold;
          break;
      }

      if (triggered) {
        const message = `Alert "${rule.name}": ${rule.metric} is ${metricValue.toFixed(2)} (threshold: ${rule.threshold})`;

        await alertRepo.insertEvent({
          alertRuleId: rule.id,
          triggeredAt: now.toISOString(),
          metricValue,
          threshold: rule.threshold,
          message,
          acknowledged: false,
        });

        await alertRepo.updateLastTriggered(rule.id, now.toISOString());

        // Send native notification
        if (Notification.isSupported()) {
          new Notification({
            title: 'OmniView Alert',
            body: message,
          }).show();
        }

        console.log(`[AlertService] Triggered: ${message}`);
      }
    }
  }
}

export const alertService = new AlertService();
