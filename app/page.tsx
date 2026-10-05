import { Studio } from "@/components/studio/Studio";
import { StudioHeader } from "@/components/studio/StudioHeader";
import { SITE } from "@/lib/site";

const STEPS = [
  {
    title: "Pick a face",
    body: "Choose a classic SVG orc or a plush 3D orc. Pick its color, ears, eyes, mouth and tusks.",
  },
  {
    title: "Gear up",
    body: "Add a mohawk or braids, a horned helm, spiked crown or skull cap, war paint, scars, nose rings and earrings.",
  },
  {
    title: "Bring it to life",
    body: "Set body motion (breathe, bob, sway or hop) and eye motion (blink, wink, glance, look around, startle and more), then export.",
  },
];

const FAQ = [
  {
    q: "What do I get when I export?",
    a: "2D orcs export as SVG plus animation CSS. 3D furry orcs export as a transparent PNG portrait or a GLB model with fur and gear. GLB models do not include preview animations or studio lighting.",
  },
  {
    q: "Why doesn't my avatar move when I use it as an image?",
    a: "Browsers don't run CSS animations inside SVGs loaded through an <img> tag. Paste the SVG markup inline in your HTML (or use <object>) together with the CSS snippet, and it will animate.",
  },
  {
    q: "Do I need an account?",
    a: "No. Orc Dot runs entirely in your browser: there's no sign-up and nothing you make is uploaded anywhere.",
  },
  {
    q: "Does it respect reduced motion?",
    a: "Yes. The exported CSS stops animating for visitors who have reduced motion turned on, and the studio preview starts paused for them.",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE.name,
  url: SITE.url,
  description: SITE.description,
  applicationCategory: "DesignApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires a modern web browser with JavaScript enabled.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  image: `${SITE.url}/opengraph-image`,
};

export default function Page() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c"),
        }}
      />
      <StudioHeader />
      <main>
        <Studio />

        <section
          aria-labelledby="how-it-works"
          className="mx-auto max-w-6xl px-4 pt-6 pb-4"
        >
          <h2 id="how-it-works" className="text-2xl font-semibold tracking-tight">
            Make an orc avatar in three steps
          </h2>
          <ol className="mt-4 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-3xl border bg-card p-5 shadow-sm">
                <span className="font-heading text-sm font-semibold text-primary">
                  Step {i + 1}
                </span>
                <h3 className="mt-1 text-lg font-medium">{step.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="faq" className="mx-auto max-w-6xl px-4 py-8">
          <h2 id="faq" className="text-2xl font-semibold tracking-tight">
            Questions
          </h2>
          <div className="mt-4 divide-y rounded-3xl border bg-card shadow-sm">
            {FAQ.map((item) => (
              <details key={item.q} className="group p-5">
                <summary className="cursor-pointer list-none font-heading text-base font-medium marker:hidden">
                  <span className="mr-2 inline-block text-primary transition-transform group-open:rotate-90">
                    ›
                  </span>
                  {item.q}
                </summary>
                <p className="mt-2 pl-5 text-sm text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} {SITE.name}. Made for orcs everywhere.
        </div>
      </footer>
    </div>
  );
}
