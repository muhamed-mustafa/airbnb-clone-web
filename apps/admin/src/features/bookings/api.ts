'use client';

import type { Paginated } from '@stays/api-contract';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { bffFetch } from '@/lib/bff-client';

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED';

export interface AdminBooking {
  id: string;
  unit: string;
  unitTitle?: string;
  guest: string;
  guestName?: string;
  host: string;
  hostName?: string;
  checkIn: string;
  checkOut: string;
  adultsCount: number;
  kidsCount?: number;
  notes?: string;
  pricePerDay: number;
  daysCount: number;
  bookingAmount: number;
  vat: number;
  vatAmount: number;
  totalAmount: number;
  status: BookingStatus;
  cancellationReason?: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingListParams {
  page: number;
  status: string;
  search: string;
  checkInFrom: string;
  checkInTo: string;
  createdFrom: string;
  createdTo: string;
}

export const bookingKeys = {
  list: (params: BookingListParams) => ['admin-bookings', params] as const,
};

const queryString = (entries: Record<string, string | number>) =>
  new URLSearchParams(
    Object.entries(entries)
      .filter(([, value]) => value !== '')
      .map(([key, value]) => [key, String(value)]),
  ).toString();

export function useAdminBookings(params: BookingListParams) {
  return useQuery({
    queryKey: bookingKeys.list(params),
    queryFn: ({ signal }) =>
      bffFetch<Paginated<AdminBooking>>(
        `/bff/api/bookings/admin?${queryString({ ...params, limit: 20 })}`,
        { signal },
      ),
    placeholderData: keepPreviousData,
  });
}
