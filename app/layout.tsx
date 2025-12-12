import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { ThemeProvider } from "@/components/theme-provider"

import Script from 'next/script'

import { Toaster } from "@/components/ui/sonner"
import { Analytics } from '@vercel/analytics/next'
import LoadingTransition from "@/components/loading-transition"
import OfflineDetector from "@/components/offline-detector"
import { ThemeColorManager } from "@/components/theme-color-manager"
import "./suppress-dev-logs"

export const metadata: Metadata = {
  title: 'Sankhya - Força de Vendas',
  description: 'Sankhya - Força de Vendas',
  generator: 'Sankhya - Força de Vendas',
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/1.png" type="image/png" />
        <link rel="apple-touch-icon" href="/1.png" />
        <link rel="manifest" href="/manifest.json" />
        
        {/* PWA Meta Tags */}
        <meta name="theme-color" content="#FFFFFF" id="theme-color-meta" />
        <meta name="theme-color" content="oklch(0.32 0.02 235)" media="(prefers-color-scheme: dark)" />
        <meta name="mobile-web-app-capable" content="yes" />
        
        {/* iOS Specific Meta Tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Sankhya" />
        
        {/* Application Name */}
        <meta name="application-name" content="Sankhya" />
        
        {/* Disable auto phone number detection */}
        <meta name="format-detection" content="telephone=no" />
        
        {/* Viewport optimizations for PWA */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        
        {/* Preconnect and DNS Prefetch */}
        <link rel="preconnect" href="https://api.sandbox.sankhya.com.br" />
        <link rel="dns-prefetch" href="https://api.sandbox.sankhya.com.br" />
        
        {/* Preload critical resources */}
        <link rel="preload" href="/anigif.gif" as="image" />
        <link rel="preload" href="/sankhya-logo-horizontal.png" as="image" />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <ThemeColorManager />
          <LoadingTransition />
          <OfflineDetector />
          {children}
          <Toaster />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}