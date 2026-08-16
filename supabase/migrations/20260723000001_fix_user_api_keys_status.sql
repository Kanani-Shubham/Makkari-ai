-- MAKKARI AI — Migration: Ensure status column exists on user_api_keys
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'user_api_keys' 
          AND column_name = 'status'
    ) THEN
        ALTER TABLE public.user_api_keys ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked'));
    END IF;
END $$;
