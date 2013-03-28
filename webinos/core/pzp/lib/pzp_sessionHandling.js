﻿/*******************************************************************************
 *  Code contributed to the webinos project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Copyright 2012 - 2013 Samsung Electronics (UK) Ltd
 * Copyright 2011 Alexander Futasz, Fraunhofer FOKUS
 * AUTHORS: Habib Virji (habib.virji@samsung.com), Alexander Futasz, Ziran Sun(ziran.sun@samsung.com)
 *******************************************************************************/
var PzpWebSocket = require("./pzp_websocket.js");
function Pzp(inputConfig) {
    "use strict";
    PzpWebSocket.call(this);
    var PzpCommon = require("./pzp.js");
    var logger = PzpCommon.wUtil.webinosLogging(__filename) || console;
    var PzpObject = this, hub, stateListeners = [], config = {};
    var pzpState = {  // Dynamic state of PZP
        enrolled    :false,
        state       :{"hub":"not_connected", "peer":"not_connected"}, // State is applicable for hub mode but for peer mode, we need to check individually
        connectedPzp:{}, // Stores PZH server details
        connectedPzh:{}, // Stores connected PZP information directly to PZP
        sessionId   :"", // In virgin mode it is device name, if enrolled it is of from pzhId/deviceName
        connectedDevicesToPzh: {pzp:{}, pzh: {} } }; //Stores information about device connected to PZH but not to PZP.

    // Helper functions
    /**
     * Checks current status of certificate present and set hub or virgin mode accordingly
     */
    function checkMode () {
        // Check if it is virgin mode
        if (config && (config.cert.internal.master.cert && config.metaData.pzhId)) {
            pzpState.enrolled = true; // Hub mode
        } else {
            pzpState.mode = false; // Virgin mode
        }
    }

    /**
     * Listener to update WRT about PZP state change
     * @param listener -
     */
    this.addStateListener = function (listener) {
        if (listener) {
            if (typeof listener.setHubConnected !== "function") {
                listener.setHubConnected = function(isConnected) {};
            }
            if (typeof listener.setPeerConnected !== "function") {
                listener.setPeerConnected = function(isConnected) {};
            }
            stateListeners.push(listener);

            // communicate current state
            listener.setHubConnected(pzpState.state["hub"] === "connected");
            listener.setPeerConnected(pzpState.state["peer"] === "connected");
        }
    };

    /**
     *
     * @param mode
     * @param isConnected
     */
    this.setConnectState = function (mode, isConnected) {
        pzpState.state[mode] = (isConnected ? "connected" : "not_connected");
        stateListeners.forEach(function(listener) {
            if (mode === "hub") {
                listener.setHubConnected(isConnected);
            } else if (mode === "peer") {
                listener.setPeerConnected(isConnected);
            }
        });
    };
    /**
     * Changes friendly name of the PZP
     * @param {String} name - PZP friendly name intended to be changed
     */
    this.setFriendlyName = function(name) {
        if (!name) PzpObject.emit("PARAM_MISSING","Name to change PZP friendly name is missing");
        if (name) {
            config.metaData.friendlyName = name;
            config.storeDetails(null, "metaData", config.metaData);
            PzpObject.sendUpdateToAll();
        }
    };
    /**
     * Returns device friendly name
     * @return {String} friendlyName - Device current friendly name
     */
    this.getFriendlyName = function() {
        return config.metaData.friendlyName;
    };
    /**
     * Sets webinos pzp sessionId
     */
    this.setSessionId = function () {
        pzpState.sessionId = config.metaData.webinosName;
        if (pzpState.enrolled) {
            if (config.metaData.pzhAssignedId) {
                pzpState.sessionId = config.metaData.pzhId + "/" + config.metaData.pzhAssignedId;
            } else {
                pzpState.sessionId = config.metaData.pzhId + "/" + config.metaData.webinosName;
            }
        }
        logger.addId (config.metaData.webinosName);
    };
    /**
     * Returns device session id
     * @return {String} sessionId - current sessionId of the device
     */
    this.getSessionId = function () {
        return pzpState.sessionId;
    };

    /**
     *
     * @param id
     */
    this.setPzhId = function (id) {
        config.metaData.pzhId =  id;
    };

    /**
     *
     * @return {*}
     */
    this.getPzhId = function () {
        return config.metaData.pzhId;
    };

    /**
     *
     * @param value
     */
    this.setExternalCertificate = function(value){
        config.exCertList.exPZP = value;
    };

    /**
     *
     * @return {*}
     */
    this.getExternalCertificate = function(){
        return config.exCertList.exPZP;
    };

    /**
     *
     * @param clientSessionId
     * @param conn
     */
    this.setConnectedPzp = function(clientSessionId, conn) {
        if (clientSessionId && conn) {
            // If PZP with same id is already connected, disconnect socket
            if (pzpState.connectedPzp.hasOwnProperty(clientSessionId)) {
                pzpState.connectedPzp[clientSessionId].socket.end();
            }
            pzpState.connectedPzp[clientSessionId] = conn;
            conn.id = clientSessionId;
        } else {
            PzpObject.emit("PARAM_MISSING", "Parameters missing");
        }
    };
    /**
     *
     * @return {*}
     */
    this.getConnectedPzp = function() {
        return pzpState.connectedPzp;
    };
    /**
     *
     * @return {*}
     */
    this.getConnectedPzh = function() {
        return pzpState.connectedPzh;
    };

    /**
     *
     * @return {*}
     */
    this.getState = function(){
        return pzpState.state;
    };

    /**
     *
     * @return {Boolean}
     */
    this.getEnrolledStatus = function(){
        return pzpState.enrolled;
    };

    /**
     *
     * @return {*}
     */
    this.getPzhConnectedDevices = function() {
        return pzpState.connectedDevicesToPzh;
    };

    /**
     *
     * @return {*}
     */
    this.getConnectPeerAddress = function() {
        return pzpState.connectingPeerAddr;
    };

    /**
     *
     * @return {*}
     */
    this.getServerAddress = function() {
        return config.metaData.serverName;
    };
    /**
     *
     * @return {*}
     */
    this.getPorts = function() {
        return config.userPref.ports;
    };
    /**
     *
     * @return {*}
     */
    this.getWebinosVersion = function() {
        return config.metaData.webinos_version;
    };
    /**
     *
     * @return {*}
     */
    this.getDeviceName = function() {
        return config.metaData && config.metaData.webinosName;
    };
    /**
     *
     * @return {*}
     */
    this.getServiceCache = function() {
        return config.serviceCache;
    };
    /**
     *
     * @return {*}
     */
    this.getWebinosPath = function() {
        return config.metaData && config.metaData.webinosRoot ;
    };
    /**
     *
     * @return {*}
     */
    this.getCertificateToBeSignedByPzh = function() {
        return config.cert.internal.master.csr;
    };


    /**
     *
     * @param clientSessionId
     * @param conn
     */
    this.handlePeerAuthorization = function(clientSessionId, conn) {
        logger.log ("authorized & connected to PZP: " + clientSessionId);
        PzpObject.setConnectedPzp(clientSessionId, conn);
        PzpObject.setConnectState("peer", true);
        conn.id = clientSessionId;

        var msg = PzpObject.messageHandler.registerSender(PzpObject.getSessionId(), clientSessionId);
        PzpObject.sendMessage (msg, clientSessionId);
        PzpObject.sendUpdateToAll();
        PzpObject.connectedApp();

    };

    /**
     * PZH connected details are stored in this function
     * @param conn - connection object of the tls client
     * @param callback - returns true or false depending on the PZH connected status
     */
    this.handlePzhAuthentication = function(conn, callback) {
        if (!pzpState.connectedPzh.hasOwnProperty(pzpState.sessionId)) {
            pzpState.connectedPzh[config.metaData.pzhId] = conn;
            PzpObject.setSessionId();
            PzpObject.setConnectState("hub", true);
            conn.id = config.metaData.pzhId;
            PzpObject.sendUpdateToAll();
            PzpObject.connectedApp();//updates webinos clients
            PzpObject.startServer();
            PzpObject.startOtherManagers();
            if (callback) callback (true, "pzp " + pzpState.sessionId + " connected to " + config.metaData.pzhId);
        } else {
            if (callback) callback (false, "pzh already connected");
        }
    };

    /**
     * @param conn - Socket connection object of the PZH
     */
    this.unAuthentication = function(conn) {
        logger.error("not authenticated " + conn.authorizationError);
        conn.socket.end();
        if (conn.authorizationError === 'CERT_NOT_YET_VALID') {
            throw "possible clock difference between PZH and your PZP, try updating time and try again";
        } else {
            throw conn.authorizationError;
        }
    };
    /**
     * Sets TLS connection parameters
     */
    this.setConnectionParameters = function () {
        try {
            var privateKey;
            if ((privateKey = config.keyStore.fetchKey(config.cert.internal.conn.key_id))) {
                var caList = [], crlList = [], key;
                if (pzpState.enrolled) caList.push(config.cert.internal.pzh.cert);
                else caList.push(config.cert.internal.master.cert);
                crlList.push(config.cert.crl.value );

                for ( key in config.cert.external) {
                    if(config.cert.external.hasOwnProperty(key)) {
                        caList.push(config.cert.external[key].cert);
                        crlList.push(config.cert.external[key].crl);
                    }
                }
                return  {
                    key : privateKey,
                    cert: config.cert.internal.conn.cert,
                    crl : crlList,
                    ca  : caList,
                    servername: config.metaData.pzhId || config.metaData.serverName,
                    rejectUnauthorized: true,
                    requestCert: true
                };
            }
        } catch(err) {
            PzpObject.emit("EXCEPTION", new Error("Failed Setting TLS Connection Parameters"), err);
        }
    };

    /**
     * Prepares webinos internal message to be sent between webinos endpoints
     * @param {String} to - address of the entity message is being sent
     * @param {String} status - webinos specific command
     * @param {String/Object} message - message payload
     */
    this.prepMsg = function (to, status, message) {
        if (!message) {
            message = status;
            status = to;
            to = config.metaData.pzhId;
        }
        var msg = {"type":"prop",
            "from"       :pzpState.sessionId,
            "to"         :to,
            "payload"    :{"status":status,
                "message"          :message}};
        PzpObject.sendMessage (msg, to);
    };

    /**
     * Sends message to either PZH or PZP or Apps
     * @param {Object} message - message to be sent to other entity
     * @param {String} address - destination address
     */
    this.sendMessage = function (message, address) {
        if (message && address) {
            var jsonString = JSON.stringify (message);
            var buf = PzpCommon.wUtil.webinosMsgProcessing.jsonStr2Buffer (jsonString);
            if (pzpState.connectedPzp.hasOwnProperty (address)
                && pzpState.state["peer"] === "connected") {
                try {
                    pzpState.connectedPzp[address].pause ();
                    pzpState.connectedPzp[address].write (buf);
                } catch (err) {
                    PzpObject.emit("EXCEPTION","exception in sending message to pzp",err);
                } finally {
                    logger.log ('send to pzp - ' + address + ' message ' + jsonString);
                    pzpState.connectedPzp[address].resume ();
                }
            } else if (pzpState.connectedPzh.hasOwnProperty (address)
                && pzpState.enrolled && pzpState.state["hub"] === "connected") {
                try {
                    pzpState.connectedPzh[address].pause();
                    pzpState.connectedPzh[address].write(buf);
                } catch (err) {
                    PzpObject.emit("EXCEPTION","exception in sending message to pzh",err);
                } finally {
                    logger.log ('send to hub - ' + address + ' message ' + jsonString);
                    pzpState.connectedPzh[address].resume ();
                }
            } else { // sending to the app
                PzpObject.sendConnectedApp(address, message);
            }
        } else {
            PzpObject.emit("PARAM_MISSING", "message or address field are missing");
        }
    };

    /**
     *
     * @param command
     * @param payload
     */
    this.sendMessageAll = function (command, payload) {
        var key;
        for (key in pzpState.connectedPzp) {
            if (pzpState.connectedPzp.hasOwnProperty (key)) PzpObject.prepMsg(key, command, payload);
        }

        for (key in pzpState.connectedPzh) {
            if (pzpState.connectedPzh.hasOwnProperty (key)) PzpObject.prepMsg(key, command, payload);
        }
    };

    /**
     *
     */
    this.sendUpdateToAll = function() {
        function getConnectedList(type) {
            var connList=[],key, list = (type === "pzp") ? pzpState.connectedPzp: pzpState.connectedPzh;
            for (key in list) {
                if (list.hasOwnProperty(key)) {
                    connList.push({friendlyName: list[key].friendlyName, key: key});
                }
            }
            return connList;
        }
        var key,msg, payload = {friendlyName: config.metaData.friendlyName,
            connectedPzp: getConnectedList("pzp"),
            connectedPzh: getConnectedList("pzh")};
        for (key in pzpState.connectedPzp) {
            if (pzpState.connectedPzp.hasOwnProperty(key)) {
                PzpObject.prepMsg(key, "update", payload);
            }
        }
        if (pzpState.enrolled) {
            PzpObject.prepMsg(config.metaData.pzhId, "update", payload);
        }
    };

    /**
     *
     * @param conn
     * @param buffer
     */
    this.handleMsg=function (conn, buffer) {
        try {
            conn.pause (); // This pauses socket, cannot receive messages
            PzpCommon.wUtil.webinosMsgProcessing.readJson(PzpObject, buffer, function (obj) {
                PzpObject.processMsg(obj);
            });
        } catch (err) {
            PzpObject.emit("EXCEPTION", "failed in processing message received", err);
        } finally {
            conn.resume ();// unlocks socket.
        }
    };

    /**
     * Removes pzp or pzh from the connected list and then updatesApp to update status about connection status
     * @param_ id - identity of the PZP or PZH disconnected
     */
    this.cleanUp = function (_id) {
        var key;
        if (_id) {
            PzpObject.messageHandler.removeRoute (_id, pzpState.sessionId);
            for (key in pzpState.connectedPzp) {
                if (pzpState.connectedPzp.hasOwnProperty (key) && key === _id) {
                    logger.log ("pzp - " + key + " details removed");
                    if (Object.keys (pzpState.connectedPzp) <= 1) PzpObject.setConnectState("peer", false);
                    delete pzpState.connectedPzp[key];
                }
            }
            if ((Object.keys(pzpState.connectedPzh)).length > 1)  PzpObject.pzhDisconnected();
            for (key in pzpState.connectedPzh) {
                if (pzpState.connectedPzh.hasOwnProperty (key) && key === _id) {
                    logger.log ("pzh - " + key + " details removed");
                    PzpObject.setConnectState("hub", false);
                    delete pzpState.connectedPzh[key];
                }
            }
            PzpObject.sendUpdateToAll();
            PzpObject.connectedApp();
        }
    };

    /**
     *
     */
    this.unRegisterDevice = function() {
        // Delete all important folders that makes it a PZP
        var filePath, key;
        logger.log("PZP configuration is being reset");
        config.fileList.forEach (function (name) {
            if (!name.fileName) name.fileName = config.metaData.webinosName;
            filePath = PzpCommon.path.join(config.metaData.webinosRoot, name.folderName, name.fileName+".json");
            logger.log("PZP Reset - " + filePath);
            PzpCommon.fs.unlink(filePath);
        });

        if ((Object.keys(pzpState.connectedPzh)).length > 1)  PzpObject.pzhDisconnected();
        // Disconnect existing connections
        for (key in pzpState.connectedPzp) {
            if (pzpState.connectedPzp.hasOwnProperty (key)) {
                delete pzpState.connectedPzp[key];
                PzpObject.messageHandler.removeRoute(key, pzpState.sessionId);
            }
        }
        for (key in pzpState.connectedPzh) {
            if (pzpState.connectedPzh.hasOwnProperty (key)) {
                delete pzpState.connectedPzh[key];
                PzpObject.setConnectState("hub", false);
            }
        }
        // Restart PZP configuration , not the PZP WebServer...
        var inputConfig = {
            pzhHost: '0.0.0.0',
            pzhName: '',
            friendlyName: '',
            forcedDeviceName: '',
            sessionIdentity: '0.0.0.0'
        };
        PzpCommon.wUtil.webinosHostname.getHostName(inputConfig.sessionIdentity, function (hostname) {
            inputConfig.sessionIdentity = hostname;
            config = new PzpCommon.wUtil.webinosConfiguration ("Pzp", inputConfig);// sets configuration
            config.setConfiguration (function (status) {
                if (status) {
                    pzpState.enrolled  = false;
                    pzpState.sessionId = config.metaData.webinosName;
                    PzpObject.setupMessage_RPCHandler();
                    PzpObject.connectedApp();
                }
            });
        });
    };

    /**
     * EnrollPZP stores signed certificate information from the PZH and then triggers connectHub function
     * @param from - Contains PZH Id
     * @param to - Contains PZP Id
     * @param payload - Signed PZP certificate from the PZH, master certificate and CRL
     */
    this.registerDevice = function (from, to, payload) {
        logger.log ("PZP ENROLLED AT  " + from);    // This message come from PZH web server over websocket
        config.cert.internal.master.cert = payload.clientCert;
        config.cert.internal.pzh.cert    = payload.masterCert;
        config.cert.crl.value            = payload.masterCrl;
        config.metaData.pzhId            = from;
        config.metaData.serverName       = from && from.split ("_")[0];
        // Same PZP name existed in PZ, PZH has assigned a new id to the PZP.
        if ((to.split("/") && to.split("/")[1])!== config.metaData.webinosName) {
            config.metaData.pzhAssignedId = to.split("/")[1];
        }
        config.generateSignedCertificate(config.cert.internal.conn.csr, function(status, signedCert) {
            if(status) {
                logger.log("connection signed certificate by PZP");
                config.cert.internal.conn.cert = signedCert;

                if (from.indexOf (":") !== -1) {
                    config.metaData.serverName = config.metaData.serverName.split (":")[0];
                }

                if (!config.trustedList.pzh.hasOwnProperty (config.metaData.pzhId)) {
                    config.trustedList.pzh[config.metaData.pzhId] = {"addr":"", "port":""};
                }
                config.storeDetails(null, "metaData", config.metaData);
                config.storeDetails(null, "crl", config.crl);
                config.storeDetails(null, "trustedList", config.trustedList);
                config.storeDetails(require("path").join("certificates", "internal"), "certificates", config.cert.internal);
                pzpState.enrolled = true; // Moved from Virgin mode to hub mode

                PzpObject.connectHub();
            }
        });
    };

    /**
     * Initializes PZP WebSocket Server and then tries connecting with the PZH hub
     * Starting PZP means starting web socket server
     */
    function initializePzp() {
        try {
            PzpCommon.wUtil.webinosHostname.getHostName(inputConfig.sessionIdentity, function (hostname) {
                inputConfig.sessionIdentity = hostname;
                config = new PzpCommon.wUtil.webinosConfiguration("Pzp", inputConfig);// sets configuration
                if(config.createOrLoadWebinosConfiguration()){
                    checkMode();   //virgin or hub mode
                    PzpObject.setSessionId();//sets pzp sessionId
                    PzpObject.startWebSocketServer();
                }
                config.on("FUNC_ERROR", function(err, errMsg){
                    PzpObject.emit("FUNC_ERROR", err, errMsg);
                });
                config.on("EXCEPTION", function(err, errMsg){
                    PzpObject.emit("EXCEPTION", err, errMsg);
                });
                config.on("WRITE", function(err, errMsg){
                    PzpObject.emit("WRITE", err, errMsg);
                });
                config.on("READ", function(err, errMsg){
                    PzpObject.emit("READ", err, errMsg);
                });
                config.on("CLEANUP", function(err, errMsg){
                    PzpObject.emit("CLEANUP", err, errMsg);
                });
            });
        } catch (err) {
            PzpObject.emit("EXCEPTION", "failed starting PZP", err);
        }
    }
    PzpObject.on("FUNC_ERROR", function(err, errMsg){
        console.log("FUNC_ERROR");
        console.log(err);
        console.log(errMsg);
    });
    PzpObject.on("EXCEPTION", function(err, errMsg){
        console.log("EXCEPTION");
        console.log(err);
        console.log(errMsg);
        var error = new Error ();
        console.log( error.stack);
    });
    PzpObject.on("WRITE", function(err, errMsg){
        console.log("WRITE");
        console.log(err);
        console.log(errMsg);
    });
    PzpObject.on("READ", function(err, errMsg){
        console.log("READ");
        console.log(err);
        console.log(errMsg);

    });
    PzpObject.on("CLEANUP", function(err, errMsg){
        console.log("READ");
        console.log(err);
        console.log(errMsg);

    });
    PzpObject.on("WSS_Started", function(){
        PzpObject.initializeRPC_Message(); // Initializes RPC & load default module
        if (PzpObject.getEnrolledStatus()) {
            PzpObject.connectHub();
        } else {
            PzpObject.setupMessage_RPCHandler ();
            logger.log("Pzp is in virgin mode and successfully started pzp WebSocket server");
            PzpObject.emit("PZP_STARTED");
        }
    });
    process.on("exit", function(){

    });
    initializePzp();
}

require("util").inherits(Pzp, PzpWebSocket);
Pzp.prototype.__proto__ = require("events").EventEmitter.prototype;
var PzpAPI = exports;
PzpAPI.setInputConfig = function(inputConfig) {
    PzpAPI.inputConfig = inputConfig;
};
PzpAPI.getInstance = function() {
    if (!PzpAPI.inputConfig) {
        console.log("Missing inputConfig parameters");
        return null;
    }
    if (!PzpAPI.pzpInstance) {
        PzpAPI.pzpInstance = new Pzp(PzpAPI.inputConfig);
    }
    return PzpAPI.pzpInstance;
};

PzpAPI.getSessionId = function() {
    return (PzpAPI.getInstance()).getSessionId();
};
PzpAPI.getDeviceName = function() {
    return (PzpAPI.getInstance()).getDeviceName();
};
PzpAPI.getWebinosPath = function() {
    return (PzpAPI.getInstance()).getWebinosPath();
};
PzpAPI.getWebinosPorts = function() {
    return (PzpAPI.getInstance()).getWebinosPorts();
};
