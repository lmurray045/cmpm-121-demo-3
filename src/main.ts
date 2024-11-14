// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet, { latLng } from "leaflet";

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

const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
const START_ZOOM = 16;
const MAX_ZOOM = 19;
const MIN_ZOOM = 15;
const TILE_SIZE = 0.001;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

const map = leaflet.map("map").setView(OAKES_CLASSROOM, START_ZOOM);

leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: MAX_ZOOM,
  minZoom: MIN_ZOOM,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const player = leaflet.marker([36.98949379578401, -122.06277128548504]).addTo(
  map,
);
player.bindPopup("This is you!");
player.openPopup();

let player_coins = 0;

// create a red polyline from an array of LatLng points
const number_of_squares = 1000;
const centerOnSpawnOffset = 0.0005;
const start_grid_lat = OAKES_CLASSROOM.lat -
  (number_of_squares / 2) * TILE_SIZE + centerOnSpawnOffset;
const end_grid_lat = OAKES_CLASSROOM.lat +
  (number_of_squares / 2) * TILE_SIZE + centerOnSpawnOffset;
const start_grid_long = OAKES_CLASSROOM.lng -
  (number_of_squares / 2) * TILE_SIZE + centerOnSpawnOffset;
const end_grid_long = OAKES_CLASSROOM.lng +
  (number_of_squares / 2) * TILE_SIZE + centerOnSpawnOffset;
const latlngs: leaflet.LatLng[][] = [];
let neighborhood: leaflet.LatLng[] = [];

for (let i = start_grid_lat; i < end_grid_lat; i += TILE_SIZE) {
  latlngs.push([
    leaflet.latLng(i, start_grid_long),
    leaflet.latLng(i, end_grid_long),
  ]);
}

for (let j = start_grid_long; j < end_grid_long; j += TILE_SIZE) {
  latlngs.push([
    leaflet.latLng(start_grid_lat, j),
    leaflet.latLng(end_grid_lat, j),
  ]);
}
leaflet.polyline(latlngs, { color: "blue", weight: 1, opacity: 0.8 }).addTo(
  map,
);

function moveDown() {
  const pos = player.getLatLng();
  const x = pos.lat;
  const y = pos.lng;
  player.setLatLng([x - TILE_SIZE, y]);
  updatePlayer();
}
function moveUp() {
  const pos = player.getLatLng();
  const x = pos.lat;
  const y = pos.lng;
  player.setLatLng([x + TILE_SIZE, y]);
  updatePlayer();
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
  updatePlayer();
}

function updatePlayer() {
  updateNeighborhood();
  generateCaches();
  map.setView(player.getLatLng(), START_ZOOM);
}

function createCache(obj: leaflet.CircleMarker) {
  //CITATION - much of this code is taken from the example file
  obj.bindPopup(() => {
    // Each cache has a random point value, mutable by the player
    let pointValue = Math.floor(
      luck([obj.getLatLng(), "initialValue"].toString()) * 100,
    );
    // The popup offers a description and button
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
                <div>There is a cache here at "${obj.getLatLng().lat}, ${obj.getLatLng().lng}". It has value <span id="value">${pointValue}</span>.</div>
                <button id="take">Take</button>
                <button id="deposit">Deposit</button>`;
    // Clicking the button decrements the cache's value and increments the player's points
    popupDiv.querySelector<HTMLButtonElement>("#take")!
      .addEventListener("click", () => {
        if (pointValue > 0) {
          pointValue--;
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            pointValue.toString();
          player_coins += 1;
          playerCoins.innerHTML = `Player Coins: ${player_coins}`;
        }
      });
    popupDiv.querySelector<HTMLButtonElement>("#deposit")!
      .addEventListener("click", () => {
        if (player_coins > 0) {
          pointValue++;
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            pointValue.toString();
          player_coins -= 1;
          playerCoins.innerHTML = `Player Coins: ${player_coins}`;
        }
      });
    return popupDiv;
  });
}

//make caches:
function placeCache(coords: leaflet.LatLng) {
  const circ = leaflet.circleMarker(coords, {
    radius: 15,
    color: "red",
    weight: 4,
  }).addTo(map);
  createCache(circ);
  circ.openPopup();
  return circ;
}

function updateNeighborhood() {
  neighborhood = [];
  const current_square = player.getLatLng();
  const current_x = current_square.lat;
  const current_y = current_square.lng;
  for (
    let i = current_x - (NEIGHBORHOOD_SIZE * TILE_SIZE);
    i < current_x + (NEIGHBORHOOD_SIZE * TILE_SIZE);
    i += TILE_SIZE
  ) {
    for (
      let j = current_y - (NEIGHBORHOOD_SIZE * TILE_SIZE);
      j < current_y + (NEIGHBORHOOD_SIZE * TILE_SIZE);
      j += TILE_SIZE
    ) {
      const pnt = leaflet.latLng(i, j);
      neighborhood.push(pnt);
    }
  }
}

function generateCaches() {
  neighborhood.forEach((coords) => {
    if (luck(coords.toString()) <= CACHE_SPAWN_PROBABILITY) {
      const topCorner = coords;
      const marker: leaflet.LatLng = leaflet.latLng(
        topCorner.lat,
        topCorner.lng,
      );
      placeCache(marker);
    }
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
