-- Agent Marketplace Listings table
CREATE TABLE IF NOT EXISTS agent_marketplace_listings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid REFERENCES agents(id),
  seller_id uuid,
  price_meeet numeric(12,2) NOT NULL,
  description text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled')),
  buyer_id uuid,
  sold_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE agent_marketplace_listings ENABLE ROW LEVEL SECURITY;

-- Public read access for active listings
CREATE POLICY "Anyone can view active listings"
  ON agent_marketplace_listings FOR SELECT
  USING (status = 'active');

-- Sellers can create listings
CREATE POLICY "Authenticated users can create listings"
  ON agent_marketplace_listings FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Sellers can cancel their own listings
CREATE POLICY "Sellers can update their listings"
  ON agent_marketplace_listings FOR UPDATE
  TO authenticated
  USING (seller_id = auth.uid());
