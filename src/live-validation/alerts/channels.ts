// EPIC 35.9 — Alert Engine (channels)
// Delivery adapters for email / Discord / Slack / generic webhook.
// Channels are best-effort: a delivery failure never blocks recording the
// alert in the immutable alert_history collection.

import type { AlertChannelKind, AlertRecord } from '../types';

export interface AlertChannel {
  kind: AlertChannelKind;
  send(alert: AlertRecord): Promise<void>;
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number }>;

const defaultFetch: FetchLike = (url, init) => fetch(url, init);

function formatText(alert: AlertRecord): string {
  const lines = [
    `[${alert.severity.toUpperCase()}] ${alert.title}`,
    alert.message,
  ];
  if (alert.metric !== null) {
    lines.push(`metric=${alert.metric} value=${alert.value} threshold=${alert.threshold}`);
  }
  lines.push(`rule=${alert.rule} firedAt=${alert.firedAt}`);
  return lines.join('\n');
}

/** Generic JSON webhook (also the transport used by chaos/replay tests). */
export class WebhookChannel implements AlertChannel {
  readonly kind: AlertChannelKind = 'webhook';
  constructor(private url: string, private fetchImpl: FetchLike = defaultFetch) {}

  async send(alert: AlertRecord): Promise<void> {
    const res = await this.fetchImpl(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert),
    });
    if (!res.ok) throw new Error(`webhook delivery failed: HTTP ${res.status}`);
  }
}

export class DiscordChannel implements AlertChannel {
  readonly kind: AlertChannelKind = 'discord';
  constructor(private webhookUrl: string, private fetchImpl: FetchLike = defaultFetch) {}

  async send(alert: AlertRecord): Promise<void> {
    const res = await this.fetchImpl(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: formatText(alert) }),
    });
    if (!res.ok) throw new Error(`discord delivery failed: HTTP ${res.status}`);
  }
}

export class SlackChannel implements AlertChannel {
  readonly kind: AlertChannelKind = 'slack';
  constructor(private webhookUrl: string, private fetchImpl: FetchLike = defaultFetch) {}

  async send(alert: AlertRecord): Promise<void> {
    const res = await this.fetchImpl(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: formatText(alert) }),
    });
    if (!res.ok) throw new Error(`slack delivery failed: HTTP ${res.status}`);
  }
}

/** Email via an HTTP email API endpoint (e.g. Resend-compatible relay). */
export class EmailChannel implements AlertChannel {
  readonly kind: AlertChannelKind = 'email';
  constructor(
    private opts: { endpoint: string; apiKey: string; from: string; to: string },
    private fetchImpl: FetchLike = defaultFetch
  ) {}

  async send(alert: AlertRecord): Promise<void> {
    const res = await this.fetchImpl(this.opts.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.opts.apiKey}`,
      },
      body: JSON.stringify({
        from: this.opts.from,
        to: this.opts.to,
        subject: `[HandicapLab ${alert.severity.toUpperCase()}] ${alert.title}`,
        text: formatText(alert),
      }),
    });
    if (!res.ok) throw new Error(`email delivery failed: HTTP ${res.status}`);
  }
}

/** Build channels from environment configuration; unset channels are skipped. */
export function channelsFromEnv(env: NodeJS.ProcessEnv = process.env): AlertChannel[] {
  const channels: AlertChannel[] = [];
  if (env.LV_ALERT_WEBHOOK_URL) channels.push(new WebhookChannel(env.LV_ALERT_WEBHOOK_URL));
  if (env.LV_ALERT_DISCORD_WEBHOOK) channels.push(new DiscordChannel(env.LV_ALERT_DISCORD_WEBHOOK));
  if (env.LV_ALERT_SLACK_WEBHOOK) channels.push(new SlackChannel(env.LV_ALERT_SLACK_WEBHOOK));
  if (env.LV_ALERT_EMAIL_ENDPOINT && env.LV_ALERT_EMAIL_API_KEY && env.LV_ALERT_EMAIL_FROM && env.LV_ALERT_EMAIL_TO) {
    channels.push(
      new EmailChannel({
        endpoint: env.LV_ALERT_EMAIL_ENDPOINT,
        apiKey: env.LV_ALERT_EMAIL_API_KEY,
        from: env.LV_ALERT_EMAIL_FROM,
        to: env.LV_ALERT_EMAIL_TO,
      })
    );
  }
  return channels;
}
