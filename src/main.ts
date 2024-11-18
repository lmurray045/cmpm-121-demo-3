// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

// Deterministic random number generator
import luck from "./luck.ts";

const app: HTMLDivElement = document.querySelector("#app")!;

const gameName = "GeoCacher!";
document.title = gameName;

//map element
const mainMap = document.createElement("div");
mainMap.id = "map";
app.append(mainMap);

const OAKES_CLASSROOM = leaflet.latLng(36.9894, -122.0627);
const START_ZOOM = 16;
const MAX_ZOOM = 19;
const MIN_ZOOM = 14;
const TILE_SIZE = 0.001;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

interface cell {
  i: number;
  j: number;
}

interface coin {
  x: number;
  y: number;
  serial: number;
}

interface Memento {
  coins: coin[];
  coords: { lat: number; lng: number };
}

const map = leaflet.map("map").setView(OAKES_CLASSROOM, START_ZOOM);

leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: MAX_ZOOM,
  minZoom: MIN_ZOOM,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const player = leaflet.marker([36.9894, -122.0627]).addTo(
  map,
);
player.bindPopup("This is you!");
player.openPopup();
//player coin counter
const player_coins: coin[] = [];

const centerOnSpawnOffset = 0.0005;

let neighborhood: cell[][] = [];

const mementoCaretaker: Map<string, Memento> = new Map();

function displayCoinList(c: coin[]): string[] {
  const displayList: string[] = [];
  c.forEach((c) => {
    displayList.push(`{${c.x.toFixed(4)}|${c.y.toFixed(4)}: ${c.serial}}`);
  });
  return displayList;
}

function renderCell(square: cell): void {
  const corners: leaflet.LatLng[] = [];
  const topRight = leaflet.latLng(square.i, square.j);
  const topLeft = leaflet.latLng(square.i, square.j - TILE_SIZE);
  const bottomRight = leaflet.latLng(square.i - TILE_SIZE, square.j);
  const bottomLeft = leaflet.latLng(
    square.i - TILE_SIZE,
    square.j - TILE_SIZE,
  );
  corners.push(topRight);
  corners.push(topLeft);
  corners.push(bottomLeft);
  corners.push(bottomRight);
  leaflet.polyline(corners, { color: "blue", weight: 1, opacity: 0.8 }).addTo(
    map,
  );
}

function moveDown() {
  const pos = player.getLatLng();
  const x = pos.lat;
  const y = pos.lng;
  player.setLatLng([x - TILE_SIZE, y]);
  updatePlayer("down");
}
function moveUp() {
  const pos = player.getLatLng();
  const x = pos.lat;
  const y = pos.lng;
  player.setLatLng([x + TILE_SIZE, y]);
  updatePlayer("up");
}
function moveRight() {
  const pos = player.getLatLng();
  const x = pos.lat;
  const y = pos.lng;
  player.setLatLng([x, y + TILE_SIZE]);
  updatePlayer();
}
function moveLeft() {
  const pos = player.getLatLng();
  const x = pos.lat;
  const y = pos.lng;
  player.setLatLng([x, y - TILE_SIZE]);
  updatePlayer("left");
}

function updatePlayer(direction?: "left" | "right" | "up" | "down") {
  if (direction) {
    updateNeighborhood(direction);
  } else {
    updateNeighborhood();
  }
  generateCaches();
  map.setView(player.getLatLng(), START_ZOOM);
}

function createOrRestoreCache(coords: leaflet.LatLng): void {
  const mementoKey = `${coords.lat},${coords.lng}`;
  let cacheState: { coins: coin[]; coords: leaflet.LatLng } | undefined =
    undefined;
  if (mementoCaretaker.has(mementoKey)) {
    // Restore from memento
    cacheState = restoreState(mementoCaretaker.get(mementoKey) as Memento);
  } else {
    // Create a new cache state
    cacheState = {
      coins: generateCoins(coords), // Assuming a function that generates coins
      coords: coords,
    };
    mementoCaretaker.set(mementoKey, saveState(cacheState.coins, coords));
  }
  const newCacheWindow = newCacheMarker(coords);
  createCache(newCacheWindow, cacheState); // Attach the state to the cache popup
}

