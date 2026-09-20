import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import type { Chunk, Distractor, Placement, TestCase } from '@parsons/shared';

export const problems = pgTable('problems', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  difficulty: text('difficulty').notNull(),
  pattern: text('pattern').notNull(),
  topics: text('topics').array().notNull(),
  lists: text('lists').array().notNull(),
  statement: text('statement').notNull(),
  entry: text('entry').notNull(),
  signature: text('signature').notNull(),
  hint: text('hint').notNull(),
  invariant: text('invariant').notNull(),
  maxIndent: integer('max_indent').notNull(),
  chunks: jsonb('chunks').$type<Chunk[]>().notNull(),
  distractors: jsonb('distractors').$type<Distractor[]>().notNull(),
  tests: jsonb('tests').$type<TestCase[]>().notNull(),
});

export const attempts = pgTable('attempts', {
  id: serial('id').primaryKey(),
  problemId: integer('problem_id')
    .notNull()
    .references(() => problems.id, { onDelete: 'cascade' }),
  passed: boolean('passed').notNull(),
  ms: integer('ms').notNull(),
  checksUsed: integer('checks_used').notNull(),
  usedHint: boolean('used_hint').notNull(),
  arrangement: jsonb('arrangement').$type<Placement[]>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const hintUses = pgTable('hint_uses', {
  id: serial('id').primaryKey(),
  problemId: integer('problem_id')
    .notNull()
    .references(() => problems.id, { onDelete: 'cascade' }),
  topics: text('topics').array().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  filters: jsonb('filters').notNull(),
  solved: integer('solved').default(0).notNull(),
  total: integer('total').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type ProblemRow = typeof problems.$inferSelect;
export type NewProblem = typeof problems.$inferInsert;
