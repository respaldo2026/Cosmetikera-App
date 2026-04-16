-- =====================================================
-- DELETE USER SAFELY (by email)
-- Usage:
--   1) Replace the email in the SET clause below
--   2) Run the whole script in Supabase SQL Editor
-- Notes:
--   - Removes perfil first (if exists) to avoid FK issues
--   - Uses auth.admin_delete_user(uid) to remove auth.users
--   - Wraps in a transaction and reports final status
-- =====================================================

DO $$
DECLARE
  v_email text := 'crystal.diamante.col@gmail.com'; -- TODO: replace
  v_uid uuid;
  v_has_admin_fn boolean := false;
BEGIN
  -- Find the user id by email
  SELECT id INTO v_uid FROM auth.users WHERE email = v_email;

  IF v_uid IS NULL THEN
    RAISE NOTICE 'No auth user found with email: %', v_email;
    RETURN;
  END IF;

  RAISE NOTICE 'Found user id: %', v_uid;

  -- Try to remove perfil first (ignore if not present)
  BEGIN
    DELETE FROM public.perfiles WHERE id = v_uid;
    RAISE NOTICE 'Deleted perfiles row (if existed) for id: %', v_uid;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Skipping perfiles delete due to: %', SQLERRM;
  END;

  -- Detect if admin delete function exists
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'admin_delete_user' AND n.nspname = 'auth'
  ) INTO v_has_admin_fn;

  IF v_has_admin_fn THEN
    -- Preferred path when available
    PERFORM auth.admin_delete_user(v_uid);
    RAISE NOTICE 'auth.admin_delete_user executed for id: %', v_uid;
  ELSE
    -- Fallback: manually clean auth schema and delete user
    BEGIN
      DELETE FROM auth.identities WHERE user_id = v_uid;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Skip identities delete: %', SQLERRM;
    END;
    BEGIN
      DELETE FROM auth.sessions WHERE user_id = v_uid;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Skip sessions delete: %', SQLERRM;
    END;
    BEGIN
      DELETE FROM auth.refresh_tokens WHERE user_id = v_uid;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Skip refresh_tokens delete: %', SQLERRM;
    END;
    BEGIN
      DELETE FROM auth.mfa_factors WHERE user_id = v_uid;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Skip mfa_factors delete: %', SQLERRM;
    END;
    -- Finally, delete the auth user
    DELETE FROM auth.users WHERE id = v_uid;
    RAISE NOTICE 'Direct delete from auth.users executed for id: %', v_uid;
  END IF;

  -- Verify
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_uid) THEN
    RAISE EXCEPTION 'User still exists in auth.users (id=%). Deletion failed.', v_uid;
  ELSE
    RAISE NOTICE 'User deleted successfully (id=%)', v_uid;
  END IF;
END $$;
