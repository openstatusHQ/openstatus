CREATE OR REPLACE TABLE cwv
(event_date datetime, browser String, city String, continent String, country String, dsn String, device String, event_name String, href String, id String, language String, os String, path String, region_code String, screen String, speed String, timezone String, value Float64)
ENGINE MergeTree()
ORDER BY (id)