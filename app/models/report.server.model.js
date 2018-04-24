/**********************
 SCHEMA INITIALISTAION
 **********************/
 var Schema = require('mongoose').Schema;

/*********************
 REPORT SCHEMA
 *********************/
 var reportSchema = new Schema({
    userId:   { type: Schema.Types.ObjectId, ref: 'users' },
    glyphId:   { type: Schema.Types.ObjectId, ref: 'glyffs' },
    createdAt: {
        type: Date,
        default: Date.now
    },
    isReported:{type: Boolean, default: false},
    reportApprovedByAdmin:{type: Boolean, default: false}
});

 var reportglyff = mongoose.model('reportglyffs', reportSchema);

/**************
 EXPORT SCHEMA
 *************/

/*****************
 SAVE GLYPH MODEL
 *****************/
 function reportGlyffModel(data, callback) {
    var newReportGlyff = new reportglyff(data);

    // API call to save block
    newReportGlyff.save(function(err, reportGlyff) {
        if(err) {
            callback(null, err)
        } else {
            console.log("reportGlyff:",reportGlyff)
            callback(null, reportGlyff)
        }
    });

}

/*****************
 FIND BLOCK MODEL
 *****************/
 function findReportGlyffModel(data, callback) {

    reportglyff.find({userId: data.userId, glyphId: data.glyphId}, function(err, reportGlyff) {
        if(err) {
            callback(null, err)
        } else {
            callback(null, reportGlyff)
        }
    });

}
module.exports = {
    reportglyff : reportglyff ,
    findReportGlyffModel:findReportGlyffModel,
    reportGlyffModel:reportGlyffModel
}

