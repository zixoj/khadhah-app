export type UserRole = 'advertiser' | 'delivery_agent' | 'admin';
export type AccountStatus = 'active' | 'suspended' | 'banned';
export type ReportStatus = 'new' | 'under_review' | 'resolved' | 'rejected';
export type PostType = 'exchange' | 'free';
export type DeliveryMethod = 'pickup' | 'delivery_agent' | 'direct_contact';
export type ListingStatus = 'available' | 'reserved_temp' | 'reserved' | 'taken';
export type DeliveryStatus = 'pending' | 'accepted' | 'in_progress' | 'delivered' | 'cancelled';

export interface Profile {
  id: string;
  full_name: string;
  display_name: string | null;
  username: string | null;
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
  last_display_name_change_at: string | null;
  last_username_change_at: string | null;
  account_status: AccountStatus;
  must_change_password: boolean;
  is_hidden_from_public: boolean;
  country: string | null;
  country_code: string | null;
  phone_number: string | null;
  full_phone_number: string | null;
}

export interface Report {
  id: string;
  listing_id: string | null;
  reporter_id: string;
  reported_user_id: string | null;
  chat_room_id: string | null;
  reason: string;
  description: string;
  status: ReportStatus;
  admin_notes: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface AdminLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
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
  is_hidden: boolean;
  admin_note: string;
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
