"use strict";

// ============================================================
// VARIABLES GLOBALES
// ============================================================
let puzzle, autoStart;
let playing;
let gameStarted = false;
let useMouse = true;
let lastMousePos;
let ui; // Interface utilisateur (éléments HTML)

const fileExtension = ".puzz";
const fileSignature = "cpzfilecct"; // Signature pour valider les fichiers de sauvegarde

// Raccourcis Math
const mhypot = Math.hypot,
  mrandom = Math.random,
  mmax = Math.max,
  mmin = Math.min,
  mround = Math.round,
  mfloor = Math.floor,
  mceil = Math.ceil,
  msqrt = Math.sqrt,
  mabs = Math.abs,
  msin = Math.sin,
  mcos = Math.cos,
  mPI = Math.PI;

// Matrices de rotation (prédéfinies selon le nombre de pas)
const MAT30 = new DOMMatrixReadOnly([mcos(mPI/6), msin(mPI/6), -msin(mPI/6), mcos(mPI/6), 0, 0]);
const MAT45 = new DOMMatrixReadOnly([mcos(mPI/4), msin(mPI/4), -msin(mPI/4), mcos(mPI/4), 0, 0]);
const MAT60 = new DOMMatrixReadOnly([mcos(mPI/3), msin(mPI/3), -msin(mPI/3), mcos(mPI/3), 0, 0]);
const MAT90 = new DOMMatrixReadOnly([0, 1, -1, 0, 0, 0]);
const MAT180 = new DOMMatrixReadOnly([-1, 0, 0, -1, 0, 0]);
const MAT120 = MAT90.multiply(MAT30);
const MAT135 = MAT90.multiply(MAT45);
const MAT150 = MAT90.multiply(MAT60);
const MAT210 = MAT180.multiply(MAT30);
const MAT225 = MAT180.multiply(MAT45);
const MAT240 = MAT180.multiply(MAT60);
const MAT270 = MAT180.multiply(MAT90);
const MAT300 = MAT270.multiply(MAT30);
const MAT315 = MAT270.multiply(MAT45);
const MAT330 = MAT270.multiply(MAT60);

const MATS180 = [, MAT180];
const MATS120 = [, MAT120, MAT240];
const MATS90 = [, MAT90, MAT180, MAT270];
const MATS60 = [, MAT60, MAT120, MAT180, MAT240, MAT300];
const MATS45 = [, MAT45, MAT90, MAT135, MAT180, MAT225, MAT270, MAT315];
const MATS30 = [, MAT30, MAT60, MAT90, MAT120, MAT150, MAT180, MAT210, MAT240, MAT270, MAT300, MAT330];
const MATS = [, MATS180, MATS120, MATS90, MATS60, MATS45, MATS30];

// ============================================================
// CHRONOMÈTRE
// ============================================================
class Chronometre {
  constructor() {
    this.tempsEcoule = 0;      // temps en millisecondes
    this.enCours = false;      // indicateur de marche
    this.timerInterval = null;
    this.tempsDepart = null;
  }

  demarrer() {
    if (this.enCours) return;
    this.enCours = true;
    this.tempsDepart = Date.now() - this.tempsEcoule;
    this.timerInterval = setInterval(() => {
      this.tempsEcoule = Date.now() - this.tempsDepart;
      this.afficherTemps();
    }, 100);
  }

  arreter() {
    if (!this.enCours) return;
    this.enCours = false;
    clearInterval(this.timerInterval);
  }

  reinitialiser() {
    this.arreter();
    this.tempsEcoule = 0;
    this.tempsDepart = null;
    this.afficherTemps();
  }

  afficherTemps() {
    const el = document.getElementById('timer-time');
    if (el) el.textContent = this.obtenirTempsFormate();
  }

