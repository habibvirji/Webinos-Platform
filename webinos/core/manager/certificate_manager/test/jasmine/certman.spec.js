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
* Copyright 2011 University of Oxford
*******************************************************************************/
// test for the openssl wrapper.
// TODO: more than just checks for not-empty, need to check some fields
// there is an x509 module somewhere I need to use...

var certman = require("certificate_manager");

var util = require("util");
var rsakey;
var certReq;
var ssCert;
var cert;
var childKey;
var childReq;
var childCert;
var emptyCRL;

var RSA_START       = "-----BEGIN RSA PRIVATE KEY-----";
var RSA_END         = "-----END RSA PRIVATE KEY-----";
var CERT_REQ_START  = "-----BEGIN CERTIFICATE REQUEST-----";
var CERT_REQ_END    = "-----END CERTIFICATE REQUEST-----";
var CERT_START      = "-----BEGIN CERTIFICATE-----";
var CERT_END        = "-----END CERTIFICATE-----";
var CRL_START       = "-----BEGIN X509 CRL-----";
var CRL_END         = "-----END X509 CRL-----";


describe("generate keys", function() {
    it("can create a 1024 size key", function() {       
        rsakey = certman.genRsaKey(1024);
        expect(rsakey).not.toBeNull();
        expect(rsakey).not.toEqual("");
        expect(rsakey).toContain(RSA_START);
        expect(rsakey).toContain(RSA_END);
        expect(rsakey.length).toBeGreaterThan(100);
    });
    it("can create a bigger key", function() {
        var rsakey2 = certman.genRsaKey(2048);
        expect(rsakey).not.toEqual(rsakey2);
    });
});

describe("generate certificate requests", function() {
    it("can create a certificate request", function() {       
        certReq = certman.createCertificateRequest(rsakey, 
            "UK","OX","Oxford","Univ. Oxford","Computer Science","Pzh:CA Key", "john.lyle@cs.ox.ac.uk");
        expect(certReq).not.toBeNull();
        expect(certReq).toContain(CERT_REQ_START);
        expect(certReq).toContain(CERT_REQ_END);
        expect(certReq.length).toBeGreaterThan(100);
    });
});

describe("sign certificate requests", function() {
    it("can self-sign a certificate request", function() {
        ssCert = certman.selfSignRequest(certReq, 30, rsakey, 1, "URI:pzh.webinos.org");
        expect(ssCert).not.toBeNull();
        expect(ssCert).toContain(CERT_START);
        expect(ssCert).toContain(CERT_END);
        expect(ssCert.length).toBeGreaterThan(100);
    });
    
    it("can sign another certificate request", function() {
        childKey = certman.genRsaKey(1024);
        childReq = certReq = certman.createCertificateRequest(rsakey, 
            "UK","OX","Oxford","Univ. Oxford","Computer Science", "Pzp:Client Key", "john.lyle@cs.ox.ac.uk");
        childCert = certman.signRequest(childReq, 30, rsakey, ssCert, 1, "URI:pzh.webinos.org");
        expect(childCert).not.toBeNull();
        expect(childCert).toContain(CERT_START);
        expect(childCert).toContain(CERT_END);
        expect(childCert.length).toBeGreaterThan(100);
    });
});

describe("create certificate revocation lists", function() {
    it("can create an empty CRL", function() {
        emptyCRL = certman.createEmptyCRL(rsakey, ssCert, 30, 0);
        expect(emptyCRL).not.toBeNull();
        expect(emptyCRL).toContain(CRL_START);
        expect(emptyCRL).toContain(CRL_END);
        expect(emptyCRL.length).toBeGreaterThan(50);
    });
    it("can add to a CRL", function() {
        newCRL = certman.addToCRL(rsakey, emptyCRL, childCert);
        expect(newCRL).not.toBeNull();
        expect(newCRL).toContain(CRL_START);
        expect(newCRL).toContain(CRL_END);
        expect(newCRL.length).toBeGreaterThan(50);
        expect(newCRL).not.toEqual(emptyCRL);
    });
});
    
