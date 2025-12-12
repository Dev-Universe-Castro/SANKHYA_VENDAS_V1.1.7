
'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function ThemeColorManager() {
  const pathname = usePathname()

  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]')
    
    if (!metaThemeColor) return

    // Define cores baseadas na rota
    let themeColor = '#FFFFFF' // Branco por padrão (login/register)
    
    if (pathname === '/' || pathname === '/register' || pathname?.startsWith('/offline')) {
      themeColor = '#FFFFFF' // Branco para login, registro e offline
    } else if (pathname?.startsWith('/dashboard') || pathname?.startsWith('/admin-panel')) {
      themeColor = '#51647A' // Convertendo oklch(0.32 0.02 235) para hex aproximado
    }

    metaThemeColor.setAttribute('content', themeColor)
    
    // Atualizar cor da barra de navegação do Android (se suportado)
    if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
      document.documentElement.style.setProperty('background-color', themeColor)
    }

    // Também atualizar a cor de fundo do body durante transições
    document.documentElement.style.setProperty('--status-bar-color', themeColor)
  }, [pathname])

  return null
}
