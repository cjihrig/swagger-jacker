'use strict';

const Path = require('path');
const Consolidate = require('consolidate');
const Express = require('express');
const Joi = require('joi');
const Walker = require('./walker');

const schema = Joi.object({
  documentationPath: Joi.string().optional().default('/documentation').description('documentation endpoint'),
  expanded: Joi.string().optional().valid(['none', 'list', 'full']).default('list').description('expanded state of view'),
  jsonPath: Joi.string().optional().default('/documentation/json').description('JSON endpoint'),
  lang: Joi.string().optional().valid(['en', 'es', 'fr', 'it', 'ja', 'pl', 'pt', 'ru', 'tr', 'zh-cn']).default('en').description('documentation language'),
  publicPath: Joi.string().optional().default(Path.resolve(__dirname, '..', 'public')).description('path to public directory'),
  sortEndpoints: Joi.string().optional().valid(['path', 'method', 'ordered']).default('path').description('sort method for routes'),
  swaggerUIPath: Joi.string().optional().default(Path.resolve(__dirname, '..', 'public', 'swaggerui')).description('path to swagger UI'),
  title: Joi.string().optional().default('API Documentation').description('documentation page title')
});


function register (app, options) {
  const opts = Object.assign({}, options);

  Joi.validate(opts, schema, function validateCb (err, settings) {
    if (err) {
      throw err;
    }

    app.use(Express.static(settings.publicPath));
    app.use(Express.static(settings.swaggerUIPath));

    app.get(settings.documentationPath, configureDocumentation(settings));
    app.get(settings.jsonPath, configureData(settings));
  });
}

module.exports = register;
module.exports.register = register;


function configureDocumentation (options) {
  const template = Path.join(options.swaggerUIPath, 'index.html');
  const context = {
    hapiSwagger: {
      lang: options.lang,
      sortTags: 'default',
      sortEndpoints: options.sortEndpoints,
      expanded: options.expanded,
      jsonPath: options.jsonPath,
      info: { title: options.title }
    }
  };

  return function documentation (req, res, next) {
    Consolidate.handlebars(template, context, function renderCb (err, html) {
      if (err) {
        return next(err);
      }

      res.send(html);
    });
  };
}


const responsesSchema = {
  default: {
    schema: { type: 'string' },
    description: 'Successful'
  }
};

function configureData (options) {
  return function data (req, res, next) {
    const routes = Walker(req.app);
    const paths = {};
    const definitions = {};

    routes.forEach(function eachRoute (route) {
      const path = route.path;
      const method = route.method;

      // Skip the documentation routes.
      if (method === 'get' &&
          (path === options.jsonPath || path === options.documentationPath)) {
        return;
      }

      paths[path] = paths[path] || {};
      paths[path][route.method] = {
        tags: ['api'],
        summary: 'Describe the route',
        operationId: `${method}_${path.replace('/', '_')}`,
        responses: responsesSchema
      };
    });

    res.json({
      swagger: '2.0',
      // TODO: Make these configurable.
      // schemes: ['http'],
      // host: '',
      // basePath: '/',
      tags: [],
      paths,
      definitions
    });
  };
}
