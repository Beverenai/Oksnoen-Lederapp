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
      announcements: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          title: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          title: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          title?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      cabins: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      extra_fields_config: {
        Row: {
          created_at: string | null
          field_key: string
          icon: string
          id: string
          is_visible: boolean | null
          sort_order: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          field_key: string
          icon?: string
          id?: string
          is_visible?: boolean | null
          sort_order?: number | null
          title?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          field_key?: string
          icon?: string
          id?: string
          is_visible?: boolean | null
          sort_order?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      home_screen_config: {
        Row: {
          element_key: string
          id: string
          is_visible: boolean | null
          label: string
          sort_order: number | null
        }
        Insert: {
          element_key: string
          id?: string
          is_visible?: boolean | null
          label: string
          sort_order?: number | null
        }
        Update: {
          element_key?: string
          id?: string
          is_visible?: boolean | null
          label?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      leader_content: {
        Row: {
          current_activity: string | null
          extra_1: string | null
          extra_2: string | null
          extra_3: string | null
          extra_4: string | null
          extra_5: string | null
          extra_activity: string | null
          id: string
          leader_id: string
          obs_message: string | null
          personal_message: string | null
          personal_notes: string | null
          updated_at: string | null
        }
        Insert: {
          current_activity?: string | null
          extra_1?: string | null
          extra_2?: string | null
          extra_3?: string | null
          extra_4?: string | null
          extra_5?: string | null
          extra_activity?: string | null
          id?: string
          leader_id: string
          obs_message?: string | null
          personal_message?: string | null
          personal_notes?: string | null
          updated_at?: string | null
        }
        Update: {
          current_activity?: string | null
          extra_1?: string | null
          extra_2?: string | null
          extra_3?: string | null
          extra_4?: string | null
          extra_5?: string | null
          extra_activity?: string | null
          id?: string
          leader_id?: string
          obs_message?: string | null
          personal_message?: string | null
          personal_notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leader_content_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: true
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      leaders: {
        Row: {
          age: number | null
          cabin: string | null
          cabin_info: string | null
          can_climbing: boolean | null
          can_rappelling: boolean | null
          can_rope_setup: boolean | null
          can_zipline: boolean | null
          created_at: string | null
          email: string | null
          has_boat_license: boolean | null
          has_car: boolean | null
          has_drivers_license: boolean | null
          id: string
          is_active: boolean | null
          ministerpost: string | null
          name: string
          phone: string
          profile_image_url: string | null
          team: string | null
          updated_at: string | null
        }
        Insert: {
          age?: number | null
          cabin?: string | null
          cabin_info?: string | null
          can_climbing?: boolean | null
          can_rappelling?: boolean | null
          can_rope_setup?: boolean | null
          can_zipline?: boolean | null
          created_at?: string | null
          email?: string | null
          has_boat_license?: boolean | null
          has_car?: boolean | null
          has_drivers_license?: boolean | null
          id?: string
          is_active?: boolean | null
          ministerpost?: string | null
          name: string
          phone: string
          profile_image_url?: string | null
          team?: string | null
          updated_at?: string | null
        }
        Update: {
          age?: number | null
          cabin?: string | null
          cabin_info?: string | null
          can_climbing?: boolean | null
          can_rappelling?: boolean | null
          can_rope_setup?: boolean | null
          can_zipline?: boolean | null
          created_at?: string | null
          email?: string | null
          has_boat_license?: boolean | null
          has_car?: boolean | null
          has_drivers_license?: boolean | null
          id?: string
          is_active?: boolean | null
          ministerpost?: string | null
          name?: string
          phone?: string
          profile_image_url?: string | null
          team?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      participant_activities: {
        Row: {
          activity: string
          completed_at: string | null
          id: string
          participant_id: string
        }
        Insert: {
          activity: string
          completed_at?: string | null
          id?: string
          participant_id: string
        }
        Update: {
          activity?: string
          completed_at?: string | null
          id?: string
          participant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_activities_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_health_events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          event_type: string
          id: string
          participant_id: string
          severity: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          event_type: string
          id?: string
          participant_id: string
          severity?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          event_type?: string
          id?: string
          participant_id?: string
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participant_health_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_health_events_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_health_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          participant_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          participant_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          participant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_health_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_health_notes_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          birth_date: string | null
          cabin_id: string | null
          created_at: string | null
          has_arrived: boolean | null
          id: string
          image_url: string | null
          name: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          birth_date?: string | null
          cabin_id?: string | null
          created_at?: string | null
          has_arrived?: boolean | null
          id?: string
          image_url?: string | null
          name: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          birth_date?: string | null
          cabin_id?: string | null
          created_at?: string | null
          has_arrived?: boolean | null
          id?: string
          image_url?: string | null
          name?: string
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_cabin_id_fkey"
            columns: ["cabin_id"]
            isOneToOne: false
            referencedRelation: "cabins"
            referencedColumns: ["id"]
          },
        ]
      }
      session_activities: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
          time_slot: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          time_slot?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          time_slot?: string | null
          title?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          leader_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          id?: string
          leader_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          id?: string
          leader_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _leader_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "leader" | "nurse"
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
      app_role: ["admin", "leader", "nurse"],
    },
  },
} as const
