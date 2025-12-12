import { oracleService } from './oracle-db';

export interface FiltroAnalise {
  dataInicio?: string;
  dataFim?: string;
  codUsuario?: number;
  isAdmin?: boolean;
  idEmpresa: number;
}

export interface DadosAnalise {
  leads: any[];
  produtosLeads: any[];
  atividades: any[];
  pedidos: any[];
  produtos: any[];
  clientes: any[];
  financeiro: any[];
  funis: any[];
  estagiosFunis: any[];
  vendedores: any[];
  estoques: any[];
  tabelaPrecos: any[];
  excecoesPreco: any[];
  timestamp: string;
  filtro: FiltroAnalise;
  totalLeads: number;
  totalAtividades: number;
  totalPedidos: number;
  totalProdutos: number;
  totalClientes: number;
  totalFinanceiro: number;
  totalVendedores: number;
  totalEstoques: number;
  totalTabelaPrecos: number;
  totalExcecoesPreco: number;
  valorTotalPedidos: number;
  valorTotalFinanceiro: number;
  valorRecebido: number;
  valorPendente: number;
  maioresClientes: any[];
}

export async function buscarDadosAnalise(
  filtro: FiltroAnalise,
  userId?: number,
  isAdmin?: boolean,
  idEmpresa?: number
): Promise<DadosAnalise> {
  console.log('🔍 Buscando dados de análise do Oracle...');

  try {
    // Usa os parâmetros passados ou os do filtro
    const empresaId = idEmpresa || filtro.idEmpresa;
    const usuarioId = userId || filtro.codUsuario;
    const ehAdmin = isAdmin !== undefined ? isAdmin : filtro.isAdmin || false;
    const { dataInicio, dataFim } = filtro;

    // Validar acesso e obter permissões
    const { accessControlService } = await import('./access-control-service');
    const userAccess = await accessControlService.validateUserAccess(usuarioId!, empresaId);

    // Verificar se pode acessar análise de dados
    if (!accessControlService.canAccessRestrictedFeatures(userAccess)) {
      throw new Error(accessControlService.getRestrictedFeatureMessage('Análise de Dados'));
    }

    console.log('🔐 Acesso do usuário:', {
      isAdmin: userAccess.isAdmin,
      codVendedor: userAccess.codVendedor,
      vendedoresEquipe: userAccess.vendedoresEquipe,
      message: 'Dados serão filtrados conforme permissões do usuário'
    });

    // 1. LEADS - Tabela AD_LEADS (com controle de acesso)
    const leadsAccessFilter = accessControlService.getLeadsWhereClause(userAccess);

    console.log('🔍 Filtro de acesso para leads:', leadsAccessFilter);

    const leadsQuery = `
      SELECT 
        l.CODLEAD,
        l.ID_EMPRESA,
        l.NOME,
        l.DESCRICAO,
        l.VALOR,
        l.CODESTAGIO,
        l.CODFUNIL,
        TO_CHAR(l.DATA_VENCIMENTO, 'DD/MM/YYYY') AS DATA_VENCIMENTO,
        l.TIPO_TAG,
        l.COR_TAG,
        l.CODPARC,
        l.CODUSUARIO,
        l.ATIVO,
        l.STATUS_LEAD,
        l.MOTIVO_PERDA,
        TO_CHAR(l.DATA_CRIACAO, 'DD/MM/YYYY') AS DATA_CRIACAO,
        TO_CHAR(l.DATA_ATUALIZACAO, 'DD/MM/YYYY') AS DATA_ATUALIZACAO,
        TO_CHAR(l.DATA_CONCLUSAO, 'DD/MM/YYYY') AS DATA_CONCLUSAO,
        e.NOME AS ESTAGIO_NOME,
        f.NOME AS FUNIL_NOME,
        p.NOMEPARC AS PARCEIRO_NOME,
        u.NOME AS USUARIO_NOME
      FROM AD_LEADS l
      LEFT JOIN AD_FUNISESTAGIOS e ON l.CODESTAGIO = e.CODESTAGIO
      LEFT JOIN AD_FUNIS f ON l.CODFUNIL = f.CODFUNIL
      LEFT JOIN AS_PARCEIROS p ON l.CODPARC = p.CODPARC AND p.ID_SISTEMA = :idEmpresa
      LEFT JOIN AD_USUARIOSVENDAS u ON l.CODUSUARIO = u.CODUSUARIO
      WHERE l.ID_EMPRESA = :idEmpresa
        AND l.ATIVO = 'S'
        ${dataInicio ? "AND l.DATA_CRIACAO >= TO_DATE(:dataInicio, 'YYYY-MM-DD')" : ''}
        ${dataFim ? "AND l.DATA_CRIACAO <= TO_DATE(:dataFim, 'YYYY-MM-DD')" : ''}
        ${leadsAccessFilter.clause}
      ORDER BY l.DATA_CRIACAO DESC
    `;

    const leadsParams: any = { idEmpresa: empresaId, ...leadsAccessFilter.binds };
    if (dataInicio) leadsParams.dataInicio = dataInicio;
    if (dataFim) leadsParams.dataFim = dataFim;

    console.log('📋 Query de leads:', leadsQuery);
    console.log('📋 Params de leads:', leadsParams);

    const leads = await oracleService.executeQuery(leadsQuery, leadsParams);
    console.log(`✅ ${leads.length} leads encontrados`);

    // 2. PRODUTOS DOS LEADS - Tabela AD_ADLEADSPRODUTOS
    // Produtos dos leads - apenas se houver leads
    let produtosLeads = [];
    if (leads.length > 0) {
      const produtosLeadsQuery = `
        SELECT 
          pl.CODLEAD,
          pl.CODPROD,
          pl.DESCRPROD,
          pl.QUANTIDADE,
          pl.VLRUNIT,
          pl.VLRTOTAL
        FROM AD_ADLEADSPRODUTOS pl
        WHERE pl.ID_EMPRESA = :idEmpresa
          AND pl.ATIVO = 'S'
        ORDER BY pl.VLRTOTAL DESC
      `;

      try {
        produtosLeads = await oracleService.executeQuery(produtosLeadsQuery, { idEmpresa: empresaId });
        console.log(`✅ ${produtosLeads.length} produtos de leads encontrados`);
      } catch (error: any) {
        console.warn('⚠️ Erro ao buscar produtos de leads:', error.message);
        produtosLeads = [];
      }
    }

    // 3. ATIVIDADES - Tabela AD_ADLEADSATIVIDADES (com controle de acesso)
    const atividadesAccessFilter = accessControlService.getAtividadesWhereClause(userAccess);

    const atividadesQuery = `
      SELECT 
        a.CODATIVIDADE,
        a.CODLEAD,
        a.ID_EMPRESA,
        a.TIPO,
        a.TITULO,
        a.DESCRICAO,
        TO_CHAR(a.DATA_INICIO, 'DD/MM/YYYY HH24:MI:SS') AS DATA_INICIO,
        TO_CHAR(a.DATA_FIM, 'DD/MM/YYYY HH24:MI:SS') AS DATA_FIM,
        a.CODUSUARIO,
        a.COR,
        a.STATUS,
        TO_CHAR(a.DATA_CRIACAO, 'DD/MM/YYYY HH24:MI:SS') AS DATA_CRIACAO,
        u.NOME AS USUARIO_NOME,
        l.NOME AS LEAD_NOME
      FROM AD_ADLEADSATIVIDADES a
      LEFT JOIN AD_USUARIOSVENDAS u ON a.CODUSUARIO = u.CODUSUARIO
      LEFT JOIN AD_LEADS l ON a.CODLEAD = l.CODLEAD
      WHERE a.ID_EMPRESA = :idEmpresa
        AND a.ATIVO = 'S'
        ${dataInicio ? "AND a.DATA_CRIACAO >= TO_DATE(:dataInicio, 'YYYY-MM-DD')" : ''}
        ${dataFim ? "AND a.DATA_CRIACAO <= TO_DATE(:dataFim, 'YYYY-MM-DD')" : ''}
        ${atividadesAccessFilter.clause}
      ORDER BY a.DATA_CRIACAO DESC
    `;

    const atividadesParams: any = { idEmpresa: empresaId, ...atividadesAccessFilter.binds };
    if (dataInicio) atividadesParams.dataInicio = dataInicio;
    if (dataFim) atividadesParams.dataFim = dataFim;

    const atividades = await oracleService.executeQuery(atividadesQuery, atividadesParams);

    // 4. PEDIDOS SANKHYA - Tabela AS_CABECALHO_NOTA (com controle de acesso)
    const pedidosAccessFilter = accessControlService.getPedidosWhereClause(userAccess);

    const pedidosQuery = `
      SELECT 
        cab.NUNOTA,
        cab.ID_SISTEMA,
        cab.CODTIPOPER,
        cab.CODTIPVENDA,
        cab.CODPARC,
        cab.CODVEND AS CODVEND,
        cab.VLRNOTA,
        TO_CHAR(cab.DTNEG, 'DD/MM/YYYY') AS DTNEG,
        cab.TIPMOV,
        p.NOMEPARC,
        v.APELIDO AS VENDEDOR_NOME,
        tn.DESCRTIPVENDA,
        top.DESCROPER,
        'SANKHYA' AS ORIGEM
      FROM AS_CABECALHO_NOTA cab
      LEFT JOIN AS_PARCEIROS p ON cab.CODPARC = p.CODPARC AND p.ID_SISTEMA = cab.ID_SISTEMA
      LEFT JOIN AS_VENDEDORES v ON cab.CODVEND = v.CODVEND AND v.ID_SISTEMA = cab.ID_SISTEMA
      LEFT JOIN AS_TIPOS_NEGOCIACAO tn ON cab.CODTIPVENDA = tn.CODTIPVENDA AND tn.ID_SISTEMA = cab.ID_SISTEMA
      LEFT JOIN AS_TIPOS_OPERACAO top ON cab.CODTIPOPER = top.CODTIPOPER AND top.ID_SISTEMA = cab.ID_SISTEMA
      WHERE cab.ID_SISTEMA = :idEmpresa
        AND cab.SANKHYA_ATUAL = 'S'
        ${dataInicio ? "AND cab.DTNEG >= TO_DATE(:dataInicio, 'YYYY-MM-DD')" : ''}
        ${dataFim ? "AND cab.DTNEG <= TO_DATE(:dataFim, 'YYYY-MM-DD')" : ''}
        ${pedidosAccessFilter.clause}
      ORDER BY cab.DTNEG DESC
    `;

    const pedidosParams: any = { idEmpresa: empresaId, ...pedidosAccessFilter.binds };
    if (dataInicio) pedidosParams.dataInicio = dataInicio;
    if (dataFim) pedidosParams.dataFim = dataFim;

    let pedidos = [];
    try {
      pedidos = await oracleService.executeQuery(pedidosQuery, pedidosParams);
    } catch (error: any) {
      console.warn('⚠️ Erro ao buscar pedidos:', error.message);
    }

    // 4.1. PEDIDOS FDV - Tabela AD_PEDIDOS_FDV
    const pedidosFDVQuery = `
      SELECT 
        fdv.ID,
        fdv.ID_EMPRESA,
        fdv.ORIGEM,
        fdv.CODLEAD,
        fdv.STATUS,
        fdv.NUNOTA,
        fdv.TENTATIVAS,
        fdv.CODUSUARIO,
        fdv.NOME_USUARIO,
        TO_CHAR(fdv.DATA_CRIACAO, 'DD/MM/YYYY HH24:MI:SS') AS DATA_CRIACAO,
        DBMS_LOB.SUBSTR(fdv.CORPO_JSON, 4000, 1) AS CORPO_JSON
      FROM AD_PEDIDOS_FDV fdv
      WHERE fdv.ID_EMPRESA = :idEmpresa
        ${dataInicio ? "AND fdv.DATA_CRIACAO >= TO_DATE(:dataInicio, 'YYYY-MM-DD')" : ''}
        ${dataFim ? "AND fdv.DATA_CRIACAO <= TO_DATE(:dataFim, 'YYYY-MM-DD')" : ''}
      ORDER BY fdv.DATA_CRIACAO DESC
    `;

    const pedidosFDVParams: any = { idEmpresa: empresaId };
    if (dataInicio) pedidosFDVParams.dataInicio = dataInicio;
    if (dataFim) pedidosFDVParams.dataFim = dataFim;

    let pedidosFDV = [];
    try {
      const rawPedidosFDV = await oracleService.executeQuery(pedidosFDVQuery, pedidosFDVParams);
      pedidosFDV = rawPedidosFDV.map((p: any) => {
        let corpoJson = null;
        if (p.CORPO_JSON) {
          try {
            corpoJson = JSON.parse(p.CORPO_JSON);
          } catch (e) {
            console.warn('⚠️ Erro ao parsear CORPO_JSON do pedido FDV:', p.ID);
          }
        }
        return {
          ...p,
          CORPO_JSON: corpoJson,
          ORIGEM: 'FDV'
        };
      });
      console.log(`✅ ${pedidosFDV.length} pedidos FDV encontrados`);
    } catch (error: any) {
      console.warn('⚠️ Erro ao buscar pedidos FDV:', error.message);
    }

    // 5. PRODUTOS - Tabela AS_PRODUTOS
    const produtosQuery = `
      SELECT 
        ID_SISTEMA,
        CODPROD,
        DESCRPROD,
        ATIVO,
        LOCAL,
        MARCA,
        CARACTERISTICAS,
        UNIDADE,
        VLRCOMERC
      FROM AS_PRODUTOS
      WHERE ID_SISTEMA = :idEmpresa
        AND SANKHYA_ATUAL = 'S'
        AND ATIVO = 'S'
      ORDER BY DESCRPROD
    `;

    let produtos = [];
    try {
      produtos = await oracleService.executeQuery(produtosQuery, { idEmpresa: empresaId });
    } catch (error: any) {
      console.warn('⚠️ Erro ao buscar produtos:', error.message);
    }

    // 6. CLIENTES/PARCEIROS - Tabela AS_PARCEIROS (com controle de acesso)
    const parceirosAccessFilter = accessControlService.getParceirosWhereClause(userAccess);

    const clientesQuery = `
      SELECT 
        ID_SISTEMA,
        CODPARC,
        NOMEPARC,
        CGC_CPF,
        CODCID,
        ATIVO,
        TIPPESSOA,
        RAZAOSOCIAL,
        CEP,
        CLIENTE,
        CODVEND,
        LATITUDE,
        LONGITUDE
      FROM AS_PARCEIROS
      WHERE ID_SISTEMA = :idEmpresa
        AND SANKHYA_ATUAL = 'S'
        AND CLIENTE = 'S'
        AND ATIVO = 'S'
        ${parceirosAccessFilter.clause}
      ORDER BY NOMEPARC
    `;

    const clientesParams: any = { idEmpresa: empresaId, ...parceirosAccessFilter.binds };

    let clientes = [];
    try {
      clientes = await oracleService.executeQuery(clientesQuery, clientesParams);
      console.log(`✅ ${clientes.length} clientes encontrados com filtro de acesso`);
    } catch (error: any) {
      console.warn('⚠️ Erro ao buscar clientes:', error.message);
    }

    // 7. FINANCEIRO - Tabela AS_FINANCEIRO (com controle de acesso)
    const financeiroAccessFilter = accessControlService.getFinanceiroWhereClause(userAccess);

    const financeiroQuery = `
      SELECT 
        fin.NUFIN,
        fin.ID_SISTEMA,
        fin.CODPARC,
        fin.CODEMP,
        fin.VLRDESDOB,
        TO_CHAR(fin.DTVENC, 'DD/MM/YYYY') AS DTVENC,
        TO_CHAR(fin.DTNEG, 'DD/MM/YYYY') AS DTNEG,
        fin.PROVISAO,
        TO_CHAR(fin.DHBAIXA, 'DD/MM/YYYY HH24:MI:SS') AS DHBAIXA,
        fin.VLRBAIXA,
        fin.RECDESP,
        fin.NOSSONUM,
        fin.HISTORICO,
        fin.NUMNOTA,
        p.NOMEPARC
      FROM AS_FINANCEIRO fin
      LEFT JOIN AS_PARCEIROS p ON fin.CODPARC = p.CODPARC AND p.ID_SISTEMA = fin.ID_SISTEMA
      WHERE fin.ID_SISTEMA = :idEmpresa
        AND fin.SANKHYA_ATUAL = 'S'
        AND fin.RECDESP = 1
        ${dataInicio ? "AND fin.DTNEG >= TO_DATE(:dataInicio, 'YYYY-MM-DD')" : ''}
        ${dataFim ? "AND fin.DTNEG <= TO_DATE(:dataFim, 'YYYY-MM-DD')" : ''}
        ${financeiroAccessFilter.clause}
      ORDER BY fin.DTNEG DESC
    `;

    const financeiroParams: any = { idEmpresa: empresaId, ...financeiroAccessFilter.binds };
    if (dataInicio) financeiroParams.dataInicio = dataInicio;
    if (dataFim) financeiroParams.dataFim = dataFim;

    let financeiro = [];
    try {
      financeiro = await oracleService.executeQuery(financeiroQuery, financeiroParams);
    } catch (error: any) {
      console.warn('⚠️ Erro ao buscar financeiro:', error.message);
    }

    // 8. FUNIS - Tabela AD_FUNIS
    const funisQuery = `
      SELECT 
        CODFUNIL,
        ID_EMPRESA,
        NOME,
        DESCRICAO,
        COR,
        ATIVO,
        TO_CHAR(DATA_CRIACAO, 'DD/MM/YYYY') AS DATA_CRIACAO
      FROM AD_FUNIS
      WHERE ID_EMPRESA = :idEmpresa
        AND ATIVO = 'S'
      ORDER BY NOME
    `;

    const funis = await oracleService.executeQuery(funisQuery, { idEmpresa: empresaId });

    // 9. ESTÁGIOS DOS FUNIS - Tabela AD_FUNISESTAGIOS (com nome do funil)
    const estagiosFunisQuery = `
      SELECT 
        e.CODESTAGIO,
        e.CODFUNIL,
        e.ID_EMPRESA,
        e.NOME,
        e.ORDEM,
        e.COR,
        e.ATIVO,
        f.NOME AS FUNIL_NOME
      FROM AD_FUNISESTAGIOS e
      LEFT JOIN AD_FUNIS f ON e.CODFUNIL = f.CODFUNIL
      WHERE e.ID_EMPRESA = :idEmpresa
        AND e.ATIVO = 'S'
      ORDER BY e.CODFUNIL, e.ORDEM
    `;

    const estagiosFunis = await oracleService.executeQuery(estagiosFunisQuery, { idEmpresa: empresaId });

    // 10. VENDEDORES - Tabela AS_VENDEDORES
    const vendedoresQuery = `
      SELECT 
        ID_SISTEMA,
        CODVEND,
        APELIDO,
        ATIVO,
        EMAIL,
        CODPARC,
        COMVENDA
      FROM AS_VENDEDORES
      WHERE ID_SISTEMA = :idEmpresa
        AND SANKHYA_ATUAL = 'S'
        AND ATIVO = 'S'
      ORDER BY APELIDO
    `;

    let vendedores = [];
    try {
      vendedores = await oracleService.executeQuery(vendedoresQuery, { idEmpresa: empresaId });
    } catch (error: any) {
      console.warn('⚠️ Erro ao buscar vendedores:', error.message);
    }

    // 11. ESTOQUES - Tabela AS_ESTOQUES
    const estoquesQuery = `
      SELECT 
        ID_SISTEMA,
        CODPROD,
        CODLOCAL,
        ESTOQUE,
        ATIVO,
        CONTROLE
      FROM AS_ESTOQUES
      WHERE ID_SISTEMA = :idEmpresa
        AND SANKHYA_ATUAL = 'S'
        AND ATIVO = 'S'
      ORDER BY CODPROD, CODLOCAL
    `;

    let estoques = [];
    try {
      estoques = await oracleService.executeQuery(estoquesQuery, { idEmpresa: empresaId });
    } catch (error: any) {
      console.warn('⚠️ Erro ao buscar estoques:', error.message);
    }

    // 12. TABELAS DE PREÇOS - Tabela AS_TABELA_PRECOS
    const tabelaPrecosQuery = `
      SELECT 
        ID_SISTEMA,
        NUTAB,
        CODTAB,
        TO_CHAR(DTVIGOR, 'DD/MM/YYYY') AS DTVIGOR,
        PERCENTUAL
      FROM AS_TABELA_PRECOS
      WHERE ID_SISTEMA = :idEmpresa
        AND SANKHYA_ATUAL = 'S'
      ORDER BY NUTAB
    `;

    let tabelaPrecos = [];
    try {
      tabelaPrecos = await oracleService.executeQuery(tabelaPrecosQuery, { idEmpresa: empresaId });
    } catch (error: any) {
      console.warn('⚠️ Erro ao buscar tabela de preços:', error.message);
    }

    // 13. EXCEÇÕES DE PREÇO - Tabela AS_EXCECAO_PRECO
    const excecoesPrecoQuery = `
      SELECT 
        ID_SISTEMA,
        CODPROD,
        NUTAB,
        CODLOCAL,
        VLRVENDA,
        TIPO
      FROM AS_EXCECAO_PRECO
      WHERE ID_SISTEMA = :idEmpresa
        AND SANKHYA_ATUAL = 'S'
      ORDER BY CODPROD, NUTAB
    `;

    let excecoesPreco = [];
    try {
      excecoesPreco = await oracleService.executeQuery(excecoesPrecoQuery, { idEmpresa: empresaId });
    } catch (error: any) {
      console.warn('⚠️ Erro ao buscar exceções de preço:', error.message);
    }

    // Calcular métricas
    const valorTotalPedidos = pedidos.reduce((sum, p: any) => sum + (parseFloat(p.VLRNOTA) || 0), 0);
    const valorTotalFinanceiro = financeiro.reduce((sum, f: any) => sum + (parseFloat(f.VLRDESDOB) || 0), 0);
    const valorRecebido = financeiro.reduce((sum, f: any) => sum + (f.DHBAIXA ? (parseFloat(f.VLRBAIXA) || 0) : 0), 0);

    // Maiores clientes por valor de pedidos
    const clientesComValor = clientes.map((c: any) => {
      const pedidosCliente = pedidos.filter((p: any) => p.CODPARC === c.CODPARC);
      const totalPedidos = pedidosCliente.reduce((sum, p: any) => sum + (parseFloat(p.VLRNOTA) || 0), 0);
      return {
        ...c,
        totalPedidos,
        qtdPedidos: pedidosCliente.length
      };
    })
      .filter(c => c.totalPedidos > 0)
      .sort((a, b) => b.totalPedidos - a.totalPedidos)
      .slice(0, 10);

    // Combinar pedidos Sankhya e FDV
    const todosPedidos = [...pedidos, ...pedidosFDV];

    const resultado: DadosAnalise = {
      leads,
      produtosLeads,
      atividades,
      pedidos: todosPedidos,
      produtos: [], // Não enviar catálogo completo de produtos
      clientes,
      financeiro,
      funis,
      estagiosFunis,
      vendedores,
      estoques,
      tabelaPrecos,
      excecoesPreco,
      timestamp: new Date().toISOString(),
      filtro,
      totalLeads: leads.length,
      totalAtividades: atividades.length,
      totalPedidos: todosPedidos.length,
      totalProdutos: produtos.length,
      totalClientes: clientes.length,
      totalFinanceiro: financeiro.length,
      totalVendedores: vendedores.length,
      totalEstoques: estoques.length,
      totalTabelaPrecos: tabelaPrecos.length,
      totalExcecoesPreco: excecoesPreco.length,
      valorTotalPedidos,
      valorTotalFinanceiro,
      valorRecebido,
      valorPendente: valorTotalFinanceiro - valorRecebido,
      maioresClientes: clientesComValor
    };

    console.log('✅ Dados de análise carregados do Oracle');
    return resultado;

  } catch (erro: any) {
    console.error('❌ Erro ao buscar dados de análise do Oracle:', erro);
    throw erro;
  }
}