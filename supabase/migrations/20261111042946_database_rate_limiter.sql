-- Database-backed, atomic rate limiter. The private counter table is not
-- exposed through PostgREST; only the service-role RPC can consume counters.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE IF NOT EXISTS private.rate_limit_counters (
    key_hash text PRIMARY KEY,
    window_started_at timestamptz NOT NULL,
    request_count integer NOT NULL CHECK (request_count > 0)
);

REVOKE ALL ON TABLE private.rate_limit_counters FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
    p_key text,
    p_limit integer DEFAULT 10,
    p_window_seconds integer DEFAULT 10
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
    v_claims jsonb := auth.jwt();
    v_now timestamptz := clock_timestamp();
    v_count integer;
BEGIN
    IF COALESCE(v_claims->>'role', '') <> 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized' USING errcode = '42501';
    END IF;

    IF p_key IS NULL OR length(p_key) NOT BETWEEN 1 AND 512
       OR p_limit NOT BETWEEN 1 AND 1000
       OR p_window_seconds NOT BETWEEN 1 AND 86400 THEN
        RAISE EXCEPTION 'Invalid rate-limit request';
    END IF;

    INSERT INTO private.rate_limit_counters AS counters
        (key_hash, window_started_at, request_count)
    VALUES
        (md5(p_key), v_now, 1)
    ON CONFLICT (key_hash) DO UPDATE
    SET window_started_at = CASE
            WHEN counters.window_started_at <= v_now - make_interval(secs => p_window_seconds)
            THEN v_now
            ELSE counters.window_started_at
        END,
        request_count = CASE
            WHEN counters.window_started_at <= v_now - make_interval(secs => p_window_seconds)
            THEN 1
            ELSE counters.request_count + 1
        END
    RETURNING request_count INTO v_count;

    -- Opportunistic cleanup at most once per hour to keep the private table small.
    IF mod(extract(epoch FROM v_now)::bigint, 3600) = 0 THEN
        DELETE FROM private.rate_limit_counters
        WHERE window_started_at < v_now - interval '1 day';
    END IF;

    RETURN v_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;
