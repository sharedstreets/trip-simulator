const Status = Object.freeze({
  ACTIVATING: Symbol("activating"),
  IDLING: Symbol("idling"),
  TRAVELING: Symbol("traveling"),
  SEARCHING: Symbol("searching"),
  BROKEN: Symbol("broken"),
  DEACTIVATING: Symbol("deactivating")
});

module.exports = Status;
