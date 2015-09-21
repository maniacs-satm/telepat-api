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
 * @api {get} /admin/user/all GetAppusers
 * @apiDescription Gets all users of the app
 * @apiName AdminGetUsers
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
 * 		"content" : [
 * 			{//user props}, ...
 * 		]
 * 	}
 *
 * @apiError 404 NotFound If the App ID doesn't exist
 */

router.get('/all', function(req, res, next) {
	var appId = req._telepat.applicationId;

	Models.User.getAll(appId, function(err, results) {
		if (err) return next(err);

		results.forEach(function(item, index, originalArray) {
			delete originalArray[index].password;
		});

		res.status(200).json({status: 200, content: results}).end();
	});
});

router.use('/update', 
	security.tokenValidation, 
	security.applicationIdValidation, 
	security.adminAppValidation);
/**
 * @api {post} /admin/user/update EditUser
 * @apiDescription Updates an user from an app
 * @apiName AdminUpdateUser
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization 
                       The authorization token obtained in the login endpoint. 
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Object} user The object that contains the user (must contain the email to identify him)
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"patches": [
 * 			{
 * 				"op": "replace",
 * 				"path": "user/user_id/field_name",
 * 				"value": "new value
 * 			}
 * 		]
 * 	}
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content" : [
 * 			{//user props}, ...
 * 		]
 * 	}
 *
 */
router.post('/update', function(req, res, next) {
	var patches = req.body.patches;

	if (!patches) {
		res.status(400)
				.json({status: 400, message: 'Patches array missing from request body'}).end();
		return;
	}

	if (!req.body.email) {
		res.status(400).json({status: 400, message: 'Email missing from request body'}).end();
		return;
	}

	async.series([
		function(callback) {
			var i = 0;
			async.each(patches, function(patch, c) {
				if (patches[i].path.split('/')[2] == 'password') {
					security.encryptPassword(patches[i].value, function(err, hash) {
						if (err) return c(err);
						patches[i].value = hash;
						i++;
						c();
					});
				} else {
					i++;
					c();
				}
			}, callback);
		},
		function(callback) {
			Models.User.update(req.body.email, req._telepat.applicationId, patches, function(err) {
				if (err && err.status == 404) {
					var error = new Error('User not found');
					error.status = 404;
					callback(error);
				} else if (err)
					return callback(err);
				else
					callback();

			});
		}
	], function(err) {
		if (err) return next(err);

		res.status(200).json({status: 200, content: 'User has been updated'}).end();
	});
});

router.use('/delete', 
	security.tokenValidation, 
	security.applicationIdValidation, 
	security.adminAppValidation);
/**
 * @api {post} /admin/user/delete Deleteuser
 * @apiDescription Deketes an user from an app
 * @apiName AdminDeleteUser
 * @apiGroup Admin
 * @apiVersion 0.2.2
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization 
                       The authorization token obtained in the login endpoint. 
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {String} email The email address of an user from an app
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"email": "user@example.com"
 * 	}
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content" : "User deleted"
 * 	}
 *
 * @apiError 404 NotFound If the App ID doesn't exist
 * @apiError 404 NotFound If the User does not belong to this application
 */
router.post('/delete', function(req, res, next) {
	if (!req.body.email) {
		res.status(400).json({status: 400, message: 'Requested email address is missing'}).end();
		return;
	}

	var appId = req._telepat.applicationId;
	var userEmail = req.body.email;

	async.waterfall([
		function(callback) {
			Models.User(userEmail, appId, callback);
		},
		function(user, callback) {
			if (user.application_id != appId) {
				var error = new Error('User does not belong to this application');
				error.code = 404;

				return callback(error);
			} else {
				Models.User.delete(userEmail, appId, callback);
			}
		}
	], function(error, results) {
		if (error && error.status == 404)
			return res.status(404).json({status: 404, message: 'User not found'}).end();
		else if (error) return next(error);

		if (results) {
			async.each(results, function(item, c) {
				var context = item.context_id;
				var mdl = item.value.type;
				var id = item.value.id;

				app.kafkaProducer.send([{
					topic: 'aggregation',
					messages: [JSON.stringify({
						op: 'delete',
						object: {path: mdl+'/'+id},
						context: context,
						applicationId: appId
					})],
					attributes: 0
				}], c);
			});
		}

		res.status(202).json({status: 202, content: 'User deleted'}).end();
	});
});

module.exports = router;