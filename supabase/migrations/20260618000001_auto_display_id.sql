-- Migration: Auto-Generate Order display_id on Insert and Enable Realtime
-- Creates a BEFORE INSERT trigger to generate display_id automatically.
-- Configures REPLICA IDENTITY FULL to send old states in update events.
-- Enables Realtime on the orders table.

-- Create trigger function
CREATE OR REPLACE FUNCTION public.generate_order_display_id()
RETURNS TRIGGER AS $$
DECLARE
    today_str TEXT;
    seq_count INT;
    prefix TEXT;
    new_display_id TEXT;
    ord_date DATE;
BEGIN
    -- Only generate if display_id is not already provided
    IF NEW.display_id IS NOT NULL AND NEW.display_id <> '' THEN
        RETURN NEW;
    END IF;

    ord_date := COALESCE(NEW.created_at, NOW())::DATE;
    today_str := to_char(ord_date, 'YYYY-MM-DD');
    
    -- Determine prefix based on order_source
    IF NEW.order_source = 'pos' THEN
        prefix := 'POSOID';
    ELSE
        prefix := 'SFOID';
    END IF;

    -- Count existing orders on the same day with the same prefix to get sequence
    SELECT COALESCE(COUNT(*), 0) INTO seq_count
    FROM public.orders
    WHERE created_at::DATE = ord_date
      AND order_source = NEW.order_source;
      
    seq_count := seq_count + 1;
    new_display_id := 'JOJ-' || prefix || '-' || today_str || '-' || lpad(seq_count::text, 4, '0');

    -- Loop to avoid race condition/duplicate key conflicts
    WHILE EXISTS (SELECT 1 FROM public.orders WHERE display_id = new_display_id) LOOP
        seq_count := seq_count + 1;
        new_display_id := 'JOJ-' || prefix || '-' || today_str || '-' || lpad(seq_count::text, 4, '0');
    END LOOP;

    NEW.display_id := new_display_id;
    
    -- Also store in metadata for safety/compatibility
    IF NEW.metadata IS NULL THEN
        NEW.metadata := jsonb_build_object('display_id', new_display_id);
    ELSE
        NEW.metadata := NEW.metadata || jsonb_build_object('display_id', new_display_id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger
DROP TRIGGER IF EXISTS orders_set_display_id ON public.orders;
CREATE TRIGGER orders_set_display_id
    BEFORE INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_order_display_id();

-- Configure REPLICA IDENTITY FULL to send old states in update events
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Safely add table to realtime publication if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;
