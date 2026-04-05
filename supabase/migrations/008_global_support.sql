-- Expand currency support beyond EGP/USD
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_preferred_currency_check;
ALTER TABLE users ADD CONSTRAINT users_preferred_currency_check CHECK (preferred_currency IN ('EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD', 'LBP', 'IQD', 'MAD', 'TND', 'DZD', 'LYD', 'SDG', 'INR', 'PKR', 'TRY', 'NGN', 'ZAR', 'BRL', 'CAD', 'AUD'));

ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_currency_check;
ALTER TABLE groups ADD CONSTRAINT groups_currency_check CHECK (currency IN ('EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD', 'LBP', 'IQD', 'MAD', 'TND', 'DZD', 'LYD', 'SDG', 'INR', 'PKR', 'TRY', 'NGN', 'ZAR', 'BRL', 'CAD', 'AUD'));

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_currency_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_currency_check CHECK (currency IN ('EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD', 'LBP', 'IQD', 'MAD', 'TND', 'DZD', 'LYD', 'SDG', 'INR', 'PKR', 'TRY', 'NGN', 'ZAR', 'BRL', 'CAD', 'AUD'));

ALTER TABLE settlements DROP CONSTRAINT IF EXISTS settlements_currency_check;
ALTER TABLE settlements ADD CONSTRAINT settlements_currency_check CHECK (currency IN ('EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD', 'LBP', 'IQD', 'MAD', 'TND', 'DZD', 'LYD', 'SDG', 'INR', 'PKR', 'TRY', 'NGN', 'ZAR', 'BRL', 'CAD', 'AUD'));

-- Expand payment methods globally
ALTER TABLE settlements DROP CONSTRAINT IF EXISTS settlements_method_check;
ALTER TABLE settlements ADD CONSTRAINT settlements_method_check CHECK (method IN ('cash', 'vodafone_cash', 'instapay', 'bank', 'paypal', 'venmo', 'zelle', 'wise', 'revolut', 'apple_pay', 'google_pay', 'stc_pay', 'mada', 'upi', 'other'));
