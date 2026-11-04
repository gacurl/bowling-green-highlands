ALTER TABLE operator_availability
  ADD COLUMN start_minute INTEGER,
  ADD COLUMN duration_minutes INTEGER;

UPDATE operator_availability
SET start_minute = 540,
    duration_minutes = 120
WHERE mode = 'available';

ALTER TABLE operator_availability
  ADD CONSTRAINT operator_availability_valid_window CHECK (
    (
      mode = 'unavailable'
      AND start_minute IS NULL
      AND duration_minutes IS NULL
    )
    OR
    (
      mode = 'available'
      AND start_minute IS NOT NULL
      AND start_minute >= 0
      AND start_minute < 1440
      AND duration_minutes IS NOT NULL
      AND duration_minutes >= 20
      AND duration_minutes <= 480
      AND duration_minutes % 20 = 0
      AND start_minute + duration_minutes <= 1440
    )
  );
