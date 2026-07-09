export interface SymptomCause {
  region: 'tip' | 'heart' | 'back' | 'spine' | 'rails' | 'blend';
  issue: string;
}

export interface AudioSignature {
  indicator: string;
  details: string;
}

export interface SymptomFix {
  action: string;
}

export interface Symptom {
  id: string;
  category: 'crow' | 'response' | 'pitch' | 'tone' | 'endurance';
  symptom: string;
  description: string;
  likelyCauses: SymptomCause[];
  audioSignatures: AudioSignature[];
  suggestedFixes: SymptomFix[];
  matchConditions?: {
    flatBeyondCents?: number;             // crow's nearest-C deviation is this many cents flat or more
    sharpBeyondCents?: number;            // crow's nearest-C deviation is this many cents sharp or more
    stabilityBelow?: number;
    monotoneCrow?: boolean;               // true = only one octave of C present
    missingLowerOctave?: boolean;         // true = crow sits high (C7+), no C6 root — sharp/stuffy
    missingUpperOctave?: boolean;         // true = rooted crow that doesn't reach the top C8
    completenessBelow?: number;           // harmonicCompleteness below this = thin, not buzzy
  };
}

export const symptoms: Symptom[] = [
  {
    id: 'crow-one-wire',
    category: 'crow',
    symptom: 'Crow is monotone — only one octave of C',
    description: 'A single-octave crow with no adjacent octave partials suggests either an over-thinned heart (killing the upper register) or bent/warped cane preventing the blade from vibrating in its higher modes.',
    likelyCauses: [
      { region: 'heart', issue: 'too thin — over-scraped, killing upper-register resonance' },
      { region: 'tip', issue: 'too thick — not vibrating freely enough to produce an adjacent octave' },
      { region: 'blend', issue: 'too gradual — no distinct resonance zones' }
    ],
    audioSignatures: [
      { indicator: 'Single dominant band in spectrogram', details: 'Only one clear horizontal band visible, with no octave-related bands above or below it' },
      { indicator: 'Low octave count', details: 'Only one candidate C octave registered as present' }
    ],
    suggestedFixes: [
      { action: 'Check the cane for warping — sight down the reed from the tip; the blade should look flat, not twisted or bowed.' },
      { action: 'Check tip thickness against light: tip should be nearly translucent at the very end.' },
      { action: 'Thin the heart selectively: remove material from the blend zone between heart and back, keeping the spine intact.' },
      { action: 'Create a steeper gradient from heart to tip. The tip should be measurably thinner (~0.10–0.12mm) than the upper heart (~0.18–0.22mm). Sharpen the blend transition.' }
    ],
    matchConditions: { monotoneCrow: true }
  },
  {
    id: 'crow-missing-lower-octave',
    category: 'crow',
    symptom: 'Crow sits high — missing its lower octave of C',
    description: 'The crow lands on the upper C\'s (C7 and above) with no C6 root beneath them. Absence of that lower octave points to insufficient back/blend thickness variation — the back is not providing enough mass to support the lower vibrational mode. Expect sharp tendencies and reduced tone core.',
    likelyCauses: [
      { region: 'back', issue: 'too thin or too uniform — not supporting the lower vibrational mode' },
      { region: 'blend', issue: 'too gradual — back-to-heart transition not differentiated enough' }
    ],
    audioSignatures: [
      { indicator: 'No band at the root C6', details: 'Spectrogram shows the crow\'s upper C bands (C7/C8) but nothing at the C6 root beneath them' },
      { indicator: 'Stack starts high', details: 'The lowest octave that registered is C7 or above' }
    ],
    suggestedFixes: [
      { action: 'Check the back of the reed (from the thread to the start of the heart) — it should have some thickness left, not be scraped thin.' },
      { action: 'Compare back thickness to heart: the back should taper gradually, not drop off sharply into the heart.' },
      { action: 'Slightly thin the blend between back and heart if the back is already at target thickness — a too-abrupt transition can also suppress the lower partial.' }
    ],
    matchConditions: { missingLowerOctave: true }
  },
  {
    id: 'crow-missing-upper-octave',
    category: 'crow',
    symptom: 'Crow is rooted but doesn\'t reach the top octave',
    description: 'The crow has its C6 root (and usually C7) but never lights up the highest octave, C8. This is a mild sign — a solid two-octave crow — rather than a structural fault. It usually means the tip is a touch stiff or the scrape not quite bright enough to excite the very top of the register.',
    likelyCauses: [
      { region: 'tip', issue: 'slightly thick or stiff at the very edge — not free enough to reach the top octave' },
      { region: 'heart', issue: 'a little heavy — damping the brightest, highest mode' }
    ],
    audioSignatures: [
      { indicator: 'No band at the top C8', details: 'Spectrogram shows C6 and C7 but nothing up at C8 (~4.2kHz)' },
      { indicator: 'Stack tops out early', details: 'The highest octave that registered is below C8' }
    ],
    suggestedFixes: [
      { action: 'Take a few very light strokes across the last 2–3mm of the tip and re-crow — a freer tip usually brings in the top octave.' },
      { action: 'This is often fine as-is: a clean, in-tune two-octave crow plays well. Only chase the top octave if the reed also feels stuffy or dark.' }
    ],
    matchConditions: { missingUpperOctave: true }
  },
  {
    id: 'crow-thin',
    category: 'crow',
    symptom: 'Crow has the right C\'s but sounds thin, not buzzy',
    description: 'Harmonic completeness measures presence of the full non-octave harmonic series between the C\'s (the buzz), independent of octave/pitch accuracy. Low completeness with correct C pitches suggests the blade is too damped or the aperture too small to sustain broadband vibration — a timbral issue, not a tuning one.',
    likelyCauses: [
      { region: 'tip', issue: 'opening too small — insufficient aperture to excite the full partial series' },
      { region: 'heart', issue: 'over-refined/too smooth — scrape too even to generate broadband buzz' }
    ],
    audioSignatures: [
      { indicator: 'Only clean bands at the C octaves', details: 'Spectrogram shows isolated thin lines at the octave positions with little energy in between' },
      { indicator: 'Low harmonic completeness score', details: 'Few or none of the non-octave partials present between the octaves' }
    ],
    suggestedFixes: [
      { action: 'Check the tip opening — gently squeeze the sides near the thread; the tip should spring back to a visible gap, not sit nearly closed.' },
      { action: 'Try soaking longer or working the reed open with a plaque before crowing again — a dry or collapsed tip crows cleanly instead of buzzing.' },
      { action: 'Slightly increase the tip opening; a uniformly smooth scrape damps the broadband buzz needed for a fully rich crow.' }
    ],
    // completenessBelow is now measured against the FULL harmonic series
    // (26 non-octave partials across C3..C8), not a fixed 4-partial set — a
    // genuinely rich, healthy crow only lights up roughly a quarter to a
    // third of that (the reference crow this app was tuned against scored
    // ~0.31), since the densest bands (15 partials between C7 and C8) are
    // never going to be fully lit even on a great reed. 0.12 marks "thin."
    matchConditions: { completenessBelow: 0.12 }
  },
  {
    id: 'crow-flat',
    category: 'crow',
    symptom: 'Crow pitch is flat of the nearest C',
    description: 'Flat crow reflects excess compliance in the vibrating surface. Diagnose by checking tip opening and comparing back thickness to target (~0.35–0.45mm at the collar).',
    likelyCauses: [
      { region: 'tip', issue: 'too thin — over-scraped, insufficient resistance' },
      { region: 'back', issue: 'too thin near collar — reed collapses under air pressure' },
      { region: 'rails', issue: 'too thin — tip opening too wide' }
    ],
    audioSignatures: [
      { indicator: 'Fundamental noticeably flat of the nearest C', details: 'Main spectrogram band sits well below where its C line should be' },
      { indicator: 'Unstable pitch under load', details: 'Pitch drops further when blowing harder' }
    ],
    suggestedFixes: [
      { action: 'Check if the tip closes completely when pinched — if yes, the back may be too thin. See a teacher before removing more cane.' },
      { action: 'Compare crow pitch before and after soaking 5 minutes. Significant flat drift after soaking suggests back is too thin.' },
      { action: 'Add resistance at the back: clip a very small amount from the tip (0.1–0.25mm) to raise the vibrating frequency.' }
    ],
    matchConditions: { flatBeyondCents: 50 }
  },
  {
    id: 'crow-sharp',
    category: 'crow',
    symptom: 'Crow pitch is sharp of the nearest C',
    description: 'Sharp crow is usually resolved by thinning the tip or opening the blade. Check the tip opening width — an overly closed tip raises the natural frequency but kills response.',
    likelyCauses: [
      { region: 'tip', issue: 'too thick — insufficient freedom to vibrate at normal pitch' },
      { region: 'heart', issue: 'too thick — too much mass resisting vibration' }
    ],
    audioSignatures: [
      { indicator: 'Fundamental noticeably sharp of the nearest C', details: 'Main spectrogram band sits well above where its C line should be' },
      { indicator: 'Narrow tip opening visible', details: 'Not an audio signature — check by looking at the reed' }
    ],
    suggestedFixes: [
      { action: 'Soak the reed fully and try again — a dry reed crows sharp. If still sharp after soaking, begin scraping.' },
      { action: 'Take light strokes across the tip (the last 3–4mm of the blade). Check crow after every 2–3 strokes.' },
      { action: 'If tip is already thin, target the channels (sides of the heart) to reduce lateral stiffness without weakening the spine.' }
    ],
    matchConditions: { sharpBeyondCents: 50 }
  },
  {
    id: 'crow-unstable',
    category: 'crow',
    symptom: 'Crow pitch wavers or is unstable',
    description: 'Crow instability (particularly pitch drift over the duration of the crow) indicates asymmetric scrape, uneven rails, or a tip that varies in thickness across its width.',
    likelyCauses: [
      { region: 'tip', issue: 'asymmetric — one side thicker than the other' },
      { region: 'rails', issue: 'uneven — one rail thicker or thinner' },
      { region: 'spine', issue: 'off-center — spine not aligned with the center of the tube' }
    ],
    audioSignatures: [
      { indicator: 'Wavering fundamental in spectrogram', details: 'The bottom band undulates or oscillates rather than appearing as a steady line' },
      { indicator: 'High pitch instability score', details: 'Stability below 60% in recording analysis' }
    ],
    suggestedFixes: [
      { action: 'Hold the reed up to a light source. Both blades should look identical. If one is darker (thicker) on one side, that side needs thinning.' },
      { action: 'Check rail evenness by gently running a fingernail along each rail edge — they should feel equal in resistance.' },
      { action: 'Thin the heavier side in small increments using diagonal strokes, rechecking crow symmetry after each pass.' }
    ],
    matchConditions: { stabilityBelow: 0.6 }
  },
  {
    id: 'hard-response',
    category: 'response',
    symptom: 'Reed is hard to start / requires too much air',
    description: 'Hard response with normal crow pitch suggests tip stiffness rather than overall thickness. Check tip opening and tip-to-heart gradient.',
    likelyCauses: [
      { region: 'tip', issue: 'too thick — requires too much pressure to initiate vibration' },
      { region: 'heart', issue: 'too thick — damping the vibration' }
    ],
    audioSignatures: [
      { indicator: 'Slow attack onset', details: 'Recording shows slow amplitude ramp-up at note start' }
    ],
    suggestedFixes: [
      { action: 'Thin the tip with light diagonal strokes and test again. Aim for near-translucency at the very edge.' },
      { action: 'Check tip opening after soaking: blades should separate slightly (~0.5–0.8mm at the widest point).' },
      { action: 'Differentiate tip and heart more clearly. If thinning the tip alone does not help, thin the channels to reduce lateral stiffness.' }
    ]
  },
  {
    id: 'closes-up',
    category: 'endurance',
    symptom: 'Reed closes up / gets harder during playing',
    description: 'Progressive closure is a structural issue: the back/spine lacks sufficient stiffness to resist lip pressure over time. Evaluate whether the problem is cane density or scrape distribution.',
    likelyCauses: [
      { region: 'back', issue: 'too thin — insufficient structural support' },
      { region: 'spine', issue: 'too thin — not holding the blades apart' }
    ],
    audioSignatures: [
      { indicator: 'Pitch rises over recording duration', details: 'Pitch contour shows steady upward drift as reed closes' },
      { indicator: 'Amplitude decreases over time', details: 'Waveform gradually reduces in level' }
    ],
    suggestedFixes: [
      { action: 'This reed may not be salvageable if the back is already too thin. Try a new piece of cane with thicker gouging.' },
      { action: 'Check back thickness at the collar: should be ~0.40–0.50mm. If under 0.35mm, the reed will close under normal embouchure pressure.' },
      { action: 'If cane quality allows, avoid scraping the final 4–5mm above the collar. Preserve spine thickness at the back third of the scrape.' }
    ]
  },
  {
    id: 'buzzy-tone',
    category: 'tone',
    symptom: 'Tone is buzzy or has an edge',
    description: 'Excessive high-frequency content (visible as bright upper bands in spectrogram) usually points to rail thinness, tip asymmetry, or staple/tube issues.',
    likelyCauses: [
      { region: 'rails', issue: 'too thin — edges vibrating independently' },
      { region: 'tip', issue: 'asymmetric or too thin at edges' }
    ],
    audioSignatures: [
      { indicator: 'Strong high-frequency bands', details: 'Bright bands above 2kHz visible in spectrogram' },
      { indicator: 'High overtone ratio', details: 'Harmonic energy disproportionate to fundamental' }
    ],
    suggestedFixes: [
      { action: 'Leave the rails alone — do not thin them further. Focus any future scraping on the center of the blade.' },
      { action: 'Check rail thickness by looking at the reed edge-on. Rails should appear uniform and not translucent.' },
      { action: 'If rails are already at target thickness, buzziness may reflect cane density. File this piece and start fresh with softer cane.' }
    ]
  },
  {
    id: 'flat-pitch',
    category: 'pitch',
    symptom: 'Reed plays flat overall',
    description: 'Distinguish between flat-from-back-thin (reed collapses, gets flatter with more air) and flat-from-tip-thin (stable but low). The former is structural; the latter can sometimes be addressed by clipping.',
    likelyCauses: [
      { region: 'tip', issue: 'too thin — vibrating at lower frequency than intended' },
      { region: 'back', issue: 'too thin — reed collapses under pressure' }
    ],
    audioSignatures: [
      { indicator: 'Fundamental consistently below target', details: 'Sustained notes read flat on tuner' }
    ],
    suggestedFixes: [
      { action: 'Try a tiny clip (0.25mm or less) from the tip. This shortens the vibrating length and raises pitch. Check crow and playing pitch after each clip.' },
      { action: 'If clipping raises crow but not playing pitch, the back is the issue — not repairable by scraping.' }
    ]
  }
];
