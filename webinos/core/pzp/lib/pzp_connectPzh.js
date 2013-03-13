
/**
 * Connects with PZH and handle respective events
 */
var PzpOtherManager = require("./pzp_otherManager.js");

var PzpConnectHub = function () {
    "use strict";
    PzpOtherManager.call(this);
    var PzpCommon       = require("./pzp.js");
    var PzpObject = this;
    var logger = PzpCommon.wUtil.webinosLogging (__filename) || console;

    /**
     * If PZP fails to connect to PZH, this tries to connect back to PZH
     */
    function retryConnecting () {
        if (PzpObject.getEnrolledStatus()) {
            setTimeout (function () {
                PzpObject.connectHub(function (status) {
                    logger.log ("retrying to connect back to the PZH " + (status ? "successful" : "failed"));
                });
            }, 60000);//increase time limit to suggest when it should retry connecting back to the PZH
        }
    }
    /**
     *
     * @param callback
     */
    this.connectHub = function (callback) {
        var pzpClient;
        try {
            PzpObject.setConnectionParameters(function (status, certificateConfiguration) {
                pzpClient = PzpCommon.tls.connect(PzpObject.getPorts().provider,
                    PzpObject.getServerAddress(),
                    certificateConfiguration, function() {
                    logger.log ("connection to pzh status: " + pzpClient.authorized);
                    if (pzpClient.authorized) {
                        PzpObject.handlePzhAuthentication(pzpClient, callback);
                    } else {
                        PzpObject.unAuthentication(pzpClient);
                        callback(false);
                    }
                });
                pzpClient.setTimeout(100);

                pzpClient.on ("data", function (buffer) {
                    PzpObject.handleMsg(pzpClient, buffer);
                });

                pzpClient.on ("close", function(had_error) {
                    if(had_error) {
                        logger.log("transmission error lead to disconnect");
                    }
                });
                pzpClient.on ("end", function() {
                    if (pzpClient.id) PzpObject.cleanUp(pzpClient.id);
                    retryConnecting();
                });

                pzpClient.on ("error", function(err) {
                    PzpObject.handlePzpError(err);
                });
            });
        } catch (err) {
            logger.error ("Connecting Personal Zone Hub Failed : " + err);
        }
    }
};

require("util").inherits(PzpConnectHub, PzpOtherManager);
module.exports = PzpConnectHub;