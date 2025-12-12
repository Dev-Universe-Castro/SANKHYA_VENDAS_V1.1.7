import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { cookies } from 'next/headers';
import { getCacheService } from '@/lib/redis-cache-cache-wrapper'; // Corrected import path
import { contratosService } from '@/lib/contratos-service';

// Função helper para fetch com timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    console.error(`⚠️ Timeout/erro ao buscar ${url}:`, error);
    throw error;
  }
}

// Função para buscar dados do sistema com filtro de data
async function analisarDadosDoSistema(userId: number, userName: string, isAdmin: boolean = false, idEmpresa: number, filtroFrontend?: { dataInicio: string, dataFim: string }) {
  try {
    // Usar filtro do frontend se disponível, senão usar padrão: últimos 90 dias
    let filtro;
    if (filtroFrontend && filtroFrontend.dataInicio && filtroFrontend.dataFim) {
      filtro = filtroFrontend;
    } else {
      const dataFim = new Date();
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - 90);
      filtro = {
        dataInicio: dataInicio.toISOString().split('T')[0],
        dataFim: dataFim.toISOString().split('T')[0]
      };
    }

    console.log('📅 Filtro de análise:', filtro);

    // Log detalhado do usuário
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 INFORMAÇÕES DO USUÁRIO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Nome: ${userName}`); // Substituído currentUser.name por userName
    console.log(`   User ID: ${userId}`);
    console.log(`   Empresa ID: ${idEmpresa}`);
    console.log(`   É Administrador: ${isAdmin ? 'SIM' : 'NÃO'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');


    // Importar serviço de análise dinamicamente
    const { buscarDadosAnalise } = await import('@/lib/analise-service');

    // Buscar TODOS os dados direto do Oracle
    const dadosCompletos = await buscarDadosAnalise(filtro, userId, isAdmin, idEmpresa);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 DADOS CARREGADOS DA EMPRESA:', idEmpresa);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Leads: ${dadosCompletos.leads.length}`);
    console.log(`   Atividades: ${dadosCompletos.atividades.length}`);
    console.log(`   Pedidos: ${dadosCompletos.pedidos.length}`);
    console.log(`   Clientes: ${dadosCompletos.clientes.length}`);
    console.log(`   Financeiro: ${dadosCompletos.financeiro.length}`);
    console.log(`   Funis: ${dadosCompletos.funis.length}`);
    console.log(`   Estágios: ${dadosCompletos.estagiosFunis.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');


    // Calcular métricas
    const valorTotalPedidos = dadosCompletos.pedidos.reduce((sum, p) => sum + (parseFloat(p.VLRNOTA) || 0), 0);
    const valorTotalFinanceiro = dadosCompletos.financeiro.reduce((sum, f) => sum + (parseFloat(f.VLRDESDOB) || 0), 0);
    const valorRecebido = dadosCompletos.financeiro.reduce((sum, f) => sum + (parseFloat(f.VLRBAIXA) || 0), 0);

    // Calcular maiores clientes
    const pedidosPorCliente = dadosCompletos.pedidos.reduce((acc: any, p: any) => {
      const nomeCliente = p.NOMEPARC || p.Parceiro_NOMEPARC || 'Cliente Desconhecido';
      const codParc = p.CODPARC || 'SEM_CODIGO';
      const key = `${codParc}|${nomeCliente}`;

      if (!acc[key]) {
        acc[key] = {
          codigo: codParc,
          nome: nomeCliente,
          total: 0,
          qtdPedidos: 0,
          pedidos: []
        };
      }
      const valor = parseFloat(p.VLRNOTA) || 0;
      acc[key].total += valor;
      acc[key].qtdPedidos += 1;
      acc[key].pedidos.push({
        nunota: p.NUNOTA,
        valor: valor,
        data: p.DTNEG
      });
      return acc;
    }, {});

    const maioresClientes = Object.values(pedidosPorCliente)
      .sort((a: any, b: any) => b.total - a.total)
      .map((c: any) => ({
        codigo: c.codparc,
        nome: c.nome,
        totalPedidos: c.qtdPedidos,
        valorTotal: c.total,
        ticketMedio: c.total / c.qtdPedidos,
        pedidos: c.pedidos
      }));

    return {
      leads: dadosCompletos.leads,
      atividades: dadosCompletos.atividades,
      pedidos: dadosCompletos.pedidos,
      clientes: dadosCompletos.clientes,
      financeiro: dadosCompletos.financeiro,
      funis: dadosCompletos.funis,
      estagiosFunis: dadosCompletos.estagiosFunis,
      userName,
      filtro,
      // Métricas calculadas
      totalLeads: dadosCompletos.leads.length,
      totalAtividades: dadosCompletos.atividades.length,
      totalPedidos: dadosCompletos.pedidos.length,
      totalClientes: dadosCompletos.clientes.length,
      totalFinanceiro: dadosCompletos.financeiro.length,
      valorTotalPedidos,
      valorTotalFinanceiro,
      valorRecebido,
      valorPendente: valorTotalFinanceiro - valorRecebido,
      maioresClientes
    };
  } catch (error) {
    console.error('❌ Erro ao analisar dados do sistema:', error);
    return {
      leads: [],
      atividades: [],
      pedidos: [],
      clientes: [],
      financeiro: [],
      funis: [],
      estagiosFunis: [],
      userName,
      filtro: { dataInicio: '', dataFim: '' },
      totalLeads: 0,
      totalAtividades: 0,
      totalPedidos: 0,
      totalClientes: 0,
      totalFinanceiro: 0,
      valorTotalPedidos: 0,
      valorTotalFinanceiro: 0,
      valorRecebido: 0,
      valorPendente: 0,
      maioresClientes: []
    };
  }
}

const SYSTEM_PROMPT = `Você é um Assistente de Vendas especializado em CRM.

🎯 REGRAS CRÍTICAS:

1. **SEMPRE COMPLETE suas respostas** - NUNCA pare no meio de uma frase ou lista
2. Use APENAS dados fornecidos no contexto YAML - NUNCA invente informações
3. Quando listar itens, mostre TODOS ou indique claramente quantos foram omitidos
4. Cite nomes REAIS de funis, estágios, leads e clientes do contexto
5. Finalize SEMPRE com uma recomendação ou próximo passo

📊 DADOS DISPONÍVEIS:

Você tem acesso completo a:
- Estrutura de Funis e Estágios (hierarquia e ordem)
- Todos os Leads (nome, valor, funil, estágio atual, parceiro vinculado)
- Produtos vinculados a cada Lead
- Histórico de Atividades (ligações, reuniões, emails, status)
- Pedidos FDV e Faturados (valores, datas, clientes)
- Base completa de Clientes/Parceiros

💡 INSTRUÇÕES:

✅ FAÇA:
- Complete todas as análises até o final
- Liste todos os itens relevantes ou indique "... e mais X itens"
- Termine com ação prática ou insight
- Use formatação clara (listas numeradas, bullet points)

❌ NÃO FAÇA:
- Parar no meio de uma lista
- Inventar dados que não estão no contexto
- Dar respostas vagas sem dados concretos
- Usar termos técnicos de banco de dados

EXEMPLO DE RESPOSTA COMPLETA:

P: "Quais leads priorizar?"
R: "Baseado nos dados, sugiro priorizar estes 3 leads:

1. **Lead ABC Empresa** - R$ 85.000
   - Estágio: Proposta Enviada
   - Última atividade: Há 2 dias
   - Status: Aguardando retorno
   
2. **Lead XYZ Comércio** - R$ 50.000
   - Estágio: Negociação
   - Última atividade: Há 5 dias ⚠️
   - Ação: Fazer follow-up urgente

3. **Lead DEF Indústria** - R$ 120.000
   - Estágio: Análise Técnica
   - Última atividade: Ontem
   - Status: Em andamento

**Próximos passos:**
- Priorize follow-up com XYZ (sem atividade há 5 dias)
- Agende reunião de fechamento com ABC
- Continue acompanhamento técnico com DEF"

LEMBRE-SE: Sempre finalize completamente sua resposta.`;



// Cache de dados por sessão
const sessionDataCache = new Map<string, { data: any; filtro: string }>();

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const userCookie = cookieStore.get('user');

    if (!userCookie) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const user = JSON.parse(userCookie.value);
    const idEmpresa = user.ID_EMPRESA || user.id_empresa || 0;

    if (!idEmpresa) {
      return new Response(JSON.stringify({ error: 'Empresa não identificada' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Buscar chave API do Gemini da empresa (configuração por empresa)
    const contrato = await contratosService.getContratoByEmpresa(idEmpresa);

    if (!contrato || !contrato.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ 
        error: 'Chave API do Gemini não configurada para esta empresa. Entre em contato com o administrador.' 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 IA ASSISTENTE - INICIALIZAÇÃO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Empresa: ${contrato.EMPRESA} (ID: ${idEmpresa})`);
    console.log(`👤 Usuário: ${user.name} (ID: ${user.id})`);
    
    let genAI;
    try {
      genAI = new GoogleGenerativeAI(contrato.GEMINI_API_KEY);
      console.log('✅ GoogleGenerativeAI inicializado');
    } catch (error: any) {
      console.error('❌ Erro ao inicializar GoogleGenerativeAI:', error);
      return new Response(JSON.stringify({ 
        error: 'Erro ao configurar a API do Gemini. Verifique a chave API.' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validar acesso à IA
    const { accessControlService } = await import('@/lib/access-control-service');

    let userAccess;

    try {
      userAccess = await accessControlService.validateUserAccess(user.id, idEmpresa);
      console.log('✅ Acesso validado:', {
        role: userAccess.role,
        isAdmin: userAccess.isAdmin,
        codVendedor: userAccess.codVendedor
      });

      // Verifica se o usuário tem permissão para usar funcionalidades restritas
      if (!accessControlService.canAccessRestrictedFeatures(userAccess)) {
        return new Response(JSON.stringify({
          error: accessControlService.getRestrictedFeatureMessage('IA Chat')
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (accessError: any) {
      console.error('❌ Erro de controle de acesso:', accessError);
      return new Response(JSON.stringify({ error: accessError.message }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { message, history, filtro, sessionId } = await request.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'Mensagem é obrigatória' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const isAdmin = userAccess.isAdmin; // Use the validated userAccess

    const { searchParams } = new URL(request.url);
    const pergunta = searchParams.get('pergunta') || '';

    let model;
    try {
      model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 8192,     // Aumentado para garantir respostas completas
          topP: 0.95,
          topK: 40,
        }
      });
      console.log('✅ Modelo configurado: gemini-1.5-flash');
    } catch (error: any) {
      console.error('❌ Erro ao configurar modelo:', error);
      return new Response(JSON.stringify({ 
        error: 'Erro ao configurar modelo de IA' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Montar histórico com prompt de sistema
    const chatHistory = [
      {
        role: 'user',
        parts: [{ text: SYSTEM_PROMPT }],
      },
      {
        role: 'model',
        parts: [{ text: 'Entendido! Estou pronto para analisar seus dados.' }],
      },
      ...history.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }))
    ];

    // Verificar se precisa carregar dados
    let messageWithContext = message;
    const filtroKey = JSON.stringify(filtro);
    const cacheKey = `${sessionId}-${idEmpresa}`;
    const cached = sessionDataCache.get(cacheKey);

    const needsReload = !cached || cached.filtro !== filtroKey;

    if (history.length === 0 || needsReload) {
      console.log(needsReload ? '🔄 Filtro alterado - Recarregando dados...' : '🔍 Primeiro prompt - Carregando dados...');

      const dadosSistema = await analisarDadosDoSistema(user.id, user.name, isAdmin, idEmpresa, filtro);

      // Mapear relação Funil → Estágios
      const funisComEstagios = (dadosSistema.funis || []).map((funil: any) => {
        const estagiosDoFunil = (dadosSistema.estagiosFunis || [])
          .filter((e: any) => e.CODFUNIL === funil.CODFUNIL)
          .sort((a: any, b: any) => (a.ORDEM || 0) - (b.ORDEM || 0));
        
        return {
          ...funil,
          estagios: estagiosDoFunil
        };
      });

      // Converter para CSV compacto e estruturado
      const csvContext = `📊 DADOS CRM - ${user.name} | Período: ${dadosSistema.filtro.dataInicio} a ${dadosSistema.filtro.dataFim}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 FUNIS E ESTÁGIOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CodFunil,NomeFunil,CodEstagio,NomeEstagio,Ordem
${funisComEstagios.flatMap((f: any) => 
  f.estagios.map((e: any) => `${f.CODFUNIL},${f.NOME},${e.CODESTAGIO},${e.NOME},${e.ORDEM}`)
).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💼 LEADS (${dadosSistema.totalLeads || 0} cadastrados)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CodLead,Nome,Valor,Status,NomeFunil,NomeEstagio,Cliente
${(dadosSistema.leads || []).map((l: any) => {
  const funil = funisComEstagios.find((f: any) => f.CODFUNIL === l.CODFUNIL);
  const estagio = funil?.estagios.find((e: any) => e.CODESTAGIO === l.CODESTAGIO);
  return `${l.CODLEAD},"${l.NOME}",${(l.VALOR || 0).toFixed(2)},${l.STATUS_LEAD || 'EM_ANDAMENTO'},"${funil?.NOME || 'N/D'}","${estagio?.NOME || 'N/D'}","${l.PARCEIRO_NOME || 'Sem Cliente'}"`;
}).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 PRODUTOS DOS LEADS (${(dadosSistema.produtosLeads || []).length} itens)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${(dadosSistema.produtosLeads || []).length > 0 ? 
`CodLead,NomeLead,Produto,Quantidade,ValorTotal
${(dadosSistema.produtosLeads || []).map((pl: any) => {
  const lead = dadosSistema.leads.find((l: any) => l.CODLEAD === pl.CODLEAD);
  return `${pl.CODLEAD},"${lead?.NOME || 'N/D'}","${pl.DESCRPROD}",${pl.QUANTIDADE},${(pl.VLRTOTAL || 0).toFixed(2)}`;
}).join('\n')}` : 'Nenhum produto vinculado'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 ATIVIDADES (${dadosSistema.totalAtividades || 0} registradas)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${(dadosSistema.atividades || []).length > 0 ?
`Tipo,Titulo,Status,NomeLead,DataInicio
${(dadosSistema.atividades || []).map((a: any) => {
  const lead = dadosSistema.leads.find((l: any) => l.CODLEAD === a.CODLEAD);
  return `${a.TIPO},"${a.TITULO}",${a.STATUS || 'PENDENTE'},"${lead?.NOME || 'N/D'}",${a.DATA_INICIO}`;
}).join('\n')}` : 'Nenhuma atividade registrada'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛒 PEDIDOS FDV (${(dadosSistema.pedidos || []).filter((p: any) => p.ORIGEM === 'FDV').length} pedidos)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${(dadosSistema.pedidos || []).filter((p: any) => p.ORIGEM === 'FDV').length > 0 ?
`ID,Status,Vendedor,DataCriacao
${(dadosSistema.pedidos || []).filter((p: any) => p.ORIGEM === 'FDV').map((p: any) => 
  `${p.ID},${p.STATUS || 'PENDENTE'},"${p.NOME_USUARIO || 'N/D'}",${p.DATA_CRIACAO}`
).join('\n')}` : 'Nenhum pedido FDV'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 PEDIDOS FATURADOS (${(dadosSistema.pedidos || []).filter((p: any) => p.ORIGEM !== 'FDV').length} pedidos)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${(dadosSistema.pedidos || []).filter((p: any) => p.ORIGEM !== 'FDV').length > 0 ?
`Cliente,Valor,Data,Vendedor
${(dadosSistema.pedidos || []).filter((p: any) => p.ORIGEM !== 'FDV').slice(0, 50).map((p: any) => 
  `"${p.NOMEPARC || 'N/D'}",${(parseFloat(p.VLRNOTA) || 0).toFixed(2)},${p.DTNEG},"${p.VENDEDOR_NOME || 'N/D'}"`
).join('\n')}
${(dadosSistema.pedidos || []).filter((p: any) => p.ORIGEM !== 'FDV').length > 50 ? `... e mais ${(dadosSistema.pedidos || []).filter((p: any) => p.ORIGEM !== 'FDV').length - 50} pedidos` : ''}` : 'Nenhum pedido faturado'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 CLIENTES (${dadosSistema.totalClientes || 0} cadastrados)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CodParc,NomeParc,CGCCPF
${(dadosSistema.clientes || []).slice(0, 30).map((c: any) => 
  `${c.CODPARC},"${c.NOMEPARC}","${c.CGC_CPF || ''}"`
).join('\n')}
${dadosSistema.totalClientes > 30 ? `... e mais ${dadosSistema.totalClientes - 30} clientes` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 RESUMO EXECUTIVO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Leads: ${dadosSistema.totalLeads || 0}
Total Atividades: ${dadosSistema.totalAtividades || 0}
Total Pedidos: ${dadosSistema.totalPedidos || 0}
Valor Total Pedidos: R$ ${(dadosSistema.valorTotalPedidos || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
Contas a Receber: R$ ${(dadosSistema.valorPendente || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
Já Recebido: R$ ${(dadosSistema.valorRecebido || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
Total Clientes: ${dadosSistema.totalClientes || 0}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

      sessionDataCache.set(cacheKey, { data: csvContext, filtro: filtroKey });

      messageWithContext = `${csvContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 INSTRUÇÕES IMPORTANTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Os dados CSV acima são TODOS os dados reais do sistema.

REGRAS OBRIGATÓRIAS:
✅ Use APENAS dados fornecidos - NUNCA invente
✅ SEMPRE complete frases e listas
✅ Finalize com recomendação prática
✅ Os funis e estágios estão mapeados na primeira tabela CSV
✅ Cada lead tem funil e estágio associados

FORMATO DOS DADOS:
• Funis/Estágios: CodFunil,NomeFunil,CodEstagio,NomeEstagio,Ordem
• Leads: CodLead,Nome,Valor,Status,NomeFunil,NomeEstagio,Cliente
• Produtos: CodLead,NomeLead,Produto,Quantidade,ValorTotal
• Atividades: Tipo,Titulo,Status,NomeLead,DataInicio
• Pedidos: Cliente,Valor,Data,Vendedor

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❓ PERGUNTA DO USUÁRIO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${message}`;

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ CONTEXTO CSV GERADO');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`   Tamanho: ${messageWithContext.length} chars (~${Math.ceil(messageWithContext.length / 4)} tokens)`);
      console.log(`   Leads: ${(dadosSistema.leads || []).length}`);
      console.log(`   Atividades: ${(dadosSistema.atividades || []).length}`);
      console.log(`   Produtos nos Leads: ${(dadosSistema.produtosLeads || []).length}`);
      console.log(`   Pedidos FDV: ${(dadosSistema.pedidos || []).filter((p: any) => p.ORIGEM === 'FDV').length}`);
      console.log(`   Pedidos Faturados: ${(dadosSistema.pedidos || []).filter((p: any) => p.ORIGEM !== 'FDV').length}`);
      console.log(`   Clientes: ${dadosSistema.totalClientes}`);
      console.log(`   Funis: ${(dadosSistema.funis || []).length}`);
      console.log(`   Estágios: ${(dadosSistema.estagiosFunis || []).length}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } else {
      console.log('💾 Usando contexto em cache - apenas pergunta do usuário');
      messageWithContext = message;
    }

    const chat = model.startChat({
      history: chatHistory,
    });

    console.log('📤 Enviando para Gemini...');
    console.log('📏 Payload:', messageWithContext.length, 'chars');
    console.log('🕐 Estimativa tokens:', Math.ceil(messageWithContext.length / 4));

    // Delay de 1s entre requests para respeitar rate limit (5 RPM)
    await new Promise(resolve => setTimeout(resolve, 1000));

    let result;
    try {
      result = await chat.sendMessageStream(messageWithContext);
      console.log('✅ Stream OK');
    } catch (error: any) {
      console.error('❌ Erro Gemini:', {
        code: error.code,
        msg: error.message,
        status: error.status
      });
      
      // Se for rate limit, informar claramente
      if (error.status === 429 || error.message?.includes('quota')) {
        return new Response(JSON.stringify({ 
          error: 'Limite de uso da API atingido. Aguarde 1 minuto e tente novamente.' 
        }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ 
        error: `Erro Gemini: ${error.message}` 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let chunkCount = 0;
        let totalChars = 0;
        let hasContent = false;

        try {
          console.log('🚀 Iniciando streaming da resposta...');

          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              hasContent = true;
              chunkCount++;
              totalChars += text.length;

              const data = `data: ${JSON.stringify({ text })}\n\n`;
              controller.enqueue(encoder.encode(data));

              // Log a cada 5 chunks para não poluir
              if (chunkCount % 5 === 0) {
                console.log(`📤 Enviado chunk ${chunkCount} (${totalChars} caracteres até agora)`);
              }
            } else {
              console.warn('⚠️ Chunk recebido sem texto');
            }
          }

          if (!hasContent) {
            console.error('❌ ERRO: Streaming concluído mas nenhum conteúdo foi recebido!');
            console.error('   Chunks recebidos:', chunkCount);
            console.error('   Total de caracteres:', totalChars);
            
            const errorMessage = `data: ${JSON.stringify({
              error: 'A IA não retornou uma resposta. Por favor, tente reformular sua pergunta ou tente novamente.'
            })}\n\n`;
            controller.enqueue(encoder.encode(errorMessage));
          } else {
            console.log(`✅ Streaming concluído: ${chunkCount} chunks, ${totalChars} caracteres totais`);
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error: any) {
          console.error('❌ Erro no streaming do Gemini:', error);
          console.error('   Código:', error.code);
          console.error('   Mensagem:', error.message);
          console.error('   Stack trace:', error.stack);
          console.error('   Chunks processados antes do erro:', chunkCount);

          const errorMessage = `data: ${JSON.stringify({
            error: `Erro ao processar resposta: ${error.message || 'Erro desconhecido'}`
          })}\n\n`;
          controller.enqueue(encoder.encode(errorMessage));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Erro no chat Gemini:', error);
    return new Response(JSON.stringify({ error: 'Erro ao processar mensagem' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}