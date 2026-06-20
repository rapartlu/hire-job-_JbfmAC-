/**
 * UK Train Times - hire-the-fleet job _JbfmAC-
 * Serves a live departure board between any two UK stations.
 * Data: RealTimeTrains (RTT) API via secure server-side proxy.
 *
 * Iteration 8: restore show-more + calling points + stop count + saved-journey
 *              expand (iterations 4/5 were lost when iteration 6 branched from
 *              the wrong base). Mobile Safari compatibility retained from v7.
 */

// Updated each deploy so the footer timestamp is always accurate.
const DEPLOY_VERSION = 'v10';
const DEPLOY_TIME = '5 Jun 2026, 18:30 UTC';

// Module-level token cache. Reused within a Worker instance's lifetime (seconds to minutes).
// Reduces get_access_token calls when multiple API requests arrive close together.
let _tokenCache = null;
let _tokenExpiry = 0;

// UK stations with CRS codes - Greater London first, then nationwide.
const STATIONS = [
  // Greater London - main terminals
  { name: "London Blackfriars", crs: "BFR" },
  { name: "London Bridge", crs: "LBG" },
  { name: "London Cannon Street", crs: "CST" },
  { name: "London Charing Cross", crs: "CHX" },
  { name: "London Euston", crs: "EUS" },
  { name: "London Fenchurch Street", crs: "FST" },
  { name: "London King's Cross", crs: "KGX" },
  { name: "London Liverpool Street", crs: "LST" },
  { name: "London Marylebone", crs: "MYB" },
  { name: "London Moorgate", crs: "MOG" },
  { name: "London Paddington", crs: "PAD" },
  { name: "London St Pancras International", crs: "STP" },
  { name: "London Victoria", crs: "VIC" },
  { name: "London Waterloo", crs: "WAT" },
  // Greater London - zones
  { name: "Balham", crs: "BAL" },
  { name: "Barnes", crs: "BNS" },
  { name: "Beckenham Junction", crs: "BKJ" },
  { name: "Blackheath", crs: "BKH" },
  { name: "Brockley", crs: "BCY" },
  { name: "Bromley North", crs: "BMN" },
  { name: "Bromley South", crs: "BMS" },
  { name: "Camden Road", crs: "CMD" },
  { name: "Canonbury", crs: "CNN" },
  { name: "Carshalton", crs: "CSH" },
  { name: "Catford", crs: "CTF" },
  { name: "Catford Bridge", crs: "CFB" },
  { name: "Charlton", crs: "CTN" },
  { name: "Clapham Junction", crs: "CLJ" },
  { name: "Crystal Palace", crs: "CYP" },
  { name: "Dalston Junction", crs: "DLJ" },
  { name: "Dalston Kingsland", crs: "DLK" },
  { name: "Denmark Hill", crs: "DMK" },
  { name: "Deptford", crs: "DEP" },
  { name: "Earlsfield", crs: "EAR" },
  { name: "East Croydon", crs: "ECR" },
  { name: "Eltham", crs: "ELW" },
  { name: "Finchley Road & Frognal", crs: "FNY" },
  { name: "Forest Hill", crs: "FOH" },
  { name: "Gipsy Hill", crs: "GPH" },
  { name: "Gospel Oak", crs: "GPO" },
  { name: "Greenwich", crs: "GRW" },
  { name: "Hackney Central", crs: "HKC" },
  { name: "Hackney Wick", crs: "HKW" },
  { name: "Hampstead Heath", crs: "HHE" },
  { name: "Harrow & Wealdstone", crs: "HRW" },
  { name: "Herne Hill", crs: "HNH" },
  { name: "Highbury & Islington", crs: "HHY" },
  { name: "Honor Oak Park", crs: "HPA" },
  { name: "Kensal Green", crs: "KNL" },
  { name: "Kensington Olympia", crs: "KEN" },
  { name: "Kentish Town", crs: "KTH" },
  { name: "Kew Gardens", crs: "KWG" },
  { name: "Kingston", crs: "KNG" },
  { name: "Lewisham", crs: "LEW" },
  { name: "London Fields", crs: "LOF" },
  { name: "Loughborough Junction", crs: "LGJ" },
  { name: "Mitcham Junction", crs: "MIJ" },
  { name: "Mortlake", crs: "MTL" },
  { name: "New Cross", crs: "NXG" },
  { name: "New Cross Gate", crs: "NXG" },
  { name: "Norbury", crs: "NRB" },
  { name: "Norwood Junction", crs: "NWD" },
  { name: "Orpington", crs: "ORP" },
  { name: "Peckham Rye", crs: "PMR" },
  { name: "Putney", crs: "PUT" },
  { name: "Richmond", crs: "RMD" },
  { name: "Shepherd's Bush", crs: "SBU" },
  { name: "South Bermondsey", crs: "SBM" },
  { name: "Streatham", crs: "STE" },
  { name: "Streatham Common", crs: "SRC" },
  { name: "Streatham Hill", crs: "SRH" },
  { name: "Stratford", crs: "SRA" },
  { name: "Sutton", crs: "SUO" },
  { name: "Sydenham", crs: "SYD" },
  { name: "Tooting", crs: "TOO" },
  { name: "Tulse Hill", crs: "TUH" },
  { name: "Twickenham", crs: "TWI" },
  { name: "Wandsworth Common", crs: "WSW" },
  { name: "Wandsworth Road", crs: "WWR" },
  { name: "Wandsworth Town", crs: "WNT" },
  { name: "Watford Junction", crs: "WFJ" },
  { name: "Wembley Central", crs: "WMB" },
  { name: "West Croydon", crs: "WCY" },
  { name: "West Dulwich", crs: "WDL" },
  { name: "West Norwood", crs: "WNW" },
  { name: "Wimbledon", crs: "WIM" },
  { name: "Wimbledon Chase", crs: "WBO" },
  // Southeast England
  { name: "Ashford International", crs: "AFK" },
  { name: "Brighton", crs: "BTN" },
  { name: "Canterbury East", crs: "CAX" },
  { name: "Canterbury West", crs: "CBW" },
  { name: "Chichester", crs: "CCH" },
  { name: "Crawley", crs: "CRW" },
  { name: "Dover Priory", crs: "DVP" },
  { name: "Eastbourne", crs: "EBN" },
  { name: "Epsom", crs: "EPS" },
  { name: "Folkestone Central", crs: "FKC" },
  { name: "Gatwick Airport", crs: "GTW" },
  { name: "Guildford", crs: "GLD" },
  { name: "Hastings", crs: "HGS" },
  { name: "Horsham", crs: "HRH" },
  { name: "Lewes", crs: "LWS" },
  { name: "Maidstone East", crs: "MAE" },
  { name: "Maidstone West", crs: "MAW" },
  { name: "Margate", crs: "MAR" },
  { name: "Ramsgate", crs: "RAM" },
  { name: "Reading", crs: "RDG" },
  { name: "Reigate", crs: "REI" },
  { name: "Rochester", crs: "RTR" },
  { name: "Sevenoaks", crs: "SEV" },
  { name: "Tonbridge", crs: "TON" },
  { name: "Tunbridge Wells", crs: "TBW" },
  { name: "Woking", crs: "WOK" },
  { name: "Worthing", crs: "WRH" },
  // South & Southwest
  { name: "Basingstoke", crs: "BSK" },
  { name: "Bath Spa", crs: "BTH" },
  { name: "Bournemouth", crs: "BMH" },
  { name: "Bristol Parkway", crs: "BPW" },
  { name: "Bristol Temple Meads", crs: "BRI" },
  { name: "Cheltenham Spa", crs: "CNM" },
  { name: "Exeter Central", crs: "EXC" },
  { name: "Exeter St David's", crs: "EXD" },
  { name: "Fareham", crs: "FRM" },
  { name: "Gloucester", crs: "GCR" },
  { name: "Penzance", crs: "PNZ" },
  { name: "Plymouth", crs: "PLY" },
  { name: "Portsmouth & Southsea", crs: "PMS" },
  { name: "Portsmouth Harbour", crs: "PMH" },
  { name: "Salisbury", crs: "SAL" },
  { name: "Southampton Airport Parkway", crs: "SOA" },
  { name: "Southampton Central", crs: "SOU" },
  { name: "Swindon", crs: "SWI" },
  { name: "Taunton", crs: "TAU" },
  { name: "Truro", crs: "TRU" },
  { name: "Winchester", crs: "WIN" },
  // East of England
  { name: "Cambridge", crs: "CBG" },
  { name: "Cambridge North", crs: "CMB" },
  { name: "Chelmsford", crs: "CHM" },
  { name: "Colchester", crs: "COL" },
  { name: "Ely", crs: "ELY" },
  { name: "Ipswich", crs: "IPS" },
  { name: "Luton Airport Parkway", crs: "LTN" },
  { name: "Norwich", crs: "NRW" },
  { name: "Peterborough", crs: "PBR" },
  { name: "Southend Central", crs: "SOC" },
  { name: "Southend Victoria", crs: "SOV" },
  { name: "Stansted Airport", crs: "SSD" },
  { name: "Stevenage", crs: "SVG" },
  // Midlands
  { name: "Birmingham International", crs: "BHI" },
  { name: "Birmingham Moor Street", crs: "BMO" },
  { name: "Birmingham New Street", crs: "BHM" },
  { name: "Birmingham Snow Hill", crs: "BSW" },
  { name: "Coventry", crs: "COV" },
  { name: "Derby", crs: "DBY" },
  { name: "Hereford", crs: "HFD" },
  { name: "Leicester", crs: "LEI" },
  { name: "Milton Keynes Central", crs: "MKC" },
  { name: "Northampton", crs: "NMP" },
  { name: "Nottingham", crs: "NOT" },
  { name: "Oxford", crs: "OXF" },
  { name: "Shrewsbury", crs: "SHR" },
  { name: "Stoke-on-Trent", crs: "SOT" },
  { name: "Wolverhampton", crs: "WVH" },
  { name: "Worcester Foregate Street", crs: "WOF" },
  { name: "Worcester Shrub Hill", crs: "WOS" },
  // North of England
  { name: "Blackpool North", crs: "BPN" },
  { name: "Bolton", crs: "BON" },
  { name: "Bradford Forster Square", crs: "BDQ" },
  { name: "Bradford Interchange", crs: "BDI" },
  { name: "Carlisle", crs: "CAR" },
  { name: "Chester", crs: "CTR" },
  { name: "Crewe", crs: "CRE" },
  { name: "Doncaster", crs: "DON" },
  { name: "Durham", crs: "DAM" },
  { name: "Halifax", crs: "HFX" },
  { name: "Harrogate", crs: "HGT" },
  { name: "Huddersfield", crs: "HUD" },
  { name: "Hull", crs: "HUL" },
  { name: "Leeds", crs: "LDS" },
  { name: "Liverpool Central", crs: "LVC" },
  { name: "Liverpool Lime Street", crs: "LIV" },
  { name: "Manchester Airport", crs: "MIA" },
  { name: "Manchester Piccadilly", crs: "MAN" },
  { name: "Manchester Victoria", crs: "MCV" },
  { name: "Middlesbrough", crs: "MBR" },
  { name: "Newcastle", crs: "NCL" },
  { name: "Preston", crs: "PRE" },
  { name: "Scarborough", crs: "SCA" },
  { name: "Sheffield", crs: "SHF" },
  { name: "Skipton", crs: "SKI" },
  { name: "Sunderland", crs: "SUN" },
  { name: "Wakefield Westgate", crs: "WKF" },
  { name: "Wigan North Western", crs: "WGN" },
  { name: "York", crs: "YRK" },
  // Wales
  { name: "Bangor (Gwynedd)", crs: "BNG" },
  { name: "Cardiff Central", crs: "CDF" },
  { name: "Cardiff Queen Street", crs: "CQU" },
  { name: "Newport (South Wales)", crs: "NWP" },
  { name: "Swansea", crs: "SWA" },
  { name: "Wrexham General", crs: "WRX" },
  // Scotland
  { name: "Aberdeen", crs: "ABD" },
  { name: "Dundee", crs: "DEE" },
  { name: "Edinburgh", crs: "EDB" },
  { name: "Glasgow Central", crs: "GLC" },
  { name: "Glasgow Queen Street", crs: "GLQ" },
  { name: "Inverness", crs: "INV" },
  { name: "Perth", crs: "PTH" },
  { name: "Stirling", crs: "STG" },
];

