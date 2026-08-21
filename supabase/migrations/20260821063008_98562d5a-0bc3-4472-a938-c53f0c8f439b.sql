-- FAQs (real content from the customer-service page)
INSERT INTO public.faqs (question, answer, category, sort_order, is_published) VALUES
('How long does shipping take?', '3–7 business days across India. Metro cities usually receive within 2–4 days.', 'Shipping', 1, true),
('What is your return policy?', '7-day return on manufacturing defects. Products must be unused and in original packaging.', 'Returns', 2, true),
('How do I claim warranty?', 'Raise a support ticket with your order ID, product photos, and issue description. Approved claims ship within 5 business days.', 'Warranty', 3, true),
('Do you deliver PAN India?', 'Yes, we ship to all serviceable pincodes in India via Shiprocket.', 'Shipping', 4, true)
ON CONFLICT DO NOTHING;

-- Career programs: open roles
INSERT INTO public.career_programs (title, department, location, employment_type, kind, description, eligibility, sort_order, is_published) VALUES
('Production Engineer', 'Manufacturing', 'Delhi NCR', 'Full-time', 'job', 'Own line efficiency, tooling and quality on the Aurona LED and appliance assembly lines.', 'Diploma or B.E. in Electrical/Mechanical with 2+ years in electronics or appliance manufacturing.', 1, true),
('Retail Sales Manager', 'Sales', 'Mumbai', 'Full-time', 'job', 'Grow the retail counter network, onboard new stores and drive sell-out across the territory.', '3+ years of channel sales experience in lighting, electricals or FMCG durables.', 2, true),
('Product Designer', 'Design', 'Bangalore', 'Full-time', 'job', 'Design fixtures and appliance housings end to end — concept, CAD, DFM and finish selection.', 'Degree in Industrial/Product Design with a portfolio of manufactured products.', 3, true),
('Warehouse Executive', 'Operations', 'Chennai', 'Full-time', 'job', 'Run inbound, put-away, picking and dispatch accuracy for the regional warehouse.', 'Graduate with 1+ year of warehouse or dispatch experience; working knowledge of WMS.', 4, true)
ON CONFLICT DO NOTHING;

-- Career programs: referral programs (existing, preserved verbatim)
INSERT INTO public.career_programs (title, kind, description, reward, eligibility, sort_order, is_published) VALUES
('Refer a Candidate', 'referral', 'Know someone great? Refer them for any open role. You earn a bonus once they complete 90 days with Aurona.', '₹5,000 bonus', 'Reward is paid after the referred candidate completes 90 days with Aurona.', 5, true),
('Refer a Retailer', 'referral', 'Introduce a shop or electrical store to Aurona. Earn a commission on their first wholesale purchase.', '2% of first order', 'Reward is paid after the referred retailer''s first wholesale order is invoiced.', 6, true),
('Customer Referral', 'referral', 'Share your personal referral code. Your friend gets a welcome discount, you get store credit on their first order.', '₹250 store credit', 'Credit is issued after the referred customer''s first order is delivered.', 7, true),
('Distributor Introduction', 'referral', 'Connect us with a distribution partner in an untapped territory and earn a one-time introduction reward.', 'Up to ₹25,000', 'Reward applies to new territories only and is paid after the distribution agreement is signed.', 8, true)
ON CONFLICT DO NOTHING;

