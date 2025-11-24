// If you want to use Phoenix channels, run `mix help phx.gen.channel`
// to get started and then uncomment the line below.
// import "./user_socket.js"

// You can include dependencies in two ways.
//
// The simplest option is to put them in assets/vendor and
// import them using relative paths:
//
//     import "../vendor/some-package.js"
//
// Alternatively, you can `npm install some-package --prefix assets` and import
// them using a path starting with the package name:
//
//     import "some-package"
//

// Include phoenix_html to handle method=PUT/DELETE in forms and buttons.
import "phoenix_html"
// Establish Phoenix Socket and LiveView configuration.
import {Socket} from "phoenix"
import {LiveSocket} from "phoenix_live_view"
import topbar from "../vendor/topbar"
// Import Alpine.js for client-side interactivity
import Alpine from "alpinejs"

// Initialize Alpine.js
window.Alpine = Alpine
Alpine.start()

let csrfToken = document.querySelector("meta[name='csrf-token']").getAttribute("content")

// Define hooks for LiveView
let Hooks = {}

// Hook to close modal on successful upload
Hooks.CloseModal = {
  mounted() {
    this.handleEvent("close-modal", () => {
      const modal = document.getElementById("upload-modal")
      if (modal) {
        modal.classList.add("hidden")
      }
    })
  }
}

// Hook to handle reader audio playback with crossfades
Hooks.AudioCrossfade = {
  mounted() {
    console.log("AudioCrossfade mounted")
    this.currentPlayer = null
    this.currentUrl = null
    this.fadeDuration = 2000
    this.fadeInterval = 50
    this.updateFromDataset()
  },

  updated() {
    console.log("AudioCrossfade updated")
    this.updateFromDataset()
  },

  destroyed() {
    console.log("AudioCrossfade destroyed")
    this.stopCurrent()
  },

  updateFromDataset() {
    const dataset = this.el.dataset
    this.audioEnabled = dataset.audioEnabled === "true"
    this.volume = parseFloat(dataset.volume || "0.7") || 0.7
    const url = dataset.audioUrl || ""
    
    console.log("Update audio:", { enabled: this.audioEnabled, volume: this.volume, url: url, currentUrl: this.currentUrl })

    if (!this.audioEnabled || url === "") {
      console.log("Audio disabled or empty URL, stopping")
      this.stopCurrent()
      this.currentUrl = url
      return
    }

    if (url === this.currentUrl) {
      if (this.currentPlayer) {
        this.currentPlayer.volume = this.volume
        if (this.audioEnabled) {
          this.currentPlayer.play().catch(e => console.log("Play catch (same url):", e))
        }
      }
      return
    }

    console.log("Starting crossfade to:", url)
    this.crossfadeTo(url)
  },

  crossfadeTo(url) {
    const newPlayer = new Audio(url)
    newPlayer.loop = true
    newPlayer.volume = 0 // Start silent for fade in

    newPlayer.play().then(() => {
      console.log("New player started playing")
      const finalize = () => {
        this.stopCurrent()
        newPlayer.volume = this.volume
        this.currentPlayer = newPlayer
        this.currentUrl = url
        window.readerAudioPlayer = this.currentPlayer
        console.log("Crossfade finalized")
      }

      if (this.currentPlayer) {
        console.log("Fading out old player...")
        const steps = this.fadeDuration / this.fadeInterval
        const volumeStep = this.volume / steps
        let step = 0

        const oldPlayer = this.currentPlayer
        const timer = setInterval(() => {
          step += 1
          if (oldPlayer) {
            oldPlayer.volume = Math.max(0, this.volume - volumeStep * step)
          }
          newPlayer.volume = Math.min(this.volume, volumeStep * step)

          if (step >= steps) {
            clearInterval(timer)
            if (oldPlayer) {
              oldPlayer.pause()
              oldPlayer.src = ''
              oldPlayer.load()
            }
            finalize()
          }
        }, this.fadeInterval)
      } else {
        console.log("No old player, immediate start (with fade in)")
        // even if no old player, let's fade in smoothly or just jump? 
        // logic above said "newPlayer.volume = 0" then play().
        // If we just finalize, it jumps to full volume. 
        // Let's fade in the new player anyway for smoothness if it's the first track?
        // or just jump to volume. The original logic just called finalize.
        // Let's set volume to target immediately for responsiveness if it's the first track.
        newPlayer.volume = this.volume
        finalize()
      }
    }).catch((err) => {
      console.warn("Audio playback error", err)
    })
  },

  stopCurrent() {
    if (this.currentPlayer) {
      this.currentPlayer.pause()
      this.currentPlayer.src = ''
      this.currentPlayer.load()
      this.currentPlayer = null
      window.readerAudioPlayer = null
    }
  }
}

let liveSocket = new LiveSocket("/live", Socket, {
  longPollFallbackMs: 2500,
  params: {_csrf_token: csrfToken},
  hooks: Hooks,
  dom: {
    onBeforeElUpdated(from, to) {
      if (from._x_dataStack) {
        window.Alpine.clone(from, to)
      }
    }
  }
})

// Show progress bar on live navigation and form submits
topbar.config({barColors: {0: "#29d"}, shadowColor: "rgba(0, 0, 0, .3)"})
window.addEventListener("phx:page-loading-start", _info => topbar.show(300))
window.addEventListener("phx:page-loading-stop", _info => topbar.hide())

// connect if there are any LiveViews on the page
liveSocket.connect()

// expose liveSocket on window for web console debug logs and latency simulation:
// >> liveSocket.enableDebug()
// >> liveSocket.enableLatencySim(1000)  // enabled for duration of browser session
// >> liveSocket.disableLatencySim()
window.liveSocket = liveSocket