// Format HHMM string to HH:MM for display
function fmtTime(t) {
  if (!t || t.length < 4) return t || "--";
  return `${t.slice(0, 2)}:${t.slice(2)}`;
}

// Extract HH:MM from an ISO datetime string, e.g. "2026-05-18T03:35:00+01:00"
function fmtIsoTime(iso) {
  if (!iso) return null;
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
}

// Calculate journey duration in minutes from two HH:MM strings.
// Cap at 480 min (8h): larger values indicate a cross-service data mismatch.
function durationMins(dep, arr) {
  if (!dep || !arr) return null;
  const [dh, dm] = dep.split(":").map(Number);
  const [ah, am] = arr.split(":").map(Number);
  let mins = ah * 60 + am - (dh * 60 + dm);
  if (mins < 0) mins += 24 * 60;
  if (mins > 480) return null;
  return mins;
}

// Format duration as "45 min" or "1h 15m"
function fmtDuration(mins) {
  if (mins == null) return null;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// Return true only when actual is strictly later than scheduled (a real delay).
// Returns false for early arrivals, on-time, or missing values.
function isDelayed(sched, actual) {
  if (!sched || !actual || sched === actual) return false;
  const s = parseInt(sched.replace(':', ''), 10);
  const a = parseInt(actual.replace(':', ''), 10);
  return a > s;
}

// Return the next HHMM string (HH:MM dep time + 1 minute) for show-more pagination.
function nextHHMM(hhmmStr) {
  if (!hhmmStr) return null;
  const [h, m] = hhmmStr.split(":").map(Number);
  let total = h * 60 + m + 1;
  if (total >= 1440) total -= 1440;
  return String(Math.floor(total / 60)).padStart(2, "0") + String(total % 60).padStart(2, "0");
}

// Build RTT NG API URL. timeFrom is optional HHMM string.
function rttUrl(from, to, time, type) {
  const params = new URLSearchParams();
  params.set('code', `gb-nr:${from.toUpperCase()}`);
  if (to) params.set('filterTo', `gb-nr:${to.toUpperCase()}`);
  if (time) params.set('timeFrom', time);
  if (type) params.set('type', type);
  return `https://data.rtt.io/rtt/location?${params}`;
}

// Exchange long-lived portal JWT for a short-lived access token (~20 min TTL).
// Caches the token in module state to reduce auth round-trips on burst requests.
async function getRttAccessToken(env) {
  const now = Date.now();
  if (_tokenCache && _tokenExpiry > now + 60000) {
    return _tokenCache;
  }
  const tokenResp = await fetch("https://data.rtt.io/api/get_access_token", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RTT_PORTAL_TOKEN}`,
      Accept: "application/json",
    },
  });
  if (!tokenResp.ok) {
    const body = await tokenResp.text();
    throw new Error(`RTT auth failed (${tokenResp.status}): ${body}`);
  }
  const { token } = await tokenResp.json();
  // Cache for 18 minutes (token TTL is ~20 min, expire 2 min early to be safe)
  _tokenCache = token;
  _tokenExpiry = now + 18 * 60 * 1000;
  return token;
}

// Map a single RTT NG service object to our simplified shape
function mapService(s) {
  const dep = s.temporalData?.departure || {};
  const locMeta = s.locationMetadata || {};
  const meta = s.scheduleMetadata || {};
  const destArr = s.destination || [];

  const scheduledDep = fmtIsoTime(dep.scheduleAdvertised);
  const realtimeDep = fmtIsoTime(dep.realtimeForecast) || scheduledDep;

  // Arrival times come from the first destination's temporalData (when filterTo is used)
  const firstDest = destArr[0] || {};
  const scheduledArr = fmtIsoTime(firstDest.temporalData?.scheduleAdvertised);
  const realtimeArr = fmtIsoTime(firstDest.temporalData?.realtimeForecast) || scheduledArr;

  // Final destination = last stop of the train service
  const lastDest = destArr[destArr.length - 1] || firstDest;
  const finalDestination = lastDest.location?.description || null;

  // All intermediate stops (shown when no filterTo is given)
  const destinations = destArr.map((d) => ({
    name: d.location?.description || "",
    time: fmtIsoTime(d.temporalData?.scheduleAdvertised),
  }));

  // Journey duration (only meaningful when filterTo is set and arr is available)
  const durMins = durationMins(scheduledDep, scheduledArr);

  return {
    uid: meta.uniqueIdentity || "",
    operator: meta.operator?.name || meta.operator?.code || "",
    scheduledDep,
    realtimeDep,
    scheduledArr,
    realtimeArr,
    platform: locMeta.platform?.actual || locMeta.platform?.planned || "--",
    cancelled: dep.isCancelled || false,
    destinations,
    finalDestination,
    durationMins: durMins,
    duration: fmtDuration(durMins),
  };
}

// Augment a departure-board service with arrival timing from the arrivals board.
function mapServiceWithArr(depSvc, arrSvc) {
  const base = mapService(depSvc);
  if (!arrSvc) return base;
  const arrTemporal = arrSvc.temporalData?.arrival || {};
  const scheduledArr = fmtIsoTime(arrTemporal.scheduleAdvertised)
    || fmtIsoTime(arrTemporal.realtimeForecast)
    || fmtIsoTime(arrTemporal.realtimeActual);
  const realtimeArr = fmtIsoTime(arrTemporal.realtimeForecast)
    || fmtIsoTime(arrTemporal.realtimeActual)
    || scheduledArr;
  if (scheduledArr) {
    base.scheduledArr = scheduledArr;
    base.realtimeArr = realtimeArr;
    const durMins = durationMins(base.scheduledDep, scheduledArr);
    base.durationMins = durMins;
    base.duration = fmtDuration(durMins);
  }
  return base;
}

// Proxy RTT NG API - keeps the portal token server-side
async function handleApi(request, env) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const time = url.searchParams.get("time"); // HHMM (4 digits, optional)

  if (!from) {
    return new Response(JSON.stringify({ error: "Missing 'from' parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!env.RTT_PORTAL_TOKEN) {
    return new Response(
      JSON.stringify({ error: "RTT credentials not configured - contact the fleet" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const accessToken = await getRttAccessToken(env);
    const rttHeaders = { Authorization: `Bearer ${accessToken}`, Accept: "application/json" };

    if (to) {
      // Two-pronged approach to catch all services:
      //
      // Prong 1 (through-services): departures from 'from' + arrivals at 'to', cross-referenced
      //   by UID. RTT filterTo misses trains whose terminus is beyond 'to' (e.g. a London Bridge
      //   → Tunbridge Wells service that stops at Orpington en route). The arrivals board at 'to'
      //   includes those through-trains so the UID cross-reference catches them.
      //
      // Prong 2 (terminus services / long routes): departures from 'from' with filterTo=to.
      //   Prong 1 fails for long-distance routes (e.g. LBG→Brighton) because the arrivals board
      //   at Brighton at time T shows trains ALREADY arriving (i.e. trains that LEFT London 60+
      //   minutes ago), which never overlap with the departures board at time T.
      //   filterTo directly returns trains from 'from' calling at 'to' with correct arrival times.
      //
      // Result: merge both, deduplicate by UID, preferring Prong 1 for accurate through-service
      // arrival times from the arrivals board.
      const [depsResp, arrsResp, directResp] = await Promise.all([
        fetch(rttUrl(from, null, time), { headers: rttHeaders }),
        fetch(rttUrl(to, null, time, 'arrivals'), { headers: rttHeaders }),
        fetch(rttUrl(from, to, time), { headers: rttHeaders }),
      ]);

      if (!depsResp.ok) {
        const body = await depsResp.text();
        return new Response(
          JSON.stringify({ error: `RTT API error ${depsResp.status}`, detail: body }),
          { status: depsResp.status, headers: { "Content-Type": "application/json" } }
        );
      }

      const depsData = await depsResp.json();
      const arrsData = arrsResp.ok ? await arrsResp.json() : { services: [] };
      const directData = directResp.ok ? await directResp.json() : { services: [] };
      const depServices = depsData.services || [];
      const arrServices = arrsData.services || [];
      const directServices = directData.services || [];

      // Build arrivals lookup: uid → arrival-board service
      const arrByUid = {};
      for (const s of arrServices) {
        const uid = s.scheduleMetadata?.uniqueIdentity;
        if (uid) arrByUid[uid] = s;
      }

      const seenUids = new Set();
      const merged = [];

      // Prong 1: through-services caught by dual-board cross-reference
      for (const s of depServices) {
        const uid = s.scheduleMetadata?.uniqueIdentity;
        if (!uid || seenUids.has(uid)) continue;
        if (arrByUid[uid]) {
          const mapped = mapServiceWithArr(s, arrByUid[uid]);
          // Filter direction mismatches: a service running THROUGH 'to' en route towards 'from'
          // has the same UID on both boards but in opposite directions. When arr < dep the
          // duration wraps negative, durationMins returns null (>480 cap). Skip those.
          if (mapped.scheduledArr && mapped.durationMins === null) continue;
          seenUids.add(uid);
          merged.push(mapped);
        }
      }

      // Prong 2: terminus/long-distance services from filterTo not caught above
      for (const s of directServices) {
        const uid = s.scheduleMetadata?.uniqueIdentity;
        if (!uid || seenUids.has(uid)) continue;
        const svcMapped = mapService(s);
        // Skip terminus arrivals (no departure time = train ends here)
        if (!svcMapped.scheduledDep) continue;
        seenUids.add(uid);
        merged.push(svcMapped);
      }

      // Sort by scheduled departure time ascending
      merged.sort((a, b) => {
        if (!a.scheduledDep) return 1;
        if (!b.scheduledDep) return -1;
        return a.scheduledDep.localeCompare(b.scheduledDep);
      });

      const services = merged.slice(0, 10);
      const lastDep = services.length > 0 ? services[services.length - 1].scheduledDep : null;

      return new Response(
        JSON.stringify({
          from: depsData.query?.location?.description || from,
          fromCrs: from.toUpperCase(),
          services,
          nextTimeFrom: nextHHMM(lastDep),
          generatedAt: new Date().toISOString(),
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // No destination - return all departures from 'from'
    const resp = await fetch(rttUrl(from, null, time), { headers: rttHeaders });
    if (!resp.ok) {
      const body = await resp.text();
      return new Response(
        JSON.stringify({ error: `RTT API error ${resp.status}`, detail: body }),
        { status: resp.status, headers: { "Content-Type": "application/json" } }
      );
    }
    const data = await resp.json();
    const services = (data.services || []).slice(0, 10).map(mapService);
    const lastDep = services.length > 0 ? services[services.length - 1].scheduledDep : null;

    return new Response(
      JSON.stringify({
        from: data.query?.location?.description || from,
        fromCrs: from.toUpperCase(),
        services,
        nextTimeFrom: nextHHMM(lastDep),
        generatedAt: new Date().toISOString(),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch from RTT", detail: err.message }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Last train of the day
async function handleLastTrain(request, env) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (!from || !to) {
    return new Response(JSON.stringify({ error: "Missing 'from' or 'to' parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!env.RTT_PORTAL_TOKEN) {
    return new Response(
      JSON.stringify({ error: "RTT credentials not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const accessToken = await getRttAccessToken(env);

    const trialTimes = ["2200", "2100", "2000", "1900"];
    let lastService = null;

    for (const t of trialTimes) {
      const apiUrl = rttUrl(from, to, t);
      const resp = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      });
      if (!resp.ok) break;
      const data = await resp.json();
      const svcs = data.services || [];
      if (svcs.length > 0) {
        lastService = mapService(svcs[svcs.length - 1]);
        break;
      }
    }

    return new Response(
      JSON.stringify({ lastService, generatedAt: new Date().toISOString() }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch last train", detail: err.message }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Fetch full calling points for a service by UID.
async function handleService(request, env) {
  const url = new URL(request.url);
  const uid = url.searchParams.get("uid");

  if (!uid) {
    return new Response(JSON.stringify({ error: "Missing uid" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!env.RTT_PORTAL_TOKEN) {
    return new Response(
      JSON.stringify({ error: "RTT credentials not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const accessToken = await getRttAccessToken(env);
    // RTT NG service endpoint: GET /rtt/service?uniqueIdentity={uid}
    // uid format is "gb-nr:{serviceUid}:{YYYY-MM-DD}" - passes as the uniqueIdentity param.
    const resp = await fetch(
      `https://data.rtt.io/rtt/service?uniqueIdentity=${encodeURIComponent(uid)}`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }
    );

    if (!resp.ok) {
      const body = await resp.text();
      return new Response(
        JSON.stringify({ error: `RTT service error ${resp.status}`, detail: body }),
        { status: resp.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await resp.json();

    // RTT NG service endpoint returns { service: { locations: [...], ... } }
    // Each location has temporalData (arrival/departure), locationMetadata (platform),
    // and location (description, shortCodes[0]=CRS, longCodes[0]=TIPLOC).
    const rawLocs = data.service?.locations || data.locations || [];
    const fmtAny = v => {
      if (!v) return null;
      if (v.includes('T')) return fmtIsoTime(v);
      return v; // already HH:MM
    };
    const locations = rawLocs
      .filter(loc => loc.temporalData?.displayAs !== 'PASS')
      .map(loc => {
        const name = loc.location?.description || "";
        const crs = loc.location?.shortCodes?.[0] || loc.location?.crs || "";
        const platform = loc.locationMetadata?.platform?.actual
          || loc.locationMetadata?.platform?.planned
          || "--";
        const callType = loc.temporalData?.scheduledCallType || "";
        return {
          name,
          crs,
          scheduledArr: fmtAny(loc.temporalData?.arrival?.scheduleAdvertised),
          realtimeArr: fmtAny(loc.temporalData?.arrival?.realtimeForecast
            || loc.temporalData?.arrival?.realtimeActual),
          scheduledDep: fmtAny(loc.temporalData?.departure?.scheduleAdvertised),
          realtimeDep: fmtAny(loc.temporalData?.departure?.realtimeForecast
            || loc.temporalData?.departure?.realtimeActual),
          platform,
          isPass: false,
          isOrigin: callType === 'ADVERTISED_PICK_UP',
          isDestination: callType === 'ADVERTISED_SET_DOWN',
        };
      })
      .filter(loc => loc.name);

    return new Response(
      JSON.stringify({ uid, locations, generatedAt: new Date().toISOString() }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch service details", detail: err.message }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Serve station list as JSON for client-side autocomplete seed
function handleStations() {
  return new Response(JSON.stringify(STATIONS), {
    headers: { "Content-Type": "application/json" },
  });
}

// HTML page - self-contained with embedded JS and CSS
function handleHtml() {
  const stationsJson = JSON.stringify(STATIONS);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>UK Train Times</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0f1117;
      --surface: #1a1d27;
      --surface2: #242736;
      --border: #2e3248;
      --accent: #4f6ef7;
      --accent-dark: #3a57d9;
      --text: #e8eaf0;
      --muted: #8890a4;
      --green: #34d399;
      --amber: #f59e0b;
      --red: #ef4444;
      --purple: #a78bfa;
      --radius: 8px;
      --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      color-scheme: dark;
    }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      min-height: 100vh;
      min-height: -webkit-fill-available;
      display: flex;
      flex-direction: column;
    }

    header {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 16px 24px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    header svg { flex-shrink: 0; }

    header h1 {
      font-size: 1.25rem;
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    header span {
      color: var(--muted);
      font-size: 0.875rem;
      margin-left: auto;
    }

    main {
      flex: 1;
      max-width: 900px;
      width: 100%;
      margin: 0 auto;
      padding: 32px 16px 64px;
    }

    .search-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
      margin-bottom: 24px;
    }

    .search-row {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: 12px;
      align-items: end;
      margin-bottom: 16px;
    }

    @media (max-width: 600px) {
      .search-row { grid-template-columns: 1fr; }
      .btn-swap { justify-self: center; }
    }

    .btn-swap {
      background: transparent;
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--muted);
      cursor: pointer;
      font-size: 1.1rem;
      line-height: 1;
      padding: 10px 10px;
      transition: background 0.15s, color 0.15s;
      align-self: flex-end;
      margin-bottom: 1px;
    }

    .btn-swap:hover {
      background: var(--surface2);
      color: var(--text);
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      position: relative;
    }

    label {
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
    }

    input[type="text"], input[type="time"], input[type="date"] {
      -webkit-appearance: none;
      appearance: none;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font-family: var(--font);
      /* 16px minimum prevents iOS Safari auto-zoom on focus */
      font-size: 16px;
      padding: 10px 12px;
      width: 100%;
      outline: none;
      transition: border-color 0.15s;
    }

    /* iOS Safari: force our colours onto date/time edit fields */
    ::-webkit-datetime-edit { color: var(--text); }
    ::-webkit-datetime-edit-fields-wrapper { color: var(--text); }
    ::-webkit-datetime-edit-text { color: var(--muted); }
    ::-webkit-calendar-picker-indicator { filter: invert(0.8); }
    ::-webkit-date-and-time-value { color: var(--text); }

    input:focus {
      border-color: var(--accent);
    }

    .autocomplete-list {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 6px;
      z-index: 100;
      max-height: 240px;
      overflow-y: auto;
      margin-top: 2px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    }

    .autocomplete-list li {
      list-style: none;
      padding: 9px 12px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.9rem;
      gap: 8px;
    }

    .autocomplete-list li:hover,
    .autocomplete-list li.active {
      background: var(--surface);
    }

    .autocomplete-list li .crs-badge {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--muted);
      font-family: monospace;
      background: var(--bg);
      padding: 2px 6px;
      border-radius: 4px;
      flex-shrink: 0;
    }

    .time-row {
      display: grid;
      grid-template-columns: 1fr 1fr auto auto;
      gap: 12px;
      align-items: flex-end;
    }

    @media (max-width: 600px) {
      .time-row { grid-template-columns: 1fr 1fr; }
      .time-row .btn-now,
      .time-row .btn-search { grid-column: span 1; }
    }

    button {
      background: var(--accent);
      border: none;
      border-radius: 6px;
      color: #fff;
      cursor: pointer;
      font-family: var(--font);
      font-size: 0.9375rem;
      font-weight: 500;
      padding: 10px 24px;
      white-space: nowrap;
      transition: background 0.15s;
    }

    button:hover { background: var(--accent-dark); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-now {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--muted);
      padding: 10px 12px;
      font-size: 0.8125rem;
    }

    .btn-now:hover {
      background: var(--surface2);
      color: var(--text);
    }

    /* Results */
    .results-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 12px;
      flex-wrap: wrap;
      gap: 8px;
    }

    .results-header h2 {
      font-size: 1rem;
      font-weight: 600;
    }

    .results-header .meta {
      font-size: 0.8125rem;
      color: var(--muted);
    }

    .table-wrap {
      overflow-x: auto;
      border-radius: var(--radius);
      border: 1px solid var(--border);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }

    th {
      background: var(--surface);
      color: var(--muted);
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 10px 14px;
      text-align: left;
      white-space: nowrap;
    }

    td {
      padding: 12px 14px;
      border-top: 1px solid var(--border);
      vertical-align: middle;
    }

    tr.service-row { cursor: pointer; }
    tr.service-row:hover td { background: rgba(79,110,247,0.06); }
    tr.service-row.expanded td { background: rgba(79,110,247,0.08); }

    tr:nth-child(even) td { background: rgba(255,255,255,0.015); }
    tr.service-row:nth-child(even):hover td,
    tr.service-row:nth-child(even).expanded td { background: rgba(79,110,247,0.08); }

    .dep-time {
      font-variant-numeric: tabular-nums;
      font-size: 1.125rem;
      font-weight: 600;
      line-height: 1;
    }

    .arr-time {
      font-variant-numeric: tabular-nums;
      font-size: 1.125rem;
      font-weight: 600;
      line-height: 1;
    }

    .time-actual {
      display: block;
      font-size: 0.75rem;
      color: var(--muted);
      margin-top: 2px;
    }

    .time-actual.late { color: var(--amber); }
    .time-actual.cancelled { color: var(--red); }

    .duration-badge {
      display: inline-block;
      font-size: 0.7rem;
      color: var(--muted);
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 1px 5px;
      margin-top: 4px;
      font-variant-numeric: tabular-nums;
    }

    .final-dest {
      font-size: 0.8125rem;
      color: var(--muted);
      display: block;
      margin-top: 4px;
      padding-top: 3px;
      border-top: 1px solid var(--border);
    }

    .final-dest strong {
      color: var(--text);
      font-weight: 500;
    }

    .expand-hint {
      font-size: 0.7rem;
      color: var(--accent);
      opacity: 0.7;
      display: block;
      margin-top: 3px;
    }

    .status-on-time { color: var(--green); font-size: 0.8rem; }
    .status-late { color: var(--amber); font-size: 0.8rem; }
    .status-cancelled { color: var(--red); font-size: 0.8rem; }

    .operator { font-size: 0.8125rem; color: var(--muted); }

    .platform {
      font-size: 0.875rem;
      font-weight: 500;
      text-align: center;
    }

    .dest-list {
      font-size: 0.875rem;
      color: var(--text);
    }

    .empty-state, .error-state, .loading-state {
      text-align: center;
      padding: 48px 24px;
      color: var(--muted);
    }

    .error-state { color: var(--red); }

    .spinner {
      display: inline-block;
      width: 24px;
      height: 24px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      margin-bottom: 12px;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* Calling points expansion row */
    tr.calling-points-row td {
      padding: 0;
      border-top: none;
    }

    .calling-points-inner {
      padding: 12px 14px 14px 28px;
      background: rgba(79,110,247,0.04);
      border-top: 1px dashed var(--border);
    }

    .calling-points-inner .cp-title {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      margin-bottom: 8px;
    }

    .cp-list {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .cp-stop {
      display: grid;
      grid-template-columns: 70px 1fr 60px;
      align-items: center;
      padding: 4px 0;
      font-size: 0.8125rem;
      border-bottom: 1px solid rgba(46,50,72,0.5);
      gap: 8px;
    }

    .cp-stop:last-child { border-bottom: none; }

    .cp-time {
      font-variant-numeric: tabular-nums;
      font-size: 0.8rem;
      color: var(--muted);
      white-space: nowrap;
    }

    .cp-time .cp-late { color: var(--amber); font-size: 0.7rem; display: block; }

    .cp-name { font-size: 0.8125rem; }
    .cp-name.is-origin { font-weight: 600; color: var(--accent); }
    .cp-name.is-destination { font-weight: 600; color: var(--green); }

    .cp-plat {
      font-size: 0.75rem;
      color: var(--muted);
      text-align: right;
    }

    .cp-loading {
      font-size: 0.8rem;
      color: var(--muted);
      padding: 8px 0;
    }

    .cp-error {
      font-size: 0.8rem;
      color: var(--red);
      padding: 8px 0;
    }

    /* Stop count badge - appears in dep cell once calling points load */
    .stop-count-badge {
      display: inline-block;
      font-size: 0.7rem;
      color: var(--accent);
      background: rgba(79,110,247,0.1);
      border: 1px solid rgba(79,110,247,0.25);
      border-radius: 4px;
      padding: 1px 5px;
      margin-top: 3px;
      font-variant-numeric: tabular-nums;
    }

    /* Clickable chip in saved panel */
    .saved-chip-clickable { cursor: pointer; transition: opacity 0.15s; }
    .saved-chip-clickable:hover { opacity: 0.8; }
    .saved-chip-clickable.chip-expanded { outline: 1px solid var(--accent); }

    /* Inline calling points expand below a saved journey row */
    .saved-chip-expand {
      width: 100%;
      padding: 0 0 4px;
    }

    /* Show-more in saved panel */
    .btn-saved-show-more {
      background: transparent;
      border: 1px dashed var(--border);
      border-radius: 6px;
      color: var(--muted);
      font-size: 0.75rem;
      padding: 4px 10px;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .btn-saved-show-more:hover { background: var(--surface2); color: var(--text); }

    /* Show-more button */
    .btn-show-more {
      display: block;
      width: 100%;
      background: transparent;
      border: 1px solid var(--border);
      border-top: none;
      border-radius: 0 0 var(--radius) var(--radius);
      color: var(--muted);
      font-size: 0.8125rem;
      padding: 10px;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }

    .btn-show-more:hover {
      background: var(--surface2);
      color: var(--text);
    }

    /* Last train banner */
    .last-train-banner {
      margin-top: 12px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .last-train-banner .lbl {
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      white-space: nowrap;
    }

    .last-train-time {
      font-size: 1.25rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: var(--purple);
    }

    .last-train-detail {
      font-size: 0.8125rem;
      color: var(--muted);
    }

    footer {
      text-align: center;
      padding: 20px;
      font-size: 0.75rem;
      color: var(--muted);
      border-top: 1px solid var(--border);
    }

    footer a { color: var(--muted); text-decoration: none; }
    footer a:hover { color: var(--text); }

    /* ── Saved journeys ──────────────────────────────────────────────────────── */
    .saved-panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px 24px;
      margin-bottom: 24px;
    }

    .saved-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .saved-panel-header h2 {
      font-size: 0.875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
    }

    .saved-panel-header .refresh-note {
      font-size: 0.75rem;
      color: var(--muted);
    }

    .saved-journey-row {
      display: flex;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 8px 12px;
      padding: 12px 0;
      border-top: 1px solid var(--border);
    }

    .saved-journey-row:first-child { border-top: none; padding-top: 0; }

    .saved-route-label {
      font-size: 0.9375rem;
      font-weight: 600;
      min-width: 160px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    @media (max-width: 600px) {
      .saved-route-label {
        width: 100%;
        min-width: unset;
        white-space: normal;
      }
      .saved-times {
        width: 100%;
        flex: none;
        min-width: 0;
      }
      .saved-controls {
        width: 100%;
        justify-content: flex-start;
      }
    }

    .saved-times {
      flex: 1;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      min-width: 0;
      align-items: flex-start;
    }

    .saved-train-chip {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 5px 10px;
      font-size: 0.8125rem;
      font-variant-numeric: tabular-nums;
    }

    .saved-train-chip .chip-main {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .saved-train-chip .chip-dur {
      font-size: 0.7rem;
      color: var(--muted);
      display: block;
      margin-top: 2px;
    }

    .saved-train-chip .chip-final-dest {
      font-size: 0.7rem;
      color: var(--muted);
      display: block;
      margin-top: 1px;
      font-style: italic;
    }

    .saved-train-chip.on-time { border-color: #166534; background: #052e16; color: #86efac; }
    .saved-train-chip.late { border-color: #92400e; background: #1c1007; color: #fcd34d; }
    .saved-train-chip.cancelled { border-color: #991b1b; background: #1c0909; color: #fca5a5; text-decoration: line-through; }
    .saved-train-chip .plat { color: var(--muted); font-size: 0.75rem; }

    .saved-last-chip {
      background: rgba(167,139,250,0.1);
      border: 1px solid rgba(167,139,250,0.3);
      border-radius: 6px;
      padding: 5px 10px;
      font-size: 0.8125rem;
      font-variant-numeric: tabular-nums;
      color: var(--purple);
      white-space: nowrap;
    }

    .saved-last-chip .lbl {
      font-size: 0.7rem;
      opacity: 0.7;
      display: block;
    }

    .saved-controls {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
    }

    .btn-saved-search {
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
    }

    .btn-saved-search:hover { background: var(--accent-dark); }

    .btn-remove-journey {
      background: transparent;
      color: var(--muted);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 0.8125rem;
      cursor: pointer;
    }

    .btn-remove-journey:hover { color: var(--red); border-color: var(--red); }

    .saved-loading { color: var(--muted); font-size: 0.8125rem; padding: 4px 0; }

    .save-bar {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn-save-journey {
      background: transparent;
      color: var(--accent);
      border: 1px solid var(--accent);
      border-radius: 6px;
      padding: 7px 14px;
      font-size: 0.875rem;
      cursor: pointer;
      transition: background 0.15s;
    }

    .btn-save-journey:hover { background: rgba(79,110,247,0.12); }

    .save-bar .saved-note {
      font-size: 0.8125rem;
      color: var(--green);
    }
  </style>
</head>
<body>

<header>
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="3" width="16" height="15" rx="2" stroke="#4f6ef7" stroke-width="1.5"/>
    <path d="M4 13h16" stroke="#4f6ef7" stroke-width="1.5"/>
    <path d="M8 18l-2 3M16 18l2 3" stroke="#4f6ef7" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="8.5" cy="10" r="1" fill="#4f6ef7"/>
    <circle cx="15.5" cy="10" r="1" fill="#4f6ef7"/>
  </svg>
  <h1>UK Train Times</h1>
  <span id="clock">--:--</span>
</header>

<main>
  <div id="saved-panel" style="display:none">
    <div class="saved-panel">
      <div class="saved-panel-header">
        <h2>Saved journeys</h2>
        <span class="refresh-note" id="saved-refresh-note"></span>
      </div>
      <div id="saved-list"></div>
    </div>
  </div>

  <div class="search-card">
    <div class="search-row">
      <div class="field" id="from-field">
        <label for="from-input">From</label>
        <input
          type="text"
          id="from-input"
          placeholder="Station name or code"
          autocomplete="off"
          spellcheck="false"
        />
        <ul class="autocomplete-list" id="from-list" hidden></ul>
        <input type="hidden" id="from-crs" />
      </div>
      <button class="btn-swap" id="btn-swap" title="Swap stations">&#8644;</button>
      <div class="field" id="to-field">
        <label for="to-input">To</label>
        <input
          type="text"
          id="to-input"
          placeholder="Station name or code"
          autocomplete="off"
          spellcheck="false"
        />
        <ul class="autocomplete-list" id="to-list" hidden></ul>
        <input type="hidden" id="to-crs" />
      </div>
    </div>
    <div class="time-row">
      <div class="field">
        <label for="date-input">Date</label>
        <input type="date" id="date-input" />
      </div>
      <div class="field">
        <label for="time-input">Time</label>
        <input type="time" id="time-input" />
      </div>
      <button class="btn-now" id="btn-now" title="Reset to now">Now</button>
      <button id="btn-search" class="btn-search">Search</button>
    </div>
  </div>

  <div id="results"></div>
</main>

<footer>
  Built by Fleet &middot; <a href="https://hire.autonomous-fleet.workers.dev" target="_blank">Alpha access</a>
  &middot; ${DEPLOY_VERSION} &middot; Deployed ${DEPLOY_TIME}
</footer>

<script>
  const STATIONS = ${stationsJson};

  // ── Clock ──────────────────────────────────────────────────────────────────
  function updateClock() {
    const now = new Date();
    document.getElementById('clock').textContent =
      now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  updateClock();
  setInterval(updateClock, 10000);

  // ── Delay helper (browser scope) ────────────────────────────────────────────
  // Mirrors the server-side isDelayed. The saved-trip chips (renderChip) and the
  // calling-points expansion call isDelayed in the browser; without this
  // definition every saved-times render threw ReferenceError, so saved trips
  // showed nothing until the user ran a manual Search (which uses a different
  // renderer that does not call isDelayed). See #1809 iterations 9-11.
  function isDelayed(sched, actual) {
    if (!sched || !actual || sched === actual) return false;
    const s = parseInt(sched.replace(':', ''), 10);
    const a = parseInt(actual.replace(':', ''), 10);
    return a > s;
  }

  // ── Date/time defaults ────────────────────────────────────────────────────
  function setNow() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('date-input').value = \`\${yyyy}-\${mm}-\${dd}\`;
    document.getElementById('time-input').value = \`\${hh}:\${min}\`;
  }
  setNow();
  document.getElementById('btn-now').addEventListener('click', setNow);

  // ── Autocomplete ──────────────────────────────────────────────────────────
  function setupAutocomplete(inputId, listId, crsHiddenId) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    const crsHidden = document.getElementById(crsHiddenId);
    let activeIdx = -1;

    function match(q) {
      if (!q) return [];
      const ql = q.toLowerCase();
      return STATIONS.filter(s =>
        s.name.toLowerCase().includes(ql) ||
        s.crs.toLowerCase().startsWith(ql)
      ).slice(0, 10);
    }

    function render(items) {
      if (!items.length) { list.hidden = true; return; }
      list.innerHTML = '';
      activeIdx = -1;
      items.forEach((item, i) => {
        const li = document.createElement('li');
        li.dataset.crs = item.crs;
        li.dataset.name = item.name;
        li.innerHTML =
          \`<span>\${item.name}</span><span class="crs-badge">\${item.crs}</span>\`;
        // mousedown for desktop; touchstart for iOS Safari (fires before blur)
        li.addEventListener('mousedown', (e) => {
          e.preventDefault();
          select(item);
        });
        li.addEventListener('touchstart', (e) => {
          e.preventDefault();
          select(item);
        }, { passive: false });
        list.appendChild(li);
      });
      list.hidden = false;
    }

    function select(item) {
      input.value = item.name;
      crsHidden.value = item.crs;
      list.hidden = true;
      activeIdx = -1;
    }

    input.addEventListener('input', () => {
      crsHidden.value = '';
      render(match(input.value));
    });

    input.addEventListener('keydown', (e) => {
      const items = list.querySelectorAll('li');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIdx = Math.min(activeIdx + 1, items.length - 1);
        items.forEach((li, i) => li.classList.toggle('active', i === activeIdx));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIdx = Math.max(activeIdx - 1, 0);
        items.forEach((li, i) => li.classList.toggle('active', i === activeIdx));
      } else if (e.key === 'Enter' && activeIdx >= 0) {
        e.preventDefault();
        const active = items[activeIdx];
        if (active) select({ crs: active.dataset.crs, name: active.dataset.name });
      } else if (e.key === 'Escape') {
        list.hidden = true;
      }
    });

    input.addEventListener('blur', () => {
      setTimeout(() => { list.hidden = true; }, 150);
      const v = input.value.trim().toUpperCase();
      if (!crsHidden.value && v.length === 3) {
        const matched = STATIONS.find(s => s.crs === v);
        if (matched) select(matched);
        else crsHidden.value = v;
      }
    });
  }

  setupAutocomplete('from-input', 'from-list', 'from-crs');
  setupAutocomplete('to-input', 'to-list', 'to-crs');

  // ── Calling points ────────────────────────────────────────────────────────
  // Track which rows are expanded so we can toggle them
  const expandedUids = new Set();

  async function toggleCallingPoints(uid, fromCrs, toCrs, tbodyEl, trEl) {
    // Find or remove existing expansion row
    const existingExpRow = tbodyEl.querySelector(\`tr[data-cp-uid="\${uid}"]\`);
    if (existingExpRow) {
      existingExpRow.remove();
      trEl.classList.remove('expanded');
      expandedUids.delete(uid);
      return;
    }

    trEl.classList.add('expanded');
    expandedUids.add(uid);

    // Insert a placeholder row immediately after this row
    const colCount = trEl.cells.length;
    const expRow = document.createElement('tr');
    expRow.className = 'calling-points-row';
    expRow.dataset.cpUid = uid;
    const td = document.createElement('td');
    td.colSpan = colCount;
    td.innerHTML = \`<div class="calling-points-inner"><div class="cp-loading">Loading calling points...</div></div>\`;
    expRow.appendChild(td);
    trEl.insertAdjacentElement('afterend', expRow);

    try {
      const resp = await fetch(\`/api/service?uid=\${encodeURIComponent(uid)}\`);
      const data = await resp.json();

      if (!expandedUids.has(uid)) return; // collapsed while loading

      if (data.error || !data.locations || !data.locations.length) {
        td.innerHTML = \`<div class="calling-points-inner"><div class="cp-error">Calling points unavailable: \${data.error || 'no stops returned'}</div></div>\`;
        return;
      }

      const stops = data.locations.filter(loc => !loc.isPass);

      // Compute stop count between user's from and to stations
      let stopCountHtml = '';
      if (fromCrs && toCrs) {
        const fIdx = stops.findIndex(loc => loc.crs && loc.crs.toUpperCase() === fromCrs.toUpperCase());
        const tIdx = stops.findIndex(loc => loc.crs && loc.crs.toUpperCase() === toCrs.toUpperCase());
        if (fIdx >= 0 && tIdx > fIdx) {
          const count = tIdx - fIdx;
          stopCountHtml = \` · \${count} stop\${count !== 1 ? 's' : ''}\`;
          const badge = trEl.querySelector('.stop-count-badge');
          if (badge) { badge.textContent = \`\${count} stop\${count !== 1 ? 's' : ''}\`; badge.style.display = ''; }
        }
      }

      const stopsHtml = stops.map(loc => {
        const time = loc.scheduledArr || loc.scheduledDep || '--';
        // Only show exp when the train is actually late (not early arrivals)
        const lateTime = isDelayed(loc.scheduledArr, loc.realtimeArr)
          ? loc.realtimeArr
          : (isDelayed(loc.scheduledDep, loc.realtimeDep) ? loc.realtimeDep : null);
        const lateHtml = lateTime ? \`<span class="cp-late">exp \${lateTime}</span>\` : '';
        const nameCls = loc.isOrigin ? 'cp-name is-origin' : (loc.isDestination ? 'cp-name is-destination' : 'cp-name');
        const platText = loc.platform && loc.platform !== '--' ? \`Plat \${loc.platform}\` : '';
        return \`<div class="cp-stop">
          <div class="cp-time">\${time}\${lateHtml}</div>
          <div class="\${nameCls}">\${loc.name}</div>
          <div class="cp-plat">\${platText}</div>
        </div>\`;
      }).join('');

      td.innerHTML = \`<div class="calling-points-inner">
        <div class="cp-title">All calling points\${stopCountHtml}</div>
        <div class="cp-list">\${stopsHtml}</div>
      </div>\`;
    } catch (err) {
      if (expandedUids.has(uid)) {
        td.innerHTML = \`<div class="calling-points-inner"><div class="cp-error">Could not load calling points</div></div>\`;
      }
    }
  }

  // ── Show more ─────────────────────────────────────────────────────────────
  async function loadMoreServices(from, to, timeFrom, tbodyEl, btnEl) {
    btnEl.textContent = 'Loading...';
    btnEl.disabled = true;

    const params = new URLSearchParams({ from, time: timeFrom });
    if (to) params.set('to', to);

    try {
      const resp = await fetch(\`/api/trains?\${params}\`);
      const data = await resp.json();

      if (data.error || !data.services || !data.services.length) {
        btnEl.textContent = 'No more services';
        btnEl.disabled = true;
        return;
      }

      const toLabel = document.getElementById('to-input').value.trim();
      const isFiltered = !!to;

      data.services.forEach(s => {
        const tr = buildServiceRow(s, isFiltered, toLabel, from, to, tbodyEl);
        tbodyEl.appendChild(tr);
      });

      if (data.nextTimeFrom) {
        btnEl.dataset.nextTime = data.nextTimeFrom;
        btnEl.textContent = 'Show more';
        btnEl.disabled = false;
      } else {
        btnEl.textContent = 'No more services';
        btnEl.disabled = true;
      }
    } catch (err) {
      btnEl.textContent = 'Error loading more';
      btnEl.disabled = false;
    }
  }

  // ── Build a single result <tr> ────────────────────────────────────────────
  function buildServiceRow(s, isFiltered, toLabel, fromCrs, toCrs, tbodyEl) {
    const cancelled = s.cancelled;
    const depStatus = statusLabel(s.scheduledDep, s.realtimeDep, cancelled);
    const arrStatus = s.scheduledArr ? statusLabel(s.scheduledArr, s.realtimeArr, cancelled) : null;

    const durBadge = (isFiltered && s.duration)
      ? \`<span class="duration-badge">\${s.duration}</span>\`
      : '';

    const finalDestCell = (isFiltered && s.finalDestination && s.finalDestination !== toLabel)
      ? \`<span class="final-dest">to <strong>\${s.finalDestination}</strong></span>\`
      : '';

    const destText = s.destinations.map(d => d.time ? \`\${d.name} (\${d.time})\` : d.name).join(', ');

    const expandHint = \`<span class="expand-hint">tap for stops</span>\`;

    const tr = document.createElement('tr');
    tr.className = 'service-row';
    tr.dataset.uid = s.uid;

    tr.innerHTML = \`
      <td>
        <div class="dep-time">\${s.scheduledDep || '--'}</div>
        \${depStatus.html}
        \${expandHint}
        <span class="stop-count-badge" style="display:none"></span>
      </td>
      \${isFiltered ? \`<td>
        <div class="arr-time">\${s.scheduledArr || '--'}</div>
        \${arrStatus ? arrStatus.html : ''}
        \${durBadge}
        \${finalDestCell}
      </td>\` : \`<td><div class="dest-list">\${destText || '--'}</div></td>\`}
      <td class="platform">\${s.platform}</td>
      <td class="\${depStatus.cls}">\${depStatus.label}</td>
      <td class="operator">\${s.operator}</td>
    \`;

    if (s.uid) {
      tr.addEventListener('click', () => toggleCallingPoints(s.uid, fromCrs, toCrs, tbodyEl, tr));
    }

    return tr;
  }

  // ── Search ────────────────────────────────────────────────────────────────
  const resultsEl = document.getElementById('results');

  async function doSearch() {
    const fromCrs = document.getElementById('from-crs').value;
    const toCrs = document.getElementById('to-crs').value;
    const fromName = document.getElementById('from-input').value.trim();
    const toName = document.getElementById('to-input').value.trim();

    if (!fromCrs && !fromName) {
      resultsEl.innerHTML = '<div class="empty-state">Enter a departure station to search.</div>';
      return;
    }

    const from = fromCrs || fromName.slice(0, 3).toUpperCase();
    const to = toCrs || (toName ? toName.slice(0, 3).toUpperCase() : '');

    const timeVal = document.getElementById('time-input').value.replace(':', '');

    const params = new URLSearchParams({ from });
    if (to) params.set('to', to);
    if (timeVal) params.set('time', timeVal);

    resultsEl.innerHTML = \`
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Fetching departures...</p>
      </div>\`;

    document.getElementById('btn-search').disabled = true;
    expandedUids.clear();

    try {
      const fetchDeps = fetch(\`/api/trains?\${params}\`).then(r => r.json());
      const fetchLast = (from && to)
        ? fetch(\`/api/last-train?from=\${encodeURIComponent(from)}&to=\${encodeURIComponent(to)}\`).then(r => r.json()).catch(() => null)
        : Promise.resolve(null);

      const [data, lastData] = await Promise.all([fetchDeps, fetchLast]);

      if (data.error) {
        resultsEl.innerHTML = \`<div class="error-state">
          <p>Could not fetch train times: \${data.error}</p>
          \${data.detail ? \`<p style="margin-top:8px;font-size:0.8rem;opacity:0.7">\${data.detail}</p>\` : ''}
        </div>\`;
        return;
      }

      renderResults(data, from, to, fromName || from, toName || to, timeVal, lastData);

      if (from && to) {
        const alreadySaved = getSavedJourneys().some(j => j.from === from && j.to === to);
        const saveBar = document.createElement('div');
        saveBar.className = 'save-bar';
        if (alreadySaved) {
          saveBar.innerHTML = \`<span class="saved-note">✓ Journey saved</span>\`;
        } else {
          const btn = document.createElement('button');
          btn.className = 'btn-save-journey';
          btn.textContent = '+ Save this journey';
          btn.dataset.from = from;
          btn.dataset.fromName = fromName || from;
          btn.dataset.to = to;
          btn.dataset.toName = toName || to;
          btn.addEventListener('click', () => {
            saveJourney(btn.dataset.from, btn.dataset.fromName, btn.dataset.to, btn.dataset.toName);
            saveBar.innerHTML = \`<span class="saved-note">✓ Journey saved</span>\`;
          });
          saveBar.appendChild(btn);
        }
        resultsEl.appendChild(saveBar);
      }
    } catch (err) {
      resultsEl.innerHTML = \`<div class="error-state">Network error: \${err.message}</div>\`;
    } finally {
      document.getElementById('btn-search').disabled = false;
    }
  }

  function renderResults(data, from, to, fromLabel, toLabel, timeVal, lastData) {
    if (!data.services || !data.services.length) {
      resultsEl.innerHTML = \`
        <div class="results-header">
          <h2>Departures from \${data.from}</h2>
          <span class="meta">No services found</span>
        </div>
        <div class="empty-state">No trains found for this route at this time.</div>\`;
      return;
    }

    const heading = toLabel ? \`\${data.from} → \${toLabel}\` : \`Departures from \${data.from}\`;
    const timeDisplay = formatDisplayTime(timeVal);
    const isFiltered = !!to;

    resultsEl.innerHTML = \`
      <div class="results-header">
        <h2>\${heading}</h2>
        <span class="meta">\${timeDisplay} &middot; \${data.services.length} service\${data.services.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="table-wrap" id="results-table-wrap">
        <table id="results-table">
          <thead>
            <tr>
              <th>Departs</th>
              \${isFiltered ? '<th>Arrives · Duration · To</th>' : '<th>Destination</th>'}
              <th>Plat</th>
              <th>Status</th>
              <th>Operator</th>
            </tr>
          </thead>
          <tbody id="results-tbody"></tbody>
        </table>
      </div>\`;

    const tbodyEl = document.getElementById('results-tbody');

    data.services.forEach(s => {
      tbodyEl.appendChild(buildServiceRow(s, isFiltered, toLabel, from, to, tbodyEl));
    });

    // Show-more button
    if (data.nextTimeFrom) {
      const tableWrap = document.getElementById('results-table-wrap');
      const showMoreBtn = document.createElement('button');
      showMoreBtn.className = 'btn-show-more';
      showMoreBtn.textContent = 'Show more departures';
      showMoreBtn.dataset.nextTime = data.nextTimeFrom;
      showMoreBtn.addEventListener('click', function() {
        loadMoreServices(from, to, this.dataset.nextTime, tbodyEl, this);
      });
      tableWrap.insertAdjacentElement('afterend', showMoreBtn);
    }

    // Last train banner
    if (toLabel && lastData && lastData.lastService) {
      const ls = lastData.lastService;
      const durStr = ls.duration ? \` &middot; \${ls.duration}\` : '';
      const termStr = (ls.finalDestination && ls.finalDestination !== toLabel)
        ? \` &middot; to \${ls.finalDestination}\`
        : '';
      resultsEl.insertAdjacentHTML('beforeend', \`
        <div class="last-train-banner">
          <span class="lbl">Last train today</span>
          <span class="last-train-time">\${ls.scheduledDep}</span>
          <span class="last-train-detail">arr \${ls.scheduledArr || '--'}\${durStr}\${termStr} &middot; \${ls.operator}</span>
        </div>\`);
    }
  }

  function statusLabel(sched, actual, cancelled) {
    if (cancelled) return { label: 'Cancelled', cls: 'status-cancelled', html: '<span class="time-actual cancelled">Cancelled</span>' };
    if (!sched || !actual || sched === actual) {
      return { label: 'On time', cls: 'status-on-time', html: '' };
    }
    const s = parseInt(sched.replace(':', ''), 10);
    const a = parseInt(actual.replace(':', ''), 10);
    const late = a - s;
    if (late > 0) {
      return {
        label: \`+\${late} min\`,
        cls: 'status-late',
        html: \`<span class="time-actual late">Exp \${actual}</span>\`,
      };
    }
    return { label: 'On time', cls: 'status-on-time', html: '' };
  }

  function formatDisplayTime(timeVal) {
    if (!timeVal) return 'Now';
    try {
      const hh = timeVal.slice(0, 2);
      const mm = timeVal.slice(2) || '00';
      const now = new Date();
      return \`\${now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} \${hh}:\${mm}\`;
    } catch { return 'Now'; }
  }

  document.getElementById('btn-search').addEventListener('click', doSearch);

  document.getElementById('btn-swap').addEventListener('click', () => {
    const fromInput = document.getElementById('from-input');
    const fromCrs = document.getElementById('from-crs');
    const toInput = document.getElementById('to-input');
    const toCrs = document.getElementById('to-crs');
    const tmpName = fromInput.value;
    const tmpCrs = fromCrs.value;
    fromInput.value = toInput.value;
    fromCrs.value = toCrs.value;
    toInput.value = tmpName;
    toCrs.value = tmpCrs;
  });

  ['from-input', 'to-input', 'date-input', 'time-input'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSearch();
    });
  });

  // ── Saved journeys ────────────────────────────────────────────────────────
  const JOURNEYS_KEY = 'train_journeys_v1';

  function getSavedJourneys() {
    try { return JSON.parse(localStorage.getItem(JOURNEYS_KEY) || '[]'); }
    catch { return []; }
  }

  function saveJourney(from, fromName, to, toName) {
    const journeys = getSavedJourneys();
    const id = \`\${from}_\${to}\`;
    if (!journeys.find(j => j.id === id)) {
      journeys.push({ id, from, fromName, to, toName });
      localStorage.setItem(JOURNEYS_KEY, JSON.stringify(journeys));
    }
    renderSavedPanel();
  }

  function removeJourney(id) {
    const journeys = getSavedJourneys().filter(j => j.id !== id);
    localStorage.setItem(JOURNEYS_KEY, JSON.stringify(journeys));
    renderSavedPanel();
  }

  async function fetchSavedTimes(from, to, timeFrom) {
    try {
      const params = new URLSearchParams({ from, to });
      if (timeFrom) params.set('time', timeFrom);
      const resp = await fetch(\`/api/trains?\${params}\`);
      if (!resp.ok) return null;
      const data = await resp.json();
      return data;
    } catch { return null; }
  }

  // Toggle calling points in a saved journey's expand area (not a table row)
  const expandedSavedUids = new Set();
  async function toggleSavedCallingPoints(uid, fromCrs, toCrs, expandEl, chipEl) {
    if (expandedSavedUids.has(uid)) {
      expandedSavedUids.delete(uid);
      chipEl.classList.remove('chip-expanded');
      expandEl.innerHTML = '';
      expandEl.style.display = 'none';
      return;
    }
    // Collapse any currently expanded chip in this panel
    expandedSavedUids.forEach(u => expandedSavedUids.delete(u));
    expandEl.querySelectorAll && expandEl.parentElement.querySelectorAll('.chip-expanded').forEach(el => el.classList.remove('chip-expanded'));

    expandedSavedUids.add(uid);
    chipEl.classList.add('chip-expanded');
    expandEl.style.display = '';
    expandEl.innerHTML = \`<div class="calling-points-inner"><div class="cp-loading">Loading calling points...</div></div>\`;

    try {
      const resp = await fetch(\`/api/service?uid=\${encodeURIComponent(uid)}\`);
      const data = await resp.json();

      if (!expandedSavedUids.has(uid)) return;

      if (data.error || !data.locations || !data.locations.length) {
        expandEl.innerHTML = \`<div class="calling-points-inner"><div class="cp-error">Calling points unavailable</div></div>\`;
        return;
      }

      const stops = data.locations.filter(loc => !loc.isPass);

      let stopCountHtml = '';
      if (fromCrs && toCrs) {
        const fIdx = stops.findIndex(loc => loc.crs && loc.crs.toUpperCase() === fromCrs.toUpperCase());
        const tIdx = stops.findIndex(loc => loc.crs && loc.crs.toUpperCase() === toCrs.toUpperCase());
        if (fIdx >= 0 && tIdx > fIdx) {
          const count = tIdx - fIdx;
          stopCountHtml = \` · \${count} stop\${count !== 1 ? 's' : ''}\`;
        }
      }

      const stopsHtml = stops.map(loc => {
        const time = loc.scheduledArr || loc.scheduledDep || '--';
        const lateTime = isDelayed(loc.scheduledArr, loc.realtimeArr)
          ? loc.realtimeArr
          : (isDelayed(loc.scheduledDep, loc.realtimeDep) ? loc.realtimeDep : null);
        const lateHtml = lateTime ? \`<span class="cp-late">exp \${lateTime}</span>\` : '';
        const nameCls = loc.isOrigin ? 'cp-name is-origin' : (loc.isDestination ? 'cp-name is-destination' : 'cp-name');
        const platText = loc.platform && loc.platform !== '--' ? \`Plat \${loc.platform}\` : '';
        return \`<div class="cp-stop">
          <div class="cp-time">\${time}\${lateHtml}</div>
          <div class="\${nameCls}">\${loc.name}</div>
          <div class="cp-plat">\${platText}</div>
        </div>\`;
      }).join('');

      expandEl.innerHTML = \`<div class="calling-points-inner">
        <div class="cp-title">All calling points\${stopCountHtml}</div>
        <div class="cp-list">\${stopsHtml}</div>
      </div>\`;
    } catch {
      if (expandedSavedUids.has(uid)) {
        expandEl.innerHTML = \`<div class="calling-points-inner"><div class="cp-error">Could not load calling points</div></div>\`;
      }
    }
  }

  async function fetchLastTrain(from, to) {
    try {
      const resp = await fetch(\`/api/last-train?from=\${encodeURIComponent(from)}&to=\${encodeURIComponent(to)}\`);
      if (!resp.ok) return null;
      const data = await resp.json();
      return data.lastService || null;
    } catch { return null; }
  }

  function renderChip(svc, uid, fromCrs, toCrs, expandId) {
    const dep = svc.scheduledDep || '--';
    // Only show expected time if the train is actually delayed (not early)
    const depDelay = isDelayed(svc.scheduledDep, svc.realtimeDep) ? \` (exp \${svc.realtimeDep})\` : '';
    const arr = svc.scheduledArr ? \` → \${svc.scheduledArr}\` : '';
    const arrDelay = isDelayed(svc.scheduledArr, svc.realtimeArr) ? \` (exp \${svc.realtimeArr})\` : '';
    const plat = svc.platform && svc.platform !== '--' ? \` · Plat \${svc.platform}\` : '';
    const durStr = svc.duration ? svc.duration : '';
    const finalDestStr = svc.finalDestination ? \`to \${svc.finalDestination}\` : '';
    let cls = 'saved-train-chip';
    if (svc.cancelled) cls += ' cancelled';
    else if (isDelayed(svc.scheduledDep, svc.realtimeDep)) cls += ' late';
    else cls += ' on-time';
    const uidAttr = uid ? \` data-uid="\${uid}" data-from="\${fromCrs||''}" data-to="\${toCrs||''}" data-expand="\${expandId||''}"\` : '';
    const clickable = uid ? ' saved-chip-clickable' : '';
    return \`<div class="\${cls}\${clickable}"\${uidAttr}>
      <div class="chip-main"><span>\${dep}\${depDelay}\${arr}\${arrDelay}</span><span class="plat">\${plat}</span></div>
      \${durStr ? \`<span class="chip-dur">\${durStr}\${finalDestStr ? \` · \${finalDestStr}\` : ''}</span>\` : (finalDestStr ? \`<span class="chip-final-dest">\${finalDestStr}</span>\` : '')}
    </div>\`;
  }

  function renderLastChip(ls) {
    if (!ls) return '';
    return \`<div class="saved-last-chip">
      <span class="lbl">Last train</span>
      <strong>\${ls.scheduledDep}</strong>\${ls.duration ? \` · \${ls.duration}\` : ''}
    </div>\`;
  }

  // Append chips (and show-more button) to a saved journey's times element.
  function populateSavedTimes(timesEl, expandEl, svcs, nextTimeFrom, fromCrs, toCrs, jId) {
    // Remove any existing show-more button before appending
    const oldBtn = timesEl.querySelector('.btn-saved-show-more');
    if (oldBtn) oldBtn.remove();

    const expandId = \`sj-expand-\${jId}\`;
    svcs.slice(0, 3).forEach(svc => {
      const uid = svc.uid;
      const chipHtml = renderChip(svc, uid, fromCrs, toCrs, expandId);
      const wrapper = document.createElement('div');
      wrapper.innerHTML = chipHtml;
      const chipEl = wrapper.firstElementChild;
      if (uid) {
        chipEl.addEventListener('click', () => toggleSavedCallingPoints(uid, fromCrs, toCrs, expandEl, chipEl));
      }
      timesEl.appendChild(chipEl);
    });

    if (nextTimeFrom) {
      const btn = document.createElement('button');
      btn.className = 'btn-saved-show-more';
      btn.textContent = 'more';
      btn.dataset.nextTime = nextTimeFrom;
      btn.addEventListener('click', async function() {
        btn.textContent = '...';
        btn.disabled = true;
        const data = await fetchSavedTimes(fromCrs, toCrs, this.dataset.nextTime);
        if (data && data.services && data.services.length) {
          populateSavedTimes(timesEl, expandEl, data.services, data.nextTimeFrom, fromCrs, toCrs, jId);
        } else {
          btn.remove();
        }
      });
      timesEl.appendChild(btn);
    }
  }

  async function renderSavedPanel() {
    const journeys = getSavedJourneys();
    const panel = document.getElementById('saved-panel');
    const list = document.getElementById('saved-list');

    if (!journeys.length) {
      panel.style.display = 'none';
      return;
    }

    panel.style.display = '';
    const note = document.getElementById('saved-refresh-note');
    note.textContent = 'Refreshing...';

    // Build skeleton rows (label + empty times + controls + expand area)
    list.innerHTML = journeys.map(j => \`
      <div class="saved-journey-row" id="sj-\${j.id}">
        <div class="saved-route-label">\${j.fromName} → \${j.toName}</div>
        <div class="saved-times" id="sj-times-\${j.id}"><span class="saved-loading">Loading...</span></div>
        <div class="saved-controls">
          <button class="btn-saved-search" data-from="\${j.from}" data-from-name="\${encodeURIComponent(j.fromName)}" data-to="\${j.to}" data-to-name="\${encodeURIComponent(j.toName)}">Search</button>
          <button class="btn-remove-journey" data-id="\${j.id}">✕</button>
        </div>
      </div>
      <div class="saved-chip-expand" id="sj-expand-\${j.id}" style="display:none"></div>\`).join('');

    list.querySelectorAll('.btn-saved-search').forEach(btn => {
      btn.addEventListener('click', () => {
        const fromInput = document.getElementById('from-input');
        const fromCrsInput = document.getElementById('from-crs');
        const toInput = document.getElementById('to-input');
        const toCrsInput = document.getElementById('to-crs');
        fromInput.value = decodeURIComponent(btn.dataset.fromName);
        fromCrsInput.value = btn.dataset.from;
        toInput.value = decodeURIComponent(btn.dataset.toName);
        toCrsInput.value = btn.dataset.to;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        doSearch();
      });
    });

    list.querySelectorAll('.btn-remove-journey').forEach(btn => {
      btn.addEventListener('click', () => removeJourney(btn.dataset.id));
    });

    const results = await Promise.all(journeys.map(async j => ({
      data: await fetchSavedTimes(j.from, j.to),
      last: await fetchLastTrain(j.from, j.to),
    })));

    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    note.textContent = \`Updated \${now}\`;

    journeys.forEach((j, i) => {
      const timesEl = document.getElementById(\`sj-times-\${j.id}\`);
      const expandEl = document.getElementById(\`sj-expand-\${j.id}\`);
      if (!timesEl) return;

      const { data, last } = results[i];
      timesEl.innerHTML = '';

      if (!data || !data.services || !data.services.length) {
        timesEl.innerHTML = '<span class="saved-loading">No services found</span>';
      } else {
        populateSavedTimes(timesEl, expandEl, data.services, data.nextTimeFrom, j.from, j.to, j.id);
      }

      const lastChipHtml = renderLastChip(last);
      if (lastChipHtml) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = lastChipHtml;
        timesEl.appendChild(wrapper.firstElementChild);
      }
    });
  }

  renderSavedPanel();
  setInterval(renderSavedPanel, 60000);
</script>

</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// Main fetch handler
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/trains") {
      return handleApi(request, env);
    }

    if (url.pathname === "/api/last-train") {
      return handleLastTrain(request, env);
    }

    if (url.pathname === "/api/service") {
      return handleService(request, env);
    }

    if (url.pathname === "/api/stations") {
      return handleStations();
    }

    return handleHtml();
  },
};
