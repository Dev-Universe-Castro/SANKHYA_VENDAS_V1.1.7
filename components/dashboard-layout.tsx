"use client"

import type React from "react"

import { useState } from "react"
import Sidebar from "./sidebar"
import Header from "./header"
import Footer from "./footer"
import FloatingActionMenu from "./floating-action-menu"
import { useToast } from "@/hooks/use-toast"
import { authService } from "@/lib/auth-service"
import { Menu } from "lucide-react" // Assuming Menu icon is needed for Header, though not directly used in the provided snippet for mobile header replacement
import { Button } from "@/components/ui/button" // Assuming Button component is used elsewhere or might be relevant
import { cn } from "@/lib/utils"

interface DashboardLayoutProps {
  children: React.ReactNode
  hideFloatingMenu?: boolean
}

export default function DashboardLayout({ children, hideFloatingMenu = false }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true) // Iniciar minimizado
  const { toast } = useToast()

  const handleLogout = async () => {
    authService.logout()

    // Limpar cache do servidor também
    try {
      await fetch('/api/cache/clear?userLogout=true', {
        method: 'POST',
      })
      console.log('✅ Cache do servidor limpo')
    } catch (error) {
      console.error('Erro ao limpar cache do servidor:', error)
    }

    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso.",
    })

    // Redirecionar para login após pequeno delay
    setTimeout(() => {
      window.location.href = '/'
    }, 500)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1">
        {/* Mobile sidebar backdrop - This will be removed as per the intention to remove the sidebar */}
        {/* {sidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )} */}

        {/* Sidebar - This component is kept but its mobile interaction is removed */}
        <Sidebar
          isOpen={sidebarOpen} // This will likely be managed by the new menu overlay logic, or kept for desktop
          onClose={() => setSidebarOpen(false)} // This handler might be repurposed or removed for mobile
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Main content */}
        <div className={cn(
          "flex-1 flex flex-col overflow-x-hidden min-h-screen",
          !sidebarCollapsed && "lg:ml-64",
          sidebarCollapsed && "lg:ml-20"
        )}>
          {/* Header - Modified for mobile */}
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} onLogout={handleLogout} />
          <main className="flex-1 p-6 bg-background pb-32 lg:pb-24 overflow-x-hidden page-transition">
            {children}
          </main>
          <Footer />
        </div>
      </div>

      {/* Floating Action Menu - This will be replaced by the new Bottom Navigation and Menu Overlay */}
      {!hideFloatingMenu && <FloatingActionMenu />}
    </div>
  )
}