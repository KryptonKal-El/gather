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
      collection_shares: {
        Row: {
          added_at: string
          collection_id: string
          id: string
          permission: string
          shared_by: string
          shared_with_email: string
        }
        Insert: {
          added_at?: string
          collection_id: string
          id?: string
          permission?: string
          shared_by: string
          shared_with_email: string
        }
        Update: {
          added_at?: string
          collection_id?: string
          id?: string
          permission?: string
          shared_by?: string
          shared_with_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_shares_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_shares_shared_by_fkey"
            columns: ["shared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          description: string | null
          emoji: string | null
          id: string
          is_default: boolean
          name: string
          owner_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          is_default?: boolean
          name: string
          owner_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          is_default?: boolean
          name?: string
          owner_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cook_session_steps: {
        Row: {
          completed_at: string | null
          id: string
          instruction: string
          session_id: string
          sort_order: number
        }
        Insert: {
          completed_at?: string | null
          id?: string
          instruction: string
          session_id: string
          sort_order?: number
        }
        Update: {
          completed_at?: string | null
          id?: string
          instruction?: string
          session_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "cook_session_steps_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cook_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cook_sessions: {
        Row: {
          completed_at: string | null
          current_step: number
          id: string
          notes: string | null
          recipe_id: string
          started_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          current_step?: number
          id?: string
          notes?: string | null
          recipe_id: string
          started_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          current_step?: number
          id?: string
          notes?: string | null
          recipe_id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cook_sessions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cook_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      history: {
        Row: {
          added_at: string | null
          category: string | null
          id: string
          image_url: string | null
          list_id: string | null
          name: string
          note: string | null
          price: number | null
          quantity: number | null
          store_id: string | null
          unit: string | null
          user_id: string
        }
        Insert: {
          added_at?: string | null
          category?: string | null
          id?: string
          image_url?: string | null
          list_id?: string | null
          name: string
          note?: string | null
          price?: number | null
          quantity?: number | null
          store_id?: string | null
          unit?: string | null
          user_id: string
        }
        Update: {
          added_at?: string | null
          category?: string | null
          id?: string
          image_url?: string | null
          list_id?: string | null
          name?: string
          note?: string | null
          price?: number | null
          quantity?: number | null
          store_id?: string | null
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "history_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "history_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          added_at: string | null
          category: string | null
          checked_at: string | null
          created_by: string | null
          due_date: string | null
          id: string
          image_url: string | null
          is_checked: boolean | null
          list_id: string
          name: string
          note: string | null
          parent_item_id: string | null
          price: number | null
          quantity: number | null
          recurrence_rule: Json | null
          reminder_days_before: number | null
          reminder_sent_at: string | null
          rsvp_status: string | null
          store_id: string | null
          unit: string
        }
        Insert: {
          added_at?: string | null
          category?: string | null
          checked_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string
          image_url?: string | null
          is_checked?: boolean | null
          list_id: string
          name: string
          note?: string | null
          parent_item_id?: string | null
          price?: number | null
          quantity?: number | null
          recurrence_rule?: Json | null
          reminder_days_before?: number | null
          reminder_sent_at?: string | null
          rsvp_status?: string | null
          store_id?: string | null
          unit?: string
        }
        Update: {
          added_at?: string | null
          category?: string | null
          checked_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string
          image_url?: string | null
          is_checked?: boolean | null
          list_id?: string
          name?: string
          note?: string | null
          parent_item_id?: string | null
          price?: number | null
          quantity?: number | null
          recurrence_rule?: Json | null
          reminder_days_before?: number | null
          reminder_sent_at?: string | null
          rsvp_status?: string | null
          store_id?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      list_audit_events: {
        Row: {
          actor_id: string
          created_at: string
          event_type: string
          id: string
          list_id: string
          metadata: Json
        }
        Insert: {
          actor_id: string
          created_at?: string
          event_type: string
          id?: string
          list_id: string
          metadata?: Json
        }
        Update: {
          actor_id?: string
          created_at?: string
          event_type?: string
          id?: string
          list_id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "list_audit_events_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      list_notification_preferences: {
        Row: {
          collaborator_joined: boolean
          created_at: string
          id: string
          item_added: boolean
          item_checked: boolean
          list_id: string
          rsvp_changed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          collaborator_joined?: boolean
          created_at?: string
          id?: string
          item_added?: boolean
          item_checked?: boolean
          list_id: string
          rsvp_changed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          collaborator_joined?: boolean
          created_at?: string
          id?: string
          item_added?: boolean
          item_checked?: boolean
          list_id?: string
          rsvp_changed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_notification_preferences_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      list_shares: {
        Row: {
          added_at: string | null
          id: string
          list_id: string
          shared_with_email: string
          sort_config: Json | null
        }
        Insert: {
          added_at?: string | null
          id?: string
          list_id: string
          shared_with_email: string
          sort_config?: Json | null
        }
        Update: {
          added_at?: string | null
          id?: string
          list_id?: string
          shared_with_email?: string
          sort_config?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "list_shares_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          categories: Json | null
          color: string
          created_at: string | null
          emoji: string | null
          id: string
          item_count: number | null
          name: string
          owner_id: string
          sort_config: Json | null
          sort_order: number | null
          type: string
        }
        Insert: {
          categories?: Json | null
          color?: string
          created_at?: string | null
          emoji?: string | null
          id?: string
          item_count?: number | null
          name: string
          owner_id: string
          sort_config?: Json | null
          sort_order?: number | null
          type?: string
        }
        Update: {
          categories?: Json | null
          color?: string
          created_at?: string | null
          emoji?: string | null
          id?: string
          item_count?: number | null
          name?: string
          owner_id?: string
          sort_config?: Json | null
          sort_order?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lists_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_deals: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          details: string | null
          id: string
          is_active: boolean
          last_checked_on: string | null
          meal_plan_id: string
          meals: string[]
          restaurant: string
          updated_at: string
          weekdays: number[]
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          details?: string | null
          id?: string
          is_active?: boolean
          last_checked_on?: string | null
          meal_plan_id: string
          meals?: string[]
          restaurant: string
          updated_at?: string
          weekdays: number[]
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          details?: string | null
          id?: string
          is_active?: boolean
          last_checked_on?: string | null
          meal_plan_id?: string
          meals?: string[]
          restaurant?: string
          updated_at?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_deals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_deals_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_entries: {
        Row: {
          cooked_at: string | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          is_locked: boolean
          kind: string
          meal: string
          meal_plan_id: string
          note: string | null
          recipe_id: string | null
          source: string
          suggestion_reason: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          cooked_at?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          is_locked?: boolean
          kind: string
          meal: string
          meal_plan_id: string
          note?: string | null
          recipe_id?: string | null
          source?: string
          suggestion_reason?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          cooked_at?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          is_locked?: boolean
          kind?: string
          meal?: string
          meal_plan_id?: string
          note?: string | null
          recipe_id?: string | null
          source?: string
          suggestion_reason?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_entries_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_entries_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_feedback: {
        Row: {
          created_at: string
          created_by: string | null
          event: string
          id: string
          meal_plan_id: string
          recipe_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event: string
          id?: string
          meal_plan_id: string
          recipe_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event?: string
          id?: string
          meal_plan_id?: string
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_feedback_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_feedback_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_feedback_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_shares: {
        Row: {
          added_at: string
          id: string
          meal_plan_id: string
          permission: string
          shared_by: string
          shared_with_email: string
        }
        Insert: {
          added_at?: string
          id?: string
          meal_plan_id: string
          permission?: string
          shared_by: string
          shared_with_email: string
        }
        Update: {
          added_at?: string
          id?: string
          meal_plan_id?: string
          permission?: string
          shared_by?: string
          shared_with_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_shares_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_shares_shared_by_fkey"
            columns: ["shared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          created_at: string
          enabled_meals: string[]
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled_meals?: string[]
          id?: string
          name?: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled_meals?: string[]
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
          image_search_settings: Json
          timezone: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          image_search_settings?: Json
          timezone?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          image_search_settings?: Json
          timezone?: string | null
        }
        Relationships: []
      }
      recipe_attributes: {
        Row: {
          auto_source_hash: string | null
          auto_tagged_at: string | null
          course: string | null
          cuisine: string | null
          effort: string | null
          kid_friendly: boolean | null
          manual_fields: string[]
          meal_types: string[]
          method: string | null
          perishables: string[]
          protein: string | null
          recipe_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_source_hash?: string | null
          auto_tagged_at?: string | null
          course?: string | null
          cuisine?: string | null
          effort?: string | null
          kid_friendly?: boolean | null
          manual_fields?: string[]
          meal_types?: string[]
          method?: string | null
          perishables?: string[]
          protein?: string | null
          recipe_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_source_hash?: string | null
          auto_tagged_at?: string | null
          course?: string | null
          cuisine?: string | null
          effort?: string | null
          kid_friendly?: boolean | null
          manual_fields?: string[]
          meal_types?: string[]
          method?: string | null
          perishables?: string[]
          protein?: string | null
          recipe_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_attributes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: true
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_attributes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          id: string
          name: string
          quantity: string | null
          recipe_id: string
          sort_order: number | null
        }
        Insert: {
          id?: string
          name: string
          quantity?: string | null
          recipe_id: string
          sort_order?: number | null
        }
        Update: {
          id?: string
          name?: string
          quantity?: string | null
          recipe_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_shares_archive: {
        Row: {
          added_at: string | null
          id: string
          recipe_id: string
          shared_with_email: string
        }
        Insert: {
          added_at?: string | null
          id?: string
          recipe_id: string
          shared_with_email: string
        }
        Update: {
          added_at?: string | null
          id?: string
          recipe_id?: string
          shared_with_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_shares_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_steps: {
        Row: {
          id: string
          instruction: string
          recipe_id: string
          sort_order: number | null
        }
        Insert: {
          id?: string
          instruction: string
          recipe_id: string
          sort_order?: number | null
        }
        Update: {
          id?: string
          instruction?: string
          recipe_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_steps_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          collection_id: string
          cook_count: number
          cook_time: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          ingredient_count: number | null
          last_cooked_at: string | null
          name: string
          owner_id: string
          prep_time: string | null
          servings: number | null
          source_name: string | null
          source_url: string | null
          step_count: number | null
          updated_at: string | null
        }
        Insert: {
          collection_id: string
          cook_count?: number
          cook_time?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          ingredient_count?: number | null
          last_cooked_at?: string | null
          name: string
          owner_id: string
          prep_time?: string | null
          servings?: number | null
          source_name?: string | null
          source_url?: string | null
          step_count?: number | null
          updated_at?: string | null
        }
        Update: {
          collection_id?: string
          cook_count?: number
          cook_time?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          ingredient_count?: number | null
          last_cooked_at?: string | null
          name?: string
          owner_id?: string
          prep_time?: string | null
          servings?: number | null
          source_name?: string | null
          source_url?: string | null
          step_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          list_id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          list_id: string
          name: string
          sort_order?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          list_id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      user_category_defaults: {
        Row: {
          categories: Json
          created_at: string | null
          id: string
          list_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          categories: Json
          created_at?: string | null
          id?: string
          list_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          categories?: Json
          created_at?: string | null
          id?: string
          list_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string | null
          default_sort_config: Json
          last_list_id: string | null
          list_order: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          default_sort_config?: Json
          last_list_id?: string | null
          list_order?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          default_sort_config?: Json
          last_list_id?: string | null
          list_order?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_last_list_id_fkey"
            columns: ["last_list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      user_store_defaults: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          list_type: string
          name: string
          sort_order: number | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          list_type: string
          name: string
          sort_order?: number | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          list_type?: string
          name?: string
          sort_order?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_store_defaults_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_next_due_date: {
        Args: { from_date: string; rule: Json }
        Returns: string
      }
      can_write_meal_plan: { Args: { plan_uuid: string }; Returns: boolean }
      get_collection_collaborators: {
        Args: { p_collection_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          user_id: string
        }[]
      }
      get_list_collaborators: {
        Args: { p_list_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          user_id: string
        }[]
      }
      get_meal_plan_collaborators: {
        Args: { p_meal_plan_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          user_id: string
        }[]
      }
      has_collection_write_permission: {
        Args: { collection_uuid: string }
        Returns: boolean
      }
      has_notification_subscribers: {
        Args: { p_list_id: string }
        Returns: boolean
      }
      has_recipe_read_access: {
        Args: { recipe_uuid: string }
        Returns: boolean
      }
      has_recipe_write_access: {
        Args: { recipe_uuid: string }
        Returns: boolean
      }
      increment_item_count: {
        Args: { amount: number; p_list_id: string }
        Returns: undefined
      }
      is_collection_owner: {
        Args: { collection_uuid: string }
        Returns: boolean
      }
      is_collection_shared_with_me: {
        Args: { collection_uuid: string }
        Returns: boolean
      }
      is_list_owner: { Args: { p_list_id: string }; Returns: boolean }
      is_list_shared_with_me: { Args: { p_list_id: string }; Returns: boolean }
      is_meal_plan_member: { Args: { plan_uuid: string }; Returns: boolean }
      is_meal_plan_owner: { Args: { plan_uuid: string }; Returns: boolean }
      is_recipe_in_my_meal_plan: {
        Args: { recipe_uuid: string }
        Returns: boolean
      }
      is_recipe_owner: { Args: { recipe_uuid: string }; Returns: boolean }
      reset_guest_list_rsvp: { Args: { p_list_id: string }; Returns: number }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
