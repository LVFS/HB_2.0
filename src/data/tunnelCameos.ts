/**
 * I cameo della modalità shonen del tunnel (FASE 10, tappe 5-6): a ogni parata riuscita dell'onda esce UN SOLO ospite da un portale —
 * un personaggio, oppure una squadra che arriva insieme (i Gentleman, la ciurma, i Saiyan, la classe 1-A) — dice una battuta e dà una
 * mano a modo suo per un po'. È SOLO DATI: per aggiungerne uno, cambiare una battuta o un colore basta toccare questo file.
 * Le figure sono segnaposto a tinte unite (corpo, fascia, capelli) con il nome sopra.
 *
 * Le voci con `todo: true` hanno una battuta GENERICA al posto di una vera (non la conosco con certezza): da sostituire
 * con quella giusta. I cameo dei doppiatori vanno scritti con le battute dei personaggi che doppiano.
 */

export type CameoGroup = 'shonen' | 'giochi' | 'streamer' | 'gentleman' | 'doppiatori' | 'squadre' | 'marvel';

/**
 * Lo STILE permanente che l'ospite ti lascia (vale fino alla fine dell'inseguimento): ognuno cambia il modo di giocare e,
 * se serve, l'aspetto di D. Il significato è in `tunnelConfig.PERKS` / `tunnelPerks.ts`.
 */
export type PerkId = 'saiyan' | 'thor' | 'gentleman' | 'gear5' | 'zoro' | 'hero' | 'magic' | 'speed' | 'fly' | 'calm' | 'eve';

/**
 * Come aiuta (un solo ospite per modalità, per tutta la sua permanenza):
 *  - `lane` (predefinito): ripulisce UNA via — quella di D — davanti a lui, spesso;
 *  - `wide`: ripulisce tutte le vie, più lontano, ma di rado;
 *  - `lost`: ripulisce una via SBAGLIATA (non quella di D): aiuta solo per fortuna;
 *  - `shield`: non ripulisce niente, ma rende D invulnerabile per qualche istante.
 */
export type CameoHelp = 'lane' | 'wide' | 'lost' | 'shield';

/** Colore del fascio che lancia (azzurro = energia, arancio = pugni e cannoni, viola = magia). */
export type CameoBeam = 'violet' | 'blue' | 'orange';

/** Un personaggio in scena: colori di corpo, fascia (cintura/accessorio) e capelli. */
export interface CameoMember {
  name: string;
  body: string;
  accent: string;
  hair: string;
  /** Oggetto in mano, se c'è. */
  prop?: 'sword' | 'staff';
}

export interface Cameo {
  id: string;
  group: CameoGroup;
  /** Uno o più personaggi che compaiono insieme come UN solo ospite (i Gentleman sono quattro). */
  members: CameoMember[];
  /** Cosa urla lanciando (comparirà come scritta). */
  shout: string;
  /** La battuta, nel fumetto. */
  line: string;
  beam?: CameoBeam;
  /** Come aiuta (vedi CameoHelp). */
  help?: CameoHelp;
  /** Stile di animazione: `toon` = gomma e rimbalzi (Gear 5), `ship` = una nave che spara (Going Merry). */
  style?: 'toon' | 'ship';
  /** Oltre a ripulire la strada: una piccola cura o qualche metro in meno da Checco. */
  bonus?: 'heal' | 'gap';
  /** Battuta segnaposto da sostituire con quella vera. */
  todo?: boolean;
}

const one = (name: string, body: string, accent: string, hair: string, prop?: CameoMember['prop']): CameoMember => ({ name, body, accent, hair, prop });

