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
* Copyright 2011 Habib Virji, Samsung Electronics (UK) Ltd
* Copyright 2012 Ziran Sun, Samsung Electronics (UK) Ltd
*******************************************************************************/
#include "openssl_wrapper.h"
#include <openssl/rsa.h>
#include <openssl/bio.h>
#include <openssl/bn.h>
#include <openssl/pem.h>
#include <openssl/err.h>
#include <openssl/x509v3.h>
#include <openssl/x509.h>
#include <openssl/err.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>

/*
 * Note: you CANT use STL in this module - it breaks the Android build.
 */

int genRsaKey(const int bits, char * privkey)
{
  BIO * out = BIO_new(BIO_s_mem());
  RSA * rsa = 0;
  BIGNUM * bn = 0;
  int err = 0;
  if (!(rsa = RSA_new())) return -1;
  if (!(bn = BN_new())) return -2;
  if (!(err = BN_set_word(bn,RSA_F4))) {
    BN_free(bn);
    return err;
  }
  if (!(err = RSA_generate_key_ex(rsa ,bits, bn,NULL))) {
    BN_free(bn);
    RSA_free(rsa);
    return err;
  }
  if (!(err = PEM_write_bio_RSAPrivateKey(out, rsa, NULL, NULL, 0, NULL, NULL))) {
    BIO_free_all(out);
    BN_free(bn);
    RSA_free(rsa);
    return err;
  }
  if (!(err = BIO_read(out, privkey, bits) <= 0)) {
    BIO_free_all(out);
    BN_free(bn);
    RSA_free(rsa);
    return err;
  }
  BIO_free_all(out);
  BN_free(bn);
  RSA_free(rsa);
  return 0;
}

int createCertificateRequest(char* result, char* keyToCertify, char * country, 
                             char* state, char* loc, char* organisation, 
                             char *organisationUnit, char* cname, char* email)
{
  BIO *mem = BIO_new(BIO_s_mem());
  X509_REQ *req=X509_REQ_new();
  X509_NAME *nm = X509_NAME_new();
  unsigned int err=0, len;
  //const char *
  char *certSubjList[] = {(char*)"C", (char*)"ST", (char*)"L", (char*)"O", (char*)"OU",
                          (char*)"CN", (char*)"emailAddress"};
  char *certValue[]    = {country, state, loc, organisation, organisationUnit, cname, email};

  for (len = 0; len < (sizeof(certSubjList)/sizeof(certSubjList[0])); len++) {
    if (strlen(certValue[len]) > 0) {
        if(!(err = X509_NAME_add_entry_by_txt(nm, certSubjList[len],
          MBSTRING_UTF8, (unsigned char*)certValue[len], -1, -1, 0))) {
          return err;
        }
      }
  }

  if(!(err = X509_REQ_set_subject_name(req, nm))) {
    return err;
  }
    //Set the public key
  //...convert PEM private key into a BIO
  BIO* bmem = BIO_new_mem_buf(keyToCertify, -1);
  if (!bmem) {
    BIO_free(bmem);
    return -3;
  }

  // read the private key into an EVP_PKEY structure
  EVP_PKEY* privkey = PEM_read_bio_PrivateKey(bmem, NULL, NULL, NULL);
  if (!privkey) {
    return -4;
  }
  BIO_free(bmem);

  if(!(err = X509_REQ_set_pubkey(req, privkey))) {
    return err;
  }

  if(!(err = X509_REQ_set_version(req,2))) {
    return err;
  }

  //write it to PEM format
  if (!(err = PEM_write_bio_X509_REQ(mem, req))) {
    BIO_free(mem);
    return err;
  }

  BUF_MEM *bptr;
  BIO_get_mem_ptr(mem, &bptr);
  BIO_read(mem, result, bptr->length);

  BIO_free(mem);
  return 0;
}

