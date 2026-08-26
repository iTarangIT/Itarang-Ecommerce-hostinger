import { z } from 'zod';

/**
 * Server-side environment.
 *
 * No `NEXT_PUBLIC_` secret may appear here.
 *
 * `HOSTINGER_API_TOKEN` was deliberately absent for a long time, on the
 * reasoning that the catalogue read API needs no credential and that keeping a
 * token out of the project means no code path can reach a mutating endpoint.
 * That reasoning held only while there was nothing we needed to write. Selling
 * a unit has to decrement the merchant's own stock, and that is an
 * authenticated call, so the token is now required — but confined to one
 * module (`commerce/hostinger/admin-client.ts`). The storefront client stays
 * read-only by construction and never sees it.
 *
 * Razorpay variables are optional and unset in this local testing phase. The
 * schema below makes it impossible to select the Razorpay provider without a
 * genuine `rzp_test_` key, and impossible to use a live key at all.
 */
const schema = z
  .object({
    NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),

    /* ------------------------------------------------------- catalogue */
    COMMERCE_PROVIDER: z.enum(['mock', 'hostinger']).default('mock'),
    HOSTINGER_ECOMMERCE_API_URL: z.string().url().default('https://api-ecommerce.hostinger.com'),
    /** Public sales channel id, `scha_…`. Configuration, not a secret. */
    HOSTINGER_SALES_CHANNEL_ID: z.string().startsWith('scha_').optional(),
    HOSTINGER_CATALOG_REVALIDATE: z.coerce.number().int().min(0).max(86_400).default(300),

    /* ------------------------------------------- hostinger account API */
    /**
     * The authenticated account API, which is a different service from the
     * public sales-channel catalogue above. Only the inventory push uses it.
     */
    HOSTINGER_ACCOUNT_API_URL: z.string().url().default('https://developers.hostinger.com'),
    /** SECRET. Never gains a NEXT_PUBLIC_ prefix; a test asserts it stays server-side. */
    HOSTINGER_API_TOKEN: z.string().min(16).optional(),
    /** Account-API store id, `store_…`. Not the sales channel id. */
    HOSTINGER_STORE_ID: z.string().startsWith('store_').optional(),
    /**
     * Master switch for writing stock back to Hostinger.
     *
     * Off by default, and deliberately separate from having credentials: a
     * token being present is not consent to start mutating the merchant's
     * catalogue. Turning this on is the deliberate act.
     */
    HOSTINGER_INVENTORY_PUSH: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),

    /* -------------------------------------------------------- database */
    /** Validated in depth by `src/lib/db/guard.ts` before any connection. */
    DATABASE_URL: z.string().optional(),

    /* --------------------------------------------------------- payment */
    PAYMENT_PROVIDER: z.enum(['mock', 'razorpay-test']).default('mock'),
    /** Only ever a TEST key. A live key is rejected below. */
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

    /* -------------------------------------------------------- checkout */
    RESERVATION_TTL_MINUTES: z.coerce.number().int().min(1).max(120).default(15),
    COD_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
    COD_FEE_PAISE: z.coerce.number().int().min(0).default(0),
    COD_MAX_ORDER_PAISE: z.coerce.number().int().min(0).default(2_000_000),

    /* ----------------------------------------------------------- email */
    /**
     * SMTP for verification and password-reset mail. All four are required
     * together or none at all — a half-configured mailer silently drops mail,
     * so it is refused at startup instead.
     */
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    EMAIL_FROM: z.string().optional(),

    /* ------------------------------------------------------------- gst */
    SELLER_GSTIN: z.string().optional(),
    SELLER_STATE_CODE: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.COMMERCE_PROVIDER === 'hostinger' && !value.HOSTINGER_SALES_CHANNEL_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['HOSTINGER_SALES_CHANNEL_ID'],
        message: 'COMMERCE_PROVIDER=hostinger requires HOSTINGER_SALES_CHANNEL_ID.',
      });
    }

    // Pushing stock needs all three together. A half-configured push would
    // fail at the moment a sale happens, which is the worst possible time to
    // discover a missing store id.
    if (value.HOSTINGER_INVENTORY_PUSH) {
      const missing = (
        [
          ['HOSTINGER_API_TOKEN', value.HOSTINGER_API_TOKEN],
          ['HOSTINGER_STORE_ID', value.HOSTINGER_STORE_ID],
        ] as const
      )
        .filter(([, v]) => !v)
        .map(([k]) => k);

      if (missing.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['HOSTINGER_INVENTORY_PUSH'],
          message:
            `HOSTINGER_INVENTORY_PUSH=true requires ${missing.join(', ')}. ` +
            'Run `npm run hostinger:probe` to discover the store id.',
        });
      }
    }

    // Half-configured SMTP is worse than none: mail would be attempted and
    // silently dropped. Either all of it is present, or the mailer stays off
    // and falls back to logging.
    const smtp = [
      ['SMTP_HOST', value.SMTP_HOST],
      ['SMTP_USER', value.SMTP_USER],
      ['SMTP_PASSWORD', value.SMTP_PASSWORD],
      ['EMAIL_FROM', value.EMAIL_FROM],
    ] as const;
    const smtpSet = smtp.filter(([, v]) => v);
    if (smtpSet.length > 0 && smtpSet.length < smtp.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SMTP_HOST'],
        message:
          'Email is partially configured. Set all of ' +
          smtp.map(([k]) => k).join(', ') +
          ', or none of them to keep the mailer off.',
      });
    }

    // A live key must never be usable in this environment, whichever provider
    // is selected. This check runs even under PAYMENT_PROVIDER=mock.
    if (value.RAZORPAY_KEY_ID && !value.RAZORPAY_KEY_ID.startsWith('rzp_test_')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RAZORPAY_KEY_ID'],
        message:
          'Only Razorpay TEST credentials are permitted in this build. ' +
          'RAZORPAY_KEY_ID must start with "rzp_test_".',
      });
    }

    if (value.PAYMENT_PROVIDER === 'razorpay-test') {
      const missing = (
        [
          ['RAZORPAY_KEY_ID', value.RAZORPAY_KEY_ID],
          ['RAZORPAY_KEY_SECRET', value.RAZORPAY_KEY_SECRET],
          ['RAZORPAY_WEBHOOK_SECRET', value.RAZORPAY_WEBHOOK_SECRET],
        ] as const
      )
        .filter(([, v]) => !v)
        .map(([k]) => k);

      if (missing.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['PAYMENT_PROVIDER'],
          message:
            `PAYMENT_PROVIDER=razorpay-test requires ${missing.join(', ')}. ` +
            'Leave PAYMENT_PROVIDER=mock until real test credentials exist.',
        });
      }
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;

  const parsed = schema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    COMMERCE_PROVIDER: process.env.COMMERCE_PROVIDER,
    HOSTINGER_ECOMMERCE_API_URL: process.env.HOSTINGER_ECOMMERCE_API_URL,
    HOSTINGER_SALES_CHANNEL_ID: process.env.HOSTINGER_SALES_CHANNEL_ID,
    HOSTINGER_CATALOG_REVALIDATE: process.env.HOSTINGER_CATALOG_REVALIDATE,
    HOSTINGER_ACCOUNT_API_URL: process.env.HOSTINGER_ACCOUNT_API_URL,
    HOSTINGER_API_TOKEN: process.env.HOSTINGER_API_TOKEN,
    HOSTINGER_STORE_ID: process.env.HOSTINGER_STORE_ID,
    HOSTINGER_INVENTORY_PUSH: process.env.HOSTINGER_INVENTORY_PUSH,
    DATABASE_URL: process.env.DATABASE_URL,
    PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
    RESERVATION_TTL_MINUTES: process.env.RESERVATION_TTL_MINUTES,
    COD_ENABLED: process.env.COD_ENABLED,
    COD_FEE_PAISE: process.env.COD_FEE_PAISE,
    COD_MAX_ORDER_PAISE: process.env.COD_MAX_ORDER_PAISE,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    EMAIL_FROM: process.env.EMAIL_FROM,
    SELLER_GSTIN: process.env.SELLER_GSTIN,
    SELLER_STATE_CODE: process.env.SELLER_STATE_CODE,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}

/** Test seam — clears the memoised environment. */
export function resetEnvCache(): void {
  cached = null;
}
