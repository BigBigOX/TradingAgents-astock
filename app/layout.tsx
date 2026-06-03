import './globals.css'
import type { Metadata } from 'next'
import { Sidebar } from '../components/Sidebar'

export const metadata: Metadata = {
  title: 'TradingAgents-Astock A股分析',
  description: 'A股多Agent投研分析系统',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-[#0a0a0a] text-[#f5f1eb] flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-80 p-6">
          {children}
        </main>
      </body>
    </html>
  )
}