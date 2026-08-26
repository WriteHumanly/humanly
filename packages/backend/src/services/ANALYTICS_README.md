# Analytics Service Quick Reference

## File Structure

```
src/
├── services/
│   └── analytics.service.ts      # Core analytics business logic
├── controllers/
│   └── analytics.controller.ts   # Request handlers and validation
└── routes/
    └── analytics.routes.ts       # Route definitions and middleware
```

## Service Methods

### AnalyticsService

All methods verify task ownership and cache results in Redis (5-minute TTL).

#### `getSummaryStats(taskId, userId, filters)`
Returns comprehensive task statistics:
- Total events, sessions, unique users
- Average events per session and session duration
- Completion rate percentage

**Optimizations:**
- Uses CTEs for efficient aggregation
- Leverages session and event indexes
- Caches results with filter-specific keys

#### `getEventsTimeline(taskId, userId, groupBy, filters)`
Returns time-series event data with configurable grouping:
- `groupBy`: 'hour' | 'day' | 'week'
- Returns array of {date, eventCount}

**Optimizations:**
- Uses PostgreSQL `date_bin()` with a fixed UTC origin
- Indexed timestamp queries

#### `getEventTypeDistribution(taskId, userId, filters)`
Returns event type breakdown with counts and percentages:
- Ordered by count descending
- Includes percentage calculations
- Total event count

**Optimizations:**
- Single query with CTE for totals
- Efficient event_type index usage

#### `getUserActivity(taskId, userId, page, limit, filters)`
Returns paginated user activity list:
- Session and event counts per user
- Last activity timestamp
- Pagination metadata

**Optimizations:**
- Efficient pagination with OFFSET/LIMIT
- Sorted by last activity
- Separate count query for total pages

#### `getSessionDetails(sessionId, userId)`
Returns detailed session with all events:
- Session metadata (start, end, duration, submission)
- Full event list ordered by timestamp
- Ownership verification

**Optimizations:**
- Shorter cache TTL (1 minute)
- Indexed session_id lookup
- Efficient event ordering

## Filter Options

All methods (except session details) support:

```typescript
interface AnalyticsFilters {
  startDate?: Date;      // ISO 8601 datetime
  endDate?: Date;        // ISO 8601 datetime
  externalUserId?: string;
  eventType?: string;
}
```

## Cache Strategy

**Cache Key Format:**
```typescript
`analytics:${taskId}:${type}:${JSON.stringify(filters)}`
```

**TTL:**
- Summary, timeline, event types, users: 300 seconds (5 minutes)
- Session details: 60 seconds (1 minute)

**Cache Operations:**
- Automatic cache check before database query
- Results cached on miss
- Cache hits/misses logged for monitoring

## Controller Endpoints

### Summary Statistics
**GET** `/api/v1/tasks/:taskId/analytics/summary`

Query params: `startDate`, `endDate`, `externalUserId`, `eventType`

### Events Timeline
**GET** `/api/v1/tasks/:taskId/analytics/events-timeline`

Query params: `groupBy`, `startDate`, `endDate`, `externalUserId`, `eventType`

### Event Type Distribution
**GET** `/api/v1/tasks/:taskId/analytics/event-types`

Query params: `startDate`, `endDate`, `externalUserId`

### User Activity
**GET** `/api/v1/tasks/:taskId/analytics/users`

Query params: `page`, `limit`, `startDate`, `endDate`

### Session Details
**GET** `/api/v1/tasks/:taskId/analytics/sessions/:sessionId`

No query params

## Validation

All endpoints use Zod schemas for validation:

- **Dates**: ISO 8601 datetime strings, automatically parsed to Date objects
- **Pagination**: Numbers with defaults (page: 1, limit: 20, max: 100)
- **GroupBy**: Enum validation ('hour' | 'day' | 'week')
- **UUIDs**: Regex validation for session IDs

## Security

1. **Authentication**: All routes protected with `authenticate` middleware
2. **Authorization**: Task ownership verified in every service method
3. **Input Validation**: Zod schemas validate all inputs
4. **SQL Injection**: Parameterized queries throughout

## Error Handling

All controller methods use `asyncHandler` wrapper:
- Zod validation errors → 400 Bad Request
- AppError instances → Appropriate status code
- Unexpected errors → 500 Internal Server Error

## Performance Tips

1. **Use Date Ranges**: Always provide startDate/endDate filters when possible
2. **Leverage Continuous Aggregates**: Use hourly grouping for historical data
3. **Monitor Cache**: Check logs for cache hit rates
4. **Pagination**: Keep limit reasonable (20-50 items)
5. **Index Coverage**: Ensure indexes on timestamp, task_id, session_id

## Database Dependencies

**Required TimescaleDB Features:**
- `events` hypertable
- `events_hourly` continuous aggregate
- `session_daily_stats` continuous aggregate

**Required Views:**
- `session_summaries`
- `task_statistics`

**Required Indexes:**
- `events(task_id, timestamp DESC)`
- `events(session_id, timestamp DESC)`
- `sessions(task_id, external_user_id)`
- `sessions(session_start DESC)`

## Testing Checklist

- [ ] Summary stats with and without filters
- [ ] Timeline with hour/day/week grouping
- [ ] Event type distribution
- [ ] User activity pagination (first, middle, last page)
- [ ] Session details with valid/invalid IDs
- [ ] Task ownership verification (unauthorized access)
- [ ] Invalid query parameters (validation errors)
- [ ] Cache behavior (hit and miss)
- [ ] Date range validation (startDate > endDate)
- [ ] Empty result sets

## Common Issues

**Slow Queries:**
- Check continuous aggregate refresh policies
- Verify indexes exist
- Add date range filters
- Monitor TimescaleDB chunk statistics

**Cache Not Working:**
- Verify Redis connection
- Check cache key generation
- Monitor TTL settings
- Review Redis memory usage

**Incorrect Data:**
- Verify continuous aggregate refresh schedules
- Check timezone handling in filters
- Ensure event ingestion is working
- Validate data retention policies