int getHash(char* filename, char *pointer){
  struct stat           sb;
  char                * buff;
  FILE                * fd;  
  size_t                len;
  BIO                 * bio;
  X509                * x;
  unsigned              err;
  char                  errmsg[1024];
  const EVP_MD        * digest;
  unsigned char         md[EVP_MAX_MD_SIZE];
  unsigned int          n;
  int j;

  // checks file
  if ((stat(filename, &sb)) == -1) {
    perror("getHash: stat()");
    return(1);
  };
  len = (sb.st_size * 2);

  // allocates memory
  if (!(buff = (char*)malloc(len))) {
    fprintf(stderr, "getHash: out of virtual memory\n");
    return(1);
  };

  // opens file for reading
  if ((fd = fopen(filename, "r")) == NULL) {
    perror("getHash: open()");
    free(buff);
    return(1);
  };

  // reads file
  if (!fread(buff, 1, len, fd)) {
    perror("getHash: read()");
    free(buff);
    return(1);
  };

  // closes file
  fclose(fd);

  // initialize OpenSSL
  
  // creates BIO buffer
  bio = BIO_new_mem_buf(buff, len);

  // decodes buffer
  if (!(x = PEM_read_bio_X509(bio, NULL, 0L, NULL)))
  {
    while((err = ERR_get_error()))
    {
      errmsg[1023] = '\0';
      ERR_error_string_n(err, errmsg, 1023);
      fprintf(stderr, "peminfo: %s\n", errmsg);
    };
    BIO_free(bio);
    free(buff);
    return(1); 
  };
  
  digest = EVP_get_digestbyname("sha1");
  if(X509_digest(x, digest, md, &n) && n > 0) {
    static const char hexcodes[] = "0123456789ABCDEF";
    for (j = 0; j < (int) n; j++) {
      pointer[j * 3] = hexcodes[(md[j] & 0xf0) >> 4U];
      pointer[(j * 3) + 1] = hexcodes[(md[j] & 0x0f)];
      if (j + 1 != (int) n) {
        pointer[(j * 3) + 2] = ':';
      } 
      else {
        pointer[(j * 3) + 2] = '\0';
      }
    }
  }
    
  BIO_free(bio);
  free(buff);

  return(0);
}

ASN1_INTEGER* getRandomSN() {
  ASN1_INTEGER* res = ASN1_INTEGER_new();
  BIGNUM *btmp = BN_new();
  //64 bits of randomness?
  BN_pseudo_rand(btmp, 64, 0, 0);
  BN_to_ASN1_INTEGER(btmp, res);

  BN_free(btmp);
  return res;
}

unsigned long error(BIO* csr, BIO* key, BIO* caCert) {
  BIO_free(csr);
  BIO_free(key);
  if (caCert != NULL){
    BIO_free(caCert);
  }
  return ERR_peek_error();
}

int createCertificate(char *url, int certType, int days, X509* cert, X509_REQ* req, X509 *caCert) {
  EVP_PKEY* reqPub;
  if(!(X509_set_version(cert, 2))) {
    return ERR_peek_error();
  }
  // cacert
  if (caCert != NULL) {
    if(!(X509_set_issuer_name(cert, X509_get_subject_name(caCert)))) {
      return ERR_peek_error();
    }
  } else {
    if(!(X509_set_issuer_name(cert, X509_REQ_get_subject_name(req)))) {
      return ERR_peek_error();
    }
  }
  ASN1_UTCTIME *s=ASN1_UTCTIME_new();
  // Jira-issue: WP-37
  // This is temp solution for putting pzp validity 5 minutes before current time
  // If there is a small clock difference between machines,
  // it results in cert_not_yet_valid
  // It does set GMT time but is relevant to machine time.
  // A better solution would be to have ntp server contacted to get proper time.
  if(certType == 2|| certType == 1) {
    X509_gmtime_adj(s, long(0-300));
  } else {
    X509_gmtime_adj(s, long(0));
  }// End of WP-37
  X509_set_notBefore(cert, s);
  X509_gmtime_adj(s, (long)60*60*24*days);
  X509_set_notAfter(cert, s);
  ASN1_UTCTIME_free(s);

  if(!(X509_set_subject_name(cert, X509_REQ_get_subject_name(req)))) {
    return ERR_peek_error();
  }
  if (!(reqPub = X509_REQ_get_pubkey(req))) {
    return ERR_peek_error();
  }
  if(!X509_set_pubkey(cert, reqPub)) {
    return ERR_peek_error();
  }
  EVP_PKEY_free(reqPub);

  //create a serial number at random
  ASN1_INTEGER* serial = getRandomSN();
  X509_set_serialNumber(cert, serial);

  // V3 extensions
  X509_EXTENSION *ex;
  X509V3_CTX ctx;
  X509V3_set_ctx_nodb(&ctx);
  X509V3_set_ctx(&ctx, cert, cert, NULL, NULL, 0);

  if(!(ex = X509V3_EXT_conf_nid(NULL, &ctx, NID_subject_alt_name, (char*)url))){
    return ERR_peek_error();
  } else {
    X509_add_ext(cert, ex, -1);
  }

  if(!(ex = X509V3_EXT_conf_nid(NULL, &ctx, NID_subject_key_identifier,
    (char*)"hash"))) {
    return ERR_peek_error();
  } else {
    X509_add_ext(cert, ex, -1);
  }

  if( certType == 0) {
    int certParamType[]  = {NID_basic_constraints,
                              NID_key_usage,
                              NID_ext_key_usage,
                              NID_inhibit_any_policy,
                              NID_crl_distribution_points};
    char *certParamValue[] = {(char*)"critical, CA:TRUE",
                              (char*)"critical, keyCertSign, digitalSignature, cRLSign",
                              (char*)"critical, serverAuth",
                              (char*)"0",
                              (char*)url};
    for (unsigned int len = 0;
        len < (sizeof(certParamType)/sizeof(certParamType[0])); len++) {
      if(!(ex = X509V3_EXT_conf_nid(NULL, &ctx, certParamType[len],
       certParamValue[len]))) {
        return ERR_peek_error();
      } else {
        X509_add_ext(cert, ex, -1);
      }
    }
  } if( certType == 1 || certType == 2) {
     char *str = (char*)malloc(strlen("caIssuers;") + strlen(url) + 1);
     if (str == NULL) {
       return -10;
     }
     strcpy(str, "caIssuers;");
     strcat(str, url);
     int certParamType[]  = {NID_issuer_alt_name,
                               NID_info_access,
                               NID_basic_constraints,
                               NID_ext_key_usage};
     char *certParamValue[] = {(char*)"issuer:copy",
                               (char*)str,
                               (char*)"critical, CA:FALSE",
                               (char*)"critical, clientAuth, serverAuth"};
     for (unsigned int len = 0;
         len < (sizeof(certParamType)/sizeof(certParamType[0])); len++){
       if(!(ex = X509V3_EXT_conf_nid(NULL, &ctx, certParamType[len],
        certParamValue[len]))) {
         free(str);
         return ERR_peek_error();
       } else {
         X509_add_ext(cert, ex, -1);
       }
     }
     free(str);
  }
  return 0;
}

