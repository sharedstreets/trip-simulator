# trip-simulator
*A module for generating simulated location telemetry*

## Overview

`trip-simulator` is a tool created by [SharedStreets](sharedstreets.io) for generating simulated raw GPS telemetry. Raw GPS data is highly sensitive, since it can be easily deanonymized and used to track the historical movements of an individual. For this reason, it is difficult to safely develop algorithms for use cases like transit analysis, map matching, or speed profiling without having this data locally available. The SharedStreets trip-simulator realistically creates location telemetry using agents and physically modeled GPS output. Since the data is fake, there is no privacy risk, and since the noise is plausibly simulated, it can still be used for algorithms that need to operate under real world signal conditions.

![](https://i.imgur.com/Z1N2Tdj.jpg)
*1 million trips simulated over NYC*

## Features

- Multi-agent model supporting cars, bikes, or scooters
- Generates GPS data with no inputs besides OpenStreetMap
- Reasonable pickup/dropoff generated using agent model based on network density
- Physically realistic GPS noise modeled for usage in real world telemetry algorithms
- Outputs 1hz location probes, MDS compliant trips, and MDS compliant status changes

## Install

```sh
npm install -g trip-simulator
```

## CLI

```
trip-simulator

-h,--help     show help
--config      config car,bike,scooter
--pbf         osm.pbf file
--graph       osrm graph file
--agents      number of agents
--start       start time in epoch milliseconds
--seconds     number of seconds to simulate
--probes      GeoJSON probes output file
--traces      GeoJSON traces output file
--trips       MDS trips output file
--changes     MDS status changes output file
```

## Use

trip-simulator features a command line interface capable of generating telemetry data for simulated vehicles around a city. The simulation requires an OpenStreetMap extract, which can be downloaded from many sources, such as planet.osm, geofabrick, or nextzen. Download and extract, and trim the network to the target area using a tool such as osmium. Once you have a trimmed extract, process the road graph using OSRM. As an example, we will walk through simulating data for Nashville, TN using a nextzen extract.

### 1. download data

```sh
curl https://s3.amazonaws.com/metro-extracts.nextzen.org/nashville_tennessee.osm.pbf -o nashville.osm.pbf
```

### 2. extract a smaller target bounding box

```sh
osmium extract -b "-86.84881,36.12262,-86.73688,36.20494" nashville.osm.pbf -o ./nash.osm.pbf -s "complete_ways" --overwrite
```

### 3. install OSRM to your project directory & process the road graph using the default pedestrian profile

```sh
npm install osrm;
./node_modules/osrm/lib/binding/osrm-extract ./nash.osm.pbf -p ./node_modules/osrm/profiles/foot.lua;
./node_modules/osrm/lib/binding/osrm-contract ./nash.osrm
```

### 4. run a 24 hour scooter simulation with 100 vehicle agents

```
trip-simulator \
  --config scooter \
  --pbf nash.osm.pbf \
  --graph nash.osrm \
  --agents 100 \
  --start 1563122921 \
  --seconds 86400 \
  --traces ./traces.json \
  --probes ./probes.json \
  --changes ./changes.json \
  --trips ./trips.json
```

## Test

```sh
npm test
```

## Lint

```sh
npm run lint
```
