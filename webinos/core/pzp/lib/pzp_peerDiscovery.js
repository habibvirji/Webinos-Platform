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
 * Copyright 2011 Ziran Sun, Samsung Electronics (UK) Ltd
 *******************************************************************************/

var PzpSIB = require("./pzp_SIB_auth.js");
var PzpPeerDiscovery = function(){
    PzpSIB.call(this);
    var PzpCommon = require("./pzp.js");
    this.discoveredPzp=[], // Store Discovered PZP details
    this.networkAddr = "";
    this.connectingPeerAddr = "";
    var logger  = PzpCommon.wUtil.webinosLogging(__filename) || console;
    var localConnectionManager = require("../../manager/localconnection_manager/lib/localconnectionmanager.js");
    this.localConnectionManager = new localConnectionManager.localconnectionManager();

  /**
   * Advertise PZP with service type "pzp". 
   * @discoveryMethod. DiscoveryMethod used. 
   * @param port. Port for advertisement. Use 4321 if not configured
   */
  this.advertPzp = function(discoveryMethod, port) {
    if(!port) port = 4321;
    this.localConnectionManager.advertPeers('pzp', discoveryMethod, port);
  };  

  /**
   * Find and connect other PZP Peers.   
   * @param parent. PZP instance
   * @param discoveryMethod. DiscoveryMethod used
   * @param tlsServerPort. TLS port for TLS peer connection
   * @param options. Other options specified by the user, e.g timeout
   * @param callback. 
   */
  this.findPzp = function(parent, discoveryMethod, tlsServerPort, options, callback){
    this.localConnectionManager.findPeers('pzp', discoveryMethod, tlsServerPort, options, function(msg){
      _parent.pzp_state.discoveredPzp[msg.name] = msg;
      logger.log("parent.pzp_state.discoveredPzp[" + msg.name + "]");
      logger.log(msg);
       
      //Filter out self
      logger.log("own session id: "  + parent.pzp_state.sessionId);
      var pzpname = msg.name + "_Pzp";
      logger.log("pzpname: " + pzpname);
      //TODO: Should also check PZH ID
           
      if(parent.pzp_state.sessionId.indexOf(pzpname) != -1)
      {
        logger.log(parent.getSessionId());
        parent.pzp_state.networkAddr = msg.address;  //store  own network address for later use
        logger.log("own address: " + parent.pzp_state.networkAddr);
      }
      else
      {
        //filter out already connected msg
        if (parent.pzp_state.connectedPzp.hasOwnProperty(msg.address) && 
        self.pzp_state.connectedPzp[msg.address].state === self.states[2])
          msg.connected = true; 
        else
          msg.connected = false; 
        callback(msg);
      }
    } );
  }; 
  
};
require("util").inherits(PzpPeerDiscovery, PzpSIB);
module.exports = PzpPeerDiscovery;
