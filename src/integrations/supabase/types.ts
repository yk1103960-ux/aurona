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
      abandoned_carts: {
        Row: {
          account_type: string | null
          cart_signature: string
          cart_value: number
          contact_email: string | null
          contact_phone: string | null
          coupon_code: string | null
          coupon_expires_at: string | null
          created_at: string
          customer_name: string | null
          first_reminder_at: string | null
          id: string
          item_count: number
          items: Json
          last_activity_at: string
          recovered_at: string | null
          recovered_order_id: string | null
          second_reminder_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: string | null
          cart_signature: string
          cart_value?: number
          contact_email?: string | null
          contact_phone?: string | null
          coupon_code?: string | null
          coupon_expires_at?: string | null
          created_at?: string
          customer_name?: string | null
          first_reminder_at?: string | null
          id?: string
          item_count?: number
          items?: Json
          last_activity_at?: string
          recovered_at?: string | null
          recovered_order_id?: string | null
          second_reminder_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string | null
          cart_signature?: string
          cart_value?: number
          contact_email?: string | null
          contact_phone?: string | null
          coupon_code?: string | null
          coupon_expires_at?: string | null
          created_at?: string
          customer_name?: string | null
          first_reminder_at?: string | null
          id?: string
          item_count?: number
          items?: Json
          last_activity_at?: string
          recovered_at?: string | null
          recovered_order_id?: string | null
          second_reminder_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "abandoned_carts_recovered_order_id_fkey"
            columns: ["recovered_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      addresses: {
        Row: {
          city: string
          created_at: string
          district: string | null
          full_name: string
          id: string
          is_default: boolean
          label: string | null
          landmark: string | null
          line1: string
          line2: string | null
          phone: string
          pincode: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          created_at?: string
          district?: string | null
          full_name: string
          id?: string
          is_default?: boolean
          label?: string | null
          landmark?: string | null
          line1: string
          line2?: string | null
          phone: string
          pincode: string
          state: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          created_at?: string
          district?: string | null
          full_name?: string
          id?: string
          is_default?: boolean
          label?: string | null
          landmark?: string | null
          line1?: string
          line2?: string | null
          phone?: string
          pincode?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      affiliate_commission_items: {
        Row: {
          affiliate_id: string
          amount: number
          commission_id: string
          commission_kind: string
          commission_value: number
          created_at: string
          eligible_amount: number
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          amount?: number
          commission_id: string
          commission_kind?: string
          commission_value?: number
          created_at?: string
          eligible_amount?: number
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          amount?: number
          commission_id?: string
          commission_kind?: string
          commission_value?: number
          created_at?: string
          eligible_amount?: number
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commission_items_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commission_items_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "affiliate_commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commission_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commission_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_commissions: {
        Row: {
          affiliate_id: string
          amount: number
          approved_at: string | null
          commission_kind: Database["public"]["Enums"]["commission_kind"]
          commission_value: number
          created_at: string
          eligible_amount: number
          id: string
          order_id: string | null
          order_number: string | null
          order_total: number
          paid_at: string | null
          reason: string | null
          referral_id: string | null
          status: Database["public"]["Enums"]["commission_status"]
          updated_at: string
          withdrawal_id: string | null
        }
        Insert: {
          affiliate_id: string
          amount?: number
          approved_at?: string | null
          commission_kind: Database["public"]["Enums"]["commission_kind"]
          commission_value: number
          created_at?: string
          eligible_amount?: number
          id?: string
          order_id?: string | null
          order_number?: string | null
          order_total?: number
          paid_at?: string | null
          reason?: string | null
          referral_id?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
          withdrawal_id?: string | null
        }
        Update: {
          affiliate_id?: string
          amount?: number
          approved_at?: string | null
          commission_kind?: Database["public"]["Enums"]["commission_kind"]
          commission_value?: number
          created_at?: string
          eligible_amount?: number
          id?: string
          order_id?: string | null
          order_number?: string | null
          order_total?: number
          paid_at?: string | null
          reason?: string | null
          referral_id?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
          withdrawal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "affiliate_referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          affiliate_id: string | null
          created_at: string
          detail: Json
          id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          affiliate_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          affiliate_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_logs_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_product_clicks: {
        Row: {
          affiliate_id: string
          created_at: string
          id: string
          ip: string | null
          landing_path: string | null
          product_id: string | null
          referrer: string | null
          source: string | null
          user_agent: string | null
          user_id: string | null
          visitor_id: string | null
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          id?: string
          ip?: string | null
          landing_path?: string | null
          product_id?: string | null
          referrer?: string | null
          source?: string | null
          user_agent?: string | null
          user_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          id?: string
          ip?: string | null
          landing_path?: string | null
          product_id?: string | null
          referrer?: string | null
          source?: string | null
          user_agent?: string | null
          user_id?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_product_clicks_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_product_clicks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_referrals: {
        Row: {
          affiliate_id: string
          converted_at: string | null
          created_at: string
          expires_at: string
          first_seen_at: string
          id: string
          ip: string | null
          landing_path: string | null
          product_id: string | null
          referrer: string | null
          user_agent: string | null
          user_id: string | null
          visitor_id: string | null
        }
        Insert: {
          affiliate_id: string
          converted_at?: string | null
          created_at?: string
          expires_at: string
          first_seen_at?: string
          id?: string
          ip?: string | null
          landing_path?: string | null
          product_id?: string | null
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          affiliate_id?: string
          converted_at?: string | null
          created_at?: string
          expires_at?: string
          first_seen_at?: string
          id?: string
          ip?: string | null
          landing_path?: string | null
          product_id?: string | null
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_referrals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_settings: {
        Row: {
          attribution_days: number
          auto_approve_affiliates: boolean
          auto_approve_commission_on_delivery: boolean
          cookie_days: number
          created_at: string
          default_commission_kind: Database["public"]["Enums"]["commission_kind"]
          default_commission_value: number
          enabled: boolean
          exclude_shipping: boolean
          id: boolean
          min_payout: number
          terms: string | null
          updated_at: string
        }
        Insert: {
          attribution_days?: number
          auto_approve_affiliates?: boolean
          auto_approve_commission_on_delivery?: boolean
          cookie_days?: number
          created_at?: string
          default_commission_kind?: Database["public"]["Enums"]["commission_kind"]
          default_commission_value?: number
          enabled?: boolean
          exclude_shipping?: boolean
          id?: boolean
          min_payout?: number
          terms?: string | null
          updated_at?: string
        }
        Update: {
          attribution_days?: number
          auto_approve_affiliates?: boolean
          auto_approve_commission_on_delivery?: boolean
          cookie_days?: number
          created_at?: string
          default_commission_kind?: Database["public"]["Enums"]["commission_kind"]
          default_commission_value?: number
          enabled?: boolean
          exclude_shipping?: boolean
          id?: boolean
          min_payout?: number
          terms?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      affiliate_withdrawals: {
        Row: {
          admin_note: string | null
          affiliate_id: string
          amount: number
          created_at: string
          id: string
          method: string
          payout_snapshot: Json
          processed_at: string | null
          processed_by: string | null
          reference: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          affiliate_id: string
          amount: number
          created_at?: string
          id?: string
          method?: string
          payout_snapshot?: Json
          processed_at?: string | null
          processed_by?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          affiliate_id?: string
          amount?: number
          created_at?: string
          id?: string
          method?: string
          payout_snapshot?: Json
          processed_at?: string | null
          processed_by?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_withdrawals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          address: string | null
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          city: string | null
          code: string
          commission_kind: Database["public"]["Enums"]["commission_kind"] | null
          commission_value: number | null
          company: string | null
          created_at: string
          email: string
          full_name: string
          gstin: string | null
          id: string
          mobile: string
          notes: string | null
          pan: string | null
          payout_account_name: string | null
          payout_account_number: string | null
          payout_bank: string | null
          payout_ifsc: string | null
          payout_method: string
          payout_upi: string | null
          pincode: string | null
          state: string | null
          status: Database["public"]["Enums"]["affiliate_status"]
          updated_at: string
          user_id: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          city?: string | null
          code: string
          commission_kind?:
            | Database["public"]["Enums"]["commission_kind"]
            | null
          commission_value?: number | null
          company?: string | null
          created_at?: string
          email: string
          full_name: string
          gstin?: string | null
          id?: string
          mobile: string
          notes?: string | null
          pan?: string | null
          payout_account_name?: string | null
          payout_account_number?: string | null
          payout_bank?: string | null
          payout_ifsc?: string | null
          payout_method?: string
          payout_upi?: string | null
          pincode?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["affiliate_status"]
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          city?: string | null
          code?: string
          commission_kind?:
            | Database["public"]["Enums"]["commission_kind"]
            | null
          commission_value?: number | null
          company?: string | null
          created_at?: string
          email?: string
          full_name?: string
          gstin?: string | null
          id?: string
          mobile?: string
          notes?: string | null
          pan?: string | null
          payout_account_name?: string | null
          payout_account_number?: string | null
          payout_bank?: string | null
          payout_ifsc?: string | null
          payout_method?: string
          payout_upi?: string | null
          pincode?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["affiliate_status"]
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      auth_login_attempts: {
        Row: {
          created_at: string
          id: string
          identifier: string
          ip: string | null
          method: string
          reason: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          identifier: string
          ip?: string | null
          method?: string
          reason?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          identifier?: string
          ip?: string | null
          method?: string
          reason?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      auth_otp_challenges: {
        Row: {
          attempts: number
          channel: string
          code_hash: string
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          phone: string | null
          purpose: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          channel?: string
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          phone?: string | null
          purpose?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          channel?: string
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          phone?: string | null
          purpose?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author: string
          body: Json
          category: string
          cover_url: string | null
          created_at: string
          excerpt: string
          id: string
          is_published: boolean
          published_at: string
          read_minutes: number
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author?: string
          body?: Json
          category?: string
          cover_url?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          is_published?: boolean
          published_at?: string
          read_minutes?: number
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author?: string
          body?: Json
          category?: string
          cover_url?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          is_published?: boolean
          published_at?: string
          read_minutes?: number
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      career_applications: {
        Row: {
          city: string | null
          consent_at: string | null
          created_at: string
          email: string
          experience: string | null
          full_name: string
          id: string
          message: string | null
          phone: string
          program_id: string | null
          program_title: string
          qualification: string | null
          resume_path: string | null
          resume_url: string | null
          state: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          city?: string | null
          consent_at?: string | null
          created_at?: string
          email: string
          experience?: string | null
          full_name: string
          id?: string
          message?: string | null
          phone: string
          program_id?: string | null
          program_title: string
          qualification?: string | null
          resume_path?: string | null
          resume_url?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          city?: string | null
          consent_at?: string | null
          created_at?: string
          email?: string
          experience?: string | null
          full_name?: string
          id?: string
          message?: string | null
          phone?: string
          program_id?: string | null
          program_title?: string
          qualification?: string | null
          resume_path?: string | null
          resume_url?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "career_applications_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "career_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      career_programs: {
        Row: {
          apply_email: string | null
          apply_url: string | null
          closes_at: string | null
          created_at: string
          department: string | null
          description: string
          eligibility: string | null
          employment_type: string | null
          id: string
          is_published: boolean
          kind: string
          location: string | null
          reward: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          apply_email?: string | null
          apply_url?: string | null
          closes_at?: string | null
          created_at?: string
          department?: string | null
          description?: string
          eligibility?: string | null
          employment_type?: string | null
          id?: string
          is_published?: boolean
          kind?: string
          location?: string | null
          reward?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          apply_email?: string | null
          apply_url?: string | null
          closes_at?: string | null
          created_at?: string
          department?: string | null
          description?: string
          eligibility?: string | null
          employment_type?: string | null
          id?: string
          is_published?: boolean
          kind?: string
          location?: string | null
          reward?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_reminders: {
        Row: {
          cart_signature: string
          coupon_code: string | null
          id: string
          sent_at: string
          stage: string
          user_id: string
        }
        Insert: {
          cart_signature: string
          coupon_code?: string | null
          id?: string
          sent_at?: string
          stage: string
          user_id: string
        }
        Update: {
          cart_signature?: string
          coupon_code?: string | null
          id?: string
          sent_at?: string
          stage?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          parent_group: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          parent_group: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          parent_group?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      cms_blocks: {
        Row: {
          active: boolean
          created_at: string
          ends_at: string | null
          id: string
          key: string
          payload: Json
          sort_order: number
          starts_at: string | null
          title: string | null
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          key: string
          payload?: Json
          sort_order?: number
          starts_at?: string | null
          title?: string | null
          type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          key?: string
          payload?: Json
          sort_order?: number
          starts_at?: string | null
          title?: string | null
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string
          discount_amount: number
          id: string
          order_id: string | null
          user_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          discount_amount: number
          id?: string
          order_id?: string | null
          user_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          discount_amount?: number
          id?: string
          order_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          eligible_roles: string[]
          expires_at: string | null
          id: string
          max_discount: number | null
          min_order_value: number
          per_user_limit: number
          starts_at: string | null
          times_used: number
          type: Database["public"]["Enums"]["coupon_type"]
          updated_at: string
          usage_limit: number | null
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          eligible_roles?: string[]
          expires_at?: string | null
          id?: string
          max_discount?: number | null
          min_order_value?: number
          per_user_limit?: number
          starts_at?: string | null
          times_used?: number
          type: Database["public"]["Enums"]["coupon_type"]
          updated_at?: string
          usage_limit?: number | null
          value: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          eligible_roles?: string[]
          expires_at?: string | null
          id?: string
          max_discount?: number | null
          min_order_value?: number
          per_user_limit?: number
          starts_at?: string | null
          times_used?: number
          type?: Database["public"]["Enums"]["coupon_type"]
          updated_at?: string
          usage_limit?: number | null
          value?: number
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer: string
          category: string
          created_at: string
          id: string
          is_published: boolean
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer: string
          category?: string
          created_at?: string
          id?: string
          is_published?: boolean
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          id?: string
          is_published?: boolean
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          config_public: Json
          config_secret_ciphertext: string | null
          created_at: string
          enabled: boolean
          last_sync_at: string | null
          last_sync_summary: Json | null
          last_test_message: string | null
          last_tested_at: string | null
          provider: string
          secret_masked: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config_public?: Json
          config_secret_ciphertext?: string | null
          created_at?: string
          enabled?: boolean
          last_sync_at?: string | null
          last_sync_summary?: Json | null
          last_test_message?: string | null
          last_tested_at?: string | null
          provider: string
          secret_masked?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config_public?: Json
          config_secret_ciphertext?: string | null
          created_at?: string
          enabled?: boolean
          last_sync_at?: string | null
          last_sync_summary?: Json | null
          last_test_message?: string | null
          last_tested_at?: string | null
          provider?: string
          secret_masked?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          created_at: string
          folder: string
          id: string
          mime_type: string | null
          name: string
          path: string
          size_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          folder?: string
          id?: string
          mime_type?: string | null
          name: string
          path: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          folder?: string
          id?: string
          mime_type?: string | null
          name?: string
          path?: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string
          unsubscribed_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string
          unsubscribed_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          channel: string
          created_at: string
          id: string
          kind: string
          provider_message: string | null
          recipient_masked: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          kind: string
          provider_message?: string | null
          recipient_masked?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          kind?: string
          provider_message?: string | null
          recipient_masked?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          attempts: number
          body: string | null
          channel: string
          created_at: string
          id: string
          payload: Json
          provider: string | null
          provider_message: string | null
          recipient: string
          related_id: string | null
          related_type: string | null
          sent_at: string | null
          status: string
          subject: string | null
          template: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          body?: string | null
          channel: string
          created_at?: string
          id?: string
          payload?: Json
          provider?: string | null
          provider_message?: string | null
          recipient: string
          related_id?: string | null
          related_type?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          body?: string | null
          channel?: string
          created_at?: string
          id?: string
          payload?: Json
          provider?: string | null
          provider_message?: string | null
          recipient?: string
          related_id?: string | null
          related_type?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          price: number
          product_id: string | null
          product_name: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          price: number
          product_id?: string | null
          product_name: string
          quantity: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          price?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          awb_code: string | null
          city: string
          courier_name: string | null
          created_at: string
          discount: number
          discount_code: string | null
          email: string | null
          full_name: string
          id: string
          order_number: string
          payment_method: string
          payment_provider_order_id: string | null
          payment_provider_payment_id: string | null
          payment_status: string
          phone: string
          pincode: string
          shipment_id: string | null
          shipment_provider: string | null
          shipment_status: string | null
          shipment_synced_at: string | null
          shipping: number
          state: string
          status: string
          subtotal: number
          total: number
          tracking_url: string | null
          user_id: string
        }
        Insert: {
          address: string
          awb_code?: string | null
          city: string
          courier_name?: string | null
          created_at?: string
          discount?: number
          discount_code?: string | null
          email?: string | null
          full_name: string
          id?: string
          order_number?: string
          payment_method?: string
          payment_provider_order_id?: string | null
          payment_provider_payment_id?: string | null
          payment_status?: string
          phone: string
          pincode: string
          shipment_id?: string | null
          shipment_provider?: string | null
          shipment_status?: string | null
          shipment_synced_at?: string | null
          shipping?: number
          state: string
          status?: string
          subtotal: number
          total: number
          tracking_url?: string | null
          user_id: string
        }
        Update: {
          address?: string
          awb_code?: string | null
          city?: string
          courier_name?: string | null
          created_at?: string
          discount?: number
          discount_code?: string | null
          email?: string | null
          full_name?: string
          id?: string
          order_number?: string
          payment_method?: string
          payment_provider_order_id?: string | null
          payment_provider_payment_id?: string | null
          payment_status?: string
          phone?: string
          pincode?: string
          shipment_id?: string | null
          shipment_provider?: string | null
          shipment_status?: string | null
          shipment_synced_at?: string | null
          shipping?: number
          state?: string
          status?: string
          subtotal?: number
          total?: number
          tracking_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      partner_applications: {
        Row: {
          address: string | null
          admin_notes: string | null
          business_name: string | null
          business_type: string | null
          cin: string | null
          city: string | null
          company_registration_url: string | null
          created_at: string
          distribution_area: string | null
          email: string
          existing_brands: string | null
          expected_monthly_purchase: string | null
          extra: Json | null
          full_name: string
          gst_certificate_url: string | null
          gstin: string | null
          id: string
          mobile: string
          monthly_purchase_volume: string | null
          owner_name: string | null
          pan: string | null
          partner_type: Database["public"]["Enums"]["partner_type"]
          pincode: string | null
          product_categories: string[] | null
          reviewed_at: string | null
          reviewed_by: string | null
          sales_team_size: string | null
          shop_license_url: string | null
          state: string | null
          status: Database["public"]["Enums"]["application_status"]
          trade_license_url: string | null
          updated_at: string
          user_id: string | null
          warehouse_capacity: string | null
          years_in_business: string | null
        }
        Insert: {
          address?: string | null
          admin_notes?: string | null
          business_name?: string | null
          business_type?: string | null
          cin?: string | null
          city?: string | null
          company_registration_url?: string | null
          created_at?: string
          distribution_area?: string | null
          email: string
          existing_brands?: string | null
          expected_monthly_purchase?: string | null
          extra?: Json | null
          full_name: string
          gst_certificate_url?: string | null
          gstin?: string | null
          id?: string
          mobile: string
          monthly_purchase_volume?: string | null
          owner_name?: string | null
          pan?: string | null
          partner_type: Database["public"]["Enums"]["partner_type"]
          pincode?: string | null
          product_categories?: string[] | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sales_team_size?: string | null
          shop_license_url?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          trade_license_url?: string | null
          updated_at?: string
          user_id?: string | null
          warehouse_capacity?: string | null
          years_in_business?: string | null
        }
        Update: {
          address?: string | null
          admin_notes?: string | null
          business_name?: string | null
          business_type?: string | null
          cin?: string | null
          city?: string | null
          company_registration_url?: string | null
          created_at?: string
          distribution_area?: string | null
          email?: string
          existing_brands?: string | null
          expected_monthly_purchase?: string | null
          extra?: Json | null
          full_name?: string
          gst_certificate_url?: string | null
          gstin?: string | null
          id?: string
          mobile?: string
          monthly_purchase_volume?: string | null
          owner_name?: string | null
          pan?: string | null
          partner_type?: Database["public"]["Enums"]["partner_type"]
          pincode?: string | null
          product_categories?: string[] | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sales_team_size?: string | null
          shop_license_url?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          trade_license_url?: string | null
          updated_at?: string
          user_id?: string | null
          warehouse_capacity?: string | null
          years_in_business?: string | null
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          amount: number | null
          checkout_host: string | null
          created_at: string
          currency: string
          endpoint: string | null
          environment: string | null
          http_method: string | null
          http_status: number | null
          id: string
          merchant_txn_id: string | null
          ok: boolean
          order_id: string | null
          payment_state: string | null
          provider: string
          provider_code: string | null
          provider_message: string | null
          stage: string
        }
        Insert: {
          amount?: number | null
          checkout_host?: string | null
          created_at?: string
          currency?: string
          endpoint?: string | null
          environment?: string | null
          http_method?: string | null
          http_status?: number | null
          id?: string
          merchant_txn_id?: string | null
          ok?: boolean
          order_id?: string | null
          payment_state?: string | null
          provider?: string
          provider_code?: string | null
          provider_message?: string | null
          stage: string
        }
        Update: {
          amount?: number | null
          checkout_host?: string | null
          created_at?: string
          currency?: string
          endpoint?: string | null
          environment?: string | null
          http_method?: string | null
          http_status?: number | null
          id?: string
          merchant_txn_id?: string | null
          ok?: boolean
          order_id?: string | null
          payment_state?: string | null
          provider?: string
          provider_code?: string | null
          provider_message?: string | null
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateways: {
        Row: {
          config_public: Json
          config_secret_ciphertext: string | null
          connected_at: string | null
          enabled: boolean
          mode: string
          provider: string
          secret_last4: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config_public?: Json
          config_secret_ciphertext?: string | null
          connected_at?: string | null
          enabled?: boolean
          mode?: string
          provider: string
          secret_last4?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config_public?: Json
          config_secret_ciphertext?: string | null
          connected_at?: string | null
          enabled?: boolean
          mode?: string
          provider?: string
          secret_last4?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      product_families: {
        Row: {
          body_type: string | null
          brand: string
          category_id: string | null
          created_at: string
          description: string | null
          features: Json
          id: string
          image_seed: string | null
          is_bestseller: boolean
          is_featured: boolean
          is_new: boolean
          is_sale: boolean
          main_sku: string
          material: string | null
          max_mrp: number | null
          max_price: number | null
          min_mrp: number | null
          min_price: number | null
          name: string
          rating: number
          review_count: number
          short_description: string | null
          slug: string
          specifications: Json
          total_stock: number
          updated_at: string
          warranty: string | null
        }
        Insert: {
          body_type?: string | null
          brand?: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          image_seed?: string | null
          is_bestseller?: boolean
          is_featured?: boolean
          is_new?: boolean
          is_sale?: boolean
          main_sku: string
          material?: string | null
          max_mrp?: number | null
          max_price?: number | null
          min_mrp?: number | null
          min_price?: number | null
          name: string
          rating?: number
          review_count?: number
          short_description?: string | null
          slug: string
          specifications?: Json
          total_stock?: number
          updated_at?: string
          warranty?: string | null
        }
        Update: {
          body_type?: string | null
          brand?: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          image_seed?: string | null
          is_bestseller?: boolean
          is_featured?: boolean
          is_new?: boolean
          is_sale?: boolean
          main_sku?: string
          material?: string | null
          max_mrp?: number | null
          max_price?: number | null
          min_mrp?: number | null
          min_price?: number | null
          name?: string
          rating?: number
          review_count?: number
          short_description?: string | null
          slug?: string
          specifications?: Json
          total_stock?: number
          updated_at?: string
          warranty?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_families_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          family_id: string | null
          id: string
          image_url: string
          is_primary: boolean
          product_id: string | null
          sort_order: number
          variant_sku: string | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          family_id?: string | null
          id?: string
          image_url: string
          is_primary?: boolean
          product_id?: string | null
          sort_order?: number
          variant_sku?: string | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          family_id?: string | null
          id?: string
          image_url?: string
          is_primary?: boolean
          product_id?: string | null
          sort_order?: number
          variant_sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "product_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variant_axes: {
        Row: {
          axis_key: string
          family_id: string
          id: string
          label: string
          sort_order: number
          values: Json
        }
        Insert: {
          axis_key: string
          family_id: string
          id?: string
          label: string
          sort_order?: number
          values?: Json
        }
        Update: {
          axis_key?: string
          family_id?: string
          id?: string
          label?: string
          sort_order?: number
          values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "product_variant_axes_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "product_families"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          attributes: Json
          created_at: string
          dim_h: number | null
          dim_l: number | null
          dim_w: number | null
          discount_pct: number | null
          distributor_moq: number | null
          distributor_price: number | null
          family_id: string
          id: string
          image_seed: string | null
          is_active: boolean
          moq: number
          mrp: number
          pack_h: number | null
          pack_l: number | null
          pack_size: number | null
          pack_w: number | null
          pack_weight_g: number | null
          price: number
          retailer_moq: number | null
          retailer_price: number | null
          sku: string
          sort_order: number
          stock: number
          weight_g: number | null
        }
        Insert: {
          attributes?: Json
          created_at?: string
          dim_h?: number | null
          dim_l?: number | null
          dim_w?: number | null
          discount_pct?: number | null
          distributor_moq?: number | null
          distributor_price?: number | null
          family_id: string
          id?: string
          image_seed?: string | null
          is_active?: boolean
          moq?: number
          mrp: number
          pack_h?: number | null
          pack_l?: number | null
          pack_size?: number | null
          pack_w?: number | null
          pack_weight_g?: number | null
          price: number
          retailer_moq?: number | null
          retailer_price?: number | null
          sku: string
          sort_order?: number
          stock?: number
          weight_g?: number | null
        }
        Update: {
          attributes?: Json
          created_at?: string
          dim_h?: number | null
          dim_l?: number | null
          dim_w?: number | null
          discount_pct?: number | null
          distributor_moq?: number | null
          distributor_price?: number | null
          family_id?: string
          id?: string
          image_seed?: string | null
          is_active?: boolean
          moq?: number
          mrp?: number
          pack_h?: number | null
          pack_l?: number | null
          pack_size?: number | null
          pack_w?: number | null
          pack_weight_g?: number | null
          price?: number
          retailer_moq?: number | null
          retailer_price?: number | null
          sku?: string
          sort_order?: number
          stock?: number
          weight_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "product_families"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          affiliate_commission_kind: string
          affiliate_commission_value: number | null
          affiliate_enabled: boolean
          affiliate_ends_at: string | null
          affiliate_max_commission: number | null
          affiliate_starts_at: string | null
          body_type: string | null
          brand: string
          category_id: string | null
          color_temp: string | null
          created_at: string
          description: string | null
          dim_h: number | null
          dim_l: number | null
          dim_w: number | null
          features: Json
          id: string
          image_seed: string | null
          is_bestseller: boolean
          is_featured: boolean
          is_new: boolean
          is_published: boolean
          is_sale: boolean
          material: string | null
          model: string | null
          mrp: number
          name: string
          pack_size: number | null
          price: number
          rating: number
          review_count: number
          short_description: string | null
          size: string | null
          sku: string
          slug: string
          specifications: Json
          stock: number
          unit: string
          variations: Json | null
          warranty: string | null
          wattage: string | null
          weight_g: number | null
        }
        Insert: {
          affiliate_commission_kind?: string
          affiliate_commission_value?: number | null
          affiliate_enabled?: boolean
          affiliate_ends_at?: string | null
          affiliate_max_commission?: number | null
          affiliate_starts_at?: string | null
          body_type?: string | null
          brand?: string
          category_id?: string | null
          color_temp?: string | null
          created_at?: string
          description?: string | null
          dim_h?: number | null
          dim_l?: number | null
          dim_w?: number | null
          features?: Json
          id?: string
          image_seed?: string | null
          is_bestseller?: boolean
          is_featured?: boolean
          is_new?: boolean
          is_published?: boolean
          is_sale?: boolean
          material?: string | null
          model?: string | null
          mrp: number
          name: string
          pack_size?: number | null
          price: number
          rating?: number
          review_count?: number
          short_description?: string | null
          size?: string | null
          sku: string
          slug: string
          specifications?: Json
          stock?: number
          unit?: string
          variations?: Json | null
          warranty?: string | null
          wattage?: string | null
          weight_g?: number | null
        }
        Update: {
          affiliate_commission_kind?: string
          affiliate_commission_value?: number | null
          affiliate_enabled?: boolean
          affiliate_ends_at?: string | null
          affiliate_max_commission?: number | null
          affiliate_starts_at?: string | null
          body_type?: string | null
          brand?: string
          category_id?: string | null
          color_temp?: string | null
          created_at?: string
          description?: string | null
          dim_h?: number | null
          dim_l?: number | null
          dim_w?: number | null
          features?: Json
          id?: string
          image_seed?: string | null
          is_bestseller?: boolean
          is_featured?: boolean
          is_new?: boolean
          is_published?: boolean
          is_sale?: boolean
          material?: string | null
          model?: string | null
          mrp?: number
          name?: string
          pack_size?: number | null
          price?: number
          rating?: number
          review_count?: number
          short_description?: string | null
          size?: string | null
          sku?: string
          slug?: string
          specifications?: Json
          stock?: number
          unit?: string
          variations?: Json | null
          warranty?: string | null
          wattage?: string | null
          weight_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string | null
          avatar_url: string | null
          business_name: string | null
          created_at: string
          district: string | null
          full_name: string | null
          gstin: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          account_type?: string | null
          avatar_url?: string | null
          business_name?: string | null
          created_at?: string
          district?: string | null
          full_name?: string | null
          gstin?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: string | null
          avatar_url?: string | null
          business_name?: string | null
          created_at?: string
          district?: string | null
          full_name?: string | null
          gstin?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recently_viewed: {
        Row: {
          id: string
          product_slug: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          product_slug: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          product_slug?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: []
      }
      referral_programs: {
        Row: {
          closes_at: string | null
          commission_kind: string
          commission_value: number
          created_at: string
          description: string
          eligibility: string | null
          id: string
          is_active: boolean
          is_published: boolean
          max_commission: number | null
          min_order_value: number
          name: string
          sort_order: number
          terms: string | null
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          commission_kind?: string
          commission_value?: number
          created_at?: string
          description?: string
          eligibility?: string | null
          id?: string
          is_active?: boolean
          is_published?: boolean
          max_commission?: number | null
          min_order_value?: number
          name: string
          sort_order?: number
          terms?: string | null
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          commission_kind?: string
          commission_value?: number
          created_at?: string
          description?: string
          eligibility?: string | null
          id?: string
          is_active?: boolean
          is_published?: boolean
          max_commission?: number | null
          min_order_value?: number
          name?: string
          sort_order?: number
          terms?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      return_events: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          request_id: string
          status: Database["public"]["Enums"]["return_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          request_id: string
          status: Database["public"]["Enums"]["return_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          request_id?: string
          status?: Database["public"]["Enums"]["return_status"]
        }
        Relationships: [
          {
            foreignKeyName: "return_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      return_request_items: {
        Row: {
          created_at: string
          id: string
          order_item_id: string | null
          price: number
          product_name: string
          quantity: number
          request_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_item_id?: string | null
          price?: number
          product_name: string
          quantity?: number
          request_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_item_id?: string | null
          price?: number
          product_name?: string
          quantity?: number
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_request_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      return_requests: {
        Row: {
          admin_note: string | null
          comments: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["return_kind"]
          order_id: string
          reason: string
          refund_amount: number
          refund_method: string | null
          refund_reference: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["return_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["return_kind"]
          order_id: string
          reason: string
          refund_amount?: number
          refund_method?: string | null
          refund_reference?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["return_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["return_kind"]
          order_id?: string
          reason?: string
          refund_amount?: number
          refund_method?: string | null
          refund_reference?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["return_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_events: {
        Row: {
          awb_code: string | null
          courier_name: string | null
          created_at: string
          event_key: string
          event_time: string | null
          id: string
          location: string | null
          order_id: string | null
          payload: Json | null
          provider: string
          shipment_status: string | null
          status_code: string | null
        }
        Insert: {
          awb_code?: string | null
          courier_name?: string | null
          created_at?: string
          event_key: string
          event_time?: string | null
          id?: string
          location?: string | null
          order_id?: string | null
          payload?: Json | null
          provider?: string
          shipment_status?: string | null
          status_code?: string | null
        }
        Update: {
          awb_code?: string | null
          courier_name?: string | null
          created_at?: string
          event_key?: string
          event_time?: string | null
          id?: string
          location?: string | null
          order_id?: string | null
          payload?: Json | null
          provider?: string
          shipment_status?: string | null
          status_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_providers: {
        Row: {
          auth_token_ciphertext: string | null
          auth_token_expires_at: string | null
          config_public: Json
          connected_at: string | null
          credential_masked: string | null
          credentials_ciphertext: string | null
          enabled: boolean
          last_verified_at: string | null
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auth_token_ciphertext?: string | null
          auth_token_expires_at?: string | null
          config_public?: Json
          connected_at?: string | null
          credential_masked?: string | null
          credentials_ciphertext?: string | null
          enabled?: boolean
          last_verified_at?: string | null
          provider: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auth_token_ciphertext?: string | null
          auth_token_expires_at?: string | null
          config_public?: Json
          connected_at?: string | null
          credential_masked?: string | null
          credentials_ciphertext?: string | null
          enabled?: boolean
          last_verified_at?: string | null
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      shipping_zones: {
        Row: {
          active: boolean
          cod_allowed: boolean
          created_at: string
          flat_rate: number
          free_above: number | null
          id: string
          max_days: number
          min_days: number
          name: string
          pincode_prefixes: string[]
          sort_order: number
          states: string[]
        }
        Insert: {
          active?: boolean
          cod_allowed?: boolean
          created_at?: string
          flat_rate?: number
          free_above?: number | null
          id?: string
          max_days?: number
          min_days?: number
          name: string
          pincode_prefixes?: string[]
          sort_order?: number
          states?: string[]
        }
        Update: {
          active?: boolean
          cod_allowed?: boolean
          created_at?: string
          flat_rate?: number
          free_above?: number | null
          id?: string
          max_days?: number
          min_days?: number
          name?: string
          pincode_prefixes?: string[]
          sort_order?: number
          states?: string[]
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          order_id: string | null
          phone: string | null
          priority: string
          status: string
          subject: string
          ticket_number: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          order_id?: string | null
          phone?: string | null
          priority?: string
          status?: string
          subject: string
          ticket_number?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          order_id?: string | null
          phone?: string | null
          priority?: string
          status?: string
          subject?: string
          ticket_number?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rules: {
        Row: {
          active: boolean
          applies_to: string
          created_at: string
          gst_percent: number
          hsn_code: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          applies_to?: string
          created_at?: string
          gst_percent?: number
          hsn_code?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          applies_to?: string
          created_at?: string
          gst_percent?: number
          hsn_code?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_mfa: {
        Row: {
          backup_codes_ciphertext: string | null
          created_at: string
          last_used_at: string | null
          secret_ciphertext: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          backup_codes_ciphertext?: string | null
          created_at?: string
          last_used_at?: string | null
          secret_ciphertext: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          backup_codes_ciphertext?: string | null
          created_at?: string
          last_used_at?: string | null
          secret_ciphertext?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
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
      user_security: {
        Row: {
          blocked: boolean
          blocked_at: string | null
          blocked_reason: string | null
          created_at: string
          email_verified_at: string | null
          failed_login_count: number
          last_login_at: string | null
          last_login_device: string | null
          last_login_ip: string | null
          locked_until: string | null
          phone_verified_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          blocked?: boolean
          blocked_at?: string | null
          blocked_reason?: string | null
          created_at?: string
          email_verified_at?: string | null
          failed_login_count?: number
          last_login_at?: string | null
          last_login_device?: string | null
          last_login_ip?: string | null
          locked_until?: string | null
          phone_verified_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          blocked?: boolean
          blocked_at?: string | null
          blocked_reason?: string | null
          created_at?: string
          email_verified_at?: string | null
          failed_login_count?: number
          last_login_at?: string | null
          last_login_device?: string | null
          last_login_ip?: string | null
          locked_until?: string | null
          phone_verified_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string
          device: string | null
          id: string
          ip: string | null
          last_seen_at: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device?: string | null
          id?: string
          ip?: string | null
          last_seen_at?: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device?: string | null
          id?: string
          ip?: string | null
          last_seen_at?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      woo_import_records: {
        Row: {
          applied: boolean
          entity: string
          external_id: string
          id: string
          imported_at: string
          payload: Json
        }
        Insert: {
          applied?: boolean
          entity: string
          external_id: string
          id?: string
          imported_at?: string
          payload: Json
        }
        Update: {
          applied?: boolean
          entity?: string
          external_id?: string
          id?: string
          imported_at?: string
          payload?: Json
        }
        Relationships: []
      }
    }
    Views: {
      payment_gateways_public: {
        Row: {
          config_public: Json | null
          connected_at: string | null
          enabled: boolean | null
          mode: string | null
          provider: string | null
          secret_last4: string | null
          updated_at: string | null
        }
        Insert: {
          config_public?: Json | null
          connected_at?: string | null
          enabled?: boolean | null
          mode?: string | null
          provider?: string | null
          secret_last4?: string | null
          updated_at?: string | null
        }
        Update: {
          config_public?: Json | null
          connected_at?: string | null
          enabled?: boolean | null
          mode?: string | null
          provider?: string | null
          secret_last4?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      public_product_variants: {
        Row: {
          attributes: Json | null
          created_at: string | null
          dim_h: number | null
          dim_l: number | null
          dim_w: number | null
          discount_pct: number | null
          family_id: string | null
          id: string | null
          image_seed: string | null
          is_active: boolean | null
          moq: number | null
          mrp: number | null
          pack_h: number | null
          pack_l: number | null
          pack_size: number | null
          pack_w: number | null
          pack_weight_g: number | null
          price: number | null
          sku: string | null
          sort_order: number | null
          stock: number | null
          weight_g: number | null
        }
        Insert: {
          attributes?: Json | null
          created_at?: string | null
          dim_h?: number | null
          dim_l?: number | null
          dim_w?: number | null
          discount_pct?: number | null
          family_id?: string | null
          id?: string | null
          image_seed?: string | null
          is_active?: boolean | null
          moq?: number | null
          mrp?: number | null
          pack_h?: number | null
          pack_l?: number | null
          pack_size?: number | null
          pack_w?: number | null
          pack_weight_g?: number | null
          price?: number | null
          sku?: string | null
          sort_order?: number | null
          stock?: number | null
          weight_g?: number | null
        }
        Update: {
          attributes?: Json | null
          created_at?: string | null
          dim_h?: number | null
          dim_l?: number | null
          dim_w?: number | null
          discount_pct?: number | null
          family_id?: string | null
          id?: string | null
          image_seed?: string | null
          is_active?: boolean | null
          moq?: number | null
          mrp?: number | null
          pack_h?: number | null
          pack_l?: number | null
          pack_size?: number | null
          pack_w?: number | null
          pack_weight_g?: number | null
          price?: number | null
          sku?: string | null
          sort_order?: number | null
          stock?: number | null
          weight_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "product_families"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      affiliate_balance: {
        Args: { _affiliate_id: string }
        Returns: {
          approved: number
          available: number
          paid: number
          pending: number
          reversed: number
          withdrawn_pending: number
        }[]
      }
      approve_partner: {
        Args: { _app_id: string; _decision: string }
        Returns: undefined
      }
      current_pricing_role: { Args: never; Returns: string }
      get_visible_prices: {
        Args: { _skus: string[] }
        Returns: {
          mrp: number
          price: number
          role: string
          sku: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_mfa_enrolled: { Args: { _uid: string }; Returns: boolean }
      is_partner_approved: {
        Args: {
          _type: Database["public"]["Enums"]["partner_type"]
          _uid: string
        }
        Returns: boolean
      }
      my_role_status: {
        Args: never
        Returns: {
          intended_role: string
          role: string
          status: string
        }[]
      }
      redeem_coupon: {
        Args: { _amount: number; _coupon_id: string; _order_id: string }
        Returns: undefined
      }
      validate_coupon: {
        Args: { _code: string; _subtotal: number }
        Returns: {
          coupon_id: string
          discount: number
          reason: string
        }[]
      }
    }
    Enums: {
      affiliate_status: "pending" | "approved" | "suspended" | "rejected"
      app_role: "admin" | "customer" | "retailer" | "distributor" | "staff"
      application_status: "pending" | "under_review" | "approved" | "rejected"
      commission_kind: "percentage" | "fixed"
      commission_status:
        | "pending"
        | "approved"
        | "paid"
        | "reversed"
        | "cancelled"
      coupon_type: "flat" | "percentage"
      partner_type:
        | "retailer"
        | "distributor"
        | "sales"
        | "reseller"
        | "referral"
        | "affiliate"
        | "corporate"
        | "government"
        | "architect"
        | "contractor"
        | "oem"
        | "builder"
        | "career"
      return_kind: "return" | "replacement" | "cancellation"
      return_status:
        | "requested"
        | "approved"
        | "rejected"
        | "pickup_scheduled"
        | "picked_up"
        | "received"
        | "refund_initiated"
        | "refunded"
        | "completed"
        | "cancelled"
      withdrawal_status:
        | "requested"
        | "approved"
        | "processing"
        | "paid"
        | "rejected"
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
      affiliate_status: ["pending", "approved", "suspended", "rejected"],
      app_role: ["admin", "customer", "retailer", "distributor", "staff"],
      application_status: ["pending", "under_review", "approved", "rejected"],
      commission_kind: ["percentage", "fixed"],
      commission_status: [
        "pending",
        "approved",
        "paid",
        "reversed",
        "cancelled",
      ],
      coupon_type: ["flat", "percentage"],
      partner_type: [
        "retailer",
        "distributor",
        "sales",
        "reseller",
        "referral",
        "affiliate",
        "corporate",
        "government",
        "architect",
        "contractor",
        "oem",
        "builder",
        "career",
      ],
      return_kind: ["return", "replacement", "cancellation"],
      return_status: [
        "requested",
        "approved",
        "rejected",
        "pickup_scheduled",
        "picked_up",
        "received",
        "refund_initiated",
        "refunded",
        "completed",
        "cancelled",
      ],
      withdrawal_status: [
        "requested",
        "approved",
        "processing",
        "paid",
        "rejected",
      ],
    },
  },
} as const
