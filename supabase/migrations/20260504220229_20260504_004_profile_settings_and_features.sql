/*
  # Profile Settings & Advanced Features

  1. Tables Created
    - `user_settings` - notification preferences, privacy settings per user
    - `wallet_transactions` - wallet balance ledger
    - `ratings` - user-to-user ratings with stars + comments
    - `favorites` - saved listings per user
    - `activity_log` - audit log for user actions
    - `user_blocks` - blocked users list

  2. Columns Added to Existing Tables
    - `profiles`: city, show_phone, is_verified, boost_count, rating_avg, rating_count
    - `listings`: views_count, is_boosted, boosted_until

  3. Security
    - RLS enabled on all new tables
    - Users can only access their own data (except ratings which are readable by all)
*/

-- Add columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='city') THEN
    ALTER TABLE profiles ADD COLUMN city text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='show_phone') THEN
    ALTER TABLE profiles ADD COLUMN show_phone boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_verified') THEN
    ALTER TABLE profiles ADD COLUMN is_verified boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='boost_count') THEN
    ALTER TABLE profiles ADD COLUMN boost_count integer DEFAULT 3;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='rating_avg') THEN
    ALTER TABLE profiles ADD COLUMN rating_avg numeric(3,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='rating_count') THEN
    ALTER TABLE profiles ADD COLUMN rating_count integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='wallet_balance') THEN
    ALTER TABLE profiles ADD COLUMN wallet_balance numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Add columns to listings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='views_count') THEN
    ALTER TABLE listings ADD COLUMN views_count integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='is_boosted') THEN
    ALTER TABLE listings ADD COLUMN is_boosted boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='boosted_until') THEN
    ALTER TABLE listings ADD COLUMN boosted_until timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='status') THEN
    ALTER TABLE listings ADD COLUMN status text DEFAULT 'active';
  END IF;
END $$;

-- user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  notify_messages boolean DEFAULT true,
  notify_delivery boolean DEFAULT true,
  notify_listings boolean DEFAULT true,
  messages_in_app_only boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own settings"
  ON user_settings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- wallet_transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  type text NOT NULL DEFAULT 'credit',
  description text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own wallet transactions"
  ON wallet_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallet transactions"
  ON wallet_transactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ratings table
CREATE TABLE IF NOT EXISTS ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewed_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars integer NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(reviewer_id, reviewed_id)
);
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view ratings"
  ON ratings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert own ratings"
  ON ratings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "Users can update own ratings"
  ON ratings FOR UPDATE TO authenticated
  USING (auth.uid() = reviewer_id)
  WITH CHECK (auth.uid() = reviewer_id);

-- favorites table
CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, listing_id)
);
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own favorites"
  ON favorites FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites"
  ON favorites FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
  ON favorites FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- activity_log table
CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  description text NOT NULL DEFAULT '',
  meta jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own activity log"
  ON activity_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activity log"
  ON activity_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- user_blocks table
CREATE TABLE IF NOT EXISTS user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own blocks"
  ON user_blocks FOR SELECT TO authenticated
  USING (auth.uid() = blocker_id);

CREATE POLICY "Users can insert own blocks"
  ON user_blocks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can delete own blocks"
  ON user_blocks FOR DELETE TO authenticated
  USING (auth.uid() = blocker_id);

-- Function to update rating averages after insert/update
CREATE OR REPLACE FUNCTION update_rating_avg()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET
    rating_avg = (SELECT COALESCE(AVG(stars), 0) FROM ratings WHERE reviewed_id = NEW.reviewed_id),
    rating_count = (SELECT COUNT(*) FROM ratings WHERE reviewed_id = NEW.reviewed_id)
  WHERE id = NEW.reviewed_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_rating_avg ON ratings;
CREATE TRIGGER trigger_update_rating_avg
  AFTER INSERT OR UPDATE ON ratings
  FOR EACH ROW EXECUTE FUNCTION update_rating_avg();

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_user_id ON wallet_transactions(user_id);
