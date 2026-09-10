export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  page_size: number;
  message?: string;
  error?: string;
}

export interface SingleResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface ImportResponse {
  success: boolean;
  data?: {
    imported_count: number;
    skipped_count: number;
    errors?: string[];
  };
  detail?: string;
  message?: string;
}

export interface MasterEntity {
  [key: string]: unknown;
  IsActive?: boolean;
}
