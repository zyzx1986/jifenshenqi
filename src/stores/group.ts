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

// 对局参与者
interface Participant {
  member_id: string
  name: string
  score: number
}

// 对局记录
interface Round {
  from: string
  from_id: string
  to: string
  to_id: string
  points: number
  reason: string
  timestamp: number
}

// 当前对局状态
interface GameSession {
  id: string
  group_id: string
  room_name: string
  invite_code: string
  participants: Participant[]
  rounds: Round[]
  host_id: string
  status: 'playing' | 'finished' | 'abandoned'
}

interface GroupState {
  currentGroup: Group | null
  currentMember: Member | null
  members: Member[]
  currentGame: GameSession | null  // 当前对局状态
  setCurrentGroup: (group: Group | null) => void
  setCurrentMember: (member: Member | null) => void
  setMembers: (members: Member[]) => void
  addMember: (member: Member) => void
  updateMember: (memberId: string, points: number) => void
  setCurrentGame: (game: GameSession | null) => void
  updateGameParticipant: (memberId: string, score: number) => void
  addGameRound: (round: Round) => void
  clearGame: () => void
  clear: () => void
}

export const useGroupStore = create<GroupState>((set) => ({
  currentGroup: null,
  currentMember: null,
  members: [],
  currentGame: null,
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
  setCurrentGame: (game) => set({ currentGame: game }),
  updateGameParticipant: (memberId, score) =>
    set((state) => {
      if (!state.currentGame) return state
      const participants = state.currentGame.participants.map((p) =>
        p.member_id === memberId ? { ...p, score: (p.score || 0) + score } : p
      )
      return { currentGame: { ...state.currentGame, participants } }
    }),
  addGameRound: (round) =>
    set((state) => {
      if (!state.currentGame) return state
      return {
        currentGame: {
          ...state.currentGame,
          rounds: [...state.currentGame.rounds, round]
        }
      }
    }),
  clearGame: () => set({ currentGame: null }),
  clear: () => set({ currentGroup: null, currentMember: null, members: [], currentGame: null }),
}))

export type { Group, Member, PointsRecord, GameSession, Participant, Round }
