import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import gsap from 'gsap';
import { GTA_STATS, RECIPIENT_NAME, TEXTS } from '../birthdayConfig';
import styles from './GtaTableau.module.css';

/**
 * ────────────────────────────────────────────────────────────────────────
 *  I QUATTRO ISTANTI SOTTO SONO MISURATI su `gta.mp3`, non a occhio — stesso
 *  principio già usato per gli sfx di Bloodborne/God of War ("misurati
 *  decodificandoli e guardandone l'inviluppo"), qui sull'intero brano
 *  invece che su un breve effetto: inviluppo di energia (RMS, quanto
 *  "spinge" il brano istante per istante) e attacchi/onset (i colpi netti e
 *  isolati). Primi 15 secondi:
 *
 *    0.00 → 0.53s   silenzio vero (energia a zero, misurato per davvero)
 *    0.53s          il primo colpo — un attacco netto, dei più forti di
 *                   tutta l'apertura
 *    0.53s → ~9.5s  sezione distesa, energia sostenuta e costante
 *    4.39s          l'accento più forte di questa sezione
 *    ~9.5s → ~12s   un calo di energia (quasi dimezzata) — un respiro
 *    12.07s         un colpo isolato proprio a inizio del respiro, sei
 *                   volte più forte della media della sezione
 *    ~12.5s → 13.5s il vero culmine: l'energia risale di colpo al suo
 *                   massimo assoluto, raggiunto esattamente a 13.05s
 *
 *  Restano comunque COSTANTI, non un aggancio automatico al brano: nessun
 *  quadro di questo branch "ascolta" la musica in tempo reale per decidere
 *  quando muovere le cose. Se a schermo E a orecchio un istante sembra
 *  leggermente fuori fase, spostalo di un decimo qui — capita anche con
 *  tempi misurati bene, l'occhio e l'orecchio hanno l'ultima parola.
 * ────────────────────────────────────────────────────────────────────────
 */

/** Il primo colpo: entra il kicker "Mission passed". */
const KICKER_AT = 4.3;
/** Le tre statistiche, a scalare — non tutte insieme. La terza cade
 * esattamente sull'accento più forte della sezione (misurato, non a caso):
 * vale la pena farci coincidere quella più "a effetto" (vedi GTA_STATS in
 * birthdayConfig.ts, oggi "Livello amicizia"). */
const STAT_AT = [5, 6, 7, 8];
/** Quanto dura la "sciabolata" di ingresso di kicker/statistiche — il
 * conteggio dei numeri (sotto) parte dopo che la propria riga si è già
 * scoperta, non subito insieme a lei. */
const REVEAL_DURATION = 0.5;
const COUNT_DELAY_AFTER_REVEAL = 0.1;
/** Il colpo isolato a inizio del "respiro": entra "Buon compleanno". */
const TITLE_AT = 10;
/** Il picco assoluto di tutta l'apertura del brano: entra il nome. */
const NAME_AT = 12.05;

const CONFETTI_COUNT = 70;
const CONFETTI_COLORS = ['#ffd447', '#ff6b6b', '#4ecdc4', '#a78bfa', '#f8fafc', '#ff9f43'];

const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Props {
  active: boolean;
}

/**
 * Quadro 6 — il finale, in stile "mission passed", ora scandito in quattro
 * tempi sui colpi reali di `gta.mp3` (vedi il blocco di commenti sopra):
 * silenzio grafico, obiettivi (kicker + tre statistiche a scalare), "Buon
 * compleanno" sul colpo isolato del respiro, il nome sul culmine assoluto
 * del brano. Prima di questo non esisteva nessuna scaletta: tutto compariva
 * insieme nel `fadeIn` del quadro, fermo, coi soli NUMERI delle statistiche
 * già sfalsati.
 *
 * Tre pesi diversi per tre momenti diversi, che si intensificano avvicinandosi
 * al nome: un taglio netto (`clip-path` che si apre da sinistra, come una
 * sciabolata) per kicker/statistiche; un piccolo impatto con rimbalzo per il
 * titolo; per il nome — il colpo più forte — lo stesso impatto più marcato,
 * un lampo centrato dietro al testo, e un breve sdoppiamento cromatico
 * rosso/ciano che si ricompone in una manciata di fotogrammi, come un
 * "glitch di trasmissione" da trailer: l'unico epilogo della sequenza si
 * prende un linguaggio un po' suo, gli altri quadri restano più "in camera".
 *
 * Ogni pezzo che ha una propria animazione d'ingresso prende la classe
 * `*Active` SOLO quando `active` è vero — mai un'animazione sempre accesa
 * dal mount: i sei quadri sono montati tutti insieme fin dal caricamento
 * della pagina, e per l'ultimo della sequenza un `animation-delay` contato
 * dal mount sarebbe scaduto da un pezzo prima ancora che il quadro diventi
 * quello a schermo (stesso principio già in uso per `.bgImageActive` qui
 * sotto e per la falena di Hollow Knight altrove nel branch).
 */
