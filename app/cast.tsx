// An original cast of Columbia characters for the landing page lineup.
// Every character is built from simple parts so they share one drawing style.

type Hair = "messy" | "slick" | "curly" | "bun" | "long" | "buzz" | "beanie" | "mohawk" | "none";
type Top = "hoodie" | "vest" | "tee" | "sweater" | "jacket" | "scrubs";
type Eyes = "normal" | "tired" | "glasses" | "shades" | "wide" | "side";
type Mouth = "smile" | "flat" | "grin" | "o" | "smirk" | "wobbly";
type Prop = "coffee" | "phone" | "book" | "megaphone" | "stethoscope" | "lanyard" | "laptop" | "brush" | "none";

export type Person = {
  name: string;
  skin: string;
  hair: Hair;
  hairColor: string;
  top: Top;
  topColor: string;
  eyes: Eyes;
  mouth: Mouth;
  prop: Prop;
  lift?: number; // taller or shorter in the lineup
  dark?: boolean; // black top instead of white
};

const INK = "#141414";
const S = { stroke: INK, strokeWidth: 2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

function HairBack({ p }: { p: Person }) {
  if (p.hair === "long")
    return <path d="M30 70 Q28 20 70 22 Q112 20 110 70 L114 150 Q96 158 92 128 L48 128 Q44 158 26 150 Z" fill="#141414" {...S} />;
  if (p.hair === "curly")
    return (
      <g fill="#141414" {...S}>
        {[[38, 40], [56, 26], [76, 24], [96, 34], [108, 54], [32, 60], [110, 76], [30, 82]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="16" />
        ))}
      </g>
    );
  if (p.top === "hoodie") return <path d="M22 96 Q20 22 70 20 Q120 22 118 96 Q118 132 70 134 Q22 132 22 96 Z" fill={p.dark ? "#141414" : "#ffffff"} {...S} />;
  return null;
}

function HairFront({ p }: { p: Person }) {
  const c = "#141414";
  switch (p.hair) {
    case "messy":
      return <path d="M34 58 L36 34 L46 44 L52 24 L62 38 L72 20 L80 36 L92 24 L94 42 L106 36 L106 60 Q70 46 34 58 Z" fill={c} {...S} />;
    case "slick":
      return <path d="M34 62 Q32 26 72 26 Q108 26 106 58 Q90 40 62 44 Q46 46 34 62 Z" fill={c} {...S} />;
    case "bun":
      return (
        <g fill={c} {...S}>
          <circle cx="70" cy="18" r="15" />
          <path d="M34 60 Q34 28 70 28 Q106 28 106 60 Q88 44 70 44 Q52 44 34 60 Z" />
          <path d="M80 6 L92 -6" stroke="#141414" strokeWidth="5" />
        </g>
      );
    case "long":
      return <path d="M34 62 Q36 30 70 30 Q104 30 106 62 Q92 44 72 50 Q52 44 34 62 Z" fill={c} {...S} />;
    case "buzz":
      return <path d="M36 52 Q40 30 70 30 Q100 30 104 52 Q70 40 36 52 Z" fill={c} {...S} />;
    case "beanie":
      return (
        <g {...S}>
          <path d="M32 58 Q32 18 70 18 Q108 18 108 58 Z" fill={c} />
          <rect x="28" y="50" width="84" height="14" rx="6" fill={c} />
          <circle cx="70" cy="14" r="8" fill="#fff" />
        </g>
      );
    case "mohawk":
      return <path d="M60 38 L54 6 L66 18 L70 0 L76 18 L88 6 L82 38 Z" fill={c} {...S} />;
    default:
      return null;
  }
}

