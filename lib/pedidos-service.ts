import axios from 'axios';
import { buscarPrecoProduto } from './produtos-service';
import { sankhyaDynamicAPI } from './sankhya-dynamic-api';

// Serviço de gerenciamento de pedidos de venda
export interface PedidoVenda {
  NUNOTA?: string
  CODEMP: string
  CODPARC: string
  CODTIPOPER: string
  DHTIPOPER?: string
  TIPMOV: string
  CODVEND: string
  CODTIPVENDA: string
  DHTIPVENDA?: string
  DTNEG: string
  DTFATUR?: string
  DTENTSAI?: string
  OBSERVACAO?: string
  VLRNOTA?: number
  CODNAT?: string
  CODCENCUS?: string
  VLRFRETE?: number
  TIPFRETE?: string
  ORDEMCARGA?: string
  CODPARCTRANSP?: string
  VLROUTROS?: number
  VLRDESCTOT?: number
  PERCDESC?: number
  // Campos do cliente
  TIPO_CLIENTE?: string
  CPF_CNPJ?: string
  IE_RG?: string
  RAZAO_SOCIAL?: string
  itens: ItemPedido[]
}

export interface ItemPedido {
  SEQUENCIA?: number
  CODPROD: string
  QTDNEG: number
  VLRUNIT: number
  VLRTOT?: number
  PERCDESC?: number
  VLRDESC?: number
  CODLOCALORIG: string
  CONTROLE?: string
  AD_QTDBARRA?: number
  CODVOL?: string
  VLRTOTLIQ?: number
  IDALIQICMS?: string
}

