SELECT a.call_id,a.session_id,a.workflow_id,s.participant_id,s.key_version,a.started_at,a.state,a.cost_nano_usd,
 json_extract(projection_json,'$.completed_at') completed_at,
 json_extract(projection_json,'$.operation_instance_id') operation_instance_id,
 json_extract(projection_json,'$.operation') operation,json_extract(projection_json,'$.phase') phase,
 json_extract(projection_json,'$.requested_model') requested_model,json_extract(projection_json,'$.reported_model') reported_model,
 json_extract(projection_json,'$.pricing_snapshot.pricing_version') pricing_version,
 json_extract(projection_json,'$.pricing_snapshot.status') pricing_status,
 json_extract(projection_json,'$.provider_status') provider_status,json_extract(projection_json,'$.application_status') application_status,
 json_extract(projection_json,'$.retry_of_call_id') retry_of_call_id,json_extract(projection_json,'$.fallback_for_call_id') fallback_for_call_id,
 CASE WHEN state='final' THEN json_extract(projection_json,'$.usage.input_tokens') END input_tokens,
 CASE WHEN state='final' THEN json_extract(projection_json,'$.usage.output_tokens') END output_tokens,
 CASE WHEN state='final' THEN json_extract(projection_json,'$.usage.cached_input_tokens') END cached_input_tokens,
 CASE WHEN state='final' THEN json_extract(projection_json,'$.usage.cache_write_tokens') END cache_write_tokens
FROM ai a JOIN scoped_sessions s USING(session_id) ORDER BY a.started_at,a.call_id LIMIT 100001
