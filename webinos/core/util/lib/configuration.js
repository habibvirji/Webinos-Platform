/*******************************************************************************
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
* Author: Habib Virji (habib.virji@samsung.com)
*         Ziran Sun (ziran.sun@samsung.com)
*******************************************************************************/
var dependency = require ("find-dependencies") (__dirname);
var certificate = dependency.global.require (dependency.global.manager.certificate_manager.location);

/**
 * Creates a webinos configuration
 * - Creates default directories in .webinos or AppData/Roaming/webinos or /data/data/org.webinos.app
 * - Read webinos_config and separate them in different files
 * - Default certificates from client and master
 * @param {Object} inputConfig - These are command line parameters that are passed by PZH or PZP
 * @constructor
 */
function Config(webinosType, inputConfig) {
    "use strict";
    var path = require ("path");
    var fs = require ("fs");
    var logger = require("./logging.js") (__filename) || console;
    var wPath = require("./webinosPath.js");

    var CurrentContext = this;
    certificate.call(CurrentContext);
    CurrentContext.metaData={webinosType: webinosType};
    CurrentContext.trustedList={pzh:{}, pzp:{}};
    CurrentContext.untrustedCert={};
    CurrentContext.exCertList={};
    CurrentContext.crl={};
    CurrentContext.policies={};
    CurrentContext.userData={};
    CurrentContext.userPref={};
    CurrentContext.serviceCache=[];
    var existsSync = fs.existsSync || path.existsSync;

    CurrentContext.fileList = [{folderName: null, fileName: "metaData", object: CurrentContext.metaData},
        {folderName: null, fileName: "crl", object: CurrentContext.crl},
        {folderName: null, fileName:"trustedList", object: CurrentContext.trustedList},
        {folderName: null, fileName:"untrustedList", object: CurrentContext.untrustedCert},
        {folderName: null, fileName:"exCertList", object: CurrentContext.exCertList},
        {folderName: path.join("certificates", "internal"),fileName: "certificates", object: CurrentContext.cert.internal},
        {folderName: path.join("certificates", "external"),fileName: "certificates", object: CurrentContext.cert.external},
        {folderName:"userData", fileName: "userDetails", object: CurrentContext.userData},
        {folderName:"userData", fileName:"serviceCache", object: CurrentContext.serviceCache},
        {folderName:"userData", fileName:"userPref", object: CurrentContext.userPref}];

    /**
     * This function sets default value to make certificate and keystore run correctly
     * If user has modified default values, default values updated by this function will be overwritten
     */
    function setWebinosRoot() {
        var webinos_root =  (CurrentContext.metaData.webinosType.search("Pzh") !== -1)?
                            wPath.webinosPath()+"Pzh" :wPath.webinosPath();
        require("./webinosId.js").fetchWebinosName(webinosType, inputConfig, function (webinosName) {
            CurrentContext.metaData.webinosName = webinosName;
            CurrentContext.metaData.webinosRoot = (webinosType.search("Pzh") !== -1)?
                                                (webinos_root + "/" + webinosName): webinos_root;
            CurrentContext.metaData.serverName = (inputConfig && inputConfig.sessionIdentity) || "0.0.0.0";
        });
        // UserData should be present for certificate creation
        // Note this value will be overwritten if configuration exists
        var key, defaultCert = require("../../../../webinos_config.json");
        for(key in defaultCert.certConfiguration) {
            if (defaultCert.certConfiguration.hasOwnProperty(key)) CurrentContext.userData[key] = defaultCert.certConfiguration[key];
        }
    }

    setWebinosRoot(); // Need to run this by default
    /**
     * Store first time configuration details in above folder and files
     */
    function storeAll() {
        CurrentContext.fileList.forEach (function (name) {
            if (typeof name === "object") {
                if(name.folderName === "userData") {
                    if (name.fileName === "userDetails") {
                        name.object = CurrentContext.userData;
                    }
                    if (name.fileName === "serviceCache") {
                        name.object = CurrentContext.serviceCache;
                    }
                }
                CurrentContext.storeDetails(name.folderName, name.fileName, name.object);
            }
        });
    }
    /**
     * Changes user data if value set by passport module
     * Note this function is for use only with the PZH
     * @param {Object} user - value returned by passport node module
     * @param {Object} defaultCert - parameters read from webinos_config.json
     */
    function storeUserData(user, defaultCert){
        var key;
        CurrentContext.userData = {};
        for(key in defaultCert) {
            if (defaultCert.hasOwnProperty(key)) CurrentContext.userData[key] = defaultCert[key];
        }
        CurrentContext.userData.name = user.displayName;
        CurrentContext.userData.email = user.emails;
        CurrentContext.userData.authenticator = user.from;
        CurrentContext.userData.identifier = user.identifier;
    }
    /**
     * Creates default policy file it not present
     */
    function createPolicyFile() {
        // policy file
        fs.readFile(path.join (CurrentContext.metaData.webinosRoot, "policies", "policy.xml"), function (err) {
            if (err && err.code === "ENOENT") {
                var data;
                try {
                    data = fs.readFileSync (path.resolve (__dirname, "../../manager/policy_manager/defaultpolicy.xml"));
                }
                catch (e) {
                    logger.error ("Default policy not found");
                    data = "<policy combine=\"first-applicable\" description=\"denyall\">\n<rule effect=\"deny\"></rule>\n</policy>";
                }
                fs.writeFileSync(path.join (CurrentContext.metaData.webinosRoot, "policies", "policy.xml"), data);
            }
        });
    }
    /**
     * Sets friendly name of the PZP.
     * @param [friendlyName=undefined] - Friendly if set via command line or via webinos_config.json
     */
    function setFriendlyName(friendlyName) {
        if(friendlyName) {
            CurrentContext.metaData.friendlyName = friendlyName;
        } else {
            var os = require("os");
            if (os.platform() && os.platform().toLowerCase() === "android" ){
                CurrentContext.metaData.friendlyName = "Mobile";
            } else if (process.platform === "win32") {
                CurrentContext.metaData.friendlyName = "Windows PC";
            } else if (process.platform === "darwin") {
                CurrentContext.metaData.friendlyName = "MacBook";
            } else if (process.platform === "linux" || process.platform === "freebsd") {
                CurrentContext.metaData.friendlyName = "Linux Device";
            } else {
                CurrentContext.metaData.friendlyName = "Webinos Device";// Add manually
            }
        }
    }
    // All these below functions are related to reading, writing and updating webinos_config.json\\
    /**
     * Helper function to compare two objects
     * @param {Object} objA - Object 1 to compare
     * @param {Object} objB - Object 2 to compare
     * @return {Boolean} true if both objects are equal or else false
     */
    function compareObjects(objA, objB){
        if (typeof objA !== "object" || typeof objB !== "object") {
            return false;
        }

        if ((Object.keys(objA)).length !== (Object.keys(objB)).length) {
            return false;
        }

        for (var i = 0; i < Object.keys(objA).length; i = i + 1) {
            if (objA[i] !== objB[i]){
                return false;
            }
        }

        return true;// both objects are equal
    }
    /**
     * Update webinos config if the service cache has changed..
     * @param {String} fileName - fileName (ServiceCache or userPref) that has been updated
     * @param {Object} config - updated configuration details
     */
    function writeFile(fileName, config, callback) {
        try {
            var filePath = path.resolve (__dirname, "../../../../webinos_config.json");
            fs.writeFileSync(filePath, JSON.stringify(config, null, "  "));
            logger.log("updated webinos config with details related to "+ fileName);
            if(callback) callback(true);
        } catch (err) {
            if(callback) callback(false, {"Component": "WebinosConfiguration","Type": "EXCEPTION", "Error": err,
                "Message": "webinos_config write failed"});
        }
    }
    /**
     * Updates webinos config regarding service cache and user ports
     * @param {String} fileName - file that has been changed
     */
    function updateWebinosConfig(fileName, callback) {
        try {
            var filePath = path.resolve (__dirname, "../../../../webinos_config.json");
            var config = require(filePath);
            if (fileName === "serviceCache") {
               if (CurrentContext.metaData.webinosType === "Pzh" &&
                   config.pzhDefaultServices.length !== CurrentContext.serviceCache.length) {
                   config.pzhDefaultServices = CurrentContext.serviceCache;
               } else if (CurrentContext.metaData.webinosType === "Pzp" &&
                          config.pzpDefaultServices.length !== CurrentContext.serviceCache.length) {
                   config.pzpDefaultServices = CurrentContext.serviceCache;
               }
               writeFile(fileName, config, callback);
            } else if (fileName === "userPref" && !compareObjects(config.ports, CurrentContext.userPref.ports)) {
                config.ports = CurrentContext.userPref.ports;
                writeFile(fileName, config, callback);
            }
        } catch(err) {
            if(callback) callback(false, {"Component": "WebinosConfiguration","Type": "EXCEPTION", "Error": err,
                "Message": "webinos_config update failed"});
        }
    }
    /**
     * Reads webinos_config values every time PZP is restarted.
     * This can reset values based on webinos_config,json for ports, webinos_version and serviceCache
     */
    function checkDefaultValues(callback) {
        try {
            var filePath = path.resolve (__dirname, "../../../../webinos_config.json");
            var config = require(filePath), key;
            if (!compareObjects(config.webinos_version, CurrentContext.metaData.webinos_version)) {
                CurrentContext.metaData.webinos_version = config.webinos_version;
                CurrentContext.storeDetails(null, "metaData", CurrentContext.metaData);
            }
            if (!compareObjects(config.ports, CurrentContext.userPref.ports)) {
                CurrentContext.userPref.ports = config.ports;
                CurrentContext.storeDetails("userData", "userPref", CurrentContext.userPref);
            }
            if (CurrentContext.metaData.webinosType === "Pzh" && config.pzhDefaultServices.length !== CurrentContext.serviceCache.length) {
                CurrentContext.serviceCache = config.pzhDefaultServices;
                CurrentContext.storeDetails("userData", "serviceCache", CurrentContext.serviceCache);
            } else if (CurrentContext.metaData.webinosType === "Pzp" && config.pzpDefaultServices.length !== CurrentContext.serviceCache.length) {
                CurrentContext.serviceCache = config.pzpDefaultServices;
                CurrentContext.storeDetails("userData", "serviceCache", CurrentContext.serviceCache);
            }
            if (CurrentContext.metaData.webinosType === "Pzp" && config.friendlyName !== "") {
                setFriendlyName(config.friendlyName);
            }
        } catch(err) {
            if(callback)  callback(false, {"Component": "WebinosConfiguration","Type": "EXCEPTION", "Error": err,
                "Message": "webinos_config check update failed"});
        }
    }
    /**
     * Assigns values from webinos_config to different objects
     * Each object is separately cached and reloaded when webinos restarts
     * Functionality includes -
     * 1. UserPref - assign default ports that are needed for connectivity
     * 2. MetaData - stores device type, device name, friendly name, location of webinos directory, personal zone device belongs to and webinos_version
     * 3. Service cache - services that are loaded automatically when PZH or PZP starts
     * This function all creates default policy file
     * Note this function is intended to be run only when webinos config is missing or needs to be deleted.
     * @param {Function} callback - returns true if the configuration is set or else false if directory creation failed or if an exception occurred
     */
    function fetchDefaultWebinosConfiguration(callback) {
        try {
            var filePath = path.resolve (__dirname, "../../../../webinos_config.json"), webinos_root;
            if (createDefaultDirectories(CurrentContext.metaData.webinosType)) {
                logger.log ("created default webinos directories at location : " + CurrentContext.metaData.webinosRoot);
                var defaultConfig = require(filePath);
                CurrentContext.metaData.webinos_version = defaultConfig.webinos_version;
                CurrentContext.userPref.ports = defaultConfig.ports;
                CurrentContext.userData = defaultConfig.certConfiguration;
                if(inputConfig && inputConfig.user)  storeUserData(inputConfig.user, defaultConfig.certConfiguration);
                setFriendlyName((inputConfig && inputConfig.friendlyName) || defaultConfig.friendlyName);
                if (CurrentContext.metaData.webinosType === "Pzh" || CurrentContext.metaData.webinosType === "PzhCA") {
                    CurrentContext.serviceCache = defaultConfig.pzhDefaultServices.slice(0);
                    CurrentContext.metaData.friendlyName = CurrentContext.userData.name +" ("+ CurrentContext.userData.authenticator + ")";
                } else if (CurrentContext.metaData.webinosType === "Pzp" || CurrentContext.metaData.webinosType === "PzpCA") {
                    CurrentContext.serviceCache = defaultConfig.pzpDefaultServices.slice(0);
                }
                createPolicyFile();
                storeAll();
                if(callback) callback (true);
            } else {
                if(callback) callback (false, {"Component": "WebinosConfiguration","Type": "FUNC_ERROR", "Error": err,
                    "Message": "webinos default directory creation failed"});
            }
        } catch (err){
            if(callback) callback (false, {"Component": "WebinosConfiguration","Type": "EXCEPTION", "Error": err,
                "Message": "webinos fetching default configuration failed"});
        }
    }
    //End of webinos_config.json read, write or update functionality\\
    /**
     * Creates default webinos default directories
     * Permission restricts person who created file to read/write file, other users can read file
     * @return {Boolean} true if successful in creating all directories or else
     */
    function createDefaultDirectories() {
        try {
            var permission = "0744";
            var webinos_root =  (CurrentContext.metaData.webinosType.search("Pzh") !== -1)?
                                wPath.webinosPath()+"Pzh" :wPath.webinosPath();
            //If the main folder doesn't exist
            if (!existsSync (webinos_root)) {
                fs.mkdirSync (webinos_root, permission);
            }
            // If the user folder does not exist in webinosPzh.
            if (CurrentContext.metaData.webinosType.search("Pzh") !== -1 &&
            !existsSync (CurrentContext.metaData.webinosRoot)){
                fs.mkdirSync (CurrentContext.metaData.webinosRoot, permission);
            }
            // webinos root was created, we need the following 1st level dirs
            var list = [ path.join (CurrentContext.metaData.webinosRoot, "logs"),
                path.join (webinos_root, "wrt"),
                path.join (CurrentContext.metaData.webinosRoot, "certificates"),
                path.join (CurrentContext.metaData.webinosRoot, "policies"),
                path.join (CurrentContext.metaData.webinosRoot, "wrt"),
                path.join (CurrentContext.metaData.webinosRoot, "userData"),
                path.join (CurrentContext.metaData.webinosRoot, "keys"),
                path.join (CurrentContext.metaData.webinosRoot, "certificates", "external"),
                path.join (CurrentContext.metaData.webinosRoot, "certificates", "internal")];
            list.forEach (function (name) {
                if (!existsSync (name)) fs.mkdirSync (name, permission);
            });
            // Notify that we are done
            return true;
        } catch (err) {
            logger.error("Failed in creating default webinos directories - " + require("util").inspect(err));
            return false;
        }
    }
    /**
     * Creates a new configuration if not present
     * 1. It read (webinos_config.json) and sets default configuration
     * 2. Creates 2 set of certificates - master and connection
     * 3. Connection certificate is then signed by master certificate
     * 4. All certificates are stored in certificate/internal directory
     * @param {Function} callback - true if configuration creation was successful or false if configuration failed
     */
    function createNewConfiguration (callback) {
        try {
            fetchDefaultWebinosConfiguration(function (status, errMsg) {
                if (status) {
                    var cn = CurrentContext.metaData.webinosType + "CA:" + CurrentContext.metaData.webinosName;
                    CurrentContext.generateCurrentContextSignedCertificate (CurrentContext.metaData.webinosType+"CA", cn,
                    function (status, value) {
                        if (!status) {
                            if (callback) callback (false, value); // value is set in generateCurrentContextSignedCertificate
                        } else {
                            logger.log ("*****master certificate generated*****");
                            cn = CurrentContext.metaData.webinosType + ":" + CurrentContext.metaData.webinosName;
                            CurrentContext.generateCurrentContextSignedCertificate (CurrentContext.metaData.webinosType,
                            cn, function (status, csr) { // Master Certificate
                                if (status) {
                                    logger.log ("*****connection certificate generated*****");
                                    CurrentContext.generateSignedCertificate(csr, function (status, signedCert) {
                                        if (status) {
                                            logger.log ("*****connection certificate signed by master certificate*****");
                                            CurrentContext.cert.internal.conn.cert = signedCert;
                                            CurrentContext.storeDetails(path.join("certificates", "internal"),
                                            "certificates", CurrentContext.cert.internal);
                                            CurrentContext.storeDetails(null, "crl", CurrentContext.crl);
                                            if (callback) callback(true);
                                        } else {
                                            if (callback) callback(false, signedCert);//signedCert is a error set in generateSignedCertificate
                                        }
                                    });
                                } else {
                                    if (callback) callback (false, csr);// csr is set in generateCurrentContextSignedCertificate
                                }
                            });
                        }
                    });
                } else {
                    if (callback) callback (false, errMsg);
                }
            });
        } catch (err) {
            if (callback) callback (false, {"Component": "WebinosConfiguration","Type": "EXCEPTION", "Error": err,
                "Message": "webinos new configuration setting failed"});
        }
    }
    /**
     * This should be presumably the first function to check if webinos is pre-enrolled
     * Checks whether webinos configuration exists or else a new configuration is needed to be loaded
     * @param {Function} callback - Returns true if configuration exists or false if configuration does not exists or if exception occurs.
     */
    function checkConfigExists(callback) {
        try {
            var name, i;
            if (CurrentContext.metaData.webinosRoot) {
                for (i = 0; i < CurrentContext.fileList.length; i = i + 1) {
                    name = CurrentContext.fileList[i];
                    var fileName = (name.fileName !== null) ? (name.fileName+".json"):(webinosName +".json");
                    var filePath = path.join (CurrentContext.metaData.webinosRoot, name.folderName, fileName);
                    if( !existsSync(filePath)){
                        callback(false); // This triggers createNewConfiguration
                        return;
                    }
                }
                callback(true);
            } else {
                callback(false,{"Component": "WebinosConfiguration","Type": "FUNC_ERROR", "Error": err,
                    "Message": "setting webinos root failed"});
            }
        } catch (err) {
            callback(false, {"Component": "WebinosConfiguration","Type": "EXCEPTION", "Error": err,
                "Message": "checking of webinos configuration failed"});
        }
    }
    /**
     * This is a public function that gets triggered by PZH/PZP/PZHP
     * Create or Load webinos configuration
     * @param {Function} callback - to return status (true/false) and in case of error, error details
     */
    this.createOrLoadWebinosConfiguration = function(callback) {
        try {
            checkConfigExists(function(status, errMsg) {
                if(status) {
                    CurrentContext.fileList.forEach(function(name){
                        CurrentContext.fetchDetails(name.folderName, name.fileName, name.object);
                    });
                    checkDefaultValues(callback);
                    callback(true);
                } else if(errMsg){
                    callback(false, errMsg);
                } else {
                    createNewConfiguration(callback);
                }
            });
        } catch (err) {
            callback(false, {"Component": "WebinosConfiguration","Type": "EXCEPTION", "Error": err,
                "Message": "webinos configuration load/create failed"});
        }
    };
    /**
     * Used for storing key hash
     * @param {String} keys - private key to be stored
     * @param {String} name - name of the file
     */
    this.storeKeys = function (keys, name) {
        var filePath = path.join(CurrentContext.metaData.webinosRoot, "keys", name+".pem");
        try {
            fs.writeFileSync(path.resolve(filePath), keys);
            logger.log("saved " + name +".pem");
            //calling get hash
            // CurrentContext.getKeyHash(filePath);
            return true;
        } catch (err) {
            return false;
        }
    };
    /**
     * Stores webinos configuration in the webinos configuration default directory
     * @param {String} folderName -
     * @param {String} fileName
     * @param {Object} data - JSON object stored in the file
     * @param {Function} callback - returns callback with status true if saveor else false if it fails
     */
    this.storeDetails = function(folderName, fileName, data, callback) {
        var filePath = path.join (CurrentContext.metaData.webinosRoot, folderName, fileName+".json");
        try {
            if (typeof data === "object") {
                fs.writeFileSync(path.resolve(filePath), JSON.stringify (data, null, " "));
                logger.log ("webinos configuration stored in " + filePath);
                if (folderName === "userData") {
                    updateWebinosConfig(fileName, callback);
                } else if (callback) {
                    callback(true);
                }
            } else {
                if(callback) callback(false, {"Component": "WebinosConfiguration","Type": "WRITE", "Error": err,
                    "Message": "Data permitted to store should be an object"});
            }
        } catch(err) {
            if (callback) callback(false, {"Component": "WebinosConfiguration","Type": "EXCEPTION", "Error": err,
                "Message": "webinos configuration store in " + filePath+ " failed"});
        }
    };
    /**
     * Fetches webinos configuration data (JSON object) from the webinos configuration default directory
     * @param {String} folderName - folder inside webinos configuration specific directory
     * @param {String} fileName - name of the file from where to read configuration inside folderName
     * @param {Object} assignValue - value read is assigned in the passed object
     * @param {Function} callback - returns true if successful in reading else false
     */
    this.fetchDetails = function(folderName, fileName, assignValue, callback) {
        var filePath = path.join(CurrentContext.metaData.webinosRoot, folderName, fileName+".json");
        try {
            var data = fs.readFileSync(path.resolve(filePath));
            var dataString = data.toString();
            if (dataString !== "") {
                data = JSON.parse(dataString);
                for (var key in data) {
                    if (data.hasOwnProperty(key)) assignValue[key] = data[key];
                }
                return true;
            } else {
                if(callback) callback(false, {"Component": "WebinosConfiguration","Type": "READ", "Error": err,
                    "Message":  "webinos configuration data is empty in the file, considering it is corrupted"});
            }
        } catch(error) {
            if(callback) callback(false, {"Component": "WebinosConfiguration","Type": "EXCEPTION", "Error": err,
                "Message":  "webinos configuration data is corrupted considering it is corrupted"});
            logger.log("since webinos data is corrupted, it will not start correctly");
            logger.log("triggering webinos configuration again");
            createNewConfiguration(callback);
        }
    };
}

require("util").inherits (Config, certificate);
module.exports = Config;
