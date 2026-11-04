LOCK TABLE reservation_requests IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE reservation_requests
  ADD COLUMN requested_start_key TEXT GENERATED ALWAYS AS (
    CASE
      WHEN requested_dates ~
        '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}( to [0-9]{2}:[0-9]{2})?$'
        THEN substring(requested_dates FROM 1 FOR 16)
      ELSE requested_dates
    END
  ) STORED;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM reservation_requests
    WHERE status = 'accepted'
    GROUP BY requested_start_key
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot add normalized reservation conflicts: accepted reservations share a date/start time';
  END IF;
END
$$;

DROP INDEX reservation_requests_one_accepted_exact_slot;

CREATE UNIQUE INDEX reservation_requests_one_accepted_exact_slot
  ON reservation_requests (requested_start_key)
  WHERE status = 'accepted';
