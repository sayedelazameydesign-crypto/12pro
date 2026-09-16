import { create } from 'zustand';

interface MemoryRecord {
  id: string;
  type: string;
  content: string;
  timestamp: string;
  confidence: number;
  tags: string[];
  relevance?: number;
}

interface MemoryState {
  records: MemoryRecord[];
  counts: Record<string, number>;
  searchQuery: string;
  selectedType: string | null;
  isLoading: boolean;
  total: number;

  setRecords: (records: MemoryRecord[]) => void;
  setCounts: (counts: Record<string, number>) => void;
  setSearchQuery: (query: string) => void;
  setSelectedType: (type: string | null) => void;
  setLoading: (loading: boolean) => void;
  addRecord: (record: MemoryRecord) => void;
}

export const useMemoryStore = create<MemoryState>((set) => ({
  records: [],
  counts: { working: 12, episodic: 431, semantic: 8924, procedural: 137, meta: 42, tool: 89, skill: 34, failure: 56 },
  searchQuery: '',
  selectedType: null,
  isLoading: false,
  total: 0,

  setRecords: (records) => set({ records, total: records.length }),
  setCounts: (counts) => set({ counts }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedType: (selectedType) => set({ selectedType }),
  setLoading: (isLoading) => set({ isLoading }),
  addRecord: (record) => set((state) => ({ records: [record, ...state.records] }))
}));