function generateCoins(coords: leaflet.LatLng): coin[] {
  const coinList: coin[] = [];
  const numCoins = Math.floor(
    luck([coords, "initialValue"].toString()) * 10,
  );
  for (
    let i = 0;
    i < numCoins;
    i++
  ) {
    const x = coords.lat;
    const y = coords.lng;
    const newCoin: coin = {
      x: x,
      y: y,
      serial: i,
    };
    coinList.push(newCoin);
  }
  return coinList;
}

function createCache(obj: leaflet.CircleMarker, sqr: Memento) {
  //CITATION - much of this code is taken from the example file

  obj.bindPopup(() => {
    // Each cache has a random point value, mutable by the player
    const coinList: coin[] = sqr.coins;

    // The popup offers a description and button
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
      <div>There is a cache here at "${obj.getLatLng().lat.toFixed(4)}, ${
      obj.getLatLng().lng.toFixed(4)
    }". It has the following coins: <span id="value">${
      displayCoinList(coinList)
    }</span>.</div>
        <button id="take">Take</button>
        <button id="deposit">Deposit</button>`;
    // Clicking the button decrements the cache's value and increments the player's points
    popupDiv.querySelector<HTMLButtonElement>("#take")!
      .addEventListener("click", () => {
        if (coinList.length > 0) {
          const newCoin = coinList.pop();
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = `${
            displayCoinList(coinList)
          }`;
          player_coins.push(newCoin as coin);
          playerCoins.innerHTML = `Player Coins: ${
            displayCoinList(player_coins)
          }`;
        }
        mementoCaretaker.set(
          `${sqr.coords.lat},${sqr.coords.lng}`,
          saveState(coinList, leaflet.latLng(sqr.coords)),
        );
      });
    popupDiv.querySelector<HTMLButtonElement>("#deposit")!
      .addEventListener("click", () => {
        if (player_coins.length > 0) {
          const newCoin = player_coins.pop();
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = `${
            displayCoinList(coinList)
          }`;
          coinList.push(newCoin as coin);
          playerCoins.innerHTML = `Player Coins: ${
            displayCoinList(player_coins)
          }`;
        }
        mementoCaretaker.set(
          `${sqr.coords.lat},${sqr.coords.lng}`,
          saveState(coinList, leaflet.latLng(sqr.coords)),
        );
      });
    return popupDiv;
  });
}

function saveState(coinList: coin[], coords: leaflet.LatLng): Memento {
  return {
    coins: [...coinList], // Clone the array for immutability
    coords: { lat: coords.lat, lng: coords.lng },
  };
}

function restoreState(
  memento: Memento,
): { coins: coin[]; coords: leaflet.LatLng } {
  const state = memento;
  return {
    coins: [...state.coins], // Create a copy to maintain the separation
    coords: leaflet.latLng(state.coords.lat, state.coords.lng),
  };
}

function newCacheMarker(coords: leaflet.LatLng): leaflet.CircleMarker {
  const circ = leaflet.circleMarker(
    leaflet.latLng(
      coords.lat + centerOnSpawnOffset,
      coords.lng + centerOnSpawnOffset,
    ),
    {
      radius: 15,
      color: "red",
      weight: 4,
    },
  ).addTo(map);
  return circ;
}

//make caches:
function placeCache(coords: cell) {
  const x = coords.i;
  const y = coords.j;
  createOrRestoreCache(leaflet.latLng(x, y));
}

function updateNeighborhood(direction?: "left" | "right" | "up" | "down") {
  const current_square = player.getLatLng();
  const current_x = current_square.lat;
  const current_y = current_square.lng;
  if (direction) {
    if (direction == "right") {
      neighborhood.forEach((row) => {
        const i = row[0].i;
        const j = current_y + (NEIGHBORHOOD_SIZE * TILE_SIZE) + TILE_SIZE;
        const cell: cell = {
          i: i + centerOnSpawnOffset,
          j: j + centerOnSpawnOffset,
        };
        row.push(cell);
        row.shift();
        renderCell(cell);
      });
    } else if (direction == "left") {
      neighborhood.forEach((row) => {
        const i = row[0].i;
        const j = current_y - (NEIGHBORHOOD_SIZE * TILE_SIZE) +
          centerOnSpawnOffset;
        const cell: cell = {
          i: i,
          j: j,
        };
        row.pop();
        row.unshift(cell);
        renderCell(cell);
      });
    } else if (direction == "up") {
      neighborhood.shift();
      const newRow: cell[] = [];
      for (
        let j = current_y - (NEIGHBORHOOD_SIZE * TILE_SIZE);
        j < current_y + (NEIGHBORHOOD_SIZE * TILE_SIZE);
        j += TILE_SIZE
      ) {
        const newCell: cell = {
          i: current_x + (NEIGHBORHOOD_SIZE * TILE_SIZE) + centerOnSpawnOffset,
          j: j + centerOnSpawnOffset,
        };
        newRow.push(newCell);
        renderCell(newCell);
      }
      neighborhood.push(newRow);
    } else {
      neighborhood.pop();
      const newRow: cell[] = [];
      for (
        let j = current_y - (NEIGHBORHOOD_SIZE * TILE_SIZE);
        j < current_y + (NEIGHBORHOOD_SIZE * TILE_SIZE);
        j += TILE_SIZE
      ) {
        const newCell: cell = {
          i: current_x - (NEIGHBORHOOD_SIZE * TILE_SIZE) + centerOnSpawnOffset,
          j: j + centerOnSpawnOffset,
        };
        newRow.push(newCell);
        renderCell(newCell);
      }
      neighborhood.unshift(newRow);
    }
  } else {
    neighborhood = [];
    for (
      let i = current_x - (NEIGHBORHOOD_SIZE * TILE_SIZE);
      i < current_x + (NEIGHBORHOOD_SIZE * TILE_SIZE);
      i += TILE_SIZE
    ) {
      const row: cell[] = [];
      for (
        let j = current_y - (NEIGHBORHOOD_SIZE * TILE_SIZE);
        j < current_y + (NEIGHBORHOOD_SIZE * TILE_SIZE);
        j += TILE_SIZE
      ) {
        const sqr: cell = {
          i: i + centerOnSpawnOffset,
          j: j + centerOnSpawnOffset,
        };
        row.push(sqr);
        renderCell(sqr);
      }
      neighborhood.push(row);
    }
    generateCaches();
  }
}

function generateCaches() {
  neighborhood.forEach((coords: cell[]) => {
    coords.forEach((square: cell) => {
      if (
        luck(`${square.i}, ${square.j} probability`) <= CACHE_SPAWN_PROBABILITY
      ) {
        const topCorner = square;
        const marker: cell = {
          i: topCorner.i,
          j: topCorner.j,
        };
        placeCache(marker);
      }
    });
  });
}

updateNeighborhood();

generateCaches();

map.setView(player.getLatLng(), START_ZOOM);
player.openPopup();

//make buttons
const leftButton = document.createElement("button");
leftButton.innerHTML = "Left";
app.append(leftButton);

const rightButton = document.createElement("button");
rightButton.innerHTML = "Right";
app.append(rightButton);

const upButton = document.createElement("button");
upButton.innerHTML = "Up";
app.append(upButton);

const downButton = document.createElement("button");
downButton.innerHTML = "Down";
app.append(downButton);

const playerCoins = document.createElement("div");
playerCoins.innerHTML = `Player Coins: ${player_coins}`;
app.append(playerCoins);

//alert button added
leftButton.addEventListener("click", () => {
  moveLeft();
});

rightButton.addEventListener("click", () => {
  moveRight();
});

upButton.addEventListener("click", () => {
  moveUp();
});

downButton.addEventListener("click", () => {
  moveDown();
});
