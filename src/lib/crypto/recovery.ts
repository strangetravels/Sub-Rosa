import { wrapContentKey, unwrapContentKey, type WrappedKeyPayload } from '@/lib/crypto/keys'

const WORDLIST = [
  'able', 'acid', 'army', 'axis', 'bear', 'bell', 'bird', 'blue', 'boat', 'bold',
  'bone', 'book', 'brass', 'bread', 'brick', 'bridge', 'brief', 'bring', 'broad', 'broke',
  'brook', 'brown', 'brush', 'build', 'built', 'chain', 'chair', 'chalk', 'charm', 'chart',
  'chase', 'cheap', 'check', 'chest', 'chief', 'child', 'china', 'chord', 'claim', 'class',
  'clean', 'clear', 'clerk', 'cliff', 'climb', 'clock', 'close', 'cloth', 'cloud', 'coach',
  'coast', 'could', 'count', 'court', 'cover', 'craft', 'crash', 'cream', 'crime', 'cross',
  'crowd', 'crown', 'crude', 'drawn', 'dream', 'dress', 'drift', 'drink', 'drive', 'drove',
  'eager', 'early', 'earth', 'eight', 'elite', 'empty', 'enemy', 'enjoy', 'enter', 'entry',
  'equal', 'error', 'event', 'every', 'exact', 'exist', 'extra', 'faith', 'false', 'fault',
  'field', 'fifth', 'fifty', 'fight', 'final', 'first', 'fixed', 'flash', 'fleet', 'floor',
  'fluid', 'focus', 'force', 'forge', 'forth', 'forty', 'forum', 'found', 'frame', 'frank',
  'fraud', 'fresh', 'front', 'frost', 'fruit', 'fully', 'funny', 'giant', 'given', 'glass',
  'globe', 'glory', 'going', 'grace', 'grade', 'grand', 'grant', 'grass', 'grave', 'great',
  'green', 'gross', 'group', 'grown', 'guard', 'guess', 'guide', 'guild', 'habit', 'happy',
  'harsh', 'heart', 'heavy', 'hello', 'honey', 'honor', 'horse', 'hotel', 'house', 'human',
  'ideal', 'image', 'index', 'inner', 'input', 'iron', 'irony', 'issue', 'ivory', 'jelly',
  'jewel', 'joint', 'judge', 'juice', 'knife', 'known', 'label', 'large', 'laser', 'later',
  'laugh', 'layer', 'learn', 'lemon', 'level', 'light', 'limit', 'linen', 'liver', 'local',
  'logic', 'loose', 'lucky', 'lunar', 'magic', 'major', 'maker', 'maple', 'march', 'match',
  'maybe', 'mercy', 'merit', 'metal', 'might', 'minor', 'model', 'money', 'month', 'moral',
  'motor', 'mount', 'mouse', 'mouth', 'movie', 'music', 'nerve', 'never', 'night', 'noble',
  'noise', 'north', 'noted', 'novel', 'nurse', 'occur', 'ocean', 'offer', 'often', 'olive',
  'onion', 'opera', 'orbit', 'order', 'organ', 'other', 'ought', 'outer', 'owner', 'oxide',
  'panel', 'paper', 'party', 'peace', 'pearl', 'phase', 'phone', 'photo', 'piano', 'piece',
  'pilot', 'pitch', 'place', 'plain', 'plane', 'plant', 'plate', 'point', 'polar', 'pound',
  'power', 'press', 'price', 'pride', 'prime', 'print', 'prior', 'prize', 'proof', 'proud',
  'prove', 'queen', 'quick', 'quiet', 'quite', 'radio', 'raise', 'range', 'rapid', 'ratio',
  'reach', 'ready', 'realm', 'rebel', 'refer', 'reign', 'relax', 'reply', 'right', 'river',
  'robot', 'rocky', 'roman', 'rough', 'round', 'route', 'royal', 'rural', 'scale', 'scene',
  'scope', 'score', 'sense', 'serve', 'seven', 'shade', 'shaft', 'shake', 'shall', 'shame',
  'shape', 'share', 'sharp', 'sheep', 'sheer', 'sheet', 'shelf', 'shell', 'shift', 'shine',
  'shirt', 'shock', 'shoot', 'shore', 'short', 'shown', 'sight', 'sigma', 'silly', 'since',
  'sixth', 'skill', 'sleep', 'slide', 'small', 'smart', 'smile', 'smoke', 'snake', 'solar',
  'solid', 'solve', 'sorry', 'sound', 'south', 'space', 'spare', 'speak', 'speed', 'spend',
  'spice', 'spine', 'spite', 'split', 'spoke', 'sport', 'staff', 'stage', 'stain', 'stake',
  'stand', 'start', 'state', 'steam', 'steel', 'steep', 'steer', 'stone', 'stood', 'store',
  'storm', 'story', 'stove', 'strap', 'straw', 'strip', 'stuck', 'study', 'stuff', 'style',
  'sugar', 'suite', 'super', 'surge', 'swear', 'sweet', 'swift', 'swing', 'sword', 'table',
  'taste', 'teach', 'teeth', 'thank', 'theft', 'their', 'theme', 'there', 'thick', 'thing',
  'think', 'third', 'those', 'three', 'throw', 'thumb', 'tiger', 'tight', 'timer', 'tired',
  'title', 'toast', 'today', 'token', 'tooth', 'topic', 'total', 'touch', 'tough', 'tower',
  'track', 'trade', 'trail', 'train', 'trait', 'trash', 'treat', 'trend', 'trial', 'tribe',
  'trick', 'tried', 'troop', 'trust', 'truth', 'twice', 'twist', 'ultra', 'uncle', 'under',
  'union', 'unity', 'until', 'upper', 'upset', 'urban', 'usage', 'usual', 'valid', 'value',
  'vapor', 'vault', 'venue', 'video', 'view', 'viral', 'virus', 'visit', 'vital', 'vivid',
  'vocal', 'voice', 'voter', 'waste', 'watch', 'water', 'weave', 'wheel', 'where', 'which',
  'while', 'white', 'whole', 'whose', 'widen', 'width', 'woman', 'world', 'worry', 'worth',
  'would', 'wound', 'write', 'wrong', 'wrote', 'yacht', 'yield', 'young', 'youth', 'zebra',
] as const

export function generateRecoveryPhrase(wordCount = 12): string {
  const words: string[] = []
  const bytes = crypto.getRandomValues(new Uint8Array(wordCount))
  for (const byte of bytes) {
    words.push(WORDLIST[byte % WORDLIST.length]!)
  }
  return words.join(' ')
}

export async function wrapContentKeyWithRecoveryPhrase(
  contentKey: CryptoKey,
  phrase: string,
): Promise<WrappedKeyPayload> {
  return wrapContentKey(contentKey, normalizePhrase(phrase))
}

export async function unwrapContentKeyWithRecoveryPhrase(
  payload: WrappedKeyPayload,
  phrase: string,
): Promise<CryptoKey> {
  return unwrapContentKey(payload, normalizePhrase(phrase))
}

export function normalizePhrase(phrase: string): string {
  return phrase.trim().toLowerCase().split(/\s+/).join(' ')
}
