/* Listes de mots par défaut — modifiables ensuite dans Réglages (espace parents).
   Format d'une semaine : [titre, {n: noms, a: adjectifs, v: [[infinitif, formes...]]}, phrases] */
'use strict';

const DEFAULT_INVARIANTS = ["à","là","déjà","jusqu'à","en","entre","encore","ensuite","enfin","comme","comment","vraiment","souvent","mais","jamais","bien"];

/* Phrases indices : elles aident à distinguer les mots qui se prononcent pareil (à / a, ses / ces…). */
const DEFAULT_CTX = {
  "à": "Je vais à l'école.", "là": "Le chat est là.", "en": "Je pars en vacances.", "mais": "Il est petit mais fort.",
  "comme": "Il court comme un lapin.", "comment": "Comment vas-tu ?", "entre": "Il est assis entre ses amis.", "bien": "Tu as bien travaillé.",
  "jamais": "Je ne mens jamais.", "déjà": "Il a déjà fini.", "jusqu'à": "Je compte jusqu'à dix.", "encore": "Je veux encore jouer.",
  "souvent": "Je lis souvent.", "enfin": "Enfin les vacances !", "ensuite": "Je mange, ensuite je joue.", "vraiment": "C'est vraiment beau.",
  "c'est": "C'est la rentrée.", "il est": "Il est content.", "il a": "Il a un cartable.", "il y a": "Il y a des exercices.",
  "ses amis": "Il joue avec ses amis.", "mes amis": "Je joue avec mes amis.", "des amis": "J'invite des amis.",
  "son anniversaire": "Il fête son anniversaire.", "mon anniversaire": "Je fête mon anniversaire.",
  "mon équipe": "Je joue avec mon équipe.", "ton équipe": "Tu joues avec ton équipe.", "notre équipe": "Nous jouons avec notre équipe.",
  "la date": "La maitresse écrit la date.", "du sport": "Je fais du sport.", "le sport": "J'aime le sport.",
  "tu fêtais": "Hier, tu fêtais ton anniversaire.", "il fêtait": "Hier, il fêtait son anniversaire.", "ils fêtaient": "Hier, ils fêtaient Noël.",
  "je pleurais": "Hier, je pleurais.", "tu pleurais": "Hier, tu pleurais.", "j'aimais": "Avant, j'aimais le sport.", "tu aimais": "Avant, tu aimais le sport.",
  "il fête": "Il fête son anniversaire.", "je fête": "Je fête mon anniversaire.", "il donne": "Il donne un cadeau.", "je donne": "Je donne un cadeau.",
  "il souffle": "Il souffle les bougies.", "je souffle": "Je souffle les bougies.", "elle mange": "Elle mange un gâteau.",
  "fort": "Le loup est fort.", "forte": "La colère est forte.", "joyeux": "Un joyeux anniversaire.", "joyeuse": "Une fête joyeuse."
};