void writeCert(X509* cert, char *result) {
  BIO *mem = BIO_new(BIO_s_mem());
  BUF_MEM *bptr;
  PEM_write_bio_X509(mem, cert);
  BIO_get_mem_ptr(mem, &bptr);
  BIO_read(mem, result, bptr->length);
  BIO_free(mem);
}

int selfSignRequest(char* pemRequest, int days, char* pemCAKey, int certType, 
                    char *url, char* result)  {
  BIO* bioReq = BIO_new_mem_buf(pemRequest, -1);
  BIO* bioCAKey = BIO_new_mem_buf(pemCAKey, -1);
  X509_REQ* req = NULL;
  EVP_PKEY* caKey;
  int err;

  if (!(req = PEM_read_bio_X509_REQ(bioReq, NULL, NULL, NULL))) {
    return error(bioReq, bioCAKey, NULL);
  }

  if (!(caKey = PEM_read_bio_PrivateKey(bioCAKey, NULL, NULL, NULL))) {
    return error(bioReq, bioCAKey, NULL);
  }

  BIO_free(bioReq);
  BIO_free(bioCAKey);

  X509* cert = X509_new();
  if ((err = createCertificate(url, certType, days, cert, req, NULL)) != 0) {
    return err;
  }
  if (!(err = X509_sign(cert, caKey, EVP_sha1()))) {
    return err;
  }

  writeCert(cert, result);
  return 0;
}

int signRequest(char* pemRequest, int days, char* pemCAKey, char* pemCaCert,
                int certType, char *url, char* result)  {
  BIO *bioReq, *bioCAKey, *bioCert;
  X509 *caCert, *cert;
  int err;
  X509_REQ *req = NULL;
  EVP_PKEY *caKey;
  bioReq = BIO_new_mem_buf(pemRequest, -1);
  bioCAKey = BIO_new_mem_buf(pemCAKey, -1);
  bioCert = BIO_new_mem_buf(pemCaCert, -1);

  if (!(req=PEM_read_bio_X509_REQ(bioReq, NULL, NULL, NULL))) {
    return error(bioReq, bioCAKey, bioCert);
  }
  if (!(caKey= PEM_read_bio_PrivateKey(bioCAKey, NULL, NULL, NULL))) {
    return error(bioReq, bioCAKey, bioCert);
  }
  if (!(caCert = PEM_read_bio_X509(bioCert, NULL, NULL, NULL))) {
    return error(bioReq, bioCAKey, bioCert);
  }
  BIO_free(bioReq);
  BIO_free(bioCAKey);
  BIO_free(bioCert);

  cert = X509_new();
  if ((err = createCertificate(url, certType, days, cert, req, caCert)) != 0) {
    return err;
  }
  if (!(err = X509_sign(cert, caKey, EVP_sha1()))) {
    return err;
  }

  writeCert(cert, result);
  return 0;
}

