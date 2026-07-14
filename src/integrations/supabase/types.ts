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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          ip: string | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
          workspace_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          ip?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
          workspace_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          ip?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          created_at: string
          error: string | null
          event_id: string | null
          event_name: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          subscription_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_id?: string | null
          event_name: string
          id?: string
          payload: Json
          processed_at?: string | null
          provider?: string
          subscription_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event_id?: string | null
          event_name?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          subscription_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_authors: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          id: string
          linkedin: string | null
          slug: string
          title: string | null
          twitter: string | null
          updated_at: string
          user_id: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          id?: string
          linkedin?: string | null
          slug: string
          title?: string | null
          twitter?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          id?: string
          linkedin?: string | null
          slug?: string
          title?: string | null
          twitter?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      blog_categories: {
        Row: {
          created_at: string
          description: string | null
          hero_image_url: string | null
          id: string
          name: string
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          hero_image_url?: string | null
          id?: string
          name: string
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          hero_image_url?: string | null
          id?: string
          name?: string
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      blog_media: {
        Row: {
          alt: string | null
          caption: string | null
          created_at: string
          created_by: string | null
          credit: string | null
          external_url: string | null
          height: number | null
          id: string
          mime_type: string | null
          source: string | null
          storage_path: string | null
          updated_at: string
          width: number | null
        }
        Insert: {
          alt?: string | null
          caption?: string | null
          created_at?: string
          created_by?: string | null
          credit?: string | null
          external_url?: string | null
          height?: number | null
          id?: string
          mime_type?: string | null
          source?: string | null
          storage_path?: string | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          alt?: string | null
          caption?: string | null
          created_at?: string
          created_by?: string | null
          credit?: string | null
          external_url?: string | null
          height?: number | null
          id?: string
          mime_type?: string | null
          source?: string | null
          storage_path?: string | null
          updated_at?: string
          width?: number | null
        }
        Relationships: []
      }
      blog_post_tags: {
        Row: {
          post_id: string
          tag_id: string
        }
        Insert: {
          post_id: string
          tag_id: string
        }
        Update: {
          post_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_post_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "blog_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          affiliate_blocks: Json
          affiliate_enabled: boolean
          author_id: string | null
          body_html: string | null
          body_md: string
          canonical_url: string | null
          category_id: string | null
          cover_image_alt: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          excerpt: string | null
          faq: Json
          id: string
          keywords: string[]
          og_description: string | null
          og_image_url: string | null
          og_title: string | null
          published_at: string | null
          reading_time_min: number
          scheduled_for: string | null
          schema_jsonld: Json | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: Database["public"]["Enums"]["blog_post_status"]
          title: string
          twitter_description: string | null
          twitter_title: string | null
          updated_at: string
          view_count: number
        }
        Insert: {
          affiliate_blocks?: Json
          affiliate_enabled?: boolean
          author_id?: string | null
          body_html?: string | null
          body_md?: string
          canonical_url?: string | null
          category_id?: string | null
          cover_image_alt?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          faq?: Json
          id?: string
          keywords?: string[]
          og_description?: string | null
          og_image_url?: string | null
          og_title?: string | null
          published_at?: string | null
          reading_time_min?: number
          scheduled_for?: string | null
          schema_jsonld?: Json | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: Database["public"]["Enums"]["blog_post_status"]
          title: string
          twitter_description?: string | null
          twitter_title?: string | null
          updated_at?: string
          view_count?: number
        }
        Update: {
          affiliate_blocks?: Json
          affiliate_enabled?: boolean
          author_id?: string | null
          body_html?: string | null
          body_md?: string
          canonical_url?: string | null
          category_id?: string | null
          cover_image_alt?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          faq?: Json
          id?: string
          keywords?: string[]
          og_description?: string | null
          og_image_url?: string | null
          og_title?: string | null
          published_at?: string | null
          reading_time_min?: number
          scheduled_for?: string | null
          schema_jsonld?: Json | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["blog_post_status"]
          title?: string
          twitter_description?: string | null
          twitter_title?: string | null
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "blog_authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_revisions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          post_id: string
          snapshot: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          post_id: string
          snapshot: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          post_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "blog_revisions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_tags: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      checkout_sessions: {
        Row: {
          created_at: string
          fulfilled_workspace_id: string | null
          id: string
          ls_checkout_id: string | null
          ls_checkout_url: string | null
          organization_name: string
          plan_id: string
          status: string
          updated_at: string
          user_id: string
          workspace_name: string
        }
        Insert: {
          created_at?: string
          fulfilled_workspace_id?: string | null
          id?: string
          ls_checkout_id?: string | null
          ls_checkout_url?: string | null
          organization_name: string
          plan_id: string
          status?: string
          updated_at?: string
          user_id: string
          workspace_name: string
        }
        Update: {
          created_at?: string
          fulfilled_workspace_id?: string | null
          id?: string
          ls_checkout_id?: string | null
          ls_checkout_url?: string | null
          organization_name?: string
          plan_id?: string
          status?: string
          updated_at?: string
          user_id?: string
          workspace_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_sessions_fulfilled_workspace_id_fkey"
            columns: ["fulfilled_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          currency: string | null
          email: string | null
          external_id: string | null
          id: string
          locale: string | null
          metadata: Json
          name: string | null
          phone: string | null
          provider: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          email?: string | null
          external_id?: string | null
          id?: string
          locale?: string | null
          metadata?: Json
          name?: string | null
          phone?: string | null
          provider?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          email?: string | null
          external_id?: string | null
          id?: string
          locale?: string | null
          metadata?: Json
          name?: string | null
          phone?: string | null
          provider?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json
          created_at: string
          credentials_ciphertext: string | null
          display_name: string | null
          health: string | null
          id: string
          kind: Database["public"]["Enums"]["integration_kind"]
          last_error: string | null
          last_verified_at: string | null
          provider: string
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          credentials_ciphertext?: string | null
          display_name?: string | null
          health?: string | null
          id?: string
          kind: Database["public"]["Enums"]["integration_kind"]
          last_error?: string | null
          last_verified_at?: string | null
          provider: string
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          credentials_ciphertext?: string | null
          display_name?: string | null
          health?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["integration_kind"]
          last_error?: string | null
          last_verified_at?: string | null
          provider?: string
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_email: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          billing_email?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          billing_email?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          code: string
          created_at: string
          currency: string
          description: string | null
          features: Json
          id: string
          interval: string
          is_active: boolean
          ls_product_id: string | null
          ls_variant_id: string
          name: string
          price_cents: number
          sort_order: number
          trial_days: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          interval?: string
          is_active?: boolean
          ls_product_id?: string | null
          ls_variant_id: string
          name: string
          price_cents?: number
          sort_order?: number
          trial_days?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          interval?: string
          is_active?: boolean
          ls_product_id?: string | null
          ls_variant_id?: string
          name?: string
          price_cents?: number
          sort_order?: number
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recovery_attempts: {
        Row: {
          ai_completion_tokens: number | null
          ai_model: string | null
          ai_prompt_tokens: number | null
          body_html: string | null
          body_text: string | null
          channel: Database["public"]["Enums"]["recovery_channel"]
          created_at: string
          delivered_at: string | null
          error: string | null
          event_id: string
          id: string
          provider_message_id: string | null
          provider_response: Json
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["recovery_attempt_status"]
          step: number
          subject: string | null
          to_address: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ai_completion_tokens?: number | null
          ai_model?: string | null
          ai_prompt_tokens?: number | null
          body_html?: string | null
          body_text?: string | null
          channel: Database["public"]["Enums"]["recovery_channel"]
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          event_id: string
          id?: string
          provider_message_id?: string | null
          provider_response?: Json
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["recovery_attempt_status"]
          step?: number
          subject?: string | null
          to_address?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ai_completion_tokens?: number | null
          ai_model?: string | null
          ai_prompt_tokens?: number | null
          body_html?: string | null
          body_text?: string | null
          channel?: Database["public"]["Enums"]["recovery_channel"]
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          event_id?: string
          id?: string
          provider_message_id?: string | null
          provider_response?: Json
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["recovery_attempt_status"]
          step?: number
          subject?: string | null
          to_address?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_attempts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "recovery_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recovery_attempts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_events: {
        Row: {
          abandoned_at: string | null
          ai_analysis: Json
          ai_summary: string | null
          amount_cents: number | null
          attempts_count: number
          cadence_step: number
          created_at: string
          currency: string | null
          customer_id: string | null
          external_event_id: string | null
          external_object_id: string | null
          failure_category: string | null
          failure_code: string | null
          failure_message: string | null
          id: string
          next_action: string | null
          next_run_at: string | null
          object_type: string | null
          provider: string
          raw: Json
          recovered_at: string | null
          status: Database["public"]["Enums"]["recovery_event_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          abandoned_at?: string | null
          ai_analysis?: Json
          ai_summary?: string | null
          amount_cents?: number | null
          attempts_count?: number
          cadence_step?: number
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          external_event_id?: string | null
          external_object_id?: string | null
          failure_category?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          next_action?: string | null
          next_run_at?: string | null
          object_type?: string | null
          provider?: string
          raw?: Json
          recovered_at?: string | null
          status?: Database["public"]["Enums"]["recovery_event_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          abandoned_at?: string | null
          ai_analysis?: Json
          ai_summary?: string | null
          amount_cents?: number | null
          attempts_count?: number
          cadence_step?: number
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          external_event_id?: string | null
          external_object_id?: string | null
          failure_category?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          next_action?: string | null
          next_run_at?: string | null
          object_type?: string | null
          provider?: string
          raw?: Json
          recovered_at?: string | null
          status?: Database["public"]["Enums"]["recovery_event_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recovery_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_templates: {
        Row: {
          body_html: string | null
          body_text: string | null
          channel: Database["public"]["Enums"]["recovery_channel"]
          created_at: string
          enabled: boolean
          id: string
          step: number
          subject: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          channel: Database["public"]["Enums"]["recovery_channel"]
          created_at?: string
          enabled?: boolean
          id?: string
          step: number
          subject?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          channel?: Database["public"]["Enums"]["recovery_channel"]
          created_at?: string
          enabled?: boolean
          id?: string
          step?: number
          subject?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          card_brand: string | null
          card_last_four: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          customer_portal_url: string | null
          ends_at: string | null
          id: string
          ls_customer_id: string | null
          ls_order_id: string | null
          ls_subscription_id: string | null
          ls_variant_id: string | null
          plan_id: string | null
          raw: Json
          renews_at: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          update_payment_url: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          cancelled_at?: string | null
          card_brand?: string | null
          card_last_four?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          customer_portal_url?: string | null
          ends_at?: string | null
          id?: string
          ls_customer_id?: string | null
          ls_order_id?: string | null
          ls_subscription_id?: string | null
          ls_variant_id?: string | null
          plan_id?: string | null
          raw?: Json
          renews_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          update_payment_url?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          cancelled_at?: string | null
          card_brand?: string | null
          card_last_four?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          customer_portal_url?: string | null
          ends_at?: string | null
          id?: string
          ls_customer_id?: string | null
          ls_order_id?: string | null
          ls_subscription_id?: string | null
          ls_variant_id?: string | null
          plan_id?: string | null
          raw?: Json
          renews_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          update_payment_url?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["workspace_role"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          plan_id: string | null
          recovery_engine_enabled: boolean
          setup_completed_at: string | null
          setup_step: number
          slug: string
          status: Database["public"]["Enums"]["workspace_status"]
          subscription_id: string | null
          subscription_status: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          plan_id?: string | null
          recovery_engine_enabled?: boolean
          setup_completed_at?: string | null
          setup_step?: number
          slug: string
          status?: Database["public"]["Enums"]["workspace_status"]
          subscription_id?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          plan_id?: string | null
          recovery_engine_enabled?: boolean
          setup_completed_at?: string | null
          setup_step?: number
          slug?: string
          status?: Database["public"]["Enums"]["workspace_status"]
          subscription_id?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_workspace_engine: {
        Args: { _enabled: boolean; _workspace_id: string }
        Returns: boolean
      }
      admin_workspace_overview: {
        Args: never
        Returns: {
          active_integrations_count: number
          created_at: string
          events_count: number
          integrations_count: number
          members_count: number
          organization_id: string
          organization_name: string
          recovered_amount_cents: number
          recovered_count: number
          recovery_engine_enabled: boolean
          status: string
          workspace_id: string
          workspace_name: string
          workspace_slug: string
        }[]
      }
      can_manage_workspace: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      workspace_role_of: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: Database["public"]["Enums"]["workspace_role"]
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "user"
      blog_post_status: "draft" | "scheduled" | "published" | "archived"
      integration_kind: "store" | "payment_gateway" | "communication"
      integration_status: "pending" | "connected" | "error" | "disconnected"
      recovery_attempt_status:
        | "pending"
        | "sending"
        | "sent"
        | "delivered"
        | "failed"
        | "skipped"
        | "cancelled"
      recovery_channel: "email" | "whatsapp"
      recovery_event_status:
        | "new"
        | "analyzing"
        | "recovering"
        | "recovered"
        | "abandoned"
        | "failed"
      subscription_status:
        | "on_trial"
        | "active"
        | "paused"
        | "past_due"
        | "unpaid"
        | "cancelled"
        | "expired"
      workspace_role: "owner" | "admin" | "member" | "viewer"
      workspace_status:
        | "setup"
        | "active"
        | "paused"
        | "suspended"
        | "cancelled"
        | "trial"
        | "expired"
        | "pending"
        | "archived"
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
      app_role: ["super_admin", "admin", "user"],
      blog_post_status: ["draft", "scheduled", "published", "archived"],
      integration_kind: ["store", "payment_gateway", "communication"],
      integration_status: ["pending", "connected", "error", "disconnected"],
      recovery_attempt_status: [
        "pending",
        "sending",
        "sent",
        "delivered",
        "failed",
        "skipped",
        "cancelled",
      ],
      recovery_channel: ["email", "whatsapp"],
      recovery_event_status: [
        "new",
        "analyzing",
        "recovering",
        "recovered",
        "abandoned",
        "failed",
      ],
      subscription_status: [
        "on_trial",
        "active",
        "paused",
        "past_due",
        "unpaid",
        "cancelled",
        "expired",
      ],
      workspace_role: ["owner", "admin", "member", "viewer"],
      workspace_status: [
        "setup",
        "active",
        "paused",
        "suspended",
        "cancelled",
        "trial",
        "expired",
        "pending",
        "archived",
      ],
    },
  },
} as const
