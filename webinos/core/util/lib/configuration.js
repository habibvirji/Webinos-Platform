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
/**
 * Creates a webinos configuration
 * - Creates default directories in .webinos or AppData/Roaming/webinos or /data/data/org.webinos.app
 * - Read webinos_config and separate them in different files
 * - Default certificates from client and master
 *@param {Object} inputConfig - These are command line parameters that are passed by PZH or PZP
 *@constructor
 */
function Config(webinosType, inputConfig) {
    "use strict";
    var path = require ("path");
    var fs = require ("fs");
    var dependency = require ("find-dependencies") (__dirname);
    var logger = require("./logging.js") (__filename) || console;
    var Certificate = dependency.global.require (dependency.global.manager.certificate_manager.location);
    var wPath = require("./webinosPath.js");
    var webinosConfigValue;
    var ConfigContext = this;
    var existsSync = fs.existsSync || path.existsSync;
    
    function initializeConfigContext() {
        ConfigContext.metaData={};
        ConfigContext.trustedList={pzh:{}, pzp:{}};
        ConfigContext.untrustedCert={};
        ConfigContext.exCertList={};
        ConfigContext.crl={};
        ConfigContext.policies={};
        ConfigContext.userData={};
        ConfigContext.userPref={};
        ConfigContext.serviceCache=[];        
        setWebinosMetaData();
    }
    /**
    * This function sets default value to make certificate and keystore run correctly
    * If user has modified default values, default values updated by this function will be overwritten
    */
    function setWebinosMetaData() {
        ConfigContext.metaData.webinosType = webinosType,
        var webinos_root =  (ConfigContext.metaData.webinosType.search("Pzh") !== -1)?
                            wPath.webinosPath()+"Pzh" :wPath.webinosPath();
        try {
            require("./webinosId.js").fetchWebinosName(webinosType, inputConfig, function (webinosName) {
                ConfigContext.metaData.webinosName = webinosName;
                ConfigContext.metaData.webinosRoot = (webinosType.search("Pzh") !== -1)?
                                                    (webinos_root + "/" + webinosName): webinos_root;
                ConfigContext.metaData.serverName = (inputConfig && inputConfig.sessionIdentity) || "0.0.0.0";
            });
        } catch(err) {
            ConfigContext.emit("EXCEPTION", "failed setting webinos id", err);
        }
        // UserData should be present for certificate creation
        // Note this value will be overwritten if configuration exists
        try {
            var key,
            webinosConfigValue = require("../../../../webinos_config.json");
            for(key in webinosConfigValue.certConfiguration) {
                if (webinosConfigValue.certConfiguration.hasOwnProperty(key)) 
                    ConfigContext.userData[key] = webinosConfigValue.certConfiguration[key];
            }
        } catch(err) {
            ConfigContext.emit("EXCEPTION", "failed reading webinos default configuration");
        }
        ConfigContext.cert = new Certificate(ConfigContext.metaData.webinosType, ConfigContext.metaData.webinosRoot, 
                                            ConfigContext.metaData.webinosName, ConfigContext.metaData.serverName);
        ConfigContext.fileList = [{folderName: null, fileName: "metaData", object: ConfigContext.metaData},
            {folderName: null, fileName: "crl", object: ConfigContext.crl},
            {folderName: null, fileName:"trustedList", object: ConfigContext.trustedList},
            {folderName: null, fileName:"untrustedList", object: ConfigContext.untrustedCert},
            {folderName: null, fileName:"exCertList", object: ConfigContext.exCertList},
            {folderName: path.join("certificates", "internal"),fileName: "certificates", object: ConfigContext.cert.internal},
            {folderName: path.join("certificates", "external"),fileName: "certificates", object: ConfigContext.cert.external},
            {folderName:"userData", fileName: "userDetails", object: ConfigContext.userData},
            {folderName:"userData", fileName:"serviceCache", object: ConfigContext.serviceCache},
            {folderName:"userData", fileName:"userPref", object: ConfigContext.userPref}];
    }    
    /**
     * Store first time configuration details in above folder and files
     */
    function storeAll() {
        ConfigContext.fileList.forEach (function (name) {
            if (typeof name === "object") {
                if(name.folderName === "userData") {
                    if (name.fileName === "userDetails") {
                        name.object = ConfigContext.userData;
                    }
                    if (name.fileName === "serviceCache") {
                        name.object = ConfigContext.serviceCache;
                    }
                }
                ConfigContext.storeDetails(name.folderName, name.fileName, name.object);
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
        ConfigContext.userData.name = user.displayName;
        ConfigContext.userData.email = user.emails;
        ConfigContext.userData.authenticator = user.from;
        ConfigContext.userData.identifier = user.identifier;
    }
    /**
     * Creates default policy file it not present
     */
    function createPolicyFile() {
        // policy file
        fs.readFile(path.join (ConfigContext.metaData.webinosRoot, "policies", "policy.xml"), function (err) {
            if (err && err.code === "ENOENT") {
                var data;
                try {
                    data = fs.readFileSync (path.resolve (__dirname, "../../manager/policy_manager/defaultpolicy.xml"));
                }
                catch (e) {
                    logger.error ("Default policy not found");
                    data = "<policy combine=\"first-applicable\" description=\"denyall\">\n<rule effect=\"deny\"></rule>\n</policy>";
                }
                fs.writeFileSync(path.join (ConfigContext.metaData.webinosRoot, "policies", "policy.xml"), data);
            }
        });
    }
    /**
     * Sets friendly name of the PZP.
     * @param [friendlyName=undefined] - Friendly if set via command line or via webinos_config.json
     */
    function setFriendlyName(friendlyName) {
        if(friendlyName) {
            ConfigContext.metaData.friendlyName = friendlyName;
        } else {
            var os = require("os");
            if (os.platform() && os.platform().toLowerCase() === "android" ){
                ConfigContext.metaData.friendlyName = "Mobile";
            } else if (process.platform === "win32") {
                ConfigContext.metaData.friendlyName = "Windows PC";
            } else if (process.platform === "darwin") {
                ConfigContext.metaData.friendlyName = "MacBook";
            } else if (process.platform === "linux" || process.platform === "freebsd") {
                ConfigContext.metaData.friendlyName = "Linux Device";
            } else {
                ConfigContext.metaData.friendlyName = "Webinos Device";// Add manually
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
    function updateWebinosConfigFile(fileName, config, callback) {
        try {
            var filePath = path.resolve (__dirname, "../../../../webinos_config.json");
            fs.writeFileSync(filePath, JSON.stringify(config, null, "  "));
            logger.log("updated webinos config with details related to "+ fileName);
            if(callback) callback(true);            
        } catch (err) {
            ConfigContext.on("EXCEPTION", "webinos_config write failed", err});
        }
    }
    /**
     * Updates webinos config regarding service cache and user ports
     * @param {String} fileName - file that has been changed
     */
    function updateWebinosConfig(fileName, callback) {
        try {
            if (fileName === "serviceCache") {
               if (ConfigContext.metaData.webinosType === "Pzh" &&
                   defaultConfig.pzhDefaultServices.length !== ConfigContext.serviceCache.length) {
                   defaultConfig.pzhDefaultServices = ConfigContext.serviceCache;
               } else if (ConfigContext.metaData.webinosType === "Pzp" &&
                          config.pzpDefaultServices.length !== ConfigContext.serviceCache.length) {
                   config.pzpDefaultServices = ConfigContext.serviceCache;
               }
               updateWebinosConfigFile(fileName, config, callback);
            } else if (fileName === "userPref" && !compareObjects(config.ports, ConfigContext.userPref.ports)) {
                config.ports = ConfigContext.userPref.ports;
                updateWebinosConfigFile(fileName, config, callback);
            }
        } catch(err) {
            ConfigContext.emit("EXCEPTION", "webinos_config update failed", err});
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
            if (!compareObjects(config.webinos_version, ConfigContext.metaData.webinos_version)) {
                ConfigContext.metaData.webinos_version = config.webinos_version;
                ConfigContext.storeDetails(null, "metaData", ConfigContext.metaData);
            }
            if (!compareObjects(config.ports, ConfigContext.userPref.ports)) {
                ConfigContext.userPref.ports = config.ports;
                ConfigContext.storeDetails("userData", "userPref", ConfigContext.userPref);
            }
            if (ConfigContext.metaData.webinosType === "Pzh" && config.pzhDefaultServices.length !== ConfigContext.serviceCache.length) {
                ConfigContext.serviceCache = config.pzhDefaultServices;
                ConfigContext.storeDetails("userData", "serviceCache", ConfigContext.serviceCache);
            } else if (ConfigContext.metaData.webinosType === "Pzp" && config.pzpDefaultServices.length !== ConfigContext.serviceCache.length) {
                ConfigContext.serviceCache = config.pzpDefaultServices;
                ConfigContext.storeDetails("userData", "serviceCache", ConfigContext.serviceCache);
            }
            if (ConfigContext.metaData.webinosType === "Pzp" && config.friendlyName !== "") {
                setFriendlyName(config.friendlyName);
            }
        } catch(err) {
            ConfigContext.emit("EXCEPTION", "webinos_config check update failed", err});
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
            var webinos_root;
            if (createDefaultDirectories(ConfigContext.metaData.webinosType)) {
                logger.log ("created default webinos directories at location : " + ConfigContext.metaData.webinosRoot);
                ConfigContext.metaData.webinos_version = webinosConfigValue.webinos_version;
                ConfigContext.userPref.ports = webinosConfigValue.ports;
                ConfigContext.userData = webinosConfigValue.certConfiguration;
                if(inputConfig && inputConfig.user)  storeUserData(inputConfig.user, webinosConfigValue.certConfiguration);
                setFriendlyName((inputConfig && inputConfig.friendlyName) || webinosConfigValue.friendlyName);
                if (ConfigContext.metaData.webinosType === "Pzh" || ConfigContext.metaData.webinosType === "PzhCA") {
                    ConfigContext.serviceCache = webinosConfigValue.pzhDefaultServices.slice(0);
                    ConfigContext.metaData.friendlyName = ConfigContext.userData.name +" ("+ ConfigContext.userData.authenticator + ")";
                } else if (ConfigContext.metaData.webinosType === "Pzp" || ConfigContext.metaData.webinosType === "PzpCA") {
                    ConfigContext.serviceCache = webinosConfigValue.pzpDefaultServices.slice(0);
                }
                createPolicyFile();
                storeAll();
                if(callback) callback (true);
            } else {
                ConfigContext.emit("FUNC_ERROR",  "webinos default directory creation failed", err});
            }
        } catch (err){
            ConfigContext.emit("EXCEPTION",  "webinos fetching default configuration failed", err});            
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
            var webinos_root =  (ConfigContext.metaData.webinosType.search("Pzh") !== -1)?
                                wPath.webinosPath()+"Pzh" :wPath.webinosPath();
            //If the main folder doesn't exist
            if (!existsSync (webinos_root)) {
                fs.mkdirSync (webinos_root, permission);
            }
            // If the user folder does not exist in webinosPzh.
            if (ConfigContext.metaData.webinosType.search("Pzh") !== -1 &&
            !existsSync (ConfigContext.metaData.webinosRoot)){
                fs.mkdirSync (ConfigContext.metaData.webinosRoot, permission);
            }
            // webinos root was created, we need the following 1st level dirs
            var list = [ path.join (ConfigContext.metaData.webinosRoot, "logs"),
                path.join (webinos_root, "wrt"),
                path.join (ConfigContext.metaData.webinosRoot, "certificates"),
                path.join (ConfigContext.metaData.webinosRoot, "policies"),
                path.join (ConfigContext.metaData.webinosRoot, "wrt"),
                path.join (ConfigContext.metaData.webinosRoot, "userData"),
                path.join (ConfigContext.metaData.webinosRoot, "keys"),
                path.join (ConfigContext.metaData.webinosRoot, "certificates", "external"),
                path.join (ConfigContext.metaData.webinosRoot, "certificates", "internal")];
            list.forEach (function (name) {
                if (!existsSync (name)) fs.mkdirSync (name, permission);
            });
            // Notify that we are done
            return true;
        } catch (err) {
            ConfigContext.emit("EXCEPTION", "Failed in creating default directories", err);            
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
                    var cn = ConfigContext.metaData.webinosType + "CA:" + ConfigContext.metaData.webinosName;
                    ConfigContext.generateSelfSignedCertificate (ConfigContext.metaData.webinosType+"CA", cn,
                    function (status, value) {
                        if (!status) {
                            if (callback) callback (false, value); // value is set in generateConfigContextSignedCertificate
                        } else {
                            logger.log ("*****master certificate generated*****");
                            cn = ConfigContext.metaData.webinosType + ":" + ConfigContext.metaData.webinosName;
                            ConfigContext.generateSelfSignedCertificate (ConfigContext.metaData.webinosType,
                            cn, function (status, csr) { // Master Certificate
                                if (status) {
                                    logger.log ("*****connection certificate generated*****");
                                    ConfigContext.generateSignedCertificate(csr, function (status, signedCert) {
                                        if (status) {
                                            logger.log ("*****connection certificate signed by master certificate*****");
                                            ConfigContext.cert.internal.conn.cert = signedCert;
                                            ConfigContext.storeDetails(path.join("certificates", "internal"),
                                            "certificates", ConfigContext.cert.internal);
                                            ConfigContext.storeDetails(null, "crl", ConfigContext.crl);
                                            if (callback) callback(true);
                                        } else {
                                            ConfigContext.emit("FUNC_ERROR", "Failed signing certificate", signedCert); 
                                        }
                                    });
                                } else {
                                    ConfigContext.emit("FUNC_ERROR", "Failed signing certificate", csr); // csr is set in generateConfigContextSignedCertificate
                                }
                            });
                        }
                    });
                } else {
                    ConfigContext.emit("EXCEPTION", "webinos configuration data is corrupted considering it is corrupted", err);
                }
            });
        } catch (err) {
            ConfigContext.emit("EXCEPTION", "webinos new configuration setting failed", err);
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
            if (ConfigContext.metaData.webinosRoot) {
                for (i = 0; i < ConfigContext.fileList.length; i = i + 1) {
                    name = ConfigContext.fileList[i];
                    var fileName = (name.fileName !== null) ? (name.fileName+".json"):(webinosName +".json");
                    var filePath = path.join (ConfigContext.metaData.webinosRoot, name.folderName, fileName);
                    if( !existsSync(filePath)){
                        callback(false); // This triggers createNewConfiguration
                        return;
                    }
                }
                callback(true);
            } else {
                ConfigContext.emit("FUNC_ERROR", "setting webinos root failed", err);
            }
        } catch (err) {
            ConfigContext.emit("EXCEPTION", "checking of webinos configuration failed", err);            
        }
    }
    /**
     * This is a public function that gets triggered by PZH/PZP/PZHP to fetch existing configuration
     * or load old configuration.
     * Create or Load webinos configuration
     * @param {Function} callback - to return status (true/false) and in case of error, error details
     */
    this.createOrLoadWebinosConfiguration = function(callback) {
        try {
            checkConfigExists(function(status, errMsg) {
                if(status) {
                    ConfigContext.fileList.forEach(function(name){
                        ConfigContext.fetchDetails(name.folderName, name.fileName, name.object);
                    });
                    checkDefaultValues(callback);
                    callback(true);
                } else {
                    createNewConfiguration(callback);
                }
            });
        } catch (err) {
            ConfigContext.emit("EXCEPTION", "webinos configuration load/create failed", err);
        }
    };
    /**
     * Used for storing key hash
     * @param {String} keys - private key to be stored
     * @param {String} name - name of the file
     */
    this.storeKeys = function (keys, name) {
        var filePath = 
        path.join(ConfigContext.metaData.webinosRoot, "keys", name+".pem");
        try {
            fs.writeFileSync(path.resolve(filePath), keys);
            logger.log("saved " + name +".pem");
            //calling get hash
            // ConfigContext.getKeyHash(filePath);
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
        var filePath = path.join (ConfigContext.metaData.webinosRoot, folderName, fileName+".json");
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
                ConfigContext.emit("WRITE", "Object to store is empty should be am object", err);
            }
        } catch(err) {
            ConfigContext.emit("EXCEPTION", "webinos configuration store in " + filePath+ " failed", err);
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
        var filePath = path.join(ConfigContext.metaData.webinosRoot, folderName, fileName+".json");
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
                ConfigContext.emit("READ", "webinos configuration data is empty in the file, considering it is corrupted", err);
            }
        } catch(error) {
            ConfigContext.emit("EXCEPTION", "webinos configuration data is corrupted considering it is corrupted", err);
            logger.log("since webinos data is corrupted, it will not start correctly");
            logger.log("triggering webinos configuration again");
            ConfigContext.createOrLoadWebinosConfiguration(callback);
        }
    };
    initializeConfigContext(); // Need to run this by default
}

Config.prototype.__proto__ = require("events").EventEmitter.prototype;
module.exports = Config;
