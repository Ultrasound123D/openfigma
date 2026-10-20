/**
 * emoji.ts — PHASE 19 (T8). Local emoji dataset + search.
 * Source evidence: comments.emojiPicker + editorRef.insertEmoji (5101-a9dd…)
 * + text marker type "EMOJI" (1517-f945…). No external API: curated set.
 */

export interface EmojiCategory {
  name: string
  emojis: string[]
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: 'Smileys',
    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','😮‍💨','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','😵','🤯','🤠','🥳','😎','🤓','🧐'],
  },
  {
    name: 'Gestures',
    emojis: ['👍','👎','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤝','🙏','✍️','💪','🦾','👏','🙌','🤲','🤜','🤛'],
  },
  {
    name: 'Objects',
    emojis: ['💻','🖥️','⌨️','🖱️','📱','☎️','📞','📠','📺','📷','🎥','📽️','⏰','⏱️','⌛','💡','🔦','🕯️','🔋','🔌','🔍','🔭','📡','💊','💉','🩹','🚀','✈️','🚗','🚕','🚌','🚲','🗺️','🧭','🎒','👓','👕','👖','👔','👗','👠','🎒','🏆','🎯','🎮','🎲','✏️','🖊️','🖌️','📝','📚','📎','✂️','🔒','🔑','🔨','🛠️','⚙️','🧲','💰','💳','📈','📉','📊','🗂️','📅','📌','🔖','🏷️','⭐','🌟','✨','⚡','🔥','💧','🌊'],
  },
  {
    name: 'Nature',
    emojis: ['🌱','🌲','🌳','🌴','🌵','🌾','🌿','☘️','🍀','🍁','🍄','🌷','🌹','🥀','🌺','🌸','🌼','🌻','🍎','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🥦','🥕','🌽','🥔','🍞','🧀','🍗','🥩','🍳','🥓','🍔','🍟','🍕','🌮','🌯','🍜','🍣','🍱','🍦','🍩','🍪','🎂','☕','🍵','🧃','🍺','🍷','🥤'],
  },
  {
    name: 'Symbols',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💯','❗','❓','✅','❌','⭕','🚫','⚠️','♻️','🔘','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🔺','🔻','🔸','🔹','⬛','⬜','🔶','🔷','💥','💤','💬','💭','🕐'],
  },
]

/** Flat list of every emoji (for search indexing). */
export const ALL_EMOJIS: string[] = EMOJI_CATEGORIES.flatMap((c) => c.emojis.filter((e) => !e.includes(' ')))

/** Search by keyword against category names (emoji glyphs have no keywords). */
export function searchEmojis(query: string): string[] {
  const q = (query || '').trim().toLowerCase()
  if (!q) return ALL_EMOJIS
  const cats = EMOJI_CATEGORIES.filter((c) => c.name.toLowerCase().includes(q))
  return cats.flatMap((c) => c.emojis.filter((e) => !e.includes(' ')))
}
