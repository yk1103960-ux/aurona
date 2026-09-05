import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { careersQuery } from "@/lib/careers";
import { submitCareerApplication } from "@/lib/careers.functions";

export const Route = createFileRoute("/partner-program/$id")({
  head: () => ({
    meta: [
      { title: "Partner Program — Aurona Lighting Industries" },
      {
        name: "description",
        content:
          "Details and application form for an Aurona Lighting Industries business partner program — apply online in a few minutes.",
      },
      { property: "og:title", content: "Partner Program — Aurona Lighting Industries" },
      {
        property: "og:description",
        content: "Read the program details and submit your partner application to Aurona Lighting Industries.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PartnerProgramPage,
});

const MAX_RESUME_BYTES = 3 * 1024 * 1024;

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  address: z.string().trim().min(5, "Enter your address").max(500),
});

type DetailSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  numbered?: string[];
  subsections?: {
    heading: string;
    paragraphs?: string[];
    bullets?: string[];
  }[];
};

type ProgramContent = {
  subtitle?: string;
  intro?: string;
  partnerChoices?: string[];
  sections: DetailSection[];
};

const PROGRAM_CONTENT: Record<string, ProgramContent> = {
  "sales partner program": {
    subtitle: "Earn, Grow, and Succeed",
    intro:
      "Looking for an exciting job opportunity with flexible hours? Join the Aurona Sales Partner Program and become a part of our dynamic team. This program is designed for self-motivated individuals who want to represent Aurona's premium LED lighting and home appliance products in their local communities.",
    partnerChoices: ["Individual", "Business"],
    sections: [
      {
        heading: "About the Program",
        paragraphs: [
          "The Aurona Sales Partner Program offers individuals the opportunity to represent Aurona's premium LED lighting and home appliance products in their local communities. We specialize in delivering quality products with comprehensive support, training, and marketing materials to help you succeed in building your own sales network and income.",
        ],
      },
      {
        heading: "Key Features of the Program",
        bullets: [
          "Flexibility to Work Independently: Set your own hours and determine the best ways to market Aurona products in your area.",
          "Attractive Commission Structure: Earn competitive commissions for every sale, with opportunities for bonus incentives.",
          "Training & Support: Gain access to product knowledge, sales strategies, and customer engagement training.",
          "Marketing Materials: Receive brochures, product catalogues, banners, and promotional support.",
          "Exclusive Incentives: Unlock rewards for reaching sales milestones and exceeding performance goals.",
        ],
      },
      {
        heading: "Eligibility Criteria",
        bullets: [
          "Passion for Sales: Prior sales experience is a plus, but enthusiasm and the ability to connect with people are essential.",
          "Local Market Knowledge: Familiarity with your local area and potential customers is important.",
          "Communication Skills: Ability to clearly explain product features and benefits.",
          "Basic Requirements: Smartphone, email access, and willingness to attend online training.",
        ],
      },
      {
        heading: "Working Plan",
        subsections: [
          {
            heading: "Program Introduction",
            bullets: [
              "Gain in-depth product knowledge through training.",
              "Receive your sales kit and marketing materials.",
            ],
          },
          {
            heading: "Sales Process",
            bullets: [
              "Identify households, businesses, and retailers in your community.",
              "Present Aurona products and assist customers with purchasing.",
              "Submit sales details to Aurona for order processing and delivery coordination.",
            ],
          },
          {
            heading: "Rewards and Earnings",
            bullets: [
              "Earn commissions on successful sales.",
              "Unlock additional bonuses for meeting or exceeding sales targets.",
            ],
          },
        ],
      },
      {
        heading: "Onboarding Process",
        bullets: [
          "Application Submission: Fill out the application form below.",
          "Interview: Attend a brief interview to discuss your skills and interest.",
          "Training: Participate in a free online product and sales training session.",
          "Activation: Receive your Sales Partner ID, commission structure details, and marketing materials.",
        ],
      },
      {
        heading: "How to Join",
        bullets: [
          "Fill out the application form below to apply online.",
          "Contact Aurona for assistance if required.",
          "Complete the registration process and begin earning as an official Aurona Sales Partner.",
        ],
      },
      {
        heading: "Benefits After Joining",
        bullets: [
          "Financial Growth: Earn commissions and bonus incentives based on sales performance.",
          "Skill Development: Improve your sales and marketing skills through training and experience.",
          "Networking Opportunities: Build valuable community and professional relationships.",
          "Be Your Own Boss: Work independently with flexible hours.",
        ],
        paragraphs: [
          "By joining the Aurona Sales Partner Program, you're taking the first step toward building a rewarding career in lighting and home appliances while representing a trusted brand.",
        ],
      },
    ],
  },

  "reseller partner program": {
    subtitle: "Empowering Businesses to Thrive",
    intro:
      "The Aurona Reseller Partner Program is an opportunity for entrepreneurs, retailers, electrical contractors, and e-commerce businesses to sell Aurona's premium LED lighting and home appliance products through offline or online channels.",
    partnerChoices: ["Offline Reseller", "Online Reseller"],
    sections: [
      {
        heading: "About the Program",
        paragraphs: [
          "Aurona's Reseller Partner Program enables business partners to sell premium lighting and home appliance products through two tailored participation options: Offline Reseller and Online Reseller.",
          "The program offers discounts, marketing support, operational assistance, and growth rewards.",
        ],
      },
      {
        heading: "Offline Reseller Program",
        paragraphs: [
          "Designed for local distributors and retail partners who want to bring Aurona products to their community through physical stores, showrooms, or local business networks.",
        ],
        bullets: [
          "Exclusive regional sales opportunities.",
          "Seasonal sales campaigns and product bundles.",
          "Tiered pricing and dealer discounts.",
          "In-store marketing and promotional support.",
          "Growth rewards for strong sales performance.",
          "Operational assistance.",
        ],
      },
      {
        heading: "Online Reseller Program",
        paragraphs: [
          "Designed for online sellers who want to sell Aurona products through e-commerce platforms or their own websites.",
        ],
        bullets: [
          "No geographical boundaries.",
          "Seasonal campaigns and exclusive product bundles.",
          "Competitive tiered pricing.",
          "Digital marketing assistance.",
          "Reseller-exclusive promotions.",
          "Operational and e-commerce support.",
        ],
      },
      {
        heading: "Eligibility Criteria",
        subsections: [
          {
            heading: "Offline Resellers",
            bullets: [
              "Retailer, distributor, electrical contractor, or interior designer with local market knowledge.",
              "Physical retail store/showroom or ability to collaborate with local businesses.",
              "Ability to manage inventory and deliveries.",
              "Basic sales and customer-management knowledge.",
            ],
          },
          {
            heading: "Online Resellers",
            bullets: [
              "Operate an online store or marketplace account.",
              "Ability to promote products through digital channels.",
              "Follow Aurona branding guidelines.",
              "Customer service and online order-management capability.",
            ],
          },
        ],
      },
      {
        heading: "Terms & Conditions",
        bullets: [
          "Resellers must sell only authentic Aurona products.",
          "Pricing and promotions must follow Aurona policies.",
          "Special discounts and rewards may depend on purchase volume.",
          "Aurona-provided marketing materials must be used responsibly.",
          "Partners must comply with applicable tax and consumer-protection laws.",
        ],
      },
      {
        heading: "How to Join",
        bullets: [
          "Complete the application form below.",
          "Submit the required details.",
          "Await confirmation and onboarding from the Aurona team.",
        ],
      },
      {
        heading: "Benefits of Joining the Program",
        bullets: [
          "Premium Aurona products.",
          "Exclusive discounts and tiered pricing.",
          "Marketing and operational support.",
          "Rewards for growth and bulk purchases.",
          "Flexible offline and online participation options.",
        ],
      },
    ],
  },

  "loyalty program for partners": {
    subtitle: "Rewarding Excellence in Sales Performance",
    partnerChoices: ["Sales Team", "Distributor", "Reseller"],
    sections: [
      {
        heading: "About the Program",
        paragraphs: [
          "The Aurona Loyalty Program for Partners is designed to recognize and reward the exceptional efforts of our sales team, distributors, and resellers. This points-based program encourages sustained high performance while offering exclusive rewards such as products, cash bonuses, early product previews, and public recognition.",
        ],
      },
      {
        heading: "Key Features of the Program",
        bullets: [
          "Points-Based System: Earn loyalty points for every sale, referral, or milestone.",
          "Seasonal Bonuses: Additional points during special campaigns and festive sales drives.",
          "Redeemable Rewards: Exchange points for Aurona products, cash rewards, or account credits.",
          "Exclusive Previews: Early access to new product launches and exclusive events.",
          "Leaderboards & Recognition: Recognition through leaderboards, trophies, certificates, and newsletters.",
          "Referral Incentives: Bonus points for referring new customers or partners.",
          "Annual Appreciation Event: Invitations for top performers.",
        ],
      },
      {
        heading: "Eligibility Criteria",
        subsections: [
          {
            heading: "For Sales Team",
            bullets: [
              "Must be an active member of Aurona's sales team.",
              "Must consistently meet or exceed sales targets.",
            ],
          },
          {
            heading: "For Distributors & Resellers",
            bullets: [
              "Must have an active partnership agreement with Aurona.",
              "Must meet applicable monthly sales thresholds.",
              "Can earn bonus points through referrals and seasonal promotions.",
            ],
          },
        ],
      },
      {
        heading: "Working Plan",
        subsections: [
          {
            heading: "Program Overview",
            paragraphs: [
              "Partners earn points through sales achievements, referrals, and campaign participation. Points can be redeemed for available rewards.",
            ],
          },
          {
            heading: "Earning Points",
            bullets: [
              "Sales achievements based on product value and category.",
              "Bonus opportunities through campaigns and milestones.",
              "Referral points for introducing new customers or partners.",
            ],
          },
          {
            heading: "Redeeming Points",
            bullets: [
              "Redeem points for Aurona products.",
              "Convert eligible points into cash rewards or account credits.",
              "Earn certificates, trophies, and recognition.",
            ],
          },
        ],
      },
      {
        heading: "Onboarding Process",
        bullets: [
          "Existing eligible sales team members, distributors, and resellers can be enrolled.",
          "New partners receive program guidelines and orientation.",
          "Eligible partners can access their points, progress, and rewards.",
          "Support is available to help partners understand and use the program.",
        ],
      },
      {
        heading: "Benefits After Joining",
        bullets: [
          "Financial rewards and product redemptions.",
          "Professional recognition.",
          "Early access to products and campaigns.",
          "Stronger long-term partnership with Aurona.",
        ],
      },
      {
        heading: "Terms & Conditions",
        bullets: [
          "Program cycles may be monthly, quarterly, or annual.",
          "Points are awarded only for completed qualifying sales.",
          "Minimum thresholds may apply to redemptions.",
          "Rewards are subject to availability.",
          "Participants must follow ethical and compliant business practices.",
          "Aurona may modify program terms with appropriate notice.",
        ],
      },
      {
        heading: "Why Partner with Aurona?",
        bullets: [
          "Trusted lighting and home-appliance brand.",
          "Performance-based growth incentives.",
          "Transparent rewards and partner support.",
        ],
      },
    ],
  },

  "online distributor program": {
    subtitle: "Unlock Your Potential in E-Commerce",
    partnerChoices: ["Online Distributor"],
    sections: [
      {
        heading: "About the Program",
        paragraphs: [
          "The Aurona Online Distributor Program offers entrepreneurs and online sellers an opportunity to expand their businesses by selling LED lighting and home appliances online. Partners can access wholesale pricing, marketing support, and training while selling through their own stores or major online marketplaces.",
        ],
      },
      {
        heading: "Key Features of the Program",
        bullets: [
          "Wholesale pricing for stronger margins.",
          "Training on e-commerce, digital marketing, and platform optimization.",
          "Performance-based rewards and incentives.",
          "Wide product selection across lighting and appliances.",
          "Flexible selling through marketplaces or your own store.",
          "Marketing support with product assets and promotional materials.",
          "Dedicated account support.",
          "Drop-shipping option where available.",
        ],
      },
      {
        heading: "Eligibility Criteria",
        bullets: [
          "Entrepreneurs looking to start or expand an e-commerce business.",
          "Existing online sellers seeking additional product categories.",
          "Basic e-commerce knowledge is preferred.",
          "Applicants must meet the applicable age and business requirements.",
        ],
      },
      {
        heading: "Working Plan",
        subsections: [
          { heading: "Sign-Up Process", paragraphs: ["Submit your application to get started."] },
          {
            heading: "Product Selection",
            paragraphs: ["Choose products from the Aurona catalogue for your target market."],
          },
          {
            heading: "Setup Assistance",
            paragraphs: ["Receive guidance for store setup or marketplace listing optimization."],
          },
          {
            heading: "Sales Operations",
            paragraphs: ["Start selling Aurona products through approved online channels."],
          },
          {
            heading: "Performance Monitoring",
            paragraphs: ["Review results and improve your sales strategy over time."],
          },
        ],
      },
      {
        heading: "Onboarding Process",
        bullets: [
          "Application approval and business verification.",
          "Program orientation.",
          "Access to product and marketing resources.",
          "Account/store setup support.",
          "Launch and ongoing assistance.",
        ],
      },
      {
        heading: "How to Join",
        bullets: [
          "Fill out the application below.",
          "Submit required business details and documents.",
          "Complete approval and onboarding.",
          "Start selling after activation.",
        ],
      },
      {
        heading: "Benefits After Joining",
        bullets: [
          "Optional low-inventory/drop-shipping model where available.",
          "Use Aurona's brand recognition.",
          "Wholesale pricing and performance incentives.",
          "Training and marketing support.",
          "Early access to selected products and promotions.",
        ],
      },
      {
        heading: "Terms & Conditions",
        bullets: [
          "Products must be sold through legitimate channels.",
          "Partners must accurately represent Aurona products.",
          "Payment and shipping terms depend on the applicable agreement.",
          "Incentives depend on qualifying performance.",
          "Aurona may terminate participation for breaches or unethical practices.",
        ],
      },
    ],
  },

  "affiliate marketing program": {
    subtitle: "Earn Money by Promoting Premium LED Lighting & Home Appliances",
    partnerChoices: ["Affiliate"],
    sections: [
      {
        heading: "About the Program",
        paragraphs: [
          "The Aurona Affiliate Marketing Program invites individuals, influencers, and bloggers to promote Aurona's LED lighting and home-appliance products. Approved affiliates can use referral links and earn commissions on qualifying sales.",
        ],
      },
      {
        heading: "Key Features of the Program",
        bullets: [
          "Flexible promotional schedule.",
          "Performance-based rewards and incentives.",
          "Product catalogues, training, and marketing materials.",
          "Competitive commissions on qualifying referral sales.",
          "Tracking of clicks, conversions, and earnings where available.",
          "Possible free or discounted promotional products.",
          "Contests and partner campaigns.",
          "Long-term partnership opportunities for strong performers.",
        ],
      },
      {
        heading: "Eligibility Criteria",
        bullets: [
          "Applicants must meet applicable age requirements.",
          "Suitable for influencers, bloggers, creators, or individuals with an engaged network.",
          "Active and authentic audience engagement is preferred.",
          "Applicants must follow applicable tax and advertising requirements.",
          "Accurate application and business details are required.",
        ],
      },
      {
        heading: "Working Plan",
        bullets: [
          "Promote approved Aurona products using your affiliate resources.",
          "Use your unique referral link where provided.",
          "Earn commissions on qualifying sales.",
          "Use approved marketing material and follow Aurona brand guidelines.",
        ],
      },
      {
        heading: "Onboarding Process",
        bullets: [
          "Submit your application.",
          "Aurona reviews your profile and suitability.",
          "Approved affiliates receive program details, marketing resources, and referral information.",
        ],
      },
      {
        heading: "How to Join",
        bullets: [
          "Complete the application below.",
          "Wait for review and confirmation.",
          "Start promoting after approval and activation.",
        ],
      },
      {
        heading: "Benefits After Joining",
        bullets: [
          "Earn commissions on qualifying referral sales.",
          "Access selected discounts, offers, and promotions.",
          "Possible product-review opportunities.",
          "Performance rewards and recognition.",
          "Partner support to help improve results.",
        ],
      },
      {
        heading: "Terms & Conditions",
        bullets: [
          "Referral links and promotions must be used ethically.",
          "Marketing materials must follow Aurona guidelines.",
          "Commissions apply only to qualifying successful sales.",
          "Payout rules and thresholds may apply.",
          "Affiliate disclosures and advertising laws must be followed.",
          "Confidential program information must be protected.",
        ],
      },
    ],
  },

  "custom solutions partnership program": {
    subtitle: "Tailored Lighting & Appliance Solutions for Your Projects",
    partnerChoices: ["Custom Solutions"],
    sections: [
      {
        heading: "About the Program",
        paragraphs: [
          "The Aurona Custom Solutions Partnership Program is designed for hotels, offices, interior design firms, construction companies, and other businesses requiring tailored lighting or appliance solutions for larger projects.",
        ],
      },
      {
        heading: "Key Features of the Program",
        bullets: [
          "Tailored lighting and appliance recommendations.",
          "Volume-based discounts.",
          "Dedicated consultation and project support.",
          "Co-branding opportunities where agreed.",
          "After-sales service and ongoing support.",
        ],
      },
      {
        heading: "Eligibility Criteria",
        bullets: [
          "Open to eligible businesses requiring bulk or project-based solutions.",
          "Project requirements should be suitable for custom or volume-based supply.",
          "Partners should collaborate with Aurona teams on specifications, timelines, and quality requirements.",
        ],
      },
      {
        heading: "Working Plan",
        subsections: [
          {
            heading: "Program Introduction",
            paragraphs: ["Aurona works with your team to understand project needs and recommend suitable solutions."],
          },
          { heading: "Volume Discounts", paragraphs: ["Project pricing can scale with order size and requirements."] },
          {
            heading: "Design & Installation Support",
            paragraphs: ["Consultation and implementation support can be coordinated for eligible projects."],
          },
          { heading: "Co-Branding Opportunities", paragraphs: ["Co-branding may be available where mutually agreed."] },
          {
            heading: "Post-Project Support",
            paragraphs: ["After-sales support, maintenance, and upgrade assistance may be available."],
          },
        ],
      },
      {
        heading: "Onboarding Process",
        bullets: [
          "Initial inquiry and project discussion.",
          "Needs assessment.",
          "Proposal and pricing review.",
          "Partnership/project agreement.",
          "Execution and support.",
        ],
      },
      {
        heading: "How to Join",
        bullets: [
          "Submit the application below.",
          "Provide your business and project details.",
          "Schedule a consultation with the Aurona team.",
        ],
      },
      {
        heading: "Benefits After Joining",
        bullets: [
          "Project-based cost savings.",
          "Customized product solutions.",
          "Expert collaboration.",
          "Potential co-branding opportunities.",
          "Long-term support.",
        ],
      },
      {
        heading: "Terms & Conditions",
        bullets: [
          "Eligibility depends on project type and scale.",
          "Discounts depend on project requirements and order volume.",
          "Co-branding must follow mutually agreed guidelines.",
          "Installation and expedited services may have separate terms.",
          "Warranty and support follow applicable product/project terms.",
          "Project information may be treated as confidential.",
        ],
      },
    ],
  },
};

function normalizeTitle(value?: string | null) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

async function toBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buf.length; i += 8192) {
    binary += String.fromCharCode(...buf.subarray(i, i + 8192));
  }
  return btoa(binary);
}

