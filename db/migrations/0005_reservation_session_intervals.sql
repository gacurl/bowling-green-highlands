LOCK TABLE reservation_requests IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE reservation_requests
  ADD COLUMN session_date DATE,
  ADD COLUMN session_start_minute INTEGER,
  ADD COLUMN session_duration_minutes INTEGER;

WITH raw_components AS (
  SELECT
    id,
    substring(requested_dates FROM 1 FOR 4)::integer AS year_value,
    substring(requested_dates FROM 6 FOR 2)::integer AS month_value,
    substring(requested_dates FROM 9 FOR 2)::integer AS day_value,
    substring(requested_dates FROM 12 FOR 2)::integer * 60
      + substring(requested_dates FROM 15 FOR 2)::integer AS start_minute,
    CASE
      WHEN length(requested_dates) = 25
        THEN substring(requested_dates FROM 21 FOR 2)::integer * 60
          + substring(requested_dates FROM 24 FOR 2)::integer
      ELSE NULL
    END AS end_minute
  FROM reservation_requests
  WHERE requested_dates ~
    '^[0-9]{4}-[0-9]{2}-[0-9]{2} ([01][0-9]|2[0-3]):[0-5][0-9]( to ([01][0-9]|2[0-3]):[0-5][0-9])?$'
), parsed_requests AS (
  SELECT
    id,
    CASE
      WHEN year_value BETWEEN 1 AND 9999
        AND month_value BETWEEN 1 AND 12
        AND day_value >= 1
        AND day_value <= CASE
          WHEN month_value = 2
            AND (
              year_value % 400 = 0
              OR (year_value % 4 = 0 AND year_value % 100 <> 0)
            )
            THEN 29
          WHEN month_value = 2 THEN 28
          WHEN month_value IN (4, 6, 9, 11) THEN 30
          ELSE 31
        END
        THEN make_date(year_value, month_value, day_value)
      ELSE NULL
    END AS parsed_date,
    start_minute,
    end_minute
  FROM raw_components
), reliable_requests AS (
  SELECT
    id,
    parsed_date,
    start_minute,
    CASE
      WHEN end_minute IS NULL THEN NULL
      ELSE end_minute - start_minute
    END AS duration_minutes
  FROM parsed_requests
  WHERE parsed_date IS NOT NULL
    AND (
      end_minute IS NULL
      OR (
        end_minute > start_minute
        AND end_minute <= 1440
      )
    )
)
UPDATE reservation_requests AS reservation
SET session_date = reliable.parsed_date,
    session_start_minute = reliable.start_minute,
    session_duration_minutes = reliable.duration_minutes
FROM reliable_requests AS reliable
WHERE reservation.id = reliable.id;

ALTER TABLE reservation_requests
  ADD CONSTRAINT reservation_requests_session_start_complete CHECK (
    (session_date IS NULL AND session_start_minute IS NULL)
    OR
    (session_date IS NOT NULL AND session_start_minute IS NOT NULL)
  ),
  ADD CONSTRAINT reservation_requests_session_start_minute_valid CHECK (
    session_start_minute IS NULL
    OR (
      session_start_minute >= 0
      AND session_start_minute < 1440
    )
  ),
  ADD CONSTRAINT reservation_requests_session_duration_valid CHECK (
    session_duration_minutes IS NULL
    OR (
      session_date IS NOT NULL
      AND session_start_minute IS NOT NULL
      AND session_duration_minutes > 0
      AND session_start_minute::bigint
        + session_duration_minutes::bigint <= 1440
    )
  ),
  ADD CONSTRAINT reservation_requests_session_snapshot_matches_request CHECK (
    CASE
      WHEN session_date IS NULL THEN TRUE
      WHEN requested_dates ~
        '^[0-9]{4}-[0-9]{2}-[0-9]{2} ([01][0-9]|2[0-3]):[0-5][0-9]( to ([01][0-9]|2[0-3]):[0-5][0-9])?$'
        THEN
          session_date::text = substring(requested_dates FROM 1 FOR 10)
          AND session_start_minute =
            substring(requested_dates FROM 12 FOR 2)::integer * 60
              + substring(requested_dates FROM 15 FOR 2)::integer
          AND (
            length(requested_dates) = 16
            OR (
              length(requested_dates) = 25
              AND session_duration_minutes IS NOT NULL
              AND session_duration_minutes =
                substring(requested_dates FROM 21 FOR 2)::integer * 60
                  + substring(requested_dates FROM 24 FOR 2)::integer
                  - session_start_minute
            )
          )
      ELSE FALSE
    END
  );
