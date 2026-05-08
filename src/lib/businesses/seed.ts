import type { Business } from "./types"

// Real cities with approximate centroid lat/lng. Plausible roofer business names.
// Distributed across storm-prone US states (tornado alley, hail belt, hurricane belt, severe weather corridor).
export const SEEDED_BUSINESSES: Business[] = [
  // Texas
  { id: "biz-tx-01", name: "Lone Star Roofing", city: "Dallas", state: "TX", lat: 32.7767, lng: -96.797, phone: "+12145551001", email: "ops@lonestarroofing.test", timezone: "America/Chicago" },
  { id: "biz-tx-02", name: "Bluebonnet Roofing Co", city: "Fort Worth", state: "TX", lat: 32.7555, lng: -97.3308, phone: "+18175551002", email: "ops@bluebonnetroof.test", timezone: "America/Chicago" },
  { id: "biz-tx-03", name: "Capital City Roofers", city: "Austin", state: "TX", lat: 30.2672, lng: -97.7431, phone: "+15125551003", email: "ops@capcityroofers.test", timezone: "America/Chicago" },
  { id: "biz-tx-04", name: "Bayou Town Roofing", city: "Houston", state: "TX", lat: 29.7604, lng: -95.3698, phone: "+17135551004", email: "ops@bayoutown.test", timezone: "America/Chicago" },
  { id: "biz-tx-05", name: "Mission Roof Works", city: "San Antonio", state: "TX", lat: 29.4241, lng: -98.4936, phone: "+12105551005", email: "ops@missionroof.test", timezone: "America/Chicago" },
  { id: "biz-tx-06", name: "Panhandle Pro Roofing", city: "Amarillo", state: "TX", lat: 35.222, lng: -101.8313, phone: "+18065551006", email: "ops@panhandlepro.test", timezone: "America/Chicago" },
  { id: "biz-tx-07", name: "Border Roofing Solutions", city: "El Paso", state: "TX", lat: 31.7619, lng: -106.485, phone: "+19155551007", email: "ops@borderroof.test", timezone: "America/Denver" },
  { id: "biz-tx-08", name: "Piney Woods Roofing", city: "Tyler", state: "TX", lat: 32.3513, lng: -95.3011, phone: "+19035551008", email: "ops@pineywoods.test", timezone: "America/Chicago" },

  // Oklahoma
  { id: "biz-ok-01", name: "Sooner Roofing", city: "Oklahoma City", state: "OK", lat: 35.4676, lng: -97.5164, phone: "+14055551009", email: "ops@soonerroof.test", timezone: "America/Chicago" },
  { id: "biz-ok-02", name: "Twister Town Roofers", city: "Tulsa", state: "OK", lat: 36.154, lng: -95.9928, phone: "+19185551010", email: "ops@twistertown.test", timezone: "America/Chicago" },
  { id: "biz-ok-03", name: "Red Dirt Roofing", city: "Norman", state: "OK", lat: 35.222, lng: -97.4395, phone: "+14055551011", email: "ops@reddirt.test", timezone: "America/Chicago" },
  { id: "biz-ok-04", name: "Plains Roofing Group", city: "Lawton", state: "OK", lat: 34.6087, lng: -98.3903, phone: "+15805551012", email: "ops@plainsroof.test", timezone: "America/Chicago" },

  // Kansas
  { id: "biz-ks-01", name: "Sunflower Roofing", city: "Wichita", state: "KS", lat: 37.6872, lng: -97.3301, phone: "+13165551013", email: "ops@sunflowerroof.test", timezone: "America/Chicago" },
  { id: "biz-ks-02", name: "Tallgrass Roofing", city: "Topeka", state: "KS", lat: 39.0473, lng: -95.6752, phone: "+17855551014", email: "ops@tallgrass.test", timezone: "America/Chicago" },
  { id: "biz-ks-03", name: "Heartland Roof & Tarp", city: "Kansas City", state: "KS", lat: 39.1141, lng: -94.6275, phone: "+19135551015", email: "ops@heartlandroof.test", timezone: "America/Chicago" },
  { id: "biz-ks-04", name: "Salina Stormcrew Roofing", city: "Salina", state: "KS", lat: 38.8403, lng: -97.6114, phone: "+17855551016", email: "ops@salinacrew.test", timezone: "America/Chicago" },

  // Missouri
  { id: "biz-mo-01", name: "Show-Me Roofing", city: "Kansas City", state: "MO", lat: 39.0997, lng: -94.5786, phone: "+18165551017", email: "ops@showmeroof.test", timezone: "America/Chicago" },
  { id: "biz-mo-02", name: "Gateway Roofing Solutions", city: "Saint Louis", state: "MO", lat: 38.627, lng: -90.1994, phone: "+13145551018", email: "ops@gatewayroof.test", timezone: "America/Chicago" },
  { id: "biz-mo-03", name: "Springfield Storm Roofing", city: "Springfield", state: "MO", lat: 37.2089, lng: -93.2923, phone: "+14175551019", email: "ops@springfieldstorm.test", timezone: "America/Chicago" },
  { id: "biz-mo-04", name: "Joplin Roof Pros", city: "Joplin", state: "MO", lat: 37.0842, lng: -94.5133, phone: "+14175551020", email: "ops@joplinpros.test", timezone: "America/Chicago" },

  // Florida
  { id: "biz-fl-01", name: "Sunshine State Roofing", city: "Miami", state: "FL", lat: 25.7617, lng: -80.1918, phone: "+13055551021", email: "ops@sunshineroof.test", timezone: "America/New_York" },
  { id: "biz-fl-02", name: "Bay Roofing Co", city: "Tampa", state: "FL", lat: 27.9506, lng: -82.4572, phone: "+18135551022", email: "ops@bayroof.test", timezone: "America/New_York" },
  { id: "biz-fl-03", name: "Magic City Roofers", city: "Orlando", state: "FL", lat: 28.5383, lng: -81.3792, phone: "+14075551023", email: "ops@magiccityroof.test", timezone: "America/New_York" },
  { id: "biz-fl-04", name: "First Coast Roofing", city: "Jacksonville", state: "FL", lat: 30.3322, lng: -81.6557, phone: "+19045551024", email: "ops@firstcoast.test", timezone: "America/New_York" },
  { id: "biz-fl-05", name: "Emerald Coast Roofers", city: "Pensacola", state: "FL", lat: 30.4213, lng: -87.2169, phone: "+18505551025", email: "ops@emeraldroof.test", timezone: "America/Chicago" },
  { id: "biz-fl-06", name: "Treasure Coast Roof", city: "Fort Pierce", state: "FL", lat: 27.4467, lng: -80.3256, phone: "+17725551026", email: "ops@treasurecoast.test", timezone: "America/New_York" },
  { id: "biz-fl-07", name: "Gulf Side Roofing", city: "Fort Myers", state: "FL", lat: 26.6406, lng: -81.8723, phone: "+12395551027", email: "ops@gulfside.test", timezone: "America/New_York" },

  // Colorado (hail belt)
  { id: "biz-co-01", name: "Mile High Roofing", city: "Denver", state: "CO", lat: 39.7392, lng: -104.9903, phone: "+13035551028", email: "ops@milehighroof.test", timezone: "America/Denver" },
  { id: "biz-co-02", name: "Front Range Roofers", city: "Colorado Springs", state: "CO", lat: 38.8339, lng: -104.8214, phone: "+17195551029", email: "ops@frontrange.test", timezone: "America/Denver" },
  { id: "biz-co-03", name: "Bouldercrest Roofing", city: "Boulder", state: "CO", lat: 40.015, lng: -105.2705, phone: "+13035551030", email: "ops@bouldercrest.test", timezone: "America/Denver" },
  { id: "biz-co-04", name: "Choice City Roofing", city: "Fort Collins", state: "CO", lat: 40.5853, lng: -105.0844, phone: "+19705551031", email: "ops@choicecity.test", timezone: "America/Denver" },
  { id: "biz-co-05", name: "Pueblo Plains Roofing", city: "Pueblo", state: "CO", lat: 38.2544, lng: -104.6091, phone: "+17195551032", email: "ops@pueblo.test", timezone: "America/Denver" },

  // Alabama
  { id: "biz-al-01", name: "Heart of Dixie Roofing", city: "Birmingham", state: "AL", lat: 33.5186, lng: -86.8104, phone: "+12055551033", email: "ops@heartofdixie.test", timezone: "America/Chicago" },
  { id: "biz-al-02", name: "Cradle Coast Roofing", city: "Mobile", state: "AL", lat: 30.6954, lng: -88.0399, phone: "+12515551034", email: "ops@cradlecoast.test", timezone: "America/Chicago" },
  { id: "biz-al-03", name: "Capstone Roofers", city: "Tuscaloosa", state: "AL", lat: 33.2098, lng: -87.5692, phone: "+12055551035", email: "ops@capstone.test", timezone: "America/Chicago" },
  { id: "biz-al-04", name: "Rocket City Roof", city: "Huntsville", state: "AL", lat: 34.7304, lng: -86.5861, phone: "+12565551036", email: "ops@rocketcity.test", timezone: "America/Chicago" },
  { id: "biz-al-05", name: "Capital Roofing Group", city: "Montgomery", state: "AL", lat: 32.3668, lng: -86.3, phone: "+13345551037", email: "ops@capitalroofgroup.test", timezone: "America/Chicago" },

  // Mississippi
  { id: "biz-ms-01", name: "Magnolia Roofing", city: "Jackson", state: "MS", lat: 32.2988, lng: -90.1848, phone: "+16015551038", email: "ops@magnoliaroof.test", timezone: "America/Chicago" },
  { id: "biz-ms-02", name: "Pine Belt Roofers", city: "Hattiesburg", state: "MS", lat: 31.327, lng: -89.2903, phone: "+16015551039", email: "ops@pinebelt.test", timezone: "America/Chicago" },
  { id: "biz-ms-03", name: "Coastal MS Roofing", city: "Biloxi", state: "MS", lat: 30.3960, lng: -88.8853, phone: "+12285551040", email: "ops@coastalms.test", timezone: "America/Chicago" },
  { id: "biz-ms-04", name: "Delta Roof Co", city: "Tupelo", state: "MS", lat: 34.2576, lng: -88.7034, phone: "+16625551041", email: "ops@deltaroof.test", timezone: "America/Chicago" },

  // Louisiana
  { id: "biz-la-01", name: "Crescent City Roofing", city: "New Orleans", state: "LA", lat: 29.9511, lng: -90.0715, phone: "+15045551042", email: "ops@crescentcity.test", timezone: "America/Chicago" },
  { id: "biz-la-02", name: "Red Stick Roofers", city: "Baton Rouge", state: "LA", lat: 30.4515, lng: -91.1871, phone: "+12255551043", email: "ops@redstick.test", timezone: "America/Chicago" },
  { id: "biz-la-03", name: "Cajun Coast Roofing", city: "Lafayette", state: "LA", lat: 30.2241, lng: -92.0198, phone: "+13375551044", email: "ops@cajuncoast.test", timezone: "America/Chicago" },
  { id: "biz-la-04", name: "Sportsman Roofing", city: "Shreveport", state: "LA", lat: 32.5252, lng: -93.7502, phone: "+13185551045", email: "ops@sportsmanroof.test", timezone: "America/Chicago" },

  // Georgia
  { id: "biz-ga-01", name: "Peach State Roofing", city: "Atlanta", state: "GA", lat: 33.749, lng: -84.388, phone: "+14045551046", email: "ops@peachstate.test", timezone: "America/New_York" },
  { id: "biz-ga-02", name: "Garden City Roofers", city: "Augusta", state: "GA", lat: 33.4735, lng: -82.0105, phone: "+17065551047", email: "ops@gardencity.test", timezone: "America/New_York" },
  { id: "biz-ga-03", name: "Hostess City Roofing", city: "Savannah", state: "GA", lat: 32.0809, lng: -81.0912, phone: "+19125551048", email: "ops@hostesscity.test", timezone: "America/New_York" },
  { id: "biz-ga-04", name: "Classic City Roof", city: "Athens", state: "GA", lat: 33.9519, lng: -83.3576, phone: "+17065551049", email: "ops@classiccity.test", timezone: "America/New_York" },

  // Tennessee
  { id: "biz-tn-01", name: "Music City Roofing", city: "Nashville", state: "TN", lat: 36.1627, lng: -86.7816, phone: "+16155551050", email: "ops@musiccity.test", timezone: "America/Chicago" },
  { id: "biz-tn-02", name: "Bluff City Roofers", city: "Memphis", state: "TN", lat: 35.1495, lng: -90.049, phone: "+19015551051", email: "ops@bluffcity.test", timezone: "America/Chicago" },
  { id: "biz-tn-03", name: "Scruffy City Roofing", city: "Knoxville", state: "TN", lat: 35.9606, lng: -83.9207, phone: "+18655551052", email: "ops@scruffycity.test", timezone: "America/New_York" },
  { id: "biz-tn-04", name: "Scenic City Roof", city: "Chattanooga", state: "TN", lat: 35.0456, lng: -85.3097, phone: "+14235551053", email: "ops@sceniccity.test", timezone: "America/New_York" },

  // North Carolina
  { id: "biz-nc-01", name: "Queen City Roofing", city: "Charlotte", state: "NC", lat: 35.2271, lng: -80.8431, phone: "+17045551054", email: "ops@queencityroof.test", timezone: "America/New_York" },
  { id: "biz-nc-02", name: "Triangle Roof Pros", city: "Raleigh", state: "NC", lat: 35.7796, lng: -78.6382, phone: "+19195551055", email: "ops@triangleroof.test", timezone: "America/New_York" },
  { id: "biz-nc-03", name: "Gate City Roofing", city: "Greensboro", state: "NC", lat: 36.0726, lng: -79.792, phone: "+13365551056", email: "ops@gatecity.test", timezone: "America/New_York" },
  { id: "biz-nc-04", name: "Port City Roofers", city: "Wilmington", state: "NC", lat: 34.2104, lng: -77.8868, phone: "+19105551057", email: "ops@portcity.test", timezone: "America/New_York" },

  // Illinois
  { id: "biz-il-01", name: "Windy City Roofing", city: "Chicago", state: "IL", lat: 41.8781, lng: -87.6298, phone: "+13125551058", email: "ops@windycity.test", timezone: "America/Chicago" },
  { id: "biz-il-02", name: "Land of Lincoln Roof", city: "Springfield", state: "IL", lat: 39.7817, lng: -89.6501, phone: "+12175551059", email: "ops@lincolnroof.test", timezone: "America/Chicago" },
  { id: "biz-il-03", name: "Riverbend Roofing", city: "Peoria", state: "IL", lat: 40.6936, lng: -89.589, phone: "+13095551060", email: "ops@riverbend.test", timezone: "America/Chicago" },

  // Indiana
  { id: "biz-in-01", name: "Crossroads Roofing", city: "Indianapolis", state: "IN", lat: 39.7684, lng: -86.1581, phone: "+13175551061", email: "ops@crossroadsroof.test", timezone: "America/New_York" },
  { id: "biz-in-02", name: "Summit City Roofers", city: "Fort Wayne", state: "IN", lat: 41.0793, lng: -85.1394, phone: "+12605551062", email: "ops@summitcity.test", timezone: "America/New_York" },
  { id: "biz-in-03", name: "Region Roofing", city: "Gary", state: "IN", lat: 41.5934, lng: -87.3464, phone: "+12195551063", email: "ops@regionroof.test", timezone: "America/Chicago" },

  // Nebraska
  { id: "biz-ne-01", name: "Husker Roofing", city: "Omaha", state: "NE", lat: 41.2565, lng: -95.9345, phone: "+14025551064", email: "ops@huskerroof.test", timezone: "America/Chicago" },
  { id: "biz-ne-02", name: "Capital City Roofers", city: "Lincoln", state: "NE", lat: 40.8136, lng: -96.7026, phone: "+14025551065", email: "ops@nebcapital.test", timezone: "America/Chicago" },

  // Iowa
  { id: "biz-ia-01", name: "Hawkeye Roofing", city: "Des Moines", state: "IA", lat: 41.5868, lng: -93.625, phone: "+15155551066", email: "ops@hawkeye.test", timezone: "America/Chicago" },
  { id: "biz-ia-02", name: "Quad City Roofers", city: "Davenport", state: "IA", lat: 41.5236, lng: -90.5776, phone: "+15635551067", email: "ops@quadcity.test", timezone: "America/Chicago" },
  { id: "biz-ia-03", name: "Cedar Crest Roof", city: "Cedar Rapids", state: "IA", lat: 41.9779, lng: -91.6656, phone: "+13195551068", email: "ops@cedarcrest.test", timezone: "America/Chicago" },

  // Arkansas
  { id: "biz-ar-01", name: "Natural State Roofing", city: "Little Rock", state: "AR", lat: 34.7465, lng: -92.2896, phone: "+15015551069", email: "ops@naturalstate.test", timezone: "America/Chicago" },
  { id: "biz-ar-02", name: "Razorback Roof", city: "Fayetteville", state: "AR", lat: 36.0822, lng: -94.1719, phone: "+14795551070", email: "ops@razorbackroof.test", timezone: "America/Chicago" },

  // South Carolina
  { id: "biz-sc-01", name: "Lowcountry Roofers", city: "Charleston", state: "SC", lat: 32.7765, lng: -79.9311, phone: "+18435551071", email: "ops@lowcountryroof.test", timezone: "America/New_York" },
  { id: "biz-sc-02", name: "Capital SC Roofing", city: "Columbia", state: "SC", lat: 34.0007, lng: -81.0348, phone: "+18035551072", email: "ops@capitalsc.test", timezone: "America/New_York" },
  { id: "biz-sc-03", name: "Upstate Roofers", city: "Greenville", state: "SC", lat: 34.8526, lng: -82.394, phone: "+18645551073", email: "ops@upstateroof.test", timezone: "America/New_York" },

  // Kentucky
  { id: "biz-ky-01", name: "Derby City Roofing", city: "Louisville", state: "KY", lat: 38.2527, lng: -85.7585, phone: "+15025551074", email: "ops@derbycity.test", timezone: "America/New_York" },
  { id: "biz-ky-02", name: "Bluegrass Roofers", city: "Lexington", state: "KY", lat: 38.0406, lng: -84.5037, phone: "+18595551075", email: "ops@bluegrass.test", timezone: "America/New_York" },
]
