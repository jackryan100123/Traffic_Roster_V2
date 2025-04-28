export interface Policeman {
  id: number;
  name: string;
  belt_no: string;
  rank: string;
  rank_display?: string;
  is_driver: boolean;
  preferred_duty: string;
  specialized_duty?: string;
  is_senior?: boolean;
  gender: string;
  has_fixed_duty?: boolean;
  zone?: number;
  area?: number;
}

export interface Zone {
  id: number;
  name: string;
  description: string | null;
}

export interface Area {
  id: number;
  name: string;
  zone: number;
  zone_name?: string;
  call_sign: string;
  vehicle_no: string | null;
}

export interface Deployment {
  id: number;
  area: number;
  area_name?: string;
  policeman: number;
  policeman_name?: string;
  policeman_rank?: string;
  is_driver?: boolean;
  duty_type: string;
  start_date: string;
  end_date?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Roster {
  id: number;
  name: string;
  created_at: string;
  is_active: boolean;
  repetition_count: number;
  same_area_repetition_count: number;
  unfulfilled_requirements: any[] | null;
  assignments: RosterAssignment[];
}

export interface RosterAssignment {
  id: number;
  policeman: number;
  policeman_name: string;
  policeman_rank: string;
  area: number;
  area_name: string;
  zone_name: string;
  call_sign: string;
  was_previous_zone: boolean;
  was_previous_area: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface APIResponse<T> {
  data: T;
  status: number;
  statusText: string;
}

export interface PolicemanFilters {
  rank?: string;
  is_driver?: boolean;
  preferred_duty?: string;
  gender?: string;
  has_fixed_duty?: boolean;
  search?: string;
} 