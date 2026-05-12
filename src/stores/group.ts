import Taro from '@tarojs/taro'
import { useSyncExternalStore } from 'react'
import { createStore } from 'zustand/vanilla'

interface Member {
  id: string
  name: string
  avatar_url?: string
  total_points: number
  total_given: number
  total_received: number
  received_count: number
  group_id: string
  user_id: string
  isHost?: boolean
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
  is_revoked?: boolean
}

interface Participant {
  member_id: string
  name: string
  score: number
}

interface Round {
  record_id?: string
  from: string
  from_id: string
  to: string
  to_id: string
  points: number
  reason: string
  timestamp: number
}

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
  currentGame: GameSession | null
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

function persistCurrentGame(game: GameSession | null) {
  if (game) {
    Taro.setStorageSync('currentGame', game)
    return
  }

  Taro.removeStorageSync('currentGame')
}

const groupStore = createStore<GroupState>()((set) => {
  const savedGroup = Taro.getStorageSync('currentGroup') || null
  const savedMember = Taro.getStorageSync('currentMember') || null
  const savedGame = Taro.getStorageSync('currentGame') || null

  return {
    currentGroup: savedGroup,
    currentMember: savedMember,
    members: [],
    currentGame: savedGame,
    setCurrentGroup: (group) => {
      set({ currentGroup: group })
      if (group) {
        Taro.setStorageSync('currentGroup', group)
      } else {
        Taro.removeStorageSync('currentGroup')
      }
    },
    setCurrentMember: (member) => {
      set({ currentMember: member })
      if (member) {
        Taro.setStorageSync('currentMember', member)
      } else {
        Taro.removeStorageSync('currentMember')
      }
    },
    setMembers: (members) => set({ members }),
    addMember: (member) => set((state) => ({ members: [...state.members, member] })),
    updateMember: (memberId, points) =>
      set((state) => ({
        members: state.members.map((member) =>
          member.id === memberId
            ? { ...member, total_points: member.total_points + points }
            : member
        ),
      })),
    setCurrentGame: (game) => {
      persistCurrentGame(game)
      set({ currentGame: game })
    },
    updateGameParticipant: (memberId, score) =>
      set((state) => {
        if (!state.currentGame) {
          return state
        }

        const nextGame = {
          ...state.currentGame,
          participants: state.currentGame.participants.map((participant) =>
            participant.member_id === memberId
              ? { ...participant, score: (participant.score || 0) + score }
              : participant
          ),
        }

        persistCurrentGame(nextGame)
        return { currentGame: nextGame }
      }),
    addGameRound: (round) =>
      set((state) => {
        if (!state.currentGame) {
          return state
        }

        const nextGame = {
          ...state.currentGame,
          rounds: [...state.currentGame.rounds, round],
        }

        persistCurrentGame(nextGame)
        return { currentGame: nextGame }
      }),
    clearGame: () => {
      persistCurrentGame(null)
      set({ currentGame: null })
    },
    clear: () => {
      Taro.removeStorageSync('currentGroup')
      Taro.removeStorageSync('currentMember')
      Taro.removeStorageSync('members')
      Taro.removeStorageSync('currentGame')
      set({ currentGroup: null, currentMember: null, members: [], currentGame: null })
    },
  }
})

function getGroupSnapshot() {
  return groupStore.getState()
}

function useGroupStore(): GroupState
function useGroupStore<T>(selector: (state: GroupState) => T): T
function useGroupStore<T>(selector?: (state: GroupState) => T) {
  return useSyncExternalStore(
    groupStore.subscribe,
    () => {
      const state = getGroupSnapshot()
      return selector ? selector(state) : state
    },
    () => {
      const state = getGroupSnapshot()
      return selector ? selector(state) : state
    }
  )
}

export type { GameSession, Group, Member, Participant, PointsRecord, Round }
export { groupStore, useGroupStore }
