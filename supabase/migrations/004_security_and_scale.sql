-- REQUIRED BEFORE deploying hardened VITAL ID application.
-- Run on STAGING first, back up database, inspect orphaned/cross-owner rows.
-- If inconsistent data exists, this migration deliberately FAILS: investigate and repair it safely.

DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.devices d JOIN public.patients p ON p.id=d.patient_id WHERE d.owner_id<>p.owner_id)
 OR EXISTS (SELECT 1 FROM public.share_links s JOIN public.patients p ON p.id=s.patient_id WHERE s.owner_id<>p.owner_id)
 OR EXISTS (SELECT 1 FROM public.clinical_suggestions c JOIN public.patients p ON p.id=c.patient_id WHERE c.owner_id<>p.owner_id)
 OR EXISTS (SELECT 1 FROM public.activity_logs a JOIN public.patients p ON p.id=a.patient_id WHERE a.owner_id<>p.owner_id)
 THEN RAISE EXCEPTION 'VITAL security migration blocked: cross-owner records require investigation'; END IF;
END $$;

ALTER TABLE public.patients ADD CONSTRAINT patients_id_owner_uq UNIQUE (id, owner_id);
ALTER TABLE public.devices ADD CONSTRAINT devices_patient_owner_fk
 FOREIGN KEY (patient_id,owner_id) REFERENCES public.patients(id,owner_id) ON DELETE CASCADE;
ALTER TABLE public.share_links ADD CONSTRAINT shares_patient_owner_fk
 FOREIGN KEY (patient_id,owner_id) REFERENCES public.patients(id,owner_id) ON DELETE CASCADE;
ALTER TABLE public.clinical_suggestions ADD CONSTRAINT suggestions_patient_owner_fk
 FOREIGN KEY (patient_id,owner_id) REFERENCES public.patients(id,owner_id) ON DELETE CASCADE;
ALTER TABLE public.activity_logs ADD CONSTRAINT activity_patient_owner_fk
 FOREIGN KEY (patient_id,owner_id) REFERENCES public.patients(id,owner_id) ON DELETE CASCADE;

-- Prevent broken cross-account references to activity devices even for own patient.
CREATE OR REPLACE FUNCTION public.vital_validate_activity_device()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF NEW.device_id IS NOT NULL AND NOT EXISTS
 (SELECT 1 FROM public.devices d WHERE d.id=NEW.device_id AND d.owner_id=NEW.owner_id
   AND (NEW.patient_id IS NULL OR d.patient_id=NEW.patient_id))
 THEN RAISE EXCEPTION 'activity device ownership mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER vital_activity_device_owner BEFORE INSERT OR UPDATE ON public.activity_logs
FOR EACH ROW EXECUTE FUNCTION public.vital_validate_activity_device();

-- Existing RLS ownership checks remain. These restrictions block direct browser audit-forgery
-- and unsafe direct link creation/update (owner uses authenticated API endpoint instead).
REVOKE INSERT, UPDATE, DELETE ON public.activity_logs FROM authenticated;
DROP POLICY IF EXISTS "owners insert activity" ON public.activity_logs;
REVOKE INSERT, UPDATE, DELETE ON public.share_links FROM authenticated;
DROP POLICY IF EXISTS "owners insert share links" ON public.share_links;
DROP POLICY IF EXISTS "owners update share links" ON public.share_links;
DROP POLICY IF EXISTS "owners delete share links" ON public.share_links;
GRANT UPDATE (revoked_at) ON public.share_links TO authenticated;
CREATE POLICY "owners revoke share links" ON public.share_links FOR UPDATE TO authenticated
 USING ((SELECT auth.uid())=owner_id) WITH CHECK ((SELECT auth.uid())=owner_id);
