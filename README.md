# trip-simulator
Scripts for generating simulated GPS data from NYC taxi origin/destinations

## Overview

`trip-simulator` is a tool created by [SharedStreets](sharedstreets.io) for generating simulated raw GPS telemetry. Raw GPS data is highly sensitive, since it can be easily deanonymized and used to track the historical movements of an individual. For this reason, it is difficult to safely develop algorithms for use cases like transit analysis, map matching, or speed profiling without having this data locally available. The SharedStreets trip-simulator uses real open origin destination data from the NYC TLC, combined with synthesized route paths and simulated GPS noise, to create realistically modeled location telemetry. Since the data is fake, there is no privacy risk, and since the noise is plausibly simulated, it can still be used for algorithms that need to operate under real world signal conditions.

![](https://i.imgur.com/Z1N2Tdj.jpg)
*1 million trips simulated over NYC*

## Signal Simulation

GPS signals are mimicked by an algorithm that plays back the shortest route and simulates the frequency and location accuracy drift found in raw telemetry from a device like a phone or vehicle.

### Frequency

Varying time between location updates is simulated by starting from the beginning of the route and playing back the path in steps, with the gap between updates set by a random point on a normal distribution with a mean of 20 seconds. Any updates exceeding 1Hz are capped, so there should be no gaps shorter than 1 second in duration.

In addition to the distribution used to vary the gap between each update, an additional frequency bias is assigned to each trip based on a second normal distribution to give some trips an overall high or low update frequency. This behavior is used to mimic patterns often seen in location telemetry where a particular device performs a bit more or less optimally depending a number of confounding factors such as operating system, chipset, battery level, and app configuration.

### Location

Like frequency, locational drift is also simulated per update with an overall per trip bias, both generated through selecting a random point over a gaussian distribution. The mean locational horizontal accuracy is set to 10 meters, which roughly approximates the maximum accuracy in modern phone hardware, with a moderately aggressive app configuration. Locational accuracy does not currently take urban canyons into account, but this could be simulated in the future.

### Preview

Below are images of sparse telemetry zoomed in to give an idea of what to expect in terms of noise fidelity. Most of the standard patterns seen in real world data emerge from the gaussian model, including cuts across city blocks where low frequency data is present, as well as tightly packed groups of pings where stationary data is present.

![](https://i.imgur.com/GCbMBiG.jpg)
*Lower Manhattan / World Trade Center*
![](https://i.imgur.com/CmDSxb1.jpg)
*Central Park / Hell's Kitchen / Midtown*

## Install

`trip-simulator` processes data in Node.js, with routing powered by OSRM C++ bindings. The OSRM configuration is targeted at car travel, but could be modified to simulate pedestrian, biking behavior, as needed.

```sh
npm install
```

## Format

Data is output as GeoJSON LineString Features, with an array property called `timestamps`. `timestamps` are an ordered list of simulated date times that correspond to the spatial coordinates provided in the standard GeoJSON geometry format.

## Use

```sh
make
```

Running make will perform the following sequential operations:

1. Download OD data from NYC for 11 million trips logged in 2016 (can be modified, but be aware that the TLC format has shifted over time, without explicit documentation)
2. Download an OSM extract from Geofabrik for the state of New York
3. Extract the NY OSM extract into the OSRM internal data format
4. Generate an OSRM contraction hierarchy for optimized routing
5. Generate routes for all OD pairs with simulated GPS paths (Geojson by default; Geojson line delimited sequence optional)

Expect this process to take a couple hours, between data downloads, contraction, and path generation.

### Steps

Below are the individual steps of the Makefile, useful when modifying configuration without starting from scratch.

#### trips.csv

Downloads OD data from NYC TLC endpoint.

```sh
make trips.csv
```

#### nyc.osm.pbf

Downloads New York state OSM extract from Geofrabrik

```sh
make nyc.osm.pbf
```

#### nyc.osrm

Builds OSRM database and contracts edges for optimal routing performance.

```sh
make nyc.osrm
```

#### traces.json

Generates GeoJSON file of path simulation data.

```sh
make traces.json
```

#### traces-seq.json

Generates line delimited GeoJSON file of path simulation data. This step is not run by default.

```sh
make traces-seq.json
```

## License

trip-simulator is provided under the [MIT License](./LICENSE)


## Credits

- [OSRM](https://github.com/Project-OSRM/osrm-backend) is used to generate shortest routes before noise is introduced
- OD data used to seed trips is pulled from [NYC TLC](https://www1.nyc.gov/site/tlc/about/tlc-trip-record-data.page)
