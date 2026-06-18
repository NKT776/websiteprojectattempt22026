const Map = {
  territories: [],
  runningPhysics: true,

generate(territoryNames = []) {
  this.territories = [];

  const shuffledNames = shuffleArray([...territoryNames]);

  for (let i = 0; i < 30; i++) {
    const name = shuffledNames[i] || `T${i}`;

    this.territories.push({
      id: i,
      name,

      connections: [],
      owner: null,

      defense: randRange(0, 5),
      economy: randRange(1000, 10000),
      points: randRange(1, 5),

      x: Math.random() * 900,
      y: Math.random() * 600,

      vx: 0,
      vy: 0
    });
  }

  // backbone chain, ensures the whole world is connected
  for (let i = 0; i < 29; i++) {
    this.link(i, i + 1);
  }

  // extra random edges, still max 3 connections per territory
  for (let i = 0; i < 50; i++) {
    let a = randRange(0, 29);
    let b = randRange(0, 29);

    if (a !== b) {
      this.link(a, b);
    }
  }
},

  link(a, b) {
    let A = this.territories[a];
    let B = this.territories[b];

    if (A.connections.length >= 3 || B.connections.length >= 3) return;

    if (!A.connections.includes(b)) A.connections.push(b);
    if (!B.connections.includes(a)) B.connections.push(a);
  },

  // 🌐 physics layout step
  stepPhysics() {
    const nodes = this.territories;

    // repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        let a = nodes[i], b = nodes[j];

        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dist = Math.max(20, Math.sqrt(dx * dx + dy * dy));

        let force = 2000 / (dist * dist);

        let fx = (dx / dist) * force;
        let fy = (dy / dist) * force;

        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    // spring attraction (edges)
    for (let a of nodes) {
      for (let c of a.connections) {
        let b = nodes[c];

        let dx = b.x - a.x;
        let dy = b.y - a.y;

        let dist = Math.max(20, Math.sqrt(dx * dx + dy * dy));

        let force = 0.02 * dist;

        let fx = (dx / dist) * force;
        let fy = (dy / dist) * force;

        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    // integrate
    for (let n of nodes) {
      n.vx *= 0.85;
      n.vy *= 0.85;

      n.x += n.vx;
      n.y += n.vy;

      // bounds
      n.x = Math.min(880, Math.max(20, n.x));
      n.y = Math.min(580, Math.max(20, n.y));
    }
  },

getTerritoryAt(x, y) {
  const clickRadius = 28;

  for (const territory of this.territories) {
    const dx = territory.x - x;
    const dy = territory.y - y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= clickRadius) {
      return territory;
    }
  }

  return null;
},

highlightTerritory(ctx, territory) {
  if (!territory) return;

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.arc(territory.x, territory.y, 18, 0, Math.PI * 2);
  ctx.stroke();
},

  draw(ctx) {
    ctx.clearRect(0, 0, 900, 600);

    // edges
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1;

    for (let t of this.territories) {
      for (let c of t.connections) {
        let o = this.territories[c];
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(o.x, o.y);
        ctx.stroke();
      }
    }

    // nodes
for (let t of this.territories) {
  ctx.fillStyle = t.owner ? t.owner.color : "#999";

  ctx.beginPath();
  ctx.arc(t.x, t.y, 10, 0, Math.PI * 2);
  ctx.fill();

  if (
    typeof Game !== "undefined" &&
    Game.playerFaction &&
    t.owner &&
    t.owner.id === Game.playerFaction.id
  ) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 14, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = "#fff";
  ctx.font = "10px Arial";
  ctx.textAlign = "center";
  ctx.fillText(t.id, t.x, t.y + 4);

  ctx.font = "11px Arial";
  ctx.fillText(t.name, t.x, t.y - 16);
  ctx.textAlign = "left";
}
  }

  
};

function randRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}