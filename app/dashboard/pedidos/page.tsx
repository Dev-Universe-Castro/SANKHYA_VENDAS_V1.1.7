
"use client"

import DashboardLayout from "@/components/dashboard-layout"
import PedidosTable from "@/components/pedidos-table"
import PedidosFDVTable from "@/components/pedidos-fdv-table"
import PedidosSyncMonitor from "@/components/pedidos-sync-monitor"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function PedidosPage() {
  return (
    <DashboardLayout hideFloatingMenu={true}>
      <div className="space-y-4">
        <Tabs defaultValue="fdv" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto p-1">
            <TabsTrigger value="fdv" className="text-xs sm:text-sm py-2 px-2 sm:px-4">
              <span className="hidden sm:inline">Pedidos FDV</span>
              <span className="sm:hidden">FDV</span>
            </TabsTrigger>
            <TabsTrigger value="sankhya" className="text-xs sm:text-sm py-2 px-2 sm:px-4">
              <span className="hidden sm:inline">Pedidos Sankhya</span>
              <span className="sm:hidden">Sankhya</span>
            </TabsTrigger>
            <TabsTrigger value="sincronizador" className="text-xs sm:text-sm py-2 px-2 sm:px-4">
              <span className="hidden sm:inline">Sincronizador</span>
              <span className="sm:hidden">Sync</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="fdv">
            <PedidosFDVTable />
          </TabsContent>
          
          <TabsContent value="sankhya">
            <PedidosTable />
          </TabsContent>
          
          <TabsContent value="sincronizador">
            <PedidosSyncMonitor />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
