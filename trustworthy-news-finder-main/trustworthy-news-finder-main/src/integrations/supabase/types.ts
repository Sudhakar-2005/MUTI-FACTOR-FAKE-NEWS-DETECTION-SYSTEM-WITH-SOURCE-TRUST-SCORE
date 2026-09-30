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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      analysis_history: {
        Row: {
          article_content: string | null
          article_title: string | null
          clickbait_words_found: string[] | null
          created_at: string
          domain_age: string | null
          domain_score: number
          evidence_score: number
          final_score: number
          id: string
          input_type: string
          input_value: string
          rating: string
          sentiment_bias: string | null
          sentiment_score: number
          similar_sources: number | null
          ssl_valid: boolean | null
          text_score: number
          user_id: string
        }
        Insert: {
          article_content?: string | null
          article_title?: string | null
          clickbait_words_found?: string[] | null
          created_at?: string
          domain_age?: string | null
          domain_score: number
          evidence_score: number
          final_score: number
          id?: string
          input_type: string
          input_value: string
          rating: string
          sentiment_bias?: string | null
          sentiment_score: number
          similar_sources?: number | null
          ssl_valid?: boolean | null
          text_score: number
          user_id: string
        }
        Update: {
          article_content?: string | null
          article_title?: string | null
          clickbait_words_found?: string[] | null
          created_at?: string
          domain_age?: string | null
          domain_score?: number
          evidence_score?: number
          final_score?: number
          id?: string
          input_type?: string
          input_value?: string
          rating?: string
          sentiment_bias?: string | null
          sentiment_score?: number
          similar_sources?: number | null
          ssl_valid?: boolean | null
          text_score?: number
          user_id?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          permissions: string[] | null
          rate_limit: number | null
          requests_today: number | null
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          permissions?: string[] | null
          rate_limit?: number | null
          requests_today?: number | null
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          permissions?: string[] | null
          rate_limit?: number | null
          requests_today?: number | null
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fact_checks: {
        Row: {
          claim: string
          created_at: string
          explanation: string | null
          id: string
          keywords: string[] | null
          source_url: string | null
          updated_at: string
          verdict: string
        }
        Insert: {
          claim: string
          created_at?: string
          explanation?: string | null
          id?: string
          keywords?: string[] | null
          source_url?: string | null
          updated_at?: string
          verdict: string
        }
        Update: {
          claim?: string
          created_at?: string
          explanation?: string | null
          id?: string
          keywords?: string[] | null
          source_url?: string | null
          updated_at?: string
          verdict?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          daily_summary_enabled: boolean
          display_name: string | null
          email: string | null
          id: string
          low_score_alerts_enabled: boolean
          low_score_threshold: number
          updated_at: string
          user_id: string
          weekly_digest_enabled: boolean
        }
        Insert: {
          created_at?: string
          daily_summary_enabled?: boolean
          display_name?: string | null
          email?: string | null
          id?: string
          low_score_alerts_enabled?: boolean
          low_score_threshold?: number
          updated_at?: string
          user_id: string
          weekly_digest_enabled?: boolean
        }
        Update: {
          created_at?: string
          daily_summary_enabled?: boolean
          display_name?: string | null
          email?: string | null
          id?: string
          low_score_alerts_enabled?: boolean
          low_score_threshold?: number
          updated_at?: string
          user_id?: string
          weekly_digest_enabled?: boolean
        }
        Relationships: []
      }
      threat_scans: {
        Row: {
          avg_score: number | null
          created_at: string
          domains_scanned: number
          id: string
          malicious_domains: string[] | null
          scan_duration_ms: number | null
          scan_type: string
          threat_types: Json | null
          threats_found: number
          user_id: string | null
        }
        Insert: {
          avg_score?: number | null
          created_at?: string
          domains_scanned?: number
          id?: string
          malicious_domains?: string[] | null
          scan_duration_ms?: number | null
          scan_type: string
          threat_types?: Json | null
          threats_found?: number
          user_id?: string | null
        }
        Update: {
          avg_score?: number | null
          created_at?: string
          domains_scanned?: number
          id?: string
          malicious_domains?: string[] | null
          scan_duration_ms?: number | null
          scan_type?: string
          threat_types?: Json | null
          threats_found?: number
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_delivery_logs: {
        Row: {
          attempt_number: number
          created_at: string
          error_message: string | null
          event: string
          id: string
          response_time_ms: number | null
          status_code: number | null
          success: boolean
          user_id: string
          webhook_id: string
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          error_message?: string | null
          event: string
          id?: string
          response_time_ms?: number | null
          status_code?: number | null
          success?: boolean
          user_id: string
          webhook_id: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          error_message?: string | null
          event?: string
          id?: string
          response_time_ms?: number | null
          status_code?: number | null
          success?: boolean
          user_id?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_delivery_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string
          enabled: boolean | null
          events: string[] | null
          failure_count: number | null
          id: string
          last_triggered_at: string | null
          name: string
          secret: string | null
          type: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean | null
          events?: string[] | null
          failure_count?: number | null
          id?: string
          last_triggered_at?: string | null
          name: string
          secret?: string | null
          type: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean | null
          events?: string[] | null
          failure_count?: number | null
          id?: string
          last_triggered_at?: string | null
          name?: string
          secret?: string | null
          type?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
