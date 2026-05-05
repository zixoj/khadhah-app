export type UserRole = 'advertiser' | 'delivery_agent';
export type PostType = 'exchange' | 'free';
export type DeliveryMethod = 'pickup' | 'delivery_agent' | 'direct_contact';
export type ListingStatus = 'available' | 'reserved_temp' | 'reserved' | 'taken';
export type DeliveryStatus = 'pending' | 'accepted' | 'in_progress' | 'delivered' | 'cancelled';

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  role: UserRole;
  avatar_url: string;
  city: string;
  created_at: string;
  is_verified: boolean;
  boost_count: number;
  rating_avg: number;
  rating_count: number;
  wallet_balance: number;
  show_phone: boolean;
  allow_whatsapp: boolean;
  allow_messages: boolean;
  phone_verified: boolean;
  phone_verified_at: string | null;
}

export interface Listing {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  type: PostType;
  city: string;
  phone: string;
  delivery_method: DeliveryMethod;
  image_url: string;
  created_at: string;
  views_count: number;
  is_boosted: boolean;
  boosted_until: string | null;
  status: ListingStatus;
  is_urgent: boolean;
  urgent_until: string | null;
  dual_mode: boolean;
  interest_count: number;
  reserved_by: string | null;
  reserved_until: string | null;
  is_featured: boolean;
  premium_badge: boolean;
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
}
