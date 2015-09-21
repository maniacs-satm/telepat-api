/* jshint maxlen: 120 */

var express = require('express');
var router = express.Router();

var security = require('../security');
var Models = require('telepat-models');

router.use('/all',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);
/**
 * @api {post} /admin/schema/all GetSchemas
 * @apiDescription Gets the model schema for an application
 * @apiName AdminGetSchemas
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content" :{
 * 			"answer": {
 *   			"properties": {},
 *   			"belongsTo": [
 *     				{
 *       				"parentModel": "event",
 *       				"relationType": "hasSome"
 *     				}
 *   			],
 *   			"read_acl": 6,
 *   			"write_acl": 6,
 *   			"meta_read_acl": 6
 * 			},
 * 		...
 * 		}
 * 	}
 *
 */
router.get('/all', function(req, res, next) {
	var appId = req._telepat.applicationId;

	Models.Application.getAppSchema(appId, function(err, result) {
		if (err){
			next(err);
		} else {
			res.status(200).json({status: 200, content: result}).end();
		}
	});
});

router.use('/update',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);
/**
 * @api {post} /admin/schema/update UpdateSchema
 * @apiDescription Updates the model schema
 * @apiName AdminUpdateSchema
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Object} schema Updated schema object
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"schema": "see example at /schemas"
 * 	}
 *
 * @apiError 404 NotFound If the App ID doesn't exist
 */
router.post('/update', function(req, res, next) {
	if (!req.body.schema) {
		res.status(400)
				.json({status: 400, message: 'Requested schema object is missing'}).end();
		return;
	}

	var appId = req._telepat.applicationId;
	var schema = req.body.schema;

	Models.Application.updateSchema(appId, schema, function(err, result) {
		if (err){
			next(err);
		} else {
			app.applications[appId].schema = schema;
			res.status(200).json({status: 200, content: 'Schema updated'}).end();
		}
	});
});

router.use('/remove_model',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);
/**
 * @api {post} /admin/schema/remove_model RemoveAppModel
 * @apiDescription Removes a model from the application (all items of this type will be deleted)
 * @apiName AdminRemoveAppModel
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Object} schema Updated schema object
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"model_name": "events"
 * 	}
 *
 * @apiError 404 NotFound If the App ID doesn't exist
 * @apiError 404 NotFound If the App does not have a model with that name
 */
router.post('/remove_model', function(req, res, next) {
	if (!req.body.model_name) {
		res.status(400).json({status: 400, message: 'Requested model name object is missing'}).end();
		return;
	}

	var appId = req._telepat.applicationId;
	var modelName = req.body.model_name;

	if (!app.applications[appId].schema[modelName]) {
		res.status(404)
			.json({
				status: 404,
				message: 'Application with ID '+appId+' does not have a model named '+modelName
			}).end();
		return;
	}

	Models.Application.deleteModel(appId, modelName, function(err) {
		if (err){
			next(err);
		} else {
			delete app.applications[appId].schema[modelName];
			res.status(200).json({status: 200, content: 'Schema updated'}).end();
		}
	});
});

module.exports = router;