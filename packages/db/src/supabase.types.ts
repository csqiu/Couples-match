// Generated from the hosted project with `supabase gen types typescript` (via the
// Supabase MCP generate_typescript_types tool). Do not edit by hand; regenerate
// after every migration.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          couple_id: string
          created_at: string
          id: number
          payload: Json
          type: string
          user_id: string | null
        }
        Insert: {
          couple_id: string
          created_at?: string
          id?: never
          payload?: Json
          type: string
          user_id?: string | null
        }
        Update: {
          couple_id?: string
          created_at?: string
          id?: never
          payload?: Json
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      cbsa_boundaries: {
        Row: {
          cbsa_code: string
          geom: unknown
          lsad: string | null
          name: string
        }
        Insert: {
          cbsa_code: string
          geom: unknown
          lsad?: string | null
          name: string
        }
        Update: {
          cbsa_code?: string
          geom?: unknown
          lsad?: string | null
          name?: string
        }
        Relationships: []
      }
      comparisons: {
        Row: {
          answered_by: string | null
          both_agreed: boolean
          couple_id: string
          created_at: string
          id: string
          locked: boolean
          pair_left: string
          pair_right: string
          seq: number
          winner: Database["public"]["Enums"]["comparison_winner"]
        }
        Insert: {
          answered_by?: string | null
          both_agreed?: boolean
          couple_id: string
          created_at?: string
          id?: string
          locked?: boolean
          pair_left: string
          pair_right: string
          seq?: never
          winner: Database["public"]["Enums"]["comparison_winner"]
        }
        Update: {
          answered_by?: string | null
          both_agreed?: boolean
          couple_id?: string
          created_at?: string
          id?: string
          locked?: boolean
          pair_left?: string
          pair_right?: string
          seq?: never
          winner?: Database["public"]["Enums"]["comparison_winner"]
        }
        Relationships: [
          {
            foreignKeyName: "comparisons_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      couples: {
        Row: {
          activated_at: string | null
          created_at: string
          dissolved_at: string | null
          id: string
          match_name: string
          match_type: Database["public"]["Enums"]["match_type"]
          match_year: number
          partner_a: string | null
          partner_b: string | null
          settings: Json
          status: Database["public"]["Enums"]["couple_status"]
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          dissolved_at?: string | null
          id?: string
          match_name: string
          match_type: Database["public"]["Enums"]["match_type"]
          match_year: number
          partner_a?: string | null
          partner_b?: string | null
          settings?: Json
          status?: Database["public"]["Enums"]["couple_status"]
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          dissolved_at?: string | null
          id?: string
          match_name?: string
          match_type?: Database["public"]["Enums"]["match_type"]
          match_year?: number
          partner_a?: string | null
          partner_b?: string | null
          settings?: Json
          status?: Database["public"]["Enums"]["couple_status"]
        }
        Relationships: []
      }
      individual_ranks: {
        Row: {
          acceptable: boolean
          couple_id: string
          note: string | null
          nrmp_code: string | null
          program_id: string
          rank: number
          tier: Database["public"]["Enums"]["tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          acceptable?: boolean
          couple_id: string
          note?: string | null
          nrmp_code?: string | null
          program_id: string
          rank: number
          tier: Database["public"]["Enums"]["tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          acceptable?: boolean
          couple_id?: string
          note?: string | null
          nrmp_code?: string | null
          program_id?: string
          rank?: number
          tier?: Database["public"]["Enums"]["tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "individual_ranks_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "individual_ranks_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          couple_id: string
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          couple_id: string
          created_at?: string
          created_by?: string | null
          email: string
          expires_at: string
          id?: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          couple_id?: string
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      list_versions: {
        Row: {
          couple_id: string
          created_at: string
          created_by: string | null
          engine_version: string
          id: string
          inputs_snapshot: Json
          is_frozen: boolean
          name: string
          note: string | null
          pairs: Json
        }
        Insert: {
          couple_id: string
          created_at?: string
          created_by?: string | null
          engine_version: string
          id?: string
          inputs_snapshot: Json
          is_frozen?: boolean
          name: string
          note?: string | null
          pairs: Json
        }
        Update: {
          couple_id?: string
          created_at?: string
          created_by?: string | null
          engine_version?: string
          id?: string
          inputs_snapshot?: Json
          is_frozen?: boolean
          name?: string
          note?: string | null
          pairs?: Json
        }
        Relationships: [
          {
            foreignKeyName: "list_versions_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      pair_exclusions: {
        Row: {
          couple_id: string
          created_at: string
          created_by: string | null
          id: string
          program_a: string
          program_b: string
          reason: string | null
        }
        Insert: {
          couple_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          program_a: string
          program_b: string
          reason?: string | null
        }
        Update: {
          couple_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          program_a?: string
          program_b?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pair_exclusions_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      pins: {
        Row: {
          comparison_id: string | null
          couple_id: string
          created_at: string
          created_by: string | null
          higher_pair: string
          id: string
          lower_pair: string
          source: Database["public"]["Enums"]["pin_source"]
        }
        Insert: {
          comparison_id?: string | null
          couple_id: string
          created_at?: string
          created_by?: string | null
          higher_pair: string
          id?: string
          lower_pair: string
          source: Database["public"]["Enums"]["pin_source"]
        }
        Update: {
          comparison_id?: string | null
          couple_id?: string
          created_at?: string
          created_by?: string | null
          higher_pair?: string
          id?: string
          lower_pair?: string
          source?: Database["public"]["Enums"]["pin_source"]
        }
        Relationships: [
          {
            foreignKeyName: "pins_comparison_id_fkey"
            columns: ["comparison_id"]
            isOneToOne: false
            referencedRelation: "comparisons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pins_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          is_admin: boolean
          specialty: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          is_admin?: boolean
          specialty?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          is_admin?: boolean
          specialty?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_specialty_fkey"
            columns: ["specialty"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["code"]
          },
        ]
      }
      programs: {
        Row: {
          acgme_id: string | null
          address: string
          cbsa_code: string | null
          cbsa_name: string | null
          city: string
          created_at: string
          created_by_couple: string | null
          geocode_confidence: number | null
          geocode_source: string | null
          geom: unknown
          id: string
          institution: string
          is_advanced: boolean
          lat: number | null
          lon: number | null
          match_name: string
          match_type: Database["public"]["Enums"]["match_type"]
          name: string
          nrmp_code: string | null
          source: string
          specialty_code: string
          specialty_name: string
          state: string
          verified: boolean
        }
        Insert: {
          acgme_id?: string | null
          address?: string
          cbsa_code?: string | null
          cbsa_name?: string | null
          city?: string
          created_at?: string
          created_by_couple?: string | null
          geocode_confidence?: number | null
          geocode_source?: string | null
          geom?: unknown
          id?: string
          institution: string
          is_advanced?: boolean
          lat?: number | null
          lon?: number | null
          match_name: string
          match_type: Database["public"]["Enums"]["match_type"]
          name: string
          nrmp_code?: string | null
          source: string
          specialty_code: string
          specialty_name: string
          state?: string
          verified?: boolean
        }
        Update: {
          acgme_id?: string | null
          address?: string
          cbsa_code?: string | null
          cbsa_name?: string | null
          city?: string
          created_at?: string
          created_by_couple?: string | null
          geocode_confidence?: number | null
          geocode_source?: string | null
          geom?: unknown
          id?: string
          institution?: string
          is_advanced?: boolean
          lat?: number | null
          lon?: number | null
          match_name?: string
          match_type?: Database["public"]["Enums"]["match_type"]
          name?: string
          nrmp_code?: string | null
          source?: string
          specialty_code?: string
          specialty_name?: string
          state?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "programs_created_by_couple_fkey"
            columns: ["created_by_couple"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_specialty_code_fkey"
            columns: ["specialty_code"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["code"]
          },
        ]
      }
      rule_exceptions: {
        Row: {
          couple_id: string
          created_at: string
          created_by: string | null
          higher_pair: string
          id: string
          lower_pair: string
        }
        Insert: {
          couple_id: string
          created_at?: string
          created_by?: string | null
          higher_pair: string
          id?: string
          lower_pair: string
        }
        Update: {
          couple_id?: string
          created_at?: string
          created_by?: string | null
          higher_pair?: string
          id?: string
          lower_pair?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_exceptions_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      specialties: {
        Row: {
          code: string
          match_name: string
          match_type: string
          name: string
        }
        Insert: {
          code: string
          match_name: string
          match_type: string
          name: string
        }
        Update: {
          code?: string
          match_name?: string
          match_type?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      couple_pair_distances: {
        Row: {
          couple_id: string | null
          distance_mi: number | null
          program_a: string | null
          program_b: string | null
          same_cbsa: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "individual_ranks_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "individual_ranks_program_id_fkey"
            columns: ["program_a"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "individual_ranks_program_id_fkey"
            columns: ["program_b"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invite: { Args: { p_token: string }; Returns: string }
      acting_user: { Args: never; Returns: string }
      create_invite: {
        Args: { p_couple: string; p_email: string }
        Returns: {
          expires_at: string
          invite_id: string
          token: string
        }[]
      }
      delete_my_account: { Args: never; Returns: undefined }
      invite_preview: {
        Args: { p_token: string }
        Returns: {
          invited_email: string
          inviter_name: string
          match_name: string
          match_type: Database["public"]["Enums"]["match_type"]
          match_year: number
          status: string
        }[]
      }
      is_active_member: { Args: { p_couple: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_couple_member: { Args: { p_couple: string }; Returns: boolean }
      leave_couple: { Args: { p_couple: string }; Returns: undefined }
      pair_distance_mi: { Args: { p_a: string; p_b: string }; Returns: number }
      purge_dissolved_couples: {
        Args: { p_older_than?: string }
        Returns: number
      }
      restore_version: { Args: { p_version: string }; Returns: undefined }
      revoke_invite: { Args: { p_invite: string }; Returns: undefined }
    }
    Enums: {
      comparison_winner: "left" | "right" | "tie"
      couple_status: "pending" | "active" | "dissolved"
      match_type: "main" | "sms_fellowship"
      pin_source: "comparison" | "manual_drag" | "conflict_resolution"
      tier: "A" | "B" | "C"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> =
  (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
