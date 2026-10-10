import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { go } from '../lib/format';

/**
 * A real <a href> so search engines can follow it, that still navigates without a page reload.
 * Ctrl/Cmd/middle-click and "open in new tab" keep working as normal.
 */
export function Link({ to, onClick, className, ...rest }: { to: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(to);
  };
  return <a href={to} onClick={handle} className={`link ${className ?? ''}`.trim()} {...rest} />;
}
