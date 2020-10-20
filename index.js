// a little client for webrtc-signalling-middleware
class WebrtcSignalClient {
  constructor () {
    this.id = null
    this.key = null
    this.presence = []
    this.eventSource = null
    this.onConnect = () => {}
    this.onPresence = () => {}
    this.onSignal = () => {}
    this.onData = () => {}
    this.onError = (err) => console.error('Signalling Server Error:', err)
  }

  async connect (mountPath = '') {
    this.mountPath = mountPath
    const response = await window.fetch(`${this.mountPath}/connect`)
    const json = await response.json()
    this.id = json.id
    this.key = json.key
    this.onConnect(this)

    // connect event source
    const qs = new URLSearchParams([['id', this.id], ['key', this.key]])
    this.eventSource = new window.EventSource(`${this.mountPath}/events?${qs}`)
    this.eventSource.onmessage = ({ data }) => {
      const json = JSON.parse(data)

      if (json.connect) {
        json.connect.forEach(peerID => {
          if (!this.presence.includes(peerID)) this.presence.push(peerID)
        })
      }

      if (json.disconnect) {
        this.presence = this.presence.filter(peerID => !json.disconnect.includes(peerID))
      }

      if (json.presence) {
        this.presence = json.presence
      }

      if (json.presence || json.connect || json.disconnect) {
        this.onPresence(this.presence)
      }

      if (json.signal) {
        this.onSignal(json.from, json.signal)
      }

      if (json.data) {
        this.onData(json.data)
      }

      if (json.error) {
        this.disconnect()
        this.onError(json.error)
      }
    }
  }

  async disconnect () {
    this.eventSource.close()
    this.eventSource = null
    // notify server we're disconnecting immediately
    const qs = new URLSearchParams([['id', this.id], ['key', this.key]])
    await window.fetch(`${this.mountPath}/disconnect?${qs}`, { keepalive: true })
  }

  async signal (to, message) {
    const response = await window.fetch(`${this.mountPath}/send-signal/${encodeURIComponent(to)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: this.id,
        key: this.key,
        signal: message
      })
    })
    const json = await response.json()
    return json.success
  }
}

if (typeof module === 'object') {
  module.exports = WebrtcSignalClient
} else if (typeof window === 'object') {
  window.WebrtcSignalClient = WebrtcSignalClient
}
