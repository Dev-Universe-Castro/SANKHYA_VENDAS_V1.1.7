"use client"

import { useState, useEffect } from "react"
import { Search, Plus, MoreHorizontal, Calendar, DollarSign, ChevronRight, Settings, User, Pencil, Check, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { LeadModal } from "@/components/lead-modal"
import { LeadCreateModal } from "./lead-create-modal"
import { FunilModal } from "@/components/funil-modal"
import { EstagiosModal } from "@/components/estagios-modal"
import { useToast } from "@/hooks/use-toast"
import type { Funil, EstagioFunil } from "@/lib/oracle-funis-service"
import type { User } from "@/lib/auth-service"
import { authService } from "@/lib/auth-service"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useIsMobile } from "@/hooks/use-mobile"

// Tipos importados localmente para evitar importar o módulo oracle
export interface Lead {
  CODLEAD: string
  ID_EMPRESA: number
  NOME: string
  DESCRICAO: string
  VALOR: number
  ESTAGIO: string
  CODESTAGIO: string
  CODFUNIL: string
  DATA_VENCIMENTO: string
  TIPO_TAG: string
  COR_TAG: string
  CODPARC?: string
  CODUSUARIO?: number
  ATIVO: string
  DATA_CRIACAO: string
  DATA_ATUALIZACAO: string
  STATUS_LEAD?: 'EM_ANDAMENTO' | 'GANHO' | 'PERDIDO'
  MOTIVO_PERDA?: string
  DATA_CONCLUSAO?: string
}

const TAG_COLORS: Record<string, string> = {
  'Ads Production': 'bg-blue-100 text-blue-700',
  'Landing Page': 'bg-red-100 text-red-700',
  'Dashboard': 'bg-green-100 text-green-700',
  'UX Design': 'bg-pink-100 text-pink-700',
  'Video Production': 'bg-amber-100 text-amber-700',
  'Typeface': 'bg-cyan-100 text-cyan-700',
  'Web Design': 'bg-purple-100 text-purple-700'
}

