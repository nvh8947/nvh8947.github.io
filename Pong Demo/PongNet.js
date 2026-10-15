const ROOM_PREFIX = "spong-unity-"; // change this to something unique to your project

window.PongNet = {
  peer: null,
  conn: null,
  isHost: false,

  _toUnity(method, arg) {
    if (!window.unityInstance) {
      console.warn("PongNet: unityInstance not set yet, dropping message to " + method);
      return;
    }
    window.unityInstance.SendMessage("PongNetworkManager", method, arg ?? "");
  },

  // ---- Hosting ----
  host(code) {
    this.isHost = true;
    this.peer = new Peer(ROOM_PREFIX + code);

    this.peer.on("open", () => {
      this._toUnity("OnHostReady", code);
    });

    this.peer.on("connection", (c) => {
      if (this.conn) {
        // If already have connection, don't open a new one with someone else
        c.close();
        return;
      }
      this._setupConnection(c);
    });

    this.peer.on("error", (err) => this._toUnity("OnNetError", err.type || String(err)));
  },

  // ---- Guest ----
  join(code) {
    this.isHost = false;
    this.peer = new Peer();

    this.peer.on("open", () => {
      const c = this.peer.connect(ROOM_PREFIX + code, { reliable: true });
      this._setupConnection(c);
    });

    this.peer.on("error", (err) => this._toUnity("OnNetError", err.type || String(err)));
  },

  // ---- Shared connection wiring ----
  _setupConnection(c) {
    this.conn = c;

    c.on("open", () => this._toUnity("OnConnected"));

    c.on("data", (data) => {
      // data is already a JS string (or object, if PeerJS auto-parsed it);
      // normalize to a string before handing it to Unity.
      const msg = typeof data === "string" ? data : JSON.stringify(data);
      this._toUnity("OnPacketReceived", msg);
    });

    c.on("close", () => {
      this._toUnity("OnDisconnected");
      this.conn = null;
    });

    c.on("error", (err) => this._toUnity("OnNetError", String(err)));

    // Nothing happening with this right now...
    // window.addEventListener('beforeunload', (event) => {
    //   this.conn.close;
    // });
  },

  // ---- Sending ----
  send(msgJson) {
    if (this.conn && this.conn.open) {
      this.conn.send(msgJson);
    } else {
      if (!this.conn) {
        console.warn("PongNet: sent with no connection!");
      }
      else if (!this.conn.open) {
        console.warn("PongNet: tried to send with no open connection");
      }

    }
  },

  // ---- Teardown ----
  close() {
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
    this.conn = null;
    this.peer = null;
  }
};