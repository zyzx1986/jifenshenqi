export interface Group {
  id: string
  name: string
  invite_code: string
  creator_id: string
}

export interface Member {
  id: string
  group_id: string
  user_id: string
  name: string
  total_points: number
  created_at: string
  updated_at: string | null
}

export interface PointsRecord {
  id: string
  group_id: string
  from_member_id: string
  to_member_id: string
  points: number
  reason: string
  created_at: string
  from_member_name?: string
  to_member_name?: string
}
