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
  notified?: boolean;
  notificationMethods?: string[]; // per risk #5
}

interface ApprovalState {
  approvals: ApprovalRequest[];
  pending: ApprovalRequest[];
  isLoading: boolean;
  notifications: { enabled: boolean; methods: string[]; pendingNotified: number };

  setApprovals: (approvals: ApprovalRequest[]) => void;
  addApproval: (approval: ApprovalRequest) => void;
  approve: (id: string) => void;
  reject: (id: string) => void;
  setLoading: (loading: boolean) => void;
  notifyApproval: (id: string) => void; // per risk #5
}

export const useApprovalStore = create<ApprovalState>((set, get) => ({
  approvals: [],
  pending: [],
  isLoading: false,
  notifications: { enabled: true, methods: ['SSE (real-time)', 'in-memory queue', 'email placeholder', 'push placeholder'], pendingNotified: 0 },

  setApprovals: (approvals) => set({ 
    approvals,
    pending: approvals.filter(a => a.status === 'pending'),
    notifications: { ...get().notifications, pendingNotified: approvals.filter(a => a.notified).length }
  }),

  addApproval: (approval) => set((state) => {
    const approvals = [approval, ...state.approvals];
    // Simulate notification per risk #5
    console.log(`[approval-store] New approval ${approval.id}: ${approval.action} - notifying via SSE`);
    if (!approval.notified) {
      approval.notified = true;
      approval.notificationMethods = ['SSE'];
      // In production: would trigger email/push/Slack
      // For now: SSE already notifies UI in real-time
    }
    return {
      approvals,
      pending: approvals.filter(a => a.status === 'pending'),
      notifications: { ...state.notifications, pendingNotified: approvals.filter(a => a.notified).length }
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

  notifyApproval: (id) => {
    const approval = get().approvals.find(a => a.id === id);
    if (approval) {
      console.log(`[approval-store] Notify ${id} via`, get().notifications.methods);
      // Simulate notification
      fetch('/api/v1/approvals/notify', { method: 'POST', body: JSON.stringify({ approvalId: id }), headers: { 'Content-Type': 'application/json' } }).catch(() => {});
    }
  },

  setLoading: (isLoading) => set({ isLoading })
}));
