"use client"

import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Plus, List, Calendar, Clock, AlertCircle, CheckCircle2, Archive, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from '@/components/ui/badge'
import axios from 'axios' // Import axios

interface CalendarioEvento {
  CODATIVIDADE: string
  CODLEAD?: string
  TIPO: string
  TITULO: string
  DESCRICAO: string
  DATA_INICIO: string
  DATA_FIM: string
  STATUS: 'ATRASADO' | 'EM_ANDAMENTO' | 'REALIZADO' | 'AGUARDANDO'
  COR?: string
  ATIVO?: string
}

interface NovaAtividade {
  TIPO: string
  TITULO: string
  DESCRICAO: string
  DATA_INICIO: string
  DATA_FIM: string
  STATUS: 'ATRASADO' | 'EM_ANDAMENTO' | 'REALIZADO' | 'AGUARDANDO'
  COR: string
  CODLEAD?: string
}

interface EventoItemProps {
  evento: CalendarioEvento
  onUpdate: () => void
  onUpdateLocal: (evento: CalendarioEvento) => void
  onClose?: () => void
  onInativar?: (evento: CalendarioEvento) => void
}

function EventoItem({ evento, onUpdate, onUpdateLocal, onClose, onInativar }: EventoItemProps) {
  const [editando, setEditando] = useState(false)
  const [titulo, setTitulo] = useState(evento.TITULO)
  const [descricao, setDescricao] = useState(evento.DESCRICAO)
  const [tipo, setTipo] = useState(evento.TIPO)
  const [cor, setCor] = useState(evento.COR || '#22C55E')
  const [dataInicio, setDataInicio] = useState(evento.DATA_INICIO.slice(0, 16))
  const [dataFim, setDataFim] = useState(evento.DATA_FIM.slice(0, 16))
  const [salvando, setSalvando] = useState(false)
  const [concluindo, setConcluindo] = useState(false)
  const [mostrarAlertaInativar, setMostrarAlertaInativar] = useState(false)
  const [inativando, setInativando] = useState(false) // Added state for inactivate loading
  const { toast } = useToast()

  const marcarRealizado = async () => {
    try {
      setConcluindo(true)
      const response = await fetch('/api/leads/atividades/atualizar-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ CODATIVIDADE: evento.CODATIVIDADE, STATUS: 'REALIZADO' })
      })

      if (!response.ok) throw new Error('Erro ao marcar como concluído')

      toast({
        title: "Sucesso",
        description: "Tarefa concluída",
      })

      onUpdateLocal({ ...evento, STATUS: 'REALIZADO' })
      await onUpdate()

      // Fechar o modal após concluir
      if (onClose) {
        onClose()
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setConcluindo(false)
    }
  }

  const marcarAguardando = async () => {
    try {
      setConcluindo(true)
      const response = await fetch('/api/leads/atividades/atualizar-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ CODATIVIDADE: evento.CODATIVIDADE, STATUS: 'AGUARDANDO' })
      })

      if (!response.ok) throw new Error('Erro ao alterar status')

      toast({
        title: "Sucesso",
        description: "Status alterado para Aguardando",
      })

      onUpdateLocal({ ...evento, STATUS: 'AGUARDANDO' })
      await onUpdate()

      // Fechar o modal após alterar status
      if (onClose) {
        onClose()
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setConcluindo(false)
    }
  }

  const salvarEdicao = async () => {
    try {
      setSalvando(true)

      // Converter data sem forçar UTC
      const dataInicioCompleta = dataInicio + ':00'
      const dataFimCompleta = dataFim + ':00'

      // Atualizar todos os campos editáveis
      const response = await fetch('/api/leads/atividades/atualizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          CODATIVIDADE: evento.CODATIVIDADE,
          TITULO: titulo,
          DESCRICAO: descricao,
          TIPO: tipo,
          COR: cor,
          DATA_INICIO: dataInicioCompleta,
          DATA_FIM: dataFimCompleta
        })
      })

      if (!response.ok) throw new Error('Erro ao atualizar')

      // Atualizar o evento localmente com os novos dados
      const eventoAtualizado = {
        ...evento,
        TITULO: titulo,
        DESCRICAO: descricao,
        TIPO: tipo,
        COR: cor,
        DATA_INICIO: dataInicioCompleta,
        DATA_FIM: dataFimCompleta
      }

      // Primeiro atualizar localmente
      onUpdateLocal(eventoAtualizado)

      // Fechar o modo de edição
      setEditando(false)

      // Recarregar todos os eventos
      await onUpdate()

      toast({
        title: "Sucesso",
        description: "Atividade atualizada",
      })

      // Fechar o modal após salvar
      if (onClose) {
        onClose()
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSalvando(false)
    }
  }

  const inativar = async () => {
    try {
      setInativando(true)
      const response = await fetch('/api/leads/atividades/atualizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          CODATIVIDADE: evento.CODATIVIDADE,
          ATIVO: 'N'
        })
      })

      if (!response.ok) throw new Error('Erro ao inativar')

      toast({
        title: "Sucesso",
        description: "Atividade inativada",
      })

      // Fechar o modal primeiro
      if (onClose) {
        onClose()
      }

      // Recarregar todos os eventos (ativos e inativos)
      await onUpdate()
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setInativando(false)
    }
  }

  const estaRealizado = evento.STATUS === 'REALIZADO'

  return (
    <>
      <div className="relative pl-6 sm:pl-12">
        <div
          className="absolute left-1 sm:left-2.5 top-2 w-2 h-2 sm:w-3 sm:h-3 rounded-full border-2 border-white shadow-sm"
          style={{ backgroundColor: evento.COR || '#22C55E' }}
        />

        <div className="border rounded-lg p-2 sm:p-4 space-y-2 sm:space-y-3 bg-white">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 flex items-start gap-1 sm:gap-2 min-w-0">
              {evento.STATUS === 'REALIZADO' && <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 mt-0.5 flex-shrink-0" />}
              {evento.STATUS === 'ATRASADO' && <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 mt-0.5 flex-shrink-0" />}
              {evento.STATUS === 'AGUARDANDO' && <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mt-0.5 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm sm:text-base truncate">{evento.TITULO}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 line-clamp-2">{evento.DESCRICAO}</p>
              </div>
            </div>
            <Badge className={`${evento.STATUS === 'REALIZADO' ? 'bg-green-500' : evento.STATUS === 'ATRASADO' ? 'bg-red-500' : 'bg-blue-500'} text-white text-[10px] sm:text-xs whitespace-nowrap flex-shrink-0`}>
              {evento.STATUS === 'REALIZADO' ? 'Concluído' : evento.STATUS === 'ATRASADO' ? 'Atrasado' : 'Aguardando'}
            </Badge>
          </div>

          {editando ? (
            <div className="space-y-3 pt-3 border-t">
              <div>
                <Label className="text-xs">Título</Label>
                <Input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="text-xs"
                  disabled={salvando}
                />
              </div>
              <div>
                <Label className="text-xs">Descrição</Label>
                <Textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="text-xs"
                  disabled={salvando}
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={tipo} onValueChange={setTipo} disabled={salvando}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TAREFA">Tarefa</SelectItem>
                    <SelectItem value="REUNIAO">Reunião</SelectItem>
                    <SelectItem value="LIGACAO">Ligação</SelectItem>
                    <SelectItem value="EMAIL">E-mail</SelectItem>
                    <SelectItem value="VISITA">Visita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Cor</Label>
                <Input
                  type="color"
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  className="text-xs h-10"
                  disabled={salvando}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Data Início</Label>
                  <Input
                    type="datetime-local"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="text-xs"
                    disabled={salvando}
                  />
                </div>
                <div>
                  <Label className="text-xs">Data Fim</Label>
                  <Input
                    type="datetime-local"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="text-xs"
                    disabled={salvando}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={salvarEdicao} disabled={salvando}>
                  {salvando ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar'
                  )}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditando(false)} disabled={salvando}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 pt-2 sm:pt-3 border-t">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="font-medium">Tipo:</span> {evento.TIPO}
                </span>
                <span className="flex items-center gap-1">
                  <span className="font-medium">Data:</span>{' '}
                  {new Date(evento.DATA_INICIO).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <div className="flex gap-1 sm:gap-2 w-full sm:w-auto flex-wrap">
                {estaRealizado ? (
                  <Button
                    size="sm"
                    onClick={marcarAguardando}
                    className="bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none text-xs"
                    disabled={concluindo}
                  >
                    {concluindo ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Alterando...</span>
                        <span className="sm:hidden">...</span>
                      </>
                    ) : (
                      <>
                        <span className="hidden sm:inline">Voltar p/ Aguardando</span>
                        <span className="sm:hidden">Aguardando</span>
                      </>
                    )}
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      onClick={marcarRealizado}
                      className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none text-xs"
                      disabled={concluindo}
                    >
                      {concluindo ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1 sm:mr-2" />
                          <span className="hidden sm:inline">Concluindo...</span>
                          <span className="sm:hidden">...</span>
                        </>
                      ) : (
                        'Concluir'
                      )}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditando(true)} disabled={concluindo} className="text-xs">
                      Editar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setMostrarAlertaInativar(true)} disabled={concluindo || inativando} className="text-xs">
                      {inativando ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1 sm:mr-2" />
                          <span className="hidden sm:inline">Inativando...</span>
                          <span className="sm:hidden">...</span>
                        </>
                      ) : (
                        'Inativar'
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={mostrarAlertaInativar} onOpenChange={setMostrarAlertaInativar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja inativar?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá inativar a tarefa "{evento.TITULO}". Você poderá reativá-la posteriormente através da lista de tarefas inativas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              inativar()
              setMostrarAlertaInativar(false)
            }} disabled={inativando}>
              Sim, inativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default function CalendarioView() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [eventos, setEventos] = useState<CalendarioEvento[]>([])
  const [loading, setLoading] = useState(true)
  const [modalDiaAberto, setModalDiaAberto] = useState(false)
  const [modalNovaAtividadeAberto, setModalNovaAtividadeAberto] = useState(false)
  const [modalInativosAberto, setModalInativosAberto] = useState(false)
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false)
  const [eventosDoDia, setEventosDoDia] = useState<CalendarioEvento[]>([])
  const [eventosInativos, setEventosInativos] = useState<CalendarioEvento[]>([])
  const [eventoSelecionado, setEventoSelecionado] = useState<CalendarioEvento | null>(null)
  const [dataSelecionada, setDataSelecionada] = useState<Date | null>(null)
  const [visualizacao, setVisualizacao] = useState<'calendario' | 'lista'>('calendario')
  const [dataInicioFiltro, setDataInicioFiltro] = useState<string>("")
  const [dataFimFiltro, setDataFimFiltro] = useState<string>("")
  const [novaAtividade, setNovaAtividade] = useState<NovaAtividade>({
    TIPO: 'EMAIL', // Changed from 'TAREFA' to 'EMAIL'
    TITULO: '',
    DESCRICAO: '',
    DATA_INICIO: new Date().toISOString().split('T')[0], // Set to today's date
    DATA_FIM: new Date().toISOString().split('T')[0], // Set to today's date
    STATUS: 'AGUARDANDO',
    COR: '#22C55E'
  })
  const [salvandoAtividade, setSalvandoAtividade] = useState(false)
  const [carregandoInativos, setCarregandoInativos] = useState(false) // State for loading inactive events
  const [reativando, setReativando] = useState<string | null>(null) // State for reativate loading
  const [concluindo, setConcluindo] = useState(false) // State for marking as completed
  const [editandoAtividade, setEditandoAtividade] = useState(false) // State for editing activity
  const [mostrarAlertaInativar, setMostrarAlertaInativar] = useState(false) // State for inactivate alert
  const { toast } = useToast()

  const diasSemana = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  const loadEventos = async () => {
    try {
      setLoading(true)
      // Adicionar timestamp para evitar cache
      const timestamp = new Date().getTime()

      // Construir query params com filtros de data
      const params = new URLSearchParams({ t: timestamp.toString() })
      if (dataInicioFiltro) params.append('dataInicio', dataInicioFiltro)
      if (dataFimFiltro) params.append('dataFim', dataFimFiltro)

      // Adicionar codUsuario do usuário logado se disponível
      const userCookie = document.cookie.split('; ').find(row => row.startsWith('user='))
      let codUsuario = ''
      if (userCookie) {
        try {
          const userData = JSON.parse(decodeURIComponent(userCookie.split('=')[1]))
          codUsuario = userData.id || userData.CODUSUARIO || ''
        } catch (e) {
          console.error('Erro ao parsear cookie do usuário:', e)
        }
      }

      if (codUsuario) {
        params.append('codUsuario', codUsuario)
      }

      // Carregar eventos ativos
      const responseAtivos = await fetch(`/api/leads/eventos?${params.toString()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      if (!responseAtivos.ok) throw new Error('Erro ao carregar eventos')
      const dataAtivos = await responseAtivos.json()

      // Carregar eventos inativos
      const responseInativos = await fetch(`/api/leads/eventos/inativos?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      if (!responseInativos.ok) throw new Error('Erro ao carregar eventos inativos')
      const dataInativos = await responseInativos.json()

      console.log('📊 [Calendário] Eventos ativos:', dataAtivos.length)
      console.log('❌ [Calendário] Eventos inativos:', dataInativos.length)

      // Filtrar apenas eventos ativos (garantia adicional)
      const ativos = dataAtivos.filter((ev: CalendarioEvento) => ev.ATIVO !== 'N')

      setEventos(ativos)
      setEventosInativos(dataInativos)

      // Se houver uma data selecionada, atualizar os eventos do dia
      if (dataSelecionada) {
        const eventosAtualizados = ativos.filter((evento: CalendarioEvento) => {
          const eventoDate = new Date(evento.DATA_INICIO)
          return (
            eventoDate.getDate() === dataSelecionada.getDate() &&
            eventoDate.getMonth() === dataSelecionada.getMonth() &&
            eventoDate.getFullYear() === dataSelecionada.getFullYear()
          )
        })
        setEventosDoDia(eventosAtualizados)
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const carregarEventosInativos = async () => {
    try {
      setCarregandoInativos(true)
      console.log('🔄 Carregando eventos inativos...')
      const response = await fetch('/api/leads/eventos/inativos', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
      if (!response.ok) throw new Error('Erro ao carregar eventos inativos')
      const data = await response.json()
      console.log('✅ Eventos inativos carregados:', data.length)
      setEventosInativos(data)
    } catch (error) {
      console.error('❌ Erro ao carregar eventos inativos:', error)
      toast({
        title: "Erro",
        description: "Falha ao carregar tarefas inativas",
        variant: "destructive",
      })
    } finally {
      setCarregandoInativos(false)
    }
  }

  useEffect(() => {
    loadEventos()
  }, [currentDate]) // Rerun apenas quando currentDate mudar

  const reativarAtividade = async (codAtividade: string) => {
    try {
      setReativando(codAtividade)
      const response = await fetch('/api/leads/atividades/atualizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          CODATIVIDADE: codAtividade,
          ATIVO: 'S'
        })
      })

      if (!response.ok) throw new Error('Erro ao reativar')

      toast({
        title: "Sucesso",
        description: "Atividade reativada",
      })

      // Recarregar todos os eventos (ativos e inativos) de uma vez
      await loadEventos()
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setReativando(null)
    }
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []

    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        day: prevMonthLastDay - i,
        isCurrentMonth: false,
        date: new Date(year, month - 1, prevMonthLastDay - i)
      })
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        date: new Date(year, month, i)
      })
    }

    const remainingDays = 42 - days.length
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        date: new Date(year, month + 1, i)
      })
    }

    return days
  }

  const getEventosForDay = (date: Date) => {
    return eventos.filter(evento => {
      const eventoDate = new Date(evento.DATA_INICIO)
      return (
        eventoDate.getDate() === date.getDate() &&
        eventoDate.getMonth() === date.getMonth() &&
        eventoDate.getFullYear() === date.getFullYear()
      )
    })
  }

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  const today = () => {
    setCurrentDate(new Date())
  }

  const isToday = (date: Date) => {
    const now = new Date()
    return (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    )
  }

  const abrirModalDia = (date: Date) => {
    const eventosDay = getEventosForDay(date)
    setEventosDoDia(eventosDay)
    setDataSelecionada(date)
    setModalDiaAberto(true)
  }

  const abrirModalNovaAtividade = () => {
    const hoje = new Date()
    const dataFormatada = hoje.toISOString().split('T')[0]
    setNovaAtividade({
      TIPO: 'EMAIL', // Default to EMAIL
      TITULO: '',
      DESCRICAO: '',
      DATA_INICIO: dataFormatada,
      DATA_FIM: dataFormatada,
      STATUS: 'AGUARDANDO',
      COR: '#22C55E'
    })
    setModalNovaAtividadeAberto(true)
  }

  const salvarNovaAtividade = async () => {
    try {
      if (!novaAtividade.TITULO || !novaAtividade.DATA_INICIO) {
        toast({
          title: "Erro",
          description: "Título e data de início são obrigatórios",
          variant: "destructive",
        })
        return
      }

      setSalvandoAtividade(true)

      // Converter data sem alterar o fuso horário
      const dataInicio = novaAtividade.DATA_INICIO + 'T00:00:00'
      const dataFim = (novaAtividade.DATA_FIM || novaAtividade.DATA_INICIO) + 'T23:59:59'

      const response = await fetch('/api/leads/atividades/criar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          CODLEAD: novaAtividade.CODLEAD || null,
          TIPO: novaAtividade.TIPO,
          TITULO: novaAtividade.TITULO,
          DESCRICAO: novaAtividade.DESCRICAO,
          DATA_INICIO: dataInicio,
          DATA_FIM: dataFim,
          COR: novaAtividade.COR,
          DADOS_COMPLEMENTARES: JSON.stringify({ STATUS: novaAtividade.STATUS })
        })
      })

      if (!response.ok) throw new Error('Erro ao criar atividade')

      toast({
        title: "Sucesso",
        description: "Atividade criada com sucesso",
      })

      setModalNovaAtividadeAberto(false)

      // Resetar o formulário
      setNovaAtividade({
        CODLEAD: null,
        TIPO: 'EMAIL',
        TITULO: '',
        DESCRICAO: '',
        DATA_INICIO: new Date().toISOString().split('T')[0],
        DATA_FIM: new Date().toISOString().split('T')[0],
        COR: '#22C55E',
        STATUS: 'AGUARDANDO'
      })

      // Forçar recarga dos eventos
      await loadEventos()

      // Se estiver visualizando um dia específico, atualizar também
      if (dataSelecionada) {
        const eventosAtualizados = getEventosForDay(dataSelecionada)
        setEventosDoDia(eventosAtualizados)
      }
    } catch (error: any) {
      console.error('❌ Erro ao criar atividade:', error)
      toast({
        title: "Erro ao criar atividade",
        description: error.message || "Erro desconhecido ao criar atividade",
        variant: "destructive",
      })
    } finally {
      setSalvandoAtividade(false)
    }
  }

  const atualizarStatusAtividade = async (codAtividade: string, novoStatus: string) => {
    try {
      const response = await fetch('/api/leads/atividades/atualizar-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ CODATIVIDADE: codAtividade, STATUS: novoStatus })
      })

      if (!response.ok) throw new Error('Erro ao atualizar status')

      toast({
        title: "Sucesso",
        description: "Status atualizado com sucesso",
      })

      loadEventos() // Reload all events
      const eventosAtualizados = eventosDoDia.map(ev =>
        ev.CODATIVIDADE === codAtividade ? { ...ev, STATUS: novoStatus as any } : ev
      )
      setEventosDoDia(eventosAtualizados)
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ATRASADO': return 'bg-red-500'
      case 'REALIZADO': return 'bg-green-500'
      case 'AGUARDANDO': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ATRASADO': return 'Atrasado'
      case 'REALIZADO': return 'Concluído'
      case 'AGUARDANDO': return 'Aguardando'
      default: return status
    }
  }

  const days = getDaysInMonth(currentDate)

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-muted-foreground">Carregando tarefas...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white h-full flex flex-col overflow-hidden max-w-full">
        {/* Header Mobile */}
        <div className="border-b px-2 py-2 flex items-center justify-between flex-shrink-0 md:hidden">
          <div className="flex items-center gap-2">
            <Button
              variant={visualizacao === 'lista' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setVisualizacao('lista')}
            >
              <List className="w-4 h-4" />
            </Button>
            <Select
              value={`${currentDate.getMonth()}`}
              onValueChange={(value) => setCurrentDate(new Date(currentDate.getFullYear(), parseInt(value)))}
            >
              <SelectTrigger className="border-0 font-semibold text-sm w-auto">
                <SelectValue>
                  {meses[currentDate.getMonth()].substring(0, 3)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {meses.map((mes, index) => (
                  <SelectItem key={index} value={`${index}`}>{mes}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={visualizacao === 'calendario' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setVisualizacao('calendario')}
            >
              <Calendar className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setModalInativosAberto(true)}>
              <Archive className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Header Desktop */}
        <div className="border-b p-4 hidden md:flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            {visualizacao === 'calendario' && (
              <>
                <Button variant="outline" size="sm" onClick={today}>
                  Hoje
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={previousMonth}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={nextMonth}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <h2 className="text-xl font-semibold">
                  {meses[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>
              </>
            )}
            {visualizacao === 'lista' && (
              <h2 className="text-xl font-semibold">Todas as Tarefas</h2>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={visualizacao === 'calendario' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setVisualizacao('calendario')}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Calendário
            </Button>
            <Button
              variant={visualizacao === 'lista' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setVisualizacao('lista')}
            >
              <List className="w-4 h-4 mr-2" />
              Lista
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalInativosAberto(true)}
            >
              <Archive className="w-4 h-4 mr-1" />
              Inativos ({eventosInativos.length})
            </Button>
            <Button onClick={abrirModalNovaAtividade} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Tarefa
            </Button>
          </div>
        </div>

        {/* Visualização Lista */}
        {visualizacao === 'lista' ? (
          <div className="flex-1 p-2 sm:p-4 overflow-y-auto">
            {/* Filtro de Data */}
            <div className="mb-4 p-3 bg-muted/30 rounded-lg">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1 w-full">
                  <Input
                    type="date"
                    value={dataInicioFiltro}
                    onChange={(e) => setDataInicioFiltro(e.target.value)}
                    className="bg-background h-9 w-full sm:w-auto text-sm"
                    placeholder="Data Início"
                  />
                  <span className="text-sm text-muted-foreground hidden sm:inline">até</span>
                  <Input
                    type="date"
                    value={dataFimFiltro}
                    onChange={(e) => setDataFimFiltro(e.target.value)}
                    className="bg-background h-9 w-full sm:w-auto text-sm"
                    placeholder="Data Fim"
                  />
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadEventos}
                      className="h-9 flex-1 sm:flex-none whitespace-nowrap"
                    >
                      Aplicar Filtro
                    </Button>
                    {(dataInicioFiltro || dataFimFiltro) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDataInicioFiltro("")
                          setDataFimFiltro("")
                          loadEventos()
                        }}
                        className="h-9 flex-1 sm:flex-none whitespace-nowrap"
                      >
                        Limpar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 sm:space-y-4">
              {eventos.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  Nenhuma tarefa encontrada
                </p>
              ) : (
                eventos.map((evento) => (
                  <EventoItem
                    key={evento.CODATIVIDADE}
                    evento={evento}
                    onUpdate={loadEventos}
                    onUpdateLocal={(updated) => {
                      setEventos(prevEventos => prevEventos.map(ev =>
                        ev.CODATIVIDADE === updated.CODATIVIDADE ? updated : ev
                      ))
                    }}
                  />
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 relative">
            {/* Dias da semana */}
            <div className="grid grid-cols-7 border-b flex-shrink-0">
              {diasSemana.map((dia) => (
                <div key={dia} className="text-center text-[10px] md:text-xs font-medium text-muted-foreground py-1 md:py-2">
                  {dia.toLowerCase()}
                </div>
              ))}
            </div>

            {/* Grid do calendário */}
            <div className="grid grid-cols-7 flex-1 overflow-y-auto overflow-x-hidden" style={{ gridAutoRows: 'minmax(70px, 1fr)' }}>
              {days.map((dayInfo, index) => {
                const eventosDay = getEventosForDay(dayInfo.date)
                const isTodayDate = isToday(dayInfo.date)

                return (
                  <div
                    key={index}
                    onClick={() => dayInfo.isCurrentMonth && abrirModalDia(dayInfo.date)}
                    className={`
                      border-r border-b p-1 md:p-2 relative cursor-pointer hover:bg-accent/30 transition-colors min-w-0
                      ${!dayInfo.isCurrentMonth ? 'bg-muted/30 text-muted-foreground' : 'bg-white'}
                      ${isTodayDate ? 'ring-2 ring-primary ring-inset' : ''}
                    `}
                  >
                    {/* Número do dia */}
                    <div className="flex justify-center mb-0.5 md:mb-1">
                      <span className={`
                        text-xs md:text-sm font-semibold
                        ${isTodayDate ? 'bg-primary text-primary-foreground rounded-full w-5 h-5 md:w-7 md:h-7 flex items-center justify-center text-[10px] md:text-sm' : ''}
                      `}>
                        {dayInfo.day}
                      </span>
                    </div>

                    {/* Eventos */}
                    <div className="space-y-0.5 overflow-hidden">
                      {eventosDay.slice(0, 2).map((evento) => (
                        <div
                          key={evento.CODATIVIDADE}
                          className="text-[8px] md:text-[10px] px-1 md:px-2 py-0.5 rounded-full text-white truncate font-medium"
                          style={{ backgroundColor: evento.COR || '#22C55E' }}
                          title={evento.TITULO}
                        >
                          {evento.TITULO}
                        </div>
                      ))}
                      {eventosDay.length > 2 && (
                        <div className="text-[8px] md:text-[9px] text-muted-foreground text-center">
                          +{eventosDay.length - 2}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Tarefas do Dia - Lista Simples */}
      <Dialog open={modalDiaAberto} onOpenChange={setModalDiaAberto}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              Tarefas de {dataSelecionada?.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
              })}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4 sm:mt-6">
            {eventosDoDia.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground font-medium mb-2">
                  Nenhuma tarefa para este dia
                </p>
                <p className="text-sm text-muted-foreground/70">
                  Clique em "Adicionar Tarefa" para criar uma nova atividade
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {eventosDoDia.map((evento) => (
                  <div
                    key={evento.CODATIVIDADE}
                    onClick={() => {
                      setEventoSelecionado(evento)
                      setModalDetalhesAberto(true)
                    }}
                    className="border rounded-lg p-4 hover:bg-accent/50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                          style={{ backgroundColor: evento.COR || '#22C55E' }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-sm truncate">
                              {evento.TITULO}
                            </h3>
                            <Badge className={`${getStatusColor(evento.STATUS)} text-white text-xs flex-shrink-0`}>
                              {getStatusLabel(evento.STATUS)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {evento.DESCRICAO}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(evento.DATA_INICIO).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {evento.TIPO}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes da Atividade */}
      <Dialog open={modalDetalhesAberto} onOpenChange={setModalDetalhesAberto}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {eventoSelecionado && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0 mt-1"
                    style={{ backgroundColor: eventoSelecionado.COR || '#22C55E' }}
                  />
                  <div className="flex-1">
                    <DialogTitle className="text-lg">
                      {eventoSelecionado.TITULO}
                    </DialogTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={`${getStatusColor(eventoSelecionado.STATUS)} text-white`}>
                        {getStatusLabel(eventoSelecionado.STATUS)}
                      </Badge>
                      <Badge variant="outline">
                        {eventoSelecionado.TIPO}
                      </Badge>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6 mt-6">
                {/* Descrição */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Descrição
                  </h4>
                  <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md">
                    {eventoSelecionado.DESCRICAO || 'Sem descrição'}
                  </p>
                </div>

                {/* Informações de Data/Hora */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Período
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-muted/30 p-3 rounded-md">
                      <p className="text-xs text-muted-foreground mb-1">Início</p>
                      <p className="text-sm font-medium">
                        {new Date(eventoSelecionado.DATA_INICIO).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(eventoSelecionado.DATA_INICIO).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="bg-muted/30 p-3 rounded-md">
                      <p className="text-xs text-muted-foreground mb-1">Término</p>
                      <p className="text-sm font-medium">
                        {new Date(eventoSelecionado.DATA_FIM).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(eventoSelecionado.DATA_FIM).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex gap-2 pt-4 border-t">
                  {eventoSelecionado.STATUS === 'REALIZADO' ? (
                    <Button
                      onClick={async () => {
                        try {
                          setConcluindo(true)
                          const response = await fetch('/api/leads/atividades/atualizar-status', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              CODATIVIDADE: eventoSelecionado.CODATIVIDADE,
                              STATUS: 'AGUARDANDO'
                            })
                          })

                          if (!response.ok) throw new Error('Erro ao alterar status')

                          toast({
                            title: "Sucesso",
                            description: "Status alterado para Aguardando",
                          })

                          // Atualizar localmente
                          const atualizado = { ...eventoSelecionado, STATUS: 'AGUARDANDO' as any }
                          setEventoSelecionado(atualizado)

                          // Atualizar lista
                          setEventosDoDia(eventosDoDia.map(ev =>
                            ev.CODATIVIDADE === eventoSelecionado.CODATIVIDADE ? atualizado : ev
                          ))
                          setEventos(prevEventos => prevEventos.map(ev =>
                            ev.CODATIVIDADE === eventoSelecionado.CODATIVIDADE ? atualizado : ev
                          ))

                          await loadEventos()
                        } catch (error: any) {
                          toast({
                            title: "Erro",
                            description: error.message,
                            variant: "destructive",
                          })
                        } finally {
                          setConcluindo(false)
                        }
                      }}
                      className="bg-blue-600 hover:bg-blue-700 flex-1"
                      disabled={concluindo}
                    >
                      {concluindo ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Alterando...
                        </>
                      ) : (
                        'Voltar para Aguardando'
                      )}
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={async () => {
                          try {
                            setConcluindo(true)
                            const response = await fetch('/api/leads/atividades/atualizar-status', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                CODATIVIDADE: eventoSelecionado.CODATIVIDADE,
                                STATUS: 'REALIZADO'
                              })
                            })

                            if (!response.ok) throw new Error('Erro ao marcar como concluído')

                            toast({
                              title: "Sucesso",
                              description: "Tarefa concluída",
                            })

                            setModalDetalhesAberto(false)
                            await loadEventos()

                            if (dataSelecionada) {
                              const eventosAtualizados = getEventosForDay(dataSelecionada)
                              setEventosDoDia(eventosAtualizados)
                            }
                          } catch (error: any) {
                            toast({
                              title: "Erro",
                              description: error.message,
                              variant: "destructive",
                            })
                          } finally {
                            setConcluindo(false)
                          }
                        }}
                        className="bg-green-600 hover:bg-green-700 flex-1"
                        disabled={concluindo}
                      >
                        {concluindo ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            Concluindo...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Concluir
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setModalDetalhesAberto(false)
                          setEditandoAtividade(true)
                        }}
                        className="flex-1"
                        disabled={concluindo}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          setModalDetalhesAberto(false)
                          setMostrarAlertaInativar(true)
                        }}
                        disabled={concluindo}
                      >
                        Inativar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Tarefas Inativas */}
      <Dialog open={modalInativosAberto} onOpenChange={setModalInativosAberto}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tarefas Inativas</DialogTitle>
          </DialogHeader>

          <div className="mt-4">
            {carregandoInativos ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : eventosInativos.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma tarefa inativa
              </p>
            ) : (
              <div className="space-y-3">
                {eventosInativos.map((evento) => (
                  <div
                    key={evento.CODATIVIDADE}
                    className="border rounded-lg p-4 bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: evento.COR || '#22C55E' }}
                          />
                          <h3 className="font-semibold">{evento.TITULO}</h3>
                          <Badge className={`${getStatusColor(evento.STATUS)} text-white`}>
                            {getStatusLabel(evento.STATUS)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{evento.DESCRICAO}</p>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span><span className="font-medium">Tipo:</span> {evento.TIPO}</span>
                          <span><span className="font-medium">Data:</span> {new Date(evento.DATA_INICIO).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => reativarAtividade(evento.CODATIVIDADE)}
                        className="flex-shrink-0"
                        disabled={reativando === evento.CODATIVIDADE}
                      >
                        {reativando === evento.CODATIVIDADE ? (
                          <>
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                            Reativando...
                          </>
                        ) : (
                          'Ativar'
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Nova Atividade */}
      <Dialog open={modalNovaAtividadeAberto} onOpenChange={setModalNovaAtividadeAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Nova Tarefa</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={novaAtividade.TITULO}
                onChange={(e) => setNovaAtividade({ ...novaAtividade, TITULO: e.target.value })}
                placeholder="Digite o título da tarefa"
              />
            </div>

            <div>
              <Label htmlFor="tipo">Tipo</Label>
              <Select
                value={novaAtividade.TIPO}
                onValueChange={(value) => setNovaAtividade({ ...novaAtividade, TIPO: value as any })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOTA">Nota</SelectItem>
                  <SelectItem value="EMAIL">E-mail</SelectItem>
                  <SelectItem value="LIGACAO">Ligação</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="PROPOSTA">Proposta</SelectItem>
                  <SelectItem value="REUNIAO">Reunião</SelectItem>
                  <SelectItem value="VISITA">Visita</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={novaAtividade.DESCRICAO}
                onChange={(e) => setNovaAtividade({ ...novaAtividade, DESCRICAO: e.target.value })}
                placeholder="Digite a descrição da tarefa"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="data-inicio">Data Início *</Label>
                <Input
                  id="data-inicio"
                  type="date"
                  value={novaAtividade.DATA_INICIO}
                  onChange={(e) => setNovaAtividade({ ...novaAtividade, DATA_INICIO: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="data-fim">Data Fim</Label>
                <Input
                  id="data-fim"
                  type="date"
                  value={novaAtividade.DATA_FIM}
                  onChange={(e) => setNovaAtividade({ ...novaAtividade, DATA_FIM: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="cor">Cor</Label>
              <Input
                id="cor"
                type="color"
                value={novaAtividade.COR}
                onChange={(e) => setNovaAtividade({ ...novaAtividade, COR: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setModalNovaAtividadeAberto(false)}
                disabled={salvandoAtividade}
              >
                Cancelar
              </Button>
              <Button onClick={salvarNovaAtividade} disabled={salvandoAtividade}>
                {salvandoAtividade ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Tarefa'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  )
}