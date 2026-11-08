-- Handwritten: frozen days move from { day, ok, degraded, error } to
-- { day, requests: { ok, degraded, error } }. Days that already have `requests` are kept.
UPDATE `frozen_monitor_uptime`
SET `days` = (
	SELECT json_group_array(
		CASE
			WHEN json_type(d.value, '$.requests') IS NOT NULL THEN json(d.value)
			ELSE json_object(
				'day', json_extract(d.value, '$.day'),
				'requests', json_object(
					'ok', json_extract(d.value, '$.ok'),
					'degraded', json_extract(d.value, '$.degraded'),
					'error', json_extract(d.value, '$.error')
				)
			)
		END
	)
	FROM (SELECT `value` FROM json_each(`frozen_monitor_uptime`.`days`) ORDER BY `key`) AS d
)
WHERE EXISTS (
	SELECT 1 FROM json_each(`frozen_monitor_uptime`.`days`)
	WHERE json_type(`value`, '$.requests') IS NULL
);
