'use strict';

const Path = require('path');
const Consolidate = require('consolidate');
const Express = require('express');
const Joi = require('joi');
const Set = require('lodash.set');
const Walker = require('./walker');

const publicPath = Path.resolve(__dirname, '..', 'public');
const swaggerUiPath = Path.join(publicPath, 'swaggerui');
const schema = Joi.object({
  assetsPath: Joi.string().optional().default('/documentation/assets').description('path to swagger UI assets'),
  documentationPath: Joi.string().optional().default('/documentation').description('documentation endpoint'),
  expanded: Joi.string().optional().valid(['none', 'list', 'full']).default('list').description('expanded state of view'),
  jsonPath: Joi.string().optional().default('/documentation/json').description('JSON endpoint'),
  lang: Joi.string().optional().valid(['en', 'es', 'fr', 'it', 'ja', 'pl', 'pt', 'ru', 'tr', 'zh-cn']).default('en').description('documentation language'),
  sortEndpoints: Joi.string().optional().valid(['path', 'method', 'ordered']).default('path').description('sort method for routes'),
  title: Joi.string().optional().default('API Documentation').description('documentation page title')
});


function register (app, options) {
  const opts = Object.assign({}, options);

  Joi.validate(opts, schema, function validateCb (err, settings) {
    if (err) {
      throw err;
    }

    if (!settings.assetsPath.endsWith('/')) {
      settings.assetsPath += '/';
    }

    app.use(settings.assetsPath, Express.static(publicPath));
    app.use(settings.assetsPath, Express.static(swaggerUiPath));

    app.get(settings.documentationPath, configureDocumentation(settings));
    app.get(settings.jsonPath, configureData(settings));
  });
}

module.exports = register;
module.exports.register = register;


function configureDocumentation (options) {
  const template = Path.join(swaggerUiPath, 'index.html');
  const context = {
    hapiSwagger: {
      lang: options.lang,
      sortTags: 'default',
      sortEndpoints: options.sortEndpoints,
      expanded: options.expanded,
      jsonPath: options.jsonPath,
      info: { title: options.title },
      swaggerUIPath: options.assetsPath
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
    const data = {
      swagger: '2.0',
      // TODO: Make these configurable.
      // schemes: ['http'],
      // host: '',
      // basePath: '/',
      tags: [],
      paths: {},
      definitions: {}
    };

    routes.forEach(function eachRoute (route) {
      const path = route.path;
      const method = route.method;

      // Skip the documentation routes.
      if ((path === options.jsonPath || path === options.documentationPath) &&
          method === 'get') {
        return;
      }

      const entry = {
        tags: ['api'],
        summary: 'Expand for route details',
        operationId: `${method}_${path.replace('/', '_')}`,
        parameters: [],
        responses: responsesSchema
      };

      route.stack.forEach(function eachMiddleware (fn) {
        const schema = fn.handle._schema;

        if (!isObject(schema)) {
          return;
        }

        Object.keys(schema).forEach(function eachKey (key) {
          processSchema(schema, key, entry, data.definitions);
        });
      });

      Set(data.paths, `${path}.${method}`, entry);
    });

    res.json(data);
  };
}


function isObject (obj) {
  return typeof obj === 'object' && obj !== null;
}


function processSchema (schema, field, entry, definitions) {
  const input = schema[field];

  if (!isObject(input)) {
    return;
  }

  const model = translateJoiSchema(input.describe());
  const modelCount = Object.keys(definitions).length + 1;

  definitions[`Model ${modelCount}`] = model;
  entry.parameters.push({
    in: field,
    name: field,
    schema: { $ref: `#/definitions/Model ${modelCount}` }
  });
}


function translateJoiSchema (schema) {
  const output = { properties: {} };

  if (schema.type === 'object') {
    Object.keys(schema.children).forEach(function eachChild (name) {
      const child = schema.children[name];

      output.properties[name] = {
        type: child.type,
        description: child.description
      };
    });
  }

  return output;
}