function Face({ p }: { p: Person }) {
  const eyes = (() => {
    switch (p.eyes) {
      case "glasses":
        return (
          <g {...S} fill="#fff">
            <circle cx="56" cy="74" r="11" />
            <circle cx="86" cy="74" r="11" />
            <path d="M67 74 h8" fill="none" />
            <circle cx="57" cy="75" r="3.5" fill={INK} stroke="none" />
            <circle cx="87" cy="75" r="3.5" fill={INK} stroke="none" />
          </g>
        );
      case "shades":
        return (
          <g fill={INK}>
            <rect x="42" y="66" width="26" height="15" rx="5" />
            <rect x="74" y="66" width="26" height="15" rx="5" />
            <rect x="66" y="70" width="10" height="4" />
          </g>
        );
      case "tired":
        return (
          <g>
            <circle cx="56" cy="74" r="8" fill="#fff" {...S} />
            <circle cx="86" cy="74" r="8" fill="#fff" {...S} />
            <path d="M48 72 h16 M78 72 h16" {...S} />
            <circle cx="56" cy="77" r="3" fill={INK} />
            <circle cx="86" cy="77" r="3" fill={INK} />
            <path d="M48 86 q8 5 16 0 M78 86 q8 5 16 0" fill="none" stroke="#141414" strokeWidth="3" />
          </g>
        );
      case "wide":
        return (
          <g>
            <circle cx="55" cy="72" r="11" fill="#fff" {...S} />
            <circle cx="87" cy="72" r="11" fill="#fff" {...S} />
            <circle cx="55" cy="72" r="4" fill={INK} />
            <circle cx="87" cy="72" r="4" fill={INK} />
          </g>
        );
      case "side":
        return (
          <g>
            <circle cx="56" cy="74" r="8" fill="#fff" {...S} />
            <circle cx="86" cy="74" r="8" fill="#fff" {...S} />
            <circle cx="61" cy="75" r="3.5" fill={INK} />
            <circle cx="91" cy="75" r="3.5" fill={INK} />
            <path d="M47 64 l16 3 M95 64 l-16 3" {...S} />
          </g>
        );
      default:
        return (
          <g>
            <circle cx="56" cy="74" r="8" fill="#fff" {...S} />
            <circle cx="86" cy="74" r="8" fill="#fff" {...S} />
            <circle cx="57" cy="75" r="3.5" fill={INK} />
            <circle cx="87" cy="75" r="3.5" fill={INK} />
          </g>
        );
    }
  })();
  const mouth = (() => {
    switch (p.mouth) {
      case "grin":
        return <path d="M54 98 Q71 116 88 98 Z" fill="#fff" {...S} />;
      case "o":
        return <ellipse cx="71" cy="102" rx="7" ry="9" fill="#ffffff" {...S} />;
      case "flat":
        return <path d="M60 102 h22" {...S} />;
      case "smirk":
        return <path d="M58 102 Q74 104 86 94" fill="none" {...S} />;
      case "wobbly":
        return <path d="M56 104 q5 -5 10 0 t10 0 t10 0" fill="none" {...S} />;
      default:
        return <path d="M58 98 Q71 110 84 98" fill="none" {...S} />;
    }
  })();
  return (
    <g>
      {eyes}
      <path d="M70 80 q-5 10 2 12" fill="none" {...S} strokeWidth="3" />
      {mouth}
    </g>
  );
}

