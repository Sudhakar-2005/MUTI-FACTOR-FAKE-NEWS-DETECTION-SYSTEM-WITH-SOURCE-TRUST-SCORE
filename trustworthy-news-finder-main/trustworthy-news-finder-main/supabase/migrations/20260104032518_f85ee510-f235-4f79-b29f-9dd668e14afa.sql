-- Create fact_checks table for storing verified claims
CREATE TABLE public.fact_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  claim TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('true', 'false', 'misleading', 'unverified')),
  source_url TEXT,
  explanation TEXT,
  keywords TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fact_checks ENABLE ROW LEVEL SECURITY;

-- Allow public read access for fact-checks (public database)
CREATE POLICY "Anyone can view fact checks" 
ON public.fact_checks 
FOR SELECT 
USING (true);

-- Create index for keyword search
CREATE INDEX idx_fact_checks_keywords ON public.fact_checks USING GIN(keywords);

-- Create index for full-text search on claim
CREATE INDEX idx_fact_checks_claim ON public.fact_checks USING GIN(to_tsvector('english', claim));

-- Create trigger for updated_at
CREATE TRIGGER update_fact_checks_updated_at
BEFORE UPDATE ON public.fact_checks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();