export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12"
  }
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          password_hash: string
          role: "user" | "admin"
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          password_hash: string
          role?: "user" | "admin"
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>
        Relationships: []
      }
      stores: {
        Row: {
          id: string
          user_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["stores"]["Insert"]>
        Relationships: [
          {
            foreignKeyName: "stores_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      suppliers: {
        Row: {
          id: string
          user_id: string
          store_id: string
          supplier_name: string
          purchase_date: string
          note: string
          payment_status: "paid" | "unpaid"
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          store_id: string
          supplier_name: string
          purchase_date: string
          note?: string
          payment_status?: "paid" | "unpaid"
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["suppliers"]["Insert"]>
        Relationships: [
          {
            foreignKeyName: "suppliers_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_store_id_fkey"
            columns: ["store_id"]
            referencedRelation: "stores"
            referencedColumns: ["id"]
          }
        ]
      }
      supplier_items: {
        Row: {
          id: string
          supplier_id: string
          item_name: string
          unit_price: number
          quantity: number
          total_price: number
          purchase_date: string
          created_at: string
        }
        Insert: {
          id?: string
          supplier_id: string
          item_name: string
          unit_price?: number
          quantity?: number
          purchase_date: string
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["supplier_items"]["Insert"]>
        Relationships: [
          {
            foreignKeyName: "supplier_items_supplier_id_fkey"
            columns: ["supplier_id"]
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          }
        ]
      }
      financial_summaries: {
        Row: {
          id: string
          user_id: string
          store_id: string
          period_month: string
          total_revenue: number
          total_cost: number
          gross_profit: number
          other_expenses: number
          net_profit_before_tax: number
          corporate_tax: number
          net_profit_after_tax: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          store_id: string
          period_month: string
          total_revenue?: number
          total_cost?: number
          gross_profit?: number
          other_expenses?: number
          net_profit_before_tax?: number
          corporate_tax?: number
          net_profit_after_tax?: number
          created_at?: string
        }
        Update: Partial<
          Database["public"]["Tables"]["financial_summaries"]["Insert"]
        >
        Relationships: [
          {
            foreignKeyName: "financial_summaries_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_summaries_store_id_fkey"
            columns: ["store_id"]
            referencedRelation: "stores"
            referencedColumns: ["id"]
          }
        ]
      }
      capital_contributions: {
        Row: {
          id: string
          user_id: string
          store_id: string
          partner_name: string
          amount: number
          contribution_date: string
          note: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          store_id: string
          partner_name: string
          amount?: number
          contribution_date: string
          note?: string
          created_at?: string
        }
        Update: Partial<
          Database["public"]["Tables"]["capital_contributions"]["Insert"]
        >
        Relationships: [
          {
            foreignKeyName: "capital_contributions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capital_contributions_store_id_fkey"
            columns: ["store_id"]
            referencedRelation: "stores"
            referencedColumns: ["id"]
          }
        ]
      }
      shopping_items: {
        Row: {
          id: string
          user_id: string
          item_name: string
          quantity: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          item_name: string
          quantity?: number
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["shopping_items"]["Insert"]>
        Relationships: [
          {
            foreignKeyName: "shopping_items_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
