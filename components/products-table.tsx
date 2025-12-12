"use client"

import { useState, useEffect, useRef } from "react"
import { Search, ChevronLeft, ChevronRight, Package, Eye, ChevronDown, ChevronUp, WifiOff, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EstoqueModal } from "@/components/estoque-modal"
import { useToast } from "@/hooks/use-toast"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { OfflineDataService } from '@/lib/offline-data-service'


interface Produto {
  _id: string
  CODPROD: string
  DESCRPROD: string
  ATIVO: string
  LOCAL?: string
  MARCA?: string
  CARACTERISTICAS?: string
  UNIDADE?: string
  VLRCOMERC?: string
  ESTOQUE?: string
  estoqueTotal?: number // Adicionado para o modal
  preco?: number       // Adicionado para o modal
  estoques?: any[]     // Adicionado para o modal
}

interface PaginatedResponse {
  produtos: Produto[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const ITEMS_PER_PAGE = 20

export default function ProductsTable() {
  const [produtos, setProdutos] = useState<any[]>([])
  const [produtosFiltrados, setProdutosFiltrados] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchName, setSearchName] = useState("")
  const [searchCode, setSearchCode] = useState("")
  const [appliedSearchName, setAppliedSearchName] = useState("") // Estado para o nome de busca aplicado
  const [appliedSearchCode, setAppliedSearchCode] = useState("") // Estado para o código de busca aplicado
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const { toast } = useToast()
  const loadingRef = useRef(false)
  const [filtrosAbertos, setFiltrosAbertos] = useState(false) // Estado para controlar filtros colapsáveis
  const [tabelasPrecos, setTabelasPrecos] = useState<any[]>([])
  const [tabelaSelecionada, setTabelaSelecionada] = useState<string>('0')
  const [precoProduto, setPrecoProduto] = useState<number>(0)
  const [loadingPreco, setLoadingPreco] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [produtoSelecionado, setSelectedProduct] = useState<Produto | null>(null); // Estado para o produto selecionado no modal
  const [estoqueModalOpen, setEstoqueModalOpen] = useState(false); // Estado para controlar a abertura do modal
  const [produtoEstoque, setProdutoEstoque] = useState<any>(null); // Estado para armazenar os dados de estoque do produto
  const [loadingEstoque, setLoadingEstoque] = useState(false); // Estado para indicar o carregamento do estoque


  useEffect(() => {
    const handleOnline = () => {
      console.log("✅ Conexão restabelecida!")
      setIsOffline(false)
      // Tenta recarregar os produtos quando a conexão volta
      loadProducts().finally(() => {
        toast({
          title: "Conectado",
          description: "Sua conexão foi restabelecida. Os dados foram atualizados.",
          variant: "default",
        });
      })
    }
    const handleOffline = () => {
      console.log("⚠️ Modo Offline!")
      setIsOffline(true)
      // Ao ficar offline, carrega os dados do cache local
      loadProducts().finally(() => {
        toast({
          title: "Modo Offline",
          description: "Você está sem conexão. Exibindo dados em cache.",
          variant: "default",
          icon: <WifiOff className="w-4 h-4 text-yellow-500" />
        });
      })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Verifica o estado inicial da conexão ao montar o componente
    if (navigator.onLine) {
      handleOnline()
    } else {
      handleOffline()
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])


  useEffect(() => {
    if (loadingRef.current) {
      console.log('⏭️ Pulando requisição duplicada (Strict Mode)')
      return
    }

    loadingRef.current = true
    loadProducts().finally(() => {
      loadingRef.current = false
    })
  }, [currentPage, isOffline]) // Requisita novamente se a página ou o status offline mudar


  // Carregar produtos do cache ao montar o componente (apenas se já estiver offline)
  useEffect(() => {
    if (isOffline) {
      const cached = sessionStorage.getItem('cached_produtos');
      if (cached) {
        try {
          const parsedData = JSON.parse(cached)
          const allProdutos = Array.isArray(parsedData) ? parsedData : (parsedData.produtos || [])

          if (allProdutos.length > 0) {
            console.log('✅ Carregando produtos iniciais do cache (offline):', allProdutos.length)
            setProdutos(allProdutos.slice(0, ITEMS_PER_PAGE));
            setTotalPages(Math.ceil(allProdutos.length / ITEMS_PER_PAGE));
            setTotalRecords(allProdutos.length);
            setLoading(false); // Altera o estado de loading
          }
        } catch (e) {
          console.error('Erro ao carregar cache inicial de produtos (offline):', e)
          sessionStorage.removeItem('cached_produtos');
        }
      } else {
        // Se não houver cache e estiver offline, tenta carregar do serviço offline
        loadProductsOfflineFallback();
      }
    }
  }, [isOffline]); // Executa apenas uma vez ao montar o componente ou quando o status offline muda para true


  useEffect(() => {
    carregarTabelasPrecos()
  }, [isOffline]) // Recarrega tabelas de preço se ficar offline

  const carregarTabelasPrecos = async () => {
    try {
      console.log('💰 Carregando tabelas de preços do IndexedDB...')

      const tabelasOffline = await OfflineDataService.getTabelasPrecosConfig()
      const tabelasFormatadas = tabelasOffline.map((config: any) => ({
        NUTAB: config.NUTAB,
        CODTAB: config.CODTAB,
        DESCRICAO: config.DESCRICAO,
        ATIVO: config.ATIVO
      }))

      setTabelasPrecos(tabelasFormatadas)
      if (tabelasFormatadas.length > 0) {
        setTabelaSelecionada(String(tabelasFormatadas[0].NUTAB))
      }

      console.log(`✅ ${tabelasFormatadas.length} tabelas de preços carregadas do IndexedDB`)
    } catch (error) {
      console.error('❌ Erro ao carregar tabelas de preços do IndexedDB:', error)
      setTabelasPrecos([])
      toast({
        title: "Erro",
        description: "Falha ao carregar tabelas de preços do banco local.",
        variant: "destructive",
      })
    }
  }

  const buscarPrecoProduto = async (codProd: string, nutab: string) => {
    if (!codProd || !nutab) return

    setLoadingPreco(true)
    try {
      const codProdNumber = Number(codProd);
      const nutabNumber = Number(nutab);

      console.log('🔍 Buscando preço - CODPROD:', codProdNumber, 'NUTAB:', nutabNumber);

      if (!codProdNumber || codProdNumber <= 0 || !nutabNumber || nutabNumber <= 0) {
        console.error('❌ Parâmetros inválidos - CODPROD:', codProdNumber, 'NUTAB:', nutabNumber);
        setPrecoProduto(0);
        return;
      }

      // SEMPRE buscar do IndexedDB primeiro (online ou offline)
      console.log('💾 Buscando preço do IndexedDB...');
      const excecoesOffline = await OfflineDataService.getPrecos(codProdNumber, nutabNumber);

      if (excecoesOffline.length > 0 && excecoesOffline[0].VLRVENDA !== null && excecoesOffline[0].VLRVENDA !== undefined) {
        const precoStr = String(excecoesOffline[0].VLRVENDA).replace(/,/g, '.');
        const preco = parseFloat(precoStr);

        if (!isNaN(preco) && preco >= 0) {
          setPrecoProduto(preco);
          console.log(`✅ Preço carregado do IndexedDB: R$ ${preco.toFixed(2)}`);
          return;
        }
      }

      // Se não encontrou no IndexedDB e está online, buscar da API
      if (navigator.onLine) {
        console.log('🌐 Preço não encontrado no IndexedDB, buscando da API...');
        try {
          const response = await fetch(`/api/oracle/preco?codProd=${codProd}&nutab=${nutab}`);

          if (!response.ok) {
            throw new Error('Erro ao buscar preço');
          }

          const data = await response.json();
          const preco = parseFloat(data.preco || '0');

          if (!isNaN(preco) && preco >= 0) {
            setPrecoProduto(preco);
            console.log(`✅ Preço carregado da API: R$ ${preco.toFixed(2)}`);
          } else {
            setPrecoProduto(0);
            console.log('⚠️ Preço inválido retornado da API');
          }
        } catch (apiError) {
          console.error('❌ Erro ao buscar preço da API:', apiError);
          setPrecoProduto(0);
        }
      } else {
        console.warn('⚠️ Offline e sem preço no IndexedDB');
        setPrecoProduto(0);
      }
    } catch (error) {
      console.error('❌ Erro geral ao buscar preço:', error)
      setPrecoProduto(0)
      toast({
        title: "Erro",
        description: "Falha ao carregar preço.",
        variant: "destructive",
      })
    } finally {
      setLoadingPreco(false)
    }
  }


  // Função para aplicar filtros ao clicar no botão
  const handleSearch = () => {
    setAppliedSearchName(searchName)
    setAppliedSearchCode(searchCode)
    setCurrentPage(1)
  }

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }


  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
    }
  }

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1)
    }
  }

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalRecords)

  // Função para carregar produtos do IndexedDB e aplicar filtros
  const loadProducts = async () => {
    try {
      setLoading(true)

      console.log('📦 Carregando produtos do IndexedDB...')

      // Buscar TODOS os produtos do IndexedDB
      const todosProdutos = await OfflineDataService.getProdutos({ ativo: 'S' })

      if (todosProdutos.length === 0) {
        console.warn('⚠️ Nenhum produto encontrado no IndexedDB')
        toast({
          title: "Aviso",
          description: "Nenhum produto encontrado. Execute o prefetch para sincronizar os dados.",
          variant: "destructive",
        })
        setProdutos([])
        setTotalRecords(0)
        setTotalPages(0)
        setProdutosFiltrados([]) // Limpa a lista de produtos filtrados
        return
      }

      setProdutos(todosProdutos)
      console.log(`✅ ${todosProdutos.length} produtos carregados do IndexedDB`)

      // Aplicar filtros localmente com base nos termos aplicados
      aplicarFiltros(todosProdutos, 1) // Sempre volta para a página 1 ao carregar/filtrar

    } catch (error) {
      console.error('❌ Erro ao carregar produtos do IndexedDB:', error)
      toast({
        title: "Erro",
        description: "Falha ao carregar produtos do banco local.",
        variant: "destructive",
      })
      setProdutos([])
      setProdutosFiltrados([])
    } finally {
      setLoading(false)
    }
  }

  // Fallback para carregar produtos do serviço offline (se aplicável)
  const loadProductsOfflineFallback = async () => {
    console.warn("⚠️ Tentando carregar produtos do serviço offline como fallback...")
    // Implemente a lógica de carregamento do serviço offline aqui, se necessário
    // Por enquanto, apenas exibe um aviso
    toast({
      title: "Modo Offline",
      description: "Não foi possível carregar dados do cache. Verifique sua conexão.",
      variant: "destructive",
      icon: <WifiOff className="w-4 h-4 text-yellow-500" />
    });
  }

  // Nova função para aplicar filtros localmente e gerenciar paginação
  const aplicarFiltros = (todosProdutos: any[], page: number) => {
    let produtosFiltrados = [...todosProdutos]

    // Filtrar por nome aplicado
    if (appliedSearchName.trim()) {
      const searchLower = appliedSearchName.toLowerCase()
      produtosFiltrados = produtosFiltrados.filter(p =>
        p.DESCRPROD?.toLowerCase().includes(searchLower)
      )
    }

    // Filtrar por código aplicado
    if (appliedSearchCode.trim()) {
      produtosFiltrados = produtosFiltrados.filter(p =>
        p.CODPROD?.toString().includes(appliedSearchCode)
      )
    }

    // Paginação
    const total = produtosFiltrados.length
    const totalPgs = Math.ceil(total / ITEMS_PER_PAGE)
    const startIdx = (page - 1) * ITEMS_PER_PAGE
    const endIdx = startIdx + ITEMS_PER_PAGE
    const produtosPaginados = produtosFiltrados.slice(startIdx, endIdx)

    setProdutosFiltrados(produtosPaginados)
    setTotalRecords(total)
    setTotalPages(totalPgs)
    setCurrentPage(page)

    console.log(`📊 Filtros aplicados: ${total} produtos encontrados (exibindo ${produtosPaginados.length})`)
  }

  // Carrega produtos iniciais ao montar o componente
  useEffect(() => {
    loadProducts()
  }, []) // Executa apenas uma vez ao montar

  // Aplica filtros quando os termos de busca ATUAIS (aplicados) mudam
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (produtos.length > 0) {
        // Aplica filtros com base nos termos JÁ DEFINIDOS (appliedSearchName, appliedSearchCode)
        aplicarFiltros(produtos, 1) // Reseta para a página 1 ao mudar filtros aplicados
      } else {
        loadProducts() // Carrega produtos se a lista estiver vazia
      }
    }, 500) // Atraso de 500ms para debounce

    return () => clearTimeout(delayDebounceFn)
  }, [appliedSearchName, appliedSearchCode]) // Depende dos termos de busca aplicados

  // Atualiza a lista de produtos exibidos quando a paginação muda
  useEffect(() => {
    // Só aplica filtros se houver produtos carregados
    if (produtos.length > 0) {
      aplicarFiltros(produtos, currentPage)
    }
  }, [currentPage, produtos.length]) // Depende da página e do tamanho da lista de produtos


  const buscarEstoque = async (codProd: string) => {
    if (!codProd) return

    setLoadingEstoque(true)
    try {
      console.log(`📦 Buscando estoque do produto ${codProd} no IndexedDB...`)

      const estoquesOffline = await OfflineDataService.getEstoque(Number(codProd))
      const estoqueTotal = estoquesOffline.reduce((sum: number, e: any) =>
        sum + (parseFloat(e.ESTOQUE) || 0), 0
      )

      setProdutoEstoque({
        estoques: estoquesOffline,
        total: estoquesOffline.length,
        estoqueTotal
      })

      console.log(`✅ Estoque carregado: ${estoqueTotal} unidades`)
    } catch (error) {
      console.error('❌ Erro ao buscar estoque do IndexedDB:', error)
      setProdutoEstoque(null)
      toast({
        title: "Erro",
        description: "Falha ao carregar estoque do banco local.",
        variant: "destructive",
      })
    } finally {
      setLoadingEstoque(false)
    }
  }

  const abrirModal = async (produto: Produto) => { // Tipo explícito para produto
    setSelectedProduct(produto)
    setEstoqueModalOpen(true)
    setPrecoProduto(0)

    // Buscar estoque ao abrir o modal
    await buscarEstoque(produto.CODPROD)
  }

  // UseEffect para buscar preço quando modal abre ou tabela de preço muda
  useEffect(() => {
    if (estoqueModalOpen && produtoSelecionado && tabelaSelecionada) {
      buscarPrecoProduto(produtoSelecionado.CODPROD, tabelaSelecionada)
    }
  }, [estoqueModalOpen, produtoSelecionado, tabelaSelecionada])

  const formatCurrency = (value: number | undefined | string): string => {
    if (value === undefined || value === null) return 'R$ 0,00';
    let numValue: number;
    if (typeof value === 'string') {
      numValue = parseFloat(value.replace(',', '.')); // Tenta converter strings com vírgula decimal
      if (isNaN(numValue)) {
        numValue = 0; // Se a conversão falhar, usa 0
      }
    } else {
      numValue = value;
    }

    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numValue);
  }

  const getAvatarColor = (name: string) => {
    const colors = [
      '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#10B981',
      '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6',
      '#A855F7', '#EC4899', '#F43F5E'
    ];
    const hash = name.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    return colors[hash % colors.length];
  }

  // Filtra produtos com base no termo de busca, considerando todos os campos relevantes
  // Esta parte parece redundante com aplicarFiltros, mas pode ser usada para pré-visualização
  const filteredProducts = searchName || searchCode
    ? produtosFiltrados.filter(produto =>
        (searchCode ? produto.CODPROD?.toString().includes(searchCode) : true) &&
        (searchName ? produto.DESCRPROD?.toLowerCase().includes(searchName.toLowerCase()) : true)
      )
    : produtosFiltrados; // Usa a lista já filtrada e paginada

  return (
    <div className="h-full flex flex-col">
      {/* Header - Desktop */}
      <div className="hidden md:block border-b p-6">
        <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
        <p className="text-muted-foreground">
          Consulta e gerenciamento de produtos
        </p>
      </div>

      {/* Header - Mobile */}
      <div className="md:hidden border-b px-3 py-3">
        <h1 className="text-lg font-bold">Produtos</h1>
        <p className="text-xs text-muted-foreground">
          Consulta e gerenciamento de produtos
        </p>
      </div>

      {/* Filtros de Busca - Desktop */}
      <div className="hidden md:block border-b p-6">
        <Card>
          <CardHeader>
            <CardTitle>Filtros de Busca</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="searchCode" className="text-xs md:text-sm font-medium">
                  Código
                </Label>
                <Input
                  id="searchCode"
                  type="text"
                  placeholder="Buscar por código"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  onKeyPress={handleSearchKeyPress}
                  className="h-9 md:h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="searchName" className="text-xs md:text-sm font-medium">
                  Descrição
                </Label>
                <Input
                  id="searchName"
                  type="text"
                  placeholder="Buscar por descrição"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  onKeyPress={handleSearchKeyPress}
                  className="h-9 md:h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5 md:self-end">
                <Label className="text-xs md:text-sm font-medium opacity-0 hidden md:block">Ação</Label>
                <Button
                  onClick={handleSearch}
                  disabled={loading}
                  className="w-full h-9 md:h-10 text-sm bg-green-600 hover:bg-green-700"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {loading ? 'Buscando...' : 'Buscar Produtos'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros de Busca - Mobile (Colapsável) */}
      <div className="md:hidden border-b">
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
            <Card>
              <CardContent className="p-4 space-y-4 bg-muted/30">
                <div className="space-y-1.5">
                  <Label htmlFor="searchCodeMobile" className="text-xs md:text-sm font-medium">
                    Código
                  </Label>
                  <Input
                    id="searchCodeMobile"
                    type="text"
                    placeholder="Buscar por código"
                    value={searchCode}
                    onChange={(e) => setSearchCode(e.target.value)}
                    onKeyPress={handleSearchKeyPress}
                    className="h-9 md:h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="searchNameMobile" className="text-xs md:text-sm font-medium">
                    Descrição
                  </Label>
                  <Input
                    id="searchNameMobile"
                    type="text"
                    placeholder="Buscar por descrição"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    onKeyPress={handleSearchKeyPress}
                    className="h-9 md:h-10 text-sm"
                  />
                </div>

                <Button
                  onClick={handleSearch}
                  disabled={loading}
                  className="w-full h-9 md:h-10 text-sm bg-green-600 hover:bg-green-700"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {loading ? 'Buscando...' : 'Buscar Produtos'}
                </Button>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {(appliedSearchName || appliedSearchCode) && (
        <div className="md:hidden p-4">
          <Button
            onClick={() => {
              setSearchName("")
              setSearchCode("")
              setAppliedSearchName("")
              setAppliedSearchCode("")
              setCurrentPage(1)
              setTimeout(() => {
                loadProducts() // Recarrega todos os produtos sem filtros aplicados
              }, 0)
            }}
            variant="outline"
            className="w-full"
          >
            Limpar Filtros
          </Button>
        </div>
      )}

      {/* Lista de Produtos - Mobile Cards / Desktop Table */}
      <div className="flex-1 overflow-auto p-0 md:p-6 mt-4 md:mt-0">
        {/* Mobile - Cards */}
        <div className="md:hidden px-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
              <p className="text-sm font-medium text-muted-foreground">Carregando produtos...</p>
            </div>
          ) : produtosFiltrados.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {isOffline ? "Nenhum produto encontrado em cache." : "Nenhum produto encontrado"}
            </div>
          ) : (
            produtosFiltrados.map((product) => {
              // Gerar cor baseada na descrição
              const getAvatarColor = (name: string) => {
                const colors = [
                  '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#10B981',
                  '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6',
                  '#A855F7', '#EC4899', '#F43F5E'
                ];
                const hash = name.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
                return colors[hash % colors.length];
              };

              const avatarColor = getAvatarColor(product.DESCRPROD || 'P');
              const initials = (product.DESCRPROD || 'P')
                .split(' ')
                .filter(word => word.length > 0)
                .slice(0, 2)
                .map(word => word[0])
                .join('')
                .toUpperCase();

              return (
                <div
                  key={product._id || product.CODPROD}
                  onClick={() => abrirModal(product)}
                  className="bg-card border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-foreground truncate">
                        {product.DESCRPROD}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {product.CODPROD}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Ativo
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop - Table */}
        <div className="hidden md:block md:rounded-lg md:border md:shadow md:bg-card">
          <div className="overflow-x-auto md:overflow-y-auto md:max-h-[calc(100vh-400px)]">
            <table className="w-full">
              <thead className="sticky top-0 z-10" style={{ backgroundColor: 'rgb(35, 55, 79)' }}>
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white uppercase tracking-tight">
                    Código
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white uppercase tracking-tight">
                    Descrição
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white uppercase tracking-tight hidden lg:table-cell">
                    Marca
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white uppercase tracking-tight hidden xl:table-cell">
                    Unidade
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white uppercase tracking-tight">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                        <p className="text-sm font-medium text-muted-foreground">Carregando produtos...</p>
                      </div>
                    </td>
                  </tr>
                ) : produtosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-muted-foreground">
                      {isOffline ? "Nenhum produto encontrado em cache." : "Nenhum produto encontrado"}
                    </td>
                  </tr>
                ) : (
                  produtosFiltrados.map((product) => (
                    <tr key={product._id || product.CODPROD} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-foreground">{product.CODPROD}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{product.DESCRPROD}</td>
                      <td className="px-6 py-4 text-sm text-foreground hidden lg:table-cell">{product.MARCA || '-'}</td>
                      <td className="px-6 py-4 text-sm text-foreground hidden xl:table-cell">{product.UNIDADE || '-'}</td>
                      <td className="px-6 py-4">
                        <Button
                          size="sm"
                          onClick={() => abrirModal(product)}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium uppercase text-xs flex items-center gap-1 px-3 h-9"
                        >
                          <Package className="w-3 h-3" />
                          <span className="hidden sm:inline">Detalhes</span>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pagination */}
      {!loading && totalRecords > 0 && (
        <div className="flex flex-col items-center justify-center gap-3 bg-card rounded-lg shadow px-6 py-4">
          <div className="text-sm text-muted-foreground">
            Mostrando {startIndex + 1} a {endIndex} de {totalRecords} produtos
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)} // Ajustado para usar handlePageChange
              disabled={currentPage === 1}
              className="flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </Button>
            <div className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)} // Ajustado para usar handlePageChange
              disabled={currentPage === totalPages}
              className="flex items-center gap-1"
            >
              Próxima
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Função auxiliar para lidar com a mudança de página */}
      {/* Essa função foi movida para fora do return e é chamada pelos botões de paginação */}
      {/* A lógica de atualização da tabela é feita no useEffect de currentPage */}

      <Dialog open={estoqueModalOpen} onOpenChange={setEstoqueModalOpen}>
        <DialogContent className="md:max-w-md h-full md:h-auto md:max-h-[90vh] p-0 gap-0 w-full max-w-full md:rounded-lg rounded-none">
          {produtoSelecionado && (
            <>
              {/* Header - Mobile */}
              <div className="md:hidden flex-shrink-0 bg-card border-b">
                <div className="flex items-center justify-between p-3">
                  <button 
                    onClick={() => setEstoqueModalOpen(false)} 
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <h2 className="text-sm font-semibold text-foreground">
                    Detalhes do Produto
                  </h2>
                  <div className="w-6" />
                </div>
                
                {/* Avatar e Dados Principais - Mobile */}
                <div className="flex flex-col py-4 px-4 border-b">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                      style={{ 
                        backgroundColor: getAvatarColor(produtoSelecionado.DESCRPROD || 'P')
                      }}
                    >
                      {(produtoSelecionado.DESCRPROD || 'P')
                        .split(' ')
                        .filter(word => word.length > 0)
                        .slice(0, 2)
                        .map(word => word[0])
                        .join('')
                        .toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {produtoSelecionado.DESCRPROD}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Código: {produtoSelecionado.CODPROD}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-medium text-muted-foreground">
                        Marca
                      </Label>
                      <p className="text-xs font-semibold">{produtoSelecionado.MARCA || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-medium text-muted-foreground">
                        Unidade
                      </Label>
                      <p className="text-xs font-semibold">{produtoSelecionado.UNIDADE || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Header - Desktop */}
              <div className="hidden md:block flex-shrink-0">
                <DialogHeader className="p-6 pb-4">
                  <DialogTitle>Detalhes do Produto</DialogTitle>
                </DialogHeader>
                
                {/* Avatar e Dados Principais - Desktop */}
                <div className="flex items-center gap-6 px-6 pb-6 border-b bg-muted/30">
                  <div
                    className="w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-2xl flex-shrink-0"
                    style={{ 
                      backgroundColor: getAvatarColor(produtoSelecionado.DESCRPROD || 'P')
                    }}
                  >
                    {(produtoSelecionado.DESCRPROD || 'P')
                      .split(' ')
                      .filter(word => word.length > 0)
                      .slice(0, 2)
                      .map(word => word[0])
                      .join('')
                      .toUpperCase()}
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Código
                      </Label>
                      <p className="text-sm font-semibold">{produtoSelecionado.CODPROD}</p>
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Descrição
                      </Label>
                      <p className="text-sm font-semibold">{produtoSelecionado.DESCRPROD}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Conteúdo */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                {/* Informações adicionais - Desktop */}
                <div className="hidden md:grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Marca</p>
                    <p className="font-medium">{produtoSelecionado.MARCA || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Unidade</p>
                    <p className="font-medium">{produtoSelecionado.UNIDADE || '-'}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tabela-preco" className="text-xs md:text-sm font-medium text-muted-foreground">
                    Tabela de Preço
                  </Label>
                  <Select
                    value={tabelaSelecionada}
                    onValueChange={(value) => {
                      console.log(`📋 Tabela selecionada: ${value}`)
                      setTabelaSelecionada(value)
                      if (produtoSelecionado && produtoSelecionado.CODPROD) {
                        buscarPrecoProduto(produtoSelecionado.CODPROD, value)
                      }
                    }}
                  >
                    <SelectTrigger className="w-full h-9 md:h-10 text-xs md:text-sm">
                      <SelectValue placeholder="Selecione uma tabela">
                        {tabelaSelecionada === '0' ? 'Padrão (NUTAB 0)' :
                          tabelasPrecos.find(t => String(t.NUTAB) === tabelaSelecionada) ?
                            `${tabelasPrecos.find(t => String(t.NUTAB) === tabelaSelecionada)?.CODTAB} - NUTAB ${tabelaSelecionada}${tabelasPrecos.find(t => String(t.NUTAB) === tabelaSelecionada)?.DESCRICAO ? ` - ${tabelasPrecos.find(t => String(t.NUTAB) === tabelaSelecionada)?.DESCRICAO}` : ''}` :
                            'Selecione uma tabela'
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Padrão (NUTAB 0)</SelectItem>
                      {tabelasPrecos.map((tabela) => (
                        <SelectItem key={tabela.NUTAB} value={String(tabela.NUTAB)}>
                          {tabela.CODTAB} - NUTAB {tabela.NUTAB}{tabela.DESCRICAO ? ` - ${tabela.DESCRICAO}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-xs md:text-sm text-muted-foreground mb-1">Preço Unitário</p>
                  {loadingPreco ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs md:text-sm">Carregando preço...</span>
                    </div>
                  ) : (
                    <p className="font-bold text-xl md:text-2xl text-green-700 dark:text-green-400">
                      {formatCurrency(precoProduto)}
                    </p>
                  )}
                </div>
              </div>

              {/* Footer - Fixo */}
              <div className="flex-shrink-0 p-3 md:p-6 border-t bg-card">
                <Button 
                  onClick={() => setEstoqueModalOpen(false)} 
                  className="w-full bg-green-600 hover:bg-green-700 h-9 md:h-10 text-sm"
                >
                  Fechar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}