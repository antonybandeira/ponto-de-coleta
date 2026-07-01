'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import clsx from 'clsx'

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/vendas', label: 'Vendas' },
  { href: '/vendas/historico', label: 'Histórico' },
  { href: '/ocorrencias', label: 'Ocorrências' },
  { href: '/contatos', label: 'Contatos' },
  { href: '/catalogo', label: 'Catálogo' },
]

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' })
    router.push('/pin')
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 h-14">
        <span className="font-bold text-blue-600 mr-4 text-sm whitespace-nowrap">📦 Ponto de Coleta</span>
        <nav className="flex items-center gap-1 flex-1 overflow-x-auto">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                'px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap transition-colors',
                pathname === href
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <button
          onClick={handleLogout}
          className="ml-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded font-medium transition-colors whitespace-nowrap"
        >
          Sair
        </button>
      </div>
    </header>
  )
}
