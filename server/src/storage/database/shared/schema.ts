import { sql } from "drizzle-orm"
import { pgTable, text, varchar, timestamp, integer, index, serial } from "drizzle-orm/pg-core"



export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 用户表
export const users = pgTable(
	"users",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		openid: varchar("openid", { length: 100 }).notNull().unique(),
		nickname: varchar("nickname", { length: 50 }).notNull(),
		avatar_url: varchar("avatar_url", { length: 500 }),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("users_openid_idx").on(table.openid),
	]
);

// 群组表
export const groups = pgTable(
	"groups",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		name: varchar("name", { length: 100 }).notNull(),
		invite_code: varchar("invite_code", { length: 10 }).notNull().unique(),
		creator_id: varchar("creator_id", { length: 36 }).notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("groups_invite_code_idx").on(table.invite_code),
		index("groups_creator_id_idx").on(table.creator_id),
	]
);

// 成员表
export const members = pgTable(
	"members",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		group_id: varchar("group_id", { length: 36 }).notNull().references(() => groups.id, { onDelete: "cascade" }),
		user_id: varchar("user_id", { length: 36 }).notNull(),
		name: varchar("name", { length: 50 }).notNull(),
		total_points: integer("total_points").notNull().default(0),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("members_group_id_idx").on(table.group_id),
		index("members_user_id_idx").on(table.user_id),
	]
);

// 用户创建的房间历史记录表
export const userRooms = pgTable(
	"user_rooms",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		user_id: varchar("user_id", { length: 36 }).notNull(),
		group_id: varchar("group_id", { length: 36 }).notNull(),
		room_name: varchar("room_name", { length: 100 }).notNull(),
		invite_code: varchar("invite_code", { length: 10 }).notNull(),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("user_rooms_user_id_idx").on(table.user_id),
	]
);

// 对局表 - 保存每个房间的当前对局状态
export const gameSessions = pgTable(
	"game_sessions",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		group_id: varchar("group_id", { length: 36 }).notNull().references(() => groups.id, { onDelete: "cascade" }),
		room_name: varchar("room_name", { length: 100 }).notNull(),
		invite_code: varchar("invite_code", { length: 10 }).notNull(),
		// 参与者列表，JSON格式存储：[{member_id, name, score}]
		participants: text("participants").notNull().default('[]'),
		// 对局轮次记录，JSON格式存储：[{from, to, points, reason, timestamp}]
		rounds: text("rounds").notNull().default('[]'),
		// 房主ID
		host_id: varchar("host_id", { length: 36 }).notNull(),
		// 对局状态：playing(进行中), finished(已结束), abandoned(已放弃)
		status: varchar("status", { length: 20 }).notNull().default('playing'),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true }),
	},
	(table) => [
		index("game_sessions_group_id_idx").on(table.group_id),
		index("game_sessions_invite_code_idx").on(table.invite_code),
		index("game_sessions_status_idx").on(table.status),
	]
);

// 对局历史表 - 保存已结束的对局记录
export const gameHistory = pgTable(
	"game_history",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		group_id: varchar("group_id", { length: 36 }).notNull().references(() => groups.id, { onDelete: "cascade" }),
		room_name: varchar("room_name", { length: 100 }).notNull(),
		invite_code: varchar("invite_code", { length: 10 }).notNull(),
		// 参与者列表和最终分数，JSON格式存储
		participants: text("participants").notNull(),
		// 对局轮次记录
		rounds: text("rounds").notNull().default('[]'),
		// 总给分次数
		total_rounds: integer("total_rounds").notNull().default(0),
		// 对局开始时间
		start_time: timestamp("start_time", { withTimezone: true }).defaultNow().notNull(),
		// 对局结束时间
		end_time: timestamp("end_time", { withTimezone: true }),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("game_history_group_id_idx").on(table.group_id),
		index("game_history_invite_code_idx").on(table.invite_code),
		index("game_history_created_at_idx").on(table.created_at),
	]
);
export const pointsRecords = pgTable(
	"points_records",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		group_id: varchar("group_id", { length: 36 }).notNull().references(() => groups.id, { onDelete: "cascade" }),
		from_member_id: varchar("from_member_id", { length: 36 }).notNull().references(() => members.id, { onDelete: "cascade" }),
		to_member_id: varchar("to_member_id", { length: 36 }).notNull().references(() => members.id, { onDelete: "cascade" }),
		points: integer("points").notNull(),
		reason: varchar("reason", { length: 200 }),
		created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("points_records_group_id_idx").on(table.group_id),
		index("points_records_from_member_id_idx").on(table.from_member_id),
		index("points_records_to_member_id_idx").on(table.to_member_id),
		index("points_records_created_at_idx").on(table.created_at),
	]
);
