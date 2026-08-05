CREATE VIEW IF NOT EXISTS analytics_events_normalized AS
SELECT
  *,
  CASE
    WHEN lower(coalesce(source, '')) LIKE '%codex%'
      OR lower(coalesce(source, '')) LIKE '%teste%'
      OR lower(coalesce(source, '')) LIKE '%test%'
      OR lower(coalesce(source_detail, '')) LIKE '%codex%'
      OR lower(coalesce(url, '')) LIKE '%codex%'
      OR lower(coalesce(url, '')) LIKE '%fresh=%'
    THEN 1
    ELSE 0
  END AS is_test_event
FROM analytics_events;
