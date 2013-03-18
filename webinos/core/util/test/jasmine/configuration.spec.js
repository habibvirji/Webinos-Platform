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

// KeyStore JavaScript calls
describe("KeyStore JS tests", function() {
    var secretKey = "mySecret"+(Math.random()*100);
    var checkKey;
    it("generate and store key", function() {
        ConfigInstance.generateStoreKey("Pzp", secretKey, function(status, key){
            checkKey = key;
            expect(status).toBeTruthy();
            expect(key).not.toBeNull();
            expect(key).not.toEqual("");
            expect(key).toContain(RSA_START);
            expect(key).toContain(RSA_END);
        });
    });
    it("fetch a secret key", function() {
        ConfigInstance.fetchKey(secretKey, function(status, key){
            expect(status).toBeTruthy();
            expect(key).not.toBeNull();
            expect(key).not.toEqual("");
            expect(key).toContain(RSA_START);
            expect(key).toContain(RSA_END);
            expect(key).toEqual(checkKey);
        });
    });
    it("delete key", function() {
        ConfigInstance.deleteKey(secretKey, function(status, errmsg){
            expect(status).toBeTruthy();
        });
    });

    // Check exceptions
    it("check exception while storing generated key", function() {
        ConfigInstance.generateStoreKey("Pzp", null, function(statusG, errMsg){
            expect(statusG).toBeFalsy();
            expect(errMsg).not.toBeNull();
            expect(typeof errMsg).toEqual("object");
            expect(errMsg.Component).toEqual("KeyStore");
            expect(errMsg.Type).toEqual("WRITE");
            expect(errMsg.Message).toEqual("Failed storing key");
        });
    });
    it("check exception while fetching key with empty secretKey", function() {
        ConfigInstance.fetchKey(null, function(statusF, errMsg){
            expect(statusF).toBeFalsy();
            expect(errMsg).not.toBeNull();
            expect(typeof errMsg).toEqual("object");
            expect(errMsg.Component).toEqual("KeyStore");
            expect(errMsg.Type).toEqual("READ");
            expect(errMsg.Message).toEqual("Failed fetching key");
        });
    });
    it("check exception while deleting key", function() {
        ConfigInstance.deleteKey(null, function(statusD, errMsg){
            expect(statusD).toBeFalsy();
            expect(errMsg).not.toBeNull();
            expect(typeof errMsg).toEqual("object");
            expect(errMsg.Component).toEqual("KeyStore");
            expect(errMsg.Type).toEqual("CLEANUP");
            expect(errMsg.Message).toEqual("Failed deleting key");
        });
    });
});

describe("CertificateManager Server JS tests", function() {
    it("generates server private key, csr, self signed certificate and crl", function() {
        var cn ="PzpCA:" +  ConfigInstance.metaData.webinosName;
        ConfigInstance.generateSelfSignedCertificate("PzpCA", cn, function(status, csr){
            expect(status).toBeTruthy();
            expect(csr).toEqual(undefined);
            expect(ConfigInstance.cert.internal.master.cert).toContain(CERT_START);
            expect(ConfigInstance.cert.internal.master.cert).toContain(CERT_END);
            expect(ConfigInstance.crl.value).toContain(CRL_START);
            expect(ConfigInstance.crl.value).toContain(CRL_END);
            expect(ConfigInstance.cert.internal.master.key_id).toEqual(ConfigInstance.metaData.webinosName + "_master");
        });
    });
});

//Certificate manager JS calls
describe("CertificateManager Client JS tests", function() {
    it("generate client private key, csr, self signed certificate and crl", function() {
        var cn ="Pzp:" + ConfigInstance.metaData.webinosName;
        // PZP should return back csr
        expect(ConfigInstance.cert.internal.master.cert).not.toBeNull();
        expect(ConfigInstance.cert.internal.master.cert).toContain(CERT_START);
        expect(ConfigInstance.cert.internal.master.cert).toContain(CERT_END);
        expect(ConfigInstance.crl).not.toBeNull({ });
        ConfigInstance.generateSelfSignedCertificate("Pzp", cn, function(status, csr){
            expect(status).toBeTruthy();
            expect(csr).not.toBeNull();
            expect(csr).not.toEqual("");
            expect(csr).toContain(CERT_REQ_START);
            expect(csr).toContain(CERT_REQ_END);
            expect(ConfigInstance.cert.internal.conn.cert ).toContain(CERT_START);
            expect(ConfigInstance.cert.internal.conn.cert).toContain(CERT_END);
            expect(ConfigInstance.cert.internal.conn.key_id).toEqual(ConfigInstance.metaData.webinosName + "_conn");
            // Signed certificate back by PZP
            ConfigInstance.generateSignedCertificate(csr, function(status, cert) {
                expect(status).toBeTruthy();
                expect(cert).not.toBeNull();
                expect(cert).not.toEqual("");
                expect(cert).toContain(CERT_START);
                expect(cert).toContain(CERT_END);
                // Revoke PZP certificate
                ConfigInstance.revokeClientCert(cert, function(status, crl) {
                    expect(status).toBeTruthy();
                    expect(crl).not.toBeNull();
                    expect(crl).not.toEqual("");
                    expect(crl).toContain(CRL_START);
                    expect(crl).toContain(CRL_END);
                });
            });
        });

    });
});

describe("CertificateManager Negative JS tests", function() {
    it("Trigger error in CSR", function() {
        ConfigInstance.generateSelfSignedCertificate("Pzp", "", function(status, errMsg){
            expect(status).toBeFalsy();
            expect(errMsg).not.toBeNull();
            expect(typeof errMsg).toEqual("object");
            expect(errMsg.Component).toEqual("CertificateManager");
            expect(errMsg.Type).toEqual("FUNC_ERROR");
            expect(errMsg.Message).toEqual("failed generating CSR. user details are missing");
        });
    });
    it("Trigger error in self-sign certificate", function() {
        var serverName = ConfigInstance.metaData.serverName;
        ConfigInstance.metaData.serverName = "";
        ConfigInstance.generateSelfSignedCertificate("Pzp", "Pzp:"+ConfigInstance.metaData.webinosName, function(status, errMsg){
            expect(status).toBeFalsy();
            expect(errMsg).not.toBeNull();
            expect(typeof errMsg).toEqual("object");
            expect(errMsg.Component).toEqual("CertificateManager");
            expect(errMsg.Type).toEqual("FUNC_ERROR");
            expect(errMsg.Message).toEqual("failed self signing certificate");
            ConfigInstance.metaData.serverName = serverName;
        });
    });
    it("Trigger error in signing certificate", function() {
        expect(ConfigInstance.cert.internal.master.key_id).toEqual(ConfigInstance.metaData.webinosName + "_master");
        ConfigInstance.generateSignedCertificate(undefined, function(status, errMsg) {
            expect(status).toBeFalsy();
            expect(errMsg).not.toBeNull();
            expect(errMsg).not.toEqual("");
            expect(typeof errMsg).toEqual("object");
        });
    });
});

describe("Check configuration parameters", function(){
    it("check configuration default values", function() {

    });
    it("create new configuration", function(){

    })
    createOrLoadWebinosConfiguration
});