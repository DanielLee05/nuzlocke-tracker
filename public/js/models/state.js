// Client-side state for the open run, plus the small set of queries every view needs.

export const runId = location.pathname.split("/").pop().toUpperCase();
const ACTOR_KEY = `nuz:actor:${runId}`;

export const state = {
  run: null, // latest document from the server
  actor: localStorage.getItem(ACTOR_KEY) || "", // player id this browser is acting as ("" = spectator)
  online: [], // player ids with a tab open
};

export function setActor(playerId) {
  state.actor = playerId;
  localStorage.setItem(ACTOR_KEY, playerId);
}

export const player = (id) => state.run.players.find((p) => p.id === id);

/** Each player may only edit their own column, name and sprite. */
export const canEdit = (playerId) => Boolean(state.actor) && state.actor === playerId;

/** Attempt number currently being played (archived attempts + 1). */
export const currentAttempt = () => state.run.history.length + 1;

/** [{ route, encounter }] for every route where `playerId` has a Pokémon recorded. */
export function encountersOf(playerId, { routes, encounters } = state.run) {
  return routes
    .map((route) => ({ route, encounter: encounters[route.id]?.[playerId] }))
    .filter(({ encounter }) => encounter?.species);
}

export const isDead = ({ encounter }) => encounter.status === "dead";
export const isAlive = ({ encounter }) => encounter.status === "alive";
