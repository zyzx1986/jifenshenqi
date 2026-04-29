import { create } from 'zustand'

interface Member {
  id: string
  name: string
  total_points: number
  group_id: string
  user_id: string
}

interface Group {
  id: string
  name: string
  invite_code: string
  creator_id: string
}

interface PointsRecord {
  id: string
  group_id: string
  from_member_id: string
  to_member_id: string
  from_member_name?: string
  to_member_name?: string
  points: number
  reason: string
  created_at: string
}

interface GroupState {
  currentGroup: Group | null
  currentMember: Member | null
  members: Member[]
  setCurrentGroup: (group: Group | null) => void
  setCurrentMember: (member: Member | null) => void
  setMembers: (members: Member[]) => void
  addMember: (member: Member) => void
  updateMember: (memberId: string, points: number) => void
  clear: () => void
}

export const useGroupStore = create<GroupState>((set) => ({
  currentGroup: null,
  currentMember: null,
  members: [],
  setCurrentGroup: (group) => set({ currentGroup: group }),
  setCurrentMember: (member) => set({ currentMember: member }),
  setMembers: (members) => set({ members }),
  addMember: (member) => set((state) => ({ members: [...state.members, member] })),
  updateMember: (memberId, points) =>
    set((state) => ({
      members: state.members.map((m) =>
        m.id === memberId ? { ...m, total_points: m.total_points + points } : m
      ),
    })),
  clear: () => set({ currentGroup: null, currentMember: null, members: [] }),
}))

export type { Group, Member, PointsRecord }
