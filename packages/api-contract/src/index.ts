export * from './errors';
export type {
  CityResponseDto,
  CountryResponseDto,
  CreateCityDto,
  CreateCountryDto,
  CreateCurrencyDto,
  CurrencyResponseDto,
  UpdateCurrencyDto,
  UpdateCityDto,
  UpdateCountryDto,
  AdminResponseDto,
  AuthResponseDto,
  LoginAdminDtoWritable,
} from './generated/types.gen';

/** `meta` of paginated lists. Declared here because OpenAPI does not mark it required (D4). */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface Envelope<T> {
  data: T;
}
