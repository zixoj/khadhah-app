/*
  # Add privacy preference columns to profiles

  1. Changes
    - `allow_whatsapp` (boolean, default true) — whether others can contact via WhatsApp
    - `allow_messages` (boolean, default true) — whether others can send in-app messages

  2. Security
    - No new tables; existing RLS on profiles applies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'allow_whatsapp'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN allow_whatsapp boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'allow_messages'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN allow_messages boolean NOT NULL DEFAULT true;
  END IF;
END $$;
