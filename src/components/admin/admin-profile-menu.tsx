import { ChevronDown, LogOut } from 'lucide-react';
import { logoutAction } from '@/lib/auth/actions';

/** "Rushikesh Patil" → "RP"; a single word gives one letter. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0]![0], parts.at(-1)![0]] : [parts[0]?.[0]];
  return letters.join('').toUpperCase() || 'A';
}

/**
 * The signed-in administrator, shown by name in the corner of the console.
 *
 * The email address is deliberately not displayed: the console is often on a
 * shared screen, and the sign-in identifier is the half of the credential pair
 * nobody else needs to see.
 *
 * A native `<details>` rather than a client-side dropdown, so the menu works
 * without JavaScript and the page stays a server component.
 */
export function AdminProfileMenu({ name }: { name: string | null }) {
  const display = name?.trim() || 'Admin';

  return (
    <details className="group relative">
      <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-border bg-card pl-1 pr-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        >
          {initials(display)}
        </span>
        <span className="max-w-[10rem] truncate">{display}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-border bg-card p-1 shadow-lg">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-semibold text-foreground">{display}</p>
          <p className="text-xs text-muted-foreground">Administrator</p>
        </div>
        <div className="my-1 h-px bg-border" />
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
