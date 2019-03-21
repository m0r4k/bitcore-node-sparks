'use strict';

var Common = require('./common');
var sparkscore = require('bitcore-lib-sparks');
var _ = sparkscore.deps._;

function MasternodeController(node) {
	this.node = node;
	this.common = new Common({log: this.node.log});
}

MasternodeController.prototype.list = function(req, res) {
	var self = this;
	this.getMNList(function(err, result) {
		if (err) {
			return self.common.handleErrors(err, res);
		}
		res.jsonp(result);
	});
};
MasternodeController.prototype.listenabled = function(req, res) {
	var self = this;
	this.getMNListEnabled(function(err, result) {
		if (err) {
			return self.common.handleErrors(err, res);
		}
		res.jsonp(result);
	});
};

MasternodeController.prototype.listnewstart = function(req, res) {
	var self = this;
	this.getMNListNewStart(function(err, result) {
		if (err) {
			return self.common.handleErrors(err, res);
		}
		res.jsonp(result);
	});
};

MasternodeController.prototype.listwatchdog = function(req, res) {
	var self = this;
	this.getMNListWatchDog(function(err, result) {
		if (err) {
			return self.common.handleErrors(err, res);
		}
		res.jsonp(result);
	});
};

MasternodeController.prototype.listinfo = function(req, res) {
	var self = this;
	this.getMNListSum(function(err, result) {
		if (err) {
			return self.common.handleErrors(err, res);
		}
		res.jsonp(result);
	});
};



MasternodeController.prototype.validate = function (req, res, next) {
    var payeeAddr = req.params.payee;
    //We first validate that the payee address is valid
    var self = this;
    if(!payeeAddr || payeeAddr.length!=34 ) {
        return self.common.handleErrors({
            message: 'Must include a valid format address',
            code: 1
        }, res);
    }

	try {
		var a = new sparkscore.Address(payeeAddr);
	} catch(e) {
		return self.common.handleErrors({
			message: 'Invalid address: ' + e.message,
			code: 1
		}, res);
	}


	//After having valide addr, we get the MNList
	this.getMNList(function(err, mnList){
		if(err){
			return self.common.handleErrors(err, res);
		}

		var filteredMnList = mnList.filter(function(elem){
			return elem.payee === payeeAddr;
		});

		if(!filteredMnList || !filteredMnList[0]){
			return res.jsonp({valid:false, payee:payeeAddr});
		}
		var mn = filteredMnList[0];
		mn.valid = false;

		if(!mn.hasOwnProperty('payee') ||
			mn.hasOwnProperty('vin')){
			var vin = mn.vin.split('-');
			var txid = vin[0];
			var voutindex = vin[1];

			self.node.getDetailedTransaction(txid, function(err, transaction) {
					if (err && err.code === -5) {
							return self.common.handleErrors(null, res);
					} else if(err) {
							return self.common.handleErrors(err, res);
					}
					if(transaction.outputs && transaction.outputs[voutindex]){
						var txvout = transaction.outputs[voutindex]
						if(txvout.satoshis===100000000000 &&
							txvout.spentTxId===undefined &&
							txvout.spentHeight===undefined &&
							txvout.spentIndex===undefined){
								mn.valid = true;
								res.jsonp(mn)
						}else{
								res.jsonp(mn)
						}
					}
			});
		}
	})
};

MasternodeController.prototype.getMNListEnabled = function(callback) {
	this.node.services.sparksd.getMNList(function(err, result){
		var MNList = result || [];
		var i = 0;

		for ( i in MNList) {
			if (MNList[i].status  !== "ENABLED" ) {
				delete MNList[i];
			}
		}

		if (err) {
			return callback(err);
		}
		callback(null,MNList);
	});
};

MasternodeController.prototype.getMNListNewStart = function(callback) {
	this.node.services.sparksd.getMNList(function(err, result){
		var MNList = result || [];
		var i = 0;

		for ( i in MNList) {
			if (MNList[i].status  !== "NEW_START_REQUIRED" ) {
				delete MNList[i];
			}
		}

		if (err) {
			return callback(err);
		}
		callback(null,MNList);
	});
};

MasternodeController.prototype.getMNListWatchDog = function(callback) {
	this.node.services.sparksd.getMNList(function(err, result){
		var MNList = result || [];
		var i = 0;

		for ( i in MNList) {
			if (MNList[i].status  !== "SENTINEL_PING_EXPIRED" ) {
				delete MNList[i];
			}
		}

		if (err) {
			return callback(err);
		}
		callback(null,MNList);
	});
};



MasternodeController.prototype.getMNListSum = function(callback) {
	this.node.services.sparksd.getMNList(function(err, result){
		var MNList = result || [];
		var i = 0;
		var mn_enabled = 0;
		var mn_newstart = 0;
		var mn_watchdog = 0;
		var mn_unknown = 0;

		for ( i in MNList) {
			switch (MNList[i].status) {
				case "ENABLED":
					mn_enabled = ++mn_enabled;
					break;
				case "SENTINEL_PING_EXPIRED":
					mn_watchdog = ++mn_watchdog;
					break;
				case "NEW_START_REQUIRED":
					mn_newstart = ++mn_newstart;
					break;
				default:
					mn_unknown = ++mn_unknown;
					break;
			}
		}

		var result = {
			enabled: mn_enabled,
			restart: mn_newstart,
			watchdog: mn_watchdog,
			unknown: mn_unknown
		  };

		if (err) {
			return callback(err);
		}
		callback(null,result);
	});
};

MasternodeController.prototype.getMNList = function(callback) {
	this.node.services.sparksd.getMNList(function(err, result){
		var MNList = result || [];
		if (err) {
			return callback(err);
		}
		callback(null,MNList);
	});
};

module.exports = MasternodeController;
