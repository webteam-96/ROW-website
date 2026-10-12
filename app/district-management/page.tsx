import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import PageFx from "@/components/PageFx";
import { ArtCards, CardGrid, DemoButton, PageHero, Scribble, Section } from "@/components/kit";
import { Avatar, C, Card, Club, ICON, IconTile, Lines, Tick } from "@/components/art";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Rotary District Management Software | Roster On Wheels",
  description:
    "ROW helps Rotary districts manage the directory, committee, Assistant Governors, club monthly reports, projects, events, citation and district dues.",
};

/* Hero hub spokes: card labels from this page, fanned on an arc (--x) around the District Governor. */
const SPOKES: [string, string, string, ReactNode][] = [
  ["District Committee", "0", "azure", ICON.people],
  ["Assistant Governors", ".55", "marigold", ICON.badge],
  ["Club Monthly Reports", ".88", "mint", ICON.clipboard],
  ["District Projects", "1", "azure", ICON.heart],
  ["District Events", ".88", "mint", ICON.calendar],
  ["Announcements", ".55", "marigold", ICON.megaphone],
  ["District Dues Collection", "0", "azure", ICON.card],
];

/* ---------- Card pictures (text-free, the home page's card style) ---------- */

// Club Monthly Reports: clubs send their reports in, the district reviews them
const reportsArt = (
  <svg viewBox="0 0 320 200">
    <path d="M94 72c10 0 12 8 18 12M100 130c8 0 8-10 12-14" fill="none" stroke={C.ink} strokeWidth="2.2" strokeDasharray="2 6" strokeLinecap="round" opacity=".5" />
    <Card x={22} y={52} w={72} h={40}><Club x={20} y={20} r={10} /><Lines x={36} y={13} w={26} w2={16} /></Card>
    <Card x={28} y={110} w={72} h={40}><Club x={20} y={20} r={10} /><Lines x={36} y={13} w={24} w2={14} /></Card>
    <Card x={112} y={26} w={128} h={200} r={16}>
      <rect x="16" y="18" width="46" height="8" rx="4" fill={C.azure} />
      {[[56, C.azure, 60], [90, C.marigold, 50], [124, C.mint, 66]].map(([y, c, w]) => (
        <g key={y}>
          <Tick x={26} y={Number(y)} r={9} fill={String(c)} />
          <Lines x={42} y={Number(y) - 7} w={Number(w)} />
        </g>
      ))}
    </Card>
    <circle cx="246" cy="116" r="26" fill="#fff" fillOpacity=".4" stroke={C.ink} strokeWidth="5" />
    <path d="M265 135l18 18" stroke={C.ink} strokeWidth="8" strokeLinecap="round" />
  </svg>
);

// District Citation: a rosette, the criteria ticked off and the points filling up
const citationArt = (
  <svg viewBox="0 0 320 200">
    <path d="M84 118 70 168l14-8 9 14 11-48Z" fill={C.coral} />
    <path d="M116 118l14 50-14-8-9 14-11-48Z" fill={C.coral} />
    <circle cx="100" cy="94" r="40" fill={C.marigold} stroke="#fff" strokeWidth="6" />
    <circle cx="100" cy="94" r="27" fill="none" stroke="#fff" strokeWidth="3" opacity=".8" />
    <path d="M100 76 104.4 86.9 116.2 87.7 107.1 95.3 110 106.8 100 100.5 90 106.8 92.9 95.3 83.8 87.7 95.6 86.9Z" fill="#fff" />
    <Card x={164} y={42} w={130} h={120}>
      {[[24, C.mint, 66], [50, C.mint, 54], [76, C.lilac, 72]].map(([y, c, w]) => (
        <g key={y}>
          <Tick x={20} y={Number(y)} r={8} fill={String(c)} />
          <Lines x={34} y={Number(y) - 4} w={Number(w)} w2={0} />
        </g>
      ))}
      <rect x="14" y="98" width="102" height="10" rx="5" fill={C.cream2} />
      <rect x="14" y="98" width="72" height="10" rx="5" fill={C.marigold} />
    </Card>
  </svg>
);

