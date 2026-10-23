SELECT e.event_id,e.session_id,e.workflow_id,e.event_name,e.client_seq,e.occurred_at,e.received_at,s.opened_at,s.participant_id,s.key_version,
 json_extract(event_json,'$.payload.phase') phase,json_extract(event_json,'$.payload.from') from_phase,
 json_extract(event_json,'$.payload.to') to_phase,json_extract(event_json,'$.payload.reason') reason,
 json_extract(event_json,'$.payload.start_ms') start_ms,json_extract(event_json,'$.payload.end_ms') end_ms,
 json_extract(event_json,'$.payload.last_interaction_ms') last_interaction_ms,
 json_extract(event_json,'$.payload.operation_instance_id') operation_instance_id,json_extract(event_json,'$.payload.operation') operation,
 json_extract(event_json,'$.payload.outcome') outcome,json_extract(event_json,'$.payload.output_id') output_id,
 json_extract(event_json,'$.payload.representation') representation
FROM ev e JOIN scoped_sessions s USING(session_id) ORDER BY occurred_at,client_seq,event_id LIMIT 600001
