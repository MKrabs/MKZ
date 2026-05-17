/**
 * Default map coordinates for each German Bundesland (ISO 3166-2).
 * Points to the state capital. Used to pan the globe when a
 * kennzeichen is matched but no city-specific coordinates exist.
 *
 * Format: [longitude, latitude]
 */
export const BUNDESLAND_COORDS: Record<string, [number, number]> = {
  'DE-BW': [9.182,  48.776],   // Stuttgart (Baden-Württemberg)
  'DE-BY': [11.582, 48.135],   // München   (Bayern)
  'DE-BE': [13.405, 52.520],   // Berlin
  'DE-BB': [13.060, 52.397],   // Potsdam   (Brandenburg)
  'DE-HB': [8.807,  53.075],   // Bremen
  'DE-HH': [9.993,  53.551],   // Hamburg
  'DE-HE': [8.684,  50.113],   // Wiesbaden (Hessen)
  'DE-MV': [11.415, 53.629],   // Schwerin  (Mecklenburg-Vorpommern)
  'DE-NI': [9.733,  52.374],   // Hannover  (Niedersachsen)
  'DE-NW': [6.773,  51.227],   // Düsseldorf (Nordrhein-Westfalen)
  'DE-RP': [7.308,  50.099],   // Mainz     (Rheinland-Pfalz)
  'DE-SL': [6.993,  49.236],   // Saarbrücken (Saarland)
  'DE-SN': [13.738, 51.050],   // Dresden   (Sachsen)
  'DE-ST': [11.627, 52.130],   // Magdeburg (Sachsen-Anhalt)
  'DE-SH': [10.123, 54.323],   // Kiel      (Schleswig-Holstein)
  'DE-TH': [11.030, 50.979],   // Erfurt    (Thüringen)
};

/** Zoom level to use when panning to a state (less precise than a city). */
export const BUNDESLAND_ZOOM = 8;
