
import { NextResponse } from 'next/server';
import { criarPedidoVenda } from '@/lib/pedidos-service';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    // Obter usuário do cookie
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('user');
    
    console.log('🍪 Cookie presente:', !!userCookie);
    
    if (!userCookie) {
      console.error('❌ Cookie de usuário não encontrado');
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const user = JSON.parse(decodeURIComponent(userCookie.value));
    
    console.log('👤 Usuário completo do cookie:', user);
    console.log('🔍 ID_EMPRESA:', user.ID_EMPRESA);
    
    if (!user) {
      console.error('❌ Usuário não encontrado no cookie');
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Obter ID_EMPRESA do usuário
    const idEmpresa = user.ID_EMPRESA;
    
    console.log('🏢 ID Empresa:', idEmpresa);
    
    if (!idEmpresa) {
      console.error('❌ Usuário sem empresa vinculada');
      return NextResponse.json({ 
        error: 'Usuário não possui empresa vinculada',
        success: false 
      }, { status: 400 });
    }

    // Validar se o usuário pode criar pedidos
    const { accessControlService } = await import('@/lib/access-control-service');
    
    try {
      const userAccess = await accessControlService.validateUserAccess(user.id, idEmpresa);
      
      if (!accessControlService.canCreateOrEdit(userAccess)) {
        const errorMsg = accessControlService.getAccessDeniedMessage(userAccess);
        return NextResponse.json({ error: errorMsg, success: false }, { status: 403 });
      }
    } catch (accessError: any) {
      return NextResponse.json({ error: accessError.message, success: false }, { status: 403 });
    }

    const body = await request.json();
    
    console.log('📦 Body recebido:', JSON.stringify(body, null, 2));
    console.log(`🔄 API Route - Criando pedido para empresa ${idEmpresa}:`, body);
    
    const resultado = await criarPedidoVenda({
      ...body,
      idEmpresa
    });
    
    console.log("✅ API Route - Pedido criado com sucesso");
    
    return NextResponse.json(resultado);
  } catch (error: any) {
    console.error('❌ API Route - Erro ao criar pedido:', {
      message: error.message,
      response: error.response?.data
    });
    
    const errorResponse = error.response?.data;
    const errorMessage = errorResponse?.error?.details || 
                        errorResponse?.error?.message || 
                        errorResponse?.statusMessage ||
                        error.message || 
                        'Erro ao criar pedido';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorResponse,
        success: false
      },
      { status: errorResponse?.statusCode || 500 }
    );
  }
}
