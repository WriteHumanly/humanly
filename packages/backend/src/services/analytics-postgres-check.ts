import assert from 'node:assert/strict';
import { pool } from '../config/database';
import { TaskModel } from '../models/task.model';
import { AnalyticsService } from './analytics.service';

const taskId = '00000000-0000-4000-8000-000000000101';
const userId = '00000000-0000-4000-8000-000000000102';
const documentId = '00000000-0000-4000-8000-000000000103';
const sessionId = '00000000-0000-4000-8000-000000000104';

async function main(): Promise<void> {
  await pool.query(`
    CREATE TABLE sessions (
      id uuid PRIMARY KEY,
      task_id uuid NOT NULL,
      external_user_id text NOT NULL
    );
    CREATE TABLE events (
      session_id uuid NOT NULL,
      task_id uuid NOT NULL,
      event_type text NOT NULL,
      "timestamp" timestamp without time zone NOT NULL
    );
    CREATE TABLE users (
      id uuid PRIMARY KEY,
      email text NOT NULL
    );
    CREATE TABLE task_enrollments (
      task_id uuid NOT NULL,
      submission_document_id uuid
    );
    CREATE TABLE document_events (
      document_id uuid NOT NULL,
      user_id uuid NOT NULL,
      event_type text NOT NULL,
      "timestamp" timestamp without time zone NOT NULL
    );

    INSERT INTO users (id, email)
    VALUES ('${userId}', 'analytics-postgres@writehumanly.test');
    INSERT INTO sessions (id, task_id, external_user_id)
    VALUES ('${sessionId}', '${taskId}', 'analytics-postgres@writehumanly.test');
    INSERT INTO task_enrollments (task_id, submission_document_id)
    VALUES ('${taskId}', '${documentId}');

    INSERT INTO events (session_id, task_id, event_type, "timestamp") VALUES
      ('${sessionId}', '${taskId}', 'input', TIMESTAMP '2020-12-27 23:30:00'),
      ('${sessionId}', '${taskId}', 'keydown', TIMESTAMP '2020-12-28 00:15:00'),
      ('${sessionId}', '${taskId}', 'input', TIMESTAMP '2020-12-31 23:55:00'),
      ('${sessionId}', '${taskId}', 'keydown', TIMESTAMP '2021-01-01 00:05:00');
    INSERT INTO document_events (document_id, user_id, event_type, "timestamp") VALUES
      ('${documentId}', '${userId}', 'input', TIMESTAMP '2021-01-04 00:01:00'),
      ('${documentId}', '${userId}', 'keydown', TIMESTAMP '2021-01-04 00:15:00'),
      ('${documentId}', '${userId}', 'input', TIMESTAMP '2021-01-04 00:45:00');
  `);

  const originalVerifyOwnership = TaskModel.verifyOwnership;
  TaskModel.verifyOwnership = async () => true;
  try {
    assert.deepEqual(
      await AnalyticsService.getEventsTimeline(taskId, userId, 'hour'),
      [
        { date: '2020-12-27 23:00:00', eventCount: 1 },
        { date: '2020-12-28 00:00:00', eventCount: 1 },
        { date: '2020-12-31 23:00:00', eventCount: 1 },
        { date: '2021-01-01 00:00:00', eventCount: 1 },
        { date: '2021-01-04 00:00:00', eventCount: 3 },
      ],
    );
    assert.deepEqual(
      await AnalyticsService.getEventsTimeline(taskId, userId, 'day'),
      [
        { date: '2020-12-27', eventCount: 1 },
        { date: '2020-12-28', eventCount: 1 },
        { date: '2020-12-31', eventCount: 1 },
        { date: '2021-01-01', eventCount: 1 },
        { date: '2021-01-04', eventCount: 3 },
      ],
    );
    assert.deepEqual(
      await AnalyticsService.getEventsTimeline(taskId, userId, 'week'),
      [
        { date: '2020-52', eventCount: 1 },
        { date: '2020-53', eventCount: 3 },
        { date: '2021-01', eventCount: 3 },
      ],
    );
    assert.deepEqual(
      await AnalyticsService.getEventsTimeline(
        '00000000-0000-4000-8000-000000000999',
        userId,
        'week',
      ),
      [],
    );
  } finally {
    TaskModel.verifyOwnership = originalVerifyOwnership;
  }
}

main()
  .finally(() => pool.end())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
