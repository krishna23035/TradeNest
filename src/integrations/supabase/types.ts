export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type PaperTable<Row> = {
  Row: Row
  Insert: Partial<Row>
  Update: Partial<Row>
  Relationships: []
}

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      roles: PaperTable<{ id: string; description: string }>
      user_roles: PaperTable<{ user_id: string; role_id: string; updated_at: string }>
      stocks: PaperTable<{ symbol: string; company_name: string; exchange: string; sector: string; last_price: number; updated_at: string; quote_source: string }>
      paper_quote_history: PaperTable<{ id: number; symbol: string; price: number; source: "migration_snapshot" | "simulated_initial" | "simulated_update"; captured_at: string }>
      wallets: PaperTable<{ user_id: string; available_balance: number; blocked_balance: number; updated_at: string }>
      orders: PaperTable<{ id: string; user_id: string; idempotency_key: string; symbol: string; side: "BUY" | "SELL"; quantity: number; order_kind: "MARKET" | "LIMIT"; limit_price: number | null; reserved_amount: number; executed_price: number | null; status: "PENDING" | "EXECUTED" | "CANCELLED"; created_at: string; executed_at: string | null }>
      holdings: PaperTable<{ user_id: string; symbol: string; quantity: number; cost_basis: number; avg_price: number; realized_pl: number; updated_at: string }>
      transactions: PaperTable<{ id: string; user_id: string; order_id: string | null; idempotency_key: string | null; txn_type: "BUY" | "SELL" | "VIRTUAL_DEPOSIT" | "VIRTUAL_WITHDRAWAL"; amount: number; balance_after: number; created_at: string }>
      price_alerts: PaperTable<{ id: string; user_id: string; symbol: string; target_price: number; condition_type: "ABOVE" | "BELOW"; status: "ACTIVE" | "TRIGGERED" | "CANCELLED"; created_at: string; triggered_at: string | null }>
      notifications: PaperTable<{ id: string; user_id: string; title: string; message: string; created_at: string }>
      notification_templates: PaperTable<{ template_key: string; body: string; updated_at: string }>
      ai_logs: PaperTable<{ id: string; user_id: string; request_type: "RISK" | "SIGNAL" | "SUMMARY" | "SENTIMENT"; input_summary: string; ai_response: string; created_at: string }>
      reports: PaperTable<{ id: string; user_id: string; report_type: "PORTFOLIO" | "TRADE" | "STATEMENT" | "PROFIT_LOSS"; file_name: string; created_at: string }>
      audit_logs: PaperTable<{ id: number; user_id: string | null; action: string; details: Json; created_at: string }>
      system_settings: PaperTable<{ singleton: boolean; max_order_quantity: number; max_order_value: number; max_orders_per_minute: number; updated_at: string }>
      portfolio: {
        Row: {
          avg_price: number
          created_at: string
          id: string
          name: string | null
          quantity: number
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_price?: number
          created_at?: string
          id?: string
          name?: string | null
          quantity?: number
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_price?: number
          created_at?: string
          id?: string
          name?: string | null
          quantity?: number
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      predictions: {
        Row: {
          confidence: number | null
          created_at: string
          current_price: number | null
          decision: string | null
          id: string
          predicted_price: number | null
          rationale: string | null
          symbol: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          current_price?: number | null
          decision?: string | null
          id?: string
          predicted_price?: number | null
          rationale?: string | null
          symbol: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          current_price?: number | null
          decision?: string | null
          id?: string
          predicted_price?: number | null
          rationale?: string | null
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          kyc_status: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          kyc_status?: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          kyc_status?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          created_at: string
          id: string
          name: string | null
          symbol: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          symbol: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_staff: { Args: Record<string, never>; Returns: boolean }
      is_admin: { Args: Record<string, never>; Returns: boolean }
      adjust_paper_wallet: { Args: { p_amount: number; p_direction: "VIRTUAL_DEPOSIT" | "VIRTUAL_WITHDRAWAL"; p_idempotency_key: string }; Returns: number }
      place_paper_order: { Args: { p_symbol: string; p_side: "BUY" | "SELL"; p_quantity: number; p_idempotency_key: string }; Returns: string }
      place_paper_limit_order: { Args: { p_symbol: string; p_side: "BUY" | "SELL"; p_quantity: number; p_limit_price: number; p_idempotency_key: string }; Returns: string }
      cancel_paper_order: { Args: { p_order: string }; Returns: undefined }
      set_simulated_quote: { Args: { p_symbol: string; p_price: number }; Returns: undefined }
      set_user_role: { Args: { p_user: string; p_role: "trader" | "broker" | "admin" }; Returns: undefined }
      update_trading_rules: { Args: { p_max_quantity: number; p_max_value: number; p_max_per_minute: number }; Returns: undefined }
      set_kyc_status: { Args: { p_user: string; p_status: string }; Returns: undefined }
      upsert_simulated_stock: { Args: { p_symbol: string; p_name: string; p_exchange: string; p_sector: string; p_price: number }; Returns: undefined }
      set_notification_template: { Args: { p_key: string; p_body: string }; Returns: undefined }
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
    Enums: {},
  },
} as const
