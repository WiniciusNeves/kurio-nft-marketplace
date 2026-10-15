import { Link } from '@tanstack/react-router'
import { Fragment } from 'react'

export function Breadcrumbs({ items }: { items: Array<{ label: string; to?: string }> }) {
  return (
    <nav aria-label="Trilha de navegação" className="py-6 text-sm font-bold">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((it, i) => (
          <Fragment key={it.label}>
            <li>
              {it.to && i < items.length - 1 ? (
                <Link to={it.to} className="hover:text-primary-strong">
                  {it.label}
                </Link>
              ) : (
                <span aria-current={i === items.length - 1 ? 'page' : undefined}>{it.label}</span>
              )}
            </li>
            {i < items.length - 1 && <li aria-hidden>/</li>}
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}
