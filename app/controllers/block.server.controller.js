/**************************
 MODULE INITIALISATION
 **************************/
var mongoose = require('mongoose');
var ObjectId = require('mongodb').ObjectID;
var BlockModel    = require('../models/block.server.model');
var Follow = require('../models/users.server.model').follow;

/**************************
 BLOCK USER LIST API
 **************************/
exports.blockUser = function (req, res, next) {

    // Validating the fields
    if(!req.body.blockedById) {
        res.status(400).json({status: 0, message: "Bad Request", data: [], code: 400});
        return false;
    }

    if(!req.body.blockedId) {
        res.status(400).json({status: 0, message: "Bad Request", data: [], code: 400});
        return false;
    }

    if (String(req.body.blockedById) == String(req.body.blockedId)) {
        res.status(400).json({status: 0, message: "User cannot block themselves.", data: [], code: 400});
        return false;
    }

    var requestObject = {
        blockedById: ObjectId(req.body.blockedById),
        blockedId: ObjectId(req.body.blockedId),
    }

    // Calling model to insert data
    BlockModel.findBlockModel(requestObject, function (err, block) {
        if(err) { res.status(500).json({status: 0, message: err,data: [] }); return false;}
        if(block.length) { res.status(400).json({status: 0, message: "User is already blocked.",data: [] }); return false;}

        BlockModel.blockModel(requestObject, function(err, blocked) {
            if(err) { res.status(500).json({status: 0, message: err, data: [] }); return false;}

            Follow.update({ $or: [
                { 'followeeId': ObjectId(req.body.blockedId), 'followerId': ObjectId(req.body.blockedById) },
                { 'followeeId': ObjectId(req.body.blockedById), 'followerId': ObjectId(req.body.blockedId) }
            ]}, {$set: {"isValid": "false"}}, {"multi": true}, function(err, follow) {
                if(err) { res.status(500).json({status: 0, message: err, data: [] }); return false;}

                res.status(200).json({status: 1, message: "User is blocked successfully"});
                return false;
            });
        });
    });

}

/**************************
 UNBLOCK USER LIST API
 **************************/
exports.unblockUser = function (req, res, next) {

    // Validating the fields
    if(!req.body.blockedById) {
        res.status(400).json({status: 0, message: "Bad Request", data: [], code: 400});
        return false;
    }

    if(!req.body.blockedId) {
        res.status(400).json({status: 0, message: "Bad Request", data: [], code: 400});
        return false;
    }

    if (String(req.body.blockedById) == String(req.body.blockedId)) {
        res.status(400).json({status: 0, message: "User cannot unblock themselves.", data: [], code: 400});
        return false;
    }

    var requestObject = {
        blockedById: ObjectId(req.body.blockedById),
        blockedId: ObjectId(req.body.blockedId),
    }

    // Calling model to insert data
    BlockModel.findBlockModel(requestObject, function (err, block) {
        if(err) { res.status(500).json({status: 0, message: err,data: [] }); return false;}
        if(!block.length) { res.status(400).json({status: 0, message: "There are no user to unblock",data: [] }); return false;}

        BlockModel.unblockModel(requestObject, function(err, unblock) {
            if(err) { res.status(500).json({status: 0, message: err, data: [] }); return false;}

            Follow.update({ $or: [
                { 'followeeId': ObjectId(req.body.blockedId), 'followerId': ObjectId(req.body.blockedById) },
                { 'followeeId': ObjectId(req.body.blockedById), 'followerId': ObjectId(req.body.blockedId) }
            ]}, {$set: {"isValid": "true"}}, {"multi": true}, function(err, follow) {
                if(err) { res.status(500).json({status: 0, message: err, data: [] }); return false;}

                res.status(200).json({status: 1, message: "User is unblocked successfully"});
                return false;
            });
        });
    });

}

/**************************
 FETCH BLOCK USER LIST API
 **************************/
exports.fetchBlockUsers = function (req, res, next) {

    var limit = parseInt(req.query.limit);
    var offset = parseInt(req.query.offset);
    var pageSortQuery = { sort: { createdAt: -1 }, skip: offset, limit: limit };
    var queryCondition = {"blockedById": ObjectId(req.params.userId)}
    var requestObject = {
        "queryCondition": queryCondition,
        "pageSortQuery" : pageSortQuery
    }

    // Calling model to insert data
    BlockModel.fetchBlockUsersModel(requestObject, function (err, blocks) {
        if(err) { res.status(500).json({status: 0, message: err,data: [] }); return false;}
        if(!blocks.length) { res.status(404).json({status: 0, message: "No user is blocked",data: [] }); return false;}

        BlockModel.countBlockModel(requestObject, function(err, count) {
            res.status(200).json({status: 1, message: "Blocker list found successfully", data: { blocks:blocks, count: count, offset: offset }});
            return false;
        });
    });

}