CREATE OR REPLACE FUNCTION public.vital_revoke_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR NEW.revoked_at > now() + interval '1 minute'
 THEN RAISE EXCEPTION 'invalid share revocation'; END IF;
 IF (to_jsonb(NEW)-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at')
 THEN RAISE EXCEPTION 'share links are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER vital_share_revoke_only BEFORE UPDATE ON public.share_links
FOR EACH ROW EXECUTE FUNCTION public.vital_revoke_only();

-- New shares must be short lived; existing links >24h must be revoked/expired before this constraint.
ALTER TABLE public.share_links ADD CONSTRAINT vital_share_lifetime
 CHECK (expires_at > created_at AND expires_at <= created_at + interval '24 hours');
ALTER TABLE public.share_links ADD CONSTRAINT vital_share_token_format CHECK (token ~ '^[0-9a-f]{48}$');
CREATE INDEX IF NOT EXISTS vital_active_shares_idx ON public.share_links(patient_id,expires_at)
 WHERE revoked_at IS NULL;

CREATE TABLE public.clinician_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 patient_id uuid NOT NULL,
 share_id uuid NOT NULL REFERENCES public.share_links(id) ON DELETE CASCADE,
 qr_slug text NOT NULL,
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (patient_id,owner_id) REFERENCES public.patients(id,owner_id) ON DELETE CASCADE
);
CREATE INDEX clinician_sessions_share_idx ON public.clinician_sessions(share_id) WHERE revoked_at IS NULL;
CREATE INDEX clinician_sessions_exp_idx ON public.clinician_sessions(expires_at);
ALTER TABLE public.clinician_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clinician_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinician_sessions TO service_role;

-- Files are private. Browser uploads must be within quota and approved types.
UPDATE storage.buckets SET public=false, file_size_limit=12582912,
 allowed_mime_types=ARRAY['application/pdf','image/png','image/jpeg','image/webp']
 WHERE id='medical-documents';

-- Database-backed atomic distributed limiter, safe across serverless instances.
CREATE TABLE public.vital_rate_limits (
 id text PRIMARY KEY, hits integer NOT NULL, reset_at timestamptz NOT NULL
);
ALTER TABLE public.vital_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vital_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.vital_rate_limits TO service_role;
CREATE INDEX vital_rate_limits_exp_idx ON public.vital_rate_limits(reset_at);
CREATE OR REPLACE FUNCTION public.vital_take_rate_limit(p_key text,p_limit int,p_window_seconds int)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.vital_rate_limits%ROWTYPE;
BEGIN
 IF length(p_key)>128 OR p_limit NOT BETWEEN 1 AND 10000 OR p_window_seconds NOT BETWEEN 1 AND 86400
 THEN RAISE EXCEPTION 'invalid limit parameters'; END IF;
 INSERT INTO public.vital_rate_limits AS t(id,hits,reset_at)
 VALUES(p_key,1,now()+make_interval(secs=>p_window_seconds))
 ON CONFLICT (id) DO UPDATE
 SET hits=CASE WHEN t.reset_at<=now() THEN 1 ELSE t.hits+1 END,
 reset_at=CASE WHEN t.reset_at<=now() THEN now()+make_interval(secs=>p_window_seconds) ELSE t.reset_at END
 RETURNING * INTO r;
 RETURN CASE WHEN r.hits<=p_limit THEN 0 ELSE GREATEST(1,CEIL(EXTRACT(EPOCH FROM r.reset_at-now()))::int) END;