int createEmptyCRL(char* pemSigningKey, char* pemCaCert, int crldays,
                   int crlhours, char* result) {
  int err = 0;

  //convert to BIOs and then keys and x509 structures
  BIO* bioCert = BIO_new_mem_buf(pemCaCert, -1);
  if (!bioCert) {
    BIO_free(bioCert);
    return ERR_peek_error();
  }

  BIO* bioSigningKey = BIO_new_mem_buf(pemSigningKey, -1);
  if (!bioSigningKey) {
    BIO_free(bioCert);
    BIO_free(bioSigningKey);
    return ERR_peek_error();
  }

  X509* caCert = PEM_read_bio_X509(bioCert, NULL, NULL, NULL);
  if (!caCert) {
    BIO_free(bioCert);
    BIO_free(bioSigningKey);
    return ERR_peek_error();
  }

  EVP_PKEY* caKey = PEM_read_bio_PrivateKey(bioSigningKey, NULL, NULL, NULL);
  if (!caKey) {
    BIO_free(bioCert);
    BIO_free(bioSigningKey);
    return ERR_peek_error();
  }

  X509_CRL* crl = X509_CRL_new();

  X509_CRL_set_issuer_name(crl, X509_get_subject_name(caCert));

  //set update times (probably not essential, but why not.
  ASN1_TIME* tmptm = ASN1_TIME_new();
  X509_gmtime_adj(tmptm, long(0));
  X509_CRL_set_lastUpdate(crl, tmptm);
  X509_gmtime_adj(tmptm,(crldays*24+crlhours)*60*60);
  X509_CRL_set_nextUpdate(crl, tmptm);
  ASN1_TIME_free(tmptm);

  X509_CRL_sort(crl);

  //extensions would go here.
  if (!(err = X509_CRL_sign(crl,caKey,EVP_sha1()))) {
    BIO_free(bioCert);
    BIO_free(bioSigningKey);
    return err;
  }

  BIO *mem = BIO_new(BIO_s_mem());
  PEM_write_bio_X509_CRL(mem,crl);
  BUF_MEM *bptr;
  BIO_get_mem_ptr(mem, &bptr);
  BIO_read(mem, result, bptr->length);


  BIO_free(bioCert);
  BIO_free(bioSigningKey);
  BIO_free(mem);
  return 0;
}


int addToCRL(char* pemSigningKey, char* pemOldCrl, char* pemRevokedCert, 
             char* result) {
  int err = 0;

  BIO* bioSigningKey = BIO_new_mem_buf(pemSigningKey, -1);
  if (!bioSigningKey) {
    return ERR_peek_error();
  }
  BIO* bioRevCert = BIO_new_mem_buf(pemRevokedCert, -1);
  if (!bioRevCert) {
    BIO_free(bioSigningKey);
    return ERR_peek_error();
  }
  BIO* bioOldCRL = BIO_new_mem_buf(pemOldCrl, -1);
  if (!bioOldCRL) {
    BIO_free(bioSigningKey);
    BIO_free(bioRevCert);
    return ERR_peek_error();
  }

  X509* badCert = PEM_read_bio_X509(bioRevCert, NULL, NULL, NULL);
  if (!badCert) {
    BIO_free(bioSigningKey);
    BIO_free(bioRevCert);
    return ERR_peek_error();
  }

  EVP_PKEY* caKey = PEM_read_bio_PrivateKey(bioSigningKey, NULL, NULL, NULL);
  if (!caKey) {
    BIO_free(bioSigningKey);
    BIO_free(bioRevCert);
    return -18;
  }

  X509_CRL* crl = PEM_read_bio_X509_CRL(bioOldCRL, NULL, NULL, NULL);
  if (!crl) {
    BIO_free(bioSigningKey);
    BIO_free(bioRevCert);
    return ERR_peek_error();
  }

  X509_REVOKED* revoked = X509_REVOKED_new();
  X509_REVOKED_set_serialNumber(revoked, X509_get_serialNumber(badCert));
  ASN1_TIME* tmptm = ASN1_TIME_new();
  X509_gmtime_adj(tmptm, long(0));
  X509_REVOKED_set_revocationDate(revoked, tmptm);

  //set the reason?  Not yet.
  //    ASN1_ENUMERATED* rtmp = ASN1_ENUMERATED_new();
  //  ASN1_ENUMERATED_set(rtmp, reasonCode);
  //    goto err;
  //  if (!X509_REVOKED_add1_ext_i2d(rev, NID_crl_reason, rtmp, 0, 0))
  //    goto err;
  //  }

  if(!(err = X509_CRL_add0_revoked(crl,revoked))) {
    BIO_free(bioSigningKey);
    BIO_free(bioRevCert);
    return err;
  }

  X509_CRL_sort(crl);

  if(!(err=X509_CRL_sign(crl,caKey,EVP_sha1()))) {
    BIO_free(bioSigningKey);
    BIO_free(bioRevCert);
    return err;
  }

  BIO *mem = BIO_new(BIO_s_mem());
  PEM_write_bio_X509_CRL(mem,crl);
  BUF_MEM *bptr;
  BIO_get_mem_ptr(mem, &bptr);
  BIO_read(mem, result, bptr->length);

  BIO_free(bioRevCert);
  BIO_free(bioSigningKey);
  BIO_free(bioOldCRL);
  BIO_free(mem);

  return 0;
}


parseCertificate() {

}