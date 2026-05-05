export type UserRole = 'advertiser' | 'delivery_agent';
export type PostType = 'exchange' | 'free';
export type DeliveryMethod = 'pickup' | 'delivery_agent' | 'direct_contact';
export type PostStatus = 'active' | 'completed' | 'cancelled';
export type DeliveryStatus = 'pending' | 'accepted' | 'in_progress' | 'delivered' | 'cancelled';

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  role: UserRole;
  avatar_url: string;
  created_at: string;
}

export interface Category {
  id: string;
  name_ar: string;
  icon: string;
  sort_order: number;
}

export interface Post {
  id: string;
  user_id: string;
  type: PostType;
  category_id: string;
  title: string;
  description: string;
  delivery_method: DeliveryMethod;
  status: PostStatus;
  location_text: string;
  city: string;
  created_at: string;
  profiles?: Profile;
  categories?: Category;
  post_images?: PostImage[];
}

export interface PostImage {
  id: string;
  post_id: string;
  image_url: string;
  sort_order: number;
}

export interface DeliveryRequest {
  id: string;
  post_id: string;
  requester_id: string;
  agent_id: string | null;
  status: DeliveryStatus;
  pickup_address: string;
  dropoff_address: string;
  created_at: string;
  updated_at: string;
  posts?: Post;
  profiles?: Profile;
  agent?: Profile;
}
