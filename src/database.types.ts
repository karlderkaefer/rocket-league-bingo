/**
 * Placeholder generated types for Supabase database schema.
 * Regenerate with: supabase gen types typescript --local > src/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      rooms: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          host_id: string;
          guest_id: string | null;
          seed: string;
          category_ids: string[];
          share_code: string;
          status: Database['public']['Enums']['room_status'];
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          host_id: string;
          guest_id?: string | null;
          seed: string;
          category_ids: string[];
          share_code: string;
          status?: Database['public']['Enums']['room_status'];
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          host_id?: string;
          guest_id?: string | null;
          seed?: string;
          category_ids?: string[];
          share_code?: string;
          status?: Database['public']['Enums']['room_status'];
        };
        Relationships: [];
      };
      marks: {
        Row: {
          id: string;
          room_id: string;
          cell_index: number;
          player_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          cell_index: number;
          player_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          cell_index?: number;
          player_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      room_status: 'waiting' | 'active' | 'completed' | 'expired';
    };
    CompositeTypes: Record<string, never>;
  };
};
