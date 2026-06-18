const ScenarioLoader = {
  scenarios: [],
  selectedScenarioId: "default",

  async loadScenarioList() {
    try {
      const res = await fetch("data/scenarios.json");

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} while loading data/scenarios.json`);
      }

      this.scenarios = await res.json();

      if (!Array.isArray(this.scenarios)) {
        throw new Error("data/scenarios.json must contain an array.");
      }

      this.populateScenarioDropdown();
    } catch (e) {
      console.error("Scenario list load failed:", e);
      log(`Scenario list load failed: ${e.message}`);

      this.scenarios = [
        {
          id: "default",
          name: "Default Fantasy"
        }
      ];

      this.populateScenarioDropdown();
    }
  },

  populateScenarioDropdown() {
    const select = document.getElementById("scenarioSelect");

    if (!select) {
      return;
    }

    select.innerHTML = "";

    for (const scenario of this.scenarios) {
      const option = document.createElement("option");
      option.value = scenario.id;
      option.textContent = scenario.name || scenario.id;

      select.appendChild(option);
    }

    select.value = this.selectedScenarioId;
  },

  getSelectedScenarioId() {
    const select = document.getElementById("scenarioSelect");

    if (!select) {
      return this.selectedScenarioId;
    }

    this.selectedScenarioId = select.value || "default";

    return this.selectedScenarioId;
  },

  getScenarioPath(filename) {
    const scenarioId = this.getSelectedScenarioId();

    return `data/${scenarioId}/${filename}`;
  }
};

window.addEventListener("DOMContentLoaded", () => {
  ScenarioLoader.loadScenarioList();
});