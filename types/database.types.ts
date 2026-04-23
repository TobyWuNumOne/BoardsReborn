export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      admin_profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          normalized_phone: string | null;
          note: string | null;
          phone: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          normalized_phone?: string | null;
          note?: string | null;
          phone: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          normalized_phone?: string | null;
          note?: string | null;
          phone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      photos: {
        Row: {
          bucket: string;
          content_type: string | null;
          created_at: string;
          id: string;
          metadata: Json | null;
          note: string | null;
          path: string;
          photo_type: Database['public']['Enums']['photo_type'];
          size_bytes: number | null;
          taken_at: string | null;
          uploaded_by_user_id: string | null;
          visibility: Database['public']['Enums']['photo_visibility'];
          work_order_id: string;
        };
        Insert: {
          bucket?: string;
          content_type?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          note?: string | null;
          path: string;
          photo_type: Database['public']['Enums']['photo_type'];
          size_bytes?: number | null;
          taken_at?: string | null;
          uploaded_by_user_id?: string | null;
          visibility?: Database['public']['Enums']['photo_visibility'];
          work_order_id: string;
        };
        Update: {
          bucket?: string;
          content_type?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          note?: string | null;
          path?: string;
          photo_type?: Database['public']['Enums']['photo_type'];
          size_bytes?: number | null;
          taken_at?: string | null;
          uploaded_by_user_id?: string | null;
          visibility?: Database['public']['Enums']['photo_visibility'];
          work_order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'photos_work_order_id_fkey';
            columns: ['work_order_id'];
            isOneToOne: false;
            referencedRelation: 'admin_work_order_list';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'photos_work_order_id_fkey';
            columns: ['work_order_id'];
            isOneToOne: false;
            referencedRelation: 'work_orders';
            referencedColumns: ['id'];
          },
        ];
      };
      print_jobs: {
        Row: {
          attempt_count: number;
          claimed_at: string | null;
          claimed_by: string | null;
          created_at: string;
          created_by_user_id: string | null;
          id: string;
          label_language: Database['public']['Enums']['label_language'];
          label_payload: Json;
          last_error: string | null;
          paper_order_no: string;
          printed_at: string | null;
          status: Database['public']['Enums']['print_job_status'];
          updated_at: string;
          work_order_id: string;
        };
        Insert: {
          attempt_count?: number;
          claimed_at?: string | null;
          claimed_by?: string | null;
          created_at?: string;
          created_by_user_id?: string | null;
          id?: string;
          label_language?: Database['public']['Enums']['label_language'];
          label_payload: Json;
          last_error?: string | null;
          paper_order_no: string;
          printed_at?: string | null;
          status?: Database['public']['Enums']['print_job_status'];
          updated_at?: string;
          work_order_id: string;
        };
        Update: {
          attempt_count?: number;
          claimed_at?: string | null;
          claimed_by?: string | null;
          created_at?: string;
          created_by_user_id?: string | null;
          id?: string;
          label_language?: Database['public']['Enums']['label_language'];
          label_payload?: Json;
          last_error?: string | null;
          paper_order_no?: string;
          printed_at?: string | null;
          status?: Database['public']['Enums']['print_job_status'];
          updated_at?: string;
          work_order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'print_jobs_work_order_paper_order_fk';
            columns: ['work_order_id', 'paper_order_no'];
            isOneToOne: false;
            referencedRelation: 'admin_work_order_list';
            referencedColumns: ['id', 'paper_order_no'];
          },
          {
            foreignKeyName: 'print_jobs_work_order_paper_order_fk';
            columns: ['work_order_id', 'paper_order_no'];
            isOneToOne: false;
            referencedRelation: 'work_orders';
            referencedColumns: ['id', 'paper_order_no'];
          },
        ];
      };
      quote_items: {
        Row: {
          amount: number;
          created_at: string;
          created_by_user_id: string | null;
          description: string;
          id: string;
          item_type: Database['public']['Enums']['quote_item_type'];
          work_order_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          created_by_user_id?: string | null;
          description: string;
          id?: string;
          item_type: Database['public']['Enums']['quote_item_type'];
          work_order_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by_user_id?: string | null;
          description?: string;
          id?: string;
          item_type?: Database['public']['Enums']['quote_item_type'];
          work_order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'quote_items_work_order_id_fkey';
            columns: ['work_order_id'];
            isOneToOne: false;
            referencedRelation: 'admin_work_order_list';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quote_items_work_order_id_fkey';
            columns: ['work_order_id'];
            isOneToOne: false;
            referencedRelation: 'work_orders';
            referencedColumns: ['id'];
          },
        ];
      };
      status_history: {
        Row: {
          changed_at: string;
          changed_by_user_id: string | null;
          id: string;
          note: string | null;
          status: Database['public']['Enums']['work_order_status'];
          work_order_id: string;
        };
        Insert: {
          changed_at?: string;
          changed_by_user_id?: string | null;
          id?: string;
          note?: string | null;
          status: Database['public']['Enums']['work_order_status'];
          work_order_id: string;
        };
        Update: {
          changed_at?: string;
          changed_by_user_id?: string | null;
          id?: string;
          note?: string | null;
          status?: Database['public']['Enums']['work_order_status'];
          work_order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'status_history_work_order_id_fkey';
            columns: ['work_order_id'];
            isOneToOne: false;
            referencedRelation: 'admin_work_order_list';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'status_history_work_order_id_fkey';
            columns: ['work_order_id'];
            isOneToOne: false;
            referencedRelation: 'work_orders';
            referencedColumns: ['id'];
          },
        ];
      };
      work_orders: {
        Row: {
          board_brand: string | null;
          board_color: string | null;
          board_model: string | null;
          board_serial_label: string | null;
          board_size_label: string | null;
          board_type: Database['public']['Enums']['board_type'];
          cancelled_at: string | null;
          created_at: string;
          current_status: Database['public']['Enums']['work_order_status'];
          customer_confirmed_at: string | null;
          customer_id: string;
          damage_description: string | null;
          delivered_at: string | null;
          estimated_completion_date: string | null;
          id: string;
          intake_date: string;
          internal_note: string | null;
          notified_at: string | null;
          paper_order_no: string;
          payment_received: boolean;
          payment_received_at: string | null;
          picked_up_at: string | null;
          pickup_note: string | null;
          public_note: string | null;
          ready_for_pickup_at: string | null;
          storage_fee_warning_after_days: number;
          updated_at: string;
        };
        Insert: {
          board_brand?: string | null;
          board_color?: string | null;
          board_model?: string | null;
          board_serial_label?: string | null;
          board_size_label?: string | null;
          board_type: Database['public']['Enums']['board_type'];
          cancelled_at?: string | null;
          created_at?: string;
          current_status?: Database['public']['Enums']['work_order_status'];
          customer_confirmed_at?: string | null;
          customer_id: string;
          damage_description?: string | null;
          delivered_at?: string | null;
          estimated_completion_date?: string | null;
          id?: string;
          intake_date: string;
          internal_note?: string | null;
          notified_at?: string | null;
          paper_order_no: string;
          payment_received?: boolean;
          payment_received_at?: string | null;
          picked_up_at?: string | null;
          pickup_note?: string | null;
          public_note?: string | null;
          ready_for_pickup_at?: string | null;
          storage_fee_warning_after_days?: number;
          updated_at?: string;
        };
        Update: {
          board_brand?: string | null;
          board_color?: string | null;
          board_model?: string | null;
          board_serial_label?: string | null;
          board_size_label?: string | null;
          board_type?: Database['public']['Enums']['board_type'];
          cancelled_at?: string | null;
          created_at?: string;
          current_status?: Database['public']['Enums']['work_order_status'];
          customer_confirmed_at?: string | null;
          customer_id?: string;
          damage_description?: string | null;
          delivered_at?: string | null;
          estimated_completion_date?: string | null;
          id?: string;
          intake_date?: string;
          internal_note?: string | null;
          notified_at?: string | null;
          paper_order_no?: string;
          payment_received?: boolean;
          payment_received_at?: string | null;
          picked_up_at?: string | null;
          pickup_note?: string | null;
          public_note?: string | null;
          ready_for_pickup_at?: string | null;
          storage_fee_warning_after_days?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'work_orders_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      admin_work_order_list: {
        Row: {
          board_size_label: string | null;
          board_type: Database['public']['Enums']['board_type'] | null;
          created_at: string | null;
          current_status: Database['public']['Enums']['work_order_status'] | null;
          customer_id: string | null;
          customer_name: string | null;
          customer_normalized_phone: string | null;
          customer_phone: string | null;
          estimated_completion_date: string | null;
          id: string | null;
          intake_date: string | null;
          is_overdue_estimated_completion: boolean | null;
          is_pickup_overdue: boolean | null;
          latest_received_at: string | null;
          notified_at: string | null;
          paper_order_no: string | null;
          payment_received: boolean | null;
          payment_received_at: string | null;
          picked_up_at: string | null;
          quote_total_amount: number | null;
          ready_for_pickup_at: string | null;
          storage_fee_warning_after_days: number | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'work_orders_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      create_admin_work_order: {
        Args: {
          p_board: Json;
          p_created_by_user_id?: string;
          p_customer?: Json;
          p_customer_id?: string;
          p_customer_mode: string;
          p_quote_items: Json;
          p_work_order: Json;
        };
        Returns: Json;
      };
      normalize_tw_mobile_phone: {
        Args: { raw_phone: string };
        Returns: string;
      };
      transition_admin_work_order_status: {
        Args: {
          p_changed_by_user_id?: string;
          p_internal_note?: string;
          p_internal_note_is_set?: boolean;
          p_note?: string;
          p_status: Database['public']['Enums']['work_order_status'];
          p_work_order_id: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      board_type: 'SURFBOARD' | 'SUP' | 'SNOWBOARD';
      label_language: 'TSPL' | 'ZPL' | 'EPL' | 'DPL';
      photo_type: 'INTAKE' | 'IN_PROGRESS' | 'SPECIAL_CONDITION' | 'COMPLETION';
      photo_visibility: 'INTERNAL' | 'PUBLIC';
      print_job_status:
        | 'QUEUED'
        | 'PROCESSING'
        | 'SENT_TO_PRINTER'
        | 'PRINTER_READY_AFTER_SEND'
        | 'FAILED_TRANSPORT'
        | 'FAILED_PRINTER_STATUS'
        | 'UNKNOWN'
        | 'REPRINT_REQUESTED';
      quote_item_type: 'INITIAL' | 'ADDITIONAL' | 'ADJUSTMENT';
      work_order_status:
        | 'RECEIVED'
        | 'DRYING'
        | 'REPAIRING'
        | 'READY_FOR_PICKUP'
        | 'DELIVERED'
        | 'CANCELLED';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null;
          avif_autodetection: boolean | null;
          created_at: string | null;
          file_size_limit: number | null;
          id: string;
          name: string;
          owner: string | null;
          owner_id: string | null;
          public: boolean | null;
          type: Database['storage']['Enums']['buckettype'];
          updated_at: string | null;
        };
        Insert: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id: string;
          name: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string | null;
        };
        Update: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id?: string;
          name?: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string | null;
        };
        Relationships: [];
      };
      buckets_analytics: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          format: string;
          id: string;
          name: string;
          type: Database['storage']['Enums']['buckettype'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          format?: string;
          id?: string;
          name: string;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          format?: string;
          id?: string;
          name?: string;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string;
        };
        Relationships: [];
      };
      buckets_vectors: {
        Row: {
          created_at: string;
          id: string;
          type: Database['storage']['Enums']['buckettype'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string;
        };
        Relationships: [];
      };
      iceberg_namespaces: {
        Row: {
          bucket_name: string;
          catalog_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          name: string;
          updated_at: string;
        };
        Insert: {
          bucket_name: string;
          catalog_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          name: string;
          updated_at?: string;
        };
        Update: {
          bucket_name?: string;
          catalog_id?: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'iceberg_namespaces_catalog_id_fkey';
            columns: ['catalog_id'];
            isOneToOne: false;
            referencedRelation: 'buckets_analytics';
            referencedColumns: ['id'];
          },
        ];
      };
      iceberg_tables: {
        Row: {
          bucket_name: string;
          catalog_id: string;
          created_at: string;
          id: string;
          location: string;
          name: string;
          namespace_id: string;
          remote_table_id: string | null;
          shard_id: string | null;
          shard_key: string | null;
          updated_at: string;
        };
        Insert: {
          bucket_name: string;
          catalog_id: string;
          created_at?: string;
          id?: string;
          location: string;
          name: string;
          namespace_id: string;
          remote_table_id?: string | null;
          shard_id?: string | null;
          shard_key?: string | null;
          updated_at?: string;
        };
        Update: {
          bucket_name?: string;
          catalog_id?: string;
          created_at?: string;
          id?: string;
          location?: string;
          name?: string;
          namespace_id?: string;
          remote_table_id?: string | null;
          shard_id?: string | null;
          shard_key?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'iceberg_tables_catalog_id_fkey';
            columns: ['catalog_id'];
            isOneToOne: false;
            referencedRelation: 'buckets_analytics';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'iceberg_tables_namespace_id_fkey';
            columns: ['namespace_id'];
            isOneToOne: false;
            referencedRelation: 'iceberg_namespaces';
            referencedColumns: ['id'];
          },
        ];
      };
      migrations: {
        Row: {
          executed_at: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Insert: {
          executed_at?: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Update: {
          executed_at?: string | null;
          hash?: string;
          id?: number;
          name?: string;
        };
        Relationships: [];
      };
      objects: {
        Row: {
          bucket_id: string | null;
          created_at: string | null;
          id: string;
          last_accessed_at: string | null;
          metadata: Json | null;
          name: string | null;
          owner: string | null;
          owner_id: string | null;
          path_tokens: string[] | null;
          updated_at: string | null;
          user_metadata: Json | null;
          version: string | null;
        };
        Insert: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Update: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'objects_bucketId_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets';
            referencedColumns: ['id'];
          },
        ];
      };
      s3_multipart_uploads: {
        Row: {
          bucket_id: string;
          created_at: string;
          id: string;
          in_progress_size: number;
          key: string;
          metadata: Json | null;
          owner_id: string | null;
          upload_signature: string;
          user_metadata: Json | null;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          id: string;
          in_progress_size?: number;
          key: string;
          metadata?: Json | null;
          owner_id?: string | null;
          upload_signature: string;
          user_metadata?: Json | null;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          id?: string;
          in_progress_size?: number;
          key?: string;
          metadata?: Json | null;
          owner_id?: string | null;
          upload_signature?: string;
          user_metadata?: Json | null;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: 's3_multipart_uploads_bucket_id_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets';
            referencedColumns: ['id'];
          },
        ];
      };
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string;
          created_at: string;
          etag: string;
          id: string;
          key: string;
          owner_id: string | null;
          part_number: number;
          size: number;
          upload_id: string;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          etag: string;
          id?: string;
          key: string;
          owner_id?: string | null;
          part_number: number;
          size?: number;
          upload_id: string;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          etag?: string;
          id?: string;
          key?: string;
          owner_id?: string | null;
          part_number?: number;
          size?: number;
          upload_id?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: 's3_multipart_uploads_parts_bucket_id_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 's3_multipart_uploads_parts_upload_id_fkey';
            columns: ['upload_id'];
            isOneToOne: false;
            referencedRelation: 's3_multipart_uploads';
            referencedColumns: ['id'];
          },
        ];
      };
      vector_indexes: {
        Row: {
          bucket_id: string;
          created_at: string;
          data_type: string;
          dimension: number;
          distance_metric: string;
          id: string;
          metadata_configuration: Json | null;
          name: string;
          updated_at: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          data_type: string;
          dimension: number;
          distance_metric: string;
          id?: string;
          metadata_configuration?: Json | null;
          name: string;
          updated_at?: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          data_type?: string;
          dimension?: number;
          distance_metric?: string;
          id?: string;
          metadata_configuration?: Json | null;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vector_indexes_bucket_id_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets_vectors';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] };
        Returns: boolean;
      };
      allow_only_operation: {
        Args: { expected_operation: string };
        Returns: boolean;
      };
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string };
        Returns: undefined;
      };
      extension: { Args: { name: string }; Returns: string };
      filename: { Args: { name: string }; Returns: string };
      foldername: { Args: { name: string }; Returns: string[] };
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string };
        Returns: string;
      };
      get_size_by_bucket: {
        Args: never;
        Returns: {
          bucket_id: string;
          size: number;
        }[];
      };
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string;
          delimiter_param: string;
          max_keys?: number;
          next_key_token?: string;
          next_upload_token?: string;
          prefix_param: string;
        };
        Returns: {
          created_at: string;
          id: string;
          key: string;
        }[];
      };
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string;
          delimiter_param: string;
          max_keys?: number;
          next_token?: string;
          prefix_param: string;
          sort_order?: string;
          start_after?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      operation: { Args: never; Returns: string };
      search: {
        Args: {
          bucketname: string;
          levels?: number;
          limits?: number;
          offsets?: number;
          prefix: string;
          search?: string;
          sortcolumn?: string;
          sortorder?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      search_by_timestamp: {
        Args: {
          p_bucket_id: string;
          p_level: number;
          p_limit: number;
          p_prefix: string;
          p_sort_column: string;
          p_sort_column_after: string;
          p_sort_order: string;
          p_start_after: string;
        };
        Returns: {
          created_at: string;
          id: string;
          key: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      search_v2: {
        Args: {
          bucket_name: string;
          levels?: number;
          limits?: number;
          prefix: string;
          sort_column?: string;
          sort_column_after?: string;
          sort_order?: string;
          start_after?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          key: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
    };
    Enums: {
      buckettype: 'STANDARD' | 'ANALYTICS' | 'VECTOR';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      board_type: ['SURFBOARD', 'SUP', 'SNOWBOARD'],
      label_language: ['TSPL', 'ZPL', 'EPL', 'DPL'],
      photo_type: ['INTAKE', 'IN_PROGRESS', 'SPECIAL_CONDITION', 'COMPLETION'],
      photo_visibility: ['INTERNAL', 'PUBLIC'],
      print_job_status: [
        'QUEUED',
        'PROCESSING',
        'SENT_TO_PRINTER',
        'PRINTER_READY_AFTER_SEND',
        'FAILED_TRANSPORT',
        'FAILED_PRINTER_STATUS',
        'UNKNOWN',
        'REPRINT_REQUESTED',
      ],
      quote_item_type: ['INITIAL', 'ADDITIONAL', 'ADJUSTMENT'],
      work_order_status: [
        'RECEIVED',
        'DRYING',
        'REPAIRING',
        'READY_FOR_PICKUP',
        'DELIVERED',
        'CANCELLED',
      ],
    },
  },
  storage: {
    Enums: {
      buckettype: ['STANDARD', 'ANALYTICS', 'VECTOR'],
    },
  },
} as const;
