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
import {PageFlip} from "page-flip"

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

Hooks.Flipbook = {
  mounted() {
    this.initFlip()
  },
  updated() {
    if (this.flip) {
      const currentPage = parseInt(this.el.dataset.currentPage || "1", 10)
      const active = this.flip.getCurrentPageIndex() + 1 // flip is zero-based
      if (active !== currentPage) {
        this.flip.turnToPage(currentPage - 1)
      }
    } else {
      this.initFlip()
    }
  },
  initFlip() {
    const images = JSON.parse(this.el.dataset.images || "[]")
    if (!images.length) return

    // Split each two-page spread image into individual pages
    this.splitImagesIntoPages(images).then(singlePageImages => {
      // Measure the first split page to get aspect ratio
      const measure = new Image()
      measure.onload = () => {
        const aspect = measure.height > 0 && measure.width > 0 ? measure.height / measure.width : 1.3
        this.buildFlip(singlePageImages, aspect)
      }
      measure.onerror = () => this.buildFlip(singlePageImages, 1.3)
      measure.src = singlePageImages[0]
    })
  },

  async splitImagesIntoPages(images) {
    const singlePages = []

    for (const imageUrl of images) {
      const splitPages = await this.splitImageInHalf(imageUrl)
      singlePages.push(...splitPages)
    }

    return singlePages
  },

  splitImageInHalf(imageUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"

      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        const halfWidth = img.width / 2
        const height = img.height

        // Create left page
        canvas.width = halfWidth
        canvas.height = height
        ctx.drawImage(img, 0, 0, halfWidth, height, 0, 0, halfWidth, height)
        const leftPage = canvas.toDataURL('image/jpeg', 0.95)

        // Create right page
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, halfWidth, 0, halfWidth, height, 0, 0, halfWidth, height)
        const rightPage = canvas.toDataURL('image/jpeg', 0.95)

        resolve([leftPage, rightPage])
      }

      img.onerror = () => {
        // If splitting fails, just use the original image
        resolve([imageUrl])
      }

      img.src = imageUrl
    })
  },
  buildFlip(images, aspect) {
    const containerWidth = this.el.clientWidth || window.innerWidth
    const containerHeight = this.el.clientHeight || window.innerHeight

    // On mobile (portrait), use nearly full width; on desktop, cap at 900px
    const isMobile = window.innerWidth < 768
    const padding = isMobile ? 0 : 48
    const maxWidth = isMobile ? containerWidth : 900

    let width = Math.min(maxWidth, Math.max(320, containerWidth - padding))
    let height = Math.round(width * aspect)

    // If height exceeds available space, scale down to fit
    if (height > containerHeight) {
      height = containerHeight
      width = Math.round(height / aspect)
    }

    this.el.innerHTML = ""
    const bookEl = document.createElement("div")
    bookEl.style.width = `${width}px`
    bookEl.style.height = `${height}px`
    bookEl.style.maxWidth = "100%"
    bookEl.classList.add("mx-auto")
    this.el.appendChild(bookEl)

    this.flip = new PageFlip(bookEl, {
      width,
      height,
      maxShadowOpacity: 0.5,
      showCover: false,
      autoSize: true,
      usePortrait: true,
      mobileScrollSupport: true
    })

    const pages = images.map((url) => {
      const page = document.createElement("div")
      page.className = "page bg-slate-900 w-full h-full"
      page.style.display = "flex"
      page.style.alignItems = "center"
      page.style.justifyContent = "center"
      page.style.padding = "12px"
      page.style.boxSizing = "border-box"
      page.innerHTML =
        `<img src="${url}" loading="lazy" style="max-width:100%;max-height:100%;object-fit:contain;display:block;" />`
      return page
    })

    this.flip.loadFromHTML(pages)

    const currentPage = parseInt(this.el.dataset.currentPage || "1", 10)
    this.flip.turnToPage(currentPage - 1) // page-flip is zero-based

    this.flip.on("flip", (e) => {
      const page = e.data + 1
      this.pushEvent("turn_to_page", {page})
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
    this.playing = dataset.playing === "true"
    this.audioEnabled = dataset.audioEnabled === "true"
    const rawVolume = parseFloat(dataset.volume || "0.7") || 0.7
    
    // Effective volume is 0 if muted, otherwise the slider value
    this.volume = this.audioEnabled ? rawVolume : 0
    
    const url = dataset.audioUrl || ""
    
    console.log("Update audio:", { playing: this.playing, enabled: this.audioEnabled, volume: this.volume, url: url, currentUrl: this.currentUrl })

    if (!this.playing || url === "") {
      console.log("Audio paused or empty URL, stopping")
      this.stopCurrent()
      this.currentUrl = url // Update currentUrl so if we resume, we know what it was
      return
    }

    if (url === this.currentUrl) {
      if (this.currentPlayer) {
        this.currentPlayer.volume = this.volume
        // Ensure we are playing (e.g. if we just unpaused)
        this.currentPlayer.play().catch(e => console.log("Play catch (same url):", e))
      } else {
        // If we have the URL but no player (was stopped), start it
        this.crossfadeTo(url)
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

