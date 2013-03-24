// Tests to check configuration  checking for the PZP
// This code is intended to check JS calls not native code
var Configuration = require("../../lib/configuration.js");
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

describe("Check configuration parameters", function() {
    // Check this is fresh instance and not duplicate of the 
    it("check configuration default values", function() {
        expect(typeof ConfigInstance.metaData).toEqual("object");
        expect(CurrentContext.metaData.webinosName).not.toBeNull();
        expect(CurrentContext.metaData.webinosName).not.toEqual("");
        expect(CurrentContext.metaData.webinosRoot).not.toBeNull();
        expect(CurrentContext.metaData.webinosRoot).not.toEqual("");;
        expect(CurrentContext.metaData.webinosRoot).toContain("webinos");
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
        expect(typeof ConfigInstance.serviceCache).toEqual("array");
        expect(ConfigInstance.serviceCache).toEqual([]);        
        expect(typeof ConfigInstance.fileList).toEqual("object");
        expect(Object.keys(ConfigInstance.fileList)).toEqual(10);
    });
    // Create new configuration
    it("create new configuration", function(){
        var webinosPath = require("").webinosPath();
        ConfigInstance.createOrLoadWebinosConfiguration(function(status, value){
            expect(status).toEqual(true);
            expect(value).toBeNull();
            it("Check Webinos directories are created properly", function(){  
                expect(ConfigInstance.metaData.webinosRoot).toEqual(webinosPath); 
                expect(existSync(path.join(ConfigInstance.metaData.webinosRoot "logs")).toEqual(true); 
                expect(existSync(path.join(ConfigInstance.metaData.webinosRoot "wrt")).toEqual(true); 
                expect(existSync(path.join(ConfigInstance.metaData.webinosRoot "certificates")).toEqual(true); 
                expect(existSync(path.join(ConfigInstance.metaData.webinosRoot "certificates", "internal")).toEqual(true); 
                expect(existSync(path.join(ConfigInstance.metaData.webinosRoot "certificates", "external")).toEqual(true); 
                expect(existSync(path.join(ConfigInstance.metaData.webinosRoot "userData")).toEqual(true); 
                expect(existSync(path.join(ConfigInstance.metaData.webinosRoot "keys")).toEqual(true);             
            });
            it("Check if values are properly set from webinos config", function(){  
                expect(typeof ConfigInstance.metaData.webinos_version).toEqual("object");
                expect(ConfigInstance.metaData.webinos_version).not.toBeNull();
                expect(ConfigInstance.metaData.webinos_version).toEqual(webinosConfigValue.webinos_version);
                expect(typeof ConfigInstance.metaData.userPref.ports).toEqual("object");
                expect(ConfigInstance.metaData.userPref.ports).not.toBeNull();
                expect(ConfigInstance.metaData.userPref.ports).toEqual(webinosConfigValue.userPref.ports);
                expect(typeof ConfigInstance.metaData.userData).toEqual("object");
                expect(ConfigInstance.metaData.userData).not.toBeNull();
                expect(ConfigInstance.metaData.userData).toEqual(webinosConfigValue.certConfiguration);
                expect(ConfigInstance.serviceCache).not.toBeNull();
                expect(typeof ConfigInstance.serviceCache).toEqual("array");
                expect(ConfigInstance.serviceCache).toEqual(webinosConfigValue.pzpDefaultServices);
            });
            it("Check set friendly name", function(){  
                expect(ConfigInstance.metaData.friendlyName).not.toBeNull();
                expect(ConfigInstance.metaData.friendlyName).toContain("Linux Device" || "Mobile" || "Windows PC" ||"MacBook" || "Webinos Device");
            });  
            it("Check configuration if it is stored in the files and contents of files are sane", function() {
                expect(existSync(ConfigInstance.metaData.webinosRoot, "metaData")).toEqual(true);
                expect(existSync(ConfigInstance.metaData.webinosRoot, "crl")).toEqual(true);
                expect(existSync(ConfigInstance.metaData.webinosRoot, "trustedList")).toEqual(true);
                expect(existSync(ConfigInstance.metaData.webinosRoot, "untrustedList")).toEqual(true);
                expect(existSync(ConfigInstance.metaData.webinosRoot, "exCertList")).toEqual(true);
                expect(existSync(ConfigInstance.metaData.webinosRoot, "certificates", "internal", "certificates")).toEqual(true);
                expect(existSync(ConfigInstance.metaData.webinosRoot, "certificates", "external", "certificates")).toEqual(true);
                expect(existSync(ConfigInstance.metaData.webinosRoot, "userData", "userDetails", )).toEqual(true);
                expect(existSync(ConfigInstance.metaData.webinosRoot, "serviceCache")).toEqual(true);
                expect(fs.readFileSync(ConfigInstance.metaData.webinosRoot, "metaData")).not.toEqual("");
                expect(fs.readFileSync(ConfigInstance.metaData.webinosRoot, "crl")).toEqual({});
                expect(fs.readFileSync(ConfigInstance.metaData.webinosRoot, "certificates", "external", "certificates")).toContain(CERT_START);
                expect(fs.readFileSync(ConfigInstance.metaData.webinosRoot, "userData", "userDetails", )).toEqual(JSON.stringify(webinosConfigValue.certConfiguration));
                expect(fs.readFileSync(ConfigInstance.metaData.webinosRoot, "certificates", "serviceCache")).toEqual(JSON.stringify(webinosConfigValue.serviceCache));
                expect(fs.readFileSync(ConfigInstance.metaData.webinosRoot, "certificates", "userPref")).toEqual(JSON.stringify(webinosConfigValue.ports));
            }); 
            it("Check if certificates has been created" , function() {
                expect(ConfigInstance.cert.internal.master.cert).toContain(CERT_START);
                expect(ConfigInstance.cert.internal.master.cert).toContain(CERT_END);
                expect(ConfigInstance.cert.internal.conn.cert).toContain(CERT_START);
                expect(ConfigInstance.cert.internal.conn.cert).toContain(CERT_END);
            });
            
        });    
    });    
});