function PartnerProgramPage() {
  const { id } = Route.useParams();
  const { data: jobs = [], isLoading } = useQuery(careersQuery);
  const programs = jobs.filter((j) => j.kind !== "job");
  const program = programs.find((p) => p.id === id);

  const [partnerType, setPartnerType] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = useServerFn(submitCareerApplication);

  useEffect(() => {
    if (program?.title) setPartnerType(program.title);
  }, [program?.title]);

  const titleKey = normalizeTitle(program?.title);
  const content = useMemo(() => {
    if (PROGRAM_CONTENT[titleKey]) return PROGRAM_CONTENT[titleKey];

    if (titleKey.includes("sales partner")) return PROGRAM_CONTENT["sales partner program"];
    if (titleKey.includes("reseller")) return PROGRAM_CONTENT["reseller partner program"];
    if (titleKey.includes("loyalty")) return PROGRAM_CONTENT["loyalty program for partners"];
    if (titleKey.includes("online distributor") || titleKey.includes("distributor")) {
      return PROGRAM_CONTENT["online distributor program"];
    }
    if (titleKey.includes("affiliate")) return PROGRAM_CONTENT["affiliate marketing program"];
    if (titleKey.includes("custom solution")) return PROGRAM_CONTENT["custom solutions partnership program"];

    return null;
  }, [titleKey]);

  const selectedType = partnerType || program?.title || "";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const parsed = schema.safeParse({
      full_name: String(fd.get("full_name") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? "").replace(/^\+?91/, ""),
      address: String(fd.get("address") ?? ""),
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }

    if (!selectedType) {
      toast.error("Please choose a partner type");
      return;
    }

    if (!consent) {
      toast.error("Please accept the declaration to submit your application.");
      return;
    }

    if (resume && resume.size > MAX_RESUME_BYTES) {
      toast.error("Resume must be 3 MB or smaller.");
      return;
    }

    setBusy(true);
    try {
      const v = parsed.data;
      await submit({
        data: {
          program_id: /^[0-9a-f-]{36}$/i.test(id) ? id : null,
          program_title: selectedType,
          full_name: v.full_name,
          email: v.email,
          phone: v.phone,
          message: `Address: ${v.address}`,
          consent: true,
          resume_file: resume
            ? {
                name: resume.name,
                type: resume.type,
                data: await toBase64(resume),
              }
            : null,
        },
      });

      toast.success("Application received — our team will get in touch shortly.");
      form.reset();
      setResume(null);
      setConsent(false);
      setPartnerType(program?.title ?? "");
    } catch {
      toast.error("Could not submit your application. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!isLoading && !program) {
    return (
      <div className="container-x py-16">
        <Link
          to="/careers"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to careers
        </Link>

        <div className="mt-8 rounded-2xl border border-border bg-card p-8">
          <h1 className="text-2xl font-semibold">Program not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This partner program is unavailable or has been removed.</p>
        </div>
      </div>
    );
  }

  const partnerChoices = content?.partnerChoices?.length ? content.partnerChoices : programs.map((p) => p.title);

  return (
    <div className="container-x py-10 md:py-14">
      <Link
        to="/careers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to careers
      </Link>

      <div className="mt-6 border-b border-border pb-8">
        <div className="text-eyebrow">Business Partner Program</div>

        <h1 className="text-display mt-3 max-w-4xl text-4xl md:text-5xl">
          {program?.title ?? (isLoading ? "Loading…" : "Partner Program")}
        </h1>

        {content?.subtitle && <p className="mt-3 text-lg font-medium text-primary">{content.subtitle}</p>}

        {content?.intro && (
          <p className="mt-5 max-w-4xl text-sm leading-7 text-muted-foreground md:text-base">{content.intro}</p>
        )}
      </div>

      <div className="mt-8">
        {content ? (
          <div className="grid gap-6 md:grid-cols-2">
            {content.sections.map((section) => (
              <section
                key={section.heading}
                className="group rounded-2xl border-2 border-border/80 bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg md:p-7"
              >
                <h2 className="text-2xl font-semibold text-foreground">{section.heading}</h2>

                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="mt-4 text-sm leading-7 text-muted-foreground md:text-base">
                    {paragraph}
                  </p>
                ))}

                {section.bullets && (
                  <ul className="mt-4 list-disc space-y-2.5 pl-5 text-sm leading-7 text-muted-foreground md:text-base">
                    {section.bullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}

                {section.numbered && (
                  <ol className="mt-4 list-decimal space-y-2.5 pl-5 text-sm leading-7 text-muted-foreground md:text-base">
                    {section.numbered.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                )}

                {section.subsections?.map((sub) => (
                  <div key={sub.heading} className="mt-6">
                    <h3 className="text-lg font-semibold text-foreground">{sub.heading}</h3>

                    {sub.paragraphs?.map((paragraph) => (
                      <p key={paragraph} className="mt-2 text-sm leading-7 text-muted-foreground md:text-base">
                        {paragraph}
                      </p>
                    ))}

                    {sub.bullets && (
                      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground md:text-base">
                        {sub.bullets.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </section>
            ))}
          </div>
        ) : (
          <section className="rounded-2xl border-2 border-border/80 bg-card p-6 shadow-sm md:p-8">
            <h2 className="text-2xl font-semibold">About the Program</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground md:text-base">
              {(program as any)?.description ||
                (program as any)?.summary ||
                (program as any)?.extra_details ||
                "Full program details can be added from the program data/admin panel."}
            </p>
          </section>
        )}

        <section className="mt-8 rounded-2xl border-2 border-primary/20 bg-card p-6 shadow-md md:p-8">
          <div className="text-eyebrow">APPLICATION FORM</div>
          <h2 className="mt-2 text-2xl font-semibold">Join as Partner</h2>

          <p className="mt-2 text-sm text-muted-foreground">
            Fill in your details below and the Aurona partnerships team will review your application.
          </p>

          <form onSubmit={onSubmit} className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Name *</Label>
              <Input id="full_name" name="full_name" required maxLength={100} autoComplete="name" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" name="email" type="email" required maxLength={255} autoComplete="email" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input id="phone" name="phone" required inputMode="numeric" maxLength={13} placeholder="98XXXXXXXX" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="partner_type">Choose For Partner *</Label>
              <Select value={selectedType} onValueChange={setPartnerType}>
                <SelectTrigger id="partner_type">
                  <SelectValue placeholder="Select partner type" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {partnerChoices.map((choice) => (
                    <SelectItem key={choice} value={choice}>
                      {choice}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="address">Address *</Label>
              <Textarea id="address" name="address" required rows={4} maxLength={500} />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="resume_file">Resume (PDF/DOC/DOCX, max 3 MB)</Label>
              <Input
                id="resume_file"
                name="resume_file"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setResume(e.target.files?.[0] ?? null)}
              />
            </div>

            <label className="flex items-start gap-2 text-xs text-muted-foreground md:col-span-2">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
              <span>
                I confirm that the information provided is accurate and allow Aurona Lighting Industries to contact me
                regarding this application.
              </span>
            </label>

            <div className="md:col-span-2">
              <Button type="submit" className="w-full rounded-full sm:w-auto sm:px-12" disabled={busy}>
                {busy ? "Submitting…" : "Apply Now"}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
