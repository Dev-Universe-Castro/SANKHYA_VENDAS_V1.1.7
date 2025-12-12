import axios from 'axios';
import { contratosService } from './contratos-service';

class SankhyaDynamicAPI {

  async obterToken(idEmpresa: number): Promise<string> {
    console.log(`🔐 Gerando novo token para empresa ${idEmpresa}`);

    const credentials = await contratosService.getSankhyaCredentials(idEmpresa);
    const loginUrl = `${credentials.baseUrl}/login`;

    try {
      const response = await axios.post(loginUrl, {}, {
        headers: {
          'token': credentials.token,
          'appkey': credentials.appkey,
          'username': credentials.username,
          'password': credentials.password
        },
        timeout: 10000 // 10 segundos de timeout
      });

      const token = response.data.bearerToken || response.data.token;

      if (!token) {
        console.error('❌ Token não retornado pela API Sankhya:', response.data);
        throw new Error('Token não retornado pela API Sankhya');
      }

      console.log(`✅ Novo token gerado para empresa ${idEmpresa}`);
      return token;
    } catch (error: any) {
      console.error('❌ Erro ao gerar token:', error.message);
      if (error.response) {
        console.error('❌ Resposta do servidor:', error.response.data);
        throw new Error(`Erro no login Sankhya: ${error.response.data?.error || error.message}`);
      }
      throw new Error(`Falha na autenticação: ${error.message}`);
    }
  }

  async fazerRequisicao(idEmpresa: number, endpoint: string, method: string, data?: any, tentativa: number = 1) {
    const token = await this.obterToken(idEmpresa)
    const credentials = await contratosService.getSankhyaCredentials(idEmpresa)
    const MAX_TENTATIVAS = 3
    const TIMEOUT_MS = 30000 // 30 segundos

    try {
      // Construir URL corretamente usando baseUrl do contrato
      const url = `${credentials.baseUrl}${endpoint}`
      
      const config = {
        method,
        url,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data,
        timeout: TIMEOUT_MS
      }

      console.log(`🔄 Tentativa ${tentativa}/${MAX_TENTATIVAS} - ${method.toUpperCase()} ${url}`)

      const response = await axios(config)
      return response.data
    } catch (error: any) {
      const errorMsg = error.message || 'Erro desconhecido'
      const errorCode = error.code || 'NO_CODE'

      console.error(`❌ Erro na requisição Sankhya (tentativa ${tentativa}):`, errorMsg, `[${errorCode}]`)

      // Retry em caso de timeout ou connection reset
      if ((errorCode === 'ECONNRESET' || errorCode === 'ETIMEDOUT' || errorMsg.includes('timeout')) && tentativa < MAX_TENTATIVAS) {
        console.log(`⏳ Aguardando 2s antes de tentar novamente...`)
        await new Promise(resolve => setTimeout(resolve, 2000))
        return this.fazerRequisicao(idEmpresa, endpoint, method, data, tentativa + 1)
      }

      throw error
    }
  }
}

export const sankhyaDynamicAPI = new SankhyaDynamicAPI();