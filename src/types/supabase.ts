export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          name: string
          description: string | null
          price: number
          category: string | null
          images: string[]
          tags: string[]
          stock_status: 'In Stock' | 'Out of Stock'
          variations: Json
          active: boolean
          keywords: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          price: number
          category?: string | null
          images?: string[]
          tags?: string[]
          stock_status?: 'In Stock' | 'Out of Stock'
          variations?: Json
          active?: boolean
          keywords?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          price?: number
          category?: string | null
          images?: string[]
          tags?: string[]
          stock_status?: 'In Stock' | 'Out of Stock'
          variations?: Json
          active?: boolean
          keywords?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          phone: string
          name: string | null
          consented: boolean
          onboarding_status: 'new' | 'awaiting_name' | 'awaiting_consent' | 'done'
          payment_status: 'none' | 'pending' | 'verified' | 'failed'
          support_status: 'bot' | 'human' | 'priority' | 'resolved'
          human_override: boolean
          assigned_staff: string | null
          last_human_message_at: string | null
          unread_count: number
          last_upi_ref: string | null
          last_notified_at: string | null
          favorite_product: string | null
          eggless_preference: boolean
          last_order_at: string | null
          last_order_total: number
          total_orders: number
          total_spent: number
          active_order_id: string | null
          preferred_delivery_type: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          phone: string
          name?: string | null
          consented?: boolean
          onboarding_status?: 'new' | 'awaiting_name' | 'awaiting_consent' | 'done'
          payment_status?: 'none' | 'pending' | 'verified' | 'failed'
          support_status?: 'bot' | 'human' | 'priority' | 'resolved'
          human_override?: boolean
          assigned_staff?: string | null
          last_human_message_at?: string | null
          unread_count?: number
          last_upi_ref?: string | null
          last_notified_at?: string | null
          favorite_product?: string | null
          eggless_preference?: boolean
          last_order_at?: string | null
          last_order_total?: number
          total_orders?: number
          total_spent?: number
          active_order_id?: string | null
          preferred_delivery_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          phone?: string
          name?: string | null
          consented?: boolean
          onboarding_status?: 'new' | 'awaiting_name' | 'awaiting_consent' | 'done'
          payment_status?: 'none' | 'pending' | 'verified' | 'failed'
          support_status?: 'bot' | 'human' | 'priority' | 'resolved'
          human_override?: boolean
          assigned_staff?: string | null
          last_human_message_at?: string | null
          unread_count?: number
          last_upi_ref?: string | null
          last_notified_at?: string | null
          favorite_product?: string | null
          eggless_preference?: boolean
          last_order_at?: string | null
          last_order_total?: number
          total_orders?: number
          total_spent?: number
          active_order_id?: string | null
          preferred_delivery_type?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          email: string | null
          mobile: string | null
          address: string | null
          role: string | null
          email_verified: boolean
          mobile_verified: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          email?: string | null
          mobile?: string | null
          address?: string | null
          role?: string | null
          email_verified?: boolean
          mobile_verified?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          email?: string | null
          mobile?: string | null
          address?: string | null
          role?: string | null
          email_verified?: boolean
          mobile_verified?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          customer_phone: string
          customer_name: string | null
          address: string | null
          door_no: string | null
          street: string | null
          area: string | null
          pincode: string | null
          district: string | null
          special_instructions: string | null
          items: Json
          total: number | null
          product_name: string | null
          quantity: number | null
          total_amount: number | null
          subtotal: number
          delivery_charge: number
          delivery_address: string | null
          delivery_date: string | null
          delivery_type: string | null
          pickup_time: string | null
          status: 'pending' | 'payment_pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled'
          payment_status: string
          payment_method: string
          payment_reference: string | null
          order_source: string
          human_takeover: boolean
          assigned_staff: string | null
          notes: string | null
          admin_notes: string | null
          metadata: Json
          user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_phone: string
          customer_name?: string | null
          address?: string | null
          door_no?: string | null
          street?: string | null
          area?: string | null
          pincode?: string | null
          district?: string | null
          special_instructions?: string | null
          items?: Json
          total?: number | null
          product_name?: string | null
          quantity?: number | null
          total_amount?: number | null
          subtotal?: number
          delivery_charge?: number
          delivery_address?: string | null
          delivery_date?: string | null
          delivery_type?: string | null
          pickup_time?: string | null
          status?: 'pending' | 'payment_pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled'
          payment_status?: string
          payment_method?: string
          payment_reference?: string | null
          order_source?: string
          human_takeover?: boolean
          assigned_staff?: string | null
          notes?: string | null
          admin_notes?: string | null
          metadata?: Json
          user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_phone?: string
          customer_name?: string | null
          address?: string | null
          door_no?: string | null
          street?: string | null
          area?: string | null
          pincode?: string | null
          district?: string | null
          special_instructions?: string | null
          items?: Json
          total?: number | null
          product_name?: string | null
          quantity?: number | null
          total_amount?: number | null
          subtotal?: number
          delivery_charge?: number
          delivery_address?: string | null
          delivery_date?: string | null
          delivery_type?: string | null
          pickup_time?: string | null
          status?: 'pending' | 'payment_pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled'
          payment_status?: string
          payment_method?: string
          payment_reference?: string | null
          order_source?: string
          human_takeover?: boolean
          assigned_staff?: string | null
          notes?: string | null
          admin_notes?: string | null
          metadata?: Json
          user_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      addresses: {
        Row: {
          id: string
          profile_id: string
          label: string
          door_no: string
          street: string
          area: string
          landmark: string | null
          pincode: string
          district: string | null
          state: string | null
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          label?: string
          door_no: string
          street: string
          area: string
          landmark?: string | null
          pincode: string
          district?: string | null
          state?: string | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          label?: string
          door_no?: string
          street?: string
          area?: string
          landmark?: string | null
          pincode?: string
          district?: string | null
          state?: string | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          variant_name: string | null
          quantity: number
          unit_price: number
          total_price: number
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          variant_name?: string | null
          quantity?: number
          unit_price: number
          total_price: number
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          variant_name?: string | null
          quantity?: number
          unit_price?: number
          total_price?: number
          created_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          customer_phone: string
          order_id: string | null
          utr: string | null
          amount: number | null
          payment_method: string
          screenshot_url: string | null
          verified_by: string | null
          verified_at: string | null
          admin_notes: string | null
          status: 'pending' | 'verified' | 'failed'
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          customer_phone: string
          order_id?: string | null
          utr?: string | null
          amount?: number | null
          payment_method?: string
          screenshot_url?: string | null
          verified_by?: string | null
          verified_at?: string | null
          admin_notes?: string | null
          status?: 'pending' | 'verified' | 'failed'
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          customer_phone?: string
          order_id?: string | null
          utr?: string | null
          amount?: number | null
          payment_method?: string
          screenshot_url?: string | null
          verified_by?: string | null
          verified_at?: string | null
          admin_notes?: string | null
          status?: 'pending' | 'verified' | 'failed'
          metadata?: Json
          created_at?: string
        }
      }
      whatsapp_messages: {
        Row: {
          id: string
          whatsapp_id: string | null
          customer_phone: string
          direction: 'inbound' | 'outbound'
          sender_type: 'bot' | 'staff' | 'system'
          content: string
          message_type: string
          media_url: string | null
          reply_to_message_id: string | null
          is_read: boolean
          status: 'sent' | 'delivered' | 'read' | 'failed'
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          whatsapp_id?: string | null
          customer_phone: string
          direction: 'inbound' | 'outbound'
          sender_type?: 'bot' | 'staff' | 'system'
          content: string
          message_type?: string
          media_url?: string | null
          reply_to_message_id?: string | null
          is_read?: boolean
          status?: 'sent' | 'delivered' | 'read' | 'failed'
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          whatsapp_id?: string | null
          customer_phone?: string
          direction?: 'inbound' | 'outbound'
          sender_type?: 'bot' | 'staff' | 'system'
          content?: string
          message_type?: string
          media_url?: string | null
          reply_to_message_id?: string | null
          is_read?: boolean
          status?: 'sent' | 'delivered' | 'read' | 'failed'
          metadata?: Json
          created_at?: string
        }
      }
      whatsapp_sessions: {
        Row: {
          phone_number: string
          state: string
          data: Json
          cart: Json
          customer_name: string | null
          selected_category: string | null
          delivery_type: string | null
          current_order_id: string | null
          last_interaction: string
        }
        Insert: {
          phone_number: string
          state?: string
          data?: Json
          cart?: Json
          customer_name?: string | null
          selected_category?: string | null
          delivery_type?: string | null
          current_order_id?: string | null
          last_interaction?: string
        }
        Update: {
          phone_number?: string
          state?: string
          data?: Json
          cart?: Json
          customer_name?: string | null
          selected_category?: string | null
          delivery_type?: string | null
          current_order_id?: string | null
          last_interaction?: string
        }
      }
      processed_messages: {
        Row: {
          id: string
          message_id: string
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          created_at?: string
        }
      }
      conversation_state: {
        Row: {
          id: string
          customer_phone: string
          current_state: string
          context: Json
          updated_at: string
        }
        Insert: {
          id?: string
          customer_phone: string
          current_state?: string
          context?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          customer_phone?: string
          current_state?: string
          context?: Json
          updated_at?: string
        }
      }
      temp_otps: {
        Row: {
          id: string
          email: string | null
          mobile: string | null
          type: 'email' | 'whatsapp' | null
          otp: string
          created_at: string
        }
        Insert: {
          id?: string
          email?: string | null
          mobile?: string | null
          type?: 'email' | 'whatsapp' | null
          otp: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          mobile?: string | null
          type?: 'email' | 'whatsapp' | null
          otp?: string
          created_at?: string
        }
      }
      staff_notifications: {
        Row: {
          id: string
          customer_phone: string
          type: string | null
          title: string | null
          message: string
          resolved: boolean
          metadata: Json
          created_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          customer_phone: string
          type?: string | null
          title?: string | null
          message: string
          resolved?: boolean
          metadata?: Json
          created_at?: string
          resolved_at?: string | null
        }
        Update: {
          id?: string
          customer_phone?: string
          type?: string | null
          title?: string | null
          message?: string
          resolved?: boolean
          metadata?: Json
          created_at?: string
          resolved_at?: string | null
        }
      }
      chat_assignments: {
        Row: {
          id: string
          customer_phone: string
          assigned_to: string | null
          assigned_by: string | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          customer_phone: string
          assigned_to?: string | null
          assigned_by?: string | null
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          customer_phone?: string
          assigned_to?: string | null
          assigned_by?: string | null
          active?: boolean
          created_at?: string
        }
      }
      customer_tags: {
        Row: {
          id: string
          customer_phone: string
          tag: string
          created_at: string
        }
        Insert: {
          id?: string
          customer_phone: string
          tag: string
          created_at?: string
        }
        Update: {
          id?: string
          customer_phone?: string
          tag?: string
          created_at?: string
        }
      }
      ai_logs: {
        Row: {
          id: string
          customer_phone: string | null
          model: string | null
          model_used: string | null
          prompt: string | null
          response: string | null
          success: boolean
          error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_phone?: string | null
          model?: string | null
          model_used?: string | null
          prompt?: string | null
          response?: string | null
          success?: boolean
          error?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          customer_phone?: string | null
          model?: string | null
          model_used?: string | null
          prompt?: string | null
          response?: string | null
          success?: boolean
          error?: string | null
          created_at?: string
        }
      }
      site_content: {
        Row: {
          id: string
          key: string
          value: string
          category: string | null
          created_at: string
        }
        Insert: {
          id?: string
          key: string
          value: string
          category?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: string
          category?: string | null
          created_at?: string
        }
      }
      product_categories: {
        Row: {
          id: string
          name: string
          emoji: string
          image_url: string | null
          parent_id: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          emoji?: string
          image_url?: string | null
          parent_id?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          emoji?: string
          image_url?: string | null
          parent_id?: string | null
          sort_order?: number
          created_at?: string
        }
      }
      inventory: {
        Row: {
          id: string
          name: string
          current_stock: number
          unit: string
          low_stock_threshold: number
          product_id: string | null
          last_updated: string
        }
        Insert: {
          id?: string
          name: string
          current_stock?: number
          unit: string
          low_stock_threshold?: number
          product_id?: string | null
          last_updated?: string
        }
        Update: {
          id?: string
          name?: string
          current_stock?: number
          unit?: string
          low_stock_threshold?: number
          product_id?: string | null
          last_updated?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
