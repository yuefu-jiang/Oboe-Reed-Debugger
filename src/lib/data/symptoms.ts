import type { ExperienceLevel } from '$lib/stores/experienceStore';

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
  level: ExperienceLevel;
}

export interface Symptom {
  id: string;
  category: 'crow' | 'response' | 'pitch' | 'tone' | 'endurance';
  symptom: string;
  description: Record<ExperienceLevel, string>;
  likelyCauses: SymptomCause[];
  audioSignatures: AudioSignature[];
  suggestedFixes: SymptomFix[];
  matchConditions?: {
    flatBeyondCents?: number;             // crow's nearest-C deviation is this many cents flat or more
    sharpBeyondCents?: number;            // crow's nearest-C deviation is this many cents sharp or more
    stabilityBelow?: number;
    monotoneCrow?: boolean;               // true = only one octave of C present
    missingLowerOctave?: boolean;         // true = upper C's present but nothing below the root
    completenessBelow?: number;           // harmonicCompleteness below this = thin, not buzzy
  };
}

export const symptoms: Symptom[] = [
  {
    id: 'crow-one-wire',
    category: 'crow',
    symptom: 'Crow is monotone — only one octave of C',
    description: {
      beginner: 'A good crow should sound like a stack of "C" pitches an octave or two apart, not just one note. If you only hear one pitch, the reed is too even, too stiff, or the cane may be bent.',
      intermediate: 'A healthy crow contains multiple octaves of C stacked on top of each other. A monotone (single-octave) crow usually means too much material was removed from the heart, or the cane itself is bent.',
      advanced: 'A single-octave crow with no adjacent octave partials suggests either an over-thinned heart (killing the upper register) or bent/warped cane preventing the blade from vibrating in its higher modes.'
    },
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
      { action: 'Check the cane for warping — sight down the reed from the tip; the blade should look flat, not twisted or bowed.', level: 'beginner' },
      { action: 'Check tip thickness against light: tip should be nearly translucent at the very end.', level: 'beginner' },
      { action: 'Thin the heart selectively: remove material from the blend zone between heart and back, keeping the spine intact.', level: 'intermediate' },
      { action: 'Create a steeper gradient from heart to tip. The tip should be measurably thinner (~0.10–0.12mm) than the upper heart (~0.18–0.22mm). Sharpen the blend transition.', level: 'advanced' }
    ],
    matchConditions: { monotoneCrow: true }
  },
  {
    id: 'crow-missing-lower-octave',
    category: 'crow',
    symptom: 'Crow is missing its lower octave of C',
    description: {
      beginner: 'A good crow has a low, middle, and high "C" stacked together. If the low one is missing and you only hear the higher ones, the reed will likely play sharp with a stuffy tone.',
      intermediate: 'When upper C partials are present but nothing registers below the crow\'s root pitch, the reed is missing its lower register — a common cause of sharp pitch and a stuffy, closed tone on the instrument.',
      advanced: 'Absence of the sub-octave partial points to insufficient back/blend thickness variation — the back is not providing enough mass to support the lower vibrational mode. Expect sharp tendencies and reduced tone core.'
    },
    likelyCauses: [
      { region: 'back', issue: 'too thin or too uniform — not supporting the lower vibrational mode' },
      { region: 'blend', issue: 'too gradual — back-to-heart transition not differentiated enough' }
    ],
    audioSignatures: [
      { indicator: 'No band below the root pitch', details: 'Spectrogram shows the crow\'s upper C bands but nothing an octave below the lowest one' },
      { indicator: 'Fewer than 3 octaves present', details: 'Only the root and/or upper bands registered — no lower band' }
    ],
    suggestedFixes: [
      { action: 'Check the back of the reed (from the thread to the start of the heart) — it should have some thickness left, not be scraped thin.', level: 'beginner' },
      { action: 'Compare back thickness to heart: the back should taper gradually, not drop off sharply into the heart.', level: 'intermediate' },
      { action: 'Slightly thin the blend between back and heart if the back is already at target thickness — a too-abrupt transition can also suppress the lower partial.', level: 'advanced' }
    ],
    matchConditions: { missingLowerOctave: true }
  },
  {
    id: 'crow-thin',
    category: 'crow',
    symptom: 'Crow has the right C\'s but sounds thin, not buzzy',
    description: {
      beginner: 'A great crow isn\'t just the "C" pitches — it should sound raspy and full, with extra buzz filling in between the clean notes. If you only hear the clean C\'s and nothing else, the reed may be too refined or closed to crow at full richness.',
      intermediate: 'A physically healthy crow radiates a natural harmonic series — not just octaves of the fundamental, but the 3rd, 5th, 6th, and 7th partials too (landing near a fifth, a third, another fifth, and a flat seventh above the octaves). Few of these present means a thin, less buzzy crow, even if the C pitches themselves are dead on.',
      advanced: 'Harmonic completeness measures presence of the non-octave partials (3x, 5x, 6x, 7x the fundamental) independent of octave/pitch accuracy. Low completeness with correct C pitches suggests the blade is too damped or the aperture too small to sustain broadband vibration — a timbral issue, not a tuning one.'
    },
    likelyCauses: [
      { region: 'tip', issue: 'opening too small — insufficient aperture to excite the full partial series' },
      { region: 'heart', issue: 'over-refined/too smooth — scrape too even to generate broadband buzz' }
    ],
    audioSignatures: [
      { indicator: 'Only clean bands at the C octaves', details: 'Spectrogram shows isolated thin lines at the octave positions with little energy in between' },
      { indicator: 'Low harmonic completeness score', details: 'Few or none of the 3rd/5th/6th/7th partials present between the octaves' }
    ],
    suggestedFixes: [
      { action: 'Check the tip opening — gently squeeze the sides near the thread; the tip should spring back to a visible gap, not sit nearly closed.', level: 'beginner' },
      { action: 'Try soaking longer or working the reed open with a plaque before crowing again — a dry or collapsed tip crows cleanly instead of buzzing.', level: 'intermediate' },
      { action: 'Slightly increase the tip opening; a uniformly smooth scrape damps the broadband buzz needed for a fully rich crow.', level: 'advanced' }
    ],
    matchConditions: { completenessBelow: 0.25 }
  },
  {
    id: 'crow-flat',
    category: 'crow',
    symptom: 'Crow pitch is flat of the nearest C',
    description: {
      beginner: 'The crow should land close to a "C" — any octave of it is fine. If it sounds noticeably lower/duller than the nearest C, the reed is too soft or open.',
      intermediate: 'A crow that sits well flat of its nearest C (whichever octave it\'s rooted on) typically indicates the tip or back is too thin, or the reed is too open at the tip.',
      advanced: 'Flat crow reflects excess compliance in the vibrating surface. Diagnose by checking tip opening and comparing back thickness to target (~0.35–0.45mm at the collar).'
    },
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
      { action: 'Check if the tip closes completely when pinched — if yes, the back may be too thin. See a teacher before removing more cane.', level: 'beginner' },
      { action: 'Compare crow pitch before and after soaking 5 minutes. Significant flat drift after soaking suggests back is too thin.', level: 'intermediate' },
      { action: 'Add resistance at the back: clip a very small amount from the tip (0.1–0.25mm) to raise the vibrating frequency.', level: 'advanced' }
    ],
    matchConditions: { flatBeyondCents: 50 }
  },
  {
    id: 'crow-sharp',
    category: 'crow',
    symptom: 'Crow pitch is sharp of the nearest C',
    description: {
      beginner: 'If the crow sounds noticeably higher than the nearest C, the reed is too stiff or closed. It will play sharp on the instrument and be hard to blow.',
      intermediate: 'A crow that sits well sharp of its nearest C (whichever octave it\'s rooted on) indicates too much resistance. The tip or heart is too thick, or the tip opening is too narrow.',
      advanced: 'Sharp crow is usually resolved by thinning the tip or opening the blade. Check the tip opening width — an overly closed tip raises the natural frequency but kills response.'
    },
    likelyCauses: [
      { region: 'tip', issue: 'too thick — insufficient freedom to vibrate at normal pitch' },
      { region: 'heart', issue: 'too thick — too much mass resisting vibration' }
    ],
    audioSignatures: [
      { indicator: 'Fundamental noticeably sharp of the nearest C', details: 'Main spectrogram band sits well above where its C line should be' },
      { indicator: 'Narrow tip opening visible', details: 'Not an audio signature — check by looking at the reed' }
    ],
    suggestedFixes: [
      { action: 'Soak the reed fully and try again — a dry reed crows sharp. If still sharp after soaking, begin scraping.', level: 'beginner' },
      { action: 'Take light strokes across the tip (the last 3–4mm of the blade). Check crow after every 2–3 strokes.', level: 'intermediate' },
      { action: 'If tip is already thin, target the channels (sides of the heart) to reduce lateral stiffness without weakening the spine.', level: 'advanced' }
    ],
    matchConditions: { sharpBeyondCents: 50 }
  },
  {
    id: 'crow-unstable',
    category: 'crow',
    symptom: 'Crow pitch wavers or is unstable',
    description: {
      beginner: 'The crow should stay on a pitch when you hold it steady. If it wobbles, drifts, or sounds uneven, something is out of balance.',
      intermediate: 'Pitch instability in the crow usually points to asymmetry — one blade thicker than the other — or a tip with uneven thinning.',
      advanced: 'Crow instability (particularly pitch drift over the duration of the crow) indicates asymmetric scrape, uneven rails, or a tip that varies in thickness across its width.'
    },
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
      { action: 'Hold the reed up to a light source. Both blades should look identical. If one is darker (thicker) on one side, that side needs thinning.', level: 'beginner' },
      { action: 'Check rail evenness by gently running a fingernail along each rail edge — they should feel equal in resistance.', level: 'intermediate' },
      { action: 'Thin the heavier side in small increments using diagonal strokes, rechecking crow symmetry after each pass.', level: 'advanced' }
    ],
    matchConditions: { stabilityBelow: 0.6 }
  },
  {
    id: 'hard-response',
    category: 'response',
    symptom: 'Reed is hard to start / requires too much air',
    description: {
      beginner: 'If you have to push a lot of air to get a sound, or the notes feel resistant, the reed is too stiff.',
      intermediate: 'Over-resistance is most often a tip that is too thick or a tip opening that is too narrow after soaking.',
      advanced: 'Hard response with normal crow pitch suggests tip stiffness rather than overall thickness. Check tip opening and tip-to-heart gradient.'
    },
    likelyCauses: [
      { region: 'tip', issue: 'too thick — requires too much pressure to initiate vibration' },
      { region: 'heart', issue: 'too thick — damping the vibration' }
    ],
    audioSignatures: [
      { indicator: 'Slow attack onset', details: 'Recording shows slow amplitude ramp-up at note start' }
    ],
    suggestedFixes: [
      { action: 'Thin the tip with light diagonal strokes and test again. Aim for near-translucency at the very edge.', level: 'beginner' },
      { action: 'Check tip opening after soaking: blades should separate slightly (~0.5–0.8mm at the widest point).', level: 'intermediate' },
      { action: 'Differentiate tip and heart more clearly. If thinning the tip alone does not help, thin the channels to reduce lateral stiffness.', level: 'advanced' }
    ]
  },
  {
    id: 'closes-up',
    category: 'endurance',
    symptom: 'Reed closes up / gets harder during playing',
    description: {
      beginner: 'If the reed starts okay but gets harder and harder to play after a few minutes, it is closing up. The blades are collapsing inward.',
      intermediate: 'Closure during playing is typically caused by back that is too thin (not enough spine strength to maintain opening) or cane that is too soft.',
      advanced: 'Progressive closure is a structural issue: the back/spine lacks sufficient stiffness to resist lip pressure over time. Evaluate whether the problem is cane density or scrape distribution.'
    },
    likelyCauses: [
      { region: 'back', issue: 'too thin — insufficient structural support' },
      { region: 'spine', issue: 'too thin — not holding the blades apart' }
    ],
    audioSignatures: [
      { indicator: 'Pitch rises over recording duration', details: 'Pitch contour shows steady upward drift as reed closes' },
      { indicator: 'Amplitude decreases over time', details: 'Waveform gradually reduces in level' }
    ],
    suggestedFixes: [
      { action: 'This reed may not be salvageable if the back is already too thin. Try a new piece of cane with thicker gouging.', level: 'beginner' },
      { action: 'Check back thickness at the collar: should be ~0.40–0.50mm. If under 0.35mm, the reed will close under normal embouchure pressure.', level: 'intermediate' },
      { action: 'If cane quality allows, avoid scraping the final 4–5mm above the collar. Preserve spine thickness at the back third of the scrape.', level: 'advanced' }
    ]
  },
  {
    id: 'buzzy-tone',
    category: 'tone',
    symptom: 'Tone is buzzy or has an edge',
    description: {
      beginner: 'If the sound is harsh, edgy, or "buzzy," the reed may have too many overtones compared to its fundamental tone.',
      intermediate: 'Buzziness often comes from rails that are too thin, a tip that is uneven, or cane that is too hard.',
      advanced: 'Excessive high-frequency content (visible as bright upper bands in spectrogram) usually points to rail thinness, tip asymmetry, or staple/tube issues.'
    },
    likelyCauses: [
      { region: 'rails', issue: 'too thin — edges vibrating independently' },
      { region: 'tip', issue: 'asymmetric or too thin at edges' }
    ],
    audioSignatures: [
      { indicator: 'Strong high-frequency bands', details: 'Bright bands above 2kHz visible in spectrogram' },
      { indicator: 'High overtone ratio', details: 'Harmonic energy disproportionate to fundamental' }
    ],
    suggestedFixes: [
      { action: 'Leave the rails alone — do not thin them further. Focus any future scraping on the center of the blade.', level: 'beginner' },
      { action: 'Check rail thickness by looking at the reed edge-on. Rails should appear uniform and not translucent.', level: 'intermediate' },
      { action: 'If rails are already at target thickness, buzziness may reflect cane density. File this piece and start fresh with softer cane.', level: 'advanced' }
    ]
  },
  {
    id: 'flat-pitch',
    category: 'pitch',
    symptom: 'Reed plays flat overall',
    description: {
      beginner: 'If every note is flat on the tuner, the reed is too soft or too open.',
      intermediate: 'Overall flat pitch (more than 10 cents flat at A=440) indicates the reed is over-scraped or the cane is too soft.',
      advanced: 'Distinguish between flat-from-back-thin (reed collapses, gets flatter with more air) and flat-from-tip-thin (stable but low). The former is structural; the latter can sometimes be addressed by clipping.'
    },
    likelyCauses: [
      { region: 'tip', issue: 'too thin — vibrating at lower frequency than intended' },
      { region: 'back', issue: 'too thin — reed collapses under pressure' }
    ],
    audioSignatures: [
      { indicator: 'Fundamental consistently below target', details: 'Sustained notes read flat on tuner' }
    ],
    suggestedFixes: [
      { action: 'Try a tiny clip (0.25mm or less) from the tip. This shortens the vibrating length and raises pitch. Check crow and playing pitch after each clip.', level: 'intermediate' },
      { action: 'If clipping raises crow but not playing pitch, the back is the issue — not repairable by scraping.', level: 'advanced' }
    ]
  }
];