function Torso({ p }: { p: Person }) {
  const body = "M14 460 L16 176 Q18 134 70 132 Q122 134 124 176 L126 460 Z";
  return (
    <g>
      <path d={body} fill={p.dark ? "#141414" : "#ffffff"} {...S} />
      {p.top === "vest" && (
        <g {...S}>
          <path d="M52 134 L70 190 L88 134 Z" fill="#fff" />
          <path d="M70 190 V460" />
          <path d="M40 150 L40 460 M100 150 L100 460" strokeWidth="2.5" />
        </g>
      )}
      {p.top === "hoodie" && (
        <g {...S}>
          <path d="M58 140 v30 M82 140 v30" />
          <path d="M44 236 h52 v40 h-52 z" fill="none" strokeWidth="2.5" />
        </g>
      )}
      {p.top === "jacket" && (
        <g {...S}>
          <path d="M70 134 V460" />
          <path d="M56 134 L64 168 L70 140 L76 168 L84 134" fill="#fff" />
          <circle cx="58" cy="210" r="5" fill="#ffffff" />
        </g>
      )}
      {p.top === "sweater" && <path d="M18 200 h104 M18 214 h104" stroke="#fff" strokeWidth="5" opacity=".8" />}
      {p.top === "tee" && (
        <text x="70" y="208" textAnchor="middle" fontSize="18" fontWeight="900" fill={INK} fontFamily="Arial">
          NYC
        </text>
      )}
      {p.top === "scrubs" && <path d="M54 134 L70 162 L86 134" fill="none" {...S} />}
    </g>
  );
}

function Hands({ skin, children }: { skin: string; children?: React.ReactNode }) {
  return (
    <g>
      {children}
      <circle cx="44" cy="232" r="11" fill="#ffffff" {...S} />
      <circle cx="98" cy="232" r="11" fill="#ffffff" {...S} />
    </g>
  );
}

function PropItem({ p }: { p: Person }) {
  switch (p.prop) {
    case "coffee":
      return (
        <Hands skin={p.skin}>
          <path d="M84 198 h30 l-4 44 h-22 z" fill="#ffffff" {...S} />
          <rect x="85" y="214" width="28" height="12" fill="#ffffff" {...S} strokeWidth="2.5" />
        </Hands>
      );
    case "phone":
      return (
        <Hands skin={p.skin}>
          <rect x="54" y="196" width="34" height="54" rx="6" fill={INK} />
          <rect x="58" y="202" width="26" height="40" rx="3" fill="#ffffff" />
        </Hands>
      );
    case "book":
      return (
        <Hands skin={p.skin}>
          <path d="M36 204 h70 v40 h-70 z" fill="#ffffff" {...S} />
          <text x="71" y="229" textAnchor="middle" fontSize="12" fontWeight="900" fill="#fff" fontFamily="Arial">KANT</text>
        </Hands>
      );
    case "megaphone":
      return (
        <Hands skin={p.skin}>
          <path d="M60 220 L110 196 L110 256 L60 236 Z" fill="#ffffff" {...S} />
          <rect x="48" y="220" width="14" height="18" fill="#fff" {...S} />
        </Hands>
      );
    case "stethoscope":
      return (
        <g>
          <path d="M50 136 Q48 200 70 206 Q92 200 90 136" fill="none" stroke="#141414" strokeWidth="4" />
          <circle cx="70" cy="210" r="9" fill="#ffffff" {...S} />
        </g>
      );
    case "lanyard":
      return (
        <g>
          <path d="M54 136 L70 196 L86 136" fill="none" stroke="#141414" strokeWidth="5" />
          <rect x="56" y="194" width="28" height="36" rx="3" fill="#fff" {...S} />
          <path d="M62 222 h16" stroke="#141414" strokeWidth="3" />
        </g>
      );
    case "laptop":
      return (
        <Hands skin={p.skin}>
          <rect x="30" y="204" width="82" height="50" rx="5" fill="#ffffff" {...S} />
          <circle cx="71" cy="229" r="7" fill="#fff" {...S} strokeWidth="2" />
        </Hands>
      );
    case "brush":
      return (
        <Hands skin={p.skin}>
          <path d="M96 232 L112 180" stroke="#141414" strokeWidth="6" strokeLinecap="round" />
          <path d="M108 186 l10 -16 l4 4 z" fill="#ffffff" {...S} strokeWidth="2" />
          <circle cx="40" cy="190" r="6" fill="#ffffff" />
          <circle cx="104" cy="170" r="5" fill="#ffffff" />
        </Hands>
      );
    default:
      return null;
  }
}

