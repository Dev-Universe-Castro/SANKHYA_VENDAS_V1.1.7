import { oracleService } from './oracle-db';

export interface UserAccess {
  userId: number;
  idEmpresa: number;
  role: string;
  codVendedor: number | null;
  codGerente: number | null;
  isAdmin: boolean;
  vendedoresEquipe: number[];
}

export class AccessControlService {
  /**
   * Valida se o usuário tem vendedor/gerente vinculado
   * Retorna erro se não for admin e não tiver vinculação
   */
  async validateUserAccess(userId: number, idEmpresa: number): Promise<UserAccess> {
    console.log('🔐 Validando acesso do usuário:', { userId, idEmpresa });

    const sql = `
      SELECT 
        u.CODUSUARIO,
        u.FUNCAO,
        u.CODVEND,
        v.TIPVEND,
        v.CODGER
      FROM AD_USUARIOSVENDAS u
      LEFT JOIN AS_VENDEDORES v ON u.CODVEND = v.CODVEND AND v.ID_SISTEMA = :idEmpresa
      WHERE u.CODUSUARIO = :userId
        AND u.ID_EMPRESA = :idEmpresa
    `;

    const result = await oracleService.executeOne<any>(sql, { userId, idEmpresa });

    if (!result) {
      throw new Error('Usuário não encontrado');
    }

    const isAdmin = result.FUNCAO === 'Administrador' || result.FUNCAO === 'ADMIN';
    const codVendedor = result.CODVEND ? Number(result.CODVEND) : null;

    // Verificar se precisa de vinculação
    if (!isAdmin && !codVendedor) {
      throw new Error('⚠️ Seu usuário não possui vendedor/gerente vinculado. Entre em contato com o administrador para criar leads, pedidos e acessar funcionalidades do sistema.');
    }

    // Buscar vendedores da equipe se for gerente
    let vendedoresEquipe: number[] = [];
    if (codVendedor && result.TIPVEND === 'G') {
      const vendedoresSql = `
        SELECT CODVEND
        FROM AS_VENDEDORES
        WHERE CODGER = :codGerente
          AND ID_SISTEMA = :idEmpresa
          AND SANKHYA_ATUAL = 'S'
          AND ATIVO = 'S'
      `;
      const vendedores = await oracleService.executeQuery<any>(vendedoresSql, {
        codGerente: codVendedor,
        idEmpresa
      });
      vendedoresEquipe = vendedores.map(v => Number(v.CODVEND));
    }

    const userAccess: UserAccess = {
      userId,
      idEmpresa,
      role: result.FUNCAO,
      codVendedor,
      codGerente: result.CODGER ? Number(result.CODGER) : null,
      isAdmin,
      vendedoresEquipe
    };

    console.log('✅ Acesso validado:', userAccess);
    return userAccess;
  }

  /**
   * Valida se o usuário pode criar/editar dados
   * Apenas Admin ou usuário com vendedor vinculado
   */
  canCreateOrEdit(access: UserAccess): boolean {
    return access.isAdmin || access.codVendedor !== null;
  }

  /**
   * Retorna mensagem de erro caso não possa criar/editar
   */
  getAccessDeniedMessage(access: UserAccess): string {
    if (access.isAdmin) return '';
    if (access.codVendedor) return '';
    return '⚠️ ACESSO NEGADO: Seu usuário não possui vendedor/gerente vinculado. Você não pode criar leads, pedidos, financeiro, parceiros ou usar a IA. Apenas administradores podem executar estas ações sem vínculo. Entre em contato com o administrador do sistema.';
  }

  /**
   * Valida se pode acessar funcionalidades restritas (IA, análise, etc)
   */
  canAccessRestrictedFeatures(access: UserAccess): boolean {
    return access.isAdmin || access.codVendedor !== null;
  }

  /**
   * Retorna mensagem específica para funcionalidades restritas
   */
  getRestrictedFeatureMessage(featureName: string): string {
    return `⚠️ ACESSO NEGADO À ${featureName.toUpperCase()}: Você não possui vendedor/gerente vinculado ao seu usuário. Esta funcionalidade está disponível apenas para usuários com vendedor vinculado ou administradores. Entre em contato com o administrador do sistema.`;
  }

  /**
   * Retorna a cláusula WHERE para filtrar leads por permissão
   */
  getLeadsWhereClause(userAccess: UserAccess): { clause: string; binds: Record<string, any> } {
    if (userAccess.isAdmin) {
      return { clause: '', binds: {} };
    }

    // Vendedor comum: ver apenas leads criados por ele (CODUSUARIO)
    if (!userAccess.vendedoresEquipe || userAccess.vendedoresEquipe.length === 0) {
      return {
        clause: 'AND l.CODUSUARIO = :userId',
        binds: { userId: userAccess.userId }
      };
    }

    // Gerente: ver leads criados por usuários da equipe (buscar CODUSUARIOs vinculados aos CODVENDs da equipe)
    const allVendedores = [userAccess.codVendedor, ...userAccess.vendedoresEquipe].filter(Boolean);
    return {
      clause: `AND l.CODUSUARIO IN (
        SELECT uv.CODUSUARIO 
        FROM AD_USUARIOSVENDAS uv 
        WHERE uv.CODVEND IN (${allVendedores.join(',')})
          AND uv.ID_EMPRESA = :idEmpresa
      )`,
      binds: { idEmpresa: userAccess.idEmpresa }
    };
  }

