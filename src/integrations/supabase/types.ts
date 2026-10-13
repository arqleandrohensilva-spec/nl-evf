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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ambientes: {
        Row: {
          evf_id: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          evf_id: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          evf_id?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "ambientes_evf_id_fkey"
            columns: ["evf_id"]
            isOneToOne: false
            referencedRelation: "evfs"
            referencedColumns: ["id"]
          },
        ]
      }
      capitulos: {
        Row: {
          codigo: number
          id: string
          nome: string
          ordem: number
          taxa_adm_pct: number | null
        }
        Insert: {
          codigo: number
          id?: string
          nome: string
          ordem?: number
          taxa_adm_pct?: number | null
        }
        Update: {
          codigo?: number
          id?: string
          nome?: string
          ordem?: number
          taxa_adm_pct?: number | null
        }
        Relationships: []
      }
      catalogo_servicos: {
        Row: {
          capitulo_codigo: number
          codigo: string
          created_at: string
          data_preco: string | null
          descricao: string
          fonte: string | null
          id: string
          material_unit: number
          mo_unit: number
          tipo_preco: string
          unidade: string
        }
        Insert: {
          capitulo_codigo: number
          codigo?: string
          created_at?: string
          data_preco?: string | null
          descricao: string
          fonte?: string | null
          id?: string
          material_unit?: number
          mo_unit?: number
          tipo_preco?: string
          unidade?: string
        }
        Update: {
          capitulo_codigo?: number
          codigo?: string
          created_at?: string
          data_preco?: string | null
          descricao?: string
          fonte?: string | null
          id?: string
          material_unit?: number
          mo_unit?: number
          tipo_preco?: string
          unidade?: string
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          cub_ref: string
          cub_uf: string
          cub_valor: number
          id: number
          margem_erro_pct: number
          nome_escritorio: string
        }
        Insert: {
          cub_ref?: string
          cub_uf?: string
          cub_valor?: number
          id?: number
          margem_erro_pct?: number
          nome_escritorio?: string
        }
        Update: {
          cub_ref?: string
          cub_uf?: string
          cub_valor?: number
          id?: number
          margem_erro_pct?: number
          nome_escritorio?: string
        }
        Relationships: []
      }
      cotacoes: {
        Row: {
          data: string | null
          fornecedor_nome: string | null
          id: string
          item_id: string
          ordem: number
          valor: number
        }
        Insert: {
          data?: string | null
          fornecedor_nome?: string | null
          id?: string
          item_id: string
          ordem?: number
          valor?: number
        }
        Update: {
          data?: string | null
          fornecedor_nome?: string | null
          id?: string
          item_id?: string
          ordem?: number
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens_evf"
            referencedColumns: ["id"]
          },
        ]
      }
      evfs: {
        Row: {
          area_m2: number
          cidade_uf: string | null
          cliente: string
          created_at: string
          data_base: string
          id: string
          obra: string
          observacoes: string | null
          origem_recurso: string
          padrao: string
          revisao: string
          status: string
          target: number
          tipo_obra: string
        }
        Insert: {
          area_m2?: number
          cidade_uf?: string | null
          cliente?: string
          created_at?: string
          data_base?: string
          id?: string
          obra?: string
          observacoes?: string | null
          origem_recurso?: string
          padrao?: string
          revisao?: string
          status?: string
          target?: number
          tipo_obra?: string
        }
        Update: {
          area_m2?: number
          cidade_uf?: string | null
          cliente?: string
          created_at?: string
          data_base?: string
          id?: string
          obra?: string
          observacoes?: string | null
          origem_recurso?: string
          padrao?: string
          revisao?: string
          status?: string
          target?: number
          tipo_obra?: string
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          categoria: string | null
          contato: string | null
          created_at: string
          id: string
          nome: string
          observacoes: string | null
        }
        Insert: {
          categoria?: string | null
          contato?: string | null
          created_at?: string
          id?: string
          nome: string
          observacoes?: string | null
        }
        Update: {
          categoria?: string | null
          contato?: string | null
          created_at?: string
          id?: string
          nome?: string
          observacoes?: string | null
        }
        Relationships: []
      }
      itens_evf: {
        Row: {
          ambiente_id: string | null
          capitulo_codigo: number
          codigo: string
          criterio_cotacao: string
          descricao: string
          etapa: string
          evf_id: string
          id: string
          justificativa: string | null
          material_unit: number
          mo_unit: number
          ordem: number
          perda_pct: number
          quantidade: number
          tipo_preco: string
          unidade: string
        }
        Insert: {
          ambiente_id?: string | null
          capitulo_codigo: number
          codigo?: string
          criterio_cotacao?: string
          descricao?: string
          etapa?: string
          evf_id: string
          id?: string
          justificativa?: string | null
          material_unit?: number
          mo_unit?: number
          ordem?: number
          perda_pct?: number
          quantidade?: number
          tipo_preco?: string
          unidade?: string
        }
        Update: {
          ambiente_id?: string | null
          capitulo_codigo?: number
          codigo?: string
          criterio_cotacao?: string
          descricao?: string
          etapa?: string
          evf_id?: string
          id?: string
          justificativa?: string | null
          material_unit?: number
          mo_unit?: number
          ordem?: number
          perda_pct?: number
          quantidade?: number
          tipo_preco?: string
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "itens_evf_ambiente_id_fkey"
            columns: ["ambiente_id"]
            isOneToOne: false
            referencedRelation: "ambientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_evf_evf_id_fkey"
            columns: ["evf_id"]
            isOneToOne: false
            referencedRelation: "evfs"
            referencedColumns: ["id"]
          },
        ]
      }
      medicoes: {
        Row: {
          altura: number
          ambiente_id: string
          created_at: string
          descricao: string | null
          id: string
          largura: number
          ordem: number
          quantidade: number
          sinal: number
        }
        Insert: {
          altura?: number
          ambiente_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          largura?: number
          ordem?: number
          quantidade?: number
          sinal?: number
        }
        Update: {
          altura?: number
          ambiente_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          largura?: number
          ordem?: number
          quantidade?: number
          sinal?: number
        }
        Relationships: [
          {
            foreignKeyName: "medicoes_ambiente_id_fkey"
            columns: ["ambiente_id"]
            isOneToOne: false
            referencedRelation: "ambientes"
            referencedColumns: ["id"]
          },
        ]
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
