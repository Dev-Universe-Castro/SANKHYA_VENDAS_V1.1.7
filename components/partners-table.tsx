"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Pencil, ChevronLeft, ChevronRight, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PartnerModal } from "@/components/partner-modal"
import { useToast } from "@/hooks/use-toast"
import { authService } from "@/lib/auth-service"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { OfflineDataService } from '@/lib/offline-data-service' // Importação adicionada

interface Partner {
  _id: string
  CODPARC: string
  NOMEPARC: string
  CGC_CPF: string
  CODCID?: string
  ATIVO?: string
  TIPPESSOA?: string
  CODVEND?: number
  CLIENTE?: string
}

interface PaginatedResponse {
  parceiros: Partner[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const ITEMS_PER_PAGE = 50

export default function PartnersTable() {
  const [searchName, setSearchName] = useState("")
  const [searchCode, setSearchCode] = useState("")
  const [appliedSearchName, setAppliedSearchName] = useState("")
  const [appliedSearchCode, setAppliedSearchCode] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [partners, setPartners] = useState<Partner[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const { toast } = useToast()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [vendedoresMap, setVendedoresMap] = useState<Record<number, string>>({})
  const [searchTerm, setSearchTerm] = useState("") // Estado para o termo de busca geral
  const [showPartnerDropdown, setShowPartnerDropdown] = useState(false)
  const [filteredPartners, setFilteredPartners] = useState<Partner[]>([])
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const loadingRef = useRef(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine); // Estado para modo offline

  // Efeitos para monitorar o estado online/offline
  useEffect(() => {
    const handleOnline = () => {
      console.log('✅ Conexão restabelecida!');
      setIsOffline(false);
      // Tentar sincronizar dados se necessário
      syncDataOnReconnect(); // Chama a função de sincronização ao reconectar
    };
    const handleOffline = () => {
      console.log('⚠️ Modo offline detectado!');
      setIsOffline(true);
      toast({
        title: "Modo Offline",
        description: "Você está sem conexão. Os dados exibidos são do cache.",
        variant: "default",
        duration: 7000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]); // Adicionado toast como dependência

  useEffect(() => {
    loadPartners();
  }, [currentPage, appliedSearchName, appliedSearchCode, isOffline]); // Adicionado isOffline

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }
    loadVendedores();
  }, []);

  // Função para sincronizar dados ao reconectar
  const syncDataOnReconnect = async () => {
    if (isOffline) return;

    console.log('🌐 Tentando sincronizar dados após reconexão...');
    try {
      const prefetchResponse = await fetch('/api/prefetch', { method: 'POST' });
      if (prefetchResponse.ok) {
        const prefetchData = await prefetchResponse.json();
        await OfflineDataService.sincronizarTudo(prefetchData);
        toast({
          title: "Sincronização Concluída",
          description: "Seus dados foram atualizados com o servidor.",
          variant: "default",
          duration: 3000,
        });
        await loadPartners();
      }
    } catch (error) {
      console.error('Erro durante a sincronização após reconexão:', error);
      toast({
        title: "Erro na Sincronização",
        description: "Houve um problema ao atualizar seus dados.",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const loadVendedores = async () => {
    try {
      const response = await fetch('/api/vendedores?tipo=todos');
      const vendedores = await response.json();
      const map: Record<number, string> = {};
      vendedores.forEach((v: any) => {
        map[v.CODVEND] = v.APELIDO;
      });
      setVendedoresMap(map);
    } catch (error) {
      console.error('Erro ao carregar vendedores:', error);
    }
  };

  const handleSearch = () => {
    setAppliedSearchName(searchName);
    setAppliedSearchCode(searchCode);
    setCurrentPage(1);
    loadPartners(); // Chama loadPartners para aplicar os filtros
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalRecords);

  const loadPartners = async () => {
    if (loadingRef.current) {
      console.log('⏭️ Requisição de loadPartners já em andamento.');
      return;
    }
    loadingRef.current = true;

    try {
      setIsLoading(true);

      // SEMPRE carregar do IndexedDB (independente de estar online ou offline)
      console.log('📦 Carregando parceiros do IndexedDB...');
      let allParceiros: Partner[] = await OfflineDataService.getParceiros();

      if (allParceiros.length === 0) {
        console.log('⚠️ IndexedDB vazio - aguardando sincronização via prefetch');
        toast({
          title: "Sem Dados em Cache",
          description: "Aguarde a sincronização inicial ou use o botão de atualização.",
          variant: "default",
        });
      } else {
        console.log(`✅ ${allParceiros.length} parceiros carregados do IndexedDB`);
      }

      // Aplicar filtros se existirem
      let filteredParceiros = allParceiros;
      const hasFilters = (appliedSearchName && appliedSearchName.trim() !== '') ||
                         (appliedSearchCode && appliedSearchCode.trim() !== '');

      if (hasFilters) {
        filteredParceiros = allParceiros.filter(p => {
          const matchName = !appliedSearchName || !appliedSearchName.trim() ||
                           p.NOMEPARC?.toLowerCase().includes(appliedSearchName.toLowerCase());
          const matchCode = !appliedSearchCode || !appliedSearchCode.trim() ||
                           p.CODPARC?.toString().includes(appliedSearchCode);
          return matchName && matchCode;
        });
        console.log(`🔍 Filtros aplicados: ${filteredParceiros.length} de ${allParceiros.length} parceiros`);
      } else {
        console.log(`📋 Exibindo todos os ${allParceiros.length} parceiros (sem filtros aplicados)`);
      }

      // Calcular índices de paginação
      const total = filteredParceiros.length;
      const totalPgs = Math.ceil(total / ITEMS_PER_PAGE) || 1;
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      const end = Math.min(start + ITEMS_PER_PAGE, total);

      // Paginar os resultados
      const paginatedParceiros = filteredParceiros.slice(start, end);

      setPartners(paginatedParceiros);
      setTotalPages(totalPgs);
      setTotalRecords(total);
      console.log(`✅ Exibindo página ${currentPage}/${totalPgs} - ${paginatedParceiros.length} parceiros (${start + 1}-${end} de ${total})`);

    } catch (error: any) {
      console.error("Erro ao carregar parceiros:", error);
      toast({
        title: "Erro ao Carregar Clientes",
        description: error.message || "Não foi possível carregar a lista de clientes.",
        variant: "destructive",
      });
      setPartners([]);
      setTotalPages(1);
      setTotalRecords(0);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  };

  const handleSave = async (partnerData: any) => {
    try {
      // Remover campos vazios/undefined
      const cleanData = Object.fromEntries(
        Object.entries(partnerData).filter(([_, v]) => v !== '' && v !== undefined && v !== null)
      );

      console.log("Frontend - Enviando dados do parceiro:", cleanData);

      if (currentUser?.role === 'Vendedor' && !cleanData.CODVEND) {
        cleanData.CODVEND = currentUser.codVendedor;
      }

      const response = await fetch('/api/sankhya/parceiros/salvar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cleanData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Frontend - Erro na resposta da API:", errorData);
        throw new Error(errorData.error || 'Falha ao salvar parceiro');
      }

      const resultado = await response.json();

      console.log("Frontend - Parceiro salvo com sucesso:", resultado);

      toast({
        title: "Sucesso",
        description: resultado.message || (partnerData.CODPARC
          ? "Parceiro atualizado com sucesso. Aguarde a sincronização para visualizar as alterações."
          : "Parceiro cadastrado com sucesso. Aguarde a sincronização para visualizar no sistema."),
        duration: 5000,
      });

      // Após salvar, forçar uma nova sincronização do prefetch
      if (navigator.onLine) {
        try {
          const prefetchResponse = await fetch('/api/prefetch', { method: 'POST' });
          if (prefetchResponse.ok) {
            const prefetchData = await prefetchResponse.json();
            await OfflineDataService.sincronizarTudo(prefetchData);
            console.log('✅ Dados sincronizados após salvar parceiro');
          }
        } catch (error) {
          console.error('⚠️ Erro ao sincronizar após salvar:', error);
        }
      }
      
      await loadPartners(); // Recarrega os dados do IndexedDB
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Frontend - Erro ao salvar parceiro:", {
        message: error.message,
        dados: partnerData
      });

      toast({
        title: "Erro",
        description: error.message || "Falha ao salvar parceiro",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (codParceiro: string) => {
    if (!confirm("Tem certeza que deseja inativar este parceiro?")) {
      return;
    }

    try {
      const response = await fetch('/api/sankhya/parceiros/deletar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codParceiro })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao inativar parceiro');
      }

      toast({
        title: "Sucesso",
        description: "Parceiro inativado com sucesso.",
      });

      // Após deletar, forçar uma nova sincronização do prefetch
      if (navigator.onLine) {
        try {
          const prefetchResponse = await fetch('/api/prefetch', { method: 'POST' });
          if (prefetchResponse.ok) {
            const prefetchData = await prefetchResponse.json();
            await OfflineDataService.sincronizarTudo(prefetchData);
            console.log('✅ Dados sincronizados após deletar parceiro');
          }
        } catch (error) {
          console.error('⚠️ Erro ao sincronizar após deletar:', error);
        }
      }
      
      await loadPartners(); // Recarrega os dados do IndexedDB
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao inativar parceiro",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (partner: any) => {
    setSelectedPartner(partner);
    requestAnimationFrame(() => {
      setIsModalOpen(true);
    });
  };

  const handleCreate = () => {
    setSelectedPartner(null);
    setIsModalOpen(true);
  };

  const handlePartnerSearch = (value: string) => {
    setSearchName(value);
    setShowPartnerDropdown(true);

    // Só filtrar se tiver 2+ caracteres
    if (value.length < 2) {
      setFilteredPartners([]);
      setShowPartnerDropdown(false);
      return;
    }

    // Usa os parceiros já carregados (sejam online ou offline) para filtrar
    const allParceiros = partners; // Assumindo que 'partners' já contém os dados mais recentes carregados
    const searchLower = value.toLowerCase();
    const filtered = allParceiros.filter((p: any) =>
      p.NOMEPARC?.toLowerCase().includes(searchLower) ||
      p.CGC_CPF?.includes(value) ||
      p.RAZAOSOCIAL?.toLowerCase().includes(searchLower) ||
      p.CODPARC?.toString().includes(value)
    );
    setFilteredPartners(filtered);
    console.log('✅ Parceiros filtrados (PartnersTable):', filtered.length);
  };

  const handlePartnerSelect = (partner: Partner) => {
    setSearchName(partner.NOMEPARC);
    setShowPartnerDropdown(false);
    // Opcional: Aplicar o filtro imediatamente ao selecionar
    setAppliedSearchName(partner.NOMEPARC);
    setAppliedSearchCode(''); // Limpar outros filtros se desejar
    // Atualiza a lista exibida com o parceiro selecionado e recarrega para garantir a paginação correta
    setPartners([partner]);
    setTotalRecords(1);
    setTotalPages(1);
    setCurrentPage(1);
    // Se quiser que a busca aplique o filtro:
    // handleSearch();
  };

  const handleViewDetails = (partner: Partner) => {
    setSelectedPartner(partner);
    setIsModalOpen(true);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header - Desktop */}
      <div className="hidden md:block border-b p-6">
        <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
        <p className="text-muted-foreground">
          Consulta e gerenciamento de clientes
        </p>
      </div>

      {/* Header - Mobile */}
      <div className="md:hidden border-b px-3 py-3">
        <h1 className="text-lg font-bold">Clientes</h1>
        <p className="text-xs text-muted-foreground">
          Consulta e gerenciamento de clientes
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
                  Código do Parceiro
                </Label>
                <Input
                  id="searchCode"
                  type="text"
                  placeholder="Digite o código"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  onKeyPress={handleSearchKeyPress}
                  className="h-9 md:h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="searchName" className="text-xs md:text-sm font-medium">
                  Nome do Parceiro
                </Label>
                <Input
                  id="searchName"
                  type="text"
                  placeholder="Digite o nome"
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
                  disabled={isLoading}
                  className="w-full h-9 md:h-10 text-sm bg-green-600 hover:bg-green-700"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {isLoading ? 'Buscando...' : 'Buscar Clientes'}
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
                    Código do Parceiro
                  </Label>
                  <Input
                    id="searchCodeMobile"
                    type="text"
                    placeholder="Digite o código"
                    value={searchCode}
                    onChange={(e) => setSearchCode(e.target.value)}
                    onKeyPress={handleSearchKeyPress}
                    className="h-9 md:h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="searchNameMobile" className="text-xs md:text-sm font-medium">
                    Nome do Parceiro
                  </Label>
                  <Input
                    id="searchNameMobile"
                    type="text"
                    placeholder="Digite o nome"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    onKeyPress={handleSearchKeyPress}
                    className="h-9 md:h-10 text-sm"
                  />
                </div>

                <Button
                  onClick={handleSearch}
                  disabled={isLoading}
                  className="w-full h-9 md:h-10 text-sm bg-green-600 hover:bg-green-700"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {isLoading ? 'Buscando...' : 'Buscar Clientes'}
                </Button>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Lista de Clientes - Mobile Cards / Desktop Table */}
      <div className="flex-1 overflow-auto p-0 md:p-6 mt-4 md:mt-0">
        {/* Mobile - Cards */}
        <div className="md:hidden px-4 space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
              <p className="text-sm font-medium text-muted-foreground">Carregando clientes...</p>
            </div>
          ) : partners.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado. Use os filtros acima para buscar.
            </div>
          ) : (
            partners.map((partner) => {
              // Gerar cor baseada no nome
              const getAvatarColor = (name: string) => {
                const colors = [
                  '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#10B981',
                  '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6',
                  '#A855F7', '#EC4899', '#F43F5E'
                ];
                const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                return colors[hash % colors.length];
              };

              // Obter iniciais do nome
              const getInitials = (name: string) => {
                const words = name.trim().split(' ').filter(word => word.length > 0);
                if (words.length === 0) return '??';
                if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
                return (words[0][0] + words[words.length - 1][0]).toUpperCase();
              };

              const avatarColor = getAvatarColor(partner.NOMEPARC);
              const initials = getInitials(partner.NOMEPARC);

              return (
                <div
                  key={partner.CODPARC}
                  onClick={() => handleViewDetails(partner)}
                  className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer"
                >
                  {/* Avatar com iniciais */}
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {initials}
                  </div>

                  {/* Informações */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{partner.NOMEPARC}</h3>
                    <p className="text-sm text-gray-500 truncate">{partner.CGC_CPF || 'Sem CPF/CNPJ'}</p>
                  </div>

                  {/* Status Badge */}
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Ativo
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop - Table */}
        <div className="hidden md:block rounded-lg border shadow bg-card">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-400px)]">
            <table className="w-full">
              <thead className="sticky top-0 z-10" style={{ backgroundColor: 'rgb(35, 55, 79)' }}>
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white uppercase tracking-tight">
                    Código
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white uppercase tracking-tight">
                    Nome
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white uppercase tracking-tight hidden lg:table-cell">
                    CPF/CNPJ
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white uppercase tracking-tight">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                        <p className="text-sm font-medium text-muted-foreground">Carregando clientes...</p>
                      </div>
                    </td>
                  </tr>
                ) : partners.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-muted-foreground">
                      Nenhum cliente encontrado. Use os filtros acima para buscar.
                    </td>
                  </tr>
                ) : (
                  partners.map((partner) => (
                    <tr key={partner.CODPARC} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-foreground">{partner.CODPARC}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{partner.NOMEPARC}</td>
                      <td className="px-6 py-4 text-sm text-foreground hidden lg:table-cell">{partner.CGC_CPF || '-'}</td>
                      <td className="px-6 py-4">
                        <Button
                          size="sm"
                          onClick={() => handleViewDetails(partner)}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium uppercase text-xs flex items-center gap-1 px-3 h-9"
                        >
                          Ver Detalhes
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

      {/* Pagination - Moved outside the CardContent to be always visible */}
      {!isLoading && partners.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t bg-card">
          <div className="text-sm text-muted-foreground">
            Mostrando {startIndex + 1} a {endIndex} de {totalRecords} clientes
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
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
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1"
            >
              Próxima
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <PartnerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        partner={selectedPartner}
        onSave={handleSave}
        currentUser={currentUser}
      />
    </div>
  );
}