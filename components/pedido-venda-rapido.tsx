"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import PedidoVendaFromLead from "@/components/pedido-venda-from-lead"
import { useToast } from "@/components/ui/use-toast"
import { PedidoSyncService } from "@/lib/pedido-sync"
import { useState, useEffect, useRef } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface PedidoVendaRapidoProps {
  isOpen: boolean
  onClose: () => void
}

interface TipoPedido {
  CODTIPOPEDIDO: number
  NOME: string
  DESCRICAO?: string
  CODTIPOPER: number
  MODELO_NOTA: number
  TIPMOV: string
  CODTIPVENDA: number
  COR?: string
}

export default function PedidoVendaRapido({ isOpen, onClose }: PedidoVendaRapidoProps) {
  const { toast } = useToast()

  // Obter CODVEND do cookie IMEDIATAMENTE na inicialização
  const getCodVendFromCookie = () => {
    try {
      const userStr = document.cookie
        .split('; ')
        .find(row => row.startsWith('user='))
        ?.split('=')[1]

      if (userStr) {
        const user = JSON.parse(decodeURIComponent(userStr))
        return user.codVendedor ? String(user.codVendedor) : "0"
      }
    } catch (error) {
      console.error('❌ Erro ao obter CODVEND do cookie:', error)
    }
    return "0"
  }

  const [codVendUsuario, setCodVendUsuario] = useState(() => getCodVendFromCookie())
  const [pedido, setPedido] = useState<any>(null)
  const [tiposPedido, setTiposPedido] = useState<TipoPedido[]>([])
  const [tipoPedidoSelecionado, setTipoPedidoSelecionado] = useState<string>("")
  const [vendedores, setVendedores] = useState<any[]>([])
  const [tabelasPrecos, setTabelasPrecos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingTipos, setLoadingTipos] = useState(false)
  const [nomeVendedor, setNomeVendedor] = useState<string>('')
  const [showVendedorModal, setShowVendedorModal] = useState(false)
  const salvarPedidoRef = useRef<(() => Promise<boolean>) | null>(null)
  const [condicaoComercialManual, setCondicaoComercialManual] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      carregarVendedorUsuario()
      carregarTabelasPrecos()
      carregarTiposPedido()
    }
  }, [isOpen])

  // Atualizar nome do vendedor quando a lista estiver carregada
  useEffect(() => {
    if (codVendUsuario !== "0" && vendedores.length > 0) {
      const vendedor = vendedores.find((v: any) => String(v.CODVEND) === codVendUsuario)
      if (vendedor) {
        setNomeVendedor(vendedor.APELIDO)
        console.log('✅ Nome do vendedor atualizado:', vendedor.APELIDO)
      }
    }
  }, [codVendUsuario, vendedores])

  const carregarTiposPedido = async () => {
    try {
      setLoadingTipos(true)

      // Buscar do IndexedDB
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const tipos = await OfflineDataService.getTiposPedido()

      setTiposPedido(tipos)
      console.log('✅ Tipos de pedido carregados do IndexedDB:', tipos.length)

      // Selecionar o primeiro tipo por padrão
      if (tipos.length > 0) {
        setTipoPedidoSelecionado(String(tipos[0].CODTIPOPEDIDO))
      }
    } catch (error) {
      console.error('Erro ao carregar tipos de pedido:', error)
      toast({
        title: "Erro",
        description: "Erro ao carregar tipos de pedido. Configure-os em Configurações.",
        variant: "destructive"
      })
    } finally {
      setLoadingTipos(false)
    }
  }

  const carregarVendedores = async () => {
    try {
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const vendedoresList = await OfflineDataService.getVendedores()

      // Filtrar apenas vendedores ativos
      const vendedoresAtivos = vendedoresList.filter((v: any) =>
        v.ATIVO === 'S' && v.TIPVEND === 'V'
      )

      setVendedores(vendedoresAtivos)
      console.log('✅ Vendedores carregados do IndexedDB:', vendedoresAtivos.length)
    } catch (error) {
      console.error('Erro ao carregar vendedores:', error)
      setVendedores([])
    }
  }

  const handleSelecionarVendedor = (vendedor: any) => {
    const codVend = String(vendedor.CODVEND)
    setCodVendUsuario(codVend)
    setNomeVendedor(vendedor.APELIDO)

    // Atualizar pedido se já existir
    if (pedido) {
      setPedido({ ...pedido, CODVEND: codVend })
    }

    setShowVendedorModal(false)
    toast({
      title: "Vendedor selecionado",
      description: `${vendedor.APELIDO} (Cód: ${codVend})`
    })
  }

  const carregarVendedorUsuario = async () => {
    try {
      const userStr = document.cookie
        .split('; ')
        .find(row => row.startsWith('user='))
        ?.split('=')[1]

      if (userStr) {
        const user = JSON.parse(decodeURIComponent(userStr))

        if (user.codVendedor) {
          const codVend = String(user.codVendedor)
          setCodVendUsuario(codVend)
          console.log('✅ Vendedor do usuário carregado:', codVend)

          // Carregar lista de vendedores primeiro
          await carregarVendedores()

          // Buscar nome do vendedor do IndexedDB
          try {
            const { OfflineDataService } = await import('@/lib/offline-data-service')
            const vendedoresList = await OfflineDataService.getVendedores()
            const vendedor = vendedoresList.find((v: any) => String(v.CODVEND) === codVend)

            if (vendedor) {
              setNomeVendedor(vendedor.APELIDO)
              console.log('✅ Nome do vendedor do IndexedDB:', vendedor.APELIDO)
            }
          } catch (error) {
            console.error('❌ Erro ao buscar vendedor do IndexedDB:', error)
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar vendedor do usuário:', error)
    }
  }

  const carregarTabelasPrecos = async () => {
    try {
      // Buscar do IndexedDB
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const configs = await OfflineDataService.getTabelasPrecosConfig()

      // Converter formato de configuração para formato de tabela
      const tabelasFormatadas = configs.map((config: any) => ({
        NUTAB: config.NUTAB,
        CODTAB: config.CODTAB,
        DESCRICAO: config.DESCRICAO,
        ATIVO: config.ATIVO
      }))

      setTabelasPrecos(tabelasFormatadas)
      console.log('✅ Tabelas de preços configuradas carregadas do IndexedDB:', tabelasFormatadas.length)
    } catch (error) {
      console.error('Erro ao carregar tabelas de preços:', error)
      toast({
        title: "Erro",
        description: "Falha ao carregar tabelas de preços. Verifique sua conexão.",
        variant: "destructive"
      })
      setTabelasPrecos([])
    }
  }


  // Atualizar pedido quando tipo de pedido for selecionado
  useEffect(() => {
    if (tipoPedidoSelecionado && tiposPedido.length > 0) {
      const tipoSelecionado = tiposPedido.find(t => String(t.CODTIPOPEDIDO) === tipoPedidoSelecionado)

      if (tipoSelecionado) {
        console.log('📋 Criando pedido com:', {
          tipoPedido: tipoSelecionado.NOME,
          codVendUsuario: codVendUsuario
        })

        setPedido({
          CODEMP: "1",
          CODCENCUS: "0",
          NUNOTA: "",
          MODELO_NOTA: String(tipoSelecionado.MODELO_NOTA),
          DTNEG: new Date().toISOString().split('T')[0],
          DTFATUR: "",
          DTENTSAI: "",
          CODPARC: "",
          CODTIPOPER: String(tipoSelecionado.CODTIPOPER),
          TIPMOV: tipoSelecionado.TIPMOV,
          CODTIPVENDA: String(tipoSelecionado.CODTIPVENDA),
          CODVEND: codVendUsuario,
          OBSERVACAO: "",
          VLOUTROS: 0,
          VLRDESCTOT: 0,
          VLRFRETE: 0,
          TIPFRETE: "S",
          ORDEMCARGA: "",
          CODPARCTRANSP: "0",
          PERCDESC: 0,
          CODNAT: "0",
          TIPO_CLIENTE: "PJ",
          CPF_CNPJ: "",
          IE_RG: "",
          RAZOAO_SOCIAL: "",
          itens: []
        })
        console.log('✅ Pedido criado com CODVEND:', codVendUsuario)
      }
    }
  }, [tipoPedidoSelecionado, tiposPedido, codVendUsuario])

  const handlePedidoSucesso = () => {
    toast({
      title: "Sucesso",
      description: "Pedido criado com sucesso!"
    })
    onClose()
  }

  const handleCancelar = () => {
    onClose()
  }

  const handleCriarPedido = async () => {
    if (!salvarPedidoRef.current) {
      toast({
        title: "Erro Inesperado",
        description: "Verificar nos Pedidos de Vendas FDV",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      console.log('🚀 Iniciando criação do pedido rápido...')
      const sucesso = await salvarPedidoRef.current()

      console.log('📊 Resultado da criação:', sucesso)

      if (sucesso) {
        console.log('✅ Pedido criado com sucesso, fechando modal...')

        // Aguardar um momento para o usuário ver a notificação
        await new Promise(resolve => setTimeout(resolve, 1500))

        // Fechar modal
        onClose()
      } else {
        console.error('❌ Pedido não foi criado')
        // Notificação já foi exibida pelo PedidoSyncService
        // NÃO fechar modal em caso de erro - deixar usuário ver a mensagem
      }
    } catch (error: any) {
      console.error("❌ Erro inesperado ao criar pedido:", error)

      // Notificação de erro já foi exibida
      // NÃO fechar modal - deixar usuário ver o erro
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-full w-full h-full md:max-w-[98vw] md:h-[98vh] p-0 overflow-hidden flex flex-col m-0 rounded-none md:rounded-lg">
        {loading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
              <div className="text-center space-y-2">
                <p className="text-base font-semibold text-foreground">Criando pedido de venda...</p>
                <p className="text-sm text-muted-foreground">Aguarde, não feche esta janela</p>
              </div>
            </div>
          </div>
        )}
        <DialogHeader className="px-4 md:px-6 py-3 md:py-4 border-b flex-shrink-0">
          <DialogTitle className="text-base md:text-lg">Criar Pedido de Venda Rápido</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-scroll scrollbar-hide px-4 md:px-6 py-4 pb-20">
          {pedido && tipoPedidoSelecionado && (
            <PedidoVendaFromLead
              dadosIniciais={pedido}
              onSuccess={handlePedidoSucesso}
              onCancel={handleCancelar}
              onSalvarPedido={(salvarFn) => {
                salvarPedidoRef.current = salvarFn
              }}
              isLeadVinculado={false}
            />
          )}
        </div>

        <div className="border-t px-4 md:px-6 py-3 md:py-4 flex-shrink-0 bg-background">
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelar}
              className="min-w-[100px]"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="min-w-[100px] bg-green-600 hover:bg-green-700"
              onClick={handleCriarPedido}
              disabled={loading || !tipoPedidoSelecionado || tiposPedido.length === 0}
            >
              {loading ? "Criando..." : "Criar Pedido"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}