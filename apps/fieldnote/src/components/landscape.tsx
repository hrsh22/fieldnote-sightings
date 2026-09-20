export function Landscape() {
  return (
    <svg
      viewBox="0 0 600 300"
      role="img"
      aria-label="Illustration of a kingfisher above a quiet wetland"
      className="landscape"
    >
      <defs>
        <linearGradient id="sky" x2="0" y2="1">
          <stop stopColor="#e7eadb" />
          <stop offset="1" stopColor="#f3eedf" />
        </linearGradient>
        <linearGradient id="water" x2="0" y2="1">
          <stop stopColor="#c9d2bd" />
          <stop offset="1" stopColor="#e8e7d5" />
        </linearGradient>
      </defs>
      <rect width="600" height="300" fill="url(#sky)" />
      <circle cx="445" cy="82" r="43" fill="#ead8a2" />
      <path d="M0 169Q87 109 169 151T340 156T600 132V300H0" fill="#adbba2" />
      <path d="M0 186Q126 128 239 170T600 152V300H0" fill="#7f977e" />
      <path d="M0 202Q173 171 293 198T600 179V300H0" fill="url(#water)" />
      <path
        d="M152 228H359M187 242H437M330 257H535M74 274H299"
        stroke="#f6f4e6"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <g fill="none" stroke="#486a4d" strokeWidth="3">
        <path d="M22 300q30-95 19-144M47 300q17-56 48-92M573 300q-4-52-25-90M584 300q-9-100 7-130" />
        <path d="M39 231q-28-31-35-20M43 211q25-41 29-18M573 250q-29-18-30-9" />
      </g>
      <path
        d="M43 155v25M95 204v24M591 165v29"
        stroke="#6e563b"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M295 180q51-16 88-48"
        stroke="#5a513c"
        strokeWidth="5"
        fill="none"
      />
      <g transform="translate(342 106) rotate(-12)">
        <path d="M-11 34l-5 23 27-25" fill="#295b65" />
        <ellipse cx="9" cy="15" rx="22" ry="29" fill="#c08142" />
        <path d="M0-10q-24 6-15 43l30-9q10-24-15-34" fill="#346a70" />
        <circle cx="13" cy="-9" r="15" fill="#346a70" />
        <path d="M25-15l35 10-33 1" fill="#38423c" />
        <path d="M9-1q12 8 18 1" fill="none" stroke="#f0e6ca" strokeWidth="6" />
        <circle cx="18" cy="-12" r="3" fill="#172b28" />
        <path d="M6 40l-2 10m11-10l-2 8" stroke="#754b36" strokeWidth="2" />
      </g>
      <g stroke="#647967" strokeWidth="2" fill="none">
        <path d="M143 70q8-9 16 0q8-9 16 0M202 53q6-7 12 0q6-7 12 0" />
      </g>
    </svg>
  );
}
