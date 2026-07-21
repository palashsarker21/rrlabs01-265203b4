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
      admin_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      ai_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          hit_count: number
          id: string
          input_tokens: number
          last_hit_at: string | null
          model_id: string
          output_tokens: number
          response: Json
          task: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at: string
          hit_count?: number
          id?: string
          input_tokens?: number
          last_hit_at?: string | null
          model_id: string
          output_tokens?: number
          response: Json
          task: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          hit_count?: number
          id?: string
          input_tokens?: number
          last_hit_at?: string | null
          model_id?: string
          output_tokens?: number
          response?: Json
          task?: string
        }
        Relationships: []
      }
      ai_models: {
        Row: {
          context_window: number | null
          created_at: string
          display_name: string
          enabled: boolean
          id: string
          input_price_per_mtok: number
          metadata: Json
          model_id: string
          output_price_per_mtok: number
          provider_id: string
          supports_json: boolean
          supports_tools: boolean
          tier: string
          updated_at: string
        }
        Insert: {
          context_window?: number | null
          created_at?: string
          display_name: string
          enabled?: boolean
          id?: string
          input_price_per_mtok?: number
          metadata?: Json
          model_id: string
          output_price_per_mtok?: number
          provider_id: string
          supports_json?: boolean
          supports_tools?: boolean
          tier: string
          updated_at?: string
        }
        Update: {
          context_window?: number | null
          created_at?: string
          display_name?: string
          enabled?: boolean
          id?: string
          input_price_per_mtok?: number
          metadata?: Json
          model_id?: string
          output_price_per_mtok?: number
          provider_id?: string
          supports_json?: boolean
          supports_tools?: boolean
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_models_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_library: {
        Row: {
          active_version_id: string | null
          category: string
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          active_version_id?: string | null
          category: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          active_version_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompt_library_active_version_fk"
            columns: ["active_version_id"]
            isOneToOne: false
            referencedRelation: "ai_prompt_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          prompt_id: string
          status: string
          system_prompt: string
          updated_at: string
          user_template: string | null
          variables: Json
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          prompt_id: string
          status?: string
          system_prompt: string
          updated_at?: string
          user_template?: string | null
          variables?: Json
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          prompt_id?: string
          status?: string
          system_prompt?: string
          updated_at?: string
          user_template?: string | null
          variables?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompt_versions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "ai_prompt_library"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_provider_health: {
        Row: {
          checked_at: string
          error_rate: number | null
          id: string
          latency_ms: number | null
          metadata: Json
          provider_slug: string
          up: boolean
        }
        Insert: {
          checked_at?: string
          error_rate?: number | null
          id?: string
          latency_ms?: number | null
          metadata?: Json
          provider_slug: string
          up: boolean
        }
        Update: {
          checked_at?: string
          error_rate?: number | null
          id?: string
          latency_ms?: number | null
          metadata?: Json
          provider_slug?: string
          up?: boolean
        }
        Relationships: []
      }
      ai_providers: {
        Row: {
          auth_header: string
          auth_scheme: string
          base_url: string
          created_at: string
          enabled: boolean
          id: string
          metadata: Json
          name: string
          priority: number
          secret_env_var: string
          slug: string
          supports_openai_compat: boolean
          updated_at: string
        }
        Insert: {
          auth_header?: string
          auth_scheme?: string
          base_url: string
          created_at?: string
          enabled?: boolean
          id?: string
          metadata?: Json
          name: string
          priority?: number
          secret_env_var: string
          slug: string
          supports_openai_compat?: boolean
          updated_at?: string
        }
        Update: {
          auth_header?: string
          auth_scheme?: string
          base_url?: string
          created_at?: string
          enabled?: boolean
          id?: string
          metadata?: Json
          name?: string
          priority?: number
          secret_env_var?: string
          slug?: string
          supports_openai_compat?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      ai_requests: {
        Row: {
          attempt: number
          cached: boolean
          cost_usd: number
          created_at: string
          error: string | null
          fallback_used: boolean
          id: string
          input_tokens: number
          latency_ms: number
          metadata: Json
          model_id: string
          output_tokens: number
          provider_slug: string
          status: string
          task: string
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          attempt?: number
          cached?: boolean
          cost_usd?: number
          created_at?: string
          error?: string | null
          fallback_used?: boolean
          id?: string
          input_tokens?: number
          latency_ms?: number
          metadata?: Json
          model_id: string
          output_tokens?: number
          provider_slug: string
          status: string
          task: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          attempt?: number
          cached?: boolean
          cost_usd?: number
          created_at?: string
          error?: string | null
          fallback_used?: boolean
          id?: string
          input_tokens?: number
          latency_ms?: number
          metadata?: Json
          model_id?: string
          output_tokens?: number
          provider_slug?: string
          status?: string
          task?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_routes: {
        Row: {
          cache_enabled: boolean
          cache_ttl_seconds: number
          created_at: string
          description: string | null
          enabled: boolean
          fallback_model_id: string | null
          id: string
          max_retries: number
          metadata: Json
          premium_model_id: string | null
          primary_model_id: string | null
          secondary_model_id: string | null
          task: string
          timeout_ms: number
          updated_at: string
        }
        Insert: {
          cache_enabled?: boolean
          cache_ttl_seconds?: number
          created_at?: string
          description?: string | null
          enabled?: boolean
          fallback_model_id?: string | null
          id?: string
          max_retries?: number
          metadata?: Json
          premium_model_id?: string | null
          primary_model_id?: string | null
          secondary_model_id?: string | null
          task: string
          timeout_ms?: number
          updated_at?: string
        }
        Update: {
          cache_enabled?: boolean
          cache_ttl_seconds?: number
          created_at?: string
          description?: string | null
          enabled?: boolean
          fallback_model_id?: string | null
          id?: string
          max_retries?: number
          metadata?: Json
          premium_model_id?: string | null
          primary_model_id?: string | null
          secondary_model_id?: string | null
          task?: string
          timeout_ms?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_routes_fallback_model_id_fkey"
            columns: ["fallback_model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_routes_premium_model_id_fkey"
            columns: ["premium_model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_routes_primary_model_id_fkey"
            columns: ["primary_model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_routes_secondary_model_id_fkey"
            columns: ["secondary_model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          category: Database["public"]["Enums"]["alert_category"]
          created_at: string
          dedupe_key: string | null
          entity: string | null
          entity_id: string | null
          id: string
          message: string | null
          payload: Json
          severity: Database["public"]["Enums"]["alert_severity"]
          status: Database["public"]["Enums"]["alert_status"]
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          category: Database["public"]["Enums"]["alert_category"]
          created_at?: string
          dedupe_key?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          message?: string | null
          payload?: Json
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          category?: Database["public"]["Enums"]["alert_category"]
          created_at?: string
          dedupe_key?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          message?: string | null
          payload?: Json
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          component: string | null
          created_at: string
          id: string
          meta: Json | null
          name: string
          page: string | null
          platform: string | null
          user_agent: string | null
        }
        Insert: {
          component?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          name: string
          page?: string | null
          platform?: string | null
          user_agent?: string | null
        }
        Update: {
          component?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          name?: string
          page?: string | null
          platform?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      announcement_dismissals: {
        Row: {
          announcement_id: string
          dismissed_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          dismissed_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          dismissed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_dismissals_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          audience: string
          audience_filter: Json
          body: string
          created_at: string
          created_by: string | null
          cta_href: string | null
          cta_label: string | null
          dismissible: boolean
          ends_at: string | null
          id: string
          kind: string
          published: boolean
          published_at: string | null
          severity: string
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          audience_filter?: Json
          body?: string
          created_at?: string
          created_by?: string | null
          cta_href?: string | null
          cta_label?: string | null
          dismissible?: boolean
          ends_at?: string | null
          id?: string
          kind?: string
          published?: boolean
          published_at?: string | null
          severity?: string
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          audience_filter?: Json
          body?: string
          created_at?: string
          created_by?: string | null
          cta_href?: string | null
          cta_label?: string | null
          dismissible?: boolean
          ends_at?: string | null
          id?: string
          kind?: string
          published?: boolean
          published_at?: string | null
          severity?: string
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          disabled_at: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          last_used_ip: string | null
          name: string
          request_count: number
          revoked_at: string | null
          revoked_reason: string | null
          scopes: string[]
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          disabled_at?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          last_used_ip?: string | null
          name: string
          request_count?: number
          revoked_at?: string | null
          revoked_reason?: string | null
          scopes?: string[]
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          disabled_at?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          last_used_ip?: string | null
          name?: string
          request_count?: number
          revoked_at?: string | null
          revoked_reason?: string | null
          scopes?: string[]
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
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
          last_attempt_at: string | null
          ls_checkout_id: string | null
          ls_checkout_url: string | null
          organization_name: string
          plan_id: string
          provider_error: string | null
          provider_status_code: number | null
          status: string
          updated_at: string
          user_id: string
          workspace_name: string
        }
        Insert: {
          created_at?: string
          fulfilled_workspace_id?: string | null
          id?: string
          last_attempt_at?: string | null
          ls_checkout_id?: string | null
          ls_checkout_url?: string | null
          organization_name: string
          plan_id: string
          provider_error?: string | null
          provider_status_code?: number | null
          status?: string
          updated_at?: string
          user_id: string
          workspace_name: string
        }
        Update: {
          created_at?: string
          fulfilled_workspace_id?: string | null
          id?: string
          last_attempt_at?: string | null
          ls_checkout_id?: string | null
          ls_checkout_url?: string | null
          organization_name?: string
          plan_id?: string
          provider_error?: string | null
          provider_status_code?: number | null
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
      contact_leads: {
        Row: {
          arr_range: string | null
          company: string | null
          created_at: string
          email: string
          id: string
          ip_hash: string | null
          name: string
          plan_code: string | null
          role: string | null
          seats: string | null
          source: string | null
          use_case: string | null
          user_agent: string | null
        }
        Insert: {
          arr_range?: string | null
          company?: string | null
          created_at?: string
          email: string
          id?: string
          ip_hash?: string | null
          name: string
          plan_code?: string | null
          role?: string | null
          seats?: string | null
          source?: string | null
          use_case?: string | null
          user_agent?: string | null
        }
        Update: {
          arr_range?: string | null
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string | null
          name?: string
          plan_code?: string | null
          role?: string | null
          seats?: string | null
          source?: string | null
          use_case?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          churn_score: number | null
          clv_cents: number | null
          country: string | null
          created_at: string
          currency: string | null
          email: string | null
          external_id: string | null
          id: string
          locale: string | null
          metadata: Json
          name: string | null
          phone: string | null
          preferred_language: string | null
          preferred_timezone: string | null
          provider: string
          segment: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          churn_score?: number | null
          clv_cents?: number | null
          country?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          external_id?: string | null
          id?: string
          locale?: string | null
          metadata?: Json
          name?: string | null
          phone?: string | null
          preferred_language?: string | null
          preferred_timezone?: string | null
          provider?: string
          segment?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          churn_score?: number | null
          clv_cents?: number | null
          country?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          external_id?: string | null
          id?: string
          locale?: string | null
          metadata?: Json
          name?: string | null
          phone?: string | null
          preferred_language?: string | null
          preferred_timezone?: string | null
          provider?: string
          segment?: string | null
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
      email_events: {
        Row: {
          created_at: string
          email_log_id: string | null
          event_type: string
          id: string
          payload: Json
          provider_message_id: string | null
        }
        Insert: {
          created_at?: string
          email_log_id?: string | null
          event_type: string
          id?: string
          payload?: Json
          provider_message_id?: string | null
        }
        Update: {
          created_at?: string
          email_log_id?: string | null
          event_type?: string
          id?: string
          payload?: Json
          provider_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_events_email_log_id_fkey"
            columns: ["email_log_id"]
            isOneToOne: false
            referencedRelation: "email_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          attempts: number
          created_at: string
          delivered_at: string | null
          failed_at: string | null
          id: string
          idempotency_key: string | null
          last_error: string | null
          metadata: Json
          provider: string
          provider_message_id: string | null
          recipient: string
          sent_at: string | null
          status: string
          subject: string | null
          template: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          metadata?: Json
          provider?: string
          provider_message_id?: string | null
          recipient: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          metadata?: Json
          provider?: string
          provider_message_id?: string | null
          recipient?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_subscription_preferences: {
        Row: {
          category: Database["public"]["Enums"]["email_pref_category"]
          created_at: string
          email: string
          id: string
          source: string | null
          subscribed: boolean
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["email_pref_category"]
          created_at?: string
          email: string
          id?: string
          source?: string | null
          subscribed?: boolean
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["email_pref_category"]
          created_at?: string
          email?: string
          id?: string
          source?: string | null
          subscribed?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      email_webhook_logs: {
        Row: {
          body_snippet: string | null
          created_at: string
          error: string | null
          event_type: string | null
          headers: Json
          id: string
          matched_log_id: string | null
          outcome: string
          payload: Json | null
          processing_ms: number | null
          provider: string
          provider_message_id: string | null
          received_at: string
          signature_valid: boolean
          status_code: number
          svix_id: string | null
          svix_timestamp: string | null
        }
        Insert: {
          body_snippet?: string | null
          created_at?: string
          error?: string | null
          event_type?: string | null
          headers?: Json
          id?: string
          matched_log_id?: string | null
          outcome: string
          payload?: Json | null
          processing_ms?: number | null
          provider?: string
          provider_message_id?: string | null
          received_at?: string
          signature_valid?: boolean
          status_code: number
          svix_id?: string | null
          svix_timestamp?: string | null
        }
        Update: {
          body_snippet?: string | null
          created_at?: string
          error?: string | null
          event_type?: string | null
          headers?: Json
          id?: string
          matched_log_id?: string | null
          outcome?: string
          payload?: Json | null
          processing_ms?: number | null
          provider?: string
          provider_message_id?: string | null
          received_at?: string
          signature_valid?: boolean
          status_code?: number
          svix_id?: string | null
          svix_timestamp?: string | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          beta: boolean
          created_at: string
          description: string
          enabled: boolean
          id: string
          key: string
          label: string
          maintenance_mode: boolean
          updated_at: string
        }
        Insert: {
          beta?: boolean
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          key: string
          label: string
          maintenance_mode?: boolean
          updated_at?: string
        }
        Update: {
          beta?: boolean
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          key?: string
          label?: string
          maintenance_mode?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      flow_installations: {
        Row: {
          id: string
          installed_at: string
          installed_by: string | null
          marketplace_flow_id: string
          overrides: Json
          recovery_template_ids: string[]
          version_installed: number
          workspace_id: string
        }
        Insert: {
          id?: string
          installed_at?: string
          installed_by?: string | null
          marketplace_flow_id: string
          overrides?: Json
          recovery_template_ids?: string[]
          version_installed: number
          workspace_id: string
        }
        Update: {
          id?: string
          installed_at?: string
          installed_by?: string | null
          marketplace_flow_id?: string
          overrides?: Json
          recovery_template_ids?: string[]
          version_installed?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_installations_marketplace_flow_id_fkey"
            columns: ["marketplace_flow_id"]
            isOneToOne: false
            referencedRelation: "marketplace_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_installations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_updates: {
        Row: {
          author_id: string | null
          created_at: string
          id: string
          incident_id: string
          message: string
          status: Database["public"]["Enums"]["incident_status"]
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          id?: string
          incident_id: string
          message: string
          status: Database["public"]["Enums"]["incident_status"]
        }
        Update: {
          author_id?: string | null
          created_at?: string
          id?: string
          incident_id?: string
          message?: string
          status?: Database["public"]["Enums"]["incident_status"]
        }
        Relationships: [
          {
            foreignKeyName: "incident_updates_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          affected_components: string[]
          created_at: string
          created_by: string | null
          id: string
          impact: Database["public"]["Enums"]["incident_impact"]
          is_public: boolean
          resolved_at: string | null
          started_at: string
          status: Database["public"]["Enums"]["incident_status"]
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          affected_components?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          impact?: Database["public"]["Enums"]["incident_impact"]
          is_public?: boolean
          resolved_at?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["incident_status"]
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          affected_components?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          impact?: Database["public"]["Enums"]["incident_impact"]
          is_public?: boolean
          resolved_at?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["incident_status"]
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
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
          last_test_at: string | null
          last_test_ok: boolean | null
          last_verified_at: string | null
          provider: string
          provider_account_id: string | null
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
          verification_status: string
          webhook_secret: string | null
          webhook_verify_token: string | null
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
          last_test_at?: string | null
          last_test_ok?: boolean | null
          last_verified_at?: string | null
          provider: string
          provider_account_id?: string | null
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
          verification_status?: string
          webhook_secret?: string | null
          webhook_verify_token?: string | null
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
          last_test_at?: string | null
          last_test_ok?: boolean | null
          last_verified_at?: string | null
          provider?: string
          provider_account_id?: string | null
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
          verification_status?: string
          webhook_secret?: string | null
          webhook_verify_token?: string | null
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
      job_queue: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          max_attempts: number
          moved_to_dlq_at: string | null
          next_retry_at: string | null
          payload: Json
          priority: number
          queue: string
          scheduled_for: string
          started_at: string | null
          status: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          job_type: string
          last_error?: string | null
          max_attempts?: number
          moved_to_dlq_at?: string | null
          next_retry_at?: string | null
          payload?: Json
          priority?: number
          queue: string
          scheduled_for?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          job_type?: string
          last_error?: string | null
          max_attempts?: number
          moved_to_dlq_at?: string | null
          next_retry_at?: string | null
          payload?: Json
          priority?: number
          queue?: string
          scheduled_for?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_queue_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_flows: {
        Row: {
          country: string | null
          created_at: string
          created_by: string | null
          customer_segment: string | null
          description: string | null
          failure_classification:
            | Database["public"]["Enums"]["failure_classification"]
            | null
          id: string
          industry: string | null
          language: string
          name: string
          product_kind: string | null
          published_at: string | null
          region: string | null
          slug: string
          status: Database["public"]["Enums"]["marketplace_status"]
          steps: Json
          tags: string[]
          tone: string | null
          updated_at: string
          usage_count: number
          version: number
        }
        Insert: {
          country?: string | null
          created_at?: string
          created_by?: string | null
          customer_segment?: string | null
          description?: string | null
          failure_classification?:
            | Database["public"]["Enums"]["failure_classification"]
            | null
          id?: string
          industry?: string | null
          language?: string
          name: string
          product_kind?: string | null
          published_at?: string | null
          region?: string | null
          slug: string
          status?: Database["public"]["Enums"]["marketplace_status"]
          steps?: Json
          tags?: string[]
          tone?: string | null
          updated_at?: string
          usage_count?: number
          version?: number
        }
        Update: {
          country?: string | null
          created_at?: string
          created_by?: string | null
          customer_segment?: string | null
          description?: string | null
          failure_classification?:
            | Database["public"]["Enums"]["failure_classification"]
            | null
          id?: string
          industry?: string | null
          language?: string
          name?: string
          product_kind?: string | null
          published_at?: string | null
          region?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["marketplace_status"]
          steps?: Json
          tags?: string[]
          tone?: string | null
          updated_at?: string
          usage_count?: number
          version?: number
        }
        Relationships: []
      }
      marketplace_templates: {
        Row: {
          body_html: string | null
          body_text: string | null
          channel: Database["public"]["Enums"]["recovery_channel"]
          country: string | null
          created_at: string
          created_by: string | null
          customer_segment: string | null
          description: string | null
          failure_classification:
            | Database["public"]["Enums"]["failure_classification"]
            | null
          id: string
          industry: string | null
          language: string
          name: string
          product_kind: string | null
          published_at: string | null
          region: string | null
          slug: string
          status: Database["public"]["Enums"]["marketplace_status"]
          step: number
          subject: string | null
          tags: string[]
          tone: string | null
          updated_at: string
          usage_count: number
          variables: Json
          version: number
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          channel: Database["public"]["Enums"]["recovery_channel"]
          country?: string | null
          created_at?: string
          created_by?: string | null
          customer_segment?: string | null
          description?: string | null
          failure_classification?:
            | Database["public"]["Enums"]["failure_classification"]
            | null
          id?: string
          industry?: string | null
          language?: string
          name: string
          product_kind?: string | null
          published_at?: string | null
          region?: string | null
          slug: string
          status?: Database["public"]["Enums"]["marketplace_status"]
          step?: number
          subject?: string | null
          tags?: string[]
          tone?: string | null
          updated_at?: string
          usage_count?: number
          variables?: Json
          version?: number
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          channel?: Database["public"]["Enums"]["recovery_channel"]
          country?: string | null
          created_at?: string
          created_by?: string | null
          customer_segment?: string | null
          description?: string | null
          failure_classification?:
            | Database["public"]["Enums"]["failure_classification"]
            | null
          id?: string
          industry?: string | null
          language?: string
          name?: string
          product_kind?: string | null
          published_at?: string | null
          region?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["marketplace_status"]
          step?: number
          subject?: string | null
          tags?: string[]
          tone?: string | null
          updated_at?: string
          usage_count?: number
          variables?: Json
          version?: number
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          confirmed: boolean
          created_at: string
          email: string
          id: string
          source: string | null
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          confirmed?: boolean
          created_at?: string
          email: string
          id?: string
          source?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          confirmed?: boolean
          created_at?: string
          email?: string
          id?: string
          source?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          channel: string
          created_at: string
          error: string | null
          id: string
          kind: string
          payload: Json
          recipient: string | null
          status: string
          subscription_id: string | null
          workspace_id: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          payload?: Json
          recipient?: string | null
          status?: string
          subscription_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          payload?: Json
          recipient?: string | null
          status?: string
          subscription_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          category: Database["public"]["Enums"]["alert_category"]
          created_at: string
          email: boolean
          id: string
          in_app: boolean
          min_severity: Database["public"]["Enums"]["alert_severity"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["alert_category"]
          created_at?: string
          email?: boolean
          id?: string
          in_app?: boolean
          min_severity?: Database["public"]["Enums"]["alert_severity"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["alert_category"]
          created_at?: string
          email?: boolean
          id?: string
          in_app?: boolean
          min_severity?: Database["public"]["Enums"]["alert_severity"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_ai_settings: {
        Row: {
          ai_enabled: boolean
          budget_alert_threshold: number
          cache_enabled: boolean
          created_at: string
          custom_system_prompt: string | null
          daily_budget_usd: number | null
          default_model: string | null
          fallback_enabled: boolean
          metadata: Json
          monthly_budget_usd: number | null
          monthly_token_limit: number | null
          premium_enabled: boolean
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ai_enabled?: boolean
          budget_alert_threshold?: number
          cache_enabled?: boolean
          created_at?: string
          custom_system_prompt?: string | null
          daily_budget_usd?: number | null
          default_model?: string | null
          fallback_enabled?: boolean
          metadata?: Json
          monthly_budget_usd?: number | null
          monthly_token_limit?: number | null
          premium_enabled?: boolean
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ai_enabled?: boolean
          budget_alert_threshold?: number
          cache_enabled?: boolean
          created_at?: string
          custom_system_prompt?: string | null
          daily_budget_usd?: number | null
          default_model?: string | null
          fallback_enabled?: boolean
          metadata?: Json
          monthly_budget_usd?: number | null
          monthly_token_limit?: number | null
          premium_enabled?: boolean
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_ai_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
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
      permissions: {
        Row: {
          category: string
          created_at: string
          description: string
          key: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          key: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          key?: string
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
          is_contact_sales: boolean
          ls_product_id: string | null
          ls_variant_id: string | null
          monthly_event_limit: number | null
          name: string
          price_cents: number
          sort_order: number
          starting_at_price_cents: number | null
          success_fee_bps: number | null
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
          is_contact_sales?: boolean
          ls_product_id?: string | null
          ls_variant_id?: string | null
          monthly_event_limit?: number | null
          name: string
          price_cents?: number
          sort_order?: number
          starting_at_price_cents?: number | null
          success_fee_bps?: number | null
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
          is_contact_sales?: boolean
          ls_product_id?: string | null
          ls_variant_id?: string | null
          monthly_event_limit?: number | null
          name?: string
          price_cents?: number
          sort_order?: number
          starting_at_price_cents?: number | null
          success_fee_bps?: number | null
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accepted_data_processing_at: string | null
          accepted_privacy_at: string | null
          accepted_service_comms_at: string | null
          accepted_terms_at: string | null
          avatar_url: string | null
          consent_ip: unknown
          consent_user_agent: string | null
          consent_version: string | null
          created_at: string
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          marketing_email_opt_in: boolean
          product_updates_opt_in: boolean
          service_notifications_opt_in: boolean
          sms_notifications_opt_in: boolean
          timezone: string | null
          updated_at: string
          whatsapp_notifications_opt_in: boolean
        }
        Insert: {
          accepted_data_processing_at?: string | null
          accepted_privacy_at?: string | null
          accepted_service_comms_at?: string | null
          accepted_terms_at?: string | null
          avatar_url?: string | null
          consent_ip?: unknown
          consent_user_agent?: string | null
          consent_version?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          marketing_email_opt_in?: boolean
          product_updates_opt_in?: boolean
          service_notifications_opt_in?: boolean
          sms_notifications_opt_in?: boolean
          timezone?: string | null
          updated_at?: string
          whatsapp_notifications_opt_in?: boolean
        }
        Update: {
          accepted_data_processing_at?: string | null
          accepted_privacy_at?: string | null
          accepted_service_comms_at?: string | null
          accepted_terms_at?: string | null
          avatar_url?: string | null
          consent_ip?: unknown
          consent_user_agent?: string | null
          consent_version?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          marketing_email_opt_in?: boolean
          product_updates_opt_in?: boolean
          service_notifications_opt_in?: boolean
          sms_notifications_opt_in?: boolean
          timezone?: string | null
          updated_at?: string
          whatsapp_notifications_opt_in?: boolean
        }
        Relationships: []
      }
      provider_catalog: {
        Row: {
          beta: boolean
          code: string
          created_at: string
          description: string
          docs_url: string | null
          enabled: boolean
          id: string
          kind: string
          logo_url: string | null
          name: string
          required_scopes: Json
          setup_fields: Json
          setup_instructions: string
          sort_order: number
          updated_at: string
          webhook_events: Json
        }
        Insert: {
          beta?: boolean
          code: string
          created_at?: string
          description?: string
          docs_url?: string | null
          enabled?: boolean
          id?: string
          kind: string
          logo_url?: string | null
          name: string
          required_scopes?: Json
          setup_fields?: Json
          setup_instructions?: string
          sort_order?: number
          updated_at?: string
          webhook_events?: Json
        }
        Update: {
          beta?: boolean
          code?: string
          created_at?: string
          description?: string
          docs_url?: string | null
          enabled?: boolean
          id?: string
          kind?: string
          logo_url?: string | null
          name?: string
          required_scopes?: Json
          setup_fields?: Json
          setup_instructions?: string
          sort_order?: number
          updated_at?: string
          webhook_events?: Json
        }
        Relationships: []
      }
      provider_limits: {
        Row: {
          created_at: string
          id: string
          max_count: number | null
          plan_code: string
          provider_kind: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_count?: number | null
          plan_code: string
          provider_kind: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_count?: number | null
          plan_code?: string
          provider_kind?: string
          updated_at?: string
        }
        Relationships: []
      }
      provider_status: {
        Row: {
          integration_id: string
          last_delivery_at: string | null
          last_error: string | null
          last_success_at: string | null
          retry_count: number
          updated_at: string
          verification_status: string
        }
        Insert: {
          integration_id: string
          last_delivery_at?: string | null
          last_error?: string | null
          last_success_at?: string | null
          retry_count?: number
          updated_at?: string
          verification_status?: string
        }
        Update: {
          integration_id?: string
          last_delivery_at?: string | null
          last_error?: string | null
          last_success_at?: string | null
          retry_count?: number
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_status_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: true
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_attempts: {
        Row: {
          ai_completion_tokens: number | null
          ai_model: string | null
          ai_prompt_tokens: number | null
          body_html: string | null
          body_text: string | null
          channel: Database["public"]["Enums"]["recovery_channel"]
          click_status: string | null
          clicked_at: string | null
          created_at: string
          delivered_at: string | null
          delivery_status: string | null
          error: string | null
          event_id: string
          id: string
          language: string | null
          opened_at: string | null
          provider_error_code: string | null
          provider_message_id: string | null
          provider_response: Json
          read_at: string | null
          read_status: string | null
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["recovery_attempt_status"]
          step: number
          subject: string | null
          template_id: string | null
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
          click_status?: string | null
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string | null
          error?: string | null
          event_id: string
          id?: string
          language?: string | null
          opened_at?: string | null
          provider_error_code?: string | null
          provider_message_id?: string | null
          provider_response?: Json
          read_at?: string | null
          read_status?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["recovery_attempt_status"]
          step?: number
          subject?: string | null
          template_id?: string | null
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
          click_status?: string | null
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string | null
          error?: string | null
          event_id?: string
          id?: string
          language?: string | null
          opened_at?: string | null
          provider_error_code?: string | null
          provider_message_id?: string | null
          provider_response?: Json
          read_at?: string | null
          read_status?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["recovery_attempt_status"]
          step?: number
          subject?: string | null
          template_id?: string | null
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
          ai_cost_micros: number | null
          ai_processing_ms: number | null
          ai_summary: string | null
          amount_cents: number | null
          attempts_count: number
          cadence_step: number
          created_at: string
          currency: string | null
          customer_id: string | null
          decision: Json
          external_event_id: string | null
          external_object_id: string | null
          failure_category: string | null
          failure_classification:
            | Database["public"]["Enums"]["failure_classification"]
            | null
          failure_code: string | null
          failure_message: string | null
          id: string
          last_ai_version: string | null
          next_action: string | null
          next_run_at: string | null
          notification_channel: string | null
          object_type: string | null
          preferred_language: string | null
          preferred_timezone: string | null
          prompt_version: string | null
          provider: string
          raw: Json
          recovered_at: string | null
          recovery_score: number | null
          risk_score: number | null
          status: Database["public"]["Enums"]["recovery_event_status"]
          template_confidence: number | null
          template_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          abandoned_at?: string | null
          ai_analysis?: Json
          ai_cost_micros?: number | null
          ai_processing_ms?: number | null
          ai_summary?: string | null
          amount_cents?: number | null
          attempts_count?: number
          cadence_step?: number
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          decision?: Json
          external_event_id?: string | null
          external_object_id?: string | null
          failure_category?: string | null
          failure_classification?:
            | Database["public"]["Enums"]["failure_classification"]
            | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          last_ai_version?: string | null
          next_action?: string | null
          next_run_at?: string | null
          notification_channel?: string | null
          object_type?: string | null
          preferred_language?: string | null
          preferred_timezone?: string | null
          prompt_version?: string | null
          provider?: string
          raw?: Json
          recovered_at?: string | null
          recovery_score?: number | null
          risk_score?: number | null
          status?: Database["public"]["Enums"]["recovery_event_status"]
          template_confidence?: number | null
          template_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          abandoned_at?: string | null
          ai_analysis?: Json
          ai_cost_micros?: number | null
          ai_processing_ms?: number | null
          ai_summary?: string | null
          amount_cents?: number | null
          attempts_count?: number
          cadence_step?: number
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          decision?: Json
          external_event_id?: string | null
          external_object_id?: string | null
          failure_category?: string | null
          failure_classification?:
            | Database["public"]["Enums"]["failure_classification"]
            | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          last_ai_version?: string | null
          next_action?: string | null
          next_run_at?: string | null
          notification_channel?: string | null
          object_type?: string | null
          preferred_language?: string | null
          preferred_timezone?: string | null
          prompt_version?: string | null
          provider?: string
          raw?: Json
          recovered_at?: string | null
          recovery_score?: number | null
          risk_score?: number | null
          status?: Database["public"]["Enums"]["recovery_event_status"]
          template_confidence?: number | null
          template_id?: string | null
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
      recovery_template_matches: {
        Row: {
          channel: Database["public"]["Enums"]["recovery_channel"]
          confidence: number
          created_at: string
          event_id: string
          id: string
          match_keys: Json
          matched: boolean
          outcome: string | null
          step: number
          template_id: string | null
          workspace_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["recovery_channel"]
          confidence?: number
          created_at?: string
          event_id: string
          id?: string
          match_keys?: Json
          matched: boolean
          outcome?: string | null
          step: number
          template_id?: string | null
          workspace_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["recovery_channel"]
          confidence?: number
          created_at?: string
          event_id?: string
          id?: string
          match_keys?: Json
          matched?: boolean
          outcome?: string | null
          step?: number
          template_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_template_matches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "recovery_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recovery_template_matches_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "recovery_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recovery_template_matches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_templates: {
        Row: {
          ai_model: string | null
          body_html: string | null
          body_text: string | null
          channel: Database["public"]["Enums"]["recovery_channel"]
          confidence: number
          country: string | null
          created_at: string
          customer_segment: string | null
          enabled: boolean
          failure_classification:
            | Database["public"]["Enums"]["failure_classification"]
            | null
          gateway: string | null
          id: string
          language: string | null
          last_used_at: string | null
          product_kind: string | null
          prompt_version: string | null
          source: Database["public"]["Enums"]["template_source"]
          step: number
          subject: string | null
          success_count: number
          tone: string | null
          updated_at: string
          usage_count: number
          workspace_id: string
        }
        Insert: {
          ai_model?: string | null
          body_html?: string | null
          body_text?: string | null
          channel: Database["public"]["Enums"]["recovery_channel"]
          confidence?: number
          country?: string | null
          created_at?: string
          customer_segment?: string | null
          enabled?: boolean
          failure_classification?:
            | Database["public"]["Enums"]["failure_classification"]
            | null
          gateway?: string | null
          id?: string
          language?: string | null
          last_used_at?: string | null
          product_kind?: string | null
          prompt_version?: string | null
          source?: Database["public"]["Enums"]["template_source"]
          step: number
          subject?: string | null
          success_count?: number
          tone?: string | null
          updated_at?: string
          usage_count?: number
          workspace_id: string
        }
        Update: {
          ai_model?: string | null
          body_html?: string | null
          body_text?: string | null
          channel?: Database["public"]["Enums"]["recovery_channel"]
          confidence?: number
          country?: string | null
          created_at?: string
          customer_segment?: string | null
          enabled?: boolean
          failure_classification?:
            | Database["public"]["Enums"]["failure_classification"]
            | null
          gateway?: string | null
          id?: string
          language?: string | null
          last_used_at?: string | null
          product_kind?: string | null
          prompt_version?: string | null
          source?: Database["public"]["Enums"]["template_source"]
          step?: number
          subject?: string | null
          success_count?: number
          tone?: string | null
          updated_at?: string
          usage_count?: number
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
      role_permissions: {
        Row: {
          permission_key: string
          role: Database["public"]["Enums"]["workspace_role"]
        }
        Insert: {
          permission_key: string
          role: Database["public"]["Enums"]["workspace_role"]
        }
        Update: {
          permission_key?: string
          role?: Database["public"]["Enums"]["workspace_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
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
      success_fee_adjustments: {
        Row: {
          actor_user_id: string | null
          amount_cents: number
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["success_fee_adjustment_kind"]
          reason: string
          statement_id: string
          workspace_id: string
        }
        Insert: {
          actor_user_id?: string | null
          amount_cents: number
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["success_fee_adjustment_kind"]
          reason: string
          statement_id: string
          workspace_id: string
        }
        Update: {
          actor_user_id?: string | null
          amount_cents?: number
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["success_fee_adjustment_kind"]
          reason?: string
          statement_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "success_fee_adjustments_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "success_fee_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "success_fee_adjustments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      success_fee_statements: {
        Row: {
          adjustments_total_cents: number
          created_at: string
          currency: string
          events_count: number
          fee_amount_cents: number
          fee_bps: number
          finalized_at: string | null
          id: string
          invoiced_at: string | null
          ls_checkout_url: string | null
          ls_invoice_id: string | null
          ls_order_id: string | null
          net_amount_cents: number
          notes: string | null
          paid_at: string | null
          period_end: string
          period_start: string
          plan_id: string | null
          provider_error: string | null
          provider_status_code: number | null
          recovered_amount_cents: number
          status: Database["public"]["Enums"]["success_fee_status"]
          updated_at: string
          voided_at: string | null
          workspace_id: string
        }
        Insert: {
          adjustments_total_cents?: number
          created_at?: string
          currency?: string
          events_count?: number
          fee_amount_cents?: number
          fee_bps?: number
          finalized_at?: string | null
          id?: string
          invoiced_at?: string | null
          ls_checkout_url?: string | null
          ls_invoice_id?: string | null
          ls_order_id?: string | null
          net_amount_cents?: number
          notes?: string | null
          paid_at?: string | null
          period_end: string
          period_start: string
          plan_id?: string | null
          provider_error?: string | null
          provider_status_code?: number | null
          recovered_amount_cents?: number
          status?: Database["public"]["Enums"]["success_fee_status"]
          updated_at?: string
          voided_at?: string | null
          workspace_id: string
        }
        Update: {
          adjustments_total_cents?: number
          created_at?: string
          currency?: string
          events_count?: number
          fee_amount_cents?: number
          fee_bps?: number
          finalized_at?: string | null
          id?: string
          invoiced_at?: string | null
          ls_checkout_url?: string | null
          ls_invoice_id?: string | null
          ls_order_id?: string | null
          net_amount_cents?: number
          notes?: string | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          plan_id?: string | null
          provider_error?: string | null
          provider_status_code?: number | null
          recovered_amount_cents?: number
          status?: Database["public"]["Enums"]["success_fee_status"]
          updated_at?: string
          voided_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "success_fee_statements_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "success_fee_statements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      support_activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          conversation_id: string | null
          created_at: string
          id: string
          payload: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "support_activity_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          assignee_id: string | null
          conversation_id: string
          id: string
          reason: string | null
          released_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          assignee_id?: string | null
          conversation_id: string
          id?: string
          reason?: string | null
          released_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          assignee_id?: string | null
          conversation_id?: string
          id?: string
          reason?: string | null
          released_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_assignments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_attachments: {
        Row: {
          content_type: string
          conversation_id: string
          created_at: string
          file_name: string
          id: string
          message_id: string | null
          scan_status: string
          size_bytes: number
          storage_path: string
          uploader_id: string | null
        }
        Insert: {
          content_type: string
          conversation_id: string
          created_at?: string
          file_name: string
          id?: string
          message_id?: string | null
          scan_status?: string
          size_bytes: number
          storage_path: string
          uploader_id?: string | null
        }
        Update: {
          content_type?: string
          conversation_id?: string
          created_at?: string
          file_name?: string
          id?: string
          message_id?: string | null
          scan_status?: string
          size_bytes?: number
          storage_path?: string
          uploader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_attachments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      support_conversation_tags: {
        Row: {
          conversation_id: string
          created_at: string
          tag_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          tag_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_conversation_tags_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_conversation_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "support_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      support_conversations: {
        Row: {
          ai_summary: Json | null
          archived_at: string | null
          assigned_to: string | null
          category: Database["public"]["Enums"]["support_category"]
          closed_at: string | null
          created_at: string
          customer_id: string
          first_response_at: string | null
          id: string
          important: boolean
          last_message_at: string | null
          metadata: Json
          pinned: boolean
          priority: Database["public"]["Enums"]["support_priority"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["support_status"]
          subject: string | null
          unread_customer: number
          unread_staff: number
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          ai_summary?: Json | null
          archived_at?: string | null
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["support_category"]
          closed_at?: string | null
          created_at?: string
          customer_id: string
          first_response_at?: string | null
          id?: string
          important?: boolean
          last_message_at?: string | null
          metadata?: Json
          pinned?: boolean
          priority?: Database["public"]["Enums"]["support_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_status"]
          subject?: string | null
          unread_customer?: number
          unread_staff?: number
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          ai_summary?: Json | null
          archived_at?: string | null
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["support_category"]
          closed_at?: string | null
          created_at?: string
          customer_id?: string
          first_response_at?: string | null
          id?: string
          important?: boolean
          last_message_at?: string | null
          metadata?: Json
          pinned?: boolean
          priority?: Database["public"]["Enums"]["support_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_status"]
          subject?: string | null
          unread_customer?: number
          unread_staff?: number
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      support_feedback: {
        Row: {
          agent_id: string | null
          comment: string | null
          conversation_id: string
          created_at: string
          customer_id: string
          id: string
          rating: Database["public"]["Enums"]["support_feedback_rating"] | null
          stars: number
        }
        Insert: {
          agent_id?: string | null
          comment?: string | null
          conversation_id: string
          created_at?: string
          customer_id: string
          id?: string
          rating?: Database["public"]["Enums"]["support_feedback_rating"] | null
          stars: number
        }
        Update: {
          agent_id?: string | null
          comment?: string | null
          conversation_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          rating?: Database["public"]["Enums"]["support_feedback_rating"] | null
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "support_feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_internal_notes: {
        Row: {
          author_id: string | null
          body: string
          conversation_id: string
          created_at: string
          id: string
          mentions: string[]
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          mentions?: string[]
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          mentions?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_internal_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          attachments: Json
          body: string
          client_message_id: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          delivery_status: Database["public"]["Enums"]["support_delivery_status"]
          edited_at: string | null
          id: string
          is_staff: boolean
          kind: Database["public"]["Enums"]["support_message_kind"]
          metadata: Json
          seen_at: string | null
          sender_id: string | null
          updated_at: string
        }
        Insert: {
          attachments?: Json
          body?: string
          client_message_id?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          delivery_status?: Database["public"]["Enums"]["support_delivery_status"]
          edited_at?: string | null
          id?: string
          is_staff?: boolean
          kind?: Database["public"]["Enums"]["support_message_kind"]
          metadata?: Json
          seen_at?: string | null
          sender_id?: string | null
          updated_at?: string
        }
        Update: {
          attachments?: Json
          body?: string
          client_message_id?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          delivery_status?: Database["public"]["Enums"]["support_delivery_status"]
          edited_at?: string | null
          id?: string
          is_staff?: boolean
          kind?: Database["public"]["Enums"]["support_message_kind"]
          metadata?: Json
          seen_at?: string | null
          sender_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_presence: {
        Row: {
          is_staff: boolean
          last_seen_at: string
          status: Database["public"]["Enums"]["support_presence_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          is_staff?: boolean
          last_seen_at?: string
          status?: Database["public"]["Enums"]["support_presence_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          is_staff?: boolean
          last_seen_at?: string
          status?: Database["public"]["Enums"]["support_presence_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          label: string
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          label: string
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          label?: string
          slug?: string
        }
        Relationships: []
      }
      template_installations: {
        Row: {
          id: string
          installed_at: string
          installed_by: string | null
          marketplace_template_id: string
          overrides: Json
          recovery_template_id: string | null
          version_installed: number
          workspace_id: string
        }
        Insert: {
          id?: string
          installed_at?: string
          installed_by?: string | null
          marketplace_template_id: string
          overrides?: Json
          recovery_template_id?: string | null
          version_installed: number
          workspace_id: string
        }
        Update: {
          id?: string
          installed_at?: string
          installed_by?: string | null
          marketplace_template_id?: string
          overrides?: Json
          recovery_template_id?: string | null
          version_installed?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_installations_marketplace_template_id_fkey"
            columns: ["marketplace_template_id"]
            isOneToOne: false
            referencedRelation: "marketplace_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_installations_recovery_template_id_fkey"
            columns: ["recovery_template_id"]
            isOneToOne: false
            referencedRelation: "recovery_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_installations_workspace_id_fkey"
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
      webhook_logs: {
        Row: {
          attempt_count: number
          error: string | null
          event_type: string | null
          id: string
          integration_id: string | null
          payload_hash: string | null
          processed_at: string | null
          provider_code: string
          received_at: string
          signature_valid: boolean
          status_code: number | null
          workspace_id: string | null
        }
        Insert: {
          attempt_count?: number
          error?: string | null
          event_type?: string | null
          id?: string
          integration_id?: string | null
          payload_hash?: string | null
          processed_at?: string | null
          provider_code: string
          received_at?: string
          signature_valid?: boolean
          status_code?: number | null
          workspace_id?: string | null
        }
        Update: {
          attempt_count?: number
          error?: string | null
          event_type?: string | null
          id?: string
          integration_id?: string | null
          payload_hash?: string | null
          processed_at?: string | null
          provider_code?: string
          received_at?: string
          signature_valid?: boolean
          status_code?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_automation_settings: {
        Row: {
          ai_enabled: boolean
          business_hours: Json
          created_at: string
          holiday_calendar: Json
          max_retries: number
          preferred_channels: string[]
          quiet_hours: Json
          retry_schedule_minutes: number[]
          template_reuse_threshold: number
          timezone: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ai_enabled?: boolean
          business_hours?: Json
          created_at?: string
          holiday_calendar?: Json
          max_retries?: number
          preferred_channels?: string[]
          quiet_hours?: Json
          retry_schedule_minutes?: number[]
          template_reuse_threshold?: number
          timezone?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ai_enabled?: boolean
          business_hours?: Json
          created_at?: string
          holiday_calendar?: Json
          max_retries?: number
          preferred_channels?: string[]
          quiet_hours?: Json
          retry_schedule_minutes?: number[]
          template_reuse_threshold?: number
          timezone?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_automation_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_feature_overrides: {
        Row: {
          created_at: string
          enabled: boolean | null
          feature_key: string
          id: string
          limit_override: number | null
          notes: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean | null
          feature_key: string
          id?: string
          limit_override?: number | null
          notes?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean | null
          feature_key?: string
          id?: string
          limit_override?: number | null
          notes?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_feature_overrides_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["workspace_role"]
          status: string
          token: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          status?: string
          token?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          status?: string
          token?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_member_permissions: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          permission_key: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          id?: string
          permission_key: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          permission_key?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_member_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "workspace_member_permissions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      accept_workspace_invitation: {
        Args: { _token: string }
        Returns: {
          role: Database["public"]["Enums"]["workspace_role"]
          workspace_id: string
        }[]
      }
      admin_job_queue_stats: {
        Args: never
        Returns: {
          count: number
          queue: string
          status: string
        }[]
      }
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
      can_view_support_conversation: {
        Args: { _conv_id: string; _user_id: string }
        Returns: boolean
      }
      create_alert: {
        Args: {
          _category: Database["public"]["Enums"]["alert_category"]
          _dedupe_key: string
          _entity: string
          _entity_id: string
          _message: string
          _payload: Json
          _severity: Database["public"]["Enums"]["alert_severity"]
          _title: string
          _workspace_id: string
        }
        Returns: string
      }
      expire_trial_workspaces: { Args: never; Returns: number }
      has_permission: {
        Args: { _permission: string; _user_id: string; _workspace_id: string }
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
      is_support_staff: { Args: { _user_id: string }; Returns: boolean }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      next_support_assignee: { Args: never; Returns: string }
      preview_workspace_invitation: {
        Args: { _token: string }
        Returns: {
          email: string
          expires_at: string
          organization_name: string
          role: Database["public"]["Enums"]["workspace_role"]
          status: string
          workspace_name: string
        }[]
      }
      provision_trial_workspace: {
        Args: {
          _org_name: string
          _org_slug: string
          _trial_days?: number
          _workspace_name: string
          _workspace_slug: string
        }
        Returns: {
          already_exists: boolean
          organization_id: string
          workspace_id: string
        }[]
      }
      recompute_success_fee_statement: {
        Args: { _statement_id: string }
        Returns: undefined
      }
      run_rls_test_suite: {
        Args: never
        Returns: {
          detail: string
          passed: boolean
          test_name: string
        }[]
      }
      workspace_can_send: { Args: { _workspace_id: string }; Returns: boolean }
      workspace_permissions_of: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: string[]
      }
      workspace_provider_limit: {
        Args: { _kind: string; _workspace_id: string }
        Returns: number
      }
      workspace_role_of: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: Database["public"]["Enums"]["workspace_role"]
      }
    }
    Enums: {
      alert_category:
        | "recovery_failure"
        | "webhook_issue"
        | "activation_status"
        | "integration_error"
        | "system"
      alert_severity: "info" | "warning" | "critical"
      alert_status: "open" | "acknowledged" | "dismissed"
      app_role: "super_admin" | "admin" | "user" | "support_agent" | "moderator"
      blog_post_status: "draft" | "scheduled" | "published" | "archived"
      email_pref_category:
        | "billing"
        | "analytics"
        | "recovery"
        | "product"
        | "marketing"
      failure_classification:
        | "soft_decline"
        | "hard_decline"
        | "expired_card"
        | "insufficient_funds"
        | "auth_required"
        | "incorrect_cvc"
        | "fraud_suspected"
        | "temporary_bank"
        | "gateway_timeout"
        | "network_error"
        | "unknown"
      incident_impact: "none" | "minor" | "major" | "critical"
      incident_status:
        | "investigating"
        | "identified"
        | "monitoring"
        | "resolved"
      integration_kind: "store" | "payment_gateway" | "communication"
      integration_status: "pending" | "connected" | "error" | "disconnected"
      marketplace_status: "draft" | "published" | "archived"
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
      success_fee_adjustment_kind: "credit" | "debit" | "refund" | "manual"
      success_fee_status: "draft" | "finalized" | "invoiced" | "paid" | "voided"
      support_category:
        | "general"
        | "billing"
        | "technical"
        | "integration"
        | "recovery_engine"
        | "bug_report"
        | "feature_request"
        | "security"
        | "account"
        | "other"
      support_delivery_status:
        | "sending"
        | "sent"
        | "delivered"
        | "seen"
        | "failed"
      support_feedback_rating:
        | "very_unsatisfied"
        | "unsatisfied"
        | "neutral"
        | "satisfied"
        | "very_satisfied"
      support_message_kind: "text" | "system" | "note"
      support_presence_status:
        | "online"
        | "available"
        | "busy"
        | "away"
        | "offline"
      support_priority: "low" | "normal" | "high" | "urgent" | "critical"
      support_status:
        | "open"
        | "pending"
        | "waiting"
        | "resolved"
        | "closed"
        | "archived"
      template_source: "curated" | "ai_generated" | "custom"
      workspace_role: "owner" | "admin" | "manager" | "member" | "viewer"
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
      alert_category: [
        "recovery_failure",
        "webhook_issue",
        "activation_status",
        "integration_error",
        "system",
      ],
      alert_severity: ["info", "warning", "critical"],
      alert_status: ["open", "acknowledged", "dismissed"],
      app_role: ["super_admin", "admin", "user", "support_agent", "moderator"],
      blog_post_status: ["draft", "scheduled", "published", "archived"],
      email_pref_category: [
        "billing",
        "analytics",
        "recovery",
        "product",
        "marketing",
      ],
      failure_classification: [
        "soft_decline",
        "hard_decline",
        "expired_card",
        "insufficient_funds",
        "auth_required",
        "incorrect_cvc",
        "fraud_suspected",
        "temporary_bank",
        "gateway_timeout",
        "network_error",
        "unknown",
      ],
      incident_impact: ["none", "minor", "major", "critical"],
      incident_status: [
        "investigating",
        "identified",
        "monitoring",
        "resolved",
      ],
      integration_kind: ["store", "payment_gateway", "communication"],
      integration_status: ["pending", "connected", "error", "disconnected"],
      marketplace_status: ["draft", "published", "archived"],
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
      success_fee_adjustment_kind: ["credit", "debit", "refund", "manual"],
      success_fee_status: ["draft", "finalized", "invoiced", "paid", "voided"],
      support_category: [
        "general",
        "billing",
        "technical",
        "integration",
        "recovery_engine",
        "bug_report",
        "feature_request",
        "security",
        "account",
        "other",
      ],
      support_delivery_status: [
        "sending",
        "sent",
        "delivered",
        "seen",
        "failed",
      ],
      support_feedback_rating: [
        "very_unsatisfied",
        "unsatisfied",
        "neutral",
        "satisfied",
        "very_satisfied",
      ],
      support_message_kind: ["text", "system", "note"],
      support_presence_status: [
        "online",
        "available",
        "busy",
        "away",
        "offline",
      ],
      support_priority: ["low", "normal", "high", "urgent", "critical"],
      support_status: [
        "open",
        "pending",
        "waiting",
        "resolved",
        "closed",
        "archived",
      ],
      template_source: ["curated", "ai_generated", "custom"],
      workspace_role: ["owner", "admin", "manager", "member", "viewer"],
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
