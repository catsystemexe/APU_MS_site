, event_totals AS (
 SELECT s.key_version,s.participant_id,e.workflow_id,count(*) event_count,
 min(CASE WHEN event_name='workflow_started' THEN occurred_at END) started_at,max(occurred_at) last_event_at
 FROM ev e JOIN scoped_sessions s USING(session_id) WHERE e.workflow_id IS NOT NULL
 GROUP BY s.key_version,s.participant_id,e.workflow_id
), ai_totals AS (
 SELECT s.key_version,s.participant_id,a.workflow_id,count(*) ai_count,
 COALESCE(sum(cost_nano_usd),0) known_cost_nano_usd,sum(cost_nano_usd IS NULL) unknown_cost_count,max(started_at) last_ai_at
 FROM ai a JOIN scoped_sessions s USING(session_id) WHERE a.workflow_id IS NOT NULL
 GROUP BY s.key_version,s.participant_id,a.workflow_id
), episodes AS (
 SELECT key_version,participant_id,workflow_id FROM event_totals UNION SELECT key_version,participant_id,workflow_id FROM ai_totals
)
SELECT k.*,e.started_at,e.last_event_at,COALESCE(e.event_count,0) event_count,
 COALESCE(a.ai_count,0) ai_count,COALESCE(a.known_cost_nano_usd,0) known_cost_nano_usd,
 COALESCE(a.unknown_cost_count,0) unknown_cost_count,a.last_ai_at
FROM episodes k LEFT JOIN event_totals e USING(key_version,participant_id,workflow_id)
LEFT JOIN ai_totals a USING(key_version,participant_id,workflow_id)
ORDER BY k.key_version,k.participant_id,k.workflow_id LIMIT 20001
