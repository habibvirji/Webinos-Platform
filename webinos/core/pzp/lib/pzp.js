var dependency = require("find-dependencies")(__dirname);
var rpc = require ("webinos-jsonrpc2");;
module.exports = {
  "session"     : require("./pzp_sessionHandling"),
  "dependency"  : dependency,
  "wUtil"       : dependency.global.require(dependency.global.util.location),
  "sync"        : dependency.global.require (dependency.global.manager.synchronisation_manager.location, "index"),
  "discovery"   : dependency.global.require (dependency.global.api.service_discovery.location, "lib/rpc_servicedisco").Service,
  "messageHandler": dependency.global.require (dependency.global.manager.messaging.location, "lib/messagehandler").MessageHandler,
  "modLoader"   : dependency.global.require (dependency.global.util.location, "lib/loadservice.js"),
  "PzpDiscovery": require ("./pzp_peerDiscovery"),
  "PzpSib"      : require("./pzp_SIB_auth"),
  "certExchange": require("./pzp_peerCertificateExchange.js"),
  "rpc"         : rpc,
  "os"          : require("os"),
  "https"       : require('https'),
  "http"        : require ("http"),
  "path"        : require("path"),
  "fs"          : require("fs"),
  "tls"         : require("tls"),
  "url"         : require("url"),
  "WebSocketServer":require ("websocket").server
};