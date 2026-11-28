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
          payment_id: string | null;
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
          payment_id?: string | null;
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
          payment_id?: string | null;
          plan_id?: string;
          source?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learner_subscriptions_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: true;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
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
          branch_id: string | null;
          created_at: string;
          driverush_share_kes: number;
          fee_kes: number | null;
          id: string;
          payer_user_id: string | null;
          plan_id: string | null;
          provider: string;
          provider_ref: string | null;
          raw: Json | null;
          school_id: string | null;
          school_share_kes: number;
          settled_at: string | null;
          status: Database["public"]["Enums"]["payment_status"];
        };
        ComputedFields: never;
        Insert: {
          amount_kes: number;
          branch_id?: string | null;
          created_at?: string;
          driverush_share_kes: number;
          fee_kes?: number | null;
          id?: string;
          payer_user_id?: string | null;
          plan_id?: string | null;
          provider: string;
          provider_ref?: string | null;
          raw?: Json | null;
          school_id?: string | null;
          school_share_kes?: number;
          settled_at?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
        };
        Update: {
          amount_kes?: number;
          branch_id?: string | null;
          created_at?: string;
          driverush_share_kes?: number;
          fee_kes?: number | null;
          id?: string;
          payer_user_id?: string | null;
          plan_id?: string | null;
          provider?: string;
          provider_ref?: string | null;
          raw?: Json | null;
          school_id?: string | null;
          school_share_kes?: number;
          settled_at?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
        };
        Relationships: [
          {
            foreignKeyName: "payments_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "school_branches";
            referencedColumns: ["id"];
          },
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
          address: string | null;
          created_at: string;
          hours: Json | null;
          id: string;
          is_active: boolean;
          lat: number | null;
          lng: number | null;
          name: string;
          phone: string | null;
          school_id: string;
          town: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          created_at?: string;
          hours?: Json | null;
          id?: string;
          is_active?: boolean;
          lat?: number | null;
          lng?: number | null;
          name: string;
          phone?: string | null;
          school_id: string;
          town?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          hours?: Json | null;
          id?: string;
          is_active?: boolean;
          lat?: number | null;
          lng?: number | null;
          name?: string;
          phone?: string | null;
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
      school_liveries: {
        Row: {
          banner: Json | null;
          base_color: string;
          created_at: string;
          created_by: string | null;
          id: string;
          label: string;
          marks: NonNullable<Json>;
          paint: NonNullable<Json>;
          posters: Json | null;
          published_at: string | null;
          rail: NonNullable<Json>;
          school_id: string;
          status: Database["public"]["Enums"]["livery_status"];
          stills: NonNullable<Json>;
          thumbs: NonNullable<Json>;
          top_board: Json | null;
        };
        ComputedFields: never;
        Insert: {
          banner?: Json | null;
          base_color: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          label: string;
          marks: NonNullable<Json>;
          paint: NonNullable<Json>;
          posters?: Json | null;
          published_at?: string | null;
          rail: NonNullable<Json>;
          school_id: string;
          status?: Database["public"]["Enums"]["livery_status"];
          stills?: NonNullable<Json>;
          thumbs?: NonNullable<Json>;
          top_board?: Json | null;
        };
        Update: {
          banner?: Json | null;
          base_color?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          label?: string;
          marks?: NonNullable<Json>;
          paint?: NonNullable<Json>;
          posters?: Json | null;
          published_at?: string | null;
          rail?: NonNullable<Json>;
          school_id?: string;
          status?: Database["public"]["Enums"]["livery_status"];
          stills?: NonNullable<Json>;
          thumbs?: NonNullable<Json>;
          top_board?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "school_liveries_school_id_fkey";
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
          expires_at: string;
          id: string;
          invited_by: string | null;
          keep_previous_owner: boolean;
          last_sent_at: string;
          role: Database["public"]["Enums"]["school_role"];
          school_id: string;
          sent_count: number;
          status: Database["public"]["Enums"]["invite_status"];
        };
        ComputedFields: never;
        Insert: {
          branch_ids?: string[];
          closed_at?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          keep_previous_owner?: boolean;
          last_sent_at?: string;
          role: Database["public"]["Enums"]["school_role"];
          school_id: string;
          sent_count?: number;
          status?: Database["public"]["Enums"]["invite_status"];
        };
        Update: {
          branch_ids?: string[];
          closed_at?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          keep_previous_owner?: boolean;
          last_sent_at?: string;
          role?: Database["public"]["Enums"]["school_role"];
          school_id?: string;
          sent_count?: number;
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
      school_payment_settings: {
        Row: {
          account_name: string | null;
          bank_label: string | null;
          code: string;
          created_at: string;
          is_active: boolean;
          paystack_subaccount_code: string | null;
          pending_account_name: string | null;
          pending_bank_label: string | null;
          pending_subaccount_code: string | null;
          price_kes: number;
          requested_at: string | null;
          requested_by: string | null;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          school_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          account_name?: string | null;
          bank_label?: string | null;
          code: string;
          created_at?: string;
          is_active?: boolean;
          paystack_subaccount_code?: string | null;
          pending_account_name?: string | null;
          pending_bank_label?: string | null;
          pending_subaccount_code?: string | null;
          price_kes?: number;
          requested_at?: string | null;
          requested_by?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          school_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          account_name?: string | null;
          bank_label?: string | null;
          code?: string;
          created_at?: string;
          is_active?: boolean;
          paystack_subaccount_code?: string | null;
          pending_account_name?: string | null;
          pending_bank_label?: string | null;
          pending_subaccount_code?: string | null;
          price_kes?: number;
          requested_at?: string | null;
          requested_by?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          school_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "school_payment_settings_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: true;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      school_profiles: {
        Row: {
          about: string | null;
          brand_ink: string | null;
          brand_paint: string | null;
          email: string | null;
          logo: Json | null;
          logo_mono: Json | null;
          phone: string | null;
          school_id: string;
          socials: NonNullable<Json>;
          tagline: string | null;
          updated_at: string;
          updated_by: string | null;
          website_url: string | null;
          whatsapp: string | null;
        };
        ComputedFields: never;
        Insert: {
          about?: string | null;
          brand_ink?: string | null;
          brand_paint?: string | null;
          email?: string | null;
          logo?: Json | null;
          logo_mono?: Json | null;
          phone?: string | null;
          school_id: string;
          socials?: NonNullable<Json>;
          tagline?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          website_url?: string | null;
          whatsapp?: string | null;
        };
        Update: {
          about?: string | null;
          brand_ink?: string | null;
          brand_paint?: string | null;
          email?: string | null;
          logo?: Json | null;
          logo_mono?: Json | null;
          phone?: string | null;
          school_id?: string;
          socials?: NonNullable<Json>;
          tagline?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          website_url?: string | null;
          whatsapp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "school_profiles_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: true;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      school_sponsorships: {
        Row: {
          created_at: string;
          created_by: string | null;
          ends_on: string | null;
          id: string;
          note: string | null;
          school_id: string;
          starts_on: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          ends_on?: string | null;
          id?: string;
          note?: string | null;
          school_id: string;
          starts_on: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          ends_on?: string | null;
          id?: string;
          note?: string | null;
          school_id?: string;
          starts_on?: string;
        };
        Relationships: [
          {
            foreignKeyName: "school_sponsorships_school_id_fkey";
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
          expires_at: string;
          id: string;
          last_sent_at: string;
          school_id: string;
          sent_count: number;
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
          expires_at?: string;
          id?: string;
          last_sent_at?: string;
          school_id: string;
          sent_count?: number;
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
          expires_at?: string;
          id?: string;
          last_sent_at?: string;
          school_id?: string;
          sent_count?: number;
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
          status?: Database["public"]["Enums"]["school_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          status?: Database["public"]["Enums"]["school_status"];
          updated_at?: string;
        };
        Relationships: [];
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
        Args: { p_name: string; p_owner_email: string; p_slug: string };
        Returns: string;
      };
      admin_end_sponsorship: {
        Args: { p_sponsorship_id: string };
        Returns: undefined;
      };
      admin_hand_over_school: {
        Args: {
          p_keep_previous_owner?: boolean;
          p_owner_email: string;
          p_school_id: string;
        };
        Returns: string;
      };
      admin_list_bank_requests: {
        Args: Record<PropertyKey, never>;
        Returns: {
          live_bank_label: string;
          pending_account_name: string;
          pending_bank_label: string;
          requested_at: string;
          requested_by_email: string;
          school_id: string;
          school_name: string;
        }[];
      };
      admin_list_payments: {
        Args: {
          p_limit: number;
          p_offset: number;
          p_school_id?: string;
          p_search: string;
          p_status: string;
        };
        Returns: {
          amount_kes: number;
          created_at: string;
          driverush_share_kes: number;
          fee_kes: number;
          id: string;
          payer_email: string;
          plan_code: string;
          provider_ref: string;
          school_id: string;
          school_name: string;
          school_share_kes: number;
          settled_at: string;
          status: Database["public"]["Enums"]["payment_status"];
          total: number;
        }[];
      };
      admin_list_schools: {
        Args: {
          p_limit: number;
          p_livery: string;
          p_offset: number;
          p_search: string;
          p_sponsoring: string;
          p_status: string;
        };
        Returns: {
          admins: number;
          branches: number;
          created_at: string;
          drafts: number;
          id: string;
          invited_owner_email: string;
          livery: string;
          name: string;
          owner_email: string;
          slug: string;
          sponsoring: boolean;
          status: Database["public"]["Enums"]["school_status"];
          students: number;
          total: number;
        }[];
      };
      admin_livery_draft_get: { Args: { p_livery_id: string }; Returns: Json };
      admin_payment_totals: {
        Args: Record<PropertyKey, never>;
        Returns: {
          driverush_kes: number;
          fees_kes: number;
          month: string;
          paid_kes: number;
          payments: number;
          refunded: number;
          schools_kes: number;
        }[];
      };
      admin_publish_livery: {
        Args: { p_livery_id: string };
        Returns: undefined;
      };
      admin_retire_livery: {
        Args: { p_livery_id: string };
        Returns: undefined;
      };
      admin_review_bank: {
        Args: { p_approve: boolean; p_note: string; p_school_id: string };
        Returns: string;
      };
      admin_school_counts: {
        Args: Record<PropertyKey, never>;
        Returns: {
          active: number;
          setup: number;
          sponsoring: number;
          total: number;
        }[];
      };
      admin_set_school_payments: {
        Args: {
          p_account_name: string;
          p_bank_label: string;
          p_code: string;
          p_is_active: boolean;
          p_school_id: string;
          p_subaccount_code: string;
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
      admin_set_sponsorship: {
        Args: {
          p_ends_on: string;
          p_note: string;
          p_school_id: string;
          p_starts_on: string;
        };
        Returns: string;
      };
      admin_transfer_school_owner: {
        Args: { p_email: string; p_school_id: string };
        Returns: string;
      };
      board_schools: { Args: Record<PropertyKey, never>; Returns: Json };
      custom_access_token_hook: { Args: { event: Json }; Returns: Json };
      fail_payment: {
        Args: { p_raw: Json; p_reference: string };
        Returns: undefined;
      };
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
          full_access: boolean;
          pass_ends_at: string;
          pending_invites: number;
          school_id: string;
          school_name: string;
          school_slug: string;
          tier: string;
        }[];
      };
      my_pass_offers: {
        Args: Record<PropertyKey, never>;
        Returns: {
          branch_id: string;
          branch_name: string;
          code: string;
          linked: boolean;
          price_kes: number;
          school_id: string;
          school_name: string;
        }[];
      };
      pass_school_by_code: {
        Args: { p_code: string };
        Returns: {
          branches: Json;
          price_kes: number;
          school_id: string;
          school_name: string;
          school_slug: string;
        }[];
      };
      refund_payment: {
        Args: { p_raw: Json; p_reference: string };
        Returns: undefined;
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
      school_earnings: {
        Args: { p_branch_id?: string; p_school_id: string };
        Returns: {
          branch_id: string;
          branch_name: string;
          learner_email: string;
          paid_at: string;
          payment_id: string;
          price_kes: number;
          school_share_kes: number;
          status: Database["public"]["Enums"]["payment_status"];
        }[];
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
      school_pass_info: {
        Args: { p_school_id: string };
        Returns: {
          account_name: string;
          bank_label: string;
          code: string;
          driverush_share_kes: number;
          min_price_kes: number;
          pending_account_name: string;
          pending_bank_label: string;
          price_kes: number;
          ready: boolean;
          requested_at: string;
          review_note: string;
          reviewed_at: string;
        }[];
      };
      school_release_student: {
        Args: { p_link_id: string };
        Returns: undefined;
      };
      school_remove_admin: {
        Args: { p_member_id: string };
        Returns: undefined;
      };
      school_request_bank: {
        Args: {
          p_account_name: string;
          p_actor: string;
          p_bank_label: string;
          p_school_id: string;
          p_subaccount_code: string;
        };
        Returns: string;
      };
      school_resend_member_invite: {
        Args: { p_invite_id: string };
        Returns: {
          branch_ids: string[];
          email: string;
          role: Database["public"]["Enums"]["school_role"];
          school_name: string;
        }[];
      };
      school_resend_student_invite: {
        Args: { p_link_id: string };
        Returns: {
          branch_name: string;
          email: string;
          school_name: string;
        }[];
      };
      school_set_admin_branches: {
        Args: { p_branch_ids: string[]; p_member_id: string };
        Returns: undefined;
      };
      school_set_logo: {
        Args: {
          p_actor: string;
          p_kind: string;
          p_ref: Json;
          p_school_id: string;
        };
        Returns: string;
      };
      school_set_pass_price: {
        Args: { p_price_kes: number; p_school_id: string };
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
          pass_ends_at: string;
          pass_through_school: boolean;
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
      school_update_branch_details: {
        Args: {
          p_address: string;
          p_branch_id: string;
          p_hours: Json;
          p_lat: number;
          p_lng: number;
          p_phone: string;
        };
        Returns: undefined;
      };
      school_update_profile: {
        Args: {
          p_about: string;
          p_brand_ink: string;
          p_brand_paint: string;
          p_email: string;
          p_phone: string;
          p_school_id: string;
          p_socials: Json;
          p_tagline: string;
          p_website_url: string;
          p_whatsapp: string;
        };
        Returns: undefined;
      };
      settle_payment: {
        Args: {
          p_amount_kes: number;
          p_fee_kes: number;
          p_raw: Json;
          p_reference: string;
        };
        Returns: string;
      };
      start_pass_checkout: {
        Args: {
          p_branch_id?: string;
          p_plan_code: string;
          p_school_code?: string;
        };
        Returns: {
          amount_kes: number;
          email: string;
          payment_id: string;
          reference: string;
          school_id: string;
          school_name: string;
        }[];
      };
    };
    Enums: {
      app_role: "driverush_su" | "driverush_admin" | "user";
      invite_status: "pending" | "accepted" | "cancelled";
      link_end_reason: "expired" | "switched" | "released";
      livery_status: "draft" | "live" | "retired";
      payment_status: "pending" | "succeeded" | "failed" | "refunded";
      plan_audience: "learner" | "school";
      school_role: "owner" | "admin";
      school_status: "setup" | "active" | "suspended" | "archived";
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
      livery_status: ["draft", "live", "retired"],
      payment_status: ["pending", "succeeded", "failed", "refunded"],
      plan_audience: ["learner", "school"],
      school_role: ["owner", "admin"],
      school_status: ["setup", "active", "suspended", "archived"],
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
