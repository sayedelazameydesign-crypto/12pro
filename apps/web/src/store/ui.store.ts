import { create } from 'zustand';

interface UIState {
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  theme: 'dark' | 'light';
  language: 'ar' | 'en';
  agentMode: 'user' | 'observer' | 'developer' | 'autonomous';
  showMissionCockpit: boolean;
  showToolActivity: boolean;
  showMemoryPanel: boolean;

  toggleSidebar: () => void;
  setCommandPalette: (open: boolean) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setLanguage: (lang: 'ar' | 'en') => void;
  setAgentMode: (mode: UIState['agentMode']) => void;
  toggleMissionCockpit: () => void;
  toggleToolActivity: () => void;
  toggleMemoryPanel: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  theme: 'dark',
  language: 'ar',
  agentMode: 'developer',
  showMissionCockpit: true,
  showToolActivity: true,
  showMemoryPanel: false,

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setCommandPalette: (open) => set({ commandPaletteOpen: open }),
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
  setAgentMode: (agentMode) => set({ agentMode }),
  toggleMissionCockpit: () => set((s) => ({ showMissionCockpit: !s.showMissionCockpit })),
  toggleToolActivity: () => set((s) => ({ showToolActivity: !s.showToolActivity })),
  toggleMemoryPanel: () => set((s) => ({ showMemoryPanel: !s.showMemoryPanel }))
}));
