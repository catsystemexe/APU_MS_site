-- Aggregate the two many-side relations BEFORE joining. No event can multiply AI cost.
, event_totals AS (
 SELECT session_id,count(*) event_count,max(occurred_at) last_event_at,
 max(client_seq)+1-count(DISTINCT client_seq) sequence_gaps FROM ev GROUP BY session_id
), ai_totals AS (
 SELECT session_id,count(*) ai_count,sum(cost_nano_usd) known_cost_nano_usd,
 sum(cost_nano_usd IS NULL) unknown_cost_count,max(started_at) last_ai_at FROM ai GROUP BY session_id
)
SELECT s.session_id,s.participant_id,s.key_version,s.opened_at,s.last_interaction_at,s.stopped_at,
 COALESCE(e.event_count,0) event_count,e.last_event_at,COALESCE(e.sequence_gaps,0) sequence_gaps,
 COALESCE(a.ai_count,0) ai_count,COALESCE(a.known_cost_nano_usd,0) known_cost_nano_usd,
 COALESCE(a.unknown_cost_count,0) unknown_cost_count,a.last_ai_at
FROM scoped_sessions s LEFT JOIN event_totals e USING(session_id) LEFT JOIN ai_totals a USING(session_id)
WHERE s.opened_at>=:retained_since OR e.event_count>0 OR a.ai_count>0
ORDER BY s.opened_at,s.session_id LIMIT 10001
