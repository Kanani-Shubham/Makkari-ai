-- MAKKARI AI — Migration: Add title_generated and title_locked flags to chats table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'chats' 
          AND column_name = 'title_generated'
    ) THEN
        ALTER TABLE public.chats ADD COLUMN title_generated BOOLEAN DEFAULT FALSE NOT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'chats' 
          AND column_name = 'title_locked'
    ) THEN
        ALTER TABLE public.chats ADD COLUMN title_locked BOOLEAN DEFAULT FALSE NOT NULL;
    END IF;
END $$;
