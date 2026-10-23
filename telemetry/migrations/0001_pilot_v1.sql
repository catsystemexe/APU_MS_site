-- Telemetry only. Authored for emulation; never applied remotely by B1.
PRAGMA foreign_keys = ON;
CREATE TABLE telemetry_sessions (
 session_id TEXT PRIMARY KEY, tab_id TEXT NOT NULL, participant_id TEXT NOT NULL,
 cohort_id TEXT NOT NULL, key_version TEXT NOT NULL,
 test_class TEXT NOT NULL CHECK(test_class IN ('tester','developer','synthetic')),
 notice_version TEXT NOT NULL, measurement_version TEXT NOT NULL CHECK(measurement_version='pilot-v1'),
 opened_at INTEGER NOT NULL, last_interaction_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 stopped_at INTEGER, budget_minute INTEGER NOT NULL DEFAULT -1,
 budget_count INTEGER NOT NULL DEFAULT 0 CHECK(budget_count BETWEEN 0 AND 120),
 CHECK(expires_at>opened_at AND expires_at<=opened_at+43200000)
);
CREATE INDEX telemetry_sessions_cohort_time ON telemetry_sessions(cohort_id,opened_at);
CREATE INDEX telemetry_sessions_participant_time ON telemetry_sessions(participant_id,opened_at);
CREATE TABLE telemetry_events (
 event_id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES telemetry_sessions(session_id) ON DELETE CASCADE,
 tab_id TEXT NOT NULL, client_seq INTEGER NOT NULL CHECK(client_seq>=0), workflow_id TEXT,
 event_name TEXT NOT NULL CHECK(event_name IN ('activity_interval','workflow_started','phase_transition','operation_requested','operation_resolved','document_accepted','workflow_reset','session_closed','workflow_metadata')),
 schema_version INTEGER NOT NULL CHECK(schema_version=1), measurement_version TEXT NOT NULL CHECK(measurement_version='pilot-v1'),
 occurred_at INTEGER NOT NULL, received_at INTEGER NOT NULL, app_version TEXT NOT NULL CHECK(app_version='unknown'),
 event_json TEXT NOT NULL CHECK(json_valid(event_json) AND length(CAST(event_json AS BLOB))<=2048),
 UNIQUE(session_id,tab_id,client_seq)
);
CREATE INDEX telemetry_events_name_time ON telemetry_events(event_name,occurred_at);
CREATE INDEX telemetry_events_workflow_time ON telemetry_events(workflow_id,occurred_at);
-- BEFORE triggers also run for ON CONFLICT DO NOTHING: duplicates with changed bodies fail.
CREATE TRIGGER telemetry_event_conflict BEFORE INSERT ON telemetry_events BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM telemetry_events WHERE
 (event_id=NEW.event_id OR (session_id=NEW.session_id AND tab_id=NEW.tab_id AND client_seq=NEW.client_seq))
 AND (event_id<>NEW.event_id OR event_json<>NEW.event_json)) THEN RAISE(ABORT,'telemetry_conflict') END;
END;
CREATE TABLE telemetry_ai_calls (
 call_id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES telemetry_sessions(session_id) ON DELETE CASCADE,
 workflow_id TEXT, started_at INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN ('pending','final')),
 identity_json TEXT NOT NULL, projection_json TEXT NOT NULL CHECK(json_valid(projection_json)),
 cost_nano_usd INTEGER CHECK(cost_nano_usd>=0)
);
CREATE INDEX telemetry_ai_session_time ON telemetry_ai_calls(session_id,started_at);
CREATE INDEX telemetry_ai_workflow_time ON telemetry_ai_calls(workflow_id,started_at);
CREATE TRIGGER telemetry_ai_conflict BEFORE INSERT ON telemetry_ai_calls BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM telemetry_ai_calls WHERE call_id=NEW.call_id AND
 (identity_json<>NEW.identity_json OR (state='final' AND NEW.state='final' AND projection_json<>NEW.projection_json)))
 THEN RAISE(ABORT,'telemetry_conflict') END;
END;
CREATE TRIGGER telemetry_session_identity_immutable BEFORE UPDATE ON telemetry_sessions
 WHEN NEW.session_id<>OLD.session_id OR NEW.participant_id<>OLD.participant_id OR NEW.cohort_id<>OLD.cohort_id
 OR NEW.key_version<>OLD.key_version OR NEW.tab_id<>OLD.tab_id OR NEW.opened_at<>OLD.opened_at
 OR NEW.expires_at<>OLD.expires_at OR NEW.notice_version<>OLD.notice_version OR NEW.test_class<>OLD.test_class
 OR (OLD.stopped_at IS NOT NULL AND NEW.stopped_at IS NOT OLD.stopped_at)
 BEGIN SELECT RAISE(ABORT,'telemetry_conflict'); END;
CREATE TRIGGER telemetry_event_session_active BEFORE INSERT ON telemetry_events BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM telemetry_sessions WHERE session_id=NEW.session_id AND tab_id=NEW.tab_id
 AND stopped_at IS NULL AND expires_at>NEW.received_at AND last_interaction_at>NEW.received_at-1800000)
 THEN RAISE(ABORT,'telemetry_inactive') END;
END;
