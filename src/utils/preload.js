const runWhenIdle = (task) => {
  if (navigator.connection?.saveData) return;
  if ('requestIdleCallback' in window) window.requestIdleCallback(task, { timeout: 3000 });
  else setTimeout(task, 1500);
};

// Stessi import() delle route: il browser riusa il file già scaricato
const preloadAll = (importers) => runWhenIdle(() => {
  importers.forEach((load) => load().catch(() => {}));
});

/** Dalla pagina di login: dopo l'accesso il calendario è la prima cosa che serve. */
export const preloadHomePage = () => preloadAll([() => import('../pages/HomePage')]);

/** Dopo l'avvio dell'app: rende istantanei i cambi di pagina e le modali più usate. */
export const preloadAppPages = (isAdmin) => preloadAll([
  () => import('../pages/MyRequestsPage'),
  () => import('../pages/StatsPage'),
  () => import('../components/AddRequestModal'),
  () => import('../components/DayRequestsModal'),
  ...(isAdmin ? [() => import('../pages/ParkingSpacesPage')] : []),
]);
