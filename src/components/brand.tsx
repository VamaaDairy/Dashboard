export function GaiaLogo({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 260 150" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M16 42 C 8 26, 16 6, 38 4 C 53 2, 58 12, 70 8 C 88 2, 102 14, 116 6 C 132 -2, 148 8, 162 4 C 180 -1, 198 4, 210 16 C 224 28, 228 36, 222 48 C 230 56, 232 68, 222 76 C 228 84, 224 94, 212 92 C 214 100, 202 106, 190 100 C 180 106, 166 102, 160 94 C 146 102, 128 98, 122 88 C 108 96, 90 92, 84 82 C 68 88, 50 82, 46 70 C 30 72, 16 62, 18 50 C 10 48, 8 44, 16 42 Z"
        fill="#4A6FA5"
      />
      <text x="130" y="66" textAnchor="middle" fontFamily="'Baloo 2', 'Segoe UI', system-ui, sans-serif" fontWeight={700} fontSize="46" fill="#FFFFFF" letterSpacing="1">
        gaia
      </text>
      <text x="130" y="132" textAnchor="middle" fontFamily="'Segoe UI', system-ui, sans-serif" fontWeight={400} fontSize="17" fill="#3E9B4F">
        nourishment for life
      </text>
    </svg>
  );
}

export function ClipboardIllustration({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 620 720" xmlns="http://www.w3.org/2000/svg">
      <circle cx="330" cy="380" r="270" fill="#EAF0FB" />
      <circle cx="330" cy="380" r="270" fill="none" stroke="#2B2B2B" strokeWidth="1.5" />
      <g>
        <rect x="30" y="70" width="330" height="470" rx="18" fill="#DCE4F7" stroke="#B9C6EA" strokeWidth="2" />
        <rect x="130" y="46" width="130" height="46" rx="12" fill="#5B7FC7" />
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(60, ${170 + i * 100})`}>
            <circle cx="30" cy="10" r="28" fill="#6E8FD6" />
            <path d="M17 10 L26 19 L44 -3" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="80" y="0" width="200" height="8" rx="4" fill="#8FA6DE" />
          </g>
        ))}
        <rect x="90" y="490" width="150" height="8" rx="4" fill="#8FA6DE" />
      </g>
      <g transform="translate(190, 260)">
        <rect x="30" y="330" width="46" height="150" rx="18" fill="#4E7A4E" />
        <rect x="110" y="330" width="46" height="150" rx="18" fill="#4E7A4E" />
        <path d="M20 470 h60 l-10 24 h-45 z" fill="#3E5FA0" />
        <path d="M100 470 h60 l-10 24 h-45 z" fill="#3E5FA0" />
        <rect x="20" y="150" width="140" height="190" rx="30" fill="#F4C64B" />
        <rect x="140" y="170" width="110" height="34" rx="17" fill="#F4C64B" transform="rotate(8 140 170)" />
        <rect x="60" y="90" width="60" height="70" rx="20" fill="#E8B48C" />
        <circle cx="90" cy="70" r="46" fill="#E8B48C" />
        <path d="M40 60 a50 40 0 0 1 100 0 z" fill="#3E6FD6" />
        <ellipse cx="90" cy="60" rx="52" ry="10" fill="#F4A63E" />
        <path d="M40 60 q-10 40 20 55" fill="none" stroke="#2B2B2B" strokeWidth="4" />
        <circle cx="60" cy="118" r="6" fill="#2B2B2B" />
        <rect x="10" y="180" width="60" height="80" rx="8" fill="#E85C5C" transform="rotate(-8 10 180)" />
      </g>
      <rect x="480" y="360" width="34" height="70" rx="6" fill="#4CAF6E" transform="rotate(20 480 360)" />
      <g transform="translate(400, 300)">
        <rect x="0" y="0" width="230" height="330" rx="26" fill="#C9D6F5" stroke="#A9BAEF" strokeWidth="2" />
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(30, ${60 + i * 90})`}>
            <circle cx="20" cy="20" r="20" fill={i === 1 ? "#5B7FC7" : "#F5F8FF"} stroke="#5B7FC7" strokeWidth="3" />
            <rect x="60" y="6" width="120" height="28" rx="8" fill="#EEF2FC" />
          </g>
        ))}
      </g>
    </svg>
  );
}