  obtenirTempsFormate() {
    const totalSec = Math.floor(this.tempsEcoule / 1000);
    const minutes = Math.floor(totalSec / 60);
    const secondes = totalSec % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secondes).padStart(2, '0')}`;
  }
}
const chronometre = new Chronometre();

// ============================================================
// FONCTIONS UTILITAIRES
// ============================================================
function alea(min, max) {
  if (typeof max == "undefined") return min * mrandom();
  return min + (max - min) * mrandom();
}
function intAlea(min, max) {
  if (typeof max == "undefined") { max = min; min = 0; }
  return mfloor(min + (max - min) * mrandom());
}
function lerp(p0, p1, alpha) {
  return { x: p0.x * (1 - alpha) + p1.x * alpha, y: p0.y * (1 - alpha) + p1.y * alpha };
}
function arrayShuffle(array) {
  let k1, temp;
  for (let k = array.length - 1; k >= 1; --k) {
    k1 = puzzle.prng.intAlea(0, k + 1);
    temp = array[k];
    array[k] = array[k1];
    array[k1] = temp;
  }
  return array;
}

// Générateur pseudo-aléatoire reproductible (seed)
function mMash(seed) {
  let n = 0xefc8249d;
  let intSeed = (seed || Math.random()).toString();
  function mash(data) {
    if (data) {
      data = data.toString();
      for (let i = 0; i < data.length; i++) {
        n += data.charCodeAt(i);
        let h = 0.02519603282416938 * n;
        n = h >>> 0;
        h -= n;
        h *= n;
        n = h >>> 0;
        h -= n;
        n += h * 0x100000000;
      }
      return (n >>> 0) * 2.3283064365386963e-10;
    } else n = 0xefc8249d;
  }
  mash(intSeed);
  let mmash = () => mash("A");
  mmash.reset = () => { mash(); mash(intSeed); };
  Object.defineProperty(mmash, "seed", { get: () => intSeed });
  mmash.intAlea = function(min, max) {
    if (typeof max == "undefined") { max = min; min = 0; }
    return mfloor(min + (max - min) * this());
  };
  mmash.alea = function(min, max) {
    if (typeof max == "undefined") return min * this();
    return min + (max - min) * this();
  };
  return mmash;
}

// Sauvegarde dans un fichier (téléchargement direct, universel)
async function saveFile(data, fileName) {
  download(data, fileName, { mediaType: "text/plain;charset=utf8", preEncoded: false });
}
function download(data, fileName, options = {}) {
  let mediaType = options.mediaType || "";
  let preEncoded = options.preEncoded || false;
  if (!preEncoded) data = encodeURIComponent(data);
  let a = document.createElement("a");
  a.setAttribute("href", "data:" + mediaType + "," + data);
  a.setAttribute("download", fileName);
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Fenêtre modale personnalisée
class Modal {
  constructor(properties) {
    let modal = document.createElement("dialog");
    modal.style.borderRadius = "5px";
    if (properties.lines) {
      properties.lines.forEach(line => {
        const p = document.createElement("p");
        p.append(line);
        modal.append(p);
      });
    }
    if (properties?.buttons?.length > 0) {
      const p = document.createElement("p");
      modal.append(p);
      p.style.display = "flex";
      p.style.justifyContent = "center";
      properties.buttons.forEach(btn => {
        const button = document.createElement("button");
        button.innerText = btn.text || "button";
        button.style.margin = "0 1em";
        button.addEventListener("click", () => {
          modal.remove();
          if (btn.callback) btn.callback();
        });
        p.append(button);
      });
    } else {
      modal.addEventListener("click", () => modal.remove());
    }
    document.body.append(modal);
    modal.showModal();
  }
}
function popup(lines) {
  new Modal({ lines, buttons: [{ text: "OK" }] });
}

// ============================================================
// INTERFACE UTILISATEUR (MENU)
// ============================================================
function prepareUI() {
  let menu = document.getElementById("menu");
  let controls = document.getElementById("controls");
  ui = {};
  ["default","load","rotationstep","shape","nbpieces","start","stop",
   "helpstorage","save","restore","helpfile","fsave","frestore","help",
   "saveas","saveext","drawmode","show"].forEach(id => ui[id] = document.getElementById(id));

  // Gestion du menu (bascule uniquement du contenu, pas du bouton)
  function openMenu() {
    menu.classList.remove("hidden");
    controls.textContent = "close controls";
  }
  function closeMenu() {
    menu.classList.add("hidden");
    controls.textContent = "open controls";
  }
  ui.open = openMenu;
  ui.close = closeMenu;

  // Initialisation du texte
  controls.textContent = menu.classList.contains("hidden") ? "open controls" : "close controls";

  // Gestionnaire de clic
  controls.onclick = () => {
    if (menu.classList.contains("hidden")) {
      menu.classList.remove("hidden");
      controls.textContent = "close controls";
    } else {
      menu.classList.add("hidden");
      controls.textContent = "open controls";
    }
  };

  ui.waiting = () => {
    ui.default.disabled = false;
    ui.load.disabled = false;
    ui.shape.disabled = false;
    ui.nbpieces.disabled = false;
    ui.rotationstep.disabled = false;
    ui.start.disabled = false;
    ui.stop.disabled = true;
    ui.save.disabled = true;
    ui.restore.disabled = false;
    ui.fsave.disabled = true;
    ui.frestore.disabled = false;
    ui.show.disabled = true;
  };
  ui.playing = () => {
    ui.default.disabled = true;
    ui.load.disabled = true;
    ui.shape.disabled = true;
    ui.nbpieces.disabled = true;
    ui.rotationstep.disabled = true;
    ui.start.disabled = true;
    ui.stop.disabled = false;
    ui.save.disabled = false;
    ui.restore.disabled = true;
    ui.fsave.disabled = false;
    ui.frestore.disabled = true;
    ui.show.disabled = false;
  };

  ui.saveext.innerHTML = fileExtension;
  ui.default.addEventListener("click", loadInitialFile);
  ui.load.addEventListener("click", loadFile);
  ui.start.addEventListener("click", startGame);
  ui.stop.addEventListener("click", confirmStop);
  ui.save.addEventListener("click", () => events.push({ event: "save" }));
  ui.restore.addEventListener("click", () => events.push({ event: "restore" }));
  ui.fsave.addEventListener("click", () => events.push({ event: "save", file: true }));
  ui.frestore.addEventListener("click", () => { loadSaved(); events.push({ event: "restore", file: true }); });
  ui.help.addEventListener("click", () => popup(helptext));
  ui.helpstorage.addEventListener("click", () => popup(helpstoragetext));
  ui.helpfile.addEventListener("click", () => popup(helpfiletext));
  ui.show.addEventListener("click", () => puzzle.showImage(true));
}

const helptext = [
  "Bienvenue dans ce jeu de puzzle !",
  "",
  "1. Pour commencer :",
  "   - Chargez une image depuis votre ordinateur (bouton 'load image') ou utilisez l'image par défaut.",
  "   - Choisissez le nombre de pièces (approximatif, selon les dimensions de l'image).",
  "   - Sélectionnez le style de découpe des pièces (classique, triangle, polygonal, etc.).",
  "   - Choisissez le pas de rotation (aucune rotation, 2, 3, 4, 6, 8 ou 12 positions par tour).",
  "   - Cliquez sur 'start game' pour lancer la partie.",
  "",
  "2. Jouer :",
  "   - Déplacez une pièce en la glissant (souris ou doigt).",
  "   - Pour faire pivoter une pièce : cliquez (ou touchez) brièvement sur la pièce. Maintenez la touche Shift enfoncée pour tourner dans l'autre sens.",
  "   - Les pièces se collent automatiquement si elles sont parfaitement ajustées (même orientation et bords complémentaires).",
  "   - Déplacez l'ensemble du puzzle en glissant sur le fond (en dehors des pièces).",
  "   - Zoomez avec la molette de la souris ou le pincement à deux doigts. Sur ordinateur, utilisez Ctrl + ou Ctrl -.",
  "",
  "3. Sauvegarde et restauration :",
  "   - Sauvegarde dans le navigateur (stockage local) : rapide mais un seul jeu possible. Évite les très grandes images.",
  "   - Sauvegarde dans un fichier .puzz : télécharge le fichier, vous pouvez le restaurer plus tard.",
  "   - Donnez un nom dans le champ 'save name' avant d'utiliser la sauvegarde fichier.",
  "",
  "4. Autres options :",
  "   - 'show image' : affiche l'image entière (cliquez pour revenir au puzzle).",
  "   - 'between connected pieces' : style des traits entre pièces (ligne fine, plat, biseauté).",
  "",
  "Amusez-vous bien !"
];
const helpstoragetext = [
  "Sauvegarde dans le navigateur (stockage local) :",
  "   • Un simple clic suffit pour sauvegarder ou restaurer.",
  "   • Un seul jeu peut être stocké à la fois (le précédent est écrasé).",
  "   • Cette méthode est rapide mais peut échouer avec des images locales de plus de quelques Mégaoctets.",
  "   • Elle n'est pas disponible sur certains appareils ou navigateurs.",
  "   • Si la sauvegarde échoue, utilisez plutôt la sauvegarde dans un fichier."
];
const helpfiletext = [
  "Sauvegarde dans un fichier :",
  "   • Le jeu est enregistré dans un fichier avec l'extension .puzz que vous pouvez télécharger.",
  "   • Donnez un nom dans le champ 'save name' avant d'enregistrer (le nom est automatiquement proposé à partir de l'image).",
  "   • Pour restaurer, choisissez le fichier .puzz précédemment sauvegardé.",
  "   • Cette méthode fonctionne sur tous les navigateurs et pour toutes les images, quelle que soit leur taille.",
  "   • Vous pouvez conserver plusieurs sauvegardes en utilisant des noms différents."
];

// ============================================================
// CLASSES GÉOMÉTRIQUES (Delaunay, pièces)
// ============================================================
class SortedArray {
  constructor(fCompar, keepDuplicates = false) {
    this.tb = [];
    this.fCompar = fCompar;
    this.keepDuplicates = keepDuplicates;
  }
  indexOf(thing) {
    this.thing = thing;
    if (this.tb.length == 0) { this.insertAt = 0; return -1; }
    let a = 0, c = this.tb.length - 1, b, cmp;
    do {
      b = Math.floor((a + c) / 2);
      cmp = this.fCompar(this.tb[b], thing);
      if (cmp < 0) {
        if (b == c) { this.insertAt = c + 1; return -1; }
        if (a == b) ++b;
        a = b;
      } else if (cmp == 0) {
        this.insertAt = b;
        return b;
      } else {
        if (b == a) { this.insertAt = a; return -1; }
        c = b;
      }
    } while (true);
  }
  doInsert() { this.tb.splice(this.insertAt, 0, this.thing); }
  insert(thing) {
    if (this.indexOf(thing) != -1 && !this.keepDuplicates) return;
    this.tb.splice(this.insertAt, 0, thing);
  }
}
class Edge {
  constructor(p0, p1) {
    if (p0.kp <= p1.kp) { this.p0 = p0; this.p1 = p1; }
    else { this.p0 = p1; this.p1 = p0; }
    this.tris = [];
  }
  attachTriangle(tri) {
    if (!this.p0.tris.includes(tri)) this.p0.tris.push(tri);
    if (!this.p1.tris.includes(tri)) this.p1.tris.push(tri);
    if (!this.p0.edges.includes(this)) this.p0.edges.push(this);
    if (!this.p1.edges.includes(this)) this.p1.edges.push(this);
    if (tri.a == this.p0) {
      if (tri.b == this.p1) { this.tris[0] = tri; tri.edges[0] = this; }
      else { this.tris[1] = tri; tri.edges[2] = this; }
    } else if (tri.b == this.p0) {
      if (tri.c == this.p1) { this.tris[0] = tri; tri.edges[1] = this; }
      else { this.tris[1] = tri; tri.edges[0] = this; }
    } else if (tri.c == this.p0) {
      if (tri.a == this.p1) { this.tris[0] = tri; tri.edges[2] = this; }
      else { this.tris[1] = tri; tri.edges[1] = this; }
    }
  }
}
class Triangle {
  constructor(a, b, c) {
    this.a = a; this.b = b; this.c = c;
    this.vertices = [a, b, c];
    const m11 = 2*(b.x - a.x), m21 = 2*(c.x - a.x);
    const m12 = 2*(b.y - a.y), m22 = 2*(c.y - a.y);
    const c1 = b.x*b.x - a.x*a.x + b.y*b.y - a.y*a.y;
    const c2 = c.x*c.x - a.x*a.x + c.y*c.y - a.y*a.y;
    const det = m11*m22 - m21*m12;
    this.xc = (c1*m22 - c2*m12)/det;
    this.yc = (m11*c2 - m21*c1)/det;
    this.r = Math.hypot(this.xc - a.x, this.yc - a.y);
  }
  inCircumCircle(p) { return Math.hypot(p.x - this.xc, p.y - this.yc) < this.r; }
  hasEdge(p1, p2) {
    return (p1 == this.a || p1 == this.b || p1 == this.c) &&
           (p2 == this.a || p2 == this.b || p2 == this.c);
  }
  listTris() {
    let other;
    this.tris = [];
    this.edges.forEach((edge, kEdge) => {
      other = edge.tris[0] == this ? edge.tris[1] : edge.tris[0];
      if (other) this.tris[kEdge] = other;
    });
  }
}
class Delaunay {
  constructor(points, rect) {
    let triangulation, badTriangles, polygon;
    const pts = points;
    pts.forEach((p, kp) => p.kp = kp);
    this.points = pts;
    let supert = [
      { x: rect.p0.x - 1, y: 2*rect.p1.y - rect.p0.y + 3 },
      { x: rect.p0.x - 1, y: rect.p0.y - 1 },
      { x: 2*rect.p1.x - rect.p0.x + 3, y: rect.p0.y - 1 }
    ];
    triangulation = [new Triangle(...supert)];
    for (let kp = 0; kp < pts.length; ++kp) {
      let point = pts[kp];
      badTriangles = [];
      for (let kt = 0; kt < triangulation.length; ++kt) {
        if (triangulation[kt].inCircumCircle(point)) badTriangles.push(triangulation[kt]);
      }
      polygon = [];
      for (let kt = 0; kt < badTriangles.length; ++kt) {
        let tri = badTriangles[kt];
        if (!badTriangles.some(ot => ot !== tri && ot.hasEdge(tri.a, tri.b))) polygon.push([tri.a, tri.b]);
        if (!badTriangles.some(ot => ot !== tri && ot.hasEdge(tri.b, tri.c))) polygon.push([tri.b, tri.c]);
        if (!badTriangles.some(ot => ot !== tri && ot.hasEdge(tri.c, tri.a))) polygon.push([tri.c, tri.a]);
      }
      for (let kt = 0; kt < badTriangles.length; ++kt) {
        let tri = badTriangles[kt];
        triangulation.splice(triangulation.indexOf(tri), 1);
      }
      polygon.forEach(edge => triangulation.push(new Triangle(point, edge[0], edge[1])));
    }
    for (let kt = triangulation.length-1; kt >= 0; --kt) {
      let tri = triangulation[kt];
      if (supert.includes(tri.a) || supert.includes(tri.b) || supert.includes(tri.c))
        triangulation.splice(kt,1);
    }
    this.triangulation = triangulation;
  }
  analyze() {
    this.points.forEach(p => { p.tris = []; p.edges = []; });
    this.triangulation.forEach(tri => tri.edges = []);
    this.edgesList = new SortedArray((e0, e1) => {
      if (e0.p0.kp - e1.p0.kp) return e0.p0.kp - e1.p0.kp;
      else return e0.p1.kp - e1.p1.kp;
    });
    this.triangulation.forEach(tri => {
      let ed = new Edge(tri.a, tri.b);
      let kedge = this.edgesList.indexOf(ed);
      if (kedge == -1) this.edgesList.doInsert();
      else ed = this.edgesList.tb[kedge];
      ed.attachTriangle(tri);
      ed = new Edge(tri.b, tri.c);
      kedge = this.edgesList.indexOf(ed);
      if (kedge == -1) this.edgesList.doInsert();
      else ed = this.edgesList.tb[kedge];
      ed.attachTriangle(tri);
      ed = new Edge(tri.c, tri.a);
      kedge = this.edgesList.indexOf(ed);
      if (kedge == -1) this.edgesList.doInsert();
      else ed = this.edgesList.tb[kedge];
      ed.attachTriangle(tri);
    });
    this.points.forEach(p => {
      const newEdges = [], newTris = [];
      let edge0, tri;
      if (p.tris.length != p.edges.length) {
        edge0 = p.edges.find(edge => (edge.p0 == p && edge.tris[0] && !edge.tris[1]) ||
                                     (edge.p1 == p && edge.tris[1] && !edge.tris[0]));
        if (edge0 === undefined) edge0 = p.edges[0];
      } else edge0 = p.edges[0];
      while (true) {
        newEdges.push(edge0);
        tri = edge0.tris[edge0.p0 == p ? 0 : 1];
        if (tri === undefined) break;
        newTris.push(tri);
        if (newEdges.length == p.edges.length) break;
        switch (p) {
          case tri.a: edge0 = tri.edges[2]; break;
          case tri.b: edge0 = tri.edges[0]; break;
          case tri.c: edge0 = tri.edges[1]; break;
        }
      }
      p.tris = newTris;
      p.edges = newEdges;
    });
  }
}
class RdPoint {
  constructor(parent, x, y) {
    this.x = x; this.y = y;
    this.kx = Math.floor((x - parent.rect.p0.x) / parent.square);
    this.ky = Math.floor((y - parent.rect.p0.y) / parent.square);
  }
  distance(p) { return mhypot(this.x - p.x, this.y - p.y); }
}
class RandomPoints {
  constructor(rect, dist, nbTries) {
    const genValues = (range) => {
      let currv = 0;
      const list = [currv];
      let nbTry = 0;
      while (true) {
        let rnd = puzzle.prng();
        let futv = currv + (1 + 0.5 * rnd * rnd) * this.dist;
        if (range - futv < this.dist) {
          ++nbTry;
          if (nbTry < 10) continue;
          return list;
        }
        list.push(futv);
        currv = futv;
        if (range - currv < 2 * dist) return list;
      }
    };
    this.rect = rect;
    this.dist = dist;
    this.square = dist;
    this.nbx = mceil((rect.p1.x - rect.p0.x) / this.square);
    this.nby = mceil((rect.p1.y - rect.p0.y) / this.square);
    this.terrain = new Array(this.nby+1).fill().map(() => new Array(this.nbx+1).fill().map(() => []));
    this.points = [];
    this.list = [];
    let l = genValues(rect.p1.x - rect.p0.x);
    l.forEach(v => this.isAcceptable(new RdPoint(this, rect.p0.x + v, rect.p0.y)));
    l = genValues(rect.p1.y - rect.p0.y);
    l.forEach(v => this.isAcceptable(new RdPoint(this, rect.p1.x, rect.p0.y + v)));
    l = genValues(rect.p1.x - rect.p0.x);
    l.forEach(v => this.isAcceptable(new RdPoint(this, rect.p1.x - v, rect.p1.y)));
    l = genValues(rect.p1.y - rect.p0.y);
    l.forEach(v => this.isAcceptable(new RdPoint(this, rect.p0.x, rect.p1.y - v)));
    for (let k = 0; k < this.list.length; ++k) {
      if ((this.list[k].x == rect.p0.x || this.list[k].x == rect.p1.x) &&
          (this.list[k].y == rect.p0.y || this.list[k].y == rect.p1.y))
        this.list[k].isCorner = true;
      else this.list[k].isEdge = true;
    }
    while (this.list.length) {
      let posp = puzzle.prng.intAlea(this.list.length);
      let p = this.list[posp];
      let found = false;
      for (let k = 0; k < nbTries; ++k) {
        let p1 = this.rndr2r();
        p1 = new RdPoint(this, p.x + p1.x, p.y + p1.y);
        if (this.isAcceptable(p1)) { found = true; }
      }
      if (!found) this.list.splice(posp, 1);
    }
    delete this.terrain;
    this.points.forEach((p, k) => { p.kList = k; delete p.kx; delete p.ky; });
  }
  rndr2r() {
    let rnd = puzzle.prng();
    rnd *= rnd;
    const r = this.dist * (1 + 0.7 * rnd);
    const th = Math.PI * puzzle.prng() * 2;
    return { x: r * Math.cos(th), y: r * Math.sin(th) };
  }
  isAcceptable(p) {
    if (p.x < this.rect.p0.x || p.x > this.rect.p1.x ||
        p.y < this.rect.p0.y || p.y > this.rect.p1.y) return false;
    for (let kky = mmax(0, p.ky-1); kky <= mmin(p.ky+1, this.nby); ++kky) {
      for (let kkx = mmax(0, p.kx-1); kkx <= mmin(p.kx+1, this.nbx); ++kkx) {
        if (this.terrain[kky][kkx].some(pp => p.distance(pp) < this.dist)) return false;
      }
    }
    this.terrain[p.ky][p.kx].push(p);
    this.list.push(p);
    this.points.push(p);
    return true;
  }
}
class Polygon {
  constructor(tr, kp, lastkp) {
    let p = this.p = tr.points[kp];
    p.polygon = this;
    if (kp <= lastkp) {
      this.vertices = [];
      if (p.isCorner) this.vertices.push(p);
      p.tris.forEach((tri, k) => {
        if (k == 0) this.vertices.push(p.p1);
        this.vertices.push(tri.gc);
        if (k == p.tris.length-1) this.vertices.push(tr.points[kp==0 ? lastkp : kp-1].p1);
      });
      this.c = {};
      if (p.isCorner) {
        let pa = this.vertices[1];
        if (pa.x !== p.x) {
          this.c.x = (this.vertices.at(-1).x + this.vertices.at(-2).x)/2;
          this.c.y = (this.vertices[1].y + this.vertices[2].y)/2;
        } else {
          this.c.x = (this.vertices[1].x + this.vertices[2].x)/2;
          this.c.y = (this.vertices.at(-1).y + this.vertices.at(-2).y)/2;
        }
      } else {
        this.c = {
          x: (this.vertices[0].x + this.vertices[1].x + this.vertices.at(-2).x + this.vertices.at(-1).x)/4,
          y: (this.vertices[0].y + this.vertices[1].y + this.vertices.at(-2).y + this.vertices.at(-1).y)/4
        };
      }
    } else {
      this.vertices = p.tris.map(tri => tri.gc);
      this.c = {
        x: this.vertices.reduce((s,v) => s + v.x, 0)/this.vertices.length,
        y: this.vertices.reduce((s,v) => s + v.y, 0)/this.vertices.length
      };
    }
  }
}

// ============================================================
// FORMES DES PIÈCES (TWIST)
// ============================================================
function twist0(side, ca) {
  const sp = side.points;
  const dxh = sp[1].x - sp[0].x, dyh = sp[1].y - sp[0].y;
  const lsegh = mhypot(dxh, dyh);
  if (lsegh < puzzle.distPoints * 0.4) return;
  const mid0 = lerp(sp[0], sp[1], 0.5);
  const dxv = ca.x - mid0.x, dyv = ca.y - mid0.y;
  const lsegv = mhypot(dxv, dyv);
  let scalev = puzzle.prng.alea(1.5, 2);
  const scaleh = puzzle.prng.alea(1, 1.3);
  const alpha = 2;
  if (scalev * lsegv > alpha * scaleh * lsegh) scalev = (alpha * scaleh * lsegh)/lsegv;
  if (scalev * lsegv < 0.5 * scaleh * lsegh) return;
  const mid = puzzle.prng.alea(0.45, 0.55);
  const pointAt = (ch, cv) => ({ x: sp[0].x + ch*dxh + cv*dxv, y: sp[0].y + ch*dyh + cv*dyv });
  const pa = pointAt(mid - (1/12)*scaleh, (1/12)*scalev);
  const pb = pointAt(mid - (1.8/12)*scaleh, (2.8/12)*scalev);
  const pc = pointAt(mid, (4/12)*scalev);
  const pd = pointAt(mid + (1.8/12)*scaleh, (2.8/12)*scalev);
  const pe = pointAt(mid + (1/12)*scaleh, (1/12)*scalev);
  side.points = [
    sp[0],
    { x: sp[0].x + (5/12)*dxh*0.52, y: sp[0].y + (5/12)*dyh*0.52 },
    { x: pa.x - (1/12)*dxv*0.72, y: pa.y - (1/12)*dyv*0.72 }, pa,
    { x: pa.x + (2/12)*dxv*0.92, y: pa.y + (2/12)*dyv*0.92 },
    { x: pb.x - (1/12)*dxv*0.92, y: pb.y - (1/12)*dyv*0.92 }, pb,
    { x: pb.x + (1/12)*dxv*0.92, y: pb.y + (1/12)*dyv*0.92 },
    { x: pc.x - (2/12)*dxh*0.7, y: pc.y - (2/12)*dyh*0.7 }, pc,
    { x: pc.x + (2/12)*dxh*0.7, y: pc.y + (2/12)*dyh*0.7 },
    { x: pd.x + (1/12)*dxv*0.92, y: pd.y + (1/12)*dyv*0.92 }, pd,
    { x: pd.x - (1/12)*dxv*0.92, y: pd.y - (1/12)*dyv*0.92 },
    { x: pe.x + (2/12)*dxv*0.92, y: pe.y + (2/12)*dyv*0.92 }, pe,
    { x: pe.x - (1/12)*dxv*0.72, y: pe.y - (1/12)*dyv*0.72 },
    { x: sp[1].x - (5/12)*dxh*0.52, y: sp[1].y - (5/12)*dyh*0.52 },
    sp[1]
  ];
  side.type = "z";
}
function twist1(side, ca) {
  const sp = side.points;
  const dxh = sp[1].x - sp[0].x, dyh = sp[1].y - sp[0].y;
  if (mhypot(dxh, dyh) < puzzle.distPoints * 0.4) return;
  const mid0 = lerp(sp[0], sp[1], 0.5);
  const dxv = ca.x - mid0.x, dyv = ca.y - mid0.y;
  const pointAt = (ch, cv) => ({ x: sp[0].x + ch*dxh + cv*dxv, y: sp[0].y + ch*dyh + cv*dyv });
  const pa = pointAt(puzzle.prng.alea(0.15,0.35), puzzle.prng.alea(-0.05,0.05));
  const pb = pointAt(puzzle.prng.alea(0.45,0.55), puzzle.prng.alea(0.3,0.5));
  const pc = pointAt(puzzle.prng.alea(0.65,0.85), puzzle.prng.alea(-0.05,0.05));
  side.points = [sp[0], sp[0], pa, pa, pa, pb, pb, pb, pc, pc, pc, sp[1], sp[1]];
  side.type = "z";
}
function twist2(side, ca) {
  const sp = side.points;
  const dxh = sp[1].x - sp[0].x, dyh = sp[1].y - sp[0].y;
  const mid0 = lerp(sp[0], sp[1], 0.5);
  const dxv = ca.x - mid0.x, dyv = ca.y - mid0.y;
  const pointAt = (ch, cv) => ({ x: sp[0].x + ch*dxh + cv*dxv, y: sp[0].y + ch*dyh + cv*dyv });
  const hmid = puzzle.prng.alea(0.45,0.55);
  const vmid = puzzle.prng.alea(0.4,0.5);
  const pc = pointAt(hmid, vmid);
  const pb = lerp(sp[0], pc, 2/3);
  const pd = lerp(sp[1], pc, 2/3);
  side.points = [sp[0], pb, pd, sp[1]];
  side.type = "z";
}
function twist3() {}
function twist4(side, ca, cb) {
  const sp = side.points;
  const pa0 = lerp(sp[0], ca, 0.13), pa1 = lerp(sp[1], ca, 0.13);
  const pb0 = lerp(sp[0], cb, 0.13), pb1 = lerp(sp[1], cb, 0.13);
  side.points = [
    sp[0], lerp(sp[0], sp[1], 0.25),
    lerp(pa0, pa1, 0.23), lerp(pa0, pa1, 0.33), lerp(pa0, pa1, 0.43),
    lerp(pb0, pb1, 0.57), lerp(pb0, pb1, 0.67), lerp(pb0, pb1, 0.77),
    lerp(sp[1], sp[0], 0.25), sp[1]
  ];
  side.type = "z";
}

// ============================================================
// CLASSE SIDE (côté d'une pièce)
// ============================================================
class Side {
  constructor(type, points) {
    this.type = type || "";
    this.points = points || [];
  }
  reversed() {
    const ns = new Side();
    ns.type = this.type;
    ns.points = this.points.slice().reverse();
    return ns;
  }
  drawNormPath(path, first) {
    if (first) path.moveTo(this.points[0].x, this.points[0].y);
    if (this.type == "d") {
      path.lineTo(this.points[1].x, this.points[1].y);
    } else {
      for (let k = 1; k < this.points.length - 1; k += 3) {
        path.bezierCurveTo(this.points[k].x, this.points[k].y,
                           this.points[k+1].x, this.points[k+1].y,
                           this.points[k+2].x, this.points[k+2].y);
      }
    }
  }
}

// ============================================================
// CLASSE POLYPIECE (groupe de pièces fusionnées)
// ============================================================
class PolyPiece {
  constructor(initialPiece) {
    this.pieces = [initialPiece];
    initialPiece.poly = this;
    this.selected = false;
    this.minx = initialPiece.minx;
    this.maxx = initialPiece.maxx;
    this.miny = initialPiece.miny;
    this.maxy = initialPiece.maxy;
    this.pCentre = { x: (this.minx+this.maxx)/2, y: (this.miny+this.maxy)/2 };
    this.diagonal = mhypot(this.maxx-this.minx, this.maxy-this.miny);
    this.listLoops();
    this.getSrcPath();
    this.getNormIntPath();
    this.rot = 0;
    this.x = 0; this.y = 0;
    this.isMoving = false;
  }

  getScreenCenter() {
    if (!this.fromSrcMatrix) return { x: this.x, y: this.y };
    return this.fromSrcMatrix.transformPoint(this.pCentre);
  }

  // Fusionne deux PolyPieces (la plus petite dans la plus grande)
  merge(otherPoly) {
    const kOther = puzzle.polyPieces.indexOf(otherPoly);
    puzzle.polyPieces.splice(kOther, 1);
    for (let piece of otherPoly.pieces) {
      piece.poly = this;
      this.pieces.push(piece);
    }
    if (otherPoly.minx < this.minx) this.minx = otherPoly.minx;
    if (otherPoly.maxx > this.maxx) this.maxx = otherPoly.maxx;
    if (otherPoly.miny < this.miny) this.miny = otherPoly.miny;
    if (otherPoly.maxy > this.maxy) this.maxy = otherPoly.maxy;
    this.pCentre = { x: (this.minx+this.maxx)/2, y: (this.miny+this.maxy)/2 };
    this.diagonal = mhypot(this.maxx-this.minx, this.maxy-this.miny);
    this.listLoops();
    this.getSrcPath();
    this.getNormIntPath();
    puzzle.evaluateOrder();
  }

  // Vérifie si cette PolyPiece est proche et complémentaire d'une autre (fusion conditionnelle)
  ifNear(otherPoly) {
    if (this.rot != otherPoly.rot) return false;
    if (Math.hypot(this.x - otherPoly.x, this.y - otherPoly.y) >= puzzle.dConnect) return false;
    const sidesThis = this.tbLoops.flat();
    const sidesOther = otherPoly.tbLoops.flat();
    const eps = 1;   // tolérance d'un pixel
    for (let sd of sidesOther) {
      const lastPoint = sd.points.at(-1);
      if (sidesThis.some(es => {
        const firstPoint = es.points[0];
        return Math.hypot(firstPoint.x - lastPoint.x, firstPoint.y - lastPoint.y) < eps;
      })) return true;
    }
    return false;
  }

  // Construit la liste des boucles du contour extérieur
  listLoops() {
    const tbLoops = [];
    const tbEdges = [];
    this.pieces.forEach(pc => {
      pc.sides.forEach((side, k) => {
        if (side.polys.length == 2) {
          let other = side.polys[0] == pc ? side.polys[1] : side.polys[0];
          if (other?.poly == this) return;
        }
        tbEdges.push(pc.sideLines[k]);
      });
    });
    while (tbEdges.length) {
      let lp = [];
      let currEdge = tbEdges.shift();
      lp.push(currEdge);
      do {
        let edgeNumber = tbEdges.findIndex(ed => ed.points[0] == currEdge.points.at(-1));
        if (edgeNumber == -1) break;
        currEdge = tbEdges.splice(edgeNumber, 1)[0];
        lp.push(currEdge);
      } while (true);
      tbLoops.push(lp);
    }
    this.tbLoops = tbLoops;
  }

  getSrcPath() {
    this.srcPath = new Path2D();
    this.tbLoops.forEach(loop => {
      let pth = new Path2D();
      loop.forEach((side, k) => side.drawNormPath(pth, k==0));
      this.srcPath.addPath(pth);
    });
    return this.srcPath;
  }

  getNormIntPath() {
    this.normIntPath = new Path2D();
    let edg = this.tbLoops.flat();
    this.pieces.forEach(pc => {
      pc.sides.forEach((side, k) => {
        if (edg.includes(pc.sideLines[k])) return;
        if (pc == side.polys[0]) side.drawNormPath(this.normIntPath, true);
      });
    });
    return this.normIntPath;
  }

  setTransforms() {
    this.fromSrcMatrix = new DOMMatrix([1,0,0,1,this.x,this.y]);
    if (this.rot) this.fromSrcMatrix.multiplySelf(puzzle.rotMat[this.rot]);
    this.fromSrcMatrix.scaleSelf(puzzle.scale, puzzle.scale);
    this.fromSrcMatrix = this.fromSrcMatrix.translateSelf(0, 0);
  }

  drawImage(special) {
    this.setTransforms();
    let pth = new Path2D();
    pth.addPath(this.srcPath, this.fromSrcMatrix);
    this.playPath = pth;
    let pa = this.fromSrcMatrix.transformPoint({ x: this.minx - this.diagonal/2, y: this.miny - this.diagonal/2 });
    let pb = this.fromSrcMatrix.transformPoint({ x: this.maxx + this.diagonal/2, y: this.maxy + this.diagonal/2 });
    if (mmax(pa.x, pb.x) < 0 || mmax(pa.y, pb.y) < 0 ||
        mmin(pa.x, pb.x) > puzzle.contWidth || mmin(pa.y, pb.y) > puzzle.contHeight)
      return;
    let ctx = puzzle.playCtx;
    if (this.isMoving) {
      ctx = puzzle.moveCtx;
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
    ctx.fillStyle = "none";
    ctx.shadowColor = this.selected ? (special ? "lime" : "gold") : "rgba(0,0,0,0.5)";
    ctx.shadowBlur = this.selected ? mmin(8, (puzzle.distPoints * puzzle.scale)/10) : 4;
    ctx.shadowOffsetX = this.selected ? 0 : -4;
    ctx.shadowOffsetY = this.selected ? 0 : 4;
    ctx.fill(pth);
    if (this.selected) for (let i=0;i<6;i++) ctx.fill(pth);
    ctx.shadowColor = "transparent";
    ctx.save();
    ctx.clip(pth);
    ctx.setTransform(this.fromSrcMatrix);
    ctx.drawImage(puzzle.srcImage, 0, 0);
    ctx.resetTransform();
    const dx = puzzle.embossThickness/2, dy = -puzzle.embossThickness/2;
    if (puzzle.drawMode == 3) {
      ctx.restore();
      this.pieces.forEach(pc => {
        let pthi = new Path2D();
        pthi.addPath(pc.srcPath, this.fromSrcMatrix);
        ctx.save();
        ctx.clip(pthi);
        drawEmboss(ctx, pthi);
        ctx.restore();
      });
    } else {
      drawEmboss(ctx, pth);
      if (puzzle.drawMode == "1") drawInternal(ctx, this);
      ctx.restore();
    }
    function drawEmboss(ctx, path) {
      ctx.lineWidth = puzzle.embossThickness * 1.5;
      ctx.translate(dx, dy);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.stroke(path);
      ctx.translate(-2*dx, -2*dy);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.stroke(path);
    }
    function drawInternal(ctx, pp) {
      let pthi = new Path2D();
      pthi.addPath(pp.normIntPath, pp.fromSrcMatrix);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#ffffff";
      let oldOp = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = "difference";
      ctx.stroke(pthi);
      ctx.globalCompositeOperation = oldOp;
    }
  }

  moveTo(x, y) {
    this.x = x;
    this.y = y;
    this.setTransforms();
  }

  rotate(angle) {
    let pCenterDisp = this.fromSrcMatrix.transformPoint(this.pCentre);
    this.rot = angle;
    const mtrx = new DOMMatrix([1,0,0,1,pCenterDisp.x, pCenterDisp.y]);
    if (this.rot) mtrx.multiplySelf(puzzle.rotMat[this.rot]);
    mtrx.scaleSelf(puzzle.scale, puzzle.scale);
    mtrx.translateSelf(-this.pCentre.x, -this.pCentre.y);
    this.x = mtrx.e;
    this.y = mtrx.f;
  }

  isPointInPath(p) {
    return puzzle.playCtx.isPointInPath(this.playPath, p.x, p.y);
  }
}

// ============================================================
// CLASSE PRINCIPALE PUZZLE
// ============================================================
class Puzzle {
  constructor(params) {
    this.container = typeof params.container == "string" ? document.getElementById(params.container) : params.container;
    this.initEvents();
    this.srcImage = new Image();
    this.imageLoaded = false;
    this.srcImage.addEventListener("load", () => imageLoaded());
  }

  initEvents() {
    this.container.addEventListener("mousedown", (e) => {
      useMouse = true;
      e.preventDefault();
      if (e.button != 0) return;
      events.push({ event: "touch", position: this.relativeMouseCoordinates(e) });
    });
    this.container.addEventListener("touchstart", (e) => {
      useMouse = false;
      e.preventDefault();
      if (e.touches.length == 0) return;
      let touches = [];
      for (let i=0; i<e.touches.length; i++) touches.push(this.relativeMouseCoordinates(e.touches.item(i)));
      if (e.touches.length == 1) events.push({ event: "touch", position: touches[0] });
      if (e.touches.length == 2) events.push({ event: "touches", touches });
    }, { passive: false });
    this.container.addEventListener("mouseup", (e) => { if (e.button==0) events.push({ event: "leave", shiftKey: e.shiftKey }); });
    this.container.addEventListener("touchend", (e) => events.push({ event: "leave", shiftKey: false }));
    this.container.addEventListener("touchleave", (e) => events.push({ event: "leave", shiftKey: false }));
    this.container.addEventListener("touchcancel", (e) => events.push({ event: "leave", shiftKey: false }));
    this.container.addEventListener("mousemove", (e) => {
      useMouse = true;
      e.preventDefault();
      if (events.length && events[events.length-1].event == "move") events.pop();
      events.push({ event: "move", position: this.relativeMouseCoordinates(e), ev: e });
    });
    this.container.addEventListener("touchmove", (e) => {
      useMouse = false;
      e.preventDefault();
      let touches = [];
      for (let i=0; i<e.touches.length; i++) touches.push(this.relativeMouseCoordinates(e.touches.item(i)));
      if (e.touches.length == 1) {
        if (events.length && events[events.length-1].event == "move") events.pop();
        events.push({ event: "move", position: touches[0] });
      }
      if (e.touches.length == 2) {
        if (events.length && events[events.length-1].event == "moves") events.pop();
        events.push({ event: "moves", touches });
      }
    }, { passive: false });
    this.container.addEventListener("wheel", (e) => {
      useMouse = true;
      e.preventDefault();
      if (events.length && events.at(-1).event == "wheel") events.pop();
      events.push({ event: "wheel", wheel: e });
    });
    const keyInstalled = "puzzleKeyHandler";
    if (!document.body.dataset[keyInstalled]) {
      document.body.addEventListener("keydown", (e) => {
        if ((e.key != "+" && e.key != "-") || !e.shiftKey) return;
        e.preventDefault();
        if (events.length && events.at(-1).event == "wheel") events.pop();
        events.push({
          event: "wheel",
          wheel: { deltaY: e.key == "+" ? 1 : -1 },
          center: { x: this.contWidth/2, y: this.contHeight/2 }
        });
      });
      document.body.dataset[keyInstalled] = "1";
    }
  }

  getContainerSize() {
    const styl = window.getComputedStyle(this.container);
    this.contWidth = parseFloat(styl.width);
    this.contHeight = parseFloat(styl.height);
  }

  showImage(state) {
    this.showState = state === undefined ? !this.showState : !!state;
    let showElem = this.container.querySelector(".showimage");
    if (!showElem) {
      showElem = document.createElement("div");
      showElem.classList.add("showimage");
      showElem.addEventListener("click", () => this.showImage(false));
      this.container.append(showElem);
    }
    showElem.innerHTML = "";
    if (this.showState) {
      ui.close();
      showElem.style.display = "block";
      let img = document.createElement("img");
      img.src = this.srcImage.src;
      showElem.append(img);
    } else {
      showElem.style.display = "none";
    }
  }

  create(baseData) {
    this.prng = mMash(baseData ? baseData[2] : "a");
    this.container.innerHTML = "";
    this.playCanvas = document.createElement("canvas");
    this.playCanvas.style.position = "absolute";
    this.container.append(this.playCanvas);
    this.playCtx = this.playCanvas.getContext("2d");
    this.moveCanvas = document.createElement("canvas");
    this.moveCanvas.style.position = "absolute";
    this.container.append(this.moveCanvas);
    this.moveCtx = this.moveCanvas.getContext("2d");
    this.getContainerSize();
    this.moveCanvas.width = this.playCanvas.width = this.contWidth;
    this.moveCanvas.height = this.playCanvas.height = this.contHeight;

    if (baseData) {
      this.typeOfShape = baseData[4];
      ui.shape.value = Number(baseData[3]) + 1;
      this.distPoints = baseData[0];
      this.scale = baseData[1];
      this.rotationStep = baseData[3];
      ui.rotationstep.value = this.rotationStep;
      this.prng = mMash(baseData[2]);
      this.makePolygons();
    } else {
      this.typeOfShape = document.getElementById("shape").value - 1;
      this.distPoints = msqrt(this.srcWidth * this.srcHeight) / 10;
      this.rotationStep = parseInt(ui.rotationstep.value, 10);
      do {
        this.prng = mMash();
        this.makePolygons();
        if (mabs(1 - this.pieces.length / this.nbPieces) <= 0.01 ||
            mabs(this.pieces.length - this.nbPieces) <= 2) break;
        this.distPoints *= mmax(0.67, mmin(1.5, msqrt(this.pieces.length / this.nbPieces)));
      } while (true);
    }
    this.nbPiecesAct = this.pieces.length;
    this.rotMat = MATS[this.rotationStep];
    this.nbRot = [,2,3,4,6,8,12][this.rotationStep];
    this.pieces.forEach(piece => {
      piece.minx = piece.vertices.reduce((m, v) => mmin(m, v.x), Infinity);
      piece.maxx = piece.vertices.reduce((m, v) => mmax(m, v.x), -Infinity);
      piece.miny = piece.vertices.reduce((m, v) => mmin(m, v.y), Infinity);
      piece.maxy = piece.vertices.reduce((m, v) => mmax(m, v.y), -Infinity);
    });
    this.defineShapes({ coeffDecentr: 0.12, twistf: [twist0,twist1,twist2,twist3,twist4][this.typeOfShape] });

    this.polyPieces = [];
    if (!baseData) {
      this.pieces.forEach(piece => this.polyPieces.push(new PolyPiece(piece)));
      arrayShuffle(this.polyPieces);
      if (this.rotationStep) this.polyPieces.forEach(pp => pp.rot = intAlea(this.nbRot));
    } else {
      const pps = baseData[7];
      const offs = this.rotationStep ? 3 : 2;
      pps.forEach(ppData => {
        let polyp = new PolyPiece(this.pieces[ppData[offs]]);
        polyp.x = ppData[0];
        polyp.y = ppData[1];
        polyp.rot = this.rotationStep ? ppData[2] : 0;
        for (let k = offs+1; k < ppData.length; k++) {
          polyp.pieces.push(this.pieces[ppData[k]]);
          this.pieces[ppData[k]].poly = polyp;
          if (this.pieces[ppData[k]].minx < polyp.minx) polyp.minx = this.pieces[ppData[k]].minx;
          if (this.pieces[ppData[k]].maxx > polyp.maxx) polyp.maxx = this.pieces[ppData[k]].maxx;
          if (this.pieces[ppData[k]].miny < polyp.miny) polyp.miny = this.pieces[ppData[k]].miny;
          if (this.pieces[ppData[k]].maxy > polyp.maxy) polyp.maxy = this.pieces[ppData[k]].maxy;
        }
        polyp.pCentre = { x: (polyp.minx+polyp.maxx)/2, y: (polyp.miny+polyp.maxy)/2 };
        polyp.listLoops();
        polyp.getSrcPath();
        polyp.getNormIntPath();
        this.polyPieces.push(polyp);
      });
    }
    this.evaluateOrder();
  }

  drawPolyPieces(butTop) {
    this.playCtx.clearRect(0, 0, this.playCanvas.width, this.playCanvas.height);
    let max = this.polyPieces.length - (butTop ? 1 : 0);
    for (let k=0; k<max; k++) this.polyPieces[k].drawImage();
  }

  defineShapes(shapeDesc) {
    let { twistf } = shapeDesc;
    for (let piece of this.pieces) {
      piece.sideLines = [];
      piece.sides.forEach((side, k) => {
        if (!side.processed && side.polys.length == 2) {
          let cs = [side.polys[0].c, side.polys[1].c];
          if (this.prng.intAlea(2)) cs = [cs[1], cs[0]];
          twistf(side, cs[0], cs[1]);
          side.processed = true;
        }
        piece.sideLines[k] = (side.points[0] == piece.vertices[k]) ? side : side.reversed();
      });
      piece.srcPath = new Path2D();
      piece.sideLines.forEach((sln, k) => sln.drawNormPath(piece.srcPath, k==0));
      piece.srcPath.closePath();
    }
  }

  doScale() {
    this.dConnect = mmax(10, (this.scale * this.distPoints) / 10);
    this.embossThickness = mmin(2 + ((this.scale * this.distPoints) / 200) * 2, 4);
    this.polyPieces.forEach(pp => pp.setTransforms());
  }

  sweepBy(dx, dy) {
    this.polyPieces.forEach(pp => pp.moveTo(pp.x + dx, pp.y + dy));
    this.drawPolyPieces();
  }

  zoomBy(coef, center) {
    let futWidth = this.srcWidth * this.scale * coef;
    let futHeight = this.srcHeight * this.scale * coef;
    let nsize = msqrt((futWidth*futWidth)/this.pieces.length);
    if (((nsize > 1000 || futWidth > 10000 || futHeight > 10000) && coef > 1) ||
        (nsize < 10 && coef < 1)) return;
    if (coef == 1) return;
    this.scale *= coef;
    this.doScale();
    this.polyPieces.forEach(pp => {
      pp.moveTo(coef * (pp.x - center.x) + center.x, coef * (pp.y - center.y) + center.y);
    });
    this.drawPolyPieces();
  }

  relativeMouseCoordinates(event) {
    const br = this.container.getBoundingClientRect();
    lastMousePos = { x: event.clientX - br.x, y: event.clientY - br.y };
    return lastMousePos;
  }

  spread() {
    let kSpread = 1.7, kMargin = 1.7;
    let gstep = this.distPoints * kSpread;
    let ngx = mceil((2*kMargin*this.distPoints + this.srcWidth)/gstep);
    let ngy = mceil((2*kMargin*this.distPoints + this.srcHeight)/gstep);
    let nTotCells = this.nbPiecesAct + ngx*ngy;
    let nmaxx = mceil(nTotCells/ngy) + 2;
    let nmaxy = mceil(nTotCells/ngx) + 2;
    let bestk = { cellSize: 0 };
    let cellSize;
    for (let nbx=ngx; nbx<nmaxx; nbx++) {
      let nby = mmax(ngy, mceil(nTotCells/nbx));
      cellSize = mmin(this.contWidth/nbx, this.contHeight/nby);
      if (cellSize > bestk.cellSize) bestk = { cellSize, nbx, nby };
    }
    for (let nby=ngy; nby<nmaxy; nby++) {
      let nbx = mmax(ngx, mceil(nTotCells/nby));
      cellSize = mmin(this.contWidth/nbx, this.contHeight/nby);
      if (cellSize > bestk.cellSize) bestk = { cellSize, nbx, nby };
    }
    this.scale = bestk.cellSize / this.distPoints / kSpread;
    let col0 = mfloor((bestk.nbx - ngx)/2);
    let col1 = col0 + ngx - 1;
    let row0 = mfloor((bestk.nby - ngy)/2);
    let row1 = row0 + ngy - 1;
    let offsx = (this.contWidth - bestk.nbx * bestk.cellSize)/2;
    let offsy = (this.contHeight - bestk.nby * bestk.cellSize)/2;
    let idxpc = 0;
    loop: for (let ky=0; ky<bestk.nby; ky++) {
      for (let kx=0; kx<bestk.nbx; kx++) {
        if (kx>=col0 && kx<=col1 && ky>=row0 && ky<=row1) continue;
        let pp = this.polyPieces[idxpc++];
        let mat = new DOMMatrix([1,0,0,1, offsx + (kx+0.5)*bestk.cellSize, offsy + (ky+0.5)*bestk.cellSize]);
        if (pp.rot) mat.multiplySelf(this.rotMat[pp.rot]);
        mat.scaleSelf(this.scale, this.scale);
        mat.translateSelf(-pp.pCentre.x, -pp.pCentre.y);
        pp.x = mat.e;
        pp.y = mat.f;
        if (idxpc >= this.nbPiecesAct) break loop;
      }
    }
  }

  evaluateOrder() {
    for (let k=this.polyPieces.length-1; k>0; k--) {
      if (this.polyPieces[k].pieces.length > this.polyPieces[k-1].pieces.length) {
        [this.polyPieces[k], this.polyPieces[k-1]] = [this.polyPieces[k-1], this.polyPieces[k]];
      }
    }
  }

  getStateData() {
    let saved = { signature: fileSignature };
    if ("origin" in this.srcImage.dataset) saved.origin = this.srcImage.dataset.origin;
    saved.src = this.srcImage.src;
    let base = [this.distPoints, this.scale, this.prng.seed, this.rotationStep, this.typeOfShape, this.srcWidth, this.srcHeight];
    saved.base = base;
    let pps = [];
    base.push(pps);
    this.polyPieces.forEach(pp => {
      let ppData = [mround(pp.x), mround(pp.y)];
      if (this.rotationStep) ppData.push(pp.rot);
      pp.pieces.forEach(p => ppData.push(this.pieces.indexOf(p)));
      pps.push(ppData);
    });
    // Sauvegarde de l'état du chronomètre
    saved.chrono = {
      tempsEcoule: chronometre.tempsEcoule,
      enCours: chronometre.enCours
    };
    return saved;
  }

  makePolygons() {
    let tr, points;
    tryagain: do {
      let t = new RandomPoints({ p0: {x:0,y:0}, p1: {x:this.srcWidth, y:this.srcHeight} }, this.distPoints, 30);
      points = t.points.map(p => ({ x:p.x, y:p.y, isCorner:p.isCorner, isEdge:p.isEdge }));
      tr = new Delaunay(points, t.rect);
      tr.analyze();
      tr.triangulation.forEach(tri => tri.listTris());
      for (let tri of tr.triangulation) {
        if (tri.tris.flat().length != 3) {
          let cnt = 0;
          if (tri.a.isCorner || tri.a.isEdge) cnt++;
          if (tri.b.isCorner || tri.b.isEdge) cnt++;
          if (tri.c.isCorner || tri.c.isEdge) cnt++;
          if (cnt < 2) continue tryagain;
        }
      }
      break;
    } while (true);
    tr.triangulation.forEach(tri => { tri.gc = { x: (tri.a.x+tri.b.x+tri.c.x)/3, y: (tri.a.y+tri.b.y+tri.c.y)/3 }; });
    let lastkp;
    for (let kp=0, side=0; tr.points[kp]?.isEdge || tr.points[kp]?.isCorner; ++kp) {
      if (tr.points[kp].isCorner) side = 1 - side;
      let tri = tr.points[kp].tris[0];
      let np = tr.points[kp+1];
      if (!np?.isEdge && !np?.isCorner) np = tr.points[0];
      tr.points[kp].p1 = side ? { x: tri.gc.x, y: tr.points[kp].y } : { x: tr.points[kp].x, y: tri.gc.y };
      lastkp = kp;
    }
    let polygons = [];
    tr.points.forEach((p, k) => polygons.push(new Polygon(tr, k, lastkp)));
    polygons.forEach(poly => {
      let nVert = poly.vertices.length;
      poly.sides = [];
      for (let k=0; k<nVert; k++) {
        let p0 = poly.vertices[k], p1 = poly.vertices[(k+1)%nVert];
        let side = new Side("d", [p0, p1]);
        side.polys = [poly];
        if ((p0.isCorner || p0.isEdge) && (p1.isCorner || p1.isEdge)) {
          side.isEdge = true;
          poly.isEdge = true;
        } else {
          let side1 = p0.sides?.find(ed => (ed.points[0]==p0 && ed.points[1]==p1) || (ed.points[0]==p1 && ed.points[1]==p0));
          if (side1) {
            side = side1;
            side.polys.push(poly);
          } else {
            p0.sides = p0.sides || [];
            p0.sides.push(side);
            p1.sides = p1.sides || [];
            p1.sides.push(side);
          }
        }
        poly.sides[k] = side;
      }
    });
    polygons.forEach(poly => {
      poly.neighbors = new Set();
      poly.sides.forEach(side => side.polys.forEach(pp => poly.neighbors.add(pp)));
      poly.neighbors.delete(poly);
    });
    this.pieces = polygons;
  }
}

// ============================================================
// GESTION DES FICHIERS (CHARGEMENT / SAUVEGARDE)
// ============================================================
let loadFile, loadSaved;
{
  let elFile = document.createElement("input");
  elFile.type = "file";
  elFile.style.display = "none";
  elFile.addEventListener("change", function() {
    if (!this.files.length) return;
    let reader = new FileReader();
    let origin = this.files[0].name;
    reader.addEventListener("load", () => {
      puzzle.srcImage.src = reader.result;
      puzzle.srcImage.dataset.origin = origin;
      makeSaveFileName(origin);
    });
    reader.readAsDataURL(this.files[0]);
  });
  loadFile = () => {
    elFile.accept = "image/*";
    elFile.value = null;
    elFile.click();
  };
}
{
  let elFile = document.createElement("input");
  elFile.type = "file";
  elFile.style.display = "none";
  let loading = false;
  elFile.addEventListener("change", function() {
    if (!this.files.length) { events.push({ event: "cancel" }); return; }
    let reader = new FileReader();
    let fname = this.files[0].name;
    reader.addEventListener("load", () => {
      puzzle.restoredString = reader.result;
      loading = false;
      events.push({ event: "restored" });
      if (fname.endsWith(fileExtension)) fname = fname.slice(0, -fileExtension.length);
      makeSaveFileName(fname);
    });
    reader.readAsText(this.files[0]);
  });
  document.body.addEventListener("mousemove", () => { if (loading) { loading=false; events.push({ event: "cancel" }); } });
  loadSaved = () => {
    elFile.accept = fileExtension;
    elFile.value = null;
    elFile.click();
    loading = true;
  };
}

function makeSaveFileName(src) {
  if (URL.canParse(src)) {
    src = new URL(src).pathname.split('/').at(-1);
  }
  src = src.trim();
  if (!src) src = "save";
  let dot = src.lastIndexOf(".");
  if (dot != -1) src = src.slice(0, dot);
  src = src.trim();
  if (!src) src = "save";
  let clean = "";
  for (let c of src) {
    if ("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-".includes(c)) clean += c;
    else clean += "_";
  }
  ui.saveas.value = clean;
  return clean;
}

// ============================================================
// FONCTIONS DE DÉMARRAGE / ARRÊT / CHARGEMENT IMAGE
// ============================================================
function startGame() {
  gameStarted = true;
  // Le chronomètre est démarré dans case 20, pas ici
  events.push({ event: "nbpieces", nbpieces: Number(ui.nbpieces.value) });
  ui.playing();
  playing = true;
}

function confirmStop() {
  if (!playing) return;
  new Modal({
    lines: ["Voulez-vous vraiment arrêter cette partie ?"],
    buttons: [
      { text: "Arrêter", callback: () => events.push({ event: "stop" }) },
      { text: "Continuer" }
    ]
  });
}

function loadInitialFile() {
  let defaultImage = "images/default.jpg";   // À remplacer par votre image par défaut
  puzzle.imageLoaded = false;
  puzzle.srcImage.src = defaultImage;
  delete puzzle.srcImage.dataset.origin;
  makeSaveFileName(defaultImage);
}

function loadRemoteFile(fileURL) {
  puzzle.srcImage.src = fileURL;
  delete puzzle.srcImage.dataset.origin;
}

function imageLoaded() {
  puzzle.imageLoaded = true;
  let event = { event: "srcImageLoaded" };
  if (puzzle.restoring) {
    delete puzzle.restoring;
    if (mround(puzzle.srcWidth) != puzzle.restoredState.base[5] ||
        mround(puzzle.srcHeight) != puzzle.restoredState.base[6]) {
      popup(["Erreur : impossible de restaurer la partie.", "L'image ne correspond pas."]);
      event.event = "wrongImage";
    }
  }
  events.push(event);
}

function fitImage(img, width, height) {
  let wn = img.naturalWidth, hn = img.naturalHeight;
  let w = width, h = (w * hn) / wn;
  if (h > height) { h = height; w = (h * wn) / hn; }
  img.style.position = "absolute";
  img.style.width = w + "px";
  img.style.height = h + "px";
  img.style.top = "50%";
  img.style.left = "50%";
  img.style.transform = "translate(-50%,-50%)";
}

// ============================================================
// BOUCLE D'ANIMATION PRINCIPALE (GESTION DES ÉVÉNEMENTS)
// ============================================================
let animate;
let events = [];

{
  let state = 0, moving = {}, tmpImage, tInit, filesave;
  animate = function(tStamp) {
    requestAnimationFrame(animate);
    let event;
    if (events.length) event = events.shift();
    if (event?.event == "reset") state = 0;
    if (event?.event == "timeout" && (state==10||state==15) && !puzzle.imageLoaded) {
      puzzle.srcImage.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAJUlEQVR4AeyQMQ0AAAyDlmrDv6XNwYKAkvBxEWCNGUnDd5TecwAAAP//4lOPOQAAAAZJREFUAwBRdRIDdhSIewAAAABJRU5ErkJggg==";
      state = 10;
      popup(["Erreur de chargement de l'image.", "Vous pouvez essayer avec une image locale."]);
    }
    if (event?.event == "resize") {
      puzzle.getContainerSize();
      if (state == 15 || state == 60) {
        fitImage(tmpImage, puzzle.contWidth*0.95, puzzle.contHeight*0.95);
      } else if (state >= 25) {
        puzzle.moveCanvas.width = puzzle.playCanvas.width = puzzle.contWidth;
        puzzle.moveCanvas.height = puzzle.playCanvas.height = puzzle.contHeight;
        puzzle.drawPolyPieces();
      }
    }
    switch (state) {
      case 0: state = 10;
      case 10:
        playing = false;
        if (!puzzle.imageLoaded) return;
        puzzle.container.innerHTML = "";
        tmpImage = document.createElement("img");
        tmpImage.addEventListener("load", () => {
          puzzle.getContainerSize();
          fitImage(tmpImage, puzzle.contWidth*0.95, puzzle.contHeight*0.95);
          puzzle.container.appendChild(tmpImage);
        });
        tmpImage.src = puzzle.srcImage.src;
        tmpImage.style.boxShadow = "-4px 4px 4px rgba(0,0,0,0.5)";
        state = 15;
        break;
      case 15:
        if (!puzzle.imageLoaded) { state = 10; return; }
        puzzle.srcWidth = puzzle.srcImage.naturalWidth;
        puzzle.srcHeight = puzzle.srcImage.naturalHeight;
        playing = false;
        ui.waiting();
        if (!event) return;
        if (event.event == "nbpieces") { puzzle.nbPieces = event.nbpieces; state = 20; }
        else if (event.event == "srcImageLoaded") { state = 10; return; }
        else if (event.event == "restore") { filesave = event.file; state = 150; return; }
        else return;
      case 20:
        puzzle.drawMode = ui.drawmode.value;
        ui.close();
        ui.playing();
        playing = true;
        if (puzzle.restoredState) {
          puzzle.create(puzzle.restoredState.base);
          // Restauration du chronomètre
          if (puzzle.restoredState.chrono) {
            chronometre.tempsEcoule = puzzle.restoredState.chrono.tempsEcoule;
            chronometre.afficherTemps();
            if (puzzle.restoredState.chrono.enCours) {
              chronometre.demarrer();
            } else {
              chronometre.arreter();
            }
          } else {
            chronometre.reinitialiser();
            chronometre.arreter();
          }
        } else {
          puzzle.create();
          // Nouvelle partie : on démarre le chronomètre
          chronometre.reinitialiser();
          chronometre.demarrer();
        }
        if (puzzle.restoredState) {
          puzzle.doScale();
          puzzle.polyPieces.forEach(pp=>pp.moveTo(pp.x,pp.y));
          delete puzzle.restoredState;
        } else {
          puzzle.spread();
          puzzle.doScale();
        }
        puzzle.drawPolyPieces();
        state = 50;
        break;
      case 50:
        if (puzzle.drawMode != ui.drawmode.value) { puzzle.drawMode = ui.drawmode.value; puzzle.drawPolyPieces(); }
        if (!event) return;
        if (event.event == "stop") { chronometre.arreter(); state = 10; return; }
        if (event.event == "nbpieces") { puzzle.nbPieces = event.nbpieces; state = 20; }
        else if (event.event == "save") { filesave = event.file; state = 120; }
        else if (event.event == "touch" && puzzle.container.querySelector(".showimage")?.style?.display != "block") {
          moving = { xMouseInit: event.position.x, yMouseInit: event.position.y, tInit: tStamp };
          for (let k = puzzle.polyPieces.length-1; k >= 0; k--) {
            let pp = puzzle.polyPieces[k];
            if (pp.isPointInPath(event.position)) {
              pp.selected = true;
              moving.pp = pp;
              moving.ppXInit = pp.x;
              moving.ppYInit = pp.y;
              puzzle.polyPieces.splice(k,1);
              puzzle.polyPieces.push(pp);
              pp.isMoving = true;
              puzzle.drawPolyPieces();
              state = 55;
              return;
            }
          }
          state = 100;
        } else if (event.event == "touches" && puzzle.container.querySelector(".showimage")?.style?.display != "block") { moving = { touches: event.touches }; state = 110; }
        else if (event.event == "wheel") { const center = event.center || lastMousePos; if (event.wheel.deltaY > 0) puzzle.zoomBy(1.3, center); if (event.wheel.deltaY < 0) puzzle.zoomBy(1/1.3, center); }
        break;
      case 55:
        if (!event) return;
        if (event.event == "stop") { chronometre.arreter(); state = 10; return; }
        switch (event.event) {
          case "moves": case "touches": moving.pp.selected = false; moving.pp.drawImage(); moving = { touches: event.touches }; state = 110; break;
          case "move": if (event?.ev?.buttons === 0) { events.push({ event: "leave" }); break; } moving.pp.moveTo(event.position.x - moving.xMouseInit + moving.ppXInit, event.position.y - moving.yMouseInit + moving.ppYInit); moving.pp.drawImage(); break;
          case "leave":
            if (puzzle.rotationStep && tStamp < moving.tInit + 250) { if (event.shiftKey) moving.pp.rotate((moving.pp.rot + puzzle.nbRot - 1) % puzzle.nbRot); else moving.pp.rotate((moving.pp.rot + 1) % puzzle.nbRot); }
            moving.pp.selected = false;
            moving.pp.isMoving = false;
            puzzle.moveCtx.clearRect(0,0,puzzle.moveCanvas.width,puzzle.moveCanvas.height);
            // Fusion automatique conditionnelle
            let merged = false;
            let doneSomething;
            do {
              doneSomething = false;
              for (let k = puzzle.polyPieces.length - 1; k >= 0; k--) {
                let pp = puzzle.polyPieces[k];
                if (pp == moving.pp) continue;
                if (moving.pp.ifNear(pp)) {
                  merged = true;
                  if (pp.pieces.length > moving.pp.pieces.length) {
                    pp.merge(moving.pp);
                    moving.pp = pp;
                  } else {
                    moving.pp.merge(pp);
                  }
                  doneSomething = true;
                  break;
                }
              }
            } while (doneSomething);
            puzzle.evaluateOrder();
            if (merged) {
              moving.pp.isMoving = true;
              moving.pp.selected = true;
              moving.pp.drawImage(true);
              moving.tInit = tStamp + 500;
              state = 56;
              break;
            }
            puzzle.drawPolyPieces();
            state = 50;
            if (puzzle.polyPieces.length == 1 && puzzle.polyPieces[0].rot == 0) { chronometre.arreter(); state = 60; }
            break;
        }
        break;
      case 56:
        if (tStamp < moving.tInit) return;
        moving.pp.isMoving = false; moving.pp.selected = false;
        puzzle.moveCtx.clearRect(0,0,puzzle.moveCanvas.width,puzzle.moveCanvas.height);
        puzzle.drawPolyPieces();
        if (puzzle.polyPieces.length == 1 && puzzle.polyPieces[0].rot == 0) { chronometre.arreter(); state = 60; }
        else state = 50;
        break;
      case 60:
        playing = false;
        puzzle.container.innerHTML = "";
        puzzle.getContainerSize();
        fitImage(tmpImage, puzzle.contWidth*0.95, puzzle.contHeight*0.95);
        let finalW = tmpImage.style.width, finalH = tmpImage.style.height;
        tmpImage.style.width = `${puzzle.srcWidth * puzzle.scale}px`;
        tmpImage.style.height = `${puzzle.srcHeight * puzzle.scale}px`;
        tmpImage.style.left = `${((puzzle.polyPieces[0].x + (puzzle.srcWidth * puzzle.scale)/2) / puzzle.contWidth)*100}%`;
        tmpImage.style.top = `${((puzzle.polyPieces[0].y + (puzzle.srcHeight * puzzle.scale)/2) / puzzle.contHeight)*100}%`;
        tmpImage.style.boxShadow = "-4px 4px 4px rgba(0,0,0,0.5)";
        tmpImage.classList.add("moving");
        setTimeout(() => { tmpImage.style.top = tmpImage.style.left = "50%"; tmpImage.style.width = finalW; tmpImage.style.height = finalH; }, 0);
        puzzle.container.appendChild(tmpImage);
        setTimeout(() => {
        new Modal({
            lines: [
                " Puzzle résolu !",
                "",
                " « I am not in danger, Skyler. I am the danger. »",
                ""
            ],
            buttons: [{ text: "OK" }]
        });
    }, 500);
        state = 15;
        break;
      case 100:
        if (!event) return;
        if (event.event == "move") { if (event?.ev?.buttons === 0) { state = 50; break; } puzzle.sweepBy(event.position.x - moving.xMouseInit, event.position.y - moving.yMouseInit); moving.xMouseInit = event.position.x; moving.yMouseInit = event.position.y; return; }
        if (event.event == "leave") { state = 50; return; }
        if (event.event == "touches") { moving = { touches: event.touches }; state = 110; }
        break;
      case 110:
        if (!event) return;
        if (event.event == "leave") { state = 50; return; }
        if (event.event == "moves") { let center = { x: (moving.touches[0].x + moving.touches[1].x)/2, y: (moving.touches[0].y + moving.touches[1].y)/2 }; let dInit = mhypot(moving.touches[0].x - moving.touches[1].x, moving.touches[0].y - moving.touches[1].y); let d = mhypot(event.touches[0].x - event.touches[1].x, event.touches[0].y - event.touches[1].y); let dRef = msqrt(puzzle.contWidth * puzzle.contHeight) / 5; puzzle.zoomBy(Math.exp((d - dInit)/dRef), center); moving.touches = event.touches; return; }
        break;
      case 120:
        let saved = puzzle.getStateData();
        let str = JSON.stringify(saved);
        if (filesave) { let name = makeSaveFileName(ui.saveas.value); saveFile(str, `${name}${fileExtension}`); ui.fsave.classList.add("enhanced"); setTimeout(() => ui.fsave.classList.remove("enhanced"), 500); }
        else { try { localStorage.setItem("svpuzzle", str); ui.save.classList.add("enhanced"); setTimeout(() => ui.save.classList.remove("enhanced"), 500); } catch(e) { popup(["Erreur lors de la sauvegarde.", `JS: ${e.message}`]); } }
        state = 50;
        break;
      case 150:
        puzzle.restoredString = "";
        if (filesave) state = 152;
        else { try { puzzle.restoredString = localStorage.getItem("svpuzzle") || ""; } catch(e) { puzzle.restoredString = ""; } if (!puzzle.restoredString) { state = 15; break; } state = 155; }
        break;
      case 152:
        if (!event) return;
        if (event.event == "cancel") { state = 15; return; }
        if (event.event != "restored") return;
        state = 155;
      case 155:
        try { puzzle.restoredState = JSON.parse(puzzle.restoredString); } catch(e) { popup(["JSON invalide"]); delete puzzle.restoredState; state = 10; break; }
        if (!puzzle.restoredState.signature || puzzle.restoredState.signature != fileSignature || !puzzle.restoredState.src) { popup(["Fichier de sauvegarde invalide."]); delete puzzle.restoredState; state = 10; break; }
        puzzle.restoring = true;
        puzzle.imageLoaded = false;
        puzzle.srcImage.src = puzzle.restoredState.src;
        if (puzzle.restoredState.origin) puzzle.srcImage.dataset.origin = puzzle.restoredState.origin;
        else delete puzzle.srcImage.dataset.origin;
        if (!filesave) makeSaveFileName(puzzle.restoredState.origin || puzzle.restoredState.src);
        tInit = tStamp;
        state = 158;
      case 158:
        if (event && event.event == "srcImageLoaded") state = 160;
        else if (event && event.event == "wrongImage") { state = 10; break; }
        else if (tStamp > tInit + 5000) { events.push({ event: "timeout" }); state = 10; }
        break;
      case 160:
        tmpImage.src = puzzle.srcImage.src;
        fitImage(tmpImage, puzzle.contWidth*0.95, puzzle.contHeight*0.95);
        state = 20;
        break;
    }
  };
}

// ============================================================
// INITIALISATION
// ============================================================
prepareUI();
window.addEventListener("resize", () => { if (events.length && events[events.length-1].event == "resize") return; events.push({ event: "resize" }); });
puzzle = new Puzzle({ container: "forPuzzle" });
autoStart = false;
requestAnimationFrame(animate);
loadInitialFile();