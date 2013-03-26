// Tests to check configuration  checking for the PZP
// This code is intended to check JS calls not native code
var Configuration = require("../../lib/configuration.js");
var fs = require("fs");
var path = require("path");
var RSA_START       = "-----BEGIN RSA PRIVATE KEY-----";
var RSA_END         = "-----END RSA PRIVATE KEY-----";
var CERT_REQ_START  = "-----BEGIN CERTIFICATE REQUEST-----";
var CERT_REQ_END    = "-----END CERTIFICATE REQUEST-----";
var CERT_START      = "-----BEGIN CERTIFICATE-----";
var CERT_END        = "-----END CERTIFICATE-----";
var CRL_START       = "-----BEGIN X509 CRL-----";
var CRL_END         = "-----END X509 CRL-----";

var inputConfig = {
    pzhHost: '0.0.0.0',
    pzhName: '',
    friendlyName: '',
    forcedDeviceName: '',
    sessionIdentity: '0.0.0.0'
};
var ConfigInstance= new Configuration("Pzp", inputConfig);
var existsSync = fs.existsSync || path.existsSync;
var webinosPath = require("../../lib/webinosPath.js");
var webinosConfigValue = require("../../../../../webinos_config.json");


describe("Check default configuration parameters", function() {
    // Check this is fresh instance and not duplicate of the
    it("check configuration default values", function() {
        expect(typeof ConfigInstance.metaData).toEqual("object");
        expect(ConfigInstance.metaData.webinosName).not.toBeNull();
        expect(ConfigInstance.metaData.webinosName).not.toEqual("");
        expect(ConfigInstance.metaData.webinosRoot).not.toBeNull();
        expect(ConfigInstance.metaData.webinosRoot).not.toEqual("");
        expect(ConfigInstance.metaData.webinosRoot).toContain("webinos");
        expect(typeof ConfigInstance.trustedList.pzh).toEqual("object");
        expect(ConfigInstance.trustedList.pzh).toEqual({});
        expect(typeof ConfigInstance.trustedList.pzp).toEqual("object");
        expect(ConfigInstance.trustedList.pzp).toEqual({});
        expect(typeof ConfigInstance.untrustedCert).toEqual("object");
        expect(ConfigInstance.untrustedCert).toEqual({});
        expect(typeof ConfigInstance.exCertList).toEqual("object");
        expect(ConfigInstance.exCertList).toEqual({});
        expect(typeof ConfigInstance.crl).toEqual("object");
        expect(ConfigInstance.crl).toEqual({});
        expect(typeof ConfigInstance.policies).toEqual("object");
        expect(ConfigInstance.policies).toEqual({});
        expect(typeof ConfigInstance.userData).toEqual("object");
        expect(ConfigInstance.userData).not.toBeNull();
        expect(typeof ConfigInstance.userPref).toEqual("object");
        expect(ConfigInstance.userPref).toEqual({});
        expect(typeof ConfigInstance.serviceCache).toEqual("object");
        expect(ConfigInstance.serviceCache).toEqual([]);
        expect(typeof ConfigInstance.fileList).toEqual("object");
        expect((Object.keys(ConfigInstance.fileList)).length).toEqual(10);
    });
});
describe("Create new PZP configuration", function() {
    runs(function(){
        // Create new configuration
        ConfigInstance.createOrLoadWebinosConfiguration(function(status, value){
            expect(status).toEqual(true);
            expect(value).toEqual(undefined);
        });
    });
    waits(2000);

    it("Check Webinos directories are created properly", function(){
        expect(ConfigInstance.metaData.webinosRoot).toEqual(webinosPath.webinosPath());
        expect(existsSync(path.join(ConfigInstance.metaData.webinosRoot, "logs"))).toEqual(true);
        expect(existsSync(path.join(ConfigInstance.metaData.webinosRoot, "wrt"))).toEqual(true);
        expect(existsSync(path.join(ConfigInstance.metaData.webinosRoot, "certificates"))).toEqual(true);
        expect(existsSync(path.join(ConfigInstance.metaData.webinosRoot, "certificates", "internal"))).toEqual(true);
        expect(existsSync(path.join(ConfigInstance.metaData.webinosRoot, "certificates", "external"))).toEqual(true);
        expect(existsSync(path.join(ConfigInstance.metaData.webinosRoot, "userData"))).toEqual(true);
        expect(existsSync(path.join(ConfigInstance.metaData.webinosRoot, "keys"))).toEqual(true);
    });

    it("Check if values are properly set from webinos config", function(){
        expect(typeof ConfigInstance.metaData.webinos_version).toEqual("object");
        expect(ConfigInstance.metaData.webinos_version).not.toBeNull();
        expect(ConfigInstance.metaData.webinos_version).toEqual(webinosConfigValue.webinos_version);
        expect(typeof ConfigInstance.userPref.ports).toEqual("object");
        expect(ConfigInstance.userPref.ports).not.toBeNull();
        expect(ConfigInstance.userPref.ports).toEqual(webinosConfigValue.ports);
        expect(typeof ConfigInstance.userData).toEqual("object");
        expect(ConfigInstance.userData).not.toBeNull();
        expect(ConfigInstance.userData).toEqual(webinosConfigValue.certConfiguration);
        expect(ConfigInstance.serviceCache).not.toBeNull();
        expect(typeof ConfigInstance.serviceCache).toEqual("object");
        expect(ConfigInstance.serviceCache).toEqual(webinosConfigValue.pzpDefaultServices);
    });
    it("Check set friendly name", function(){
        expect(ConfigInstance.metaData.friendlyName).not.toBeNull();
        expect(ConfigInstance.metaData.friendlyName).toContain("Linux Device" || "Mobile" || "Windows PC" ||"MacBook" || "Webinos Device");
    });
    it("Check configuration if it is stored in the files and contents of files are sane", function() {
        expect(existsSync(ConfigInstance.metaData.webinosRoot, "metaData")).toEqual(true);
        expect(existsSync(ConfigInstance.metaData.webinosRoot, "crl")).toEqual(true);
        expect(existsSync(ConfigInstance.metaData.webinosRoot, "trustedList")).toEqual(true);
        expect(existsSync(ConfigInstance.metaData.webinosRoot, "untrustedList")).toEqual(true);
        expect(existsSync(ConfigInstance.metaData.webinosRoot, "exCertList")).toEqual(true);
        expect(existsSync(ConfigInstance.metaData.webinosRoot, "certificates", "internal", "certificates")).toEqual(true);
        expect(existsSync(ConfigInstance.metaData.webinosRoot, "certificates", "external", "certificates")).toEqual(true);
        expect(existsSync(ConfigInstance.metaData.webinosRoot, "userData", "userDetails")).toEqual(true);
        expect(existsSync(ConfigInstance.metaData.webinosRoot, "serviceCache")).toEqual(true);
        expect((fs.readFileSync(path.join(ConfigInstance.metaData.webinosRoot, "metaData.json"))).toString()).not.toEqual("");
        expect((fs.readFileSync(path.join(ConfigInstance.metaData.webinosRoot, "crl.json"))).toString()).toEqual("{}");
        expect((fs.readFileSync(path.join(ConfigInstance.metaData.webinosRoot, "certificates", "internal", "certificates.json"))).toString()).toContain(CERT_START);
        expect(JSON.parse((fs.readFileSync(path.join(ConfigInstance.metaData.webinosRoot, "userData", "userDetails.json"))).toString())).toEqual(webinosConfigValue.certConfiguration);
        expect(JSON.parse((fs.readFileSync(path.join(ConfigInstance.metaData.webinosRoot, "userData", "serviceCache.json"))).toString())).toEqual(webinosConfigValue.pzpDefaultServices);
        expect(JSON.parse((fs.readFileSync(path.join(ConfigInstance.metaData.webinosRoot, "userData", "userPref.json"))).toString()).ports).toEqual(webinosConfigValue.ports);
    });
    it("Check if certificates has been created" , function() {
        expect(ConfigInstance.cert.internal.master.cert).toContain(CERT_START);
        expect(ConfigInstance.cert.internal.master.cert).toContain(CERT_END);
        expect(ConfigInstance.cert.internal.conn.cert).toContain(CERT_START);
        expect(ConfigInstance.cert.internal.conn.cert).toContain(CERT_END);
    });
});