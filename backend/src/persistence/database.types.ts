export type DatabaseJson =
  | string
  | number
  | boolean
  | null
  | { [key: string]: DatabaseJson | undefined }
  | DatabaseJson[];

export interface Database {
  public: {
    Tables: {
      agent_metadata: {
        Row: {
          id: string;
          agent_id: string;
          display_name: string | null;
          description: string | null;
          category: string | null;
          capabilities: DatabaseJson;
          avatar_key: string | null;
          accent_theme: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          display_name?: string | null;
          description?: string | null;
          category?: string | null;
          capabilities?: DatabaseJson;
          avatar_key?: string | null;
          accent_theme?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["agent_metadata"]["Insert"]>;
        Relationships: [];
      };
      audit_events: {
        Row: {
          id: string;
          event_type: string;
          request_id: string | null;
          sender_agent_id: string | null;
          receiver_agent_id: string | null;
          action: string | null;
          result: string;
          code: string;
          reason: string;
          recovered_wallet: string | null;
          registered_wallet: string | null;
          metadata: DatabaseJson;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          request_id?: string | null;
          sender_agent_id?: string | null;
          receiver_agent_id?: string | null;
          action?: string | null;
          result: string;
          code: string;
          reason: string;
          recovered_wallet?: string | null;
          registered_wallet?: string | null;
          metadata?: DatabaseJson;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_events"]["Insert"]>;
        Relationships: [];
      };
      interactions: {
        Row: {
          id: string;
          request_id: string;
          sender_agent_id: string;
          receiver_agent_id: string;
          action: string;
          request_payload: DatabaseJson;
          response_payload: DatabaseJson;
          authentication_code: string;
          duration_ms: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          sender_agent_id: string;
          receiver_agent_id: string;
          action: string;
          request_payload: DatabaseJson;
          response_payload: DatabaseJson;
          authentication_code: string;
          duration_ms: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["interactions"]["Insert"]>;
        Relationships: [];
      };
      replay_nonces: {
        Row: {
          id: string;
          sender_agent_id: string;
          nonce: string;
          request_id: string;
          consumed_at: string;
        };
        Insert: {
          id?: string;
          sender_agent_id: string;
          nonce: string;
          request_id: string;
          consumed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["replay_nonces"]["Insert"]>;
        Relationships: [];
      };
      chain_event_index: {
        Row: {
          chain_id: number;
          contract_address: string;
          block_number: number;
          transaction_hash: string;
          log_index: number;
          event_name: string;
          agent_id: string;
          decoded_data: DatabaseJson;
          created_at: string;
        };
        Insert: {
          chain_id: number;
          contract_address: string;
          block_number: number;
          transaction_hash: string;
          log_index: number;
          event_name: string;
          agent_id: string;
          decoded_data: DatabaseJson;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chain_event_index"]["Insert"]>;
        Relationships: [];
      };
      chain_indexer_state: {
        Row: {
          chain_id: number;
          contract_address: string;
          last_scanned_block: number;
          updated_at: string;
        };
        Insert: {
          chain_id: number;
          contract_address: string;
          last_scanned_block: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chain_indexer_state"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
