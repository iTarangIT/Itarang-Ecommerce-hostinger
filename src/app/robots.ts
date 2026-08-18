import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Personal and transient surfaces carry no crawlable value.
      disallow: ['/api/', '/cart', '/account', '/compare'],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
