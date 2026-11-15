// The parts of the database rows the pages read. (The tables themselves are unchanged.)
export interface EventRow {
  id: string; slug?: string | null; title: string; subtitle: string | null; tagline?: string | null; description: string | null;
  event_date: string; ends_at: string | null; registration_deadline: string | null; venue: string | null; venue_address: string | null;
  capacity: number; registration_open: boolean; registration_fee: number | string; fee_note: string | null; price_info: string | null;
  banner_coming_soon?: boolean; hashtags?: string[]; kit_inclusions?: string[]; terms_html?: string | null;
  contact_links?: { label: string; url: string }[]; payment_account_name?: string | null; payment_account_number?: string | null; send_ack_email?: boolean;
  ticket_prefix?: string;
}
export interface ImageRow { id: string; event_id: string; slot: string; storage_path: string | null; external_url: string | null; alt_text: string | null; updated_at?: string }
export interface KitRow { id: string; event_id: string; name: string; description?: string | null; unit_price: number | string; active?: boolean }
