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
 * Razorpay variables are optional. The schema below ties the key to the mode:
 * `razorpay-test` and `mock` accept only an `rzp_test_` key, and only
 * `PAYMENT_PROVIDER=razorpay` accepts an `rzp_live_` key — so live money can
 * move only when both the mode and the key say so.
 */
const schema = z
  .object({
    NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),

    /* ------------------------------------------------------- catalogue */
    /**
     * `db` serves the catalogue we own — our Postgres, our admin panel, our
     * ids. `hostinger` and `mock` are unchanged and still selectable; nothing
     * about either was redesigned to make room for the third.
     */
    COMMERCE_PROVIDER: z.enum(['mock', 'hostinger', 'db']).default('mock'),
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

    /* --------------------------------------------------- product media */
    /**
     * Supabase Storage holds the product image binaries; Postgres holds only
     * the object key. Deliberately not Hostinger: the catalogue's content —
     * images included — is ours, and an image that lives in the merchant's CDN
     * disappears when the merchant's product does.
     *
     * The project URL, e.g. https://abcdefgh.supabase.co. Not a secret: the
     * public object URL derived from it is what a browser fetches.
     */
    SUPABASE_URL: z.string().url().optional(),
    /**
     * SECRET, and a more dangerous one than the Razorpay keys: the service role
     * bypasses row-level security on every table in the project. It is used
     * only server-side, only to write objects into the bucket below, and
     * `src/lib/security.test.ts` greps the built client bundle to keep it that
     * way. There is deliberately no NEXT_PUBLIC_ variant.
     */
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
    /**
     * The project's publishable (`sb_publishable_…`) or legacy `anon` key, for
     * Supabase Auth. Not a secret — Supabase designs it to be public, and RLS
     * with no policies keeps it from reading any table — but it is still only
     * used server-side: the browser never talks to Supabase directly. Unset
     * means Supabase sign-in is off and only the original sessions are read.
     */
    SUPABASE_ANON_KEY: z.string().min(20).optional(),
    /** Public bucket the product images live in. */
    SUPABASE_STORAGE_BUCKET: z.string().min(1).default('product-media'),

    /* --------------------------------------------------------- payment */
    PAYMENT_PROVIDER: z.enum(['mock', 'razorpay-test', 'razorpay']).default('mock'),
    /** `rzp_live_` with `razorpay`, `rzp_test_` otherwise — enforced below. */
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

    /* ------------------------------------------------------------- otp */
    /**
     * Keys the digest of every one-time sign-in code.
     *
     * Optional here and demanded at the point of use, not at boot: an
     * installation that has not turned customer sign-in on yet should still
     * start. `otpPepper()` in `lib/auth/otp.ts` throws if a code is ever
     * hashed without it, so the failure lands on the feature rather than on
     * the whole application.
     *
     * A six-digit code has only a million possible values, so an unkeyed
     * digest of one is reversible the instant the table leaks. This is the
     * secret that makes that infeasible, which is why it lives outside the
     * database. Rotating it invalidates every code in flight — harmless, they
     * last ten minutes.
     */
    AUTH_OTP_PEPPER: z.string().min(32).optional(),

    /* ------------------------------------------------------------- gst */
    SELLER_GSTIN: z.string().optional(),
    SELLER_STATE_CODE: z.string().optional(),

    /* ------------------------------------------------ stock notifications */

    /**
     * Where the internal "a product has gone out of stock" alert is sent.
     *
     * Defaulted rather than required, because the alert is operational mail and
     * a missing variable must not stop the application booting — nor, worse,
     * stop a payment committing. The address the business named is the default;
     * set the variable to route it somewhere else without a code change.
     *
     * Sending is additionally gated on the `stock_notifications` setting in
     * `app_settings`, which an administrator controls from the console.
     */
    STOCK_ALERT_EMAIL: z.string().email().default('anirudh@itarang.com'),
    /**
     * Where new complaints, warranty registrations and installation bookings
     * are sent. Defaults to the customer-care address the site publishes.
     */
    SUPPORT_INBOX_EMAIL: z.string().email().default('care@itarang.com'),
    /**
     * Who hears about a paid order and about paid orders still without an
     * invoice (R-03, R-08). Comma-separated; defaults to customer care.
     */
    ORDER_ALERT_EMAILS: z
      .string()
      .default('care@itarang.com')
      .transform((value) =>
        value
          .split(',')
          .map((address) => address.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.string().email()).min(1)),

    /* -------------------------------------------------------- scheduled jobs */
    /**
     * Bearer token for `/api/cron/*`. Unset turns the routes off (404), so a
     * job can never run unauthenticated by accident.
     */
    CRON_SECRET: z.string().min(24).optional(),

    /* ----------------------------------------------------- SMS OTP (Exotel) */
    /**
     * Exotel SMS for sign-in codes (R-21). All of SID, API key, API token,
     * sender id, DLT entity id, DLT template id and template text, or none —
     * without them `SmsOtpTransport` refuses, exactly as before. The template
     * must be the DLT-approved text with `{code}` where the code goes.
     */
    EXOTEL_SID: z.string().optional(),
    EXOTEL_API_KEY: z.string().optional(),
    EXOTEL_API_TOKEN: z.string().optional(),
    EXOTEL_SUBDOMAIN: z.string().default('api.exotel.com'),
    EXOTEL_SMS_SENDER_ID: z.string().optional(),
    EXOTEL_DLT_ENTITY_ID: z.string().optional(),
    EXOTEL_DLT_OTP_TEMPLATE_ID: z.string().optional(),
    EXOTEL_OTP_TEMPLATE: z.string().includes('{code}').optional(),
  })
  .superRefine((value, ctx) => {
    if (value.COMMERCE_PROVIDER === 'hostinger' && !value.HOSTINGER_SALES_CHANNEL_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['HOSTINGER_SALES_CHANNEL_ID'],
        message: 'COMMERCE_PROVIDER=hostinger requires HOSTINGER_SALES_CHANNEL_ID.',
      });
    }

    // Serving our own catalogue needs the database it lives in and the storage
    // project its images live in. Both are checked at boot rather than at the
    // first request: a storefront that starts and then serves every product
    // without an image is a worse failure than one that refuses to start.
    //
    // The service-role key is NOT required here. Reading the catalogue only
    // needs the project URL to build public object URLs; the key is needed to
    // *write* an object, and `products/media.ts` demands it at that point.
    if (value.COMMERCE_PROVIDER === 'db') {
      const missing = (
        [
          ['DATABASE_URL', value.DATABASE_URL],
          ['SUPABASE_URL', value.SUPABASE_URL],
        ] as const
      )
        .filter(([, v]) => !v)
        .map(([k]) => k);

      if (missing.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['COMMERCE_PROVIDER'],
          message: `COMMERCE_PROVIDER=db requires ${missing.join(', ')}.`,
        });
      }
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

    const exotel = [
      ['EXOTEL_SID', value.EXOTEL_SID],
      ['EXOTEL_API_KEY', value.EXOTEL_API_KEY],
      ['EXOTEL_API_TOKEN', value.EXOTEL_API_TOKEN],
      ['EXOTEL_SMS_SENDER_ID', value.EXOTEL_SMS_SENDER_ID],
      ['EXOTEL_DLT_ENTITY_ID', value.EXOTEL_DLT_ENTITY_ID],
      ['EXOTEL_DLT_OTP_TEMPLATE_ID', value.EXOTEL_DLT_OTP_TEMPLATE_ID],
      ['EXOTEL_OTP_TEMPLATE', value.EXOTEL_OTP_TEMPLATE],
    ] as const;
    const exotelSet = exotel.filter(([, v]) => v);
    if (exotelSet.length > 0 && exotelSet.length < exotel.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['EXOTEL_SID'],
        message:
          'SMS is partially configured. Set all of ' +
          exotel.map(([k]) => k).join(', ') +
          ', or none of them to keep SMS sign-in off.',
      });
    }

    // The key must match the mode. A live key is accepted only under
    // `PAYMENT_PROVIDER=razorpay`, and that mode accepts only a live key, so a
    // test build can never move real money and a live build never silently
    // takes test payments. This check runs even under PAYMENT_PROVIDER=mock.
    if (value.RAZORPAY_KEY_ID) {
      const prefix = value.PAYMENT_PROVIDER === 'razorpay' ? 'rzp_live_' : 'rzp_test_';
      if (!value.RAZORPAY_KEY_ID.startsWith(prefix)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['RAZORPAY_KEY_ID'],
          message:
            value.PAYMENT_PROVIDER === 'razorpay'
              ? 'PAYMENT_PROVIDER=razorpay takes payments for real: RAZORPAY_KEY_ID must start with "rzp_live_".'
              : `PAYMENT_PROVIDER=${value.PAYMENT_PROVIDER} accepts only Razorpay TEST credentials: ` +
                'RAZORPAY_KEY_ID must start with "rzp_test_". Set PAYMENT_PROVIDER=razorpay to use a live key.',
        });
      }
    }

    if (value.PAYMENT_PROVIDER === 'razorpay-test' || value.PAYMENT_PROVIDER === 'razorpay') {
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
            `PAYMENT_PROVIDER=${value.PAYMENT_PROVIDER} requires ${missing.join(', ')}. ` +
            'Leave PAYMENT_PROVIDER=mock until Razorpay credentials exist.',
        });
      }
    }
  });