-- Blog posts (the six real Aurona articles)
INSERT INTO public.blog_posts (slug, title, excerpt, category, cover_url, author, read_minutes, body, published_at, is_published) VALUES
('concealed-lights-guide',
 'Choosing the right concealed lights for your home',
 'A practical guide to wattage, colour temperature and beam angle for Indian interiors.',
 'Lighting Guide',
 '/__l5e/assets-v1/4dfd4cd5-b4fc-4040-82bc-77df27cd0e8a/concealed-lights-guide.jpg',
 'Aurona Design Team', 5,
 $json$[
  {"p":"Concealed lighting is the quickest way to make a room feel finished. Because the fixture disappears into the false ceiling, all you see is light — which means every decision about wattage, beam angle and colour temperature shows up directly on your walls."},
  {"h":"1. Start with wattage per square foot"},
  {"p":"For living rooms and bedrooms, plan roughly 1–1.5 watts of LED per square foot for comfortable ambient light. Kitchens and study areas need closer to 2 watts per square foot because tasks demand higher contrast."},
  {"h":"2. Pick colour temperature by room"},
  {"li":["2700K–3000K (warm white): bedrooms, living rooms, dining — relaxing and skin-flattering.","4000K (natural white): kitchens, corridors, wardrobes — clean and neutral.","6500K (cool daylight): utility areas, garages, workshops — maximum clarity."]},
  {"h":"3. Respect the beam angle"},
  {"p":"A 24° beam creates dramatic pools of light for artwork and textures; 60° and above washes broad surfaces evenly. Mixing both in one ceiling is what makes designer interiors look layered rather than flat."},
  {"h":"4. Space fixtures properly"},
  {"p":"As a rule of thumb, keep spacing equal to the ceiling height for even ambient coverage — 9 ft ceiling, 9 ft spacing — and drop to 2–3 ft when you are grazing a textured wall."},
  {"h":"Aurona recommendation"},
  {"p":"Our concealed COB range runs on high-CRI chips (Ra > 80) with aluminium heat sinks, so colour stays consistent through the fixture's life and the driver stays cool inside a closed ceiling."}
 ]$json$::jsonb,
 '2026-07-12T09:00:00Z', true),
('cob-vs-smd',
 'COB vs SMD LEDs: what''s the real difference?',
 'Two dominant LED chip types — how each performs and where each shines.',
 'Product Knowledge',
 '/__l5e/assets-v1/59ab48db-0d1a-4416-ae25-a95d572284e8/cob-vs-smd.jpg',
 'Aurona Product Team', 6,
 $json$[
  {"p":"Nearly every LED fixture you buy uses one of two chip architectures: COB (chip on board) or SMD (surface mounted device). They are not interchangeable, and picking the wrong one is the most common reason a room feels either glary or washed out."},
  {"h":"COB — one dense light source"},
  {"p":"Dozens of diodes sit on a single substrate and share one phosphor layer, so the output reads as a single crisp point of light. That gives excellent beam control, higher contrast and better colour rendering — ideal for spotlights, downlights and accent lighting."},
  {"h":"SMD — many small sources"},
  {"p":"Individual diodes are mounted across a board, spreading light over a wider area with softer shadows. This is what you want in panel lights, tube lights, battens and street lighting where uniformity matters more than punch."},
  {"h":"Quick comparison"},
  {"li":["Beam control: COB wins — tight, well-defined beams.","Uniformity: SMD wins — no hotspots across large surfaces.","Heat: COB concentrates heat, so heat-sink quality matters more.","Colour consistency: COB typically holds tighter colour binning."]},
  {"h":"How to choose"},
  {"p":"Use COB where you want the eye to land — art walls, kitchen islands, retail displays. Use SMD where you want light to be felt but not noticed — offices, corridors, false-ceiling panels."}
 ]$json$::jsonb,
 '2026-06-28T09:00:00Z', true),
('layered-lighting',
 'Layered lighting: the pro designer approach',
 'Ambient, task and accent lighting explained with examples for Indian homes.',
 'Home Improvement',
 '/__l5e/assets-v1/729af96e-2c22-42f5-8367-73d8dd2d2e8a/layered-lighting.jpg',
 'Aurona Design Team', 4,
 $json$[
  {"p":"A single ceiling light in the middle of the room is why most homes feel flat after sunset. Designers solve it with three layers working together."},
  {"h":"Layer 1 — Ambient"},
  {"p":"The base wash of light: panel lights, concealed cove lighting or a central fixture. It should be dimmable or switchable in zones so evenings feel calmer than mornings."},
  {"h":"Layer 2 — Task"},
  {"p":"Focused light exactly where work happens — under-cabinet strips in the kitchen, a 4000K reading light beside the bed, mirror lighting in the bathroom at eye level rather than overhead."},
  {"h":"Layer 3 — Accent"},
  {"p":"The layer that creates atmosphere: narrow-beam spots on artwork, grazing light on stone or brick, and low-level lighting along stairs and corridors for night movement."},
  {"h":"Putting it together"},
  {"li":["Give each layer its own switch — that's what makes a room adaptable.","Keep colour temperature consistent within a room; mix intensities, not colours.","Aim for 3 light sources minimum in every living space."]}
 ]$json$::jsonb,
 '2026-06-09T09:00:00Z', true),
