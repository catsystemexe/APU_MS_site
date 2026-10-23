WITH scoped_sessions AS (
 SELECT * FROM telemetry_sessions
 WHERE cohort_id=:cohort AND test_class=:test_class AND opened_at<:to AND opened_at<=:as_of
), ev AS (
 SELECT e.* FROM telemetry_events e JOIN scoped_sessions s USING(session_id)
 WHERE occurred_at>=:retained_since AND occurred_at<=:as_of AND received_at<=:as_of
), ai AS (
 SELECT a.call_id,a.session_id,a.workflow_id,a.started_at,
 CASE WHEN a.state='final' AND json_extract(projection_json,'$.completed_at')<=:as_of THEN 'final' ELSE 'pending' END state,
 CASE WHEN a.state='final' AND json_extract(projection_json,'$.completed_at')<=:as_of THEN cost_nano_usd ELSE NULL END cost_nano_usd,
 projection_json FROM telemetry_ai_calls a JOIN scoped_sessions s USING(session_id)
 WHERE started_at>=:retained_since AND started_at<=:as_of
)
