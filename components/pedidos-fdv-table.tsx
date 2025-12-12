"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Eye, RefreshCw, Filter, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import PedidoVendaRapido from "./pedido-venda-rapido"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface PedidoFDV {
  ID: number
  ORIGEM: 'RAPIDO' | 'LEAD' | 'OFFLINE'
  CODLEAD?: number
  CORPO_JSON: any
  STATUS: 'SUCESSO' | 'ERRO'
  NUNOTA?: number
  ERRO?: string | object // Changed to string | object to handle both cases
  TENTATIVAS: number
  NOME_USUARIO: string
  DATA_CRIACAO: string
  DATA_ULTIMA_TENTATIVA: string
}

export default function PedidosFDVTable() {
  const [pedidos, setPedidos] = useState<PedidoFDV[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroOrigem, setFiltroOrigem] = useState<string>('TODOS')
  const [filtroStatus, setFiltroStatus] = useState<string>('TODOS')
  const [pedidoSelecionado, setPedidoSelecionado] = useState<PedidoFDV | null>(null)
  const [showPedidoModal, setShowPedidoModal] = useState(false)

  useEffect(() => {
    carregarPedidos()
  }, [filtroOrigem, filtroStatus])

  const carregarPedidos = async () => {
    setLoading(true)
    try {
      let url = '/api/pedidos-fdv'
      const params = new URLSearchParams()

      if (filtroOrigem !== 'TODOS') {
        params.append('origem', filtroOrigem)
      }

      if (filtroStatus !== 'TODOS') {
        params.append('status', filtroStatus)
      }

      if (params.toString()) {
        url += `?${params.toString()}`
      }

      console.log('Buscando pedidos FDV:', url)
      const response = await fetch(url)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao carregar pedidos')
      }

      const data = await response.json()
      console.log('Pedidos FDV carregados:', data)
      setPedidos(data)
    } catch (error: any) {
      console.error('Erro ao carregar pedidos FDV:', error)
      toast.error(`Erro ao carregar pedidos: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const abrirPedido = async (pedido: PedidoFDV) => {
    setPedidoSelecionado(pedido)
    setShowPedidoModal(true)
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      SUCESSO: 'default',
      ERRO: 'destructive'
    }

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status}
      </Badge>
    )
  }

  const getOrigemBadge = (origem: string) => {
    const variants: Record<string, any> = {
      LEAD: 'default',
      RAPIDO: 'outline',
      OFFLINE: 'secondary'
    }

    return (
      <Badge variant={variants[origem] || 'outline'}>
        {origem}
      </Badge>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="space-y-3">
            <div>
              <CardTitle className="text-base md:text-xl">Pedidos de Vendas</CardTitle>
              <CardDescription className="text-xs md:text-sm mt-1">
                Histórico e controle de pedidos criados pelo sistema
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={carregarPedidos}
                disabled={loading}
                className="text-xs h-8"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span className="ml-1.5 hidden sm:inline">Atualizar</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todas as Origens</SelectItem>
                  <SelectItem value="RAPIDO">Pedido Rápido</SelectItem>
                  <SelectItem value="LEAD">From Lead</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos os Status</SelectItem>
                  <SelectItem value="SUCESSO">Sucesso</SelectItem>
                  <SelectItem value="ERRO">Erro</SelectItem>
                  <SelectItem value="PENDENTE">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Mobile - Cards */}
          <div className="md:hidden px-4 space-y-3">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                <p className="text-sm font-medium text-muted-foreground">Carregando pedidos...</p>
              </div>
            ) : pedidos.length === 0 ? (
              <div className="py-12 text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  Nenhum pedido encontrado
                </p>
              </div>
            ) : (
              pedidos.map((pedido) => (
                <div
                  key={pedido.ID}
                  className="bg-card border rounded-lg p-4 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-muted-foreground">ID #{pedido.ID}</span>
                        {getOrigemBadge(pedido.ORIGEM)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(pedido.DATA_CRIACAO), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="ml-2">
                      {getStatusBadge(pedido.STATUS)}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {pedido.NUNOTA && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">NUNOTA</span>
                        <span className="text-xs font-medium text-foreground">{pedido.NUNOTA}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Tentativas</span>
                      <span className="text-xs font-medium text-foreground">{pedido.TENTATIVAS}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Usuário</span>
                      <span className="text-xs font-medium text-foreground truncate max-w-[180px]">{pedido.NOME_USUARIO}</span>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => abrirPedido(pedido)}
                    className="w-full mt-3"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Ver Detalhes
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* Desktop - Table */}
          <div className="hidden md:block rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>NUNOTA</TableHead>
                  <TableHead>Tentativas</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : pedidos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum pedido encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  pedidos.map((pedido) => (
                    <TableRow key={pedido.ID}>
                      <TableCell className="font-medium">{pedido.ID}</TableCell>
                      <TableCell>
                        {format(new Date(pedido.DATA_CRIACAO), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{getOrigemBadge(pedido.ORIGEM)}</TableCell>
                      <TableCell>{getStatusBadge(pedido.STATUS)}</TableCell>
                      <TableCell>{pedido.NUNOTA || '-'}</TableCell>
                      <TableCell>{pedido.TENTATIVAS}</TableCell>
                      <TableCell>{pedido.NOME_USUARIO}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => abrirPedido(pedido)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de detalhes do pedido */}
      {pedidoSelecionado && (
        <Dialog open={showPedidoModal} onOpenChange={setShowPedidoModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Pedido #{pedidoSelecionado.ID} - {pedidoSelecionado.ORIGEM}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <p>{getStatusBadge(pedidoSelecionado.STATUS)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Tentativas</p>
                  <p>{pedidoSelecionado.TENTATIVAS}</p>
                </div>
                {pedidoSelecionado.NUNOTA && (
                  <div>
                    <p className="text-sm font-medium">NUNOTA</p>
                    <p className="font-mono">{pedidoSelecionado.NUNOTA}</p>
                  </div>
                )}
                {pedidoSelecionado.CODLEAD && (
                  <div>
                    <p className="text-sm font-medium">Código Lead</p>
                    <p className="font-mono">{pedidoSelecionado.CODLEAD}</p>
                  </div>
                )}
              </div>

              {pedidoSelecionado.ERRO && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-800 mb-2">Erro:</p>
                  {(() => {
                    const erro = pedidoSelecionado.ERRO;
                    let erroObj: any = null;
                    
                    // O erro já vem como objeto do backend
                    if (typeof erro === 'object' && erro !== null) {
                      erroObj = erro;
                    } else if (typeof erro === 'string') {
                      try {
                        erroObj = JSON.parse(erro);
                      } catch {
                        erroObj = { mensagem: erro };
                      }
                    } else {
                      erroObj = { mensagem: String(erro) };
                    }

                    // Exibir de forma estruturada
                    return (
                      <div className="space-y-2">
                        {erroObj.mensagem && (
                          <div className="p-3 bg-white rounded border border-red-300">
                            <p className="text-sm font-semibold text-red-700 mb-1">Mensagem:</p>
                            <p className="text-sm text-red-600 whitespace-pre-wrap">{erroObj.mensagem}</p>
                          </div>
                        )}
                        {erroObj.statusCode && (
                          <div className="p-2 bg-white rounded border border-red-200">
                            <span className="text-xs font-medium text-red-700">Status Code: </span>
                            <span className="text-xs text-red-600">{erroObj.statusCode}</span>
                          </div>
                        )}
                        {erroObj.timestamp && (
                          <div className="p-2 bg-white rounded border border-red-200">
                            <span className="text-xs font-medium text-red-700">Timestamp: </span>
                            <span className="text-xs text-red-600">{new Date(erroObj.timestamp).toLocaleString('pt-BR')}</span>
                          </div>
                        )}
                        <details className="mt-2">
                          <summary className="text-xs text-red-700 cursor-pointer hover:text-red-800 font-medium">
                            Ver JSON completo do erro
                          </summary>
                          <pre className="mt-2 text-xs text-red-600 whitespace-pre-wrap break-words overflow-auto max-h-48 bg-white p-3 rounded border border-red-300 font-mono">
{JSON.stringify(erroObj, null, 2)}
                          </pre>
                        </details>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2">Dados do Pedido (CORPO_JSON):</p>
                <pre className="p-4 bg-slate-100 rounded-lg text-xs overflow-auto max-h-96 font-mono">
                  {typeof pedidoSelecionado.CORPO_JSON === 'object'
                    ? JSON.stringify(pedidoSelecionado.CORPO_JSON, null, 2)
                    : pedidoSelecionado.CORPO_JSON
                  }
                </pre>
              </div>

              {pedidoSelecionado.STATUS === 'ERRO' && (
                <Button
                  className="w-full"
                  onClick={() => {
                    // Aqui você pode implementar a lógica para retentar
                    toast.info('Funcionalidade de retentativa em desenvolvimento')
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Tentar Novamente
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}