const RAW_PERIODS = [
  { name: "Période 1", bilan: "2026-10-16", weeks: [
    ["La rentrée", { n: ["la rentrée","un cartable","un cahier","des cahiers"], v: [["être","il est","c'est"],["avoir","il a"]] },
      ["C'est la rentrée.","Il a un cartable et un cahier.","Il est content."]],
    ["La maitresse", { n: ["la maitresse","la date","le tableau","un élève","des élèves"], v: [["écrire","elle écrira","ils écrivent"],["noter","elle note"]] },
      ["La maitresse note la date au tableau.","Les élèves écrivent la date.","Elle écrira au tableau."]],
    ["Les matières", { n: ["la classe","l'écriture","des calculs","les mathématiques","le français","du sport"], v: [["faire","elle fera","ils feront"]] },
      ["Elle fera des calculs.","Ils feront du sport et du français."]],
    ["Les consignes", { n: ["une règle","la consigne","les consignes"], v: [["écrire","nous écrivons"],["souligner","nous soulignons"],["entourer","nous entourons"]] },
      ["Nous écrivons la consigne.","Nous soulignons avec une règle.","Nous entourons les consignes."]],
    ["Le calcul", { n: ["les tables","le calcul","les calculs"], v: [["mémoriser","elle mémorise","nous mémorisons","ils mémorisent"],["calculer","elle calcule","nous calculons"]] },
      ["Elle mémorise les tables.","Nous calculons encore.","Ils mémorisent le calcul."]],
    ["La classe", { n: ["une classe","des classes","l'école","un maître","un exercice","des exercices","un cahier","des cahiers"], v: [["avoir","il y a"]] },
      ["Il y a des exercices dans un cahier.","Un maître entre dans l'école."]]
  ]},
  { name: "Période 2", bilan: "2026-12-18", weeks: [
    ["L'anniversaire (1)", { n: ["mon anniversaire","son anniversaire","un gâteau","des gâteaux","mes amis","ses amis","des amis"], v: [["fêter","je fête","il fête","nous fêtons"],["manger","elle mange","nous mangeons","ils mangent"]] },
      ["Nous fêtons mon anniversaire.","Elle mange un gâteau avec ses amis.","Ils mangent des gâteaux."]],
    ["L'anniversaire (2)", { n: ["une bougie","des bougies","un cadeau","des cadeaux"], a: ["joyeux","joyeuse"], v: [["souffler","je souffle","il souffle","nous soufflons"],["donner","je donne","il donne","ils donnent"]] },
      ["Je souffle les bougies.","Il donne un cadeau à son ami.","Ils donnent des cadeaux.","Elle est joyeuse."]],
    ["L'anniversaire (imparfait)", { n: ["la famille","une invitation"], v: [["fêter","tu fêtais","il fêtait","nous fêtions","ils fêtaient"],["inviter","tu invitais","elle invitait","ils invitaient"],["envoyer","tu envoyais","elle envoyait","nous envoyions","ils envoyaient"]] },
      ["Tu invitais toute la famille.","Elle envoyait une invitation à ses amis.","Nous fêtions son anniversaire.","Ils envoyaient des cadeaux."]],
    ["Les émotions (1)", { n: ["la joie","la peur","la colère","le sport","mon équipe","ton équipe","notre équipe"], v: [["aimer","j'aimais","tu aimais","nous aimions"],["pleurer","je pleurais","tu pleurais","nous pleurions"]] },
      ["J'aimais le sport avec mon équipe.","Tu pleurais de colère.","Nous pleurions de joie.","Nous aimions notre équipe."]],
    ["Les émotions (2)", { n: ["le loup","les loups","les enfants"], a: ["surpris","fort"], v: [["sembler","tu semblais","nous semblions","vous sembliez","ils semblaient"],["entendre","tu entendais","nous entendions","vous entendiez","ils entendaient"]] },
      ["Les enfants entendaient le loup.","Tu semblais surpris.","Nous entendions les loups.","Vous sembliez fort."]],
    ["Bilan émotions", { n: ["la joie","la peur","la colère","la frayeur","les émotions"], a: ["agréable","désagréable","forte"], v: [["exprimer","tu exprimes","il exprime","nous exprimons","vous exprimez"]] },
      ["Tu exprimes ta joie.","Nous exprimons nos émotions.","La peur est désagréable.","Il exprime une forte colère."]]
  ]}
];

function defaultSettings() {
  return { childName: "Valentin", buddyName: "Draco", rate: 0.8, voice: "", includeInvariants: true,
           sessionLength: 10, dictationLength: 10, challengeSeconds: 60, parentGate: true,
           sounds: true, useRecordings: true, bossUnlocked: false };
}

/* Mise à niveau des données enregistrées par une version précédente de l'appli. */
function migrateData(d) {
  const bilans = { "Période 1": "2026-10-16", "Période 2": "2026-12-18" };
  d.periods.forEach(p => { if (p.bilan === undefined) p.bilan = bilans[p.name] || ""; });
  if (!d.ctx) d.ctx = { ...DEFAULT_CTX };
  d.version = 5;
  return d;
}

function buildDefaultData() {
  const id = () => Math.random().toString(36).slice(2, 9);
  const periods = RAW_PERIODS.map(p => ({
    id: id(), name: p.name, bilan: p.bilan || "",
    weeks: p.weeks.map(([title, g, phrases]) => ({
      id: id(), title,
      words: [
        ...(g.n || []).map(w => ({ w, k: "nom" })),
        ...(g.a || []).map(w => ({ w, k: "adjectif" })),
        ...(g.v || []).flatMap(([inf, ...forms]) => forms.map(w => ({ w, k: "verbe", h: inf })))
      ],
      phrases: phrases || []
    }))
  }));
  // Valentin en est à la période 2, semaine 4.
  return { version: 5, periods, invariants: [...DEFAULT_INVARIANTS], ctx: { ...DEFAULT_CTX },
           current: { period: periods[1].id, week: periods[1].weeks[3].id }, settings: defaultSettings() };
}