export const CAMEOS: readonly Cameo[] = [
  // --- shonen e anime ---
  { id: 'luffy', group: 'shonen', style: 'toon', beam: 'orange', shout: 'GOMU GOMU NO… GEAR 5!', line: 'Diventerò il Re dei Pirati! BOING!', members: [one('Luffy', '#fffbeb', '#ef4444', '#ffffff')] },
  { id: 'zoro', group: 'shonen', help: 'lost', beam: 'orange', shout: 'ONI GIRI!', line: 'Mi sono perso? Ma se la strada era qui un attimo fa!', members: [one('Zoro', '#15803d', '#1f2937', '#16a34a', 'sword')] },
  { id: 'sanji', group: 'shonen', beam: 'orange', shout: 'DIABLE JAMBE!', line: 'Mellorine~! …ehm, attenzione agli ostacoli!', members: [one('Sanji', '#111827', '#2563eb', '#facc15')] },
  { id: 'merry', group: 'shonen', help: 'wide', style: 'ship', beam: 'orange', shout: 'CANNONATA!', line: 'Fuoco a volontà! (la Going Merry scricchiola ma ci sta)', members: [one('Going Merry', '#a16207', '#f8fafc', '#fde68a')] },
  { id: 'tanjiro', group: 'shonen', beam: 'blue', shout: 'RESPIRAZIONE DELL’ACQUA!', line: 'Respirazione dell’Acqua, prima forma!', members: [one('Tanjiro', '#14532d', '#111827', '#7f1d1d', 'sword')] },
  { id: 'kirito', group: 'shonen', beam: 'blue', shout: 'STARBURST STREAM!', line: 'Switch!', members: [one('Kirito', '#0f172a', '#6b7280', '#0b1020', 'sword')] },
  { id: 'asuna', group: 'shonen', beam: 'blue', shout: 'LINEAR!', line: 'Kirito, ti copro io! …dov’è finito Kirito?', members: [one('Asuna', '#f8fafc', '#dc2626', '#f59e0b', 'sword')] },
  { id: 'goku', group: 'shonen', help: 'wide', beam: 'blue', bonus: 'gap', shout: 'KAMEHAMEHA!', line: 'Ehi, qui c’è qualcuno di forte?', members: [one('Goku', '#f97316', '#2563eb', '#111827')] },
  { id: 'vegeta', group: 'shonen', beam: 'blue', shout: 'GALICK HO!', line: 'È più di ottomila!', members: [one('Vegeta', '#2563eb', '#f8fafc', '#111827')] },
  { id: 'trunks', group: 'shonen', beam: 'blue', shout: 'LAMA DEL FUTURO!', line: 'Ho una spada più grossa di me, ma funziona.', members: [one('Trunks', '#1d4ed8', '#fbbf24', '#a78bfa', 'sword')] },
  { id: 'gohan', group: 'shonen', beam: 'blue', shout: 'MASENKO!', line: 'Prima i compiti, poi i cattivi!', members: [one('Gohan', '#6d28d9', '#f8fafc', '#111827')] },
  { id: 'deku', group: 'shonen', beam: 'blue', shout: 'DETROIT SMASH!', line: 'PLUS ULTRA!', members: [one('Deku', '#16a34a', '#dc2626', '#14532d')] },
  { id: 'bakugo', group: 'shonen', beam: 'orange', shout: 'EXPLOSION!', line: 'MORITE! …ma con affetto.', members: [one('Bakugo', '#111827', '#f97316', '#facc15')] },
  { id: 'allmight', group: 'shonen', help: 'wide', beam: 'blue', bonus: 'heal', shout: 'UNITED STATES OF SMASH!', line: 'Non temete: ora ci sono io!', members: [one('All Might', '#2563eb', '#dc2626', '#fde047')] },
  { id: 'shoto', group: 'shonen', beam: 'blue', shout: 'GHIACCIO E FIAMMA!', line: 'Metà ghiaccio, metà fuoco, tutto sarcasmo.', members: [one('Shoto Todoroki', '#e5e7eb', '#ef4444', '#f87171')] },
  { id: 'itadori', group: 'shonen', beam: 'orange', shout: 'PUGNO DIVERGENTE!', line: 'Ci penso io! …il dito di Sukuna lo lascio da parte.', members: [one('Itadori', '#1e3a8a', '#dc2626', '#f9a8d4')] },
  { id: 'gojo', group: 'shonen', help: 'wide', beam: 'violet', shout: 'VUOTO VIOLA!', line: 'Tranquilli: sono il più forte.', members: [one('Gojo', '#0f172a', '#e5e7eb', '#f8fafc')] },
  { id: 'frieren', group: 'shonen', help: 'wide', beam: 'violet', shout: 'ZOLTRAAK!', line: 'Mi sono distratta un attimo: sono passati cinquant’anni.', members: [one('Frieren', '#f4efe6', '#1f2937', '#e5e7eb', 'staff')] },
  // --- videogiochi ---
  { id: 'kratos', group: 'giochi', help: 'shield', beam: 'blue', shout: 'ASCIA LEVIATHAN!', line: 'Ragazzo.', members: [one('Kratos', '#d1d5db', '#7f1d1d', '#d1d5db')] },
  { id: 'atreus', group: 'giochi', beam: 'blue', shout: 'FRECCIA RUNICA!', line: 'Padre, guarda là!', members: [one('Atreus', '#78350f', '#10b981', '#111827')] },
  { id: 'knight', group: 'giochi', beam: 'violet', shout: 'CHIODO!', line: '…', members: [one('Il Cavaliere Vuoto', '#e5e7eb', '#111827', '#e5e7eb', 'sword')] },
  { id: 'raiden', group: 'giochi', beam: 'blue', shout: 'LAMA AD ALTA FREQUENZA!', line: 'Colonnello? Colonnello!', members: [one('Raiden (Player Inside)', '#9ca3af', '#ef4444', '#e5e7eb', 'sword')] },
  { id: 'midna', group: 'giochi', beam: 'violet', shout: 'MAGIA DEL CREPUSCOLO!', line: 'Allora, eroe, ti muovi o no?', members: [one('Midna (Player Inside)', '#111827', '#f97316', '#f97316')] },
  { id: 'maelle', group: 'giochi', beam: 'violet', shout: 'SCHERMA!', line: 'Per chi verrà dopo di noi.', members: [one('Maelle', '#f8fafc', '#991b1b', '#b91c1c', 'sword')] },
  { id: 'verso', group: 'giochi', beam: 'violet', shout: 'LAMA DI ALBA!', line: 'La Spedizione non si ferma qui.', members: [one('Verso', '#111827', '#a16207', '#111827', 'sword')] },
  { id: 'monoco', group: 'giochi', beam: 'violet', shout: 'SALTO FERINO!', line: 'Salto io, salti tu!', members: [one('Monoco', '#a16207', '#facc15', '#d1d5db')] },
  { id: 'esquie', group: 'giochi', help: 'shield', beam: 'blue', bonus: 'heal', shout: 'VOLO!', line: 'Si vola! Salite pure!', members: [one('Esquie', '#7dd3fc', '#f8fafc', '#bae6fd')] },
  { id: 'alba', group: 'giochi', beam: 'violet', shout: 'SPADA E LUPETTO!', line: 'Neva, andiamo!', members: [one('Alba (Neva)', '#dc2626', '#f8fafc', '#f8fafc', 'sword')] },
  { id: 'neva', group: 'giochi', beam: 'violet', shout: 'AUUUU!', line: 'Auuuuuu!', members: [one('Neva', '#e5e7eb', '#f8fafc', '#cbd5e1')] },
  { id: 'journey', group: 'giochi', help: 'shield', beam: 'orange', shout: '♪ CANTO ♪', line: '♪ … ♪', members: [one('Il Viaggiatore (Journey)', '#b91c1c', '#fbbf24', '#7f1d1d')] },
  { id: 'flower', group: 'giochi', help: 'shield', beam: 'violet', shout: 'PETALI!', line: '(un vento di petali ti accompagna)', members: [one('Flower', '#f472b6', '#facc15', '#86efac')] },
  { id: 'flow', group: 'giochi', beam: 'blue', shout: 'FLUSSO!', line: '(blub blub)', members: [one('Flow', '#38bdf8', '#e0f2fe', '#7dd3fc')] },
  // --- streamer e youtuber (battute generiche: da sostituire con le loro vere) ---
  { id: 'favij', group: 'streamer', beam: 'orange', todo: true, shout: 'LIKE E ISCRIZIONE!', line: 'Mettete like e iscrivetevi al canale!', members: [one('Favij', '#2563eb', '#f8fafc', '#92400e')] },
  { id: 'sabaku', group: 'streamer', beam: 'orange', todo: true, shout: 'SUPER CHAT!', line: 'Non dimenticate la campanella!', members: [one('Sabaku', '#eab308', '#111827', '#111827')] },
  { id: 'moccia', group: 'streamer', beam: 'orange', todo: true, shout: 'RAGEQUIT!', line: 'Ragazzi, ma che roba è questa?!', members: [one('Dario Moccia', '#7c3aed', '#f8fafc', '#111827')] },
  { id: 'lollo', group: 'streamer', beam: 'orange', todo: true, shout: 'COLLAB!', line: 'Ci vediamo nel prossimo video!', members: [one('Lollo Lacustre', '#0ea5e9', '#fde047', '#7c2d12')] },
  { id: 'danny', group: 'streamer', beam: 'orange', todo: true, shout: 'TWITCH PRIME!', line: 'Offrite una sub, grazie!', members: [one('Danny Lazzarin', '#16a34a', '#f8fafc', '#292524')] },
  // --- i Gentleman (arrivano insieme) ---
  {
    id: 'gentleman',
    group: 'gentleman',
    help: 'wide',
    beam: 'violet',
    bonus: 'gap',
    todo: true,
    shout: 'UN PO’ DI CONTEGNO!',
    line: 'Signori, un po’ di contegno… e un po’ di sana confusione!',
    members: [
      one('Rhomas', '#1f2937', '#fbbf24', '#111827'),
      one('Hungy', '#7c2d12', '#f8fafc', '#92400e'),
      one('Xmurry', '#0f766e', '#fde68a', '#111827'),
      one('Maurizio Merluzzo', '#9ca3af', '#2563eb', '#e5e7eb')
    ]
  },
  // --- altre squadre (arrivano insieme, come i Gentleman) ---
  {
    id: 'ciurma',
    group: 'squadre',
    help: 'wide',
    beam: 'orange',
    shout: 'CIURMA ALL’ASSALTO!',
    line: 'Si salpa! Chi resta indietro fa il bucato!',
    members: [one('Luffy', '#fffbeb', '#ef4444', '#ffffff'), one('Zoro', '#15803d', '#1f2937', '#16a34a', 'sword'), one('Sanji', '#111827', '#2563eb', '#facc15')]
  },
  {
    id: 'saiyan',
    group: 'squadre',
    help: 'wide',
    beam: 'blue',
    bonus: 'gap',
    shout: 'ATTACCO SAIYAN!',
    line: 'Facciamogli vedere cosa sa fare una famiglia di guerrieri!',
    members: [one('Goku', '#f97316', '#2563eb', '#111827'), one('Vegeta', '#2563eb', '#f8fafc', '#111827'), one('Trunks', '#1d4ed8', '#fbbf24', '#a78bfa', 'sword'), one('Gohan', '#6d28d9', '#f8fafc', '#111827')]
  },
  {
    id: 'classe1a',
    group: 'squadre',
    help: 'wide',
    beam: 'blue',
    bonus: 'heal',
    shout: 'PLUS ULTRA!',
    line: 'Classe 1-A, tutti insieme: PLUS ULTRA!',
    members: [one('Deku', '#16a34a', '#dc2626', '#14532d'), one('Bakugo', '#111827', '#f97316', '#facc15'), one('Shoto Todoroki', '#e5e7eb', '#ef4444', '#f87171'), one('All Might', '#2563eb', '#dc2626', '#fde047')]
  },
  // --- Marvel (ti lasciano lo stile di Thor) ---
  { id: 'thor', group: 'marvel', help: 'wide', beam: 'blue', shout: 'MJOLNIR!', line: 'Chi è degno di questo martello? Io, e anche tu!', members: [one('Thor', '#1e3a8a', '#dc2626', '#fde047', 'staff')] },
  { id: 'ironman', group: 'marvel', beam: 'orange', shout: 'REPULSORI!', line: 'Jarvis, accendi i repulsori. E mettimi un po’ di musica.', members: [one('Iron Man', '#b91c1c', '#fbbf24', '#7f1d1d')] },
  { id: 'spiderman', group: 'marvel', beam: 'blue', shout: 'RAGNATELA!', line: 'Il tuo amichevole Spider-Man di quartiere, in consegna!', members: [one('Spider-Man', '#dc2626', '#1d4ed8', '#dc2626')] },
  { id: 'captain', group: 'marvel', help: 'shield', beam: 'blue', shout: 'SCUDO DI VIBRANIO!', line: 'Posso farlo tutto il giorno.', members: [one('Capitan America', '#1d4ed8', '#f8fafc', '#fde047')] },
  // --- doppiatori (battute da completare con quelle dei personaggi che doppiano) ---
  { id: 'moneta', group: 'doppiatori', beam: 'violet', todo: true, shout: 'VOCE FUORI CAMPO!', line: '(una voce profonda ti dà coraggio)', members: [one('Claudio Moneta', '#374151', '#a78bfa', '#d1d5db')] },
  { id: 'iacono', group: 'doppiatori', beam: 'violet', todo: true, shout: 'VOCE FUORI CAMPO!', line: '(una voce amica ti incoraggia)', members: [one('Gianluca Iacono', '#1d4ed8', '#fde047', '#292524')] },
  { id: 'novara', group: 'doppiatori', beam: 'violet', todo: true, shout: 'VOCE FUORI CAMPO!', line: '(una voce inconfondibile ti spinge avanti)', members: [one('Renato Novara', '#065f46', '#f8fafc', '#78350f')] },
  { id: 'pacotto', group: 'doppiatori', beam: 'violet', todo: true, shout: 'VOCE FUORI CAMPO!', line: '(una voce dolcissima ti dice di non mollare)', members: [one('Emanuela Pacotto', '#be185d', '#fde68a', '#9d174d')] }
];

