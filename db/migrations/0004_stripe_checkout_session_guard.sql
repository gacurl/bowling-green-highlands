ALTER TABLE reservation_requests
  ADD COLUMN stripe_checkout_session_id TEXT,
  ADD COLUMN stripe_checkout_session_retryable BOOLEAN NOT NULL DEFAULT FALSE,
  ADD CONSTRAINT reservation_requests_checkout_retryable_requires_session
    CHECK (
      NOT stripe_checkout_session_retryable
      OR stripe_checkout_session_id IS NOT NULL
    ),
  ADD CONSTRAINT reservation_requests_stripe_checkout_session_id_unique
    UNIQUE (stripe_checkout_session_id);