END $$;
REVOKE ALL ON FUNCTION public.vital_take_rate_limit(text,int,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vital_take_rate_limit(text,int,int) TO service_role;
-- Cleanup daily with Supabase pg_cron or an external scheduled job:
-- DELETE FROM public.vital_rate_limits WHERE reset_at < now() - interval '1 day';

ALTER TABLE public.devices ADD COLUMN last_scan_at timestamptz;
ALTER TABLE public.devices ADD COLUMN last_location_at timestamptz;
-- Single transaction handles dedupe, validation and audit; avoids read-then-write races.
CREATE OR REPLACE FUNCTION public.vital_record_scan(p_device_id uuid,p_event text,p_detail text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.devices%ROWTYPE;
BEGIN
 IF p_event NOT IN ('scan','location') OR length(p_detail)>220 THEN RETURN false; END IF;
 IF p_event='scan' THEN
   UPDATE public.devices SET last_scan_at=now(),
    data=jsonb_set(data,'{lastScanned}',to_jsonb(now()::text),true)
   WHERE id=p_device_id AND status='active'
    AND (last_scan_at IS NULL OR last_scan_at<now()-interval '30 seconds')
   RETURNING * INTO d;
 ELSE
   UPDATE public.devices SET last_location_at=now() WHERE id=p_device_id AND status='active'
    AND (last_location_at IS NULL OR last_location_at<now()-interval '1 minute')
   RETURNING * INTO d;
 END IF;
 IF d.id IS NULL THEN RETURN false; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id=d.patient_id AND p.owner_id=d.owner_id)
 THEN RAISE EXCEPTION 'device owner mismatch'; END IF;
 INSERT INTO public.activity_logs(owner_id,patient_id,device_id,type,title,detail)
 VALUES(d.owner_id,d.patient_id,d.id,
  CASE WHEN p_event='scan' THEN 'scan' ELSE 'access' END,
  CASE WHEN p_event='scan' THEN 'Medical ID scanned' ELSE 'Unverified location reported' END,
  p_detail);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.vital_record_scan(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vital_record_scan(uuid,text,text) TO service_role;

-- Quotas bound accidental/abusive per-account database growth. Apply after
-- checking existing record counts; this affects INSERT only, not existing rows.
ALTER TABLE public.patients ADD CONSTRAINT vital_patient_json_max_bytes CHECK (octet_length(data::text) <= 524288);
ALTER TABLE public.devices ADD CONSTRAINT vital_device_json_max_bytes CHECK (octet_length(data::text) <= 16384);
ALTER TABLE public.clinical_suggestions ADD CONSTRAINT vital_suggestion_json_max_bytes
 CHECK (octet_length(payload::text) <= 20000);
CREATE OR REPLACE FUNCTION public.vital_account_record_quota()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE count_rows int; max_rows int;
BEGIN
  -- Limits concurrent inserts from the same account, preventing quota races.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(NEW.owner_id::text), 2026);
  IF TG_TABLE_NAME='patients' THEN
    SELECT count(*) INTO count_rows FROM public.patients WHERE owner_id=NEW.owner_id;
    max_rows:=100;
  ELSIF TG_TABLE_NAME='devices' THEN
    SELECT count(*) INTO count_rows FROM public.devices WHERE owner_id=NEW.owner_id;
    max_rows:=250;
  ELSE RETURN NEW;
  END IF;
  IF count_rows >= max_rows THEN RAISE EXCEPTION 'VITAL account quota exceeded'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER vital_patients_quota BEFORE INSERT ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.vital_account_record_quota();
CREATE TRIGGER vital_devices_quota BEFORE INSERT ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.vital_account_record_quota();

-- High-read-path optimization: join device + patient in ONE database call.
-- Public users cannot call these functions directly; only server's service role.
CREATE OR REPLACE FUNCTION public.vital_public_emergency_lookup(p_slug text)
RETURNS TABLE(owner_id uuid, patient_slug text, patient_data jsonb, device_data jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT p.owner_id,p.slug,p.data,d.data
 FROM public.devices d
 JOIN public.patients p ON p.id=d.patient_id AND p.owner_id=d.owner_id
 WHERE d.qr_slug=p_slug AND d.status='active'
 LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.vital_public_emergency_lookup(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vital_public_emergency_lookup(text) TO service_role;

-- Public QR writes are idempotent/rate-deduped in ONE transaction/call.
CREATE OR REPLACE FUNCTION public.vital_record_scan(p_qr_slug text,p_event text,p_detail text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.devices%ROWTYPE;
BEGIN
 IF p_event NOT IN ('scan','location') OR length(p_detail)>220 OR length(p_qr_slug)>100 THEN RETURN false; END IF;
 IF p_event='scan' THEN
   UPDATE public.devices SET last_scan_at=now(),
    data=jsonb_set(data,'{lastScanned}',to_jsonb(now()::text),true)
   WHERE qr_slug=p_qr_slug AND status='active'
    AND (last_scan_at IS NULL OR last_scan_at<now()-interval '30 seconds')
   RETURNING * INTO d;
 ELSE
   UPDATE public.devices SET last_location_at=now() WHERE qr_slug=p_qr_slug AND status='active'
    AND (last_location_at IS NULL OR last_location_at<now()-interval '1 minute')
   RETURNING * INTO d;
 END IF;
 IF d.id IS NULL THEN RETURN false; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id=d.patient_id AND p.owner_id=d.owner_id)
 THEN RAISE EXCEPTION 'device owner mismatch'; END IF;
 INSERT INTO public.activity_logs(owner_id,patient_id,device_id,type,title,detail)
 VALUES(d.owner_id,d.patient_id,d.id,
  CASE WHEN p_event='scan' THEN 'scan' ELSE 'access' END,
  CASE WHEN p_event='scan' THEN 'Medical ID scanned' ELSE 'Unverified location reported' END,
  p_detail);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.vital_record_scan(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vital_record_scan(text,text,text) TO service_role;
DROP FUNCTION public.vital_record_scan(uuid,text,text);
