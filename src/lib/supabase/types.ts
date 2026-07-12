import type { Database } from '@/database.types';

export type Room = Database['public']['Tables']['rooms']['Row'];
export type InsertRoom = Database['public']['Tables']['rooms']['Insert'];
export type UpdateRoom = Database['public']['Tables']['rooms']['Update'];
export type RoomStatus = Database['public']['Enums']['room_status'];
export type Mark = Database['public']['Tables']['marks']['Row'];
export type InsertMark = Database['public']['Tables']['marks']['Insert'];
