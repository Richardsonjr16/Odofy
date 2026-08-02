import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  color: string;
}

interface DriverMapProps {
  markers?: MapMarker[];
  currentLocation?: { lat: number; lng: number } | null;
}

const SPRINGFIELD_CENTER = { lat: 37.1944, lng: -93.2844 };
const DEFAULT_ZOOM = 12;

function createLocationButton(map: google.maps.Map): HTMLDivElement {
  const controlDiv = document.createElement("div");

  // Match Google's native control style: white pill/circle with shadow
  const button = document.createElement("button");
  button.type = "button";
  button.title = "Your location";
  button.style.cssText = `
    width: 40px;
    height: 40px;
    background: #fff;
    border: none;
    border-radius: 2px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0;
    padding: 0;
  `;

  // Crosshair icon using inline SVG (matches Google Maps native look)
  button.innerHTML = `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2">
      <circle cx="12" cy="12" r="8" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
    </svg>
  `;

  button.addEventListener("click", () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    // Show loading state
    button.style.background = "#e8e8e8";
    button.style.cursor = "wait";

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        map.setCenter(loc);
        map.setZoom(16);
        button.style.background = "#4285f4"; // Google blue — indicate active
        button.querySelector("svg")!.style.stroke = "#fff";
        setTimeout(() => {
          button.style.background = "#fff";
          button.querySelector("svg")!.style.stroke = "#666";
        }, 800);
        button.style.cursor = "pointer";
      },
      () => {
        button.style.background = "#fff";
        button.style.cursor = "pointer";
        alert("Unable to retrieve your location");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  });

  controlDiv.appendChild(button);
  return controlDiv;
}

const DriverMap = forwardRef<google.maps.Map | null, DriverMapProps>(
  function DriverMap({ markers = [], currentLocation = null }, ref) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<google.maps.Map | null>(null);
    const markersRef = useRef<google.maps.Marker[]>([]);
    const overlayRef = useRef<google.maps.OverlayView | null>(null);
    const currentLocationRef = useRef(currentLocation);
    const [ready, setReady] = useState(false);
    const [mapReady, setMapReady] = useState(false);

    useImperativeHandle(ref, () => mapInstance.current, []);

    currentLocationRef.current = currentLocation;

    useEffect(() => {
      if (window.google?.maps) {
        setReady(true);
        return;
      }

      const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!key) return;

      const existing = document.getElementById("odofy-maps-script");
      if (existing) return;

      const script = document.createElement("script");
      script.id = "odofy-maps-script";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&v=weekly&loading=async&callback=odofyMapsLoaded`;
      script.async = true;
      script.defer = true;

      (window as any).odofyMapsLoaded = () => setReady(true);

      document.head.appendChild(script);

      return () => {
        delete (window as any).odofyMapsLoaded;
      };
    }, []);

    useEffect(() => {
      if (!ready || !mapRef.current || mapInstance.current) return;

      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: SPRINGFIELD_CENTER,
        zoom: DEFAULT_ZOOM,
        disableDefaultUI: false,
        zoomControl: true,
        gestureHandling: "greedy",
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [{ featureType: "poi.business", stylers: [{ visibility: "off" }] }],
      });

      // Add custom My Location button to bottom-right (Google Maps native position)
      const locationButton = createLocationButton(mapInstance.current);
      mapInstance.current.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(locationButton);

      setMapReady(true);
    }, [ready]);

    useEffect(() => {
      if (!mapInstance.current) return;

      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];

      markers.forEach((m) => {
        const marker = new window.google.maps.Marker({
          position: { lat: m.lat, lng: m.lng },
          map: mapInstance.current,
          label: { text: m.label, color: "#ffffff", fontWeight: "bold", fontSize: "14px" },
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: m.color,
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            scale: 10,
          },
        });
        markersRef.current.push(marker);
      });

      if (markers.length === 1) {
        mapInstance.current.setCenter({ lat: markers[0].lat, lng: markers[0].lng });
        mapInstance.current.setZoom(15);
      } else if (markers.length > 1) {
        const bounds = new window.google.maps.LatLngBounds();
        markers.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
        mapInstance.current.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
      }
    }, [markers]);

    useEffect(() => {
      const map = mapInstance.current;
      if (!map) return;

      if (overlayRef.current) {
        overlayRef.current.setMap(null);
        overlayRef.current = null;
      }

      if (!currentLocation) return;

      class GPSOverlay extends google.maps.OverlayView {
        private container: HTMLDivElement | null = null;

        onAdd() {
          this.container = document.createElement("div");
          this.container.style.position = "absolute";
          this.container.style.transform = "translate(-50%, -50%)";
          this.container.style.pointerEvents = "none";
          this.container.style.zIndex = "1000";

          const dot = document.createElement("div");
          dot.style.width = "20px";
          dot.style.height = "20px";
          dot.style.backgroundColor = "#5E0009";
          dot.style.borderRadius = "50%";
          dot.style.border = "3px solid #FFFFFF";
          dot.style.boxShadow = "0 0 0 4px rgba(94, 0, 9, 0.25)";
          dot.style.position = "absolute";
          dot.style.left = "50%";
          dot.style.top = "50%";
          dot.style.transform = "translate(-50%, -50%)";
          this.container.appendChild(dot);

          this.getPanes()!.overlayMouseTarget.appendChild(this.container);
        }

        draw() {
          const loc = currentLocationRef.current;
          if (!this.container || !loc) return;
          const pos = this.getProjection().fromLatLngToDivPixel(
            new google.maps.LatLng(loc.lat, loc.lng)
          );
          if (pos) {
            this.container.style.left = pos.x + "px";
            this.container.style.top = pos.y + "px";
          }
        }

        onRemove() {
          if (this.container) {
            this.container.remove();
            this.container = null;
          }
        }
      }

      overlayRef.current = new GPSOverlay();
      overlayRef.current.setMap(map);

      return () => {
        if (overlayRef.current) {
          overlayRef.current.setMap(null);
          overlayRef.current = null;
        }
      };
    }, [currentLocation, mapReady]);

    return (
      <div
        ref={mapRef}
        className="w-full h-full bg-gray-200"
      />
    );
  }
);

export default DriverMap;
