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
      activities: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
          title: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          target_group: string | null
          title: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          target_group?: string | null
          title: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          target_group?: string | null
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
      cabin_reports: {
        Row: {
          cabin_id: string
          content: string | null
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          cabin_id: string
          content?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          cabin_id?: string
          content?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cabin_reports_cabin_id_fkey"
            columns: ["cabin_id"]
            isOneToOne: true
            referencedRelation: "cabins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cabin_reports_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      cabins: {
        Row: {
          created_at: string | null
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      dynga_cards: {
        Row: {
          column_id: string
          created_at: string
          id: string
          participant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          column_id: string
          created_at?: string
          id?: string
          participant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          column_id?: string
          created_at?: string
          id?: string
          participant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dynga_cards_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "dynga_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dynga_cards_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      dynga_columns: {
        Row: {
          color: string
          created_at: string
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          sort_order?: number
          title: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      dynga_comments: {
        Row: {
          body: string
          card_id: string
          created_at: string
          id: string
          leader_id: string | null
        }
        Insert: {
          body: string
          card_id: string
          created_at?: string
          id?: string
          leader_id?: string | null
        }
        Update: {
          body?: string
          card_id?: string
          created_at?: string
          id?: string
          leader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dynga_comments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "dynga_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dynga_comments_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
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
      fix_tasks: {
        Row: {
          admin_notes: string | null
          assigned_at: string | null
          assigned_to: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          fixed_at: string | null
          fixed_by: string | null
          id: string
          image_url: string | null
          location: string | null
          status: string
          title: string
          updated_at: string | null
          what_to_fix: string | null
        }
        Insert: {
          admin_notes?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          fixed_at?: string | null
          fixed_by?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          status?: string
          title: string
          updated_at?: string | null
          what_to_fix?: string | null
        }
        Update: {
          admin_notes?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          fixed_at?: string | null
          fixed_by?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          status?: string
          title?: string
          updated_at?: string | null
          what_to_fix?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fix_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fix_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fix_tasks_fixed_by_fkey"
            columns: ["fixed_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      gjenglemt_items: {
        Row: {
          ai_description: string | null
          ai_status: string
          ai_tags: string[]
          color: string | null
          comment: string | null
          created_at: string
          created_by: string | null
          garment_type: string | null
          id: string
          image_url: string
          notes: string | null
          owner_name: string | null
          period_id: string
          status: string
          updated_at: string
        }
        Insert: {
          ai_description?: string | null
          ai_status?: string
          ai_tags?: string[]
          color?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          garment_type?: string | null
          id?: string
          image_url: string
          notes?: string | null
          owner_name?: string | null
          period_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          ai_description?: string | null
          ai_status?: string
          ai_tags?: string[]
          color?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          garment_type?: string | null
          id?: string
          image_url?: string
          notes?: string | null
          owner_name?: string | null
          period_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gjenglemt_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gjenglemt_items_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      home_screen_config: {
        Row: {
          bg_color: string | null
          element_key: string
          icon: string | null
          id: string
          is_bold: boolean | null
          is_italic: boolean | null
          is_visible: boolean | null
          label: string
          sort_order: number | null
          text_size: string | null
          title: string | null
        }
        Insert: {
          bg_color?: string | null
          element_key: string
          icon?: string | null
          id?: string
          is_bold?: boolean | null
          is_italic?: boolean | null
          is_visible?: boolean | null
          label: string
          sort_order?: number | null
          text_size?: string | null
          title?: string | null
        }
        Update: {
          bg_color?: string | null
          element_key?: string
          icon?: string | null
          id?: string
          is_bold?: boolean | null
          is_italic?: boolean | null
          is_visible?: boolean | null
          label?: string
          sort_order?: number | null
          text_size?: string | null
          title?: string | null
        }
        Relationships: []
      }
      leader_cabins: {
        Row: {
          cabin_id: string
          created_at: string | null
          id: string
          leader_id: string
        }
        Insert: {
          cabin_id: string
          created_at?: string | null
          id?: string
          leader_id: string
        }
        Update: {
          cabin_id?: string
          created_at?: string | null
          id?: string
          leader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leader_cabins_cabin_id_fkey"
            columns: ["cabin_id"]
            isOneToOne: false
            referencedRelation: "cabins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leader_cabins_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
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
          has_read: boolean | null
          has_seen_hajolo_tooltip: boolean | null
          id: string
          last_app_edit_at: string
          last_synced_at: string | null
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
          has_read?: boolean | null
          has_seen_hajolo_tooltip?: boolean | null
          id?: string
          last_app_edit_at?: string
          last_synced_at?: string | null
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
          has_read?: boolean | null
          has_seen_hajolo_tooltip?: boolean | null
          id?: string
          last_app_edit_at?: string
          last_synced_at?: string | null
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
      leader_teams: {
        Row: {
          created_at: string | null
          id: string
          leader_id: string
          period_number: number
          team: string
          year: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          leader_id: string
          period_number: number
          team: string
          year?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          leader_id?: string
          period_number?: number
          team?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leader_teams_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      leaders: {
        Row: {
          age: number | null
          auth_user_id: string | null
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
          has_seen_push_prompt: boolean
          id: string
          is_active: boolean | null
          last_app_edit_at: string
          last_synced_at: string | null
          ministerpost: string | null
          name: string
          phone: string
          profile_image_url: string | null
          team: string | null
          updated_at: string | null
        }
        Insert: {
          age?: number | null
          auth_user_id?: string | null
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
          has_seen_push_prompt?: boolean
          id?: string
          is_active?: boolean | null
          last_app_edit_at?: string
          last_synced_at?: string | null
          ministerpost?: string | null
          name: string
          phone: string
          profile_image_url?: string | null
          team?: string | null
          updated_at?: string | null
        }
        Update: {
          age?: number | null
          auth_user_id?: string | null
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
          has_seen_push_prompt?: boolean
          id?: string
          is_active?: boolean | null
          last_app_edit_at?: string
          last_synced_at?: string | null
          ministerpost?: string | null
          name?: string
          phone?: string
          profile_image_url?: string | null
          team?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      nurse_report_mentions: {
        Row: {
          created_at: string | null
          id: string
          mention_text: string
          participant_id: string
          report_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mention_text?: string
          participant_id: string
          report_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mention_text?: string
          participant_id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nurse_report_mentions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "nurse_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      nurse_reports: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          period_id: string | null
          updated_at: string | null
        }
        Insert: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          period_id?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          period_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nurse_reports_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      overnatting_responses: {
        Row: {
          created_at: string
          is_joining: boolean
          leader_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          is_joining?: boolean
          leader_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          is_joining?: boolean
          leader_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "overnatting_responses_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: true
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_activities: {
        Row: {
          activity: string
          completed_at: string | null
          id: string
          participant_id: string
          registered_by: string | null
        }
        Insert: {
          activity: string
          completed_at?: string | null
          id?: string
          participant_id: string
          registered_by?: string | null
        }
        Update: {
          activity?: string
          completed_at?: string | null
          id?: string
          participant_id?: string
          registered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participant_activities_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_activities_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "leaders"
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
          period_id: string | null
          severity: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          event_type: string
          id?: string
          participant_id: string
          period_id?: string | null
          severity?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          event_type?: string
          id?: string
          participant_id?: string
          period_id?: string | null
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
          {
            foreignKeyName: "participant_health_events_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_health_info: {
        Row: {
          created_at: string | null
          id: string
          info: string
          participant_id: string
          period_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          info: string
          participant_id: string
          period_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          info?: string
          participant_id?: string
          period_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participant_health_info_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_health_info_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
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
          period_id: string | null
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          participant_id: string
          period_id?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          participant_id?: string
          period_id?: string | null
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
          {
            foreignKeyName: "participant_health_notes_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          activity_notes: string | null
          birth_date: string | null
          cabin_id: string | null
          created_at: string | null
          first_name: string | null
          has_arrived: boolean | null
          id: string
          image_url: string | null
          last_name: string | null
          name: string
          notes: string | null
          pass_suggestion: string | null
          pass_text: string | null
          pass_written: boolean | null
          pass_written_at: string | null
          pass_written_by: string | null
          period_id: string | null
          room: string | null
          times_attended: number | null
          updated_at: string | null
        }
        Insert: {
          activity_notes?: string | null
          birth_date?: string | null
          cabin_id?: string | null
          created_at?: string | null
          first_name?: string | null
          has_arrived?: boolean | null
          id?: string
          image_url?: string | null
          last_name?: string | null
          name: string
          notes?: string | null
          pass_suggestion?: string | null
          pass_text?: string | null
          pass_written?: boolean | null
          pass_written_at?: string | null
          pass_written_by?: string | null
          period_id?: string | null
          room?: string | null
          times_attended?: number | null
          updated_at?: string | null
        }
        Update: {
          activity_notes?: string | null
          birth_date?: string | null
          cabin_id?: string | null
          created_at?: string | null
          first_name?: string | null
          has_arrived?: boolean | null
          id?: string
          image_url?: string | null
          last_name?: string | null
          name?: string
          notes?: string | null
          pass_suggestion?: string | null
          pass_text?: string | null
          pass_written?: boolean | null
          pass_written_at?: string | null
          pass_written_by?: string | null
          period_id?: string | null
          room?: string | null
          times_attended?: number | null
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
          {
            foreignKeyName: "participants_pass_written_by_fkey"
            columns: ["pass_written_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      periods: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          is_public: boolean
          name: string
          slug: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          is_public?: boolean
          name: string
          slug: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          is_public?: boolean
          name?: string
          slug?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string | null
          channel: string
          created_at: string | null
          endpoint: string
          id: string
          last_used_at: string | null
          leader_id: string
          native_token: string | null
          p256dh: string | null
          platform: string | null
        }
        Insert: {
          auth?: string | null
          channel?: string
          created_at?: string | null
          endpoint: string
          id?: string
          last_used_at?: string | null
          leader_id: string
          native_token?: string | null
          p256dh?: string | null
          platform?: string | null
        }
        Update: {
          auth?: string | null
          channel?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          last_used_at?: string | null
          leader_id?: string
          native_token?: string | null
          p256dh?: string | null
          platform?: string | null
        }
        Relationships: []
      }
      room_capacity: {
        Row: {
          bed_count: number
          cabin_id: string
          created_at: string | null
          id: string
          room: string | null
        }
        Insert: {
          bed_count?: number
          cabin_id: string
          created_at?: string | null
          id?: string
          room?: string | null
        }
        Update: {
          bed_count?: number
          cabin_id?: string
          created_at?: string | null
          id?: string
          room?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_capacity_cabin_id_fkey"
            columns: ["cabin_id"]
            isOneToOne: false
            referencedRelation: "cabins"
            referencedColumns: ["id"]
          },
        ]
      }
      room_swaps: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          from_cabin_id: string | null
          from_room: string | null
          id: string
          participant_id: string
          reason: string | null
          status: string
          to_cabin_id: string
          to_room: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          from_cabin_id?: string | null
          from_room?: string | null
          id?: string
          participant_id: string
          reason?: string | null
          status?: string
          to_cabin_id: string
          to_room?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          from_cabin_id?: string | null
          from_room?: string | null
          id?: string
          participant_id?: string
          reason?: string | null
          status?: string
          to_cabin_id?: string
          to_room?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_swaps_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_swaps_from_cabin_id_fkey"
            columns: ["from_cabin_id"]
            isOneToOne: false
            referencedRelation: "cabins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_swaps_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_swaps_to_cabin_id_fkey"
            columns: ["to_cabin_id"]
            isOneToOne: false
            referencedRelation: "cabins"
            referencedColumns: ["id"]
          },
        ]
      }
      rope_controls: {
        Row: {
          activity: string
          assigned_to: string | null
          carabiner_comment: string | null
          carabiner_status: string | null
          created_at: string | null
          fix_comment: string | null
          fixed_at: string | null
          fixed_by: string | null
          harness_comment: string | null
          harness_status: string | null
          helmet_comment: string | null
          helmet_status: string | null
          id: string
          leader_id: string
          rope_comment: string | null
          rope_status: string | null
          updated_at: string | null
        }
        Insert: {
          activity: string
          assigned_to?: string | null
          carabiner_comment?: string | null
          carabiner_status?: string | null
          created_at?: string | null
          fix_comment?: string | null
          fixed_at?: string | null
          fixed_by?: string | null
          harness_comment?: string | null
          harness_status?: string | null
          helmet_comment?: string | null
          helmet_status?: string | null
          id?: string
          leader_id: string
          rope_comment?: string | null
          rope_status?: string | null
          updated_at?: string | null
        }
        Update: {
          activity?: string
          assigned_to?: string | null
          carabiner_comment?: string | null
          carabiner_status?: string | null
          created_at?: string | null
          fix_comment?: string | null
          fixed_at?: string | null
          fixed_by?: string | null
          harness_comment?: string | null
          harness_status?: string | null
          helmet_comment?: string | null
          helmet_status?: string | null
          id?: string
          leader_id?: string
          rope_comment?: string | null
          rope_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rope_controls_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rope_controls_fixed_by_fkey"
            columns: ["fixed_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rope_controls_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
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
      shift_assignments: {
        Row: {
          assignment_type: string
          created_at: string | null
          day_index: number
          day_type: string
          excluded_leader_ids: string[]
          id: string
          is_locked: boolean
          leader_id: string | null
          note: string | null
          role: string | null
          schedule_id: string
          shift_type_id: string
          team_name: string | null
          updated_at: string | null
        }
        Insert: {
          assignment_type: string
          created_at?: string | null
          day_index: number
          day_type: string
          excluded_leader_ids?: string[]
          id?: string
          is_locked?: boolean
          leader_id?: string | null
          note?: string | null
          role?: string | null
          schedule_id: string
          shift_type_id: string
          team_name?: string | null
          updated_at?: string | null
        }
        Update: {
          assignment_type?: string
          created_at?: string | null
          day_index?: number
          day_type?: string
          excluded_leader_ids?: string[]
          id?: string
          is_locked?: boolean
          leader_id?: string | null
          note?: string | null
          role?: string | null
          schedule_id?: string
          shift_type_id?: string
          team_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_assignments_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "shift_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_shift_type_id_fkey"
            columns: ["shift_type_id"]
            isOneToOne: false
            referencedRelation: "shift_types"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_schedules: {
        Row: {
          generated_at: string | null
          generated_by: string | null
          id: string
          period_length: number
          period_number: number
          start_date: string | null
          status: string
          updated_at: string | null
          year: number
        }
        Insert: {
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          period_length?: number
          period_number: number
          start_date?: string | null
          status?: string
          updated_at?: string | null
          year?: number
        }
        Update: {
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          period_length?: number
          period_number?: number
          start_date?: string | null
          status?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "shift_schedules_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_types: {
        Row: {
          all_must_attend: boolean | null
          created_at: string | null
          day_type: string
          duration_hours: number
          end_time: string
          id: string
          min_leaders: number | null
          name: string
          requires_18_plus: boolean | null
          slug: string
          sort_order: number
          start_time: string
        }
        Insert: {
          all_must_attend?: boolean | null
          created_at?: string | null
          day_type: string
          duration_hours: number
          end_time: string
          id?: string
          min_leaders?: number | null
          name: string
          requires_18_plus?: boolean | null
          slug: string
          sort_order: number
          start_time: string
        }
        Update: {
          all_must_attend?: boolean | null
          created_at?: string | null
          day_type?: string
          duration_hours?: number
          end_time?: string
          id?: string
          min_leaders?: number | null
          name?: string
          requires_18_plus?: boolean | null
          slug?: string
          sort_order?: number
          start_time?: string
        }
        Relationships: []
      }
      special_duties: {
        Row: {
          created_at: string | null
          day_index: number
          duty_type: string
          id: string
          leader_id: string
          schedule_id: string
        }
        Insert: {
          created_at?: string | null
          day_index: number
          duty_type: string
          id?: string
          leader_id: string
          schedule_id: string
        }
        Update: {
          created_at?: string | null
          day_index?: number
          duty_type?: string
          id?: string
          leader_id?: string
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "special_duties_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_duties_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "shift_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title?: string
          updated_at?: string | null
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
      gjenglemt_public: {
        Row: {
          ai_description: string | null
          ai_status: string | null
          ai_tags: string[] | null
          color: string | null
          created_at: string | null
          garment_type: string | null
          id: string | null
          image_url: string | null
          notes: string | null
          period_id: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gjenglemt_items_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      leader_activities_public: {
        Row: {
          current_activity: string | null
          extra_activity: string | null
          leader_id: string | null
          updated_at: string | null
        }
        Insert: {
          current_activity?: string | null
          extra_activity?: string | null
          leader_id?: string | null
          updated_at?: string | null
        }
        Update: {
          current_activity?: string | null
          extra_activity?: string | null
          leader_id?: string | null
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
    }
    Functions: {
      current_leader_id: { Args: never; Returns: string }
      get_active_period_id: { Args: never; Returns: string }
      get_all_leader_roles: {
        Args: never
        Returns: {
          leader_id: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      get_my_roles: {
        Args: never
        Returns: {
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      has_role: {
        Args: {
          _leader_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_nurse: { Args: never; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "leader" | "nurse" | "superadmin"
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
      app_role: ["admin", "leader", "nurse", "superadmin"],
    },
  },
} as const
