"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { authService } from "@/lib/auth-service"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Send, ArrowLeft, BarChart3, TrendingUp, Package, Users, Calendar as CalendarIcon } from "lucide-react"
import Image from "next/image"
import { WidgetRenderer } from "@/components/widget-renderer"
import { Label } from "@/components/ui/label"

interface Widget {
  tipo: "card" | "grafico_barras" | "grafico_linha" | "grafico_pizza" | "tabela"
  titulo: string
  dados: any
  metadados?: any
}

const SUGGESTED_PROMPTS = [
  {
    label: "Performance de Vendas",
    prompt: "Analise o desempenho de vendas dos últimos 6 meses com evolução temporal e mostre os top 5 produtos mais vendidos",
    icon: TrendingUp
  },
  {
    label: "Análise de Leads",
    prompt: "Mostre uma análise completa dos meus leads: distribuição por estágio ao longo do tempo, taxa de conversão e evolução mensal",
    icon: BarChart3
  },
  {
    label: "Estoque Crítico",
    prompt: "Identifique produtos com estoque baixo, mostre a evolução do estoque nos últimos meses e sugira ações de reposição",
    icon: Package
  },
  {
    label: "Análise de Clientes",
    prompt: "Analise o perfil dos meus clientes com evolução temporal, identifique padrões de compra e correlações entre valor e frequência",
    icon: Users
  }
]

export default function AnalisePage() {
  const router = useRouter()
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [showInitial, setShowInitial] = useState(true)
  const [isOnline, setIsOnline] = useState(true)
  
  // Filtro de data (padrão: últimos 30 dias)
  const hoje = new Date().toISOString().split('T')[0]
  const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const [dataInicio, setDataInicio] = useState(trintaDiasAtras)
  const [dataFim, setDataFim] = useState(hoje)

  useEffect(() => {
    const currentUser = authService.getCurrentUser()
    if (!currentUser) {
      router.push("/")
    }

    // Verificar status de conexão
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [router])

  const handleAnalyze = async (prompt: string) => {
    if (!prompt.trim() || isLoading) return

    setInput("")
    setIsLoading(true)
    setShowInitial(false)
    setWidgets([])

    try {
      const response = await fetch("/api/gemini/analise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt,
          dataInicio,
          dataFim
        })
      })

      if (!response.ok) throw new Error("Erro ao processar análise")

      const data = await response.json()
      setWidgets(data.widgets || [])
    } catch (error) {
      console.error("Erro ao analisar dados:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChipClick = (prompt: string) => {
    handleAnalyze(prompt)
  }

  if (!isOnline) {
    return (
      <DashboardLayout hideFloatingMenu={true}>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">IA Análise Indisponível Offline</h3>
                <p className="text-sm text-muted-foreground">
                  A Análise de Dados com IA requer conexão com a internet para funcionar. Por favor, conecte-se à internet para acessar esta funcionalidade.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout hideFloatingMenu={true}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b p-4 flex items-center justify-between gap-3 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para escolhas de IA
          </Button>
          
          {/* Filtro de Data */}
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-40"
                disabled={isLoading}
              />
              <span className="text-sm text-muted-foreground">até</span>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-40"
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        {/* Área Principal */}
        <div className={`flex-1 px-4 py-6 ${!showInitial ? 'overflow-y-auto scrollbar-hide' : ''}`}>
          {showInitial ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="flex items-center gap-3 mb-6">
                <div className="relative w-8 h-8">
                  <Image
                    src="/1.png"
                    alt="AI Icon"
                    fill
                    className="object-contain"
                  />
                </div>
                <h1 className="text-3xl font-bold text-primary">IA Análise de Dados</h1>
              </div>
              <p className="text-center text-muted-foreground max-w-md mb-8">
                Faça perguntas sobre seus dados e receba análises visuais em tempo real com gráficos, tabelas e insights automáticos.
              </p>

              {/* Chips de Sugestões */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl w-full">
                {SUGGESTED_PROMPTS.map((promptData) => {
                  const Icon = promptData.icon
                  return (
                    <Card
                      key={promptData.label}
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => handleChipClick(promptData.prompt)}
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Icon className="w-4 h-4 text-primary" />
                          {promptData.label}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground">{promptData.prompt}</p>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-7xl mx-auto">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                  <div className="relative w-24 h-24">
                    <Image
                      src="/anigif.gif"
                      alt="Analisando"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <p className="text-muted-foreground">Analisando seus dados...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 pb-6">
                  {widgets.map((widget, index) => (
                    <WidgetRenderer key={index} widget={widget} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Barra de Input Fixa */}
        <div className="border-t bg-background p-4 flex-shrink-0">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAnalyze(input)}
              placeholder="Faça uma pergunta sobre seus dados..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={() => handleAnalyze(input)}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="bg-primary hover:bg-primary/90"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}