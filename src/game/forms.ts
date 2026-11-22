// Medallas y datos de formas especiales (Mega, G-MAX, Primal y Origen).

export const GYM_BADGES = [
  { id: 'boulder', name: 'Boulder Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/1.png' },
  { id: 'cascade', name: 'Cascade Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/2.png' },
  { id: 'thunder', name: 'Thunder Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/3.png' },
  { id: 'rainbow', name: 'Rainbow Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/4.png' },
  { id: 'soul', name: 'Soul Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/5.png' },
  { id: 'marsh', name: 'Marsh Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/6.png' },
  { id: 'volcano', name: 'Volcano Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/7.png' },
  { id: 'earth', name: 'Earth Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/8.png' },
  { id: 'zephyr', name: 'Zephyr Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/9.png' },
  { id: 'hive', name: 'Hive Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/10.png' },
  { id: 'plain', name: 'Plain Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/11.png' },
  { id: 'fog', name: 'Fog Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/12.png' },
  { id: 'storm', name: 'Storm Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/13.png' },
  { id: 'mineral', name: 'Mineral Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/14.png' },
  { id: 'glacier', name: 'Glacier Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/15.png' },
  { id: 'rising', name: 'Rising Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/16.png' },
  { id: 'stone', name: 'Stone Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/17.png' },
  { id: 'knuckle', name: 'Knuckle Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/18.png' },
  { id: 'dynamo', name: 'Dynamo Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/19.png' },
  { id: 'heat', name: 'Heat Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/20.png' },
  { id: 'balance', name: 'Balance Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/21.png' },
  { id: 'feather', name: 'Feather Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/22.png' },
  { id: 'mind', name: 'Mind Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/23.png' },
  { id: 'rain', name: 'Rain Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/24.png' },
  { id: 'coal', name: 'Coal Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/25.png' },
  { id: 'forest', name: 'Forest Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/26.png' },
  { id: 'cobble', name: 'Cobble Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/27.png' },
  { id: 'fen', name: 'Fen Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/28.png' },
  { id: 'relic', name: 'Relic Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/29.png' },
  { id: 'mine', name: 'Mine Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/30.png' },
  { id: 'icicle', name: 'Icicle Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/31.png' },
  { id: 'beacon', name: 'Beacon Badge', sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/32.png' },
]

export const MEGA_CAPABLE_IDS = new Set([
  3, 6, 9, 15, 18, 26, 36, 65, 71, 80, 94, 115, 121, 127, 130, 142, 149, 150,
  154, 160, 181, 208, 212, 214, 227, 229, 248,
  254, 257, 260, 282, 302, 303, 306, 308, 310, 319, 323, 334, 354, 358, 359, 362, 373, 376, 380, 381, 384, 398,
  428, 445, 448, 460, 475, 478, 485, 491,
  500, 530, 531, 545, 560, 604, 609, 623,
  652, 655, 658, 668, 670, 678, 687, 689, 691, 701, 719, 10025, 10120,
  740, 768, 780, 801, 807,
  870, 952, 970, 978, 998,
])

export const MEGA_FORM_IDS: Record<number, number | number[]> = {
  3: 10033, 6: [10034, 10035], 9: 10036, 15: 10090, 18: 10073,
  26: [10304, 10305], 36: 10278, 65: 10037, 71: 10279, 80: 10071,
  94: 10038, 115: 10039, 121: 10280, 127: 10040, 130: 10041,
  142: 10042, 149: 10281, 150: [10043, 10044],
  154: 10282, 160: 10283, 181: 10045, 208: 10072, 212: 10046,
  214: 10047, 227: 10284, 229: 10048, 248: 10049,
  254: 10065, 257: 10050, 260: 10064, 282: 10051, 302: 10066,
  303: 10052, 306: 10053, 308: 10054, 310: 10055, 319: 10070, 323: 10087, 334: 10067, 354: 10056,
  358: 10306, 359: [10057, 10307], 362: 10074, 373: 10089, 376: 10076,
  380: 10062, 381: 10063, 384: 10079, 398: 10308,
  428: 10088, 445: [10058, 10309], 448: [10059, 10310],
  460: 10060, 475: 10068, 478: 10285, 485: 10311, 491: 10312,
  500: 10286, 530: 10287, 531: 10069, 545: 10288, 560: 10289,
  604: 10290, 609: 10291, 623: 10313,
  652: 10292, 655: 10293, 658: 10294, 668: 10295, 670: 10296,
  678: [10314, 10326], 687: 10297, 689: 10298, 691: 10299,
  10025: [10314, 10326],
  701: 10300, 719: 10075, 10120: 10301,
  740: 10315, 768: 10316, 780: 10302, 801: [10317, 10318],
  807: 10319,
  870: 10303, 952: 10320, 970: 10321, 978: [10322, 10323, 10324],
  998: 10325,
}

// Mega Zygarde (10301) no tiene sprite de batalla estático en PokeAPI: se usa su
// arte oficial (el mismo diseño que Zygarde Forma Completa).
export const MEGA_SPRITE_OVERRIDES: Record<number, string> = {
  10301: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10301.png',
}

export const GMAX_CAPABLE_IDS = new Set([
  3, 6, 9, 12, 25, 52, 68, 94, 99, 131, 133, 143, 569, 809,
  812, 815, 818, 823, 826, 834, 839, 841, 842, 844, 849, 851,
  858, 861, 869, 879, 884, 892, 10191,
])

export const GMAX_FORM_IDS: Record<number, number | number[]> = {
  3: 10195, 6: 10196, 9: 10197, 12: 10198, 25: 10199, 52: 10200,
  68: 10201, 94: 10202, 99: 10203, 131: 10204, 133: 10205, 143: 10206,
  569: 10207, 809: 10208, 812: 10209, 815: 10210, 818: 10211,
  823: 10212, 826: 10213, 834: 10214, 839: 10215, 841: 10216,
  842: 10217, 844: 10218, 849: [10219, 10228], 851: 10220,
  858: 10221, 861: 10222, 869: 10223, 879: 10224, 884: 10225,
  892: 10226, 10191: 10227,
}

export const PRIMAL_CAPABLE_IDS = new Set([
  382, 383,
])

export const PRIMAL_FORM_IDS: Record<number, number> = {
  382: 10077,
  383: 10078,
}

// Formas Origen de Dialga, Palkia y Giratina mediante las esferas.
export const ORIGIN_CAPABLE_IDS = new Set([483, 484, 487])

export const ORIGIN_FORM_IDS: Record<number, number> = {
  483: 10245,
  484: 10246,
  487: 10007,
}