export type Env = z.infer<typeof schema>;

/**
 * An empty environment variable is an unset one.
 *
 * `.env.example` documents optional settings as bare `NAME=` lines, so anyone
 * who copies it has them defined as `''`. zod sees a set value and applies the
 * whole rule — `.url()`, `.min(20)` — and the application refuses to start over
 * a variable the operator has deliberately left blank.
 */
function blank(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value;
}

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
    // `blank()` rather than the raw value: copying `.env.example` leaves these
    // present-but-empty, and an empty string is a *set* variable as far as zod
    // is concerned — it would fail `.url()` and `.min(20)` and refuse to boot,
    // which is a hostile way to greet someone who has not configured storage
    // yet. Absent and blank mean the same thing here.
    SUPABASE_URL: blank(process.env.SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: blank(process.env.SUPABASE_SERVICE_ROLE_KEY),
    SUPABASE_ANON_KEY: blank(process.env.SUPABASE_ANON_KEY),
    SUPABASE_STORAGE_BUCKET: blank(process.env.SUPABASE_STORAGE_BUCKET),
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
    AUTH_OTP_PEPPER: blank(process.env.AUTH_OTP_PEPPER),
    SELLER_GSTIN: process.env.SELLER_GSTIN,
    SELLER_STATE_CODE: process.env.SELLER_STATE_CODE,
    STOCK_ALERT_EMAIL: blank(process.env.STOCK_ALERT_EMAIL),
    SUPPORT_INBOX_EMAIL: blank(process.env.SUPPORT_INBOX_EMAIL),
    ORDER_ALERT_EMAILS: blank(process.env.ORDER_ALERT_EMAILS),
    CRON_SECRET: blank(process.env.CRON_SECRET),
    EXOTEL_SID: blank(process.env.EXOTEL_SID),
    EXOTEL_API_KEY: blank(process.env.EXOTEL_API_KEY),
    EXOTEL_API_TOKEN: blank(process.env.EXOTEL_API_TOKEN),
    EXOTEL_SUBDOMAIN: blank(process.env.EXOTEL_SUBDOMAIN),
    EXOTEL_SMS_SENDER_ID: blank(process.env.EXOTEL_SMS_SENDER_ID),
    EXOTEL_DLT_ENTITY_ID: blank(process.env.EXOTEL_DLT_ENTITY_ID),
    EXOTEL_DLT_OTP_TEMPLATE_ID: blank(process.env.EXOTEL_DLT_OTP_TEMPLATE_ID),
    EXOTEL_OTP_TEMPLATE: blank(process.env.EXOTEL_OTP_TEMPLATE),
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
