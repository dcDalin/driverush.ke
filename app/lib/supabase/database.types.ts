export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      learner_progress: {
        Row: {
          data: NonNullable<Json>;
          store: string;
          updated_at: string;
          user_id: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          data: NonNullable<Json>;
          store: string;
          updated_at?: string;
          user_id?: string;
          version?: number;
        };
        Update: {
          data?: NonNullable<Json>;
          store?: string;
          updated_at?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [];
      };
      learner_subscriptions: {
        Row: {
          created_at: string;
          ends_at: string;
          id: string;
          plan_id: string;
          source: string;
          starts_at: string;
          status: Database["public"]["Enums"]["subscription_status"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          ends_at: string;
          id?: string;
          plan_id: string;
          source?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string;
          id?: string;
          plan_id?: string;
          source?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learner_subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount_kes: number;
          created_at: string;
          id: string;
          payer_user_id: string | null;
          plan_id: string | null;
          provider: string;
          provider_ref: string | null;
          raw: Json | null;
          school_id: string | null;
          settled_at: string | null;
          status: Database["public"]["Enums"]["payment_status"];
        };
        ComputedFields: never;
        Insert: {
          amount_kes: number;
          created_at?: string;
          id?: string;
          payer_user_id?: string | null;
          plan_id?: string | null;
          provider: string;
          provider_ref?: string | null;
          raw?: Json | null;
          school_id?: string | null;
          settled_at?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
        };
        Update: {
          amount_kes?: number;
          created_at?: string;
          id?: string;
          payer_user_id?: string | null;
          plan_id?: string | null;
          provider?: string;
          provider_ref?: string | null;
          raw?: Json | null;
          school_id?: string | null;
          settled_at?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
        };
        Relationships: [
          {
            foreignKeyName: "payments_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          audience: Database["public"]["Enums"]["plan_audience"];
          code: string;
          created_at: string;
          id: string;
          is_active: boolean;
          limits: NonNullable<Json>;
          name: string;
          period: string;
          price_kes: number;
        };
        ComputedFields: never;
        Insert: {
          audience: Database["public"]["Enums"]["plan_audience"];
          code: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          limits?: NonNullable<Json>;
          name: string;
          period: string;
          price_kes: number;
        };
        Update: {
          audience?: Database["public"]["Enums"]["plan_audience"];
          code?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          limits?: NonNullable<Json>;
          name?: string;
          period?: string;
          price_kes?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      school_branches: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          school_id: string;
          town: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          school_id: string;
          town?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          school_id?: string;
          town?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "school_branches_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      school_member_branches: {
        Row: {
          branch_id: string;
          member_id: string;
          school_id: string;
        };
        ComputedFields: never;
        Insert: {
          branch_id: string;
          member_id: string;
          school_id: string;
        };
        Update: {
          branch_id?: string;
          member_id?: string;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "school_member_branches_branch_id_school_id_fkey";
            columns: ["branch_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "school_branches";
            referencedColumns: ["id", "school_id"];
          },
          {
            foreignKeyName: "school_member_branches_member_id_school_id_fkey";
            columns: ["member_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "school_members";
            referencedColumns: ["id", "school_id"];
          },
        ];
      };
      school_member_invites: {
        Row: {
          branch_ids: string[];
          closed_at: string | null;
          created_at: string;
          email: string;
          id: string;
          invited_by: string | null;
          role: Database["public"]["Enums"]["school_role"];
          school_id: string;
          status: Database["public"]["Enums"]["invite_status"];
        };
        ComputedFields: never;
        Insert: {
          branch_ids?: string[];
          closed_at?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          invited_by?: string | null;
          role: Database["public"]["Enums"]["school_role"];
          school_id: string;
          status?: Database["public"]["Enums"]["invite_status"];
        };
        Update: {
          branch_ids?: string[];
          closed_at?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          invited_by?: string | null;
          role?: Database["public"]["Enums"]["school_role"];
          school_id?: string;
          status?: Database["public"]["Enums"]["invite_status"];
        };
        Relationships: [
          {
            foreignKeyName: "school_member_invites_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      school_members: {
        Row: {
          added_by: string | null;
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["school_role"];
          school_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          added_by?: string | null;
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["school_role"];
          school_id: string;
          user_id: string;
        };
        Update: {
          added_by?: string | null;
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["school_role"];
          school_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "school_members_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      school_student_links: {
        Row: {
          added_at: string;
          added_by: string | null;
          branch_id: string;
          email: string;
          end_reason: Database["public"]["Enums"]["link_end_reason"] | null;
          ended_at: string | null;
          ends_at: string | null;
          id: string;
          school_id: string;
          starts_at: string | null;
          status: Database["public"]["Enums"]["student_link_status"];
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          added_at?: string;
          added_by?: string | null;
          branch_id: string;
          email: string;
          end_reason?: Database["public"]["Enums"]["link_end_reason"] | null;
          ended_at?: string | null;
          ends_at?: string | null;
          id?: string;
          school_id: string;
          starts_at?: string | null;
          status?: Database["public"]["Enums"]["student_link_status"];
          user_id?: string | null;
        };
        Update: {
          added_at?: string;
          added_by?: string | null;
          branch_id?: string;
          email?: string;
          end_reason?: Database["public"]["Enums"]["link_end_reason"] | null;
          ended_at?: string | null;
          ends_at?: string | null;
          id?: string;
          school_id?: string;
          starts_at?: string | null;
          status?: Database["public"]["Enums"]["student_link_status"];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "school_student_links_branch_id_school_id_fkey";
            columns: ["branch_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "school_branches";
            referencedColumns: ["id", "school_id"];
          },
          {
            foreignKeyName: "school_student_links_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      school_subscriptions: {
        Row: {
          created_at: string;
          ends_at: string;
          id: string;
          plan_id: string;
          school_id: string;
          starts_at: string;
          status: Database["public"]["Enums"]["subscription_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          ends_at: string;
          id?: string;
          plan_id: string;
          school_id: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string;
          id?: string;
          plan_id?: string;
          school_id?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "school_subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "school_subscriptions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      schools: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          slug: string;
          sponsor_id: string | null;
          status: Database["public"]["Enums"]["school_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          slug: string;
          sponsor_id?: string | null;
          status?: Database["public"]["Enums"]["school_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          sponsor_id?: string | null;
          status?: Database["public"]["Enums"]["school_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      subscription_pauses: {
        Row: {
          created_at: string;
          link_id: string;
          moved_start: boolean;
          shifted_by: string;
          subscription_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          link_id: string;
          moved_start: boolean;
          shifted_by: string;
          subscription_id: string;
        };
        Update: {
          created_at?: string;
          link_id?: string;
          moved_start?: boolean;
          shifted_by?: string;
          subscription_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_pauses_link_id_fkey";
            columns: ["link_id"];
            isOneToOne: false;
            referencedRelation: "school_student_links";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_pauses_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "learner_subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_create_school: {
        Args: {
          p_name: string;
          p_owner_email: string;
          p_slug: string;
          p_sponsor_id: string;
        };
        Returns: string;
      };
      admin_set_school_status: {
        Args: {
          p_school_id: string;
          p_status: Database["public"]["Enums"]["school_status"];
        };
        Returns: undefined;
      };
      admin_transfer_school_owner: {
        Args: { p_email: string; p_school_id: string };
        Returns: string;
      };
      custom_access_token_hook: { Args: { event: Json }; Returns: Json };
      grant_platform_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"];
          p_user_id: string;
        };
        Returns: undefined;
      };
      learner_accept_school_link: {
        Args: { p_link_id: string };
        Returns: undefined;
      };
      learner_decline_school_link: {
        Args: { p_link_id: string };
        Returns: undefined;
      };
      my_entitlement: {
        Args: Record<PropertyKey, never>;
        Returns: {
          branch_id: string;
          ends_at: string;
          pending_invites: number;
          school_id: string;
          school_name: string;
          sponsor_id: string;
          tier: string;
        }[];
      };
      revoke_platform_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"];
          p_user_id: string;
        };
        Returns: undefined;
      };
      school_add_admin: {
        Args: { p_branch_ids: string[]; p_email: string; p_school_id: string };
        Returns: string;
      };
      school_add_student: {
        Args: { p_branch_id: string; p_email: string };
        Returns: string;
      };
      school_cancel_member_invite: {
        Args: { p_invite_id: string };
        Returns: undefined;
      };
      school_cancel_student_invite: {
        Args: { p_link_id: string };
        Returns: undefined;
      };
      school_create_branch: {
        Args: { p_name: string; p_school_id: string; p_town: string };
        Returns: string;
      };
      school_members_list: {
        Args: { p_school_id: string };
        Returns: {
          branch_ids: string[];
          created_at: string;
          email: string;
          full_name: string;
          member_id: string;
          role: Database["public"]["Enums"]["school_role"];
          user_id: string;
        }[];
      };
      school_move_student_branch: {
        Args: { p_branch_id: string; p_link_id: string };
        Returns: undefined;
      };
      school_release_student: {
        Args: { p_link_id: string };
        Returns: undefined;
      };
      school_remove_admin: {
        Args: { p_member_id: string };
        Returns: undefined;
      };
      school_set_admin_branches: {
        Args: { p_branch_ids: string[]; p_member_id: string };
        Returns: undefined;
      };
      school_student_progress: {
        Args: { p_branch_id?: string; p_school_id: string };
        Returns: {
          branch_id: string;
          email: string;
          ends_at: string;
          full_name: string;
          link_id: string;
          progress: Json;
          progress_updated_at: string;
          starts_at: string;
          user_id: string;
        }[];
      };
      school_update_branch: {
        Args: {
          p_branch_id: string;
          p_is_active: boolean;
          p_name: string;
          p_town: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "driverush_su" | "driverush_admin" | "user";
      invite_status: "pending" | "accepted" | "cancelled";
      link_end_reason: "expired" | "switched" | "released";
      payment_status: "pending" | "succeeded" | "failed" | "refunded";
      plan_audience: "learner" | "school";
      school_role: "owner" | "admin";
      school_status: "active" | "suspended" | "archived";
      student_link_status:
        "pending" | "active" | "ended" | "declined" | "cancelled";
      subscription_status: "active" | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["driverush_su", "driverush_admin", "user"],
      invite_status: ["pending", "accepted", "cancelled"],
      link_end_reason: ["expired", "switched", "released"],
      payment_status: ["pending", "succeeded", "failed", "refunded"],
      plan_audience: ["learner", "school"],
      school_role: ["owner", "admin"],
      school_status: ["active", "suspended", "archived"],
      student_link_status: [
        "pending",
        "active",
        "ended",
        "declined",
        "cancelled",
      ],
      subscription_status: ["active", "cancelled"],
    },
  },
} as const;
