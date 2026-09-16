import { create } from 'zustand';

export interface ApprovalRequest {
  id: string;
  missionId: string;
  action: string;
  resource: string;
  risk: 'SAFE' | 'READ' | 'WRITE' | 'EXECUTE' | 'EXTERNAL' | 'SECRET';
  policy: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  decidedAt?: string;
  metadata?: any;
}

interface ApprovalState {
  approvals: ApprovalRequest[];
  pending: ApprovalRequest[];
  isLoading: boolean;

  setApprovals: (approvals: ApprovalRequest[]) => void;
  addApproval: (approval: ApprovalRequest) => void;
  approve: (id: string) => void;
  reject: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useApprovalStore = create<ApprovalState>((set) => ({
  approvals: [],
  pending: [],
  isLoading: false,

  setApprovals: (approvals) => set({ 
    approvals,
    pending: approvals.filter(a => a.status === 'pending')
  }),

  addApproval: (approval) => set((state) => {
    const approvals = [approval, ...state.approvals];
    return {
      approvals,
      pending: approvals.filter(a => a.status === 'pending')
    };
  }),

  approve: (id) => set((state) => {
    const approvals = state.approvals.map(a => a.id === id ? { ...a, status: 'approved' as const, decidedAt: new Date().toISOString() } : a);
    return {
      approvals,
      pending: approvals.filter(a => a.status === 'pending')
    };
  }),

  reject: (id) => set((state) => {
    const approvals = state.approvals.map(a => a.id === id ? { ...a, status: 'rejected' as const, decidedAt: new Date().toISOString() } : a);
    return {
      approvals,
      pending: approvals.filter(a => a.status === 'pending')
    };
  }),

  setLoading: (isLoading) => set({ isLoading })
}));
