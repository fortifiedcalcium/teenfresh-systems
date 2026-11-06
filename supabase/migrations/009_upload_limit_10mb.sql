-- Raise the upload limit of both storage buckets from 5 MB to 10 MB (10 * 1024 * 1024 bytes).
-- Safe to run more than once.
update storage.buckets set file_size_limit = 10485760 where id in ('event-media', 'payment-receipts');
