ALTER TABLE lists
ADD COLUMN sort_mode text DEFAULT NULL
CONSTRAINT lists_sort_mode_check CHECK (
  sort_mode IS NULL OR sort_mode IN ('store-category', 'category', 'alpha', 'date-added')
);
