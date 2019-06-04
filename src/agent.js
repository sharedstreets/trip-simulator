const fs = require("fs");
const path = require("path");
const turf = require("@turf/turf");
const tilebelt = require("@mapbox/tilebelt");
const cover = require("@mapbox/tile-cover");
const Status = require("./status");

var Agent = function(simulation, opts, config) {
  this.probes = opts.probes;
  this.traces = opts.traces;
  this.trips = opts.trips;
  this.changes = opts.changes;
  this.simulation = simulation;
  this.config = config;
  this.status = Status.ACTIVATING;
  this.speed = Math.abs(this.simulation.chance.normal({ mean: 1, dev: 0.1 }));
  this.breakdown =
    this.simulation.time +
    Math.abs(
      config.timeToBreakage * this.simulation.chance.normal({ mean: 1, dev: 1 })
    );
  this.shift =
    this.simulation.time +
    Math.abs(
      config.serviceDuration *
        this.simulation.chance.normal({ mean: 1, dev: 1 })
    );
  this.id = [
    this.simulation.chance.letter({ casing: "upper" }),
    this.simulation.chance.letter({ casing: "upper" }),
    this.simulation.chance.letter({ casing: "upper" }),
    "-",
    this.simulation.chance.character({ pool: "0123456789" }),
    this.simulation.chance.character({ pool: "0123456789" }),
    this.simulation.chance.character({ pool: "0123456789" }),
    this.simulation.chance.character({ pool: "0123456789" })
  ].join("");
};

Agent.prototype.step = async function() {
  if (this.status === Status.ACTIVATING) {
    // transition to idling
    this.status = Status.IDLING;
    // set idling duration
    if (this.config.idleTimeBetweenTrips > 0) {
      this.next =
        this.simulation.time +
        Math.abs(
          this.config.idleTimeBetweenTrips *
            this.simulation.chance.normal({
              mean: 1,
              dev: 1
            })
        );
    } else this.next = -1;

    // place vehicle
    await this.place();

    // log status_change: available, service_start
    if (this.changes) {
      var change = {
        vehicle_id: this.id,
        event_time: this.simulation.time,
        event_type: "available",
        event_type_reason: "service_start",
        event_location: turf.point(this.gps())
      };

      fs.appendFileSync(
        path.join(__dirname, "../" + this.changes),
        JSON.stringify(change) + "\n"
      );
    }
  } else if (this.status === Status.IDLING) {
    // if idle duration expired, transition to searching
    if (this.simulation.time >= this.next) {
      // if search distance is zero, skip to traveling
      if (this.config.distanceBetweenTrips > 0) {
        this.status = Status.SEARCHING;

        // calculate search range
        const range = Math.abs(
          this.config.distanceBetweenTrips *
            this.simulation.chance.normal({
              mean: 1,
              dev: 1
            })
        );
        // select search route
        await this.route(range);
      } else {
        this.status = Status.TRAVELING;

        // log status_change: reserved, user_pick_up
        if (this.changes) {
          var change = {
            vehicle_id: this.id,
            event_time: this.simulation.time,
            event_type: "reserved",
            event_type_reason: "user_pick_up",
            event_location: turf.point(this.gps())
          };
          fs.appendFileSync(
            path.join(__dirname, "../" + this.changes),
            JSON.stringify(change) + "\n"
          );
        }

        // calculate travel range
        const range = Math.abs(
          this.config.tripDistance *
            this.simulation.chance.normal({
              mean: 1,
              dev: 1
            })
        );

        // select travel route
        await this.route(range);
      }
    }
  } else if (this.status === Status.SEARCHING) {
    // set vehicle location by % search route complete
    const progress =
      (this.simulation.time - this.start) / (this.next - this.start);
    this.location = turf.along(
      this.path.line,
      progress * this.path.distance || 0
    ).geometry.coordinates;

    // if search duration expired, transition to traveling
    if (this.simulation.time >= this.next) {
      this.status = Status.TRAVELING;

      // log status_change: reserved, user_pick_up
      if (this.changes) {
        var change = {
          vehicle_id: this.id,
          event_time: this.simulation.time,
          event_type: "reserved",
          event_type_reason: "user_pick_up",
          event_location: turf.point(this.gps())
        };
        fs.appendFileSync(
          path.join(__dirname, "../" + this.changes),
          JSON.stringify(change) + "\n"
        );
      }

      // calculate travel range
      const range = Math.abs(
        this.config.tripDistance *
          this.simulation.chance.normal({
            mean: 1,
            dev: 1
          })
      );

      // select travel route
      await this.route(range);
    }
  } else if (this.status === Status.TRAVELING) {
    // set vehicle location by % travel route complete
    const progress =
      (this.simulation.time - this.start) / (this.next - this.start);

    this.location = turf.along(
      this.path.line,
      progress * this.path.distance
    ).geometry.coordinates;

    // if breakdown triggered, transition to broken
    if (this.simulation.time >= this.breakdown) {
      this.status = Status.BROKEN;

      // log status_change: unavailable, maintenance
      if (this.changes) {
        var change = {
          vehicle_id: this.id,
          event_time: this.simulation.time,
          event_type: "unavailable",
          event_type_reason: "maintenance",
          event_location: turf.point(this.gps())
        };
        fs.appendFileSync(
          path.join(__dirname, "../" + this.changes),
          JSON.stringify(change) + "\n"
        );
      }

      // log trip
      if (this.trips) {
        const trip = {
          vehicle_id: this.id,
          trip_duration: this.path.duration / 1000,
          trip_distance: this.path.distance * 1000,
          start_time: this.start,
          end_time: this.next,
          route: turf.featureCollection(
            this.path.line.geometry.coordinates.map((c, i) => {
              return turf.point(this.gps(c), {
                // interpolate timestamp from this.start
                timestamp: this.start + i * this.simulation.stepSize
              });
            })
          )
        };

        fs.appendFileSync(
          path.join(__dirname, "../" + this.trips),
          JSON.stringify(trip) + "\n"
        );
      }
    }
    // if travel duration expired, transition to idling
    if (this.simulation.time >= this.next) {
      this.status = Status.IDLING;

      // log status_change: available, user_drop_off
      if (this.changes) {
        var change = {
          vehicle_id: this.id,
          event_time: this.simulation.time,
          event_type: "available",
          event_type_reason: "user_drop_off",
          event_location: turf.point(this.gps())
        };
        fs.appendFileSync(
          path.join(__dirname, "../" + this.changes),
          JSON.stringify(change) + "\n"
        );
      }

      // log trip
      if (this.trips) {
        const trip = {
          vehicle_id: this.id,
          trip_duration: this.path.duration / 1000,
          trip_distance: this.path.distance * 1000,
          start_time: this.start,
          end_time: this.next,
          route: turf.featureCollection(
            this.path.line.geometry.coordinates.map((c, i) => {
              return turf.point(this.gps(c), {
                // interpolate timestamp from this.start
                timestamp: this.start + i * this.simulation.stepSize
              });
            })
          )
        };

        fs.appendFileSync(
          path.join(__dirname, "../" + this.trips),
          JSON.stringify(trip) + "\n"
        );
      }
    }
  } else if (this.status === Status.BROKEN) {
    // do nothing
  } else if (this.status === Status.DEACTIVATING) {
    // log status_change: unavailable, service_end
    if (this.changes) {
      var change = {
        vehicle_id: this.id,
        event_time: this.simulation.time,
        event_type: "unavailable",
        event_type_reason: "service_end",
        event_location: turf.point(this.gps())
      };
      fs.appendFileSync(
        path.join(__dirname, "../" + this.changes),
        JSON.stringify(change) + "\n"
      );
    }
    // kill agent
  }

  // log vehicle probe
  if (this.probes) {
    var probe = turf.point(this.gps(), {
      id: this.id,
      time: this.simulation.time,
      status: String(this.status).slice(7, -1)
    });
    fs.appendFileSync(
      path.join(__dirname, "../" + this.probes),
      JSON.stringify(probe) + "\n"
    );
  }
};

