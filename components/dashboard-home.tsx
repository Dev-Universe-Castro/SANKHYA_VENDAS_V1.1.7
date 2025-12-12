"use client"

import { Sparkles, BarChart3, Target, CheckCircle, XCircle, DollarSign, TrendingUp, TrendingDown, Package } from "lucide-react"
import { useState, useEffect } from "react"
import { authService } from "@/lib/auth-service"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { AssistenteModal } from "@/components/assistente-modal"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts'

interface Funil {
  CODFUNIL: string
  NOME: string
  COR: string
}

interface Parceiro {
  CODPARC: number
  NOMEPARC: string
}

interface DashboardData {
  totalLeads: number
  leadsGanhos: number
  leadsPerdidos: number
  valorTotal: number
  leadsGanhosPerdidosPorDia: Array<{
    data: string
    ganhos: number
    perdidos: number
  }>
  dadosFunil: Array<{
    estagio: string
    quantidade: number
    cor: string
    ordem: number
  }>
  leadsDetalhados: Array<{
    CODLEAD: number
    TITULO: string
    NOMEPARC: string
    VALOR: number
    STATUS_LEAD: string
    NOME_ESTAGIO: string
    COR_ESTAGIO: string
    DATA_CRIACAO: string
  }>
}

export default function DashboardHome() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  // Removed assistenteOpen state as per intention
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [dataInicio, setDataInicio] = useState("")
  const [dataFim, setDataFim] = useState("")
  const [funis, setFunis] = useState<Funil[]>([])
  const [funilSelecionado, setFunilSelecionado] = useState<string>("")
  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [parceiroSelecionado, setParceiroSelecionado] = useState<string>("")
  const [buscaParceiro, setBuscaParceiro] = useState("")
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  // States for displayed funnel (only updated when "Filtrar" is clicked)
  const [nomeFunilExibido, setNomeFunilExibido] = useState('')
  const [corFunilExibido, setCorFunilExibido] = useState('#3b82f6') // Default blue
  
  // Estados para análise de clientes
  const [abaAtiva, setAbaAtiva] = useState<'funis' | 'clientes'>('funis')
  const [parceiroAnalise, setParceiroAnalise] = useState<string>("")
  const [nomeParceiroAnalise, setNomeParceiroAnalise] = useState<string>("")
  const [buscaParceiroAnalise, setBuscaParceiroAnalise] = useState("")
  const [parceirosFiltradosAnalise, setParceirosFiltradosAnalise] = useState<Parceiro[]>([])
  const [mostrarDropdownAnalise, setMostrarDropdownAnalise] = useState(false)
  const [isLoadingCliente, setIsLoadingCliente] = useState(false)
  const [pedidosFDVCliente, setPedidosFDVCliente] = useState<any[]>([])
  const [leadsCliente, setLeadsCliente] = useState<any[]>([])
  const [produtosLeadsCliente, setProdutosLeadsCliente] = useState<any[]>([])
  
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const user = authService.getCurrentUser()
    setCurrentUser(user)

    // Definir filtro de data padrão (últimos 90 dias para garantir dados)
    const hoje = new Date()
    const amanha = new Date(hoje)
    amanha.setDate(hoje.getDate() + 1)

    const noventaDiasAtras = new Date(hoje)
    noventaDiasAtras.setDate(hoje.getDate() - 90)

    const dataFimFormatada = amanha.toISOString().split('T')[0]
    const dataInicioFormatada = noventaDiasAtras.toISOString().split('T')[0]

    console.log('📅 Datas definidas:', { dataInicioFormatada, dataFimFormatada })

    setDataFim(dataFimFormatada)
    setDataInicio(dataInicioFormatada)

    // Carregar funis e parceiros
    loadFunis()
    loadParceirosCompleto()
  }, [])

  const loadFunis = async () => {
    try {
      const response = await fetch('/api/funis')
      if (!response.ok) throw new Error('Erro ao carregar funis')
      const data = await response.json()
      setFunis(data)

      // Selecionar o primeiro funil automaticamente
      if (data.length > 0 && !funilSelecionado) {
        setFunilSelecionado(data[0].CODFUNIL)
      }

      // Initializing the filter funnel state
      if (data.length > 0 && !nomeFunilExibido) {
        setNomeFunilExibido(data[0].NOME)
        setCorFunilExibido(data[0].COR)
      }
    } catch (error) {
      console.error('Erro ao carregar funis:', error)
    }
  }

  const loadParceirosCompleto = async () => {
    try {
      console.log('📊 Carregando parceiros do IndexedDB...')
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const todosParceiros = await OfflineDataService.getParceiros()
      
      if (todosParceiros && todosParceiros.length > 0) {
        setParceiros(todosParceiros)
        console.log('✅ Parceiros carregados do IndexedDB:', todosParceiros.length)
        
        // Log dos primeiros 3 para debug
        console.log('📋 Amostra de parceiros:', todosParceiros.slice(0, 3).map(p => ({
          CODPARC: p.CODPARC,
          NOMEPARC: p.NOMEPARC
        })))
      } else {
        console.warn('⚠️ Nenhum parceiro encontrado no IndexedDB')
        setParceiros([])
      }
    } catch (error) {
      console.error('❌ Erro ao carregar parceiros do IndexedDB:', error)
      setParceiros([])
    }
  }

  // Renamed carregarDashboard to loadDashboardData to match previous usage and intention
  const loadDashboardData = async () => {
    try {
      setIsLoadingData(true)
      console.log('📊 Iniciando carregamento do dashboard...')
      console.log('🔍 Funil selecionado:', funilSelecionado)
      console.log('🔍 Funis disponíveis:', funis.length)

      // Atualizar nome e cor do funil IMEDIATAMENTE ao iniciar o carregamento
      if (funilSelecionado && funis.length > 0) {
        // Garantir comparação correta convertendo ambos para string
        const funil = funis.find(f => String(f.CODFUNIL) === String(funilSelecionado))
        console.log('🔍 Funil encontrado:', funil)
        console.log('🔍 Comparando:', { 
          funilSelecionado: String(funilSelecionado), 
          codigosFunis: funis.map(f => String(f.CODFUNIL)) 
        })
        if (funil) {
          console.log('🎯 Atualizando funil exibido ANTES do carregamento:')
          console.log('   - Nome:', funil.NOME)
          console.log('   - Cor:', funil.COR)
          console.log('   - Código:', funil.CODFUNIL)
          setNomeFunilExibido(funil.NOME)
          setCorFunilExibido(funil.COR)
        } else {
          console.warn('⚠️ Funil não encontrado no array de funis')
          console.warn('   - funilSelecionado:', funilSelecionado, typeof funilSelecionado)
          console.warn('   - funis disponíveis:', funis.map(f => ({ cod: f.CODFUNIL, tipo: typeof f.CODFUNIL })))
        }
      } else {
        console.warn('⚠️ Condições não atendidas:', { funilSelecionado, funisLength: funis.length })
      }

      // Buscar leads filtrados por funil e parceiro
      const leadsParams = new URLSearchParams()
      if (dataInicio) leadsParams.append('dataInicio', dataInicio)
      if (dataFim) leadsParams.append('dataFim', dataFim)
      if (funilSelecionado) leadsParams.append('codFunil', funilSelecionado)
      if (parceiroSelecionado) leadsParams.append('codParc', parceiroSelecionado)

      console.log('🔍 Buscando leads com params:', leadsParams.toString())
      const leadsRes = await fetch(`/api/leads?${leadsParams.toString()}`)
      if (!leadsRes.ok) {
        throw new Error(`Erro ao buscar leads: ${leadsRes.status}`)
      }
      const leads = await leadsRes.json()
      console.log('✅ Leads carregados:', leads.length)

      // Buscar estágios do funil selecionado
      console.log('🔍 Buscando estágios do funil:', funilSelecionado)
      const estagiosRes = await fetch(`/api/funis/estagios?codFunil=${funilSelecionado}`)
      if (!estagiosRes.ok) {
        throw new Error(`Erro ao buscar estágios: ${estagiosRes.status}`)
      }
      const estagios = await estagiosRes.json()
      console.log('✅ Estágios carregados:', estagios.length)

      // Calcular métricas principais
      const totalLeads = leads.length
      const leadsGanhos = leads.filter((l: any) => l.STATUS_LEAD === 'GANHO').length
      const leadsPerdidos = leads.filter((l: any) => l.STATUS_LEAD === 'PERDIDO').length
      const valorTotal = leads.reduce((sum: number, l: any) => sum + (parseFloat(l.VALOR) || 0), 0)

      console.log('📈 Métricas calculadas:', { totalLeads, leadsGanhos, leadsPerdidos, valorTotal })

      // Agrupar leads ganhos e perdidos por dia (valores em reais, últimos 30 dias)
      const leadsGanhosPerdidosPorDia: { [key: string]: { ganhos: number; perdidos: number; data: Date } } = {}

      leads.forEach((lead: any) => {
        if (lead.STATUS_LEAD === 'GANHO' || lead.STATUS_LEAD === 'PERDIDO') {
          // Usar DATA_CONCLUSAO se disponível, senão DATA_ATUALIZACAO, senão DATA_CRIACAO
          let dataEvento: Date
          try {
            if (lead.DATA_CONCLUSAO) {
              const partes = lead.DATA_CONCLUSAO.split('/')
              dataEvento = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]))
            } else if (lead.DATA_ATUALIZACAO) {
              const partes = lead.DATA_ATUALIZACAO.split('/')
              dataEvento = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]))
            } else {
              const partes = lead.DATA_CRIACAO.split('/')
              dataEvento = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]))
            }
          } catch (e) {
            console.warn('Erro ao parsear data do lead:', lead.CODLEAD, e)
            return // Pular datas inválidas
          }

          // Verificar se a data é válida
          if (isNaN(dataEvento.getTime())) {
            console.warn('Data inválida para lead:', lead.CODLEAD)
            return
          }

          const dataStr = dataEvento.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

          if (!leadsGanhosPerdidosPorDia[dataStr]) {
            leadsGanhosPerdidosPorDia[dataStr] = { ganhos: 0, perdidos: 0, data: dataEvento }
          }

          const valor = parseFloat(lead.VALOR) || 0

          if (lead.STATUS_LEAD === 'GANHO') {
            leadsGanhosPerdidosPorDia[dataStr].ganhos += valor
          } else {
            leadsGanhosPerdidosPorDia[dataStr].perdidos += valor
          }
        }
      })

      console.log('📊 Leads ganhos/perdidos agrupados:', Object.keys(leadsGanhosPerdidosPorDia).length, 'dias')

      const leadsGanhosPerdidosPorDiaArray = Object.entries(leadsGanhosPerdidosPorDia)
        .map(([data, valores]) => ({
          data,
          ganhos: valores.ganhos,
          perdidos: valores.perdidos,
          dataObj: valores.data
        }))
        .sort((a, b) => a.dataObj.getTime() - b.dataObj.getTime())
        .slice(-30) // Últimos 30 dias

      console.log('📊 Array final de leads ganhos/perdidos:', leadsGanhosPerdidosPorDiaArray.length, 'dias')

      // Criar dados do funil (quantidade de leads por estágio + ganhos/perdidos)
      const dadosFunilMap: { [key: string]: { quantidade: number; estagio: string; cor: string; ordem: number; ganhos: number; perdidos: number } } = {}

      // Inicializar todos os estágios com 0
      estagios.forEach((estagio: any) => {
        dadosFunilMap[estagio.CODESTAGIO] = {
          estagio: estagio.NOME,
          quantidade: 0,
          cor: estagio.COR || '#94a3b8',
          ordem: estagio.ORDEM,
          ganhos: 0,
          perdidos: 0
        }
      })

      // Contar leads em cada estágio e rastrear ganhos/perdidos
      leads.forEach((lead: any) => {
        if (lead.CODESTAGIO && dadosFunilMap[lead.CODESTAGIO]) {
          dadosFunilMap[lead.CODESTAGIO].quantidade++

          if (lead.STATUS_LEAD === 'GANHO') {
            dadosFunilMap[lead.CODESTAGIO].ganhos++
          } else if (lead.STATUS_LEAD === 'PERDIDO') {
            dadosFunilMap[lead.CODESTAGIO].perdidos++
          }
        }
      })

      const dadosFunil = Object.values(dadosFunilMap)
        .sort((a, b) => a.ordem - b.ordem)

      // Preparar leads detalhados para a tabela
      const leadsDetalhados = leads.map((lead: any) => {
        const estagio = estagios.find((e: any) => e.CODESTAGIO === lead.CODESTAGIO)

        // Buscar o título correto do lead da coluna NOME
        let tituloLead = 'Sem título'
        if (lead.NOME && lead.NOME.trim() !== '') {
          tituloLead = lead.NOME.trim()
        } else if (lead.NOMEPARC) {
          tituloLead = `Lead - ${lead.NOMEPARC}`
        }

        return {
          CODLEAD: lead.CODLEAD,
          TITULO: tituloLead,
          NOMEPARC: lead.NOMEPARC || 'Sem parceiro',
          VALOR: parseFloat(lead.VALOR) || 0,
          STATUS_LEAD: lead.STATUS_LEAD || 'EM_ANDAMENTO',
          NOME_ESTAGIO: estagio?.NOME || 'Sem estágio',
          COR_ESTAGIO: estagio?.COR || '#94a3b8',
          DATA_CRIACAO: lead.DATA_CRIACAO
        }
      }).sort((a: any, b: any) => new Date(b.DATA_CRIACAO).getTime() - new Date(a.DATA_CRIACAO).getTime())

      const dashData = {
        totalLeads,
        leadsGanhos,
        leadsPerdidos,
        valorTotal,
        leadsGanhosPerdidosPorDia: leadsGanhosPerdidosPorDiaArray,
        dadosFunil,
        leadsDetalhados
      }

      console.log('💾 Dados do dashboard preparados:', {
        totalLeads: dashData.totalLeads,
        leadsGanhos: dashData.leadsGanhos,
        leadsPerdidos: dashData.leadsPerdidos,
        valorTotal: dashData.valorTotal,
        diasComDados: dashData.leadsGanhosPerdidosPorDia.length,
        estagiosFunil: dashData.dadosFunil.length,
        leadsDetalhados: dashData.leadsDetalhados.length
      })

      setDashboardData(dashData)

    } catch (error) {
      console.error('❌ Erro ao carregar dados do dashboard:', error)
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados do dashboard. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingData(false)
    }
  }

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  const formatarNumero = (valor: number) => {
    return new Intl.NumberFormat('pt-BR').format(valor)
  }

  const formatarData = (dataISO: string) => {
    if (!dataISO || dataISO === '') return 'Sem data'
    try {
      // Se a data já está no formato DD/MM/YYYY, retornar diretamente
      if (dataISO.includes('/')) {
        return dataISO
      }
      // Se a data está no formato ISO (YYYY-MM-DD)
      if (dataISO.includes('-')) {
        const [ano, mes, dia] = dataISO.split('-')
        return `${dia}/${mes}/${ano}`
      }
      // Tentar criar Date object como último recurso
      const date = new Date(dataISO)
      if (isNaN(date.getTime())) return 'Sem data'
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch (e) {
      console.error('Erro ao formatar data:', dataISO, e)
      return 'Sem data'
    }
  }

  const handleBuscaParceiroAnalise = (value: string) => {
    setBuscaParceiroAnalise(value)
    
    if (value.length < 2) {
      setParceirosFiltradosAnalise([])
      setMostrarDropdownAnalise(false)
      return
    }

    const searchLower = value.toLowerCase()
    const filtered = parceiros.filter((p: any) =>
      p.NOMEPARC?.toLowerCase().includes(searchLower) ||
      p.CGC_CPF?.includes(value) ||
      p.RAZAOSOCIAL?.toLowerCase().includes(searchLower) ||
      p.CODPARC?.toString().includes(value)
    )
    setParceirosFiltradosAnalise(filtered.slice(0, 10)) // Limitar a 10 resultados
    setMostrarDropdownAnalise(true)
  }

  const handleSelecionarParceiroAnalise = (parceiro: Parceiro) => {
    setParceiroAnalise(String(parceiro.CODPARC))
    setBuscaParceiroAnalise(parceiro.NOMEPARC)
    setNomeParceiroAnalise(parceiro.NOMEPARC)
    setMostrarDropdownAnalise(false)
  }

  const loadDadosCliente = async () => {
    if (!parceiroAnalise) {
      toast({
        title: "Atenção",
        description: "Selecione um parceiro para análise",
        variant: "destructive",
      })
      return
    }

    try {
      setIsLoadingCliente(true)
      console.log('📊 Carregando dados do cliente:', parceiroAnalise)

      // Buscar dados do parceiro do IndexedDB
      try {
        const { OfflineDataService } = await import('@/lib/offline-data-service')
        const todosParceirosBusca = await OfflineDataService.getParceiros()
        const parceiro = todosParceirosBusca.find((p: any) => String(p.CODPARC) === String(parceiroAnalise))
        
        if (parceiro) {
          setNomeParceiroAnalise(parceiro.NOMEPARC)
          console.log('✅ Parceiro encontrado no IndexedDB:', parceiro.NOMEPARC)
        } else {
          console.warn('⚠️ Parceiro não encontrado no IndexedDB')
          setNomeParceiroAnalise(`Parceiro ${parceiroAnalise}`)
        }
      } catch (error) {
        console.error('❌ Erro ao buscar parceiro do IndexedDB:', error)
        setNomeParceiroAnalise(`Parceiro ${parceiroAnalise}`)
      }

      // 1. Buscar pedidos FDV do cliente
      const pedidosFDVRes = await fetch(`/api/pedidos-fdv`)
      if (pedidosFDVRes.ok) {
        const todosPedidos = await pedidosFDVRes.json()
        // Filtrar pedidos que têm o CODPARC no corpo JSON
        const pedidosDoCliente = todosPedidos.filter((p: any) => {
          try {
            const corpo = typeof p.CORPO_JSON === 'string' ? JSON.parse(p.CORPO_JSON) : p.CORPO_JSON
            return corpo && String(corpo.CODPARC) === String(parceiroAnalise)
          } catch (e) {
            return false
          }
        })
        setPedidosFDVCliente(pedidosDoCliente)
        console.log('✅ Pedidos FDV do cliente:', pedidosDoCliente.length)
      }

      // 2. Buscar leads do cliente
      const leadsRes = await fetch(`/api/leads?codParc=${parceiroAnalise}`)
      if (leadsRes.ok) {
        const leads = await leadsRes.json()
        setLeadsCliente(leads)
        console.log('✅ Leads do cliente:', leads.length)

        // 3. Buscar produtos de todos os leads do cliente
        const produtosPromises = leads.map(async (lead: any) => {
          try {
            const prodRes = await fetch(`/api/leads/produtos?codLead=${lead.CODLEAD}`)
            if (prodRes.ok) {
              const produtos = await prodRes.json()
              return produtos.map((p: any) => ({
                ...p,
                NOME_LEAD: lead.NOME,
                STATUS_LEAD: lead.STATUS_LEAD
              }))
            }
          } catch (e) {
            console.error('Erro ao buscar produtos do lead:', lead.CODLEAD, e)
          }
          return []
        })

        const produtosArrays = await Promise.all(produtosPromises)
        const todosProdutos = produtosArrays.flat()
        setProdutosLeadsCliente(todosProdutos)
        console.log('✅ Produtos dos leads:', todosProdutos.length)
      }

      toast({
        title: "Sucesso",
        description: "Dados do cliente carregados",
      })

    } catch (error) {
      console.error('❌ Erro ao carregar dados do cliente:', error)
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados do cliente",
        variant: "destructive",
      })
    } finally {
      setIsLoadingCliente(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'GANHO':
        return <Badge className="bg-green-500 text-white">Ganho</Badge>
      case 'PERDIDO':
        return <Badge className="bg-red-500 text-white">Perdido</Badge>
      default:
        return <Badge className="bg-blue-500 text-white">Em Andamento</Badge>
    }
  }

  useEffect(() => {
    // Carregar dados apenas na primeira vez quando os filtros iniciais forem definidos
    if (dataInicio && dataFim && funilSelecionado && !dashboardData) {
      console.log('🔄 Carregando dados iniciais:', { dataInicio, dataFim, funilSelecionado, parceiroSelecionado })
      loadDashboardData().finally(() => setIsInitialLoading(false))
    }
  }, [dataInicio, dataFim, funilSelecionado])


  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 md:space-y-6 p-3 md:p-6 pb-20 lg:pb-6">
      {/* Seção de Destaque IA - Compacta - Apenas Desktop */}
      <div className="hidden md:block relative overflow-hidden rounded-lg bg-gradient-to-r from-primary/10 via-purple-500/10 to-primary/10 border border-primary/20 p-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/1.png" alt="IA" className="w-8 h-8 animate-pulse" />
            <div>
              <h3 className="font-semibold text-lg bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Inteligência Artificial Integrada
              </h3>
              <p className="text-xs text-muted-foreground">
                Seu diferencial competitivo em vendas e análises
              </p>
            </div>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 md:flex-none gap-2 border-primary/30 hover:bg-primary/10"
              onClick={() => router.push('/dashboard/chat')}
            >
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="hidden sm:inline">IA Assistente</span>
              <span className="sm:hidden">Assistente</span>
              <Badge className="bg-green-500 text-white text-xs ml-1">Ativo</Badge>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="flex-1 md:flex-none gap-2 border-purple-500/30 hover:bg-purple-500/10"
              onClick={() => router.push('/dashboard/analise')}
            >
              <BarChart3 className="w-4 h-4 text-purple-500" />
              <span className="hidden sm:inline">IA Análise</span>
              <span className="sm:hidden">Análise</span>
              <Badge className="bg-purple-500 text-white text-xs ml-1">Ativo</Badge>
            </Button>
          </div>
        </div>
      </div>

      {/* Header com título */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            {/* Header - Mobile */}
            <div className="md:hidden border-b px-3 py-3">
              <h1 className="text-lg font-bold">Dashboard</h1>
              <p className="text-xs text-muted-foreground">
                Visão geral do seu negócio
              </p>
            </div>
            <h1 className="hidden md:block text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="hidden md:block text-sm text-muted-foreground">Visão geral do seu negócio</p>
          </div>
        </div>
      </div>

      {/* Tabs para Funis e Clientes - Movido para cima */}
      <Tabs value={abaAtiva} onValueChange={(value) => setAbaAtiva(value as 'funis' | 'clientes')} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="funis">Análise de Funis</TabsTrigger>
          <TabsTrigger value="clientes">Análise de Clientes</TabsTrigger>
        </TabsList>

        <TabsContent value="funis" className="space-y-4 mt-4">
          {/* Filtros específicos para Funis - Desktop */}
          <div className="hidden md:block p-4 bg-muted/30 rounded-lg border">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
              <div className="space-y-1.5">
                <Label htmlFor="dataInicio" className="text-xs font-medium">
                  Data Início
                </Label>
                <Input
                  type="date"
                  id="dataInicio"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dataFim" className="text-xs font-medium">
                  Data Fim
                </Label>
                <Input
                  type="date"
                  id="dataFim"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="funil" className="text-xs font-medium">
                  Funil
                </Label>
                <div className="relative">
                  {funilSelecionado && funis.find(f => f.CODFUNIL === funilSelecionado) && (
                    <div
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full z-10 pointer-events-none"
                      style={{ backgroundColor: funis.find(f => f.CODFUNIL === funilSelecionado)?.COR || '#3b82f6' }}
                    />
                  )}
                  <select
                    id="funil"
                    value={funilSelecionado}
                    onChange={(e) => setFunilSelecionado(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-input bg-white text-sm shadow-xs hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-ring"
                    style={{ paddingLeft: funilSelecionado ? '2rem' : '0.75rem', paddingRight: '0.75rem' }}
                  >
                    {funis.map((funil) => (
                      <option key={funil.CODFUNIL} value={funil.CODFUNIL}>
                        {funil.NOME}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => {
                console.log('🔘 Botão Filtrar clicado - Desktop - Funis');
                console.log('🔍 Dados dos filtros:', { dataInicio, dataFim, funilSelecionado, parceiroSelecionado });
                loadDashboardData();
              }}
              disabled={isLoadingData}
              className="w-full h-9 bg-green-600 hover:bg-green-700 text-white transition-colors duration-200"
            >
              {isLoadingData ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Filtrando...
                </>
              ) : (
                'Filtrar'
              )}
            </Button>
          </div>

          {/* Filtros específicos para Funis - Mobile */}
          <div className="md:hidden border rounded-lg">
            <Collapsible open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50"
                >
                  <span className="font-medium">Filtros de Busca</span>
                  {filtrosAbertos ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-1 gap-3 p-4 bg-muted/30">
                  <div className="space-y-1.5">
                    <Label htmlFor="dataInicioMobile" className="text-xs font-medium">
                      Data Início
                    </Label>
                    <Input
                      type="date"
                      id="dataInicioMobile"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="dataFimMobile" className="text-xs font-medium">
                      Data Fim
                    </Label>
                    <Input
                      type="date"
                      id="dataFimMobile"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="funilMobile" className="text-xs font-medium">
                      Funil
                    </Label>
                    <div className="relative">
                      {funilSelecionado && funis.find(f => f.CODFUNIL === funilSelecionado) && (
                        <div
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full z-10 pointer-events-none"
                          style={{ backgroundColor: funis.find(f => f.CODFUNIL === funilSelecionado)?.COR || '#3b82f6' }}
                        />
                      )}
                      <select
                        id="funilMobile"
                        value={funilSelecionado}
                        onChange={(e) => setFunilSelecionado(e.target.value)}
                        className="w-full h-9 px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        style={{ paddingLeft: funilSelecionado ? '2rem' : '0.75rem', paddingRight: '0.75rem' }}
                      >
                        {funis.map((funil) => (
                          <option key={funil.CODFUNIL} value={funil.CODFUNIL}>
                            {funil.NOME}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Botão Filtrar - Mobile */}
          <div className="md:hidden">
            <Button
              type="button"
              onClick={() => {
                console.log('🔘 Botão Filtrar clicado - Mobile - Funis');
                console.log('🔍 Dados dos filtros:', { dataInicio, dataFim, funilSelecionado, parceiroSelecionado });
                loadDashboardData();
              }}
              className="w-full bg-green-600 hover:bg-green-700 text-white transition-colors duration-200"
              disabled={isLoadingData}
            >
              {isLoadingData ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Filtrando...
                </>
              ) : (
                'Filtrar'
              )}
            </Button>
          </div>
          {/* Indicador de Funil Ativo */}
          {nomeFunilExibido && dashboardData && (
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-muted/50 to-muted/30 rounded-lg border-l-4" style={{ borderLeftColor: corFunilExibido }}>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full shadow-sm"
                  style={{ backgroundColor: corFunilExibido }}
                />
                <div>
                  <p className="text-xs text-muted-foreground">Visualizando funil:</p>
                  <p className="text-sm font-semibold" style={{ color: corFunilExibido }}>
                    {nomeFunilExibido}
                  </p>
                </div>
              </div>
              <div className="ml-auto text-xs text-muted-foreground">
                {dataInicio && dataFim && (
                  <span>
                    Período: {formatarData(dataInicio)} até {formatarData(dataFim)}
                  </span>
                )}
              </div>
            </div>
          )}

      {/* 4 Cards Principais - Grid 2x2 no mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-2.5 md:p-4">
            <CardTitle className="text-[11px] md:text-sm font-medium text-muted-foreground leading-tight">
              Total de Leads
            </CardTitle>
            <Target className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-500 flex-shrink-0" />
          </CardHeader>
          <CardContent className="p-2.5 md:p-4 pt-0">
            <div className="text-xl md:text-2xl font-bold leading-none mb-1">{formatarNumero(dashboardData?.totalLeads || 0)}</div>
            <p className="text-[9px] md:text-xs text-muted-foreground leading-tight">
              {dashboardData?.totalLeads ? ((dashboardData.totalLeads - dashboardData.leadsGanhos - dashboardData.leadsPerdidos)) : 0} em andamento
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-2.5 md:p-4">
            <CardTitle className="text-[11px] md:text-sm font-medium text-muted-foreground leading-tight">
              Leads Ganhos
            </CardTitle>
            <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-500 flex-shrink-0" />
          </CardHeader>
          <CardContent className="p-2.5 md:p-4 pt-0">
            <div className="text-xl md:text-2xl font-bold leading-none mb-1">{formatarNumero(dashboardData?.leadsGanhos || 0)}</div>
            <p className="text-[9px] md:text-xs text-green-600 leading-tight">
              {dashboardData?.totalLeads ? ((dashboardData.leadsGanhos / dashboardData.totalLeads) * 100).toFixed(1) : 0}% do total
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-2.5 md:p-4">
            <CardTitle className="text-[11px] md:text-sm font-medium text-muted-foreground leading-tight">
              Leads Perdidos
            </CardTitle>
            <TrendingDown className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-500 flex-shrink-0" />
          </CardHeader>
          <CardContent className="p-2.5 md:p-4 pt-0">
            <div className="text-xl md:text-2xl font-bold leading-none mb-1">{formatarNumero(dashboardData?.leadsPerdidos || 0)}</div>
            <p className="text-[9px] md:text-xs text-red-600 leading-tight">
              {dashboardData?.totalLeads ? ((dashboardData.leadsPerdidos / dashboardData.totalLeads) * 100).toFixed(1) : 0}% do total
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-2.5 md:p-4">
            <CardTitle className="text-[11px] md:text-sm font-medium text-muted-foreground leading-tight">
              Valor Total
            </CardTitle>
            <DollarSign className="w-3.5 h-3.5 md:w-4 md:h-4 text-purple-500 flex-shrink-0" />
          </CardHeader>
          <CardContent className="p-2.5 md:p-4 pt-0">
            <div className="text-xl md:text-2xl font-bold leading-none mb-1">R$ {formatarNumero(dashboardData?.valorTotal || 0)}</div>
            <p className="text-[9px] md:text-xs text-muted-foreground leading-tight">Ticket médio: R$ {formatarNumero(dashboardData?.ticketMedio || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-2.5 md:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-2.5 md:p-6 pb-2">
            <CardTitle className="text-sm md:text-base font-semibold">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent className="p-2.5 md:p-6 pt-0">
            {dashboardData?.leadsGanhosPerdidosPorDia && dashboardData.leadsGanhosPerdidosPorDia.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dashboardData.leadsGanhosPerdidosPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="data" style={{ fontSize: '11px' }} />
                  <YAxis
                    tickFormatter={(value) => {
                      if (value >= 1000) {
                        return `R$ ${(value / 1000).toFixed(0)}k`
                      }
                      return `R$ ${value.toFixed(0)}`
                    }}
                    style={{ fontSize: '11px' }}
                  />
                  <Tooltip
                    formatter={(value: number) => formatarMoeda(value)}
                    labelFormatter={(label) => `Data: ${label}`}
                  />
                  <Legend />
                  <Bar dataKey="ganhos" fill="#22c55e" name="Ganhos (R$)" />
                  <Bar dataKey="perdidos" fill="#ef4444" name="Perdidos (R$)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Nenhum dado disponível para o período
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-2.5 md:p-6 pb-2">
            <CardTitle className="text-sm md:text-base font-semibold">Funil de Vendas</CardTitle>
          </CardHeader>
          <CardContent className="p-2.5 md:p-6 pt-0">
            {dashboardData?.dadosFunil && dashboardData.dadosFunil.length > 0 ? (
              <div className="space-y-2">
                {dashboardData.dadosFunil.map((item, index) => {
                  const maxQuantidade = Math.max(...dashboardData.dadosFunil.map(d => d.quantidade))
                  const larguraPercentual = maxQuantidade > 0 ? (item.quantidade / maxQuantidade) * 100 : 0
                  const larguraMinima = 20 // Largura mínima para visualização
                  const larguraFinal = Math.max(larguraPercentual, larguraMinima)

                  return (
                    <div key={index} className="flex flex-col items-center gap-1">
                      <div
                        className="relative flex items-center justify-center text-white font-semibold rounded-md transition-all hover:opacity-90 group cursor-pointer"
                        style={{
                          backgroundColor: item.cor,
                          width: `${larguraFinal}%`,
                          height: '60px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                        title={`${item.estagio}: ${item.quantidade} leads (Ganhos: ${item.ganhos}, Perdidos: ${item.perdidos})`}
                      >
                        <div className="text-center px-4">
                          <div className="text-sm font-medium">{item.estagio}</div>
                          <div className="text-2xl font-bold">{item.quantidade}</div>
                        </div>

                        {/* Tooltip on hover */}
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-10">
                          <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg whitespace-nowrap">
                            <div className="font-semibold mb-1">{item.estagio}</div>
                            <div className="flex items-center gap-2">
                              <span className="text-green-400">✓ Ganhos: {item.ganhos}</span>
                              <span className="text-red-400">✗ Perdidos: {item.perdidos}</span>
                            </div>
                            <div className="text-gray-300 mt-1">Em andamento: {item.quantidade - item.ganhos - item.perdidos}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Leads */}
      <Card>
        <CardHeader className="p-2.5 md:p-6 pb-2">
          <CardTitle className="text-sm md:text-base font-semibold">Leads Recentes</CardTitle>
        </CardHeader>
        <CardContent className="p-2.5 md:p-6 pt-0">
          {dashboardData?.leadsDetalhados && dashboardData.leadsDetalhados.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Parceiro</TableHead>
                    <TableHead>Estágio</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboardData.leadsDetalhados.slice(0, 10).map((lead) => (
                    <TableRow
                      key={lead.CODLEAD}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/dashboard/leads?leadId=${lead.CODLEAD}`)}
                    >
                      <TableCell className="font-medium">#{lead.CODLEAD}</TableCell>
                      <TableCell>{lead.TITULO}</TableCell>
                      <TableCell>{lead.NOMEPARC}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: lead.COR_ESTAGIO }}
                          />
                          <span className="text-sm">{lead.NOME_ESTAGIO}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">{formatarMoeda(lead.VALOR)}</TableCell>
                      <TableCell>{getStatusBadge(lead.STATUS_LEAD)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatarData(lead.DATA_CRIACAO)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum lead encontrado
            </div>
          )}
        </CardContent>
      </Card>

      </TabsContent>

        <TabsContent value="clientes" className="space-y-4 mt-4">
          {/* Filtros específicos para Clientes - Desktop */}
          <div className="hidden md:block p-4 bg-muted/30 rounded-lg border">
            <div className="grid grid-cols-1 gap-3 mb-3">
              <div className="space-y-1.5 relative">
                <Label htmlFor="parceiroAnalise" className="text-xs font-medium">Cliente/Parceiro</Label>
                <Input
                  id="parceiroAnalise"
                  type="text"
                  placeholder="Digite para buscar cliente..."
                  value={buscaParceiroAnalise}
                  onChange={(e) => handleBuscaParceiroAnalise(e.target.value)}
                  className="h-9 text-sm"
                />
                {mostrarDropdownAnalise && parceirosFiltradosAnalise.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    {parceirosFiltradosAnalise.map((parceiro) => (
                      <div
                        key={parceiro.CODPARC}
                        onClick={() => handleSelecionarParceiroAnalise(parceiro)}
                        className="px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                      >
                        <div className="font-medium text-sm">{parceiro.NOMEPARC}</div>
                        <div className="text-xs text-muted-foreground">
                          Cód: {parceiro.CODPARC} {parceiro.CGC_CPF ? `• ${parceiro.CGC_CPF}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={loadDadosCliente}
              disabled={isLoadingCliente || !parceiroAnalise}
              className="w-full h-9 bg-green-600 hover:bg-green-700 text-white"
            >
              {isLoadingCliente ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Carregando...
                </>
              ) : (
                'Analisar Cliente'
              )}
            </Button>
          </div>

          {/* Filtros específicos para Clientes - Mobile */}
          <div className="md:hidden border rounded-lg">
            <Collapsible open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50"
                >
                  <span className="font-medium">Filtros de Busca</span>
                  {filtrosAbertos ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-1 gap-3 p-4 bg-muted/30">
                  <div className="space-y-1.5 relative">
                    <Label htmlFor="parceiroAnaliseMobile" className="text-xs font-medium">Cliente/Parceiro</Label>
                    <Input
                      id="parceiroAnaliseMobile"
                      type="text"
                      placeholder="Digite para buscar cliente..."
                      value={buscaParceiroAnalise}
                      onChange={(e) => handleBuscaParceiroAnalise(e.target.value)}
                      className="h-9 text-sm"
                    />
                    {mostrarDropdownAnalise && parceirosFiltradosAnalise.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                        {parceirosFiltradosAnalise.map((parceiro) => (
                          <div
                            key={parceiro.CODPARC}
                            onClick={() => handleSelecionarParceiroAnalise(parceiro)}
                            className="px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                          >
                            <div className="font-medium text-sm">{parceiro.NOMEPARC}</div>
                            <div className="text-xs text-muted-foreground">
                              Cód: {parceiro.CODPARC} {parceiro.CGC_CPF ? `• ${parceiro.CGC_CPF}` : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Botão Analisar - Mobile */}
          <div className="md:hidden">
            <Button
              onClick={loadDadosCliente}
              disabled={isLoadingCliente || !parceiroAnalise}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {isLoadingCliente ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Carregando...
                </>
              ) : (
                'Analisar Cliente'
              )}
            </Button>
          </div>

          {/* Indicador de Cliente Ativo */}
          {nomeParceiroAnalise && (
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border-l-4 border-l-blue-500">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Analisando cliente:</p>
                  <p className="text-sm font-semibold text-blue-600">
                    {nomeParceiroAnalise}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Cards de Resumo do Cliente */}
          {nomeParceiroAnalise && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Total de Leads</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{leadsCliente.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {leadsCliente.filter(l => l.STATUS_LEAD === 'GANHO').length} ganhos
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Pedidos FDV</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pedidosFDVCliente.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {pedidosFDVCliente.filter(p => p.STATUS === 'SUCESSO').length} com sucesso
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Produtos de Interesse</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{produtosLeadsCliente.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Set(produtosLeadsCliente.map(p => p.CODPROD)).size} únicos
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tabela de Pedidos FDV */}
          {nomeParceiroAnalise && pedidosFDVCliente.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Últimos Pedidos FDV</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>NUNOTA</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pedidosFDVCliente.slice(0, 10).map((pedido) => (
                        <TableRow key={pedido.ID}>
                          <TableCell className="font-medium">#{pedido.ID}</TableCell>
                          <TableCell>
                            <Badge variant={pedido.ORIGEM === 'LEAD' ? 'default' : 'outline'}>
                              {pedido.ORIGEM}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={pedido.STATUS === 'SUCESSO' ? 'default' : 'destructive'}>
                              {pedido.STATUS}
                            </Badge>
                          </TableCell>
                          <TableCell>{pedido.NUNOTA || '-'}</TableCell>
                          <TableCell className="text-sm">{pedido.NOME_USUARIO}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatarData(pedido.DATA_CRIACAO)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabela de Leads do Cliente */}
          {nomeParceiroAnalise && leadsCliente.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Leads do Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data Criação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leadsCliente.map((lead) => (
                        <TableRow 
                          key={lead.CODLEAD}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/dashboard/leads?leadId=${lead.CODLEAD}`)}
                        >
                          <TableCell className="font-medium">#{lead.CODLEAD}</TableCell>
                          <TableCell>{lead.NOME || 'Sem título'}</TableCell>
                          <TableCell className="font-semibold">
                            {formatarMoeda(parseFloat(lead.VALOR) || 0)}
                          </TableCell>
                          <TableCell>
                            {lead.STATUS_LEAD === 'GANHO' && (
                              <Badge className="bg-green-500 text-white">Ganho</Badge>
                            )}
                            {lead.STATUS_LEAD === 'PERDIDO' && (
                              <Badge className="bg-red-500 text-white">Perdido</Badge>
                            )}
                            {lead.STATUS_LEAD === 'EM_ANDAMENTO' && (
                              <Badge className="bg-blue-500 text-white">Em Andamento</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatarData(lead.DATA_CRIACAO)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Análise de Produtos dos Leads */}
          {nomeParceiroAnalise && produtosLeadsCliente.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Análise de Produtos dos Leads
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Lead</TableHead>
                        <TableHead>Quantidade</TableHead>
                        <TableHead>Valor Unit.</TableHead>
                        <TableHead>Valor Total</TableHead>
                        <TableHead>Status Lead</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {produtosLeadsCliente.map((produto, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            <div>
                              <div className="text-sm">{produto.DESCRPROD}</div>
                              <div className="text-xs text-muted-foreground">Cód: {produto.CODPROD}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{produto.NOME_LEAD}</TableCell>
                          <TableCell>{produto.QUANTIDADE}</TableCell>
                          <TableCell>{formatarMoeda(produto.VLRUNIT)}</TableCell>
                          <TableCell className="font-semibold">{formatarMoeda(produto.VLRTOTAL)}</TableCell>
                          <TableCell>
                            {produto.STATUS_LEAD === 'GANHO' && (
                              <Badge className="bg-green-500 text-white text-xs">Ganho</Badge>
                            )}
                            {produto.STATUS_LEAD === 'PERDIDO' && (
                              <Badge className="bg-red-500 text-white text-xs">Perdido</Badge>
                            )}
                            {produto.STATUS_LEAD === 'EM_ANDAMENTO' && (
                              <Badge className="bg-blue-500 text-white text-xs">Em Andamento</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Resumo de produtos mais frequentes */}
                <div className="mt-6">
                  <h3 className="text-sm font-semibold mb-3">Produtos Mais Frequentes</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(() => {
                      // Agrupar produtos por código e contar
                      const produtosAgrupados = produtosLeadsCliente.reduce((acc: any, prod) => {
                        const key = prod.CODPROD
                        if (!acc[key]) {
                          acc[key] = {
                            CODPROD: prod.CODPROD,
                            DESCRPROD: prod.DESCRPROD,
                            count: 0,
                            totalQtd: 0,
                            totalValor: 0
                          }
                        }
                        acc[key].count++
                        acc[key].totalQtd += prod.QUANTIDADE
                        acc[key].totalValor += prod.VLRTOTAL
                        return acc
                      }, {})

                      // Ordenar por frequência e pegar top 5
                      return Object.values(produtosAgrupados)
                        .sort((a: any, b: any) => b.count - a.count)
                        .slice(0, 5)
                        .map((prod: any, idx) => (
                          <div key={idx} className="p-3 border rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <div className="text-sm font-medium">{prod.DESCRPROD}</div>
                                <div className="text-xs text-muted-foreground">Cód: {prod.CODPROD}</div>
                              </div>
                              <Badge variant="outline">{prod.count}x</Badge>
                            </div>
                            <div className="text-xs space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Qtd Total:</span>
                                <span className="font-medium">{prod.totalQtd}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Valor Total:</span>
                                <span className="font-medium text-green-600">{formatarMoeda(prod.totalValor)}</span>
                              </div>
                            </div>
                          </div>
                        ))
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mensagem quando não há dados */}
          {nomeParceiroAnalise && pedidosFDVCliente.length === 0 && leadsCliente.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhum dado encontrado para este cliente</p>
                <p className="text-sm mt-2">O cliente selecionado ainda não possui leads ou pedidos registrados</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal do Assistente - Removed as assistenteOpen state is removed */}
      {/* <AssistenteModal open={assistenteOpen} onClose={() => setAssistenteOpen(false)} /> */}
    </div>
  )
}