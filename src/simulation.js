const fs = require("fs");
const through2 = require("through2");
const parser = require("osm-pbf-parser");
const turf = require("@turf/turf");
const tilebelt = require("@mapbox/tilebelt");
const cover = require("@mapbox/tile-cover");
const OSRM = require("osrm");
const Chance = require("chance");
const Agent = require("./agent");
const Status = require("./status");

const ZOOM = 18;
const Z = { min_zoom: ZOOM, max_zoom: ZOOM };

var Simulation = function(opts, config) {
  this.pbf = opts.pbf;
  this.osrm = new OSRM(opts.graph);
  this.stepSize = 1000;
  this.start = opts.start;
  this.time = this.start;
  this.nodes = new Map();
  this.quadtree = new Map();
  this.quadranks = [];
  this.quadscores = [];
  this.chance = new Chance();
  this.Z = Z;
  this.agents = [];
  var spawn = opts.agents;
  while (spawn--) {
    this.agents.push(new Agent(this, opts, config));
  }
};

Simulation.prototype.setup = async function() {
  return new Promise((resolve, reject) => {
    var parse = parser();

    // build node store
    fs.createReadStream(this.pbf)
      .pipe(parse)
      .pipe(
        through2.obj((items, enc, next) => {
          items.forEach(item => {
            if (item.type === "node") {
              this.nodes.set(item.id, [item.lon, item.lat]);
            }
          });
          next();
        })
      )
      .on("finish", () => {
        parse = parser();
        fs.createReadStream(this.pbf)
          .pipe(parse)
          .pipe(
            through2.obj((items, enc, next) => {
              items.forEach(item => {
                if (item.type === "node") {
                  // node
                  if (Object.keys(item.tags).length && item.tags.amenity) {
                    // interesting node
                    var score = Object.keys(item.tags).length;
                    var geom = turf.point(this.nodes.get(item.id)).geometry;
                    var quadkeys = cover.indexes(geom, Z);
                    for (let quadkey of quadkeys) {
                      var cell = this.quadtree.get(quadkey);
                      if (!cell) {
                        cell = score;
                      } else {
                        cell += score;
                      }
                      this.quadtree.set(quadkey, cell);
                    }
                  }
                } else if (
                  item.type === "way" &&
                  item.refs.length >= 2 &&
                  (item.tags.building ||
                    item.tags.amenity ||
                    item.tags.highway === "residential")
                ) {
                  // way
                  var score = Object.keys(item.tags).length;
                  // residential roads included, but given reduced weight
                  if (item.tags.highway) score = score * 0.1;
                  var geom = turf.lineString(
                    item.refs.map(ref => {
                      return this.nodes.get(ref);
                    })
                  ).geometry;
                  var quadkeys = cover.indexes(geom, Z);
                  for (let quadkey of quadkeys) {
                    var cell = this.quadtree.get(quadkey);
                    if (!cell) {
                      cell = score;
                    } else {
                      cell += score;
                    }
                    this.quadtree.set(quadkey, cell);
                  }
                }
              });
              next();
            })
          )
          .on("finish", () => {
            // rank quadkeys
            this.quadtree.forEach((value, key) => {
              this.quadranks.push(key);
            });
            this.quadranks.sort((a, b) => {
              return this.quadtree.get(a) - this.quadtree.get(b);
            });
            this.quadranks.forEach(q => {
              this.quadscores.push(this.quadtree.get(q));
            });

            resolve();
          });
      });
  });
};

Simulation.prototype.step = async function() {
  this.time += this.stepSize;
  for (let agent of this.agents) {
    await agent.step();
  }
};

Simulation.prototype.snap = async function(coordinates) {
  return new Promise((resolve, reject) => {
    var options = {
      coordinates: [coordinates],
      number: 1
    };

    this.osrm.nearest(options, (err, results) => {
      if (err) reject(err);
      if (results && results.waypoints.length)
        resolve(results.waypoints[0].location);
      else resolve();
    });
  });
};

Simulation.prototype.route = async function(a, b) {
  return new Promise((resolve, reject) => {
    var options = {
      coordinates: [a, b],
      overview: "full",
      geometries: "geojson"
    };

    this.osrm.route(options, (err, results) => {
      if (err) reject(err);
      if (results && results.routes && results.routes.length)
        resolve(results.routes[0]);
      else resolve();
    });
  });
};

module.exports = Simulation;
