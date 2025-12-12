
"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Eye, EyeOff, Copy, Check, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ContratoData {
  EMPRESA: string
  IS_SANDBOX: string
  SANKHYA_TOKEN: string
  SANKHYA_APPKEY: string
  SANKHYA_USERNAME: string
  SANKHYA_PASSWORD: string
  GEMINI_API_KEY: string
  ATIVO: string
}

export default function ConfiguracoesGerais() {
  const [contrato, setContrato] = useState<ContratoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSankhyaPassword, setShowSankhyaPassword] = useState(false)
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const fetchContrato = async () => {
    try {
      setLoading(true)
      
      // Primeiro tenta pegar do localStorage
      let userData = null
      const storedUser = localStorage.getItem('currentUser')
      
      if (storedUser) {
        userData = JSON.parse(storedUser)
      } else {
        // Se não tiver no localStorage, tenta pegar do cookie
        const userCookie = document.cookie
          .split('; ')
          .find(row => row.startsWith('user='))

        if (!userCookie) {
          toast.error("Usuário não autenticado")
          return
        }

        const cookieValue = userCookie.split('=')[1]
        userData = JSON.parse(decodeURIComponent(cookieValue))
      }

      const idEmpresa = userData.ID_EMPRESA || userData.id_empresa

      if (!idEmpresa) {
        toast.error("Empresa não identificada")
        return
      }

      const response = await fetch(`/api/configuracoes/credenciais?idEmpresa=${idEmpresa}`)
      
      if (!response.ok) {
        throw new Error('Erro ao buscar credenciais')
      }

      const data = await response.json()
      setContrato(data.contrato)
    } catch (error) {
      console.error('Erro ao buscar contrato:', error)
      toast.error("Erro ao carregar credenciais da empresa")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContrato()
  }, [])

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldName)
      toast.success(`${fieldName} copiado!`)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      toast.error("Erro ao copiar")
    }
  }

  const maskValue = (value: string, show: boolean) => {
    if (show || !value) return value
    return '•'.repeat(Math.min(value.length, 20))
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configurações Gerais</CardTitle>
          <CardDescription>Credenciais e informações da empresa</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!contrato) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configurações Gerais</CardTitle>
          <CardDescription>Credenciais e informações da empresa</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhuma credencial encontrada para esta empresa
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Informações da Empresa</CardTitle>
              <CardDescription>Dados gerais do contrato</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchContrato}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Input value={contrato.EMPRESA} readOnly />
          </div>

          <div className="space-y-2">
            <Label>Ambiente</Label>
            <div>
              <Badge variant={contrato.IS_SANDBOX === 'S' ? 'secondary' : 'default'}>
                {contrato.IS_SANDBOX === 'S' ? 'Sandbox (Teste)' : 'Produção'}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status do Contrato</Label>
            <div>
              <Badge variant={contrato.ATIVO === 'S' ? 'default' : 'destructive'}>
                {contrato.ATIVO === 'S' ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credenciais Sankhya</CardTitle>
          <CardDescription>Credenciais de acesso à API Sankhya</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Token</Label>
            <div className="flex gap-2">
              <Input 
                value={maskValue(contrato.SANKHYA_TOKEN, showSankhyaPassword)} 
                readOnly 
                type={showSankhyaPassword ? "text" : "password"}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(contrato.SANKHYA_TOKEN, 'Token')}
              >
                {copiedField === 'Token' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>App Key</Label>
            <div className="flex gap-2">
              <Input 
                value={maskValue(contrato.SANKHYA_APPKEY, showSankhyaPassword)} 
                readOnly 
                type={showSankhyaPassword ? "text" : "password"}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(contrato.SANKHYA_APPKEY, 'App Key')}
              >
                {copiedField === 'App Key' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Username</Label>
            <div className="flex gap-2">
              <Input value={contrato.SANKHYA_USERNAME} readOnly />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(contrato.SANKHYA_USERNAME, 'Username')}
              >
                {copiedField === 'Username' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Password</Label>
            <div className="flex gap-2">
              <Input 
                value={maskValue(contrato.SANKHYA_PASSWORD, showSankhyaPassword)} 
                readOnly 
                type={showSankhyaPassword ? "text" : "password"}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowSankhyaPassword(!showSankhyaPassword)}
              >
                {showSankhyaPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(contrato.SANKHYA_PASSWORD, 'Password')}
              >
                {copiedField === 'Password' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credenciais Google Gemini</CardTitle>
          <CardDescription>API Key para inteligência artificial</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API Key</Label>
            <div className="flex gap-2">
              <Input 
                value={maskValue(contrato.GEMINI_API_KEY || 'Não configurado', showGeminiKey)} 
                readOnly 
                type={showGeminiKey ? "text" : "password"}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                disabled={!contrato.GEMINI_API_KEY}
              >
                {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(contrato.GEMINI_API_KEY, 'Gemini API Key')}
                disabled={!contrato.GEMINI_API_KEY}
              >
                {copiedField === 'Gemini API Key' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {!contrato.GEMINI_API_KEY && (
            <p className="text-sm text-muted-foreground">
              ⚠️ Nenhuma chave API configurada. Entre em contato com o suporte para configurar.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