// Reports: a dashboard of bars, a trend line and a share
const statsArt = (
  <svg viewBox="0 0 320 200">
    <Card x={40} y={28} w={240} h={200} r={16}>
      <Lines x={18} y={18} w={72} w2={46} />
      {[[22, 64, C.azure], [48, 92, C.mint], [74, 52, C.marigold], [100, 100, C.azure], [126, 78, C.mint]].map(([x, h, c]) => (
        <rect key={x} x={Number(x)} y={162 - Number(h)} width="18" height={Number(h)} rx="5" fill={String(c)} />
      ))}
      <path d="M31 112 57 84 83 122 109 70 135 96" fill="none" stroke={C.ink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {[[31, 112], [57, 84], [83, 122], [109, 70], [135, 96]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="4" fill="#fff" stroke={C.ink} strokeWidth="2.5" />)}
      <circle cx="196" cy="98" r="26" fill="none" stroke={C.cream2} strokeWidth="12" />
      <circle cx="196" cy="98" r="26" fill="none" stroke={C.azure} strokeWidth="12" strokeDasharray="98 66" transform="rotate(-90 196 98)" />
      <circle cx="196" cy="98" r="26" fill="none" stroke={C.marigold} strokeWidth="12" strokeDasharray="40 124" strokeDashoffset="-98" transform="rotate(-90 196 98)" />
      <rect x="170" y="140" width="52" height="6" rx="3" fill={C.ink} opacity=".2" />
    </Card>
  </svg>
);

// District Projects: the district's service projects, each with its progress, and a button to start a new one
const projectsArt = (
  <svg viewBox="0 0 320 200">
    <Card x={58} y={28} w={204} h={200} r={16}>
      <rect x="18" y="18" width="80" height="8" rx="4" fill={C.ink} opacity=".75" />
      {[[42, C.coral, ICON.heart, 116, 0.7], [86, C.sky, ICON.drop, 104, 0.45], [130, C.marigold, ICON.tree, 124, 0.85]].map(([y, c, icon, w, p], i) => (
        <g key={i}>
          <IconTile x={16} y={Number(y)} size={32} fill={String(c)} stroke={C.ink}>{icon}</IconTile>
          <rect x="58" y={Number(y) + 4} width={Number(w) - 34} height="7" rx="3.5" fill={C.ink} opacity=".75" />
          <rect x="58" y={Number(y) + 19} width={Number(w)} height="7" rx="3.5" fill={C.cream2} />
          <rect x="58" y={Number(y) + 19} width={Number(w) * Number(p)} height="7" rx="3.5" fill={C.azure} />
        </g>
      ))}
    </Card>
    <g transform="translate(262 36)">
      <circle r="20" fill={C.marigold} stroke="#fff" strokeWidth="5" />
      <path d="M0-8v16M-8 0h16" stroke={C.ink} strokeWidth="3.2" strokeLinecap="round" />
    </g>
  </svg>
);

// District Events: a calendar with the event's day marked, and the people coming
const eventsArt = (
  <svg viewBox="0 0 320 200">
    <Card x={78} y={30} w={164} h={152} r={16}>
      <path d="M0 16A16 16 0 0 1 16 0h132a16 16 0 0 1 16 16v20H0Z" fill={C.azure} />
      <rect x="40" y="-8" width="7" height="18" rx="3.5" fill={C.ink} />
      <rect x="117" y="-8" width="7" height="18" rx="3.5" fill={C.ink} />
      {Array.from({ length: 15 }, (_, i) => {
        const x = 16 + (i % 5) * 28;
        const y = 50 + Math.floor(i / 5) * 30;
        return i === 8 ? (
          <g key={i}>
            <rect x={x} y={y} width="20" height="20" rx="6" fill={C.azure} />
            <path d={`M${x + 5.5} ${y + 10.5}l3 3 6-6.5`} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ) : (
          <rect key={i} x={x} y={y} width="20" height="20" rx="6" fill={C.cream2} />
        );
      })}
    </Card>
    <Avatar x={238} y={170} r={16} fill={C.coral} glyph={C.ink} ring="#fff" />
    <Avatar x={262} y={176} r={16} fill={C.mint} ring="#fff" />
    <Avatar x={286} y={170} r={16} fill={C.lilac} glyph={C.ink} ring="#fff" />
  </svg>
);

/* Keeping the district informed: the three messages land on a phone, one after another (data-build, lib/row-fx.js).
   Text-free. */
const NOTES = [
  { y: 112, c: C.marigold, icon: ICON.calendar, w: 92 },
  { y: 182, c: C.coral, icon: ICON.megaphone, w: 80 },
  { y: 252, c: C.mint, icon: ICON.gift, w: 100 },
];
const informedArt = (
  <svg className={styles.informed} viewBox="0 0 340 380" aria-hidden="true" data-build>
    <circle cx="170" cy="190" r="170" fill="#fff" opacity=".1" />
    <rect x="80" y="14" width="180" height="352" rx="34" fill={C.ink} />
    <rect x="88" y="22" width="164" height="336" rx="27" fill={C.sky} />
    <rect x="140" y="32" width="60" height="14" rx="7" fill={C.ink} />
    <rect x="130" y="64" width="80" height="18" rx="9" fill="#fff" opacity=".9" />
    <rect x="148" y="88" width="44" height="6" rx="3" fill={C.ink} opacity=".25" />
    {NOTES.map((n, i) => (
      <g key={n.y} data-in={(0.3 + i * 0.35).toFixed(2)} data-in-move="40 0">
        <Card x={56} y={n.y} w={228} h={56} r={16}>
          <IconTile x={12} y={12} size={32} fill={n.c} stroke={n.c === C.mint ? "#fff" : C.ink}>{n.icon}</IconTile>
          <Lines x={56} y={16} w={n.w} w2={Math.round(n.w * 0.6)} />
          <path d="M196 28.5l3.5 3.5 7-7.5M203 32l7-7.5" fill="none" stroke={C.mint} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </Card>
      </g>
    ))}
  </svg>
);

/* District dues: receipts print one after another, each stamped paid, and the report bars rise
   (data-build, lib/row-fx.js). The only words are the doc's own: "online" and "offline". */
const TEETH = "l-10 8-10-8-10 8-10-8-10 8-10-8-10 8-10-8-10 8-10-8-10 8-10-8";
const RECEIPTS = [
  { x: 40, way: "online", w: 72 },
  { x: 160, way: "offline", w: 60 },
  { x: 280, way: "online", w: 80 },
];
const duesArt = (
  <div className={styles.dues}>
    <svg viewBox="0 0 440 410" aria-hidden="true" data-build>
      <defs>
        <clipPath id="dues-slot"><rect x="0" y="70" width="440" height="340" /></clipPath>
      </defs>
      <g clipPath="url(#dues-slot)">
        {RECEIPTS.map((r, i) => (
          <g key={r.x} transform={`translate(${r.x} 70)`}>
            <g data-in={(0.2 + i * 0.3).toFixed(2)} data-in-move="0 -190">
              <path d={`M0 0h120v170${TEETH}V0Z`} fill="#fff" />
              <Club x={22} y={28} r={10} />
              <Lines x={38} y={21} w={62} w2={40} />
              <path d="M12 56h96" stroke={C.ink} strokeOpacity=".2" strokeWidth="2" strokeDasharray="3 4" />
              <rect x="14" y="70" width={r.w} height="12" rx="6" fill={C.ink} opacity=".8" />
              <rect x="14" y="94" width="64" height="22" rx="11" fill={r.way === "online" ? C.sky : "#FDE7B8"} />
              <text className={styles.way} x="46" y="109">{r.way}</text>
              <rect x="14" y="130" width="44" height="6" rx="3" fill={C.ink} opacity=".2" />
            </g>
          </g>
        ))}
      </g>
      {RECEIPTS.map((r, i) => (
        <g key={r.x} transform={`translate(${r.x + 92} 206) rotate(-12)`}>
          <g data-in={(1.05 + i * 0.22).toFixed(2)}>
            <circle r="20" fill={C.mint} stroke="#fff" strokeWidth="4" />
            <path d="M-8 .5l5 5 11-11.5" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
      ))}
      <rect x="20" y="28" width="400" height="52" rx="22" fill="#2A3F5C" />
      <rect x="36" y="64" width="368" height="9" rx="4.5" fill="#0B1626" />
      <circle cx="396" cy="46" r="6" fill={C.marigold} />
      <rect x="40" y="40" width="70" height="10" rx="5" fill="#fff" opacity=".25" />
      <Card x={108} y={286} w={224} h={104} r={18}>
        <IconTile x={16} y={16} size={30} fill={C.marigold} stroke={C.ink}>{ICON.chart}</IconTile>
        <Lines x={56} y={20} w={70} w2={0} />
        {[18, 30, 24, 40, 34, 48].map((h, i) => (
          <g key={i} transform={`translate(${60 + i * 24} 92)`}>
            <rect data-in={(1.75 + i * 0.08).toFixed(2)} data-in-grow="" y={-h} width="14" height={h} rx="4" fill={i % 2 ? C.mint : C.azure} />
          </g>
        ))}
      </Card>
    </svg>
  </div>
);

export default function DistrictManagement() {
  return (
    <>
      <PageHero
        title={<>District management for District Governors and <Scribble>their teams</Scribble></>}
        intro="ROW lets the District Governor and the district team see and support every club from one place. Reports, projects, events, messages and dues are all together, so nothing gets lost in emails and spreadsheets."
        visual={
          /* The district hub scene (lib/row-fx.js: data-hub): threads run from the core and each spoke switches on. */
          <div className={`hub ${styles.heroHub}`} aria-hidden="true" data-hub>
            <svg className="hub__threads" data-hub-svg />
            <div className="hub__core" data-hub-core>
              <svg className="hub__mark" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="9.5" fill="none" stroke="#F7A81B" strokeWidth="4.5" />
              </svg>
              {" "}
              <span className="hub__name">District Governor</span>
            </div>
            <ul className="hub__clubs">
              {SPOKES.map(([label, x, c, icon]) => (
                <li key={label} className="club" style={{ "--x": x } as CSSProperties} data-c={c}>
                  <span className="club__dot"><svg viewBox="0 0 24 24">{icon}</svg></span>
                  <span className="club__text">
                    <span className="club__name">{label}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        }
      />

      <Section id="people-and-structure" title="People and structure">
        <CardGrid
          items={[
            "District Directory: see contact details for every member in the district",
            "District Committee: manage and update your District Committee members",
            "Assistant Governors: assign Assistant Governors to clubs for better coordination and support",
          ]}
        />
      </Section>

      <Section id="following-every-club" c="sky" title="Following every club">
        <ArtCards
          items={[
            { line: "Club Monthly Reports: review every club's monthly report to follow projects, meetings, Rotary Foundation contributions and membership changes", c: "lilac", art: reportsArt },
            { line: "District Citation: set the criteria for citation points so clubs can take part and earn points", c: "azure", art: citationArt },
            { line: "Reports: create detailed reports on district and club activity to support better decisions", c: "sky", art: statsArt },
          ]}
        />
      </Section>

      <Section id="projects-and-events" title="Projects and events">
        <ArtCards
          cols={2}
          items={[
            { line: "District Projects: create and manage all district projects in one place", c: "mint", art: projectsArt },
            { line: "District Events: create and manage district events", c: "marigold", art: eventsArt },
          ]}
        />
      </Section>

      <Section
        id="keeping-the-district-informed"
        c="marigold"
        title={<>Keeping the district <Scribble>informed</Scribble></>}
        aside={informedArt}
        className={styles.split}
      >
        <CardGrid
          icons={[ICON.calendar, ICON.megaphone, ICON.gift]}
          items={[
            "Event Notifications: tell members about upcoming district events through the app and WhatsApp",
            "Announcements: share important district news with all members through the app and WhatsApp",
            "Greetings: send personal birthday and anniversary wishes to district members automatically",
          ]}
        />
      </Section>

      <Section
        id="district-dues-and-website"
        className={styles.duesSection}
        title="District dues and website"
        aside={duesArt}
      >
        <CardGrid
          cols={2}
          items={[
            "District Dues Collection: collect district dues from clubs with automatic reminders and several payment methods, online or offline. Receipts are created automatically and reports update on their own",
            "District Website Management: update your district website's banners, advertisements, social media links and more",
          ]}
        />
        <div className={`hero__ctas ${styles.cta}`} data-reveal>
          <DemoButton />
        </div>
      </Section>
      <PageFx />
    </>
  );
}