Agent.prototype.gps = function(coordinate) {
  var drifted = turf.destination(
    turf.point(coordinate || this.location),
    this.simulation.chance.normal() * this.config.horizontalAccuracy,
    this.simulation.chance.normal() * 360
  ).geometry.coordinates;

  return drifted;
};

// select starting location
Agent.prototype.place = async function() {
  // pick a quadkey
  const quadkey = this.simulation.chance.weighted(
    this.simulation.quadranks,
    this.simulation.quadscores
  );
  const bbox = tilebelt.tileToBBOX(tilebelt.quadkeyToTile(quadkey));

  // select random point within bbox
  const pt = [
    this.simulation.chance.longitude({ min: bbox[0], max: bbox[2] }),
    this.simulation.chance.latitude({ min: bbox[1], max: bbox[3] })
  ];

  // snap to graph
  const snapped = await this.simulation.snap(pt);
  this.location = snapped;
};

// select route
Agent.prototype.route = async function(range) {
  try {
    // buffer location to range
    const buffer = turf.buffer(turf.point(this.location), range).geometry;
    // compute quadkeys to query
    const quadkeys = cover.indexes(buffer, this.simulation.Z);
    // select random quadkey by rank
    const scores = quadkeys.map(q => {
      var score = this.simulation.quadtree.get(q);
      return this.simulation.quadtree.get(q) || 0;
    });

    const quadkey = this.simulation.chance.weighted(quadkeys, scores);
    const bbox = tilebelt.tileToBBOX(tilebelt.quadkeyToTile(quadkey));
    // select random destination within bbox
    var destination = [
      this.simulation.chance.longitude({ min: bbox[0], max: bbox[2] }),
      this.simulation.chance.latitude({ min: bbox[1], max: bbox[3] })
    ];
    // snap destination to graph
    destination = await this.simulation.snap(destination);
    // route from location to destination
    this.path = await this.simulation.route(this.location, destination);
    this.path.duration = this.path.duration * this.speed * 1000;
    this.path.line = turf.lineString(this.path.geometry.coordinates);
    this.path.distance = turf.length(this.path.line);
    this.start = this.simulation.time;
    this.next = this.simulation.time + this.path.duration;

    if (this.path.distance === 0) {
      return await this.route(range * 1.5);
    }

    if (this.traces) {
      fs.appendFileSync(
        path.join(__dirname, "../" + this.traces),
        JSON.stringify(
          turf.lineString(
            this.path.line.geometry.coordinates.map(c => {
              return this.gps(c);
            }),
            { d: this.path.distance }
          )
        ) + "\n"
      );
    }
  } catch (e) {
    console.log(e);
    throw new Error();
    return this.route(range * 1.5);
  }
};

module.exports = Agent;
