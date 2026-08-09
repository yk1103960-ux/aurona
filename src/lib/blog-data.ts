import coverConcealed from "@/assets/blog/concealed-lights-guide.jpg.asset.json";
import coverCob from "@/assets/blog/cob-vs-smd.jpg.asset.json";
import coverLayered from "@/assets/blog/layered-lighting.jpg.asset.json";
import coverMakeInIndia from "@/assets/blog/make-in-india-lighting.jpg.asset.json";
import coverFan from "@/assets/blog/ceiling-fan-bee-rating.jpg.asset.json";
import coverGeyser from "@/assets/blog/geyser-buying-guide.jpg.asset.json";

export type BlogPost = {
  slug: string;
  cat: string;
  title: string;
  excerpt: string;
  date: string;
  read: string;
  tone: string;
  /** CDN-hosted cover image */
  cover: string;
  author: string;
  /** Simple block content: h = heading, p = paragraph, li = bullet list */
  body: { h?: string; p?: string; li?: string[] }[];
};

export const POSTS: BlogPost[] = [
  {
    slug: "concealed-lights-guide",
    cover: coverConcealed.url,
    cat: "Lighting Guide",
    title: "Choosing the right concealed lights for your home",
    excerpt: "A practical guide to wattage, colour temperature and beam angle for Indian interiors.",
    date: "12 Jul 2026",
    read: "5 min read",
    tone: "from-primary/25 via-primary/10 to-transparent",
    author: "Aurona Design Team",
    body: [
      { p: "Concealed lighting is the quickest way to make a room feel finished. Because the fixture disappears into the false ceiling, all you see is light — which means every decision about wattage, beam angle and colour temperature shows up directly on your walls." },
      { h: "1. Start with wattage per square foot" },
      { p: "For living rooms and bedrooms, plan roughly 1–1.5 watts of LED per square foot for comfortable ambient light. Kitchens and study areas need closer to 2 watts per square foot because tasks demand higher contrast." },
      { h: "2. Pick colour temperature by room" },
      { li: [
        "2700K–3000K (warm white): bedrooms, living rooms, dining — relaxing and skin-flattering.",
        "4000K (natural white): kitchens, corridors, wardrobes — clean and neutral.",
        "6500K (cool daylight): utility areas, garages, workshops — maximum clarity.",
      ] },
      { h: "3. Respect the beam angle" },
      { p: "A 24° beam creates dramatic pools of light for artwork and textures; 60° and above washes broad surfaces evenly. Mixing both in one ceiling is what makes designer interiors look layered rather than flat." },
      { h: "4. Space fixtures properly" },
      { p: "As a rule of thumb, keep spacing equal to the ceiling height for even ambient coverage — 9 ft ceiling, 9 ft spacing — and drop to 2–3 ft when you are grazing a textured wall." },
      { h: "Aurona recommendation" },
      { p: "Our concealed COB range runs on high-CRI chips (Ra > 80) with aluminium heat sinks, so colour stays consistent through the fixture's life and the driver stays cool inside a closed ceiling." },
    ],
  },
  {
    slug: "cob-vs-smd",
    cover: coverCob.url,
    cat: "Product Knowledge",
    title: "COB vs SMD LEDs: what's the real difference?",
    excerpt: "Two dominant LED chip types — how each performs and where each shines.",
    date: "28 Jun 2026",
    read: "6 min read",
    tone: "from-sky/30 via-primary/10 to-transparent",
    author: "Aurona Product Team",
    body: [
      { p: "Nearly every LED fixture you buy uses one of two chip architectures: COB (chip on board) or SMD (surface mounted device). They are not interchangeable, and picking the wrong one is the most common reason a room feels either glary or washed out." },
      { h: "COB — one dense light source" },
      { p: "Dozens of diodes sit on a single substrate and share one phosphor layer, so the output reads as a single crisp point of light. That gives excellent beam control, higher contrast and better colour rendering — ideal for spotlights, downlights and accent lighting." },
      { h: "SMD — many small sources" },
      { p: "Individual diodes are mounted across a board, spreading light over a wider area with softer shadows. This is what you want in panel lights, tube lights, battens and street lighting where uniformity matters more than punch." },
      { h: "Quick comparison" },
      { li: [
        "Beam control: COB wins — tight, well-defined beams.",
        "Uniformity: SMD wins — no hotspots across large surfaces.",
        "Heat: COB concentrates heat, so heat-sink quality matters more.",
        "Colour consistency: COB typically holds tighter colour binning.",
      ] },
      { h: "How to choose" },
      { p: "Use COB where you want the eye to land — art walls, kitchen islands, retail displays. Use SMD where you want light to be felt but not noticed — offices, corridors, false-ceiling panels." },
    ],
  },
  {
    slug: "layered-lighting",
    cover: coverLayered.url,
    cat: "Home Improvement",
    title: "Layered lighting: the pro designer approach",
    excerpt: "Ambient, task and accent lighting explained with examples for Indian homes.",
    date: "09 Jun 2026",
    read: "4 min read",
    tone: "from-primary/20 via-sky/15 to-transparent",
    author: "Aurona Design Team",
    body: [
      { p: "A single ceiling light in the middle of the room is why most homes feel flat after sunset. Designers solve it with three layers working together." },
      { h: "Layer 1 — Ambient" },
      { p: "The base wash of light: panel lights, concealed cove lighting or a central fixture. It should be dimmable or switchable in zones so evenings feel calmer than mornings." },
      { h: "Layer 2 — Task" },
      { p: "Focused light exactly where work happens — under-cabinet strips in the kitchen, a 4000K reading light beside the bed, mirror lighting in the bathroom at eye level rather than overhead." },
      { h: "Layer 3 — Accent" },
      { p: "The layer that creates atmosphere: narrow-beam spots on artwork, grazing light on stone or brick, and low-level lighting along stairs and corridors for night movement." },
      { h: "Putting it together" },
      { li: [
        "Give each layer its own switch — that's what makes a room adaptable.",
        "Keep colour temperature consistent within a room; mix intensities, not colours.",
        "Aim for 3 light sources minimum in every living space.",
      ] },
    ],
  },
  {
    slug: "make-in-india-lighting",
    cover: coverMakeInIndia.url,
    cat: "Industry News",
    title: "Why Make in India lighting is quietly leading exports",
    excerpt: "How Indian manufacturing scale is reshaping the global lighting market.",
    date: "21 May 2026",
    read: "7 min read",
    tone: "from-sky/25 via-primary/8 to-transparent",
    author: "Aurona Newsroom",
    body: [
      { p: "India's lighting industry has moved from assembly to genuine manufacturing over the last decade — driver electronics, housings and heat sinks are increasingly made domestically rather than imported." },
      { h: "What changed" },
      { li: [
        "Component depth: local driver and SMPS manufacturing shortened supply chains.",
        "Quality standards: BIS compliance pushed the floor up across the category.",
        "Scale: domestic demand from housing and infrastructure funded better tooling.",
      ] },
      { h: "What it means for buyers" },
      { p: "Shorter lead times, easier warranty service and pricing that is no longer tied to import cycles — which is exactly why manufacturer-direct buying now beats imported private labels on total cost of ownership." },
    ],
  },
  {
    slug: "ceiling-fan-bee-rating",
    cover: coverFan.url,
    cat: "Home Appliances",
    title: "BEE star ratings on ceiling fans, decoded",
    excerpt: "What a 5-star BLDC fan actually saves you every month, with real numbers.",
    date: "02 May 2026",
    read: "5 min read",
    tone: "from-primary/20 via-primary/5 to-transparent",
    author: "Aurona Appliances Team",
    body: [
      { p: "A conventional induction ceiling fan draws about 75W. A 5-star BLDC fan delivers similar air delivery at roughly 28–32W. That gap is the entire story behind star ratings." },
      { h: "The monthly math" },
      { p: "Running a fan 10 hours a day for 30 days: a 75W fan uses about 22.5 units; a 30W BLDC uses about 9 units. At ₹8 per unit that's roughly ₹108 saved per fan per month — around ₹1,300 a year." },
      { h: "What else to check beyond stars" },
      { li: [
        "Air delivery (CMM): look for 210+ CMM for rooms up to 120 sq ft.",
        "Sweep size: 1200 mm for standard bedrooms, 1400 mm for large halls.",
        "Remote & memory: BLDC fans should retain speed after a power cut.",
      ] },
    ],
  },
  {
    slug: "geyser-buying-guide",
    cover: coverGeyser.url,
    cat: "Home Appliances",
    title: "Water geyser buying guide for Indian bathrooms",
    excerpt: "Storage vs instant, tank capacity, and safety features worth paying for.",
    date: "18 Apr 2026",
    read: "6 min read",
    tone: "from-sky/25 via-primary/10 to-transparent",
    author: "Aurona Appliances Team",
    body: [
      { p: "Geyser buying comes down to three decisions: type, capacity and safety hardware. Get those right and the rest is finish and warranty." },
      { h: "Storage or instant?" },
      { p: "Instant geysers (3L) suit kitchens and quick hand-wash use. Storage geysers (10–25L) are the right answer for bathing, especially bucket baths and showers where sustained hot water matters." },
      { h: "Capacity guide" },
      { li: [
        "10L — 1–2 people, bucket bath.",
        "15L — small family, shower use.",
        "25L — larger family or multiple back-to-back showers.",
      ] },
      { h: "Safety features that matter" },
      { p: "Look for a multi-function safety valve, thermal cut-out, glass-lined or SS304 inner tank, and high-density PUF insulation to keep standby heat loss low. In hard-water areas, a magnesium anode rod is not optional." },
    ],
  },
];

export const CATEGORIES = Array.from(new Set(POSTS.map((p) => p.cat)));

export function getPost(slug: string) {
  return POSTS.find((p) => p.slug === slug) ?? null;
}

export function neighbours(slug: string) {
  const i = POSTS.findIndex((p) => p.slug === slug);
  return { prev: i > 0 ? POSTS[i - 1]! : null, next: i >= 0 && i < POSTS.length - 1 ? POSTS[i + 1]! : null };
}
