export const STICKER_LIST: string[] = [
  '🔥', '⭐', '❤️', '⚡', '🚀', '👑', '💯', '🎯',
  '🔔', '👍', '💥', '🎬', '✨', '🌈', '🏆', '💎'
];

export const STICKER_POPULAR = [
  '🔥', '⭐', '❤️', '⚡', '🚀', '👑', '💯', '🎯',
  '✨', '🎬', '💥', '🌈', '🏆', '💎', '🎉', '👏',
  '😍', '😂', '🤩', '😎', '💪', '🤙', '🍿', '💡',
  '💰', '💣', '🤯', '🥳', '🙌', '✨', '🔥', '❤️'
];

export const STICKER_SOCIAL = [
  '👍', '🔔', '💬', '↗️', '❤️', '📌', '🔴', '⭐',
  '👀', '📱', '🎵', '📺', '📸', '✨', '🔥', '✔️',
  '👏', '📢', '🎧', '⚡', '💌', '🎁', '💎', '🚀'
];

export const STICKER_ARROWS = [
  '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '👉', '👈',
  '👆', '👇', '🎯', '📍', '⚠️', '❓', '❗', '🛑',
  '⛔', '✅', '❌', '✨', '💥', '💫', '⚡', '🔥'
];

export const STICKER_FUN = [
  '🍕', '🍔', '🍟', '🍦', '🍩', '☕', '🎮', '🕹️',
  '👾', '🤖', '🛸', '🦄', '🐱', '🐶', '🦁', '🦊',
  '🕶️', '👑', '🎩', '💎', '💰', '💸', '🏆', '🥇'
];

export const STICKER_BADGE_PRESETS = [
  { text: '🔥 HOT', bg: 'bg-rose-500', color: 'text-white' },
  { text: '✨ NEW', bg: 'bg-amber-500', color: 'text-slate-950' },
  { text: '👍 LIKE', bg: 'bg-blue-500', color: 'text-white' },
  { text: '🔔 SUBSCRIBE', bg: 'bg-red-600', color: 'text-white' },
  { text: '⭐ TOP 1', bg: 'bg-purple-600', color: 'text-white' },
  { text: '💎 VIP', bg: 'bg-emerald-500', color: 'text-slate-950' },
  { text: '🚀 VIRAL', bg: 'bg-indigo-500', color: 'text-white' },
  { text: '💯 100%', bg: 'bg-amber-600', color: 'text-white' },
  { text: '⚠️ WOW', bg: 'bg-yellow-400', color: 'text-slate-950' },
  { text: '🎯 TARGET', bg: 'bg-teal-500', color: 'text-slate-950' },
];


export const VOLUME_PRESET_BUTTONS = [
  { label: '0%', val: 0 },
  { label: '50%', val: 50 },
  { label: '100%', val: 100 },
  { label: '150%', val: 150 },
  { label: '200%', val: 200 },
];

export const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const BACKGROUND_PRESETS = [
  { id: 'black', name: 'Dark Void' },
  { id: 'blur', name: 'Frosted Blur' },
  { id: 'white', name: 'Studio White' },
  { id: 'emerald', name: 'Chroma Green' },
  { id: 'navy', name: 'Midnight Navy' }
] as const;

export const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:5', '21:9'] as const;

export const FILTER_PRESETS = [
  { id: 'none', name: 'Original (No Filter)' },
  { id: 'cinematic', name: 'Cinematic Teal & Orange' },
  { id: 'vintage', name: 'Vintage Warm Film' },
  { id: 'noir', name: 'Film Noir B&W' },
  { id: 'vibrant', name: 'Hyper Vibrant' },
  { id: 'cyberpunk', name: 'Cyberpunk Neon' },
  { id: 'sepia', name: 'Warm Sepia' },
  { id: 'cold', name: 'Arctic Cool' }
] as const;

export const TRANSITION_PRESETS = [
  { id: 'none', name: "Yo'q (None)" },
  { id: 'dissolve', name: "Erib o'tish" },
  { id: 'fade_black', name: "Qorayib o'tish" },
  { id: 'zoom_in', name: "Kattalashib o'tish" },
  { id: 'slide_left', name: "Chapga surilish" }
] as const;