export default function LeadsKanban() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isFunilModalOpen, setIsFunilModalOpen] = useState(false)
  const [isEstagiosModalOpen, setIsEstagiosModalOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [selectedFunilForEdit, setSelectedFunilForEdit] = useState<Funil | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null)
  const [selectedFunil, setSelectedFunil] = useState<Funil | null>(null)
  const [funis, setFunis] = useState<Funil[]>([])
  const [estagios, setEstagios] = useState<EstagioFunil[]>([])
  const [selectedEstagioTab, setSelectedEstagioTab] = useState<string>("")
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [viewMode, setViewMode] = useState<'kanban' | 'lista'>('kanban')
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'EM_ANDAMENTO' | 'GANHO' | 'PERDIDO'>('EM_ANDAMENTO')
  const [dataInicio, setDataInicio] = useState<string>("")
  const [dataFim, setDataFim] = useState<string>("")
  const [parceirosMap, setParceirosMap] = useState<Record<string, string>>({})
  const [usuariosMap, setUsuariosMap] = useState<Record<number, string>>({})
  const { toast } = useToast()
  const isMobile = useIsMobile()

  useEffect(() => {
    const user = authService.getCurrentUser()
    setCurrentUser(user)
    loadFunis()
  }, [])

  useEffect(() => {
    if (selectedFunil) {
      setIsLoading(true)
      Promise.all([loadEstagios(), loadLeads()])
        .finally(() => {
          requestAnimationFrame(() => {
            setIsLoading(false)
          })
        })
    }
  }, [selectedFunil])

  const loadFunis = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/funis', {
        headers: { 'Cache-Control': 'no-cache' }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Falha ao carregar funis')
      }

      const data = await response.json()
      setFunis(data)

      if (data.length === 0) {
        console.warn("⚠️ Nenhum funil retornado da API")
      }
    } catch (error: any) {
      console.error("❌ Erro ao carregar funis:", error)
      toast({
        title: "Erro ao conectar com a API",
        description: "Verifique sua conexão e tente novamente. Se o problema persistir, recarregue a página.",
        variant: "destructive",
      })
      // Não limpar os funis em caso de erro, manter os dados anteriores se existirem
    } finally {
      setIsLoading(false)
    }
  }

  const loadEstagios = async () => {
    if (!selectedFunil) return
    try {
      const response = await fetch(`/api/funis/estagios?codFunil=${selectedFunil.CODFUNIL}`)
      if (!response.ok) throw new Error('Falha ao carregar estágios')
      const data = await response.json()
      setEstagios(data)
      // Definir o primeiro estágio como selecionado
      if (data.length > 0 && !selectedEstagioTab) {
        const sortedEstagios = [...data].sort((a, b) => a.ORDEM - b.ORDEM)
        setSelectedEstagioTab(sortedEstagios[0].CODESTAGIO)
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      })
      throw error
    }
  }

  const loadLeads = async () => {
    try {
      setIsLoading(true)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      // Construir query params com filtros de data
      const params = new URLSearchParams({ t: Date.now().toString() })
      if (dataInicio) params.append('dataInicio', dataInicio)
      if (dataFim) params.append('dataFim', dataFim)

      // Forçar recarregamento sem cache
      const response = await fetch(`/api/leads?${params.toString()}`, {
        signal: controller.signal,
        headers: { 
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Accept': 'application/json'
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Falha ao carregar leads')
      }

      const data = await response.json()
      console.log('📊 Leads carregados:', data.length)
      setLeads(Array.isArray(data) ? data : [])

      // Carregar nomes dos parceiros e usuários
      await loadParceirosNomes(data)
      await loadUsuariosNomes(data)
    } catch (error: any) {
      console.error("Erro ao carregar leads:", error)
      toast({
        title: "Erro",
        description: error.name === 'AbortError' 
          ? "Tempo de carregamento excedido"
          : error.message || "Falha ao carregar leads",
        variant: "destructive",
      })
      setLeads([])
      throw error
    } finally {
      setIsLoading(false)
    }
  };

  const loadParceirosNomes = async (leadsData: Lead[]) => {
    try {
      // Obter códigos únicos de parceiros
      const codParcs = [...new Set(leadsData.map(l => l.CODPARC).filter(Boolean))]

      if (codParcs.length === 0) return

      // Buscar do cache de parceiros
      const cachedParceiros = sessionStorage.getItem('cached_parceiros')
      if (cachedParceiros) {
        const parsedCache = JSON.parse(cachedParceiros)
        const allParceiros = parsedCache.parceiros || parsedCache

        const map: Record<string, string> = {}
        codParcs.forEach(codParc => {
          const parceiro = allParceiros.find((p: any) => p.CODPARC === codParc)
          if (parceiro) {
            map[codParc] = parceiro.NOMEPARC
          }
        })

        setParceirosMap(map)
      }
    } catch (error) {
      console.error('Erro ao carregar nomes de parceiros:', error)
    }
  }

  const loadUsuariosNomes = async (leadsData: Lead[]) => {
    try {
      // Obter códigos únicos de usuários
      const codUsuarios = [...new Set(leadsData.map(l => l.CODUSUARIO).filter(Boolean))]

      if (codUsuarios.length === 0) return

      // Buscar usuários
      const response = await fetch('/api/usuarios')
      if (!response.ok) return

      const usuarios = await response.json()

      const map: Record<number, string> = {}
      codUsuarios.forEach(codUsuario => {
        const usuario = usuarios.find((u: any) => u.id === codUsuario)
        if (usuario) {
          map[codUsuario] = usuario.name
        }
      })

      setUsuariosMap(map)
    } catch (error) {
      console.error('Erro ao carregar nomes de usuários:', error)
    }
  }

  const handleCreate = () => {
    setSelectedLead(null)
    setIsCreateModalOpen(true)
  }

  const handleEdit = (lead: Lead) => {
    // Garantir que o lead está completamente carregado antes de abrir
    setSelectedLead(lead)
    // Usar duplo requestAnimationFrame para garantir que o estado foi atualizado
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsModalOpen(true)
      })
    })
  }

  const handleSave = async () => {
    try {
      console.log('💾 Salvando lead e recarregando dados...')

      // Aguardar o reload completo dos leads
      await loadLeads()

      // Aguardar renderização completa
      await new Promise(resolve => setTimeout(resolve, 500))

      console.log('✅ Leads recarregados com sucesso')

      // Fechar modais
      setIsModalOpen(false)
      setIsCreateModalOpen(false)

      toast({
        title: "Sucesso",
        description: selectedLead ? "Lead atualizado!" : "Lead criado!",
      })
    } catch (error: any) {
      console.error('❌ Erro ao salvar:', error)
      toast({
        title: "Erro",
        description: "Erro ao atualizar dados. Tente novamente.",
        variant: "destructive",
      })
    }
  }

  const handleFunilSaved = async () => {
    setIsFunilModalOpen(false)
    await loadFunis()
    toast({
      title: "Sucesso",
      description: selectedFunilForEdit ? "Funil atualizado!" : "Funil criado!",
    })
  }

  const handleEstagiosSaved = async () => {
    setIsEstagiosModalOpen(false)
    if (selectedFunil) {
      await loadEstagios()
    }
    toast({
      title: "Sucesso",
      description: "Estágios atualizados!",
    })
  }

  const handleDragStart = (lead: Lead) => {
    // Bloquear drag de leads ganhos ou perdidos
    if (lead.STATUS_LEAD === 'GANHO' || lead.STATUS_LEAD === 'PERDIDO') {
      toast({
        title: "Ação não permitida",
        description: "Não é possível mover leads ganhos ou perdidos",
        variant: "destructive",
      })
      return
    }
    setDraggedLead(lead)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (codEstagio: string, nomeEstagio: string) => {
    if (!draggedLead || draggedLead.CODESTAGIO === codEstagio) {
      setDraggedLead(null)
      return
    }

    // Verificação adicional antes de mover
    if (draggedLead.STATUS_LEAD === 'GANHO' || draggedLead.STATUS_LEAD === 'PERDIDO') {
      setDraggedLead(null)
      toast({
        title: "Ação não permitida",
        description: "Não é possível mover leads ganhos ou perdidos",
        variant: "destructive",
      })
      return
    }

    const leadOriginal = draggedLead
    setDraggedLead(null)

    try {
      console.log('🔄 Drag & Drop - Iniciando:', { 
        CODLEAD: leadOriginal.CODLEAD,
        tipoCODLEAD: typeof leadOriginal.CODLEAD,
        NOME: leadOriginal.NOME,
        CODESTAGIO_DE: leadOriginal.CODESTAGIO,
        CODESTAGIO_PARA: codEstagio,
        STATUS_LEAD: leadOriginal.STATUS_LEAD
      })

      // Atualizar no banco de dados PRIMEIRO
      const response = await fetch('/api/leads/atualizar-estagio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codLeed: leadOriginal.CODLEAD,
          novoEstagio: codEstagio
        })
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('❌ Resposta de erro da API:', { 
          status: response.status,
          statusText: response.statusText,
          error 
        })
        throw new Error(error.error || 'Falha ao atualizar estágio')
      }

      const data = await response.json()
      console.log('✅ Resposta de sucesso da API:', data)

      // Atualizar estado local DEPOIS do sucesso no banco
      setLeads(prev => prev.map(l => 
        l.CODLEAD === leadOriginal.CODLEAD 
          ? { ...l, CODESTAGIO: codEstagio }
          : l
      ))

      console.log('✅ Drag & Drop - Estágio atualizado com sucesso')

      toast({
        title: "Sucesso",
        description: `Lead movido para ${nomeEstagio}`,
      })
    } catch (error: any) {
      console.error('❌ Drag & Drop - Erro:', error)
      
      toast({
        title: "Erro",
        description: error.message || "Falha ao atualizar estágio. Tente novamente.",
        variant: "destructive",
      })
    }
  }

  const getLeadsByEstagio = (codEstagio: string) => {
    return leads.filter(lead => {
      const matchesSearch = searchTerm === '' || 
                           (lead.CODPARC && lead.CODPARC.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesFunil = selectedFunil && String(lead.CODFUNIL) === String(selectedFunil.CODFUNIL)
      const matchesEstagio = String(lead.CODESTAGIO) === String(codEstagio)
      const matchesStatus = statusFilter === 'TODOS' || 
                           (statusFilter === 'EM_ANDAMENTO' && (!lead.STATUS_LEAD || lead.STATUS_LEAD === 'EM_ANDAMENTO')) ||
                           lead.STATUS_LEAD === statusFilter
      
      return matchesSearch && matchesFunil && matchesEstagio && matchesStatus
    })
  }

  const formatCurrency = (value: number) => {
    // Garantir que o valor seja um número válido
    const numericValue = Number(value) || 0
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numericValue)
  }

  const formatDate = (dateString: string) => {
    if (!dateString || dateString === '') return 'Sem data definida'
    try {
      // Se a data já está no formato DD/MM/YYYY
      if (dateString.includes('/')) {
        return dateString
      }
      // Se a data está no formato ISO ou YYYY-MM-DD
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return 'Sem data definida'
      return date.toLocaleDateString('pt-BR')
    } catch (e) {
      return 'Sem data definida'
    }
  }

  const handleCreateFunil = () => {
    setSelectedFunilForEdit(null)
    requestAnimationFrame(() => {
      setIsFunilModalOpen(true)
    })
  }

  // Se nenhum funil foi selecionado, mostrar lista de funis
  if (!selectedFunil) {
    return (
      <>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Negócios</h1>
            {currentUser?.role === "Administrador" && (
              <Button
                onClick={handleCreateFunil}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium uppercase flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Novo Funil
              </Button>
            )}
          </div>

          <div className="text-sm text-muted-foreground mb-4">
            Selecione um funil para gerenciar seus leads
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card rounded-lg p-6 shadow-sm border border-border animate-pulse">
                  <div className="space-y-3">
                    <div className="h-6 w-32 bg-muted rounded"></div>
                    <div className="h-4 w-full bg-muted rounded"></div>
                    <div className="h-4 w-3/4 bg-muted rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : funis.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <div className="text-muted-foreground">
                <p>Nenhum funil disponível</p>
                <p className="text-sm mt-2">Crie um novo funil para começar ou tente recarregar</p>
              </div>
              <Button
                onClick={loadFunis}
                variant="outline"
                className="mx-auto"
              >
                Tentar Novamente
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {funis.map((funil) => (
                <div key={funil.CODFUNIL} className="relative bg-card rounded-lg p-6 shadow-sm border border-border hover:shadow-lg transition-all group">
                  <button
                    onClick={() => setSelectedFunil(funil)}
                    className="text-left w-full"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: funil.COR }}
                        />
                        <h3 className="font-semibold text-lg text-foreground">{funil.NOME}</h3>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                    {funil.DESCRICAO && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{funil.DESCRICAO}</p>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modais sempre disponíveis */}
        <FunilModal
          isOpen={isFunilModalOpen}
          onClose={() => setIsFunilModalOpen(false)}
          funil={selectedFunilForEdit}
          onSave={handleFunilSaved}
        />
      </>
    )
  }

  // Se um funil foi selecionado, mostrar o Kanban
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Carregando dados...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header - Desktop */}
      <div className="hidden md:flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedFunil(null)}
            className="text-muted-foreground hover:text-foreground h-9 px-3"
          >
            ← Voltar
          </Button>
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0" 
              style={{ backgroundColor: selectedFunil.COR }}
            />
            <h1 className="text-xl md:text-2xl font-bold text-foreground truncate">{selectedFunil.NOME}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentUser?.role === "Administrador" && (
            <Button
              onClick={() => {
                setSelectedFunilForEdit(selectedFunil)
                setIsEstagiosModalOpen(true)
              }}
              variant="outline"
              size="default"
              className="flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              <span>Configurar Estágios</span>
            </Button>
          )}
          <Button
            onClick={handleCreate}
            size="default"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar Novo
          </Button>
        </div>
      </div>

      {/* Header - Mobile (Simplificado) */}
      <div className="md:hidden flex items-center justify-between px-3 py-3 border-b">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedFunil(null)}
            className="h-8 w-8 flex-shrink-0"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <div 
              className="w-2 h-2 rounded-full flex-shrink-0" 
              style={{ backgroundColor: selectedFunil.COR }}
            />
            <h1 className="text-sm font-bold text-foreground truncate">{selectedFunil.NOME}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleCreate}
            variant="ghost"
            size="icon"
            className="h-9 w-9 flex-shrink-0 bg-primary/10 hover:bg-primary/20 text-primary"
          >
            <Plus className="w-5 h-5" />
          </Button>
          {currentUser?.role === "Administrador" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelectedFunilForEdit(selectedFunil)
                setIsEstagiosModalOpen(true)
              }}
              className="h-9 w-9 flex-shrink-0"
            >
              <Settings className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters - Desktop */}
      <div className="hidden md:block space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por cliente"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-card h-9 text-sm"
            />
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="h-9 px-3 pr-8 rounded-md border border-input bg-white text-sm shadow-xs hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
            >
              <option value="EM_ANDAMENTO">Em Andamento</option>
              <option value="GANHO">Ganhos</option>
              <option value="PERDIDO">Perdidos</option>
              <option value="TODOS">Todos</option>
            </select>
            <svg className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant={viewMode === 'lista' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('lista')}
              className="h-9 w-auto px-3 gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>Lista</span>
            </Button>
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('kanban')}
              className="h-9 w-auto px-3 gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              <span>Funil</span>
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="bg-card h-9 w-auto text-sm"
            placeholder="Data Início"
          />
          <span className="text-sm text-muted-foreground">até</span>
          <Input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="bg-card h-9 w-auto text-sm"
            placeholder="Data Fim"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={loadLeads}
            className="h-9 whitespace-nowrap"
          >
            Aplicar
          </Button>
          {(dataInicio || dataFim) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDataInicio("")
                setDataFim("")
                loadLeads()
              }}
              className="h-9 whitespace-nowrap"
            >
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters - Mobile (Simplificado) */}
      <div className="md:hidden px-4 py-2 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-card h-10 text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </Button>
        </div>
      </div>

      {/* Visualização Lista */}
      {viewMode === 'lista' ? (
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground whitespace-nowrap">NOME</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground whitespace-nowrap">CONTATO</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground whitespace-nowrap">RESPONSÁVEL</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground whitespace-nowrap">STATUS</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground whitespace-nowrap">ETAPA</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground whitespace-nowrap">VALOR</th>
                </tr>
              </thead>
              <tbody>
                {leads.filter(lead => {
                  const matchesSearch = searchTerm === '' || 
                                       (lead.CODPARC && lead.CODPARC.toLowerCase().includes(searchTerm.toLowerCase()))
                  const matchesFunil = lead.CODFUNIL === selectedFunil.CODFUNIL
                  const matchesStatus = statusFilter === 'TODOS' || 
                                       (statusFilter === 'EM_ANDAMENTO' && (!lead.STATUS_LEAD || lead.STATUS_LEAD === 'EM_ANDAMENTO')) ||
                                       lead.STATUS_LEAD === statusFilter
                  return matchesSearch && matchesFunil && matchesStatus
                }).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      Nenhum negócio encontrado
                    </td>
                  </tr>
                ) : (
                  leads.filter(lead => {
                    const matchesSearch = searchTerm === '' || 
                                         (lead.CODPARC && lead.CODPARC.toLowerCase().includes(searchTerm.toLowerCase()))
                    const matchesFunil = lead.CODFUNIL === selectedFunil.CODFUNIL
                    const matchesStatus = statusFilter === 'TODOS' || 
                                         (statusFilter === 'EM_ANDAMENTO' && (!lead.STATUS_LEAD || lead.STATUS_LEAD === 'EM_ANDAMENTO')) ||
                                         lead.STATUS_LEAD === statusFilter
                    return matchesSearch && matchesFunil && matchesStatus
                  }).map((lead) => {
                    const estagio = estagios.find(e => e.CODESTAGIO === lead.CODESTAGIO)
                    const parceiro = lead.CODPARC || 'N/A'

                    return (
                      <tr 
                        key={lead.CODLEAD} 
                        onClick={() => handleEdit(lead)}
                        className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                              {lead.NOME.charAt(0)}
                            </div>
                            <span className="font-medium text-foreground">{lead.NOME}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                          {lead.CODPARC 
                            ? `${lead.CODPARC} - ${parceirosMap[lead.CODPARC] || 'Carregando...'}`
                            : 'Não vinculado'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                              <User className="w-3 h-3" />
                            </div>
                            <span className="text-sm">{currentUser?.name || 'Você'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {lead.STATUS_LEAD === 'GANHO' && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium bg-green-100 text-green-700">
                              ✓ Ganho
                            </span>
                          )}
                          {lead.STATUS_LEAD === 'PERDIDO' && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium bg-red-100 text-red-700">
                              ✗ Perdido
                            </span>
                          )}
                          {lead.STATUS_LEAD === 'EM_ANDAMENTO' && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium bg-yellow-100 text-yellow-700">
                              ⏳ Em andamento
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <div 
                              className="w-2 h-2 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: estagio?.COR || '#gray' }}
                            />
                            <span className="text-sm">{estagio?.NOME || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground whitespace-nowrap">
                          {formatCurrency(lead.VALOR)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t bg-muted/30">
            <p className="text-sm text-muted-foreground">
              Exibindo {leads.filter(lead => {
                const matchesSearch = searchTerm === '' || 
                                     (lead.CODPARC && lead.CODPARC.toLowerCase().includes(searchTerm.toLowerCase()))
                const matchesFunil = lead.CODFUNIL === selectedFunil.CODFUNIL
                const matchesStatus = statusFilter === 'TODOS' || 
                                     (statusFilter === 'EM_ANDAMENTO' && (!lead.STATUS_LEAD || lead.STATUS_LEAD === 'EM_ANDAMENTO')) ||
                                     lead.STATUS_LEAD === statusFilter
                return matchesSearch && matchesFunil && matchesStatus
              }).length} de {leads.filter(lead => {
                const matchesFunil = lead.CODFUNIL === selectedFunil.CODFUNIL
                const matchesStatus = statusFilter === 'TODOS' || 
                                     (statusFilter === 'EM_ANDAMENTO' && (!lead.STATUS_LEAD || lead.STATUS_LEAD === 'EM_ANDAMENTO')) ||
                                     lead.STATUS_LEAD === statusFilter
                return matchesFunil && matchesStatus
              }).length} negócio(s)
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Kanban Board - Desktop and Mobile */}
          {isMobile ? (
        // Visualização Mobile com Tabs
        <div className="space-y-0 md:px-0">
          {estagios.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Configure os estágios deste funil para começar
            </div>
          ) : (
            <Tabs value={selectedEstagioTab} onValueChange={setSelectedEstagioTab} className="w-full">
              <div className="w-full border-b sticky top-0 bg-background z-10">
                <TabsList className="w-full grid h-12 bg-transparent rounded-none" style={{ gridTemplateColumns: `repeat(${estagios.length}, minmax(0, 1fr))` }}>
                  {estagios.sort((a, b) => a.ORDEM - b.ORDEM).map((estagio) => {
                    const leadsList = getLeadsByEstagio(estagio.CODESTAGIO)
                    return (
                      <TabsTrigger 
                        key={estagio.CODESTAGIO} 
                        value={estagio.CODESTAGIO}
                        className="flex flex-col items-center justify-center gap-0.5 px-1 py-2 h-full min-w-0 data-[state=active]:border-b-2 rounded-none data-[state=active]:shadow-none"
                        style={{
                          borderColor: estagio.COR
                        }}
                      >
                        <span className="text-xs font-medium truncate max-w-full">{estagio.NOME}</span>
                        <span className="text-[10px] opacity-60 flex-shrink-0">{leadsList.length}</span>
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
              </div>

              {estagios.sort((a, b) => a.ORDEM - b.ORDEM).map((estagio) => {
                const leadsList = getLeadsByEstagio(estagio.CODESTAGIO)
                const totalValue = leadsList.reduce((sum, lead) => sum + (Number(lead.VALOR) || 0), 0)

                return (
                  <TabsContent key={estagio.CODESTAGIO} value={estagio.CODESTAGIO} className="mt-0">
                    {/* Sub-header discreto */}
                    <div className="px-4 py-2 bg-muted/30 border-b">
                      <p className="text-xs text-muted-foreground">
                        {leadsList.length} {leadsList.length === 1 ? 'negócio' : 'negócios'} • {formatCurrency(totalValue)}
                      </p>
                    </div>

                    {/* Cards dos Leads */}
                    <div className="space-y-0">
                      {isLoading ? (
                        <>
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-card p-4 border-b animate-pulse">
                              <div className="space-y-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-muted"></div>
                                    <div className="space-y-1.5">
                                      <div className="h-5 w-32 bg-muted rounded"></div>
                                      <div className="h-3 w-24 bg-muted rounded"></div>
                                    </div>
                                  </div>
                                </div>
                                <div className="h-4 w-20 bg-muted rounded"></div>
                              </div>
                            </div>
                          ))}
                        </>
                      ) : leadsList.length === 0 ? (
                        <div className="flex items-center justify-center h-48 px-4">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Nenhum negócio nesta etapa</p>
                          </div>
                        </div>
                      ) : (
                        leadsList.map((lead, index) => (
                          <div
                            key={`${estagio.CODESTAGIO}-${lead.CODLEAD || `temp-${index}`}`}
                            className="bg-card border-b last:border-b-0 hover:bg-muted/30 active:bg-muted/50 transition-colors relative"
                          >
                            {/* Barra Colorida Lateral */}
                            <div 
                              className="absolute left-0 top-0 bottom-0 w-1" 
                              style={{ backgroundColor: estagio.COR }}
                            />
                            <div className="p-4 pl-5">
                              <div className="space-y-2.5">
                                {/* Lead Header */}
                                <div className="flex items-start justify-between gap-3">
                                  <div 
                                    className="flex items-center gap-3 flex-1 min-w-0"
                                    onClick={() => handleEdit(lead)}
                                  >
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-base font-bold flex-shrink-0">
                                      {lead.NOME.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-normal text-base text-foreground leading-tight truncate">{lead.NOME}</h4>
                                      {lead.CODPARC && (
                                        <div className="flex items-center gap-1 mt-0.5">
                                          <User className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                          <span className="text-xs text-muted-foreground truncate">
                                            {parceirosMap[lead.CODPARC] || lead.CODPARC}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {/* Dropdown Alterar Estágio - Sempre visível */}
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                        <button 
                                          className="p-1.5 hover:bg-blue-50 active:bg-blue-100 rounded-md flex-shrink-0 text-blue-600 transition-colors"
                                          disabled={lead.STATUS_LEAD === 'GANHO' || lead.STATUS_LEAD === 'PERDIDO'}
                                          title="Alterar estágio"
                                        >
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                          </svg>
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-52">
                                        <DropdownMenuLabel className="text-xs font-semibold">Mover para estágio</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {estagios.sort((a, b) => a.ORDEM - b.ORDEM).map((est) => (
                                          <DropdownMenuItem
                                            key={est.CODESTAGIO}
                                            disabled={lead.STATUS_LEAD === 'GANHO' || lead.STATUS_LEAD === 'PERDIDO' || est.CODESTAGIO === lead.CODESTAGIO}
                                            onClick={async (e) => {
                                              e.stopPropagation()
                                              if (lead.STATUS_LEAD === 'GANHO' || lead.STATUS_LEAD === 'PERDIDO') return
                                              if (est.CODESTAGIO === lead.CODESTAGIO) return

                                              try {
                                                console.log('🔄 Dropdown Mobile - Atualizando estágio:', { 
                                                  CODLEAD: lead.CODLEAD, 
                                                  de: lead.CODESTAGIO,
                                                  para: est.CODESTAGIO 
                                                })

                                                // Atualizar no banco de dados PRIMEIRO
                                                const response = await fetch('/api/leads/atualizar-estagio', {
                                                  method: 'POST',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify({
                                                    codLeed: lead.CODLEAD,
                                                    novoEstagio: est.CODESTAGIO
                                                  })
                                                })

                                                if (!response.ok) {
                                                  const error = await response.json()
                                                  throw new Error(error.error || 'Falha ao atualizar estágio')
                                                }

                                                // Atualizar estado local DEPOIS do sucesso no banco
                                                setLeads(prev => prev.map(l => 
                                                  l.CODLEAD === lead.CODLEAD 
                                                    ? { ...l, CODESTAGIO: est.CODESTAGIO }
                                                    : l
                                                ))

                                                console.log('✅ Dropdown Mobile - Estágio atualizado com sucesso')

                                                toast({
                                                  title: "Sucesso",
                                                  description: `Lead movido para ${est.NOME}`,
                                                })
                                              } catch (error: any) {
                                                console.error('❌ Dropdown Mobile - Erro:', error)
                                                toast({
                                                  title: "Erro",
                                                  description: error.message || "Falha ao atualizar estágio",
                                                  variant: "destructive",
                                                })
                                              }
                                            }}
                                          >
                                            <div className="flex items-center gap-2 w-full">
                                              <div 
                                                className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                                                style={{ backgroundColor: est.COR }}
                                              />
                                              <span className="flex-1 text-sm">{est.NOME}</span>
                                              {est.CODESTAGIO === lead.CODESTAGIO && (
                                                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                              )}
                                            </div>
                                          </DropdownMenuItem>
                                        ))}
                                      </DropdownMenuContent>
                                    </DropdownMenu>

                                    {/* Dropdown Mais Opções */}
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                        <button className="p-1.5 hover:bg-muted active:bg-muted/80 rounded-md flex-shrink-0 transition-colors" title="Mais opções">
                                          <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem onClick={(e) => {
                                          e.stopPropagation()
                                          handleEdit(lead)
                                        }}>
                                          <Pencil className="w-4 h-4 mr-2" />
                                          Editar
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>

                                {/* Lead Info */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1">
                                    <span className="font-normal text-base text-foreground">{formatCurrency(lead.VALOR)}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">{formatDate(lead.DATA_VENCIMENTO)}</span>
                                  </div>
                                </div>

                                {/* Tags */}
                                {(lead.TIPO_TAG || lead.STATUS_LEAD !== 'EM_ANDAMENTO') && (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {lead.TIPO_TAG && (
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TAG_COLORS[lead.TIPO_TAG] || 'bg-gray-100 text-gray-700'}`}>
                                        {lead.TIPO_TAG}
                                      </span>
                                    )}
                                    {lead.STATUS_LEAD === 'GANHO' && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                                        ✓ Ganho
                                      </span>
                                    )}
                                    {lead.STATUS_LEAD === 'PERDIDO' && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">
                                        ✗ Perdido
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>
                )
              })}
            </Tabs>
          )}
        </div>
      ) : (
        // Visualização Desktop - Kanban
        <div className="grid gap-4" style={{ 
          gridTemplateColumns: `repeat(${estagios.length || 1}, minmax(300px, 1fr))` 
        }}>
          {estagios.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              Configure os estágios deste funil para começar
            </div>
          ) : (
            estagios.sort((a, b) => a.ORDEM - b.ORDEM).map((estagio) => {
              const leadsList = getLeadsByEstagio(estagio.CODESTAGIO)
              const totalValue = leadsList.reduce((sum, lead) => sum + (Number(lead.VALOR) || 0), 0)

              return (
                <div
                  key={estagio.CODESTAGIO}
                  className={`bg-card rounded-lg overflow-hidden min-h-[600px] transition-all shadow-sm border border-border ${
                    draggedLead && draggedLead.CODESTAGIO !== estagio.CODESTAGIO 
                      ? 'ring-2 ring-primary/50 bg-primary/5' 
                      : ''
                  }`}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(estagio.CODESTAGIO, estagio.NOME)}
                >
                  {/* Color Bar */}
                  <div 
                    className="h-2 w-full" 
                    style={{ backgroundColor: estagio.COR }}
                  />

                  {/* Column Header */}
                  <div className="flex flex-col gap-2 p-4 pb-3 border-b border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{estagio.NOME}</h3>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {leadsList.length} {leadsList.length === 1 ? 'negócio' : 'negócios'}
                      </span>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(totalValue)}
                      </span>
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="space-y-3 p-4">
                    {isLoading ? (
                      <>
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="bg-card rounded-lg p-4 shadow-sm border border-border animate-pulse">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-muted"></div>
                                  <div>
                                    <div className="h-4 w-24 bg-muted rounded mb-1"></div>
                                    <div className="h-3 w-32 bg-muted rounded"></div>
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="h-3 w-full bg-muted rounded"></div>
                                <div className="h-6 w-20 bg-muted rounded"></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    ) : leadsList.length === 0 ? (
                      <div className="flex items-center justify-center h-64 border-2 border-dashed border-muted-foreground/20 rounded-lg">
                        <div className="text-center p-6">
                          <p className="text-sm text-muted-foreground">
                            Arraste para cá,<br/>para adicionar negócios<br/>nessa etapa
                          </p>
                        </div>
                      </div>
                    ) : (
                      leadsList.map((lead, index) => (
                        <div
                          key={`${estagio.CODESTAGIO}-${lead.CODLEAD || `temp-${index}`}`}
                          draggable={lead.STATUS_LEAD !== 'GANHO' && lead.STATUS_LEAD !== 'PERDIDO'}
                          onDragStart={() => handleDragStart(lead)}
                          onDragEnd={() => setDraggedLead(null)}
                          className={`bg-card rounded-lg shadow-sm hover:shadow-md transition-all border border-border relative overflow-hidden ${
                            lead.STATUS_LEAD === 'GANHO' || lead.STATUS_LEAD === 'PERDIDO' 
                              ? 'cursor-pointer' 
                              : 'cursor-move'
                          } ${
                            draggedLead?.CODLEAD === lead.CODLEAD ? 'opacity-50 scale-95' : ''
                          }`}
                        >
                          {/* Barra Colorida Lateral */}
                          <div 
                            className="absolute left-0 top-0 bottom-0 w-1" 
                            style={{ backgroundColor: estagio.COR }}
                          />
                          <div className="p-4 pl-5">
                          <div className="space-y-3">
                            {/* Lead Header */}
                            <div className="flex items-start justify-between">
                              <div 
                                className="flex items-center gap-2 flex-1 cursor-pointer"
                                onClick={(e) => {
                                  if (!draggedLead) {
                                    handleEdit(lead)
                                  }
                                }}
                              >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                                  {lead.NOME.charAt(0)}
                                </div>
                                <div>
                                  <h4 className="font-semibold text-sm text-foreground">{lead.NOME}</h4>
                                  <p className="text-xs text-muted-foreground">{lead.DESCRICAO}</p>
                                  <div className="flex flex-col gap-1 mt-1">
                                    <div className="flex items-center gap-1">
                                      <User className="w-3 h-3 text-muted-foreground" />
                                      <span className="text-xs text-muted-foreground">
                                        {lead.CODPARC 
                                          ? `${lead.CODPARC} - ${parceirosMap[lead.CODPARC] || 'Carregando...'}`
                                          : 'Não vinculado'}
                                      </span>
                                    </div>
                                    {lead.CODUSUARIO && (
                                      <div className="flex items-center gap-1">
                                        <div className="w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center">
                                          <span className="text-[8px] text-white font-bold">
                                            {(usuariosMap[lead.CODUSUARIO] || 'U')[0].toUpperCase()}
                                          </span>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                          {usuariosMap[lead.CODUSUARIO] || 'Carregando...'}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {/* Dropdown de mais opções - Desktop */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      className="h-7 w-7 p-0" 
                                      title="Mais opções"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem onClick={(e) => {
                                      e.stopPropagation()
                                      handleEdit(lead)
                                    }}>
                                      <Pencil className="w-4 h-4 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>

                            {/* Lead Info */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-xs">
                                <DollarSign className="w-3 h-3 text-muted-foreground" />
                                <span className="font-semibold text-foreground">{formatCurrency(lead.VALOR)}</span>
                                <span className="text-muted-foreground">•</span>
                                <Calendar className="w-3 h-3 text-muted-foreground" />
                                <span className="text-muted-foreground">{formatDate(lead.DATA_VENCIMENTO)}</span>
                              </div>

                              {/* Tag e Status */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs px-2 py-1 rounded-md font-medium ${TAG_COLORS[lead.TIPO_TAG] || 'bg-gray-100 text-gray-700'}`}>
                                  {lead.TIPO_TAG}
                                </span>
                                {lead.STATUS_LEAD === 'GANHO' && (
                                  <span className="text-xs px-2 py-1 rounded-md font-medium bg-green-100 text-green-700">
                                    ✓ Ganho
                                  </span>
                                )}
                                {lead.STATUS_LEAD === 'PERDIDO' && (
                                  <span className="text-xs px-2 py-1 rounded-md font-medium bg-red-100 text-red-700">
                                    ✗ Perdido
                                  </span>
                                )}
                                {lead.STATUS_LEAD === 'EM_ANDAMENTO' && (
                                  <span className="text-xs px-2 py-1 rounded-md font-medium bg-blue-100 text-blue-700">
                                    ⏳ Em Andamento
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
        </>
      )}



      <LeadCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleSave}
        funilSelecionado={selectedFunil ? { CODFUNIL: selectedFunil.CODFUNIL, estagios } : undefined}
      />

      <LeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        lead={selectedLead}
        onSave={handleSave}
        funilSelecionado={selectedFunil ? { CODFUNIL: selectedFunil.CODFUNIL, estagios } : undefined}
        onLeadUpdated={async () => {
          console.log('🔄 Lead atualizado - recarregando kanban...')
          await loadLeads()
        }}
      />

      {/* Modais sempre disponíveis */}
      <FunilModal
        isOpen={isFunilModalOpen}
        onClose={() => setIsFunilModalOpen(false)}
        funil={selectedFunilForEdit}
        onSave={handleFunilSaved}
      />
      <EstagiosModal
        isOpen={isEstagiosModalOpen}
        onClose={() => setIsEstagiosModalOpen(false)}
        funil={selectedFunilForEdit}
        onSave={handleEstagiosSaved}
      />
    </div>
  )
}