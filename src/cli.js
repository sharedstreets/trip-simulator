#!/usr/bin/env node

const path = require("path");
const Simulation = require("./simulation");
var argv = require("minimist")(process.argv.slice(2));

if (argv.help || argv.h || Object.keys(argv).length === 1) {
  var help = "";
  help += "\ntrip-simulator\n";
  help += "\n";
  help += "-h,--help     show help\n";
  help += "--config      config car,bike,scooter\n";
  help += "--pbf         osm.pbf file\n";
  help += "--graph       osrm graph file\n";
  help += "--agents      number of agents\n";
  help += "--start       start time in epoch milliseconds\n";
  help += "--seconds     number of seconds to simulate\n";
  help += "--probes      GeoJSON probes output file\n";
  help += "--traces      GeoJSON traces output file\n";
  help += "--trips       MDS trips output file\n";
  help += "--changes     MDS status changes output file\n";

  console.log(help);
  process.exit(0);
} else {
  if (!argv.config) throw new Error("specify config");
  if (!argv.pbf) throw new Error("specify pbf");
  if (!argv.graph) throw new Error("specify osrm graph");
  if (!argv.agents) throw new Error("specify number of agents");
  if (!argv.start) throw new Error("specify start time");
  if (!argv.seconds) throw new Error("specify number of seconds");
}

const config = require(path.join(
  __dirname,
  "../configs/" + argv.config + ".json"
));
const quiet = argv.quiet || argv.q;
const pbf = argv.pbf;
const graph = argv.graph;
const agents = +argv.agents;
const start = +argv.seconds;
const seconds = +argv.seconds;
const probes = argv.probes;
const traces = argv.traces;
const trips = argv.trips;
const changes = argv.changes;

var opts = {
  probes: probes,
  traces: traces,
  trips: trips,
  changes: changes,
  pbf: pbf,
  graph: graph,
  agents: agents,
  start: start
};

var message = "";

async function main() {
  var simulation = new Simulation(opts, config);

  await simulation.setup();

  var i = seconds;

  while (i--) {
    if (!quiet) {
      const update = (((seconds - i) / seconds) * 100).toFixed(2) + "%";
      if (update !== message) {
        message = update;
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(message);
      }
    }
    await simulation.step();
  }
  if (!quiet) {
    console.log();
  }
}

(async () => {
  try {
    await main();
  } catch (err) {
    throw err;
  }
})();
