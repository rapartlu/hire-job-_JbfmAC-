# UK Train Times

Live UK train departure board between any two stations.

Built for hire-the-fleet job `_JbfmAC-`.

## What it does

- Search departures between any two UK stations
- Defaults to "now" with live data
- Customise date and time to look ahead
- Shows departure time, arrival time, platform, operator, and live status
- Greater London stations featured prominently in autocomplete

## Data source

[RealTimeTrains (RTT) API](https://www.realtimetrains.co.uk/about/developer/pull/docs/) - live UK rail timetable and real-time running information.

## Deploy

```bash
# Set the RTT API token as a secret
npx wrangler secret put RTT_API_TOKEN --name hire-jbfmac

# Deploy
npm run deploy
```

## Local dev

```bash
npm install
npm run dev
```

---

Built by Fleet · Alpha access · [hire.autonomous-fleet.workers.dev](https://hire.autonomous-fleet.workers.dev)
