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
      addresses: {
        Row: {
          city: string
          created_at: string
          full_name: string
          id: string
          is_default: boolean
          label: string | null
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
          full_name: string
          id?: string
          is_default?: boolean
          label?: string | null
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
          full_name?: string
          id?: string
          is_default?: boolean
          label?: string | null
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
          city: string
          created_at: string
          discount: number
          email: string | null
          full_name: string
          id: string
          order_number: string
          payment_method: string
          phone: string
          pincode: string
          shipping: number
          state: string
          status: string
          subtotal: number
          total: number
          user_id: string
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          discount?: number
          email?: string | null
          full_name: string
          id?: string
          order_number?: string
          payment_method?: string
          phone: string
          pincode: string
          shipping?: number
          state: string
          status?: string
          subtotal: number
          total: number
          user_id: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          discount?: number
          email?: string | null
          full_name?: string
          id?: string
          order_number?: string
          payment_method?: string
          phone?: string
          pincode?: string
          shipping?: number
          state?: string
          status?: string
          subtotal?: number
          total?: number
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
      product_families: {
        Row: {
          brand: string
          category_id: string | null
          created_at: string
          description: string | null
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
          total_stock: number
          updated_at: string
          warranty: string | null
        }
        Insert: {
          brand?: string
          category_id?: string | null
          created_at?: string
          description?: string | null
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
          total_stock?: number
          updated_at?: string
          warranty?: string | null
        }
        Update: {
          brand?: string
          category_id?: string | null
          created_at?: string
          description?: string | null
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
          brand: string
          category_id: string | null
          color_temp: string | null
          created_at: string
          description: string | null
          id: string
          image_seed: string | null
          is_bestseller: boolean
          is_featured: boolean
          is_new: boolean
          is_sale: boolean
          material: string | null
          mrp: number
          name: string
          price: number
          rating: number
          review_count: number
          short_description: string | null
          size: string | null
          sku: string
          slug: string
          stock: number
          unit: string
          variations: Json | null
          warranty: string | null
          wattage: string | null
        }
        Insert: {
          brand?: string
          category_id?: string | null
          color_temp?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_seed?: string | null
          is_bestseller?: boolean
          is_featured?: boolean
          is_new?: boolean
          is_sale?: boolean
          material?: string | null
          mrp: number
          name: string
          price: number
          rating?: number
          review_count?: number
          short_description?: string | null
          size?: string | null
          sku: string
          slug: string
          stock?: number
          unit?: string
          variations?: Json | null
          warranty?: string | null
          wattage?: string | null
        }
        Update: {
          brand?: string
          category_id?: string | null
          color_temp?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_seed?: string | null
          is_bestseller?: boolean
          is_featured?: boolean
          is_new?: boolean
          is_sale?: boolean
          material?: string | null
          mrp?: number
          name?: string
          price?: number
          rating?: number
          review_count?: number
          short_description?: string | null
          size?: string | null
          sku?: string
          slug?: string
          stock?: number
          unit?: string
          variations?: Json | null
          warranty?: string | null
          wattage?: string | null
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
          business_name: string | null
          created_at: string
          full_name: string | null
          gstin: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          account_type?: string | null
          business_name?: string | null
          created_at?: string
          full_name?: string | null
          gstin?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: string | null
          business_name?: string | null
          created_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
    }
    Enums: {
      app_role: "admin" | "customer" | "retailer" | "distributor" | "staff"
      application_status: "pending" | "under_review" | "approved" | "rejected"
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
      app_role: ["admin", "customer", "retailer", "distributor", "staff"],
      application_status: ["pending", "under_review", "approved", "rejected"],
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
    },
  },
} as const
