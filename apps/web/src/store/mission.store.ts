/**
 * Mission Store - Tracks missions, plan, steps, tool activity
 */

import { create } from 'zustand';
import type { Mission } from '@/lib/api/client';

interface MissionState {
  missions: Mission[];
  currentMissionId: string | null;
  currentMission: Mission | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setMissions: (missions: Mission[]) => void;
  setCurrentMission: (mission: Mission | null) => void;
  setCurrentMissionId: (id: string | null) => void;
  addMission: (mission: Mission) => void;
  updateMission: (id: string, data: Partial<Mission>) => void;
  updateMissionStep: (missionId: string, stepId: string, data: any) => void;
  addToolCall: (missionId: string, toolCall: any) => void;
  
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useMissionStore = create<MissionState>((set, get) => ({
  missions: [],
  currentMissionId: null,
  currentMission: null,
  isLoading: false,
  error: null,

  setMissions: (missions) => set({ missions }),
  
  setCurrentMission: (mission) => set({ 
    currentMission: mission,
    currentMissionId: mission?.id || null
  }),
  
  setCurrentMissionId: (id) => {
    const mission = get().missions.find(m => m.id === id) || null;
    set({ currentMissionId: id, currentMission: mission });
  },
  
  addMission: (mission) => set((state) => ({
    missions: [mission, ...state.missions]
  })),
  
  updateMission: (id, data) => set((state) => {
    const updatedMissions = state.missions.map(m => m.id === id ? { ...m, ...data } : m);
    const currentMission = state.currentMission?.id === id ? { ...state.currentMission, ...data } as Mission : state.currentMission;
    return { missions: updatedMissions, currentMission };
  }),

  updateMissionStep: (missionId, stepId, data) => set((state) => {
    const updateSteps = (mission: Mission) => ({
      ...mission,
      steps: mission.steps.map(s => s.id === stepId ? { ...s, ...data } : s)
    });

    const missions = state.missions.map(m => m.id === missionId ? updateSteps(m) : m);
    const currentMission = state.currentMission?.id === missionId ? updateSteps(state.currentMission) : state.currentMission;
    
    return { missions, currentMission };
  }),

  addToolCall: (missionId, toolCall) => set((state) => {
    const addCall = (mission: Mission) => ({
      ...mission,
      toolCalls: [...mission.toolCalls, toolCall]
    });

    const missions = state.missions.map(m => m.id === missionId ? addCall(m) : m);
    const currentMission = state.currentMission?.id === missionId ? addCall(state.currentMission) : state.currentMission;
    
    return { missions, currentMission };
  }),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error })
}));
