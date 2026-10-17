import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import { formatPostDate, postPath, type BlogPost } from '@/lib/blog';

/** One article in a grid: category, title, summary, date and reading time. */
export function PostCard({ post, headingLevel = 'h2' }: { post: BlogPost; headingLevel?: 'h2' | 'h3' }) {
  const Heading = headingLevel;
  return (
    <article className="group relative flex h-full flex-col rounded-lg border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-raised">
      <p className="eyebrow">{post.category}</p>
      <Heading className="mt-2 font-display text-lg font-semibold leading-snug text-card-foreground">
        <Link href={postPath(post.slug)} className="after:absolute after:inset-0 group-hover:text-primary-600">
          {post.title}
        </Link>
      </Heading>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
        {post.description}
      </p>
      <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <time dateTime={post.date}>{formatPostDate(post.date)}</time>
          <span aria-hidden="true">·</span>
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {post.readingMinutes} min read
        </span>
        <ArrowRight
          className="h-4 w-4 shrink-0 text-accent-600 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
    </article>
  );
}
