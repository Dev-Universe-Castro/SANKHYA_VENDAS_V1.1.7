"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Trash2, Plus, Search, Package } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import ProdutoSelectorModal from "@/components/produto-selector-modal"
import EstoqueModal from "@/components/estoque-modal"
import VendedorSelectorModal from "@/components/vendedor-selector-modal"
import { PedidoSyncService } from "@/lib/pedido-sync"
import { OfflineDataService } from '@/lib/offline-data-service'

interface PedidoVendaFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export default function PedidoVendaForm({ onSuccess, onCancel }: PedidoVendaFormProps) {
  const [pedido, setPedido] = useState({
    CODEMP: "1",
    CODCENCUS: "0",
    NUNOTA: "",
    MODELO_NOTA: "",
    DTNEG: new Date().toISOString().split('T')[0],
    DTFATUR: "",
    DTENTSAI: "",
    CODPARC: "",
    CODTIPOPER: "974",
    TIPMOV: "P",
    CODTIPVENDA: "1",
    CODVEND: "0",
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
    RAZAO_SOCIAL: "",
    RAZAOSOCIAL: ""
  })

  const [itens, setItens] = useState<any[]>([])
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [showProdutoModal, setShowProdutoModal] = useState(false)
  const [showEstoqueModal, setShowEstoqueModal] = useState(false)
  const [produtoEstoqueSelecionado, setProdutoEstoqueSelecionado] = useState<any>(null)
  const [showVendedorModal, setShowVendedorModal] = useState(false)
  const [vendedores, setVendedores] = useState<any[]>([])
  const [parceiros, setParceiros] = useState<any[]>([])
  const [showParceiroModal, setShowParceiroModal] = useState(false)
  const [searchParceiro, setSearchParceiro] = useState("")
  const [tiposNegociacao, setTiposNegociacao] = useState<any[]>([])
  const [loadingTiposNegociacao, setLoadingTiposNegociacao] = useState(false)
  const [tabelasPrecos, setTabelasPrecos] = useState<any[]>([])
  const [loadingTabelasPrecos, setLoadingTabelasPrecos] = useState(false)
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const initializeData = async () => {
      const offline = await OfflineDataService.isDataAvailable();
      setIsOffline(offline);

      if (offline) {
        console.log("Sistema offline: Carregando dados do serviço offline.");
        await carregarDadosOffline();
      } else {
        console.log("Sistema online: Carregando dados da API.");
        carregarVendedorUsuario();
        carregarTiposNegociacao();
        verificarPermissaoAdmin();
        carregarTabelasPrecos();
      }
    };
    initializeData();
  }, []);

  const carregarDadosOffline = async () => {
    try {
      setLoadingTiposNegociacao(true);
      setLoadingTabelasPrecos(true);

      const [
        tiposOperacaoOffline,
        tabelasPrecosConfigOffline,
        vendedoresOffline,
        parceirosOffline
      ] = await Promise.all([
        OfflineDataService.getTiposOperacao(),
        OfflineDataService.getTabelasPrecosConfig(),
        OfflineDataService.getVendedores(),
        OfflineDataService.getParceiros()
      ]);

      setTiposNegociacao(tiposOperacaoOffline || []);
      setTabelasPrecos(tabelasPrecosConfigOffline || []);
      setVendedores(vendedoresOffline || []);
      setParceiros(parceirosOffline || []);

      console.log("✅ Dados offline carregados.");

      // Tentar carregar o vendedor do usuário localmente
      const userStr = localStorage.getItem('currentUser'); // Assumindo que o usuário logado é salvo no localStorage
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.codVendedor) {
          setPedido(prev => ({ ...prev, CODVEND: String(user.codVendedor) }));
          console.log('✅ Vendedor do usuário carregado do localStorage:', user.codVendedor);
        }
      }
      // Verificar permissão admin do localStorage também
      if (userStr) {
        const user = JSON.parse(userStr);
        setIsAdminUser(user.role === 'ADMIN');
      }

    } catch (error) {
      console.error("Erro ao carregar dados offline:", error);
      toast.error("Falha ao carregar dados offline.");
    } finally {
      setLoadingTiposNegociacao(false);
      setLoadingTabelasPrecos(false);
    }
  };

  const verificarPermissaoAdmin = () => {
    try {
      const userStr = document.cookie
        .split('; ')
        .find(row => row.startsWith('user='))
        ?.split('=')[1]

      if (userStr) {
        const user = JSON.parse(decodeURIComponent(userStr))
        setIsAdminUser(user.role === 'ADMIN')
      }
    } catch (error) {
      console.error('Erro ao verificar permissão admin:', error)
    }
  }

  const carregarVendedorUsuario = () => {
    try {
      const userStr = document.cookie
        .split('; ')
        .find(row => row.startsWith('user='))
        ?.split('=')[1]

      if (userStr) {
        const user = JSON.parse(decodeURIComponent(userStr))
        if (user.codVendedor) {
          setPedido(prev => ({ ...prev, CODVEND: String(user.codVendedor) }))
          console.log('✅ Vendedor do usuário carregado:', user.codVendedor)
        }
      }
    } catch (error) {
      console.error('Erro ao carregar vendedor do usuário:', error)
    }
  }

  const carregarVendedores = async () => {
    if (isOffline) {
      const cachedVendedores = await OfflineDataService.getVendedores();
      if (cachedVendedores) {
        setVendedores(cachedVendedores);
        console.log('✅ Vendedores carregados do serviço offline:', cachedVendedores.length);
      }
      return;
    }

    try {
      const response = await fetch('/api/vendedores'); // Assumindo que esta API retorna os vendedores
      if (!response.ok) throw new Error('Erro ao carregar vendedores');
      const data = await response.json();
      const vendedoresList = Array.isArray(data) ? data : (data.data || []);

      const vendedoresAtivos = vendedoresList.filter((v: any) =>
        v.ATIVO === 'S' && v.TIPVEND === 'V'
      );

      setVendedores(vendedoresAtivos);
      console.log('✅ Vendedores carregados da API:', vendedoresAtivos.length);
    } catch (error) {
      console.error('Erro ao carregar vendedores da API:', error);
      setVendedores([]);
      toast.error("Falha ao carregar vendedores.");
    }
  }

  const carregarTiposNegociacao = async () => {
    if (isOffline) {
      const cachedTiposOperacao = await OfflineDataService.getTiposOperacao();
      if (cachedTiposOperacao) {
        setTiposNegociacao(cachedTiposOperacao);
        console.log('✅ Tipos de negociação carregados do serviço offline:', cachedTiposOperacao.length);
      }
      return;
    }

    try {
      setLoadingTiposNegociacao(true)

      // Tentar buscar do cache primeiro
      const cachedTiposOperacao = sessionStorage.getItem('cached_tiposOperacao')
      if (cachedTiposOperacao) {
        try {
          const data = JSON.parse(cachedTiposOperacao)
          setTiposNegociacao(Array.isArray(data) ? data : [])
          console.log('✅ Tipos de negociação carregados do cache:', data.length)
          return
        } catch (e) {
          console.error('Erro ao parsear cache de tipos de operação:', e)
          sessionStorage.removeItem('cached_tiposOperacao')
        }
      }

      // Se não houver cache, buscar da API
      const response = await fetch('/api/sankhya/tipos-negociacao?tipo=operacao')
      if (response.ok) {
        const data = await response.json()
        const tiposOperacaoList = data.tiposOperacao || []
        setTiposNegociacao(tiposOperacaoList)
        console.log('✅ Tipos de negociação carregados:', tiposOperacaoList.length)

        // Salvar no cache
        if (tiposOperacaoList.length > 0) {
          sessionStorage.setItem('cached_tiposOperacao', JSON.stringify(tiposOperacaoList))
        }
      }
    } catch (error) {
      console.error('Erro ao carregar tipos de negociação:', error)
      setTiposNegociacao([])
    } finally {
      setLoadingTiposNegociacao(false)
    }
  }

  const carregarTabelasPrecos = async () => {
    if (isOffline) {
      const cachedTabelas = await OfflineDataService.getTabelasPrecos();
      if (cachedTabelas) {
        setTabelasPrecos(cachedTabelas);
        console.log('✅ Tabelas de preços carregadas do serviço offline:', cachedTabelas.length);
      }
      return;
    }

    try {
      setLoadingTabelasPrecos(true)

      const response = await fetch('/api/tabelas-precos-config')
      if (!response.ok) throw new Error('Erro ao carregar tabelas de preços configuradas')
      const data = await response.json()
      const tabelas = data.configs || []

      const tabelasFormatadas = tabelas.map((config: any) => ({
        NUTAB: config.NUTAB,
        CODTAB: config.CODTAB,
        DESCRICAO: config.DESCRICAO,
        ATIVO: config.ATIVO
      }))

      setTabelasPrecos(tabelasFormatadas)
      console.log('✅ Tabelas de preços configuradas carregadas:', tabelasFormatadas.length)
    } catch (error) {
      console.error('Erro ao carregar tabelas de preços configuradas:', error)
      toast.error("Falha ao carregar tabelas de preços. Verifique as configurações.")
      setTabelasPrecos([])
    } finally {
      setLoadingTabelasPrecos(false)
    }
  }

  const buscarParceiros = async (termo: string) => {
    if (termo.length < 3) {
      setParceiros([])
      return
    }

    if (isOffline) {
      const parceirosOffline = await OfflineDataService.getParceiros();
      const filteredParceiros = parceirosOffline?.filter((p: any) =>
        p.NOMEPARC.toLowerCase().includes(termo.toLowerCase()) ||
        p.RAZAOSOCIAL.toLowerCase().includes(termo.toLowerCase()) ||
        p.CODPARC.toString().includes(termo) ||
        p.CGC_CPF.replace(/[^\d]/g, '').includes(termo.replace(/[^\d]/g, ''))
      ) || [];
      setParceiros(filteredParceiros);
      console.log(`✅ Parceiros offline encontrados para "${termo}":`, filteredParceiros.length);
      return;
    }

    try {
      const response = await fetch(`/api/sankhya/parceiros/search?termo=${encodeURIComponent(termo)}`)
      if (response.ok) {
        const data = await response.json()
        setParceiros(data)
      }
    } catch (error) {
      console.error('Erro ao buscar parceiros:', error)
      toast.error('Erro ao buscar parceiros')
    }
  }

  const selecionarParceiro = async (parceiro: any) => {
    console.log('🔍 Parceiro selecionado:', parceiro)

    setPedido(prev => ({
      ...prev,
      CODPARC: String(parceiro.CODPARC),
      RAZAOSOCIAL: parceiro.RAZAOSOCIAL || parceiro.NOMEPARC,
      RAZAO_SOCIAL: parceiro.RAZAOSOCIAL || parceiro.NOMEPARC,
      CPF_CNPJ: parceiro.CGC_CPF || '',
      IE_RG: parceiro.IDENTINSCESTAD || '',
      TIPO_CLIENTE: parceiro.TIPPESSOA === 'J' ? 'PJ' : 'PF'
    }))

    setShowParceiroModal(false)
    setParceiros([])
    setSearchParceiro("")
    toast.success(`Parceiro ${parceiro.RAZAOSOCIAL || parceiro.NOMEPARC} selecionado`)
  }

  const handleConfirmarProdutoEstoque = async (produto: any, quantidade: number, desconto: number, tabelaPreco?: string) => {
    try {
      console.log('📦 Produto confirmado:', { produto, quantidade, desconto, tabelaPreco })

      let vlrUnit = produto.AD_VLRUNIT || 0
      let vlrUnitTabela = vlrUnit

      if (tabelaPreco && tabelaPreco !== 'PADRAO' && !isOffline) { // Só busca preço da tabela online se não estiver offline
        try {
          const responsePreco = await fetch(
            `/api/oracle/preco?codProd=${produto.CODPROD}&tabelaPreco=${encodeURIComponent(tabelaPreco)}`
          )

          if (responsePreco.ok) {
            const dataPreco = await responsePreco.json()
            if (dataPreco.preco) {
              vlrUnitTabela = dataPreco.preco
              vlrUnit = dataPreco.preco
              console.log('💰 Preço da tabela aplicado:', vlrUnitTabela)
            }
          }
        } catch (error) {
          console.error('❌ Erro ao buscar preço da tabela:', error)
          toast.error('Erro ao buscar preço da tabela')
        }
      } else if (tabelaPreco && tabelaPreco !== 'PADRAO' && isOffline) {
        // Se offline, tenta buscar o preço da tabela offline
        const tabelas = await OfflineDataService.getTabelasPrecos();
        const tabelaSelecionada = tabelas?.find((t: any) => t.CODTAB === tabelaPreco);
        if (tabelaSelecionada && tabelaSelecionada.preco) { // Assumindo que o preço está na estrutura offline
          vlrUnitTabela = tabelaSelecionada.preco;
          vlrUnit = tabelaSelecionada.preco;
          console.log('💰 Preço da tabela offline aplicado:', vlrUnitTabela);
        } else {
          console.warn(`Preço da tabela ${tabelaPreco} não encontrado offline.`);
        }
      }

      const vlrDesconto = (vlrUnit * desconto) / 100
      const vlrUnitFinal = vlrUnit - vlrDesconto
      const vlrTotal = vlrUnitFinal * quantidade

      const novoItem = {
        CODPROD: produto.CODPROD,
        DESCRPROD: produto.DESCRPROD,
        QTDNEG: quantidade,
        VLRUNIT: vlrUnitFinal,
        VLRTOT: vlrTotal,
        PERCDESC: desconto,
        VLRDESC: vlrDesconto * quantidade,
        CODVOL: produto.CODVOL || 'UN',
        CONTROLE: produto.CONTROLE || 'N',
        AD_VLRUNIT: vlrUnit, // Preço base original
        TABELA_PRECO: tabelaPreco || 'PADRAO'
      }

      setItens(prev => [...prev, novoItem])
      setShowEstoqueModal(false)
      setProdutoEstoqueSelecionado(null)
      toast.success('Produto adicionado ao pedido')
    } catch (error) {
      console.error('❌ Erro ao adicionar produto:', error)
      toast.error('Erro ao adicionar produto')
    }
  }

  const removerItem = (index: number) => {
    setItens(prev => prev.filter((_, i) => i !== index))
    toast.success('Produto removido')
  }

  const calcularTotalPedido = () => {
    const totalItens = itens.reduce((acc, item) => acc + (item.VLRTOT || 0), 0)
    return totalItens
  }

  const handleSubmit = async () => {
    try {
      const dadosAtuaisPedido = { ...pedido }
      const cpfCnpj = dadosAtuaisPedido.CPF_CNPJ
      const ieRg = dadosAtuaisPedido.IE_RG
      const razaoSocial = dadosAtuaisPedido.RAZAOSOCIAL || dadosAtuaisPedido.RAZAO_SOCIAL

      if (!cpfCnpj) {
        toast.error("CPF/CNPJ não encontrado", {
          description: "Preencha o CPF/CNPJ do parceiro."
        })
        return
      }

      if (!ieRg) {
        toast.error("IE/RG não encontrado", {
          description: "Preencha a IE/RG do parceiro."
        })
        return
      }

      if (!razaoSocial) {
        toast.error("Razão Social não encontrada", {
          description: "Preencha a Razão Social do parceiro."
        })
        return
      }

      if (!dadosAtuaisPedido.CODVEND || dadosAtuaisPedido.CODVEND === "0") {
        toast.error("Vendedor não vinculado. Entre em contato com o administrador.")
        return
      }

      if (itens.length === 0) {
        toast.error("Adicione pelo menos um produto ao pedido")
        return
      }

      const pedidoCompleto = {
        ...dadosAtuaisPedido,
        CPF_CNPJ: cpfCnpj,
        IE_RG: ieRg,
        RAZAO_SOCIAL: razaoSocial,
        RAZAOSOCIAL: razaoSocial,
        itens: itens.map(item => ({
          CODPROD: item.CODPROD,
          QTDNEG: item.QTDNEG,
          VLRUNIT: item.VLRUNIT,
          PERCDESC: item.PERCDESC || 0,
          CODVOL: item.CODVOL || 'UN'
        }))
      }

      console.log('📤 Enviando pedido:', pedidoCompleto)

      // Usar serviço de sincronização híbrida
      const result = await PedidoSyncService.salvarPedido(pedidoCompleto)

      if (!result.success) {
        throw new Error("Erro ao salvar pedido")
      }

      toast.success('Pedido criado com sucesso!', {
        description: `Número: ${result.data.NUNOTA}`
      })

      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error('❌ Erro ao salvar pedido:', error)
      toast.error('Erro ao criar pedido', {
        description: error.message
      })
    }
  }

  return (
    <div className="space-y-4">
      {/* Dados do Parceiro */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-green-700">Dados do Parceiro</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Parceiro *</Label>
              <div className="flex gap-1">
                <Input
                  value={pedido.RAZAOSOCIAL || pedido.RAZAO_SOCIAL || ''}
                  readOnly
                  placeholder="Buscar parceiro..."
                  className="text-xs md:text-sm h-8 md:h-10 bg-gray-50"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowParceiroModal(true)}
                  className="h-8 w-8 md:h-10 md:w-10"
                >
                  <Search className="h-3 w-3 md:h-4 md:w-4" />
                </Button>
              </div>
              {pedido.CODPARC && (
                <div className="text-[10px] md:text-xs text-muted-foreground mt-1">
                  Código: {pedido.CODPARC}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tipo Cliente *</Label>
              <Select value={pedido.TIPO_CLIENTE} onValueChange={(value) => setPedido({ ...pedido, TIPO_CLIENTE: value })}>
                <SelectTrigger className="text-xs md:text-sm h-8 md:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                  <SelectItem value="PF">Pessoa Física</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">CPF/CNPJ *</Label>
              <Input
                value={pedido.CPF_CNPJ || ''}
                onChange={(e) => setPedido(prev => ({ ...prev, CPF_CNPJ: e.target.value }))}
                placeholder="Digite o CPF/CNPJ"
                className="text-xs md:text-sm h-8 md:h-10"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">IE/RG *</Label>
              <Input
                value={pedido.IE_RG || ''}
                onChange={(e) => setPedido(prev => ({ ...prev, IE_RG: e.target.value }))}
                placeholder="Digite a IE/RG"
                className="text-xs md:text-sm h-8 md:h-10"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Razão Social *</Label>
              <Input
                value={pedido.RAZAO_SOCIAL || ''}
                onChange={(e) => setPedido(prev => ({ ...prev, RAZAO_SOCIAL: e.target.value }))}
                placeholder="Digite a Razão Social"
                className="text-xs md:text-sm h-8 md:h-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dados da Nota */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <h3 className="text-sm font-semibold text-green-700">Dados da Nota</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Modelo Nota *</Label>
              <Input
                type="number"
                value={pedido.MODELO_NOTA}
                onChange={(e) => setPedido({ ...pedido, MODELO_NOTA: e.target.value })}
                placeholder="Digite o número do modelo"
                className="text-xs md:text-sm h-8 md:h-10"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tipo de Movimento</Label>
              <Select value={pedido.TIPMOV} onValueChange={(value) => setPedido({ ...pedido, TIPMOV: value })}>
                <SelectTrigger className="text-xs md:text-sm h-8 md:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="P">Pedido</SelectItem>
                  <SelectItem value="V">Venda</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tipo de Operação *</Label>
              <Select
                value={pedido.CODTIPOPER}
                onValueChange={(value) => setPedido({ ...pedido, CODTIPOPER: value })}
                disabled={loadingTiposNegociacao}
              >
                <SelectTrigger className="text-xs md:text-sm h-8 md:h-10">
                  <SelectValue placeholder={loadingTiposNegociacao ? "Carregando..." : "Selecione"} />
                </SelectTrigger>
                <SelectContent>
                  {tiposNegociacao.map((tipo) => (
                    <SelectItem key={tipo.CODTIPOPER} value={String(tipo.CODTIPOPER)}>
                      {tipo.CODTIPOPER} - {tipo.DESCRTIPOPER}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Data Negociação *</Label>
              <Input
                type="date"
                value={pedido.DTNEG}
                onChange={(e) => setPedido({ ...pedido, DTNEG: e.target.value })}
                max={new Date().toISOString().split('T')[0]}
                className="text-xs md:text-sm h-8 md:h-10"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">
                Vendedor *
                {!isAdminUser && pedido.CODVEND !== "0" && (
                  <span className="ml-2 text-[10px] text-orange-600 font-semibold">(🔒 Automático)</span>
                )}
                {isAdminUser && (
                  <span className="ml-2 text-[10px] text-green-600 font-semibold">(✅ Editável)</span>
                )}
              </Label>
              <div className="flex gap-1">
                <Input
                  value={pedido.CODVEND}
                  readOnly
                  placeholder={!isAdminUser ? "Vendedor vinculado ao usuário" : "Código do Vendedor"}
                  className={`text-xs md:text-sm h-8 md:h-10 ${!isAdminUser ? 'bg-gray-100 cursor-not-allowed' : 'bg-gray-50'}`}
                />
                {isAdminUser && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={async () => {
                      await carregarVendedores() // Carrega vendedores online ou offline
                      setShowVendedorModal(true)
                    }}
                    className="h-8 w-8 md:h-10 md:w-10"
                  >
                    <Search className="h-3 w-3 md:h-4 md:w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1 md:col-span-3">
              <Label className="text-xs">Observação</Label>
              <Textarea
                value={pedido.OBSERVACAO}
                onChange={(e) => setPedido({ ...pedido, OBSERVACAO: e.target.value })}
                placeholder="Digite observações adicionais"
                className="text-xs md:text-sm min-h-[60px] md:min-h-[80px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Itens do Pedido */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-green-700">Itens do Pedido</h3>
            <Button
              type="button"
              size="sm"
              onClick={() => setShowProdutoModal(true)}
              className="h-7 md:h-8 text-xs"
            >
              <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1" />
              Adicionar Item
            </Button>
          </div>

          {itens.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhum produto adicionado
            </div>
          ) : (
            <div className="space-y-2">
              {itens.map((item, index) => (
                <Card key={index} className="border-green-200">
                  <CardContent className="p-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-start gap-2">
                          <Package className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs md:text-sm font-medium break-words">{item.DESCRPROD}</p>
                            <p className="text-[10px] md:text-xs text-muted-foreground">Cód: {item.CODPROD}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-1 md:gap-2 text-[10px] md:text-xs mt-2">
                          <div>
                            <span className="text-muted-foreground">Qtd:</span>
                            <span className="ml-1 font-medium">{item.QTDNEG}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Unit:</span>
                            <span className="ml-1 font-medium">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.VLRUNIT)}
                            </span>
                          </div>
                          {item.PERCDESC > 0 && (
                            <div>
                              <span className="text-muted-foreground">Desc:</span>
                              <span className="ml-1 font-medium text-orange-600">{item.PERCDESC}%</span>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground">Total:</span>
                            <span className="ml-1 font-medium text-green-600">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.VLRTOT)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removerItem(index)}
                        className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                      >
                        <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Total do Pedido */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm md:text-base font-semibold">Total do Pedido:</span>
            <span className="text-lg md:text-xl font-bold text-green-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calcularTotalPedido())}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Botões de Ação */}
      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
        )}
        <Button type="button" onClick={handleSubmit} className="flex-1">
          Salvar Pedido
        </Button>
      </div>

      {/* Modal de Busca de Produto */}
      <ProdutoSelectorModal
        isOpen={showProdutoModal}
        onClose={() => setShowProdutoModal(false)}
        onConfirm={(produto) => {
          setProdutoEstoqueSelecionado(produto)
          setShowProdutoModal(false)
          setShowEstoqueModal(true)
        }}
        titulo="Buscar Produto para Pedido"
      />

      {/* Modal de Estoque */}
      <EstoqueModal
        isOpen={showEstoqueModal}
        onClose={() => setShowEstoqueModal(false)}
        product={produtoEstoqueSelecionado}
        onConfirm={handleConfirmarProdutoEstoque}
      />

      {/* Modal de Seleção de Vendedor */}
      <VendedorSelectorModal
        isOpen={showVendedorModal}
        onClose={() => setShowVendedorModal(false)}
        onSelect={(codVendedor) => {
          setPedido({ ...pedido, CODVEND: String(codVendedor) })
          const vendedorSelecionado = vendedores.find(v => v.CODVEND === codVendedor)
          toast.success(`Vendedor ${vendedorSelecionado?.APELIDO || codVendedor} selecionado`)
        }}
        tipo="vendedor"
      />

      {/* Modal de Busca de Parceiro */}
      <Dialog open={showParceiroModal} onOpenChange={setShowParceiroModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">Buscar Parceiro</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={searchParceiro}
                onChange={(e) => {
                  setSearchParceiro(e.target.value)
                  buscarParceiros(e.target.value)
                }}
                placeholder="Digite nome, CNPJ/CPF ou código do parceiro..."
                className="text-xs md:text-sm"
              />
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2">
              {parceiros.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {searchParceiro.length >= 3 ? 'Nenhum parceiro encontrado' : 'Digite pelo menos 3 caracteres para buscar'}
                </div>
              ) : (
                parceiros.map((parceiro) => (
                  <Card
                    key={parceiro.CODPARC}
                    className="cursor-pointer hover:bg-green-50 transition-colors"
                    onClick={() => selecionarParceiro(parceiro)}
                  >
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">{parceiro.RAZAOSOCIAL || parceiro.NOMEPARC}</p>
                          <p className="text-xs text-muted-foreground">
                            {parceiro.CGC_CPF} | Cód: {parceiro.CODPARC}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}