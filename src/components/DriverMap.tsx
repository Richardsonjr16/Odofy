import { useEffect, useRef, useState } from "react";

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

export default function DriverMap({
  markers = [],
  currentLocation = null,
}: DriverMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const overlayRef = useRef<google.maps.OverlayView | null>(null);
  const currentLocationRef = useRef(currentLocation);
  const [ready, setReady] = useState(false);

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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=odofyMapsLoaded`;
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
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      styles: [{ featureType: "poi.business", stylers: [{ visibility: "off" }] }],
    });
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
        console.log("GPSOverlay added, dot rendered");
        this.container = document.createElement("div");
        this.container.style.position = "absolute";
        this.container.style.transform = "translate(-50%, -50%)";
        this.container.style.pointerEvents = "none";
        this.container.style.zIndex = "1000";

        const ringWrapper = document.createElement("div");
        ringWrapper.style.position = "absolute";
        ringWrapper.style.left = "50%";
        ringWrapper.style.top = "50%";
        ringWrapper.style.transform = "translate(-50%, -50%)";

        const ring = document.createElement("div");
        ring.className = "animate-ping";
        ring.style.width = "20px";
        ring.style.height = "20px";
        ring.style.borderRadius = "50%";
        ring.style.backgroundColor = "rgba(94, 0, 9, 0.3)";
        ringWrapper.appendChild(ring);
        this.container.appendChild(ringWrapper);

        const dot = document.createElement("div");
        dot.style.width = "14px";
        dot.style.height = "14px";
        dot.style.backgroundColor = "#5E0009";
        dot.style.borderRadius = "50%";
        dot.style.border = "2px solid white";
        dot.style.boxShadow = "0 0 4px rgba(0,0,0,0.3)";
        dot.style.position = "absolute";
        dot.style.left = "50%";
        dot.style.top = "50%";
        dot.style.transform = "translate(-50%, -50%)";
        dot.style.zIndex = "1";
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
  }, [currentLocation]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full bg-gray-200"
    />
  );
}
