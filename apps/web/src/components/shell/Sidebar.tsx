'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  MessageSquare, 
  FolderKanban, 
  Target, 
  Brain, 
  Plug, 
  Wrench, 
  Package, 
  ShieldCheck, 
  Code2, 
  Settings, 
  FileText,
  Search,
  Plus,
  Shield,
  Activity
} from 'lucide-react';
import { useUIStore } from '@/store/ui.store';
import { useRuntimeStore } from '@/store/runtime.store';
import { useApprovalStore } from '@/store/approval.store';

const navItems = [
  { href: '/', label: 'الرئيسية', labelEn: 'Home', icon: Activity, section: 'main' },
  { href: '/chat', label: 'المحادثات', labelEn: 'Chats', icon: MessageSquare, section: 'main' },
  { href: '/missions', label: 'المهمات', labelEn: 'Missions', icon: Target, section: 'work' },
  { href: '/projects', label: 'المشاريع', labelEn: 'Projects', icon: FolderKanban, section: 'work' },
  { href: '/skills', label: 'المهارات', labelEn: 'Skills', icon: Brain, section: 'knowledge' },
  { href: '/memory', label: 'الذاكرة', labelEn: 'Memory', icon: Package, section: 'knowledge' },
  { href: '/tools', label: 'الأدوات', labelEn: 'Tools', icon: Wrench, section: 'knowledge' },
  { href: '/connectors', label: 'الموصلات', labelEn: 'Connectors', icon: Plug, section: 'knowledge' },
  { href: '/artifacts', label: 'المخرجات', labelEn: 'Artifacts', icon: FileText, section: 'knowledge' },
  { href: '/approvals', label: 'الموافقات', labelEn: 'Approvals', icon: ShieldCheck, section: 'governance' },
  { href: '/trust', label: 'الثقة', labelEn: 'Trust', icon: Shield, section: 'governance' },
  { href: '/developer', label: 'المطور', labelEn: 'Developer', icon: Code2, section: 'governance' },
  { href: '/settings', label: 'الإعدادات', labelEn: 'Settings', icon: Settings, section: 'system' }
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, language } = useUIStore();
  const { governance } = useRuntimeStore();
  const { pending } = useApprovalStore();

  const grouped = {
    main: navItems.filter(i => i.section === 'main'),
    work: navItems.filter(i => i.section === 'work'),
    knowledge: navItems.filter(i => i.section === 'knowledge'),
    governance: navItems.filter(i => i.section === 'governance'),
    system: navItems.filter(i => i.section === 'system')
  };

  return (
    <aside className={`${sidebarCollapsed ? 'w-[60px]' : 'w-[260px]'} border-r border-zinc-800 bg-zinc-950 flex flex-col h-screen sticky top-0 transition-all duration-200`}>
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 flex items-center px-3 gap-2">
        <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold text-sm">C</div>
        {!sidebarCollapsed && (
          <div className="flex flex-col">
            <span className="font-semibold text-sm">CeliaOS / Nawah</span>
            <span className="text-[10px] text-zinc-500">Agent OS • 12pro</span>
          </div>
        )}
      </div>

      {/* New Chat */}
      <div className="p-2">
        <Link href="/chat" className="flex items-center gap-2 w-full bg-zinc-100 text-zinc-900 hover:bg-white rounded-lg px-3 py-2 text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />
          {!sidebarCollapsed && <span>{language === 'ar' ? '+ محادثة جديدة' : '+ New Chat'}</span>}
        </Link>
      </div>

      {/* Search */}
      {!sidebarCollapsed && (
        <div className="px-2 pb-2">
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-500">
            <Search className="w-4 h-4" />
            <span className="text-xs">{language === 'ar' ? 'بحث ⌘K' : 'Search ⌘K'}</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {Object.entries(grouped).map(([section, items]) => (
          <div key={section}>
            {!sidebarCollapsed && (
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 px-2 mb-1 font-semibold">
                {section === 'main' ? (language === 'ar' ? 'الرئيسي' : 'Main') :
                 section === 'work' ? (language === 'ar' ? 'العمل' : 'Work') :
                 section === 'knowledge' ? (language === 'ar' ? 'المعرفة' : 'Knowledge') :
                 section === 'governance' ? (language === 'ar' ? 'الحوكمة' : 'Governance') :
                 (language === 'ar' ? 'النظام' : 'System')}
              </div>
            )}
            <div className="space-y-0.5">
              {items.map(item => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                      isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {!sidebarCollapsed && (
                      <span className="flex-1 truncate">{language === 'ar' ? item.label : item.labelEn}</span>
                    )}
                    {!sidebarCollapsed && item.href === '/approvals' && pending.length > 0 && (
                      <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pending.length}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer - Runtime Status */}
      <div className="border-t border-zinc-800 p-2 space-y-2">
        {!sidebarCollapsed && (
          <>
            <div className="bg-zinc-900 rounded-lg p-2.5 border border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-zinc-300">{language === 'ar' ? 'حالة النظام' : 'System Status'}</span>
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between"><span className="text-zinc-500">Runtime</span><span className="text-green-400">HEALTHY</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Governance</span><span className="text-green-400">{governance.status}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Spend</span><span className="text-zinc-300">$0.00 / $0.00</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Cost Guard</span><span className="text-green-400">ENABLED</span></div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-500 px-1">
              <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center">👤</div>
              <span className="truncate">Local-First • $0</span>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
