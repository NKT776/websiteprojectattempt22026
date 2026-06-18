const Factions = {
  all: [],
  list: [],

  async load() {
    const data = await CSVLoader.load(ScenarioLoader.getScenarioPath("factions.csv"));

    this.all = [];

    // Load all CSV factions, not just IDs 0–18
    for (const row of data) {
      const id = parseInt(row.id);

      if (Number.isNaN(id)) continue;

this.all.push({
  id,
  name: row.name || `Faction ${id}`,
  color: null,
  leader: Commander.createLeader(row),
  commanders: [],
  territories: [],
  tier: null,
  startingTerritoryCount: 0,
  gold: 0,
  eliminated: false
});
    }

    // If fewer than 19 CSV factions exist, create fallback factions
    let fallbackId = 0;

    while (this.all.length < 19) {
      while (this.all.some(f => f.id === fallbackId)) {
        fallbackId++;
      }

      const fallbackRow = {
        id: fallbackId,
        name: `Faction ${fallbackId}`,
        leadfirst: `Fact ${fallbackId}`,
        leadlast: "Leader",
        cost: 1,
        attack: 1,
        defense: 1,
        speed: 1,
        maxtroop: 1
      };

this.all.push({
  id: fallbackId,
  name: fallbackRow.name,
  color: null,
  leader: Commander.createLeader(fallbackRow),
  commanders: [],
  territories: [],
  tier: null,
  startingTerritoryCount: 0,
  gold: 0,
  eliminated: false
});
    }

    this.chooseActiveFactions();
  },

  chooseActiveFactions() {
    const shuffled = shuffleArray([...this.all]);

    const selected = shuffled.slice(0, 19);

    this.list = selected.map((faction, index) => {
      let tier;
      let startingTerritoryCount;

      if (index < 3) {
        tier = "supermajor";
        startingTerritoryCount = 3;
      } else if (index < 8) {
        tier = "major";
        startingTerritoryCount = 2;
      } else {
        tier = "minor";
        startingTerritoryCount = 1;
      }

return {
  ...faction,
  color: `hsl(${index * 19}, 70%, 60%)`,
  tier,
  startingTerritoryCount,
  commanders: [],
  territories: [],
  gold: 0,
  eliminated: false
};
    });
  }
};