  /**
   * Retorna a cláusula WHERE para filtrar parceiros por permissão
   */
  getParceirosWhereClause(access: UserAccess): { clause: string; binds: any } {
    if (access.isAdmin) {
      return { clause: '', binds: {} };
    }

    if (!access.codVendedor) {
      // Sem vendedor vinculado - não deve chegar aqui devido à validação prévia
      return {
        clause: 'AND 1 = 0',
        binds: {}
      };
    }

    if (access.vendedoresEquipe.length > 0) {
      // Gerente: ver parceiros seus e da equipe
      const allVendedores = [access.codVendedor, ...access.vendedoresEquipe];
      return {
        clause: `AND CODVEND IN (${allVendedores.join(',')})`,
        binds: {}
      };
    }

    // Vendedor: ver apenas seus parceiros
    return {
      clause: 'AND CODVEND = :codVendedor',
      binds: { codVendedor: access.codVendedor }
    };
  }

  /**
   * Retorna a cláusula WHERE para filtrar pedidos por permissão
   */
  getPedidosWhereClause(userAccess: UserAccess): { clause: string; binds: Record<string, any> } {
    if (userAccess.isAdmin) {
      return { clause: '', binds: {} };
    }

    if (!userAccess.codVendedor) {
      return { clause: '', binds: {} };
    }

    // Vendedor comum: ver pedidos de parceiros vinculados ao seu CODVEND
    if (!userAccess.vendedoresEquipe || userAccess.vendedoresEquipe.length === 0) {
      return {
        clause: 'AND EXISTS (SELECT 1 FROM AS_PARCEIROS p WHERE p.CODPARC = cab.CODPARC AND p.ID_SISTEMA = cab.ID_SISTEMA AND p.SANKHYA_ATUAL = \'S\' AND p.CODVEND = :codVend)',
        binds: { codVend: userAccess.codVendedor }
      };
    }

    // Gerente: ver pedidos de parceiros vinculados aos vendedores da equipe (incluindo ele mesmo)
    const vendedores = [userAccess.codVendedor, ...userAccess.vendedoresEquipe].filter(Boolean);
    return {
      clause: `AND EXISTS (SELECT 1 FROM AS_PARCEIROS p WHERE p.CODPARC = cab.CODPARC AND p.ID_SISTEMA = cab.ID_SISTEMA AND p.SANKHYA_ATUAL = 'S' AND p.CODVEND IN (${vendedores.join(',')}))`,
      binds: {}
    };
  }

  getFinanceiroWhereClause(userAccess: UserAccess): { clause: string; binds: Record<string, any> } {
    if (userAccess.isAdmin) {
      return { clause: '', binds: {} };
    }

    if (!userAccess.codVendedor) {
      return { clause: '', binds: {} };
    }

    // Vendedor comum: ver títulos de parceiros vinculados ao seu CODVEND
    if (!userAccess.vendedoresEquipe || userAccess.vendedoresEquipe.length === 0) {
      return {
        clause: 'AND EXISTS (SELECT 1 FROM AS_PARCEIROS p WHERE p.CODPARC = F.CODPARC AND p.ID_SISTEMA = F.ID_SISTEMA AND p.SANKHYA_ATUAL = \'S\' AND p.CODVEND = :codVend)',
        binds: { codVend: userAccess.codVendedor }
      };
    }

    // Gerente: ver títulos de parceiros vinculados aos vendedores da equipe (incluindo ele mesmo)
    const vendedores = [userAccess.codVendedor, ...userAccess.vendedoresEquipe].filter(Boolean);
    return {
      clause: `AND EXISTS (SELECT 1 FROM AS_PARCEIROS p WHERE p.CODPARC = F.CODPARC AND p.ID_SISTEMA = F.ID_SISTEMA AND p.SANKHYA_ATUAL = 'S' AND p.CODVEND IN (${vendedores.join(',')}))`,
      binds: {}
    };
  }

  /**
   * Retorna a cláusula WHERE para filtrar atividades por permissão
   */
  getAtividadesWhereClause(userAccess: UserAccess): { clause: string; binds: Record<string, any> } {
    if (userAccess.isAdmin) {
      return { clause: '', binds: {} };
    }

    // Vendedor comum: ver apenas atividades criadas por ele (CODUSUARIO)
    if (!userAccess.vendedoresEquipe || userAccess.vendedoresEquipe.length === 0) {
      return {
        clause: 'AND a.CODUSUARIO = :userId',
        binds: { userId: userAccess.userId }
      };
    }

    // Gerente: ver atividades criadas por usuários da equipe (buscar CODUSUARIOs vinculados aos CODVENDs da equipe)
    const allVendedores = [userAccess.codVendedor, ...userAccess.vendedoresEquipe].filter(Boolean);
    return {
      clause: `AND a.CODUSUARIO IN (
        SELECT uv.CODUSUARIO 
        FROM AD_USUARIOSVENDAS uv 
        WHERE uv.CODVEND IN (${allVendedores.join(',')})
          AND uv.ID_EMPRESA = :idEmpresa
      )`,
      binds: { idEmpresa: userAccess.idEmpresa }
    };
  }

  /**
   * Retorna filtros para a IA (Gemini) baseado nas permissões
   */
  getIADataFilters(access: UserAccess): {
    leads: string;
    parceiros: string;
    pedidos: string;
    financeiro: string;
    atividades: string;
  } {
    const leadsFilter = this.getLeadsWhereClause(access);
    const parceirosFilter = this.getParceirosWhereClause(access);
    const pedidosFilter = this.getPedidosWhereClause(access);
    const financeiroFilter = this.getFinanceiroWhereClause(access);
    const atividadesFilter = this.getAtividadesWhereClause(access);

    return {
      leads: leadsFilter.clause,
      parceiros: parceirosFilter.clause,
      pedidos: pedidosFilter.clause,
      financeiro: financeiroFilter.clause,
      atividades: atividadesFilter.clause
    };
  }
}

export const accessControlService = new AccessControlService();