/** Probabilità che l'ospite sia una SQUADRA (più personaggi insieme: Gentleman, ciurma, Saiyan, classe 1-A) invece di uno solo. */
export const TEAM_CHANCE = 0.35;

/**
 * L'ospite della prossima modalità: una squadra con probabilità `TEAM_CHANCE`, altrimenti un singolo (di qualunque gruppo). Fra le
 * candidate si escludono quelle già comparse di recente (`recent`, gli ultimi id), finché ne restano altre.
 */
export function pickCameo(recent: readonly string[], random: () => number = Math.random): Cameo {
  const teams = random() < TEAM_CHANCE;
  const pool = CAMEOS.filter((cameo) => (cameo.members.length > 1) === teams);
  const fresh = pool.filter((cameo) => !recent.includes(cameo.id));
  const from = fresh.length > 0 ? fresh : pool;
  return from[Math.min(from.length - 1, Math.floor(random() * from.length))];
}

/** Lo stile permanente di ogni ospite (se un id non c'è: «hero», più vita). */
const CAMEO_PERKS: Record<string, readonly PerkId[]> = {
  luffy: ['gear5'], zoro: ['zoro'], sanji: ['speed'], merry: ['magic'], tanjiro: ['speed'], kirito: ['speed'], asuna: ['speed'],
  goku: ['saiyan'], vegeta: ['saiyan'], trunks: ['saiyan'], gohan: ['saiyan'], deku: ['hero'], bakugo: ['speed'], allmight: ['hero'],
  shoto: ['magic'], itadori: ['speed'], gojo: ['magic'], frieren: ['magic'],
  kratos: ['thor'], atreus: ['speed'], knight: ['calm'], raiden: ['speed'], midna: ['magic'], maelle: ['speed'], verso: ['speed'],
  monoco: ['speed'], esquie: ['fly'], alba: ['speed'], neva: ['calm'], journey: ['calm'], flower: ['calm'], flow: ['calm'],
  favij: ['calm'], sabaku: ['calm'], moccia: ['calm'], lollo: ['calm'], danny: ['calm'],
  gentleman: ['gentleman'], ciurma: ['gear5', 'zoro'], saiyan: ['saiyan'], classe1a: ['hero', 'speed'],
  thor: ['thor'], ironman: ['thor'], spiderman: ['thor'], captain: ['thor'],
  moneta: ['hero'], iacono: ['hero'], novara: ['hero'], pacotto: ['hero']
};

/** Gli stili permanenti che lascia questo ospite. */
export function cameoPerks(cameo: Cameo): readonly PerkId[] {
  return CAMEO_PERKS[cameo.id] ?? ['hero'];
}

export function cameoById(id: string): Cameo | undefined {
  return CAMEOS.find((cameo) => cameo.id === id);
}