describe("Proper error handling", function() {
    it("will error given a bad altname", function() {
        childKey = certman.genRsaKey(1024);
        childReq = certReq = certman.createCertificateRequest(rsakey, 
            "UK","OX","Oxford","Univ. Oxford","Computer Science", "Client Key", "john.lyle@cs.ox.ac.uk");
        try {
            childCert = certman.signRequest(childReq, 30, rsakey, ssCert, 1, "foo://bar");
            expect(childCert).toBeNull(); //shouldn't get here.
        } catch (err) {
            expect(err).not.toBeGreaterThan(0);
            expect(err.toString()).toEqual("Error: Failed to sign a certificate");
        }
    });
});    

/*describe("get hash", function() {
    it("can get hash of public certificate", function() {
        var path = require("path").join(__dirname,"../conn.pem");
        var hash = certman.getHash(path);
        expect(hash).not.toBeNull();
        expect(hash).not.toEqual([]);
    });
});*/

var CertificateManager = require("../../lib/certificate");
var WebinosPath = require("../../../../util/lib/webinosPath");
var webinosName = "WebinosPZP";
var certConfig = require("../../../../../../webinos_config.json");
var CertificateManagerInstance = new CertificateManager("Pzp", WebinosPath.webinosPath(), webinosName, "0.0.0.0", certConfig.certConfiguration);

describe("CertificateManager Server JS tests", function() {
    it("generates server private key, csr, self signed certificate and crl", function() {
        var cn ="PzpCA:" +  webinosName;
        CertificateManagerInstance.generateSelfSignedCertificate("PzpCA", cn, function(status, csr) {
            expect(status).toBeTruthy();
            expect(csr).toEqual(undefined);
            expect(CertificateManagerInstance.cert.internal.master.cert).toContain(CERT_START);
            expect(CertificateManagerInstance.cert.internal.master.cert).toContain(CERT_END);
            expect(CertificateManagerInstance.crl.value).toContain(CRL_START);
            expect(CertificateManagerInstance.crl.value).toContain(CRL_END);
            expect(CertificateManagerInstance.cert.internal.master.key_id).toEqual(webinosName + "_master");
        });
    });
    var cn ="Pzp:" + webinosName, csr, cert;
    it("generate client private key, csr, self signed certificate and crl", function() {
        // PZP should return back csr
        expect(CertificateManagerInstance.cert.internal.master.cert).not.toBeNull();
//        expect(CertificateManagerInstance.cert.internal.master.cert).toContain(CERT_START);
//        expect(CertificateManagerInstance.cert.internal.master.cert).toContain(CERT_END);
        expect(CertificateManagerInstance.crl).not.toBeNull({ });
    });
    it("generate connection certificate", function() {
        CertificateManagerInstance.generateSelfSignedCertificate("Pzp", cn, function(status, csr_){
            csr = csr_;
            expect(status).toBeTruthy();
            expect(csr).not.toBeNull();
            expect(csr).not.toEqual("");
            expect(csr).toContain(CERT_REQ_START);
            expect(csr).toContain(CERT_REQ_END);
            expect(CertificateManagerInstance.cert.internal.conn.cert ).toContain(CERT_START);
            expect(CertificateManagerInstance.cert.internal.conn.cert).toContain(CERT_END);
            expect(CertificateManagerInstance.cert.internal.conn.key_id).toEqual(webinosName + "_conn");
        });
    });
    it("signed connection certificate by the master certificate", function() { // Signed certificate back by PZP
        CertificateManagerInstance.generateSignedCertificate(csr, function(status, cert_) {
            cert = cert_;
            expect(status).toBeTruthy();
            expect(cert).not.toBeNull();
            expect(cert).not.toEqual("");
            expect(cert).toContain(CERT_START);
            expect(cert).toContain(CERT_END);
        });
    });
    it("revoke PZP certificate", function() {// Revoke PZP certificate
        CertificateManagerInstance.revokeClientCert(cert, function(status, crl) {
            expect(status).toBeTruthy();
            expect(crl).not.toBeNull();
            expect(crl).not.toEqual("");
            expect(crl).toContain(CRL_START);
            expect(crl).toContain(CRL_END);
        });
    });
});

describe("CertificateManager Negative JS tests", function() {
    CertificateManagerInstance.on("FUNC_ERROR", function(errText, err) {
        expect(errText).not.toBeNull();
        if(errText === "failed generating CSR. user details are missing" ||
            errText === "failed signing client certificate") ;
        else throw "functionality error " + err;
    });

    it("csr and signed cert error", function() {
        CertificateManagerInstance.generateSelfSignedCertificate("Pzp", "");
        CertificateManagerInstance.generateSignedCertificate(undefined);

    });


});
