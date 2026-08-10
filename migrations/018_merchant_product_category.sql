-- 018: Category support for merchant storefront menus.
-- The public storefront (/store/:slug) groups menu items by category; the
-- seed data (scripts/seed-st-michaels.sql) supplies one of seven fixed
-- categories (Starters, Fresh Garden Salads, Burgers, Cold Subs, Hot Subs,
-- Wraps, Sandwiches).

ALTER TABLE merchant_products ADD COLUMN IF NOT EXISTS category TEXT;
