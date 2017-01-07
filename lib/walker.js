'use strict';

function walk (app) {
  // The router is created lazily.
  if (app._router === undefined) {
    return [];
  }

  return _walkRouter(app._router);
}

module.exports = walk;
module.exports.walk = walk;


function _walkRouter (router) {
  let routes = [];

  router.stack.forEach(function eachLayer (layer) {
    // TODO: The layer name is probably not enough of a check.
    if (layer.name === 'bound dispatch') {
      routes = routes.concat(_walkRoute(layer.route));
    } else if (layer.name === 'router') {
      routes = routes.concat(_walkRouter(layer.handle));
    } else if (layer.name === 'mounted_app') {
      // TODO: Process a mounted app if possible.
    }
  });

  return routes;
}


function _walkRoute (route) {
  const routes = Object.keys(route.methods).map(function mapMethod (method) {
    return {
      method,
      path: route.path,
      stack: route.stack.filter(function stackFilter (layer) {
        return layer.method === method;
      })
    };
  });

  return routes;
}