export function GtaTableau({ active }: Props) {
  const valueRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const confetti = useMemo(() => {
    if (prefersReducedMotion()) return [];
    return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 1.6}s`,
      duration: `${2.4 + Math.random() * 2.6}s`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      width: `${5 + Math.random() * 6}px`,
      height: `${9 + Math.random() * 8}px`,
      tilt: `${Math.random() * 360}deg`
    }));
  }, []);

  useEffect(() => {
    if (!active) return;

    if (prefersReducedMotion()) {
      // Niente conteggio: i valori finali compaiono e basta.
      GTA_STATS.forEach((stat, i) => {
        const node = valueRefs.current[i];
        if (node) node.textContent = `${stat.to}${stat.suffix ?? ''}`;
      });
      return;
    }

    const tweens = GTA_STATS.map((stat, i) => {
      const counter = { value: stat.from };
      return gsap.to(counter, {
        value: stat.to,
        duration: 1.5,
        // Parte DOPO che la propria riga si è scoperta (vedi STAT_AT sopra),
        // non subito all'apertura del quadro come faceva prima.
        delay: (STAT_AT[i] ?? 0) + REVEAL_DURATION + COUNT_DELAY_AFTER_REVEAL,
        ease: 'power2.out',
        onUpdate: () => {
          const node = valueRefs.current[i];
          if (node) node.textContent = `${Math.round(counter.value)}${stat.suffix ?? ''}`;
        }
      });
    });

    return () => {
      tweens.forEach((tween) => tween.kill());
    };
  }, [active]);

  const timing = {
    '--kicker-at': `${KICKER_AT}s`,
    '--title-at': `${TITLE_AT}s`,
    '--name-at': `${NAME_AT}s`
  } as CSSProperties;

  return (
    <div className={styles.root} style={timing}>
      {/* Slot opzionale: resta trasparente se il file manca, il gradiente
          sotto fa comunque da base. */}
      <div className={`${styles.bgImage} ${active ? styles.bgImageActive : ''}`} />

      {/* Vampata bianca brevissima, il "sipario che si apre" — resta
          all'istante zero anche con la nuova scaletta: sta bene anche prima
          che compaia il primo testo. Un <span> a schermo intero che sfuma
          via in fretta — nessun nuovo asset. Rimontata da zero a ogni volta
          che `active` torna true (key sul valore stesso) così l'animazione
          riparte anche se il quadro venisse rivisitato. */}
      {active && <span key="flash" aria-hidden="true" className={styles.flash} />}

      {/* Il "premio" arriva col vero traguardo, non prima: la vecchia
          versione faceva partire i coriandoli insieme al flash, all'istante
          zero — prima ancora che ci fosse qualcosa da festeggiare a
          schermo. Ora l'esplosione coincide con la comparsa del nome
          (NAME_AT), il culmine sia musicale che della sequenza. */}
      {active &&
        confetti.map((piece) => (
          <span
            key={piece.id}
            className={styles.confetto}
            style={{
              left: piece.left,
              width: piece.width,
              height: piece.height,
              background: piece.color,
              animationDelay: `calc(${NAME_AT}s + ${piece.delay})`,
              animationDuration: piece.duration,
              rotate: piece.tilt
            }}
          />
        ))}

      <div className={styles.content}>
        <span className={`${styles.kicker} ${active ? styles.kickerActive : ''}`}>Mission passed</span>

        <ul className={styles.stats}>
          {GTA_STATS.map((stat, i) => (
            <li
              key={stat.label}
              className={`${styles.statRow} ${active ? styles.statRowActive : ''}`}
              style={{ animationDelay: `${STAT_AT[i] ?? 0}s` }}
            >
              <span className={styles.statLabel}>{stat.label}</span>
              <span
                className={styles.statValue}
                ref={(node) => {
                  valueRefs.current[i] = node;
                }}
              >
                {stat.from}
                {stat.suffix ?? ''}
              </span>
            </li>
          ))}
        </ul>

        {/* "Buon compleanno" e il nome, due elementi indipendenti (prima
            vivevano nello stesso <h1>): compaiono in due momenti separati,
            ciascuno con la propria animazione — non si può sfalsare
            l'ingresso di due pezzi che sono lo stesso nodo di testo. */}
        <h1 className={styles.title}>
          <span className={`${styles.titleLine} ${active ? styles.titleLineActive : ''}`}>{TEXTS.gtaTitle},</span>
          <span className={styles.nameWrap}>
            {/* Lampo centrato dietro al nome, non a schermo intero come il
                flash d'apertura: qui deve leggersi come un colpo dietro
                QUESTO testo, non un secondo sipario. */}
            <span aria-hidden="true" className={`${styles.nameFlash} ${active ? styles.nameFlashActive : ''}`} />
            <span className={`${styles.name} ${active ? styles.nameActive : ''}`}>{RECIPIENT_NAME}</span>
          </span>
        </h1>
      </div>
    </div>
  );
}
