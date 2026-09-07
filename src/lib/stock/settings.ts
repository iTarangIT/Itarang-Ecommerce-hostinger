import { z } from 'zod';
import { query, queryOne } from '@/lib/db/pool';

/**
 * Operational switches an administrator controls, stored in `app_settings`.
 *
 * One switch today: whether stock notification emails are sent at all. It is a
 * database row rather than an environment variable because the business asked
 * for a control in the console, and a redeploy is not a control — the point of
 * a kill switch is that it works at the moment somebody needs it.
 */

const STOCK_NOTIFICATIONS_KEY = 'stock_notifications';

const stockNotificationSettings = z.object({
  /**
   * Gates **both** kinds of mail — the internal out-of-stock alert and the
   * customer back-in-stock message.
   *
   * One switch rather than two, because the reason to reach for it is the same
   * for both: something is wrong with the catalogue, an import has gone
   * sideways, or a migration is running, and nobody wants that reaching
   * anyone's inbox. Splitting it would mean guessing which half is the problem
   * while it is happening.
   */
  enabled: z.boolean(),
});

export type StockNotificationSettings = z.infer<typeof stockNotificationSettings>;

/**
 * Off until somebody turns it on.
 *
 * A fresh database has no row, and defaulting that to "send" would mean a
 * deployment starts mailing customers before anyone has looked at the
 * interested list. The console shows the state plainly, so this is a decision
 * an administrator makes rather than one they discover.
 */
export const STOCK_NOTIFICATIONS_DEFAULT: StockNotificationSettings = { enabled: false };

export async function stockNotificationSettingsOf(): Promise<StockNotificationSettings> {
  const row = await queryOne<{ value: unknown }>(
    'SELECT value FROM app_settings WHERE key = $1',
    [STOCK_NOTIFICATIONS_KEY],
  );
  if (!row) return STOCK_NOTIFICATIONS_DEFAULT;

  // Fails closed. A value that does not parse — hand-edited, or written by an
  // older version of this code — must not be coerced into "enabled".
  const parsed = stockNotificationSettings.safeParse(row.value);
  return parsed.success ? parsed.data : STOCK_NOTIFICATIONS_DEFAULT;
}

export async function setStockNotificationsEnabled(
  enabled: boolean,
  actor: string,
): Promise<void> {
  await query(
    `INSERT INTO app_settings (key, value, updated_by)
     VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            updated_at = now(),
            updated_by = EXCLUDED.updated_by`,
    [STOCK_NOTIFICATIONS_KEY, JSON.stringify({ enabled }), actor],
  );
}

/** Who last changed the switch, and when — shown beside it in the console. */
export async function stockNotificationSettingsMeta(): Promise<{
  updatedAt: string;
  updatedBy: string | null;
} | null> {
  const row = await queryOne<{ updated_at: Date; updated_by: string | null }>(
    'SELECT updated_at, updated_by FROM app_settings WHERE key = $1',
    [STOCK_NOTIFICATIONS_KEY],
  );
  return row ? { updatedAt: row.updated_at.toISOString(), updatedBy: row.updated_by } : null;
}
