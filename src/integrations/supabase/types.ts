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
      admin_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_pinned: boolean
          kind: string
          strokes: Json
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean
          kind?: string
          strokes?: Json
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean
          kind?: string
          strokes?: Json
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_pins: {
        Row: {
          created_at: string
          leader_id: string
          pin_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          leader_id: string
          pin_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          leader_id?: string
          pin_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_pins_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: true
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          period_id: string | null
          target_group: string | null
          title: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          period_id?: string | null
          target_group?: string | null
          title: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          period_id?: string | null
          target_group?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
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
      booking_edit_log: {
        Row: {
          booking_id: string
          changed_by: string | null
          changed_by_name: string | null
          created_at: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          participant_name: string | null
          period_id: string | null
        }
        Insert: {
          booking_id: string
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          participant_name?: string | null
          period_id?: string | null
        }
        Update: {
          booking_id?: string
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          participant_name?: string | null
          period_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_edit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      cabin_reports: {
        Row: {
          cabin_id: string
          content: string | null
          id: string
          period_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          cabin_id: string
          content?: string | null
          id?: string
          period_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          cabin_id?: string
          content?: string | null
          id?: string
          period_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cabin_reports_cabin_id_fkey"
            columns: ["cabin_id"]
            isOneToOne: false
            referencedRelation: "cabins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cabin_reports_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
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
      chat_mention_notifications: {
        Row: {
          created_at: string
          message_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
        }
        Update: {
          created_at?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_mention_notifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string
          channel: string
          created_at: string
          id: string
          leader_id: string
          mentions: string[]
          period_id: string | null
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          id?: string
          leader_id: string
          mentions?: string[]
          period_id?: string | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          id?: string
          leader_id?: string
          mentions?: string[]
          period_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      dynga_cards: {
        Row: {
          column_id: string
          created_at: string
          id: string
          participant_id: string
          period_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          column_id: string
          created_at?: string
          id?: string
          participant_id: string
          period_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          column_id?: string
          created_at?: string
          id?: string
          participant_id?: string
          period_id?: string | null
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
            referencedRelation: "kiosk_balances"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "dynga_cards_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dynga_cards_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      dynga_columns: {
        Row: {
          color: string
          created_at: string
          id: string
          period_id: string | null
          sort_order: number
          title: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          period_id?: string | null
          sort_order?: number
          title: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          period_id?: string | null
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "dynga_columns_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
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
          period_id: string | null
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
          period_id?: string | null
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
          period_id?: string | null
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
          {
            foreignKeyName: "fix_tasks_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      gjenglemt_items: {
        Row: {
          ai_description: string | null
          ai_status: string
          ai_tags: string[]
          bag_label: string | null
          color: string | null
          comment: string | null
          created_at: string
          created_by: string | null
          garment_type: string | null
          id: string
          image_url: string
          item_number: number | null
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
          bag_label?: string | null
          color?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          garment_type?: string | null
          id?: string
          image_url: string
          item_number?: number | null
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
          bag_label?: string | null
          color?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          garment_type?: string | null
          id?: string
          image_url?: string
          item_number?: number | null
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
      hookup_notifications: {
        Row: {
          created_at: string
          hookup_id: string
          id: string
          kind: string
        }
        Insert: {
          created_at?: string
          hookup_id: string
          id?: string
          kind: string
        }
        Update: {
          created_at?: string
          hookup_id?: string
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "hookup_notifications_hookup_id_fkey"
            columns: ["hookup_id"]
            isOneToOne: false
            referencedRelation: "leader_hookups"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_categories: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      kiosk_deposits: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          kind: string
          note: string | null
          participant_id: string
          period_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          note?: string | null
          participant_id: string
          period_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          note?: string | null
          participant_id?: string
          period_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_deposits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_deposits_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "kiosk_balances"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "kiosk_deposits_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_deposits_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_products: {
        Row: {
          category_id: string | null
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "kiosk_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_sale_items: {
        Row: {
          created_at: string
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id?: string | null
          product_name: string
          quantity?: number
          sale_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kiosk_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "kiosk_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_sales: {
        Row: {
          client_ref: string | null
          created_at: string
          id: string
          participant_id: string
          period_id: string | null
          sale_number: number | null
          sold_by: string | null
          total: number
          updated_at: string
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          client_ref?: string | null
          created_at?: string
          id?: string
          participant_id: string
          period_id?: string | null
          sale_number?: number | null
          sold_by?: string | null
          total?: number
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          client_ref?: string | null
          created_at?: string
          id?: string
          participant_id?: string
          period_id?: string | null
          sale_number?: number | null
          sold_by?: string | null
          total?: number
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_sales_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "kiosk_balances"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "kiosk_sales_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_sales_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_sales_sold_by_fkey"
            columns: ["sold_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_sales_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_item_checks: {
        Row: {
          checked_at: string
          checked_by: string | null
          created_at: string
          id: string
          item_id: string
          period_id: string | null
          updated_at: string
        }
        Insert: {
          checked_at?: string
          checked_by?: string | null
          created_at?: string
          id?: string
          item_id: string
          period_id?: string | null
          updated_at?: string
        }
        Update: {
          checked_at?: string
          checked_by?: string | null
          created_at?: string
          id?: string
          item_id?: string
          period_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_item_checks_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_item_checks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "kitchen_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_item_checks_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_items: {
        Row: {
          created_at: string
          hint: string | null
          id: string
          label: string
          section_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          hint?: string | null
          id?: string
          label: string
          section_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          hint?: string | null
          id?: string
          label?: string
          section_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "kitchen_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_sections: {
        Row: {
          body: string | null
          created_at: string
          icon: string | null
          id: string
          kind: string
          slug: string
          sort_order: number
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          kind?: string
          slug: string
          sort_order?: number
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          kind?: string
          slug?: string
          sort_order?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      leader_availability: {
        Row: {
          available: boolean
          created_at: string
          date: string
          from_time: string | null
          id: string
          note: string | null
          period_leader_id: string
          to_time: string | null
          updated_at: string
        }
        Insert: {
          available?: boolean
          created_at?: string
          date: string
          from_time?: string | null
          id?: string
          note?: string | null
          period_leader_id: string
          to_time?: string | null
          updated_at?: string
        }
        Update: {
          available?: boolean
          created_at?: string
          date?: string
          from_time?: string | null
          id?: string
          note?: string | null
          period_leader_id?: string
          to_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leader_availability_period_leader_id_fkey"
            columns: ["period_leader_id"]
            isOneToOne: false
            referencedRelation: "period_leaders"
            referencedColumns: ["id"]
          },
        ]
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
      leader_deviations: {
        Row: {
          created_at: string
          created_by: string | null
          hours: number | null
          id: string
          kind: string
          leader_id: string
          note: string | null
          occurred_on: string
          period_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          hours?: number | null
          id?: string
          kind?: string
          leader_id: string
          note?: string | null
          occurred_on?: string
          period_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          hours?: number | null
          id?: string
          kind?: string
          leader_id?: string
          note?: string | null
          occurred_on?: string
          period_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leader_deviations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leader_deviations_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leader_deviations_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      leader_hookups: {
        Row: {
          confirmed_at: string | null
          created_at: string
          id: string
          leader_a_id: string
          leader_b_id: string
          period_id: string | null
          requested_by: string
          status: string
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          id?: string
          leader_a_id: string
          leader_b_id: string
          period_id?: string | null
          requested_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          id?: string
          leader_a_id?: string
          leader_b_id?: string
          period_id?: string | null
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leader_hookups_leader_a_id_fkey"
            columns: ["leader_a_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leader_hookups_leader_b_id_fkey"
            columns: ["leader_b_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leader_hookups_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leader_hookups_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      leader_period_history: {
        Row: {
          created_at: string
          id: string
          leader_id: string
          note: string | null
          period_id: string
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          leader_id: string
          note?: string | null
          period_id: string
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          leader_id?: string
          note?: string | null
          period_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leader_period_history_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leader_period_history_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      leader_service_periods: {
        Row: {
          created_at: string
          id: string
          leader_id: string
          period_code: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          leader_id: string
          period_code: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          leader_id?: string
          period_code?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leader_service_periods_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
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
          gender: string | null
          has_boat_license: boolean | null
          has_car: boolean | null
          has_drivers_license: boolean | null
          has_seen_push_prompt: boolean
          id: string
          in_roulette: boolean
          is_active: boolean | null
          is_external: boolean
          last_app_edit_at: string
          last_synced_at: string | null
          ministerpost: string | null
          name: string
          phone: string
          profile_image_aged_url: string | null
          profile_image_url: string | null
          snus_custom_label: string | null
          snus_product_id: string | null
          snus_product_ids: string[]
          snus_user: boolean
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
          gender?: string | null
          has_boat_license?: boolean | null
          has_car?: boolean | null
          has_drivers_license?: boolean | null
          has_seen_push_prompt?: boolean
          id?: string
          in_roulette?: boolean
          is_active?: boolean | null
          is_external?: boolean
          last_app_edit_at?: string
          last_synced_at?: string | null
          ministerpost?: string | null
          name: string
          phone: string
          profile_image_aged_url?: string | null
          profile_image_url?: string | null
          snus_custom_label?: string | null
          snus_product_id?: string | null
          snus_product_ids?: string[]
          snus_user?: boolean
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
          gender?: string | null
          has_boat_license?: boolean | null
          has_car?: boolean | null
          has_drivers_license?: boolean | null
          has_seen_push_prompt?: boolean
          id?: string
          in_roulette?: boolean
          is_active?: boolean | null
          is_external?: boolean
          last_app_edit_at?: string
          last_synced_at?: string | null
          ministerpost?: string | null
          name?: string
          phone?: string
          profile_image_aged_url?: string | null
          profile_image_url?: string | null
          snus_custom_label?: string | null
          snus_product_id?: string | null
          snus_product_ids?: string[]
          snus_user?: boolean
          team?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      mailbox_messages: {
        Row: {
          admin_reply: string | null
          category: string
          content: string
          created_at: string
          id: string
          is_anonymous: boolean
          period_id: string | null
          read_at: string | null
          replied_at: string | null
          replied_by: string | null
          reply_seen_at: string | null
          sender_leader_id: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_reply?: string | null
          category?: string
          content: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          period_id?: string | null
          read_at?: string | null
          replied_at?: string | null
          replied_by?: string | null
          reply_seen_at?: string | null
          sender_leader_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_reply?: string | null
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          period_id?: string | null
          read_at?: string | null
          replied_at?: string | null
          replied_by?: string | null
          reply_seen_at?: string | null
          sender_leader_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mailbox_messages_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mailbox_messages_replied_by_fkey"
            columns: ["replied_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mailbox_messages_sender_leader_id_fkey"
            columns: ["sender_leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      murder_death_notifications: {
        Row: {
          claim_id: string
          created_at: string
          game_id: string
          id: string
          sent_count: number
          updated_at: string
          victim_leader_id: string
        }
        Insert: {
          claim_id: string
          created_at?: string
          game_id: string
          id?: string
          sent_count?: number
          updated_at?: string
          victim_leader_id: string
        }
        Update: {
          claim_id?: string
          created_at?: string
          game_id?: string
          id?: string
          sent_count?: number
          updated_at?: string
          victim_leader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "murder_death_notifications_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: true
            referencedRelation: "murder_kill_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "murder_death_notifications_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "murder_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "murder_death_notifications_victim_leader_id_fkey"
            columns: ["victim_leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      murder_games: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          period_id: string
          round_number: number
          started_at: string | null
          updated_at: string
          winner_leader_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          period_id: string
          round_number?: number
          started_at?: string | null
          updated_at?: string
          winner_leader_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          period_id?: string
          round_number?: number
          started_at?: string | null
          updated_at?: string
          winner_leader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "murder_games_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: true
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "murder_games_winner_leader_id_fkey"
            columns: ["winner_leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      murder_kill_claims: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          game_id: string
          id: string
          killer_leader_id: string
          status: string
          updated_at: string
          victim_leader_id: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          game_id: string
          id?: string
          killer_leader_id: string
          status?: string
          updated_at?: string
          victim_leader_id: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          game_id?: string
          id?: string
          killer_leader_id?: string
          status?: string
          updated_at?: string
          victim_leader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "murder_kill_claims_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "murder_kill_claims_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "murder_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "murder_kill_claims_killer_leader_id_fkey"
            columns: ["killer_leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "murder_kill_claims_victim_leader_id_fkey"
            columns: ["victim_leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      murder_players: {
        Row: {
          created_at: string
          game_id: string
          id: string
          is_alive: boolean
          killed_at: string | null
          killed_by: string | null
          kills: number
          leader_id: string
          ring_order: number | null
          target_leader_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          is_alive?: boolean
          killed_at?: string | null
          killed_by?: string | null
          kills?: number
          leader_id: string
          ring_order?: number | null
          target_leader_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          is_alive?: boolean
          killed_at?: string | null
          killed_by?: string | null
          kills?: number
          leader_id?: string
          ring_order?: number | null
          target_leader_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "murder_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "murder_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "murder_players_killed_by_fkey"
            columns: ["killed_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "murder_players_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "murder_players_target_leader_id_fkey"
            columns: ["target_leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      murder_round_snapshots: {
        Row: {
          archived_at: string
          archived_by: string | null
          created_at: string
          data: Json
          game_id: string | null
          id: string
          kill_count: number
          period_id: string | null
          player_count: number
          round_number: number
          updated_at: string
          winner_leader_id: string | null
        }
        Insert: {
          archived_at?: string
          archived_by?: string | null
          created_at?: string
          data?: Json
          game_id?: string | null
          id?: string
          kill_count?: number
          period_id?: string | null
          player_count?: number
          round_number?: number
          updated_at?: string
          winner_leader_id?: string | null
        }
        Update: {
          archived_at?: string
          archived_by?: string | null
          created_at?: string
          data?: Json
          game_id?: string | null
          id?: string
          kill_count?: number
          period_id?: string | null
          player_count?: number
          round_number?: number
          updated_at?: string
          winner_leader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "murder_round_snapshots_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "murder_round_snapshots_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "murder_round_snapshots_winner_leader_id_fkey"
            columns: ["winner_leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      nurse_incident_reviews: {
        Row: {
          created_at: string
          id: string
          incident_id: string
          mention_ids: string[]
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          incident_id: string
          mention_ids?: string[]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          incident_id?: string
          mention_ids?: string[]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nurse_incident_reviews_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: true
            referencedRelation: "participant_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nurse_incident_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
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
          period_id: string | null
          registered_by: string | null
        }
        Insert: {
          activity: string
          completed_at?: string | null
          id?: string
          participant_id: string
          period_id?: string | null
          registered_by?: string | null
        }
        Update: {
          activity?: string
          completed_at?: string | null
          id?: string
          participant_id?: string
          period_id?: string | null
          registered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participant_activities_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "kiosk_balances"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "participant_activities_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_activities_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
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
      participant_bonus_points: {
        Row: {
          activity_key: string
          activity_label: string
          awarded_by: string | null
          created_at: string
          id: string
          participant_id: string
          period_id: string
          points: number
          team_id: string | null
          variant: string
        }
        Insert: {
          activity_key: string
          activity_label: string
          awarded_by?: string | null
          created_at?: string
          id?: string
          participant_id: string
          period_id: string
          points: number
          team_id?: string | null
          variant: string
        }
        Update: {
          activity_key?: string
          activity_label?: string
          awarded_by?: string | null
          created_at?: string
          id?: string
          participant_id?: string
          period_id?: string
          points?: number
          team_id?: string | null
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_bonus_points_awarded_by_fkey"
            columns: ["awarded_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_bonus_points_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "kiosk_balances"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "participant_bonus_points_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_bonus_points_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_bonus_points_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "participant_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_bookings: {
        Row: {
          address: string | null
          birth_date: string | null
          booking_time: string | null
          cancelled_date: string | null
          created_at: string
          discount: number | null
          first_name: string | null
          friends: string | null
          gender: string | null
          guardian_email: string | null
          guardian_first_name: string | null
          guardian_last_name: string | null
          guardian_phone: string | null
          id: string
          invoiced_date: string | null
          kiosk_money: number | null
          last_name: string | null
          notes_info: string | null
          paid_date: string | null
          participant_id: string | null
          payment_reference: string | null
          payment_status: string | null
          period_id: string | null
          period_label: string | null
          postal_city: string | null
          postal_code: string | null
          prepayment: number | null
          price: number | null
          reservation_code: string | null
          reservation_number: string | null
          seat_confirmed: string | null
          status: string | null
          sweater_size: string | null
          times_attended: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          booking_time?: string | null
          cancelled_date?: string | null
          created_at?: string
          discount?: number | null
          first_name?: string | null
          friends?: string | null
          gender?: string | null
          guardian_email?: string | null
          guardian_first_name?: string | null
          guardian_last_name?: string | null
          guardian_phone?: string | null
          id?: string
          invoiced_date?: string | null
          kiosk_money?: number | null
          last_name?: string | null
          notes_info?: string | null
          paid_date?: string | null
          participant_id?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          period_id?: string | null
          period_label?: string | null
          postal_city?: string | null
          postal_code?: string | null
          prepayment?: number | null
          price?: number | null
          reservation_code?: string | null
          reservation_number?: string | null
          seat_confirmed?: string | null
          status?: string | null
          sweater_size?: string | null
          times_attended?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          booking_time?: string | null
          cancelled_date?: string | null
          created_at?: string
          discount?: number | null
          first_name?: string | null
          friends?: string | null
          gender?: string | null
          guardian_email?: string | null
          guardian_first_name?: string | null
          guardian_last_name?: string | null
          guardian_phone?: string | null
          id?: string
          invoiced_date?: string | null
          kiosk_money?: number | null
          last_name?: string | null
          notes_info?: string | null
          paid_date?: string | null
          participant_id?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          period_id?: string | null
          period_label?: string | null
          postal_city?: string | null
          postal_code?: string | null
          prepayment?: number | null
          price?: number | null
          reservation_code?: string | null
          reservation_number?: string | null
          seat_confirmed?: string | null
          status?: string | null
          sweater_size?: string | null
          times_attended?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_bookings_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "kiosk_balances"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "participant_bookings_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_bookings_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
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
            referencedRelation: "kiosk_balances"
            referencedColumns: ["participant_id"]
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
            referencedRelation: "kiosk_balances"
            referencedColumns: ["participant_id"]
          },
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
            referencedRelation: "kiosk_balances"
            referencedColumns: ["participant_id"]
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
      participant_incident_participants: {
        Row: {
          created_at: string
          incident_id: string
          participant_id: string
        }
        Insert: {
          created_at?: string
          incident_id: string
          participant_id: string
        }
        Update: {
          created_at?: string
          incident_id?: string
          participant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_incident_participants_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "participant_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_incident_participants_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "kiosk_balances"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "participant_incident_participants_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_incidents: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          leader_id: string
          period_id: string | null
          severity: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          leader_id: string
          period_id?: string | null
          severity?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          leader_id?: string
          period_id?: string | null
          severity?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_incidents_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_incidents_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_sweaters: {
        Row: {
          bought_at: string | null
          bought_on_camp: boolean
          bought_size: string | null
          created_at: string
          id: string
          participant_id: string
          period_id: string
          picked_up: boolean
          picked_up_at: string | null
          picked_up_size: string | null
          preordered_size: string | null
          updated_at: string
        }
        Insert: {
          bought_at?: string | null
          bought_on_camp?: boolean
          bought_size?: string | null
          created_at?: string
          id?: string
          participant_id: string
          period_id: string
          picked_up?: boolean
          picked_up_at?: string | null
          picked_up_size?: string | null
          preordered_size?: string | null
          updated_at?: string
        }
        Update: {
          bought_at?: string | null
          bought_on_camp?: boolean
          bought_size?: string | null
          created_at?: string
          id?: string
          participant_id?: string
          period_id?: string
          picked_up?: boolean
          picked_up_at?: string | null
          picked_up_size?: string | null
          preordered_size?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_sweaters_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "kiosk_balances"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "participant_sweaters_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_sweaters_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_tasks: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          is_broadcast: boolean
          message: string
          participant_id: string
          period_id: string | null
          read_at: string | null
          read_by: string | null
          status: string
          target_leader_id: string | null
          updated_at: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_broadcast?: boolean
          message: string
          participant_id: string
          period_id?: string | null
          read_at?: string | null
          read_by?: string | null
          status?: string
          target_leader_id?: string | null
          updated_at?: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_broadcast?: boolean
          message?: string
          participant_id?: string
          period_id?: string | null
          read_at?: string | null
          read_by?: string | null
          status?: string
          target_leader_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_tasks_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_tasks_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "kiosk_balances"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "participant_tasks_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_tasks_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_tasks_read_by_fkey"
            columns: ["read_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_tasks_target_leader_id_fkey"
            columns: ["target_leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_teams: {
        Row: {
          bonus_points: number
          color: string
          created_at: string
          id: string
          name: string
          period_id: string
          slot: number
          updated_at: string
        }
        Insert: {
          bonus_points?: number
          color: string
          created_at?: string
          id?: string
          name: string
          period_id: string
          slot: number
          updated_at?: string
        }
        Update: {
          bonus_points?: number
          color?: string
          created_at?: string
          id?: string
          name?: string
          period_id?: string
          slot?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_teams_period_id_fkey"
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
          gift_card_number: string | null
          has_arrived: boolean | null
          id: string
          image_aged_url: string | null
          image_thumb_url: string | null
          image_url: string | null
          insj_points: number
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
          team_id: string | null
          times_attended: number | null
          updated_at: string | null
        }
        Insert: {
          activity_notes?: string | null
          birth_date?: string | null
          cabin_id?: string | null
          created_at?: string | null
          first_name?: string | null
          gift_card_number?: string | null
          has_arrived?: boolean | null
          id?: string
          image_aged_url?: string | null
          image_thumb_url?: string | null
          image_url?: string | null
          insj_points?: number
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
          team_id?: string | null
          times_attended?: number | null
          updated_at?: string | null
        }
        Update: {
          activity_notes?: string | null
          birth_date?: string | null
          cabin_id?: string | null
          created_at?: string | null
          first_name?: string | null
          gift_card_number?: string | null
          has_arrived?: boolean | null
          id?: string
          image_aged_url?: string | null
          image_thumb_url?: string | null
          image_url?: string | null
          insj_points?: number
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
          team_id?: string | null
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
          {
            foreignKeyName: "participants_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "participant_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      period_leaders: {
        Row: {
          created_at: string
          id: string
          leader_id: string
          max_hours_per_day: number
          notes: string | null
          period_id: string
          period_number: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          leader_id: string
          max_hours_per_day?: number
          notes?: string | null
          period_id: string
          period_number: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          leader_id?: string
          max_hours_per_day?: number
          notes?: string | null
          period_id?: string
          period_number?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_leaders_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_leaders_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      periods: {
        Row: {
          archived_at: string | null
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
          archived_at?: string | null
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
          archived_at?: string | null
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
          period_id: string | null
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
          period_id?: string | null
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
          period_id?: string | null
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
            referencedRelation: "kiosk_balances"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "room_swaps_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_swaps_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
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
          period_id: string | null
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
          period_id?: string | null
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
          period_id?: string | null
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
          {
            foreignKeyName: "rope_controls_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      roulette_assignments: {
        Row: {
          assigned_at: string
          completed_at: string | null
          created_at: string
          id: string
          leader_id: string
          period_id: string | null
          status: string
          task_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          leader_id: string
          period_id?: string | null
          status?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          leader_id?: string
          period_id?: string | null
          status?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roulette_assignments_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roulette_assignments_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roulette_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "roulette_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      roulette_tasks: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roulette_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_generator_runs: {
        Row: {
          created_at: string
          id: string
          keep_locked: boolean
          run_at: string
          run_by: string | null
          schedule_id: string
          stats: Json
        }
        Insert: {
          created_at?: string
          id?: string
          keep_locked?: boolean
          run_at?: string
          run_by?: string | null
          schedule_id: string
          stats?: Json
        }
        Update: {
          created_at?: string
          id?: string
          keep_locked?: boolean
          run_at?: string
          run_by?: string | null
          schedule_id?: string
          stats?: Json
        }
        Relationships: [
          {
            foreignKeyName: "schedule_generator_runs_run_by_fkey"
            columns: ["run_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_generator_runs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "shift_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_post_assignments: {
        Row: {
          assigned_at: string
          assigned_manually: boolean
          created_at: string
          generator_run_id: string | null
          id: string
          is_locked: boolean
          period_leader_id: string
          post_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_manually?: boolean
          created_at?: string
          generator_run_id?: string | null
          id?: string
          is_locked?: boolean
          period_leader_id: string
          post_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_manually?: boolean
          created_at?: string
          generator_run_id?: string | null
          id?: string
          is_locked?: boolean
          period_leader_id?: string
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_post_assignments_period_leader_id_fkey"
            columns: ["period_leader_id"]
            isOneToOne: false
            referencedRelation: "period_leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_post_assignments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "schedule_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_posts: {
        Row: {
          created_at: string
          date: string
          duration_hours: number
          end_time: string
          id: string
          is_breakfast: boolean
          is_main_session: boolean
          is_night: boolean
          name: string
          notes: string | null
          required_leaders: number
          schedule_id: string
          shift_type_id: string | null
          slug: string | null
          sort_order: number
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          duration_hours: number
          end_time: string
          id?: string
          is_breakfast?: boolean
          is_main_session?: boolean
          is_night?: boolean
          name: string
          notes?: string | null
          required_leaders?: number
          schedule_id: string
          shift_type_id?: string | null
          slug?: string | null
          sort_order?: number
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          duration_hours?: number
          end_time?: string
          id?: string
          is_breakfast?: boolean
          is_main_session?: boolean
          is_night?: boolean
          name?: string
          notes?: string | null
          required_leaders?: number
          schedule_id?: string
          shift_type_id?: string | null
          slug?: string | null
          sort_order?: number
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_posts_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "shift_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_posts_shift_type_id_fkey"
            columns: ["shift_type_id"]
            isOneToOne: false
            referencedRelation: "shift_types"
            referencedColumns: ["id"]
          },
        ]
      }
      secret_word_assignments: {
        Row: {
          created_at: string
          id: string
          pair_id: string
          participant_id: string
          period_id: string
          slot: number
          word: string
        }
        Insert: {
          created_at?: string
          id?: string
          pair_id: string
          participant_id: string
          period_id: string
          slot: number
          word: string
        }
        Update: {
          created_at?: string
          id?: string
          pair_id?: string
          participant_id?: string
          period_id?: string
          slot?: number
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "secret_word_assignments_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "secret_word_pairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secret_word_assignments_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "kiosk_balances"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "secret_word_assignments_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secret_word_assignments_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      secret_word_matches: {
        Row: {
          id: string
          matched_at: string
          matched_by: string | null
          pair_id: string
          participant_a_id: string
          participant_b_id: string
          period_id: string
        }
        Insert: {
          id?: string
          matched_at?: string
          matched_by?: string | null
          pair_id: string
          participant_a_id: string
          participant_b_id: string
          period_id: string
        }
        Update: {
          id?: string
          matched_at?: string
          matched_by?: string | null
          pair_id?: string
          participant_a_id?: string
          participant_b_id?: string
          period_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secret_word_matches_matched_by_fkey"
            columns: ["matched_by"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secret_word_matches_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "secret_word_pairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secret_word_matches_participant_a_id_fkey"
            columns: ["participant_a_id"]
            isOneToOne: false
            referencedRelation: "kiosk_balances"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "secret_word_matches_participant_a_id_fkey"
            columns: ["participant_a_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secret_word_matches_participant_b_id_fkey"
            columns: ["participant_b_id"]
            isOneToOne: false
            referencedRelation: "kiosk_balances"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "secret_word_matches_participant_b_id_fkey"
            columns: ["participant_b_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secret_word_matches_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      secret_word_pairs: {
        Row: {
          created_at: string
          id: string
          word_1: string
          word_2: string
        }
        Insert: {
          created_at?: string
          id?: string
          word_1: string
          word_2: string
        }
        Update: {
          created_at?: string
          id?: string
          word_1?: string
          word_2?: string
        }
        Relationships: []
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
      shift_planner_mini_assignments: {
        Row: {
          created_at: string
          day_index: number
          id: string
          leader_id: string
          shift_id: string
        }
        Insert: {
          created_at?: string
          day_index: number
          id?: string
          leader_id: string
          shift_id: string
        }
        Update: {
          created_at?: string
          day_index?: number
          id?: string
          leader_id?: string
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_planner_mini_assignments_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_planner_mini_assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shift_planner_mini_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_planner_mini_shifts: {
        Row: {
          created_at: string
          end_time: string
          id: string
          min_leaders: number
          name: string
          sort_order: number
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          min_leaders?: number
          name: string
          sort_order?: number
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          min_leaders?: number
          name?: string
          sort_order?: number
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      shift_schedules: {
        Row: {
          generated_at: string | null
          generated_by: string | null
          id: string
          is_published: boolean
          period_id: string | null
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
          is_published?: boolean
          period_id?: string | null
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
          is_published?: boolean
          period_id?: string | null
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
          {
            foreignKeyName: "shift_schedules_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
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
          period_id: string | null
          sort_order: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          period_id?: string | null
          sort_order?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          period_id?: string | null
          sort_order?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stories_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
      }
      team_kitchen_duty: {
        Row: {
          created_at: string
          id: string
          manual_override_date: string | null
          manual_override_slot_a: number | null
          manual_override_slot_b: number | null
          period_id: string
          rotation_start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          manual_override_date?: string | null
          manual_override_slot_a?: number | null
          manual_override_slot_b?: number | null
          period_id: string
          rotation_start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          manual_override_date?: string | null
          manual_override_slot_a?: number | null
          manual_override_slot_b?: number | null
          period_id?: string
          rotation_start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_kitchen_duty_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: true
            referencedRelation: "periods"
            referencedColumns: ["id"]
          },
        ]
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
          bag_label: string | null
          color: string | null
          created_at: string | null
          garment_type: string | null
          id: string | null
          image_url: string | null
          item_number: number | null
          notes: string | null
          owner_name: string | null
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
      kiosk_balances: {
        Row: {
          balance: number | null
          deposited: number | null
          participant_id: string | null
          period_id: string | null
          spent: number | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_period_id_fkey"
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
      add_external_leader: {
        Args: { _gender?: string; _name: string }
        Returns: string
      }
      add_murder_player: { Args: { _leader_id: string }; Returns: undefined }
      archive_murder_round: { Args: never; Returns: string }
      claim_murder_kill: { Args: never; Returns: string }
      claim_participant_task: { Args: { _task_id: string }; Returns: boolean }
      confirm_murder_death: { Args: { _claim_id?: string }; Returns: undefined }
      current_leader_id: { Args: never; Returns: string }
      edit_kiosk_sale: {
        Args: { _items: Json; _sale_id: string }
        Returns: undefined
      }
      get_active_period_id: { Args: never; Returns: string }
      get_all_leader_roles: {
        Args: never
        Returns: {
          leader_id: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      get_archive_participants: {
        Args: { _period_id: string }
        Returns: {
          birth_date: string
          cabin_id: string
          has_arrived: boolean
          id: string
          image_thumb_url: string
          image_url: string
          insj_points: number
          name: string
          notes: string
          pass_written: boolean
          room: string
          team_id: string
          times_attended: number
        }[]
      }
      get_kitchen_allergy_notes: {
        Args: never
        Returns: {
          booking_notes: string
          cabin_name: string
          health_info: string
          name: string
          participant_id: string
          participant_notes: string
          room: string
        }[]
      }
      get_murder_overview: {
        Args: never
        Returns: {
          is_alive: boolean
          killed_at: string
          killed_by: string
          kills: number
          leader_id: string
          leader_name: string
          ring_order: number
          target_leader_id: string
        }[]
      }
      get_my_murder_state: {
        Args: never
        Returns: {
          alive_count: number
          game_id: string
          incoming_claim_id: string
          incoming_claim_killer_name: string
          is_active: boolean
          is_alive: boolean
          killed_by_name: string
          kills: number
          pending_claim_id: string
          pending_claim_victim_name: string
          target_image_url: string
          target_leader_id: string
          target_name: string
          total_count: number
          winner_leader_id: string
        }[]
      }
      get_my_roles: {
        Args: never
        Returns: {
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      get_my_unread_badge: { Args: { _leader_id?: string }; Returns: number }
      get_season_participants: {
        Args: never
        Returns: {
          activity_notes: string
          birth_date: string
          cabin_id: string
          created_at: string
          first_name: string
          has_arrived: boolean
          id: string
          image_thumb_url: string
          image_url: string
          insj_points: number
          last_name: string
          name: string
          notes: string
          pass_suggestion: string
          pass_text: string
          pass_written: boolean
          period_id: string
          period_name: string
          room: string
          team_id: string
          times_attended: number
          updated_at: string
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
      is_kitchen: { Args: never; Returns: boolean }
      is_nurse: { Args: never; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      mark_fix_task_fixed: { Args: { _task_id: string }; Returns: undefined }
      record_kiosk_sale: {
        Args: { _client_ref?: string; _items: Json; _participant_id: string }
        Returns: string
      }
      revive_and_reshuffle_murder: {
        Args: { _count?: number }
        Returns: {
          leader_id: string
          leader_name: string
          was_revived: boolean
        }[]
      }
      set_murder_game_active: { Args: { _active: boolean }; Returns: undefined }
      start_murder_game: { Args: { _leader_ids: string[] }; Returns: string }
      void_kiosk_sale: { Args: { _sale_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "leader" | "nurse" | "superadmin" | "kitchen"
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
      app_role: ["admin", "leader", "nurse", "superadmin", "kitchen"],
    },
  },
} as const
