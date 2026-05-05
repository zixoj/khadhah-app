/*
  # Khadhah App - Initial Database Schema

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key, references auth.users)
      - `full_name` (text)
      - `phone` (text)
      - `role` (text: 'advertiser' or 'delivery_agent')
      - `avatar_url` (text)
      - `created_at` (timestamptz)
    - `categories`
      - `id` (uuid, primary key)
      - `name_ar` (text, Arabic category name)
      - `icon` (text, icon name)
      - `sort_order` (integer)
    - `posts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `type` (text: 'exchange' or 'free')
      - `category_id` (uuid, references categories)
      - `title` (text)
      - `description` (text)
      - `delivery_method` (text: 'pickup', 'delivery_agent', 'direct_contact')
      - `status` (text: 'active', 'completed', 'cancelled')
      - `location_text` (text)
      - `created_at` (timestamptz)
    - `post_images`
      - `id` (uuid, primary key)
      - `post_id` (uuid, references posts)
      - `image_url` (text)
      - `sort_order` (integer)
    - `delivery_requests`
      - `id` (uuid, primary key)
      - `post_id` (uuid, references posts)
      - `requester_id` (uuid, references profiles)
      - `agent_id` (uuid, references profiles, nullable)
      - `status` (text: 'pending', 'accepted', 'in_progress', 'delivered', 'cancelled')
      - `pickup_address` (text)
      - `dropoff_address` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Profiles: users can read all, update own
    - Categories: anyone can read
    - Posts: anyone can read, authenticated users can insert/update own, delete own
    - Post images: anyone can read, post owner can insert/delete
    - Delivery requests: involved users can read, authenticated can create, agents can update assigned requests

  3. Important Notes
    - Categories are pre-seeded with Arabic names
    - Posts reference both users and categories
    - Delivery requests link posts with delivery agents
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text DEFAULT '',
  phone text DEFAULT '',
  role text NOT NULL DEFAULT 'advertiser' CHECK (role IN ('advertiser', 'delivery_agent')),
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  icon text DEFAULT '',
  sort_order integer DEFAULT 0
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories"
  ON categories FOR SELECT
  TO authenticated
  USING (true);

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('exchange', 'free')),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text DEFAULT '',
  delivery_method text NOT NULL DEFAULT 'direct_contact' CHECK (delivery_method IN ('pickup', 'delivery_agent', 'direct_contact')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  location_text text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view posts"
  ON posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
  ON posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Post images table
CREATE TABLE IF NOT EXISTS post_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  sort_order integer DEFAULT 0
);

ALTER TABLE post_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view post images"
  ON post_images FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Post owner can insert images"
  ON post_images FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM posts WHERE posts.id = post_images.post_id AND posts.user_id = auth.uid())
  );

CREATE POLICY "Post owner can delete images"
  ON post_images FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM posts WHERE posts.id = post_images.post_id AND posts.user_id = auth.uid())
  );

-- Delivery requests table
CREATE TABLE IF NOT EXISTS delivery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'delivered', 'cancelled')),
  pickup_address text DEFAULT '',
  dropoff_address text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE delivery_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Involved users can view delivery requests"
  ON delivery_requests FOR SELECT
  TO authenticated
  USING (
    requester_id = auth.uid() OR agent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM posts WHERE posts.id = delivery_requests.post_id AND posts.user_id = auth.uid())
  );

CREATE POLICY "Authenticated users can create delivery requests"
  ON delivery_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Assigned agent can update delivery request"
  ON delivery_requests FOR UPDATE
  TO authenticated
  USING (agent_id = auth.uid() OR requester_id = auth.uid())
  WITH CHECK (agent_id = auth.uid() OR requester_id = auth.uid());

-- Seed categories
INSERT INTO categories (name_ar, icon, sort_order) VALUES
  ('إلكترونيات', 'smartphone', 1),
  ('أثاث', 'armchair', 2),
  ('ملابس', 'shirt', 3),
  ('كتب', 'book-open', 4),
  ('ألعاب', 'gamepad-2', 5),
  ('رياضة', 'dumbbell', 6),
  ('مطبخ', 'cooking-pot', 7),
  ('سيارات', 'car', 8),
  ('عقارات', 'home', 9),
  ('أخرى', 'package', 10)
ON CONFLICT DO NOTHING;

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(type);
CREATE INDEX IF NOT EXISTS idx_posts_category_id ON posts(category_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_post_images_post_id ON post_images(post_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_agent_id ON delivery_requests(agent_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_post_id ON delivery_requests(post_id);
