'use strict';

const Code = require('code');
const Express = require('express');
const Lab = require('lab');
const Walker = require('../lib/walker');

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const describe = lab.describe;
const it = lab.it;

const noop = () => {};


describe('Walker', () => {
  it('can walk an empty routing table', (done) => {
    expect(Walker(Express())).to.equal([]);
    done();
  });

  it('can walk simple routes', (done) => {
    const app = Express();

    // Root route
    app.get('/', noop);

    // Rest pattern routes
    app.get('/b', noop);        // Get all
    app.post('/b', noop);       // Create
    app.get('/b/:id', noop);    // Retrieve
    app.put('/b/:id', noop);    // Update
    app.delete('/b/:id', noop); // Delete

    const routes = Walker(app);

    check(routes, 'get', '/', 1, 1);
    check(routes, 'get', '/b', 1, 1);
    check(routes, 'post', '/b', 1, 1);
    check(routes, 'get', '/b/:id', 1, 1);
    check(routes, 'put', '/b/:id', 1, 1);
    check(routes, 'delete', '/b/:id', 1, 1);
    done();
  });

  it('can walk an \'all\' route', (done) => {
    const app = Express();

    app.all('/a', noop);

    const routes = Walker(app);

    check(routes, 'get', '/a', 1, 1);
    check(routes, 'post', '/a', 1, 1);
    check(routes, 'put', '/a', 1, 1);
    check(routes, 'delete', '/a', 1, 1);
    check(routes, 'patch', '/a', 1, 1);
    check(routes, 'options', '/a', 1, 1);
    check(routes, 'head', '/a', 1, 1);
    // There are more verbs, but this should be enough to check.
    done();
  });

  it('can walk simple nested routers', (done) => {
    const app = Express();
    const router = Express.Router();
    const nested = Express.Router();

    router.get('/a', noop);
    router.get('/a/b', noop);

    nested.get('/a/b/c', noop, noop);
    nested.post('/b', noop);

    router.use(nested);
    app.use(router);

    const routes = Walker(app);

    check(routes, 'get', '/a', 1, 1);
    check(routes, 'get', '/a/b', 1, 1);
    check(routes, 'get', '/a/b/c', 1, 2);
    check(routes, 'post', '/b', 1, 1);
    done();
  });

  describe('Unsupported', () => {
    it('cannot walk a nested app', (done) => {
      const app = Express();
      const nested = Express();

      nested.get('/e', noop);
      app.use(nested);

      expect(Walker(app)).to.equal([]);
      check(Walker(nested), 'get', '/e', 1, 1);
      done();
    });
  });
});


function check (routes, method, path, count, middleware) {
  let matches = 0;

  routes.forEach((route) => {
    if (route.method === method &&
        route.path === path &&
        route.stack.length === middleware) {
      matches++;
    }
  });

  expect(matches).to.equal(count);
}
