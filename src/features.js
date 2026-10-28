"use strict";
// Switches that the directory build turns off. The full build has everything on.
module.exports = {
  FEATURES: {
    OPENCODE: true, // the OpenCode agent: downloads and runs a local program (needs Node.js APIs, desktop only)
  },
};
