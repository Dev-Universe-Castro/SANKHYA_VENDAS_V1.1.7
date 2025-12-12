
import Dexie, { Table } from 'dexie';

class SankhyaOfflineDB extends Dexie {
  produtos!: Table<any>;
  parceiros!: Table<any>;
  financeiro!: Table<any>;
  tiposNegociacao!: Table<any>;
  tiposOperacao!: Table<any>;
  tiposPedido!: Table<any>;
  estoque!: Table<any>;
  precos!: Table<any>;
  tabelasPrecos!: Table<any>;
  tabelasPrecosConfig!: Table<any>;
  pedidosPendentes!: Table<any>;
  pedidos!: Table<any>;
  usuarios!: Table<any>;
  vendedores!: Table<any>;
  metadados!: Table<any>;

  constructor() {
    super('SankhyaOfflineDB');
    
    // Versão 6 - schema com índice melhorado para login offline
    this.version(6).stores({
      produtos: 'CODPROD, DESCRPROD, ATIVO',
      parceiros: 'CODPARC, NOMEPARC, CODVEND, CGC_CPF',
      financeiro: 'NUFIN, CODPARC, DTVENC, RECDESP',
      tiposNegociacao: 'CODTIPVENDA',
      tiposOperacao: 'CODTIPOPER',
      tiposPedido: 'CODTIPOPEDIDO, CODTIPOPER',
      estoque: '[CODPROD+CODLOCAL], CODPROD, CODLOCAL',
      precos: '[CODPROD+NUTAB], CODPROD, NUTAB',
      tabelasPrecos: 'NUTAB, CODTAB',
      tabelasPrecosConfig: 'CODCONFIG, NUTAB',
      pedidosPendentes: '++id, synced, createdAt',
      pedidos: 'NUNOTA, CODPARC, CODVEND, DTNEG',
      usuarios: 'CODUSUARIO, &EMAIL, username, NOME, FUNCAO, STATUS, passwordHash',
      vendedores: 'CODVEND, APELIDO, ATIVO',
      metadados: 'chave'
    });
  }
}

export const db = new SankhyaOfflineDB();