export function Character({ p }: { p: Person }) {
  return (
    <svg viewBox="-6 -10 152 310" className="h-full w-full overflow-visible" role="img" aria-label={p.name} filter="url(#sketch)">
      <HairBack p={p} />
      <rect x="58" y="112" width="26" height="26" fill="#ffffff" {...S} />
      <Torso p={p} />
      <circle cx="34" cy="78" r="9" fill="#ffffff" {...S} />
      <circle cx="106" cy="78" r="9" fill="#ffffff" {...S} />
      <rect x="34" y="30" width="72" height="92" rx="34" fill="#ffffff" {...S} />
      <HairFront p={p} />
      <Face p={p} />
      <PropItem p={p} />
    </svg>
  );
}

export function Pigeon() {
  return (
    <svg viewBox="0 0 180 200" className="h-full w-full overflow-visible" role="img" aria-label="The campus pigeon" filter="url(#sketch)">
      <ellipse cx="96" cy="150" rx="70" ry="54" fill="#ffffff" {...S} />
      <path d="M30 150 L0 128 L8 170 Z" fill="#ffffff" {...S} />
      <path d="M80 140 q30 -14 56 6 q-26 18 -56 -6 z" fill="#ffffff" {...S} />
      <circle cx="132" cy="70" r="34" fill="#ffffff" {...S} />
      <path d="M108 96 q24 14 48 0" stroke="#141414" strokeWidth="8" fill="none" />
      <path d="M150 62 l26 8 l-26 8 z" fill="#ffffff" {...S} />
      <circle cx="140" cy="60" r="7" fill="#fff" {...S} />
      <circle cx="142" cy="60" r="3" fill={INK} />
      <path d="M96 86 q-12 -10 -4 -22" stroke="#141414" strokeWidth="4" fill="none" />
    </svg>
  );
}

export const CAST: Person[] = [
  { name: "The all-nighter", skin: "#7fb8e8", hair: "messy", hairColor: "#5a3a22", top: "hoodie", topColor: "#a77de0", eyes: "tired", mouth: "wobbly", prop: "coffee", lift: 6 },
  { name: "The finance bro", skin: "#f2a56b", hair: "slick", hairColor: "#2b1d12", top: "vest", topColor: "#3a4a6b", eyes: "shades", mouth: "smirk", prop: "phone", lift: 14 },
  { name: "The Lit Hum philosopher", skin: "#c39be8", hair: "curly", hairColor: "#7a4fa8", top: "sweater", topColor: "#3bb3a0", eyes: "glasses", mouth: "o", prop: "book", lift: 2 },
  { name: "The Sidechat lurker", skin: "#9ad47a", hair: "none", hairColor: "#000", top: "hoodie", topColor: "#141414", eyes: "side", mouth: "smirk", prop: "phone", lift: 10 },
  { name: "The club fair recruiter", skin: "#e88fa3", hair: "mohawk", hairColor: "#4c7fd6", top: "sweater", topColor: "#f08a4b", eyes: "wide", mouth: "grin", prop: "megaphone", lift: 18 },
  { name: "The engineer", skin: "#6fd6b8", hair: "buzz", hairColor: "#141414", top: "jacket", topColor: "#4c7fd6", eyes: "glasses", mouth: "flat", prop: "laptop", lift: 0 },
  { name: "The pre-med", skin: "#f2a56b", hair: "bun", hairColor: "#141414", top: "scrubs", topColor: "#6fd6b8", eyes: "tired", mouth: "flat", prop: "stethoscope", lift: 12 },
  { name: "The Barnard artist", skin: "#7fb8e8", hair: "long", hairColor: "#f08fb0", top: "tee", topColor: "#141414", eyes: "normal", mouth: "smile", prop: "brush", lift: 4 },
  { name: "The TA", skin: "#c39be8", hair: "beanie", hairColor: "#e05a5a", top: "jacket", topColor: "#fffaf0", eyes: "glasses", mouth: "smirk", prop: "lanyard", lift: 16 },
];