('make-in-india-lighting',
 'Why Make in India lighting is quietly leading exports',
 'How Indian manufacturing scale is reshaping the global lighting market.',
 'Industry News',
 '/__l5e/assets-v1/fb3d006e-75a9-4932-8b54-168a0486b637/make-in-india-lighting.jpg',
 'Aurona Newsroom', 7,
 $json$[
  {"p":"India's lighting industry has moved from assembly to genuine manufacturing over the last decade — driver electronics, housings and heat sinks are increasingly made domestically rather than imported."},
  {"h":"What changed"},
  {"li":["Component depth: local driver and SMPS manufacturing shortened supply chains.","Quality standards: BIS compliance pushed the floor up across the category.","Scale: domestic demand from housing and infrastructure funded better tooling."]},
  {"h":"What it means for buyers"},
  {"p":"Shorter lead times, easier warranty service and pricing that is no longer tied to import cycles — which is exactly why manufacturer-direct buying now beats imported private labels on total cost of ownership."}
 ]$json$::jsonb,
 '2026-05-21T09:00:00Z', true),
('ceiling-fan-bee-rating',
 'BEE star ratings on ceiling fans, decoded',
 'What a 5-star BLDC fan actually saves you every month, with real numbers.',
 'Home Appliances',
 '/__l5e/assets-v1/f82a89c3-7895-4fa8-8849-5c1b3bd94896/ceiling-fan-bee-rating.jpg',
 'Aurona Appliances Team', 5,
 $json$[
  {"p":"A conventional induction ceiling fan draws about 75W. A 5-star BLDC fan delivers similar air delivery at roughly 28–32W. That gap is the entire story behind star ratings."},
  {"h":"The monthly math"},
  {"p":"Running a fan 10 hours a day for 30 days: a 75W fan uses about 22.5 units; a 30W BLDC uses about 9 units. At ₹8 per unit that's roughly ₹108 saved per fan per month — around ₹1,300 a year."},
  {"h":"What else to check beyond stars"},
  {"li":["Air delivery (CMM): look for 210+ CMM for rooms up to 120 sq ft.","Sweep size: 1200 mm for standard bedrooms, 1400 mm for large halls.","Remote & memory: BLDC fans should retain speed after a power cut."]}
 ]$json$::jsonb,
 '2026-05-02T09:00:00Z', true),
('geyser-buying-guide',
 'Water geyser buying guide for Indian bathrooms',
 'Storage vs instant, tank capacity, and safety features worth paying for.',
 'Home Appliances',
 '/__l5e/assets-v1/c93688df-62fb-456c-9cc0-753eb338389d/geyser-buying-guide.jpg',
 'Aurona Appliances Team', 6,
 $json$[
  {"p":"Geyser buying comes down to three decisions: type, capacity and safety hardware. Get those right and the rest is finish and warranty."},
  {"h":"Storage or instant?"},
  {"p":"Instant geysers (3L) suit kitchens and quick hand-wash use. Storage geysers (10–25L) are the right answer for bathing, especially bucket baths and showers where sustained hot water matters."},
  {"h":"Capacity guide"},
  {"li":["10L — 1–2 people, bucket bath.","15L — small family, shower use.","25L — larger family or multiple back-to-back showers."]},
  {"h":"Safety features that matter"},
  {"p":"Look for a multi-function safety valve, thermal cut-out, glass-lined or SS304 inner tank, and high-density PUF insulation to keep standby heat loss low. In hard-water areas, a magnesium anode rod is not optional."}
 ]$json$::jsonb,
 '2026-04-18T09:00:00Z', true)
ON CONFLICT (slug) DO NOTHING;