// Criar Pedido de Venda usando a nova API dinâmica
export async function criarPedidoVenda(pedido: PedidoVenda & { idEmpresa: number }): Promise<any> {
  try {
    console.log("\n" + "🚀 ".repeat(40));
    console.log("INICIANDO CRIAÇÃO DE PEDIDO DE VENDA - API DINÂMICA");
    console.log(`📊 Empresa ID: ${pedido.idEmpresa}`);
    console.log("🚀 ".repeat(40));

    const { idEmpresa, ...dadosPedido } = pedido;

    // Calcular valor total
    let valorTotal = 0;
    pedido.itens.forEach(item => {
      const vlrTotal = item.QTDNEG * item.VLRUNIT;
      const vlrDesc = item.PERCDESC ? (vlrTotal * item.PERCDESC / 100) : 0;
      valorTotal += (vlrTotal - vlrDesc);
    });

    // Ajustar com frete, outros e descontos totais
    valorTotal += (pedido.VLRFRETE || 0);
    valorTotal += (pedido.VLROUTROS || 0);
    valorTotal -= (pedido.VLRDESCTOT || 0);

    // Converter data de YYYY-MM-DD para DD/MM/YYYY
    const formatarData = (dataStr: string) => {
      if (!dataStr) return "";
      const [ano, mes, dia] = dataStr.split('-');
      return `${dia}/${mes}/${ano}`;
    };

    // Obter hora atual no formato HH:mm
    const obterHoraAtual = () => {
      const agora = new Date();
      const horas = String(agora.getHours()).padStart(2, '0');
      const minutos = String(agora.getMinutes()).padStart(2, '0');
      return `${horas}:${minutos}`;
    };

    // Buscar preços dos produtos se não fornecidos
    const itensComPreco = await Promise.all(
      pedido.itens.map(async (item, index) => {
        let valorUnitario = item.VLRUNIT;

        // Se não tem preço, buscar da API
        if (!valorUnitario || valorUnitario === 0) {
          console.log(`🔍 Buscando preço do produto ${item.CODPROD}...`);
          valorUnitario = await buscarPrecoProduto(item.CODPROD);
          console.log(`💰 Preço encontrado: ${valorUnitario}`);
        }

        return {
          "sequencia": index + 1,
          "codigoProduto": parseInt(item.CODPROD),
          "quantidade": parseFloat(item.QTDNEG.toString()),
          "controle": item.CONTROLE || "007",
          "codigoLocalEstoque": parseInt(item.CODLOCALORIG) || 700,
          "unidade": item.CODVOL || "UN",
          "valorUnitario": parseFloat(valorUnitario.toString())
        };
      })
    );

    // Validações antes de enviar
    if (!pedido.CODPARC) {
      throw new Error('Código do parceiro é obrigatório');
    }

    if (!pedido.CODVEND || pedido.CODVEND === '0') {
      throw new Error('Vendedor é obrigatório');
    }

    if (!pedido.CPF_CNPJ) {
      throw new Error('CPF/CNPJ do cliente é obrigatório');
    }

    if (!pedido.RAZAO_SOCIAL) {
      throw new Error('Razão Social do cliente é obrigatória');
    }

    // Capturar modelo da nota (campo obrigatório)
    console.log('\n🔍 DEBUG - Valores recebidos para modelo da nota:');
    console.log(`   - (pedido as any).MODELO_NOTA: "${(pedido as any).MODELO_NOTA}"`);
    console.log(`   - Tipo: ${typeof (pedido as any).MODELO_NOTA}`);

    // Validar que MODELO_NOTA foi fornecido
    if (!(pedido as any).MODELO_NOTA) {
      throw new Error('Modelo da Nota é obrigatório');
    }

    const modeloNota = Number((pedido as any).MODELO_NOTA);
    
    if (isNaN(modeloNota) || modeloNota <= 0) {
      throw new Error('Modelo da Nota inválido. Informe um número válido.');
    }
    
    console.log(`✅ Modelo da nota validado: ${modeloNota} (tipo: ${typeof modeloNota})`);

    const dataNegociacao = formatarData(pedido.DTNEG);
    const horaAtual = obterHoraAtual();

    // Garantir que a data não seja futura
    const hoje = new Date()
    const partesData = dataNegociacao.split('/')
    const dataDigitada = new Date(
      Number(partesData[2]),
      Number(partesData[1]) - 1,
      Number(partesData[0])
    )

    // Se a data for futura, usar a data de hoje
    const dataFinal = dataDigitada > hoje
      ? hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : dataNegociacao

    // Montar o payload conforme o novo formato da API
    const corpoPedido = {
      cliente: {
        tipo: pedido.TIPO_CLIENTE || 'PJ',
        cnpjCpf: pedido.CPF_CNPJ,
        ieRg: pedido.IE_RG || '',
        razao: pedido.RAZAO_SOCIAL || pedido.RAZAOSOCIAL || ''
      },
      notaModelo: modeloNota,
      CODTIPOPER: Number(pedido.CODTIPOPER),
      CODTIPVENDA: Number(pedido.CODTIPVENDA),
      data: dataFinal,
      hora: horaAtual,
      codigoVendedor: Number(pedido.CODVEND),
      codigoCliente: Number(pedido.CODPARC),
      valorTotal: Number(valorTotal.toFixed(2)),
      itens: itensComPreco
    }

    console.log("\n" + "📤 ".repeat(40));
    console.log("CORPO DE ENVIO PARA API SANKHYA - VALIDAÇÃO COMPLETA");
    console.log("📤 ".repeat(40));
    console.log("\n📋 MODELO DA NOTA:");
    console.log(`   - Valor digitado: ${(pedido as any).MODELO_NOTA}`);
    console.log(`   - CODTIPOPER: ${pedido.CODTIPOPER}`);
    console.log(`   - modeloNota final: ${modeloNota}`);
    console.log(`   - Tipo: ${typeof modeloNota}`);
    console.log("\n📦 CORPO JSON COMPLETO:");
    console.log(JSON.stringify(corpoPedido, null, 2));
    console.log("\n📅 DATAS:");
    console.log(`   - Data original: ${dataNegociacao}`);
    console.log(`   - Data validada: ${dataFinal}`);
    console.log(`   - Hora: ${horaAtual}`);
    console.log("📤 ".repeat(40) + "\n")

    // Usar a API dinâmica para fazer a requisição
    const resposta = await sankhyaDynamicAPI.fazerRequisicao(
      idEmpresa,
      '/v1/vendas/pedidos',
      'POST',
      corpoPedido
    );

    console.log("\n📥 RESPOSTA COMPLETA:");
    console.log(JSON.stringify(resposta, null, 2));

    // Verificar se há erro na resposta
    if (resposta?.statusCode && resposta.statusCode >= 400) {
      console.error("\n" + "❌ ".repeat(40));
      console.error("ERRO NA RESPOSTA DA API SANKHYA");
      console.error("❌ ".repeat(40));
      console.error("\n📋 CORPO ENVIADO:");
      console.error(JSON.stringify(corpoPedido, null, 2));
      console.error("\n📥 RESPOSTA RECEBIDA:");
      console.error(JSON.stringify(resposta, null, 2));
      console.error("\n🔍 DETALHES DO ERRO:");
      console.error(`   - Status Code: ${resposta.statusCode}`);
      console.error(`   - Error Code: ${resposta.error?.code}`);
      console.error(`   - Message: ${resposta.error?.message}`);
      console.error(`   - Details: ${resposta.error?.details}`);
      console.error("❌ ".repeat(40) + "\n");

      // Criar mensagem de erro detalhada
      const errorDetails = resposta?.error?.details || resposta?.error?.message || '';
      const errorCode = resposta?.error?.code || resposta?.statusCode || '';
      const errorMessage = errorDetails 
        ? `[${errorCode}] ${errorDetails}`
        : resposta?.statusMessage || 'Erro ao criar pedido';

      throw new Error(errorMessage);
    }

    if (resposta?.error) {
      console.error("\n" + "❌ ".repeat(40));
      console.error("ERRO NA RESPOSTA DA API SANKHYA");
      console.error("❌ ".repeat(40));
      console.error("\n📋 CORPO ENVIADO:");
      console.error(JSON.stringify(corpoPedido, null, 2));
      console.error("\n📥 RESPOSTA RECEBIDA:");
      console.error(JSON.stringify(resposta, null, 2));
      console.error("❌ ".repeat(40) + "\n");

      // Criar mensagem de erro detalhada
      const errorDetails = resposta.error.details || resposta.error.message || '';
      const errorCode = resposta.error.code || '';
      const errorMessage = errorDetails 
        ? `[${errorCode}] ${errorDetails}`
        : 'Erro ao criar pedido';

      throw new Error(errorMessage);
    }

    // Tentar diferentes formas de extrair o NUNOTA
    console.log("\n🔍 DEBUG - Verificando estrutura da resposta:");
    console.log("- resposta:", resposta);
    console.log("- tipo de resposta:", typeof resposta);

    // Extrair NUNOTA ou ID do pedido da resposta
    let nunota =
      resposta?.retorno?.codigoPedido ||
      resposta?.codigoPedido ||
      resposta?.codigo ||
      resposta?.nunota ||
      resposta?.NUNOTA ||
      resposta?.id ||
      resposta?.data?.codigoPedido ||
      resposta?.data?.nunota ||
      resposta?.data?.NUNOTA ||
      resposta?.data?.id;

    console.log("\n🔍 NUNOTA/ID EXTRAÍDO:", nunota);

    if (!nunota) {
      console.error("\n❌ ESTRUTURA COMPLETA DA RESPOSTA:");
      console.error(JSON.stringify(resposta, null, 2));
    }

    console.log("\n" + "✅ ".repeat(40));
    console.log(`PEDIDO CRIADO COM SUCESSO! ${nunota ? `NUNOTA: ${nunota}` : 'ID não identificado'}`);
    console.log("✅ ".repeat(40) + "\n");

    return {
      success: true,
      nunota: nunota,
      message: "Pedido criado com sucesso",
      resposta: resposta
    };
  } catch (erro: any) {
    console.error("\n" + "❌ ".repeat(40));
    console.error("ERRO AO CRIAR PEDIDO DE VENDA");
    console.error("Mensagem:", erro.message);
    console.error("❌ ESTRUTURA COMPLETA DA RESPOSTA:");
    console.error(JSON.stringify(erro.response?.data || erro, null, 2));
    console.error("❌ ".repeat(40) + "\n");

    // Criar um erro com informações detalhadas
    const errorData = erro.response?.data;
    
    // Criar mensagem de erro estruturada com todos os detalhes
    const errorMessage = errorData?.error?.details 
      ? `${errorData.error.message || 'Erro'}\n\nDetalhes: ${errorData.error.details}`
      : errorData?.error?.message || errorData?.statusMessage || erro.message || 'Erro desconhecido ao criar pedido';
    
    const detailedError = new Error(errorMessage);
    (detailedError as any).response = erro.response;
    (detailedError as any).errorData = errorData; // Guardar dados completos do erro

    throw detailedError;
  }
}