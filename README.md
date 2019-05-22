# trip-simulator
A module for generating simulated location telemetry

## Overview

`trip-simulator` is a tool created by [SharedStreets](sharedstreets.io) for generating simulated raw GPS telemetry. Raw GPS data is highly sensitive, since it can be easily deanonymized and used to track the historical movements of an individual. For this reason, it is difficult to safely develop algorithms for use cases like transit analysis, map matching, or speed profiling without having this data locally available. The SharedStreets trip-simulator realistically modeled location telemetry. Since the data is fake, there is no privacy risk, and since the noise is plausibly simulated, it can still be used for algorithms that need to operate under real world signal conditions.

![](https://i.imgur.com/Z1N2Tdj.jpg)
*1 million trips simulated over NYC*

## Features

- Multi-agent model supporting cars, bikes, or scooters
- Generates GPS data with no inputs besides OpenStreetMap
- Reasonable pickup/dropoff generated using agent model based on network density
- Physically realistic GPS noise modeled for usage in real world telemetry algorithms
- Outputs 1hz location probes, MDS compliant trips, and MDS compliant status changes

## Install

```
npm install -g trip-simulator
```

## Use

```
trip-simulator

-h,--help     show help
--config      car, bike, or scooter
--pbf         osm.pbf file
--graph       osrm graph file
--agents      number of agents
--iterations  number of iterations to simulate
--probes      probes output file
--trips       trips output file
--changes     status changes output file
```

## Test

```
npm test
```

## Lint

```
npm run lint
```
